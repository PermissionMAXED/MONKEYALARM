class_name RanchWegenetz
extends RefCounted
## Wegenetz-Ausstattung der offenen Welt (WELT-1): WEGWEISER mit
## Entfernungsangaben an jedem Zonen-Anschluss (man sieht IMMER, wohin es
## weitergeht), RASTPLÄTZE mit Bank + Feuerstelle an langen Strecken,
## WEIDEGATTER (fence_gate) an Zonen-Einfahrten und die FURT-Markierung
## am Bach. Die PLANUNG ist PURE + headless-testbar (wegweiser_plan,
## distanz_m, rastplatz_deko_plan, wegweiser_deko_plan); der Bau-Schritt
## setzt sie in wenige Meshes um — Label3D und Kleinteile mit
## Sichtweiten-Culling (Budget). POLISH (W19): Rastplätze und Wegweiser-
## Füße tragen die Bestands-CC0-Kits statt nackter Primitive — Kenney
## Survival Kit (Feuerstelle/Zelt, schon im Repo für den Urlaubs-Berg)
## und Kenney Nature Kit (Sitzstamm, Stümpfe, Stein/Gras/Blumen). Alle
## Kit-Requisiten bündeln über RanchBau.baue_multimesh nach GLB-Sorte
## (EIN Draw-Call je Mesh, egal wie viele Plätze) und sitzen einzeln auf
## RanchGelaende.hoehe — nichts schwebt am Hang.

const SICHT_M := 170.0

## Bestands-CC0-Kits (Lizenz-Dateien liegen in den Asset-Ordnern).
const NATUR_KIT := "res://assets/ranch/natur"
const LAGER_KIT := "res://assets/city/urlaub/survival-kit"
const FEUER_GLB := LAGER_KIT + "/campfire-pit.glb"
const ZELT_GLB := LAGER_KIT + "/tent-canvas.glb"
const STAMM_GLB := NATUR_KIT + "/log.glb"
const STUMPF_GLB := NATUR_KIT + "/stump_round.glb"
const STEIN_GLB := NATUR_KIT + "/rock_smallA.glb"
const GRAS_GLB := NATUR_KIT + "/grass_large.glb"
const BLUMEN_GLB: Array[String] = [
	NATUR_KIT + "/flower_redA.glb",
	NATUR_KIT + "/flower_yellowA.glb",
	NATUR_KIT + "/flower_purpleA.glb",
]

## Rastplätze: [x, z] an langen Wegstrecken (Serpentinen-Fuß, Strandweg,
## Feldrand) — Bank, Feuerstelle, Sitzstämme.
const RASTPLAETZE: Array[Array] = [
	[130.0, -640.0],
	[688.0, 236.0],
	[-160.0, 806.0],
]

## Weidegatter: {weg-id, t entlang des Wegs} — Tor steht AUF dem Weg.
const GATTER: Array[Dictionary] = [
	{"von": "hof", "nach": "weidetal", "t": 0.45},
	{"von": "turnierplatz", "nach": "obstgarten", "t": 0.5},
	{"von": "scheune_alt", "nach": "kornfeld", "t": 0.55},
]

const HOLZ := Color(0.62, 0.55, 0.47)
const SCHILD_CREME := Color("#F4E9CD")
const INK := Color(0.32, 0.25, 0.2)
const FEUER_ORANGE := Color(1.0, 0.62, 0.25, 0.9)

## ------------------------------------------------------------- Planung


## Weglänge in Metern zwischen zwei Zonen (Polyline; 0.0 = kein Weg).
static func distanz_m(von_zone: String, nach_zone: String) -> float:
	var punkte := RanchKarte.wegpunkte(von_zone, nach_zone)
	var laenge := 0.0
	for i in punkte.size() - 1:
		laenge += Vector2(punkte[i].x, punkte[i].z).distance_to(
			Vector2(punkte[i + 1].x, punkte[i + 1].z)
		)
	return laenge


