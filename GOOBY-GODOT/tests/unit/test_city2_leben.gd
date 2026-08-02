extends TestCase
## CITY-2 „Orte lebendig 3“ — Wachen für die neuen OrtLeben-Anschlüsse:
## Flughafen-Reisende inkl. Check-in-Kasse, das NEUE Kino GOOBYWOOD
## (Karte/Szene, Tagesprogramm, atomarer Ticketkauf, Vorstellung,
## Ambient-Kinogänger) und der lebendige GOOBERANDO-Fahrer (geteilter
## Käppi-Baustein + Spruch-Domain). Die Spruch-Domains flughafen/kino/
## gooberando sind gefüttert (EN-Parität sichert das W1c-Strings-Tor).

const FlughafenSzene := preload("res://scenes/city/orte/flughafen.tscn")
const KinoSzene := preload("res://scenes/city/orte/kino.tscn")

const SEED := 4711


## GameState-Double (Muster test_g7_ort_leben): dotted get + update-Pfad;
## state() braucht der UrlaubsBonus-/GOOBY-FREE-Pfad des Flughafens.
class FakeGameState:
	extends RefCounted

	signal slice_changed(slice_id: String, data: Variant)

	var daten: Dictionary = {}

	func _init(start: Dictionary = {}) -> void:
		daten = start

	func state() -> Dictionary:
		return daten

	func get_value(path: String, fallback: Variant = null) -> Variant:
		var node: Variant = daten
		for part in path.split("."):
			if node is Dictionary and (node as Dictionary).has(part):
				node = node[part]
			else:
				return fallback
		return node

	func update(mutator: Callable) -> void:
		mutator.call(daten)

	func notify_slice_changed(slice_id: String) -> void:
		slice_changed.emit(slice_id, daten.get(slice_id))


func _basis_state() -> Dictionary:
	return {
		"economy": {"coins": 500},
		"inventory": {"items": {}, "food": {}},
		"gooby": {"stats": {"fun": 40.0, "energy": 80.0}},
		"home": {"storage": [], "storageCapacity": 100},
		"buffs": {"aktiv": []},
		"city": {},
	}


## Ort sauber abbauen (Muster test_g7_ort_leben): erst die Plapper-Stimme
## entwerten, dann freigeben — sonst hängt die Babble-Koroutine am Timer.
func _ort_abbauen(ort: OrtScene) -> void:
	if ort.voice != null and is_instance_valid(ort.voice):
		ort.voice.sagt("")
	await wait_frames(6)
	ort.queue_free()
	await wait_frames(2)


## ------------------------------------------------------------- Flughafen


func test_flughafen_ist_lebendig() -> void:
	var gs := FakeGameState.new(_basis_state())
	var ort: OrtFlughafen = FlughafenSzene.instantiate()
	ort.game_state_override = gs
	ort.leben_seed_override = SEED
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	assert_ne(ort.leben, null, "Terminal hat Ambient-Leben")
	assert_eq(ort.leben.besucher_nodes().size(), 4, "4 Reisende unterwegs")
	assert_ne(ort.kassen_npc, null, "Schalter-Gooby hat das Kassen-Verhalten")
	assert_true(
		ort.leben.konfig.get("kasse_punkt") is Vector3, "ein Reisender steuert den Check-in an"
	)
	assert_true(
		ort.leben.kunde_kauft.is_connected(ort.kassen_npc.kunde_zahlt),
		"Check-in ist an den Schalter verdrahtet"
	)
	var piepse: int = ort.kassen_npc.piep_zaehler
	ort.leben.kunde_kauft.emit()
	assert_eq(ort.kassen_npc.piep_zaehler, piepse + 1, "Check-in piept am Schalter")
	assert_true(bool(ort.leben.konfig.get("gemurmel", false)), "Terminal-Gemurmel verdrahtet")
	assert_true(bool(ort.leben.konfig.get("tuer_glocke", false)), "Tür-Pling verdrahtet")
	await _ort_abbauen(ort)


## ------------------------------------------------------- Kino: Karte/Logik


func test_kino_steht_in_der_karte() -> void:
	var karte := CityMap.laden()
	var eintrag := OrtKatalog.eintrag("kino", karte)
	assert_false(eintrag.is_empty(), "Kino fehlt in city_map.json")
	assert_eq(str(eintrag.get("distrikt", "")), "zentrum", "Kino liegt im Zentrum")
	assert_true(OrtKatalog.betretbare_ids(karte).has("kino"), "Kino ist betretbar")
	assert_true(
		ResourceLoader.exists(str(eintrag.get("szene", ""))), "kino.tscn existiert wirklich"
	)
	assert_ne(
		I18nService.t(str(eintrag.get("name_key", ""))),
		str(eintrag.get("name_key", "")),
		"Kino-Name ist übersetzt"
	)
	assert_eq(karte.validieren(), [] as Array[String], "Karte bleibt konsistent")


func test_kino_tagesfilm_ist_deterministisch() -> void:
	var filme := I18nService.items("kino.filme")
	assert_true(filme.size() >= 4, "genug Parodie-Filme im Programm")
	assert_eq(OrtKino.heutiger_film(7), OrtKino.heutiger_film(7), "gleicher Seed = gleicher Film")
	assert_eq(String(filme[7 % filme.size()]), OrtKino.heutiger_film(7), "Seed wählt aus der Liste")
	assert_ne(OrtKino.heutiger_film(0), OrtKino.heutiger_film(1), "andere Tage, anderer Film")
	assert_false(OrtKino.heutiger_film().is_empty(), "Tages-Seed-Pfad liefert einen Film")


