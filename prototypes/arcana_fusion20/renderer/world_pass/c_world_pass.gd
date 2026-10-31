## Experimental real-screen source-C composition for JOIN QA only.
## It must be parented in the world's canvas ABOVE terrain and BELOW actors.
## A BackBufferCopy ensures each cast reads the real scene at this point in
## draw order. It does not solve foreground/background ink depth, bloom,
## viewport post, occlusion, cross-cast post arbitration or production perf.
extends Node2D
class_name Arcana20CWorldPass

const SHADER = preload("res://prototypes/arcana_fusion20/renderer/world_pass/c_world_composite.gdshader")
var _sprite: Sprite2D
var _material: ShaderMaterial
var _textures: Dictionary = {}

func _init() -> void:
    z_index = -24 # A0 Hollow Marches terrain z=-30..-26, entities z=0.

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
    if frame.family != &"C" or frame.source_size != Vector2i(384, 216):
        return
    var ground := frame.c_ground.duplicate()
    for i in range(CFrame.N):
        ground[i * 4 + 3] = clampi(roundi(frame.c_ground_coverage[i] * 255.0), 0, 255)
    _sprite.texture = _set_texture("ground", Image.create_from_data(384, 216, false, Image.FORMAT_RGBA8, ground))
    _material.set_shader_parameter("ground_tex", _sprite.texture)
    _material.set_shader_parameter("ink_tex", _set_texture("ink", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_ink.to_byte_array())))
    _material.set_shader_parameter("light_tex", _set_texture("light", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_light.to_byte_array())))
    _material.set_shader_parameter("disp_tex", _set_texture("disp", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_disp.to_byte_array())))
    _material.set_shader_parameter("fragment_tex", _set_texture("fragment", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_world_fragment.to_byte_array())))
    _material.set_shader_parameter("influence_tex", _set_texture("influence", Image.create_from_data(384, 216, false, Image.FORMAT_R8, frame.c_influence)))
    var has_live_light := frame.c_live_light_count > 0
    _material.set_shader_parameter("live_light_enabled", has_live_light)
    if has_live_light:
        _material.set_shader_parameter("live_light_index", _set_texture("live_light_index", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_live_light_index.to_byte_array())))
        _material.set_shader_parameter("live_light_ops", _set_texture("live_light_ops", Image.create_from_data(384, frame.c_live_light_height, false, Image.FORMAT_RGBAF, frame.c_live_light_operations.to_byte_array())))
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

func _set_texture(key: String, image: Image) -> ImageTexture:
    if not _textures.has(key) or (_textures[key] as ImageTexture).get_size() != image.get_size():
        _textures[key] = ImageTexture.create_from_image(image)
    else:
        var tex: ImageTexture = _textures[key]
        tex.update(image)
    return _textures[key]

func clear() -> void:
    if _sprite != null:
        _sprite.visible = false
