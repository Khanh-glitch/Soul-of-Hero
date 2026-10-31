## Diagnostic multi-cast A/B/C/D world-field router. Each cast/family gets its
## own consumer and ordered BackBufferCopy. This is intentionally opt-in: it
## does not implement post arbitration, actor/foreground depth, D bloom/post, or a
## production/performance contract, and must not mount itself in production.
extends Node2D
class_name Arcana20WorldPassMount

var _renderer: Arcana20Renderer
var _passes: Dictionary = {} # canonical id -> {family: viewer}
var unsupported: Dictionary = {}

func attach(renderer: Arcana20Renderer) -> bool:
    if not is_instance_valid(renderer) or not renderer.world_pass_mode:
        return false
    detach()
    _renderer = renderer
    _renderer.source_pass_ready.connect(_on_frame)
    _renderer.cast_finished.connect(_on_finished)
    _renderer.source_layer_finished.connect(_on_layer_finished)
    return true

func _on_frame(id: StringName, frame: Arcana20SourcePassFrame) -> void:
    if frame.family not in [&"A", &"B", &"C", &"D"]:
        unsupported[id] = frame.family
        return
    var by_family: Dictionary = _passes.get(id, {})
    var viewer: Node2D = by_family.get(frame.family)
    if not is_instance_valid(viewer):
        match frame.family:
            &"A": viewer = Arcana20AWorldPass.new()
            &"B": viewer = Arcana20BWorldPass.new()
            &"C": viewer = Arcana20CWorldPass.new()
            &"D": viewer = Arcana20DWorldPass.new()
        if viewer == null:
            return
        # Source #01's chosen C outer layer is behind A's crown candidate.
        # This does not establish actor depth or remove duplicated geometry.
        if String(id).ends_with("_01"):
            viewer.z_index = -25 if frame.family == &"C" else -23
        add_child(viewer)
        by_family[frame.family] = viewer
        _passes[id] = by_family
    viewer.call(&"consume", frame)

func _on_layer_finished(id: StringName, family: StringName) -> void:
    var by_family: Dictionary = _passes.get(id, {})
    var viewer: Node = by_family.get(family)
    if is_instance_valid(viewer):
        viewer.call(&"clear")
        viewer.queue_free()
    by_family.erase(family)
    if by_family.is_empty(): _passes.erase(id)
    else: _passes[id] = by_family

func _on_finished(id: StringName) -> void:
    var by_family: Dictionary = _passes.get(id, {})
    for viewer in by_family.values():
        if is_instance_valid(viewer):
            viewer.call(&"clear")
            viewer.queue_free()
    _passes.erase(id)
    unsupported.erase(id)

func active_viewers(id: StringName) -> int:
    var by_family: Dictionary = _passes.get(id, {})
    return by_family.size()

func detach() -> void:
    if is_instance_valid(_renderer):
        if _renderer.source_pass_ready.is_connected(_on_frame):
            _renderer.source_pass_ready.disconnect(_on_frame)
        if _renderer.cast_finished.is_connected(_on_finished):
            _renderer.cast_finished.disconnect(_on_finished)
        if _renderer.source_layer_finished.is_connected(_on_layer_finished):
            _renderer.source_layer_finished.disconnect(_on_layer_finished)
    _renderer = null
    for id in _passes.keys():
        _on_finished(id)
    unsupported.clear()

func _exit_tree() -> void:
    detach()
