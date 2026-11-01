## Viewport-aligned C stage-to-terrain consumer. Local C geometry remains in
## its own world-space pass; actors/HUD draw afterward. Experimental: source
## full-post ordering, foreground occlusion and multicasters need review.
extends Node2D
class_name Arcana20CStageWorld
const SHADER := preload("res://prototypes/arcana_fusion20/renderer/world_pass/c_stage_world.gdshader")
var _states: Dictionary = {}
var _rect: ColorRect
var _material: ShaderMaterial
var _scan_texture: ImageTexture
func _init() -> void:
    z_index = -25
func _ready() -> void:
    var back := BackBufferCopy.new()
    back.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
    add_child(back)
    _rect = ColorRect.new()
    _rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _material = ShaderMaterial.new()
    _material.shader = SHADER
    _rect.material = _material
    add_child(_rect)
    _rect.visible = false
    visible = false
    _sync_view()
func _process(_delta: float) -> void:
    _sync_view()
func _sync_view() -> void:
    if not is_inside_tree(): return
    # Counteract camera translation, rotation and zoom, so this rectangle is
    # the physical viewport rather than a source-sized transformed canvas.
    global_transform = get_viewport().get_canvas_transform().affine_inverse()
    _rect.size = get_viewport().get_visible_rect().size
func consume(id: StringName, frame: Arcana20SourcePassFrame) -> void:
    if frame.family != &"C": return
    var lines := frame.c_stage_scanlines
    var has_scan := false
    for v in lines:
        if v != 0.0:
            has_scan = true
            break
    if frame.c_stage_shade == 1.0 and not has_scan:
        _states.erase(id)
    else:
        # Frames borrow mutable source buffers. Retain a copy per active cast.
        _states[id] = {"shade": frame.c_stage_shade, "scan": lines.duplicate()}
    _apply()
func retire(id: StringName) -> void:
    _states.erase(id)
    _apply()
func _apply() -> void:
    if _rect == null: return
    var shade := 1.0
    var values := PackedFloat32Array()
    values.resize(216 * 4)
    var scan_active := false
    for state in _states.values():
        shade *= float(state.shade)
        var lines: PackedFloat32Array = state.scan
        for y in range(mini(216, int(lines.size() / 2))):
            values[y * 4] += lines[y * 2]
            values[y * 4 + 1] += lines[y * 2 + 1]
            if lines[y * 2] != 0.0 or lines[y * 2 + 1] != 0.0: scan_active = true
    _rect.visible = shade != 1.0 or scan_active
    visible = _rect.visible
    _material.set_shader_parameter("stage_shade", shade)
    _material.set_shader_parameter("scanlines_active", scan_active)
    if scan_active:
        var image := Image.create_from_data(216, 1, false, Image.FORMAT_RGBAF, values.to_byte_array())
        if _scan_texture == null: _scan_texture = ImageTexture.create_from_image(image)
        else: _scan_texture.update(image)
        _material.set_shader_parameter("scanlines", _scan_texture)
    _sync_view()
