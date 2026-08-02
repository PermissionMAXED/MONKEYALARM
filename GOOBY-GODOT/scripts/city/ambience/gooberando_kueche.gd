class_name GooberandoKueche
extends Node3D
## „Blick in die Küche“ (GOOBY LOOP, GOOBERANDO-Ambience): kleines
## 3D-Interieur für die Küchen-Phase der GOOBERANDO-App — Marken-Tresen
## mit orangem GOOBERANDO-Band, Koch-Gooby mit weißer Kochmütze am
## dampfenden Topf, Regal mit Vorrats-Dosen und die gepackte Papiertüte.
## Bordmittel-Primitive statt Assets (Muster Papiertüte, Doc E §5) und das
## ROHE gooby.glb + AnimationPlayer statt GoobyRig (billig, Muster
## OrtLeben-Besucher) — das Porträt lebt in einem SubViewport der App.
##
## Lebendigkeit: der Topfdeckel klappert im Sinus-Takt (deckel_hub, PURE)
## und der Dampf steigt als CPUParticles3D auf (preprocess ⇒ ab dem ersten
## Frame eingeschwungen — WICHTIG, weil die App die Ansicht bei
## Phasen-Wechseln neu baut). Reduced Motion: Deckel ruht (kein _process),
## halber Dampf (dampf_menge, PURE) — die Küche bleibt erkennbar.

## Markenfarbe (wie GooberandoApp.ORANGE — die Küche gehört zur Marke).
const ORANGE := Color("#FF7A00")
## Dampf-Teilchen voll; Reduced Motion halbiert (dampf_menge).
const DAMPF_MENGE := 16
## Deckel-Klappern: Hub-Amplitude (m) und Sinus-Takt (rad/s).
const DECKEL_HUB_M := 0.012
const DECKEL_TAKT := 5.2

## Test-Hook: Reduced Motion erzwingen (-1 = AppSettings fragen).
var reduced_override := -1

var _deckel: MeshInstance3D
var _deckel_basis_y := 0.0
var _zeit := 0.0


func _ready() -> void:
	_baue_raum()
	_baue_topf()
	_baue_koch()
	var tuete := baue_papier_tuete()
	tuete.position = Vector3(-0.28, 0.6, 0.32)
	tuete.rotation_degrees = Vector3(0.0, 24.0, 0.0)
	add_child(tuete)
	set_process(not _reduziert())


func _process(delta: float) -> void:
	_zeit += delta
	if _deckel != null:
		_deckel.position.y = _deckel_basis_y + deckel_hub(_zeit)


## ------------------------------------------------------------ Pure Helfer


## Dampf-Menge nach Bewegungs-Vorliebe: Reduced Motion = halber Dampf.
static func dampf_menge(reduziert: bool) -> int:
	return DAMPF_MENGE / 2 if reduziert else DAMPF_MENGE


## Deckel-Hub zum Zeitpunkt `zeit` (s): |sin| ⇒ der Deckel setzt immer
## wieder auf dem Topf auf (klappern statt schweben), begrenzt auf HUB.
static func deckel_hub(zeit: float) -> float:
	return absf(sin(zeit * DECKEL_TAKT)) * DECKEL_HUB_M


## -------------------------------------------------------------- Bausteine


## Weiße Kochmütze (Bund + Puff) — Schwester des OrtLeben-Käppis, sitzt
## wie dieses am Wurzel-Node des rohen Gooby-GLB (kein Bone-Attachment).
static func baue_kochmuetze() -> Node3D:
	var muetze := Node3D.new()
	muetze.name = "Kochmuetze"
	muetze.position = Vector3(0.0, 1.02, 0.02)
	muetze.rotation_degrees = Vector3(-6.0, 0.0, 0.0)
	var weiss := StandardMaterial3D.new()
	weiss.albedo_color = Color("#F7F5EE")
	weiss.roughness = 0.85
	var bund := MeshInstance3D.new()
	var bund_mesh := CylinderMesh.new()
	bund_mesh.top_radius = 0.12
	bund_mesh.bottom_radius = 0.095
	bund_mesh.height = 0.12
	bund.mesh = bund_mesh
	bund.material_override = weiss
	bund.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	bund.position = Vector3(0.0, 0.05, 0.0)
	muetze.add_child(bund)
	var puff := MeshInstance3D.new()
	var puff_mesh := SphereMesh.new()
	puff_mesh.radius = 0.125
	puff_mesh.height = 0.16
	puff.mesh = puff_mesh
	puff.material_override = weiss
	puff.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	puff.position = Vector3(0.0, 0.13, 0.0)
	muetze.add_child(puff)
	return muetze


