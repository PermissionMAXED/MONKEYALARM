class_name AchievementsScreen
extends Control
## Erfolgs-Screen (REST-1, EVAL-VOLLSTAENDIGKEIT Rang 3): AC-Look-Vollbild
## mit Kategorie-Chips (Pflege/Spielen/Garten/Sammeln/Reisen/Fortschritt),
## Zähler-Kapsel (n/44) und einer Liste aller Katalog-Erfolge — jede Zeile
## mit Fortschrittsbalken (AchievementsEngine.progress_of gegen den echten
## Save-State). Gesperrte Erfolge werden ANGEDEUTET, nicht verraten: Name
## „???“, die Bedingung bleibt als Hinweis lesbar (Album-Mystery-Muster).
## Freigeschaltete Zeilen zeigen Name, „Freigeschaltet!“ und die Belohnung.
##
## Feier kommt IMMER vom RewardHub (achievement_celebrated: Konfetti/Toast/
## Sound laufen dort) — dieser Screen feiert die ZEILE dazu in place
## (LOOP-QUESTS-Muster mark_claimed): Name lüftet sich, Balken GLEITET auf
## voll (UiMotion.bar_to), das „Freigeschaltet!“-Badge poppt auf, die Karte
## hüpft mit Gold-Glitzer und die Zähler-Kapsel hüpft mit — OHNE Listen-
## Neubau, die Scrollposition bleibt stehen. Nur wenn die Zeile nicht im
## aktuellen Filter hängt, wird wie früher neu gebaut.
##
## Geometrie: ScreenShell (UiScale + Safe-Area + Touch-Floor), 0-Befund-Regel.

signal ready_for_reveal

const ROUTE := &"erfolge"
const ROUTES := {ROUTE: "res://scripts/ui/profil/achievements_screen.tscn"}
const ROW_SEPARATION := 10
## Balken-Höhe in Design-px (skaliert ×f — vorher fix 10 px, auf dem
## Leitformat quasi ein Haarstrich neben der f≈3-Schrift).
const BAR_HEIGHT := 10.0
## Kategorie → Balken-Identitätsfarbe (Tokens-only; Muster
## DailyQuestPanel.KATEGORIE_STYLE — die AC-Kategorien-Farbwelt statt
## sechsmal demselben Theme-Grün).
const KATEGORIE_FARBE := {
	"pflege": AcTokens.PINK,
	"spiel": AcTokens.TEAL,
	"garten": AcTokens.LEAF_DARK,
	"sammeln": AcTokens.GOLD,
	"reisen": AcTokens.STAT_HYGIENE,
	"fortschritt": AcTokens.STAT_HUNGER,
}

## Tests: Navigation abschaltbar; GameState/Katalog injizierbar.
var auto_navigate := true
var gs_override: Object = null
var catalog_override: Array = []

var _gs: Object = null
var _catalog: Array = []
var _current_cat := "alle"
var _rows_box: VBoxContainer
var _list_box: VBoxContainer
var _chip_row: HFlowContainer
var _count_chip: PanelContainer
var _count_label: Label
var _back_btn: Button
## id → Zeilen-Referenzen {card, name, bar, fortschritt, belohnung, seite}
## für die In-place-Feier + f-Nachskalierung (wird pro Filter neu gefüllt).
var _row_refs: Dictionary = {}


## Route am SceneRouter anmelden (idempotent) — der Profil-Screen springt her.
static func register_routes() -> void:
	var router := _router()
	if router != null and router.has_method("register_routes"):
		router.register_routes(ROUTES)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	register_routes()
	_gs = gs_override if gs_override != null else get_node_or_null("/root/GameState")
	_catalog = catalog_override if not catalog_override.is_empty() else AchievementsCatalog.all()
	_build_ui()
	_apply_metrics()
	get_viewport().size_changed.connect(_on_viewport_resized)
	_show_category(_current_cat)
	_attach_hub()
	ready_for_reveal.emit()


func unlocked_count() -> int:
	if _gs == null:
		return 0
	return AchievementsEngine.unlocked_count(_gs.state(), _catalog)


## Kategorie hart anwählen (Screenshots/Tests).
func show_category(cat: String) -> void:
	_show_category(cat)


