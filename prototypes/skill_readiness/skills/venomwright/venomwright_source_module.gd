class_name VenomwrightSourceModule
extends Gold93SkillModule

## Host-facing adapter for the SOURCE-NATIVE Venomwright engine.
##
## Until this file existed the two execution domains were silently conflated:
##
##   * the differential harness drove `venom_world` / `venom_engine` directly
##     and diffed it tick-by-tick against the original TypeScript, producing
##     the `source_parity_verified` evidence;
##   * the Gold93 host runtime could only cast `venomwright:001`, whose module
##     is built on the older `prototypes/gold_pair` component set.
##
## So six skills were recorded as source-parity-verified while only one was
## reachable through `Gold93SkillRuntime.cast()`. This module closes that gap
## by driving the SAME source-native generators through the host contract:
##
##   CastContext (caster, aim, targets, seed)
##     -> VenomEngine.resolve / auto_aim (original aiming)
##     -> VenomEngine.cast (original cast identity + RNG seeding)
##     -> venom_world.step(1/60) (original 60 Hz simulation + draw)
##     -> frame_payload(): the ORIGINAL scene and glow rasters
##     -> Gold93Intents: one Damage/Status intent per authored hit/mark
##
## Nothing here re-authors a skill. Every number, every RNG draw and every
## draw hook belongs to the ported original generator.
##
## IMPORTANT SCOPE NOTE: a host cast is NOT an oracle run. The oracle replays a
## fixed authored world (seed, density 16, formation placement, tick-1 cast). A
## host cast uses whatever caster, aim and targets the real game supplies, so
## its rasters legitimately differ from the oracle's. `HOST_ADAPTER_CASTABLE`
## is therefore reported as an axis of its own and never folded into
## `SOURCE_PARITY_VERIFIED`.

const ENGINE = preload("res://prototypes/skill_readiness/native/venom/venom_engine.gd")
const WORLDG = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")
const SKILLS = preload("res://prototypes/skill_readiness/native/venom/venom_skills.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")

const F: float = 1.0 / 60.0
## Ground plate seed. The oracle asserts 17; the host adapter uses the same
## plate so a host frame and an oracle frame share one authored environment.
const GROUND_SEED: int = 17

var _world = null
var _gfx: Dictionary = {}
var _ground = null
var _cast_obj = null
var _hit_cursor: int = 0
var _cue_cursor: int = 0
var _started: bool = false
var _cast_fired: bool = false
var _frames: int = 0
var _damage_intents: int = 0
var _status_intents: int = 0
var _ink_peak: int = 0
var _last_ink: int = 0
var _host_targets: Array = []
var _aim_source: Vector2 = Vector2.ZERO
var _has_aim: bool = false


## ---------------------------------------------------------------------------
## world subclass: records the authored events the host must be told about
## ---------------------------------------------------------------------------

class HostWorld extends "res://prototypes/skill_readiness/native/venom/venom_world.gd":
	var hits: Array = []
	var cues: Array = []

	func hit(e, amt: float, o: Dictionary) -> bool:
		var killed: bool = super.hit(e, amt, o)
		hits.append({
			"t": time, "e": e.id, "amt": amt,
			"kind": String(o.get("kind", "impact")), "src": o.get("src", null),
			"at": o.get("at", null),
			"kx": float(o.get("kx", 0.0)), "ky": float(o.get("ky", 0.0)),
			"stag": float(o.get("stagger", 0.0)),
			"big": bool(o.get("big", false)), "killed": killed,
		})
		return killed

	func mark(e, key: String, dur: float, k: float = 1.0) -> void:
		cues.append({"t": time, "k": "mark", "e": e.id, "key": key, "dur": dur})
		super.mark(e, key, dur, k)

	func poison(e, total: float, dur: float, key: int, src: int,
			every: float = 0.5) -> void:
		cues.append({"t": time, "k": "poison", "e": e.id,
				"total": total, "dur": dur, "src": src})
		super.poison(e, total, dur, key, src, every)

	func shake(m: float, d: float = 0.25) -> void:
		cues.append({"t": time, "k": "shake", "m": m, "d": d})
		super.shake(m, d)

	func shock(x: float, y: float, max_: float, dur: float, amp: float = 3) -> void:
		cues.append({"t": time, "k": "shock", "x": x, "y": y,
				"max": max_, "dur": dur, "amp": amp})
		super.shock(x, y, max_, dur, amp)

	func screen_flash(c: int, a: float, dur: float = 0.2) -> void:
		cues.append({"t": time, "k": "flash", "c": c, "a": a, "dur": dur})
		super.screen_flash(c, a, dur)


