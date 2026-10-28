class_name VenomGlassfangEnvironmentCanvas
extends Node2D

## Native original Gold procedural environmental renderer, true Ultra k2.
## Original FX are computed from source event parameters/age at the requested
## 60Hz tick. No pre-rendered sprites, no enlarged k1 bitmap.
const PORT=preload("res://prototypes/gold_pair/venom_glassfang_source_environment.gd")
var density:int=2
var W:int=1200
var H:int=680
var renderer
var images:Dictionary={}
var textures:Dictionary={}
var sprites:Dictionary={}
var last_counts:Dictionary={}

func set_source_density(k:int)->void:
    if sprites.size()>0:
        push_error("Set Gold native raster density before _ready()")
        return
    if k!=1 and k!=2:
        push_error("Only Gold native Classic k1 and Ultra k2")
        return
    density=k
    W=600*k;H=340*k

func _ready()->void:
    _ensure_passes()
    set_process(false)

func _ensure_passes()->void:
    if sprites.size()==2:return
    renderer=PORT.new(density)
    for key in ["scene","glow"]:
        var im:Image=Image.create(W,H,false,Image.FORMAT_RGBA8)
        var tex:=ImageTexture.create_from_image(im)
        var spr:=Sprite2D.new()
        spr.name="GoldEnvironment_"+key
        spr.centered=false
        spr.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
        spr.texture=tex
        spr.z_index=0 if key=="scene" else 1
        if key=="glow":
            var mat:=CanvasItemMaterial.new()
            mat.blend_mode=CanvasItemMaterial.BLEND_MODE_ADD
            spr.material=mat
        add_child(spr)
        images[key]=im
        textures[key]=tex
        sprites[key]=spr

func set_source_to_map_transform(xform:Transform2D)->void:
    _ensure_passes()
    for key in sprites.keys():sprites[key].transform=xform

func render_source_events(events:Array)->Dictionary:
    _ensure_passes()
    renderer.clear()
    last_counts.clear()
    for ev in events:
        if not ev is Dictionary:continue
        var e:Dictionary=ev
        renderer.render_source_event(e)
        var kind:String=String(e.get("kind",""))
        last_counts[kind]=int(last_counts.get(kind,0))+1
    var result:Dictionary=renderer.buffers()
    for key in ["scene","glow"]:
        var raw:PackedByteArray=result[key]
        if raw.size()!=W*H*4:
            push_error("Gold environmental Ultra raster buffer size drift "+key)
            return {}
        var im:Image=images[key];var tex:ImageTexture=textures[key]
        im.set_data(W,H,false,Image.FORMAT_RGBA8,raw)
        tex.update(im)
        sprites[key].visible=events.size()>0
    return result

func release_source_environment()->void:
    _ensure_passes()
    last_counts.clear()
    for key in sprites.keys():
        sprites[key].visible=false
