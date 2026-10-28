class_name VenomSourceParticlesCanvas
extends Node2D

## Source-native procedural Gold particle renderer (all 11 original kinds).
## Each source tick draws from live Particles.update() state to 1200x680
## separate scene/light textures. No frame image playback or baked particle
## sprites. The original Layer CPU and Pixi composition rules are tested
## independently; full Gold shader compositor is a separate fidelity gate.
const SOURCE_PARTS=preload("res://prototypes/gold_pair/venom_glassfang_source_particles.gd")
var source_density:int=2
var width:int=1200
var height:int=680
var cpu_renderer
var images:Dictionary={}
var textures:Dictionary={}
var sprites:Dictionary={}
var rendered_count:int=0
var render_frame:int=0

func set_source_density(density:int)->void:
    if sprites.size()>0:
        push_error("Gold source particle density must be set before scene tree")
        return
    if density!=1 and density!=2:
        push_error("Gold source supports only native Classic or Ultra")
        return
    source_density=density
    width=600*density
    height=340*density

func _ready()->void:
    _ensure_passes()
    set_process(false)

func _ensure_passes()->void:
    if sprites.size()==2:return
    cpu_renderer=SOURCE_PARTS.new(source_density)
    for pass_name in ["scene","glow"]:
        var image:=Image.create(width,height,false,Image.FORMAT_RGBA8)
        var texture:=ImageTexture.create_from_image(image)
        var sprite:=Sprite2D.new()
        sprite.name="OriginalGoldParticles_"+pass_name
        sprite.centered=false
        sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
        sprite.texture=texture
        sprite.z_index=0 if pass_name=="scene" else 1
        if pass_name=="glow":
            var material:=CanvasItemMaterial.new()
            material.blend_mode=CanvasItemMaterial.BLEND_MODE_ADD
            sprite.material=material
        add_child(sprite)
        images[pass_name]=image
        textures[pass_name]=texture
        sprites[pass_name]=sprite

func set_source_to_map_transform(xform:Transform2D)->void:
    _ensure_passes()
    for key in sprites.keys():sprites[key].transform=xform

func render_source_world_particles(parts:Array,source_tick:int)->Dictionary:
    _ensure_passes()
    if source_tick<render_frame:
        push_error("Original source particle clock moved backwards")
        return {}
    render_frame=source_tick
    cpu_renderer.render_source_particles(parts)
    var out:Dictionary=cpu_renderer.buffers()
    for key in ["scene","glow"]:
        var buffer:PackedByteArray=out[key]
        if buffer.size()!=width*height*4:
            push_error("Original source-native particle frame buffer dimensions drift")
            return {}
        var im:Image=images[key]
        im.set_data(width,height,false,Image.FORMAT_RGBA8,buffer)
        textures[key].update(im)
        sprites[key].visible=parts.size()>0
    rendered_count=parts.size()
    return out

func release_source_particles()->void:
    _ensure_passes()
    rendered_count=0
    for key in sprites.keys():sprites[key].visible=false
