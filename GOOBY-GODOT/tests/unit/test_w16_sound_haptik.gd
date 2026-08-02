extends TestCase
## W16 SOUND/HAPTIK — Wächter (F5, g2-Fixliste): reparierte Builder/Screens
## bauen ausschließlich SquishButtons (Haptik + Squish laufen zentral dort).
## Die Datei wächst wellenweise mit; Editor in G3: P09 SOUND-KERN.
## Konvention: docs/godot-rewrite/AUDIO-GRAMMATIK.md.

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

const NOW_MS := 1768478400000
const TAG := "2026-07-25"

## UI-HAPTIC-Welle: reine ANZEIGE-Chips (kein pressed-Handler, Maus per
## style_status_chip raus) dürfen nackte Buttons bleiben — je Datei die
## erlaubte Anzahl. ALLES andere unter scripts/ muss SquishButton bauen.
const NACKTE_BUTTON_AUSNAHMEN := {
	"res://scripts/ui/social/social_screen.gd": 1,
	"res://scripts/ui/friends/friends_screen.gd": 1,
	"res://scripts/city/phone/friends_app.gd": 1,
}

var _seq := 0


## Scan-Helfer: jeder interaktive Button unter `root` muss SquishButton sein.
## Ausgenommen: OptionButton-Dropdowns (kein SquishButton-Erbe möglich) und
## reine Anzeige-Chips mit MOUSE_FILTER_IGNORE.
func _assert_alle_buttons_squish(root: Node, kontext: String) -> void:
	var gefunden := 0
	for btn: Node in root.find_children("*", "Button", true, false):
		if btn is OptionButton or (btn as Control).mouse_filter == Control.MOUSE_FILTER_IGNORE:
			continue
		gefunden += 1
		assert_true(btn is SquishButton, "%s: '%s' ist kein SquishButton" % [kontext, btn.name])
	assert_true(gefunden > 0, "%s: Scan fand keinen einzigen Button" % kontext)


func test_city_bausteine_bauen_squish() -> void:
	var box := VBoxContainer.new()
	var zeile := CitySheetBausteine.kauf_zeile(box, "T", "", "Kauf", true, func() -> void: pass)
	_assert_alle_buttons_squish(zeile, "kauf_zeile")
	var knopf := CitySheetBausteine.farb_knopf(Color.RED, false, func() -> void: pass)
	assert_true(knopf is SquishButton, "farb_knopf baut keinen SquishButton")
	knopf.free()
	box.free()


func test_kauf_zeile_sound_overrides_bleiben_kompatibel() -> void:
	# Die zwei dokumentierten Overrides (F1): Bestücken = stumm (""),
	# GoobyPal-Senden = "ui_click". Beide Signaturen müssen bauen und der
	# Druck muss den bei_kauf-Handler weiterhin erreichen.
	var box := VBoxContainer.new()
	var gedrueckt := [0]
	var stumm := CitySheetBausteine.kauf_zeile(
		box, "T", "", "K", true, func() -> void: gedrueckt[0] += 1, ""
	)
	var klick := CitySheetBausteine.kauf_zeile(
		box, "T", "", "K", false, func() -> void: pass, "ui_click"
	)
	var stumm_btn := stumm.get_child(stumm.get_child_count() - 1) as Button
	stumm_btn.pressed.emit()
	assert_eq(gedrueckt[0], 1, 'bei_kauf läuft auch mit sound_id=""')
	var klick_btn := klick.get_child(klick.get_child_count() - 1) as Button
	assert_true(klick_btn.disabled, "aktiv=false disabled den Knopf weiterhin")
	box.free()


func test_goobay_panel_baut_nur_squish_buttons() -> void:
	# F4: GooBay-Listenzeile, „zu“, Versand und die _add_button-Knöpfe.
	var gs := _fresh_gs()
	HomeState.ensure_initialized(gs)
	HomeState.store_item(gs, "chair")
	var layer := Control.new()
	tree.root.add_child(layer)
	var panel := GoobayPanel.open_in(layer, gs, null, TAG, 7)
	await wait_frames(2)
	panel.starte_verhandlung("chair")
	await wait_frames(1)
	_assert_alle_buttons_squish(panel, "GoobayPanel")
	layer.queue_free()
	await wait_frames(2)
	_teardown(gs)


