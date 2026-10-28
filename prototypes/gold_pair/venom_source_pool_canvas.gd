class_name VenomSourcePoolCanvas
extends Node2D

## Source-exact two-pass Venomwright acid Pool display. CPU shade code and
## dynamic noise remain in source-native 600x340 on every AUTHORITATIVE tick.
## ImageTexture is only the presentation transport, not a baked VFX frame.
## Caller must supply original source-world→map transform and fixed 60Hz clock.
## No source Pool.upd gameplay or damage yet; this is presentation staging.
const SHADE=preload("res://prototypes/gold_pair/venom_source_pool_shade.gd")
const W:int=600
const H:int=340
var shader
var sprites:Dictionary={}
var images:Dictionary={}
var textures:Dictionary={}
var source_age:float=0.0
var elapsed_frames:int=0
var finished:bool=false

func _ready()->void:
    _ensure_passes()
    set_process(false)

func _ensure_passes()->void:
    if sprites.size()==2:return
    for key in ["ground","light"]:
        var image:=Image.create(W,H,false,Image.FORMAT_RGBA8)
        var texture:=ImageTexture.create_from_image(image)
        var sprite:=Sprite2D.new()
        sprite.name="OriginalAcid_"+key
        sprite.centered=false
        sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
        sprite.texture=texture
        sprite.z_index=0 if key=="ground" else 1
        if key=="light":
            var material:=CanvasItemMaterial.new()
            material.blend_mode=CanvasItemMaterial.BLEND_MODE_ADD
            sprite.material=material
        add_child(sprite)
        sprites[key]=sprite
        images[key]=image
        textures[key]=texture

func begin_source_pool(source_x:float,source_y:float,radius:float,life:float,
        blobs:int,grow:float,seed:int=-1)->void:
    _ensure_passes()
    shader=SHADE.new()
    shader.begin(source_x,source_y,radius,life,blobs,grow,seed)
    source_age=0.0
    elapsed_frames=0
    finished=false
    for key in sprites.keys():
        sprites[key].visible=true

func set_source_to_map_transform(xform:Transform2D)->void:
    _ensure_passes()
    for key in sprites.keys():
        sprites[key].transform=xform

func seek_source_time(age:float,world_time:float,
        flow_x:float=7.0,flow_y:float=3.0)->Dictionary:
    _ensure_passes()
    if shader==null:
        push_error("Original Pool Canvas requires begin_source_pool first")
        return {}
    if age<0.0 or age>shader.pool.life:
        release_source_pool()
        return {}
    source_age=age
    var ground:PackedByteArray=shader.source_frame(age,world_time,flow_x,flow_y)
    var light:PackedByteArray=shader.source_light_frame(age)
    var result:Dictionary={"ground":ground,"light":light}
    for key in ["ground","light"]:
        var raw:PackedByteArray=result[key]
        if raw.size()!=W*H*4:
            push_error("Original Pool pixel dimensions drift in "+key)
            return {}
        var image:Image=images[key]
        var texture:ImageTexture=textures[key]
        image.set_data(W,H,false,Image.FORMAT_RGBA8,raw)
        texture.update(image)
        sprites[key].visible=true
    return result

## Advances the SOURCE clock by one fixed 60Hz tick. Do not call per
## variable-rate rendered frame; this does not reproduce World.time ownership.
func tick_source_60hz(cast_age:float,world_time:float)->Dictionary:
    elapsed_frames+=1
    return seek_source_time(cast_age,world_time)

func release_source_pool()->void:
    finished=true
    for key in sprites.keys():
        sprites[key].visible=false
