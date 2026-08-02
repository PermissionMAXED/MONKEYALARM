extends TestCase
## REST-1 Rang 3: Erfolgs-Katalog (44 aus der Web-Vorlage 1:1), Engine-
## Bedingungen (counter + special) und der AchievementsService am ECHTEN
## GameState — Freischaltung einmalig, Belohnung einmalig, DE/EN-Strings
## für jeden Erfolg vorhanden.

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

const NOW_MS := 1_750_000_000_000
## Web data/achievements.js: 44 Erfolge, Münzsumme exakt 3410.
const WEB_COUNT := 44
const WEB_COINS_TOTAL := 3410

var _seq := 0


func _fresh_state() -> Dictionary:
	return SaveSchema.default_state(NOW_MS)


func _fresh_gs() -> Node:
	_seq += 1
	var dir := "user://rest1_tests/ach_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(dir + "/save_v5.json")
	return gs


func test_katalog_hat_44_valide_erfolge() -> void:
	var catalog := AchievementsCatalog.all()
	assert_eq(catalog.size(), WEB_COUNT, "44 Erfolge wie im Web")
	assert_eq(AchievementsCatalog.total_coins(catalog), WEB_COINS_TOTAL, "Münzsumme 3410")
	var errors := AchievementsCatalog.validate(catalog)
	assert_true(errors.is_empty(), "Katalog valide: %s" % str(errors))
	var per_cat := 0
	for cat in AchievementsCatalog.CATEGORIES:
		per_cat += AchievementsCatalog.by_category(catalog, cat).size()
	assert_eq(per_cat, WEB_COUNT, "jede Kategorie-Sicht deckt den Katalog ab")
	assert_eq(
		str(AchievementsCatalog.by_id(catalog, "firstFeed").get("cat", "")),
		"pflege",
		"by_id findet firstFeed"
	)


func test_strings_de_en_fuer_jeden_erfolg() -> void:
	var catalog := AchievementsCatalog.all()
	for locale in ["de", "en"]:
		var parsed: Variant = JSON.parse_string(
			FileAccess.get_file_as_string("res://strings/%s/achievements.json" % locale)
		)
		assert_true(parsed is Dictionary, "%s/achievements.json parst" % locale)
		var defs: Variant = (parsed as Dictionary).get("achievements", {}).get("defs", {})
		assert_true(defs is Dictionary, "%s: defs-Block da" % locale)
		for def: Dictionary in catalog:
			var id := str(def["id"])
			var entry: Variant = (defs as Dictionary).get(id)
			assert_true(entry is Dictionary, "%s: Eintrag für %s" % [locale, id])
			if entry is Dictionary:
				assert_false(str(entry.get("name", "")).is_empty(), "%s: %s.name" % [locale, id])
				assert_false(str(entry.get("desc", "")).is_empty(), "%s: %s.desc" % [locale, id])


func test_engine_counter_bedingungen() -> void:
	var catalog := AchievementsCatalog.all()
	var state := _fresh_state()
	var first_feed := AchievementsCatalog.by_id(catalog, "firstFeed")
	var feed100 := AchievementsCatalog.by_id(catalog, "feed100")
	assert_eq(AchievementsEngine.progress_of(first_feed, state)["current"], 0, "frisch: 0/1")
	assert_false(AchievementsEngine.is_satisfied(first_feed, state), "frisch nicht erfüllt")
	state["achievements"]["counters"]["feeds"] = 1
	assert_true(AchievementsEngine.is_satisfied(first_feed, state), "1 Fütterung reicht")
	assert_eq(AchievementsEngine.progress_of(feed100, state)["current"], 1, "feed100: 1/100")
	assert_false(AchievementsEngine.is_satisfied(feed100, state), "feed100 offen")
	state["achievements"]["counters"]["feeds"] = 250
	var p := AchievementsEngine.progress_of(feed100, state)
	assert_eq(p["current"], 100, "current klemmt auf target")
	assert_true(AchievementsEngine.is_satisfied(feed100, state), "feed100 erfüllt")


