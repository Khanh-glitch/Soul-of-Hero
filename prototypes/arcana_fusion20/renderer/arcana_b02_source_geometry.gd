## Native 60Hz geometry port of ORIGINAL B sources/B/src/effects/pyre.ts
## furnaceWyrm (#02, RNG seed 202). Not a baked 30Hz atlas, Gold screenshot,
## or a simulated player/enemy. R4 alone owns damage and A body reaction.
## Geometry, head path, segment lag, contract and impact are source-derived;
## additive light/ground/post need image parity review before Gold acceptance.
extends Node2D
class_name ArcanaB02SourceGeometry

signal visual_contact_cue(world_position: Vector2)
signal finished()

const DURATION := 7.6
const CONTACT_T := 4.98
const NSEG := 48
const RAMP: Array[Vector3] = [
    Vector3(0.0,0.0,0.0),Vector3(0.3,0.02,0.03),
    Vector3(0.85,0.07,0.04),Vector3(1.6,0.48,0.06),
    Vector3(2.2,1.35,0.3),Vector3(3.0,2.7,2.0)
]
var elapsed := 0.0
var active := false
var origin := Vector2.ZERO
var target := Vector2.ZERO
var _control: Array[Vector2] = []
var _cracks: Array[Dictionary] = []
var _debris: Array[Dictionary] = []
var _contact_emitted := false
var _last_frame_us := 0
var _max_draw_ms := 0.0
var _draw_count := 0


func _ready() -> void:
    # Source's ground, air and body passes must stay behind/on top of real actors
    # by the parent world. This node only draws source B's spell geometry.
    z_index = 1
    set_process(true)


func begin(caster_world: Vector2, target_world: Vector2) -> void:
    origin = caster_world
    target = target_world
    elapsed = 0.0
    _contact_emitted = false
    _max_draw_ms = 0.0
    _draw_count = 0
    _build_source_202()
    active = true
    queue_redraw()


func stop() -> void:
    if not active:
        return
    active = false
    queue_redraw()
    finished.emit()


func _process(delta: float) -> void:
    if not active:
        return
    elapsed += maxf(delta,0.0)
    if not _contact_emitted and elapsed >= CONTACT_T:
        _contact_emitted = true
        # Visual cue only. No HP mutation and no fictitious guaranteed hit.
        visual_contact_cue.emit(target)
    if elapsed >= DURATION:
        stop()
    else:
        queue_redraw()


func _smooth(a: float, b: float, t: float) -> float:
    var u := clampf((t-a)/maxf(0.000001,b-a),0.0,1.0)
    return u*u*(3.0-2.0*u)


func _ease_out(u: float) -> float:
    var x := clampf(u,0.0,1.0)
    return 1.0-pow(1.0-x,3.0)


func _ease_in(u: float) -> float:
    var x := clampf(u,0.0,1.0)
    return x*x*x


func _ease_in_out(u: float) -> float:
    var x := clampf(u,0.0,1.0)
    return x*x*(3.0-2.0*x)


func _catmull(u: float) -> Vector2:
    var f := clampf(u,0.0,1.0)*float(_control.size()-1)
    var i := mini(floori(f),_control.size()-2)
    var t := f-float(i)
    var a := _control[maxi(0,i-1)]
    var b := _control[i]
    var c := _control[i+1]
    var d := _control[mini(_control.size()-1,i+2)]
    var t2 := t*t
    var t3 := t2*t
    return (2.0*b+(-a+c)*t+(2.0*a-5.0*b+4.0*c-d)*t2+
        (-a+3.0*b-3.0*c+d)*t3)*0.5


func _orbit(tt: float) -> Vector3:
    var u := tt-2.1
    var ang := 2.6+u*3.1
    var rad := 50.0-u*5.0+sin(u*5.0)*4.0
    return Vector3(target.x+cos(ang)*rad,
        target.y+sin(ang)*rad*0.62,16.0+sin(ang+1.0)*11.0)