func _build_ui() -> void:
	var wallpaper := AcWallpaper.new()
	wallpaper.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(wallpaper)

	_rows_box = VBoxContainer.new()
	_rows_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	# W14: 8er-Raster (12 war rasterfremd).
	_rows_box.add_theme_constant_override("separation", 16)
	add_child(_rows_box)
	_rows_box.add_child(_build_header())
	_rows_box.add_child(_build_chip_row())

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.scroll_deadzone = 24
	_rows_box.add_child(scroll)
	_list_box = VBoxContainer.new()
	_list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list_box.add_theme_constant_override("separation", ROW_SEPARATION)
	scroll.add_child(_list_box)


func _build_header() -> Control:
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	_back_btn = SquishButton.new()
	_back_btn.name = "BackBtn"
	# W14: Kopfzeilen-Konsistenz — Ghost-Outline-Pill wie Profil/Album.
	_back_btn.theme_type_variation = &"GhostButton"
	_back_btn.text = I18nService.t("achievements.zurueck")
	_back_btn.focus_mode = Control.FOCUS_NONE
	_back_btn.pressed.connect(_on_back_pressed)
	header.add_child(_back_btn)
	var title := Label.new()
	title.theme_type_variation = &"TitleLabel"
	title.text = I18nService.t("achievements.titel")
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header.add_child(title)
	_count_chip = PanelContainer.new()
	_count_chip.theme_type_variation = &"StatusCapsule"
	_count_label = Label.new()
	_count_label.theme_type_variation = &"SoftLabel"
	_count_chip.add_child(_count_label)
	header.add_child(_count_chip)
	_refresh_count()
	return header


func _build_chip_row() -> Control:
	_chip_row = HFlowContainer.new()
	_chip_row.add_theme_constant_override("h_separation", 8)
	_chip_row.add_theme_constant_override("v_separation", 8)
	var cats: Array[String] = ["alle"]
	cats.append_array(AchievementsCatalog.CATEGORIES)
	for cat in cats:
		var chip := SquishButton.new()
		chip.name = "CatChip_%s" % cat
		chip.theme_type_variation = &"AcChip"
		chip.text = I18nService.t("achievements.kategorie.%s" % cat)
		chip.focus_mode = Control.FOCUS_NONE
		chip.pressed.connect(_show_category.bind(cat))
		_chip_row.add_child(chip)
	return _chip_row


func _show_category(cat: String) -> void:
	_current_cat = cat
	_mark_active_chip()
	if _list_box == null:
		return
	_row_refs.clear()
	for child in _list_box.get_children():
		_list_box.remove_child(child)
		child.queue_free()
	var defs := _catalog if cat == "alle" else AchievementsCatalog.by_category(_catalog, cat)
	for def: Variant in defs:
		if def is Dictionary:
			_list_box.add_child(_build_row(def))
	if _list_box.get_child_count() == 0:
		# Illustrierter Leerzustand (UIFINAL-Muster: winkender Gooby) statt
		# nackter Scroll-Fläche — greift bei leer gefilterten Katalogen
		# (z. B. künftige Content-Packs), nie beim eingebauten 44er-Set.
		var empty := FriendListUi.build_empty_state(
			"achievements.leer_art", "achievements.leer", _f()
		)
		empty.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_list_box.add_child(empty)
	# W14: Zeilen federn beim Kategorie-Wechsel gestaffelt ein (ACNH-Muster;
	# UiMotion beachtet Reduced Motion selbst).
	UiMotion.stagger_in(_list_box.get_children(), 0.02)


## Aktiver Chip bekommt den Leaf-Ton (aktiver-Tab-Konvention).
func _mark_active_chip() -> void:
	if _chip_row == null:
		return
	for chip in _chip_row.get_children():
		if chip is Button:
			var active := str(chip.name) == "CatChip_%s" % _current_cat
			(chip as Button).self_modulate = AcTokens.LEAF if active else AcTokens.WHITE


