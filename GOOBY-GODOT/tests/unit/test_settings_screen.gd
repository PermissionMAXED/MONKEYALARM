extends TestCase
## RW-7 — Settings-Screen (UI): alle Abschnitte existieren, Regler schreiben
## sofort in AppSettings UND wirken messbar (Engine.max_fps, UiScale),
## Einzelregler markieren das Profil als "benutzerdefiniert", die
## CC-BY-Credits stehen unter "Ueber", und der versteckte Dev-Trigger
## (3 Tipps auf das aktive "Deutsch" + Halte-Bestaetigung) aktiviert
## den Entwicklermodus. Der ECHTE AppSettings-Autoload wird benutzt und am
## Testende wieder auf die Ausgangswerte gestellt.

const SETTINGS_SCENE := preload("res://scripts/ui/settings_screen.tscn")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

const SECTIONS := [
	"SectionAllgemein",
	"SectionGrafik",
	"SectionAnzeige",
	"SectionSteuerung",
	"SectionBarrierefreiheit",
	"SectionAudio",
	"SectionBenachrichtigungen",
	"SectionSpiel",
	"SectionSpielstand",
	"SectionUpdates",
	"SectionUeber",
]


func _app() -> Node:
	return tree.root.get_node_or_null("/root/AppSettings")


func _mount_screen() -> Control:
	I18nService.set_locale("de")
	var screen: Control = SETTINGS_SCENE.instantiate()
	tree.root.add_child(screen)
	return screen


func _unmount(screen: Control) -> void:
	screen.get_parent().remove_child(screen)
	screen.free()


func test_alle_abschnitte_existieren() -> void:
	var screen := _mount_screen()
	for section: String in SECTIONS:
		assert_true(
			screen.find_child(section, true, false) != null, "Abschnitt fehlt: %s" % section
		)
	_unmount(screen)


func test_credits_mit_cc_by_namensnennungen() -> void:
	var screen := _mount_screen()
	var title := screen.find_child("CreditsTitle", true, false) as Label
	assert_true(title != null, "Credits-Titel unter Ueber")
	var joined := ""
	for i in 12:
		var line := screen.find_child("CreditLine%d" % i, true, false) as Label
		if line != null:
			joined += line.text + "\n"
	for pflicht in [
		"congusbongus", "Alan McKinney", "DoKashiteru", "kurt", "Gregor Quendel", "tcarisland"
	]:
		assert_true(joined.contains(pflicht), "CC-BY-Namensnennung fehlt: %s" % pflicht)
	_unmount(screen)


func test_preset_wahl_schreibt_und_wirkt() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev_graphics: Dictionary = (app.get_setting("graphics") as Dictionary).duplicate(true)
	var prev_fps := Engine.max_fps
	var screen := _mount_screen()
	var picker := (
		screen.find_child("RowGraphicsPreset", true, false).get_node("Value") as OptionButton
	)
	# Index 1 = "niedrig" (auto/niedrig/mittel/hoch/benutzerdefiniert).
	picker.select(1)
	picker.item_selected.emit(1)
	assert_eq(str(app.value_of("graphics.preset")), "niedrig", "Preset persistiert")
	assert_eq(Engine.max_fps, 30, "QualityService wendet Niedrig sofort an (30 FPS)")
	_unmount(screen)
	app.set_setting("graphics", prev_graphics)
	app.set_setting("graphics.preset", str(prev_graphics.get("preset", "auto")))
	Engine.max_fps = prev_fps


func test_einzelregler_markiert_benutzerdefiniert() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev_graphics: Dictionary = (app.get_setting("graphics") as Dictionary).duplicate(true)
	var prev_fps := Engine.max_fps
	var screen := _mount_screen()
	var slider := (
		screen.find_child("RowGraphicsParticles", true, false).get_node("Value") as HSlider
	)
	# WARN-SWEEP: 0.45 statt 0.35 — 0.35 ist der Partikel-Wert des
	# "niedrig"-Buendels. Senkt die Auto-Notbremse im langsamen Headless-Lauf
	# die Stufe auf niedrig, startet der Slider schon bei 0.35 und
	# `slider.value = 0.35` feuert KEIN value_changed (Flake: got=auto).
	# 0.45 kommt in keinem Profil-Buendel vor (0.35/0.65/0.75/1.0).
	slider.value = 0.45
	assert_eq(
		str(app.value_of("graphics.preset")),
		"benutzerdefiniert",
		"Einzelregler stellt das Profil auf benutzerdefiniert"
	)
	assert_almost(float(app.value_of("graphics.particles")), 0.45, 0.001)
	_unmount(screen)
	app.set_setting("graphics", prev_graphics)
	app.set_setting("graphics.preset", str(prev_graphics.get("preset", "auto")))
	Engine.max_fps = prev_fps


func test_ui_scale_regler_wirkt_auf_uiscale() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev := float(app.value_of("display.ui_scale"))
	var screen := _mount_screen()
	var slider := screen.find_child("RowDisplayUiScale", true, false).get_node("Value") as HSlider
	slider.value = 1.15
	assert_almost(float(app.value_of("display.ui_scale")), 1.15, 0.001, "persistiert")
	assert_almost(UiScale.user_factor, 1.15, 0.001, "wirkt sofort auf die zentrale UiScale")
	_unmount(screen)
	app.set_setting("display.ui_scale", prev)


