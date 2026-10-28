class_name VenomSourceFangCanvas
extends Node2D

## Live original-source procedural Fang renderer. Source Layer -> RGBA ImageTexture,
## never a sprite sheet or approximated keyframe sequence. Preview only:
## not yet a registered playable Glassfang skill / Level2 map acceptance.
const FANG=preload("res://prototypes/gold_pair/venom_source_fang.gd")
const W:int=600
const H:int=340
const PASSES=["shd","up","lit"]
var fang:VenomSourceFang
var sprites:Dictionary={}
var images:Dictionary={}
var textures:Dictionary={}

func _ready()->void:
    _ensure_layers()

func _ensure_layers()->void:
    if sprites.size()==3: return
    for key in PASSES:
        var im:Image=Image.create(W,H,false,Image.FORMAT_RGBA8)
        var tex:ImageTexture=ImageTexture.create_from_image(im)
        var sprite:=Sprite2D.new()
        sprite.name="GoldFang_"+key
        sprite.centered=false
        sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
        sprite.texture=tex
        sprite.z_index=-1 if key=="shd" else (1 if key=="lit" else 0)
        if key=="lit":
            var material:=CanvasItemMaterial.new()
            material.blend_mode=CanvasItemMaterial.BLEND_MODE_ADD
            sprite.material=material
        add_child(sprite)
        images[key]=im
        textures[key]=tex
        sprites[key]=sprite
    set_process(false)

func begin_source_actor(source_x:float,source_y:float,angle:float)->void:
    _ensure_layers()
    fang=FANG.new(source_x,source_y,angle)

func set_source_to_map_transform(source_to_map:Transform2D)->void:
    _ensure_layers()
    for key in PASSES:
        sprites[key].transform=source_to_map

func render_source_frame(source_time:float,head_x:float,head_y:float,
        altitude:float,face_angle:float,mandible_open:float,
        body_scale:float=1.0)->Dictionary:
    _ensure_layers()
    if fang==null or sprites.size()!=3:
        push_error("Source Fang Canvas not initialized / start a Gold cast")
        return {}
    fang.x=head_x
    fang.y=head_y
    fang.z=altitude
    fang.heading=face_angle
    fang.open=mandible_open
    fang.scale=body_scale
    fang.update_chain()
    return render_live_actor_frame(fang,source_time)

## The motion driver already advanced source Chain at 60 Hz. Do NOT move it
## again at render rate: doing so destroys exact source 8-segment dynamics.
func render_live_actor_frame(source_fang:VenomSourceFang,source_time:float)->Dictionary:
    _ensure_layers()
    if source_fang==null:
        release_source_actor()
        return {}
    fang=source_fang
    var outputs:Dictionary={}
    for key in PASSES:
        var rgba:PackedByteArray=fang.render_pass(key,source_time)
        if rgba.size()!=W*H*4:
            push_error("Source Fang Canvas unexpected Gold RGBA size "+key)
            return {}
        var im:Image=images[key]
        var tex:ImageTexture=textures[key]
        im.set_data(W,H,false,Image.FORMAT_RGBA8,rgba)
        tex.update(im)
        sprites[key].visible=true
        outputs[key]=rgba
    return outputs

func release_source_actor()->void:
    fang=null
    for key in PASSES: sprites[key].visible=false
