class_name QualityProfiles
extends RefCounted
## RW-7 — Qualitätsprofile nach Doc RANCH-DLC-IDEAS-4 §4.2 (pure Tabelle).
##
## Ein Profil ist das BÜNDEL der einzelnen graphics.*-Werte; „Auto“ löst über
## `DeviceProfile.classify()` auf eines der drei Bündel auf (plus 120 Hz,
## wenn das Display es kann). Einzelregler-Änderungen markiert der Settings-
## Screen als „benutzerdefiniert“ — dann gilt kein Bündel mehr.

const NIEDRIG := {
	"scale_3d": 0.67,
	"fps": 30,
	"msaa": "aus",
	"shadows": "aus",
	"draw_distance": 0.7,
	"particles": 0.35,
	"post_fx": "aus",
}
const MITTEL := {
	"scale_3d": 0.8,
	"fps": 60,
	"msaa": "2x",
	"shadows": "niedrig",
	"draw_distance": 0.85,
	"particles": 0.65,
	"post_fx": "dezent",
}
const HOCH := {
	"scale_3d": 1.0,
	"fps": 60,
	"msaa": "2x",
	"shadows": "hoch",
	"draw_distance": 1.0,
	"particles": 1.0,
	"post_fx": "hoch",
}
## Reihenfolge fürs Herunterschalten der Notbremse (Index 0 = niedrigste).
const STUFEN: Array[String] = ["niedrig", "mittel", "hoch"]
## Virtuelle Spitzenstufe über „hoch“: das 120-Hz-Bündel für ProMotion
## (Doc §4.2, Zeile „120 Hz“). Die Notbremse fällt von hier ZUERST auf
## „hoch“@60 zurück („… sonst automatisch 60 Hz“, Doc §3.7) — ein Gerät,
## das nur das 8,33-ms-Budget reißt (Thermik, iOS-Stromsparmodus deckelt
## auf 60), verliert so nicht grundlos Schatten/Auflösung/Sichtweite.
const STUFE_HOCH_120 := "hoch120"


## Bündel zu einem Profilnamen (unbekannt → MITTEL, konservativ).
static func bundle(preset: String) -> Dictionary:
	match preset:
		"niedrig":
			return NIEDRIG.duplicate()
		"mittel":
			return MITTEL.duplicate()
		"hoch":
			return HOCH.duplicate()
		"hoch120":
			return _hoch_120()
		_:
			return MITTEL.duplicate()


## „Auto“ → konkretes Bündel aus der Geräteklasse; ProMotion-Geräte der
## Klasse „hoch“ bekommen das 120-Hz-Bündel (STUFE_HOCH_120).
static func resolve_auto(device: Dictionary) -> Dictionary:
	var klasse := String(device.get("klasse", "mittel"))
	if klasse == "hoch" and bool(device.get("supports_120", false)):
		return _hoch_120()
	return bundle(klasse)


## Nächstniedrigere Stufe für die Notbremse ("" = schon ganz unten).
static func stufe_darunter(preset: String) -> String:
	if preset == STUFE_HOCH_120:
		return "hoch"
	var idx := STUFEN.find(preset)
	if idx <= 0:
		return ""
	return STUFEN[idx - 1]


## Klassifiziert ein konkretes Bündel zurück auf einen Stufen-Namen (für die
## Notbremse, wenn „auto“ aufgelöst wurde): 120 FPS ist eindeutig die
## Spitzenstufe, sonst entscheidet gleiche Schattenqualität („mittel“ als
## konservativer Rest).
static func stufe_von(applied: Dictionary) -> String:
	if int(applied.get("fps", 0)) == 120:
		return STUFE_HOCH_120
	for name in STUFEN:
		if bundle(name)["shadows"] == applied.get("shadows", ""):
			return name
	return "mittel"


## Doc §4.2, Zeile „120 Hz“: 0,85er-Skala, Schatten wie Mittel, Sichtweite
## 0,85×, Partikel 75 %, sparsames Post-FX — das halbe Framebudget (8,33 ms)
## wird über gesenkte Nebenkosten bezahlt, nicht über die Kern-Optik.
static func _hoch_120() -> Dictionary:
	var result := HOCH.duplicate()
	result["fps"] = 120
	result["scale_3d"] = 0.85
	result["shadows"] = "niedrig"
	result["draw_distance"] = 0.85
	result["particles"] = 0.75
	result["post_fx"] = "dezent"
	return result