func test_engine_special_bedingungen() -> void:
	var catalog := AchievementsCatalog.all()
	var state := _fresh_state()
	var setze_reiseziele := func() -> void:
		for i in 9:
			state["vacation"]["visited"]["ziel%d" % i] = NOW_MS
	var cases: Array = [
		["coins1000", func() -> void: state["economy"]["coins"] = 1000],
		["level10", func() -> void: state["progression"]["level"] = 10],
		["streak7", func() -> void: state["daily"]["streak"] = 7],
		["chonkZone", func() -> void: state["gooby"]["weight"] = 86.0],
		["sleekMode", func() -> void: state["gooby"]["weight"] = 25.0],
		["parkDay", func() -> void: state["park"]["visits"] = 1],
		["coasterFan", func() -> void: state["park"]["rides"]["coaster"] = 5],
		["wheelRide", func() -> void: state["park"]["rides"]["wheel"] = 1],
		["funkelnacht", func() -> void: state["park"]["nightVisit"] = true],
		["weltenbummler", setze_reiseziele],
	]
	for case: Array in cases:
		var id := str(case[0])
		var def := AchievementsCatalog.by_id(catalog, id)
		assert_false(AchievementsEngine.is_satisfied(def, state), "%s: frisch offen" % id)
		(case[1] as Callable).call()
		assert_true(AchievementsEngine.is_satisfied(def, state), "%s: erfüllt" % id)
	# fullOutfit: Hut + Brille + Halsschmuck gleichzeitig.
	var outfit := AchievementsCatalog.by_id(catalog, "fullOutfit")
	assert_eq(AchievementsEngine.progress_of(outfit, state)["current"], 0, "Outfit: 0/3")
	state["cosmetics"]["outfits"]["equipped"] = {
		"hat": "tophat", "glasses": "round", "neck": "scarf", "back": null
	}
	assert_true(AchievementsEngine.is_satisfied(outfit, state), "volles Outfit erfüllt")
	# neverSick: Level 10 UND nie krank (sickEver-Latch bricht es).
	var never := AchievementsCatalog.by_id(catalog, "neverSick")
	assert_true(AchievementsEngine.is_satisfied(never, state), "Level 10, nie krank")
	state["achievements"]["counters"]["sickEver"] = 1
	assert_false(AchievementsEngine.is_satisfied(never, state), "einmal krank → verwirkt")


func test_engine_sticker_und_sammlung() -> void:
	var catalog := AchievementsCatalog.all()
	var state := _fresh_state()
	var first := AchievementsCatalog.by_id(catalog, "firstSticker")
	assert_false(AchievementsEngine.is_satisfied(first, state), "frisch: kein Sticker")
	state["stickers"]["unlocked"]["st1"] = NOW_MS
	assert_true(AchievementsEngine.is_satisfied(first, state), "1 Buch-Sticker reicht")
	var book10 := AchievementsCatalog.by_id(catalog, "stickerBook10")
	for i in 10:
		state["stickers"]["unlocked"]["st%d" % i] = NOW_MS
	assert_true(AchievementsEngine.is_satisfied(book10, state), "10 Sticker im Buch")
	var set_complete := AchievementsCatalog.by_id(catalog, "setComplete")
	assert_false(AchievementsEngine.is_satisfied(set_complete, state), "kein Set claimt")
	state["stickers"]["setRewards"] = {"tiere": NOW_MS}
	assert_true(AchievementsEngine.is_satisfied(set_complete, state), "Godot-Set-Belohnung zählt")


func test_service_schaltet_einmalig_frei_und_zahlt_einmal() -> void:
	var gs := _fresh_gs()
	tree.root.add_child(gs)
	var service := AchievementsService.new()
	tree.root.add_child(service)
	var unlocked_events: Array = []
	service.achievement_unlocked.connect(func(def: Dictionary) -> void: unlocked_events.append(def))
	service.attach(gs)
	await wait_frames(1)
	assert_true(unlocked_events.is_empty(), "frischer Save schaltet nichts frei")
	var coins_before := int(gs.get_value("economy.coins", 0))
	gs.update(func(state: Dictionary) -> void: state["achievements"]["counters"]["feeds"] = 1)
	RewardHub.note_action(gs)
	await wait_frames(1)
	assert_eq(unlocked_events.size(), 1, "genau eine Freischaltung")
	assert_eq(str(unlocked_events[0].get("id", "")), "firstFeed", "firstFeed feuert")
	assert_true(
		(
			gs.get_value("achievements.unlocked.firstFeed", 0) is int
			and int(gs.get_value("achievements.unlocked.firstFeed", 0)) > 0
		),
		"unlocked-Stempel gesetzt"
	)
	var coins_after := int(gs.get_value("economy.coins", 0))
	assert_eq(coins_after, coins_before + 10, "Belohnung +10 Münzen")
	# Zweite Auswertung: KEINE Doppel-Belohnung, kein zweites Event.
	RewardHub.note_action(gs)
	await wait_frames(1)
	assert_eq(unlocked_events.size(), 1, "keine Doppel-Feier")
	assert_eq(int(gs.get_value("economy.coins", 0)), coins_after, "keine Doppel-Belohnung")
	service.free()
	tree.root.remove_child(gs)
	gs.free()


