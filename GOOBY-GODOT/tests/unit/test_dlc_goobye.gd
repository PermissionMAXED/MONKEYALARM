extends TestCase
## G5/P24 DLC-GOOBYE-A/B — Integration des „Goo und Bye“: Hub-Status nach dem
## Ranch-Muster (installiert/verfügbar/gesperrt), Kauf-Gate GoobyeKauf
## (atomar, Startlager aus dem Pack), Save-Slice dlc.goobye.* (GoobyeState),
## Angebots-Sheet (GoobyeOffer), Routen-Anmeldung, DE↔EN-String-Parität und
## die Laden-Szene: mountet headless, Story-Beat beim Erstbetreten, Regal-Tap,
## kompletter Markttag bis zur Kassensturz-Karte, Geometrie-Grundcheck.
## Welle B (Großmarkt/Preise): atomare Bestell-Buchung, Bestell-Sheet mit
## ±-Steppern, Preis-Schieber-Sheet (sofort gespeichert, „empfohlen“-Reset)
## und der Beweis, dass der Schieber-Faktor WIRKLICH an der Kasse piept.

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")
const LadenSzene := preload("res://scripts/dlc/goobye/laden_scene.tscn")

var _dir_seq := 0


## GameState-Double NUR fürs Lesen (Hub-Status): dotted get_value/set_value.
class FakeGameState:
	extends RefCounted
	var s: Dictionary = {}

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


class FakeRouter:
	extends RefCounted
	var routen: Dictionary = {}
	var ziele: Array = []

	func register_route(route: StringName, szene: String) -> void:
		routen[route] = szene

	func goto(route: StringName, params: Dictionary = {}) -> void:
		ziele.append({"route": route, "params": params})


func _fake(level: int, gekauft: bool) -> FakeGameState:
	var gs := FakeGameState.new()
	gs.set_value("progression.level", level)
	gs.set_value("dlc.goobye.gekauft", gekauft)
	return gs


