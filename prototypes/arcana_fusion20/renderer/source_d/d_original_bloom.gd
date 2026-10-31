## Original D multi-resolution bright/blur chain operating on an explicit scene
## texture. This producer is not yet attached to the live SOH scene and does
## not implement D post or constitute world/visual approval. A caller must pass
## the actual world-composited scene, never a Gold/fake battlefield.
extends Node
class_name DOriginalBloom

const STAGE = preload("res://prototypes/arcana_fusion20/renderer/source_d/d_bloom_stage.gdshader")
const HALF := Vector2i(240, 135)
const QUARTER := Vector2i(120, 67)
var _stages: Array[SubViewport] = []
var _first_material: ShaderMaterial
var _small: SubViewport
var _wide: SubViewport

func _stage(input: Texture2D, size: Vector2i, mode: int, dir: Vector2, nearest := false, threshold := 0.42, knee := 0.5) -> SubViewport:
    var vp := SubViewport.new()
    vp.size = size
    vp.disable_3d = true
    vp.transparent_bg = false
    vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    add_child(vp)
    var rect := ColorRect.new()
    rect.size = Vector2(size)
    var mat := ShaderMaterial.new()
    mat.shader = STAGE
    mat.set_shader_parameter("input_nearest", input)
    mat.set_shader_parameter("input_linear", input)
    mat.set_shader_parameter("nearest_input", nearest)
    mat.set_shader_parameter("stage_mode", mode)
    mat.set_shader_parameter("direction", dir)
    mat.set_shader_parameter("threshold", threshold)
    mat.set_shader_parameter("knee", knee)
    rect.material = mat
    vp.add_child(rect)
    _stages.append(vp)
    if _first_material == null: _first_material = mat
    return vp

func setup(scene: Texture2D) -> void:
    assert(_stages.is_empty(), "D bloom setup must only be called once")
    var bright := _stage(scene, HALF, 0, Vector2.ZERO, true, 0.42, 0.5)
    var h1 := _stage(bright.get_texture(), HALF, 1, Vector2(1.6 / HALF.x, 0.0))
    var v1 := _stage(h1.get_texture(), HALF, 1, Vector2(0.0, 1.6 / HALF.y))
    var h2 := _stage(v1.get_texture(), HALF, 1, Vector2(3.1 / HALF.x, 0.0))
    _small = _stage(h2.get_texture(), HALF, 1, Vector2(0.0, 3.1 / HALF.y))
    var bright2 := _stage(_small.get_texture(), QUARTER, 0, Vector2.ZERO, false, 0.18, 0.6)
    var h3 := _stage(bright2.get_texture(), HALF, 1, Vector2(2.4 / QUARTER.x, 0.0))
    var v3 := _stage(h3.get_texture(), QUARTER, 1, Vector2(0.0, 2.4 / HALF.y))
    var h4 := _stage(v3.get_texture(), HALF, 1, Vector2(4.6 / QUARTER.x, 0.0))
    _wide = _stage(h4.get_texture(), QUARTER, 1, Vector2(0.0, 4.6 / HALF.y))

func set_scene(scene: Texture2D) -> void:
    _first_material.set_shader_parameter("input_nearest", scene)
    _first_material.set_shader_parameter("input_linear", scene)

func small_texture() -> Texture2D:
    return _small.get_texture()

func wide_texture() -> Texture2D:
    return _wide.get_texture()
