extends TestCase
## G7-P56 EIN-SPIEL-GEFÜHL, Brettspiel-Ausbau — Wächter: Schach + Schiffe
## versenken enden im MINIGAME-RAHMEN-Look über EIN gemeinsames
## BoardResultOverlay statt eigener Mini-Panels/Toasts:
## (1) Look-Wache: dieselbe Abdunkelung wie Pause/Results
##     (MinigamePauseModal.DIM_COLOR), AcCardLg-Plate, SquishButtons in
##     EINER Reihe (primäre Aktion zuerst), Gooby-Sticker jubelt nur bei
##     Sieg; Reduced Motion friert ihn ein.
## (2) Backdrop-Tap legt das Overlay beiseite (dismissed) — die
##     Schlussstellung bleibt nachbetrachtbar (Brettspiel-Anpassung).
## (3) Schach: Matt öffnet das Rahmen-Overlay (Solo-Knöpfe Nochmal/Neue
##     Partie/Verlassen); „Neue Partie“ führt zurück zur Auswahl.
## (4) Schiffe versenken: GAME_OVER öffnet das Rahmen-Overlay mit
##     Revanche (primär) + Verlassen; Revanche sperrt nach Gegner-Weggang.
## Intro/Pause bleiben bewusst Szenen-Sache: Brettspiele sind rundenbasiert
## (keine Echtzeit-Pause nötig), die Auswahl-/Setup-Phase IST der Auftakt.

const GameStateScript := preload("res://scripts/state/game_state.gd")

var _dir_seq := 0


class FakeChessServices:
	extends Node

	var chess: ChessSession = null
	var game_state_override: Object = null


class FakeBoardServices:
	extends Node

	var board: BoardSession = null
	var game_state_override: Object = null


## (1) Look-Wache am rohen Overlay: Rahmen-Abdunkelung, Plate, Knopf-Reihe.
func test_overlay_look_und_knopfreihe() -> void:
	var overlay := BoardResultOverlay.new()
	tree.root.add_child(overlay)
	await wait_frames(1)
	(
		overlay
		. show_result(
			{
				"titel": "Gewonnen!",
				"grund": "Testgrund",
				"sieg": true,
				"buttons":
				[
					{"id": "primary", "text": "Nochmal", "primary": true},
					{"id": "exit", "text": "Raus"},
				],
			}
		)
	)
	await wait_frames(1)
	assert_true(overlay.is_open(), "Overlay offen")
	var dim := overlay.get_child(0) as ColorRect
	assert_ne(dim, null, "Abdunkelung vorhanden")
	if dim != null:
		assert_eq(dim.color, MinigamePauseModal.DIM_COLOR, "gleiche Abdunkelung wie Pause/Results")
	var card: PanelContainer = overlay.get("_card")
	assert_eq(String(card.theme_type_variation), "AcCardLg", "Plate = Arcade-Karte")
	var buttons: Dictionary = overlay.get("_buttons")
	var primary: Button = buttons["primary"]
	var exit_btn: Button = buttons["exit"]
	for btn: Button in [primary, exit_btn]:
		assert_true(btn is SquishButton, "Rahmen-Knopf squisht (QW #3)")
	assert_eq(String(primary.theme_type_variation), "PrimaryButton", "primäre Aktion primär")
	assert_eq(String(exit_btn.theme_type_variation), "GhostButton", "Zweit-Aktion ghost")
	assert_eq(primary.get_parent(), exit_btn.get_parent(), "eine Knopf-Reihe")
	assert_true(primary.get_index() < exit_btn.get_index(), "primäre Aktion zuerst")
	var gooby: LoadingVeilSticker = overlay.get("_gooby")
	assert_true(gooby.is_animated(), "Sieg: Gooby jubelt")
	overlay.set_action_enabled("primary", false)
	assert_true(primary.disabled, "set_action_enabled sperrt")
	overlay.show_result({"titel": "Verloren…", "sieg": false, "buttons": []})
	assert_false(gooby.is_animated(), "Niederlage: Gooby still (Trost-Moment)")
	overlay.free()
	await wait_frames(1)


## (1b) Reduced Motion friert den Gooby auch beim Sieg ein.
func test_rm_zweig_friert_gooby_ein() -> void:
	var settings: Node = tree.root.get_node_or_null("/root/AppSettings")
	assert_ne(settings, null, "AppSettings-Autoload vorhanden")
	if settings == null:
		return
	var vorher: Variant = settings.get_setting("reduced_motion", false)
	settings.set_setting("reduced_motion", true)
	var overlay := BoardResultOverlay.new()
	tree.root.add_child(overlay)
	await wait_frames(1)
	overlay.show_result({"titel": "Gewonnen!", "sieg": true, "buttons": []})
	var gooby: LoadingVeilSticker = overlay.get("_gooby")
	assert_false(gooby.is_animated(), "RM: Gooby steht auch bei Sieg")
	overlay.free()
	settings.set_setting("reduced_motion", vorher)
	await wait_frames(1)


