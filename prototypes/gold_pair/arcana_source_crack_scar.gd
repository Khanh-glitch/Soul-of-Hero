class_name ArcanaSourceCrackScar
extends RefCounted

## Source-locked ARCANA III V2 original src/engine/fx.ts crackScar():
## procedural fracture/stones generation + source buildTaper() polygons.
## This port currently proves draw GEOMETRY only, not Pixi shader, colors,
## alpha, central disc/heat or original Black Sun full-cast timing.
const RNG=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const TAU=PI*2.0
var rng
var branches:Array[Dictionary]=[]
var stones:Array[Dictionary]=[]
var px:float=0.0
var py:float=0.0
var radius:float=0.0
var duration:float=0.0
var squash:float=0.7

static func _rnd(v:float)->int:
    # JS Math.round, including ties.
    return int(floor(v+0.5))

func _rr(a:float,b:float)->float:
    return a+(b-a)*rng.next()

func configure(source_seed:int,x:float,y:float,n:int,dist:float,life:float,ys:float=0.7)->void:
    rng=RNG.new(source_seed)
    rng.reseed(source_seed,true) # ARCANA zero -> 1; Venomwright does NOT.
    branches.clear()
    stones.clear()
    px=x;py=y;radius=dist;duration=life;squash=ys
    for i in range(n):
        var a:float=float(i)/float(n)*TAU+_rr(-0.22,0.22)
        var x0:float=x
        var y0:float=y
        var pts:Array[Vector2i]=[Vector2i(_rnd(x0),_rnd(y0))]
        var steps:int=4+int(floor(rng.next()*3.0))
        var total:float=dist*_rr(0.65,1.15)
        for k in range(1,steps+1):
            a+=(1.0 if k%2==1 else -1.0)*_rr(0.14,0.36)
            var seg:float=total/float(steps)*_rr(0.8,1.2)
            x0+=cos(a)*seg
            y0+=sin(a)*seg*ys
            pts.append(Vector2i(_rnd(x0),_rnd(y0)))
            if k==2 and rng.next()<0.65:
                var fa:float=a+(0.65 if rng.next()<0.5 else -0.65)
                var fl:float=total*0.34
                var fork:Array[Vector2i]=[
                    Vector2i(_rnd(x0),_rnd(y0)),
                    Vector2i(_rnd(x0+cos(fa)*fl*0.55),_rnd(y0+sin(fa)*fl*0.55*ys)),
                    Vector2i(_rnd(x0+cos(fa+0.2)*fl),_rnd(y0+sin(fa+0.2)*fl*ys))
                ]
                branches.append({"pts":fork,"w0":2.2})
        branches.append({"pts":pts,"w0":_rr(3.5,5.2)})
        var ra:float=float(i)/float(n)*TAU+_rr(-0.3,0.3)
        var rd:float=total*_rr(0.25,0.72)
        stones.append({
            "x":_rnd(x+cos(ra)*rd),
            "y":_rnd(y+sin(ra)*rd*ys),
            "w":_rnd(_rr(3.0,5.0)),
            "h":_rnd(_rr(2.0,3.0))
        })

static func _build_taper(pts:Array[Vector2i],w0:float,scale:float)->PackedInt32Array:
    var m:int=pts.size()
    var left:PackedInt32Array=PackedInt32Array()
    var right:PackedInt32Array=PackedInt32Array()
    for i in range(m):
        var u:float=float(i)/float(maxi(1,m-1))
        var half_w:float=maxf(0.4,w0*scale*pow(1.0-u,1.35)*0.5)
        var pa:Vector2i=pts[maxi(0,i-1)]
        var pb:Vector2i=pts[mini(m-1,i+1)]
        var dx:float=float(pb.x-pa.x)
        var dy:float=float(pb.y-pa.y)
        var segment:float=sqrt(dx*dx+dy*dy)
        if segment==0.0:segment=1.0
        dx/=segment
        dy/=segment
        left.append(_rnd(float(pts[i].x)-dy*half_w))
        left.append(_rnd(float(pts[i].y)+dx*half_w))
        right.append(_rnd(float(pts[i].x)+dy*half_w))
        right.append(_rnd(float(pts[i].y)-dx*half_w))
    var flat:PackedInt32Array=PackedInt32Array()
    flat.append_array(left)
    for i in range(m-1,-1,-1):
        flat.append(right[i*2])
        flat.append(right[i*2+1])
    return flat

static func _csv(arr:PackedInt32Array)->String:
    var vals:PackedStringArray=PackedStringArray()
    for v in arr:vals.append(str(v))
    return ",".join(vals)

static func _rect(s:Dictionary,rim:bool)->PackedInt32Array:
    var y:int=int(s["y"])-(1 if rim else 0)
    return PackedInt32Array([int(s["x"]),y,int(s["w"]),1 if rim else int(s["h"])])

func geometry_trace(source_age:float)->PackedStringArray:
    var out:PackedStringArray=PackedStringArray()
    var heat:float=clampf(1.0-source_age/(duration*0.75),0.0,1.0)
    for branch in branches:
        var pts:Array[Vector2i]=branch["pts"]
        var w0:float=float(branch["w0"])
        out.append("mark|P|"+_csv(_build_taper(pts,w0+2.0,1.0)))
        if heat>0.04:
            out.append("glow|P|"+_csv(_build_taper(pts,w0,0.85)))
            if w0>3.0 and heat>0.25:
                var limit:int=maxi(2,pts.size()-1)
                var shortened:Array[Vector2i]=[]
                for i in range(limit): shortened.append(pts[i])
                out.append("glow|P|"+_csv(_build_taper(shortened,w0,0.38)))
    for s in stones:
        out.append("mark|R|"+_csv(_rect(s,false)))
        out.append("mark|R|"+_csv(_rect(s,true)))
    return out

func geometry_sha256(source_age:float)->String:
    var lines:PackedStringArray=geometry_trace(source_age)
    var data:PackedByteArray=("\n".join(lines)+"\n").to_utf8_buffer()
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(data)
    return ctx.finish().hex_encode()