func head(tt: float) -> Vector3:
    if tt < 0.55:
        return Vector3(origin.x+4.0,origin.y+6.0,-4.0)
    if tt < 2.1:
        var u := (tt-0.55)/1.55
        var p := _catmull(_ease_in_out(u)*0.85+u*0.15)
        return Vector3(p.x,p.y,minf(16.0,(tt-0.55)*40.0)+sin(u*9.0)*4.0)
    if tt < 4.45:
        return _orbit(tt)
    var o := _orbit(4.45)
    var back := _ease_out((tt-4.45)/0.35)
    var strike := _ease_in((tt-4.8)/0.18)
    var bx := target.x+(o.x-target.x)*(1.0+back*0.6)
    var by := target.y+(o.y-target.y)*(1.0+back*0.6)-back*10.0
    return Vector3(lerpf(bx,target.x,strike),lerpf(by,target.y,strike),
        lerpf(o.z+back*22.0,0.0,strike))


func _build_source_202() -> void:
    var o0 := _orbit(2.1)
    _control = [
        origin+Vector2(4,6),origin+Vector2(-6,-20),
        origin+Vector2(-30,-62),origin+Vector2(30,-92),
        origin+Vector2(90,-40),origin+Vector2(70,30),
        Vector2((origin.x+target.x)*0.5+30.0,target.y+60.0),
        Vector2(o0.x,o0.y)
    ]
    var rng := RandomNumberGenerator.new()
    rng.seed = 202
    _cracks.clear()
    # Source B crackTree(9,80,0.4,3) family: deterministic radial branching.
    # Not exact B engine/fx.ts crackTree port; parity explicitly PARTIAL.
    for k in range(9):
        var a := float(k)*TAU/9.0+rng.randf_range(-0.2,0.2)
        var p := target
        for generation in range(3):
            var length := rng.randf_range(8.0,24.0)*(1.0-float(generation)*0.18)
            var q := p+Vector2(cos(a),sin(a)*0.6)*length
            _cracks.append({"a":p,"b":q,"generation":generation,"seed":rng.randf()})
            p = q
            a += rng.randf_range(-0.45,0.45)
    _debris.clear()
    for i in range(60):
        _debris.append({"angle":rng.randf_range(0.0,TAU),
            "v":rng.randf_range(30.0,170.0),
            "vz":rng.randf_range(60.0,190.0),
            "size":rng.randf_range(0.5,2.2),"seed":i})


func _fire(h: float, alpha: float = 1.0) -> Color:
    var q := clampf(h,0.0,1.0)*float(RAMP.size()-1)
    var i := mini(floori(q),RAMP.size()-2)
    var c: Vector3 = RAMP[i].lerp(RAMP[i+1],q-float(i))
    return Color(clampf(c.x,0.0,1.0),clampf(c.y,0.0,1.0),
        clampf(c.z,0.0,1.0),clampf(alpha,0.0,1.0))


func _px(p: Vector2, col: Color, size: float = 1.0) -> void:
    var s := maxf(1.0,roundf(size))
    draw_rect(Rect2(Vector2(roundf(p.x-s*0.5),roundf(p.y-s*0.5)),
        Vector2(s,s)),col,true)


func _stroke(a: Vector2,b: Vector2,width: float,col: Color) -> void:
    # Snap every stamp to the native pixel grid. No antialiased vector stroke.
    var d := a.distance_to(b)
    var count := maxi(1,ceili(d))
    for j in range(count+1):
        _px(a.lerp(b,float(j)/float(count)),col,width)


func _disc(p: Vector2,r: float,col: Color) -> void:
    var radius := maxi(1,roundi(r))
    for y in range(-radius,radius+1):
        var dx := floori(sqrt(maxf(0.0,float(radius*radius-y*y))))
        for x in range(-dx,dx+1):
            _px(p+Vector2(x,y),col)


func _ring(p: Vector2,r: float,col: Color) -> void:
    var steps := maxi(16,ceili(TAU*r*1.5))
    for i in range(steps):
        var a := TAU*float(i)/float(steps)
        _px(p+Vector2(cos(a)*r,sin(a)*r*0.62),col,1.0)


