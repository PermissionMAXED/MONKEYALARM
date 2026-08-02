extends TestCase
## LOOP-Polish Arcade-Pregame-Karte — Wächter für die drei Politur-Achsen:
## - ENERGIE-KLARTEXT: Kosten UND aktueller Stand in EINER Zeile („Kostet 8
##   Energie pro Runde · Gooby hat 62“), Blitz-Icon in der Stat-Farbe;
##   müde (§C1-Gate, ≤ 15) färbt DANGER und zeigt den too_sleepy-Hinweis
##   SOFORT (nicht erst nach dem Fehl-Tipp), knapp (< 25) warnt gelb.
## - DAUMENZONE: hat der Safe-Bereich Luft, rückt die Karte nach unten,
##   bis die Unterkante THUMB_RAND über der Safe-Unterkante liegt —
##   Spielen/Zurück wandern in Daumennähe statt in der Bildmitte.
## - REDUCED MOTION: der Gooby-Sticker folgt dem Live-Schalter
##   (UiTheme.reduced_motion_changed), und der persistierte AppSettings-
##   Schalter erreicht das Motion-Gate schon beim Boot (ThemeService-Sync).

const PREGAME_SCENE := "res://scripts/minigames/pregame.tscn"
const THEME_SERVICE := "res://themes/theme_service.gd"

var _saved_root_size := Vector2i.ZERO


func test_energie_zeile_zeigt_kosten_und_stand() -> void:
	var gs := _gs()
	if gs == null:
		fail_test("GameState-Autoload fehlt")
		return
	var vorher := _energy_of(gs)
	_set_energy(gs, 62.0)
	var screen := await _mount_pregame("teaParty")
	var note := screen.find_child("EnergyNote", true, false) as Label
	assert_true(note != null, "EnergyNote existiert")
	if note != null:
		var kosten := I18nService.t("mg.pregame.energy", {"energy": 8})
		var stand := I18nService.t("mg.pregame.energy_have", {"have": 62})
		assert_true(note.text.contains(kosten), "Kosten stehen in der Zeile: %s" % note.text)
		assert_true(note.text.contains(stand), "Energiestand steht daneben: %s" % note.text)
		assert_ne(
			note.get_theme_color("font_color"), AcTokens.DANGER, "voller Gooby ohne Warnfarbe"
		)
	var icon := screen.find_child("EnergyIcon", true, false) as TextureRect
	assert_true(icon != null and icon.texture != null, "Blitz-Icon geladen")
	if icon != null:
		assert_eq(
			icon.self_modulate, AcTokens.STAT_ENERGY, "Icon trägt die Stat-Farbe (HUD-Muster)"
		)
	var hint: Label = screen.get("_hint_label")
	assert_false(hint.visible, "kein Müde-Hinweis bei voller Energie")
	await _unmount(screen)
	_set_energy(gs, vorher)


func test_muede_faerbt_danger_und_zeigt_sperre_sofort() -> void:
	var gs := _gs()
	if gs == null:
		fail_test("GameState-Autoload fehlt")
		return
	var vorher := _energy_of(gs)
	_set_energy(gs, 10.0)
	var screen := await _mount_pregame("teaParty")
	var note := screen.find_child("EnergyNote", true, false) as Label
	assert_true(note != null, "EnergyNote existiert")
	if note != null:
		assert_eq(note.get_theme_color("font_color"), AcTokens.DANGER, "müde = DANGER-Zeile")
	var icon := screen.find_child("EnergyIcon", true, false) as TextureRect
	if icon != null:
		assert_eq(icon.self_modulate, AcTokens.DANGER, "Blitz färbt mit")
	var hint: Label = screen.get("_hint_label")
	assert_true(hint.visible, "too_sleepy steht SOFORT da (nicht erst nach dem Fehl-Tipp)")
	assert_eq(hint.text, I18nService.t("mg.pregame.too_sleepy"), "Hinweis-Text stimmt")
	# Regressions-Wache (xvfb-Befund): der beim AUFBAU sichtbare Hinweis darf
	# die erste Karten-Minhöhe nicht vergiften (Godot-Umbruch-Cache) — sonst
	# kollabiert das Cover und der Fit-Pass schrumpft die ganze Karte.
	var cover: Control = screen.get("_cover")
	assert_true(cover.visible, "Cover bleibt trotz sichtbarem Müde-Hinweis stehen")
	await _unmount(screen)
	# Knapp (< 25, aber nicht müde): warnendes Gelb, KEIN Sperr-Hinweis.
	_set_energy(gs, 20.0)
	var knapp := await _mount_pregame("teaParty")
	var knapp_note := knapp.find_child("EnergyNote", true, false) as Label
	if knapp_note != null:
		assert_eq(
			knapp_note.get_theme_color("font_color"), AcTokens.YELLOW_DARK, "knapp = warnendes Gelb"
		)
	var knapp_hint: Label = knapp.get("_hint_label")
	assert_false(knapp_hint.visible, "knapp sperrt nicht")
	await _unmount(knapp)
	_set_energy(gs, vorher)


