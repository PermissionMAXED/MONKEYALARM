extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „Erfolge" (PT-META): Boot → Onboarding → Möhre füttern (wie
## flow_home_basis) → der Erfolg `firstFeed` wird LIVE freigeschaltet
## (AchievementsService bucht `achievements.unlocked.firstFeed`) → Profil
## über den HUD-Knopf → Erfolge-Vorschau „Alle ansehen" → Erfolgs-Screen:
## firstFeed-Zeile trägt das „Freigeschaltet!"-Badge, gesperrte Erfolge
## bleiben als „???" angedeutet, Kategorie-Chip „Spielen" filtert die
## Pflege-Zeile wirklich weg → zurück Profil → zurück nach Hause.
## Aufruf: tools/ci/run_playtest.sh flow_erfolge

## Vom „sichtbar machen"-Schritt gemerkter Knopf (Muster flow_minigame).
var _merk_knopf: Control


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	liste.append_array(_fuetter_schritte())
	liste.append_array(_erfolge_schritte())
	return liste


## Möhre füttern (Kurzfassung flow_home_basis) — löst firstFeed aus.
func _fuetter_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "tuer_zur_kueche_tippen",
			"aktion": "tipp_3d",
			"finder": finde_tuer.bind("kitchen"),
			"offset": Vector3(0.0, 1.0, 0.0),
			"erwarte": {"text": "Los!"},
			"timeout_s": 45.0,
		},
		{
			"name": "tuer_bestaetigen",
			"aktion": "tipp_text",
			"text": "Los!",
			"erwarte": {"route": "home/kitchen"},
			"timeout_s": 120.0,
			"nebenbei_tipp_klasse": "TapMashOverlay",
		},
		{"name": "kueche_ankommen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "kuehlschrank_tippen",
			"aktion": "tipp_3d",
			"finder": finde_moebel.bind("kitchenFridge"),
			"offset": Vector3(0.0, 0.9, 0.0),
			"erwarte": {"klasse": "FuetterGrid"},
			"timeout_s": 45.0,
		},
		{
			"name": "moehre_waehlen",
			"aktion": "tipp_name",
			"node": "Karte_carrot",
			"erwarte": {"weg_klasse": "FuetterGrid"},
			"timeout_s": 30.0,
		},
		{"name": "mampf_sequenz_ansehen", "aktion": "warte", "sekunden": 10.0},
		{
			"name": "firstfeed_verbucht",
			"aktion": "warte_bis",
			"bedingung": firstfeed_freigeschaltet,
			"erwartung": "achievements.unlocked.firstFeed steht im Save",
			"timeout_s": 30.0,
		},
	]


## Profil → Erfolgs-Screen → Badge/Mystery/Filter prüfen → zurück.
func _erfolge_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "profil_oeffnen",
			"aktion": "tipp_name",
			"node": "BtnProfil",
			"erwarte": {"route": "profil"},
			"timeout_s": 90.0,
		},
		{"name": "profil_ansehen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "erfolge_knopf_sichtbar_machen",
			"aktion": "tue",
			"funktion": _merke_knopf.bind("ErfolgeBtn"),
			"erwartung": "Erfolge-Vorschau mit 'Alle ansehen'-Knopf im Profil",
		},
		{
			"name": "erfolge_oeffnen",
			"aktion": "tipp_pos",
			"pos_funktion": _merk_knopf_mitte,
			"erwarte": {"route": "erfolge"},
			"timeout_s": 60.0,
		},
		{"name": "erfolge_ansehen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "firstfeed_badge_da",
			"aktion": "warte_bis",
			"bedingung": firstfeed_badge_sichtbar,
			"erwartung": "Erfolg_firstFeed-Zeile trägt das Freigeschaltet-Badge",
			"timeout_s": 15.0,
		},
		{
			"name": "mystery_probe",
			"aktion": "warte_bis",
			"bedingung": mystery_zeile_da,
			"erwartung": "mindestens ein gesperrter Erfolg heißt '???' (kein Spoiler)",
			"timeout_s": 10.0,
		},
		{
			"name": "kategorie_spielen_filtern",
			"aktion": "tipp_name",
			"node": "CatChip_spiel",
			"erwarte": {"bedingung": firstfeed_weggefiltert},
			"timeout_s": 20.0,
		},
		{"name": "filter_ansehen", "aktion": "warte", "sekunden": 1.5},
		{
			"name": "zurueck_zum_profil",
			"aktion": "tipp_name",
			"node": "BackBtn",
			"erwarte": {"route": "profil"},
			"timeout_s": 45.0,
		},
		{"name": "profil_wieder_da", "aktion": "warte", "sekunden": 1.5},
		{
			"name": "zurueck_nach_hause",
			"aktion": "tipp_name",
			"node": "BackBtn",
			"erwarte": {"bedingung": wieder_daheim},
			"timeout_s": 90.0,
		},
		{"name": "abschluss", "aktion": "warte", "sekunden": 1.0},
	]


func firstfeed_freigeschaltet() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var unlocked: Variant = gs.get_value("achievements.unlocked", {})
	return unlocked is Dictionary and (unlocked as Dictionary).has("firstFeed")


## Zeile Erfolg_firstFeed sichtbar UND ihr „Freigeschaltet!"-Badge dran.
func firstfeed_badge_sichtbar() -> bool:
	var zeile := harness.root.find_child("Erfolg_firstFeed", true, false)
	if not (zeile is Control) or not (zeile as Control).is_visible_in_tree():
		return false
	var badge := zeile.find_child("Freigeschaltet", true, false)
	return badge is Control and (badge as Control).is_visible_in_tree()


## Album-Mystery-Muster: gesperrte Erfolge heißen „???".
func mystery_zeile_da() -> bool:
	return _suche_label_mit(harness.root, "???") != null


## Nach dem Spiel-Filter ist die Pflege-Zeile firstFeed nicht mehr sichtbar.
func firstfeed_weggefiltert() -> bool:
	var zeile := harness.root.find_child("Erfolg_firstFeed", true, false)
	if zeile == null:
		return true
	return not (zeile is Control and (zeile as Control).is_visible_in_tree())


func wieder_daheim() -> bool:
	var router := harness.root.get_node_or_null("/root/SceneRouter")
	if router == null or router.is_busy():
		return false
	return str(router.get_current_target()).begins_with("home")


func _merke_knopf(node_name: String) -> bool:
	var treffer := harness.root.find_child(node_name, true, false)
	if not (treffer is Control):
		return false
	var eltern := treffer.get_parent()
	while eltern != null:
		if eltern is ScrollContainer:
			(eltern as ScrollContainer).ensure_control_visible(treffer as Control)
		eltern = eltern.get_parent()
	_merk_knopf = treffer as Control
	return true


func _merk_knopf_mitte() -> Vector2:
	if _merk_knopf == null or not is_instance_valid(_merk_knopf):
		return Vector2.ZERO
	return harness.canvas_punkt(_merk_knopf)


func _suche_label_mit(node: Node, nadel: String) -> Label:
	var stapel: Array[Node] = [node]
	while not stapel.is_empty():
		var aktuell: Node = stapel.pop_back()
		if aktuell is Label and (aktuell as Label).is_visible_in_tree():
			if (aktuell as Label).text.contains(nadel):
				return aktuell as Label
		for kind in aktuell.get_children():
			stapel.append(kind)
	return null
