extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „EIN Minispiel wie ein Spieler“ (PT-MG, Welle H): parametrisiert über
## die Umgebungsvariable PT_MG_ID (Default teaParty) — Boot → Onboarding →
## Arcade → Spiel-Kachel (über die Scroll-Falz ins Bild geholt, Muster
## flow_stadt) → Pregame ansehen → „Spielen!“ → Countdown → spielspezifisches
## Daumen-Rezept (Taps/Wische/Halten an den Stellen, wo das Spiel sie
## erwartet) → Score-Probe (pflicht=false, reine Signal-Zeile) → Pause/Weiter
## → Pause/„Beenden“ → notfalls Results „Zur Arcade“ → zurück in der Arcade.
## GvZ/Gobnom wählen vorher ihr erstes Level im spielinternen Level-Select.
## Endet die Runde von selbst (bunnyHop-Crash, goobySays-Fehler), springen
## die falls-da-Schritte und der Results-Knopf fängt den Flow auf.
## Aufruf:  PT_MG_ID=<id> tools/ci/run_playtest.sh flow_minigame <BxH> mg_<id>
## Hochkant 1320x2868; Querformat-Spiele (gvz/gobnom/goalieGooby/
## harborHopper/runner/toyRacer/ranchHerde/ranchParcours/ranchTonnen/
## ranchZeit/ranchTurnier) mit 2868x1320 starten.
##
## PT-MG-B (Spiele 20-38): die Ranch-Spiele haben eigene Level-/Lauf-
## Selects (RanchLevelSelect bzw. RcompLevelSelect, Kacheln tragen wie bei
## GvZ die Nummer im Text); ranchTurnier — die Ranch-WETTBEWERBE — hat
## statt Level-Select ein Turnier-Menue und bekommt sein eigenes Rezept
## (_turnier_rezept: Schau-Kuer, endet nach 5 Kommandos von selbst).

## Spiele mit spielinternem Level-Select (Klassenname des Select-Screens).
const LEVEL_SELECT := {
	"gvz": "GvzLevelSelect",
	"gobnom": "GobnomLevelSelect",
	"ranchHerde": "RanchLevelSelect",
	"ranchParcours": "RanchLevelSelect",
	"ranchTonnen": "RcompLevelSelect",
	"ranchZeit": "RcompLevelSelect",
}

## Vom „kachel sichtbar machen“-tue-Schritt gemerkter Knopf (Muster
## flow_stadt: erst scrollen+merken, dann tipp_pos auf die Mitte).
var _merk_knopf: Control


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	liste.append_array(_arcade_schritte())
	liste.append_array(_start_schritte())
	liste.append_array(_level_select_schritte())
	liste.append_array(_rezept())
	liste.append_array(_abschluss_schritte())
	return liste


## Welche Kachel gespielt wird — PT_MG_ID (Registry-Id, z. B. basketBounce).
func _mg_id() -> String:
	var id := OS.get_environment("PT_MG_ID")
	return id if id != "" else "teaParty"


## HUD → Arcade → Kachel des Spiels ins Bild scrollen und antippen.
func _arcade_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "arcade_oeffnen",
			"aktion": "tipp_name",
			"node": "BtnArcade",
			"erwarte": {"route": "arcade"},
			"timeout_s": 90.0,
		},
		{"name": "arcade_ansehen", "aktion": "warte", "sekunden": 2.0},
		{"name": "kachel_sichtbar_machen", "aktion": "tue", "funktion": _merke_kachel},
		{
			"name": "kachel_tippen",
			"aktion": "tipp_pos",
			"pos_funktion": _merk_knopf_mitte,
			"erwarte": {"text": "Spielen!"},
			"timeout_s": 60.0,
		},
	]


## Pregame ansehen und die Runde starten.
func _start_schritte() -> Array[Dictionary]:
	return [
		{"name": "pregame_ansehen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "spiel_starten",
			"aktion": "tipp_text",
			"text": "Spielen!",
			"erwarte": {"klasse": "MinigameHost"},
			"timeout_s": 90.0,
		},
		{"name": "countdown_abwarten", "aktion": "warte", "sekunden": 7.0},
	]


