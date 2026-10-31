## Host for the D Constellation Engine port (480x270 DFx buffer).
## Deterministic 1/60 fixed-step; similarity world transform like B/C.
extends Node2D
class_name DSourcePlayer

signal visual_event(kind: StringName, world_pos: Vector2, source_time: float)
signal visual_contact(kind: StringName, world_pos: Vector2, source_time: float)
signal finished()
signal source_pass_ready(frame: Arcana20SourcePassFrame)

const STEP := 1.0 / 60.0

var duration := DConstellationEngine.DURATION
var _eng: DConstellationEngine
var _sprite: Sprite2D
var _tex: ImageTexture
var _tick := 0
var _acc := 0.0
var _active := false
var render_enabled := true
var world_pass_mode := false
var _events: Array = []
var _origin := Vector2.ZERO
var _target := Vector2.ZERO
var _rot := 0.0
var _scale := 1.0

func _ready() -> void:
    _ensure()

func _ensure() -> void:
    if _sprite != null:
        return
    _sprite = Sprite2D.new()
    _sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    add_child(_sprite)
    var img := Image.create(DFx.W, DFx.H, false, Image.FORMAT_RGBA8)
    _tex = ImageTexture.create_from_image(img)
    _sprite.texture = _tex

func begin(caster_world: Vector2, target_world: Vector2) -> void:
    _ensure()
    _eng = DConstellationEngine.new()
    _eng.setup()
    _eng.fx.track_world_fields = world_pass_mode
    _events = _eng.authored_events()
    var axis := target_world - caster_world
    var src_axis := DConstellationEngine.CENTER - Vector2(148, 172)
    _rot = axis.angle() - src_axis.angle() if axis.length() > 1.0 else 0.0
    _scale = clampf(axis.length() / maxf(1.0, src_axis.length()), 0.6, 3.5) if axis.length() > 1.0 else 1.0
    _origin = caster_world
    _target = target_world
    _tick = 0
    _acc = 0.0
    _active = true
    _render_frame()

func local_to_world(p: Vector2) -> Vector2:
    var v := (p - Vector2(148, 172)) * _scale
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

func advance(dt: float) -> void:
    if not _active:
        return
    _acc += dt
    var guard := 0
    while _acc >= STEP and guard < 8:
        _acc -= STEP
        guard += 1
        _tick += 1
        _eng.update(source_time(), STEP)
        _fire_events()
        if source_time() >= duration:
            _active = false
            finished.emit()
            break
    if guard > 0 and _active:
        _render_frame()

func _process(delta: float) -> void:
    advance(delta)

func _fire_events() -> void:
    var t := source_time()
    for ev in _events:
        if not bool(ev.emitted) and t >= float(ev.t):
            ev.emitted = true
            var kind := StringName(String(ev.kind))
            var wp := local_to_world(ev.pos_local)
            visual_event.emit(kind, wp, t)
            if String(ev.kind).ends_with("impact"):
                visual_contact.emit(kind, wp, t)

func _render_frame() -> void:
    if _eng == null or not render_enabled:
        return
    if world_pass_mode:
        _sprite.visible = false
        source_pass_ready.emit(source_pass_frame())
        return
    var bytes := _eng.frame_bytes()
    var img := Image.create_from_data(DFx.W, DFx.H, false, Image.FORMAT_RGBA8, bytes)
    _tex.update(img)
    _sprite.visible = true
    _sprite.position = local_to_world(Vector2(DFx.W / 2.0, DFx.H / 2.0))
    _sprite.rotation = _rot
    _sprite.scale = Vector2.ONE * _scale

func source_pass_frame() -> Arcana20SourcePassFrame:
    var result := Arcana20SourcePassFrame.new()
    result.family = &"D"
    result.variant = &"constellation"
    result.tick = _tick
    result.source_time = source_time()
    result.seeds = PackedInt32Array([97, 600 + floori(source_time() * 30.0)])
    result.source_size = Vector2i(DFx.W, DFx.H)
    var bx := Vector2(cos(_rot), sin(_rot)) * _scale
    var by := Vector2(-sin(_rot), cos(_rot)) * _scale
    result.source_to_world = Transform2D(bx, by, _origin - bx * 148.0 - by * 172.0)
    result.caster_world = _origin
    result.target_world = _target
    result.d_rgb = _eng.fx.buf
    result.d_influence = _eng.fx.world_influence
    result.d_bends = _eng.fx.world_bends.duplicate(true)
    result.d_bloom_gain = _eng.fx.bloom_gain
    result.flash = _eng.fx.flash_col * _eng.fx.flash_amt
    result.d_shake_amplitude = _eng.fx.shake
    return result

func diagnostics() -> Dictionary:
    return {"transport": "source_d_native_480x270_procedural", "tick": _tick, "active": _active}
