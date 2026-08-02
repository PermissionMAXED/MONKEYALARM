extends TestCase
## BACKLOG-REST — Album-UI headless: Sperr-Darstellung als Fragezeichen-
## Karte (KEIN Motiv-Leak), NEU-Marker-Lebenszyklus (Unlock → Badge →
## Antippen entfernt), Rail-Chip mit Set-Fortschritt und die einmalige
## Set-komplett-Belohnung (+Münzen, persistiert in stickers.setRewards).

const GameStateScript := preload("res://scripts/state/game_state.gd")

const ART_A := "res://content/stickers/assets/ranch_neuer_hof.png"
const ART_B := "res://content/stickers/assets/ranch_herde.png"

var _dir_seq := 0


func test_sperrkarte_leakt_kein_motiv() -> void:
	var ctx := await _open_album()
	var album: AlbumScreen = ctx["album"]
	var card := _card(album, "st_a")
	assert_true(card != null, "Karte st_a existiert")
	assert_true(_find_label(card, "?") != null, "Fragezeichen auf der Sperr-Karte")
	assert_true(_find_label(card, "???") != null, "Namensband zeigt ???")
	assert_true(_find_label(card, "Alpha-Sticker") == null, "Name bleibt geheim")
	assert_false(_shows_pack_art(card), "Sperr-Karte zeigt NIE das Motiv")
	await _close_album(ctx)


func test_neu_marker_und_chip_fortschritt() -> void:
	var ctx := await _open_album()
	var album: AlbumScreen = ctx["album"]
	var gs: Node = ctx["gs"]
	var chip := album._rail_box.get_node("PageChip_testset") as Button
	assert_true(chip.text.contains("0/2"), "Chip startet bei 0/2: " + chip.text)

	_bump(gs, "alpha_zaehler")
	await wait_frames(2)
	var card := _card(album, "st_a")
	assert_true(_shows_pack_art(card), "freigeschaltete Karte zeigt das Motiv")
	assert_true(card.get_node_or_null("NewBadge") != null, "NEU-Badge nach Unlock")
	assert_true(chip.text.contains("1/2"), "Chip zählt hoch: " + chip.text)
	assert_true(chip.text.contains(I18nService.t("album.neu")), "Chip zeigt NEU")

	album._on_sticker_tapped(album._catalog[0])
	await wait_frames(2)
	card = _card(album, "st_a")
	assert_true(card.get_node_or_null("NewBadge") == null, "Antippen entfernt das Badge")
	var chip_after := album._rail_box.get_node("PageChip_testset") as Button
	assert_false(
		chip_after.text.contains(I18nService.t("album.neu")), "Chip-NEU weg: " + chip_after.text
	)
	await _close_album(ctx)


## RARITY-POLISH: das Grid sortiert Rarity aufsteigend (stabil bei gleicher
## Rarity), und Mystery-Slots leaken die Rarity NICHT über den Namensband-
## Rand — erst der Unlock bringt die Rarity-Farbe.
func test_rarity_sortierung_und_leakfreier_rand() -> void:
	# Katalog absichtlich UNsortiert: Gold zuerst, zwei Häufige (Stabilität).
	var ctx := await _open_album(
		[
			_rarity_def("st_gold", "episch", "gold_zaehler"),
			_rarity_def("st_a", "haeufig", "alpha_zaehler"),
			_rarity_def("st_a2", "haeufig", "alpha2_zaehler"),
			_rarity_def("st_b", "selten", "beta_zaehler"),
		]
	)
	var album: AlbumScreen = ctx["album"]
	var namen: Array = []
	for child in album._grid.get_children():
		namen.append(String(child.name))
	assert_eq(
		namen,
		["Sticker_st_a", "Sticker_st_a2", "Sticker_st_b", "Sticker_st_gold"],
		"Grid sortiert Rarity aufsteigend, gleiche Rarity stabil"
	)
	assert_eq(_band_border(album, "st_gold"), AcTokens.WHITE, "Mystery-Rand neutral (episch)")
	assert_eq(_band_border(album, "st_b"), AcTokens.WHITE, "Mystery-Rand neutral (selten)")
	_bump(ctx["gs"], "beta_zaehler")
	await wait_frames(2)
	assert_eq(
		_band_border(album, "st_b"),
		AlbumScreen.RARITY_BORDER["selten"],
		"Unlock bringt den Silber-Rand"
	)
	await _close_album(ctx)


