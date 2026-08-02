class_name MinigameHudTypo
extends RefCounted
## P56 „Ein-Spiel-Gefühl" — DIE Timer/Hinweis-Typografie des Minigame-Rahmens
## (PT-MG-A/B F4): Zeit-Zeile, Unterzeile (Serie/Verpasst/Breite/Punkte …) und
## Hinweis sahen je Spiel anders aus — mal Milchglas-Plate (teaParty), mal
## nackt auf dem Himmel (basketBounce), mal Winzschrift (gardenRush,
## veggieChop). Hier lebt der EINE Look: Milchglas-Plate + Theme-Tinte,
## Entwurfs-px × ui-Faktor. Reine static-Fabrik ohne Zustand — die Spiele
## behalten ihre Label-Variablen und rufen style_*/layout_*/draw_* auf.
##
## Kanon = die im Playtest als „gut lesbar" gelobte M9-Welle (tea_party,
## hide_seek, harbor_hopper): Timer 26 px, Unterzeile 17 px (INK_SOFT statt
## 0,55-blassem CaptionLabel-Default), Hinweis 15 px — alles × ui.

## DIE Milchglas-Tinte des Rahmens (vorher 4 lokale Kopien in
## mpb_garden_kit/fishing_pond_scenery/bunny_hop/bubble_pop + Inline-Werte).
const PLATE_BG := Color(1.0, 0.99, 0.94, 0.72)
## Entwurfs-Kurzkante — Basis des ui-Faktors aller HUD-Pixelmaße (M9-Muster).
const DESIGN_SHORT := 390.0
## Typo-Maße in Entwurfs-px (skalieren mit ui).
const TIMER_PX := 26.0
const SUB_PX := 17.0
const HINT_PX := 15.0
## Plate-Polster um die Ecken-Labels (Entwurfs-px, tea_party-Muster).
const PAD := Vector2(12.0, 6.0)
## Ecken-Anker von Timer/Unterzeile (Entwurfs-px, Muster aller 38 Spiele).
const TIMER_POS := Vector2(16.0, 10.0)
const SUB_POS := Vector2(16.0, 48.0)
## Lesbare Unterzeilen-Tinte — CaptionLabel-Theme wäre INK_FAINT (0,55).
const SUB_INK := AcTokens.INK_SOFT


## ui-Faktor (Kurzkante/390, 0,75–3,0) — DIE eine Formel statt je-Spiel-Kopie.
static func ui_factor(view: Vector2) -> float:
	return clampf(minf(view.x, view.y) / DESIGN_SHORT, 0.75, 3.0)


## Milchglas-Plate hinter HUD-Labels (Lesbarkeit auf Wiese/Wasser/Himmel).
static func plate() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = PLATE_BG
	box.set_corner_radius_all(16)
	return box


## Milchglas mit Fade-Faktor — für ausblendende Hinweise/Banner.
static func plate_tint(alpha: float) -> Color:
	return Color(PLATE_BG.r, PLATE_BG.g, PLATE_BG.b, PLATE_BG.a * alpha)


## Timer-Zeile: Theme-Tinte auf der Plate — Farb-/Kontur-Overrides der
## „nackten" Ära (heller Text + dicker Saum) werden aktiv abgeräumt.
static func style_timer(label: Label, ui: float) -> void:
	label.theme_type_variation = &"HeadlineLabel"
	label.add_theme_font_size_override("font_size", int(TIMER_PX * ui))
	_clear_ink_overrides(label)


## Unterzeile unterm Timer (Serie/Verpasst/Breite/Punkte …) — 17 px × ui in
## INK_SOFT statt der 15-px-INK_FAINT-Winzschrift (PT-MG-B F4).
static func style_subline(label: Label, ui: float) -> void:
	label.theme_type_variation = &"CaptionLabel"
	label.add_theme_font_size_override("font_size", int(SUB_PX * ui))
	_clear_ink_overrides(label)
	label.add_theme_color_override("font_color", SUB_INK)


