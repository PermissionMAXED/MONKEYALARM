extends SceneTree
## G7-P56 Brettspiel-Ausbau — Sichtungs-Capture des gemeinsamen Partie-Ende-
## Overlays (BoardResultOverlay) für Schach + Schiffe versenken im Leitformat
## (iPhone-17-Hochkant). Braucht einen echten Renderer (Muster
## fb3_pause_screens.gd):
##   G7B_OUT=/tmp/gooby-godot/artifacts/G7B xvfb-run -a godot \
##     --path GOOBY-GODOT --rendering-method gl_compatibility \
##     --rendering-driver opengl3 --script res://tests/tools/g7_brett_screens.gd

const OUT_DEFAULT := "/tmp/gooby-godot/artifacts/G7B"
const WINDOW := Vector2i(1179, 2556)

var _out := OUT_DEFAULT


class FakeChessServices:
	extends Node

	var chess: ChessSession = null
	var game_state_override: Object = null


class FakeBoardServices:
	extends Node

	var board: BoardSession = null
	var game_state_override: Object = null


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var env := OS.get_environment("G7B_OUT")
	if env != "":
		_out = env
	DirAccess.make_dir_recursive_absolute(_out)
	DisplayServer.window_set_size(WINDOW)
	root.size = WINDOW
	await process_frame
	await _capture_chess()
	await _capture_battleship()
	quit(0)


## Schach: Solo-Matt in einem Zug → Rahmen-Overlay (Sieg), dann Backdrop-Tap
## (Schlussstellung nachbetrachten, Overlay beiseite).
func _capture_chess() -> void:
	var services := FakeChessServices.new()
	root.add_child(services)
	var scene := ChessScene.new()
	scene.services_override = services
	root.add_child(scene)
	await _frames(6)
	scene._ai_strength = 1
	scene._on_solo_start(ChessLogic.WHITE)
	scene._solo_logic.from_fen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
	scene._render()
	scene._on_square_pressed(0x00)
	scene._on_square_pressed(0x70)
	await _frames(20)
	await _snap("chess_1_matt_overlay")
	var tap := InputEventMouseButton.new()
	tap.pressed = true
	tap.button_index = MOUSE_BUTTON_LEFT
	scene._result_overlay._on_backdrop_input(tap)
	await _frames(10)
	await _snap("chess_2_backdrop_brett_ansehen")
	scene.queue_free()
	services.queue_free()
	await _frames(4)


## Schiffe versenken: GAME_OVER (Sieg) → Rahmen-Overlay mit Revanche primär.
func _capture_battleship() -> void:
	var services := FakeBoardServices.new()
	root.add_child(services)
	var scene := BattleshipScene.new()
	scene.services_override = services
	root.add_child(scene)
	await _frames(6)
	scene._on_game_over("wer", true)
	await _frames(20)
	await _snap("battleship_1_sieg_overlay")
	scene.queue_free()
	services.queue_free()
	await _frames(4)


func _snap(name: String) -> void:
	await process_frame
	var img := root.get_texture().get_image()
	img.save_png("%s/%s.png" % [_out, name])
	print("[g7b] %s.png" % name)


func _frames(n: int) -> void:
	for _i in n:
		await process_frame