func test_benachrichtigungs_gate_schreibt() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev: bool = app.is_on("notifications.pflege")
	var screen := _mount_screen()
	var toggle := screen.find_child("RowNotifyPflege", true, false).get_node("Value") as CheckButton
	toggle.button_pressed = false
	toggle.toggled.emit(false)
	assert_false(app.is_on("notifications.pflege"))
	assert_false(app.notify_allowed("pflege"), "Gate greift sofort")
	_unmount(screen)
	app.set_setting("notifications.pflege", prev)


func test_autosave_toggle_schreibt() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev: bool = app.is_on("game.autosave")
	var screen := _mount_screen()
	var toggle := screen.find_child("RowGameAutosave", true, false).get_node("Value") as CheckButton
	toggle.button_pressed = false
	toggle.toggled.emit(false)
	assert_false(app.is_on("game.autosave"))
	_unmount(screen)
	app.set_setting("game.autosave", prev)


func test_dev_trigger_drei_tipps_plus_halten() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev_enabled: Variant = app.get_setting("dev.enabled", false)
	var prev_active: Variant = app.get_setting("dev.was_active", false)
	var screen := _mount_screen()
	# Zwei Tipps reichen NICHT:
	screen.call("_on_language_pressed", "de")
	screen.call("_on_language_pressed", "de")
	assert_true(screen.find_child("DevUnlockDialog", true, false) == null, "2 Tipps oeffnen nichts")
	screen.call("_on_language_pressed", "de")
	var dialog := screen.find_child("DevUnlockDialog", true, false)
	assert_true(dialog != null, "3 Tipps oeffnen den Warn-Dialog")
	var dev := tree.root.get_node_or_null("/root/Dev")
	if dialog != null and dev != null:
		assert_false(bool(dev.is_enabled()), "vor der Bestaetigung bleibt Dev aus")
		dialog.set_process(false)
		dialog.call("_on_hold_down")
		dialog.call("_process", 2.1)
		await wait_frames(2)
		assert_true(bool(dev.is_enabled()), "Halte-Bestaetigung aktiviert den Dev-Modus")
		assert_true(bool(app.get_setting("dev.enabled", false)), "persistiert in AppSettings")
		dev.disable()
	_unmount(screen)
	app.set_setting("dev.enabled", prev_enabled)
	app.set_setting("dev.was_active", prev_active)
	SaveSchema.unregister_slice(DevActions.SLICE_ID)


func test_sprachwechsel_ueber_segmente() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev_lang: Variant = app.get_setting("language", "de")
	var screen := _mount_screen()
	screen.call("_on_language_pressed", "en")
	assert_eq(I18nService.get_locale(), "en", "Segment-Tipp wechselt die Sprache")
	assert_eq(str(app.get_setting("language")), "en", "persistiert")
	screen.call("_on_language_pressed", "de")
	assert_eq(I18nService.get_locale(), "de")
	_unmount(screen)
	I18nService.set_locale("de")
	app.set_setting("language", prev_lang)


## LOOP-SETTINGS: der "Auto"-Eintrag des Qualitaets-Pickers traegt die
## aufgeloeste Stufe ("Auto (Hoch)") statt den Spieler raten zu lassen.
func test_qualitaet_auto_zeigt_aufgeloeste_stufe() -> void:
	# Pure Abbildung Stufe -> Anzeige-Key (inkl. ProMotion-Kopplung):
	assert_eq(SettingsLogik.stufe_label_key("hoch"), "settings.qualitaet_hoch")
	assert_eq(
		SettingsLogik.stufe_label_key(QualityProfiles.STUFE_HOCH_120),
		"settings.qualitaet_hoch120",
		"hoch120-Key bleibt an QualityProfiles.STUFE_HOCH_120 gekoppelt"
	)
	assert_eq(SettingsLogik.stufe_label_key("kaputt"), "", "unbekannt = leer (Picker zeigt Auto)")
	# Pure Aufloesung: laufendes Auto nimmt das LIVE-Buendel, sonst Geraete-Fakten.
	var niedrig := QualityProfiles.bundle("niedrig")
	assert_eq(SettingsLogik.auto_stufe("auto", niedrig, {}), "niedrig", "applied zaehlt bei auto")
	assert_eq(
		SettingsLogik.auto_stufe(
			"hoch", niedrig, {"memory_mb": 6000.0, "screen_px": Vector2(2556, 1179)}
		),
		"hoch",
		"ohne laufendes Auto zaehlt die Geraete-Klassifikation"
	)
	# Und im UI: Eintrag 0 des Pickers ist nie mehr das nackte "Auto".
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev_graphics: Dictionary = (app.get_setting("graphics") as Dictionary).duplicate(true)
	app.set_setting("graphics.preset", "auto")
	var screen := _mount_screen()
	var picker := (
		screen.find_child("RowGraphicsPreset", true, false).get_node("Value") as OptionButton
	)
	var auto_text := picker.get_item_text(0)
	assert_true(auto_text.begins_with(I18nService.t("settings.qualitaet_auto")), "beginnt mit Auto")
	assert_true(auto_text.contains("("), "traegt die aufgeloeste Stufe in Klammern: " + auto_text)
	_unmount(screen)
	app.set_setting("graphics", prev_graphics)
	app.set_setting("graphics.preset", str(prev_graphics.get("preset", "auto")))