func _fresh_gs(level: int, coins: int) -> Node:
	GoobyeState.register_slice()
	_dir_seq += 1
	var dir := "user://goobye_tests/%d_%d" % [Time.get_ticks_usec(), _dir_seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.initialize(dir + "/save_v5.json")
	gs.set_value("progression.level", level)
	gs.set_value("economy.coins", coins)
	return gs


func _teardown_gs(gs: Node) -> void:
	gs.free()
	SaveSchema.unregister_slice(GoobyeState.SLICE_ID)
	GoobyeState.reset_for_tests()
	GoobyeKatalog.registry_override = null
	GoobyeKatalog.reset_cache()


## ------------------------------------------------------------ Hub-Status


func test_hub_status_goobye_nach_ranch_muster() -> void:
	DlcKatalog.reset_cache()
	GoobyeKatalog.reset_cache()
	var dlc := DlcKatalog.eintrag("goo_und_bye")
	assert_false(dlc.is_empty(), "Goo-und-Bye-Eintrag über den Katalog lesbar")
	assert_eq(str(dlc.get("status", "")), "verfuegbar", "redaktionell verfügbar (Pack)")
	assert_eq(
		DlcKatalog.status_fuer(dlc, _fake(20, true)),
		DlcKatalog.STATUS_INSTALLIERT,
		"gekauft → installiert"
	)
	assert_eq(
		DlcKatalog.status_fuer(dlc, _fake(GoobyeKatalog.freischalt_level(), false)),
		DlcKatalog.STATUS_VERFUEGBAR,
		"Level 12, nicht gekauft → verfügbar"
	)
	assert_eq(
		DlcKatalog.status_fuer(dlc, _fake(GoobyeKatalog.freischalt_level() - 1, false)),
		DlcKatalog.STATUS_GESPERRT,
		"Level < 12 → gesperrt"
	)
	var text := DlcKatalog.unlock_text(dlc)
	assert_true(text.contains(str(GoobyeKatalog.freischalt_level())), "Level eingesetzt")
	assert_true(text.contains(str(GoobyeKatalog.preis())), "Preis eingesetzt")
	assert_false(text.contains("{"), "keine offenen Platzhalter")


func test_screen_detail_goobye_knoepfe() -> void:
	DlcKatalog.reset_cache()
	var screen := DlcScreen.new()
	screen.gs_override = _fake(20, false)
	screen.auto_navigate = false
	tree.root.add_child(screen)
	await wait_frames(2)
	# Verfügbar → Angebots-Knopf mit Goobye-eigenem Text.
	var detail := screen.oeffne_detail("goo_und_bye")
	var knopf: Button = detail.get_meta(DlcScreen.META_AKTION, null)
	assert_true(knopf != null and not knopf.disabled, "Angebots-Knopf aktiv")
	assert_eq(knopf.text, I18nService.t("dlc_goobye.knopf.angebot"))
	detail.queue_free()
	screen.queue_free()
	await wait_frames(1)
	# Gekauft → „Laden aufschließen!“ (Spielen-Knopf).
	var screen2 := DlcScreen.new()
	screen2.gs_override = _fake(20, true)
	screen2.auto_navigate = false
	tree.root.add_child(screen2)
	await wait_frames(2)
	var detail2 := screen2.oeffne_detail("goo_und_bye")
	var knopf2: Button = detail2.get_meta(DlcScreen.META_AKTION, null)
	assert_true(knopf2 != null and not knopf2.disabled, "Spielen-Knopf aktiv")
	assert_eq(knopf2.text, I18nService.t("dlc_goobye.knopf.zum_laden"))
	detail2.queue_free()
	screen2.queue_free()
	await wait_frames(1)


## ------------------------------------------------------------ Kauf & State


func test_kauf_gate_und_atomik() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(GoobyeKatalog.freischalt_level() - 1, 99999)
	assert_eq(GoobyeKauf.check(gs), GoobyeKauf.RESULT_LOCKED, "unter Level 12 gesperrt")
	assert_eq(GoobyeKauf.kaufe(gs), GoobyeKauf.RESULT_LOCKED)
	assert_eq(gs.get_value("economy.coins"), 99999, "keine Abbuchung im Gesperrt-Fall")
	assert_eq(gs.get_value("dlc.goobye.gekauft"), false)
	_teardown_gs(gs)
	var arm := _fresh_gs(12, GoobyeKatalog.preis() - 1)
	assert_eq(GoobyeKauf.kaufe(arm), GoobyeKauf.RESULT_BROKE, "zu wenig Münzen blockt")
	assert_eq(arm.get_value("economy.coins"), GoobyeKatalog.preis() - 1, "unangetastet")
	assert_eq(arm.get_value("dlc.goobye.lager"), {}, "kein Startlager eingezogen")
	_teardown_gs(arm)


func test_kauf_bucht_preis_und_zieht_startlager_ein() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, GoobyeKatalog.preis() + 77)
	assert_eq(GoobyeKauf.kaufe(gs), GoobyeKauf.RESULT_OK)
	assert_eq(gs.get_value("economy.coins"), 77, "exakt der Preis wird abgebucht")
	assert_eq(gs.get_value("dlc.goobye.gekauft"), true)
	assert_true(int(gs.get_value("dlc.goobye.gekauftAm", 0)) > 0, "Kaufzeit gemerkt")
	assert_eq(
		gs.get_value("dlc.goobye.lager"),
		GoobyeKatalog.startlager(),
		"Eröffnungspaket (start-Felder) liegt im Lager"
	)
	assert_eq(GoobyeKauf.kaufe(gs), GoobyeKauf.RESULT_OWNED, "Doppelkauf blockiert")
	assert_eq(gs.get_value("economy.coins"), 77, "nur EINMAL abgebucht")
	_teardown_gs(gs)


func test_state_erstbesuch_umsatz_und_fremde_unterschluessel() -> void:
	var gs := _fresh_gs(12, 0)
	assert_true(GoobyeState.erstbesuch_merken(gs), "erster Besuch meldet true")
	assert_false(GoobyeState.erstbesuch_merken(gs), "zweiter Besuch meldet false")
	GoobyeState.umsatz_verbuchen(gs, 68)
	GoobyeState.umsatz_verbuchen(gs, 12)
	assert_eq(gs.get_value("dlc.goobye.umsatz.tage"), 2, "zwei Markttage verbucht")
	assert_eq(gs.get_value("dlc.goobye.umsatz.gestern"), 12, "letzter Tagesumsatz")
	assert_eq(gs.get_value("dlc.goobye.umsatz.gesamt"), 80, "Gesamtumsatz summiert")
	GoobyeState.lager_setzen(gs, {"apple": 3, "kaputt": 0})
	assert_eq(gs.get_value("dlc.goobye.lager"), {"apple": 3}, "0-Mengen heilen raus")
	# Geschwister-DLCs im dlc-Slice bleiben beim Normalisieren VERBATIM.
	var slice := GoobyeState.normalize_slice({"zukunft": {"x": 1}, "goobye": "kaputt"})
	assert_eq(slice["zukunft"], {"x": 1}, "fremder Unterschlüssel unangetastet")
	assert_eq(slice["goobye"]["gekauft"], false, "eigener Unterschlüssel geheilt")
	_teardown_gs(gs)


