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
# Per-fixed-tick presentation state, not combat instructions. The external
# viewport/camera owner must combine concurrent casts and clear on finish.
signal screen_post(state: Dictionary)
signal source_pass_ready(frame: Arcana20SourcePassFrame)

const STEP := 1.0 / 60.0
const SRC_W := 384.0
const SRC_H := 216.0

var duration := 8.8
var _fx: RefCounted = null
var _kind := ""
var _frame: CFrame
var _tex: ImageTexture
var _sprite: Sprite2D
var _light_tex: ImageTexture
var _light_sprite: Sprite2D
# Opt-in only: source-buffer parity and existing captures stay on the legacy
# path until this separate world-composite experiment is visually validated.
var experimental_separate_passes := false
# World-field mode suppresses all legacy quads. A real-world owner must
# consume source_pass_ready, including all environmental fields and post.
var world_pass_mode := false
var _bytes := PackedByteArray()
var _origin := Vector2.ZERO
var _target := Vector2.ZERO
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
    _sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    _sprite.centered = true
    add_child(_sprite)
    _light_tex = ImageTexture.create_from_image(img)
    _light_sprite = Sprite2D.new()
    _light_sprite.texture = _light_tex
    _light_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    _light_sprite.centered = true
    _light_sprite.visible = false
    var additive := CanvasItemMaterial.new()
    additive.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
    _light_sprite.material = additive
    add_child(_light_sprite)

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
        "rift_fusion":
            _fx = CRealityRipperFusion.new()
            duration = CRealityRipperFusion.DURATION
            _fx.setup()
        "bloom_late":
            _fx = CAbyssalBloomLate.new()
            duration = CAbyssalBloomLate.DURATION
            _fx.setup()
        "crown", "crown_outer":
            _fx = CCinderCrown.new()
            duration = CCinderCrown.DURATION
            _fx.setup()
    _events = _fx.authored_events() if _fx != null and _kind != "crown_outer" else []
    var axis := target_world - caster_world
    # Each C spell has its own authored target anchor. Rotation and scale
    # must use the same caster->anchor vector, otherwise events and geometry
    # miss the real target by an angle-dependent amount.
    var source_axis := _anchor_local() - Vector2(112, 126)
    _rot = axis.angle() - source_axis.angle() if axis.length() > 1.0 else 0.0
    _scale = clampf(axis.length() / maxf(1.0, source_axis.length()), 0.6, 3.5) if axis.length() > 1.0 else 1.0
    _origin = caster_world
    _target = target_world
    _frame.track_world_fragments = world_pass_mode
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
        "rift_fusion":
            return CRealityRipperFusion.CENTER
        "bloom_late":
            return CAbyssalBloomLate.C
        "crown", "crown_outer":
            return CCinderCrown.C
    return Vector2(192, 108)

func local_to_world(p: Vector2) -> Vector2:
    var caster_local := Vector2(112, 126)
    var v := (p - caster_local) * _scale
    var cs := cos(_rot)
    var sn := sin(_rot)
    return _origin + Vector2(v.x * cs - v.y * sn, v.x * sn + v.y * cs)

func stop() -> void:
    var was := _active
    _active = false
    if _sprite != null:
        _sprite.visible = false
    if _light_sprite != null:
        _light_sprite.visible = false
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
        _steps += 1
        if _fx != null:
            _fx.update(STEP, source_time())
            if _kind == "crown_outer":
                _fx.set("fx_shake", 0.0)
                _fx.set("fx_flash_k", 0.0)
                _fx.set("fx_kick", 0.0)
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
        if experimental_separate_passes or world_pass_mode:
            screen_post.emit({"source_time": source_time(),
                "flash": _flash_c * _flash_k * 0.28,
                "shake": _shake_vector(), "chroma": _chroma_k})
        _fire_due_events()
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

