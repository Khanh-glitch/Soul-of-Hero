class_name VenomSourceDecal
extends RefCounted

## Exact original procedural point construction and CPU ground raster:
## user Venomwright src/game/fx.ts Decal + src/game/pixel.ts Layer.dot.
## NOT yet the Lit() glow pass, map compositing, skill or damage integration.
const RNG = preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const MASK := 0xFFFFFFFF
const TAU := PI * 2.0
const WHITE := 0xFFFFFFFF
const WIDTH := 600
const HEIGHT := 340
var points: Array[Dictionary] = []
var kind := ""
var size := 0.0
var life := 0.0
var age := 0.0
var x := 0.0
var y := 0.0
var pulse := 1.2
var colors: Dictionary = {}

static func _hash(n: int) -> float:
    n &= MASK
    n = ((n ^ 61) ^ (n >> 16)) & MASK
    n = (n + ((n << 3) & MASK)) & MASK
    n = (n ^ (n >> 4)) & MASK
    n = RNG._imul32(n,0x27d4eb2d)
    n = (n ^ (n >> 15)) & MASK
    return float(n) / 4294967296.0

static func _js_round(v: float) -> int:
    return int(floor(v + 0.5))

func _push(px: float, py: float, c: int, g: int = -1) -> void:
    points.append({"x":px,"y":py,"c":c,"g":g})

func _branch(r: GoldMulberry32Rng, bx: float, by: float, angle: float, length: int, depth: int, d0: int) -> void:
    var x0 := bx
    var y0 := by
    var a0 := angle
    for i in range(length):
        a0 += r.range_between(-0.45,0.45)
        x0 += cos(a0)
        y0 += sin(a0) * 0.9
        var g := d0+i
        _push(x0+1.0,y0,int(colors["a"]))
        _push(x0,y0+1.0,int(colors["a"]))
        _push(x0-1.0,y0,int(colors["a"]))
        _push(x0,y0,int(colors["b"]),g)
        if depth < 3 and i > 3 and r.next() < 0.12:
            _branch(r,x0,y0,a0+float(r.sign_value())*r.range_between(0.6,1.2),int(floor(float(length)*0.55)),depth+1,g)

