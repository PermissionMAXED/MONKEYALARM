extends TestCase
## GOOBY LOOP — GOOBERANDO-Küchen-Ambience: in der KÜCHEN-Phase zeigt die
## App den „Blick in die Küche“ (GooberandoKueche: Koch + Kochmütze +
## dampfender Topf + Marken-Tresen + Papiertüte) statt der parkenden
## Live-Karte; unterwegs übernimmt wieder die Karte. Der Sekunden-Tick
## aktualisiert Countdown/Fahrer-Punkt IN PLACE (kein Voll-Rebuild —
## Dampf und Koch-Anim leben durch), erst der Phasen-Wechsel baut neu.
## Küchen-Zeilen rotieren über die OrtLeben-Domain gooberando_kueche
## (DE führend, EN-Parität sichert das W1c-Strings-Tor).

const SaveSchema := preload("res://scripts/state/save_schema.gd")

const NOW := 1768478400000
## Küchen-Wartezeit der Test-Bestellung VOR der Abfahrt (ms).
const KUECHE_MS := 120000


## GameState-Double (Muster test_g4_travel): dotted get/set + update.
class FakeGameState:
	extends RefCounted
	var s: Dictionary = {}
	var clock := FakeClock.new()

	func _init() -> void:
		s = SaveSchema.default_state(1768478400000)

	func state() -> Dictionary:
		return s

	func get_value(path: String, fallback: Variant = null) -> Variant:
		var node: Variant = s
		for part in path.split("."):
			if node is Dictionary and (node as Dictionary).has(part):
				node = node[part]
			else:
				return fallback
		return node

	func set_value(path: String, wert: Variant) -> void:
		var teile := path.split(".")
		var node: Dictionary = s
		for i in teile.size() - 1:
			if not (node.get(teile[i]) is Dictionary):
				node[teile[i]] = {}
			node = node[teile[i]]
		node[teile[teile.size() - 1]] = wert

	func update(mutator: Callable) -> void:
		mutator.call(s)

	func notify_slice_changed(_slice_id: String) -> void:
		pass


class FakeClock:
	extends RefCounted
	var ms := 1768478400000

	func now_ms() -> int:
		return ms


## Fahrzeit der Möhrenschmiede-Route (ms) — bestimmt die Phasen-Fenster.
func _fahrzeit_ms() -> int:
	var karte := CityMap.laden()
	var graph := CityRoadGraph.aus_karte(karte)
	var route := GooberandoFahrerSim.route_welt(
		karte, graph, GooberandoRestaurants.strasse_tile("moehrenschmiede"), karte.zuhause_tile()
	)
	return int(GooberandoFahrerSim.fahrzeit_s(route) * 1000.0)


## App mit laufender Bestellung mounten (fertigAt = Küche + Fahrzeit).
func _app_mit_bestellung(clock_ms: int) -> GooberandoApp:
	var gs := FakeGameState.new()
	gs.set_value("economy.coins", 500)
	(
		gs
		. set_value(
			"city.gooberando",
			{
				"state": GooberandoLogic.STATE_BESTELLT,
				"bestelltAt": NOW,
				"fertigAt": NOW + KUECHE_MS + _fahrzeit_ms(),
				"restaurantId": "moehrenschmiede",
				"gerichte": ["carrot"],
				"gerichtId": "carrot",
			}
		)
	)
	gs.clock.ms = clock_ms
	var app := GooberandoApp.new()
	app.gs = gs
	tree.root.add_child(app)
	await wait_frames(1)
	return app


func _abbauen(app: GooberandoApp) -> void:
	tree.root.remove_child(app)
	app.free()


## ------------------------------------------------------- Phasen-Ansichten


func test_kuechen_phase_zeigt_kuechen_blick_statt_karte() -> void:
	var app := await _app_mit_bestellung(NOW + 5000)
	var blick: Control = app.find_child("KuechenBlick", true, false)
	assert_ne(blick, null, "Küchen-Phase zeigt den Blick in die Küche")
	assert_true(
		app.find_children("*", "CityMinimap", true, false).is_empty(),
		"keine parkende Live-Karte in der Küchen-Phase"
	)
	var dampf: CPUParticles3D = blick.find_child("Dampf", true, false)
	assert_ne(dampf, null, "der Topf dampft")
	assert_true(dampf.amount > 0, "Dampf hat Teilchen")
	assert_true(dampf.preprocess > 0.0, "Dampf ist ab Frame 1 eingeschwungen")
	assert_ne(blick.find_child("Koch", true, false), null, "der Koch steht in der Küche")
	assert_ne(blick.find_child("Kochmuetze", true, false), null, "Kochmütze sitzt")
	assert_ne(blick.find_child("PapierTuete", true, false), null, "Marken-Tüte steht bereit")
	assert_ne(blick.find_child("TresenBand", true, false), null, "oranges Marken-Band am Tresen")
	assert_ne(app._kuechen_spruch, null, "Küchen-Zeile steht unter dem Porträt")
	assert_true(str(app._kuechen_spruch.text).begins_with("„"), "Zeile in Anführungszeichen")
	_abbauen(app)


func test_unterwegs_phase_zeigt_karte_statt_kueche() -> void:
	var app := await _app_mit_bestellung(NOW + KUECHE_MS + _fahrzeit_ms() / 2)
	assert_eq(app.find_child("KuechenBlick", true, false), null, "Küchen-Blick ist abgebaut")
	var mini: CityMinimap = null
	for kind in app.find_children("*", "CityMinimap", true, false):
		mini = kind
	assert_ne(mini, null, "unterwegs übernimmt die Live-Karte")
	assert_ne(app._fahrer_overlay, null, "Fahrer-Overlay steht auf der Karte")
	_abbauen(app)


