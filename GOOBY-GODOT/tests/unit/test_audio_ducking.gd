extends TestCase
## AUDIO-Polish „Dialog-Ducking + Laden-Ambience“ (AUDIO-GRAMMATIK) —
## Wachen: (1) der AudioDirector duckt Musik-Bus und Ambience-Loops
## ref-gezählt, solange Sprechblasen offen sind (weiche Flanken, erst die
## letzte Blase gibt frei); (2) AcBubble meldet sich nur in den SPRECH-
## Stilen an (gooby/witz ja, system und Ambient-Geplauder duck:false
## nein) und bleibt auch bei hartem queue_free balanciert; (3)
## DialogBubble duckt über die ganze Zeilen-
## Sequenz; (4) Ambience-Loops blenden weich ein, starten an zufälliger
## Loop-Stelle und tragen den offset_db-Feinpegel; (5) das Laden-Gemurmel
## skaliert mit der Besucherzahl (PURE).

const GEMURMEL_ID := "ranch_menge_gemurmel"
const GEMURMEL_TRIM_DB := -10.0

## Nur gesetzt, wenn ein Test den Director selbst anlegen musste (läuft
## die Suite regulär, existiert das Autoload /root/Audio bereits).
var _eigener_director: AudioDirector


func test_duck_refcount_pur() -> void:
	var director := AudioDirector.new()
	director.duck_begin()
	director.duck_begin()
	assert_true(director.is_ducked(), "Zwei Blasen offen → geduckt.")
	assert_almost(director._duck_faktor, 1.0, 1e-4, "Ohne Baum greift der Duck sofort.")
	director.duck_end()
	assert_true(director.is_ducked(), "Erste Freigabe: die zweite Blase hält den Duck.")
	director.duck_end()
	assert_false(director.is_ducked(), "Letzte Freigabe hebt den Duck auf.")
	assert_almost(director._duck_faktor, 0.0, 1e-4, "Faktor fährt auf 0 zurück.")
	director.duck_end()
	assert_eq(director._duck_count, 0, "Über-Freigabe zählt nie unter 0.")
	director.free()


func test_duck_faehrt_musikeffekt_weich() -> void:
	var director := AudioDirector.new()
	tree.root.add_child(director)
	await wait_frames(1)
	var idx := AudioServer.get_bus_index("Music")
	assert_true(idx >= 0, "Music-Bus existiert nach _ready.")
	if idx < 0:
		tree.root.remove_child(director)
		director.free()
		return
	var vorher := AudioServer.get_bus_volume_db(idx)
	assert_true(_duck_effekt(idx) != null, "Duck-Amplify sitzt auf dem Music-Bus.")
	director.duck_begin()
	assert_true(
		director._duck_faktor < 1.0, "Duck springt nicht hart, sondern fährt weich (Tween-Flanke)."
	)
	var geduckt: bool = await wait_until(
		func() -> bool: return absf(director._duck_faktor - 1.0) < 1e-3, 4000
	)
	assert_true(geduckt, "Duck fährt auf 1.0.")
	assert_almost(
		_duck_effekt(idx).volume_db,
		AudioDirector.DUCK_MUSIC_DB,
		0.1,
		"Amplify-Effekt zieht die Musik im Duck 6 dB runter."
	)
	assert_almost(
		AudioServer.get_bus_volume_db(idx),
		vorher,
		0.01,
		"Die BUS-Lautstärke (Regler + Basis-Offset) bleibt vom Duck unberührt."
	)
	director.duck_end()
	var frei: bool = await wait_until(func() -> bool: return director._duck_faktor < 1e-3, 4000)
	assert_true(frei, "Release fährt zurück auf 0.")
	assert_almost(_duck_effekt(idx).volume_db, 0.0, 0.1, "Effekt wieder neutral.")
	tree.root.remove_child(director)
	director.free()