func _build_row(def: Dictionary) -> Control:
	var id := str(def.get("id", ""))
	var unlocked := _gs != null and AchievementsEngine.is_unlocked(_gs.state(), id)
	var card := PanelContainer.new()
	card.name = "Erfolg_%s" % id
	card.theme_type_variation = &"AcCard"
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	card.add_child(row)

	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 4)
	row.add_child(body)
	var name_label := Label.new()
	name_label.name = "Name"
	name_label.theme_type_variation = &"HeadlineLabel"
	# Angedeutet, nicht verraten: gesperrte Erfolge zeigen „???“ als Namen,
	# die Bedingung darunter bleibt der Sammel-Hinweis (Album-Mystery-Regel).
	name_label.text = (
		I18nService.t("achievements.defs.%s.name" % id)
		if unlocked
		else I18nService.t("achievements.geheim")
	)
	if not unlocked:
		name_label.add_theme_color_override("font_color", AcTokens.INK_FAINT)
	body.add_child(name_label)
	var desc := Label.new()
	desc.name = "Desc"
	desc.theme_type_variation = &"SoftLabel"
	desc.text = I18nService.t("achievements.defs.%s.desc" % id)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(desc)
	var refs := {"card": card, "name": name_label}
	body.add_child(_build_progress(def, unlocked, refs))

	var side := VBoxContainer.new()
	side.alignment = BoxContainer.ALIGNMENT_CENTER
	side.add_theme_constant_override("separation", 4)
	row.add_child(side)
	if unlocked:
		side.add_child(_build_badge())
	var coins := Label.new()
	coins.name = "Belohnung"
	coins.theme_type_variation = &"SoftLabel"
	coins.text = I18nService.t("achievements.belohnung", {"coins": int(def.get("coins", 0))})
	coins.add_theme_color_override(
		"font_color", AcTokens.YELLOW_DARK if unlocked else AcTokens.INK_FAINT
	)
	side.add_child(coins)
	refs["seite"] = side
	refs["belohnung"] = coins
	_row_refs[id] = refs
	return card


## „Freigeschaltet!“-Badge (Zeilen-Bau + In-place-Feier teilen den Bauplan).
func _build_badge() -> Label:
	var badge := Label.new()
	badge.name = "Freigeschaltet"
	badge.theme_type_variation = &"SoftLabel"
	badge.text = I18nService.t("achievements.freigeschaltet")
	badge.add_theme_color_override("font_color", AcTokens.LEAF_DARK)
	return badge


func _build_progress(def: Dictionary, unlocked: bool, refs: Dictionary) -> Control:
	var wrap := HBoxContainer.new()
	wrap.add_theme_constant_override("separation", 8)
	# Immer der ECHTE Zielwert aus der Bedingung: freigeschaltete Zeilen
	# lasen sich vorher als „1/1“, obwohl der Erfolg z. B. 100 Fütterungen
	# verlangte — jetzt steht dort verdient „100/100“.
	var progress := AchievementsEngine.progress_of(def, _gs.state() if _gs != null else {})
	if unlocked:
		progress["current"] = progress["target"]
	var bar := ProgressBar.new()
	bar.name = "Fortschritt"
	bar.min_value = 0.0
	bar.max_value = float(progress["target"])
	bar.value = float(progress["current"])
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0.0, roundf(BAR_HEIGHT * _f()))
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# Kategorie-Identitätsfarbe als Pill-Fill (Tokens-only, Theme-Track
	# bleibt) — die Farbwelt der Chips zieht in die Balken ein.
	var fill := StyleBoxFlat.new()
	fill.bg_color = KATEGORIE_FARBE.get(str(def.get("cat", "")), AcTokens.LEAF)
	fill.set_corner_radius_all(AcTokens.RADIUS_PILL)
	bar.add_theme_stylebox_override("fill", fill)
	wrap.add_child(bar)
	var label := Label.new()
	label.name = "FortschrittText"
	label.theme_type_variation = &"SoftLabel"
	label.text = (I18nService.t(
		"achievements.fortschritt",
		{"current": int(progress["current"]), "target": int(progress["target"])}
	))
	wrap.add_child(label)
	refs["bar"] = bar
	refs["fortschritt"] = label
	return wrap


func _refresh_count() -> void:
	if _count_label == null:
		return
	_count_label.text = (I18nService.t(
		"achievements.zaehler", {"n": unlocked_count(), "total": _catalog.size()}
	))