## Die GOOBERANDO-Papiertüte (Doc E §5-Kleinteil, Bordmittel statt Asset):
## brauner Korpus + oranges Marken-Band. Hierher gezogen (vorher privat in
## der App), damit Tür-Porträt UND Küche dieselbe Tüte tragen.
static func baue_papier_tuete() -> Node3D:
	var tuete := Node3D.new()
	tuete.name = "PapierTuete"
	tuete.position = Vector3(0.42, 0.0, 0.28)
	tuete.rotation_degrees = Vector3(0.0, -18.0, 0.0)
	var korpus := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.26, 0.32, 0.18)
	var papier := StandardMaterial3D.new()
	papier.albedo_color = Color("#D9B48A")
	papier.roughness = 0.9
	box.material = papier
	korpus.mesh = box
	korpus.position = Vector3(0.0, 0.16, 0.0)
	tuete.add_child(korpus)
	var band := MeshInstance3D.new()
	var streifen := BoxMesh.new()
	streifen.size = Vector3(0.262, 0.07, 0.182)
	var marke := StandardMaterial3D.new()
	marke.albedo_color = ORANGE
	marke.roughness = 0.7
	streifen.material = marke
	band.mesh = streifen
	band.position = Vector3(0.0, 0.18, 0.0)
	tuete.add_child(band)
	return tuete


## ---------------------------------------------------------------- intern


func _reduziert() -> bool:
	if reduced_override >= 0:
		return reduced_override == 1
	var settings := get_node_or_null("/root/AppSettings")
	return settings != null and settings.is_reduced_motion()


## Rückwand + Marken-Band + Boden + Regal mit Vorrats-Dosen + Tresen
## (Korpus, oranges Frontband, helle Platte) — alles simple Box-Primitives.
func _baue_raum() -> void:
	_quader("Wand", Vector3(3.4, 2.1, 0.1), Vector3(0.0, 1.05, -1.15), Color("#F4EADA"))
	_quader("MarkenBand", Vector3(3.4, 0.18, 0.11), Vector3(0.0, 1.55, -1.145), ORANGE)
	_quader("Boden", Vector3(3.4, 0.1, 2.8), Vector3(0.0, -0.05, 0.1), Color("#B9AFA2"))
	_quader("Regal", Vector3(1.2, 0.05, 0.24), Vector3(-0.95, 1.18, -1.0), Color("#C99B6A"))
	_quader("Dose", Vector3(0.14, 0.16, 0.14), Vector3(-1.2, 1.29, -1.0), Color("#4FBF8B"))
	var dose := _zylinder("Dose2", 0.07, 0.18, Vector3(-0.78, 1.3, -1.0), Color("#F2C14E"))
	dose.rotation_degrees = Vector3(0.0, 12.0, 0.0)
	_quader("Tresen", Vector3(2.4, 0.55, 0.5), Vector3(0.0, 0.275, 0.35), Color("#C99B6A"))
	_quader("TresenBand", Vector3(2.4, 0.12, 0.51), Vector3(0.0, 0.4, 0.355), ORANGE)
	_quader("TresenPlatte", Vector3(2.5, 0.05, 0.56), Vector3(0.0, 0.575, 0.35), Color("#EFE3CE"))