## Wegweiser-Plan: je Zone ein Pfosten am Weg-Anschluss mit einem Arm pro
## Nachbar-Zone (name_key + gerundete Distanz). PURE für Tests.
static func wegweiser_plan() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for zone: Dictionary in RanchKarte.zonen():
		var zone_id := str(zone["id"])
		var nachbarn := RanchKarte.nachbarn(zone_id)
		if nachbarn.is_empty():
			continue
		var spawn: Array = zone["spawn"]
		var arme: Array[Dictionary] = []
		for nachbar: String in nachbarn:
			var ziel := RanchKarte.zone(nachbar)
			(
				arme
				. append(
					{
						"zone": nachbar,
						"name_key": str(ziel["name_key"]),
						"distanz_m": distanz_m(zone_id, nachbar),
					}
				)
			)
		(
			out
			. append(
				{
					"zone": zone_id,
					"pos": Vector2(float(spawn[0]) + 4.0, float(spawn[1]) - 4.0),
					"arme": arme,
				}
			)
		)
	return out


## Rastplatz-Kit-Deko um Mittelpunkt `p` (Welt-XZ), PURE + deterministisch
## aus der Position: Feuerstelle + Zelt (Survival Kit), Sitzstamm +
## Stümpfe ums Feuer, dazu Stein/Gras/Blumen-Streu (Nature Kit).
## Einträge: {glb, pos: Vector2, yaw, skala}.
static func rastplatz_deko_plan(p: Vector2) -> Array[Dictionary]:
	var rng := _rng("rast", p)
	var yaw := p.x * 0.1
	var out: Array[Dictionary] = [
		_deko(FEUER_GLB, p, rng.randf_range(0.0, TAU), 4.5),
		_deko(
			STAMM_GLB, p + _lokal(Vector2(2.35, 0.3), yaw), yaw + rng.randf_range(-0.25, 0.25), 3.4
		),
		_deko(STUMPF_GLB, p + _lokal(Vector2(-2.1, 0.7), yaw), rng.randf_range(0.0, TAU), 2.6),
		_deko(STUMPF_GLB, p + _lokal(Vector2(-1.4, 2.0), yaw), rng.randf_range(0.0, TAU), 2.4),
		_deko(ZELT_GLB, p + _lokal(Vector2(0.8, 5.2), yaw), yaw + PI, 4.4),
		_deko(STEIN_GLB, p + _lokal(Vector2(3.2, -2.0), yaw), rng.randf_range(0.0, TAU), 2.2),
	]
	for _i in 3:
		var w := rng.randf_range(0.0, TAU)
		var r := rng.randf_range(2.9, 4.3)
		out.append(_deko(GRAS_GLB, p + Vector2.from_angle(w) * r, rng.randf_range(0.0, TAU), 2.6))
	for _i in 2:
		var w := rng.randf_range(0.0, TAU)
		var r := rng.randf_range(2.6, 3.9)
		var blume: String = BLUMEN_GLB[rng.randi_range(0, BLUMEN_GLB.size() - 1)]
		out.append(_deko(blume, p + Vector2.from_angle(w) * r, rng.randf_range(0.0, TAU), 2.4))
	return out


## Wegweiser-Fuß-Deko um Pfosten `p`, PURE + deterministisch: ein Stein
## plus Gras-/Blumen-Büschel im engen Ring — der Pfosten wirkt GEPFLANZT
## statt in die nackte Wiese gesteckt.
static func wegweiser_deko_plan(p: Vector2) -> Array[Dictionary]:
	var rng := _rng("wegweiser", p)
	var out: Array[Dictionary] = [
		_deko(
			STEIN_GLB,
			p + Vector2.from_angle(rng.randf_range(0.0, TAU)) * rng.randf_range(0.55, 0.8),
			rng.randf_range(0.0, TAU),
			1.7
		)
	]
	for _i in 2:
		var w := rng.randf_range(0.0, TAU)
		var r := rng.randf_range(0.6, 1.1)
		out.append(_deko(GRAS_GLB, p + Vector2.from_angle(w) * r, rng.randf_range(0.0, TAU), 2.1))
	for _i in 2:
		var w := rng.randf_range(0.0, TAU)
		var r := rng.randf_range(0.7, 1.2)
		var blume: String = BLUMEN_GLB[rng.randi_range(0, BLUMEN_GLB.size() - 1)]
		out.append(_deko(blume, p + Vector2.from_angle(w) * r, rng.randf_range(0.0, TAU), 2.0))
	return out


## ----------------------------------------------------------------- Bau


