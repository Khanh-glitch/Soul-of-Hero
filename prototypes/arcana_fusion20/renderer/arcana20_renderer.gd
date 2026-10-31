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
signal visual_event(canonical_id: StringName, kind: StringName, world_position: Vector2, source_time: float)
signal body_event_cue(canonical_id: StringName, world_position: Vector2, element: StringName)
signal cast_finished(canonical_id: StringName)

var _casts: Dictionary = {} # canonical_id -> Node (instance or B02 geometry)
var stage_counts: Dictionary = {}
var _last_tick_emitted: Dictionary = {}


const _A_SPELLS := {
    5: "abyssal", 9: "chain", 11: "carousel", 16: "worldseed", 20: "ripper",
    4: "guillotine", 6: "riptide", 12: "skybreaker", 13: "rootwake", 14: "spore", 18: "chronoshard",
}

func _make_a_spell(id: int) -> Variant:
    match id:
        5: return AFusionSpells.AbyssalBloom.new()
        9: return AFusionSpells.ChainVerdict.new()
        11: return AFusionSpells2.VoltCarousel.new()
        16: return AFusionSpells2.Worldseed.new()
        20: return AFusionSpells2.RealityRipper.new()
        4: return ARedesignSpells.AshenGuillotineR.new()
        6: return ARedesignSpells.RiptideCalligraphyR.new()
        12: return ARedesignSpells.SkybreakerScriptR.new()
        13: return ARedesignSpells2.RootwakeR.new()
        14: return ARedesignSpells2.SporeNebulaR.new()
        18: return ARedesignSpells2.ChronoshardR.new()
    return null

func _a_spell_dur(id: int) -> float:
    match id:
        5: return AFusionSpells.AbyssalBloom.DUR
        9: return AFusionSpells.ChainVerdict.DUR
        11: return AFusionSpells2.VoltCarousel.DUR
        16: return AFusionSpells2.Worldseed.DUR
        20: return AFusionSpells2.RealityRipper.DUR
        4: return ARedesignSpells.AshenGuillotineR.DUR
        6: return ARedesignSpells.RiptideCalligraphyR.DUR
        12: return ARedesignSpells.SkybreakerScriptR.DUR
        13: return ARedesignSpells2.RootwakeR.DUR
        14: return ARedesignSpells2.SporeNebulaR.DUR
        18: return ARedesignSpells2.ChronoshardR.DUR
    return 6.0

func _a_cast(canonical_id: StringName, id: int, caster_world: Vector2, target_world: Vector2) -> bool:
    if not _A_SPELLS.has(id):
        return false
    var ap := ASourcePlayer.new()
    ap.configure(_make_a_spell(id), _a_spell_dur(id))
    add_child(ap)
    ap.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
        visual_contact.emit(canonical_id, pos, kind)
        body_event_cue.emit(canonical_id, pos, &"astral"))
    ap.visual_event.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
        visual_event.emit(canonical_id, kind, pos, st))
    ap.finished.connect(func() -> void: _on_finished(canonical_id))
    _casts[canonical_id] = ap
    cast_started.emit(canonical_id)
    ap.begin(caster_world, target_world)
    return true