## GvZ/Gobnom: erstes freigeschaltetes Level im Select antippen (die
## Kacheln tragen die Level-Nummer im Text — der „Fertig“-Knopf nicht).
func _level_select_schritte() -> Array[Dictionary]:
	if not LEVEL_SELECT.has(_mg_id()):
		return []
	var klasse := str(LEVEL_SELECT[_mg_id()])
	return [
		{
			"name": "level_select_da",
			"aktion": "warte_bis",
			"klasse": klasse,
			"timeout_s": 60.0,
		},
		{"name": "level_select_ansehen", "aktion": "warte", "sekunden": 1.5},
		{
			"name": "level_sichtbar_machen",
			"aktion": "tue",
			"funktion": _merke_erstes_level.bind(klasse),
		},
		{
			"name": "level_starten",
			"aktion": "tipp_pos",
			"pos_funktion": _merk_knopf_mitte,
			"erwarte": {"weg_klasse": klasse},
			"timeout_s": 30.0,
		},
		{"name": "level_intro_abwarten", "aktion": "warte", "sekunden": 3.0},
	]


## Spiel-Rezept: kurze Daumen-Choreo passend zur Steuerung des Spiels.
## Blind gegen die Bildmitte gerichtet — die Screenshots zeigen, was die
## Taps wirklich getroffen haben (die Harness beurteilt keine Schönheit).
func _rezept() -> Array[Dictionary]:
	var folge: Array[Dictionary] = []
	match _mg_id():
		"teaParty":
			folge = _haltefolge([Vector2(0.5, 0.62)], [1.3, 0.8, 1.1], 1.0)
		"fishingPond":
			folge = (
				_haltefolge([Vector2(0.5, 0.6)], [1.6, 1.2], 1.2)
				+ _tapfolge([Vector2(0.5, 0.6), Vector2(0.5, 0.6), Vector2(0.5, 0.6)], 0.3)
			)
		"gardenRush":
			folge = _haltefolge(
				[Vector2(0.28, 0.58), Vector2(0.72, 0.58), Vector2(0.5, 0.72)], [0.9], 0.8
			)
		"carrotCatch":
			folge = _wischfolge(
				[
					[Vector2(0.25, 0.82), Vector2(0.75, 0.82), 0.9],
					[Vector2(0.75, 0.82), Vector2(0.3, 0.82), 0.9],
					[Vector2(0.3, 0.82), Vector2(0.7, 0.82), 0.9],
				],
				1.0
			)
		"basketBounce":
			folge = _wischfolge(
				[
					[Vector2(0.5, 0.78), Vector2(0.5, 0.38), 0.25],
					[Vector2(0.5, 0.78), Vector2(0.45, 0.36), 0.25],
					[Vector2(0.5, 0.78), Vector2(0.55, 0.37), 0.25],
				],
				2.0
			)
		"goalieGooby":
			folge = (
				_wischfolge([[Vector2(0.5, 0.6), Vector2(0.25, 0.6), 0.3]], 1.4)
				+ _tapfolge([Vector2(0.5, 0.6)], 1.4)
				+ _wischfolge(
					[
						[Vector2(0.5, 0.6), Vector2(0.75, 0.6), 0.3],
						[Vector2(0.5, 0.6), Vector2(0.3, 0.55), 0.3],
					],
					1.4
				)
			)
		"harborHopper":
			folge = (
				_wischfolge([[Vector2(0.5, 0.65), Vector2(0.3, 0.65), 0.4]], 1.4)
				+ _tapfolge([Vector2(0.5, 0.65)], 1.2)
				+ _wischfolge([[Vector2(0.5, 0.65), Vector2(0.7, 0.65), 0.4]], 1.6)
			)
		"gobnom":
			folge = (
				_wischfolge([[Vector2(0.35, 0.45), Vector2(0.65, 0.55), 0.5]], 1.0)
				+ _tapfolge([Vector2(0.5, 0.35)], 0.8)
				+ _wischfolge([[Vector2(0.45, 0.6), Vector2(0.6, 0.4), 0.5]], 2.5)
			)
		"gvz":
			folge = _tapfolge(
				[
					Vector2(0.15, 0.4),
					Vector2(0.45, 0.5),
					Vector2(0.6, 0.5),
					Vector2(0.5, 0.55),
					Vector2(0.65, 0.45),
				],
				1.2
			)
		"bunnyHop":
			folge = _tapfolge(
				[
					Vector2(0.5, 0.65),
					Vector2(0.5, 0.65),
					Vector2(0.5, 0.65),
					Vector2(0.5, 0.65),
					Vector2(0.5, 0.65),
					Vector2(0.5, 0.65),
				],
				0.6
			)
		"burgerBuild":
			folge = _tapfolge(
				[
					Vector2(0.25, 0.8),
					Vector2(0.5, 0.8),
					Vector2(0.75, 0.8),
					Vector2(0.5, 0.8),
					Vector2(0.25, 0.8),
				],
				1.2
			)
		"carrotGuard":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.5),
					Vector2(0.5, 0.5),
					Vector2(0.7, 0.5),
					Vector2(0.3, 0.65),
					Vector2(0.5, 0.65),
					Vector2(0.7, 0.65),
				],
				0.5
			)
		"cityDrive", "deliveryRush":
			folge = (
				_haltefolge([Vector2(0.75, 0.6)], [1.0], 1.5)
				+ _haltefolge([Vector2(0.25, 0.6)], [1.0], 1.5)
				+ _warteschritt(3.0)
			)
		"danceParty":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.78),
					Vector2(0.5, 0.78),
					Vector2(0.7, 0.78),
					Vector2(0.3, 0.78),
					Vector2(0.5, 0.78),
					Vector2(0.7, 0.78),
				],
				0.5
			)
		"goobySays":
			folge = (
				_warteschritt(4.0)
				+ _tapfolge(
					[
						Vector2(0.35, 0.6),
						Vector2(0.65, 0.6),
						Vector2(0.35, 0.78),
						Vector2(0.65, 0.78),
					],
					0.7
				)
			)
		"bubblePop":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.62),
					Vector2(0.62, 0.55),
					Vector2(0.45, 0.7),
					Vector2(0.7, 0.65),
					Vector2(0.35, 0.5),
				],
				0.6
			)
		"ghostHunt":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.55),
					Vector2(0.6, 0.5),
					Vector2(0.75, 0.62),
					Vector2(0.4, 0.68),
					Vector2(0.55, 0.58),
					Vector2(0.25, 0.62),
				],
				0.6
			)
		"hideSeek":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.45),
					Vector2(0.5, 0.45),
					Vector2(0.7, 0.45),
					Vector2(0.3, 0.6),
					Vector2(0.5, 0.6),
					Vector2(0.7, 0.6),
				],
				0.5
			)
		"lanternFloat":
			folge = _haltefolge(
				[Vector2(0.25, 0.6), Vector2(0.75, 0.6), Vector2(0.5, 0.6)], [1.2], 1.0
			)
		"memoryMatch":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.4),
					Vector2(0.55, 0.4),
					Vector2(0.3, 0.55),
					Vector2(0.55, 0.55),
					Vector2(0.72, 0.4),
					Vector2(0.72, 0.55),
				],
				0.9
			)
		"miniGolf":
			folge = _wischfolge(
				[
					[Vector2(0.5, 0.66), Vector2(0.5, 0.86), 0.6],
					[Vector2(0.5, 0.6), Vector2(0.44, 0.82), 0.6],
					[Vector2(0.5, 0.55), Vector2(0.56, 0.8), 0.6],
				],
				3.0
			)
		"pancakeTower":
			folge = _tapfolge(
				[
					Vector2(0.5, 0.6),
					Vector2(0.5, 0.6),
					Vector2(0.5, 0.6),
					Vector2(0.5, 0.6),
					Vector2(0.5, 0.6),
				],
				1.4
			)
		"pipeFlow":
			folge = _tapfolge(
				[
					Vector2(0.3, 0.38),
					Vector2(0.5, 0.38),
					Vector2(0.7, 0.38),
					Vector2(0.4, 0.52),
					Vector2(0.6, 0.52),
					Vector2(0.5, 0.62),
				],
				0.8
			)
		"purblePlace":
			folge = _knopffolge(["Rund", "Aufs Band!", "▶", "▶", "▶", "◀"], 1.2)
		"ranchHerde":
			folge = _tapfolge(
				[
					Vector2(0.55, 0.5),
					Vector2(0.45, 0.42),
					Vector2(0.6, 0.55),
					Vector2(0.5, 0.45),
				],
				1.6
			)
		"ranchParcours":
			folge = _knopffolge(["Galopp"], 1.5) + _knopffolge(["Sprung", "Sprung", "Sprung"], 2.0)
		"ranchTonnen", "ranchZeit":
			# Gangart-Wische rechts müssen unter WISCH_MAX_MS (250 ms)
			# bleiben — 0,12 s Harness-Dauer + Frame-Latenz passt knapp.
			folge = (
				_wischfolge(
					[
						[Vector2(0.75, 0.7), Vector2(0.75, 0.5), 0.12],
						[Vector2(0.75, 0.7), Vector2(0.75, 0.5), 0.12],
						[Vector2(0.75, 0.7), Vector2(0.75, 0.5), 0.12],
					],
					0.8
				)
				+ _wischfolge([[Vector2(0.22, 0.6), Vector2(0.38, 0.6), 1.5]], 1.0)
				+ _warteschritt(4.0)
			)
		"ranchTurnier":
			folge = _turnier_rezept()
		"rocketRescue":
			folge = _haltefolge(
				[Vector2(0.5, 0.6), Vector2(0.2, 0.6), Vector2(0.8, 0.6), Vector2(0.5, 0.6)],
				[1.0, 0.7, 0.7, 1.2],
				0.7
			)
		"runner", "shoppingSurf":
			folge = _wischfolge(
				[
					[Vector2(0.5, 0.65), Vector2(0.5, 0.4), 0.25],
					[Vector2(0.5, 0.65), Vector2(0.25, 0.65), 0.25],
					[Vector2(0.5, 0.65), Vector2(0.75, 0.65), 0.25],
					[Vector2(0.5, 0.65), Vector2(0.5, 0.4), 0.25],
					[Vector2(0.5, 0.5), Vector2(0.5, 0.75), 0.25],
				],
				1.2
			)
		"snailMail":
			folge = (
				_wischfolge([[Vector2(0.3, 0.72), Vector2(0.68, 0.42), 2.0]], 1.0)
				+ _wischfolge([[Vector2(0.35, 0.65), Vector2(0.62, 0.38), 1.6]], 1.0)
				+ _warteschritt(5.0)
			)
		"starHopper":
			folge = _tapfolge(
				[
					Vector2(0.25, 0.6),
					Vector2(0.75, 0.6),
					Vector2(0.75, 0.6),
					Vector2(0.25, 0.6),
				],
				1.2
			)
		"toyRacer":
			folge = _haltefolge(
				[Vector2(0.4, 0.6), Vector2(0.62, 0.6), Vector2(0.5, 0.6)], [1.3], 0.9
			)
		"trampoline":
			folge = (
				_tapfolge([Vector2(0.5, 0.62), Vector2(0.5, 0.62)], 1.1)
				+ _wischfolge([[Vector2(0.5, 0.55), Vector2(0.5, 0.3), 0.25]], 1.2)
				+ _tapfolge([Vector2(0.5, 0.62)], 1.0)
				+ _wischfolge([[Vector2(0.35, 0.5), Vector2(0.7, 0.5), 0.25]], 1.2)
			)
		"veggieChop":
			folge = _wischfolge(
				[
					[Vector2(0.3, 0.55), Vector2(0.7, 0.45), 0.25],
					[Vector2(0.7, 0.55), Vector2(0.3, 0.45), 0.25],
					[Vector2(0.35, 0.6), Vector2(0.7, 0.35), 0.25],
					[Vector2(0.65, 0.6), Vector2(0.3, 0.35), 0.25],
				],
				1.0
			)
		_:
			folge = _tapfolge([Vector2(0.5, 0.6), Vector2(0.4, 0.55), Vector2(0.6, 0.65)], 0.8)
	return folge


