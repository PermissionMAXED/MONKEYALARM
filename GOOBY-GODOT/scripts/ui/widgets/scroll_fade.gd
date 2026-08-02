class_name ScrollFade
extends MarginContainer
## G7 — Scroll-Affordance für Listen/Grids: legt weiche Fade-Kanten über
## einen ScrollContainer und zeigt sie nur, wenn es in der jeweiligen
## Richtung wirklich weitergeht. So liest sich eine angeschnittene Zeile
## als Einladung zum Scrollen statt als Layout-Fehler (User-Befund
## Garderobe/Gestalten: „letzter Eintrag hart halbiert, ohne Hinweis“).
##
## Nutzung zur Bauzeit (Scroll noch OHNE Parent):
##   var huelle := ScrollFade.um(scroll)
##   spalte.add_child(huelle)
## Der Wrapper ist ein MarginContainer: beide Kinder (Scroll + Fade-Deck)
## liegen auf demselben Rechteck, das Deck zeichnet obendrüber.
## `rand_inset()` schiebt den Scroll samt Scrollbar vom Spalten-/
## Display-Rand weg (User-Befund: „Scrollbar klebt am Bildschirmrand“).
##
## LOOP-QUESTS: alternativ als SZENEN-Node nutzbar (panel_sheet.tscn) —
## liegt das Skript auf einem Wrapper, der seinen ScrollContainer schon
## als Szenen-Kind mitbringt, adoptiert `_ready()` dieses Kind und baut
## das Fade-Deck selbst dazu (`um()` bleibt der Bauzeit-Weg).
##
## Die Kanten sind STATISCHE Affordance (kein Motion) — sie bewegen sich
## nicht von selbst, darum braucht es hier kein Reduced-Motion-Gate.

## Dicke einer Fade-Kante in Design-px (Screens skalieren mit f nach).
const KANTE := 34.0
## Ab diesem Scroll-Rest (px) gilt eine Richtung als „geht noch weiter“.
const REST_EPSILON := 1.0

var _scroll: ScrollContainer
var _kante_px := KANTE
var _oben: TextureRect
var _unten: TextureRect
var _links: TextureRect
var _rechts: TextureRect
## Farbe, in die sich der Inhalt Richtung Rand auflöst (Default Wallpaper-
## Creme; Listen IN Karten setzen die Kartenfarbe via `farbe()`).
var _fade_farbe: Color = AcTokens.BG_CREAM


## Wrapper um einen (noch elternlosen) ScrollContainer bauen. Übernimmt
## dessen Size-Flags, damit er im Layout an dieselbe Stelle rückt.
static func um(scroll: ScrollContainer) -> ScrollFade:
	var huelle := ScrollFade.new()
	huelle._scroll = scroll
	huelle.size_flags_horizontal = scroll.size_flags_horizontal
	huelle.size_flags_vertical = scroll.size_flags_vertical
	huelle.add_child(scroll)
	huelle.add_child(huelle._deck_bauen())
	return huelle


func _ready() -> void:
	if _scroll == null:
		# Szenen-Weg: ScrollContainer-Kind adoptieren + Deck nachrüsten.
		for child in get_children():
			if child is ScrollContainer:
				_scroll = child
				break
		if _scroll == null:
			return
		add_child(_deck_bauen())
	# Range.changed feuert bei max/page-Änderungen (Inhalt/Resize),
	# value_changed beim Scrollen selbst — beide halten die Kanten frisch.
	var vbar := _scroll.get_v_scroll_bar()
	vbar.value_changed.connect(_on_scroll_bewegt)
	vbar.changed.connect(_aktualisieren)
	var hbar := _scroll.get_h_scroll_bar()
	hbar.value_changed.connect(_on_scroll_bewegt)
	hbar.changed.connect(_aktualisieren)
	resized.connect(_aktualisieren)
	_aktualisieren()


## Abstand des Scrolls (und damit seiner Scrollbar) zum rechten
## Wrapper-Rand — die Bar klebt nie mehr am äußersten Display-Rand.
func rand_inset(px: int) -> void:
	add_theme_constant_override("margin_right", maxi(px, 0))


## Kanten-Dicke nachziehen (Metrik-Pass der Screens: KANTE × f).
func kanten_hoehe(px: float) -> void:
	_kante_px = maxf(px, 8.0)
	_kanten_layouten()
	_aktualisieren()


## Auflöse-Farbe der Kanten setzen (P54R: die Options-Zeile im Gestalten-
## Screen liegt IN einer AcCard — dort löst sich der Inhalt in die
## Kartenfarbe auf, nicht ins Wallpaper-Creme).
func farbe(neu: Color) -> void:
	_fade_farbe = neu
	for kante: TextureRect in [_oben, _unten, _links, _rechts]:
		if kante == null or not (kante.texture is GradientTexture2D):
			continue
		var verlauf := (kante.texture as GradientTexture2D).gradient
		verlauf.set_color(0, Color(neu, 0.0))
		verlauf.set_color(1, neu)