## ---------------------------------------------------------------------------
## metadata
## ---------------------------------------------------------------------------

func original_name() -> String:
	var d: Dictionary = SKILLS.defs().get(original_skill_id, {})
	return String(d.get("name", ""))


func source_variant() -> String:
	return "source-native"


func registry_source_path() -> String:
	## The generator lives in the ported `src/game/skills/sN.ts` translation.
	return "src/game/skills/index.ts"


func target_semantics() -> String:
	var d: Dictionary = SKILLS.defs().get(original_skill_id, {})
	return String(d.get("aim", {}).get("kind", "target"))


func supports_retarget() -> bool:
	return true


func supports_drag_path() -> bool:
	return true


func source_hz() -> float:
	return 60.0


func native_raster_density() -> int:
	return 2


func authored_duration_seconds() -> float:
	var d: Dictionary = SKILLS.defs().get(original_skill_id, {})
	return float(d.get("dur", -1.0))


func required_components() -> PackedStringArray:
	return PackedStringArray([
		"gold_fixed_clock",
		"source_seed_rng",
		"canvas_scale",
		"life_cycle",
		"camera_layer_order",
		"procedural_raster",
		"enemy_anchor",
		"status_visual",
	])


func has_source_locked_generator() -> bool:
	## True only when the source-native registry actually holds a ported
	## generator for this id. A subclass whose id has no generator must refuse
	## to run rather than fall back to a generic approximation.
	return SKILLS.has_generator(original_skill_id)


func source_material_blocker() -> String:
	if not SKILLS.has_generator(original_skill_id):
		return ("SOURCE_NATIVE_GENERATOR_MISSING: venom_skills.gd has no "
				+ "ported generator for original skill id %d." % original_skill_id)
	return ""


## ---------------------------------------------------------------------------
## lifecycle
## ---------------------------------------------------------------------------

func _init() -> void:
	family = &"venomwright"


func begin(cast_id: StringName, bus, params: Gold93SkillParameters) -> void:
	super.begin(cast_id, bus, params)
	_world = null
	_gfx = {}
	_ground = null
	_cast_obj = null
	_hit_cursor = 0
	_cue_cursor = 0
	_damage_intents = 0
	_status_intents = 0
	_started = false
	_cast_fired = false
	_frames = 0
	_ink_peak = 0
	_last_ink = 0


## Reproduces the oracle's world construction, but with the HOST's caster,
## seed and target set instead of a fixed authored fixture.
func _ensure_world(targets: Array, aim: Dictionary) -> void:
	var def: Dictionary = SKILLS.defs().get(original_skill_id, {})
	var ctx_seed: int = int(_context_ref.original_source_seed) if _context_ref != null else 0
	var cast_seed: int = _params.resolved_seed(ctx_seed)

	var w := HostWorld.new(ENGINE.WW, ENGINE.WH)
	w.cfg["density"] = maxi(1, targets.size())
	w.reset_ids()
	w.uid = 1
	w.reset(cast_seed, true)
	w.lab = true

	# Caster: the host's real position, in original source units.
	var p = w.player
	if _context_ref != null and _context_ref.has_method("caster_source_position"):
		var cs: Vector2 = _context_ref.caster_source_position()
		p.x = cs.x
		p.y = cs.y
	p.form = "venom" if String(def.get("form", "vessel")) == "venom" else "vessel"
	p.venomT = 999.0
	p.cat = 100.0
	if String(def.get("form", "vessel")) != "venom":
		p.venomT = 0.0

	# Targets: the host's real enemies, injected into the original simulation
	# so every authored hit lands on the actor the game actually supplied.
	w.enemies.clear()
	for i in range(targets.size()):
		var t: Dictionary = targets[i]
		if not bool(t.get("exists", true)):
			continue
		# Referenced through the preloaded script: an inner class reached via a
		# world INSTANCE would not resolve for a HostWorld subclass.
		var e = WORLDG.Enemy.new("grunt", i % 3, int(t.get("id", i + 1)))
		e.x = float(t.get("x", 0.0))
		e.y = float(t.get("y", 0.0))
		e.r = float(t.get("r", 6.0))
		e.spawn = 0.0
		e.dying = float(t.get("dying", 0.0))
		w.enemies.append(e)

	_gfx = ENGINE.build_gfx()
	_ground = ENGINE.make_ground_buffer()
	_world = w

	var r: Dictionary = {}
	if _has_aim:
		r = ENGINE.resolve(w, def, _aim_source.x, _aim_source.y)
	else:
		r = ENGINE.auto_aim(w, def)
	var factory: Callable = SKILLS.run_factory(original_skill_id)
	_cast_obj = ENGINE.cast(w, def, r, factory)
	_cast_fired = true


