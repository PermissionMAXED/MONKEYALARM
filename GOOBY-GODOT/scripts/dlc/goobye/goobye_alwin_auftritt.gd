extends Node
## Onkel Alwins SICHTBARER Stammkunden-Auftritt im „Goo und Bye" (§6.3),
## als schlanke Komponente neben der Laden-Szene (CI-Split-Muster, hält
## laden_scene.gd unter max-file-lines; preload statt class_name wegen
## Import-Cache). Drei Aufgaben:
##   1. Routine-Zettel: ein Caption-Label tickt Alwins Tagesroutine mit
##      Uhrzeit durch (GoobyeAlwin.ROUTINE — ankommen, Kennerblick,
##      Regal polieren, GENAU eine Möhre, Abschied).
##   2. Polier-Moment: beim Kennerblick poliert Alwin im Vorbeigehen ein
##      Regal — Slot-Knopf hüpft blitzblank (Slot deterministisch aus dem
##      Tages-Seed), dazu der Sticker-Glanz-Ton.
##   3. Antippen: ein mitlaufender Touch-Knopf (44-pt-Floor) über Alwin;
##      jeder Tipp spielt den nächsten Gag der Tages-Rotation
##      (GoobyeAlwin.gag_key — ohne Wiederholung im Zyklus), Alwin freut
##      sich (Squash-Hopser + ecstatic-Blitz, kollidiert nie mit den
##      Positions-Tweens der Kunden-Choreo).
## Alle Hooks sind no-ops, solange kein Alwin im Laden steht (_rig null) —
## die Szene darf sie für JEDEN Kunden aufrufen.

## Antipp-Knopf schwebt auf Kopfhöhe über dem Rig (Meter).
const TIPP_HOEHE := 1.15

## Gebrabbel-Pitch-Reihe fürs Antippen (zyklisch je Tipp).
const GAG_TOENE: Array = [1.05, 1.2, 1.35]

## Injiziert von der Szene: Choreo-Zeitraffer + Tages-Seed (Gag-Rotation).
var tempo := 1.0
var seed_wert := 0

## Zuletzt gezeigter Gag-Key (Test-Anker fürs Antippen).
var letzter_gag := ""

var _ui: Control
var _cam: Camera3D
var _toast: Node
var _slot_knoepfe: Array[Button] = []
var _rig: Node3D = null
var _minute := 0
var _tipps := 0
var _label: Label
var _knopf: Button


func _process(_delta: float) -> void:
	if _rig == null or _cam == null or not _rig.is_inside_tree() or not _cam.is_inside_tree():
		return
	var punkt := _cam.unproject_position(_rig.global_position + Vector3(0.0, TIPP_HOEHE, 0.0))
	_knopf.position = punkt - _knopf.size / 2.0


## UI-Teile bauen (einmalig aus _baue_ui der Szene): Routine-Zettel links
## oben + Antipp-Knopf, beide unsichtbar bis Alwin da ist.
func einrichten(ui: Control, cam: Camera3D, toast: Node, slot_knoepfe: Array[Button]) -> void:
	_ui = ui
	_cam = cam
	_toast = toast
	_slot_knoepfe = slot_knoepfe
	_label = Label.new()
	_label.name = "AlwinRoutine"
	_label.theme_type_variation = &"CaptionLabel"
	_label.visible = false
	_ui.add_child(_label)
	_knopf = SquishButton.new()
	_knopf.name = "AlwinTippen"
	_knopf.theme_type_variation = &"BtnGhost"
	_knopf.text = "…"
	_knopf.focus_mode = Control.FOCUS_NONE
	_knopf.visible = false
	_knopf.pressed.connect(tippen)
	_ui.add_child(_knopf)
	set_process(false)


