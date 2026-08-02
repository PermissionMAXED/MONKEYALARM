extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „Telefon-Apps" (PT-META): Boot → Onboarding → IGohbie → ALLE Grid-
## Kacheln einmal wie ein Spieler bespielen: Taxi + Guber (FahrdienstApp),
## Gooberando (Essens-App), Kamera-Kachel GESPERRT (POW-Gate → Toast),
## GoobyPal, InstantGooby — Rückwege gemischt über den HomeBalken UND die
## G7/P52-„von links nach rechts"-Zurück-Geste; am Ende Runterwisch zu.
## (flow_telefon deckt Freunde-App + Runterwisch bereits ab — hier kommt
## der Rest des App-Grids dran.)
## Aufruf: tools/ci/run_playtest.sh flow_telefon_apps


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				{
					"name": "telefon_oeffnen",
					"aktion": "tipp_name",
					"node": "BtnIgohbie",
					"erwarte": {"klasse": "PhoneShell"},
					"timeout_s": 45.0,
				},
				{"name": "grid_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "taxi_oeffnen",
					"aktion": "tipp_name",
					"node": "KachelTaxi",
					"erwarte": {"klasse": "FahrdienstApp"},
					"timeout_s": 30.0,
				},
				{"name": "taxi_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "taxi_zurueck",
					"aktion": "tipp_name",
					"node": "HomeBalken",
					"erwarte": {"weg_klasse": "FahrdienstApp"},
					"timeout_s": 20.0,
				},
				{
					"name": "guber_oeffnen",
					"aktion": "tipp_name",
					"node": "KachelGuber",
					"erwarte": {"klasse": "FahrdienstApp"},
					"timeout_s": 30.0,
				},
				{"name": "guber_ansehen", "aktion": "warte", "sekunden": 1.5},
				{
					"name": "guber_zurueck",
					"aktion": "tipp_name",
					"node": "HomeBalken",
					"erwarte": {"weg_klasse": "FahrdienstApp"},
					"timeout_s": 20.0,
				},
				{
					"name": "gooberando_oeffnen",
					"aktion": "tipp_name",
					"node": "KachelGooberando",
					"erwarte": {"klasse": "GooberandoApp"},
					"timeout_s": 30.0,
				},
				{"name": "gooberando_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "gooberando_zurueck",
					"aktion": "tipp_name",
					"node": "HomeBalken",
					"erwarte": {"weg_klasse": "GooberandoApp"},
					"timeout_s": 20.0,
				},
				# POW-Gate: Kamera-Kachel ist gesperrt (Schloss-Badge) — der
				# Tap öffnet NICHTS, sondern erklärt sich per Toast.
				{
					"name": "kamera_gesperrt_toast",
					"aktion": "tipp_name",
					"node": "KachelKamera",
					"erwarte": {"text": "Kamera aus dem POW"},
					"timeout_s": 20.0,
				},
				{"name": "toast_abwarten", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "goobypal_oeffnen",
					"aktion": "tipp_name",
					"node": "KachelGoobypal",
					"erwarte": {"text": "Schick einem Freund ein paar Münzen"},
					"timeout_s": 30.0,
				},
				{"name": "goobypal_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "goobypal_zurueck",
					"aktion": "tipp_name",
					"node": "HomeBalken",
					"erwarte": {"name": "AppGrid"},
					"timeout_s": 20.0,
				},
				{
					"name": "instant_oeffnen",
					"aktion": "tipp_name",
					"node": "KachelInstant",
					"erwarte": {"klasse": "InstantGoobyApp"},
					"timeout_s": 30.0,
				},
				{"name": "instant_feed_ansehen", "aktion": "warte", "sekunden": 2.5},
				# G7/P52-Geste: Wisch von LINKS nach rechts IN der App =
				# zurück aufs Grid (wie am echten Telefon).
				{
					"name": "app_wisch_zurueck",
					"aktion": "wisch",
					"von_funktion": geraet_links,
					"nach_funktion": geraet_rechts,
					"dauer_s": 0.45,
					"erwarte": {"weg_klasse": "InstantGoobyApp"},
					"timeout_s": 20.0,
				},
				{
					"name": "grid_wieder_da",
					"aktion": "warte_bis",
					"bedingung": _grid_sichtbar,
					"erwartung": "AppGrid nach der Zurück-Geste wieder sichtbar",
					"timeout_s": 15.0,
				},
				# Runterwisch AUF dem Gerät (Statuszeilen-Zone) schließt das
				# Telefon (G7/P52 — Muster flow_telefon).
				{
					"name": "telefon_zu_wischen",
					"aktion": "wisch",
					"von_funktion": geraet_oben,
					"nach_funktion": geraet_unten,
					"dauer_s": 0.5,
					"erwarte": {"weg_klasse": "PhoneShell"},
					"timeout_s": 20.0,
				},
				{"name": "abschluss_wohnzimmer", "aktion": "warte", "sekunden": 1.0},
			]
		)
	)
	return liste


func _grid_sichtbar() -> bool:
	var grid := harness.root.find_child("AppGrid", true, false)
	return grid is Control and (grid as Control).is_visible_in_tree()


## Wisch-Start der Zurück-Geste: ganz linke Geräte-Kante, ABER in der
## Statuszeilen-Zone (~6 % Höhe). Wichtig (P52/P53-Gotcha wie flow_telefon):
## der App-Inhalt (Scroll-Liste/Knöpfe) füllt die Gerätemitte und fängt
## Drags ab — nur die Statuszeile ist die freie Wischzone, die bis zum
## Geraet-Panel durchfällt; `_geste_von_links` verlangt zusätzlich einen
## Start nahe der linken Kante (≤ geste_rand).
func geraet_links() -> Vector2:
	var rect := _geraet_rect()
	return Vector2(rect.position.x + rect.size.x * 0.03, rect.position.y + rect.size.y * 0.06)


func geraet_rechts() -> Vector2:
	var rect := _geraet_rect()
	return Vector2(rect.position.x + rect.size.x * 0.9, rect.position.y + rect.size.y * 0.06)


## Runterwisch-Punkte wie flow_telefon (Statuszeilen-Zone ~6 % Gerätehöhe).
func geraet_oben() -> Vector2:
	var rect := _geraet_rect()
	return Vector2(rect.get_center().x, rect.position.y + rect.size.y * 0.06)


func geraet_unten() -> Vector2:
	var rect := _geraet_rect()
	return Vector2(rect.get_center().x, rect.position.y + rect.size.y * 0.85)


func _geraet_rect() -> Rect2:
	var treffer := harness.root.find_child("Geraet", true, false)
	if treffer is Control:
		return (treffer as Control).get_global_rect()
	return Rect2(Vector2(600.0, 100.0), Vector2(400.0, 500.0))
