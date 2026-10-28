class_name VenomSourceChain
extends RefCounted

## Exact double-precision numeric port of src/game/fx.ts Chain.
## Glassfang Hunt (#01) uses Chain(x,y,8,4.2,heading) in Fang constructor.
## No animation faking; each segment follows the immediately preceding one.
## Keep float64 coordinates for source Math.hypot parity before rasterization.
var length := 0
var gap := 0.0
var sx := PackedFloat64Array()
var sy := PackedFloat64Array()

func _init(x: float, y: float, segments: int = 8, separation: float = 4.2, angle: float = 0.0) -> void:
    length = segments
    gap = separation
    sx.resize(length)
    sy.resize(length)
    for i in range(length):
        sx[i] = x - cos(angle)*gap*float(i)
        sy[i] = y - sin(angle)*gap*float(i)

func move_head(x: float, y: float) -> void:
    if length == 0:
        return
    sx[0] = x
    sy[0] = y
    for i in range(1,length):
        var dx: float = sx[i]-sx[i-1]
        var dy: float = sy[i]-sy[i-1]
        var distance: float = sqrt(dx*dx+dy*dy)
        if distance == 0.0:
            distance = 1.0
        sx[i] = sx[i-1] + (dx/distance)*gap
        sy[i] = sy[i-1] + (dy/distance)*gap

func get_segment(index: int) -> Dictionary:
    return {"x":sx[index],"y":sy[index]}
