## Optional source-C stage viewport consumer. Explicitly NOT production-ready:
## no multiscale bloom, desat ordering differs from the original pre-ink ground
## pass, and overlap arbitration is a deterministic diagnostic policy only.
## Canvas layer 10 is above the live world/actors but below A0 HUD layer 20.
extends CanvasLayer
class_name Arcana20CViewportPost

const POST_SHADER := preload("res://prototypes/arcana_fusion20/renderer/world_pass/c_viewport_post.gdshader")
var _renderer: Arcana20Renderer
var _states: Dictionary = {}
var _rect: ColorRect
var _material: ShaderMaterial

func _ready() -> void:
    layer = 10
    var back := BackBufferCopy.new()
    back.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
    add_child(back)
    _rect = ColorRect.new()
    _rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    _rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _material = ShaderMaterial.new()
    _material.shader = POST_SHADER
    _rect.material = _material
    _rect.visible = false
    add_child(_rect)

func attach(renderer: Arcana20Renderer) -> bool:
    if not is_instance_valid(renderer) or not renderer.world_pass_mode:
        return false
    detach()
    _renderer = renderer
    renderer.source_pass_ready.connect(_on_frame)
    renderer.cast_finished.connect(_on_finished)
    renderer.source_layer_finished.connect(_on_layer_finished)
    return true

func _on_frame(id: StringName, frame: Arcana20SourcePassFrame) -> void:
    if frame.family != &"C":
        return
    var viewport := get_viewport()
    # C shake/chroma use source pixels; map them to physical viewport pixels.
    var map := viewport.get_final_transform() * viewport.canvas_transform * frame.source_to_world
    var shake := map.basis_xform(Vector2(round(frame.shake.x), round(frame.shake.y)))
    var pixel_x := map.basis_xform(Vector2.RIGHT).length()
    _states[id] = {"flash": frame.flash, "shake": shake, "chroma": frame.chroma * pixel_x,
        "invert": frame.invert, "desat": frame.desat}
    _apply()

func _on_layer_finished(id: StringName, family: StringName) -> void:
    if family == &"C": _on_finished(id)

func _on_finished(id: StringName) -> void:
    _states.erase(id)
    _apply()

func _apply() -> void:
    if _rect == null:
        return
    # Diagnostic policy: sum flash, take strongest displacement and max other
    # impulses. Different sources' original compositors did not specify
    # cross-cast ordering; this is not an approved interaction contract.
    var flash := Vector3.ZERO
    var shake := Vector2.ZERO
    var chroma := 0.0
    var invert := 0.0
    var desat := 0.0
    for state in _states.values():
        flash += state.flash
        var state_shake: Vector2 = state.shake
        if state_shake.length_squared() > shake.length_squared(): shake = state_shake
        chroma = maxf(chroma, float(state.chroma))
        invert = maxf(invert, float(state.invert))
        desat = maxf(desat, float(state.desat))
    _rect.visible = not flash.is_zero_approx() or not shake.is_zero_approx() or chroma > 0.2 or invert > 0.0 or desat > 0.0
    _material.set_shader_parameter("flash", flash)
    _material.set_shader_parameter("shake_pixels", shake)
    _material.set_shader_parameter("chroma_pixels", chroma)
    _material.set_shader_parameter("invert", invert)
    _material.set_shader_parameter("desat", desat)

func detach() -> void:
    if is_instance_valid(_renderer):
        if _renderer.source_pass_ready.is_connected(_on_frame): _renderer.source_pass_ready.disconnect(_on_frame)
        if _renderer.cast_finished.is_connected(_on_finished): _renderer.cast_finished.disconnect(_on_finished)
        if _renderer.source_layer_finished.is_connected(_on_layer_finished): _renderer.source_layer_finished.disconnect(_on_layer_finished)
    _renderer = null
    _states.clear()
    _apply()

func _exit_tree() -> void:
    detach()
