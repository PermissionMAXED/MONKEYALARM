class_name SettingsLogik
extends RefCounted
## LOOP-SETTINGS — Klarheits-Logik des Settings-Screens, als pure Statik
## headless testbar (Muster DlcSektion: eigene Datei, damit
## settings_screen.gd unter dem gdlint-1000-Zeilen-Limit bleibt):
## (1) Qualitäts-Label: „Auto“ zeigt die AUFGELÖSTE Stufe („Auto (Hoch)“),
##     statt den Spieler raten zu lassen, was sein Gerät bekommt.
## (2) Haptik-Abgleich: Hauptschalter (game.haptik, Spiel-Sektion) und
##     Stärke-Stufe (controls.haptics, Steuerung) dürfen einander nie
##     widersprechen — AN heißt spürbar an, „Aus“ spiegelt den Schalter.

## Stufen-Name → Anzeige-Key. "hoch120" ist die ProMotion-Spitzenstufe
## (QualityProfiles.STUFE_HOCH_120 — Wache prüft die Kopplung); unbekannte
## Stufen liefern "" und der Picker zeigt schlicht "Auto".
const STUFEN_KEYS := {
	"niedrig": "settings.qualitaet_niedrig",
	"mittel": "settings.qualitaet_mittel",
	"hoch": "settings.qualitaet_hoch",
	"hoch120": "settings.qualitaet_hoch120",
}


## PURE: Anzeige-Key zu einer aufgelösten Stufe ("" = unbekannt).
static func stufe_label_key(stufe: String) -> String:
	return str(STUFEN_KEYS.get(stufe, ""))


## PURE: Welche Stufe zeigt „Auto“ an? Läuft das Auto-Profil, zählt das LIVE
## wirksame Bündel (nach Boot-Auflösung UND Notbremse — ehrliche Anzeige);
## sonst die frische Geräte-Klassifikation (was Auto WÄHLEN würde).
static func auto_stufe(preset: String, applied: Dictionary, device_facts: Dictionary) -> String:
	if preset == "auto" and not applied.is_empty():
		return QualityProfiles.stufe_von(applied)
	return QualityProfiles.stufe_von(
		QualityProfiles.resolve_auto(DeviceProfile.classify(device_facts))
	)


## Fertiges Picker-Label für den „Auto“-Eintrag (I18n-komponiert): holt das
## live wirksame Bündel vom Quality-Autoload (falls vorhanden) und fällt
## sonst auf die pure Geräte-Klassifikation zurück.
static func auto_label(screen: Node, preset: String) -> String:
	var applied: Dictionary = {}
	var quality := screen.get_node_or_null("/root/Quality")
	if quality != null and quality.has_method("applied_bundle"):
		applied = quality.applied_bundle()
	var key := stufe_label_key(auto_stufe(preset, applied, DeviceProfile.snapshot()))
	if key.is_empty():
		return I18nService.t("settings.qualitaet_auto")
	return I18nService.t("settings.qualitaet_auto_live", {"stufe": I18nService.t(key)})


## PURE: Folge-Schreibungen nach einer Haptik-Änderung, damit beide Zeilen
## immer dieselbe Geschichte erzählen. `key` = gerade geänderter Pfad,
## `wert` = sein neuer Wert, `andere_seite` = aktueller Wert der jeweils
## anderen Zeile. Hauptschalter AN bei Alt-Stufe „aus“ → Stufe zurück auf
## „normal“ (AN wäre sonst still wirkungslos, Haptics.is_enabled bliebe
## false); Stufe „aus“ gewählt bei Schalter an → Schalter aus (der Toggle
## zeigt nie AN, während nichts vibriert).
static func haptik_folgen(key: String, wert: Variant, andere_seite: Variant) -> Dictionary:
	if key == "game.haptik" and bool(wert) and str(andere_seite) == "aus":
		return {"controls.haptics": "normal"}
	if key == "controls.haptics" and str(wert) == "aus" and bool(andere_seite):
		return {"game.haptik": false}
	return {}