## P54R: Ziel-Control (z. B. die aktive Kachel) in den Ausschnitt rollen.
## `hole_ziel` wird je Versuch NEU aufgelöst (Listen werden oft neu gebaut).
## Frisch gebaute Kinder sind ggf. noch 0 px groß (Sort ausstehend), und
## spätere Layout-Nachzieh-Pässe können den Ausschnitt NACH dem Scroll noch
## verschieben (Sonde: 132 px Rest) — deshalb begrenzt nachprüfen, bis das
## Ziel wirklich im Ausschnitt steht.
func zeige(hole_ziel: Callable, versuche := 5) -> void:
	var ziel := _ziel(hole_ziel)
	if ziel == null:
		return
	if ziel.size.x <= 1.0 and ziel.size.y <= 1.0:
		if versuche > 0:
			call_deferred("zeige", hole_ziel, versuche - 1)
		return
	_scroll.ensure_control_visible(ziel)
	if versuche > 0:
		call_deferred("_zeige_pruefen", hole_ziel, versuche - 1)


## Nachkontrolle des Scroll-Ziels — Scroll/Sort greifen erst im nächsten
## Flush; ensure_control_visible ist idempotent (konvergiert, versuche-Kappe).
func _zeige_pruefen(hole_ziel: Callable, versuche: int) -> void:
	var ziel := _ziel(hole_ziel)
	if ziel == null:
		return
	var rect := ziel.get_global_rect()
	var sicht := _scroll.get_global_rect()
	var drin := true
	if _scroll.horizontal_scroll_mode != ScrollContainer.SCROLL_MODE_DISABLED:
		drin = rect.position.x >= sicht.position.x - 0.5 and rect.end.x <= sicht.end.x + 0.5
	if _scroll.vertical_scroll_mode != ScrollContainer.SCROLL_MODE_DISABLED:
		drin = drin and rect.position.y >= sicht.position.y - 0.5
		drin = drin and rect.end.y <= sicht.end.y + 0.5
	if not drin:
		zeige(hole_ziel, versuche)


func _ziel(hole_ziel: Callable) -> Control:
	if _scroll == null or not is_inside_tree() or not hole_ziel.is_valid():
		return null
	var ziel: Variant = hole_ziel.call()
	if ziel is Control and (ziel as Control).is_inside_tree():
		return ziel as Control
	return null


## Test-Introspektion: lädt die Unten-Kante gerade zum Weiterscrollen ein?
func unten_aktiv() -> bool:
	return _unten != null and _unten.visible


## Test-Introspektion: lädt die Oben-Kante (zurückscrollen) gerade ein?
func oben_aktiv() -> bool:
	return _oben != null and _oben.visible


## Test-Introspektion: lädt die Rechts-Kante (h-Scroll) gerade ein?
func rechts_aktiv() -> bool:
	return _rechts != null and _rechts.visible


func _on_scroll_bewegt(_wert: float) -> void:
	_aktualisieren()


## Kanten nur zeigen, wenn es in der Richtung wirklich weitergeht.
func _aktualisieren() -> void:
	if _scroll == null or _unten == null:
		return
	var vbar := _scroll.get_v_scroll_bar()
	var v_aktiv := _scroll.vertical_scroll_mode != ScrollContainer.SCROLL_MODE_DISABLED
	_unten.visible = v_aktiv and vbar.max_value - vbar.page - vbar.value > REST_EPSILON
	_oben.visible = v_aktiv and vbar.value > REST_EPSILON
	var hbar := _scroll.get_h_scroll_bar()
	var h_aktiv := _scroll.horizontal_scroll_mode != ScrollContainer.SCROLL_MODE_DISABLED
	_rechts.visible = h_aktiv and hbar.max_value - hbar.page - hbar.value > REST_EPSILON
	_links.visible = h_aktiv and hbar.value > REST_EPSILON


## Deck über dem Scroll (MarginContainer legt beide aufs selbe Rechteck).
func _deck_bauen() -> Control:
	var deck := Control.new()
	deck.name = "FadeDeck"
	deck.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_oben = _kante_bauen("FadeOben", Vector2(0.0, 1.0), Vector2.ZERO)
	_unten = _kante_bauen("FadeUnten", Vector2.ZERO, Vector2(0.0, 1.0))
	_links = _kante_bauen("FadeLinks", Vector2(1.0, 0.0), Vector2.ZERO)
	_rechts = _kante_bauen("FadeRechts", Vector2.ZERO, Vector2(1.0, 0.0))
	for kante: TextureRect in [_oben, _unten, _links, _rechts]:
		deck.add_child(kante)
	_kanten_layouten()
	return deck


## Eine Kante: Verlauf von durchsichtig (von) zur Wandfarbe (nach) — der
## Inhalt „löst sich“ Richtung Rand im Wallpaper-Creme auf.
func _kante_bauen(kanten_name: String, von: Vector2, nach: Vector2) -> TextureRect:
	var kante := TextureRect.new()
	kante.name = kanten_name
	kante.mouse_filter = Control.MOUSE_FILTER_IGNORE
	kante.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	kante.stretch_mode = TextureRect.STRETCH_SCALE
	kante.visible = false
	var verlauf := Gradient.new()
	verlauf.set_color(0, Color(_fade_farbe, 0.0))
	verlauf.set_color(1, _fade_farbe)
	var textur := GradientTexture2D.new()
	textur.gradient = verlauf
	textur.fill_from = von
	textur.fill_to = nach
	kante.texture = textur
	return kante


func _kanten_layouten() -> void:
	if _oben == null:
		return
	_oben.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_oben.offset_bottom = _kante_px
	_unten.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_unten.offset_top = -_kante_px
	_links.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	_links.offset_right = _kante_px
	_rechts.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	_rechts.offset_left = -_kante_px
