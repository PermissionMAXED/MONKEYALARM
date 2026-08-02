extends TestCase
## G7-P55 „LÄDEN LEBENDIG“ — Wachen fürs Ort-Ambient-System (OrtLeben +
## KassenNpc + IkeaSchaufenster): deterministische Besucher-Pläne (Seed!),
## Wegpunkt-Schlendern mit Regal-Pausen, Ort-Mount spawnt die erwartete
## Besucherzahl, Besucher bewegen sich über Zeit, Reduced Motion reduziert
## und macht statisch, Kassen-NPC existiert + reagiert auf Käufe,
## Sprüche-Rotation DE/EN-gestützt, IKEA-Vitrinen-Hintergrund lebt.
## SHOPS-1 dazu: Ambient-Käufer bezahlt an der Kasse (kasse_punkt, einmal
## pro Runde) und der IKEA-Screen bekommt Ambiente-Sound + Durchsagen.

const RehweiSzene := preload("res://scenes/city/orte/rehwei.tscn")
const BaumarktSzene := preload("res://scenes/city/orte/baumarkt.tscn")

const SEED := 4711


## GameState-Double (Muster test_g3_orte): dotted get/set + update-Pfad.
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
		"city": {},
	}


func _leben_konfig() -> Dictionary:
	return {
		"besucher": 3,
		"punkte":
		[
			Vector3(-3.0, 0.0, -0.5),
			Vector3(0.0, 0.0, 1.0),
			Vector3(3.0, 0.0, -0.5),
			Vector3(1.0, 0.0, 1.5),
		],
		"sprueche": "laden",
	}


## Ort sauber abbauen: erst die Plapper-Stimme entwerten (leeres sagt()
## bricht die Babble-Schleife beim nächsten Timer-Tick), DANN freigeben.
## Wird der Ort mitten im `await create_timer` gefreed, hängt die
## Koroutine dauerhaft am SceneTreeTimer (Leak-Warnung am Runner-Exit) —
## vorbestehendes OrtScene-Verhalten, s. gooby_voice._babble.
func _ort_abbauen(ort: OrtScene) -> void:
	if ort.voice != null and is_instance_valid(ort.voice):
		ort.voice.sagt("")
	await wait_frames(6)
	ort.queue_free()
	await wait_frames(2)


## ------------------------------------------------------------ Pure Planung


func test_plaene_sind_deterministisch() -> void:
	var a := OrtLeben.plaene(_leben_konfig(), SEED)
	var b := OrtLeben.plaene(_leben_konfig(), SEED)
	assert_eq(a.size(), 3, "drei Besucher geplant")
	for i in a.size():
		assert_eq(a[i]["punkte"], b[i]["punkte"], "Besucher %d läuft dieselbe Runde" % i)
		assert_eq(a[i]["tempo"], b[i]["tempo"], "Besucher %d gleiches Tempo" % i)
		assert_eq(a[i]["tint"], b[i]["tint"], "Besucher %d gleiche Fellfarbe" % i)
		assert_eq(a[i]["hut"], b[i]["hut"], "Besucher %d gleicher Hut" % i)
		var tempo := float(a[i]["tempo"])
		assert_true(
			tempo >= OrtLeben.TEMPO_MIN and tempo <= OrtLeben.TEMPO_MAX,
			"Schlender-Tempo im Fenster"
		)
	assert_ne(
		OrtLeben.plaene(_leben_konfig(), 9)[0]["punkte"],
		a[0]["punkte"],
		"anderer Seed ⇒ andere Runde"
	)


func test_plaene_brauchen_punkte_und_anzahl() -> void:
	assert_eq(OrtLeben.plaene({}, SEED).size(), 0, "ohne Konfig kein Leben")
	assert_eq(
		OrtLeben.plaene({"besucher": 2, "punkte": [Vector3.ZERO]}, SEED).size(),
		0,
		"ein einzelner Punkt ergibt keine Runde"
	)


