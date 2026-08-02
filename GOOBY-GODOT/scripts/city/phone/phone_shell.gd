class_name PhoneShell
extends Control
## IGohbie — die Handy-Shell (Doc E §5.1): Vollbild-Overlay im AC-Look mit
## Statusleiste (Uhr, Münzen, Akku = Goobys Energie), App-Grid aus der
## `PhoneApps`-Registry und Zurück-Geste (Wisch nach unten auf dem Gerät,
## Home-Balken oder ESC). Ein Tipp aufs Grid ersetzt den Inhalt durch die
## App, der Home-Balken geht zurück — zweimal schließt das Handy.
##
## W16/G4 P18: Das Gerät ist KEINE 380×640-Fixkarte mehr — es skaliert mit
## `ScreenShell.metrics()` (×f, `card_width`/`card_max_height`-Deckel),
## Kacheln/Geste/Schriften ziehen mit, und bei Canvas-Änderung (Rotation)
## baut die Shell die aktive Ansicht mit frischen Metriken neu. Apps koppeln
## ihre Breiten über `inhalt_breite()`/`app_label()` an die REALE
## Gerätebreite statt an die 420er-City-Bausteine (G1 ui-post §3/§4).
##
## HUD-Anbindung (Orchestrator): `hud.action_pressed` mit &"igohbie" →
## `PhoneShell.handle_hud_action(action, host, gs)` — GLEICHE Signatur wie
## `GooberandoApp.handle_hud_action`, der Aufruf lässt sich also 1:1 tauschen.
##
## G7/P52 TELEFON-REWORK (User-Screenshot vom echten iPhone, Querformat):
## (1) Gesperrte Apps sind KEIN dunkler Blob mehr (das INK_FAINT-Modulate
## multiplizierte die ganze Kachel dunkel) — Icon bleibt blass erkennbar,
## ein Schloss-Badge sagt „noch zu“. (2) Querformat bekommt eine BREITE
## Geräte-Basis (GERAET_QUER) mit dynamischen Grid-Spalten (3–5), damit
## alle Labels über dem Scroll-Falz bleiben. (3) Öffnen poppt federnd
## (RM = sofort), Grid staffelt, Apps gleiten rein. (4) Zusätzliche
## Zurück-Geste: Wisch VON LINKS in einer App führt zurück aufs Grid.
##
## G7/P52 RUNDE 2 — Wisch-Grammatik auf PanelSheet-Parität (P53):
## (a) Der Runterwisch ZIEHT das Gerät mit dem Finger mit (Scrim hellt
## proportional auf); losgelassen wird an der Weg- ODER Flick-Schwelle
## entschieden — darunter schnappt das Gerät federnd zurück (RM: sofort).
## (b) Schließen fährt animiert aus (Gerät sinkt mit Restschwung + Fade,
## Scrim blendet ab, FadeBlocker schluckt Rest-Taps) statt hart zu
## verschwinden; `geschlossen` feuert nach dem Fade (RM/kein Baum: sofort).
## (c) Sound-Grammatik an EINER Stelle: `zurueck()` klingt ui_back,
## `schliesse()` ui_close — ESC, HomeBalken, Geste und Scrim-Tap klingen
## damit identisch. Wisch-Erfolg tippt haptisch (Muster PanelSheet).
## (d) Gesten laufen NUR noch über Touch-Events (Maus kommt über die
## projektweite Touch-Emulation an) — der alte Doppel-Pfad MouseMotion+
## ScreenDrag zählte jeden Wisch DOPPELT und halbierte real die Schwelle.
## (e) Der Scrim schließt auch per Touch-Tap (P53-Backdrop-Befund: ohne
## Maus-Emulation kam auf dem Gerät kein MouseButton-Event an).

signal app_geoeffnet(app_id: String)
signal geschlossen

