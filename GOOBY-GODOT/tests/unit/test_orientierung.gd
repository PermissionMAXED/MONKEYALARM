extends TestCase
## UserFeedback §1 „alle Assets immer richtig rotiert und richtig rum" —
## ORIENTIERUNGS-PROBE über Modelle UND Platzierungen:
##   1. Boden-Modelle der Kits stehen richtig herum: Ursprung am Fuß
##      (Kenney-Kits senken max. ~0,05 m ein), nichts schwebt überm Boden.
##   2. Stadt-Kulisse (CityKulisse): JEDE Platzierung steht aufrecht
##      (Up-Vektor = UP, Basis orthogonal, keine Spiegelung).
##   3. Zaun-KETTEN der Ranch-Welt (MM_fence_simple) laufen LÄNGS ihrer
##      Linie: die Latten-Längsachse zeigt zum nächsten Nachbarn — fing
##      die radialen Hügelkamm-„Speichen" und den Aussichts-„Kamm".
##   4. Weidegatter stehen QUER über dem Weg (Doku in ranch_wegenetz).

## Ordner, deren Modelle mit Ursprung am FUSS auf dem Boden stehen müssen.
const BODEN_ORDNER: Array[String] = [
	"res://assets/ranch/natur",
	"res://assets/city/natur",
	"res://assets/city/vorstadt",
	"res://assets/city/gebaeude",
	"res://assets/city/autos",
	"res://assets/city/deko",
	"res://assets/city/essen",
	"res://assets/city/strassen",
	"res://assets/furniture/garten",
]
## Dateinamen-Präfixe ohne Fuß-Ursprung (Räder: Ursprung = Nabenmitte).
const BODEN_AUSNAHMEN: Array[String] = ["wheel-"]
## Referenz-Zaunlatte der Ranch (Längsachse für die Ketten-Probe).
const ZAUN_GLB := "res://assets/ranch/natur/fence_simple.glb"
## Kenney-Kits senken Boden-Deko 0,05 m ein — mehr wäre „versenkt".
const EINSENK_TOLERANZ := 0.061
## Ursprung höher als 25 % der Modellhöhe = Modell schwebt.
const SCHWEBE_ANTEIL := 0.25
## Latten-Längsachse vs. Richtung zum Nachbarn: cos(~35°).
const KETTEN_DOT := 0.8
## Gatter-Längsachse vs. Wegrichtung: quer heißt |dot| klein (sin ~20°).
const GATTER_QUER_DOT := 0.35


func test_boden_modelle_stehen_richtig_herum() -> void:
	var geprueft := 0
	for ordner in BODEN_ORDNER:
		var dir := DirAccess.open(ordner)
		assert_true(dir != null, "Ordner fehlt: %s" % ordner)
		if dir == null:
			continue
		for datei in dir.get_files():
			if not (datei.ends_with(".glb") or datei.ends_with(".gltf")):
				continue
			if _ist_ausnahme(datei):
				continue
			var aabb := _glb_aabb("%s/%s" % [ordner, datei])
			if aabb.size == Vector3.ZERO:
				fail_test("%s/%s: keine Meshes gefunden" % [ordner, datei])
				continue
			geprueft += 1
			assert_true(
				aabb.position.y >= -EINSENK_TOLERANZ,
				(
					"%s/%s: Fuß %.3f m unterm Ursprung (steht falsch herum/versenkt?)"
					% [ordner, datei, -aabb.position.y]
				)
			)
			assert_true(
				aabb.position.y <= SCHWEBE_ANTEIL * maxf(aabb.size.y, 0.0001),
				"%s/%s: Fuß %.3f m ÜBER dem Ursprung (schwebt)" % [ordner, datei, aabb.position.y]
			)
	assert_true(geprueft >= 60, "Probe deckt die Kits ab (%d Modelle geprüft)" % geprueft)


func test_stadt_kulisse_steht_aufrecht() -> void:
	var karte := CityMap.laden()
	var plaene := CityKulisse.plaene(karte, karte.deko_seed())
	assert_true(plaene.size() >= 250, "Kulissen-Plan gefüllt (%d)" % plaene.size())
	for eintrag in plaene:
		var basis := CityKulisse.transform_von(eintrag).basis
		_pruefe_aufrecht(basis, "Kulisse %s" % eintrag["glb"])


func test_zaun_ketten_laufen_laengs() -> void:
	var wurzel := Node3D.new()
	RanchBau.transform_log = {}
	RanchBau.log_transforms = true
	RanchZonenDeko.new(RanchKarte.seed_wert()).baue(wurzel)
	RanchFundorteBau.new(0.0).baue(wurzel)
	RanchBau.log_transforms = false
	var achse_lokal := _laengste_achse_von(_glb_aabb(ZAUN_GLB).size)
	var geprueft := 0
	for pfad: String in RanchBau.transform_log:
		if not pfad.ends_with("fence_simple.glb"):
			continue
		var ketten: Array = RanchBau.transform_log[pfad]
		for k in ketten.size():
			_pruefe_kette(ketten[k], achse_lokal, "Zaunkette %d" % k)
			geprueft += 1
	RanchBau.transform_log = {}
	assert_true(geprueft >= 5, "genug Zaun-Ketten geprüft (%d)" % geprueft)
	wurzel.free()