## ------------------------------------------------------ Großmarkt & Preise


func test_grossmarkt_bestellen_atomar() -> void:
	GoobyeKatalog.reset_cache()
	# Zettel: 10 Äpfel (Staffel, 38) + 2 Möhren (6) = 44 Münzen.
	var korb := {"apple": 10, "carrot": 2}
	var gs := _fresh_gs(12, 43)
	assert_eq(GoobyeGrossmarkt.bestellen(gs, {}), GoobyeGrossmarkt.RESULT_LEER, "leerer Zettel")
	assert_eq(GoobyeGrossmarkt.bestellen(gs, korb), GoobyeGrossmarkt.RESULT_BROKE, "1 zu wenig")
	assert_eq(gs.get_value("economy.coins"), 43, "Pleite-Fall bucht NICHTS ab")
	assert_eq(gs.get_value("dlc.goobye.lager"), {}, "…und lagert NICHTS ein (atomar)")
	gs.set_value("economy.coins", 44)
	assert_eq(GoobyeGrossmarkt.bestellen(gs, korb), GoobyeGrossmarkt.RESULT_OK)
	assert_eq(gs.get_value("economy.coins"), 0, "exakt die Zettel-Summe abgebucht")
	assert_eq(gs.get_value("dlc.goobye.lager"), {"apple": 10, "carrot": 2}, "alles im Lager")
	gs.set_value("economy.coins", 6)
	assert_eq(GoobyeGrossmarkt.bestellen(gs, {"carrot": 2}), GoobyeGrossmarkt.RESULT_OK)
	assert_eq(gs.get_value("dlc.goobye.lager"), {"apple": 10, "carrot": 4}, "stapelt obendrauf")
	_teardown_gs(gs)


func test_state_preise_setzen_und_lesen() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, 0)
	# Klemme auf die Spanne, Richtwert räumt den Eintrag.
	GoobyeState.preis_setzen(gs, "gemuese", 0.42)
	assert_eq(gs.get_value("dlc.goobye.preise"), {"gemuese": 0.7}, "auf −30 % geklemmt")
	GoobyeState.preis_setzen(gs, "gemuese", 1.0)
	assert_eq(gs.get_value("dlc.goobye.preise"), {}, "Richtwert wird nicht gespeichert")
	GoobyeState.preis_setzen(gs, "obst", 1.3)
	GoobyeState.preis_setzen(gs, "suesses", 0.9)
	assert_eq(GoobyeState.preise_von(gs), {"obst": 1.3, "suesses": 0.9}, "Lese-Kopie komplett")
	GoobyeState.preise_zuruecksetzen(gs)
	assert_eq(GoobyeState.preise_von(gs), {}, "„empfohlen“ räumt alle Schieber")
	_teardown_gs(gs)


