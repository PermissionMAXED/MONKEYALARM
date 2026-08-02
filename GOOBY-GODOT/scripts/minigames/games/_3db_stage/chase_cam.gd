extends RefCounted
## Verfolgerkamera-Kollision fürs deliveryRush/cityDrive-Kameramuster
## (PT-minigames-a F2): lenkt man den Wagen an eine Hausecke, stand der
## Kamera-Boom (Wagen → Wunsch-Kamera) sekundenlang IN einem Gebäude —
## Vollbild dunkel, nur HUD sichtbar, bis die Lerp-Kamera sich fing.
##
## `clip_xz` kürzt den Boom in der Bodenebene (x, z) auf den ersten
## Wandkontakt plus Sicherheitsabstand; die y-Höhe bleibt, die Kamera rückt
## also näher und damit steiler an den Wagen heran statt in die Wand.
## PURE Statik (headless testbar) — die Kollider sind dieselben
## minX/maxX/minZ/maxZ-Dictionaries, gegen die auch der Wagen fährt
## (`layout_colliders`/`_blocked` der beiden Fahrspiele).

## Sicherheitsabstand vor der Wand (m): deutlich mehr als die Near-Plane,
## damit auch schräge Blickwinkel keine Wandkante ins Bild ziehen.
const MARGIN_M := 0.6


## Kamera-Boom clippen: `anchor` = Wagen, `wanted` = Wunsch-Kamera (beide in
## Weltmetern). Liefert `wanted` unverändert, wenn die Strecke frei ist —
## sonst den Punkt kurz VOR der ersten Kollider-Wand. Klebt der Wagen selbst
## an der Wand (Restweg < MARGIN_M), bleibt die Kamera höchstens beim Wagen
## stehen, nie hinter der Wand.
static func clip_xz(anchor: Vector3, wanted: Vector3, colliders: Array) -> Vector3:
	var from := Vector2(anchor.x, anchor.z)
	var seg := Vector2(wanted.x, wanted.z) - from
	var length := seg.length()
	if length < 0.001:
		return wanted
	var t_hit := 1.0
	for box in colliders:
		t_hit = minf(t_hit, _entry_t(from, seg, box as Dictionary))
	if t_hit >= 1.0:
		return wanted
	var safe := from + seg * maxf(0.0, t_hit - MARGIN_M / length)
	return Vector3(safe.x, wanted.y, safe.y)


## Slab-Test in 2D: kleinstes t in [0, 1], bei dem die Strecke die Box
## betritt — 1.0, wenn sie sie im Streckenstück gar nicht trifft. Der Wagen
## selbst kann nie IN einem Kollider stehen (`_blocked` hält ihn draußen),
## t = 0 kommt also nur vor, wenn der Anker exakt auf der Wand klebt.
static func _entry_t(from: Vector2, seg: Vector2, box: Dictionary) -> float:
	var lo := Vector2(float(box["minX"]), float(box["minZ"]))
	var hi := Vector2(float(box["maxX"]), float(box["maxZ"]))
	var t_enter := 0.0
	var t_exit := 1.0
	for axis in 2:
		if absf(seg[axis]) < 0.000001:
			# Parallel zur Achse: außerhalb des Slabs gibt es keinen Treffer.
			if from[axis] <= lo[axis] or from[axis] >= hi[axis]:
				return 1.0
			continue
		var t_a := (lo[axis] - from[axis]) / seg[axis]
		var t_b := (hi[axis] - from[axis]) / seg[axis]
		t_enter = maxf(t_enter, minf(t_a, t_b))
		t_exit = minf(t_exit, maxf(t_a, t_b))
		if t_enter >= t_exit:
			return 1.0
	return t_enter