func test_loop_blendet_ein_und_duckt() -> void:
	var director := AudioDirector.new()
	tree.root.add_child(director)
	await wait_frames(1)
	director.start_loop(GEMURMEL_ID, -2.0)
	var player: AudioStreamPlayer = director._loop_players.get(GEMURMEL_ID)
	assert_true(player != null and player.playing, "Gemurmel-Loop läuft.")
	if player == null:
		tree.root.remove_child(director)
		director.free()
		return
	assert_almost(
		float(player.get_meta("basis_db")),
		GEMURMEL_TRIM_DB - 2.0,
		1e-4,
		"offset_db sitzt ZUSÄTZLICH zum SfxMap-Trim."
	)
	assert_true(player.volume_db < -30.0, "Einblendung startet leise (kein Hart-Schnitt).")
	var eingefadet: bool = await wait_until(func() -> bool: return player.volume_db > -12.5, 4000)
	assert_true(eingefadet, "Loop blendet auf den Basis-Pegel ein.")
	director.duck_begin()
	var geduckt: bool = await wait_until(func() -> bool: return player.volume_db < -16.5, 4000)
	assert_true(geduckt, "Dialog-Duck zieht den Ambience-Loop ~5 dB runter.")
	director.duck_end()
	var zurueck: bool = await wait_until(func() -> bool: return player.volume_db > -12.5, 4000)
	assert_true(zurueck, "Nach der letzten Blase kommt das Gemurmel zurück.")
	director.stop_loop(GEMURMEL_ID)
	assert_false(director.is_loop_playing(GEMURMEL_ID), "stop_loop trägt den Loop aus.")
	await wait_frames(2)
	tree.root.remove_child(director)
	director.free()


func test_loop_startposition_im_bereich() -> void:
	var director := AudioDirector.new()
	var stream: AudioStream = load(SfxMap.path(GEMURMEL_ID))
	assert_true(stream != null and stream.get_length() > 2.0, "Gemurmel-Bett ist ein Bett.")
	for _i in 8:
		var pos := director._loop_startposition(stream)
		assert_true(
			pos >= 0.0 and pos <= stream.get_length() - 0.25,
			"Zufalls-Einstieg bleibt im Loop-Bereich."
		)
	director.free()


func test_acbubble_duckt_nur_sprechende_stile() -> void:
	AcBubble.warteschlange = AcBubble.Warteschlange.new()
	UiAnchors.reset_for_tests()
	var director := _hole_director()
	await wait_frames(1)
	var basis: int = director._duck_count
	var layer := Control.new()
	tree.root.add_child(layer)
	var gooby := AcBubble.show_bubble(layer, "Ohh, wird das schön!", {"dauer_s": 600.0})
	gooby.auto_zeit = false
	assert_eq(director._duck_count, basis + 1, "Gooby-Blase duckt.")
	var witz := AcBubble.show_bubble(layer, "Erstmal Goobyn!", {"stil": "witz", "dauer_s": 600.0})
	witz.auto_zeit = false
	assert_eq(director._duck_count, basis + 2, "Zweite Sprech-Blase zählt hoch (ref-gezählt).")
	var system := AcBubble.show_bubble(layer, "Spielstand gesichert.", {"stil": "system"})
	system.auto_zeit = false
	witz.dismiss()
	assert_eq(
		director._duck_count, basis + 1, "Witz-Freigabe; die nachrückende System-Blase duckt NICHT."
	)
	gooby.dismiss()
	assert_eq(director._duck_count, basis, "Letzte Sprech-Blase gibt den Duck frei.")
	var ambient := AcBubble.show_bubble(
		layer, "Schau mal, die Regale!", {"dauer_s": 600.0, "duck": false}
	)
	ambient.auto_zeit = false
	assert_eq(director._duck_count, basis, "Ambient-Geplauder (duck:false) duckt NICHT.")
	layer.queue_free()
	await wait_frames(2)
	assert_eq(director._duck_count, basis, "Auch nach dem Layer-Abriss balanciert.")
	await _duck_ausklingen_lassen(director)
	_director_aufraeumen()


