class_name VenomSourceFang
extends RefCounted

## Original s1.ts Fang.shd/up/lit dynamic procedural actor.
## This is an isolated renderer primitive, NOT the complete #01 cast.
const CHAIN=preload("res://prototypes/gold_pair/venom_source_chain.gd")
const LAYER=preload("res://prototypes/gold_pair/venom_source_pixel_layer.gd")
const FR=[4.6,4.0,4.4,4.1,3.6,3.0,2.2,1.4]
const P={
    "bk":0xFF060402,"v0":0xFF494E18,"v1":0xFF717D26,
    "v2":0xFFA0B852,"v3":0xFFCCE495,"e0":0xFF222E0A,
    "k0":0xFF080904,"c0":0xFF22B56F,"c1":0xFF30EAA6,
    "c2":0xFF58FAD4,"c3":0xFFA0FFEE,"y1":0xFFEBE08E,
    "y2":0xFFFCF7D4,"w":0xFFFFFFFF
}
const GLASS={"o":0xFF2E2D0B,"d":0xFF494E18,"b":0xFF717D26,"l":0xFFA0B852,"s":0xFFCCE495}
var chain
var x:float
var y:float
var z:float=0.0
var heading:float
var open:float=0.2
var scale:float=1.0

func _init(px:float,py:float,ang:float)->void:
    x=px; y=py; heading=ang
    chain=CHAIN.new(x,y,8,4.2,ang)

func update_chain()->void:
    chain.move_head(x,y)

func shadow(layer:VenomSourcePixelLayer)->void:
    layer.dl=8
    for i in range(0,8,2):
        layer.ellipse(chain.sx[i],chain.sy[i]+2.0,FR[i]*0.9,FR[i]*0.45,int(P.bk))
    layer.dl=16

func front(layer:VenomSourcePixelLayer,t:float)->void:
    var pts:Array[Dictionary]=[]
    for i in range(8):
        pts.append({"x":chain.sx[i],"y":chain.sy[i]-z-3.0+sin(t*14.0-float(i)*0.9)*0.5,"r":FR[i]*scale})
    for i in range(1,5):
        var ang:float=atan2(chain.sy[i-1]-chain.sy[i],chain.sx[i-1]-chain.sx[i])
        var perpx:float=-sin(ang); var perpy:float=cos(ang)
        for sd in [-1,1]:
            var sw:float=sin(t*20.0+float(i)*1.5+float(sd)*1.6)*2.2
            var bx:float=pts[i].x+perpx*FR[i]*float(sd)
            var by:float=pts[i].y+perpy*FR[i]*float(sd)+1.0
            var kx:float=bx+perpx*3.0*float(sd)+cos(ang)*sw*0.5
            var ky:float=by+perpy*3.0*float(sd)*0.8-1.0
            var fx:float=bx+perpx*4.5*float(sd)+cos(ang)*sw
            var fy:float=by+3.0+perpy*2.0*float(sd)
            layer.line(bx,by,kx,ky,int(P.v1))
            layer.line(kx,ky,fx,fy,int(P.v3))
    var reversed:Array[Dictionary]=pts.duplicate()
    reversed.reverse()
    layer.worm_body(reversed,GLASS)
    for i in [2,4]:
        layer.disc(float(pts[i].x)+0.5,float(pts[i].y)+0.5,1.3,int(P.e0))
        layer.px(float(pts[i].x),float(pts[i].y),int(P.k0))
    var pi:int=int(floor(fposmod(t*11.0,10.0)))
    for k in range(3):
        var i:int=pi-k
        if i>=0 and i<8:
            var col:int=int(P.c3) if k==0 else (int(P.c1) if k==1 else int(P.c0))
            layer.disc(float(pts[i].x),float(pts[i].y),1.6-float(k)*0.5,col)
    for i in range(1,6):
        layer.shard(float(pts[i].x),float(pts[i].y)-FR[i]+0.5,-PI/2.0+sin(float(i)+t*3.0)*0.2,2.8,0.9,int(P.y2),int(P.v2),int(P.w))
    var h:Dictionary=pts[0]
    var fx:float=cos(heading); var fy:float=sin(heading)
    var qx:float=-fy; var qy:float=fx
    var op:float=open*0.55+0.2
    for sd in [-1,1]:
        layer.shard(float(h.x)+fx*3.0+qx*float(sd)*1.2,float(h.y)+fy*3.0+qy*float(sd)*1.2,heading+float(sd)*op,5.4,1.4,int(P.y2),int(P.v1),int(P.w))
    layer.px(float(h.x)+fx+qx*1.6,float(h.y)+fy+qy*1.6-1.0,int(P.c2))
    layer.px(float(h.x)+fx-qx*1.6,float(h.y)+fy-qy*1.6-1.0,int(P.c2))

func light(layer:VenomSourcePixelLayer)->void:
    layer.glow(chain.sx[0],chain.sy[0]-z-3.0,8.0,int(P.c1),0.3,3)
    layer.glow(chain.sx[3],chain.sy[3]-z-3.0,6.0,int(P.c1),0.15,2)

func render_pass(pass_name:String,t:float,source_density:int=1)->PackedByteArray:
    var layer=LAYER.new(source_density)
    match pass_name:
        "shd": shadow(layer)
        "up": front(layer,t)
        "lit": light(layer)
        _: push_error("Unknown original Fang pass: "+pass_name)
    return layer.bytes
