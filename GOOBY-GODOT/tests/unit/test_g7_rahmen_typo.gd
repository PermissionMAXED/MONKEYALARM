extends TestCase
## G7-P56 EIN-SPIEL-GEFÜHL, Timer/Hinweis-Typografie (PT-MG-A/B F4) — Wächter
## für den EINEN HUD-Typo-Rahmen (MinigameHudTypo):
## (1) Kanon-Wache: Milchglas-Tinte, ui-Faktor-Klemme und die Typo-Maße der
##     gelobten M9-Welle (Timer 26 / Unterzeile 17 / Hinweis 15 px × ui).
## (2) Style-Vertrag: style_* setzt Variation + Größe, räumt die hellen
##     Saum-Overrides der plattenlosen Ära ab, Unterzeile in INK_SOFT
##     statt 0,55-blassem CaptionLabel-Default (die „Winzschrift" von F4).
## (3) hud_rect: Plate umschließt nur NICHT-leere Labels (leere Serie/
##     Unterzeile bläht die Plate nicht auf).
## (4) Quell-Wache: alle 7 F4-Spiele (basketBounce/burgerBuild/gardenRush +
##     veggieChop/pancakeTower/ranchParcours/pipeFlow) ziehen Typo UND
##     Plates aus dem Rahmen; die alten lokalen Milchglas-Fabriken
##     (mpb_garden_kit, fishing_pond_scenery, bunny_hop, bubble_pop)
##     delegieren an MinigameHudTypo.plate() statt eigene Tinte zu mischen.

const GAMES_DIR := "res://scripts/minigames/games/"
## Die 7 Spiele aus PT-MG-A F4 + PT-MG-B F4 (Fortschreibung).
const F4_SPIELE: Array[String] = [
	"basket_bounce/basket_bounce.gd",
	"burger_build/burger_build.gd",
	"garden_rush/garden_rush.gd",
	"veggie_chop/veggie_chop.gd",
	"pancake_tower/pancake_tower.gd",
	"ranch_parcours/parcours_game.gd",
	"pipe_flow/pipe_flow.gd",
]
## Die ehemals lokalen Milchglas-Fabriken — jetzt reine Delegationen.
const PLATE_FABRIKEN: Array[String] = [
	"carrot_catch/mpb_garden_kit.gd",
	"fishing_pond/fishing_pond_scenery.gd",
	"bunny_hop/bunny_hop.gd",
	"bubble_pop/bubble_pop.gd",
]


## (1) Kanon-Wache: DIE Werte des Rahmens.
func test_kanon_werte() -> void:
	assert_eq(MinigameHudTypo.PLATE_BG, Color(1.0, 0.99, 0.94, 0.72), "Milchglas-Tinte")
	var box := MinigameHudTypo.plate()
	assert_eq(box.bg_color, MinigameHudTypo.PLATE_BG, "plate() trägt die Rahmen-Tinte")
	assert_eq(box.corner_radius_top_left, 16, "plate() Radius 16")
	assert_almost(MinigameHudTypo.ui_factor(Vector2(390.0, 844.0)), 1.0, 1e-6, "Leitformat = 1,0")
	assert_almost(MinigameHudTypo.ui_factor(Vector2(80.0, 80.0)), 0.75, 1e-6, "Klemme unten")
	assert_almost(MinigameHudTypo.ui_factor(Vector2(4000.0, 4000.0)), 3.0, 1e-6, "Klemme oben")
	var tint := MinigameHudTypo.plate_tint(0.5)
	assert_almost(tint.a, 0.72 * 0.5, 1e-6, "plate_tint skaliert nur das Alpha")
	assert_almost(tint.r, 1.0, 1e-6, "plate_tint lässt die Farbe stehen")


## (2) Style-Vertrag: Variation + Größe je Rolle, Alt-Overrides fliegen raus.
func test_style_vertrag() -> void:
	var label := Label.new()
	# Alt-Look der plattenlosen Ära — der Rahmen muss ihn abräumen.
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_color_override("font_outline_color", Color.BLACK)
	label.add_theme_constant_override("outline_size", 7)
	MinigameHudTypo.style_timer(label, 2.0)
	assert_eq(label.theme_type_variation, &"HeadlineLabel", "Timer = HeadlineLabel")
	assert_eq(label.get_theme_font_size("font_size"), 52, "Timer 26 px × ui")
	assert_false(label.has_theme_color_override("font_color"), "heller Saum-Override weg")
	assert_false(label.has_theme_constant_override("outline_size"), "Kontur-Override weg")
	MinigameHudTypo.style_subline(label, 1.0)
	assert_eq(label.theme_type_variation, &"CaptionLabel", "Unterzeile = CaptionLabel")
	assert_eq(
		label.get_theme_font_size("font_size"), 17, "Unterzeile 17 px × ui (keine 15er-Winzschrift)"
	)
	assert_eq(
		label.get_theme_color("font_color"),
		AcTokens.INK_SOFT,
		"Unterzeile INK_SOFT statt INK_FAINT"
	)
	MinigameHudTypo.style_hint(label, 1.0)
	assert_eq(label.theme_type_variation, &"SoftLabel", "Hinweis = SoftLabel")
	assert_eq(label.get_theme_font_size("font_size"), 15, "Hinweis 15 px × ui")
	assert_eq(label.horizontal_alignment, HORIZONTAL_ALIGNMENT_CENTER, "Hinweis mittig")
	assert_eq(label.autowrap_mode, TextServer.AUTOWRAP_WORD_SMART, "Hinweis bricht um")
	label.free()


