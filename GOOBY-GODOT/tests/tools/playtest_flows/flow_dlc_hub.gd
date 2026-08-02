extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „DLC-Hub" (PT-META): Boot → Onboarding → Settings über den HUD-
## Zahnrad-Knopf → „Alle DLCs ansehen" (Sektion DLC, über die Scroll-Falz
## geholt) → DLC-Bibliothek (Route `dlc`, 3 Cover-Karten) → Ranch-Detail
## (Level-1-Save: Aktion GESPERRT + Trainings-Hinweis) → Dim-Tap schließt →
## McGooby-Detail (per Save-Saat als GEKAUFT markiert, sonst zeigt der
## Level-1-Save nur ein zweites Gesperrt-Gate) → „Schicht starten!" springt
## WIRKLICH in die Schicht-Route — der Hub hält sein Kernversprechen
## end-zu-end. Aufruf: tools/ci/run_playtest.sh flow_dlc_hub


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				# McGooby hat seit Welle B ein Kauf-Gate (Level 14 + Preis,
				# DlcKatalog.status_fuer) — auf dem frischen Level-1-Save wäre
				# das Detail nur ein ZWEITES Gesperrt-Gate (deckt schon die
				# Ranch ab). Die Saat spielt einen Besitzer: so testet der
				# Flow den INSTALLIERT-Zweig samt echtem DLC-Start.
				{
					"name": "mcgooby_besitz_saeen",
					"aktion": "tue",
					"funktion": _saee_mcgooby_besitz,
					"erwartung": "mcgooby.besitz.gekauft=true im Save",
				},
				{
					"name": "settings_oeffnen",
					"aktion": "tipp_name",
					"node": "SettingsButton",
					"erwarte": {"klasse": "SettingsScreen"},
					"timeout_s": 45.0,
				},
				{"name": "settings_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "dlc_knopf_sichtbar_machen",
					"aktion": "tue",
					"funktion": merke_knopf.bind("DlcButton"),
					"erwartung": "Settings-Sektion DLC mit 'Alle DLCs ansehen'-Knopf",
				},
				{
					"name": "dlc_bibliothek_oeffnen",
					"aktion": "tipp_pos",
					"pos_funktion": merk_knopf_mitte,
					"erwarte": {"route": "dlc"},
					"timeout_s": 60.0,
				},
				{"name": "bibliothek_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "drei_cover_karten_da",
					"aktion": "warte_bis",
					"bedingung": _alle_karten_da,
					"erwartung": "Karten DlcKarte_ranch/goo_und_bye/mcgooby im Baum",
					"timeout_s": 15.0,
				},
				{
					"name": "ranch_detail_oeffnen",
					"aktion": "tue",
					"funktion": _oeffne_karte.bind("ranch"),
					"erwartung": "Ansehen-Knopf der Ranch-Karte gefunden+gemerkt",
				},
				{
					"name": "ranch_detail_tippen",
					"aktion": "tipp_pos",
					"pos_funktion": merk_knopf_mitte,
					"erwarte": {"name": "AktionKnopf"},
					"timeout_s": 30.0,
				},
				# Level-1-Save: Ranch ist GESPERRT — Knopf disabled + Hinweis
				# „…Level {aktuell} und trainiert fleißig" (fail-closed-Gate).
				{
					"name": "ranch_gesperrt_hinweis",
					"aktion": "warte_bis",
					"bedingung": _ranch_gesperrt_sichtbar,
					"erwartung": "GesperrtHinweis sichtbar + AktionKnopf disabled",
					"timeout_s": 15.0,
				},
				{"name": "ranch_detail_ansehen", "aktion": "warte", "sekunden": 1.5},
				{
					"name": "detail_dim_tap_schliesst",
					"aktion": "tipp_pos",
					"pos_funktion": _dim_punkt,
					"erwarte": {"weg_klasse": "PanelSheet"},
					"timeout_s": 25.0,
				},
				{"name": "kurz_verschnaufen", "aktion": "warte", "sekunden": 1.0},
				{
					"name": "mcgooby_detail_oeffnen",
					"aktion": "tue",
					"funktion": _oeffne_karte.bind("mcgooby"),
					"erwartung": "Ansehen-Knopf der McGooby-Karte gefunden+gemerkt",
				},
				{
					"name": "mcgooby_detail_tippen",
					"aktion": "tipp_pos",
					"pos_funktion": merk_knopf_mitte,
					"erwarte": {"text": "Schicht starten!"},
					"timeout_s": 30.0,
				},
				{"name": "mcgooby_detail_ansehen", "aktion": "warte", "sekunden": 1.5},
				# Der Spielen-Knopf liegt unterm Story-Text unter der Scroll-
				# Falz des Detail-Sheets — einscrollen, dann per Position.
				{
					"name": "spielen_knopf_einscrollen",
					"aktion": "tue",
					"funktion": merke_knopf.bind("AktionKnopf"),
					"erwartung": "AktionKnopf im McGooby-Detail eingescrollt",
				},
				# Kernversprechen des Hubs: der Spielen-Knopf startet das DLC.
				{
					"name": "schicht_starten",
					"aktion": "tipp_pos",
					"pos_funktion": merk_knopf_mitte,
					"erwarte": {"route": "mcgooby_schicht"},
					"timeout_s": 150.0,
				},
				{"name": "schicht_ankommen", "aktion": "warte", "sekunden": 4.0},
			]
		)
	)
	return liste