const HUD_ACTION := &"igohbie"
## Wischweg (Design-px, ×f), ab dem die Zurück-Geste beim Loslassen auslöst.
const GESTE_PX := 90.0
## Startzone der Links-Wisch-Geste (Design-px ×f vom linken Geräterand).
const GESTE_RAND_PX := 64.0
## Flick-Schwelle (Design-px/s ×f nach unten): ein Schwung-Wisch löst auch
## unterhalb des Wegs aus (PanelSheet.SWIPE_FLICK_PXPS, P53-Grammatik).
const GESTE_FLICK_PXPS := 900.0
## Wie stark der Scrim beim Mitziehen aufhellt (0.6 = bei voller Strecke
## bleiben 40 % Abdunkelung — identisch PanelSheet.SWIPE_DIM_ANTEIL).
const ZUG_DIM_ANTEIL := 0.6
## Ausfahrweg der Schließ-Animation unter die Loslass-Position (Design-px).
const SCHLIESS_SLIDE := 48.0
## Design-Basis des Geräts — die echte Größe liefert `geraet_groesse()`.
## G7/P52: im Querformat eine BREITE Basis (Leitformat iPhone 2868×1320),
## damit das Grid die Breite nutzt statt als schmale Hochkant-Karte im
## Höhen-Deckel zu verhungern (User: „Modal wirkt klein/leer im Querformat“).
const GERAET_GROESSE := Vector2(380.0, 640.0)
const GERAET_QUER := Vector2(640.0, 480.0)
## Kachelbreite und Beschriftungsgröße (Design-px): „GOOBERANDO" ist das
## längste Label und muss ohne Umbruch in eine Spalte passen.
const KACHEL_BREITE := 112.0
const KACHEL_FONT := 13
## Kachel-Knopf-Höhe (Design-px): Querformat flacher, damit 2 Grid-Reihen
## MIT Labels unter den card_max_height-Deckel passen (Touch-Floor bleibt).
const KACHEL_HOEHE := 84.0
const KACHEL_HOEHE_QUER := 72.0
## Grid-Lücken (Design-px) und Spaltenfenster: hoch 3 Spalten wie gehabt,
## quer so viele wie in die reale Gerätebreite passen (max 5).
const GRID_LUECKE := 4.0
const GRID_V_LUECKE := 14.0
const GRID_V_LUECKE_QUER := 8.0
const GRID_SPALTEN_MIN := 3
const GRID_SPALTEN_MAX := 5
## Gesperrte App: Kachel bleibt ERKENNBAR blass (nur Alpha, kein dunkles
## Multiplikations-Modulate — das war der „Blob“ im User-Screenshot).
const GESPERRT_ALPHA := 0.55
const SCHLOSS_ICON := "res://assets/ui/icons/lock.svg"
## AcCard-Innenrand (Theme `_card`: content_margin 18 je Seite).
const KARTEN_RAND := 18.0
## Reserve für den vertikalen Scrollbalken des Inhalts-Scrolls.
const SCROLL_RESERVE := 16.0

var gs: Object
## Host für Vollbild-Kinder (Fotomodus) — Default: der Szenenbaum-Wurzelknoten.
var host: Node

var aktive_app := ""

var _geraet: PanelContainer
var _scrim: ColorRect
var _inhalt: VBoxContainer
var _titel: Label
var _uhr: Label
var _muenzen: Label
var _akku: ProgressBar
var _home: Button
var _status_icons: Array[TextureRect] = []
var _geste_x := 0.0
var _geste_y := 0.0
var _geste_tempo_y := 0.0
var _geste_aktiv := false
var _geste_von_links := false
## Finger-Folgen des Runterwischens (P52 R2): Ruhelage-y des Geräts beim
## Gestenstart, aktuell angewandter Zug-Offset (≥ 0) und der Snap-Tween.
var _folge_rest_y := 0.0
var _folge_offset := 0.0
var _folge_tween: Tween
## Öffnen-Pop-Tween — wird beim Schließen gekappt, damit sein modulate:a-
## Ziel (1,0) nicht gegen das Ausblenden (0,0) kämpft.
var _auf_tween: Tween
## Schließen läuft (Ausfahr-Animation) — schützt vor Doppel-schliesse().
var _schliesst := false
## Zuletzt angewandte ScreenShell-Metriken (f, canvas, insets, floor_px).
var _m: Dictionary = {}


## Handy über der laufenden Szene öffnen (eigener CanvasLayer, Theme gesetzt).
static func oeffne(scene_host: Node, game_state: Object) -> PhoneShell:
	var layer := CanvasLayer.new()
	layer.name = "IGohbieLayer"
	layer.layer = 30
	scene_host.add_child(layer)
	var shell := PhoneShell.new()
	shell.name = "PhoneShell"
	shell.gs = game_state
	shell.host = scene_host
	# Theme explizit setzen: Window-Theme propagiert NICHT durch CanvasLayer.
	shell.theme = ThemeService.theme()
	shell.geschlossen.connect(func() -> void: layer.queue_free())
	layer.add_child(shell)
	return shell


## HUD-Aktions-Handler — identische Signatur wie GooberandoApp.
static func handle_hud_action(action: StringName, scene_host: Node, game_state: Object) -> bool:
	if action != HUD_ACTION:
		return false
	oeffne(scene_host, game_state)
	return true


## ------------------------------------------ geteilte Geometrie (Apps)


## Haupt-Viewport — auch für Builder benutzbar, die VOR add_child laufen.
static func _haupt_viewport() -> Viewport:
	var loop := Engine.get_main_loop()
	return (loop as SceneTree).root if loop is SceneTree else null


## Querformat? (Canvas breiter als hoch — Leitformat iPhone 2868×1320.)
static func ist_querformat(m: Dictionary) -> bool:
	var canvas: Vector2 = m["canvas"]
	return canvas.x > canvas.y


## Design-Basis je Orientierung (G7/P52): hoch die 380×640-Telefonkarte,
## quer die breite 640×480-Karte — der Höhen-Deckel würde ein Hochkant-
## Gerät im Querformat sonst auf eine leere Briefmarke stauchen.
static func basis_groesse(m: Dictionary) -> Vector2:
	return GERAET_QUER if ist_querformat(m) else GERAET_GROESSE