func test_zustand_geht_und_pausiert() -> void:
	var plan := {
		"punkte": [Vector3.ZERO, Vector3(2.0, 0.0, 0.0)],
		"tempo": 1.0,
		"pause_s": 1.0,
		"phase": 0.0,
		"blick": Vector3(0.0, 0.0, -4.0),
	}
	var start := OrtLeben.zustand(plan, 0.0)
	assert_eq(start["pos"], Vector3.ZERO, "Start am ersten Punkt")
	assert_false(bool(start["steht"]), "los geht es zu Fuß")
	var mitte := OrtLeben.zustand(plan, 1.0)
	assert_eq(mitte["pos"], Vector3(1.0, 0.0, 0.0), "nach 1 s bei 1 m/s = 1 m")
	var pause := OrtLeben.zustand(plan, 2.5)
	assert_true(bool(pause["steht"]), "am Wegpunkt wird das Regal angeschaut")
	assert_eq(pause["pos"], Vector3(2.0, 0.0, 0.0), "Pause AM Punkt")
	assert_almost(float(pause["pause_frac"]), 0.5, 0.001, "mitten in der Pause")
	var zurueck := OrtLeben.zustand(plan, 4.0)
	assert_false(bool(zurueck["steht"]), "danach geht es zurück")
	assert_eq(zurueck["pos"], Vector3(1.0, 0.0, 0.0), "halber Rückweg")
	var runde := OrtLeben.zustand(plan, 6.0)
	assert_eq(runde["pos"], OrtLeben.zustand(plan, 0.0)["pos"], "Runde wiederholt sich")


## SHOPS-1: mit `kasse_punkt` wird GENAU EIN Besucher zum Käufer — er
## steuert die Kasse exakt an (kein Jitter), alle anderen bleiben Bummler.
func test_kasse_punkt_macht_genau_einen_kaeufer() -> void:
	var konfig := _leben_konfig()
	var kasse := Vector3(0.2, 0.0, -0.4)
	konfig["kasse_punkt"] = kasse
	var alle := OrtLeben.plaene(konfig, SEED)
	var kaeufer: Array[int] = []
	for i in alle.size():
		var plan := alle[i]
		if not bool(plan["kauft"]):
			assert_eq(int(plan["kasse_index"]), -1, "Bummler kennen keinen Kassen-Index")
			continue
		kaeufer.append(i)
		var punkte: Array = plan["punkte"]
		assert_eq(
			Vector3(punkte[int(plan["kasse_index"])]), kasse, "Käufer steht EXAKT vor dem Tresen"
		)
	assert_eq(kaeufer.size(), 1, "genau EIN Besucher kauft ein")
	var nochmal := OrtLeben.plaene(konfig, SEED)
	assert_true(bool(nochmal[kaeufer[0]]["kauft"]), "gleicher Seed ⇒ gleicher Käufer")
	for plan in OrtLeben.plaene(_leben_konfig(), SEED):
		assert_false(bool(plan.get("kauft", false)), "ohne kasse_punkt kauft niemand")


## SHOPS-1: `zustand` meldet Steh-Punkt (punkt_index) und Rundenzähler —
## die Träger des Einmal-pro-Runde-Kassenbesuchs.
func test_zustand_meldet_runde_und_punkt_index() -> void:
	var plan := {
		"punkte": [Vector3.ZERO, Vector3(2.0, 0.0, 0.0)],
		"tempo": 1.0,
		"pause_s": 1.0,
		"phase": 0.0,
		"blick": Vector3(0.0, 0.0, -4.0),
	}
	# Zyklus = 2 s hin + 1 s Pause + 2 s zurück + 1 s Pause = 6 s.
	var unterwegs := OrtLeben.zustand(plan, 1.0)
	assert_eq(int(unterwegs["punkt_index"]), -1, "unterwegs gibt es keinen Steh-Punkt")
	assert_eq(int(unterwegs["runde"]), 0, "erste Runde")
	var pause := OrtLeben.zustand(plan, 2.5)
	assert_eq(int(pause["punkt_index"]), 1, "Pause am ZWEITEN Punkt")
	var daheim := OrtLeben.zustand(plan, 5.5)
	assert_eq(int(daheim["punkt_index"]), 0, "Rück-Pause am Startpunkt")
	assert_eq(int(daheim["runde"]), 0, "immer noch Runde 0")
	var zweite := OrtLeben.zustand(plan, 8.5)
	assert_eq(int(zweite["punkt_index"]), 1, "gleiche Stelle in Runde 2")
	assert_eq(int(zweite["runde"]), 1, "Rundenzähler zählt hoch")