## Herdplatte + Topf + klappernder Deckel (mit Knauf) + Dampf-Partikel.
func _baue_topf() -> void:
	_zylinder("Herdplatte", 0.21, 0.02, Vector3(0.35, 0.61, 0.35), Color("#3C4048"))
	var topf := _zylinder("Topf", 0.17, 0.2, Vector3(0.35, 0.72, 0.35), Color("#4E5560"))
	(topf.material_override as StandardMaterial3D).metallic = 0.35
	_deckel = _zylinder("TopfDeckel", 0.185, 0.03, Vector3(0.35, 0.835, 0.35), Color("#9AA1AC"))
	_deckel_basis_y = _deckel.position.y
	var knauf := MeshInstance3D.new()
	var kugel := SphereMesh.new()
	kugel.radius = 0.035
	kugel.height = 0.07
	knauf.mesh = kugel
	knauf.material_override = _deckel.material_override
	knauf.position = Vector3(0.0, 0.035, 0.0)
	_deckel.add_child(knauf)
	_baue_dampf()


func _baue_dampf() -> void:
	var dampf := CPUParticles3D.new()
	dampf.name = "Dampf"
	dampf.position = Vector3(0.35, 0.88, 0.35)
	dampf.amount = dampf_menge(_reduziert())
	dampf.lifetime = 1.7
	# Eingeschwungen ab Frame 1: die App baut das Porträt bei Phasen-
	# Wechseln neu — ohne preprocess würde der Topf jedes Mal „kalt“ starten.
	dampf.preprocess = 1.7
	dampf.direction = Vector3.UP
	dampf.spread = 8.0
	dampf.gravity = Vector3(0.0, 0.35, 0.0)
	dampf.initial_velocity_min = 0.22
	dampf.initial_velocity_max = 0.4
	dampf.scale_amount_min = 0.55
	dampf.scale_amount_max = 1.0
	dampf.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	dampf.emission_sphere_radius = 0.06
	var quad := QuadMesh.new()
	quad.size = Vector2(0.12, 0.12)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.albedo_color = Color(1.0, 1.0, 1.0, 0.34)
	quad.material = mat
	dampf.mesh = quad
	add_child(dampf)


## Koch-Gooby: rohes GLB (OrtLeben-Muster), Blick leicht zum Topf gedreht,
## Kochmütze auf, idle-Loop wenn der Importer einen mitbringt.
func _baue_koch() -> void:
	if not ResourceLoader.exists(OrtLeben.GOOBY_GLB):
		return
	var szene: PackedScene = load(OrtLeben.GOOBY_GLB)
	if szene == null:
		return
	var koch: Node3D = szene.instantiate()
	koch.name = "Koch"
	koch.position = Vector3(0.0, 0.0, -0.55)
	koch.rotation_degrees = Vector3(0.0, 21.0, 0.0)
	add_child(koch)
	koch.add_child(baue_kochmuetze())
	var player: AnimationPlayer = koch.find_child("AnimationPlayer", true, false)
	if player == null:
		return
	for anim_name: String in ["idle", "idle-loop", "walk"]:
		if player.has_animation(anim_name):
			player.play(anim_name)
			return


func _quader(node_name: String, groesse: Vector3, pos: Vector3, farbe: Color) -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	mesh_node.name = node_name
	var box := BoxMesh.new()
	box.size = groesse
	mesh_node.mesh = box
	mesh_node.material_override = _matt(farbe)
	mesh_node.position = pos
	add_child(mesh_node)
	return mesh_node


func _zylinder(
	node_name: String, radius: float, hoehe: float, pos: Vector3, farbe: Color
) -> MeshInstance3D:
	var mesh_node := MeshInstance3D.new()
	mesh_node.name = node_name
	var zylinder := CylinderMesh.new()
	zylinder.top_radius = radius
	zylinder.bottom_radius = radius
	zylinder.height = hoehe
	mesh_node.mesh = zylinder
	mesh_node.material_override = _matt(farbe)
	mesh_node.position = pos
	add_child(mesh_node)
	return mesh_node


func _matt(farbe: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = farbe
	mat.roughness = 0.9
	return mat
