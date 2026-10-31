## Hosts a source-B effect port (native 384x216 HDR buffer) as a
## world-space quad in SOH. The buffer contains ONLY the spell (no Gold
## floor, no Gold actors — see BRenderer header). Source anchors are the
## authored caster (104,132) / target (262,104); the quad is placed so
## the source target lands exactly on the real world target.
extends Node2D
class_name BSourcePlayer

signal visual_contact(world_position: Vector2)
signal finished()

const SRC_CASTER := Vector2(104, 132)
const SRC_TARGET := Vector2(262, 104)

var duration := 7.6
var contact_t := 4.98
var elapsed := 0.0
var active := false

var _r: BRenderer
var _fx: BPyreWyrm
var _sprite: Sprite2D
var _tex: ImageTexture
var _world_target := Vector2.ZERO
var _contact_done := false
var _max_frame_ms := 0.0
var _frames := 0

func _ready() -> void:
    _sprite = Sprite2D.new()
    _sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    add_child(_sprite)
    set_process(false)

func begin(caster_world: Vector2, target_world: Vector2) -> void:
    _r = BRenderer.new()
    _fx = BPyreWyrm.new()
    duration = BPyreWyrm.DURATION
    contact_t = BPyreWyrm.TI
    _r.caster = SRC_CASTER
    _r.target = SRC_TARGET
    _fx.setup(_r)
    _world_target = target_world
    var dist := caster_world.distance_to(target_world)
    var s := clampf(dist / SRC_CASTER.distance_to(SRC_TARGET), 0.75, 3.0)
    if caster_world.x <= target_world.x:
        _sprite.scale = Vector2(s, s)
    else:
        _sprite.scale = Vector2(-s, s)
    _sprite.position = target_world - (SRC_TARGET - Vector2(BRenderer.W / 2.0, BRenderer.H / 2.0)) * _sprite.scale
    var img := Image.create(BRenderer.W, BRenderer.H, false, Image.FORMAT_RGBA8)
    _tex = ImageTexture.create_from_image(img)
    _sprite.texture = _tex
    elapsed = 0.0
    _contact_done = false
    _frames = 0
    active = true
    set_process(true)
    _render_frame()

func stop() -> void:
    if not active:
        return
    active = false
    set_process(false)
    if _sprite:
        _sprite.texture = null
    finished.emit()

func _process(delta: float) -> void:
    if not active:
        return
    elapsed += maxf(delta, 0.0)
    if not _contact_done and elapsed >= contact_t:
        _contact_done = true
        visual_contact.emit(_world_target)
    if elapsed >= duration:
        stop()
        return
    _render_frame()

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
    return {"transport": "source_b_native_384x216_procedural", "elapsed": elapsed,
        "active": active, "frames": _frames, "max_frame_ms": _max_frame_ms,
        "source": "B/src/effects/pyre.ts furnaceWyrm seed 202"}
