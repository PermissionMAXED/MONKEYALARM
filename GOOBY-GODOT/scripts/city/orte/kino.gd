class_name OrtKino
extends OrtScene
## GOOBYWOOD — das Stadt-Kino (CITY-2 „Orte lebendig 3“): Frau Lumi
## Leinwand an der Popcorn-Kasse, Sitzreihen vor einer großen Leinwand
## mit rotem Vorhang, ein Tagesfilm (deterministisch über den Tages-Seed,
## Muster OrtLeben) und eine kleine Vorstellung: Ticket kaufen → die
## Leinwand flackert Pastellfarben, Gooby bekommt Spaß (Muster
## Funkelpark-Fahrt). Ambient-Kinogänger kommen über das OrtLeben-Muster
## von REHWEI — inklusive Popcorn-Käufer an der Kasse (SHOPS-1).

const Economy := preload("res://scripts/logic/economy.gd")

const INNEN := "res://assets/city/innen"
const MOEBEL := "res://assets/furniture"

## Ticketpreis (Münzen) und Spaß-Belohnung (Muster Funkelpark RIDE_SPASS).
const TICKET_PREIS := 15
const FILM_SPASS := 10.0
## Vorstellungs-Dauer (s) und Flacker-Takt der Leinwand.
const VORSTELLUNG_S := 6.0
const FLACKER_S := 0.4
## Leinwand-Palette (Pastell — Filmlicht, keine Disco) + Ruhe-Farbe.
const FLACKER_FARBEN: Array[String] = ["#F7E8C9", "#BFD9F2", "#F2C4D0", "#CDEBC9"]
const LEINWAND_RUHE := Color("#F5F1E6")

## Kauf-Ergebnis-Codes (schaue_film).
const KAUF_OK := "ok"
const KAUF_PLEITE := "pleite"

## Test-Hook: Reduced Motion erzwingen (-1 = AppSettings fragen).
var reduced_override := -1

var _leinwand_mat: StandardMaterial3D
var _vorstellung_rest := 0.0
var _flacker_akku := 0.0
var _flacker_index := 0


## Der Tagesfilm aus `kino.filme` (I18n-Liste, DE/EN paritätisch) —
## deterministisch über den Tages-Seed: gleicher Tag = gleicher Film.
static func heutiger_film(seed_wert := -1) -> String:
	var filme := I18nService.items("kino.filme")
	if filme.is_empty():
		return ""
	var basis := seed_wert if seed_wert >= 0 else OrtLeben.tages_seed("kino_programm")
	return String(filme[basis % filme.size()])


## Ticketkauf, atomar (Muster Funkelpark-Fahrt): Münzen weg UND Spaß
## drauf, oder nichts. PURE über dem GameState — headless testbar.
static func schaue_film(gs: Object) -> String:
	if gs == null:
		return KAUF_PLEITE
	# Einelementiges Array als Rückkanal (GDScript-Lambdas fangen per Wert).
	var bezahlt := [false]
	gs.update(
		func(state: Dictionary) -> void:
			if not Economy.spend(state["economy"], TICKET_PREIS, "kino_ticket"):
				return
			bezahlt[0] = true
			var stats: Dictionary = state["gooby"]["stats"]
			stats["fun"] = minf(100.0, float(stats.get("fun", 0.0)) + FILM_SPASS)
	)
	return KAUF_OK if bool(bezahlt[0]) else KAUF_PLEITE


func _process(delta: float) -> void:
	if _vorstellung_rest > 0.0:
		advance_vorstellung(delta)