func step_source_tick(targets: Array, aim: Dictionary) -> void:
	_source_tick += 1
	if not has_source_locked_generator():
		# Fail closed rather than faking a cast with a generic effect.
		_finished = true
		return

	_host_targets = targets
	if aim.has("source_aim"):
		_aim_source = aim["source_aim"]
		_has_aim = bool(aim.get("aim_is_set", true))
	elif aim.has("source_direction"):
		var d: Vector2 = aim["source_direction"]
		if d.length_squared() > 0.000001:
			_aim_source = Vector2(_caster_source().x + d.x * 100.0,
					_caster_source().y + d.y * 100.0)
			_has_aim = true

	if not _started:
		_started = true
		_ensure_world(targets, aim)
	if _world == null:
		return

	_sync_host_targets(targets)
	_world.step(F)
	_render()
	_drain_hits()
	_drain_cues()
	_check_end()


func _caster_source() -> Vector2:
	if _context_ref != null and _context_ref.has_method("caster_source_position"):
		return _context_ref.caster_source_position()
	return Vector2.ZERO


## Host authority over actor motion: the real game owns enemy movement, so the
## simulated actors are snapped to the host's live positions every tick.
func _sync_host_targets(targets: Array) -> void:
	if _world == null:
		return
	var by_id: Dictionary = {}
	for t in targets:
		by_id[int(t.get("id", -1))] = t
	for e in _world.enemies:
		if not by_id.has(e.id):
			continue
		var t: Dictionary = by_id[e.id]
		e.x = float(t.get("x", e.x))
		e.y = float(t.get("y", e.y))
		e.r = float(t.get("r", e.r))
		if float(t.get("dying", 0.0)) > 0.0 and e.dying <= 0.0:
			e.hp = 0.0
			e.dying = float(t.get("dying", 0.0))


## The ORIGINAL render sequence, verbatim from the oracle driver:
##   scene <- ground; glow <- 0xFF000000; reset(); w.draw(g)
func _render() -> void:
	_gfx["s"].copy_from(_ground)
	_gfx["l"].clear(0xFF000000)
	_gfx["s"].reset()
	_gfx["l"].reset()
	_gfx["t"] = _world.time
	_world.draw(_gfx)
	_frames += 1
	_last_ink = _count_ink(_gfx["s"])
	if _last_ink > _ink_peak:
		_ink_peak = _last_ink


func _count_ink(L) -> int:
	var n: int = 0
	var b: PackedByteArray = L.bytes
	var i: int = 0
	var total: int = b.size()
	# Sample every 16th pixel: this is a presence metric, not a hash.
	while i < total:
		if b[i] != 0 or b[i + 1] != 0 or b[i + 2] != 0:
			n += 1
		i += 64
	return n


## ---------------------------------------------------------------------------
## intent emission
## ---------------------------------------------------------------------------

func _source_to_world() -> Transform2D:
	if _context_ref != null and _context_ref.has_method("source_to_world"):
		return _context_ref.source_to_world()
	return Transform2D.IDENTITY


func _target_key(source_id: int) -> String:
	if _context_ref != null and _context_ref.has_method("target_key_for_source"):
		return String(_context_ref.target_key_for_source(source_id))
	return "lab:%d" % source_id