## Score-Probe + Pause/Weiter-Probe + Beenden — landet zurück in der Arcade.
## Alle Zwischenschritte sind falls-da (kurze Timeouts): ist die Runde schon
## von selbst zu Ende, fängt der Results-Knopf „Zur Arcade“ den Flow auf.
func _abschluss_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "score_probe",
			"aktion": "warte_bis",
			"bedingung": _score_positiv,
			"erwartung": "MinigameHost.score > 0 (Signal, kein Blocker)",
			"timeout_s": 3.0,
			"pflicht": false,
		},
		{
			"name": "pause_oeffnen",
			"aktion": "tipp_falls_da",
			"text": "Pause",
			"timeout_s": 8.0,
			"pflicht": false,
		},
		{"name": "pause_ansehen", "aktion": "warte", "sekunden": 1.5},
		{
			"name": "weiter_spielen",
			"aktion": "tipp_falls_da",
			"text": "Weiter",
			"timeout_s": 6.0,
			"pflicht": false,
		},
		{"name": "nachspielzeit", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "pause_zum_beenden",
			"aktion": "tipp_falls_da",
			"text": "Pause",
			"timeout_s": 8.0,
			"pflicht": false,
		},
		{
			"name": "runde_beenden",
			"aktion": "tipp_falls_da",
			"text": "Beenden",
			"timeout_s": 8.0,
			"pflicht": false,
		},
		{
			"name": "results_zur_arcade",
			"aktion": "tipp_falls_da",
			"text": "Zur Arcade",
			"timeout_s": 20.0,
			"pflicht": false,
		},
		{
			"name": "zurueck_in_arcade",
			"aktion": "warte_bis",
			"route": "arcade",
			"timeout_s": 90.0,
		},
		{"name": "arcade_abschluss", "aktion": "warte", "sekunden": 2.0},
	]