func test_weidegatter_stehen_quer_ueber_dem_weg() -> void:
	var wurzel := Node3D.new()
	RanchWegenetz.baue(wurzel)
	var geprueft := 0
	for gatter: Dictionary in RanchWegenetz.GATTER:
		var punkte := RanchKarte.wegpunkte(str(gatter["von"]), str(gatter["nach"]))
		assert_true(punkte.size() >= 2, "Weg %s→%s existiert" % [gatter["von"], gatter["nach"]])
		if punkte.size() < 2:
			continue
		var t := clampf(float(gatter["t"]), 0.0, 1.0) * float(punkte.size() - 1)
		var i := mini(int(t), punkte.size() - 2)
		var weg := punkte[i + 1] - punkte[i]
		weg.y = 0.0
		var tor_name := "Gatter_%s_%s" % [str(gatter["von"]), str(gatter["nach"])]
		var tor := wurzel.find_child(tor_name, true, false) as Node3D
		assert_true(tor != null, "%s wurde gebaut" % tor_name)
		if tor == null:
			continue
		var aabb := _merged_aabb(tor)
		var achse := (tor.basis * _laengste_achse_von(aabb.size)).normalized()
		var dot := absf(achse.dot(weg.normalized()))
		assert_true(
			dot < GATTER_QUER_DOT, "%s steht nicht quer zum Weg (|dot|=%.2f)" % [tor_name, dot]
		)
		_pruefe_aufrecht(tor.basis, tor_name)
		geprueft += 1
	assert_eq(geprueft, RanchWegenetz.GATTER.size(), "alle Gatter geprüft")
	wurzel.free()


## ------------------------------------------------------------ Werkzeug


## Basis steht aufrecht: Up-Vektor = UP, Spalten orthogonal, keine Spiegelung.
func _pruefe_aufrecht(basis: Basis, wer: String) -> void:
	var x := basis.x.normalized()
	var y := basis.y.normalized()
	var z := basis.z.normalized()
	assert_true(y.dot(Vector3.UP) > 0.999, "%s: kippt (Up-Vektor %s)" % [wer, y])
	assert_true(
		absf(x.dot(y)) < 0.001 and absf(x.dot(z)) < 0.001 and absf(y.dot(z)) < 0.001,
		"%s: Basis nicht orthogonal (geschert)" % wer
	)
	assert_true(basis.determinant() > 0.0, "%s: gespiegelt" % wer)


## Zaun-Kette: jede Latte muss (mit ihrer Längsachse) zu einem ihrer bis
## zu drei nächsten Nachbarn zeigen — an Ecken zählt der beste Treffer.
func _pruefe_kette(transforms_raw: Array, achse_lokal: Vector3, wo: String) -> void:
	var transforms: Array[Transform3D] = []
	for t in transforms_raw:
		transforms.append(t as Transform3D)
	if transforms.size() < 2:
		return
	for i in transforms.size():
		var achse := (transforms[i].basis * achse_lokal).normalized()
		var flach := Vector2(achse.x, achse.z)
		assert_true(flach.length() > 0.7, "%s[%d]: Latte liegt nicht waagerecht" % [wo, i])
		if flach.length() <= 0.0001:
			continue
		var best := 0.0
		for j in _nachbarn(transforms, i, 3):
			var richtung := transforms[j].origin - transforms[i].origin
			var richtung_flach := Vector2(richtung.x, richtung.z)
			if richtung_flach.length() < 0.01:
				continue
			best = maxf(best, absf(flach.normalized().dot(richtung_flach.normalized())))
		assert_true(
			best > KETTEN_DOT,
			"%s[%d]: Latte quer zur Zaunlinie (bester dot=%.2f) — radiale Speiche?" % [wo, i, best]
		)


## Indizes der `anzahl` nächsten Nachbarn von Instanz `i` (XZ-Abstand).
func _nachbarn(transforms: Array[Transform3D], i: int, anzahl: int) -> Array[int]:
	var kandidaten: Array = []
	for j in transforms.size():
		if j == i:
			continue
		var d := transforms[j].origin - transforms[i].origin
		kandidaten.append([Vector2(d.x, d.z).length_squared(), j])
	kandidaten.sort()
	var out: Array[int] = []
	for k in mini(anzahl, kandidaten.size()):
		out.append(int(kandidaten[k][1]))
	return out


func _ist_ausnahme(datei: String) -> bool:
	for praefix in BODEN_AUSNAHMEN:
		if datei.begins_with(praefix):
			return true
	return false


func _laengste_achse_von(groesse: Vector3) -> Vector3:
	if groesse.x >= groesse.y and groesse.x >= groesse.z:
		return Vector3.RIGHT
	if groesse.z >= groesse.y:
		return Vector3.BACK
	return Vector3.UP


## Zusammengeführte AABB aller Meshes eines GLB im Modell-Ursprungsraum.
func _glb_aabb(pfad: String) -> AABB:
	if not ResourceLoader.exists(pfad):
		return AABB()
	var szene: PackedScene = load(pfad)
	if szene == null:
		return AABB()
	var proto: Node = szene.instantiate()
	if not (proto is Node3D):
		proto.free()
		return AABB()
	var aabb := _merged_aabb(proto as Node3D)
	proto.free()
	return aabb


func _merged_aabb(wurzel: Node3D) -> AABB:
	var gesamt := AABB()
	var leer := true
	for kind in wurzel.find_children("*", "MeshInstance3D", true, false):
		var mi: MeshInstance3D = kind
		if mi.mesh == null:
			continue
		var rel := Transform3D.IDENTITY
		var n: Node = mi
		while n != null and n != wurzel:
			if n is Node3D:
				rel = (n as Node3D).transform * rel
			n = n.get_parent()
		var box := rel * mi.mesh.get_aabb()
		if leer:
			gesamt = box
			leer = false
		else:
			gesamt = gesamt.merge(box)
	return gesamt