func test_bestell_sheet_stepper_und_kauf() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, 100)
	var sheet := GoobyeBestellSheet.new()
	sheet.gs = gs
	var zettel_signal := [{}]
	sheet.bestellt.connect(func(zettel: Dictionary) -> void: zettel_signal[0] = zettel)
	tree.root.add_child(sheet)
	await wait_frames(2)
	# ±-Stepper: 3× plus, 1× minus → 2 Möhren auf dem Zettel (EK 3 → 6).
	var plus: Button = sheet.find_child("Plus_carrot", true, false)
	var minus: Button = sheet.find_child("Minus_carrot", true, false)
	for _i in 3:
		plus.pressed.emit()
	minus.pressed.emit()
	await wait_frames(1)
	var menge: Label = sheet.find_child("Menge_carrot", true, false)
	assert_eq(menge.text, "2", "Mengen-Anzeige folgt den Steppern")
	var summe: Label = sheet.find_child("BestellSumme", true, false)
	assert_eq(
		summe.text,
		I18nService.t("dlc_goobye.grossmarkt.summe", {"stueck": 2, "summe": 6}),
		"Summen-Zeile lebt mit"
	)
	# Bestellen bucht atomar, leert den Zettel und feuert das Signal.
	var bestellen: Button = sheet.find_child("Bestellen", true, false)
	bestellen.pressed.emit()
	await wait_frames(1)
	assert_eq(gs.get_value("economy.coins"), 94, "Zettel-Summe abgebucht")
	assert_eq(gs.get_value("dlc.goobye.lager"), {"carrot": 2}, "Lieferung im Lager")
	assert_eq(int(zettel_signal[0].get("stueck", 0)), 2, "Signal trägt den Zettel")
	assert_eq(menge.text, "0", "Zettel nach der Bestellung leer")
	# Pleite-Fall: Hinweis-Zeile statt Buchung, Zettel bleibt stehen.
	gs.set_value("economy.coins", 1)
	plus.pressed.emit()
	bestellen.pressed.emit()
	await wait_frames(1)
	var hinweis: Label = sheet.find_child("BestellHinweis", true, false)
	assert_true(hinweis.visible, "Zu-teuer-Hinweis sichtbar")
	assert_eq(hinweis.text, I18nService.t("dlc_goobye.grossmarkt.zu_teuer"))
	assert_eq(gs.get_value("economy.coins"), 1, "nichts abgebucht")
	assert_eq(menge.text, "1", "Zettel bleibt zum Nachbessern stehen")
	sheet.queue_free()
	await wait_frames(1)
	_teardown_gs(gs)


func test_preis_sheet_schieber_und_empfohlen() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, 0)
	GoobyeState.preis_setzen(gs, "obst", 1.2)
	var sheet := GoobyePreisSheet.new()
	sheet.gs = gs
	var geaendert := [0]
	sheet.geaendert.connect(func() -> void: geaendert[0] += 1)
	tree.root.add_child(sheet)
	await wait_frames(2)
	var obst: HSlider = sheet.find_child("PreisSlider_obst", true, false)
	assert_almost(obst.value, 1.2, 1e-6, "gespeicherter Faktor steht am Schieber")
	# Schieber bewegen speichert SOFORT und schreibt die Zeile um.
	var gemuese: HSlider = sheet.find_child("PreisSlider_gemuese", true, false)
	gemuese.value = 0.7
	await wait_frames(1)
	assert_eq(GoobyeState.preise_von(gs), {"obst": 1.2, "gemuese": 0.7}, "sofort im Save")
	var wert: Label = sheet.find_child("PreisWert_gemuese", true, false)
	assert_eq(
		wert.text,
		I18nService.t(
			"dlc_goobye.preise.prozent",
			{"name": I18nService.t("dlc_goobye.gruppe.gemuese"), "wert": "−30"}
		),
		"Wert-Zeile zeigt −30 %"
	)
	var beispiel: Label = sheet.find_child("PreisBeispiel_gemuese", true, false)
	assert_eq(
		beispiel.text,
		I18nService.t(
			"dlc_goobye.preise.beispiel",
			{"name": I18nService.t("rewards.food.carrot"), "preis": 4, "richtwert": 5}
		),
		"Beispiel rechnet die Möhre vor (5 → 4)"
	)
	# „Empfohlener Preis“ setzt ALLE Schieber und den Save zurück.
	var empfohlen: Button = sheet.find_child("PreisEmpfohlen", true, false)
	empfohlen.pressed.emit()
	await wait_frames(1)
	assert_eq(GoobyeState.preise_von(gs), {}, "alle Gruppen zurück auf Richtwert")
	assert_almost(obst.value, 1.0, 1e-6, "Schieber springen mit")
	assert_eq(
		wert.text,
		I18nService.t(
			"dlc_goobye.preise.richtwert", {"name": I18nService.t("dlc_goobye.gruppe.gemuese")}
		),
		"Wert-Zeile zeigt wieder Richtwert"
	)
	assert_true(geaendert[0] >= 2, "Szene wird über Änderungen informiert")
	sheet.queue_free()
	await wait_frames(1)
	_teardown_gs(gs)


