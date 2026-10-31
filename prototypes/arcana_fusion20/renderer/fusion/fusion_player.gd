## ONE authored choreography driving two true-source engines on a shared
## deterministic clock (fusion, not two independent casts): shared
## caster/target anchors, per-layer ownership (back/front), authored
## time offsets so both sources' impact beats land on the same tick,
## and one merged typed event ledger. Used by the A+C / A+B+C fusions.
extends Node2D
class_name FusionPlayer

signal visual_event(kind: StringName, world_pos: Vector2, source_time: float)
signal visual_contact(kind: StringName, world_pos: Vector2, source_time: float)
signal finished()
signal screen_post(state: Dictionary)
signal source_pass_ready(frame: Arcana20SourcePassFrame)
# A source family can finish before the shared fusion timeline. Owners must
# remove that family's last visual field/post without ending the other part.
signal source_layer_finished(family: StringName)

const STEP := 1.0 / 60.0

var duration := 6.6
var _back: Node2D
var _front: Node2D
var _back_offset := 0.0
var _front_offset := 0.0
var _tick := 0
var _acc := 0.0
var _active := false
var _pending: Array = []
var _retired_families: Dictionary = {}

## parts: Array of {node, offset, layer} — node must implement
## begin(caster,target[,kind]) variants handled by caller before add.
func configure(parts: Array, dur: float) -> void:
    duration = dur
    _pending = parts

func begin(caster_world: Vector2, target_world: Vector2) -> void:
    _retired_families.clear()
    for part in _pending:
        var node: Node2D = part.node
        add_child(node)
        node.z_index = int(part.get("layer", 0))
        if node.has_method("set_render_enabled"):
            node.set("render_enabled", true)
        # begin via duck-typed call stored by caller
        var bc: Callable = part.begin_call
        bc.call(node, caster_world, target_world)
        node.set_process(false)  # fusion clock is the only driver
        node.set("_acc", 0.0)  # fusion clock drives advance() manually
        if int(part.get("layer", 0)) < 0:
            _back = node
            _back_offset = float(part.get("offset", 0.0))
        else:
            _front = node
            _front_offset = float(part.get("offset", 0.0))
        node.visual_event.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_event.emit(kind, pos, source_time()))
        node.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            # Preserve each source contact even if timestamps coincide.
            # These are visual cues, never combat-damage instructions.
            visual_contact.emit(kind, pos, source_time()))
        if node.has_signal("screen_post"):
            node.connect("screen_post", func(state: Dictionary) -> void:
                screen_post.emit(state))
        if node.has_signal("source_pass_ready"):
            node.connect("source_pass_ready", func(frame: Arcana20SourcePassFrame) -> void:
                source_pass_ready.emit(frame))
        node.finished.connect(func() -> void:
            _on_child_finished(node))
    _tick = 0
    _acc = 0.0
    _active = true

func _source_family(node: Node) -> StringName:
    if node is ASourcePlayer: return &"A"
    if node is BSourcePlayer: return &"B"
    if node is CSourcePlayer: return &"C"
    if node is DSourcePlayer: return &"D"
    return &""

func _child_active(child: Node) -> bool:
    if child is BSourcePlayer: return (child as BSourcePlayer).active
    return bool(child.get("_active"))

func _on_child_finished(child: Node) -> void:
    # stop() also hides the legacy sprite when advance() naturally finished;
    # its own _active flag is already false, so it does not re-emit finished.
    if child.has_method("stop"): child.call("stop")
    if not _active: return # parent cancellation will remove every viewer
    var family := _source_family(child)
    if family == &"" or _retired_families.has(family): return
    for part in _pending:
        var other: Node = part.node
        if other != child and is_instance_valid(other) and _source_family(other) == family and _child_active(other):
            return
    _retired_families[family] = true
    source_layer_finished.emit(family)

func stop() -> void:
    var was := _active
    _active = false
    for part in _pending:
        var node: Node = part.node
        if is_instance_valid(node) and node.has_method("stop"):
            node.call("stop")
    if was:
        finished.emit()

func source_time() -> float:
    return float(_tick) * STEP

func advance(dt: float) -> void:
    if not _active:
        return
    _acc += dt
    var guard := 0
    while _acc >= STEP and guard < 8:
        _acc -= STEP
        guard += 1
        _tick += 1
        for part in _pending:
            var node: Node = part.node
            if not is_instance_valid(node):
                continue
            var local_t := source_time() + float(part.get("offset", 0.0))
            # drive child to its local time using its own advance()
            var child_tick: int = int(node.get("_tick"))
            var want_tick := int(round(local_t / STEP))
            var guard2 := 0
            while child_tick < want_tick and guard2 < 4:
                node.call("advance", STEP, false)
                child_tick = int(node.get("_tick"))
                guard2 += 1
                if not bool(node.get("_active")):
                    break
        if source_time() >= duration:
            _active = false
            finished.emit()
            break
    # Both child simulations may have consumed several fixed steps; composite
    # each source only once after the shared clock catches up.
    if guard > 0 and _active:
        for part in _pending:
            var node: Node = part.node
            if is_instance_valid(node) and bool(node.get("_active")):
                node.call("_render_frame")

func _process(delta: float) -> void:
    advance(delta)

func diagnostics() -> Dictionary:
    return {"transport": "fusion_dual_source_shared_clock", "tick": _tick, "active": _active}