## LOOP-ERFOLGE Politur: die Hub-Feier animiert die ZEILE in place (Name
## lüftet sich, Balken GLEITET auf voll, Badge erscheint) statt die Liste
## neu zu bauen — die Karte bleibt dieselbe Instanz (Scrollposition steht).
func test_screen_feier_gleitet_in_der_zeile_statt_neu_zu_bauen() -> void:
	var gs := _fresh_gs()
	tree.root.add_child(gs)
	var theme_svc := tree.root.get_node_or_null("/root/UiTheme")
	var rm_vorher := false
	if theme_svc != null:
		rm_vorher = bool(theme_svc.reduced_motion)
		theme_svc.reduced_motion = false
	var screen := AchievementsScreen.new()
	screen.auto_navigate = false
	screen.gs_override = gs
	tree.root.add_child(screen)
	await wait_frames(2)
	var karte := screen.find_child("Erfolg_feed100", true, false)
	assert_true(karte != null, "feed100-Zeile da")
	var name_label := karte.find_child("Name", true, false) as Label
	assert_eq(name_label.text, I18nService.t("achievements.geheim"), "vorher: Mystery-???")
	var bar := karte.find_child("Fortschritt", true, false) as ProgressBar
	# Freischalten wie der Service (Stempel in den Save), dann die Hub-Feier:
	gs.update(
		func(state: Dictionary) -> void:
			state["achievements"]["counters"]["feeds"] = 100
			state["achievements"]["unlocked"]["feed100"] = NOW_MS
	)
	screen.celebrate(AchievementsCatalog.by_id(AchievementsCatalog.all(), "feed100"))
	assert_true(
		is_instance_valid(karte) and karte.is_inside_tree(),
		"IN PLACE: dieselbe Karte bleibt im Baum (kein Listen-Neubau)"
	)
	assert_eq(name_label.text, I18nService.t("achievements.defs.feed100.name"), "Name lüftet sich")
	assert_true(bar.value < bar.max_value - 1e-3, "Balken GLEITET (springt nicht sofort)")
	var voll := await wait_until(func() -> bool: return bar.value >= bar.max_value - 1e-3)
	assert_true(voll, "Balken kommt am vollen Ziel an")
	assert_true(karte.find_child("Freigeschaltet", true, false) != null, "Badge poppt auf")
	var text := karte.find_child("FortschrittText", true, false) as Label
	assert_eq(
		text.text,
		I18nService.t("achievements.fortschritt", {"current": 100, "target": 100}),
		"Zieltext wird n/n"
	)
	assert_eq(screen.unlocked_count(), 1, "Zähler zählt die Feier mit")
	# Quellen-Wache (Muster test_g4_flow): Hüpfer + Gleit-Balken + Glitzer.
	var src := FileAccess.get_file_as_string("res://scripts/ui/profil/achievements_screen.gd")
	assert_true(src.contains("UiMotion.bar_to(bar, bar.max_value)"), "Balken gleitet per bar_to")
	assert_true(src.contains("UiMotion.bounce("), "Karte/Kapsel hüpfen (bounce)")
	assert_true(src.contains("UiMotion.sparkle("), "Gold-Glitzer auf der Karte")
	if theme_svc != null:
		theme_svc.reduced_motion = rm_vorher
	tree.root.remove_child(screen)
	screen.free()
	tree.root.remove_child(gs)
	gs.free()