## ------------------------------------------------------------ Angebot & Routen


func test_angebot_sheet_kauf_und_spaeter() -> void:
	GoobyeKatalog.reset_cache()
	GoobyeOffer.auto_navigate = false
	var host := Control.new()
	tree.root.add_child(host)
	# Fail-closed: gekauft oder Level zu niedrig → kein Sheet.
	assert_true(GoobyeOffer.zeige(host, _fake(5, false)) == null, "Level-Gate blockt Sheet")
	assert_true(GoobyeOffer.zeige(host, _fake(20, true)) == null, "gekauft blockt Sheet")
	# Zu wenig Münzen: Kauf-Klick lässt alles stehen + Klartext-Hinweis.
	var arm := _fresh_gs(12, 3)
	var sheet := GoobyeOffer.zeige(host, arm)
	assert_true(sheet != null, "Sheet öffnet ab Level 12")
	await wait_frames(1)
	var kaufen: Button = sheet.get_meta(GoobyeOffer.META_KAUFEN, null)
	var hinweis: Label = sheet.get_meta(GoobyeOffer.META_HINWEIS, null)
	kaufen.pressed.emit()
	await wait_frames(1)
	assert_eq(arm.get_value("economy.coins"), 3, "Münzen unangetastet")
	assert_true(hinweis.text.contains(str(GoobyeKatalog.preis())), "Zu-wenig-Zeile nennt den Preis")
	# „Später“ merkt den Stand.
	var spaeter: Button = sheet.get_meta(GoobyeOffer.META_SPAETER, null)
	spaeter.pressed.emit()
	await wait_frames(1)
	assert_eq(arm.get_value("dlc.goobye.angebotVerschoben"), true, "verschoben gemerkt")
	_teardown_gs(arm)
	# Genug Münzen: Kauf-Klick kauft atomar.
	var reich := _fresh_gs(12, GoobyeKatalog.preis())
	var sheet2 := GoobyeOffer.zeige(host, reich)
	await wait_frames(1)
	var kaufen2: Button = sheet2.get_meta(GoobyeOffer.META_KAUFEN, null)
	kaufen2.pressed.emit()
	await wait_frames(1)
	assert_eq(reich.get_value("dlc.goobye.gekauft"), true, "Sheet-Kauf greift")
	assert_eq(reich.get_value("economy.coins"), 0, "Preis abgebucht")
	_teardown_gs(reich)
	GoobyeOffer.auto_navigate = true
	host.queue_free()
	await wait_frames(1)


func test_routen_anmeldung() -> void:
	var router := FakeRouter.new()
	GoobyeRouten.registriere(router)
	assert_eq(
		str(router.routen.get(GoobyeRouten.ROUTE_LADEN, "")),
		GoobyeRouten.SZENE_LADEN,
		"Laden-Route registriert"
	)
	GoobyeRouten.router_override = router
	assert_true(GoobyeRouten.fahre_zum_laden(tree, {"frisch_gekauft": true}), "Reise startet")
	GoobyeRouten.router_override = null
	assert_eq(router.ziele.size(), 1)
	assert_eq(router.ziele[0]["route"], GoobyeRouten.ROUTE_LADEN)
	assert_eq(router.ziele[0]["params"], {"frisch_gekauft": true})
	assert_true(FileAccess.file_exists(GoobyeRouten.SZENE_LADEN), "Szene-Datei existiert")


## ------------------------------------------------------------ Strings


