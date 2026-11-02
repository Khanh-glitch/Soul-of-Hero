## Experimental A-source field viewer over live scene. Does not certify the
## current fusion/redesign geometries as authentic, and does not implement
## actor depth, source camera post, refraction or full-source parity.
extends Node2D
class_name Arcana20AWorldPass

const SHADER = preload("res://prototypes/arcana_fusion20/renderer/world_pass/a_world_composite.gdshader")
const RADIUS := 32 # 2 source blur passes * 3 quarter-res texels + sampling margin
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

## Conservative separable dilation of the source operation footprint, not
## color extraction. Bound the source bloom support without a giant texture.
func _bloom_influence(source: PackedByteArray, width: int = AFramebuffer.W, height: int = AFramebuffer.H) -> PackedByteArray:
    var horizontal := PackedByteArray()
    var result := PackedByteArray()
    horizontal.resize(width * height)
    result.resize(width * height)
    for y in range(height):
        var count := 0
        for x in range(width):
            if x == 0:
                for k in range(0, RADIUS + 1):
                    count += int(source[y * width + k])
            else:
                var add_x := x + RADIUS
                var rem_x := x - RADIUS - 1
                if add_x < width:
                    count += int(source[y * width + add_x])
                if rem_x >= 0:
                    count -= int(source[y * width + rem_x])
            horizontal[y * width + x] = 1 if count > 0 else 0
    for x in range(width):
        var count := 0
        for y in range(height):
            if y == 0:
                for k in range(0, RADIUS + 1):
                    count += int(horizontal[k * width + x])
            else:
                var add_y := y + RADIUS
                var rem_y := y - RADIUS - 1
                if add_y < height:
                    count += int(horizontal[add_y * width + x])
                if rem_y >= 0:
                    count -= int(horizontal[rem_y * width + x])
            result[y * width + x] = 1 if count > 0 else 0
    return result

func consume(frame: Arcana20SourcePassFrame) -> void:
    if frame.family != &"A" or frame.source_size.x < 64 or frame.source_size.y < 64:
        return
    var width := frame.source_size.x
    var height := frame.source_size.y
    var count := width * height
    if frame.a_rgb.size() != count * 3 or frame.a_coverage.size() != count or frame.a_influence.size() != count or frame.a_multiplier.size() != count or frame.a_world_warp.size() != count * 2:
        push_error("A_WORLD_PASS_FAIL invalid source field dimensions")
        return
    var ink := PackedFloat32Array()
    var masks := PackedFloat32Array()
    var bloom := PackedFloat32Array()
    ink.resize(count * 4)
    masks.resize(count * 4)
    bloom.resize(frame.a_bloom_size.x * frame.a_bloom_size.y * 4)
    var expanded := _bloom_influence(frame.a_influence, width, height)
    for p in range(count):
        var i := p * 4
        var j := p * 3
        ink[i] = frame.a_rgb[j]
        ink[i + 1] = frame.a_rgb[j + 1]
        ink[i + 2] = frame.a_rgb[j + 2]
        ink[i + 3] = frame.a_coverage[p]
        masks[i] = frame.a_multiplier[p]
        masks[i + 1] = frame.a_world_warp[p * 2]
        masks[i + 2] = frame.a_world_warp[p * 2 + 1]
        masks[i + 3] = float(expanded[p])
    for p in range(frame.a_bloom_size.x * frame.a_bloom_size.y):
        bloom[p * 4] = frame.a_bloom_rgb[p * 3]
        bloom[p * 4 + 1] = frame.a_bloom_rgb[p * 3 + 1]
        bloom[p * 4 + 2] = frame.a_bloom_rgb[p * 3 + 2]
    _sprite.texture = _set_texture("ink", Vector2i(width, height), ink)
    _material.set_shader_parameter("source_ink", _sprite.texture)
    _material.set_shader_parameter("influence_multiplier", _set_texture("mask", Vector2i(width, height), masks))
    _material.set_shader_parameter("bloom_tex", _set_texture("bloom", frame.a_bloom_size, bloom))
    # Opt-in #11 presentation split; all other A consumers retain the exact
    # original composite. Upload only for this variant and keep a_rgb intact.
    var carousel := frame.a_carousel_rotor_rgb.size() == count * 3 and frame.a_carousel_rotor_bloom_rgb.size() == frame.a_bloom_size.x * frame.a_bloom_size.y * 3
    _material.set_shader_parameter("carousel_presentation", carousel)
    # #01's additive A crown fades into bright SOH terrain. Preview-only
    # exposure of its light field; no source geometry/timing or C layer edit.
    _material.set_shader_parameter("crown_presentation", frame.variant == &"crown")
    if carousel:
        var rotor := PackedFloat32Array()
        var rotor_bloom := PackedFloat32Array()
        rotor.resize(count * 4)
        rotor_bloom.resize(frame.a_bloom_size.x * frame.a_bloom_size.y * 4)
        for p in range(count):
            for c in range(3): rotor[p * 4 + c] = frame.a_carousel_rotor_rgb[p * 3 + c]
        for p in range(frame.a_bloom_size.x * frame.a_bloom_size.y):
            for c in range(3): rotor_bloom[p * 4 + c] = frame.a_carousel_rotor_bloom_rgb[p * 3 + c]
        _material.set_shader_parameter("carousel_rotor_tex", _set_texture("carousel_rotor", Vector2i(width, height), rotor))
        _material.set_shader_parameter("carousel_rotor_bloom_tex", _set_texture("carousel_rotor_bloom", frame.a_bloom_size, rotor_bloom))
    _material.set_shader_parameter("bloom_amount", frame.a_bloom)
    _material.set_shader_parameter("exposure", frame.a_exposure)
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

func _set_texture(key: String, size: Vector2i, data: PackedFloat32Array) -> ImageTexture:
    var image := Image.create_from_data(size.x, size.y, false, Image.FORMAT_RGBAF, data.to_byte_array())
    if _textures.has(key):
        var existing: ImageTexture = _textures[key]
        if Vector2i(existing.get_width(), existing.get_height()) != size:
            _textures.erase(key)
    if not _textures.has(key):
        _textures[key] = ImageTexture.create_from_image(image)
    else:
        var texture: ImageTexture = _textures[key]
        texture.update(image)
    return _textures[key]

func clear() -> void:
    if _sprite != null:
        _sprite.visible = false