func test_acbubble_harter_abriss_bleibt_balanciert() -> void:
	AcBubble.warteschlange = AcBubble.Warteschlange.new()
	UiAnchors.reset_for_tests()
	var director := _hole_director()
	await wait_frames(1)
	var basis: int = director._duck_count
	var layer := Control.new()
	tree.root.add_child(layer)
	var bubble := AcBubble.show_bubble(layer, "Kurz da!", {"dauer_s": 600.0})
	bubble.auto_zeit = false
	assert_eq(director._duck_count, basis + 1, "Blase offen → geduckt.")
	# Hartes queue_free von außen (Szenenwechsel): _exit_tree gibt frei.
	layer.queue_free()
	await wait_frames(2)
	assert_eq(director._duck_count, basis, "Harter Abriss gibt den Duck über _exit_tree frei.")
	await _duck_ausklingen_lassen(director)
	_director_aufraeumen()


func test_dialogbubble_duckt_ueber_die_sequenz() -> void:
	UiAnchors.reset_for_tests()
	var director := _hole_director()
	await wait_frames(1)
	var basis: int = director._duck_count
	var bubble := (
		(load("res://scripts/ui/dialog_bubble.tscn") as PackedScene).instantiate() as DialogBubble
	)
	bubble.sofort_override = 1
	tree.root.add_child(bubble)
	await wait_frames(1)
	var zeilen: Array[String] = ["Hallo!", "Bis bald!"]
	bubble.show_lines(zeilen)
	assert_eq(director._duck_count, basis + 1, "Sequenz offen → geduckt.")
	bubble._advance()
	assert_eq(director._duck_count, basis + 1, "Zweite Zeile hält den Duck (EINE Anmeldung).")
	bubble._advance()
	assert_eq(director._duck_count, basis, "Nach der letzten Zeile ist der Duck frei.")
	tree.root.remove_child(bubble)
	bubble.free()
	await _duck_ausklingen_lassen(director)
	_director_aufraeumen()


func test_gemurmel_skaliert_mit_besucherzahl() -> void:
	assert_almost(OrtLeben.gemurmel_offset_db(0), -6.0, 1e-4, "Leerer Laden murmelt leise.")
	assert_almost(OrtLeben.gemurmel_offset_db(2), -3.0, 1e-4, "Halbe Schar = halber Weg.")
	assert_almost(OrtLeben.gemurmel_offset_db(4), 0.0, 1e-4, "Volle Schar = Bestands-Pegel.")
	assert_almost(OrtLeben.gemurmel_offset_db(9), 0.0, 1e-4, "Nie lauter als der Trim.")
	assert_almost(OrtLeben.gemurmel_offset_db(-3), -6.0, 1e-4, "Degeneriert geklemmt.")


## Director, den AcBubble/DialogBubble über get_or_create finden: das
## Autoload /root/Audio (regulärer Suitelauf) — nur zur Not ein eigener.
func _hole_director() -> AudioDirector:
	var audio := tree.root.get_node_or_null("Audio")
	if audio is AudioDirector:
		return audio
	var vorhanden := tree.root.get_node_or_null(AudioDirector.NODE_NAME)
	if vorhanden is AudioDirector:
		return vorhanden
	_eigener_director = AudioDirector.new()
	_eigener_director.name = AudioDirector.NODE_NAME
	tree.root.add_child(_eigener_director)
	return _eigener_director


## Release-Flanke (0,6 s Tween auf dem geteilten Autoload) AUSKLINGEN
## lassen, bevor der Test endet — sonst sieht ein Folgetest (z. B. die
## ef2-Bus-Wache) den Music-Bus mitten in der Rückblende.
func _duck_ausklingen_lassen(director: AudioDirector) -> void:
	if director._duck_count > 0:
		return
	var still: bool = await wait_until(func() -> bool: return director._duck_faktor < 1e-3, 4000)
	assert_true(still, "Release-Flanke klingt aus (kein Faden in Folgetests).")


## Der Duck-Amplify-Effekt auf dem Music-Bus (null = nicht vorhanden).
func _duck_effekt(bus_idx: int) -> AudioEffectAmplify:
	for i in AudioServer.get_bus_effect_count(bus_idx):
		var effekt := AudioServer.get_bus_effect(bus_idx, i)
		if effekt is AudioEffectAmplify:
			return effekt
	return null


func _director_aufraeumen() -> void:
	if _eigener_director == null:
		return
	tree.root.remove_child(_eigener_director)
	_eigener_director.free()
	_eigener_director = null