func configure(world_x: float, world_y: float, decal_kind: String, decal_size: float,
        duration: float, seed: int, palette: Dictionary, angle: float = 0.0,
        source_pulse: float = 1.2) -> void:
    x = world_x; y = world_y; kind = decal_kind; size = decal_size
    life = duration; pulse = source_pulse; age = 0.0
    colors = palette.duplicate(true)
    points.clear()
    var r := RNG.new(seed*7+3)
    match kind:
        "veins":
            var n := 4 + int(floor(size/14.0))
            for i in range(n):
                _branch(r,0.0,0.0,float(i)/float(n)*TAU+r.range_between(-0.3,0.3),
                    int(floor(size*r.range_between(0.5,1.0))),0,0)
            # Original Array.sort uses stable grouping by g<0.
            var unlit: Array[Dictionary] = []
            var lit: Array[Dictionary] = []
            for p in points:
                if int(p["g"]) < 0: unlit.append(p)
                else: lit.append(p)
            points = unlit
            points.append_array(lit)
        "cracks":
            var n := 5 + int(floor(size/10.0))
            for i in range(n):
                var x0 := 0.0; var y0 := 0.0
                var a0 := float(i)/float(n)*TAU+r.range_between(-0.3,0.3)
                var length := size*r.range_between(0.4,1.0)
                for k in range(int(ceil(length))):
                    a0 += r.range_between(-0.4,0.4)
                    x0 += cos(a0); y0 += sin(a0)*0.9
                    _push(x0,y0,int(colors["a"]))
                    if k%3==0: _push(x0+1.0,y0+1.0,int(colors["b"]))
                    if k%7==0: _push(x0,y0,int(colors["c"]),k)
        "pits":
            for i in range(int(floor(size*0.9))):
                var a := r.range_between(0.0,TAU)
                var d := sqrt(r.next())*size
                var pr := r.range_between(0.8,2.4)
                var px := cos(a)*d; var py := sin(a)*d*0.9
                for dy in range(-2,3):
                    for dx in range(-3,4):
                        var q := sqrt(pow(float(dx)/1.3,2.0)+float(dy*dy))
                        if q < pr: _push(px+dx,py+dy,int(colors["a"]))
                        elif q < pr+1.0:
                            _push(px+dx,py+dy,int(colors["b"]),i*3 if r.next()<0.3 else -1)
        "crater":
            var a := 0.0
            while a < TAU:
                var rr := size*(0.92+_hash(int(floor(a*9.0))+seed)*0.12)
                _push(cos(a)*rr,sin(a)*rr*0.85-1.0,int(colors["b"]))
                _push(cos(a)*(rr+1.4),sin(a)*(rr+1.4)*0.85-1.0,
                    int(colors["c"]) if a>3.5 and a<5.6 else int(colors["b"]))
                _push(cos(a)*(rr-1.3),sin(a)*(rr-1.3)*0.85,int(colors["a"]))
                a += 0.04
            for i in range(int(ceil(size*1.4))):
                var ra := r.range_between(0.0,TAU)
                var d := r.range_between(size*0.2,size*0.88)
                _push(cos(ra)*d,sin(ra)*d*0.85,int(colors["c"]) if i%4==0 else int(colors["a"]),i*2 if i%4==0 else -1)
        "crescent":
            for k in range(-1,2):
                var a := -1.15
                while a <= 1.15:
                    var rr := size+float(k)*1.1
                    var color := int(colors["c"]) if k==0 else (int(colors["b"]) if k<0 else int(colors["a"]))
                    var px := cos(a+angle)*rr; var py := sin(a+angle)*rr*0.9
                    var thick := (1.0-absf(a)/1.3)*2.3
                    var t := 0
                    while float(t)<thick:
                        _push(px-cos(a+angle)*float(t)*0.9,py-sin(a+angle)*float(t)*0.9,
                            color,_js_round((a+1.2)*20.0) if k==0 else -1)
                        t += 1
                    a += 0.03
        "scorch":
            for i in range(int(ceil(size*2.4))):
                var a := r.range_between(0.0,TAU)
                var d := sqrt(r.next())*size
                _push(cos(a)*d,sin(a)*d*0.85,int(colors["b"]) if i%9==0 else int(colors["a"]))
        _:
            push_error("VenomSourceDecal unknown Gold kind: "+kind)

## Transparent k=1 raster. Source Layer.dot rounds by JS Math.round.
func ground_bytes(world_time: float, source_age: float) -> PackedByteArray:
    age = source_age
    var bytes := PackedByteArray()
    bytes.resize(WIDTH*HEIGHT*4)
    var rem := life-age
    var vis := clampf(age/0.12,0.0,1.0)
    var fade := rem/1.2 if rem<1.2 else 1.0
    var t := world_time*22.0*pulse
    for i in range(points.size()):
        var p: Dictionary = points[i]
        if fade<1.0 and _hash(i*3+7)>fade: continue
        if vis<1.0 and _hash(i*5+1)>vis: continue
        var col: int = int(p["c"])
        if int(p["g"])>=0:
            var ph: float = fposmod(t-float(p["g"]),44.0)
            if ph<7.0:
                col = WHITE if ph<2.5 else _mix(int(colors["b"]),WHITE,0.5)
        var ix := _js_round(x+float(p["x"]))
        var iy := _js_round(y+float(p["y"]))
        if ix<0 or iy<0 or ix>=WIDTH or iy>=HEIGHT: continue
        var off := (iy*WIDTH+ix)*4
        bytes[off] = col&255
        bytes[off+1] = (col>>8)&255
        bytes[off+2] = (col>>16)&255
        bytes[off+3] = (col>>24)&255
    return bytes

static func _mix(a: int,b: int,k: float) -> int:
    var rr := int(float(a&255)+float((b&255)-(a&255))*k)&255
    var gg := int(float((a>>8)&255)+float(((b>>8)&255)-((a>>8)&255))*k)&255
    var bb := int(float((a>>16)&255)+float(((b>>16)&255)-((a>>16)&255))*k)&255
    return (0xFF<<24)|(bb<<16)|(gg<<8)|rr
