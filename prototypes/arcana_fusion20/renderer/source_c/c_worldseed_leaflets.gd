## Original C16 leaflets sprouting from the outer leaves, selected behind
## the A growth lead; full-world fidelity and owner review remain open.
extends RefCounted
class_name CWorldseedLeaflets
const CX := 244.0
const CY := 106.0
const SY := 0.78
static func _fold(t: float, d: float) -> float:
    return 1.0 - CMath.ease_in_out(CMath.inv(8.0 + d, 9.3 + d, t))
func render(f: CFrame, t: float) -> void:
    var folded := _fold(t,0.35)
    var lg := CMath.inv(5.0,6.0,t) * folded
    if lg <= 0.0: return
    CPalette._ensure()
    for k in range(7):
        # Preserve the authored angle expression rather than simplifying it.
        var a := (float(k)/7.0 + 0.2/7.0)*CMath.TAU + 0.2-0.2 + (0.2/7.0)*0.0
        var bp := Vector2(CX + cos(a+0.0)*76.0*0.7*folded, CY + sin(a)*76.0*0.7*SY*folded)
        for side in [-1,1]:
            var aa := a + float(side)*0.7
            var tip := Vector2(bp.x + cos(aa)*14.0*lg, bp.y + sin(aa)*14.0*lg*SY)
            f.ribbon([bp,tip],[0.6,2.6*lg],func(x: int,y: int,_q: float,e: float) -> void:
                f.Ic(x,y,CPalette.ramp(CPalette.P.leaf,0.7 if absf(e)<0.2 else 0.45),1.0))