func test_karte_rueckt_in_die_daumenzone() -> void:
	# Hochkant-Format mit viel Luft — RM an, damit der Auffeder-Tween das
	# gemessene Karten-Rect nicht mitten in der Animation verkleinert.
	var theme_svc := tree.root.get_node_or_null("/root/UiTheme")
	var rm_vorher: bool = theme_svc.reduced_motion if theme_svc != null else false
	if theme_svc != null:
		theme_svc.reduced_motion = true
	_enter_hochkant()
	var screen := await _mount_pregame("teaParty")
	await wait_frames(2)
	var m := ScreenShell.metrics(tree.root)
	var insets: Dictionary = m["insets"]
	var f: float = m["f"]
	var safe_h := float(m["canvas"].y) - float(insets["top"]) - float(insets["bottom"])
	var card: Control = screen.get("_card")
	var center: Control = screen.get("_center")
	var luft := safe_h - card.get_combined_minimum_size().y
	var rand := MinigamePregame.THUMB_RAND * f
	assert_true(luft > 2.0 * rand, "Testformat hat Daumen-Luft (luft=%.0f)" % luft)
	assert_almost(
		center.offset_top - float(insets["top"]),
		maxf(luft - 2.0 * rand, 0.0),
		1.0,
		"Top-Offset = Luft − 2·THUMB_RAND (geklemmt)"
	)
	var safe_bottom := float(m["canvas"].y) - float(insets["bottom"])
	assert_almost(
		card.get_global_rect().end.y,
		safe_bottom - rand,
		2.0,
		"Karten-Unterkante liegt THUMB_RAND über der Safe-Unterkante"
	)
	await _unmount(screen)
	await _leave_format()
	if theme_svc != null:
		theme_svc.reduced_motion = rm_vorher


func test_sticker_folgt_reduced_motion_live() -> void:
	var theme_svc := tree.root.get_node_or_null("/root/UiTheme")
	if theme_svc == null:
		fail_test("UiTheme-Autoload fehlt")
		return
	var rm_vorher: bool = theme_svc.reduced_motion
	theme_svc.reduced_motion = false
	var screen := await _mount_pregame("teaParty")
	var sticker: Control = screen.get("_gooby")
	assert_true(sticker != null, "Gooby-Sticker existiert")
	if sticker != null:
		assert_true(sticker.is_processing(), "ohne RM animiert der Sticker")
		theme_svc.reduced_motion = true
		await wait_frames(1)
		assert_false(sticker.is_processing(), "RM-Toggle friert den Sticker LIVE ein")
		theme_svc.reduced_motion = false
		await wait_frames(1)
		assert_true(sticker.is_processing(), "RM aus weckt ihn wieder")
	await _unmount(screen)
	theme_svc.reduced_motion = rm_vorher


func test_rm_boot_sync_liest_appsettings() -> void:
	var app := tree.root.get_node_or_null("/root/AppSettings")
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var vorher: bool = app.is_reduced_motion()
	app.set_setting("reduced_motion", true)
	# Frischer ThemeService = App-Neustart-Stellvertreter: _ready muss den
	# persistierten Schalter einlesen (vorher blieb reduced_motion false,
	# bis der Settings-Screen ihn irgendwann live setzte).
	var svc: Node = (load(THEME_SERVICE) as GDScript).new()
	tree.root.add_child(svc)
	await wait_frames(1)
	assert_true(bool(svc.get("reduced_motion")), "Boot-Sync liest AppSettings ein")
	svc.free()
	app.set_setting("reduced_motion", vorher)
	await wait_frames(1)


## ------------------------------------------------------------ Helfer


func _mount_pregame(game_id: String) -> Control:
	var pregame: MinigamePregame = (load(PREGAME_SCENE) as PackedScene).instantiate()
	pregame.auto_navigate = false
	pregame.receive_params({"game_id": game_id})
	tree.root.add_child(pregame)
	await wait_frames(2)
	return pregame


func _unmount(node: Control) -> void:
	node.queue_free()
	await wait_frames(2)


func _gs() -> Node:
	var gs := tree.root.get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("state") and gs.has_method("update"):
		return gs
	return null


func _energy_of(gs: Node) -> float:
	var state: Dictionary = gs.state()
	var gooby: Variant = state.get("gooby")
	if gooby is Dictionary and (gooby as Dictionary).get("stats") is Dictionary:
		return float(((gooby as Dictionary)["stats"] as Dictionary).get("energy", 100.0))
	return 100.0


func _set_energy(gs: Node, value: float) -> void:
	gs.update(
		func(state: Dictionary) -> void:
			var gooby: Variant = state.get("gooby")
			if gooby is Dictionary and (gooby as Dictionary).get("stats") is Dictionary:
				((gooby as Dictionary)["stats"] as Dictionary)["energy"] = value
	)


func _enter_hochkant() -> void:
	if _saved_root_size == Vector2i.ZERO:
		_saved_root_size = tree.root.size
	DisplayServer.window_set_size(Vector2i(1000, 1600))
	tree.root.size = Vector2i(1000, 1600)


func _leave_format() -> void:
	if _saved_root_size != Vector2i.ZERO:
		tree.root.size = _saved_root_size
		DisplayServer.window_set_size(_saved_root_size)
		_saved_root_size = Vector2i.ZERO
	await wait_frames(2)