func test_kino_ticket_kauf_ist_atomar() -> void:
	var gs := FakeGameState.new(_basis_state())
	assert_eq(OrtKino.schaue_film(gs), OrtKino.KAUF_OK, "Ticket mit 500 Münzen klappt")
	assert_eq(int(gs.get_value("economy.coins", 0)), 500 - OrtKino.TICKET_PREIS, "Preis abgebucht")
	assert_almost(
		float(gs.get_value("gooby.stats.fun", 0.0)), 40.0 + OrtKino.FILM_SPASS, 0.001, "Spaß drauf"
	)
	var pleite := FakeGameState.new(_basis_state())
	(pleite.daten["economy"] as Dictionary)["coins"] = 3
	assert_eq(OrtKino.schaue_film(pleite), OrtKino.KAUF_PLEITE, "ohne Münzen kein Ticket")
	assert_eq(int(pleite.get_value("economy.coins", 0)), 3, "pleite: nichts abgebucht")
	assert_almost(
		float(pleite.get_value("gooby.stats.fun", 0.0)), 40.0, 0.001, "pleite: kein Spaß-Bonus"
	)
	assert_eq(OrtKino.schaue_film(null), OrtKino.KAUF_PLEITE, "ohne GameState kein Crash")


## --------------------------------------------------------- Kino: Ort-Mount


func test_kino_ist_lebendig_und_spielt_vor() -> void:
	var gs := FakeGameState.new(_basis_state())
	var ort: OrtKino = KinoSzene.instantiate()
	ort.game_state_override = gs
	ort.leben_seed_override = SEED
	ort.leben_stumm_override = true
	ort.reduced_override = 0
	tree.root.add_child(ort)
	await wait_frames(3)
	assert_ne(ort.leben, null, "Kino hat Ambient-Leben")
	assert_eq(ort.leben.besucher_nodes().size(), 3, "3 Kinogänger schlendern")
	assert_ne(ort.kassen_npc, null, "Frau Lumi hat die Popcorn-Kasse")
	assert_true(ort.leben.konfig.get("kasse_punkt") is Vector3, "einer kauft Popcorn")
	assert_ne(ort.find_child("Leinwand", true, false), null, "die Leinwand hängt")
	# Vorstellung: Ticket-Logik + Leinwand-Flackern (Zeit von Hand getaktet).
	assert_false(ort.ist_vorstellung(), "vor dem Ticket ist Ruhe")
	ort.starte_vorstellung()
	assert_true(ort.ist_vorstellung(), "Film ab")
	var leinwand := ort.find_child("Leinwand", true, false) as MeshInstance3D
	var mat := (leinwand.mesh as BoxMesh).material as StandardMaterial3D
	var vorher := mat.emission
	ort.advance_vorstellung(OrtKino.FLACKER_S + 0.05)
	assert_ne(mat.emission, vorher, "die Leinwand flackert im Takt")
	ort.advance_vorstellung(OrtKino.VORSTELLUNG_S)
	assert_false(ort.ist_vorstellung(), "nach VORSTELLUNG_S ist Abspann")
	assert_eq(mat.emission, OrtKino.LEINWAND_RUHE, "Leinwand zurück in Ruhe-Farbe")
	await _ort_abbauen(ort)


## ------------------------------------------------------ GOOBERANDO-Fahrer


func test_gooberando_fahrer_bausteine() -> void:
	# Das Dienst-Käppi kommt aus dem GETEILTEN OrtLeben-Baustein.
	var kaeppi := OrtLeben.baue_kaeppi(Color("#FF7A00"))
	assert_eq(kaeppi.name, "Hut", "Käppi-Baustein liefert den Hut-Node")
	assert_eq(kaeppi.get_child_count(), 2, "Kappe + Krempe")
	kaeppi.free()
	# Spruch-Domain rotiert ohne Wiederholung (Muster test_g7_ort_leben).
	OrtLeben.reset_sprueche_fuer_tests()
	var key := "city_leben.sprueche.gooberando"
	assert_true(I18nService.has_key(key), "Fahrer-Spruch-Domain existiert")
	var liste := I18nService.items(key)
	assert_true(liste.size() >= 4, "genug Fahrer-Sprüche")
	var gesehen: Dictionary = {}
	for _i in liste.size():
		var zeile := OrtLeben.naechster_spruch("gooberando")
		assert_false(zeile.is_empty(), "Spruch nie leer")
		assert_false(gesehen.has(zeile), "keine Wiederholung vor voller Runde")
		gesehen[zeile] = true
	assert_eq(OrtLeben.naechster_spruch("gooberando"), String(liste[0]), "dann von vorn")
	OrtLeben.reset_sprueche_fuer_tests()


func test_neue_spruch_domains_sind_gefuettert() -> void:
	for domain in ["flughafen", "kino"]:
		var key := "city_leben.sprueche.%s" % domain
		assert_true(I18nService.has_key(key), "Spruch-Domain fehlt: %s" % key)
		assert_true(I18nService.items(key).size() >= 4, "%s hat genug Zeilen" % key)
