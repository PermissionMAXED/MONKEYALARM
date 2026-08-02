class_name GoobyePreisSheet
extends VBoxContainer
## Preis-Schieber-Sheet des „Goo und Bye“ (G5/P24 Welle B, §4.4/§2.5):
## EIN Schieber pro Warengruppe (±Spanne um den Richtwert, Schritt 5 %),
## dazu die lebende Beispiel-Zeile (erste Ware der Gruppe: „Möhre: 4 statt
## 5“) und der „empfohlener Preis“-Knopf als guter Default („Einfach
## führen“, §2.5). Jede Schieber-Bewegung speichert SOFORT
## (GoobyeState.preis_setzen) — der nächste Markttag rechnet damit, die
## Szene reicht die Faktoren beim Öffnen durch (Signal `geaendert`).
## Form+Farbe-Regel §2.5: jede Zeile trägt Gruppen-NAME + Farb-Chip.

signal geaendert

const SLIDER_BREITE := 150.0
const CHIP_GROESSE := 18.0
const SCHRITT := 0.05

var gs: Object

var _wert_labels: Dictionary = {}
var _beispiel_labels: Dictionary = {}
var _slider: Dictionary = {}


func _ready() -> void:
	add_theme_constant_override("separation", 8)
	var hinweis := Label.new()
	hinweis.theme_type_variation = &"CaptionLabel"
	hinweis.text = I18nService.t(
		"dlc_goobye.preise.hinweis", {"spanne": roundi(GoobyeKatalog.preis_spanne() * 100.0)}
	)
	hinweis.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(hinweis)
	var empfohlen := SquishButton.new()
	empfohlen.name = "PreisEmpfohlen"
	empfohlen.theme_type_variation = &"BtnTeal"
	empfohlen.text = I18nService.t("dlc_goobye.preise.empfohlen")
	empfohlen.focus_mode = Control.FOCUS_NONE
	empfohlen.custom_minimum_size = Vector2(0.0, AcTokens.TOUCH_FLOOR)
	empfohlen.pressed.connect(_alle_empfohlen)
	add_child(empfohlen)
	var faktoren := GoobyeState.preise_von(gs)
	for gruppe: Dictionary in GoobyeKatalog.gruppen():
		_baue_zeile(gruppe, float(faktoren.get(str(gruppe["id"]), 1.0)))


## Gruppen-Zeile: Farb-Chip + Name/Wert + Beispiel links, Schieber rechts.
func _baue_zeile(gruppe: Dictionary, faktor: float) -> void:
	var id := str(gruppe["id"])
	var zeile := HBoxContainer.new()
	zeile.add_theme_constant_override("separation", 8)
	add_child(zeile)
	var chip := ColorRect.new()
	chip.color = Color(str(gruppe.get("farbe", "#CCCCCC")))
	chip.custom_minimum_size = Vector2(CHIP_GROESSE, CHIP_GROESSE)
	chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	zeile.add_child(chip)
	var texte := VBoxContainer.new()
	texte.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	zeile.add_child(texte)
	var wert := Label.new()
	wert.name = "PreisWert_" + id
	wert.text = _wert_text(str(gruppe.get("name_key", "")), faktor)
	texte.add_child(wert)
	_wert_labels[id] = wert
	var beispiel := Label.new()
	beispiel.name = "PreisBeispiel_" + id
	beispiel.theme_type_variation = &"CaptionLabel"
	beispiel.text = _beispiel_text(id, faktor)
	texte.add_child(beispiel)
	_beispiel_labels[id] = beispiel
	var spanne := GoobyeKatalog.preis_spanne()
	var slider := HSlider.new()
	slider.name = "PreisSlider_" + id
	slider.min_value = 1.0 - spanne
	slider.max_value = 1.0 + spanne
	slider.step = SCHRITT
	slider.value = faktor
	slider.custom_minimum_size = Vector2(SLIDER_BREITE, AcTokens.TOUCH_FLOOR)
	slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	slider.focus_mode = Control.FOCUS_NONE
	slider.value_changed.connect(_schieber_bewegt.bind(id))
	zeile.add_child(slider)
	_slider[id] = slider


## Schieber-Bewegung: sofort speichern (klemmt selbst), Anzeige nachziehen.
func _schieber_bewegt(wert: float, gruppe_id: String) -> void:
	GoobyeState.preis_setzen(gs, gruppe_id, wert)
	AudioDirector.try_play(self, "ui_chip")
	_zeile_aktualisieren(gruppe_id)
	geaendert.emit()


## „Empfohlener Preis“: alle Gruppen zurück auf den Richtwert (EIN Tap).
func _alle_empfohlen() -> void:
	GoobyeState.preise_zuruecksetzen(gs)
	AudioDirector.try_play(self, "ui_confirm")
	Haptics.success(self)
	for id: String in _slider:
		(_slider[id] as HSlider).set_value_no_signal(1.0)
		_zeile_aktualisieren(id)
	geaendert.emit()


func _zeile_aktualisieren(gruppe_id: String) -> void:
	var faktor := float(GoobyeState.preise_von(gs).get(gruppe_id, 1.0))
	var gruppe := GoobyeKatalog.gruppe(gruppe_id)
	var wert: Label = _wert_labels.get(gruppe_id)
	if wert != null:
		wert.text = _wert_text(str(gruppe.get("name_key", "")), faktor)
	var beispiel: Label = _beispiel_labels.get(gruppe_id)
	if beispiel != null:
		beispiel.text = _beispiel_text(gruppe_id, faktor)


## Anzeige „Gemüse · Richtwert“ bzw. „Gemüse · −10 %“ (Vorzeichen im Code,
## das Prozent-Format kommt aus den Strings).
func _wert_text(name_key: String, faktor: float) -> String:
	var gruppen_name := I18nService.t(name_key)
	var prozent := roundi((faktor - 1.0) * 100.0)
	if prozent == 0:
		return I18nService.t("dlc_goobye.preise.richtwert", {"name": gruppen_name})
	var wert := ("+%d" % prozent) if prozent > 0 else ("−%d" % -prozent)
	return I18nService.t("dlc_goobye.preise.prozent", {"name": gruppen_name, "wert": wert})


## Beispiel-Zeile: die erste Ware der Gruppe rechnet den Schieber vor.
func _beispiel_text(gruppe_id: String, faktor: float) -> String:
	var waren := GoobyeKatalog.waren_der_gruppe(gruppe_id)
	if waren.is_empty():
		return ""
	var ware: Dictionary = waren[0]
	return (
		I18nService
		. t(
			"dlc_goobye.preise.beispiel",
			{
				"name": I18nService.t(str(ware.get("name_key", ""))),
				"preis": GoobyePreis.verkaufspreis(ware, faktor),
				"richtwert": GoobyePreis.empfohlener_preis(ware),
			}
		)
	)
