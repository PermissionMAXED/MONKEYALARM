extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „Stadt“ (PT-CITY): Boot → Onboarding → Stadt über den HUD-Reise-Knopf
## (BtnReise) → Ausparken + freie Fahrt (Bewegungs-Check + Lenken) → REHWEI
## (Parkplatz-Prompt → Betreten → Dialog „Einkaufen!“ → Kauf im HaendlerSheet
## → Sheet zu → „‹ Raus“) → Flughafen → „Reise buchen ✈“ → Glitzermeer →
## Buchen → Taxi (Dev-Key `debug.taxi_warte_s`) → Einsteigen → Boarding-Pass
## „Gute Reise!“ → Abflug-Cutscene → zuhause, Gooby im Urlaub.
##
## FAHR-ABKÜRZUNG (ehrlich dokumentiert): llvmpipe rendert das Leitformat mit
## wenigen FPS und die Stadt ist groß — minutenlange Blindfahrten sind mit
## synthetischen Taps nicht sinnvoll steuerbar. Der Flow fährt deshalb kurz
## SELBST (Ausparken + Lenk-Halte, Bewegungs-Check) und teleportiert das Auto
## dann per tue-Schritt an die Parkplätze (auto.teleport + set_frozen, beides
## öffentliche Test-Hooks). Prompt/Betreten/Läden/Reise laufen danach exakt
## wie beim echten Spieler. TESTGELD: Der Strand kostet 190 ᴳ, ein frischer
## Save hat 100 — ein tue-Schritt schenkt Münzen (klar als Harness-Eingriff
## markiert), sonst wäre die Reise im Playtest unerreichbar.
## Aufruf: tools/ci/run_playtest.sh flow_stadt

const EconomyLogic := preload("res://scripts/logic/economy.gd")

## Testgeld fürs Reisebüro (Strand 180 + Taxi 10, plus Puffer).
const TESTGELD := 250
## Verkürzte Taxi-Wartezeit (Dev-Key, s. ReiseApp.warte_s).
const TAXI_WARTE_S := 4

var _fahrt_start := Vector3.ZERO
var _muenzen_vor := 0
## Von den „sichtbar machen“-tue-Schritten gemerkter Knopf (Kauf/Ziel).
var _merk_knopf: Control


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	liste.append_array(_stadt_schritte())
	liste.append_array(_laden_schritte())
	liste.append_array(_reise_schritte())
	return liste


## Stadt betreten + kurze freie Fahrt (Ausparken, Bewegung, Lenken).
func _stadt_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "stadt_oeffnen",
			"aktion": "tipp_name",
			"node": "BtnReise",
			"erwarte": {"route": "city"},
			"timeout_s": 150.0,
		},
		{"name": "stadt_ansehen", "aktion": "warte", "sekunden": 3.0},
		{"name": "fahrt_merken", "aktion": "tue", "funktion": _merke_fahrt_start},
		{
			"name": "fahrt_pruefen",
			"aktion": "warte_bis",
			"bedingung": _auto_bewegt_sich,
			"timeout_s": 60.0,
		},
		# Lenken wie ein Spieler (rechte Daumen-Zone halten) — beendet
		# zugleich das automatische Ausparken (manuelle Eingabe gewinnt).
		{
			"name": "lenken_rechts",
			"aktion": "halte",
			"pos_rel": Vector2(0.8, 0.5),
			"dauer_s": 1.2,
		},
		{"name": "weiterfahren", "aktion": "warte", "sekunden": 2.0},
	]


