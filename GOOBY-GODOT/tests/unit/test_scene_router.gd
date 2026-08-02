extends TestCase
## Unit-Tests der SceneRouter-Statemaschine (W1a) — mit Fake-Veil und
## Fixture-Szenen, komplett headless.
## Dazu die TRANSITIONS-Bypass-Wache (Quelltext-Scan im FB3-Konformitäts-
## Muster): JEDER Szenenwechsel läuft über SceneRouter.goto()/back() und
## damit über den Veil-Wipe (COVER→SWAP→WAIT_READY→REVEAL) bzw. dessen
## Tür-Varianten — direkte SceneTree-Wechsel-APIs tauschen OHNE Abdeckung
## und an Replace-Queue/History/Preload vorbei (Web-Doppel-Veil-Bug-Klasse).

const ROUTER_SCRIPT := preload("res://scripts/core/scene_router.gd")
const FAKE_VEIL_SCRIPT := preload("res://tests/fixtures/fake_veil.gd")

const ROOM_A := "res://tests/fixtures/room_a.tscn"
const ROOM_B := "res://tests/fixtures/room_b.tscn"
const ROOM_SLOW := "res://tests/fixtures/room_slow.tscn"
const ROOM_NEVER := "res://tests/fixtures/room_never.tscn"

## Wurzel des Bypass-Scans (Produktionscode; Tests/Werkzeuge dürfen in
## Fixtures tricksen, ausgeliefert wird nur scripts/).
const SCRIPTS_ROOT := "res://scripts"
## Verbotene Direkt-Wechsel-APIs (Substring-Match je Quelldatei).
const VERBOTENE_WECHSEL_API: Array[String] = [
	"change_scene_to_file(",
	"change_scene_to_packed(",
	".change_scene(",  # Godot-3-Altlast — defensiv mitverboten.
	"reload_current_scene(",
	".unload_current_scene(",
	".current_scene = ",  # current_scene direkt umbiegen = Swap ohne Wipe.
]
## Dokumentierte Rest-Bypässe: Datei → erlaubte Marker. EINZIGER Eintrag:
## SoftRestart lädt nach Pack-Remount + Registry-Reload die BOOT-Szene neu
## (FROZEN-Sequenz docs/UPDATES.md §5.5) — das ist ein Reboot von main.tscn
## selbst und KEINE Reise (der Router wird darin frisch geboren, seine
## History zuvor geleert); das Boot-Cover übernimmt die Abdeck-Rolle des
## Veils. Neue Einträge brauchen dieselbe Begründung an dieser Stelle.
const ERLAUBTE_BYPAESSE: Dictionary = {
	"res://scripts/updates/soft_restart.gd": ["reload_current_scene("],
}


func test_full_cycle_states_mount_and_signals() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	var veil: Node = ctx["veil"]
	var states: Array = []
	router.state_changed.connect(func(state: int) -> void: states.append(state))
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))

	router.goto(&"room_a")
	var done := await wait_until(func() -> bool: return finished.size() == 1)
	assert_true(done, "travel_finished kam nicht.")
	assert_eq(finished, [&"room_a"] as Array)
	assert_eq(
		states,
		(
			[
				ROUTER_SCRIPT.State.COVER,
				ROUTER_SCRIPT.State.SWAP,
				ROUTER_SCRIPT.State.WAIT_READY,
				ROUTER_SCRIPT.State.REVEAL,
				ROUTER_SCRIPT.State.IDLE,
			]
			as Array
		),
		"State-Reihenfolge falsch."
	)
	assert_eq(veil.cover_calls, 1, "Veil muss genau 1x covern.")
	assert_eq(veil.reveal_calls, 1, "Veil muss genau 1x revealen.")
	assert_true(is_instance_valid(router.get_current_scene()), "Szene fehlt.")
	assert_eq(router.get_current_scene().get_parent(), ctx["mount"], "Szene nicht im Mount.")
	assert_eq(router.get_current_target(), &"room_a")
	assert_false(router.is_busy())
	await _cleanup(ctx)


