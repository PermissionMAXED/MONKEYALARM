extends TestCase
## EF-1 (EVAL-1 D2) — Sticker feiern GLOBAL: der RewardHub wertet die
## Freischaltbedingungen nach jeder Handlung aus (note_action → achievements-
## Signal) und feiert neue Sticker sofort — OHNE offenes Album, mit Toast
## auf der eigenen obersten Layer. Kein Doppel-Unlock, keine Doppel-Feier.

const GameStateScript := preload("res://scripts/state/game_state.gd")

const NOW_MS := 1768478400000

var _seq := 0


func _fresh_gs() -> Node:
	_seq += 1
	var dir := "user://ef1_tests/hub_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(dir + "/save_v5.json")
	return gs


func test_hub_feiert_fuetterung_ohne_album() -> void:
	var gs := _fresh_gs()
	var host := Node.new()
	tree.root.add_child(host)
	var hub := RewardHub.attach_to(host, gs)
	assert_eq(RewardHub.attach_to(host, gs), hub, "attach_to ist idempotent")
	await wait_frames(1)
	var celebrated: Array = []
	hub.sticker_celebrated.connect(
		func(def: Dictionary) -> void: celebrated.append(str(def.get("id", "")))
	)
	# Handlung irgendwo im Spiel: erste Fütterung → feeds=1 → firstNom
	# (echter Katalog) — kein Album offen, nur der Hub.
	gs.update(
		func(state: Dictionary) -> void:
			var counters: Dictionary = state["achievements"]["counters"]
			counters["feeds"] = int(counters.get("feeds", 0)) + 1
	)
	RewardHub.note_action(gs)
	assert_true(
		gs.get_value("stickers.unlocked", {}).has("firstNom"),
		"Unlock persistiert sofort (Auswertung lief ohne Album)"
	)
	# Die Feier selbst kann in der Queue hinter dem Boot-Sticker warten.
	var gefeiert := await wait_until(func() -> bool: return celebrated.has("firstNom"), 9000)
	assert_true(gefeiert, "firstNom wird gefeiert (Queue): %s" % [celebrated])
	assert_true(hub._toasts.get_child_count() > 0, "Toast liegt auf der Hub-Layer")
	# Erneute Auswertung: kein Doppel-Unlock, keine Doppel-Feier.
	celebrated.clear()
	RewardHub.note_action(gs)
	await wait_frames(3)
	assert_false(celebrated.has("firstNom"), "keine Doppel-Feier")
	host.queue_free()
	await wait_frames(1)
	gs.free()


func test_note_action_ohne_gs_crasht_nicht() -> void:
	RewardHub.note_action(null)
	assert_true(true, "note_action(null) ist ein No-Op")


## EVAL-Rest "Recovery-Toast unverdrahtet": bootet der Hub an einem
## GameState, dessen Save aus einer Sicherung zurueckgeholt wurde, zeigt er
## GENAU EINMAL den sys.save.recovered_backup-Toast auf seiner Layer.
func test_hub_zeigt_recovery_toast_beim_boot() -> void:
	_seq += 1
	var dir := "user://ef1_tests/recovery_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var path := dir + "/save_v5.json"
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(path)
	gs.save_now()
	gs.save_now()  # rotiert Generation 1 nach bak1
	gs.free()
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string("{{{ kaputt %#!")
	f = null
	var gs2: Node = GameStateScript.new()
	gs2.clock.pin(NOW_MS)
	gs2.clock.set_utc_offset_minutes(0)
	gs2.initialize(path)
	var host := Node.new()
	tree.root.add_child(host)
	var hub := RewardHub.attach_to(host, gs2)
	var erwartet := I18nService.t("sys.save.recovered_backup")
	var gezeigt := await wait_until(
		func() -> bool: return hub._toasts.queue.current() == erwartet, 5000
	)
	assert_true(gezeigt, "Recovery-Toast erscheint auf der Hub-Layer")
	assert_eq(gs2.consume_recovery_notice(), "", "Hinweis ist verbraucht (kein Doppel-Toast)")
	host.queue_free()
	await wait_frames(1)
	gs2.free()