## RewardHub feiert (Konfetti/Toast/Sound dort) — dieser Screen zieht die
## Zeile + den Zähler nach.
func _attach_hub() -> void:
	var hub := RewardHub.find(self)
	if hub != null and hub.has_signal("achievement_celebrated"):
		hub.achievement_celebrated.connect(celebrate)


## Feier-Moment am Screen: Zähler-Kapsel hüpft mit dem neuen Stand, die
## betroffene Zeile feiert IN PLACE (kein Listen-Neubau → Scrollposition
## bleibt). Hängt die Zeile nicht im aktuellen Filter, baut der Altweg um.
func celebrate(def: Dictionary) -> void:
	_refresh_count()
	if _count_chip != null and is_instance_valid(_count_chip):
		UiMotion.bounce(_count_chip)
	if not _celebrate_row(str(def.get("id", ""))):
		_show_category(_current_cat)


## LOOP-QUESTS-Muster mark_claimed: Name lüftet sich („???“ → echter Name),
## Balken GLEITET auf voll (UiMotion.bar_to statt Wertesprung), Zieltext
## wird „n/n“, das Badge poppt auf, die Belohnung färbt sich gold und die
## Karte hüpft mit Gold-Glitzer. Alles Reduced-Motion-gegated in UiMotion.
func _celebrate_row(id: String) -> bool:
	var refs: Dictionary = _row_refs.get(id, {})
	if refs.is_empty() or not is_instance_valid(refs.get("card")):
		return false
	var name_label := refs["name"] as Label
	name_label.text = I18nService.t("achievements.defs.%s.name" % id)
	name_label.remove_theme_color_override("font_color")
	var bar := refs["bar"] as ProgressBar
	UiMotion.bar_to(bar, bar.max_value)
	(refs["fortschritt"] as Label).text = (I18nService.t(
		"achievements.fortschritt", {"current": int(bar.max_value), "target": int(bar.max_value)}
	))
	(refs["belohnung"] as Label).add_theme_color_override("font_color", AcTokens.YELLOW_DARK)
	var side := refs["seite"] as Container
	if side.get_node_or_null("Freigeschaltet") == null:
		var badge := _build_badge()
		side.add_child(badge)
		side.move_child(badge, 0)
		UiMotion.pop_in(badge)
	var card := refs["card"] as Control
	UiMotion.bounce(card)
	UiMotion.sparkle(card, AcTokens.GOLD)
	return true


func _on_viewport_resized() -> void:
	if not is_inside_tree():
		return
	_apply_metrics()


func _apply_metrics() -> void:
	var m := ScreenShell.metrics(get_viewport())
	# Inhaltsspalte W16: zentriert + breiten-gedeckelt statt voller Safe-Breite.
	ScreenShell.content_frame(_rows_box, m)
	ScreenShell.scale_fonts(self, m["f"])
	ScreenShell.touch_target(_back_btn, m)
	if _chip_row != null:
		for chip in _chip_row.get_children():
			if chip is Control:
				ScreenShell.touch_target(chip, m)
	# Balken-Höhe wächst mit f (Rotation/Resize ohne Listen-Neubau) — fix
	# 10 px war neben f≈3-Schrift auf dem Leitformat ein Haarstrich.
	for refs: Dictionary in _row_refs.values():
		var bar: Variant = refs.get("bar")
		if bar is ProgressBar and is_instance_valid(bar):
			(bar as ProgressBar).custom_minimum_size.y = roundf(BAR_HEIGHT * float(m["f"]))


## UiScale-f für Bauzeit-Maße (außerhalb des Baums: Design-Basis 1.0).
func _f() -> float:
	if not is_inside_tree():
		return 1.0
	return float(ScreenShell.metrics(get_viewport())["f"])


func _on_back_pressed() -> void:
	if not auto_navigate:
		return
	var router := _router()
	if router == null or not router.has_method("goto"):
		return
	if router.has_method("handle_back_request") and router.handle_back_request():
		return
	var routes: Variant = router.get("_routes")
	if routes is Dictionary and (routes as Dictionary).has(&"home"):
		router.goto(&"home", {})


static func _router() -> Node:
	var loop := Engine.get_main_loop()
	if not (loop is SceneTree):
		return null
	return (loop as SceneTree).root.get_node_or_null("/root/SceneRouter")