func _tongue(p: Vector2,height: float,width: float,t: float,seed: int,
        strength: float) -> void:
    if height < 1.0 or strength <= 0.0:
        return
    var sw := sin(t*7.0+seed*13.0)*width*0.6
    var hh := height*(0.75+0.25*sin(t*9.0+seed*3.0))
    for k in range(maxi(1,ceili(hh))):
        var u := float(k)/maxf(1.0,hh)
        var w := width*pow(1.0-u,0.8)
        var shift := sw*u+sin(t*11.0+seed*7.0)*width*0.2*u
        _stroke(p+Vector2(shift-w,-k),p+Vector2(shift+w,-k),
            1.0,_fire(0.48+0.5*u,strength*(1.0-u)))


func _draw() -> void:
    if not active:
        return
    var start_us := Time.get_ticks_usec()
    var t := elapsed
    var contract := _smooth(4.78,4.98,t)
    var lag := 0.029*(1.0-contract*0.96)
    var cr := _ease_out(t/0.55)
    if t < 6.0:
        var strength := (1.0 if t<0.6 else 0.4)*(1.0-_smooth(4.0,6.0,t))
        _stroke(origin+Vector2(-14*cr,7),origin+Vector2(18*cr,5),
            2.0,_fire(0.85,strength))
    if t >= 0.5 and t < CONTACT_T+0.02:
        var segments: Array[Dictionary] = []
        for i in range(NSEG):
            var tt := t-float(i)*lag
            if tt < 0.55:
                break
            var p := head(tt)
            var q := head(tt-0.02)
            var spd := Vector2(p.x-q.x,p.y-q.y).length()/0.02
            var direction := atan2(p.y-q.y-(p.z-q.z),p.x-q.x)
            segments.append({"p":p,"i":i,"spd":spd,"dir":direction})
        # Source depth order: z/y, not i; sprites remain real SOH actors.
        segments.sort_custom(func(a: Dictionary,b: Dictionary) -> bool:
            var pa: Vector3 = a.p
            var pb: Vector3 = b.p
            return pa.z < pb.z if absf(pa.z-pb.z)>0.001 else pa.y<pb.y)
        for seg: Dictionary in segments:
            var p: Vector3 = seg.p
            var i: int = seg.i
            var spd: float = seg.spd
            var stretch := clampf(spd/260.0,0.0,1.0)
            var taper := 1.0-float(i)/float(NSEG)
            var w := (2.2+4.5*taper)*(1.0-0.45*stretch)*(1.0+contract*0.6)
            var depth := 0.75+clampf(p.z/30.0,0.0,1.0)*0.35
            var center := Vector2(p.x,p.y-p.z)
            var next_tt := t-float(i+1)*lag
            if next_tt >= 0.55 and i+1 < NSEG:
                var n := head(next_tt)
                _stroke(center,Vector2(n.x,n.y-n.z),w*1.5,_fire(0.42*depth+stretch*0.25))
            _disc(center,w,_fire(0.38*depth+0.05))
            _disc(center,w*0.5,_fire((0.62+0.2*(1.0-stretch))*depth))
            if i%4==0:
                _px(center+Vector2(-1,-w*0.5),_fire(0.95))
            if i%2==0 and i>1:
                var a: float = seg.dir
                var backward := Vector2(cos(a),sin(a))
                var perpendicular := Vector2(-backward.y,backward.x)
                var base := center-backward*w*0.4
                _stroke(base,base-backward*w+perpendicular*w,1.0,_fire(0.8*depth))
                _stroke(base,base-backward*w-perpendicular*w,1.0,_fire(0.8*depth))
            if i%3==1:
                _tongue(center+Vector2(0,-w*0.4),
                    w*2.2*(1.0-stretch*0.5),w*0.7,t,i,0.35)
        # Head, maw, horns and bright eyes use source B's authored path.
        if not segments.is_empty():
            var h := head(t)
            var prev := head(t-0.02)
            var a := atan2(h.y-prev.y-(h.z-prev.z),h.x-prev.x)
            var forward := Vector2(cos(a),sin(a))
            var side := Vector2(-forward.y,forward.x)
            var center := Vector2(h.x,h.y-h.z)
            var maw := _smooth(4.45,4.85,t)
            var jaw := 0.35+0.25*sin(t*9.0)+maw*0.6
            var length := 9.0+maw*5.0
            _stroke(center-side*4,center+forward*length-side*jaw*7,
                3.0,_fire(0.55))
            _stroke(center+side*4,center+forward*length+side*jaw*7,
                3.0,_fire(0.55))
            _disc(center,4.5,_fire(0.42))
            _disc(center+forward*2,2.0,_fire(0.7))
            _stroke(center-forward*2-side*4,center-forward*11-side*9,1.5,_fire(0.95))
            _stroke(center-forward*2+side*4,center-forward*11+side*9,1.5,_fire(0.95))
            _px(center+forward*2-side*2.5,Color.WHITE,2)
            _px(center+forward*2+side*2.5,Color.WHITE,2)
            if maw>0:
                for k in range(11):
                    var ang := a+float(k)*TAU/11.0
                    var length_spike := (10.0+float(k%2)*8.0)*maw
                    _stroke(center+Vector2(cos(ang),sin(ang))*5.0,
                        center+Vector2(cos(ang),sin(ang))*(5.0+length_spike),
                        2.0,_fire(0.9,maw))
    var e := t-CONTACT_T
    if e >= 0.0:
        var heat := exp(-e*0.9)
        # Affected floor is LOCAL bite scar only, not a pasted arena.
        _disc(target,14.0,Color(0.03,0.02,0.02,0.8))
        for crack: Dictionary in _cracks:
            var generation: int = crack.generation
            if float(generation) > e*4.0:
                continue
            var a: Vector2 = crack.a
            var b: Vector2 = crack.b
            _stroke(a,b,1.0,Color(0.07,0.03,0.02,0.65))
            var glow := clampf(heat*1.4-float(generation)*0.25,0.0,1.0)
            if glow>0.03:
                _stroke(a,b,1.0,_fire(0.3+glow*0.7,glow))
        var burst := 1.0-_smooth(0.0,1.4,e)
        for k in range(16):
            var a := float(k)*TAU/16.0+0.3
            var rr := 6.0+_ease_out(e/0.4)*(16.0+float(k%3)*8.0)
            _tongue(target+Vector2(cos(a)*rr,sin(a)*rr*0.6),
                (20.0+float(k%4)*6.0)*burst,4.0*burst+0.5,t,k,burst*0.55)
        for debris: Dictionary in _debris:
            var vz: float = debris.vz
            var flight := 2.0*vz/320.0
            var z := 0.0
            if e<flight:
                z = vz*e-160.0*e*e
            else:
                var ee := e-flight
                z = maxf(0.0,vz*0.3*ee-160.0*ee*ee)
            var velocity: float = debris.v
            var radius := velocity*(1.0-exp(-1.2*e))/1.2
            var angle: float = debris.angle
            var gx := target.x+cos(angle)*radius
            var gy := target.y+sin(angle)*radius*0.6
            var opacity := clampf(1.6-e*0.45,0.0,1.0)
            if opacity>0.0:
                _px(Vector2(gx,gy-z),_fire(clampf(heat+0.35,0.0,1.0),opacity),
                    float(debris.size))
        if e<0.5:
            _ring(target,_ease_out(e/0.5)*70.0,_fire(0.8,1.0-e/0.5))
    _draw_count += 1
    _last_frame_us = Time.get_ticks_usec()-start_us
    _max_draw_ms = maxf(_max_draw_ms,float(_last_frame_us)/1000.0)


func diagnostics() -> Dictionary:
    return {"elapsed":elapsed,"active":active,"draw_count":_draw_count,
        "last_draw_ms":float(_last_frame_us)/1000.0,
        "max_draw_ms":_max_draw_ms,"source_seed":202,
        "source_family":"B:02","transport":"native_per_frame_60hz_geometry",
        "source_parity":"PARTIAL_NO_FULL_POST_OR_EXACT_CRACK_TREE"}
