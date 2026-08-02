extends "res://tests/tools/playtest_flows/flow_baumodus.gd"
## Flow (d) „Schlaf“ (PT-HOME): erbt die kompletten Baumodus-Schritte
## (Boot → Onboarding → Kuschelbett aus dem Lager platzieren → Fertig) und
## hängt den Schlaf-Kreislauf an: Zeitraffer-Tweak Energie → 55 (ein frischer
## Save startet bei 90 — das Bett ist da zu Recht gesperrt, can_sleep < 70)
## → Bett antippen → Nachtkarte „Schlafen gehen“ → Ritual (Zähneputzen) +
## Einschlafen → prüfen, dass gooby.sleep.sleeping WIRKLICH im Save steht
## (echte Buchung, nicht nur Optik) → warten bis das sleep_night-Kino vorbei
## ist (Bett wieder frei) → Bett erneut antippen → „Sanft wecken“ → prüfen:
## wach UND Grumpy-Debuff gebucht (früh geweckt hat spürbare Folgen).
## Aufruf: tools/ci/run_playtest.sh flow_schlaf

## Zeitraffer-Ziel: müde genug für „Schlafen gehen“ (Sleep.START_BELOW_ENERGY).
const ZIEL_ENERGIE := 55.0


func schritte() -> Array[Dictionary]:
	var liste := super.schritte()
	(
		liste
		. append_array(
			[
				{"name": "energie_senken", "aktion": "tue", "funktion": senke_energie},
				{
					"name": "bett_antippen",
					"aktion": "tipp_3d",
					"finder": finde_moebel.bind("bedSingle"),
					"offset": Vector3(0.0, 0.4, 0.0),
					"erwarte": {"text": "Schlafen gehen"},
					"timeout_s": 45.0,
				},
				{
					"name": "schlafen_gehen",
					"aktion": "tipp_text",
					"text": "Schlafen gehen",
					"erwarte": {"bedingung": schlaeft},
					"timeout_s": 150.0,
				},
				{
					"name": "einschlaf_kino_ansehen",
					"aktion": "warte_bis",
					"bedingung": bett_wieder_frei,
					"timeout_s": 180.0,
				},
				{
					"name": "bett_im_schlaf_antippen",
					"aktion": "tipp_3d",
					"finder": finde_moebel.bind("bedSingle"),
					"offset": Vector3(0.0, 0.4, 0.0),
					"erwarte": {"text": "Sanft wecken"},
					"timeout_s": 45.0,
				},
				{
					"name": "sanft_wecken",
					"aktion": "tipp_text",
					"text": "Sanft wecken",
					"erwarte": {"bedingung": wach_und_grumpy},
					"timeout_s": 30.0,
				},
				{"name": "abschluss_schlaf", "aktion": "warte", "sekunden": 2.0},
			]
		)
	)
	return liste


## Zeitraffer statt Echtzeit-Warten: Energie im Save direkt senken (der
## Ticker bräuchte Stunden). Bewusst der EINZIGE Nicht-Spieler-Eingriff.
func senke_energie() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	gs.update(_setze_energie)
	var jetzt := float(gs.get_value("gooby.stats.energy", -1.0))
	return jetzt > 0.0 and jetzt < 70.0


func _setze_energie(state: Dictionary) -> void:
	var gooby: Variant = state.get("gooby")
	if not (gooby is Dictionary):
		return
	var stats: Variant = (gooby as Dictionary).get("stats")
	if stats is Dictionary:
		(stats as Dictionary)["energy"] = ZIEL_ENERGIE


## Liegt der Schlaf WIRKLICH im Save? (Strict-bool wie Sleep.is_sleeping.)
func schlaeft() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var sleeping: Variant = gs.get_value("gooby.sleep.sleeping", false)
	return sleeping is bool and sleeping


## Bett-Interactable fertig mit Ritual + Kino (nimmt wieder Taps an)?
func bett_wieder_frei() -> bool:
	var bett := _bett_interactable()
	return bett != null and not bool(bett.call("is_busy"))


## Nach „Sanft wecken“: wach UND der Grumpy-Debuff ist gebucht.
func wach_und_grumpy() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var sleeping: Variant = gs.get_value("gooby.sleep.sleeping", true)
	if not (sleeping is bool) or sleeping:
		return false
	return float(gs.get_value("gooby.grumpyUntil", 0)) > 0.0


func _bett_interactable() -> Node:
	var stapel: Array[Node] = [harness.root]
	while not stapel.is_empty():
		var aktuell: Node = stapel.pop_back()
		if aktuell is Bett:
			return aktuell
		for kind in aktuell.get_children():
			stapel.append(kind)
	return null