## Hinweiszeile: SoftLabel mittig mit Umbruch, 15 px × ui.
static func style_hint(label: Label, ui: float) -> void:
	label.theme_type_variation = &"SoftLabel"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", int(HINT_PX * ui))
	_clear_ink_overrides(label)


## Timer oben links, Unterzeile darunter (DIE Ecken-Anker des Rahmens).
static func layout_corner(timer: Label, subline: Label, ui: float) -> void:
	timer.position = TIMER_POS * ui
	if subline != null:
		subline.position = SUB_POS * ui


## Hinweis-Box (Breite/Höhe) aus Text + Viewport — Umbruch-sicher.
static func hint_box(label: Label, view: Vector2, ui: float) -> Vector2:
	var w := minf(view.x - 32.0 * ui, 360.0 * ui)
	var font := label.get_theme_font("font")
	var font_size := label.get_theme_font_size("font_size")
	var text_size := font.get_multiline_string_size(
		label.text, HORIZONTAL_ALIGNMENT_CENTER, w, font_size
	)
	return Vector2(w, text_size.y + 6.0 * ui)


## Hinweis-Box setzen — Godot klemmt Label-Höhen gegen die Minimalhöhe der
## ALTEN Umbruch-Breite: ein frisch gebautes Autowrap-Label ist 1 px schmal,
## seine Zeichen-pro-Zeile-Minimalhöhe (>1000 px) bliebe als Riesen-Plate
## stehen (ranchParcours-Befund; Spiele mit spätem HUD-Bau kriegen keinen
## zweiten Layout-Pass). Darum: Breite zuerst, dann per Text-Reset den
## Umbruch-Cache an der NEUEN Breite neu rechnen lassen, dann die Box.
static func set_hint_size(label: Label, box: Vector2) -> void:
	label.size = Vector2(box.x, 0.0)
	var wortlaut := label.text
	label.text = ""
	label.text = wortlaut
	label.size = box


## Hinweis unten mittig — der Standard-Platz des Rahmens.
static func layout_hint_bottom(label: Label, view: Vector2, ui: float) -> void:
	var box := hint_box(label, view, ui)
	label.position = Vector2((view.x - box.x) * 0.5, view.y - box.y - 10.0 * ui)
	set_hint_size(label, box)


## Plate-Rechteck um die nicht-leeren Ecken-Labels (PUR für die Wache).
static func hud_rect(labels: Array, ui: float) -> Rect2:
	var joined := Rect2()
	var first := true
	for entry in labels:
		var label := entry as Label
		if label == null or label.text.is_empty() or not label.visible:
			continue
		var rect := Rect2(label.position, label.size)
		joined = rect if first else joined.merge(rect)
		first = false
	if first:
		return Rect2()
	joined.position -= PAD * ui
	joined.size += PAD * ui * 2.0
	return joined


## Milchglas hinter Timer + Unterzeile zeichnen (aus dem _draw des Spiels).
static func draw_hud_plate(canvas: CanvasItem, box: StyleBoxFlat, labels: Array, ui: float) -> void:
	var rect := hud_rect(labels, ui)
	if rect.size == Vector2.ZERO:
		return
	box.set_corner_radius_all(int(16.0 * ui))
	canvas.draw_style_box(box, rect)


## Milchglas hinter dem Hinweis — alpha folgt dem Hint-Fade des Spiels.
static func draw_hint_plate(
	canvas: CanvasItem, box: StyleBoxFlat, label: Label, ui: float, alpha := 1.0
) -> void:
	if label == null or alpha <= 0.0 or label.text.is_empty() or not label.visible:
		return
	box.bg_color = plate_tint(alpha)
	box.set_corner_radius_all(int(12.0 * ui))
	canvas.draw_style_box(box, Rect2(label.position - Vector2(0.0, 2.0 * ui), label.size))


## Overrides der Vor-Rahmen-Ära entfernen — die Plate braucht keinen Saum.
static func _clear_ink_overrides(label: Label) -> void:
	label.remove_theme_color_override("font_color")
	label.remove_theme_color_override("font_outline_color")
	label.remove_theme_constant_override("outline_size")