## Gerätegröße aus den Metriken: Basis ×f, gedeckelt auf die Safe-Breite
## (`card_width`) und den Karten-Höhen-Deckel — das Gerät wächst und
## schrumpft mit dem Canvas, statt fix zu kleben (G1 ui-post §3).
static func geraet_groesse(m: Dictionary) -> Vector2:
	var f: float = m["f"]
	var basis := basis_groesse(m)
	return Vector2(
		ScreenShell.card_width(m, basis.x), minf(basis.y * f, ScreenShell.card_max_height(m))
	)


## Spaltenzahl des App-Grids für eine Innenbreite (pur, für Tests): so
## viele 112er-Kacheln wie hineinpassen, gefenstert auf 3–5 Spalten.
static func grid_spalten(innen: float, f: float) -> int:
	var schritt := (KACHEL_BREITE + GRID_LUECKE) * f
	if schritt <= 0.0:
		return GRID_SPALTEN_MIN
	var passt := int(floorf((innen + GRID_LUECKE * f) / schritt))
	return clampi(passt, GRID_SPALTEN_MIN, GRID_SPALTEN_MAX)


## Reale Innenbreite des Geräts für App-Inhalte (Canvas-px): Gerätebreite
## minus AcCard-Rand und Scroll-Reserve. Apps koppeln ihre Text-/Karten-
## breiten HIERAN statt an die 420er-City-Bausteine — das behebt die
## Breiten-Kollision aus G1 ui-post §4.
static func inhalt_breite() -> float:
	var vp := _haupt_viewport()
	if vp == null:
		return GERAET_GROESSE.x - 2.0 * KARTEN_RAND - SCROLL_RESERVE
	var m := ScreenShell.metrics(vp)
	var f: float = m["f"]
	return geraet_groesse(m).x - 2.0 * KARTEN_RAND - SCROLL_RESERVE * f


## Breite für Fließtext IN einer App-Karte (zieht den Karten-Rand ab).
static func text_breite() -> float:
	return maxf(inhalt_breite() - 2.0 * KARTEN_RAND, 120.0)


## Wurzel-Box einer Phone-App einrichten: füllt die Gerätebreite (statt
## `CitySheetBausteine.richte_box_ein` mit 420er-Fixbreite).
static func richte_app_box_ein(box: VBoxContainer) -> void:
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 10)


## Autowrap-Label in Gerätebreite (W3a-GOTCHA: Breite VOR add_child setzen).
static func app_label(box: Control, text: String, variation := "") -> Label:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var breite := text_breite()
	l.custom_minimum_size = Vector2(breite, 0.0)
	l.size = Vector2(breite, 0.0)
	if not variation.is_empty():
		l.theme_type_variation = variation
	box.add_child(l)
	return l


## Karten-Panel (AcCard) in Gerätebreite mit eigener VBox.
static func app_karte(box: Control) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.theme_type_variation = "AcCard"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_child(panel)
	var inhalt := VBoxContainer.new()
	inhalt.add_theme_constant_override("separation", 6)
	panel.add_child(inhalt)
	return inhalt


## Scroll-Bereich mit innerer VBox — Höhe in Design-px, ×f skaliert und
## auf ~60 % der Gerätehöhe gedeckelt (mehr Inhalt scrollt außen mit).
static func app_scroll_liste(box: Control, hoehe_design: float) -> VBoxContainer:
	var hoehe := hoehe_design
	var vp := _haupt_viewport()
	if vp != null:
		var m := ScreenShell.metrics(vp)
		var f: float = m["f"]
		hoehe = minf(hoehe_design * f, geraet_groesse(m).y * 0.6)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0.0, hoehe)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	var liste := VBoxContainer.new()
	liste.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste.add_theme_constant_override("separation", 8)
	scroll.add_child(liste)
	return liste


## Schriften eines App-Teilbaums auf den aktuellen ×f-Faktor heben —
## Apps rufen das nach JEDEM (Neu-)Bau ihrer Kinder auf.
static func app_fonts_skalieren(box: Control) -> void:
	if box == null or not box.is_inside_tree():
		return
	var m := ScreenShell.metrics(box.get_viewport())
	ScreenShell.scale_fonts(box, m["f"])


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	if host == null:
		host = get_tree().root
	_m = ScreenShell.metrics(get_viewport())
	_baue_scrim()
	_baue_geraet()
	zeige_grid()
	get_viewport().size_changed.connect(_on_canvas_geaendert)
	# P52 R2: Öffnen klingt wie jedes Blatt (PanelSheet-Grammatik ui_open).
	AudioDirector.try_play(self, "ui_open")
	_anim_geraet_auf()


func _process(_delta: float) -> void:
	if _uhr != null:
		_uhr.text = Time.get_time_string_from_system().substr(0, 5)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		zurueck()
		get_viewport().set_input_as_handled()


## Wischweg in Canvas-px (Design 90 ×f) — öffentlich für Tests.
func geste_schwelle() -> float:
	return GESTE_PX * float(_m.get("f", 1.0))


## Breite der Links-Wisch-Startzone in Canvas-px (Design 64 ×f).
func geste_rand() -> float:
	return GESTE_RAND_PX * float(_m.get("f", 1.0))