## LOOP-SETTINGS: purer Haptik-Abgleich — Hauptschalter (game.haptik) und
## Stufe (controls.haptics) duerfen einander nie widersprechen.
func test_haptik_folgen_pur() -> void:
	assert_eq(
		SettingsLogik.haptik_folgen("game.haptik", true, "aus"),
		{"controls.haptics": "normal"},
		"Schalter AN bei Stufe aus -> Stufe zurueck auf normal (AN wirkt)"
	)
	assert_eq(SettingsLogik.haptik_folgen("game.haptik", true, "stark"), {}, "AN + stark = nichts")
	assert_eq(SettingsLogik.haptik_folgen("game.haptik", false, "aus"), {}, "AUS zieht nichts nach")
	assert_eq(
		SettingsLogik.haptik_folgen("controls.haptics", "aus", true),
		{"game.haptik": false},
		"Stufe aus bei Schalter an -> Schalter aus (ehrliche Anzeige)"
	)
	assert_eq(SettingsLogik.haptik_folgen("controls.haptics", "aus", false), {}, "schon aus")
	assert_eq(SettingsLogik.haptik_folgen("controls.haptics", "dezent", true), {}, "Stufe normal")


## LOOP-SETTINGS: Stufe ausgegraut + Wegweiser bei Hauptschalter AUS; beide
## Richtungen des Abgleichs laufen ueber die echten Rows.
func test_haptik_staerke_gesperrt_und_abgleich() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev_master: Variant = app.get_setting("game.haptik", true)
	var prev_stufe := str(app.value_of("controls.haptics"))
	app.set_setting("game.haptik", false)
	app.set_setting("controls.haptics", "aus")
	var screen := _mount_screen()
	var picker := (
		screen.find_child("RowControlsHaptics", true, false).get_node("Value") as OptionButton
	)
	assert_true(picker.disabled, "Stufe ausgegraut, solange der Hauptschalter aus ist")
	var hilfe := screen.find_child("HapticsHelp", true, false) as Label
	assert_eq(
		hilfe.text,
		I18nService.t("settings.haptik_staerke_gesperrt"),
		"Wegweiser zum Hauptschalter statt iPhone-Hinweis"
	)
	# Hauptschalter AN: die Alt-Stufe "aus" springt auf "normal" (AN wirkt).
	var toggle := screen.find_child("RowGameHaptik", true, false).get_node("Value") as CheckButton
	toggle.button_pressed = true
	assert_true(bool(app.get_setting("game.haptik", false)), "Schalter persistiert AN")
	assert_eq(str(app.value_of("controls.haptics")), "normal", "Stufe aus -> normal")
	await wait_frames(2)
	picker = (
		screen.find_child("RowControlsHaptics", true, false).get_node("Value") as OptionButton
	)
	assert_false(picker.disabled, "nach dem Einschalten wieder bedienbar")
	hilfe = screen.find_child("HapticsHelp", true, false) as Label
	assert_eq(hilfe.text, I18nService.t("settings.haptik_hilfe"), "iPhone-Hinweis ist zurueck")
	# Stufe "aus" waehlen spiegelt den Hauptschalter (nie AN ohne Vibration).
	picker.select(0)
	picker.item_selected.emit(0)
	assert_false(bool(app.get_setting("game.haptik", true)), "Stufe aus schaltet den Schalter aus")
	await wait_frames(2)
	_unmount(screen)
	app.set_setting("game.haptik", prev_master if prev_master != null else true)
	app.set_setting("controls.haptics", prev_stufe)


## LOOP-SETTINGS: die zwei aehnlich klingenden Spielstand-Wege (Alt-Save-
## Import vs. Account-Umzug) tragen je eine erklaerende Hilfezeile.
func test_spielstand_wege_erklaert() -> void:
	var screen := _mount_screen()
	var transfer_hilfe := screen.find_child("TransferHelp", true, false) as Label
	var umzug_hilfe := screen.find_child("UmzugHelp", true, false) as Label
	assert_true(transfer_hilfe != null, "Erklaerung unter dem Transfer-Knopf")
	assert_true(umzug_hilfe != null, "Erklaerung unter dem Umzug-Knopf")
	if transfer_hilfe != null and umzug_hilfe != null:
		assert_eq(transfer_hilfe.text, I18nService.t("settings.spielstand_uebertragen_hilfe"))
		assert_eq(umzug_hilfe.text, I18nService.t("settings.umzug_eintrag_hilfe"))
		assert_ne(transfer_hilfe.text, umzug_hilfe.text, "zwei WIRKLICH verschiedene Texte")
	_unmount(screen)
