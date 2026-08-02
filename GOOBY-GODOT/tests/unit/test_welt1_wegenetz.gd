extends TestCase
## WELT-1 — Wegenetz-Ausstattung: Wegweiser-Plan nennt jede angebundene
## Zone mit plausibler Distanz, Rastplätze/Gatter liegen im Land, und die
## Distanz-Funktion misst echte Polyline-Längen (symmetrisch).
## POLISH-Wachen (W19): die Kit-Deko der Rastplätze/Wegweiser-Füße ist
## deterministisch geplant, komplett gebündelt (baue_multimesh je GLB)
## und jede Instanz steht aufrecht mit dem Fuß auf dem Gelände.


func test_distanz_ist_symmetrisch_und_plausibel() -> void:
	var hin := RanchWegenetz.distanz_m("hof", "see")
	var zurueck := RanchWegenetz.distanz_m("see", "hof")
	assert_almost(hin, zurueck, 0.001, "Distanz symmetrisch")
	assert_true(hin > 200.0 and hin < 800.0, "hof→see plausibel (%.0f m)" % hin)
	assert_eq(RanchWegenetz.distanz_m("see", "waeldchen"), 0.0, "kein Direktweg = 0")


func test_wegweiser_plan_deckt_alle_angebundenen_zonen() -> void:
	var plaene := RanchWegenetz.wegweiser_plan()
	var beschildert: Array[String] = []
	for plan: Dictionary in plaene:
		beschildert.append(str(plan["zone"]))
		var arme: Array = plan["arme"]
		assert_true(arme.size() >= 1, "%s hat mindestens einen Arm" % plan["zone"])
		for arm: Dictionary in arme:
			assert_true(float(arm["distanz_m"]) > 0.0, "Arm mit echter Distanz")
			assert_true(str(arm["name_key"]).begins_with("rwelt.zone."), "Arm nennt Zonen-Key")
	for zone_id: String in RanchKarte.zonen_ids():
		if RanchKarte.nachbarn(zone_id).is_empty():
			continue
		assert_true(beschildert.has(zone_id), "%s hat einen Wegweiser" % zone_id)


func test_wegweiser_stehen_im_land_und_nicht_im_wasser() -> void:
	var grenzen := RanchKarte.grenzen()
	for plan: Dictionary in RanchWegenetz.wegweiser_plan():
		var p: Vector2 = plan["pos"]
		assert_true(grenzen.has_point(p), "Wegweiser %s in der Welt" % plan["zone"])
		assert_false(
			RanchGelaende.ist_wasser(p.x, p.y), "Wegweiser %s nicht im Wasser" % plan["zone"]
		)


func test_rastplaetze_und_gatter_liegen_begehbar() -> void:
	for platz: Array in RanchWegenetz.RASTPLAETZE:
		var pos := RanchKarte.punkt(float(platz[0]), float(platz[1]))
		assert_true(RanchKarte.ist_begehbar(pos), "Rastplatz %s begehbar" % str(platz))
	for gatter: Dictionary in RanchWegenetz.GATTER:
		var punkte := RanchKarte.wegpunkte(str(gatter["von"]), str(gatter["nach"]))
		assert_true(punkte.size() >= 2, "Gatter-Weg %s existiert" % str(gatter))


func test_rastplatz_deko_plan_ist_deterministisch_und_komplett() -> void:
	var p := Vector2(130.0, -640.0)
	var plan := RanchWegenetz.rastplatz_deko_plan(p)
	assert_eq(
		str(plan), str(RanchWegenetz.rastplatz_deko_plan(p)), "gleiche Position = gleicher Plan"
	)
	var sorten: Dictionary = {}
	for eintrag: Dictionary in plan:
		sorten[str(eintrag["glb"])] = int(sorten.get(str(eintrag["glb"]), 0)) + 1
		assert_true(float(eintrag["skala"]) > 0.0, "uniforme Skala > 0")
		var abstand: float = (eintrag["pos"] as Vector2).distance_to(p)
		assert_true(abstand <= 5.6, "Requisite bleibt am Platz (%.1f m)" % abstand)
	assert_eq(int(sorten.get(RanchWegenetz.FEUER_GLB, 0)), 1, "genau EINE Feuerstelle")
	assert_eq(int(sorten.get(RanchWegenetz.ZELT_GLB, 0)), 1, "genau EIN Zelt")
	assert_eq(int(sorten.get(RanchWegenetz.STAMM_GLB, 0)), 1, "genau EIN Sitzstamm")
	assert_eq(int(sorten.get(RanchWegenetz.STUMPF_GLB, 0)), 2, "zwei Sitz-Stümpfe")
	assert_true(int(sorten.get(RanchWegenetz.GRAS_GLB, 0)) >= 3, "Gras-Streu vorhanden")
	var andere := RanchWegenetz.rastplatz_deko_plan(Vector2(688.0, 236.0))
	assert_ne(str(plan), str(andere), "andere Position würfelt anders")


func test_wegweiser_fuss_deko_bleibt_eng_am_pfosten() -> void:
	for plan: Dictionary in RanchWegenetz.wegweiser_plan():
		var p: Vector2 = plan["pos"]
		var deko := RanchWegenetz.wegweiser_deko_plan(p)
		assert_true(deko.size() >= 4, "%s: Fuß-Deko vorhanden" % plan["zone"])
		for eintrag: Dictionary in deko:
			var abstand: float = (eintrag["pos"] as Vector2).distance_to(p)
			assert_true(
				abstand >= 0.4 and abstand <= 1.4,
				"%s: Deko im Fuß-Ring (%.2f m)" % [plan["zone"], abstand]
			)


func test_kit_deko_ist_gebuendelt_aufrecht_und_am_boden() -> void:
	var wurzel := Node3D.new()
	RanchBau.transform_log = {}
	RanchBau.log_transforms = true
	RanchWegenetz.baue(wurzel)
	RanchBau.log_transforms = false
	var kit_pfade: Array[String] = [
		RanchWegenetz.FEUER_GLB,
		RanchWegenetz.ZELT_GLB,
		RanchWegenetz.STAMM_GLB,
		RanchWegenetz.STUMPF_GLB,
		RanchWegenetz.STEIN_GLB,
		RanchWegenetz.GRAS_GLB,
	]
	for pfad: String in kit_pfade:
		assert_true(
			RanchBau.transform_log.has(pfad), "%s läuft über baue_multimesh" % pfad.get_file()
		)
		if not RanchBau.transform_log.has(pfad):
			continue
		var calls: Array = RanchBau.transform_log[pfad]
		assert_eq(calls.size(), 1, "%s: EIN gebündelter Call" % pfad.get_file())
		for transforms: Array in calls:
			for t: Transform3D in transforms:
				var up := (t.basis * Vector3.UP).normalized()
				assert_true(up.dot(Vector3.UP) > 0.999, "%s steht aufrecht" % pfad.get_file())
				var boden := RanchGelaende.hoehe(t.origin.x, t.origin.z)
				assert_almost(t.origin.y, boden, 0.01, "%s: Fuß auf dem Gelände" % pfad.get_file())
				assert_false(
					RanchGelaende.ist_wasser(t.origin.x, t.origin.z),
					"%s steht nicht im Wasser" % pfad.get_file()
				)
	var feuer: Array = RanchBau.transform_log.get(RanchWegenetz.FEUER_GLB, [[]])[0]
	assert_eq(feuer.size(), RanchWegenetz.RASTPLAETZE.size(), "eine Feuerstelle je Rastplatz")
	RanchBau.transform_log = {}
	wurzel.free()
