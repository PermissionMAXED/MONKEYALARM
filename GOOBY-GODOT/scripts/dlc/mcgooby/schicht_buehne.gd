class_name McGoobySchichtBuehne
extends VBoxContainer
## Die Stations-Bühne der McGooby-Schicht (Welle B, Doc §2.2): EIN Control
## trägt die sichtbare Station — Grill (Patty-Knopf + Gar-Balken) ODER
## Belegstation (Ticket-Turm + Zutaten-Leiste in der Daumen-Zone). Die Szene
## bleibt Dirigent (Punkte, Ablauf, Overlays); die Bühne baut nur Optik +
## Eingabeflächen und meldet Taps als Signale zurück — so bleibt die
## Schicht-Szene unter dem Datei-Deckel und künftige Stationen (Fritteuse,
## Shake-Bar) docken hier an, ohne die Szene aufzublähen.

signal patty_getippt
signal zutat_getippt(zutat_id: String)

## Ticket-Chip-Farben (dezent — die Bühne gehört den Zutaten, nicht den Chips).
const FARBE_CHIP_OFFEN := Color("#6B4A2B")
const FARBE_CHIP_NAECHSTE := Color("#B8860B")
const FARBE_CHIP_FERTIG := Color("#8FA37E")

## Wunschgröße des Patty-Knopfs (Design-px, skaliert mit f; nie unter Floor).
const PATTY_BASIS := 168.0

var _station_chip: Label
var _grill_gruppe: VBoxContainer
var _patty_btn: Button
var _garbar: ProgressBar
var _belegen_gruppe: VBoxContainer
var _ticket_turm: VBoxContainer
var _leiste: HFlowContainer
var _ticket: Array[String] = []
var _chips: Array[Label] = []
var _zutaten_knoepfe: Dictionary = {}
var _m: Dictionary = {}


func _ready() -> void:
	add_theme_constant_override("separation", 14)
	alignment = BoxContainer.ALIGNMENT_CENTER
	_station_chip = Label.new()
	_station_chip.name = "StationSchild"
	_station_chip.theme_type_variation = &"CaptionLabel"
	_station_chip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_station_chip.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	add_child(_station_chip)
	_baue_grill()
	_baue_belegen()
	zeige_grill()


func _baue_grill() -> void:
	_grill_gruppe = VBoxContainer.new()
	_grill_gruppe.name = "GrillGruppe"
	_grill_gruppe.add_theme_constant_override("separation", 14)
	_grill_gruppe.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(_grill_gruppe)
	_patty_btn = SquishButton.new()
	_patty_btn.name = "PattyKnopf"
	_patty_btn.focus_mode = Control.FOCUS_NONE
	_patty_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_patty_btn.pressed.connect(func() -> void: patty_getippt.emit())
	_grill_gruppe.add_child(_patty_btn)
	_garbar = ProgressBar.new()
	_garbar.name = "GarBalken"
	_garbar.min_value = 0.0
	_garbar.max_value = 1.0
	_garbar.show_percentage = false
	_garbar.custom_minimum_size = Vector2(0.0, 10.0)
	_grill_gruppe.add_child(_garbar)


func _baue_belegen() -> void:
	_belegen_gruppe = VBoxContainer.new()
	_belegen_gruppe.name = "BelegenGruppe"
	_belegen_gruppe.add_theme_constant_override("separation", 12)
	_belegen_gruppe.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(_belegen_gruppe)
	_ticket_turm = VBoxContainer.new()
	_ticket_turm.name = "TicketTurm"
	_ticket_turm.add_theme_constant_override("separation", 2)
	_ticket_turm.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_belegen_gruppe.add_child(_ticket_turm)
	# Zutaten-Leiste in der Daumen-Zone: HFlow bricht auf schmalen Canvases
	# selbst um — keine Menü-Tiefe im Rush (Doc §2.2/#10).
	_leiste = HFlowContainer.new()
	_leiste.name = "ZutatenLeiste"
	_leiste.add_theme_constant_override("h_separation", 10)
	_leiste.add_theme_constant_override("v_separation", 10)
	_leiste.alignment = FlowContainer.ALIGNMENT_CENTER
	_belegen_gruppe.add_child(_leiste)


## ---------------------------------------------------------------- Stationen


func zeige_grill() -> void:
	_grill_gruppe.visible = true
	_belegen_gruppe.visible = false


func zeige_belegen() -> void:
	_grill_gruppe.visible = false
	_belegen_gruppe.visible = true


func station_beschriften(text: String) -> void:
	_station_chip.text = text


## ---------------------------------------------------------------- Grill


func patty_knopf() -> Button:
	return _patty_btn