## ------------------------------------------------------ In-Place-Tick


func test_tick_aktualisiert_kueche_in_place() -> void:
	var app := await _app_mit_bestellung(NOW + 5000)
	var blick: Control = app.find_child("KuechenBlick", true, false)
	var label: Label = app._countdown_label
	assert_ne(label, null, "Countdown-Label ist referenziert")
	var text_vorher := str(label.text)
	(app.gs as FakeGameState).clock.ms += 1000
	app._tick()
	await wait_frames(1)
	assert_true(
		app.find_child("KuechenBlick", true, false) == blick,
		"gleiche Küchen-Instanz — kein Voll-Rebuild pro Sekunde"
	)
	assert_false(blick.is_queued_for_deletion(), "Küche lebt durch (Dampf reißt nicht ab)")
	assert_true(app._countdown_label == label, "gleiches Countdown-Label")
	assert_ne(str(label.text), text_vorher, "Countdown-Text tickt weiter")
	_abbauen(app)


func test_tick_bewegt_fahrer_punkt_in_place() -> void:
	var app := await _app_mit_bestellung(NOW + KUECHE_MS + _fahrzeit_ms() / 2)
	var mini: CityMinimap = null
	for kind in app.find_children("*", "CityMinimap", true, false):
		mini = kind
	var punkt_vorher: Vector3 = app._fahrer_overlay.fahrer
	(app.gs as FakeGameState).clock.ms += 2000
	app._tick()
	await wait_frames(1)
	var mini_nachher: CityMinimap = null
	for kind in app.find_children("*", "CityMinimap", true, false):
		mini_nachher = kind
	assert_true(mini_nachher == mini, "gleiche Karten-Instanz — kein Rebuild")
	assert_ne(app._fahrer_overlay.fahrer, punkt_vorher, "Fahrer-Punkt wandert in place")
	_abbauen(app)


func test_phasen_wechsel_baut_die_karte_auf() -> void:
	var app := await _app_mit_bestellung(NOW + 5000)
	assert_ne(app.find_child("KuechenBlick", true, false), null, "Start in der Küche")
	(app.gs as FakeGameState).clock.ms = NOW + KUECHE_MS + _fahrzeit_ms() / 2
	app._tick()
	await wait_frames(2)
	assert_eq(app.find_child("KuechenBlick", true, false), null, "Küche macht der Karte Platz")
	assert_false(
		app.find_children("*", "CityMinimap", true, false).is_empty(),
		"Phasen-Wechsel baut die Live-Karte auf"
	)
	_abbauen(app)


## ------------------------------------------------- Küchen-Bausteine + pur


func test_kueche_solo_reduced_motion_ruht() -> void:
	var kueche := GooberandoKueche.new()
	kueche.reduced_override = 1
	tree.root.add_child(kueche)
	await wait_frames(1)
	var dampf: CPUParticles3D = kueche.find_child("Dampf", true, false)
	assert_eq(dampf.amount, GooberandoKueche.dampf_menge(true), "Reduced Motion: halber Dampf")
	assert_false(kueche.is_processing(), "Deckel ruht bei Reduced Motion")
	tree.root.remove_child(kueche)
	kueche.free()


func test_kueche_solo_deckel_klappert() -> void:
	var kueche := GooberandoKueche.new()
	kueche.reduced_override = 0
	tree.root.add_child(kueche)
	await wait_frames(1)
	var deckel: MeshInstance3D = kueche.find_child("TopfDeckel", true, false)
	var basis := deckel.position.y
	assert_true(kueche.is_processing(), "Deckel-Klappern läuft")
	kueche._process(0.1)
	assert_true(deckel.position.y > basis, "Deckel hebt sich im Sinus-Takt")
	tree.root.remove_child(kueche)
	kueche.free()


func test_dampf_und_deckel_pur() -> void:
	assert_eq(GooberandoKueche.dampf_menge(false), GooberandoKueche.DAMPF_MENGE)
	assert_eq(
		GooberandoKueche.dampf_menge(true),
		GooberandoKueche.DAMPF_MENGE / 2,
		"Reduced Motion halbiert den Dampf"
	)
	assert_almost(GooberandoKueche.deckel_hub(0.0), 0.0, 1e-9, "Start: Deckel liegt auf")
	var max_hub := 0.0
	for i in 100:
		var hub := GooberandoKueche.deckel_hub(float(i) * 0.07)
		assert_true(hub >= 0.0, "Deckel sinkt nie UNTER den Topf")
		assert_true(hub <= GooberandoKueche.DECKEL_HUB_M + 1e-9, "Hub bleibt gedeckelt")
		max_hub = maxf(max_hub, hub)
	assert_true(max_hub > 0.0, "der Deckel hebt sich wirklich")


func test_kuechen_sprueche_rotieren_ohne_wiederholung() -> void:
	OrtLeben.reset_sprueche_fuer_tests()
	var key := "city_leben.sprueche.gooberando_kueche"
	assert_true(I18nService.has_key(key), "Küchen-Spruch-Domain existiert")
	var liste := I18nService.items(key)
	assert_true(liste.size() >= 4, "genug Küchen-Zeilen")
	var gesehen: Dictionary = {}
	for _i in liste.size():
		var zeile := OrtLeben.naechster_spruch("gooberando_kueche")
		assert_false(zeile.is_empty(), "Zeile nie leer")
		assert_false(gesehen.has(zeile), "keine Wiederholung vor voller Runde")
		gesehen[zeile] = true
	assert_eq(OrtLeben.naechster_spruch("gooberando_kueche"), String(liste[0]), "dann von vorn")
	OrtLeben.reset_sprueche_fuer_tests()