## SHOPS-1: der Käufer „bezahlt“ mitten in seiner Kassen-Pause — und zwar
## genau EINMAL pro Runde (Runden-Marke gegen Doppel-Piepser).
func test_ambient_kunde_kauft_einmal_pro_runde() -> void:
	var leben := OrtLeben.new()
	leben.konfig = {
		"besucher": 2,
		"punkte":
		[
			Vector3(-2.0, 0.0, 0.0),
			Vector3(2.0, 0.0, 0.0),
			Vector3(0.0, 0.0, 2.0),
		],
		"kasse_punkt": Vector3(0.0, 0.0, -1.0),
	}
	leben.seed_override = SEED
	leben.reduced_override = 0
	leben.auto_zeit = false
	leben.stumm = true
	tree.root.add_child(leben)
	await wait_frames(1)
	var treffer := [0]
	leben.kunde_kauft.connect(func() -> void: treffer[0] += 1)
	var sim := 0.0
	while treffer[0] == 0 and sim < 300.0:
		leben.advance_zeit(0.4)
		sim += 0.4
	assert_eq(treffer[0], 1, "der Ambient-Käufer hat an der Kasse bezahlt")
	# Winziger Zeitschritt: er steht noch in DERSELBEN Pause — kein 2. Piep.
	leben.advance_zeit(0.05)
	assert_eq(treffer[0], 1, "nur EIN Kauf pro Runde (keine Doppel-Piepser)")
	leben.queue_free()
	await wait_frames(1)


## ------------------------------------------------------- Ort-Mount REHWEI


func test_rehwei_spawnt_besucher_kasse_und_leben() -> void:
	var gs := FakeGameState.new(_basis_state())
	var ort: OrtRehwei = RehweiSzene.instantiate()
	ort.game_state_override = gs
	ort.leben_seed_override = SEED
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	assert_ne(ort.leben, null, "OrtLeben hängt im Baum")
	assert_ne(ort.find_child("OrtLeben", true, false), null, "OrtLeben-Node benannt")
	assert_eq(ort.leben.besucher_nodes().size(), 3, "REHWEI hat 3 Ambient-Kunden")
	assert_false(ort.leben.ist_statisch(), "ohne Reduced Motion wird geschlendert")
	assert_ne(ort.kassen_npc, null, "Frau Rehwald hat ihr Kassen-Verhalten")
	assert_eq(ort.kassen_npc.rig, ort.rig, "Kasse steuert den Haupt-NPC")
	# SHOPS-1: Ambient-Käufer — REHWEI hat einen Kassen-Punkt und dessen
	# kunde_kauft-Signal piept an Frau Rehwalds Kasse.
	assert_true(ort.leben.konfig.get("kasse_punkt") is Vector3, "REHWEI hat einen Kassen-Punkt")
	assert_true(
		ort.leben.kunde_kauft.is_connected(ort.kassen_npc.kunde_zahlt),
		"Ambient-Käufe sind an die Kasse verdrahtet"
	)
	var piepse: int = ort.kassen_npc.piep_zaehler
	ort.leben.kunde_kauft.emit()
	assert_eq(ort.kassen_npc.piep_zaehler, piepse + 1, "kunde_kauft ⇒ Kassen-Piep")
	# Audio-Verdrahtung (stumm getestet, s. OrtLeben.stumm): Glöckchen +
	# Gemurmel sind konfiguriert, die Ids existieren in der SfxMap.
	assert_true(bool(ort.leben.konfig.get("tuer_glocke", false)), "Tür-Glöckchen verdrahtet")
	assert_true(bool(ort.leben.konfig.get("gemurmel", false)), "Marktgemurmel verdrahtet")
	assert_false(SfxMap.entry(OrtLeben.GLOCKE_ID).is_empty(), "Glocken-Id existiert")
	assert_false(SfxMap.entry(OrtLeben.GEMURMEL_ID).is_empty(), "Gemurmel-Id existiert")
	assert_false(SfxMap.entry(KassenNpc.PIEP_ID).is_empty(), "Kassen-Piep-Id existiert")
	# Besucher bewegen sich über Zeit (deterministische Zeit-Injektion).
	var vorher: Array[Vector3] = []
	for node in ort.leben.besucher_nodes():
		vorher.append(node.position)
	var bewegt := false
	for _schritt in 4:
		ort.leben.advance_zeit(2.7)
		var nodes := ort.leben.besucher_nodes()
		for i in nodes.size():
			if nodes[i].position.distance_to(vorher[i]) > 0.05:
				bewegt = true
	assert_true(bewegt, "mindestens ein Besucher ist weitergeschlendert")
	await _ort_abbauen(ort)


