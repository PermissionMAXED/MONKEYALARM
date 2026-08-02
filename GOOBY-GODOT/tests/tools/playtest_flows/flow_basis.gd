extends RefCounted
## Basisklasse aller Playtest-Flows (G7-P58): gemeinsame Schritt-Bausteine
## (Onboarding wie ein Spieler) und Sucher für 3D-Ziele (Türen, Möbel).
## Ein konkreter Flow erbt hiervon und liefert `schritte()`:
##   extends "res://tests/tools/playtest_flows/flow_basis.gd"
##   func schritte() -> Array[Dictionary]: return ...
## Die Harness (tests/tools/playtest_harness.gd, s. Kopf-Doku dort) setzt vor
## dem Aufruf `harness` — darüber kommen Sucher an den Szenenbaum.

## Von der Harness gesetzt (SceneTree des laufenden Spiels).
var harness: SceneTree

## Vom Baustein `merke_knopf` gemerktes Ziel für tipp_pos-Schritte.
var merk_knopf: Control


## Überschreiben: die Schrittliste des Flows.
func schritte() -> Array[Dictionary]:
	return []


## Frischer Save → Boot-Cover öffnet aufs Onboarding; alle vier Karten wie
## ein Spieler durchtippen. Danach steht die Route home/living und der
## HUD-Coachmark („Deine Knöpfe“) wird weggetippt, falls er auftaucht.
func onboarding_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "boot_bis_onboarding",
			"aktion": "warte_bis",
			"klasse": "OnboardingFlow",
			"timeout_s": 180.0,
		},
		{"name": "name_eingeben", "aktion": "eingabe", "node": "NameEdit", "text": "Pionier"},
		{"name": "welcome_weiter", "aktion": "tipp_name", "node": "WelcomeNext"},
		{
			"name": "spitzname_eingeben",
			"aktion": "eingabe",
			"node": "NicknameEdit",
			"text": "Goobster",
		},
		{"name": "spitzname_weiter", "aktion": "tipp_name", "node": "NicknameNext"},
		{"name": "editor_weiter", "aktion": "tipp_name", "node": "EditorNext"},
		{
			"name": "onboarding_fertig",
			"aktion": "tipp_name",
			"node": "DoneButton",
			"erwarte": {"route": "home/living"},
			"timeout_s": 120.0,
		},
		{"name": "wohnzimmer_ankommen", "aktion": "warte", "sekunden": 2.0},
		# Tagesbonus-Popup (Layer 90) legt einen unsichtbaren Vollbild-Schleier
		# ÜBER die Guide-Tour (Layer 70) — erst abholen, sonst ist ALLES taub.
		{
			"name": "tagesbonus_abholen",
			"aktion": "tipp_falls_da",
			"text": "Abholen!",
			"timeout_s": 10.0,
			"pflicht": false,
		},
		# Erste-Viertelstunde-Tour (OnboardingGuide, "Schritt 1/9") liegt ÜBER
		# Coachmark und Raum — wie ein Spieler, der lieber frei spielt: X.
		{
			"name": "guide_tour_beenden",
			"aktion": "tipp_falls_da",
			"node": "GuideBeenden",
			"timeout_s": 12.0,
			"pflicht": false,
		},
		{
			"name": "coachmark_wegtippen",
			"aktion": "tipp_falls_da",
			"text": "Alles klar!",
			"timeout_s": 6.0,
			"pflicht": false,
		},
		# „Was nun?"-Hinweiskarte (oben mittig, tippbar → öffnet das Quest-
		# Panel!) lag im Pionier-Lauf 2 ÜBER der Küchentür und fing den
		# Tür-Tap ab. Wie ein Spieler: einmal aufs × — dann ist der Tages-
		# vorschlag für heute weggedrückt und die Kopf-Zone frei.
		{
			"name": "wasnun_wegdruecken",
			"aktion": "tipp_falls_da",
			"node": "WasNunSchliessen",
			"timeout_s": 8.0,
			"pflicht": false,
		},
		# PT-META-Befund: die Random-Events (RandomEventEngine.roll_on_start)
		# würfeln beim Boot mit — das „Karton"-Event (Gooby sitzt im Paket,
		# EventChoice „Raus da!"/„Ok, du bist ein Möbel") ist eine modale
		# Wahl, die Möbel-Taps im Raum blockiert (Beleg PT-meta F2, flow_radio
		# 013_radio_antippen_FAIL.png). Wie ein Spieler: Gooby rauslassen.
		# pflicht=false — in den meisten Läufen rollt gar kein Event.
		{
			"name": "stoerevent_wegtippen",
			"aktion": "tipp_falls_da",
			"text": "Raus da!",
			"timeout_s": 6.0,
			"pflicht": false,
		},
	]


