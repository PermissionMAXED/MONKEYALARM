class_name SquishButton
extends Button
## EIN Press-Feedback-Skript für alle AC-Buttons (H §1.1). W14/UIKERN:
## satterer „Squish“ nach Web-Vorbild (`.btn:active` + --ease-spring):
## Press = Scale auf PRESS_SCALE (0.94, der Schatten wird über die
## pressed-StyleBox gleichzeitig kürzer), Release = kurzer Overshoot ÜBER
## die Ruhelage (SQUISH_OVERSHOOT) und federnd (TRANS_BACK/EASE_OUT =
## --ease-spring) zurück. Respektiert Reduced Motion (ThemeService).
##
## Haptik läuft ZENTRAL hier: jeder Knopfdruck feuert Haptics.tap() —
## Screens verdrahten nichts selbst (Gate `game.haptik` sitzt in Haptics).
##
## GESPERRT klingt auch (UI-HAPTIC-Welle): ein Tap auf einen disabled-Knopf
## verpufft nicht mehr stumm, sondern spielt zentral das „Nö“ — `ui_error` +
## Haptics.warn (Grammatik: ungültiger Tap) + kurzes Kopfschütteln
## (UiMotion.schuetteln, Reduced-Motion-gated). Screens verdrahten dafür
## NICHTS selbst; wer im Outcome-Zweig bereits `ui_error` spielt, kollidiert
## nicht (45-ms-Debounce des AudioDirector schluckt Doppel-Trigger).

var _tween: Tween


func _ready() -> void:
	button_down.connect(_on_down)
	button_up.connect(_on_up)
	resized.connect(_center_pivot)
	_center_pivot()


## Disabled-Buttons bekommen gui_input weiterhin zugestellt (mouse_filter
## bleibt STOP) — nur die BaseButton-Press-Logik ist tot. Genau da hängt
## das zentrale „Nö“ für gesperrte Aktionen. Touch läuft über die
## Mouse-Emulation (Projekt-Default) ebenfalls hier durch.
func _gui_input(event: InputEvent) -> void:
	if not disabled:
		return
	var mb := event as InputEventMouseButton
	if mb != null and mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
		nope()


## Zentrales „Nö“-Feedback (Fehlerton + warn-Haptik + Kopfschütteln).
## Auch von außen aufrufbar, wenn eine gesperrte NICHT-Knopf-Fläche
## dasselbe Feedback braucht.
func nope() -> void:
	AudioDirector.try_play(self, "ui_error")
	Haptics.warn(self)
	UiMotion.schuetteln(self)


func _center_pivot() -> void:
	pivot_offset = size / 2.0


func _on_down() -> void:
	# Haptik ist KEINE Motion — sie feuert auch bei Reduced Motion.
	Haptics.tap(self)
	if ThemeService.is_reduced_motion(self):
		return
	_kill_tween()
	_tween = create_tween()
	_tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_property(self, "scale", Vector2.ONE * AcTokens.PRESS_SCALE, AcTokens.DUR_POP / 2.0)


func _on_up() -> void:
	if ThemeService.is_reduced_motion(self):
		scale = Vector2.ONE
		return
	_kill_tween()
	_tween = create_tween()
	# Overshoot-Bounce: erst über die Ruhelage hinaus, dann federnd zurück.
	(
		_tween
		. tween_property(
			self, "scale", Vector2.ONE * AcTokens.SQUISH_OVERSHOOT, AcTokens.DUR_POP * 0.5
		)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_OUT)
	)
	(
		_tween
		. tween_property(self, "scale", Vector2.ONE, AcTokens.DUR_POP * 0.7)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)


func _kill_tween() -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()