func test_strings_de_en_paritaet() -> void:
	I18nService.reset_cache()
	var de := I18nService.table("de")
	var en := I18nService.table("en")
	var de_keys: Array = []
	for key: String in de:
		if key.begins_with("dlc_goobye."):
			de_keys.append(key)
			assert_true(en.has(key), "EN-Gegenstück fehlt: %s" % key)
			assert_false(str(de[key]).is_empty(), "DE leer: %s" % key)
			assert_false(str(en.get(key, "")).is_empty(), "EN leer: %s" % key)
	assert_true(de_keys.size() >= 30, "Domain dlc_goobye gefüllt (%d Keys)" % de_keys.size())
	for key: String in en:
		if key.begins_with("dlc_goobye."):
			assert_true(de.has(key), "DE-Gegenstück fehlt: %s" % key)
	# Jeder name_key des Sortiments löst in DE auf (Waren-Anzeige + Kasse).
	GoobyeKatalog.reset_cache()
	for ware: Dictionary in GoobyeKatalog.waren():
		assert_true(
			I18nService.has_key(str(ware.get("name_key", ""))),
			"name_key auflösbar: %s" % ware.get("name_key")
		)
	# Alwins Antipp-Gags + Routine-Zettel (§6.3) lösen vollständig auf.
	for i in GoobyeAlwin.GAG_ANZAHL:
		assert_true(de.has("dlc_goobye.alwin.gag_%d" % (i + 1)), "DE-Gag %d da" % (i + 1))
	for eintrag: Dictionary in GoobyeAlwin.routine():
		assert_true(
			I18nService.has_key(str(eintrag["text_key"])),
			"Routine-Key auflösbar: %s" % eintrag["text_key"]
		)


## ------------------------------------------------------------ Laden-Szene


func test_laden_szene_kompletter_markttag() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, GoobyeKatalog.preis() + 100)
	assert_eq(GoobyeKauf.kaufe(gs), GoobyeKauf.RESULT_OK, "Vorbereitung: Laden gekauft")
	var lager_start := 0
	for menge: Variant in (gs.get_value("dlc.goobye.lager", {}) as Dictionary).values():
		lager_start += int(menge)
	var szene: GoobyeLadenScene = LadenSzene.instantiate()
	szene.game_state_override = gs
	szene.seed_override = 12345
	szene.tempo = 0.05
	szene.auto_navigate = false
	var enthuellt := [false]
	szene.ready_for_reveal.connect(func() -> void: enthuellt[0] = true)
	tree.root.add_child(szene)
	await wait_frames(3)
	assert_true(enthuellt[0], "ready_for_reveal nach dem Aufbau (Router-Contract)")
	# Story-Beat §1.3: Schlüsselübergabe-Karte beim ERSTEN Betreten.
	var intro: Control = szene.find_child("IntroOverlay", true, false)
	assert_true(intro != null, "Erstbesuch zeigt die Übergabe-Karte")
	assert_eq(gs.get_value("dlc.goobye.erstbesuchGesehen"), true, "Besuch gemerkt")
	var weiter: Button = szene.find_child("IntroWeiter", true, false)
	weiter.pressed.emit()
	await wait_frames(2)
	assert_true(szene.find_child("IntroOverlay", true, false) == null, "Karte schließt")
	# Regal-Tap räumt aus dem Lager ein (erste Katalog-Ware: 6 Äpfel).
	assert_eq(szene.phase, GoobyeLadenScene.PHASE_EINRAEUMEN)
	szene.slot_tippen(0)
	szene.slot_tippen(1)
	await wait_frames(1)
	var slot0: Button = szene.find_child("Slot0", true, false)
	assert_eq(slot0.text, "×6", "Slot 0 zeigt die eingeräumten Äpfel")
	# Markttag: öffnen → Kunden kaufen (Zeitraffer) → Kassensturz-Karte.
	szene.laden_oeffnen()
	assert_eq(szene.phase, GoobyeLadenScene.PHASE_OFFEN, "Tür sagt Goo!")
	var fertig := await wait_until(
		func() -> bool: return szene.phase == GoobyeLadenScene.PHASE_ABSCHLUSS, 20000
	)
	assert_true(fertig, "Markttag läuft bis zur Abschluss-Karte durch")
	assert_true(szene.find_child("AbschlussOverlay", true, false) != null, "Kassensturz da")
	var umsatz := szene.umsatz_heute
	assert_true(umsatz > 0, "mindestens ein Kunde hat gekauft (Umsatz %d)" % umsatz)
	var coins_vorher := int(gs.get_value("economy.coins"))
	var feierabend: Button = szene.find_child("Feierabend", true, false)
	feierabend.pressed.emit()
	await wait_frames(2)
	assert_eq(int(gs.get_value("economy.coins")), coins_vorher + umsatz, "Umsatz wird zu Münzen")
	assert_eq(gs.get_value("dlc.goobye.umsatz.tage"), 1, "Markttag verbucht")
	assert_eq(gs.get_value("dlc.goobye.umsatz.gestern"), umsatz)
	assert_eq(szene.phase, GoobyeLadenScene.PHASE_EINRAEUMEN, "nächster Tag beginnt")
	# Verlassen: Regal-Reste wandern verlustfrei zurück ins Lager (§1.4).
	szene.queue_free()
	await wait_frames(2)
	var lager_danach := 0
	for menge: Variant in (gs.get_value("dlc.goobye.lager", {}) as Dictionary).values():
		lager_danach += int(menge)
	# Denselben Tag nachrechnen: Slot 0 = 6 Äpfel, Slot 1 = 8 Möhren
	# (Katalog-Reihenfolge beim Einräumen) — gleicher Seed, gleiche Optionen.
	var verkauft := 0
	var plan := (
		GoobyeMarkttag
		. tag_planen(
			12345,
			[
				{"id": "apple", "bestand": 6, "faktor": 1.0},
				{"id": "carrot", "bestand": 8, "faktor": 1.0},
			],
			{
				"kunden_min": GoobyeLadenScene.KUNDEN_MIN,
				"kunden_max": GoobyeLadenScene.KUNDEN_MAX,
			}
		)
	)
	for anzahl: Variant in (plan["verkauft"] as Dictionary).values():
		verkauft += int(anzahl)
	assert_eq(lager_danach, lager_start - verkauft, "kein Stück geht verloren")
	_teardown_gs(gs)


