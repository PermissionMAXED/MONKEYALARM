extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „Ball-Apport“ (W17/BALL-POLISH): Boot → Onboarding → im Wohnzimmer
## warten, bis Gooby in Apport-Reichweite steht → den Ball mit einem ECHTEN
## Flick (Wisch mit Velocity) werfen → Flug/Bounce → Gooby flitzt hin,
## Kopfstoß zurück → prüfen, dass Spaß, Gewicht (−0.2) und balls-Counter
## WIRKLICH gebucht sind (echte Buchung, nicht nur Optik). Zwei Wurf-
## Versuche, weil Gooby zwischen Bedingung und Landung weiterwandern kann.
## Aufruf: tools/ci/run_playtest.sh flow_ball_apport

## Web CHASE_MAX_DIST ist 3.2 — mit Puffer werfen wir nur, wenn Gooby
## bequem in Reichweite steht und gerade NICHT läuft.
const REICHWEITE_MAX := 2.6
const REICHWEITE_MIN := 0.45
## Flick: von der Ball-Position steil nach oben (rel. Canvas-Anteile).
const FLICK_WEG_REL := Vector2(-0.04, -0.32)
const FLICK_DAUER_S := 0.6

var _fun_vorher := -1.0
var _weight_vorher := -1.0
var _balls_vorher := -1


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				{
					"name": "ball_liegt_bereit",
					"aktion": "warte_bis",
					"bedingung": ball_bereit,
					"timeout_s": 45.0,
				},
				{"name": "werte_merken", "aktion": "tue", "funktion": merke_werte},
				{
					"name": "gooby_in_reichweite",
					"aktion": "warte_bis",
					"bedingung": gooby_in_reichweite,
					"timeout_s": 150.0,
				},
				{
					"name": "ball_flick_wurf",
					"aktion": "wisch",
					"von_funktion": ball_canvas_pos,
					"nach_funktion": flick_ziel_pos,
					"dauer_s": FLICK_DAUER_S,
				},
				{
					"name": "apport_versuch_1",
					"aktion": "warte_bis",
					"bedingung": apport_gebucht,
					"timeout_s": 45.0,
					"pflicht": false,
				},
				# Zweiter Anlauf, falls Gooby beim ersten Wurf schon weitergezogen
				# war (Ball bleibt dann einfach liegen — Web-Verhalten).
				{
					"name": "gooby_wieder_in_reichweite",
					"aktion": "warte_bis",
					"bedingung": apport_oder_reichweite,
					"timeout_s": 120.0,
					"pflicht": false,
				},
				{
					"name": "ball_flick_wurf_2",
					"aktion": "wisch",
					"von_funktion": ball_canvas_pos,
					"nach_funktion": flick_ziel_pos,
					"dauer_s": FLICK_DAUER_S,
				},
				{
					"name": "apport_gebucht",
					"aktion": "warte_bis",
					"bedingung": apport_gebucht,
					"timeout_s": 60.0,
					"erwartung": "balls-Counter steigt (Gooby apportiert wirklich)",
				},
				{
					"name": "belohnung_geprueft",
					"aktion": "tue",
					"funktion": pruefe_belohnung,
					"erwartung": "Spaß +3 und Gewicht −0.2 nach dem Apport gebucht",
				},
				{"name": "apport_ausklang", "aktion": "warte", "sekunden": 4.0},
			]
		)
	)
	return liste


## Der Wohnzimmer-Ball ist aufgebaut (wartet auf ready_for_reveal) und ruht.
func ball_bereit() -> bool:
	var ball := _wurfball()
	if ball == null or not ball.is_processing():
		return false
	return ball.logic.zustand == BallLogic.RUHT


func merke_werte() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	_fun_vorher = float(gs.get_value("gooby.stats.fun", -1.0))
	_weight_vorher = float(gs.get_value("gooby.weight", -1.0))
	_balls_vorher = int(gs.get_value("achievements.counters.balls", 0))
	return _fun_vorher >= 0.0 and _weight_vorher >= 0.0


## Gooby steht (läuft nicht) bequem in Apport-Reichweite zum Ball.
func gooby_in_reichweite() -> bool:
	var ball := _wurfball()
	var gooby := _gooby()
	if ball == null or gooby == null:
		return false
	if gooby.has_method("is_walking") and gooby.is_walking():
		return false
	var ball_welt: Vector3 = ball.global_position + ball.logic.pos
	var von: Vector3 = gooby.global_position
	var dist := Vector2(ball_welt.x - von.x, ball_welt.z - von.z).length()
	return dist >= REICHWEITE_MIN and dist <= REICHWEITE_MAX


func apport_oder_reichweite() -> bool:
	return apport_gebucht() or gooby_in_reichweite()


## Echte Buchung: der balls-Lifetime-Counter ist gestiegen.
func apport_gebucht() -> bool:
	var gs := game_state()
	if gs == null or _balls_vorher < 0:
		return false
	return int(gs.get_value("achievements.counters.balls", 0)) > _balls_vorher


## Web-Zahlen: +3 Spaß (geklemmt, Ticker zehrt nebenher — Toleranz wie
## flow_home_basis) und −0.2 Gewicht pro Apport.
func pruefe_belohnung() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var fun := float(gs.get_value("gooby.stats.fun", -1.0))
	var weight := float(gs.get_value("gooby.weight", -1.0))
	var fun_ok := fun >= _fun_vorher + 2.0 or fun >= 99.0
	var weight_ok := weight <= _weight_vorher - 0.19
	return fun_ok and weight_ok


## Ball-Position (Welt → Canvas) für den Flick-Ansatzpunkt.
func ball_canvas_pos() -> Vector2:
	var kamera := harness.root.get_camera_3d()
	var ball := _wurfball()
	if kamera == null or ball == null:
		return harness.root.get_visible_rect().size * 0.5
	var welt: Vector3 = ball.global_position + ball.logic.pos
	return kamera.unproject_position(welt)


func flick_ziel_pos() -> Vector2:
	return ball_canvas_pos() + FLICK_WEG_REL * harness.root.get_visible_rect().size


func _wurfball() -> WurfBall:
	var szene := aktuelle_szene()
	if szene == null:
		return null
	return _suche_node3d(szene, func(node: Node) -> bool: return node is WurfBall) as WurfBall


func _gooby() -> Node3D:
	var szene := aktuelle_szene()
	if szene != null and szene.has_method("gooby"):
		return szene.gooby()
	return null