## (2) Backdrop-Tap = Brett ansehen: Overlay geht beiseite, dismissed feuert.
func test_backdrop_tap_legt_overlay_beiseite() -> void:
	var overlay := BoardResultOverlay.new()
	tree.root.add_child(overlay)
	await wait_frames(1)
	overlay.show_result({"titel": "X", "sieg": false, "buttons": [{"id": "exit", "text": "Raus"}]})
	await wait_frames(1)
	var weg: Array = []
	overlay.dismissed.connect(func() -> void: weg.append(true))
	var tap := InputEventMouseButton.new()
	tap.pressed = true
	tap.button_index = MOUSE_BUTTON_LEFT
	overlay._on_backdrop_input(tap)
	assert_false(overlay.is_open(), "Backdrop-Tap legt das Overlay beiseite")
	assert_eq(weg.size(), 1, "dismissed gefeuert (Schlussstellung ansehen)")
	overlay.free()
	await wait_frames(1)


## (3) Schach-Matt endet im Rahmen: Overlay + Solo-Knöpfe + Rückweg.
func test_chess_matt_endet_im_rahmen() -> void:
	var ctx := await _open_chess()
	var scene: ChessScene = ctx["scene"]
	scene._ai_strength = 1
	scene._on_solo_start(ChessLogic.WHITE)
	scene._solo_logic.from_fen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
	scene._render()
	scene._on_square_pressed(0x00)
	scene._on_square_pressed(0x70)
	assert_eq(scene._phase, "over", "Matt beendet die Partie")
	var overlay: BoardResultOverlay = scene._result_overlay
	assert_true(overlay.is_open(), "Rahmen-Overlay steht")
	assert_eq((overlay.get("_title") as Label).text, I18nService.t("chess.win"))
	var reason: Label = overlay.get("_reason")
	assert_eq(reason.text, I18nService.t("chess.reason.checkmate"), "Grund-Zeile gefüllt")
	var buttons: Dictionary = overlay.get("_buttons")
	assert_eq(
		buttons.keys(), ["again", "new", "exit"] as Array, "Solo: Nochmal/Neue Partie/Verlassen"
	)
	assert_eq(
		String((buttons["again"] as Button).theme_type_variation),
		"PrimaryButton",
		"Nochmal ist primär"
	)
	assert_eq((buttons["again"] as Button).text, I18nService.t("mg.results.again"))
	# „Neue Partie“ führt zurück zur Auswahl — Overlay geht zu.
	overlay._on_action_pressed("new", false)
	await wait_frames(1)
	assert_false(overlay.is_open(), "Overlay zu nach Neue Partie")
	assert_true(scene._pick_panel.visible, "Auswahl wieder da")
	await _close_chess(ctx)


## (4) Schiffe versenken: GAME_OVER öffnet das Rahmen-Overlay.
func test_battleship_ende_im_rahmen() -> void:
	var services := FakeBoardServices.new()
	tree.root.add_child(services)
	var scene := BattleshipScene.new()
	scene.services_override = services
	tree.root.add_child(scene)
	await wait_frames(2)
	scene._on_game_over("wer", true)
	await wait_frames(1)
	var overlay: BoardResultOverlay = scene._result_overlay
	assert_true(overlay.is_open(), "Rahmen-Overlay steht")
	assert_eq((overlay.get("_title") as Label).text, I18nService.t("board.win"))
	var buttons: Dictionary = overlay.get("_buttons")
	assert_eq(buttons.keys(), ["rematch", "exit"] as Array, "Revanche + Verlassen")
	assert_eq(
		String((buttons["rematch"] as Button).theme_type_variation),
		"PrimaryButton",
		"Revanche ist primär"
	)
	# Gegner weg (Revanche unmöglich) → der Rahmen-Knopf sperrt mit.
	overlay.set_action_enabled("rematch", false)
	assert_true((buttons["rematch"] as Button).disabled, "Revanche gesperrt")
	scene.queue_free()
	services.queue_free()
	await wait_frames(2)


## ── Helfer (Muster test_chess_scene) ─────────────────────────────────────


func _fresh_gs() -> Node:
	_dir_seq += 1
	var dir := "user://g7_rahmen_brett/chess_%d_%d" % [Time.get_ticks_usec(), _dir_seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.initialize(dir + "/save_v5.json")
	return gs


func _open_chess() -> Dictionary:
	var gs := _fresh_gs()
	var services := FakeChessServices.new()
	services.game_state_override = gs
	tree.root.add_child(services)
	var scene := ChessScene.new()
	scene.services_override = services
	tree.root.add_child(scene)
	await wait_frames(1)
	return {"scene": scene, "services": services, "gs": gs}


func _close_chess(ctx: Dictionary) -> void:
	(ctx["scene"] as Node).queue_free()
	(ctx["services"] as Node).queue_free()
	await wait_frames(2)
	(ctx["gs"] as Node).free()