## (2b) set_hint_size: Godot klemmt Label-Höhen gegen die Minimalhöhe der
## ALTEN Umbruch-Breite — ein frisch gebautes Autowrap-Label ist 1 px schmal,
## seine Zeichen-pro-Zeile-Minimalhöhe (>1000 px) bliebe bei einer Ein-Schritt-
## Zuweisung als Riesen-Plate stehen (ranchParcours-Befund). Breite zuerst!
func test_set_hint_size_entkommt_der_altbreiten_klemme() -> void:
	var label := Label.new()
	label.text = "Galopp halten, am Hindernis springen!"
	MinigameHudTypo.style_hint(label, 1.0)
	assert_true(label.size.x < 2.0, "frisches Autowrap-Label startet 1 px schmal")
	var box := MinigameHudTypo.hint_box(label, Vector2(390.0, 844.0), 1.0)
	assert_true(box.y < 100.0, "gemessene Hinweis-Box bleibt kompakt (kein 1-px-Umbruch)")
	MinigameHudTypo.set_hint_size(label, box)
	assert_almost(label.size.x, box.x, 1e-4, "set_hint_size macht die Box-Breite wirksam")
	assert_true(
		label.size.y < 100.0,
		"Höhe folgt der NEUEN Breite — nicht der 1-px-Riesenminimalhöhe (>1000 px)"
	)
	label.free()


## (3) hud_rect: Plate umschließt Timer + NICHT-leere Unterzeile mit Polster.
## Erwartungen aus den ECHTEN Label-Größen gerechnet (Labels erzwingen ihre
## Font-Mindesthöhe — Fixwerte wären an Font-Metriken gekoppelt).
func test_hud_rect_umschliesst_nur_gefuellte_labels() -> void:
	var timer := Label.new()
	timer.text = "0:42"
	timer.position = Vector2(16.0, 10.0)
	timer.size = Vector2(80.0, 34.0)
	var sub := Label.new()
	sub.text = ""
	sub.position = Vector2(16.0, 48.0)
	sub.size = Vector2(120.0, 20.0)
	var nur_timer := MinigameHudTypo.hud_rect([timer, sub], 1.0)
	assert_eq(nur_timer.position, timer.position - Vector2(12.0, 6.0), "Polster 12/6 um den Timer")
	assert_eq(
		nur_timer.size, timer.size + Vector2(24.0, 12.0), "leere Unterzeile bläht die Plate nicht"
	)
	sub.text = "Serie: 3"
	var beide := MinigameHudTypo.hud_rect([timer, sub], 1.0)
	var breite := maxf(timer.position.x + timer.size.x, sub.position.x + sub.size.x) - 16.0
	var hoehe := sub.position.y + sub.size.y - timer.position.y
	assert_almost(beide.size.x, breite + 24.0, 1e-4, "Plate umschließt die breitere Zeile")
	assert_almost(beide.size.y, hoehe + 12.0, 1e-4, "gefüllte Unterzeile wächst in die Plate")
	assert_eq(MinigameHudTypo.hud_rect([], 1.0), Rect2(), "ohne Labels keine Plate")
	timer.free()
	sub.free()


## (4a) Quell-Wache: die 7 F4-Spiele ziehen Typo + Plates aus dem Rahmen.
func test_f4_spiele_nutzen_den_rahmen() -> void:
	for rel: String in F4_SPIELE:
		var src := _lies(GAMES_DIR + rel)
		assert_true(
			src.contains("MinigameHudTypo.style_timer"), "%s: Timer-Typo aus dem Rahmen" % rel
		)
		assert_true(
			src.contains("MinigameHudTypo.style_hint"), "%s: Hinweis-Typo aus dem Rahmen" % rel
		)
		assert_true(
			src.contains("MinigameHudTypo.draw_hud_plate"), "%s: Milchglas hinterm Timer" % rel
		)
		assert_true(
			src.contains("MinigameHudTypo.draw_hint_plate"), "%s: Milchglas hinterm Hinweis" % rel
		)


## (4b) Quell-Wache: keine lokale Milchglas-Tinte mehr in den Fabriken.
func test_plate_fabriken_delegieren() -> void:
	for rel: String in PLATE_FABRIKEN:
		var src := _lies(GAMES_DIR + rel)
		assert_true(src.contains("MinigameHudTypo.plate()"), "%s: delegiert an den Rahmen" % rel)
		assert_false(
			src.contains("Color(1.0, 0.99, 0.94, 0.72)"),
			"%s: keine eigene Milchglas-Tinte mehr" % rel
		)


func _lies(pfad: String) -> String:
	var file := FileAccess.open(pfad, FileAccess.READ)
	return file.get_as_text() if file != null else ""
