extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (e) „Tagesquests-Blatt": Boot → Onboarding → Quest-Blatt über den
## HUD-Knopf öffnen → am GRIFF runterwischen und damit schließen (das
## G7-P53-Sheet-System, User-Wunsch „Modal-Menüs + Swipen") → danach das
## Blatt noch einmal öffnen und über den Hintergrund-Dim schließen.
## Aufruf: tools/ci/run_playtest.sh flow_quests_sheet


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				{
					"name": "quests_oeffnen",
					"aktion": "tipp_name",
					"node": "BtnQuests",
					"erwarte": {"klasse": "DailyQuestPanel"},
					"timeout_s": 45.0,
				},
				{"name": "blatt_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "blatt_runterwischen",
					"aktion": "wisch",
					"von_funktion": griff_mitte,
					"nach_funktion": griff_tief,
					"dauer_s": 0.45,
					"erwarte": {"weg_klasse": "DailyQuestPanel"},
					"timeout_s": 25.0,
				},
				{"name": "kurz_verschnaufen", "aktion": "warte", "sekunden": 1.5},
				{
					"name": "quests_wieder_oeffnen",
					"aktion": "tipp_name",
					"node": "BtnQuests",
					"erwarte": {"klasse": "DailyQuestPanel"},
					"timeout_s": 30.0,
				},
				{"name": "blatt_wieder_da", "aktion": "warte", "sekunden": 1.5},
				{
					"name": "dim_tippen_schliesst",
					"aktion": "tipp_pos",
					"pos_funktion": dim_punkt,
					"erwarte": {"weg_klasse": "DailyQuestPanel"},
					"timeout_s": 25.0,
				},
				{"name": "abschluss_wohnzimmer", "aktion": "warte", "sekunden": 1.0},
			]
		)
	)
	return liste


## Mitte des Sheet-Griffs (GrabHandle) — Startpunkt des Runterwischs.
func griff_mitte() -> Vector2:
	var griff := harness.root.find_child("GrabHandle", true, false)
	if griff is Control:
		return (griff as Control).get_global_rect().get_center()
	return Vector2(782.0, 200.0)


## Zielpunkt: deutlich unter dem Griff (übers Schwellen-Kriterium hinaus,
## mit Restschwung — panel_sheet schließt dann statt zurückzuschnappen).
func griff_tief() -> Vector2:
	var canvas := harness.root.get_visible_rect().size
	return Vector2(griff_mitte().x, canvas.y * 0.92)


## Punkt im Hintergrund-Dim NEBEN dem Blatt (links außen, vertikal mittig)
## — Dim-Tap schließt das Blatt (PanelSheet-Grammatik).
func dim_punkt() -> Vector2:
	var canvas := harness.root.get_visible_rect().size
	var blatt := harness.root.find_child("GrabHandle", true, false)
	if blatt is Control:
		var rect := _sheet_rect(blatt as Control)
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
