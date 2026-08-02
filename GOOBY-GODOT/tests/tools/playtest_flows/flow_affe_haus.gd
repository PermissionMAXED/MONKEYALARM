extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (g) „Zufalls-Affe im Haus": Boot → Onboarding → 40 seeded Wild-Taps
## quer durchs Wohnzimmer (HUD-Kacheln, Gooby, Türen, Möbel — was der Affe
## eben trifft). Der Flow urteilt bewusst nur über ROBUSTHEIT: das Spiel
## darf danach weder hängen (Router bleibt busy) noch tot sein; Script-
## Errors sammelt der Log-Anhang des Wrappers ein. Seed fest = Lauf exakt
## reproduzierbar. Aufruf: tools/ci/run_playtest.sh flow_affe_haus


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				{
					"name": "affe_tobt",
					"aktion": "affe",
					"taps": 40,
					"seed": 20260802,
					"pause_s": 0.4,
					# Rand meiden: Zahnrad/Settings oben rechts würde den
					# Affen in fremde Screens teleportieren — der Rest
					# (HUD-Dock, Raum, Gooby, Türen) ist Freiwild.
					"rel_min": Vector2(0.12, 0.1),
					"rel_max": Vector2(0.88, 0.9),
					"timeout_s": 240.0,
				},
				{
					"name": "spiel_lebt_noch",
					"aktion": "warte_bis",
					"bedingung": spiel_lebt,
					"timeout_s": 90.0,
					"erwartung": "Router wieder ruhig + GameState erreichbar (kein Hänger)",
				},
				{"name": "abschluss_screenshot", "aktion": "warte", "sekunden": 2.0},
			]
		)
	)
	return liste


## Kein Hänger: der Router ist (wieder) idle und der GameState-Autoload
## antwortet — wohin auch immer der Affe navigiert hat.
func spiel_lebt() -> bool:
	var router := harness.root.get_node_or_null("/root/SceneRouter")
	if router == null or router.is_busy():
		return false
	return game_state() != null