## Vorstellung von Hand takten (vom _process ODER von Tests): die Leinwand
## wechselt im FLACKER_S-Takt durch die Pastell-Palette; Reduced Motion
## lässt sie ruhig hell leuchten. Nach VORSTELLUNG_S ist Abspann.
func advance_vorstellung(delta: float) -> void:
	if _vorstellung_rest <= 0.0 or _leinwand_mat == null:
		return
	_vorstellung_rest -= delta
	if _vorstellung_rest <= 0.0:
		_vorstellung_rest = 0.0
		_leinwand_mat.emission = LEINWAND_RUHE
		zeige_toast(I18nService.t("kino.abspann"))
		return
	if _reduziert():
		return
	_flacker_akku += delta
	while _flacker_akku >= FLACKER_S:
		_flacker_akku -= FLACKER_S
		_flacker_index = (_flacker_index + 1) % FLACKER_FARBEN.size()
		_leinwand_mat.emission = Color(FLACKER_FARBEN[_flacker_index])


## Vorstellung starten (nach gelungenem Ticketkauf oder aus Tests).
func starte_vorstellung() -> void:
	_vorstellung_rest = VORSTELLUNG_S
	_flacker_akku = 0.0
	if _leinwand_mat != null and _reduziert():
		_leinwand_mat.emission = Color(FLACKER_FARBEN[0])


func ist_vorstellung() -> bool:
	return _vorstellung_rest > 0.0


func _baue_innenraum() -> void:
	_baue_leinwand()
	# Zwei Sitzreihen Richtung Leinwand (Basisgrößen klein, s. rehwei.gd).
	for reihe in 2:
		for platz in 4:
			_prop(
				"%s/chairCushion.glb" % MOEBEL,
				Vector3(-2.4 + 1.6 * platz, 0.0, 0.3 + 1.2 * reihe),
				180.0,
				1.1
			)
	# Popcorn-Kasse rechts: Tresen, Vorratsgläser, Filmplakat-Aufsteller.
	_prop("%s/kitchencounter_straight.gltf" % INNEN, Vector3(3.6, 0.0, -1.3), 90.0, 0.9)
	_prop("%s/jar_A_large.gltf" % INNEN, Vector3(3.4, 0.85, -0.9), 20.0, 0.5)
	_prop("%s/jar_A_large.gltf" % INNEN, Vector3(3.7, 0.85, -1.8), -15.0, 0.5)
	_prop("%s/menu.gltf" % INNEN, Vector3(-4.8, 0.0, -2.8), 30.0, 1.8)
	_prop("%s/lampRoundFloor.glb" % MOEBEL, Vector3(5.6, 0.0, -0.6), 0.0, 1.1)


func _dialog_pfad() -> String:
	return "res://scripts/city/data/dialoge/kino.json"


func _npc_konfig() -> Dictionary:
	return {"tint": Color("#B58CE4"), "emotion": "happy", "pos": Vector3(3.6, 0.0, -2.2)}


## CITY-2: Ambient-Kinogänger — drei Goobys schlendern zwischen
## Sitzreihen, Plakat und Popcorn-Kasse; einer kauft an der Kasse
## (kasse_punkt vor dem Tresen — Frau Lumi piept + winkt).
func _leben_konfig() -> Dictionary:
	return {
		"besucher": 3,
		"punkte":
		[
			Vector3(-4.2, 0.0, -1.6),
			Vector3(-1.6, 0.0, 1.6),
			Vector3(1.6, 0.0, 2.2),
			Vector3(0.4, 0.0, -1.6),
			Vector3(5.0, 0.0, 0.8),
		],
		"sprueche": "kino",
		"blick": Vector3(0.0, 0.0, -6.0),
		"gemurmel": true,
		"tuer_glocke": true,
		"kasse": true,
		"kasse_punkt": Vector3(3.6, 0.0, -0.4),
	}


func _baue_ui() -> void:
	super._baue_ui()
	var programm_btn := SquishButton.new()
	programm_btn.name = "Programm"
	programm_btn.text = I18nService.t("kino.knopf")
	programm_btn.theme_type_variation = "PrimaryButton"
	programm_btn.custom_minimum_size = Vector2(220.0, 56.0)
	programm_btn.pressed.connect(_on_programm)
	_baue_knopfleiste([programm_btn], "KinoKnoepfe")