func test_rehwei_reduced_motion_reduziert_und_statisch() -> void:
	var gs := FakeGameState.new(_basis_state())
	var ort: OrtRehwei = RehweiSzene.instantiate()
	ort.game_state_override = gs
	ort.leben_seed_override = SEED
	ort.leben_reduced_override = 1
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	assert_true(ort.leben.ist_statisch(), "Reduced Motion ⇒ statische Besucher")
	assert_eq(ort.leben.besucher_nodes().size(), 1, "halbe Besucherzahl (min. 1)")
	var vorher: Vector3 = ort.leben.besucher_nodes()[0].position
	ort.leben.advance_zeit(6.0)
	await wait_frames(2)
	assert_eq(ort.leben.besucher_nodes()[0].position, vorher, "niemand läuft herum")
	await _ort_abbauen(ort)


func test_kassen_npc_reagiert_auf_kunde_zahlt() -> void:
	var gs := FakeGameState.new(_basis_state())
	var ort: OrtRehwei = RehweiSzene.instantiate()
	ort.game_state_override = gs
	ort.leben_seed_override = SEED
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	var kasse := ort.kassen_npc
	assert_eq(kasse.piep_zaehler, 0, "noch kein Kunde")
	kasse.kunde_zahlt()
	assert_eq(kasse.piep_zaehler, 1, "Kauf gezählt (Piep gefeuert)")
	assert_eq(kasse.letzte_aktion, "kassiert", "Kassen-Winken lief")
	# Idle-Getippe: nach genug Zeit hat die Figur mindestens einmal getippt.
	kasse._process(KassenNpc.TIPP_ALLE_S + 0.1)
	assert_eq(kasse.letzte_aktion, "tippt", "Kassen-Getippe läuft im Takt")
	await _ort_abbauen(ort)


## ---------------------------------------------------- Zweiter Ort + Texte


func test_baumarkt_ist_auch_lebendig() -> void:
	var gs := FakeGameState.new(_basis_state())
	var ort: OrtBaumarkt = BaumarktSzene.instantiate()
	ort.game_state_override = gs
	ort.leben_seed_override = SEED
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	assert_ne(ort.leben, null, "Baumarkt hat Ambient-Leben")
	assert_eq(ort.leben.besucher_nodes().size(), 3, "3 browsende Kunden")
	assert_ne(ort.kassen_npc, null, "Bodo Balken hat die Kasse")
	await _ort_abbauen(ort)


func test_sprueche_rotieren_ohne_wiederholung() -> void:
	OrtLeben.reset_sprueche_fuer_tests()
	for domain in ["laden", "baumarkt"]:
		var key := "city_leben.sprueche.%s" % domain
		assert_true(I18nService.has_key(key), "Spruch-Domain fehlt: %s" % key)
		var liste := I18nService.items(key)
		assert_true(liste.size() >= 4, "%s hat genug Zeilen" % key)
		var gesehen: Dictionary = {}
		for _i in liste.size():
			var zeile := OrtLeben.naechster_spruch(domain)
			assert_false(zeile.is_empty(), "Spruch nie leer")
			assert_false(gesehen.has(zeile), "keine Wiederholung vor voller Runde")
			gesehen[zeile] = true
		assert_eq(OrtLeben.naechster_spruch(domain), String(liste[0]), "dann von vorn")
	assert_eq(OrtLeben.naechster_spruch("gibt_es_nicht"), "", "unbekannte Domain bleibt still")
	OrtLeben.reset_sprueche_fuer_tests()


## ------------------------------------------------------- IKEA-Schaufenster