## Reine Darstellung — Zustand/Farben entscheidet die Szene (Logik-Quelle).
func patty_darstellen(hinweis: String, farbe: Color, text_farbe: Color, wert: float) -> void:
	if _patty_btn == null:
		return
	_patty_btn.text = hinweis
	_patty_btn.add_theme_color_override("font_color", text_farbe)
	_patty_btn.add_theme_color_override("font_pressed_color", text_farbe)
	_patty_btn.add_theme_color_override("font_hover_color", text_farbe)
	var stil := StyleBoxFlat.new()
	stil.bg_color = farbe
	stil.set_corner_radius_all(int(_patty_btn.custom_minimum_size.y / 2.0))
	_patty_btn.add_theme_stylebox_override("normal", stil)
	_patty_btn.add_theme_stylebox_override("hover", stil)
	_patty_btn.add_theme_stylebox_override("pressed", stil)
	_garbar.value = clampf(wert, 0.0, 1.0)


## ---------------------------------------------------------------- Belegen


## Baut Ticket-Turm + Zutaten-Leiste für eine Bestellung neu auf. Der Turm
## wird wie ein echter Burger gezeigt: unterste Lage (ticket[0]) UNTEN.
func belegen_fuellen(ticket: Array[String], leiste_ids: Array[String]) -> void:
	_ticket = ticket.duplicate()
	for kind in _ticket_turm.get_children():
		kind.queue_free()
	_chips = []
	for i in _ticket.size():
		var chip := Label.new()
		chip.name = "Lage_%d" % i
		chip.theme_type_variation = &"SoftLabel"
		chip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chip.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		_chips.append(chip)
	# Oberste Lage zuerst ins VBox — Anzeige von oben nach unten.
	for i in range(_ticket.size() - 1, -1, -1):
		_ticket_turm.add_child(_chips[i])
	for kind in _leiste.get_children():
		kind.queue_free()
	_zutaten_knoepfe = {}
	for zutat_id in leiste_ids:
		var knopf := SquishButton.new()
		knopf.name = "Zutat_" + zutat_id
		knopf.theme_type_variation = &"BtnTeal"
		knopf.text = zutat_name(zutat_id)
		knopf.focus_mode = Control.FOCUS_NONE
		knopf.pressed.connect(_on_zutat_pressed.bind(zutat_id))
		_leiste.add_child(knopf)
		_zutaten_knoepfe[zutat_id] = knopf
	lage_markieren(0)
	_knopf_floors()


## Turm-Fortschritt anzeigen: erledigte Lagen ✓, die nächste leuchtet.
func lage_markieren(platziert: int) -> void:
	for i in _chips.size():
		var chip := _chips[i]
		if i < platziert:
			chip.text = "✓ " + zutat_name(_ticket[i])
			chip.add_theme_color_override("font_color", FARBE_CHIP_FERTIG)
		elif i == platziert:
			chip.text = "▶ " + zutat_name(_ticket[i])
			chip.add_theme_color_override("font_color", FARBE_CHIP_NAECHSTE)
		else:
			chip.text = zutat_name(_ticket[i])
			chip.add_theme_color_override("font_color", FARBE_CHIP_OFFEN)


func zutat_knopf(zutat_id: String) -> Button:
	return _zutaten_knoepfe.get(zutat_id)


## Fehlgriff-Feedback: der gedrückte Knopf schüttelt den Kopf (UiMotion).
func zutat_wackeln(zutat_id: String) -> void:
	var knopf: Button = _zutaten_knoepfe.get(zutat_id)
	if knopf != null:
		UiMotion.schuetteln(knopf)


## Lokalisierter Zutaten-Name (Fallback: lesbare Id für künftige Pack-Zutaten).
static func zutat_name(zutat_id: String) -> String:
	var key := "dlc_mcgooby.zutat." + zutat_id
	var text := I18nService.t(key)
	if text == key:
		return zutat_id.capitalize()
	return text


## ---------------------------------------------------------------- Metriken


func apply_metrics(m: Dictionary) -> void:
	_m = m
	var f := float(m.get("f", 1.0))
	var patty_seite := maxf(float(m.get("floor_px", 44.0)), PATTY_BASIS * f)
	_patty_btn.custom_minimum_size = Vector2(patty_seite, patty_seite)
	_garbar.custom_minimum_size = Vector2(patty_seite, 10.0 * f)
	_knopf_floors()


## Zutaten-Knöpfe sind echte Tippflächen (44-pt-Regel).
func _knopf_floors() -> void:
	if _m.is_empty():
		return
	for zutat_id: String in _zutaten_knoepfe:
		ScreenShell.touch_target(_zutaten_knoepfe[zutat_id], _m)


func _on_zutat_pressed(zutat_id: String) -> void:
	zutat_getippt.emit(zutat_id)