func _drain_hits() -> void:
	if _world == null:
		return
	var hits: Array = _world.hits
	for i in range(_hit_cursor, hits.size()):
		var h: Dictionary = hits[i]
		var at = h.get("at", null)
		var contact := Vector2.ZERO
		if at is Array and at.size() >= 2:
			contact = Vector2(float(at[0]), float(at[1]))
		# Only the injected CombatPort may turn this into real damage; the VFX
		# never mutates the host's health pool.
		emit(Gold93Intents.damage(cast_id(), _source_tick, next_cursor(),
					_target_key(int(h.get("e", -1))), float(h.get("amt", 0.0)),
					contact, _source_to_world(),
					StringName("venomwright_%s" % String(h.get("kind", "impact"))),
					{"killed": bool(h.get("killed", false))}))
		_damage_intents += 1
		if float(h.get("stag", 0.0)) > 0.0:
			emit(Gold93Intents.status(cast_id(), _source_tick, next_cursor(),
						_target_key(int(h.get("e", -1))), &"stagger",
						float(h.get("stag", 0.0)), 0.0,
						{"source_cue": String(h.get("kind", ""))}))
			_status_intents += 1
	_hit_cursor = hits.size()


func _drain_cues() -> void:
	if _world == null:
		return
	var cues: Array = _world.cues
	for i in range(_cue_cursor, cues.size()):
		var c: Dictionary = cues[i]
		match String(c.get("k", "")):
			"mark":
				emit(Gold93Intents.status(cast_id(), _source_tick, next_cursor(),
							_target_key(int(c.get("e", -1))),
							StringName(String(c.get("key", ""))),
							float(c.get("dur", 0.0)), 1.0, {"source_cue": "mark"}))
				_status_intents += 1
			"poison":
				emit(Gold93Intents.status(cast_id(), _source_tick, next_cursor(),
							_target_key(int(c.get("e", -1))), &"poison",
							float(c.get("dur", 0.0)),
							float(c.get("total", 0.0)),
							{"source_cue": "poison"}))
				_status_intents += 1
			_:
				pass
	_cue_cursor = cues.size()


func _cast_task_name() -> String:
	var d: Dictionary = SKILLS.defs().get(original_skill_id, {})
	return String(d.get("name", ""))


func _check_end() -> void:
	# The original generator owns its own lifetime. `w.run(gen, name)` names
	# the cast task after the authored skill, and every nested sub-generator
	# the cast spawns is registered with an empty name, so the presence of
	# that one named task is exactly "the cast is still running".
	if _world == null:
		return
	var name_: String = _cast_task_name()
	var live: bool = false
	for t in _world.tasks:
		if String(t.get("name", "")) == name_:
			live = true
			break
	if not live and _source_tick > 2:
		_finished = true


## ---------------------------------------------------------------------------
## host-facing outputs
## ---------------------------------------------------------------------------

## The ORIGINAL scene / glow rasters for this tick. Returned by reference so
## the family renderer can upload them without a copy.
func source_native_frame() -> Dictionary:
	if _gfx.is_empty():
		return {}
	return {
		"scene": _gfx.get("s"),
		"glow": _gfx.get("l"),
		"time": float(_gfx.get("t", 0.0)),
		"W": ENGINE.RW,
		"H": ENGINE.RH,
		"k": ENGINE.RK,
	}


func frame_payload() -> Dictionary:
	var f := source_native_frame()
	f["frames"] = _frames
	f["ink_peak"] = _ink_peak
	f["ink"] = _last_ink
	return f


## The live original simulation, for headless numeric inspection.
func source_runtime():
	return _world


func environment_ref():
	return _world


func update_aim(aim: Dictionary) -> void:
	if aim.has("source_aim"):
		_aim_source = aim["source_aim"]
		_has_aim = true


func cancel() -> void:
	# Cancel the authored generator exactly the way the original's scheduler
	# does: drop the task, so no further yielded step, draw or RNG draw runs.
	if _world != null:
		var name_: String = _cast_task_name()
		for i in range(_world.tasks.size() - 1, -1, -1):
			if String(_world.tasks[i].get("name", "")) == name_:
				_world.tasks.remove_at(i)
	_finished = true


func dispose() -> void:
	_world = null
	_gfx = {}
	_ground = null
	_cast_obj = null
	super.dispose()


func stats() -> Dictionary:
	var s: Dictionary = super.stats()
	s["cast_fired"] = _cast_fired
	s["frames_rendered"] = _frames
	s["damage_intents"] = _damage_intents
	s["status_intents"] = _status_intents
	s["ink_peak"] = _ink_peak
	s["skill_id"] = original_skill_id
	return s