## Balken-Politur: echtes Ziel statt „1/1“ bei freigeschalteten Zeilen,
## Kategorie-Identitätsfarbe als Fill (Tokens-only) und f-skalierte Höhe.
func test_screen_balken_echtes_ziel_und_kategoriefarbe() -> void:
	var gs := _fresh_gs()
	tree.root.add_child(gs)
	gs.update(
		func(state: Dictionary) -> void:
			state["achievements"]["counters"]["feeds"] = 100
			state["achievements"]["unlocked"]["feed100"] = NOW_MS
	)
	var screen := AchievementsScreen.new()
	screen.auto_navigate = false
	screen.gs_override = gs
	tree.root.add_child(screen)
	await wait_frames(2)
	var frei := screen.find_child("Erfolg_feed100", true, false)
	var bar := frei.find_child("Fortschritt", true, false) as ProgressBar
	assert_eq(int(bar.max_value), 100, "freigeschaltet trägt das ECHTE Ziel (nicht 1)")
	assert_eq(int(bar.value), 100, "voll am echten Ziel")
	var text := frei.find_child("FortschrittText", true, false) as Label
	assert_eq(
		text.text,
		I18nService.t("achievements.fortschritt", {"current": 100, "target": 100}),
		"„100/100“ statt „1/1“"
	)
	var fill := bar.get_theme_stylebox("fill") as StyleBoxFlat
	assert_eq(fill.bg_color, AcTokens.PINK, "Pflege-Balken trägt PINK (Kategorie-Farbwelt)")
	assert_true(bar.custom_minimum_size.y >= 10.0, "Balkenhöhe nie unter der Design-Basis")
	screen.show_category("reisen")
	await wait_frames(1)
	var reise_defs := AchievementsCatalog.by_category(AchievementsCatalog.all(), "reisen")
	assert_false(reise_defs.is_empty(), "Katalog hat Reise-Erfolge")
	var reise := screen.find_child(
		"Erfolg_%s" % str((reise_defs[0] as Dictionary)["id"]), true, false
	)
	var reise_bar := reise.find_child("Fortschritt", true, false) as ProgressBar
	var reise_fill := reise_bar.get_theme_stylebox("fill") as StyleBoxFlat
	assert_eq(reise_fill.bg_color, AcTokens.STAT_HYGIENE, "Reise-Balken trägt Himmelblau")
	tree.root.remove_child(screen)
	screen.free()
	tree.root.remove_child(gs)
	gs.free()


## Leere Kategorie (künftige Content-Packs / Overrides) zeigt den
## illustrierten Leerzustand statt nackter Scroll-Fläche.
func test_screen_leerzustand_bei_leerer_kategorie() -> void:
	var gs := _fresh_gs()
	tree.root.add_child(gs)
	var screen := AchievementsScreen.new()
	screen.auto_navigate = false
	screen.gs_override = gs
	screen.catalog_override = [AchievementsCatalog.by_id(AchievementsCatalog.all(), "firstFeed")]
	tree.root.add_child(screen)
	await wait_frames(2)
	screen.show_category("garten")
	await wait_frames(1)
	assert_true(
		screen.find_child("EmptyState", true, false) != null,
		"leere Kategorie → illustrierter Leerzustand"
	)
	assert_true(screen.find_child("Erfolg_*", true, false) == null, "…und keine Erfolgs-Zeilen")
	screen.show_category("pflege")
	await wait_frames(1)
	assert_true(
		screen.find_child("Erfolg_firstFeed", true, false) != null,
		"gefüllte Kategorie zeigt wieder Zeilen"
	)
	assert_true(screen.find_child("EmptyState", true, false) == null, "…ohne Leerzustand")
	tree.root.remove_child(screen)
	screen.free()
	tree.root.remove_child(gs)
	gs.free()


func test_service_belohnung_kann_folgeerfolg_ausloesen() -> void:
	var gs := _fresh_gs()
	tree.root.add_child(gs)
	var service := AchievementsService.new()
	tree.root.add_child(service)
	service.attach(gs)
	await wait_frames(1)
	# 990 Münzen — die firstFeed-Belohnung (+10) hebt über die 1000er-Marke.
	gs.update(
		func(state: Dictionary) -> void:
			state["economy"]["coins"] = 990
			state["achievements"]["counters"]["feeds"] = 1
	)
	RewardHub.note_action(gs)
	await wait_frames(1)
	assert_true(
		AchievementsEngine.is_unlocked(gs.state(), "coins1000"),
		"coins1000 folgt aus der firstFeed-Belohnung (Nachfass-Auswertung)"
	)
	service.free()
	tree.root.remove_child(gs)
	gs.free()
