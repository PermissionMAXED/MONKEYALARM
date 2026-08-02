class_name BoardResultOverlay
extends Control
## G7-P56 „Ein-Spiel-Gefühl“, Brettspiel-Ausbau: EIN Partie-Ende-Overlay im
## Minigame-RAHMEN-Look für Schach + Schiffe versenken — dieselbe Abdunkelung
## wie Pause/Results (MinigamePauseModal.DIM_COLOR), dieselbe AcCardLg-Plate,
## derselbe Gooby-Sticker der Lade-Karte (jubelt bei Sieg, steht bei
## Niederlage/Reduced Motion), SquishButtons in EINER Reihe (primäre Aktion
## zuerst) und die Rahmen-Klänge game_win/game_lose wie MinigameResults.
## Brettspiel-Anpassung statt 1:1-Results: KEINE Coins/XP-Zeilen (Brettspiele
## zahlen nicht aus), und ein Tap auf die Abdunkelung legt das Overlay
## beiseite (dismissed) — die Schlussstellung bleibt unter der 55-%-
## Abdunkelung sichtbar und soll nachbetrachtbar sein; die Szenen-Knöpfe
## (Revanche/Neue Partie/Verlassen) bleiben darunter erreichbar.

signal action_pressed(id: String)
signal dismissed

## Wunschbreite der Karte (Design-px, Muster pause_modal/results).
const CARD_BASE_WIDTH := 380.0

var _dim: ColorRect
var _card: PanelContainer
var _rows: VBoxContainer
var _gooby: LoadingVeilSticker
var _title: Label
var _reason: Label
var _button_row: HBoxContainer
## id → SquishButton der aktuellen Knopf-Reihe (set_action_enabled).
var _buttons: Dictionary = {}
var _open := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dim = ColorRect.new()
	_dim.name = "Dim"
	# DIE eine Abdunkelung des Minigame-Rahmens (Pause + Results + hier).
	_dim.color = MinigamePauseModal.DIM_COLOR
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	_dim.gui_input.connect(_on_backdrop_input)
	add_child(_dim)
	_card = PanelContainer.new()
	_card.name = "ResultCard"
	_card.theme_type_variation = &"AcCardLg"
	add_child(_card)
	_rows = VBoxContainer.new()
	_rows.add_theme_constant_override("separation", 10)
	_card.add_child(_rows)
	# Dieselbe Gooby-Präsenz wie im Results-Screen (Wipe → Pregame → Ende).
	_gooby = LoadingVeilSticker.new()
	_gooby.name = "GoobySticker"
	_gooby.custom_minimum_size = Vector2(
		MinigameResults.GOOBY_STICKER_PX, MinigameResults.GOOBY_STICKER_PX
	)
	_gooby.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	if ResourceLoader.exists(MinigameResults.GOOBY_MOTIV_PFAD):
		_gooby.set_motiv(load(MinigameResults.GOOBY_MOTIV_PFAD))
	_rows.add_child(_gooby)
	_title = Label.new()
	_title.name = "ResultTitle"
	_title.theme_type_variation = &"TitleLabel"
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_rows.add_child(_title)
	_reason = Label.new()
	_reason.name = "ResultReason"
	_reason.theme_type_variation = &"CaptionLabel"
	_reason.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reason.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_rows.add_child(_reason)
	_button_row = HBoxContainer.new()
	_button_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_button_row.add_theme_constant_override("separation", 14)
	_rows.add_child(_button_row)
	get_viewport().size_changed.connect(_relayout)


func _exit_tree() -> void:
	# Szene kann samt offenem Overlay sterben (Raum verlassen) — sonst
	# bleibt ein toter Eintrag im PanelStack zurück (Muster pause_modal).
	PanelStack.remove(self)


## Partie-Ende zeigen. cfg: {titel: String, grund: String (optional),
## sieg: bool, buttons: Array[{id, text, primary(optional)}]} — die Knöpfe
## feuern nur action_pressed(id); Navigation/Revanche gehören der Szene.
func show_result(cfg: Dictionary) -> void:
	var sieg := bool(cfg.get("sieg", false))
	_title.text = str(cfg.get("titel", ""))
	var grund := str(cfg.get("grund", ""))
	_reason.text = grund
	_reason.visible = not grund.is_empty()
	_gooby.set_animated(sieg and not _reduced_motion())
	_rebuild_buttons(cfg.get("buttons"))
	FeelSfx.play(self, "game_win" if sieg else "game_lose")
	_open = true
	visible = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	PanelStack.push(self)
	_relayout()
	_relayout_settled()
	UiMotion.pop_in(_card)
	_dim.modulate.a = 1.0
	if not _reduced_motion():
		_dim.modulate.a = 0.0
		var tween := create_tween()
		tween.tween_property(_dim, "modulate:a", 1.0, AcTokens.DUR_SHEET / 2.0)


