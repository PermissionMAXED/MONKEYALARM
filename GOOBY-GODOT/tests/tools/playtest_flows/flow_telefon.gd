extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (d) „Telefon": Boot → Onboarding → IGohbie über den HUD-Knopf öffnen
## → Freunde-App von der Grid-Kachel → HomeBalken zurück aufs Grid →
## Telefon per RUNTERWISCH schließen (G7-P52-Geste, User-Wunsch „Swipen").
## Aufruf: tools/ci/run_playtest.sh flow_telefon


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
					"name": "freunde_app_oeffnen",
					"aktion": "tipp_name",
					"node": "KachelFreunde",
					"erwarte": {"klasse": "PhoneFriendsApp"},
					"timeout_s": 30.0,
				},
				{"name": "freunde_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "zurueck_aufs_grid",
					"aktion": "tipp_name",
					"node": "HomeBalken",
					"erwarte": {"weg_klasse": "PhoneFriendsApp"},
					"timeout_s": 20.0,
				},
				# Runterwisch AUF dem Gerät (Start in der Statuszeilen-Zone,
				# nicht auf einer App-Kachel) — schließt das Telefon wie am
				# echten Gerät (phone_shell._geste_schritt, Schwelle 90×f).
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


## Wisch-Start: oben mittig auf dem Gerät IN der Statuszeilen-Zone (~6 %
## Gerätehöhe) — dort fällt der Druck bis zum Geraet-Panel durch. Wichtig:
## App-Kacheln sind STOP-Buttons; startet der Finger AUF einer Kachel,
## bleibt der Touch-Fokus dort hängen und die Geste erreicht das Gerät nie
## (Befund Pionier-Lauf 3 mit Start bei 12 % = Oberkante der Kachelreihe).
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