func test_ikea_schaufenster_lebt_und_ist_deterministisch() -> void:
	var a := IkeaSchaufenster.new()
	a.seed_override = 7
	a.reduced_override = 0
	a.auto_zeit = false
	tree.root.add_child(a)
	var b := IkeaSchaufenster.new()
	b.seed_override = 7
	b.reduced_override = 0
	b.auto_zeit = false
	tree.root.add_child(b)
	await wait_frames(1)
	assert_eq(a.silhouetten_anzahl(), IkeaSchaufenster.SILHOUETTEN, "Silhouetten geplant")
	for i in a.silhouetten_anzahl():
		assert_almost(
			a.silhouette_frac(i), b.silhouette_frac(i), 1e-6, "gleicher Seed ⇒ gleiche Startpose"
		)
	var vorher := a.silhouette_frac(0)
	a.advance_zeit(4.0)
	assert_ne(a.silhouette_frac(0), vorher, "Silhouetten wandern über Zeit")
	a.queue_free()
	b.queue_free()
	await wait_frames(1)


func test_ikea_schaufenster_reduced_motion_statisch() -> void:
	var still := IkeaSchaufenster.new()
	still.seed_override = 7
	still.reduced_override = 1
	still.auto_zeit = false
	tree.root.add_child(still)
	await wait_frames(1)
	var vorher := still.silhouette_frac(0)
	still.advance_zeit(4.0)
	assert_eq(still.silhouette_frac(0), vorher, "Reduced Motion ⇒ alles bleibt stehen")
	still.queue_free()
	await wait_frames(1)


## ------------------------------------------------- IKEA-Ambiente (SHOPS-1)


func test_ikea_durchsagen_rotieren_ohne_wiederholung() -> void:
	IkeaScreen.reset_durchsagen_fuer_tests()
	var key := "shop.ikea.durchsagen"
	assert_true(I18nService.has_key(key), "Durchsagen-Domain existiert")
	var liste := I18nService.items(key)
	assert_true(liste.size() >= 4, "genug Durchsagen-Zeilen")
	var gesehen: Dictionary = {}
	for _i in liste.size():
		var zeile := IkeaScreen.naechste_durchsage()
		assert_false(zeile.is_empty(), "Durchsage nie leer")
		assert_false(gesehen.has(zeile), "keine Wiederholung vor voller Runde")
		gesehen[zeile] = true
	assert_eq(IkeaScreen.naechste_durchsage(), String(liste[0]), "dann von vorn")
	IkeaScreen.reset_durchsagen_fuer_tests()


func test_ikea_screen_durchsage_erscheint_im_takt() -> void:
	IkeaScreen.reset_durchsagen_fuer_tests()
	var screen := IkeaScreen.new()
	screen.auto_navigate = false
	screen.stumm = true
	screen.auto_zeit = false
	tree.root.add_child(screen)
	await wait_frames(2)
	screen.showcase().set_spin_enabled(false)
	# Ambiente-Verdrahtung (stumm getestet, Muster REHWEI): Ids existieren.
	assert_false(SfxMap.entry(IkeaScreen.GEMURMEL_ID).is_empty(), "Gemurmel-Id existiert")
	assert_false(SfxMap.entry(IkeaScreen.PLING_ID).is_empty(), "Tür-Pling-Id existiert")
	var pill := screen.find_child("Durchsage", true, false) as Control
	var label := screen.find_child("DurchsageText", true, false) as Label
	assert_ne(pill, null, "Durchsage-Pille hängt in der Vitrine")
	assert_false(pill.visible, "vor der ersten Ansage unsichtbar")
	screen.advance_zeit(IkeaScreen.DURCHSAGE_START_S + 0.1)
	assert_true(pill.visible, "erste Durchsage läuft")
	var erste := label.text
	assert_false(erste.is_empty(), "Durchsage hat Text")
	screen.advance_zeit(IkeaScreen.DURCHSAGE_DAUER_S + 0.1)
	assert_false(pill.visible, "Ansage endet nach DURCHSAGE_DAUER_S")
	screen.advance_zeit(IkeaScreen.DURCHSAGE_ALLE_S + 0.1)
	assert_true(pill.visible, "die nächste Ansage folgt im Takt")
	assert_ne(label.text, erste, "Rotation liefert eine NEUE Zeile")
	screen.queue_free()
	await wait_frames(2)
	IkeaScreen.reset_durchsagen_fuer_tests()