## Besitz-Saat für den INSTALLIERT-Zweig (McGoobyState.ist_gekauft liest
## GENAU diesen Pfad; set_value legt fehlende Zwischen-Dicts selbst an).
func _saee_mcgooby_besitz() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	gs.set_value("mcgooby.besitz.gekauft", true)
	return bool(gs.get_value("mcgooby.besitz.gekauft", false))


## „Ansehen"-Knopf INNERHALB der Karte DlcKarte_<id> merken (tipp_text
## fände sonst immer nur die oberste Karte).
func _oeffne_karte(id: String) -> bool:
	var karte := harness.root.find_child("DlcKarte_%s" % id, true, false)
	if karte == null:
		return false
	var knopf := karte.find_child("Ansehen", true, false)
	if not (knopf is Control):
		return false
	return scrolle_und_merke(knopf as Control)


func _alle_karten_da() -> bool:
	for id in ["ranch", "goo_und_bye", "mcgooby"]:
		if harness.root.find_child("DlcKarte_%s" % id, true, false) == null:
			return false
	return true


## Ranch bei Level 1: AktionKnopf disabled + GesperrtHinweis sichtbar.
func _ranch_gesperrt_sichtbar() -> bool:
	var hinweis := harness.root.find_child("GesperrtHinweis", true, false)
	if not (hinweis is Control) or not (hinweis as Control).is_visible_in_tree():
		return false
	var knopf := harness.root.find_child("AktionKnopf", true, false)
	return knopf is BaseButton and bool((knopf as BaseButton).disabled)


## Punkt im Sheet-Dim LINKS neben dem Detail-Blatt (PanelSheet-Grammatik:
## Dim-Tap schließt — Muster flow_quests_sheet.dim_punkt).
func _dim_punkt() -> Vector2:
	var canvas := harness.root.get_visible_rect().size
	var griff := harness.root.find_child("GrabHandle", true, false)
	if griff is Control:
		var rect := _sheet_rect(griff as Control)
		if rect.position.x > 60.0:
			return Vector2(rect.position.x * 0.5, canvas.y * 0.5)
	return Vector2(canvas.x * 0.04, canvas.y * 0.5)


func _sheet_rect(griff: Control) -> Rect2:
	var aktuell: Node = griff
	while aktuell != null:
		if aktuell is PanelContainer:
			return (aktuell as PanelContainer).get_global_rect()
		aktuell = aktuell.get_parent()
	return griff.get_global_rect()
