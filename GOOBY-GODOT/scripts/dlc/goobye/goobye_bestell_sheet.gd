class_name GoobyeBestellSheet
extends VBoxContainer
## Großmarkt-Bestell-Sheet des „Goo und Bye“ (G5/P24 Welle B, §4.1/§2.5):
## EIN Blatt, alle Katalog-Waren als ±-Stepper-Zeilen (Daumenzone, Touch-
## Floor), darunter die LEBENDE Summen-Zeile und der Bestellen-Knopf.
## Rechnen und Buchen macht komplett GoobyeGrossmarkt (pure) — das Sheet
## ist reine Anzeige nach dem MarktStandSheet-Muster. Der Staffelpreis
## (ab N Stück einer Ware −Rabatt) steht als Hinweis-Zeile drin und wird
## in der Summen-Zeile einfach WAHR (die Position wird billiger).
##
## CI-Split: eigener Baustein statt weiterer laden_scene-Zeilen
## (max-file-lines-Wache) — die Szene hängt das Sheet nur ein und hört
## auf `bestellt` (lokale Lager-Kopie nachziehen + Toast).

signal bestellt(zettel: Dictionary)

## Breite der Mengen-Anzeige zwischen den ±-Steppern (Design-px).
const MENGE_BREITE := 44.0

var gs: Object

var _korb: Dictionary = {}
var _mengen_labels: Dictionary = {}
var _summe_label: Label
var _hinweis_label: Label
var _bestellen_knopf: Button


func _ready() -> void:
	add_theme_constant_override("separation", 8)
	_caption(I18nService.t("dlc_goobye.grossmarkt.hinweis"))
	_caption(
		(
			I18nService
			. t(
				"dlc_goobye.grossmarkt.staffel",
				{
					"ab": GoobyeKatalog.staffel_ab(),
					"rabatt": roundi(GoobyeKatalog.staffel_rabatt() * 100.0),
				}
			)
		)
	)
	for ware: Dictionary in GoobyeKatalog.waren():
		_baue_zeile(ware)
	_summe_label = Label.new()
	_summe_label.name = "BestellSumme"
	_summe_label.theme_type_variation = &"HeadlineLabel"
	_summe_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_summe_label)
	_hinweis_label = _caption("")
	_hinweis_label.name = "BestellHinweis"
	_hinweis_label.visible = false
	_bestellen_knopf = SquishButton.new()
	_bestellen_knopf.name = "Bestellen"
	_bestellen_knopf.theme_type_variation = &"BtnLeaf"
	_bestellen_knopf.text = I18nService.t("dlc_goobye.grossmarkt.bestellen")
	_bestellen_knopf.focus_mode = Control.FOCUS_NONE
	_bestellen_knopf.custom_minimum_size = Vector2(0.0, AcTokens.TOUCH_FLOOR)
	_bestellen_knopf.pressed.connect(_bestellen)
	add_child(_bestellen_knopf)
	_summe_aktualisieren()


## Eine Waren-Zeile: Name + Einkaufspreis links, −/Menge/+ rechts.
func _baue_zeile(ware: Dictionary) -> void:
	var id := str(ware["id"])
	var zeile := HBoxContainer.new()
	zeile.add_theme_constant_override("separation", 8)
	add_child(zeile)
	var text := Label.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.text = (
		I18nService
		. t(
			"dlc_goobye.grossmarkt.zeile",
			{
				"name": I18nService.t(str(ware.get("name_key", ""))),
				"preis": GoobyePreis.einkaufspreis(ware),
			}
		)
	)
	zeile.add_child(text)
	zeile.add_child(_stepper_knopf("Minus_" + id, "−", id, -1))
	var menge := Label.new()
	menge.name = "Menge_" + id
	menge.text = "0"
	menge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menge.custom_minimum_size = Vector2(MENGE_BREITE, 0.0)
	zeile.add_child(menge)
	_mengen_labels[id] = menge
	zeile.add_child(_stepper_knopf("Plus_" + id, "+", id, 1))


func _stepper_knopf(knopf_name: String, text: String, ware_id: String, delta: int) -> Button:
	var knopf := SquishButton.new()
	knopf.name = knopf_name
	knopf.theme_type_variation = &"BtnGhost"
	knopf.text = text
	knopf.focus_mode = Control.FOCUS_NONE
	knopf.custom_minimum_size = Vector2(AcTokens.TOUCH_FLOOR, AcTokens.TOUCH_FLOOR)
	knopf.pressed.connect(_menge_tippen.bind(ware_id, delta))
	return knopf


## ±-Tap: Zettel-Menge ändern (die Klemme wohnt in GoobyeGrossmarkt),
## Anzeige nachziehen. Am Anschlag gibt es nur den Fehl-Ton.
func _menge_tippen(ware_id: String, delta: int) -> void:
	var vorher := int(_korb.get(ware_id, 0))
	var neu := GoobyeGrossmarkt.menge_aendern(_korb, ware_id, delta)
	if neu == vorher:
		AudioDirector.try_play(self, "ui_error")
		return
	AudioDirector.try_play(self, "ui_chip" if delta > 0 else "ui_back")
	var label: Label = _mengen_labels.get(ware_id)
	if label != null:
		label.text = str(neu)
		UiMotion.bounce(label)
	_hinweis_label.visible = false
	_summe_aktualisieren()


func _bestellen() -> void:
	var zettel := GoobyeGrossmarkt.bestellung(_korb)
	match GoobyeGrossmarkt.bestellen(gs, _korb):
		GoobyeGrossmarkt.RESULT_OK:
			AudioDirector.try_play(self, "ui_buy")
			Haptics.success(self)
			_korb = {}
			for label: Label in _mengen_labels.values():
				label.text = "0"
			_hinweis_label.visible = false
			_summe_aktualisieren()
			bestellt.emit(zettel)
		GoobyeGrossmarkt.RESULT_LEER:
			AudioDirector.try_play(self, "ui_error")
			_zeige_hinweis(I18nService.t("dlc_goobye.grossmarkt.leer"))
		GoobyeGrossmarkt.RESULT_BROKE:
			AudioDirector.try_play(self, "ui_error")
			_zeige_hinweis(I18nService.t("dlc_goobye.grossmarkt.zu_teuer"))


func _summe_aktualisieren() -> void:
	var zettel := GoobyeGrossmarkt.bestellung(_korb)
	_summe_label.text = (I18nService.t(
		"dlc_goobye.grossmarkt.summe",
		{"stueck": int(zettel["stueck"]), "summe": int(zettel["summe"])}
	))


func _zeige_hinweis(text: String) -> void:
	_hinweis_label.text = text
	_hinweis_label.visible = true
	UiMotion.bounce(_hinweis_label)


func _caption(text: String) -> Label:
	var label := Label.new()
	label.theme_type_variation = &"CaptionLabel"
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(label)
	return label