## App-Grid zeigen (Startbildschirm). G7/P52: Spaltenzahl folgt der realen
## Gerätebreite (quer 4–5 statt 3), Kacheln staffeln federnd ein (RM = sofort).
func zeige_grid() -> void:
	aktive_app = ""
	_titel.text = I18nService.t("phone.titel")
	# G7/P52: im Querformat frisst der große Titel die (vom Höhen-Deckel)
	# knappe Gerätehöhe — der Grid-Startbildschirm kommt ohne ihn aus wie
	# ein echter Homescreen; App-Ansichten behalten ihre Überschrift.
	_titel.visible = not PhoneShell.ist_querformat(_m)
	_leere_inhalt()
	var f: float = _m.get("f", 1.0)
	var innen := _geraet.custom_minimum_size.x - 2.0 * KARTEN_RAND
	var spalten := PhoneShell.grid_spalten(innen, f)
	var kachel_breite := minf(
		KACHEL_BREITE * f, (innen - float(spalten - 1) * GRID_LUECKE * f) / float(spalten)
	)
	var grid := GridContainer.new()
	grid.name = "AppGrid"
	grid.columns = spalten
	grid.add_theme_constant_override("h_separation", int(GRID_LUECKE * f))
	var v_luecke := GRID_V_LUECKE_QUER if PhoneShell.ist_querformat(_m) else GRID_V_LUECKE
	grid.add_theme_constant_override("v_separation", int(v_luecke * f))
	grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_inhalt.add_child(grid)
	var kacheln: Array = []
	for app: Dictionary in PhoneApps.grid(gs):
		var kachel := _baue_kachel(app, kachel_breite)
		grid.add_child(kachel)
		kacheln.append(kachel)
	if Fahrdienst.ist_rettungsweg(gs):
		PhoneShell.app_label(_inhalt, I18nService.t("phone.fahrdienst.rettung"), "CaptionLabel")
	ScreenShell.scale_fonts(_geraet, f)
	_anim_grid_rein(kacheln)


## Eine App öffnen (id aus PhoneApps.ids()). Outcome klingt: gesperrt =
## ui_error, Ansichtswechsel ins App-UI = ui_chip (Grammatik W16 §3).
func oeffne_app(app_id: String) -> void:
	if not PhoneApps.ist_offen(app_id, gs):
		AudioDirector.try_play(self, "ui_error")
		_zeige_toast(I18nService.t(PhoneApps.gesperrt_key(app_id, gs)))
		return
	if aktive_app != app_id:
		AudioDirector.try_play(self, "ui_chip")
	aktive_app = app_id
	_titel.text = I18nService.t(str(PhoneApps.app(app_id).get("name_key", "phone.titel")))
	_titel.visible = true
	_leere_inhalt()
	var inhalt := _baue_app(app_id)
	if inhalt != null:
		_inhalt.add_child(inhalt)
		_anim_inhalt_rein(inhalt)
	ScreenShell.scale_fonts(_geraet, _m.get("f", 1.0))
	app_geoeffnet.emit(app_id)


## Zurück-Geste: aus der App aufs Grid, vom Grid aus schließt das Handy.
## P52 R2: die Sound-Grammatik wohnt HIER (ui_back) bzw. in schliesse()
## (ui_close) — ESC, HomeBalken, Wisch und Scrim-Tap klingen so identisch.
func zurueck() -> void:
	if aktive_app.is_empty():
		schliesse()
		return
	AudioDirector.try_play(self, "ui_back")
	zeige_grid()


## Telefon schließen — P52 R2 mit Ausfahr-Animation: das Gerät sinkt von
## seiner AKTUELLEN Position (nach einem Runterwisch also mit Restschwung)
## weiter ab und blendet aus, der Scrim dimmt weg; `geschlossen` feuert am
## Animations-Ende. RM/kein Baum: sofort. Der FadeBlocker schluckt Taps im
## Ausblend-Fenster (Muster PanelSheet), Doppel-Aufrufe sind geschützt.
func schliesse() -> void:
	if _schliesst:
		return
	_schliesst = true
	AudioDirector.try_play(self, "ui_close")
	_kill_folge_tween()
	if _auf_tween != null and _auf_tween.is_valid():
		_auf_tween.kill()
	if not is_inside_tree() or UiMotion.reduced(self):
		geschlossen.emit()
		return
	var blocker := Control.new()
	blocker.name = "FadeBlocker"
	blocker.mouse_filter = Control.MOUSE_FILTER_STOP
	blocker.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(blocker)
	var f: float = _m.get("f", 1.0)
	var tween := create_tween().set_parallel()
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	var dauer: float = AcTokens.DUR_SHEET / 2.0
	tween.tween_property(_geraet, "position:y", _geraet.position.y + SCHLIESS_SLIDE * f, dauer)
	tween.tween_property(_geraet, "modulate:a", 0.0, dauer)
	tween.tween_property(_scrim, "modulate:a", 0.0, dauer)
	tween.chain().tween_callback(func() -> void: geschlossen.emit())


