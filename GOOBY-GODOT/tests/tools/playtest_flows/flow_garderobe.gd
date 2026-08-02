extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (f) „Garderobe": Boot → Onboarding → Garderobe über den HUD-Knopf →
## Hut-Tab → Beanie (100 Münzen, Level 1) antippen = KAUFEN + automatisch
## anziehen → prüfen, dass der Kauf wirklich verbucht ist (Münzen runter,
## Hut im Save angelegt — echte Buchung, nicht nur Optik) → „Zurück" heim.
## Aufruf: tools/ci/run_playtest.sh flow_garderobe

## Münzstand vor dem Kauf (merke_muenzen → kauf_bezahlt).
var _muenzen_vorher := -1


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				{
					"name": "garderobe_oeffnen",
					"aktion": "tipp_name",
					"node": "BtnWardrobe",
					"erwarte": {"route": "wardrobe"},
					"timeout_s": 60.0,
				},
				{"name": "garderobe_ansehen", "aktion": "warte", "sekunden": 2.0},
				{"name": "muenzen_merken", "aktion": "tue", "funktion": merke_muenzen},
				{
					"name": "hut_tab_waehlen",
					"aktion": "tipp_name",
					"node": "Tab_hut",
					"erwarte": {"name": "Item_beanie"},
					"timeout_s": 25.0,
				},
				{
					"name": "beanie_kaufen_und_anziehen",
					"aktion": "tipp_name",
					"node": "Item_beanie",
					"erwarte": {"bedingung": beanie_angelegt},
					"timeout_s": 25.0,
				},
				{
					"name": "kauf_bezahlt",
					"aktion": "warte_bis",
					"bedingung": kauf_bezahlt,
					"timeout_s": 15.0,
					"erwartung": "economy.coins sinkt um den Beanie-Preis (100)",
				},
				{
					"name": "zurueck_nach_hause",
					"aktion": "tipp_text",
					"text": "Zurück",
					"erwarte": {"bedingung": wieder_daheim},
					"timeout_s": 90.0,
				},
				{"name": "abschluss_wohnzimmer", "aktion": "warte", "sekunden": 1.0},
			]
		)
	)
	return liste


func merke_muenzen() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	_muenzen_vorher = int(gs.get_value("economy.coins", -1))
	# Der Kauf-Schritt braucht 100 Münzen (Start 100 + Tagesbonus).
	return _muenzen_vorher >= 100


## Beanie gekauft UND angelegt? (Ein Tap im Grid kauft Nicht-Besessenes und
## zieht es direkt an — wardrobe_screen §„Ein Item antippen".)
func beanie_angelegt() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	return str(gs.get_value("cosmetics.outfits.equipped.hat", "")) == "beanie"


func kauf_bezahlt() -> bool:
	var gs := game_state()
	if gs == null or _muenzen_vorher < 0:
		return false
	return int(gs.get_value("economy.coins", -1)) == _muenzen_vorher - 100


## Der Garderoben-Zurück-Knopf reist auf die home-Alias-Route.
func wieder_daheim() -> bool:
	var router := harness.root.get_node_or_null("/root/SceneRouter")
	if router == null or router.is_busy():
		return false
	return str(router.get_current_target()).begins_with("home")