## Metrics-abhängige Teile (Aufbau + Rotation, aus _relayout_ui der Szene).
func relayout(m: Dictionary) -> void:
	if _knopf == null:
		return
	ScreenShell.touch_target(_knopf, m)
	var f := float(m["f"])
	var insets: Dictionary = m["insets"]
	_label.position = Vector2(float(insets["left"]) + 16.0 * f, float(insets["top"]) + 64.0 * f)


## ------------------------------------------------------ Routine-Choreo


## Alwin betritt den Laden (Kunde 0, 9:00): Zettel an, Knopf mitlaufen.
func betritt(rig: Node3D, minute: int) -> void:
	_rig = rig
	_minute = minute
	_zeige_schritt("ankunft")
	_knopf.visible = true
	set_process(true)


## Am Regal: Kennerblick, kurz darauf der Polier-Moment.
func stoebert() -> void:
	if _rig == null:
		return
	_zeige_schritt("kennerblick")
	var tween := create_tween()
	tween.tween_interval(0.35 * tempo)
	tween.tween_callback(_polieren)


## An der Kasse: GENAU eine Möhre (der Piep kommt aus der Szene).
func kassiert() -> void:
	if _rig == null:
		return
	_zeige_schritt("moehre")


## Auf dem Weg zur Tür: Abschied (Antippen geht noch bis zur Tür).
func geht() -> void:
	if _rig == null:
		return
	_zeige_schritt("abschied")


## Alwin ist weg: Zettel + Knopf aus, Hooks werden wieder zu no-ops.
func weg() -> void:
	if _rig == null:
		return
	_rig = null
	set_process(false)
	_knopf.visible = false
	_label.visible = false


## ------------------------------------------------------------ Antippen


## Ein Tipp auf Alwin: nächster Gag der Tages-Rotation (ohne Wiederholung
## im Zyklus) als Toast, dazu Gebrabbel-Piep + Freuen-Hopser.
func tippen() -> void:
	if _rig == null:
		return
	letzter_gag = GoobyeAlwin.gag_key(seed_wert, _tipps)
	AudioDirector.try_play(self, "ui_chip", float(GAG_TOENE[_tipps % GAG_TOENE.size()]))
	Haptics.success(self)
	_tipps += 1
	if _toast != null and _toast.has_method("show_toast"):
		_toast.show_toast(I18nService.t(letzter_gag))
	_freuen()


## ---------------------------------------------------------- Innenleben


## Ein Routine-Schritt auf dem Zettel: "9:02 · Onkel Alwin: poliert …".
func _zeige_schritt(id: String) -> void:
	var eintrag := GoobyeAlwin.schritt(id, _minute)
	if eintrag.is_empty() or _label == null:
		return
	_label.text = (
		I18nService
		. t(
			"dlc_goobye.alwin.zettel",
			{
				"uhrzeit": GoobyeAlwin.uhrzeit(int(eintrag["minute"])),
				"text": I18nService.t(str(eintrag["text_key"])),
			}
		)
	)
	_label.visible = true
	UiMotion.bounce(_label)


## Polier-Moment (§6.3): das Tages-Regal hüpft blitzblank.
func _polieren() -> void:
	if _rig == null:
		return
	_zeige_schritt("polieren")
	AudioDirector.try_play(self, "ui_sticker")
	if not _slot_knoepfe.is_empty():
		UiMotion.bounce(_slot_knoepfe[absi(seed_wert) % _slot_knoepfe.size()])


## Freuen-Reaktion: Squash-Hopser über scale (Positions-Tweens der Choreo
## bleiben unberührt) + kurzer ecstatic-Blitz.
func _freuen() -> void:
	if _rig.has_method("set_emotion"):
		_rig.set_emotion("ecstatic")
	var tween := create_tween()
	tween.tween_property(_rig, "scale", Vector3.ONE * 1.12, 0.09)
	tween.tween_property(_rig, "scale", Vector3.ONE, 0.16)
	tween.tween_callback(_wieder_froh)


func _wieder_froh() -> void:
	if _rig != null and _rig.has_method("set_emotion"):
		_rig.set_emotion("happy")