# ── Rezept-Bausteine ─────────────────────────────────────────────────────────


## Turnier-Liga (ranchTurnier) = die Ranch-WETTBEWERBE: im Turnier-Menue
## die Schau-Kür wählen (endet nach 5 Kommandos VON SELBST — die Reit-
## Disziplinen brauchen echtes Reiten bis ins Ziel), Einweisung mit
## Starterfeld lesen, „Los geht's!“, dann den „Jetzt!“-Knopf im Kommando-
## Takt (3 s + je 4 s) drücken, Endstand mit „Weiter“ wegtippen und die
## Siegerehrung („Zur Übersicht“, nur bei Platz 1–3) — landet zurück im
## Turnier-Menü, das Beenden übernimmt der Abschluss-Baustein.
## Menü-Kacheln/Einweisung/Endstand leben in SCROLL-Spalten: tipp_text
## fände geclippte Knöpfe zwar, träfe aber daneben (Pionier-Lauf blieb im
## Menü stehen) — deshalb der scroll-sichere Dreischritt _knopf_schritte.
func _turnier_rezept() -> Array[Dictionary]:
	var folge: Array[Dictionary] = _warteschritt(1.5)
	folge += _knopf_schritte("Schau-Wettbewerb", {"text": "Los geht"}, 1.0)
	folge += _knopf_schritte("Los geht", {}, 2.5)
	for _i in 6:
		folge += _knopffolge(["Jetzt!"], 3.6)
	folge += _warteschritt(2.0)
	folge += _knopf_schritte("Weiter", {}, 1.5)
	folge += _knopffolge(["Zur Übersicht"], 1.5)
	return folge