## REHWEI: Prompt → Betreten → Dialog → Laden-Sheet → Kauf → Raus.
func _laden_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "park_bei_rehwei",
			"aktion": "tue",
			"funktion": _parke_bei.bind("rehwei"),
			"erwarte": {"text": "REHWEI betreten"},
			"timeout_s": 30.0,
		},
		{
			"name": "rehwei_betreten",
			"aktion": "tipp_text",
			"text": "Betreten",
			"erwarte": {"route": "city/ort/rehwei"},
			"timeout_s": 90.0,
		},
		{"name": "dialog_ansehen", "aktion": "warte", "sekunden": 2.0},
		# Dialog wie ein Spieler durchtippen: Tap 1 auf die Bubble zeigt die
		# ganze Zeile (Typewriter-Skip), Tap 2 blättert weiter — erst DANACH
		# erscheinen die Options-Knöpfe (OrtDialogView._on_bubble_finished).
		{
			"name": "dialog_zeile_komplett",
			"aktion": "tipp_falls_da",
			"node": "TypewriterTapFang",
			"timeout_s": 10.0,
		},
		{
			"name": "dialog_weiter",
			"aktion": "tipp_falls_da",
			"node": "TypewriterTapFang",
			"timeout_s": 8.0,
		},
		{
			"name": "einkaufen_waehlen",
			"aktion": "tipp_text",
			"text": "Einkaufen!",
			"timeout_s": 60.0,
		},
		# Frau Rehwalds Kassen-Zeile ebenfalls durchtippen — der „laden“-
		# Effekt (Sheet öffnet) feuert erst, wenn die Bubble fertig ist.
		{
			"name": "kasse_zeile_komplett",
			"aktion": "tipp_falls_da",
			"node": "TypewriterTapFang",
			"timeout_s": 10.0,
		},
		# Je nach Typewriter-Timing ist die Bubble hier schon fertig und der
		# Fang weg — deshalb kurzer falls-da-Tap und die eigentliche Erwartung
		# (Sheet offen) als eigener warte-Schritt mit großzügigem Timeout.
		{
			"name": "kasse_weiter",
			"aktion": "tipp_falls_da",
			"node": "TypewriterTapFang",
			"timeout_s": 8.0,
		},
		{
			"name": "laden_sheet_da",
			"aktion": "warte_bis",
			"klasse": "HaendlerSheet",
			"timeout_s": 45.0,
		},
		{"name": "muenzen_merken", "aktion": "tue", "funktion": _merke_muenzen},
		# Kauf-Knopf gezielt: erster NICHT ausgegrauter „N ᴳ“-Knopf, per
		# ensure_control_visible ins Bild gescrollt (Blind-Taps auf geclippte
		# Scroll-Inhalte treffen sonst den Backdrop und schließen das Sheet).
		{"name": "ware_sichtbar_machen", "aktion": "tue", "funktion": _merke_kauf_knopf},
		{
			"name": "ware_kaufen",
			"aktion": "tipp_pos",
			"pos_funktion": _merk_knopf_mitte,
			"erwarte": {"bedingung": _muenzen_gesunken},
			"timeout_s": 30.0,
		},
		# Backdrop-Tipp oben schließt das oberste PanelSheet (G7/P53).
		{
			"name": "laden_sheet_zu",
			"aktion": "tipp_pos",
			"pos_rel": Vector2(0.5, 0.06),
			"erwarte": {"weg_klasse": "HaendlerSheet"},
			"timeout_s": 30.0,
		},
		{
			"name": "rehwei_raus",
			"aktion": "tipp_text",
			"text": "Raus",
			"erwarte": {"route": "city"},
			"timeout_s": 120.0,
		},
	]


## Flughafen: Reise-App → Ziel → Buchen → Taxi → Cutscene → zuhause.
func _reise_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "park_bei_flughafen",
			"aktion": "tue",
			"funktion": _parke_bei.bind("flughafen"),
			"erwarte": {"text": "Flughafen betreten"},
			"timeout_s": 30.0,
		},
		{
			"name": "flughafen_betreten",
			"aktion": "tipp_text",
			"text": "Betreten",
			"erwarte": {"route": "city/ort/flughafen"},
			"timeout_s": 90.0,
		},
		# Harness-Eingriffe (klar markiert): Testgeld + kurzes Taxi.
		{"name": "testgeld_und_dev_taxi", "aktion": "tue", "funktion": _testgeld_und_dev_taxi},
		{
			"name": "reise_app_oeffnen",
			"aktion": "tipp_text",
			"text": "Reise buchen",
			"erwarte": {"klasse": "ReiseApp"},
			"timeout_s": 60.0,
		},
		# Die Ziel-Liste liegt im Querformat UNTER der Falz des Sheets —
		# erst zum Glitzermeer-Knopf scrollen, dann gezielt antippen
		# („Doch nicht“ ist der eindeutige Beleg für die Bestätigungs-Seite).
		{"name": "ziel_sichtbar_machen", "aktion": "tue", "funktion": _merke_ziel_knopf},
		{
			"name": "ziel_glitzermeer",
			"aktion": "tipp_pos",
			"pos_funktion": _merk_knopf_mitte,
			"erwarte": {"text": "Doch nicht"},
			"timeout_s": 30.0,
		},
		{
			"name": "reise_buchen",
			"aktion": "tipp_name",
			"node": "BuchenKnopf",
			"erwarte": {"text": "unterwegs"},
			"timeout_s": 30.0,
		},
		{
			"name": "taxi_warten",
			"aktion": "warte_bis",
			"text": "Einsteigen!",
			"timeout_s": 90.0,
		},
		{
			"name": "einsteigen",
			"aktion": "tipp_text",
			"text": "Einsteigen!",
			"erwarte": {"text": "Gute Reise"},
			"timeout_s": 30.0,
		},
		{
			"name": "gute_reise",
			"aktion": "tipp_text",
			"text": "Gute Reise",
			"erwarte": {"route": "home/living"},
			"timeout_s": 240.0,
		},
		{
			"name": "urlaub_pruefen",
			"aktion": "tue",
			"funktion": _urlaub_aktiv,
			"erwartung": "vacation.phase == away (Ziel beach)",
		},
		{"name": "abschluss_wohnzimmer", "aktion": "warte", "sekunden": 2.0},
	]


## ---------------------------------------------------------------- Helfer


## CityScene mit fertig gebautem Auto ({} solange Route/Aufbau fehlen).
func _stadt_szene() -> Node:
	var szene := aktuelle_szene()
	if szene == null or not ("auto" in szene) or szene.auto == null:
		return null
	return szene


