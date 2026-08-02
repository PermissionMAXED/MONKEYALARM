class_name McGoobyBelegenLogic
extends RefCounted
## Pure Belegstations-Logik (Welle B, Doc §2.2 #2): das Bestell-Ticket zeigt
## den Zutaten-Turm, der Spieler stapelt in Ticket-Reihenfolge — direkter
## Erbe von `burger_build` (+Lage/−Fehlgriff-Grammatik, Doc §10.3 „Zahlenwerk
## übernehmen, Input-Modell tauschen“), nur ohne Zutaten-Regen: hier WÄHLT
## der Spieler, das Tempo kommt von der Kundenschlange, nicht von der Physik.
## Keine Nodes, keine Autoloads — Zahlen IMMER aus dem Balance-Block des
## Menü-Packs. Knuffig-Regel (Doc §4.2): ein Fehlgriff kostet höchstens den
## Malus und NIE mehr, als die Bestellung schon verdient hat (nie unter 0).


## Zutaten-Turm eines Rezepts (erster belegen-Schritt; [] = keine Belegstation).
static func ticket_von(rezept_def: Dictionary) -> Array[String]:
	var out: Array[String] = []
	for schritt: Variant in rezept_def.get("schritte", []):
		if not (schritt is Dictionary):
			continue
		if str((schritt as Dictionary).get("station", "")) != "belegen":
			continue
		for zutat: Variant in (schritt as Dictionary).get("zutaten", []):
			out.append(str(zutat))
		break
	return out


## Zutaten-Leiste (Auswahl-Knöpfe): jede Ticket-Zutat GENAU einmal, Reihenfolge
## deterministisch aus dem Seed gemischt (GoobyRng, Fisher-Yates) — gleicher
## Seed = gleiche Leiste (Koop-/Bot-Regel Doc §4.1).
static func leiste_von(ticket: Array, seed_wert: int) -> Array[String]:
	var out: Array[String] = []
	for zutat: Variant in ticket:
		if not out.has(str(zutat)):
			out.append(str(zutat))
	var rng := GoobyRng.new(seed_wert)
	for i in range(out.size() - 1, 0, -1):
		var j := mini(i, int(floor(rng.next() * float(i + 1))))
		var tausch := out[i]
		out[i] = out[j]
		out[j] = tausch
	return out


## Die als Nächstes gebrauchte Lage ("" = Turm fertig).
static func naechste_lage(ticket: Array, platziert: int) -> String:
	if platziert < 0 or platziert >= ticket.size():
		return ""
	return str(ticket[platziert])


static func ist_fertig(ticket: Array, platziert: int) -> bool:
	return platziert >= ticket.size()


## Punkte für eine richtig gestapelte Lage (burger_build-Grammatik: +5).
static func punkte_lage(bal: Dictionary) -> int:
	return maxi(0, int(bal.get("belegen_punkte_lage", 5)))


## Bestellpunkte NACH einem Fehlgriff: Malus (Default 2) abziehen, aber nie
## unter 0 — der Fehlgriff kostet NIE mehr, als schon verdient wurde.
static func nach_fehlgriff(punkte_bisher: int, bal: Dictionary) -> int:
	var malus := maxi(0, int(bal.get("belegen_malus_falsch", 2)))
	return maxi(0, punkte_bisher - malus)


## Bot-Zertifizierung der Belegstation (Doc §10.4): pro Lage würfelt der Bot
## einmal — sauber (Wahrscheinlichkeit = skill) stapelt er direkt, sonst EIN
## Fehlgriff (Malus wie im Spiel geklemmt) und dann die richtige Lage.
## punkte_start = bisherige Bestellpunkte (Grill), damit die Klemme exakt wie
## in der Szene rechnet. Rückgabe: {punkte, lagen, fehlgriffe}.
static func simulate_lagen(
	rng: GoobyRng, ticket: Array, skill: float, bal: Dictionary, punkte_start: int
) -> Dictionary:
	var punkte := maxi(0, punkte_start)
	var fehlgriffe := 0
	for _lage in ticket.size():
		if rng.next() >= skill:
			punkte = nach_fehlgriff(punkte, bal)
			fehlgriffe += 1
		punkte += punkte_lage(bal)
	return {"punkte": punkte, "lagen": ticket.size(), "fehlgriffe": fehlgriffe}