## Fotomodus starten: Handy zu, Sucher über die laufende Szene.
func starte_fotomodus() -> FotoModus:
	var modus := FotoModus.oeffne(host, gs)
	schliesse()
	return modus


## ---------------------------------------------------------------- Aufbau


func _baue_scrim() -> void:
	_scrim = ColorRect.new()
	_scrim.name = "Scrim"
	_scrim.color = AcTokens.VEIL_DEEP
	_scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	_scrim.gui_input.connect(_on_scrim_input)
	add_child(_scrim)


func _baue_geraet() -> void:
	_geraet = PanelContainer.new()
	_geraet.name = "Geraet"
	_geraet.theme_type_variation = "AcCard"
	_geraet.set_anchors_preset(Control.PRESET_CENTER)
	_geraet.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_geraet.grow_vertical = Control.GROW_DIRECTION_BOTH
	_geraet.gui_input.connect(_on_geraet_input)
	add_child(_geraet)
	var spalte := VBoxContainer.new()
	spalte.add_theme_constant_override("separation", 12)
	_geraet.add_child(spalte)
	spalte.add_child(_baue_statusleiste())
	_titel = Label.new()
	_titel.theme_type_variation = "TitleLabel"
	_titel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	spalte.add_child(_titel)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	spalte.add_child(scroll)
	_inhalt = VBoxContainer.new()
	_inhalt.name = "Inhalt"
	_inhalt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inhalt.add_theme_constant_override("separation", 12)
	scroll.add_child(_inhalt)
	spalte.add_child(_baue_home_balken())
	_wende_metrik_an()


## Metriken einsammeln und aufs Gerät anwenden (Größe + Schriften).
func _wende_metrik_an() -> void:
	_m = ScreenShell.metrics(get_viewport())
	# P52 R2: Rotation/Resize mitten in Zug oder Snap-back — Folge-Zustand
	# löschen, das PRESET_CENTER darunter setzt die Ruhelage ohnehin frisch.
	_kill_folge_tween()
	_folge_offset = 0.0
	if _scrim != null:
		_scrim.modulate.a = 1.0
	_geraet.custom_minimum_size = PhoneShell.geraet_groesse(_m)
	_geraet.set_anchors_preset(Control.PRESET_CENTER)
	var f: float = _m["f"]
	if _akku != null:
		_akku.custom_minimum_size = Vector2(52.0, 12.0) * f
	# G7/P52: Statusleisten-Icons ziehen bei Rotation mit (quer nicht quetschen).
	for icon: TextureRect in _status_icons:
		icon.custom_minimum_size = Vector2(18.0, 18.0) * f
	# FB3-Altbefund: HomeBalken-Tippfläche lag bei 40,2 pt — der physische
	# Touch-Floor (≥ 44 pt) wird bei JEDER Metrik-Anwendung frisch gesetzt.
	if _home != null:
		_home.custom_minimum_size = Vector2.ZERO
		ScreenShell.touch_target(_home, _m)
	ScreenShell.scale_fonts(_geraet, f)


## Canvas geändert (Rotation/Resize): Gerät neu vermessen und die aktive
## Ansicht mit frischen Metriken neu bauen (Muster RadioSheet W17/G4).
func _on_canvas_geaendert() -> void:
	if _geraet == null or not is_inside_tree():
		return
	_wende_metrik_an()
	if aktive_app.is_empty():
		zeige_grid()
	else:
		oeffne_app(aktive_app)


## ------------------------------------------------- Animationen (G7/P52)


## Öffnen-Moment: das Telefon poppt federnd auf (DUR_SHEET = 240 ms, Web
## --ease-spring); Reduced Motion springt sofort in den Endzustand. Pivot
## aus der Metrik-Größe — die Layout-Größe steht im _ready noch nicht.
func _anim_geraet_auf() -> void:
	if UiMotion.reduced(self):
		return
	_geraet.pivot_offset = PhoneShell.geraet_groesse(_m) / 2.0
	_geraet.scale = Vector2.ONE * 0.9
	_geraet.modulate.a = 0.0
	_auf_tween = _geraet.create_tween().set_parallel()
	_auf_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_auf_tween.tween_property(_geraet, "scale", Vector2.ONE, AcTokens.DUR_SHEET)
	_auf_tween.tween_property(_geraet, "modulate:a", 1.0, AcTokens.DUR_SHEET / 2.0).set_trans(
		Tween.TRANS_LINEAR
	)


## Grid-Kacheln staffeln federnd ein (RM: sofort sichtbar). Der Start läuft
## deferred, damit die Kacheln beim pop_in ihre Layout-Größe (Pivot) haben.
func _anim_grid_rein(kacheln: Array) -> void:
	if kacheln.is_empty() or UiMotion.reduced(self):
		return
	for kachel: Control in kacheln:
		kachel.modulate.a = 0.0
	_starte_grid_stagger.call_deferred(kacheln)


func _starte_grid_stagger(kacheln: Array) -> void:
	var lebendig: Array = []
	for kachel: Control in kacheln:
		if is_instance_valid(kachel) and kachel.is_inside_tree():
			lebendig.append(kachel)
	UiMotion.stagger_in(lebendig)


