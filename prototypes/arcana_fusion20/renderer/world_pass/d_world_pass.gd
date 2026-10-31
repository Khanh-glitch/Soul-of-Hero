## Diagnostic D live-world floor warp + additive fields; NO bloom pyramid,
## viewport post, persistent decals, actor depth, fidelity or production claim.
extends Node2D
class_name Arcana20DWorldPass
const SHADER = preload("res://prototypes/arcana_fusion20/renderer/world_pass/d_world_composite.gdshader")
var _sprite: Sprite2D
var _material: ShaderMaterial
var _textures: Dictionary = {}

func _init() -> void:
    z_index = -24

func _ready() -> void:
    var back := BackBufferCopy.new()
    back.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
    add_child(back)
    _sprite = Sprite2D.new()
    _sprite.centered = false
    _sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    _material = ShaderMaterial.new()
    _material.shader = SHADER
    _sprite.material = _material
    add_child(_sprite)
    _sprite.visible = false

func consume(frame: Arcana20SourcePassFrame) -> void:
    if frame.family != &"D" or frame.source_size != Vector2i(DFx.W, DFx.H): return
    var light := PackedFloat32Array()
    var influence := PackedFloat32Array()
    light.resize(DFx.N * 4)
    influence.resize(DFx.N * 4)
    for p in range(DFx.N):
        light[p * 4] = frame.d_rgb[p * 3]
        light[p * 4 + 1] = frame.d_rgb[p * 3 + 1]
        light[p * 4 + 2] = frame.d_rgb[p * 3 + 2]
        influence[p * 4 + 3] = float(frame.d_influence[p] | frame.d_warp_influence[p])
    _sprite.texture = _set_texture("light", light)
    _material.set_shader_parameter("light_tex", _sprite.texture)
    _material.set_shader_parameter("warp_tex", _set_texture("warp", frame.d_world_warp))
    _material.set_shader_parameter("influence_tex", _set_texture("influence", influence))
    _material.set_shader_parameter("source_time", frame.d_renderer_time)
    _material.set_shader_parameter("warp_amount", frame.d_warp_amount)
    _sprite.global_transform = frame.source_to_world
    _sprite.visible = true
    _update_camera_basis()

func _process(_delta: float) -> void:
    _update_camera_basis()

func _update_camera_basis() -> void:
    if _sprite == null or _material == null: return
    var transform := _sprite.get_global_transform_with_canvas()
    _material.set_shader_parameter("screen_dx", transform.x)
    _material.set_shader_parameter("screen_dy", transform.y)

func _set_texture(key: String, data: PackedFloat32Array) -> ImageTexture:
    var image := Image.create_from_data(DFx.W, DFx.H, false, Image.FORMAT_RGBAF, data.to_byte_array())
    if not _textures.has(key):
        _textures[key] = ImageTexture.create_from_image(image)
    else:
        var tex: ImageTexture = _textures[key]
        tex.update(image)
    return _textures[key]

func clear() -> void:
    if _sprite != null: _sprite.visible = false