## Programm-Sheet (auch via Dialog-Effekt "laden"): Tagesfilm + Ticket.
func oeffne_laden() -> void:
	zeige_sheet(I18nService.t("kino.sheet_titel"), _programm_inhalt())


func _on_programm() -> void:
	AudioDirector.try_play(self, "ui_click")
	oeffne_laden()


func _programm_inhalt() -> Control:
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(420.0, 0.0)
	box.add_theme_constant_override("separation", 10)
	var heute := Label.new()
	heute.theme_type_variation = "CaptionLabel"
	heute.text = I18nService.t("kino.heute")
	box.add_child(heute)
	var film := Label.new()
	film.text = I18nService.t("kino.film_zeile").format({"film": heutiger_film()})
	film.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(film)
	var gs := game_state()
	var coins := int(gs.get_value("economy.coins", 0)) if gs != null else 0
	var coins_label := Label.new()
	coins_label.theme_type_variation = "CaptionLabel"
	coins_label.text = I18nService.t("city.laden.coins").format({"coins": coins})
	box.add_child(coins_label)
	var ticket := SquishButton.new()
	ticket.name = "TicketKnopf"
	ticket.theme_type_variation = "AccentButton"
	ticket.text = I18nService.t("kino.ticket").format({"preis": TICKET_PREIS})
	ticket.custom_minimum_size = Vector2(0.0, 52.0)
	ticket.disabled = coins < TICKET_PREIS
	ticket.pressed.connect(_on_ticket)
	box.add_child(ticket)
	return box


func _on_ticket() -> void:
	if schaue_film(game_state()) != KAUF_OK:
		# „Nö“-Grammatik: gescheiterte Zahlung klingt (ui_error + warn).
		AudioDirector.try_play(self, "ui_error")
		Haptics.warn(self)
		zeige_toast(I18nService.t("kino.pleite"))
		return
	# Outcome schlägt Press: erst die GELUNGENE Zahlung klingt (Grammatik).
	AudioDirector.try_play(self, "ui_buy")
	if kassen_npc != null:
		kassen_npc.kunde_zahlt()
	zeige_toast(I18nService.t("kino.film_ab"))
	starte_vorstellung()
	# Sheet zu — der Blick gehört jetzt der Leinwand.
	if _sheet != null:
		_sheet.close()


## Leinwand (leicht emissiv — „projiziert“) mit rotem Vorhang links/rechts.
func _baue_leinwand() -> void:
	var leinwand := MeshInstance3D.new()
	leinwand.name = "Leinwand"
	var flaeche := BoxMesh.new()
	flaeche.size = Vector3(5.6, 3.0, 0.12)
	_leinwand_mat = StandardMaterial3D.new()
	_leinwand_mat.albedo_color = Color(0.97, 0.96, 0.92)
	_leinwand_mat.emission_enabled = true
	_leinwand_mat.emission = LEINWAND_RUHE
	_leinwand_mat.emission_energy_multiplier = 0.55
	flaeche.material = _leinwand_mat
	leinwand.mesh = flaeche
	leinwand.position = Vector3(-0.6, 2.0, -3.75)
	add_child(leinwand)
	var vorhang_mat := StandardMaterial3D.new()
	vorhang_mat.albedo_color = Color("#A83A4B")
	vorhang_mat.roughness = 0.85
	for seite in [-1.0, 1.0]:
		var vorhang := MeshInstance3D.new()
		var stoff := BoxMesh.new()
		stoff.size = Vector3(0.7, 3.5, 0.2)
		stoff.material = vorhang_mat
		vorhang.mesh = stoff
		vorhang.position = Vector3(-0.6 + seite * 3.3, 2.0, -3.7)
		add_child(vorhang)


func _reduziert() -> bool:
	if reduced_override >= 0:
		return reduced_override == 1
	var settings := get_node_or_null("/root/AppSettings")
	return settings != null and settings.is_reduced_motion()