## App-Inhalt gleitet nach dem Kachel-Squish ins Gerät (RM: sofort da).
## Deferred, damit die VBox den Inhalt erst einsortiert (Ruhelage-y).
func _anim_inhalt_rein(ctl: Control) -> void:
	if UiMotion.reduced(self):
		return
	ctl.modulate.a = 0.0
	_starte_inhalt_slide.call_deferred(ctl)


func _starte_inhalt_slide(ctl: Control) -> void:
	if not is_instance_valid(ctl) or not ctl.is_inside_tree():
		return
	ctl.modulate.a = 1.0
	UiMotion.slide_up_in(ctl, AcTokens.DUR_SHEET)


func _baue_statusleiste() -> Control:
	var zeile := HBoxContainer.new()
	zeile.name = "Statusleiste"
	zeile.add_theme_constant_override("separation", 10)
	_uhr = Label.new()
	_uhr.theme_type_variation = "CaptionLabel"
	_uhr.text = Time.get_time_string_from_system().substr(0, 5)
	zeile.add_child(_uhr)
	var luecke := Control.new()
	luecke.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# G7/P59 (Playtest-Befund flow_telefon): der Füll-Control stand auf dem
	# Control-Default STOP und schluckte Gesten in der ganzen Mitte der
	# Statuszeile — der Runterwisch-zum-Schließen erreichte das Gerät nie.
	# Nicht-interaktive Status-Elemente müssen durchlässig sein.
	luecke.mouse_filter = Control.MOUSE_FILTER_IGNORE
	zeile.add_child(luecke)
	_status_icons.clear()
	zeile.add_child(_icon("res://assets/ui/icons/coin.svg"))
	_muenzen = Label.new()
	_muenzen.theme_type_variation = "CaptionLabel"
	zeile.add_child(_muenzen)
	zeile.add_child(_icon("res://assets/ui/icons/energy.svg"))
	_akku = ProgressBar.new()
	_akku.theme_type_variation = "StatEnergy"
	_akku.show_percentage = false
	_akku.max_value = 100.0
	_akku.custom_minimum_size = Vector2(52.0, 12.0)
	_akku.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# Reine Anzeige (s. luecke oben) — darf Wisch-Gesten nicht abfangen.
	_akku.mouse_filter = Control.MOUSE_FILTER_IGNORE
	zeile.add_child(_akku)
	_aktualisiere_status()
	return zeile


func _baue_home_balken() -> Control:
	var btn := SquishButton.new()
	btn.name = "HomeBalken"
	btn.theme_type_variation = "GhostButton"
	btn.text = I18nService.t("phone.zurueck")
	btn.focus_mode = Control.FOCUS_NONE
	# FB3-Altbefund (40,2 pt): der Balken hebt sich auf den Touch-Floor.
	ScreenShell.touch_target(btn, _m)
	# W16 F12 → P52 R2: der Klang wohnt jetzt IN zurueck()/schliesse()
	# (ui_back bzw. ui_close) — der Balken verdrahtet nur noch die Aktion.
	btn.pressed.connect(zurueck)
	_home = btn
	return btn


func _baue_kachel(app: Dictionary, kachel_breite: float) -> Control:
	var f: float = _m.get("f", 1.0)
	var app_id := str(app["id"])
	var kachel := VBoxContainer.new()
	kachel.name = "Kachel%s" % app_id.capitalize()
	kachel.add_theme_constant_override("separation", int(4.0 * f))
	kachel.custom_minimum_size = Vector2(kachel_breite, 0.0)
	var btn := SquishButton.new()
	btn.theme_type_variation = "HudIconButton"
	var hoehe := KACHEL_HOEHE_QUER if PhoneShell.ist_querformat(_m) else KACHEL_HOEHE
	btn.custom_minimum_size = Vector2(minf(hoehe * f, kachel_breite), hoehe * f)
	ScreenShell.touch_target(btn, _m)
	btn.expand_icon = false
	btn.focus_mode = Control.FOCUS_NONE
	# G7/P52: der Theme-Deckel (44 px) hielt die Icons auf iPhone-Kacheln
	# briefmarkenklein — er skaliert jetzt ×f mit der Kachel.
	btn.add_theme_constant_override("icon_max_width", int(44.0 * f))
	btn.tooltip_text = I18nService.t(str(app["text_key"]))
	var pfad := PhoneApps.icon_pfad(app_id)
	if ResourceLoader.exists(pfad):
		btn.icon = load(pfad)
	if not bool(app["offen"]):
		# G7/P52: NUR blasser machen (self_modulate-Alpha) statt dunkel zu
		# multiplizieren — das INK_FAINT-Modulate machte die gesperrte
		# Kamera zum „dunklen Blob“ (User-Screenshot). Das Schloss-Badge
		# erklärt den Zustand, ohne das Icon zu verstecken.
		btn.self_modulate = Color(1.0, 1.0, 1.0, GESPERRT_ALPHA)
		btn.add_child(_schloss_badge(f))
	if app_id == Fahrdienst.TAXI and Fahrdienst.ist_rettungsweg(gs):
		btn.modulate = AcTokens.GOLD
	btn.pressed.connect(func() -> void: oeffne_app(app_id))
	# W13C INSTANT: Ungelesen-Badge am App-Icon (nur InstantGooby, nur > 0).
	var badge := InstantGoobyApp.unread_badge(app_id)
	if badge != null:
		btn.add_child(badge)
	kachel.add_child(btn)
	var name_label := Label.new()
	name_label.theme_type_variation = "CaptionLabel"
	name_label.text = I18nService.t(str(app["name_key"]))
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	name_label.add_theme_font_size_override("font_size", KACHEL_FONT)
	name_label.custom_minimum_size = Vector2(kachel_breite, 0.0)
	name_label.size = Vector2(kachel_breite, 0.0)
	kachel.add_child(name_label)
	return kachel