## Baut Wegweiser, Rastplätze, Gatter und Furt-Stangen unter `wurzel`.
## Die Kit-Deko ALLER Plätze/Pfosten sammelt sich erst je GLB-Sorte und
## läuft dann gebündelt durch baue_multimesh (Draw-Call-Budget).
static func baue(wurzel: Node3D) -> Node3D:
	var gruppe := Node3D.new()
	gruppe.name = "Wegenetz"
	wurzel.add_child(gruppe)
	var deko: Dictionary = {}
	for plan: Dictionary in wegweiser_plan():
		_baue_wegweiser(gruppe, plan)
		_sammle_deko(deko, wegweiser_deko_plan(plan["pos"]))
	for platz: Array in RASTPLAETZE:
		var p := Vector2(float(platz[0]), float(platz[1]))
		_baue_rastplatz(gruppe, p)
		_sammle_deko(deko, rastplatz_deko_plan(p))
	var bau := RanchBau.new(gruppe)
	for gatter: Dictionary in GATTER:
		_baue_gatter(gruppe, bau, gatter)
	_baue_furt_stangen(gruppe)
	for pfad: String in deko:
		bau.baue_multimesh(gruppe, pfad, deko[pfad])
	return gruppe


## Deko-Plan → Welt-Transforms je GLB-Pfad in `ziel`: aufrecht (nur Yaw),
## uniforme Skala, Fuß auf RanchGelaende.hoehe; Wasser-Positionen fallen
## still weg (Rastplatz am Strandweg).
static func _sammle_deko(ziel: Dictionary, plaene: Array[Dictionary]) -> void:
	for eintrag: Dictionary in plaene:
		var pos: Vector2 = eintrag["pos"]
		if RanchGelaende.ist_wasser(pos.x, pos.y):
			continue
		var basis := Basis(Vector3.UP, float(eintrag["yaw"])).scaled(
			Vector3.ONE * float(eintrag["skala"])
		)
		var origin := Vector3(pos.x, RanchGelaende.hoehe(pos.x, pos.y), pos.y)
		var liste: Array = ziel.get_or_add(str(eintrag["glb"]), [])
		liste.append(Transform3D(basis, origin))


## Wegweiser: Pfosten + je Nachbar ein Brett-Arm mit "Name  123 m".
static func _baue_wegweiser(gruppe: Node3D, plan: Dictionary) -> void:
	var p: Vector2 = plan["pos"]
	var boden := RanchGelaende.hoehe(p.x, p.y)
	var pfahl := Node3D.new()
	pfahl.name = "Wegweiser_%s" % str(plan["zone"])
	pfahl.position = Vector3(p.x, boden, p.y)
	gruppe.add_child(pfahl)
	_quader(pfahl, Vector3(0.0, 1.5, 0.0), Vector3(0.2, 3.0, 0.2), HOLZ)
	var arme: Array = plan["arme"]
	for i in arme.size():
		var arm: Dictionary = arme[i]
		var ziel := RanchKarte.zone(str(arm["zone"]))
		var spawn: Array = ziel["spawn"]
		var winkel := atan2(float(spawn[0]) - p.x, float(spawn[1]) - p.y)
		var arm_wurzel := Node3D.new()
		arm_wurzel.position = Vector3(0.0, 2.7 - float(i) * 0.42, 0.0)
		arm_wurzel.rotation.y = winkel
		pfahl.add_child(arm_wurzel)
		_quader(arm_wurzel, Vector3(0.0, 0.0, 0.85), Vector3(0.14, 0.34, 1.7), SCHILD_CREME)
		var text := Label3D.new()
		text.text = (
			"%s  %d m" % [I18nService.t(str(arm["name_key"])), int(float(arm["distanz_m"]))]
		)
		text.font_size = 52
		text.pixel_size = 0.006
		text.modulate = INK
		text.position = Vector3(0.09, 0.0, 0.85)
		text.rotation.y = -PI / 2.0
		text.visibility_range_end = SICHT_M
		# Einseitig: von hinten zeigt der Arm sauberes Brett statt
		# gespiegeltem Geister-Text (W19-Beweisfoto-Befund).
		text.double_sided = false
		arm_wurzel.add_child(text)