func _merke_fahrt_start() -> bool:
	var szene := _stadt_szene()
	if szene == null:
		return false
	_fahrt_start = szene.auto.position
	return true


## Bewegungs-Check der freien Fahrt: > 3 m vom gemerkten Punkt entfernt.
func _auto_bewegt_sich() -> bool:
	var szene := _stadt_szene()
	if szene == null:
		return false
	return szene.auto.position.distance_to(_fahrt_start) > 3.0


## Fahr-Abkürzung: Auto an den Parkplatz des Orts stellen und einfrieren
## (öffentliche CarController-Hooks) — der Prompt erscheint wie beim
## echten Heranfahren, bleibt aber fürs Antippen stabil stehen.
func _parke_bei(ort_id: String) -> bool:
	var szene := _stadt_szene()
	if szene == null:
		return false
	var park: Vector3 = szene.karte.parkplatz_welt(ort_id)
	szene.auto.teleport(park.x, park.z)
	szene.auto.set_frozen(true)
	return true


## Ersten kaufbaren „N ᴳ“-Knopf im HaendlerSheet merken + hinscrollen.
func _merke_kauf_knopf() -> bool:
	var sheet := _suche_control(func(c: Control) -> bool: return c is HaendlerSheet)
	if sheet == null:
		return false
	var knopf := _suche_control(
		func(c: Control) -> bool:
			if not (c is BaseButton) or bool(c.get("disabled")):
				return false
			return str(c.get("text")).contains("ᴳ"),
		sheet
	)
	return _scrolle_und_merke(knopf)


## Glitzermeer-Ziel-Knopf in der Reise-App merken + hinscrollen.
func _merke_ziel_knopf() -> bool:
	var app := _suche_control(func(c: Control) -> bool: return c is ReiseApp)
	if app == null:
		return false
	var knopf := _suche_control(
		func(c: Control) -> bool:
			return c is BaseButton and str(c.get("text")).contains("Glitzermeer"),
		app
	)
	return _scrolle_und_merke(knopf)


## Kanvas-Mitte des gemerkten Knopfs (tipp_pos-„pos_funktion“).
func _merk_knopf_mitte() -> Vector2:
	if _merk_knopf == null or not is_instance_valid(_merk_knopf):
		return Vector2.ZERO
	return _merk_knopf.get_global_rect().get_center()


## Knopf über ALLE ScrollContainer-Vorfahren ins Bild holen und merken —
## das ist die Harness-Fassung von „der Spieler scrollt die Liste“. Alle
## Ebenen, weil PanelSheet (SheetScroll) und Sheet-Inhalt (z. B. die
## Regal-Liste) jeweils eigene ScrollContainer stapeln können; der Knopf
## muss in jedem davon sichtbar werden, sonst tippt tipp_pos ins Geclippte.
func _scrolle_und_merke(knopf: Control) -> bool:
	if knopf == null:
		return false
	var eltern := knopf.get_parent()
	while eltern != null:
		if eltern is ScrollContainer:
			(eltern as ScrollContainer).ensure_control_visible(knopf)
		eltern = eltern.get_parent()
	_merk_knopf = knopf
	return true


## Erstes sichtbares Control, auf das `passt` zutrifft — Tiefensuche in
## Dokument-Reihenfolge (Kinder rückwärts auf den Stapel), damit „erster
## Treffer“ deterministisch der oberste Listeneintrag ist.
func _suche_control(passt: Callable, wurzel: Node = null) -> Control:
	var stapel: Array[Node] = [wurzel if wurzel != null else harness.root]
	while not stapel.is_empty():
		var aktuell: Node = stapel.pop_back()
		if aktuell is Control:
			var c := aktuell as Control
			if c.is_visible_in_tree() and bool(passt.call(c)):
				return c
		var kinder := aktuell.get_children()
		for i in range(kinder.size() - 1, -1, -1):
			stapel.append(kinder[i])
	return null


func _merke_muenzen() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	_muenzen_vor = int(gs.get_value("economy.coins", 0))
	return true


func _muenzen_gesunken() -> bool:
	var gs := game_state()
	return gs != null and int(gs.get_value("economy.coins", 0)) < _muenzen_vor


## Harness-Eingriff: Reisegeld schenken (Economy-Ledger, Grund "playtest")
## und die Taxi-Wartezeit über den Dev-Key verkürzen (ReiseApp.warte_s).
func _testgeld_und_dev_taxi() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	gs.update(
		func(state: Dictionary) -> void: EconomyLogic.award(state["economy"], TESTGELD, "playtest")
	)
	var settings := harness.root.get_node_or_null("/root/AppSettings")
	if settings == null:
		return false
	settings.set_setting("debug.taxi_warte_s", TAXI_WARTE_S)
	return true


func _urlaub_aktiv() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var phase := str(gs.get_value("vacation.phase", ""))
	var ziel := str(gs.get_value("vacation.destId", ""))
	return phase == "away" and ziel == "beach"
