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
var _previous_activity := -1
var upload_counts: Dictionary = {} # diagnostic texture update/create counts

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
    # Do not re-upload a field that is known clear in both this and the
    # preceding frame. Active -> inactive uploads once to erase stale pixels;
    # unknown producers (-1) stay conservative. Activity is authored writes,
    # including black ink/zero-color operations, never RGB thresholding.
    var activity := frame.c_field_activity
    if _field_needs_upload("ground", activity, CFrame.FIELD_GROUND):
        var ground := frame.c_ground.duplicate()
        for i in range(CFrame.N):
            ground[i * 4 + 3] = clampi(roundi(frame.c_ground_coverage[i] * 255.0), 0, 255)
        _set_texture("ground", Image.create_from_data(384, 216, false, Image.FORMAT_RGBA8, ground))
    _sprite.texture = _textures["ground"]
    _material.set_shader_parameter("ground_tex", _sprite.texture)
    if _field_needs_upload("ink", activity, CFrame.FIELD_INK):
        _set_texture("ink", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_ink.to_byte_array()))
    _material.set_shader_parameter("ink_tex", _textures["ink"])
    if _field_needs_upload("light", activity, CFrame.FIELD_LIGHT):
        _set_texture("light", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_light.to_byte_array()))
    _material.set_shader_parameter("light_tex", _textures["light"])
    if _field_needs_upload("disp", activity, CFrame.FIELD_DISP):
        _set_texture("disp", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_disp.to_byte_array()))
    _material.set_shader_parameter("disp_tex", _textures["disp"])
    if _field_needs_upload("fragment", activity, CFrame.FIELD_FRAGMENT):
        _set_texture("fragment", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_world_fragment.to_byte_array()))
    _material.set_shader_parameter("fragment_tex", _textures["fragment"])
    if _field_needs_upload("influence", activity, CFrame.FIELD_INFLUENCE):
        _set_texture("influence", Image.create_from_data(384, 216, false, Image.FORMAT_R8, frame.c_influence))
    _material.set_shader_parameter("influence_tex", _textures["influence"])
    _previous_activity = activity
    var has_live_light := frame.c_live_light_count > 0
    _material.set_shader_parameter("live_light_enabled", has_live_light)
    if has_live_light:
        _material.set_shader_parameter("live_light_index", _set_texture("live_light_index", Image.create_from_data(384, 216, false, Image.FORMAT_RGBAF, frame.c_live_light_index.to_byte_array())))
        # Hold an exponentially grown atlas while this viewer lives: changing
        # particle counts must not reallocate a GPU texture on every frame.
        var atlas_height := 1
        while atlas_height < frame.c_live_light_height: atlas_height *= 2
        if _textures.has("live_light_ops"):
            atlas_height = maxi(atlas_height, (_textures["live_light_ops"] as ImageTexture).get_height())
        var atlas := frame.c_live_light_operations.duplicate()
        atlas.resize(384 * atlas_height * 4)
        _material.set_shader_parameter("live_light_ops", _set_texture("live_light_ops", Image.create_from_data(384, atlas_height, false, Image.FORMAT_RGBAF, atlas.to_byte_array())))
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

func _field_needs_upload(key: String, activity: int, bit: int) -> bool:
    return not _textures.has(key) or (activity & bit) != 0 or (_previous_activity & bit) != 0

func _set_texture(key: String, image: Image) -> ImageTexture:
    upload_counts[key] = int(upload_counts.get(key, 0)) + 1
    if not _textures.has(key) or Vector2i((_textures[key] as ImageTexture).get_width(), (_textures[key] as ImageTexture).get_height()) != image.get_size():
        _textures[key] = ImageTexture.create_from_image(image)
    else:
        var tex: ImageTexture = _textures[key]
        tex.update(image)
    return _textures[key]

func clear() -> void:
    if _sprite != null:
        _sprite.visible = false