## Control per Node-Name suchen, über alle ScrollContainer-Vorfahren ins
## Bild holen und für tipp_pos merken (PT-meta: Sheets scrollen — Knöpfe
## unter der Falz liegen zwar sichtbar im Baum, ihr Mittelpunkt aber
## außerhalb des Canvas; tipp_name würde ins Leere tippen).
## Einsatz:  {"aktion": "tue", "funktion": merke_knopf.bind("Schliessen")}
##           {"aktion": "tipp_pos", "pos_funktion": merk_knopf_mitte, ...}
func merke_knopf(node_name: String) -> bool:
	var treffer := harness.root.find_child(node_name, true, false)
	if not (treffer is Control):
		return false
	return scrolle_und_merke(treffer as Control)


func scrolle_und_merke(knopf: Control) -> bool:
	if knopf == null:
		return false
	var eltern := knopf.get_parent()
	while eltern != null:
		if eltern is ScrollContainer:
			(eltern as ScrollContainer).ensure_control_visible(knopf)
		eltern = eltern.get_parent()
	merk_knopf = knopf
	return true


func merk_knopf_mitte() -> Vector2:
	if merk_knopf == null or not is_instance_valid(merk_knopf):
		return Vector2.ZERO
	return harness.canvas_punkt(merk_knopf)


## GameState-Autoload (bequemer Zugriff für merke/pruefe-Bausteine).
func game_state() -> Node:
	return harness.root.get_node_or_null("/root/GameState")


## Aktuelle Router-Szene (der Raum/Screen unter dem HUD).
func aktuelle_szene() -> Node:
	var router := harness.root.get_node_or_null("/root/SceneRouter")
	return router.get_current_scene() if router != null else null


## Tür im aktuellen Raum, die in `ziel_raum` führt (Node "Door_<id>").
func finde_tuer(ziel_raum: String) -> Node3D:
	var szene := aktuelle_szene()
	if szene == null:
		return null
	return _suche_node3d(szene, _ist_tuer_nach.bind(ziel_raum))


## Möbel-Node mit Katalog-Id-Präfix (z. B. "kitchenFridge") im aktuellen Raum.
func finde_moebel(item_prefix: String) -> Node3D:
	var szene := aktuelle_szene()
	if szene == null:
		return null
	return _suche_node3d(szene, _ist_moebel_mit.bind(item_prefix))


func _ist_tuer_nach(node: Node, ziel_raum: String) -> bool:
	return node is DoorTransition and str(node.get("target_room")) == ziel_raum


func _ist_moebel_mit(node: Node, item_prefix: String) -> bool:
	if not (node is FurnitureNode):
		return false
	var def: Variant = node.get("item_def")
	if not (def is Dictionary):
		return false
	return str((def as Dictionary).get("id", "")).begins_with(item_prefix)


func _suche_node3d(wurzel: Node, passt: Callable) -> Node3D:
	var stapel: Array[Node] = [wurzel]
	while not stapel.is_empty():
		var aktuell: Node = stapel.pop_back()
		if aktuell is Node3D and bool(passt.call(aktuell)):
			return aktuell
		for kind in aktuell.get_children():
			stapel.append(kind)
	return null
