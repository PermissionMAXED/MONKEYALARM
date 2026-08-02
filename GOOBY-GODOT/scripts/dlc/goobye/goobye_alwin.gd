class_name GoobyeAlwin
extends RefCounted
## Onkel Alwins Stammkunden-Vertrag (Doc §6.3) als PURE Daten-Sicht — ohne
## Nodes, ohne Uhr, ohne OS-Zufall (AGENTS-Regel: Zeit/Zufall injizieren).
## Zwei Aufgaben: (1) die SICHTBARE Tagesroutine (5 Schritte mit Uhrzeit ab
## Ladenöffnung 8 Uhr — Alwin kommt 9:00, prüft, poliert, kauft GENAU eine
## Möhre, geht), (2) die Gag-Rotation fürs Antippen: (Tages-Seed, Tipp-Nr.)
## → String-Key, deterministisch gemischt und OHNE Wiederholung, bis alle
## GAG_ANZAHL Sprüche einmal dran waren (dann beginnt der Zyklus neu).

## Öffnungszeit 8–20 Uhr (§2.2): Minute 0 der Tagesachse = 8:00 Uhr.
const OEFFNUNG_STUNDE := 8

## Tagesroutine als Daten: id + Minuten-Offset ab Alwins Ankunft (9:00).
## Die Reihenfolge IST die Choreo der Laden-Szene (betritt → stöbert →
## poliert → kassiert → geht).
const ROUTINE: Array = [
	{"id": "ankunft", "offset": 0},
	{"id": "kennerblick", "offset": 1},
	{"id": "polieren", "offset": 2},
	{"id": "moehre", "offset": 3},
	{"id": "abschied", "offset": 4},
]

## Anzahl der Antipp-Gags in strings/de+en (alwin.gag_1 … gag_N).
const GAG_ANZAHL := 12

const TEXT_PREFIX := "dlc_goobye.alwin."


## Die komplette Routine mit absoluter Tages-Minute + I18n-Key (Kopien).
static func routine(start_minute := GoobyeMarkttag.ALWIN_MINUTE) -> Array:
	var out: Array = []
	for eintrag: Dictionary in ROUTINE:
		(
			out
			. append(
				{
					"id": str(eintrag["id"]),
					"minute": start_minute + int(eintrag["offset"]),
					"text_key": TEXT_PREFIX + "routine_" + str(eintrag["id"]),
				}
			)
		)
	return out


## Ein Routine-Schritt per id ({} = unbekannt).
static func schritt(id: String, start_minute := GoobyeMarkttag.ALWIN_MINUTE) -> Dictionary:
	for eintrag: Dictionary in routine(start_minute):
		if str(eintrag["id"]) == id:
			return eintrag
	return {}


## Tages-Minute → lesbare Uhrzeit ("9:04"); Öffnung 8:00 ist Minute 0.
static func uhrzeit(minute: int) -> String:
	var m := maxi(0, minute)
	return "%d:%02d" % [OEFFNUNG_STUNDE + floori(float(m) / 60.0), m % 60]


## Deterministisch gemischte Gag-Indizes 1..GAG_ANZAHL (Fisher-Yates über
## einen Seed-RNG — gleicher Seed = gleiche Tagesreihenfolge).
static func gag_reihenfolge(seed_wert: int) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_wert
	var indizes: Array = []
	for i in GAG_ANZAHL:
		indizes.append(i + 1)
	for i in range(GAG_ANZAHL - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var merk: Variant = indizes[i]
		indizes[i] = indizes[j]
		indizes[j] = merk
	return indizes


## Der Gag zum n-ten Antippen des Tages: rotiert ohne Wiederholung durch
## die Tagesreihenfolge, nach GAG_ANZAHL Tipps beginnt der Zyklus neu.
static func gag_key(seed_wert: int, tipp_index: int) -> String:
	var reihenfolge := gag_reihenfolge(seed_wert)
	var idx := int(reihenfolge[maxi(0, tipp_index) % GAG_ANZAHL])
	return TEXT_PREFIX + "gag_%d" % idx
