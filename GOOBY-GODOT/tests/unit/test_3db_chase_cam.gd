extends TestCase
## Verfolgerkamera-Boom-Clip (PT-minigames-a F2) — pure Statik gegen die
## minX/maxX/minZ/maxZ-Kollider der Fahrspiele (deliveryRush/cityDrive-Rig).

const ChaseCam := preload("res://scripts/minigames/games/_3db_stage/chase_cam.gd")
const DeliveryLogic := preload("res://scripts/minigames/games/delivery_rush/delivery_rush_logic.gd")
const DELIVERY_SCENE := "res://scripts/minigames/games/delivery_rush/delivery_rush.tscn"

## Ein Häuserblock rechts vom Ursprung (x 4..10, z −3..3).
const BOX := {"minX": 4.0, "maxX": 10.0, "minZ": -3.0, "maxZ": 3.0}


func test_free_boom_stays_untouched() -> void:
	var wanted := Vector3(0.0, 5.4, 11.5)
	var got: Vector3 = ChaseCam.clip_xz(Vector3.ZERO, wanted, [BOX])
	assert_eq(got, wanted, "Boom ohne Wandkontakt bleibt unberührt")
	assert_eq(ChaseCam.clip_xz(Vector3.ZERO, wanted, []), wanted, "keine Kollider")


func test_boom_clips_before_wall() -> void:
	# Wunsch-Kamera MITTEN im Block: Clip auf Wand (x = 4) minus Abstand.
	var got: Vector3 = ChaseCam.clip_xz(Vector3.ZERO, Vector3(8.0, 5.4, 0.0), [BOX])
	assert_almost(got.x, 4.0 - ChaseCam.MARGIN_M, 1e-4, "kurz vor der Eintrittswand")
	assert_almost(got.y, 5.4, 1e-6, "die Kamerahöhe bleibt")
	assert_almost(got.z, 0.0)


func test_boom_through_box_clips_at_entry() -> void:
	# Wunsch-Kamera JENSEITS des Blocks: geclippt wird an der EINTRITTS-Wand.
	var got: Vector3 = ChaseCam.clip_xz(Vector3.ZERO, Vector3(20.0, 5.4, 0.0), [BOX])
	assert_almost(got.x, 4.0 - ChaseCam.MARGIN_M, 1e-4, "Eintritt zählt, nicht der Austritt")


func test_wall_hug_clamps_at_anchor() -> void:
	# Wagen klebt an der Wand (Restweg < MARGIN_M): Kamera höchstens bis zum
	# Wagen zurück, nie hinter die Wand geschoben.
	var got: Vector3 = ChaseCam.clip_xz(Vector3(3.9, 0.0, 0.0), Vector3(6.0, 5.4, 0.0), [BOX])
	assert_almost(got.x, 3.9, 1e-4, "clamp am Anker")
	assert_almost(got.y, 5.4)


func test_parallel_boom_misses_box() -> void:
	var got: Vector3 = ChaseCam.clip_xz(Vector3(0.0, 0.0, -5.0), Vector3(20.0, 5.4, -5.0), [BOX])
	assert_almost(got.x, 20.0, 1e-6, "parallel außerhalb des Slabs: kein Treffer")


func test_box_behind_anchor_is_ignored() -> void:
	var got: Vector3 = ChaseCam.clip_xz(Vector3(12.0, 0.0, 0.0), Vector3(20.0, 5.4, 0.0), [BOX])
	assert_almost(got.x, 20.0, 1e-6, "Box hinter dem Anker clippt nicht")


func test_z_axis_wall_clips_too() -> void:
	var box := {"minX": -3.0, "maxX": 3.0, "minZ": 4.0, "maxZ": 10.0}
	var got: Vector3 = ChaseCam.clip_xz(Vector3.ZERO, Vector3(0.0, 7.6, 8.0), [box])
	assert_almost(got.z, 4.0 - ChaseCam.MARGIN_M, 1e-4, "der Slab-Test kennt beide Achsen")


func test_zero_length_boom_keeps_pose() -> void:
	var wanted := Vector3(1.0, 7.6, 2.0)
	assert_eq(ChaseCam.clip_xz(Vector3(1.0, 0.0, 2.0), wanted, [BOX]), wanted)


func test_real_layout_wall_moment_stays_outside() -> void:
	# Der F2-Moment mit den ECHTEN deliveryRush-Kollidern: Wagen dicht an
	# einer Blockwand, Wunsch-Kamera diagonal in den Block — die geclippte
	# Pose liegt in KEINEM Kollider mehr.
	var colliders := DeliveryLogic.layout_colliders()
	assert_true(colliders.size() > 0, "Layout liefert Häuserblocks")
	var box: Dictionary = colliders[0]
	var anchor := Vector3(
		float(box["minX"]) - 0.4, 0.0, (float(box["minZ"]) + float(box["maxZ"])) * 0.5
	)
	var wanted := Vector3(float(box["maxX"]) - 1.0, 7.6, float(box["maxZ"]) - 1.0)
	var got: Vector3 = ChaseCam.clip_xz(anchor, wanted, colliders)
	assert_false(_inside_any(got, colliders), "geclippte Kamera steht frei: %s" % got)
	assert_almost(got.y, 7.6, 1e-6, "Höhe unangetastet")


func test_delivery_rig_kamera_steht_nie_in_der_wand() -> void:
	# Verdrahtungs-Probe am ECHTEN Spiel (Muster test_g5_express1._mount):
	# Wagen dicht an der Westwand eines Blocks, Heck (= Kamera-Boom) zeigt in
	# das Gebäude — exakt der F2-Moment (PLAYTEST2/mg_deliveryRush/022).
	var ctx := MinigameCtx.new()
	ctx.game_id = "deliveryRush"
	ctx.difficulty = "normal"
	ctx.run_seed = 4242
	var game: MinigameBase = (load(DELIVERY_SCENE) as PackedScene).instantiate()
	tree.root.add_child(game)
	game.setup(ctx)
	game.start()
	game.set("_intro_left", 0.0)
	var colliders: Array = game.get("_colliders")
	var box: Dictionary = colliders[0]
	var wall_x := float(box["minX"])
	var mid_z := (float(box["minZ"]) + float(box["maxZ"])) * 0.5
	game.set("van_pos", Vector2(wall_x - 1.0, mid_z))
	# fwd = (−1, 0): der Wagen schaut vom Block weg, der Boom ragt hinein.
	game.set("van_heading", -PI * 0.5)
	game.set("van_speed", 0.0)
	# Ohne Clip stünde die Wunsch-Kamera IM Gebäude (Szenario ist echt):
	# CAM_BACK 11,5 (+1,5 hochkant) liegt vor der Ostwand (Blockbreite 13,6).
	var raw := Vector3(wall_x - 1.0 + 11.5, 5.4, mid_z)
	assert_true(_inside_any(raw, colliders), "Roh-Boom läge in der Wand: %s" % raw)
	var cam: Camera3D = (game.get("_stage") as Node3D).get("camera")
	for i in 30:
		game.call("_sync_world", 0.1)
		assert_false(_inside_any(cam.position, colliders), "Frame %d: Kamera in der Wand" % i)
	game.free()


func _inside_any(p: Vector3, colliders: Array) -> bool:
	for b: Dictionary in colliders:
		if (
			p.x > float(b["minX"])
			and p.x < float(b["maxX"])
			and p.z > float(b["minZ"])
			and p.z < float(b["maxZ"])
		):
			return true
	return false
