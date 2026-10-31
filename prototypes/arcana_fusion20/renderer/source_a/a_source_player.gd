## Host for ported A spells (416x234 AFramebuffer). Deterministic 1/60
## fixed-step; similarity world transform like B/C/D players.
extends Node2D
class_name ASourcePlayer

signal visual_event(kind: StringName, world_pos: Vector2, source_time: float)
signal visual_contact(kind: StringName, world_pos: Vector2, source_time: float)
signal finished()
signal source_pass_ready(frame: Arcana20SourcePassFrame)
# An original contact whose selected real actor is missing/dead is still
# reported; it cannot be turned into a fake position or a damage request.
signal unbound_source_contact(kind: StringName, node_index: int, source_time: float)

const STEP := 1.0 / 60.0
const CASTER_LOCAL := Vector2(104, 150)
const ARENA_LOCAL := Vector2(232, 124)

var duration := 6.6
var render_enabled := true
var world_pass_mode := false
var source_variant: StringName = &"candidate"
var _spell: Variant
var _fb: AFramebuffer
var _sprite: Sprite2D
var _tex: ImageTexture
var _tick := 0
var _acc := 0.0
var _active := false
var _events: Array = []
var _origin := Vector2.ZERO
var _target := Vector2.ZERO
var _rot := 0.0
var _scale := 1.0

func configure(spell: Variant, dur: float) -> void:
    _spell = spell
    duration = dur

func _ready() -> void:
    _ensure()

func _ensure() -> void:
    if _sprite != null:
        return
    _sprite = Sprite2D.new()
    _sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    add_child(_sprite)
    var img := Image.create(AFramebuffer.W, AFramebuffer.H, false, Image.FORMAT_RGBA8)
    _tex = ImageTexture.create_from_image(img)
    _sprite.texture = _tex

func begin(caster_world: Vector2, target_world: Vector2) -> void:
    _ensure()
    _fb = AFramebuffer.new()
    _fb.track_world_fields = world_pass_mode
    _spell.call("setup")
    _events = _spell.call("authored_events")
    var axis := target_world - caster_world
    var src_axis := ARENA_LOCAL - CASTER_LOCAL
    _rot = axis.angle() - src_axis.angle() if axis.length() > 1.0 else 0.0
    _scale = clampf(axis.length() / maxf(1.0, src_axis.length()), 0.6, 3.5) if axis.length() > 1.0 else 1.0
    _origin = caster_world
    _target = target_world
    if _spell.has_method("bind_targets"):
        _spell.call("bind_targets", self, target_world)
    _tick = 0
    _acc = 0.0
    _active = true
    _render_frame()

func local_to_world(p: Vector2) -> Vector2:
    var v := (p - CASTER_LOCAL) * _scale
    var cs := cos(_rot)
    var sn := sin(_rot)
    return _origin + Vector2(v.x * cs - v.y * sn, v.x * sn + v.y * cs)

func stop() -> void:
    var was := _active
    _active = false
    if _sprite != null:
        _sprite.visible = false
    if was:
        finished.emit()

func source_time() -> float:
    return float(_tick) * STEP

func advance(dt: float, draw: bool = true) -> void:
    if not _active:
        return
    _acc += dt
    var guard := 0
    while _acc >= STEP and guard < 8:
        _acc -= STEP
        guard += 1
        _tick += 1
        _spell.call("update", STEP, source_time())
        _fire_events()
        if source_time() >= duration:
            _active = false
            finished.emit()
            break

    # Fixed-step simulation and event emission remain per tick. Rasterize
    # only the final state once per displayed frame, not once per catch-up tick.
    if guard > 0 and draw and _active:
        _render_frame()

func _process(delta: float) -> void:
    advance(delta)

func _fire_events() -> void:
    var t := source_time()
    for ev in _events:
        if not bool(ev.emitted) and t >= float(ev.t):
            ev.emitted = true
            var kind := StringName(String(ev.kind))
            var event_pos: Variant = _spell.call("event_local", ev) if _spell.has_method("event_local") else ev.pos_local
            if event_pos == null:
                if String(ev.kind).ends_with("impact") or String(ev.kind).ends_with("contact"):
                    unbound_source_contact.emit(kind, int(ev.get("node_index", -1)), t)
                continue
            var wp := local_to_world(event_pos)
            visual_event.emit(kind, wp, t)
            if String(ev.kind).ends_with("impact") or String(ev.kind).ends_with("contact"):
                visual_contact.emit(kind, wp, t)

func _render_frame() -> void:
    if _spell == null or not render_enabled:
        return
    _fb.clear()
    _spell.call("render", _fb, source_time())
    if world_pass_mode:
        _fb.compute_bloom()
        _sprite.visible = false
        source_pass_ready.emit(source_pass_frame())
        return
    var img := Image.create_from_data(AFramebuffer.W, AFramebuffer.H, false, Image.FORMAT_RGBA8, _fb.present())
    _tex.update(img)
    _sprite.visible = true
    _sprite.position = local_to_world(Vector2(AFramebuffer.W / 2.0, AFramebuffer.H / 2.0))
    _sprite.rotation = _rot
    _sprite.scale = Vector2.ONE * _scale

func source_pass_frame() -> Arcana20SourcePassFrame:
    var result := Arcana20SourcePassFrame.new()
    result.family = &"A"
    result.variant = source_variant
    result.tick = _tick
    result.source_time = source_time()
    result.source_size = Vector2i(AFramebuffer.W, AFramebuffer.H)
    var bx := Vector2(cos(_rot), sin(_rot)) * _scale
    var by := Vector2(-sin(_rot), cos(_rot)) * _scale
    result.source_to_world = Transform2D(bx, by, _origin - bx * CASTER_LOCAL.x - by * CASTER_LOCAL.y)
    result.caster_world = _origin
    result.target_world = _target
    result.a_rgb = _fb.buf
    result.a_coverage = _fb.world_coverage
    result.a_multiplier = _fb.world_multiplier
    result.a_world_warp = _fb.world_warp
    result.a_influence = _fb.world_influence
    result.a_exposure = _fb.exposure
    result.a_bloom = _fb.bloom_amt
    result.a_bloom_rgb = _fb.bloom_a
    result.a_bloom_size = Vector2i(_fb.bw, _fb.bh)
    result.a_impact_frames = _fb.impact_frames
    result.a_impact_tint = _fb.impact_tint
    result.flash = _fb.flash
    result.chroma = _fb.chroma
    return result

func diagnostics() -> Dictionary:
    return {"transport": "source_a_native_416x234_procedural", "tick": _tick, "active": _active}