## Schloss-Badge einer gesperrten App (oben rechts auf dem Kachel-Knopf).
func _schloss_badge(f: float) -> TextureRect:
	var badge := TextureRect.new()
	badge.name = "SchlossBadge"
	if ResourceLoader.exists(SCHLOSS_ICON):
		badge.texture = load(SCHLOSS_ICON)
	badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	badge.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	badge.self_modulate = AcTokens.INK_SOFT
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	badge.offset_left = -22.0 * f
	badge.offset_top = 5.0 * f
	badge.offset_right = -5.0 * f
	badge.offset_bottom = 22.0 * f
	return badge


## App-Inhalt bauen — EINE Stelle, an der Id auf UI trifft.
func _baue_app(app_id: String) -> Control:
	# W13C INSTANT: Variable statt 7. return (gdlint max-returns).
	var inhalt: Control = null
	match app_id:
		Fahrdienst.TAXI, Fahrdienst.GUBER:
			var fahrt := FahrdienstApp.new()
			fahrt.gs = gs
			fahrt.dienst = app_id
			fahrt.eingestiegen.connect(func(_d: String) -> void: schliesse())
			return fahrt
		"gooberando":
			var essen := GooberandoApp.new()
			essen.gs = gs
			return essen
		"kamera":
			var kamera := PhoneKameraApp.new()
			kamera.gs = gs
			kamera.fotomodus_gewuenscht.connect(starte_fotomodus)
			return kamera
		"freunde":
			# G5/P34 (P18-Request): echtes Telefon-Layout statt eingebettetem
			# Vollbild-Screen — der Router-Weg (FriendsScreen) bleibt bestehen.
			return PhoneFriendsApp.new()
		"goobypal":
			return PhoneSocialApps.goobypal(gs, _on_pal_freund)
		InstantGoobyApp.APP_ID:
			var feed := InstantGoobyApp.new()
			feed.gs = gs
			inhalt = feed
	return inhalt


## --------------------------------------------------------------- Actions


func _on_pal_freund(freund: Dictionary) -> void:
	_leere_inhalt()
	var sheet := PhoneSocialApps.pal_sheet(self, freund)
	if sheet == null:
		return
	if sheet is GoobyPalSheet:
		(sheet as GoobyPalSheet).closed.connect(func() -> void: oeffne_app("goobypal"))
		(sheet as GoobyPalSheet).toast_requested.connect(_zeige_toast)
	_inhalt.add_child(sheet)
	ScreenShell.scale_fonts(_geraet, _m.get("f", 1.0))


## Scrim-Tap schließt das Telefon — Maus UND Touch (P53-Backdrop-Befund:
## auf Geräten ohne Maus-Emulation kam sonst kein MouseButton-Event an;
## kommen BEIDE Events an, schützt der _schliesst-Guard vor Doppelung).
func _on_scrim_input(event: InputEvent) -> void:
	var tipp := false
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		tipp = true
	elif event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed:
		tipp = true
	if tipp:
		schliesse()


## Zurück-Gesten (G7/P52): Wisch nach UNTEN = zurück (vom Grid: schließen),
## Wisch VON LINKS nach rechts IN einer App = zurück aufs Grid (wie am
## echten Telefon). Schwellwerte skalieren ×f — 90 Design-px wären auf dem
## iPhone sonst ein ~28-pt-Mini-Wisch (G1 §3).
##
## P52 R2: NUR Touch-Events (Maus kommt über die projektweite
## emulate_touch_from_mouse-Emulation an) — der alte Doppel-Pfad
## MouseMotion+ScreenDrag verbuchte jeden Wisch ZWEIMAL und halbierte
## damit real die Schwelle. Entschieden wird beim LOSLASSEN (Weg oder
## Flick), bis dahin folgt das Gerät dem Finger (_folge_mit).
func _on_geraet_input(event: InputEvent) -> void:
	if event is InputEventScreenDrag:
		var drag: InputEventScreenDrag = event
		_geste_schritt(drag.position, drag.relative, drag.velocity.y)
		return
	if event is InputEventScreenTouch:
		if (event as InputEventScreenTouch).pressed:
			# Sicherheitsnetz: hängt noch eine Alt-Geste (verlorenes
			# Release), beginnt der neue Finger sauber bei null.
			if _geste_aktiv:
				_geste_reset()
				_snap_zurueck()
		else:
			_geste_ende()