## Welle B (§4.4): der gespeicherte Gruppen-Schieber muss WIRKLICH an der
## Kasse piepen — gleicher Seed, Referenzrechnung mit Waren-Faktor 0.7.
func test_laden_szene_preisfaktor_wirkt() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, GoobyeKatalog.preis() + 50)
	assert_eq(GoobyeKauf.kaufe(gs), GoobyeKauf.RESULT_OK, "Vorbereitung: Laden gekauft")
	gs.set_value("dlc.goobye.erstbesuchGesehen", true)
	GoobyeState.preis_setzen(gs, "obst", 0.7)
	var szene: GoobyeLadenScene = LadenSzene.instantiate()
	szene.game_state_override = gs
	szene.seed_override = 4242
	szene.tempo = 0.05
	szene.auto_navigate = false
	tree.root.add_child(szene)
	await wait_frames(3)
	# Slot 0 zieht die erste Lager-Ware in Katalog-Reihenfolge: 6 Äpfel.
	szene.slot_tippen(0)
	szene.laden_oeffnen()
	var fertig := await wait_until(
		func() -> bool: return szene.phase == GoobyeLadenScene.PHASE_ABSCHLUSS, 20000
	)
	assert_true(fertig, "Markttag läuft durch")
	var plan := (
		GoobyeMarkttag
		. tag_planen(
			4242,
			[{"id": "apple", "bestand": 6, "faktor": 0.7}],
			{
				"kunden_min": GoobyeLadenScene.KUNDEN_MIN,
				"kunden_max": GoobyeLadenScene.KUNDEN_MAX,
			}
		)
	)
	assert_true(int(plan["umsatz"]) > 0, "Referenz-Tag verkauft etwas")
	assert_eq(szene.umsatz_heute, int(plan["umsatz"]), "Schieber-Preis piept an der Kasse")
	for bon: Dictionary in plan["bons"]:
		for position: Dictionary in bon["positionen"]:
			assert_eq(int(position["preis"]), 4, "Apfel kostet 4 statt 6 (−30 %)")
	szene.queue_free()
	await wait_frames(2)
	_teardown_gs(gs)


