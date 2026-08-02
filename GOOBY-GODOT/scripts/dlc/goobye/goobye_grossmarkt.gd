class_name GoobyeGrossmarkt
extends RefCounted
## Großmarkt-Bestellung des „Goo und Bye“ (G5/P24 Welle B, Doc §4.1/§2.2) —
## PURE + static: der Bestellzettel ist ein schlichtes Dictionary
## {ware_id: menge}, das Bestell-Sheet bedient ihn über ±-Stepper, und die
## Buchung läuft ATOMAR in EINEM gs.update-Block (Muster GoobyeKauf):
## entweder Münzen runter UND Lager rauf — oder gar nichts. Geliefert wird
## weiterhin bis zur Ladentür; die echte Auto-Fahrt (Kofferraum, §4.2) ist
## der Transport-Teil von Welle B und bewusst NICHT hier.
##
## Staffelpreis (§4.1): ab GoobyeKatalog.staffel_ab() Stück EINER Ware
## bekommt die Positions-Summe staffel_rabatt() Nachlass — Großeinkauf
## fühlt sich nach Großmarkt an, bleibt aber EINE erklärbare Regel.

const RESULT_OK := "ok"
const RESULT_LEER := "korb_leer"
const RESULT_BROKE := "not_enough_coins"
## Buchungs-Grund wie der Welle-A-Einzelkauf (Statistik bleibt vergleichbar).
const REASON := "gooundbye_einkauf"

## Stepper-Deckel je Ware — reiner Bedien-Deckel des Sheets (mehr als eine
## Regal-Reihe fasst, braucht kein Zettel), kein Gameplay-Gate.
const MAX_JE_WARE := 24

const Economy := preload("res://scripts/logic/economy.gd")


## ±-Stepper: Menge einer Ware ändern (geklemmt 0..MAX_JE_WARE, 0 räumt den
## Eintrag vom Zettel). Unbekannte Waren prallen ab. Gibt die neue Menge.
static func menge_aendern(korb: Dictionary, ware_id: String, delta: int) -> int:
	if GoobyeKatalog.ware(ware_id).is_empty():
		return 0
	var neu := clampi(int(korb.get(ware_id, 0)) + delta, 0, MAX_JE_WARE)
	if neu <= 0:
		korb.erase(ware_id)
	else:
		korb[ware_id] = neu
	return neu


## Positions-Summe: Einkaufspreis × Menge, ab der Staffel-Schwelle mit
## Rabatt auf die ganze Position — nie unter 1 Münze je Stück.
static func positions_preis(ware: Dictionary, menge: int) -> int:
	if menge <= 0:
		return 0
	var summe := GoobyePreis.einkaufspreis(ware) * menge
	if menge >= GoobyeKatalog.staffel_ab():
		summe = roundi(float(summe) * (1.0 - GoobyeKatalog.staffel_rabatt()))
	return maxi(menge, summe)


## Bestellzettel fürs Sheet: Positionen in Katalog-Reihenfolge + Summen.
## Ergebnis: {positionen: [{id, menge, preis, staffel}], stueck, summe}.
static func bestellung(korb: Dictionary) -> Dictionary:
	var positionen: Array = []
	var stueck := 0
	var summe := 0
	for ware: Dictionary in GoobyeKatalog.waren():
		var id := str(ware["id"])
		var menge := int(korb.get(id, 0))
		if menge <= 0:
			continue
		var preis := positions_preis(ware, menge)
		(
			positionen
			. append(
				{
					"id": id,
					"menge": menge,
					"preis": preis,
					"staffel": menge >= GoobyeKatalog.staffel_ab(),
				}
			)
		)
		stueck += menge
		summe += preis
	return {"positionen": positionen, "stueck": stueck, "summe": summe}


## Bestellen: ATOMAR Münzen abbuchen UND alle Positionen ins Lager legen
## (EIN update-Block, Economy.spend ist selbst atomar). Liefert
## RESULT_OK/RESULT_LEER/RESULT_BROKE; nur RESULT_OK hat State verändert.
static func bestellen(gs: Object, korb: Dictionary) -> String:
	if gs == null:
		return RESULT_LEER
	var zettel := bestellung(korb)
	if int(zettel["stueck"]) <= 0:
		return RESULT_LEER
	var summe := int(zettel["summe"])
	var positionen: Array = zettel["positionen"]
	# Einelementiges Array als Rückkanal (Lambda fängt per Wert).
	var bezahlt := [false]
	gs.update(
		func(state: Dictionary) -> void:
			if not Economy.spend(state["economy"], summe, REASON):
				return
			bezahlt[0] = true
			var goobye := GoobyeState.ensure_goobye(state)
			var lager: Dictionary = goobye["lager"]
			for position: Dictionary in positionen:
				var id := str(position["id"])
				lager[id] = int(lager.get(id, 0)) + int(position["menge"])
	)
	if not bool(bezahlt[0]):
		return RESULT_BROKE
	gs.notify_slice_changed(GoobyeState.SLICE_ID)
	return RESULT_OK
