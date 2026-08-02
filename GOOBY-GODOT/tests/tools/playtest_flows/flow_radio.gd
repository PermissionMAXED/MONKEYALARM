extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „Radio" (PT-META): Boot → Onboarding → Radio-Möbel im Wohnzimmer
## antippen (Standard-Layout stellt ein `radio` aufs Regal → Vollradio, weil
## RadioLogic.besitzt_radio das platzierte Möbel als Kauf-Nachweis wertet) →
## Einschalten (Save-Beweis `radio.playing`) → Sender auf Gooby FM →
## „Nächster Titel" wechselt den Track WIRKLICH (MusicDirector-Probe) →
## „Gefällt mir" bucht einen Like additiv in `radio.likes` → Schließen.
## Aufruf: tools/ci/run_playtest.sh flow_radio

## Track-Id vor dem Skip (merke_track → track_gewechselt).
var _track_vorher := ""


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				# Das Radio steht in der vorderen linken Ecke (Zelle [0,8],
				# Weltpunkt ~x0.25/z4.25) DICHT an der Kamera — der Möbel-
				# Ursprung projiziert an den unteren Bildrand, ein Tap dort
				# verfehlt die TapArea (PT-meta F3). Der Zielpunkt wird darum
				# nach OBEN und Richtung Raummitte gelegt, bleibt aber INNEN in
				# der 0,9³-Tap-Box (x±0.45, y 0..top+0.3, z±0.45), damit der
				# Kamerastrahl die Radio-Area3D wirklich trifft.
				{
					"name": "radio_antippen",
					"aktion": "tipp_3d",
					"finder": finde_moebel.bind("radio"),
					"offset": Vector3(0.3, 0.55, -0.4),
					"erwarte": {"klasse": "RadioSheet"},
					"timeout_s": 45.0,
				},
				{"name": "radio_sheet_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "vollradio_da",
					"aktion": "warte_bis",
					"bedingung": vollradio_da,
					"erwartung": "Sender-Chips sichtbar (Vollradio, kein Bordmusik-Gate)",
					"timeout_s": 15.0,
				},
				{
					"name": "einschalten",
					"aktion": "tipp_name",
					"node": "AnAus",
					"erwarte": {"bedingung": radio_spielt},
					"timeout_s": 20.0,
				},
				{"name": "musik_laeuft", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "sender_gooby_fm",
					"aktion": "tipp_name",
					"node": "Sender_gooby-fm",
					"erwarte": {"bedingung": sender_gewechselt},
					"timeout_s": 20.0,
				},
				{"name": "sender_ansehen", "aktion": "warte", "sekunden": 2.0},
				{"name": "track_merken", "aktion": "tue", "funktion": merke_track},
				{
					"name": "naechster_titel",
					"aktion": "tipp_name",
					"node": "Naechster",
					"erwarte": {"bedingung": track_gewechselt},
					"timeout_s": 20.0,
				},
				{"name": "neuer_titel_laeuft", "aktion": "warte", "sekunden": 1.5},
				{
					"name": "like_buchen",
					"aktion": "tipp_name",
					"node": "Like",
					"erwarte": {"bedingung": like_verbucht},
					"timeout_s": 20.0,
				},
				{"name": "like_ansehen", "aktion": "warte", "sekunden": 1.5},
				# Der Schließen-Knopf ist das LETZTE Sheet-Kind und liegt
				# unter der Scroll-Falz des PanelSheet (%SheetScroll) — erst
				# einscrollen, dann per Position tippen (Muster flow_dlc_hub).
				# Vorher fand tipp_name ihn gar nicht: _baue_ui benannte die
				# Direktkinder nach jedem Senderwechsel um (PT-meta F4).
				{
					"name": "schliessen_einscrollen",
					"aktion": "tue",
					"funktion": merke_knopf.bind("Schliessen"),
					"erwartung": "Schliessen-Knopf im Sheet gefunden + eingescrollt",
				},
				{
					"name": "radio_schliessen",
					"aktion": "tipp_pos",
					"pos_funktion": merk_knopf_mitte,
					"erwarte": {"weg_klasse": "RadioSheet"},
					"timeout_s": 20.0,
				},
				# Musik läuft nach dem Schließen weiter (Save-Beweis).
				{
					"name": "spielt_weiter",
					"aktion": "warte_bis",
					"bedingung": radio_spielt,
					"erwartung": "radio.playing bleibt true nach dem Schließen",
					"timeout_s": 10.0,
				},
				{"name": "abschluss_wohnzimmer", "aktion": "warte", "sekunden": 1.0},
			]
		)
	)
	return liste


## Vollradio erkannt: mindestens ein Sender-Chip ist im Baum sichtbar.
func vollradio_da() -> bool:
	var chips := harness.root.find_child("SenderChips", true, false)
	return chips is Control and (chips as Control).is_visible_in_tree()


func radio_spielt() -> bool:
	var gs := game_state()
	return gs != null and bool(gs.get_value("radio.playing", false))


func sender_gewechselt() -> bool:
	var gs := game_state()
	return gs != null and str(gs.get_value("radio.station", "")) == "gooby-fm"


func merke_track() -> bool:
	_track_vorher = _aktueller_track()
	return _track_vorher != ""


func track_gewechselt() -> bool:
	var jetzt := _aktueller_track()
	return jetzt != "" and jetzt != _track_vorher


## Like additiv in radio.likes (RadioLogic.toggle_like: {track_id: true})?
func like_verbucht() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var likes: Variant = gs.get_value("radio.likes", {})
	return likes is Dictionary and (likes as Dictionary).size() >= 1


## Aktuelle Track-Id über den MusicDirector-Knoten (der RadioSheet-Weg).
func _aktueller_track() -> String:
	var director := _finde_music_director(harness.root)
	if director == null or not director.has_method("current_track_id"):
		return ""
	return str(director.current_track_id())


func _finde_music_director(node: Node) -> Node:
	var skript: Variant = node.get_script()
	if skript is Script and (skript as Script).get_global_name() == &"MusicDirector":
		return node
	for kind in node.get_children():
		var treffer := _finde_music_director(kind)
		if treffer != null:
			return treffer
	return null
