## Original C16 pulsing core disc, golden spiral motes and halo, isolated.
extends RefCounted
class_name CWorldseedCore
const CX := 244.0
const CY := 106.0
const SY := 0.78
func render(f: CFrame, t: float) -> void:
    var cg := CMath.inv(4.2,6.0,t) * CWorldseedMembranes._fold(t,-0.1)
    if cg <= 0.0: return
    CPalette._ensure()
    var age := t - 7.05
    var pulse := 0.0
    if age >= 0.0 and age <= 0.7:
        pulse = exp(-pow(age * 140.0,2.0)/30.0) * (1.0-age/0.7)
    var pr := 1.0+0.15*sin(t*6.0)
    f.disc_l(CX,CY,(3.0+cg*4.0)*pr,Vector3(1.0,0.9,0.6),0.45+pulse*1.5)
    for k in range(22):
        var r := 1.6*sqrt(float(k))*cg
        var a := float(k)*2.39996-t*1.2
        f.Lc(CX+cos(a)*r,CY+sin(a)*r*SY,Vector3(1.0,0.85,0.4),0.6)
    f.glow(CX,CY,30.0,CPalette.ramp(CPalette.P.gold,0.8),0.22*cg,4.0)
