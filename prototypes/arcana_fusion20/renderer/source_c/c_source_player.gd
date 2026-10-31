## Generic host for TRUE ports of original C spells (engine/frame.ts +
## gl.ts COMP on CPU). Deterministic 1/60 fixed-step: update(dt, t)
## then render(frame, t) each step, exactly like engine/stage.ts
## (minus floor/actors/ambient motes, which are world, not spell).
## Stage post impulses (shake/flash/chroma) decay exactly as stage.ts.
## World placement: similarity transform (rotation + uniform scale) of
## the authored 384x216 buffer, same contract as the B player.
extends Node2D
class_name CSourcePlayer

signal visual_event(kind: StringName, world_pos: Vector2, source_time: float)
signal visual_contact(kind: StringName, world_pos: Vector2, source_time: float)
signal finished()

const STEP := 1.0 / 60.0
const SRC_W := 384.0
const SRC_H := 216.0

var duration := 8.8
var _fx: RefCounted = null
var _kind := ""
var _frame: CFrame
var _tex: ImageTexture
var _sprite: Sprite2D
var _bytes := PackedByteArray()
var _origin := Vector2.ZERO
var _rot := 0.0
var _scale := 1.0
var _tick := 0
var _acc := 0.0
var _events: Array = []
var _active := false
var render_enabled := true
var _steps := 0
var _shake_k := 0.0
var _flash_k := 0.0
var _flash_c := Vector3.ZERO
var _chroma_k := 0.0

func _ready() -> void:
    _ensure_sprite()

func _ensure_sprite() -> void:
    if _sprite != null:
        return
    _frame = CFrame.new()
    var img := Image.create(384, 216, false, Image.FORMAT_RGBA8)
    _tex = ImageTexture.create_from_image(img)
    _sprite = Sprite2D.new()
    _sprite.texture = _tex
    _sprite.centered = true
    add_child(_sprite)

func begin(caster_world: Vector2, target_world: Vector2, kind: String) -> void:
    _ensure_sprite()
    _kind = kind
    match kind:
        "horizon":
            _fx = CEventHorizon.new()
            duration = CEventHorizon.DURATION
            _fx.setup()
        "basilica":
            _fx = CMirrorfrostBasilica.new()
            duration = CMirrorfrostBasilica.DURATION
            _fx.setup()
        "thunderloom":
            _fx = CThunderloom.new()
            duration = CThunderloom.DURATION
            _fx.setup()
        "thorn":
            _fx = CThornOpera.new()
            duration = CThornOpera.DURATION
            _fx.setup()
    _events = _fx.authored_events() if _fx != null else []
    var axis := target_world - caster_world
    _rot = axis.angle() - Vector2(250 - 112, 106 - 126).angle() if axis.length() > 1.0 else 0.0
    # authored anchors: CASTER (112,126) -> E per spell; keep simple
    # similarity: authored caster->E axis preserved below via _anchor_local.
    _scale = clampf(axis.length() / maxf(1.0, _anchor_local().distance_to(Vector2(112, 126))), 0.6, 3.5) if axis.length() > 1.0 else 1.0
    _origin = caster_world
    _tick = 0
    _acc = 0.0
    _steps = 0
    _shake_k = 0.0
    _flash_k = 0.0
    _chroma_k = 0.0
    _active = true
    _render_frame()

func _anchor_local() -> Vector2:
    match _kind:
        "horizon":
            return CEventHorizon.E
        "basilica":
            return CMirrorfrostBasilica.Q
        "thunderloom":
            return CThunderloom.TG
        "thorn":
            return CThornOpera.FZ
    return Vector2(192, 108)

func local_to_world(p: Vector2) -> Vector2:
    var anchor := _anchor_local()
    var caster_local := Vector2(112, 126)
    var v := (p - caster_local) * _scale
    var cs := cos(_rot)
    var sn := sin(_rot)
    return _origin + Vector2(v.x * cs - v.y * sn, v.x * sn + v.y * cs) + (anchor - caster_local) * 0.0

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
        _steps += 1
        if _fx != null:
            _fx.update(STEP, source_time())
            var sh = _fx.get("fx_shake")
            if sh != null and float(sh) > 0.0:
                _shake_k = maxf(_shake_k, float(sh))
                _fx.set("fx_shake", 0.0)
            var fk = _fx.get("fx_flash_k")
            if fk != null and float(fk) > 0.0:
                _flash_c = _fx.get("fx_flash")
                _flash_k = maxf(_flash_k, float(fk))
                _fx.set("fx_flash_k", 0.0)
            var kk = _fx.get("fx_kick")
            if kk != null and float(kk) > 0.0:
                _chroma_k = maxf(_chroma_k, float(kk))
                _fx.set("fx_kick", 0.0)
        _shake_k *= 0.86
        if _shake_k < 0.3:
            _shake_k = 0.0
        _flash_k *= 0.82
        _chroma_k *= 0.88
        _render_frame()
        _fire_due_events()
        if source_time() >= duration:
            _active = false
            finished.emit()
            break

func _process(delta: float) -> void:
    advance(delta)

func _fire_due_events() -> void:
    var t := source_time()
    for ev in _events:
        if not bool(ev.emitted) and t >= float(ev.t):
            ev.emitted = true
            var wp := local_to_world(ev.pos_local)
            var kind := StringName(String(ev.kind))
            visual_event.emit(kind, wp, t)
            if String(ev.kind).ends_with("impact"):
                visual_contact.emit(kind, wp, t)

func _render_frame() -> void:
    if _fx == null or not render_enabled:
        return
    _frame.clear()
    _frame.t = source_time()
    _frame.invert = 0.0
    _frame.desat = 0.0
    _frame.chroma = _chroma_k
    _frame.flash = _flash_c * _flash_k * 0.28
    if _shake_k > 0.0:
        _frame.shake = Vector2((CMath.hash1(_steps * 3) - 0.5) * 2.0 * _shake_k, (CMath.hash1(_steps * 3 + 1) - 0.5) * 2.0 * _shake_k)
    else:
        _frame.shake = Vector2.ZERO
    _fx.render(_frame, source_time())
    _bytes = _frame.composite()
    var img := Image.create_from_data(384, 216, false, Image.FORMAT_RGBA8, _bytes)
    _tex.update(img)
    if _sprite != null:
        _sprite.visible = true
        var anchor := _anchor_local()
        var center_local := Vector2(SRC_W / 2.0, SRC_H / 2.0)
        _sprite.position = local_to_world(center_local)
        _sprite.rotation = _rot
        _sprite.scale = Vector2.ONE * _scale

func frame_bytes() -> PackedByteArray:
    return _bytes

func diagnostics() -> Dictionary:
    return {"tick": _tick, "steps": _steps, "kind": _kind}
