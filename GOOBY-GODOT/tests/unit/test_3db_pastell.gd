extends TestCase
## Wache F5b (PT-MG-B, Politur-Welle): die Nature-Kit-GLBs tragen ihre Farbe
## als baseColorFactor MIT metallicFactor 1 — auf der reflexionslosen
## 3D-B-Bühne (stage3d: REFLECTION_SOURCE_DISABLED) rendert Voll-Metall fast
## schwarz (runner-Bäume). Die Modellbank MUSS solche Materialien
## entmetallisieren und das Kenney-Türkis auf die Pastellpalette ziehen
## (Props3D.NATURE, gleicher Kanon wie die 3D-A-Bühne); die colormap-Kits
## (Straßen/Häuser/Autos, metallic 0 + Textur) bleiben unangetastet.

const Models := preload("res://scripts/minigames/games/_3db_stage/model_bank.gd")
const Props3D := preload("res://scripts/minigames/games/_3da_stage/props3d.gd")

## Die Fast-Schwarz-Kandidaten des Runners (F5b) + die geteilten Stadt-Bäume
## von cityDrive/deliveryRush — alle aus flachfarbigen Kenney-Kits.
const NATUR_PFADE: Array[String] = [
	"res://assets/city/natur/tree_default.glb",
	"res://assets/minigames/runner/nature-kit/tree_oak.glb",
	"res://assets/city/natur/plant_bushLarge.glb",
	"res://assets/city/natur/rock_smallA.glb",
]
## Colormap-Referenz: texturiertes City-Kit, muss unverändert bleiben.
const COLORMAP_PFAD := "res://assets/city/strassen/road-straight.glb"


func test_natur_kits_entmetallisiert_und_pastell() -> void:
	for path in NATUR_PFADE:
		var parts := Models.parts(path, 1.9)
		assert_true(parts.size() > 0, "keine Teile aus %s" % path)
		for entry: Dictionary in parts:
			var mesh: Mesh = entry["mesh"]
			for i in mesh.get_surface_count():
				var mat := mesh.surface_get_material(i) as BaseMaterial3D
				assert_true(mat != null, "%s[%d]: kein BaseMaterial3D" % [path, i])
				if mat == null:
					continue
				assert_almost(
					mat.metallic,
					0.0,
					1e-6,
					"%s[%d] (%s) noch metallisch" % [path, i, mat.resource_name]
				)


func test_laub_liegt_auf_der_pastellpalette() -> void:
	# Kenney-leafsGreen ist Türkis (0.16, 0.79, 0.67) — nach dem Angleich muss
	# GENAU die NATURE-Farbe der 3D-A-Bühne stehen (ein Kanon für alle Spiele).
	var soll: Color = Props3D.NATURE["leafsGreen"]
	for path: String in [NATUR_PFADE[0], NATUR_PFADE[1]]:
		var gefunden := false
		for entry: Dictionary in Models.parts(path):
			var mesh: Mesh = entry["mesh"]
			for i in mesh.get_surface_count():
				var mat := mesh.surface_get_material(i) as BaseMaterial3D
				if mat == null or mat.resource_name != "leafsGreen":
					continue
				gefunden = true
				assert_true(
					mat.albedo_color.is_equal_approx(soll),
					"%s: Laubfarbe %s statt Pastell %s" % [path, mat.albedo_color, soll]
				)
		assert_true(gefunden, "%s: keine leafsGreen-Oberfläche gefunden" % path)


func test_colormap_kit_bleibt_original() -> void:
	# Straßen-/Häuser-Kits (metallic 0, colormap-Textur) dürfen NICHT durch den
	# Pastell-Angleich laufen — sonst verlieren sie ihre Textur.
	var parts := Models.parts(COLORMAP_PFAD, 4.6)
	assert_true(parts.size() > 0, "keine Teile aus %s" % COLORMAP_PFAD)
	for entry: Dictionary in parts:
		var mesh: Mesh = entry["mesh"]
		for i in mesh.get_surface_count():
			var mat := mesh.surface_get_material(i) as BaseMaterial3D
			assert_true(mat != null, "%s[%d]: kein BaseMaterial3D" % [COLORMAP_PFAD, i])
			if mat == null:
				continue
			assert_true(
				mat.albedo_texture != null, "%s[%d]: colormap-Textur verloren" % [COLORMAP_PFAD, i]
			)
			assert_almost(mat.metallic, 0.0, 1e-6, "%s[%d] metallisch" % [COLORMAP_PFAD, i])
