extends RefCounted
## P54R/CI-Split (gdlint max-file-lines, Muster mini_golf_feel): die reinen
## Bau-Helfer der Options-Zeile des Gestalten-Screens — Options-Kacheln und
## Farb-Swatches als purer Fabrik-Code. Zustand kommt als Parameter herein,
## das Drücken verdrahtet der Screen (pressed.connect an der Call-Site).
## Einbindung per `preload` (kein class_name — vermeidet den
## global_script_class_cache-Import-Schritt, s. AGENTS.md Import-Gotcha).


## Options-Kachel: Vorschau-Icon oben, Titel + Preis/Besitz darunter.
## `aktiv` = aktuell angewandt (Pink-Rahmen), `pending` = vorgemerkte
## Anprobe (Gold-Rahmen), `schrift_px` folgt dem Kachel-Deckel (_tile_f).
static func kachel(
	gs: Object,
	art: String,
	option: Dictionary,
	aktiv: bool,
	pending: bool,
	farb_id: String,
	tile: Vector2,
	schrift_px: int
) -> Button:
	var id := str(option["id"])
	var ding := SquishButton.new()
	ding.name = "Option_%s" % id
	ding.custom_minimum_size = tile
	ding.icon = CustomizeIcons.option_preview(art, id, farb_id)
	ding.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ding.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	# G7-Leitformat-Fix: expand_icon=true — das fixe 96-px-Icon sprengte
	# sonst den _tile_f-Deckel (Options-Zeile fraß im flachen Querformat
	# 221 statt ~150 px Höhe und drückte die Aktionen unter den Canvas).
	ding.expand_icon = true
	# Das Theme tönt Button-Icons dunkelbraun (INK) — die Muster-Vorschau
	# muss aber in Originalfarben erscheinen.
	for zustand: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		ding.add_theme_color_override(zustand, Color.WHITE)
	ding.add_theme_color_override("icon_focus_color", Color.WHITE)
	var gekauft := HouseStyleState.ist_gekauft(gs, art, id)
	var status := I18nService.t("customize.im_besitz")
	if not gekauft:
		status = I18nService.t("customize.preis", {"n": int(option.get("preis", 0))})
	var titel := CustomizeCatalog.display_name(option, I18nService.get_locale())
	ding.text = "%s\n%s" % [titel, status]
	# Kachel-Schrift folgt dem KACHEL-Deckel (_tile_f), nicht dem globalen
	# f — sonst hebelt der Text den gedeckelten Platz wieder aus (s. o.).
	ding.set_meta(ScreenShell.META_FONT_SKIP, true)
	ding.add_theme_font_size_override("font_size", schrift_px)
	var box := StyleBoxFlat.new()
	box.bg_color = Color.WHITE if gekauft else Color("#F3EDE3")
	box.set_corner_radius_all(AcTokens.RADIUS_ROW)
	box.set_border_width_all(3 if aktiv or pending else 1)
	box.border_color = AcTokens.PINK if aktiv else AcTokens.OUTLINE_SOFT
	if pending:
		box.border_color = AcTokens.GOLD
	box.set_content_margin_all(8)
	for stil: String in ["normal", "hover", "pressed", "focus"]:
		ding.add_theme_stylebox_override(stil, box)
	return ding


## Palette-Swatch: Farbfläche mit Rahmen; der gewählte deutlich (dicker
## Rahmen + weicher Pink-Schein). `mindest` = physischer Touch-Floor.
static func swatch(farb_id: String, aktiv: bool, mindest: float) -> Button:
	var ding := SquishButton.new()
	ding.name = "Farbe_%s" % farb_id
	# FB3: Swatches halten den PHYSISCHEN Touch-Floor (waren 36 Design-px).
	ding.custom_minimum_size = Vector2.ONE * mindest
	ding.tooltip_text = I18nService.t("customize.farbe.%s" % farb_id)
	var box := StyleBoxFlat.new()
	box.bg_color = CustomizeMaterials.farbe(farb_id)
	box.set_corner_radius_all(AcTokens.RADIUS_ROW)
	box.set_border_width_all(4 if aktiv else 1)
	box.border_color = AcTokens.PINK if aktiv else AcTokens.OUTLINE_SOFT
	if aktiv:
		box.shadow_color = Color(AcTokens.PINK, 0.35)
		box.shadow_size = 4
	for stil: String in ["normal", "hover", "pressed"]:
		ding.add_theme_stylebox_override(stil, box)
	return ding
