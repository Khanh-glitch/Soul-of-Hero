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
func _bloom_influence(source: PackedByteArray) -> PackedByteArray:
    var horizontal := PackedByteArray()
    var result := PackedByteArray()
    horizontal.resize(AFramebuffer.W * AFramebuffer.H)
    result.resize(AFramebuffer.W * AFramebuffer.H)
    for y in range(AFramebuffer.H):
        var count := 0
        for x in range(AFramebuffer.W):
            if x == 0:
                for k in range(0, RADIUS + 1):
                    count += int(source[y * AFramebuffer.W + k])
            else:
                var add_x := x + RADIUS
                var rem_x := x - RADIUS - 1
                if add_x < AFramebuffer.W:
                    count += int(source[y * AFramebuffer.W + add_x])
                if rem_x >= 0:
                    count -= int(source[y * AFramebuffer.W + rem_x])
            horizontal[y * AFramebuffer.W + x] = 1 if count > 0 else 0
    for x in range(AFramebuffer.W):
        var count := 0
        for y in range(AFramebuffer.H):
            if y == 0:
                for k in range(0, RADIUS + 1):
                    count += int(horizontal[k * AFramebuffer.W + x])
            else:
                var add_y := y + RADIUS
                var rem_y := y - RADIUS - 1
                if add_y < AFramebuffer.H:
                    count += int(horizontal[add_y * AFramebuffer.W + x])
                if rem_y >= 0:
                    count -= int(horizontal[rem_y * AFramebuffer.W + x])
            result[y * AFramebuffer.W + x] = 1 if count > 0 else 0
    return result

func consume(frame: Arcana20SourcePassFrame) -> void:
    if frame.family != &"A" or frame.source_size != Vector2i(AFramebuffer.W, AFramebuffer.H):
        return
    var count := AFramebuffer.W * AFramebuffer.H
    var ink := PackedFloat32Array()
    var masks := PackedFloat32Array()
    var bloom := PackedFloat32Array()
    ink.resize(count * 4)
    masks.resize(count * 4)
    bloom.resize(frame.a_bloom_size.x * frame.a_bloom_size.y * 4)
    var expanded := _bloom_influence(frame.a_influence)
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
    _sprite.texture = _set_texture("ink", Vector2i(AFramebuffer.W, AFramebuffer.H), ink)
    _material.set_shader_parameter("source_ink", _sprite.texture)
    _material.set_shader_parameter("influence_multiplier", _set_texture("mask", Vector2i(AFramebuffer.W, AFramebuffer.H), masks))
    _material.set_shader_parameter("bloom_tex", _set_texture("bloom", frame.a_bloom_size, bloom))
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
    if not _textures.has(key):
        _textures[key] = ImageTexture.create_from_image(image)
    else:
        var texture: ImageTexture = _textures[key]
        texture.update(image)
    return _textures[key]

func clear() -> void:
    if _sprite != null:
        _sprite.visible = false
