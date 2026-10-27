class_name GoldHairlineSourceFloor
extends RefCounted

## Exact port of original src/engine/ground.ts buildBase() to RGBA8.
## 480x270 floor, tile edges, hash noise, 14 old cracks, 90 moss marks.
## Source algorithm verified byte-identical in independent Python oracle.
const W:=480
const H:=270
var state:=33

func _rand() -> float:
    state=(state*1664525+1013904223)&0xFFFFFFFF
    return float(state)/4294967296.0

static func _hash(x: int,y: int) -> float:
    var h: int=(x*374761393+y*668265263)&0xFFFFFFFF
    # JS uses Number (float64) multiplication before >>>0.
    h=int(float(h^(h>>13))*1274126177.0)&0xFFFFFFFF
    return float((h^(h>>16))&0xFFFFFFFF)/4294967296.0

func _old_line(ground: RefCounted,x0: float,y0: float,angle: float,length: float) -> void:
    var x:=x0
    var y:=y0
    var a:=angle
    for step in range(ceili(length)):
        a+=(_rand()-0.5)*0.7
        x+=cos(a)
        y+=sin(a)*0.8
        ground._put(x,y,12.0,13.0,20.0,0.95)
        ground._put(x,y+1.0,27.2,28.8,44.0,0.3)

func build(ground: RefCounted) -> void:
    state=33
    for y in range(H):
        var row:=int(y/22)
        var off: int=(row%2)*13+floori(_hash(row,9)*7.0)
        for x in range(W):
            var col:=int((x+off)/30)
            var lx: int=(x+off)-col*30
            var ly: int=y-row*22
            var tid:=_hash(col,row)
            var red:=40.0+tid*16.0
            var green:=44.0+tid*16.0
            var blue:=56.0+tid*18.0
            var noise:=_hash(x>>1,y>>1)*8.0+_hash(x,y)*4.0
            red+=noise
            green+=noise
            blue+=noise
            if _hash(int(x/5)+col*7,int(y/4)+row*3)>0.86:
                red-=6.0
                green-=6.0
                blue-=4.0
            if lx==0 or ly==0:
                red=15.0;green=16.0;blue=24.0
            elif lx==1 or ly==1:
                red+=22.0;green+=24.0;blue+=28.0
            elif lx==29 or ly==21:
                red-=14.0;green-=14.0;blue-=12.0
            if (lx<3 or ly<3) and _hash(x*3,y*7)>0.75:
                red=24.0;green=26.0;blue=36.0
            var dx: float=(x-240.0)/240.0
            var dy: float=(y-270.0*0.54)/135.0
            var v:=1.0-minf(1.0,maxf(0.0,(sqrt(dx*dx+dy*dy*1.21)-0.55)*0.9))*0.55
            var p: int=(y*W+x)*4
            ground.pixels[p]=ground._u8(red*v)
            ground.pixels[p+1]=ground._u8(green*v)
            ground.pixels[p+2]=ground._u8(blue*v)
            ground.pixels[p+3]=255
    for k in range(14):
        _old_line(ground,_rand()*W,_rand()*H,_rand()*6.28,12.0+_rand()*26.0)
    for k in range(90):
        var x:=int(_rand()*W)
        var y:=int(_rand()*H)
        ground._put(x,y,30.0,52.0,50.0,0.7)
        ground._put(x+1,y,26.0,44.0,42.0,0.5)