func _shake_vector() -> Vector2:
    if _shake_k <= 0.0:
        return Vector2.ZERO
    return Vector2((CMath.hash1(_steps * 3) - 0.5) * 2.0 * _shake_k,
        (CMath.hash1(_steps * 3 + 1) - 0.5) * 2.0 * _shake_k)

func _render_frame() -> void:
    if _fx == null or not render_enabled:
        return
    _frame.clear()
    _frame.t = source_time()
    _frame.invert = 0.0
    _frame.desat = 0.0
    _frame.chroma = _chroma_k
    _frame.flash = _flash_c * _flash_k * 0.28
    _frame.shake = _shake_vector()
    if _kind == "crown_outer":
        _fx.call("render_outer_flame", _frame, source_time())
    else:
        _fx.render(_frame, source_time())
    if world_pass_mode:
        _sprite.visible = false
        _light_sprite.visible = false
        source_pass_ready.emit(source_pass_frame())
        return
    if experimental_separate_passes:
        var passes := _frame.native_passes()
        _bytes = passes.ink
        _tex.update(Image.create_from_data(384, 216, false, Image.FORMAT_RGBA8, _bytes))
        _light_tex.update(Image.create_from_data(384, 216, false, Image.FORMAT_RGBA8, passes.light))
        _light_sprite.visible = true
    else:
        _bytes = _frame.composite()
        _tex.update(Image.create_from_data(384, 216, false, Image.FORMAT_RGBA8, _bytes))
        _light_sprite.visible = false
    if _sprite != null:
        _sprite.visible = true
        var center_local := Vector2(SRC_W / 2.0, SRC_H / 2.0)
        _sprite.position = local_to_world(center_local)
        _sprite.rotation = _rot
        _sprite.scale = Vector2.ONE * _scale
        _light_sprite.position = _sprite.position
        _light_sprite.rotation = _sprite.rotation
        _light_sprite.scale = _sprite.scale

func source_pass_frame() -> Arcana20SourcePassFrame:
    var result := Arcana20SourcePassFrame.new()
    result.family = &"C"
    result.variant = StringName(_kind)
    result.tick = _tick
    result.source_time = source_time()
    var seed_by_kind := {"bloom_late": 32676, "crown": 1000, "crown_outer": 1000, "rift_fusion": 151461, "basilica": 48514, "thunderloom": 72271, "thorn": 111866, "horizon": 127704}
    result.seeds = PackedInt32Array([int(seed_by_kind.get(_kind, 0))])
    if _kind == "thunderloom":
        result.seeds.append(999)
    elif _kind == "rift_fusion":
        result.seeds.append(0x7ea4) # selected A20 live-ground debris seed
    result.source_size = Vector2i(CFrame.W, CFrame.H)
    var bx := Vector2(cos(_rot), sin(_rot)) * _scale
    var by := Vector2(-sin(_rot), cos(_rot)) * _scale
    result.source_to_world = Transform2D(bx, by, _origin - bx * 112.0 - by * 126.0)
    result.caster_world = _origin
    result.target_world = _target
    result.c_ground = _frame.ground
    result.c_ground_coverage = _frame.ground_coverage
    result.c_ink = _frame.ink
    result.c_light = _frame.light
    result.c_disp = _frame.disp
    result.c_world_fragment = _frame.world_fragment
    result.c_influence = _frame.world_influence
    if _kind == "rift_fusion" and not _frame.live_light_buckets.is_empty():
        var live_light := _frame.live_light_fields()
        result.c_live_light_index = live_light.index
        result.c_live_light_operations = live_light.operations
        result.c_live_light_height = int(live_light.height)
        result.c_live_light_count = int(live_light.count)
    result.flash = _frame.flash
    result.shake = _frame.shake
    result.chroma = _frame.chroma
    result.invert = _frame.invert
    result.desat = _frame.desat
    return result

func frame_bytes() -> PackedByteArray:
    return _bytes

func diagnostics() -> Dictionary:
    return {"tick": _tick, "steps": _steps, "kind": _kind}