## Einen Wisch-Schritt verbuchen: beim ERSTEN Schritt entscheidet die
## Startposition, ob es ein Links-Rand-Wisch ist; danach zählen die Wege
## und das Gerät zieht mit dem Abwärts-Anteil mit (Scrim hellt auf).
func _geste_schritt(pos: Vector2, rel: Vector2, tempo_y: float) -> void:
	if _schliesst:
		return
	if not _geste_aktiv:
		_geste_aktiv = true
		_geste_von_links = (pos.x - rel.x) <= geste_rand()
		_geste_x = 0.0
		_geste_y = 0.0
		_folge_start()
	_geste_x += rel.x
	_geste_y += rel.y
	_geste_tempo_y = tempo_y
	_folge_mit(maxf(_geste_y, 0.0))


## Loslassen: über der Weg- ODER Flick-Schwelle löst die Geste aus (Grid:
## schließen — die Ausfahr-Animation übernimmt den Restschwung; App:
## federnd zurückschnappen + aufs Grid), darunter schnappt das Gerät nur
## zurück. Haptik-Tipp NUR bei Erfolg (Muster PanelSheet._zug_ende).
func _geste_ende() -> void:
	if not _geste_aktiv:
		return
	var f: float = _m.get("f", 1.0)
	var von_links := _geste_von_links and not aktive_app.is_empty() and _geste_x > geste_schwelle()
	var flick := _geste_y > 0.0 and _geste_tempo_y >= GESTE_FLICK_PXPS * f
	var runter := _geste_y > geste_schwelle() or flick
	_geste_reset()
	if von_links or runter:
		Haptics.tap(self)
		if runter and aktive_app.is_empty():
			schliesse()
			return
		_snap_zurueck()
		zurueck()
		return
	_snap_zurueck()


func _geste_reset() -> void:
	_geste_aktiv = false
	_geste_von_links = false
	_geste_x = 0.0
	_geste_y = 0.0
	_geste_tempo_y = 0.0


## ------------------------------------------- Finger-Folgen (P52 Runde 2)


## Gestenstart: laufenden Snap-Tween kappen (der Finger übernimmt); die
## Ruhelage wird NUR bei entspanntem Gerät frisch vermessen — mitten im
## Snap-back ist position.y keine Ruhelage, der gemerkte Wert bleibt.
func _folge_start() -> void:
	_kill_folge_tween()
	if _folge_offset <= 0.0:
		_folge_rest_y = _geraet.position.y


## Gerät auf Zug-Offset stellen (≥ 0, unter die Ruhelage) und den Scrim
## proportional aufhellen — bewusst OHNE Reduced-Motion-Gate: direkte
## Manipulation ist keine Animation (P53-Regel), RM greift beim Loslassen.
func _folge_mit(offset: float) -> void:
	_folge_offset = maxf(offset, 0.0)
	_geraet.position.y = _folge_rest_y + _folge_offset
	var anteil := clampf(_folge_offset / maxf(geste_schwelle(), 1.0), 0.0, 1.0)
	_scrim.modulate.a = 1.0 - ZUG_DIM_ANTEIL * anteil


## Federnd in die Ruhelage zurück (RM/Mini-Zug: sofort). tween_method hält
## _folge_offset synchron — ein Gestenstart mitten im Snap rechnet dadurch
## immer von der ECHTEN Momentanposition weiter.
func _snap_zurueck() -> void:
	if _folge_offset <= 0.5 or UiMotion.reduced(self):
		_folge_mit(0.0)
		return
	_kill_folge_tween()
	_folge_tween = create_tween()
	_folge_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_folge_tween.tween_method(_folge_mit, _folge_offset, 0.0, AcTokens.DUR_POP)


func _kill_folge_tween() -> void:
	if _folge_tween != null and _folge_tween.is_valid():
		_folge_tween.kill()
	_folge_tween = null


func _aktualisiere_status() -> void:
	if gs == null:
		return
	_muenzen.text = str(int(gs.get_value("economy.coins", 0)))
	_akku.value = float(gs.get_value("gooby.stats.energy", 100.0))


func _leere_inhalt() -> void:
	for kind in _inhalt.get_children():
		_inhalt.remove_child(kind)
		kind.queue_free()
	_aktualisiere_status()


func _icon(pfad: String) -> TextureRect:
	var rect := TextureRect.new()
	if ResourceLoader.exists(pfad):
		rect.texture = load(pfad)
	rect.custom_minimum_size = Vector2(18.0, 18.0) * float(_m.get("f", 1.0))
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	rect.self_modulate = AcTokens.INK_SOFT
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_status_icons.append(rect)
	return rect


func _zeige_toast(text: String) -> void:
	var toasts := get_tree().root.find_children("*", "ToastLayer", true, false)
	if not toasts.is_empty():
		toasts[0].show_toast(text)
