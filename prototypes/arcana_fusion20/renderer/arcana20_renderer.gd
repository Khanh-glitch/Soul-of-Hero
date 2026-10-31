## ARCANA Fusion20 renderer host (AVFX stream, PR #28 contract).
## Public interface for Control Tower (PR #30, soh_binding) — visual only:
## this renderer never applies damage, HP, mana or cooldown. Combat
## authority emits real hits; we emit visual contact/body cues in return.
##
##   cast_skill(canonical_id, caster_world, target_world, facing) -> bool
##   cancel_all() / active_casts() -> Array[Dictionary diagnostics]
## Signals: cast_started, source_tick, visual_contact, body_event_cue,
## cast_finished (all carry the canonical arcana_fusion20_NN id).
extends Node2D
class_name Arcana20Renderer

signal cast_started(canonical_id: StringName)
signal source_tick(canonical_id: StringName, tick: int, phase: StringName)
signal visual_contact(canonical_id: StringName, world_position: Vector2, kind: StringName)
signal body_event_cue(canonical_id: StringName, world_position: Vector2, element: StringName)
signal cast_finished(canonical_id: StringName)

var _casts: Dictionary = {} # canonical_id -> Node (instance or B02 geometry)
var _last_tick_emitted: Dictionary = {}

func cast_skill(canonical_id: StringName, caster_world: Vector2, target_world: Vector2, facing: float = 1.0) -> bool:
    var id := Arcana20SOHRegistry_index(canonical_id)
    if id < 1:
        return false
    cancel_skill(canonical_id)
    if id == 2:
        # Regression fixture: the source-ported B geometry class, unchanged.
        var b02 := ArcanaB02SourceGeometry.new()
        add_child(b02)
        b02.visual_contact_cue.connect(func(pos: Vector2) -> void:
            visual_contact.emit(canonical_id, pos, &"source_climax")
            body_event_cue.emit(canonical_id, pos, &"fire"))
        b02.finished.connect(func() -> void: _on_finished(canonical_id))
        _casts[canonical_id] = b02
        cast_started.emit(canonical_id)
        b02.begin(caster_world, target_world)
        return true
    var inst := Arcana20SkillInstance.new()
    add_child(inst)
    inst.setup(id, caster_world, target_world, facing)
    inst.visual_contact.connect(func(sid: int, pos: Vector2, kind: StringName) -> void:
        visual_contact.emit(canonical_id, pos, kind))
    inst.body_event_cue.connect(func(sid: int, pos: Vector2, el: StringName) -> void:
        body_event_cue.emit(canonical_id, pos, el))
    inst.cast_finished.connect(func(sid: int) -> void: _on_finished(canonical_id))
    _casts[canonical_id] = inst
    cast_started.emit(canonical_id)
    inst.begin()
    return true

static func Arcana20SOHRegistry_index(canonical_id: StringName) -> int:
    var s := String(canonical_id)
    if not s.begins_with("arcana_fusion20_"):
        return -1
    var suffix := s.trim_prefix("arcana_fusion20_")
    if suffix.length() != 2 or not suffix.is_valid_int():
        return -1
    var id := int(suffix)
    return id if id >= 1 and id <= 20 else -1

func cancel_skill(canonical_id: StringName) -> void:
    if not _casts.has(canonical_id):
        return
    var node: Node = _casts[canonical_id]
    _casts.erase(canonical_id)
    _last_tick_emitted.erase(canonical_id)
    if node is Arcana20SkillInstance:
        (node as Arcana20SkillInstance).cancel()
    elif node.has_method("stop"):
        node.stop()
    node.queue_free()

func cancel_all() -> void:
    for key in _casts.keys():
        cancel_skill(key)

func is_active(canonical_id: StringName) -> bool:
    return _casts.has(canonical_id)

func active_casts() -> Array:
    var out: Array = []
    for key in _casts.keys():
        var node: Node = _casts[key]
        if node.has_method("diagnostics"):
            out.append(node.diagnostics())
        else:
            out.append({"canonical_id": String(key)})
    return out

func _process(_delta: float) -> void:
    # Forward 60 Hz source ticks for timeline verification by QA/CT.
    for key in _casts.keys():
        var node: Node = _casts[key]
        if node is Arcana20SkillInstance:
            var inst := node as Arcana20SkillInstance
            if inst.active and int(_last_tick_emitted.get(key, -1)) != inst.source_tick:
                _last_tick_emitted[key] = inst.source_tick
                source_tick.emit(key, inst.source_tick, inst.phase_name())

func _on_finished(canonical_id: StringName) -> void:
    if _casts.has(canonical_id):
        var node: Node = _casts[canonical_id]
        _casts.erase(canonical_id)
        _last_tick_emitted.erase(canonical_id)
        node.queue_free()
    cast_finished.emit(canonical_id)
