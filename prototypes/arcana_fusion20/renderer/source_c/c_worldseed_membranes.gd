## Original C16 living membrane wedges and branching veins, isolated candidate.
## This is one C-authored role, not full Worldseed or a creator-approved fusion.
extends RefCounted
class_name CWorldseedMembranes
const C := Vector2(244,106)
const SYW := 0.78
var trees: Array = []
func setup() -> void:
    CPalette._ensure()
    var rng := CMath.CRng.new(CWorldseedDebris.SEED)
    trees.clear()
    for k in range(7):
        trees.append(CKit.grow_tree(rng, {"x": C.x,"y": C.y,"ang": (float(k) + 0.5) / 7.0 * CMath.TAU + 0.2,
            "step": 4,"steps": 11,"speed": 22,"branch": 0.45,"spread": 0.45,"jitter": 0.25,"maxDepth": 2,"t0": 3.4,"sy": SYW}))
static func _fold(t: float, d: float) -> float:
    return 1.0 - CMath.ease_in_out(CMath.inv(8.0 + d, 9.3 + d, t))
static func _pulse(t: float, r: float) -> float:
    var age := t - 6.35
    if age < 0.0 or age > 0.7: return 0.0
    var rw := age * 140.0
    return exp(-pow(r - rw, 2.0) / 30.0) * (1.0 - age / 0.7)
func render(f: CFrame, t: float) -> void:
    var mg := CMath.inv(3.3,5.0,t) * _fold(t,0.1)
    if mg <= 0.0: return
    var membrane_color := CPalette.ramp(CPalette.P.spore, 0.7)
    var vein_color := CPalette.ramp(CPalette.P.spore, 0.85)
    for k in range(7):
        var a0 := float(k) / 7.0 * CMath.TAU + 0.2
        var a1 := float(k + 1) / 7.0 * CMath.TAU + 0.2
        var radius := 50.0 * mg
        var wedge: Array = [C]
        for i in range(6):
            var a := CMath.lerp(a0 + 0.15,a1 - 0.15,float(i) / 5.0)
            wedge.append(Vector2(C.x + cos(a) * radius,C.y + sin(a) * radius * SYW))
        f.poly(wedge, func(x: int, y: int) -> void:
            var dx := float(x) - C.x
            var dy := (float(y) - C.y) / SYW
            var r := sqrt(dx * dx + dy * dy)
            f.Lc(x,y,membrane_color,0.07 + _pulse(t,r) * 0.8))
        CKit.draw_tree(f, trees[k], t, func(x: int, y: int, _seg: Dictionary, _age: float) -> void:
            var dx := float(x) - C.x
            var dy := (float(y) - C.y) / SYW
            var r := sqrt(dx * dx + dy * dy)
            if r < radius: f.Lc(x,y,vein_color,0.3 + _pulse(t,r) * 1.2))
