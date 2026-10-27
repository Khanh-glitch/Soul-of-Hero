class_name GoldS01TransparentGround
extends "res://prototypes/gold_fidelity/hairline_ground.gd"

## Original Gold Ground.groove(), Ground.crack(), Ground.rubble() algorithms
## and RNG are INHERITED UNCHANGED. Only _put is adapted to a transparent
## world-space TileMap overlay, not source Gold's opaque 480x270 buffer.
##
## For an opaque pixel D, original _put computes:
##       new_D = D*(1-a)+ink*a.
## Storing ink over alpha on transparent texture obeys the same equation
## when the texture is composited over D. Multiple writes accumulate alpha
## and color in source order; no invented crack silhouettes or screenshots.
## Native image RGBA8 introduces at most single-byte quantization differences.
## DOES NOT alter TileMap tiles, collision, persistent saves or environment AI.
func _put(fx: float,fy: float,r: float,g: float,b: float,a: float) -> void:
    var x:=int(fx)
    var y:=int(fy)
    if x<0 or y<0 or x>=W or y>=H:
        return
    var off: int=(y*W+x)*4
    var old_alpha: float=float(pixels[off+3])/255.0
    var ink_alpha: float=clampf(a,0.0,1.0)
    var new_alpha: float=ink_alpha+(1.0-ink_alpha)*old_alpha
    if new_alpha<0.00001:
        return
    var old_weight:=old_alpha*(1.0-ink_alpha)
    pixels[off]=_u8((float(pixels[off])*old_weight+r*ink_alpha)/new_alpha)
    pixels[off+1]=_u8((float(pixels[off+1])*old_weight+g*ink_alpha)/new_alpha)
    pixels[off+2]=_u8((float(pixels[off+2])*old_weight+b*ink_alpha)/new_alpha)
    pixels[off+3]=_u8(new_alpha*255.0)

func clear_ink() -> void:
    pixels.fill(0)
    _rng=7

func marked_count() -> int:
    var result:=0
    for i in range(3,pixels.size(),4):
        if pixels[i]>0:
            result+=1
    return result