## Scroll-sicherer Text-Tap (Muster kachel/level): warten bis der Knopf
## sichtbar ist, über alle Scroll-Vorfahren ins Bild holen + merken, auf
## die Kanvas-Mitte tippen (optional mit erwarte-Nachbedingung).
func _knopf_schritte(text: String, erwarte: Dictionary, pause_s: float) -> Array[Dictionary]:
	var tipp := {
		"name": "knopf_tippen",
		"aktion": "tipp_pos",
		"pos_funktion": _merk_knopf_mitte,
		"timeout_s": 30.0,
	}
	if not erwarte.is_empty():
		tipp["erwarte"] = erwarte
	return [
		{"name": "knopf_da", "aktion": "warte_bis", "text": text, "timeout_s": 30.0},
		{
			"name": "knopf_sichtbar_machen",
			"aktion": "tue",
			"funktion": _merke_knopf_text.bind(text),
		},
		tipp,
		{"name": "spiel_takt", "aktion": "warte", "sekunden": pause_s},
	]


## Knopf-Serie über sichtbaren Text (falls-da, kurzer Timeout): fehlt der
## Knopf gerade — z. B. „Zur Übersicht“ ohne Podiumsplatz —, läuft der
## Flow weiter; die Screenshots zeigen, was wirklich da war.
func _knopffolge(texte: Array, pause_s: float) -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	for text: String in texte:
		(
			liste
			. append(
				{
					"name": "spiel_knopf",
					"aktion": "tipp_falls_da",
					"text": text,
					"timeout_s": 3.0,
					"pflicht": false,
				}
			)
		)
		liste.append({"name": "spiel_takt", "aktion": "warte", "sekunden": pause_s})
	return liste


## Tap-Serie an rel-Punkten, dazwischen jeweils `pause_s` warten.
func _tapfolge(punkte: Array, pause_s: float) -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	for punkt: Vector2 in punkte:
		liste.append({"name": "spiel_tap", "aktion": "tipp_pos", "pos_rel": punkt})
		liste.append({"name": "spiel_takt", "aktion": "warte", "sekunden": pause_s})
	return liste