## Rastplatz: Pastell-Bank + Flammen-Quad über der Kit-Feuerstelle.
## Feuerstelle/Zelt/Sitzstamm/Stümpfe/Streu kommen NICHT mehr als
## Primitive hierher, sondern gebündelt aus rastplatz_deko_plan.
static func _baue_rastplatz(gruppe: Node3D, p: Vector2) -> void:
	var boden := RanchGelaende.hoehe(p.x, p.y)
	var platz := Node3D.new()
	platz.name = "Rastplatz"
	platz.position = Vector3(p.x, boden, p.y)
	platz.rotation.y = p.x * 0.1
	gruppe.add_child(platz)
	_quader(platz, Vector3(0.0, 0.5, -2.6), Vector3(2.4, 0.14, 0.7), HOLZ)
	_quader(platz, Vector3(-0.9, 0.25, -2.6), Vector3(0.16, 0.5, 0.6), HOLZ)
	_quader(platz, Vector3(0.9, 0.25, -2.6), Vector3(0.16, 0.5, 0.6), HOLZ)
	_quader(platz, Vector3(0.0, 0.85, -2.92), Vector3(2.4, 0.6, 0.1), HOLZ)
	var flamme := MeshInstance3D.new()
	flamme.name = "Feuer"
	var quad := QuadMesh.new()
	quad.size = Vector2(0.9, 1.1)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = FEUER_ORANGE
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	quad.material = mat
	flamme.mesh = quad
	flamme.position = Vector3(0.0, 0.95, 0.0)
	flamme.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flamme.visibility_range_end = SICHT_M
	platz.add_child(flamme)


## Weidegatter: Kit-Tor quer über den Weg, an Punkt t der Polyline.
static func _baue_gatter(gruppe: Node3D, bau: RanchBau, gatter: Dictionary) -> void:
	var punkte := RanchKarte.wegpunkte(str(gatter["von"]), str(gatter["nach"]))
	if punkte.size() < 2:
		return
	var t := clampf(float(gatter["t"]), 0.0, 1.0) * float(punkte.size() - 1)
	var i := mini(int(t), punkte.size() - 2)
	var p := punkte[i].lerp(punkte[i + 1], t - float(i))
	var richtung := punkte[i + 1] - punkte[i]
	var tor := bau.lade_glb("%s/natur/fence_gate.glb" % "res://assets/ranch", 3.4)
	if tor == null:
		return
	tor.name = "Gatter_%s_%s" % [str(gatter["von"]), str(gatter["nach"])]
	tor.position = Vector3(p.x, RanchGelaende.hoehe(p.x, p.z), p.z)
	# QUER über den Weg (Doku oben): Yaw = Weg-Heading stellt die Tor-
	# Längsachse (X) senkrecht zur Wegrichtung; +PI/2 legte es parallel
	# NEBEN den Weg.
	tor.rotation.y = atan2(richtung.x, richtung.z)
	gruppe.add_child(tor)


## Furt: zwei Stangen-Paare markieren die sichere Bach-Querung.
static func _baue_furt_stangen(gruppe: Node3D) -> void:
	var bach: Dictionary = RanchKarte.karte()["bach"]
	var furt: Array = bach["furt"]
	var fx := float(furt[0])
	var fz := float(furt[1])
	for ecke: Vector2 in [
		Vector2(-5.0, -3.0), Vector2(5.0, -3.0), Vector2(-5.0, 3.0), Vector2(5.0, 3.0)
	]:
		var p := Vector2(fx, fz) + ecke
		var boden := RanchGelaende.hoehe(p.x, p.y)
		var stange := _quader(
			gruppe, Vector3(p.x, boden + 0.8, p.y), Vector3(0.14, 1.6, 0.14), HOLZ
		)
		_quader(
			gruppe, Vector3(p.x, boden + 1.55, p.y), Vector3(0.3, 0.3, 0.3), Color(0.86, 0.42, 0.36)
		)
		stange.visibility_range_end = SICHT_M * 2.0


static func _quader(wurzel: Node3D, pos: Vector3, groesse: Vector3, farbe: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = groesse
	mesh.material = RanchPferd.material(farbe)
	mi.mesh = mesh
	mi.position = pos
	wurzel.add_child(mi)
	return mi


## ------------------------------------------------ Deko-Plan-Werkzeuge


static func _deko(glb: String, pos: Vector2, yaw: float, skala: float) -> Dictionary:
	return {"glb": glb, "pos": pos, "yaw": yaw, "skala": skala}


## Lokaler Platz-Offset → Welt-Offset unter Platz-Yaw (entspricht
## Basis(UP, yaw) auf der XZ-Ebene).
static func _lokal(offset: Vector2, yaw: float) -> Vector2:
	return offset.rotated(-yaw)


## Deterministischer RNG je Zweck + Position (AGENTS-Regel: Zufall
## injizierbar/reproduzierbar — kein randomize() in Kernlogik).
static func _rng(zweck: String, p: Vector2) -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash("%s:%d:%d" % [zweck, int(round(p.x)), int(round(p.y))])
	return rng