## PanelStack-Contract (Back-Geste/Backdrop): Beiseitelegen = Brett ansehen.
func close() -> void:
	if not _open:
		return
	hide_overlay()
	dismissed.emit()


## Nur ausblenden (Revanche gestartet / neue Partie) — ohne dismissed.
func hide_overlay() -> void:
	if not _open:
		return
	_open = false
	visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	PanelStack.remove(self)


func is_open() -> bool:
	return _open


## Aktion sperren/freigeben (z. B. Revanche, solange der Server überlegt
## oder nachdem der Gegner den Raum verlassen hat).
func set_action_enabled(id: String, enabled: bool) -> void:
	var btn: Variant = _buttons.get(id)
	if btn is Button and is_instance_valid(btn):
		(btn as Button).disabled = not enabled


func _rebuild_buttons(defs: Variant) -> void:
	_buttons.clear()
	for child in _button_row.get_children():
		child.queue_free()
	if not (defs is Array):
		return
	for def: Variant in defs as Array:
		if not (def is Dictionary):
			continue
		var d := def as Dictionary
		var id := str(d.get("id", ""))
		var primary := bool(d.get("primary", false))
		var btn: Button = SquishButton.new()
		btn.name = "Action_" + id
		btn.theme_type_variation = &"PrimaryButton" if primary else &"GhostButton"
		btn.text = str(d.get("text", ""))
		btn.focus_mode = Control.FOCUS_NONE
		btn.pressed.connect(_on_action_pressed.bind(id, primary))
		_button_row.add_child(btn)
		_buttons[id] = btn


func _on_action_pressed(id: String, primary: bool) -> void:
	AudioDirector.try_play(self, "ui_confirm" if primary else "ui_back")
	action_pressed.emit(id)


func _on_backdrop_input(event: InputEvent) -> void:
	# QW #22-Muster: nur die LINKE Taste legt das Overlay beiseite.
	if not (event is InputEventMouseButton):
		return
	var mb := event as InputEventMouseButton
	if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT and PanelStack.is_top(self):
		AudioDirector.try_play(self, "ui_close")
		close()


## Kompakte, mittige Karte in der Safe-Area (Muster pause_modal._relayout):
## Breite gedeckelt, Fonts/Tippflächen über die zentralen ScreenShell-Regeln.
func _relayout() -> void:
	if _card == null or not is_inside_tree():
		return
	var m := ScreenShell.metrics(get_viewport())
	var insets: Dictionary = m["insets"]
	var canvas: Vector2 = m["canvas"]
	var width := minf(ScreenShell.card_width(m, CARD_BASE_WIDTH), canvas.x * 0.6)
	_card.custom_minimum_size = Vector2(width, 0.0)
	var d := MinigameResults.GOOBY_STICKER_PX * float(m["f"])
	_gooby.custom_minimum_size = Vector2(d, d)
	for id: Variant in _buttons:
		var btn: Variant = _buttons[id]
		if btn is Button and is_instance_valid(btn):
			ScreenShell.touch_target(btn, m)
	ScreenShell.scale_fonts(_card, m["f"])
	_card.reset_size()
	var card_size := _card.get_combined_minimum_size()
	var safe_pos := Vector2(float(insets["left"]), float(insets["top"]))
	var safe_size := Vector2(
		canvas.x - safe_pos.x - float(insets["right"]),
		canvas.y - safe_pos.y - float(insets["bottom"])
	)
	_card.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_card.position = safe_pos + (safe_size - card_size) / 2.0
	_card.size = card_size


## Autowrap-Minima stehen erst NACH dem ersten Layout-Pass — beim ersten
## Einblenden fror reset_size() sonst eine viel zu hohe Karte ein (Muster
## onboarding_guide/whats_next_hint._relayout_settled). Zwei Frames warten,
## dann die echte Größe nachziehen (fire-and-forget).
func _relayout_settled() -> void:
	var tree := get_tree()
	if tree == null:
		return
	await tree.process_frame
	await tree.process_frame
	if is_instance_valid(self) and _card != null and is_instance_valid(_card):
		_relayout()


## Reduced-Motion-Quelle wie im Rahmen-Results (AppSettings, live).
func _reduced_motion() -> bool:
	var settings := get_node_or_null("/root/AppSettings")
	if settings != null and settings.has_method("is_reduced_motion"):
		return settings.is_reduced_motion()
	return false