func test_swap_replaces_old_scene() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))

	router.goto(&"room_a")
	await wait_until(func() -> bool: return finished.size() == 1)
	var first_scene: Node = router.get_current_scene()
	router.goto(&"room_b")
	await wait_until(func() -> bool: return finished.size() == 2)
	assert_false(is_instance_valid(first_scene), "Alte Szene muss freigegeben sein.")
	assert_eq(router.get_current_scene().name, &"RoomB")
	var mount: Node = ctx["mount"]
	assert_eq(mount.get_child_count(), 1, "Genau eine Szene im Mount.")
	await _cleanup(ctx)


func test_waits_for_ready_for_reveal_contract() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	var ready_at_reveal: Array = []
	var check_ready := func(state: int) -> void:
		if state == ROUTER_SCRIPT.State.REVEAL:
			ready_at_reveal.append(router.get_current_scene().ready_emitted)
	router.state_changed.connect(check_ready)
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))

	router.goto(&"room_slow")
	await wait_until(func() -> bool: return finished.size() == 1)
	assert_eq(ready_at_reveal, [true] as Array, "REVEAL kam vor ready_for_reveal.")
	await _cleanup(ctx)


func test_replace_queue_keeps_only_last_request() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))
	var replaced: Array = []
	var on_replaced := func(old_target: StringName, new_target: StringName) -> void:
		replaced.append([old_target, new_target])
	router.travel_replaced.connect(on_replaced)

	router.goto(&"room_a")
	router.goto(&"room_b")
	router.goto(&"room_slow")
	await wait_until(func() -> bool: return finished.size() == 2)
	assert_eq(finished, [&"room_a", &"room_slow"] as Array, "Nur letzte Anfrage darf folgen.")
	assert_eq(replaced, [[&"room_b", &"room_slow"]] as Array, "travel_replaced falsch.")
	await _cleanup(ctx)


func test_hard_timeout_force_reveals() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	router.hard_timeout_ms = 250
	var forced: Array = []
	router.travel_force_revealed.connect(func(target: StringName) -> void: forced.append(target))
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))

	router.goto(&"room_never")
	var done := await wait_until(func() -> bool: return finished.size() == 1, 10_000)
	assert_true(done, "Force-Reveal muss travel_finished liefern (nie Deadlock).")
	assert_eq(forced, [&"room_never"] as Array, "travel_force_revealed fehlt.")
	assert_false(router.is_busy())
	await _cleanup(ctx)


func test_door_travel_api_skeleton_and_params() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	var veil: Node = ctx["veil"]
	var started: Array = []
	var on_started := func(target: StringName, travel_type: int) -> void:
		started.append([target, travel_type])
	router.travel_started.connect(on_started)
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))

	router.goto(&"room_a", {"door_id": "north"}, ROUTER_SCRIPT.TravelType.DOOR_TRAVEL)
	await wait_until(func() -> bool: return finished.size() == 1)
	assert_eq(started, [[&"room_a", ROUTER_SCRIPT.TravelType.DOOR_TRAVEL]] as Array)
	assert_eq(
		router.get_current_scene().received_params,
		{"door_id": "north"},
		"receive_params-Contract verletzt."
	)
	assert_eq(veil.cover_calls, 1, "M1-DOOR_TRAVEL nutzt den Veil-Cut.")
	await _cleanup(ctx)


func test_preload_target_then_goto() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	router.preload_target(&"room_b")
	await wait_frames(3)
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))
	router.goto(&"room_b")
	var done := await wait_until(func() -> bool: return finished.size() == 1)
	assert_true(done, "Reise nach Preload muss ankommen.")
	assert_eq(router.get_current_scene().name, &"RoomB")
	await _cleanup(ctx)


