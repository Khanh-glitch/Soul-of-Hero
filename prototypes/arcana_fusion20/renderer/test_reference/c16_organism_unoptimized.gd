## Original C16 layered leaves / cellular and trembling petals, isolated.
## Candidate only: fusion stacking and owner review are not resolved.
extends RefCounted
class_name CWorldseedOrganismReference
const CX := 244.0
const CY := 106.0
const SY := 0.78
static func _fold(t: float, d: float) -> float:
    return 1.0 - CMath.ease_in_out(CMath.inv(8.0 + d, 9.3 + d, t))
static func _pulse(t: float, j: int, r: float) -> float:
    var a: float = t - float([6.0,6.35,6.7,7.05][j])
    if a < 0.0 or a > 0.7: return 0.0
    return exp(-pow(r - a * 140.0, 2.0) / 30.0) * (1.0 - a / 0.7)
func render(f: CFrame, t: float) -> void:
    if t < 2.5: return
    CPalette._ensure()
    var lay: Array[Dictionary] = [
        {"n":12,"off":0.0,"l":18.0 * CMath.ease_out(CMath.inv(3.8,5.0,t)) * _fold(t,0.0),"wd":3.4,"tw":0.045,"kind":2},
        {"n":9,"off":0.5,"l":38.0 * CMath.back_out(CMath.inv(3.2,4.6,t),1.4) * _fold(t,0.15),"wd":9.0,"tw":0.0,"kind":1},
        {"n":7,"off":0.2,"l":76.0 * CMath.ease_out(CMath.inv(2.6,6.0,t),2.0) * _fold(t,0.35),"wd":17.0,"tw":0.0,"kind":0}]
    f.field(CX-80.0,CY-80.0*SY,CX+80.0,CY+80.0*SY,func(x: int,y: int) -> void:
        var dx := float(x)+0.5-CX
        var dy := (float(y)+0.5-CY)/SY
        var r := sqrt(dx*dx+dy*dy)
        if r > 80.0: return
        var pa := atan2(dy,dx)
        for l in lay:
            var length: float = l.l
            if length < 1.0 or r > length: continue
            var kind: int = l.kind
            for k in range(int(l.n)):
                var ang := ((float(k)+float(l.off))/float(l.n))*CMath.TAU + (t*0.05 if kind==1 else 0.0) + sin(t*31.0+float(k)*1.7)*float(l.tw) + (1.0-_fold(t,0.2))*1.6
                var u := r/length
                var hw := float(l.wd)*pow(sin(PI*minf(1.0,u)),0.8)*(1.0-0.25*u)
                var v := CMath.ang_diff(ang,pa)*r/maxf(hw,0.3)
                if absf(v)>=1.0: continue
                var th := CMath.bayer(x,y)
                var av := absf(v)
                if kind==0:
                    var unf := CMath.ease_out(CMath.inv(2.6,6.0,t),2.0)
                    var tone := 0.28+0.2*(1.0-av)
                    if av<0.1: tone+=0.25
                    if fposmod(u*9.0-av*1.5,1.0)<0.12: tone+=0.12
                    if unf<1.0 and u>0.86: tone+=0.25
                    if av>0.86: tone=0.12
                    f.Ic(x,y,CPalette.ramp_d(CPalette.P.leaf,tone,th),1.0)
                    var p0 := _pulse(t,0,r)
                    if p0>0.05 and (fmod(u*18.0+av*3.0,1.0)<0.14 or av<0.12):
                        f.Lc(x,y,CPalette.ramp(CPalette.P.leaf,1.0),p0*1.4)
                elif kind==1:
                    var cu := u*7.0+CMath.hash2(k,floori(u*7.0))*0.3
                    var cv := (v+1.0)*2.5
                    var wall := fmod(cu,1.0)<0.16 or fmod(cv,1.0)<0.16
                    var lit := u<(t-4.3)*0.55
                    f.Ic(x,y,CPalette.ramp_d(CPalette.P.bloom,0.25+0.42*(1.0-av)+(0.15 if wall else 0.0),th),1.0)
                    if lit and not wall: f.Lc(x,y,CPalette.ramp(CPalette.P.bloom,0.8),0.12+_pulse(t,2,r)*1.2)
                    if av>0.85: f.Ic(x,y,CPalette.ramp(CPalette.P.bloom,0.15),1.0)
                else:
                    f.Ic(x,y,CPalette.ramp_d(CPalette.P.gold,0.55+0.4*(1.0-av),th),1.0)
                    f.Lc(x,y,CPalette.ramp(CPalette.P.gold,0.9),0.25+_pulse(t,3,r)*1.5)
                return)