## Halte-Serie: Punkt i wird `dauern[min(i, letzte)]` s gehalten.
func _haltefolge(punkte: Array, dauern: Array, pause_s: float) -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	var laeufe := maxi(punkte.size(), dauern.size())
	for i in laeufe:
		var punkt: Vector2 = punkte[mini(i, punkte.size() - 1)]
		var dauer: float = dauern[mini(i, dauern.size() - 1)]
		liste.append({"name": "spiel_halte", "aktion": "halte", "pos_rel": punkt, "dauer_s": dauer})
		liste.append({"name": "spiel_takt", "aktion": "warte", "sekunden": pause_s})
	return liste


## Einzelner Zuschau-Schritt als TYPISIERTE Liste — `+` auf Array[Dictionary]
## verlangt typgleiche Operanden (ein rohes Literal machte den ganzen
## Rezept-Ausdruck untypisiert und die Zuweisung schlug leise fehl).
func _warteschritt(sekunden: float) -> Array[Dictionary]:
	var liste: Array[Dictionary] = [{"name": "zuschauen", "aktion": "warte", "sekunden": sekunden}]
	return liste


## Wisch-Serie aus [von, nach, dauer]-Tripeln, dazwischen `pause_s` warten.
func _wischfolge(zuege: Array, pause_s: float) -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	for zug: Array in zuege:
		(
			liste
			. append(
				{
					"name": "spiel_wisch",
					"aktion": "wisch",
					"von_rel": zug[0],
					"nach_rel": zug[1],
					"dauer_s": float(zug[2]),
				}
			)
		)
		liste.append({"name": "spiel_takt", "aktion": "warte", "sekunden": pause_s})
	return liste


# ── Sucher & Proben ──────────────────────────────────────────────────────────


## Arcade-Kachel des Spiels über die Scroll-Falz ins Bild holen und merken.
func _merke_kachel() -> bool:
	var kachel := harness.root.find_child("Tile_%s" % _mg_id(), true, false)
	if not (kachel is Control):
		return false
	return _scrolle_und_merke(kachel as Control)


## Knopf mit Text (Teilstring, Groß/klein egal) suchen, über die
## Scroll-Falz ins Bild holen und merken (Baustein von _knopf_schritte).
func _merke_knopf_text(text: String) -> bool:
	var nadel := text.to_lower()
	var knopf := _suche_control(
		func(c: Control) -> bool:
			return c is BaseButton and str(c.get("text")).to_lower().contains(nadel)
	)
	return _scrolle_und_merke(knopf)


## Erste freigeschaltete Level-Kachel im Select merken (Knopf mit Ziffer im
## Text — der „Fertig“-Knopf trägt keine).
func _merke_erstes_level(select_klasse: String) -> bool:
	var select := _suche_control(
		func(c: Control) -> bool:
			var skript: Script = c.get_script()
			return skript != null and skript.get_global_name() == StringName(select_klasse)
	)
	if select == null:
		return false
	var knopf := _suche_control(
		func(c: Control) -> bool:
			if not (c is BaseButton) or bool(c.get("disabled")):
				return false
			var text := str(c.get("text"))
			for ziffer in ["1", "2", "3", "4", "5", "6", "7", "8", "9"]:
				if text.contains(ziffer):
					return true
			return false,
		select
	)
	return _scrolle_und_merke(knopf)


## Kanvas-Mitte des gemerkten Knopfs (tipp_pos-„pos_funktion“) — über
## harness.canvas_punkt, damit auch Knöpfe IM Spiel-SubViewport (GvZ/Gobnom-
## Level-Select) am richtigen Fensterpunkt getroffen werden.
func _merk_knopf_mitte() -> Vector2:
	if _merk_knopf == null or not is_instance_valid(_merk_knopf):
		return Vector2.ZERO
	return harness.canvas_punkt(_merk_knopf)


## Knopf über ALLE ScrollContainer-Vorfahren ins Bild holen und merken
## (Muster flow_stadt — sonst tippt tipp_pos ins Geclippte).
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
## Dokument-Reihenfolge (Muster flow_stadt: erster Treffer = oberster
## Listeneintrag, deterministisch).
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


## Signal-Zeile für den Report: hat das blinde Daumen-Rezept gepunktet?
func _score_positiv() -> bool:
	var host: Node = null
	var stapel: Array[Node] = [harness.root]
	while not stapel.is_empty():
		var aktuell: Node = stapel.pop_back()
		if aktuell is MinigameHost:
			host = aktuell
			break
		for kind in aktuell.get_children():
			stapel.append(kind)
	return host != null and int(host.get("score")) > 0
