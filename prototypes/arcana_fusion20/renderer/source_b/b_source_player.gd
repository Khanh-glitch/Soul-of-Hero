## Hosts a source-B effect port (native 384x216 HDR buffer) as a
## world-space quad in SOH. The buffer contains ONLY the spell (no Gold
## floor, no Gold actors — see BRenderer header).
##
## Deterministic timeline: the source clock advances in fixed 1/60 steps
## from accumulated real delta, so event timing is frame-rate independent
## (rendering still happens once per real frame). Transform: uniform
## scale + rotation aligning the authored caster->target axis onto the
## real world axis (no stretching, no flip hack), so authored geometry
## is preserved for arbitrary caster/target orientation and distance.
extends Node2D
class_name BSourcePlayer

signal visual_contact(world_position: Vector2)
signal visual_event(kind: StringName, world_position: Vector2, source_time: float)
signal finished()

const SRC_CASTER := Vector2(104, 132)
const SRC_TARGET := Vector2(262, 104)
const STEP := 1.0 / 60.0

var duration := 7.6
var elapsed := 0.0
var source_tick := 0
var active := false

var _r: BRenderer
var _fx: RefCounted # BPyreWyrm / BMeteorLoom / BUndertowMaw (duck-typed)
var _kind: String = "wyrm"
var _sprite: Sprite2D
var _tex: ImageTexture
var _acc := 0.0
var _events: Array = [] # {t, kind, pos_local, emitted}
var _world_target := Vector2.ZERO
var _max_frame_ms := 0.0
var _frames := 0

func _ready() -> void:
    if _sprite != null:
        return
    _sprite = Sprite2D.new()
    _sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    add_child(_sprite)
    set_process(false)

func begin(caster_world: Vector2, target_world: Vector2, kind: String = "wyrm") -> void:
    if _sprite == null:
        _ready()
    _kind = kind
    _r = BRenderer.new()
    match kind:
        "meteor":
            _fx = BMeteorLoom.new()
            duration = BMeteorLoom.DURATION
        "maw":
            _fx = BUndertowMaw.new()
            duration = BUndertowMaw.DURATION
        _:
            _fx = BPyreWyrm.new()
            duration = BUndertowMaw.DURATION
    _r.caster = SRC_CASTER
    _r.target = SRC_TARGET
    _fx.setup(_r)
    _events = _fx.call("authored_events") if _fx.has_method("authored_events") else []
    _world_target = target_world
    # Similarity transform: rotate authored axis onto world axis.
    var src_axis := SRC_TARGET - SRC_CASTER
    var world_axis := target_world - caster_world
    var s := clampf(world_axis.length() / src_axis.length(), 0.6, 3.5)
    _sprite.scale = Vector2(s, s)
    _sprite.rotation = world_axis.angle() - src_axis.angle()
    _sprite.position = target_world - (SRC_TARGET - Vector2(BRenderer.W / 2.0, BRenderer.H / 2.0)).rotated(_sprite.rotation) * s
    var img := Image.create(BRenderer.W, BRenderer.H, false, Image.FORMAT_RGBA8)
    _tex = ImageTexture.create_from_image(img)
    _sprite.texture = _tex
    elapsed = 0.0
    source_tick = 0
    _acc = 0.0
    _frames = 0
    active = true
    set_process(true)
    _render_frame()

func local_to_world(p: Vector2) -> Vector2:
    # Source buffer coords -> sprite local (centred) -> world.
    var centred := (p - Vector2(BRenderer.W / 2.0, BRenderer.H / 2.0))
    return _sprite.position + centred.rotated(_sprite.rotation) * _sprite.scale.x

func stop() -> void:
    if not active:
        return
    active = false
    set_process(false)
    if _sprite:
        _sprite.texture = null
    finished.emit()

func advance(dt: float) -> void:
    # Deterministic fixed-step source clock (also used by headless tests).
    if not active:
        return
    _acc += maxf(dt, 0.0)
    while _acc >= STEP and active:
        _acc -= STEP
        elapsed += STEP
        source_tick = int(floor(elapsed * 60.0))
        _fire_due_events()
        if elapsed >= duration:
            stop()
            return

func _process(delta: float) -> void:
    if not active:
        return
    advance(delta)
    if active:
        _render_frame()

func _fire_due_events() -> void:
    for ev in _events:
        if not bool(ev.get("emitted", false)) and elapsed >= float(ev.t):
            ev["emitted"] = true
            var pos := local_to_world(ev.pos_local)
            visual_event.emit(StringName(ev.kind), pos, elapsed)
            if String(ev.kind).ends_with("impact") or String(ev.kind) == "bite":
                visual_contact.emit(pos)

func phase_name() -> StringName:
    if not active:
        return &"CLEAN_OUT"
    return &"SOURCE_B"

func _render_frame() -> void:
    var start := Time.get_ticks_usec()
    _r.begin()
    _fx.render(_r, elapsed)
    _fx.post(_r, elapsed)
    _r.lighting()
    var bytes := _r.finalize()
    var img := Image.create_from_data(BRenderer.W, BRenderer.H, false, Image.FORMAT_RGBA8, bytes)
    _tex.update(img)
    _frames += 1
    _max_frame_ms = maxf(_max_frame_ms, float(Time.get_ticks_usec() - start) / 1000.0)

func diagnostics() -> Dictionary:
    return {"transport": "source_b_native_384x216_procedural", "kind": _kind,
        "elapsed": elapsed, "source_tick": source_tick, "active": active,
        "frames": _frames, "max_frame_ms": _max_frame_ms,
        "events_total": _events.size(),
        "source": "B/src/effects (pyre/tide) original TS port"}
