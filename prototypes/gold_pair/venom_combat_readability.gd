class_name VenomCombatReadability
extends RefCounted

## OPTIONAL map-adaptive contrast control. NOT part of original Gold skill VFX.
## Darkens authored dungeon BACKGROUND only (Backdrop/Geometry/Decor).
## Never changes original Gold RGBA sources, actors, HUD, collision or hit rules.
## Baseline modulates are preserved and restored, no permanent map changes.
## Brightness is measured from the genuine native viewport BEFORE Gold FX,
## within an ROI of the real target. Deterministic 60Hz smoothing.
const DEFAULT_THRESHOLD:float=0.23
const DEFAULT_TARGET:float=0.16
const MAX_ATTENUATION:float=0.42
const RAMP_UP:float=0.18
const RAMP_DOWN:float=0.30
var layers:Array[CanvasItem]=[]
var originals:Array[Color]=[]
var strength:float=0.0
var requested:float=0.0
var last_luminance:float=0.0
var last_sample_count:int=0

func bind_level(level:Node,background:CanvasItem=null)->void:
    restore()
    layers.clear()
    originals.clear()
    # The live Chapter1 Level2 includes a separate CrucibleArt facade root.
    # Dimming only TileMapLayers misses most of the actual bright architecture.
    # Never modulate Level root: its Entities child contains real Knight/enemy.
    for layer_name in ["Backdrop","Geometry","Decor","CrucibleArt"]:
        var item:CanvasItem=level.get_node_or_null(NodePath(layer_name)) as CanvasItem
        if item!=null:
            layers.append(item)
            originals.append(item.modulate)
    # Optional actual parallax/sky background, if used by this map.
    if background!=null:
        layers.append(background)
        originals.append(background.modulate)
    strength=0.0
    requested=0.0

func sample_roi(frame:Image,roi:Rect2i,step:int=5)->float:
    if frame==null:return 0.0
    var w:int=frame.get_width()
    var h:int=frame.get_height()
    var left:int=clampi(roi.position.x,0,w)
    var top:int=clampi(roi.position.y,0,h)
    var right:int=clampi(roi.end.x,0,w)
    var bottom:int=clampi(roi.end.y,0,h)
    var samples:int=0
    var total:float=0.0
    var stride:int=maxi(1,step)
    for y in range(top,bottom,stride):
        for x in range(left,right,stride):
            var c:Color=frame.get_pixel(x,y)
            # Correct sRGB-to-linear conversion before luminance; do not
            # apply the linear/sRGB ambiguity directly to Gold source RGB.
            var lc:Color=c.srgb_to_linear()
            var lum:float=lc.r*0.2126+lc.g*0.7152+lc.b*0.0722
            total+=lum
            samples+=1
    last_sample_count=samples
    last_luminance=total/float(samples) if samples>0 else 0.0
    return last_luminance

func compute_target(mean_luminance:float,is_skill_active:bool,
        threshold:float=DEFAULT_THRESHOLD,target_brightness:float=DEFAULT_TARGET)->float:
    if not is_skill_active or mean_luminance<=threshold:
        return 0.0
    var desired:float=1.0-target_brightness/maxf(0.00001,mean_luminance)
    return clampf(desired,0.0,MAX_ATTENUATION)

func request_for_luminance(mean_luminance:float,is_skill_active:bool)->float:
    requested=compute_target(mean_luminance,is_skill_active)
    return requested

func advance_60hz()->void:
    var sec:float=RAMP_UP if requested>strength else RAMP_DOWN
    var k:float=1.0-exp(-1.0/(60.0*sec))
    set_strength(lerpf(strength,requested,k))

func set_strength(value:float)->void:
    strength=clampf(value,0.0,MAX_ATTENUATION)
    var factor:float=1.0-strength
    for i in range(layers.size()):
        if is_instance_valid(layers[i]):
            var origin:Color=originals[i]
            # Preserve author tint, original opacity and alpha.
            layers[i].modulate=Color(origin.r*factor,origin.g*factor,
                origin.b*factor,origin.a)

func restore()->void:
    for i in range(layers.size()):
        if is_instance_valid(layers[i]):
            layers[i].modulate=originals[i]
    strength=0.0
    requested=0.0

func report()->Dictionary:
    return {
        "sampled_linear_luminance":last_luminance,
        "pixels_sampled":last_sample_count,
        "requested_attenuation":requested,
        "actual_attenuation":strength,
        "layer_names":_layer_names(),
        "changes_original_gold_effects":false,
        "changes_real_enemy_or_hero":false
    }

func _layer_names()->Array:
    var out:Array=[]
    for item in layers:
        if is_instance_valid(item):out.append(String(item.name))
    return out
