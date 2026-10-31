## Experimental source-B world-field consumer. Draw above A0 terrain but below
## actors. This is JOIN QA, not a replacement for CT's viewport compositor or
## a visual-parity/production claim. Per-frame CPU packing is not optimized.
extends Node2D
class_name Arcana20BWorldPass

const SHADER = preload("res://prototypes/arcana_fusion20/renderer/world_pass/b_world_composite.gdshader")
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
    if frame.family != &"B" or frame.source_size != Vector2i(384, 216):
        return
    var ink := PackedFloat32Array()
    var ground := PackedFloat32Array()
    var light_shade := PackedFloat32Array()
    var warp_influence := PackedFloat32Array()
    ink.resize(BRenderer.N * 4)
    ground.resize(BRenderer.N * 4)
    light_shade.resize(BRenderer.N * 4)
    warp_influence.resize(BRenderer.N * 4)
    for p in range(BRenderer.N):
        var i := p * 4
        var j := p * 3
        for channel in range(3):
            ink[i + channel] = frame.b_ink_rgb[j + channel]
            ground[i + channel] = frame.b_ground_rgb[j + channel]
            light_shade[i + channel] = frame.b_light[j + channel]
        ink[i + 3] = frame.b_ink_coverage[p]
        ground[i + 3] = frame.b_ground_coverage[p]
        light_shade[i + 3] = frame.b_shade[p]
        warp_influence[i] = frame.b_world_warp[p * 2]
        warp_influence[i + 1] = frame.b_world_warp[p * 2 + 1]
        warp_influence[i + 3] = float(frame.b_influence[p])
    _sprite.texture = _set_texture("ink", ink)
    _material.set_shader_parameter("ink_tex", _sprite.texture)
    _material.set_shader_parameter("ground_tex", _set_texture("ground", ground))
    _material.set_shader_parameter("light_shade_tex", _set_texture("light_shade", light_shade))
    _material.set_shader_parameter("warp_influence_tex", _set_texture("warp_influence", warp_influence))
    _material.set_shader_parameter("ambient_tint", frame.b_tint * frame.b_ambient)
    _sprite.global_transform = frame.source_to_world
    _sprite.visible = true
    _update_camera_basis()

func _process(_delta: float) -> void:
    _update_camera_basis()

func _update_camera_basis() -> void:
    if _sprite == null or _material == null:
        return
    var transform := _sprite.get_global_transform_with_canvas()
    _material.set_shader_parameter("screen_dx", transform.x)
    _material.set_shader_parameter("screen_dy", transform.y)

func _set_texture(key: String, data: PackedFloat32Array) -> ImageTexture:
    var image := Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, data.to_byte_array())
    if not _textures.has(key):
        _textures[key] = ImageTexture.create_from_image(image)
    else:
        var tex: ImageTexture = _textures[key]
        tex.update(image)
    return _textures[key]

func clear() -> void:
    if _sprite != null:
        _sprite.visible = false
