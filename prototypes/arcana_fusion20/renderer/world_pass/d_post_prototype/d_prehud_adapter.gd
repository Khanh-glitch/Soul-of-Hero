## Isolated, opt-in D bloom/COMP experiment. A caller must supply a separate
## real pre-HUD world texture; never point it at this output viewport (feedback).
## Original BRIGHT/BLUR/COMP structure, but native viewport ordering, color
## transfer, actor ordering and source-image fidelity are NOT validated.
## Not production binding. No gameplay state. One cast only; no arbitration.
extends Node
class_name Arcana20DPreHudPrototype

const BRIGHT := preload("res://prototypes/arcana_fusion20/renderer/world_pass/d_post_prototype/bright.gdshader")
const BLUR := preload("res://prototypes/arcana_fusion20/renderer/world_pass/d_post_prototype/blur.gdshader")
const COMP := preload("res://prototypes/arcana_fusion20/renderer/world_pass/d_post_prototype/composite.gdshader")
const HALF := Vector2i(240, 135)
const QUARTER := Vector2i(120, 67)
var _passes: Array[SubViewport] = []
var _output: CanvasLayer
var _rect: ColorRect
var _material: ShaderMaterial

func _stage(size: Vector2i, shader: Shader, input: Texture2D, settings: Dictionary) -> Texture2D:
    var view := SubViewport.new()
    view.size = size
    view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    view.transparent_bg = false
    add_child(view)
    _passes.append(view)
    var rect := ColorRect.new()
    rect.size = Vector2(size)
    rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    var material := ShaderMaterial.new()
    material.shader = shader
    if shader == BRIGHT:
        material.set_shader_parameter("scene_nearest", input)
        material.set_shader_parameter("scene_linear", input)
    else:
        material.set_shader_parameter("input_tex", input)
    for key in settings: material.set_shader_parameter(key, settings[key])
    rect.material = material
    view.add_child(rect)
    return view.get_texture()

func attach(world_before_hud: Texture2D) -> bool:
    # This prototype cannot detect every renderer-level cyclic dependency;
    # the caller is responsible for the explicit separate input contract.
    if not is_inside_tree() or world_before_hud == null or not _passes.is_empty(): return false
    var a := _stage(HALF, BRIGHT, world_before_hud, {"threshold": 0.42, "knee": 0.5})
    a = _stage(HALF, BLUR, a, {"direction": Vector2(1.6 / HALF.x, 0)})
    a = _stage(HALF, BLUR, a, {"direction": Vector2(0, 1.6 / HALF.y)})
    a = _stage(HALF, BLUR, a, {"direction": Vector2(3.1 / HALF.x, 0)})
    var small := _stage(HALF, BLUR, a, {"direction": Vector2(0, 3.1 / HALF.y)})
    var wide := _stage(QUARTER, BRIGHT, small, {"threshold": 0.18, "knee": 0.6, "linear_input": true})
    wide = _stage(HALF, BLUR, wide, {"direction": Vector2(2.4 / QUARTER.x, 0)})
    wide = _stage(QUARTER, BLUR, wide, {"direction": Vector2(0, 2.4 / HALF.y)})
    wide = _stage(HALF, BLUR, wide, {"direction": Vector2(4.6 / QUARTER.x, 0)})
    wide = _stage(QUARTER, BLUR, wide, {"direction": Vector2(0, 4.6 / HALF.y)})
    _output = CanvasLayer.new()
    _output.layer = 10
    add_child(_output)
    _rect = ColorRect.new()
    _rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _output.add_child(_rect)
    _rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    _material = ShaderMaterial.new()
    _material.shader = COMP
    _material.set_shader_parameter("world_scene", world_before_hud)
    _material.set_shader_parameter("bloom_small", small)
    _material.set_shader_parameter("bloom_wide", wide)
    _rect.material = _material
    return true

func set_bloom_gain(gain: float) -> void:
    if _material != null: _material.set_shader_parameter("bloom_amt", 0.68 * gain)

func detach() -> void:
    if is_instance_valid(_output):
        _output.queue_free()
        _output = null
        _rect = null
        _material = null
    for view in _passes: view.queue_free()
    _passes.clear()

func _exit_tree() -> void:
    detach()
