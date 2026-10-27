extends SceneTree
const Seg = preload("res://prototypes/gold_fidelity/segment_math.gd")
func _initialize() -> void:
    var fails := 0
    if Seg.strength_at(-1.0) != 0.0 or Seg.strength_at(0.0) != 0.0 or Seg.strength_at(2.0) != 0.0: fails += 1
    if absf(Seg.strength_at(0.3) - 1.8) > 0.00001: fails += 1
    if absf(Seg.strength_at(1.6) - 1.8) > 0.00001: fails += 1
    if absf(Seg.strength_at(1.8) - 0.9) > 0.00001: fails += 1
    if Seg.displacement_at(Vector2(180, 178), 1.0, 0.5) != Vector2.ZERO: fails += 1
    var a: Vector2 = Seg.displacement_at(Vector2(180, 142), 1.0, 0.7)
    var b: Vector2 = Seg.displacement_at(Vector2(180, 140), 1.0, 0.7)
    if a.y <= 0.0 or b.y >= 0.0: fails += 1
    if Seg.displacement_at(Vector2(180, 141), 1.0, 0.7).y <= 0.0: fails += 1
    print("GOLD_SEGMENT_MATH: %s" % ("PASS" if fails == 0 else "FAIL %d" % fails))
    quit(0 if fails == 0 else 1)