func test_laden_szene_alwin_routine_und_antippen() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, GoobyeKatalog.preis())
	GoobyeKauf.kaufe(gs)
	gs.set_value("dlc.goobye.erstbesuchGesehen", true)
	var szene: GoobyeLadenScene = LadenSzene.instantiate()
	szene.game_state_override = gs
	szene.seed_override = 12345
	# Langsame Choreo, damit Alwin mitten im Besuch angetippt werden kann.
	szene.tempo = 3.0
	szene.auto_navigate = false
	tree.root.add_child(szene)
	await wait_frames(3)
	var knopf: Button = szene.find_child("AlwinTippen", true, false)
	var zettel: Label = szene.find_child("AlwinRoutine", true, false)
	assert_true(knopf != null and zettel != null, "Antipp-Knopf + Routine-Zettel existieren")
	assert_false(knopf.visible, "vor Ladenöffnung kein Alwin, kein Knopf")
	szene.slot_tippen(0)
	szene.laden_oeffnen()
	# Kunde 0 ist IMMER Alwin (§6.3) — mit ihm erscheinen Zettel + Knopf.
	var da := await wait_until(func() -> bool: return knopf.visible, 5000)
	assert_true(da, "Antipp-Knopf läuft mit Alwin mit")
	assert_true(zettel.visible, "Tagesroutine sichtbar")
	assert_true(zettel.text.contains(GoobyeAlwin.uhrzeit(60)), "Ankunft um 9:00 auf dem Zettel")
	var m := ScreenShell.metrics(szene.get_viewport())
	var floor_px: float = m["floor_px"]
	assert_true(
		knopf.custom_minimum_size.x >= floor_px and knopf.custom_minimum_size.y >= floor_px,
		"Antipp-Knopf hält den Touch-Floor"
	)
	# Antippen: Gags kommen deterministisch aus der Tages-Rotation.
	var auftritt: Node = szene.find_child("AlwinAuftritt", true, false)
	knopf.pressed.emit()
	assert_eq(str(auftritt.get("letzter_gag")), GoobyeAlwin.gag_key(12345, 0), "Gag 1 der Rotation")
	knopf.pressed.emit()
	assert_eq(
		str(auftritt.get("letzter_gag")), GoobyeAlwin.gag_key(12345, 1), "Gag 2, keine Doppel"
	)
	assert_true(I18nService.has_key(str(auftritt.get("letzter_gag"))), "Gag-Key löst auf")
	szene.queue_free()
	await wait_frames(2)
	_teardown_gs(gs)


func test_laden_szene_geometrie_grundcheck() -> void:
	GoobyeKatalog.reset_cache()
	var gs := _fresh_gs(12, GoobyeKatalog.preis())
	GoobyeKauf.kaufe(gs)
	gs.set_value("dlc.goobye.erstbesuchGesehen", true)
	var szene: GoobyeLadenScene = LadenSzene.instantiate()
	szene.game_state_override = gs
	szene.auto_navigate = false
	tree.root.add_child(szene)
	await wait_frames(3)
	assert_true(szene.find_child("IntroOverlay", true, false) == null, "kein Intro mehr")
	var m := ScreenShell.metrics(szene.get_viewport())
	var floor_px: float = m["floor_px"]
	var canvas: Vector2 = m["canvas"]
	# Touch-Floor 44 pt auf allen Tippzielen (User-Leitidee).
	for i in 5:
		var slot: Button = szene.find_child("Slot%d" % i, true, false)
		assert_true(slot != null, "Slot-Knopf %d existiert" % i)
		assert_true(
			slot.custom_minimum_size.x >= floor_px and slot.custom_minimum_size.y >= floor_px,
			"Slot %d hält den Touch-Floor" % i
		)
		var rect := slot.get_global_rect()
		assert_true(
			rect.position.x >= -1.0 and rect.end.x <= canvas.x + 1.0,
			"Slot %d liegt horizontal im Bild" % i
		)
	# Bedienleiste mittig in der Daumenzone (unteres Drittel).
	var leiste: Control = szene.find_child("LadenKnoepfe", true, false)
	assert_true(leiste != null, "Bottom-Leiste existiert")
	var leiste_rect := leiste.get_global_rect()
	assert_true(leiste_rect.position.y > canvas.y * 0.6, "Leiste in der Daumenzone")
	var mitte := absf(leiste_rect.get_center().x - canvas.x / 2.0)
	assert_true(mitte <= canvas.x * 0.1, "Leiste horizontal mittig")
	var oeffnen: Button = szene.find_child("LadenOeffnen", true, false)
	assert_true(oeffnen.custom_minimum_size.y >= floor_px, "Öffnen-Knopf hält den Floor")
	var verlassen: Button = szene.find_child("Verlassen", true, false)
	assert_true(verlassen.get_global_rect().position.y >= 0.0, "Verlassen unter der Notch")
	szene.queue_free()
	await wait_frames(2)
	_teardown_gs(gs)