func cast_skill(canonical_id: StringName, caster_world: Vector2, target_world: Vector2, facing: float = 1.0) -> bool:
    var id := Arcana20SOHRegistry_index(canonical_id)
    if id < 1:
        return false
    cancel_skill(canonical_id)
    if _a_cast(canonical_id, id, caster_world, target_world):
        return true
    if id == 1:
        # FUSION #01 Cinder Crown (vote A+C, FUSION_DECISIONS §01):
        # A crown formation/collapse/impact is the lead; C provides the
        # complementary outer flame geometry. C local clock is offset
        # +0.69s so C's burst (T_BU 4.64) lands on A's burst tick (3.95)
        # — one impact beat, one radial contact. C owns the back layer
        # (outer geometry/scar), A owns the front (crown body/petals).
        var fp := FusionPlayer.new()
        var ap := ASourcePlayer.new()
        ap.configure(ACinderCrown.new(), ACinderCrown.DURATION)
        var cp := CSourcePlayer.new()
        fp.configure([
            {"node": cp, "layer": -1, "offset": 0.69, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw, "crown")},
            {"node": ap, "layer": 1, "offset": 0.0, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw)},
        ], ACinderCrown.DURATION)
        add_child(fp)
        fp.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_contact.emit(canonical_id, pos, kind)
            body_event_cue.emit(canonical_id, pos, &"pyre"))
        fp.visual_event.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_event.emit(canonical_id, kind, pos, st))
        fp.finished.connect(func() -> void: _on_finished(canonical_id))
        _casts[canonical_id] = fp
        cast_started.emit(canonical_id)
        fp.begin(caster_world, target_world)
        return true
    if id == 19:
        # TRUE source translation: D Constellation Engine (standalone
        # HTML WebGL -> CPU DFx; see source_d headers for differences).
        var dp := DSourcePlayer.new()
        add_child(dp)
        dp.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_contact.emit(canonical_id, pos, kind)
            body_event_cue.emit(canonical_id, pos, &"astral"))
        dp.visual_event.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_event.emit(canonical_id, kind, pos, st))
        dp.finished.connect(func() -> void: _on_finished(canonical_id))
        _casts[canonical_id] = dp
        cast_started.emit(canonical_id)
        dp.begin(caster_world, target_world)
        return true
    if id == 17 or id == 7 or id == 10 or id == 15:
        # TRUE source port on the ported C frame/compositor (astral.ts).
        var cp := CSourcePlayer.new()
        add_child(cp)
        cp.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_contact.emit(canonical_id, pos, kind)
            body_event_cue.emit(canonical_id, pos, &"astral" if id == 17 else (&"ice" if id == 7 else (&"volt" if id == 10 else &"leaf"))))
        cp.visual_event.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_event.emit(canonical_id, kind, pos, st))
        cp.finished.connect(func() -> void: _on_finished(canonical_id))
        _casts[canonical_id] = cp
        cast_started.emit(canonical_id)
        cp.begin(caster_world, target_world, "horizon" if id == 17 else ("basilica" if id == 7 else ("thunderloom" if id == 10 else "thorn")))
        return true
    if id == 2 or id == 3 or id == 8:
        # TRUE source ports on the ported B HDR renderer (pyre.ts).
        var bp := BSourcePlayer.new()
        add_child(bp)
        bp.visual_contact.connect(func(pos: Vector2) -> void:
            visual_contact.emit(canonical_id, pos, &"source_impact")
            body_event_cue.emit(canonical_id, pos, &"fire" if id != 8 else &"water"))
        bp.visual_event.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            visual_event.emit(canonical_id, kind, pos, st))
        bp.finished.connect(func() -> void: _on_finished(canonical_id))
        _casts[canonical_id] = bp
        cast_started.emit(canonical_id)
        bp.begin(caster_world, target_world, "wyrm" if id == 2 else ("meteor" if id == 3 else "maw"))
        return true
    stage_counts["new"] = int(stage_counts.get("new", 0)) + 1
    var inst := Arcana20SkillInstance.new()
    stage_counts["created"] = int(stage_counts.get("created", 0)) + 1
    add_child(inst)
    inst.setup(id, caster_world, target_world, facing)
    stage_counts["setup"] = int(stage_counts.get("setup", 0)) + 1
    inst.visual_contact.connect(func(sid: int, pos: Vector2, kind: StringName) -> void:
        visual_contact.emit(canonical_id, pos, kind))
    inst.body_event_cue.connect(func(sid: int, pos: Vector2, el: StringName) -> void:
        body_event_cue.emit(canonical_id, pos, el))
    inst.cast_finished.connect(func(sid: int) -> void: _on_finished(canonical_id))
    _casts[canonical_id] = inst
    cast_started.emit(canonical_id)
    inst.begin()
    stage_counts["begin"] = int(stage_counts.get("begin", 0)) + 1
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
        elif node is BSourcePlayer:
            var bp := node as BSourcePlayer
            if bp.active and int(_last_tick_emitted.get(key, -1)) != bp.source_tick:
                _last_tick_emitted[key] = bp.source_tick
                source_tick.emit(key, bp.source_tick, bp.phase_name())
        elif node is ASourcePlayer:
            var ap2 := node as ASourcePlayer
            if int(_last_tick_emitted.get(key, -1)) != ap2._tick:
                _last_tick_emitted[key] = ap2._tick
                source_tick.emit(key, ap2._tick, &"SOURCE_A")
        elif node is FusionPlayer:
            var fp2 := node as FusionPlayer
            if int(_last_tick_emitted.get(key, -1)) != fp2._tick:
                _last_tick_emitted[key] = fp2._tick
                source_tick.emit(key, fp2._tick, &"SOURCE_A")
        elif node is DSourcePlayer:
            var dp2 := node as DSourcePlayer
            if int(_last_tick_emitted.get(key, -1)) != dp2._tick:
                _last_tick_emitted[key] = dp2._tick
                source_tick.emit(key, dp2._tick, &"SOURCE_D")
        elif node is CSourcePlayer:
            var cp2 := node as CSourcePlayer
            if int(_last_tick_emitted.get(key, -1)) != cp2._tick:
                _last_tick_emitted[key] = cp2._tick
                source_tick.emit(key, cp2._tick, &"SOURCE_C")

func _on_finished(canonical_id: StringName) -> void:
    if _casts.has(canonical_id):
        var node: Node = _casts[canonical_id]
        _casts.erase(canonical_id)
        _last_tick_emitted.erase(canonical_id)
        node.queue_free()
    cast_finished.emit(canonical_id)
