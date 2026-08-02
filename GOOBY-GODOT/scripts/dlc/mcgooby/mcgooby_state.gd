class_name McGoobyState
extends RefCounted
## McGooby-Slice-Anbindung ans GameState (Welle A+B) — via FROZEN
## Slice-Registry, Muster RanchState/CityState. Alle Funktionen static,
## `gs` = Duck-Typing (`/root/GameState` oder Test-Double mit
## get_value/set_value). ADDITIV: neuer Slice `mcgooby` über register_slice,
## KEIN Save-Version-Bump (Doc §10.1: additive Unterschlüssel mit
## normalize-Self-Heal).
##
## Slice-Struktur (Welle B bringt das Kauf-Gate, Doc §6.2/§10.1):
##   mcgooby.v,
##   mcgooby.introGesehen (bool — Eröffnungs-Hook-Karte lief, Doc §1.3),
##   mcgooby.besitz { gekauft, kaufAt (ms), angebotGesehen, angebotVerschoben },
##   mcgooby.schichten { gespielt (int), bestwert (int Punkte) }.

const SaveSchema := preload("res://scripts/state/save_schema.gd")

const SLICE_ID := "mcgooby"

static var _registered := false


## Registriert den mcgooby-Slice (idempotent, VOR GameState.initialize()).
static func register_slice() -> void:
	if _registered:
		return
	_registered = true
	SaveSchema.register_slice(SLICE_ID, default_slice, normalize_slice)


static func default_slice() -> Dictionary:
	return {
		"v": 1,
		"introGesehen": false,
		"besitz": default_besitz(),
		"schichten": {"gespielt": 0, "bestwert": 0},
	}


static func default_besitz() -> Dictionary:
	return {
		"gekauft": false,
		"kaufAt": 0,
		"angebotGesehen": false,
		"angebotVerschoben": false,
	}


## Self-Heal: Typen reparieren, gültige Daten VERBATIM erhalten (Muster
## RanchState.normalize_slice — Alt-Saves ohne Slice bekommen Defaults;
## Welle-A-Saves ohne besitz bekommen den Besitz-Block dazu).
static func normalize_slice(raw: Variant) -> Dictionary:
	var slice: Dictionary = raw if raw is Dictionary else default_slice()
	slice["v"] = maxi(1, int(slice.get("v", 1)))
	slice["introGesehen"] = bool(slice.get("introGesehen", false))
	var besitz: Dictionary = slice.get("besitz") if slice.get("besitz") is Dictionary else {}
	besitz["gekauft"] = bool(besitz.get("gekauft", false))
	besitz["kaufAt"] = maxi(0, int(besitz.get("kaufAt", 0)))
	besitz["angebotGesehen"] = bool(besitz.get("angebotGesehen", false))
	besitz["angebotVerschoben"] = bool(besitz.get("angebotVerschoben", false))
	slice["besitz"] = besitz
	var schichten: Dictionary = (
		slice.get("schichten") if slice.get("schichten") is Dictionary else {}
	)
	schichten["gespielt"] = maxi(0, int(schichten.get("gespielt", 0)))
	schichten["bestwert"] = maxi(0, int(schichten.get("bestwert", 0)))
	slice["schichten"] = schichten
	return slice


## Laden gekauft? (Kauf-Gate Welle B, Doc §6.2.)
static func ist_gekauft(gs: Object) -> bool:
	return gs != null and bool(gs.get_value("mcgooby.besitz.gekauft", false))


## Level-Gate: ab diesem Level ist das Eckgrundstück im Hub verfügbar
## (Balance-Pack, Default 14 — McGoobyKatalog.freischalt_level).
static func ist_freigeschaltet(gs: Object) -> bool:
	if gs == null:
		return false
	var level := int(gs.get_value("progression.level", 1))
	return level >= McGoobyKatalog.freischalt_level()


## „Später kaufen“: Angebot gesehen + verschoben merken (Muster GoobyeState).
static func angebot_verschieben(gs: Object) -> void:
	if gs == null:
		return
	gs.update(
		func(state: Dictionary) -> void:
			var besitz := ensure_besitz(state)
			besitz["angebotGesehen"] = true
			besitz["angebotVerschoben"] = true
	)
	gs.notify_slice_changed(SLICE_ID)


## Eröffnungs-Hook schon gesehen? (Erststart-Erkennung der Schicht-Szene.)
static func ist_intro_gesehen(gs: Object) -> bool:
	return gs != null and bool(gs.get_value("mcgooby.introGesehen", false))


static func setze_intro_gesehen(gs: Object) -> void:
	if gs != null:
		gs.set_value("mcgooby.introGesehen", true)


## Schicht verbuchen: Zähler hoch, Bestwert = Maximum (nie runter).
static func schicht_verbuchen(gs: Object, punkte: int) -> void:
	if gs == null:
		return
	var gespielt := int(gs.get_value("mcgooby.schichten.gespielt", 0))
	gs.set_value("mcgooby.schichten.gespielt", gespielt + 1)
	var bestwert := int(gs.get_value("mcgooby.schichten.bestwert", 0))
	gs.set_value("mcgooby.schichten.bestwert", maxi(bestwert, maxi(0, punkte)))


static func reset_for_tests() -> void:
	_registered = false


## Ensure-Muster (GoobyeState/random_events.gd): fehlende Schlüssel im
## update-Block anlegen/heilen — robust, auch wenn der Slice erst NACH
## initialize() registriert wurde (Alt-Saves, isolierte Tests).
static func ensure_besitz(state: Dictionary) -> Dictionary:
	var slice: Dictionary = (
		state.get(SLICE_ID) if state.get(SLICE_ID) is Dictionary else default_slice()
	)
	state[SLICE_ID] = normalize_slice(slice)
	return state[SLICE_ID]["besitz"]