func test_min_shown_ms_is_respected() -> void:
	var ctx := _make_router()
	var router: Node = ctx["router"]
	router.min_shown_ms = 200
	var finished: Array = []
	router.travel_finished.connect(func(target: StringName) -> void: finished.append(target))
	var started_ms := Time.get_ticks_msec()
	router.goto(&"room_a")
	await wait_until(func() -> bool: return finished.size() == 1)
	var elapsed := Time.get_ticks_msec() - started_ms
	assert_true(elapsed >= 200, "min_shown_ms nicht eingehalten (%d ms)." % elapsed)
	await _cleanup(ctx)


## GOOBY TRANSITIONS — Bypass-Wache: kein Produktionsskript ruft die
## SceneTree-Wechsel-APIs direkt; Szenenwechsel NUR über den Router (und
## damit den Wipe). Sanktionierte Ausnahmen stehen begründet in
## ERLAUBTE_BYPAESSE — alles andere ist ein Regressions-FAIL.
func test_keine_szenenwechsel_am_router_vorbei() -> void:
	var dateien := _gd_dateien(SCRIPTS_ROOT)
	assert_true(dateien.size() > 500, "Scan sieht den Skript-Baum (%d Dateien)" % dateien.size())
	for pfad: String in dateien:
		var erlaubt: Array = ERLAUBTE_BYPAESSE.get(pfad, [])
		var quelle := FileAccess.get_file_as_string(pfad)
		assert_true(not quelle.is_empty(), "%s lesbar" % pfad)
		for marker: String in VERBOTENE_WECHSEL_API:
			if marker in erlaubt:
				continue
			assert_false(
				quelle.contains(marker),
				(
					"%s nutzt '%s' — Szenenwechsel NUR über SceneRouter.goto()/" % [pfad, marker]
					+ "back() (Veil-Wipe); Ausnahmen begründet in ERLAUBTE_BYPAESSE."
				)
			)


## Die Allowlist bleibt minimal UND ehrlich: jeder Eintrag existiert und
## braucht seinen Marker noch — veraltete Ausnahmen fliegen raus.
func test_erlaubte_bypaesse_bleiben_dokumentiert_und_minimal() -> void:
	assert_eq(ERLAUBTE_BYPAESSE.size(), 1, "Genau EIN sanktionierter Bypass (SoftRestart).")
	for pfad: String in ERLAUBTE_BYPAESSE:
		var quelle := FileAccess.get_file_as_string(pfad)
		assert_true(not quelle.is_empty(), "Allowlist-Datei existiert: %s" % pfad)
		for marker: String in ERLAUBTE_BYPAESSE[pfad]:
			assert_true(
				quelle.contains(marker),
				"Allowlist-Eintrag veraltet: %s braucht '%s' nicht mehr." % [pfad, marker]
			)


func _gd_dateien(root: String) -> Array[String]:
	var found: Array[String] = []
	var dir := DirAccess.open(root)
	if dir == null:
		return found
	dir.list_dir_begin()
	var eintrag := dir.get_next()
	while eintrag != "":
		var pfad := root + "/" + eintrag
		if dir.current_is_dir():
			if not eintrag.begins_with("."):
				found.append_array(_gd_dateien(pfad))
		elif eintrag.ends_with(".gd"):
			found.append(pfad)
		eintrag = dir.get_next()
	dir.list_dir_end()
	return found


func _make_router() -> Dictionary:
	var router: Node = ROUTER_SCRIPT.new()
	var veil: Node = FAKE_VEIL_SCRIPT.new()
	router.install_veil(veil)
	router.min_shown_ms = 0
	var mount := Node.new()
	tree.root.add_child(mount)
	tree.root.add_child(router)
	router.set_mount_point(mount)
	router.register_route(&"room_a", ROOM_A)
	router.register_route(&"room_b", ROOM_B)
	router.register_route(&"room_slow", ROOM_SLOW)
	router.register_route(&"room_never", ROOM_NEVER)
	return {"router": router, "veil": veil, "mount": mount}


func _cleanup(ctx: Dictionary) -> void:
	(ctx["mount"] as Node).queue_free()
	(ctx["router"] as Node).queue_free()
	(ctx["veil"] as Node).free()
	await wait_frames(1)
