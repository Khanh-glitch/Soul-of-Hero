class_name VenomSourceDisplayPost
extends ColorRect

## Source original display.ts Display.present() adapter for Godot 4.7.
## The 2 uploaded textures are original scene and independent glow buffers;
## unlike isolated Sprite2D additive overlay, source Gold always composites
## through Display.FRAG on a full viewport, including grade and shock.
const SOURCE_SHADER=preload("res://prototypes/gold_pair/venom_source_display_post.gdshader")
var post_material:ShaderMaterial
var source_density:int=2

func _ready()->void:
    _ensure_material()
    mouse_filter=Control.MOUSE_FILTER_IGNORE

func _ensure_material()->void:
    if post_material!=null:return
    post_material=ShaderMaterial.new()
    post_material.shader=SOURCE_SHADER
    material=post_material

func bind_source_layers(scene_texture:Texture2D,glow_texture:Texture2D,
        density:int=2)->void:
    _ensure_material()
    if density!=1 and density!=2:
        push_error("Gold Display supports only Classic k1 and Ultra k2")
        return
    source_density=density
    size=Vector2(float(600*density),float(340*density))
    post_material.set_shader_parameter("u_scene",scene_texture)
    post_material.set_shader_parameter("u_glow",glow_texture)
    post_material.set_shader_parameter("u_res",size)
    post_material.set_shader_parameter("u_shock",PackedVector4Array([
        Vector4.ZERO,Vector4.ZERO,Vector4.ZERO,Vector4.ZERO
    ]))
    post_material.set_shader_parameter("u_shake",Vector2.ZERO)
    post_material.set_shader_parameter("u_flash",Vector4.ZERO)
    post_material.set_shader_parameter("u_grade",Vector4(0.0,1.0,0.0,1.0))

## SOURCE original Display.present() multiplies XY shake/shock/radius/strength
## by renderer k, *not* RGBA flash or grade. Keep this state separate from
## render rate (the caller owns authoritative World 60Hz / RNG).
func present_source_feedback(source_world_time:float,
        shake_world:Vector2=Vector2.ZERO,
        shock_world:Array[Vector4]=[],
        flash_rgba:Vector4=Vector4.ZERO,
        grade:Vector4=Vector4(0.0,1.0,0.0,1.0))->void:
    _ensure_material()
    post_material.set_shader_parameter("u_time",source_world_time)
    post_material.set_shader_parameter("u_shake",shake_world*float(source_density))
    var shocks:=PackedVector4Array()
    for i in range(4):
        var s:Vector4=shock_world[i] if i<shock_world.size() else Vector4.ZERO
        shocks.append(s*float(source_density))
    post_material.set_shader_parameter("u_shock",shocks)
    post_material.set_shader_parameter("u_flash",flash_rgba)
    post_material.set_shader_parameter("u_grade",grade)