func test_set_komplett_belohnung_einmalig() -> void:
	var ctx := await _open_album()
	var album: AlbumScreen = ctx["album"]
	var gs: Node = ctx["gs"]
	var coins_before := int(gs.get_value("economy.coins", 0))
	_bump(gs, "alpha_zaehler")
	_bump(gs, "beta_zaehler")
	await wait_frames(2)
	assert_eq(
		int(gs.get_value("economy.coins", 0)),
		coins_before + AlbumScreen.SET_REWARD_COINS,
		"Set komplett → +%d Münzen" % AlbumScreen.SET_REWARD_COINS
	)
	var rewards: Dictionary = gs.get_value("stickers.setRewards", {})
	assert_true(rewards.has("testset"), "Claim persistiert")
	assert_true(
		album._page_progress.text.contains(I18nService.t("album.set_komplett")),
		"Fortschrittszeile meldet Set komplett: " + album._page_progress.text
	)
	# Erneutes Auswerten (z. B. weiterer Slice-Ping) zahlt NICHT doppelt.
	album._maybe_claim_set_reward("testset")
	assert_eq(
		int(gs.get_value("economy.coins", 0)),
		coins_before + AlbumScreen.SET_REWARD_COINS,
		"keine Doppel-Belohnung"
	)
	await _close_album(ctx)


# ── Aufbau/Helfer ─────────────────────────────────────────────────────────────


func _mini_catalog() -> Array:
	return [
		{
			"id": "st_a",
			"name_de": "Alpha-Sticker",
			"flavor_de": "A.",
			"hint_de": "Zähler A.",
			"set": "testset",
			"page": "testset",
			"rarity": "haeufig",
			"image": ART_A,
			"cond": {"type": "counter", "key": "alpha_zaehler", "count": 1},
		},
		{
			"id": "st_b",
			"name_de": "Beta-Sticker",
			"flavor_de": "B.",
			"hint_de": "Zähler B.",
			"set": "testset",
			"page": "testset",
			"rarity": "selten",
			"image": ART_B,
			"cond": {"type": "counter", "key": "beta_zaehler", "count": 1},
		},
	]


## Sticker-Def für die Rarity-Tests (alle auf der einen Testset-Seite).
func _rarity_def(id: String, rarity: String, counter_key: String) -> Dictionary:
	return {
		"id": id,
		"name_de": id,
		"flavor_de": "x",
		"hint_de": "x",
		"set": "testset",
		"page": "testset",
		"rarity": rarity,
		"image": ART_A,
		"cond": {"type": "counter", "key": counter_key, "count": 1},
	}


## Rand-Farbe des Namensbands einer Karte (RARITY-POLISH-Wache).
func _band_border(album: AlbumScreen, id: String) -> Color:
	var band := _card(album, id).find_child("NameBand", true, false) as PanelContainer
	var style := band.get_theme_stylebox("panel") as StyleBoxFlat
	return style.border_color


func _open_album(catalog: Array = []) -> Dictionary:
	_dir_seq += 1
	var dir := "user://backlogrest_tests/album_%d_%d" % [Time.get_ticks_usec(), _dir_seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.initialize(dir + "/save_v5.json")
	tree.root.add_child(gs)
	var album := AlbumScreen.new()
	album.auto_navigate = false
	album.gs_override = gs
	album.catalog_override = catalog if not catalog.is_empty() else _mini_catalog()
	album.pages_override = [
		{"id": "testset", "title_de": "Testset", "icon": "star", "tint": "#CDE6BE", "order": 0}
	]
	tree.root.add_child(album)
	await wait_frames(2)
	return {"album": album, "gs": gs}


func _close_album(ctx: Dictionary) -> void:
	(ctx["album"] as Node).queue_free()
	(ctx["gs"] as Node).queue_free()
	await wait_frames(2)


func _bump(gs: Node, key: String) -> void:
	gs.update(
		func(state: Dictionary) -> void:
			var counters: Dictionary = state["achievements"]["counters"]
			counters[key] = int(counters.get(key, 0)) + 1
	)
	gs.notify_slice_changed("achievements")


func _card(album: AlbumScreen, id: String) -> Control:
	return album._grid.get_node_or_null("Sticker_%s" % id) as Control


## Zeigt die Karte irgendein Content-Pack-Motiv (echtes Sticker-PNG)?
func _shows_pack_art(node: Node) -> bool:
	if node is TextureRect:
		var texture := (node as TextureRect).texture
		if texture != null and str(texture.resource_path).contains("content/stickers"):
			return true
	for child in node.get_children():
		if _shows_pack_art(child):
			return true
	return false


func _find_label(node: Node, text: String) -> Label:
	if node is Label and (node as Label).text == text:
		return node
	for child in node.get_children():
		var found := _find_label(child, text)
		if found != null:
			return found
	return null
