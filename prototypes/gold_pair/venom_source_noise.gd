class_name VenomSourceNoise
extends RefCounted

## Exact procedural noise-tile generator ported from original
## Venomwright src/game/pixel.ts mkNoise(cells, seed); NOT sampled sprites.
## Lattice uses Float32Array in TypeScript; Godot PackedFloat32Array retains
## precisely that intermediate quantization before double bilinear blend.
const RNG=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
var nz1:PackedByteArray
var nz2:PackedByteArray

func _init()->void:
    nz1=_generate(8,11)
    nz2=_generate(16,29)

static func _generate(cells:int,seed:int)->PackedByteArray:
    var lattice:=PackedFloat32Array()
    lattice.resize(cells*cells)
    var rng=RNG.new(seed)
    for i in range(lattice.size()):
        lattice[i]=rng.next()
    var table:=PackedByteArray()
    table.resize(64*64)
    var cell_size:float=64.0/float(cells)
    for y in range(64):
        for x in range(64):
            var gx:float=float(x)/cell_size
            var gy:float=float(y)/cell_size
            var x0:int=int(floor(gx))
            var y0:int=int(floor(gy))
            var fx:float=gx-float(x0)
            var fy:float=gy-float(y0)
            fx=fx*fx*(3.0-2.0*fx)
            fy=fy*fy*(3.0-2.0*fy)
            var a:float=lattice[(y0%cells)*cells+(x0%cells)]
            var b:float=lattice[(y0%cells)*cells+((x0+1)%cells)]
            var c:float=lattice[((y0+1)%cells)*cells+(x0%cells)]
            var d:float=lattice[((y0+1)%cells)*cells+((x0+1)%cells)]
            var value:float=(a+(b-a)*fx+(c-a+(d-c-(b-a))*fx)*fy)*255.0
            table[y*64+x]=clampi(int(floor(value)),0,255)
    return table

func value1(x:float,y:float)->int:
    return int(nz1[((int(floor(y))&63)<<6)|(int(floor(x))&63)])

func value2(x:float,y:float)->int:
    return int(nz2[((int(floor(y))&63)<<6)|(int(floor(x))&63)])

static func sha(data:PackedByteArray)->String:
    var ctx=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(data)
    return ctx.finish().hex_encode()