## UI-HAPTIC-Welle: repo-weiter Quell-Scan — interaktive Knöpfe entstehen
## NIE mehr als nackte `Button.new()` (SquishButton trägt Squish + Haptik +
## das zentrale „Nö“). MenuButton/OptionButton/SquishButton zählen nicht.
func test_repo_weit_keine_nackten_button_new() -> void:
	var treffer := _scanne_nackte_buttons("res://scripts")
	for pfad: String in treffer:
		var erlaubt := int(NACKTE_BUTTON_AUSNAHMEN.get(pfad, 0))
		assert_true(
			int(treffer[pfad]) <= erlaubt,
			(
				(
					"%s: %d nackte(r) Button.new() (erlaubt: %d) — interaktive "
					% [pfad, int(treffer[pfad]), erlaubt]
				)
				+ "Knöpfe sind SquishButton (AUDIO-GRAMMATIK)"
			)
		)
	# Selbsttest des Scanners: die drei Anzeige-Chips muss er finden.
	for pfad: String in NACKTE_BUTTON_AUSNAHMEN:
		assert_true(treffer.has(pfad), "Scanner-Selbsttest: %s nicht gefunden" % pfad)


## UI-HAPTIC-Welle: ein Tap auf einen GESPERRTEN SquishButton verpufft nicht
## stumm — das zentrale „Nö“ (ui_error + warn-Haptik + Kopfschütteln) feuert
## in SquishButton._gui_input, ganz ohne Screen-Verdrahtung.
func test_gesperrter_squishbutton_spielt_das_noe() -> void:
	var btn := SquishButton.new()
	btn.disabled = true
	tree.root.add_child(btn)
	await wait_frames(1)
	var director := AudioDirector.get_or_create(btn)
	var played: Dictionary = director.get("_last_played_msec")
	var vorher := int(played.get("ui_error", -1))
	if vorher >= 0:
		# Debounce (45 ms) verstreichen lassen, damit der Zeitstempel wandert.
		await wait_until(func() -> bool: return Time.get_ticks_msec() - vorher > 60, 2000)
	var tap := InputEventMouseButton.new()
	tap.button_index = MOUSE_BUTTON_LEFT
	tap.pressed = true
	btn._gui_input(tap)
	played = director.get("_last_played_msec")
	var nachher := int(played.get("ui_error", -1))
	assert_true(nachher >= 0 and nachher != vorher, "disabled-Tap spielt zentral ui_error")
	# Nicht-gesperrte Knöpfe lösen das „Nö“ NICHT aus (Press-Pfad bleibt frei).
	btn.disabled = false
	await wait_until(func() -> bool: return Time.get_ticks_msec() - nachher > 60, 2000)
	btn._gui_input(tap)
	played = director.get("_last_played_msec")
	assert_eq(int(played.get("ui_error", -1)), nachher, "aktiver Knopf spielt kein ui_error")
	btn.queue_free()
	await wait_frames(1)


## ----------------------------------------------------------- Scan-Helfer


func _scanne_nackte_buttons(wurzel: String) -> Dictionary:
	var out: Dictionary = {}
	var stapel: Array[String] = [wurzel]
	while not stapel.is_empty():
		var dir_pfad: String = stapel.pop_back()
		var dir := DirAccess.open(dir_pfad)
		if dir == null:
			continue
		dir.list_dir_begin()
		var eintrag := dir.get_next()
		while eintrag != "":
			var pfad := dir_pfad.path_join(eintrag)
			if dir.current_is_dir():
				if not eintrag.begins_with("."):
					stapel.append(pfad)
			elif eintrag.ends_with(".gd"):
				var n := _zaehle_nackte_buttons(pfad)
				if n > 0:
					out[pfad] = n
			eintrag = dir.get_next()
		dir.list_dir_end()
	return out


## Zählt `Button.new()` in Code-Zeilen (Kommentare zählen nicht); vorn darf
## KEIN Wortzeichen stehen — Menu/Option/Squish/…Button.new() sind ok.
func _zaehle_nackte_buttons(pfad: String) -> int:
	var n := 0
	for zeile: String in FileAccess.get_file_as_string(pfad).split("\n"):
		var code := zeile.strip_edges()
		if code.begins_with("#"):
			continue
		var pos := code.find("Button.new()")
		while pos != -1:
			if pos == 0 or not _ist_wortzeichen(code[pos - 1]):
				n += 1
			pos = code.find("Button.new()", pos + 1)
	return n


func _ist_wortzeichen(zeichen: String) -> bool:
	return (
		zeichen == "_"
		or (zeichen >= "a" and zeichen <= "z")
		or (zeichen >= "A" and zeichen <= "Z")
		or (zeichen >= "0" and zeichen <= "9")
	)


func _fresh_gs() -> Node:
	_seq += 1
	var dir := "user://w16_sound_haptik/%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	HomeState.register_slice()
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.initialize(dir + "/save_v5.json")
	return gs


func _teardown(gs: Node) -> void:
	gs.free()
	SaveSchema.unregister_slice(HomeState.SLICE_ID)
	HomeState.reset_for_tests()
