class_name Venomwright001GlassfangHunt
extends Gold93SkillModule

## Venomwright #001 — Glassfang Hunt (original `src/game/skills/s1.ts`).
##
## This is a REAL native module: the whole authored cast is executed by the
## source-locked Gold components produced by the factory branch
## (`prototypes/gold_pair/**`, READ-ONLY dependency). Nothing here is a stub,
## a baked sprite sheet, a mock draw call or a primitive-only placeholder.
##
## Timeline actually reproduced:
##   vial throw -> Fang spawn -> first leap -> four (leap / bite / recoil /
##   orbit) cycles -> retarget on dying enemy -> finisher bite -> 11+6 shards
##   and 28 droplet burst -> three cast-seeded 4.2 s acidic aftershock pools ->
##   afterlife / expiry -> cleanup.
##
## The module NEVER mutates health. Bite and acid cues become DamageIntent /
## StatusIntent messages; only an injected, user-configured CombatPort may turn
## them into real combat, exactly once per source hit.

const SOURCE = preload("res://prototypes/gold_pair/venom_glassfang_full_particle_runtime.gd")
const LIVE_ENV = preload("res://prototypes/gold_pair/venom_glassfang_live_environment.gd")

const F: float = 1.0 / 60.0
## Original authored pool afterlife: three `aftershock_pool` cues with life 4.2 s.
const POOL_AFTERLIFE_TICKS: int = 252

var _source = null
var environment = null

var _bite_cursor: int = 0
var _cue_cursor: int = 0
var _env_cursor: int = 0
var _pending_aim: Dictionary = {}
var _caster_source: Vector2 = Vector2.ZERO
var _cast_angle: float = 0.0
var _initial_target_id: int = -1
var _started: bool = false
var _cast_done: bool = false
var _afterlife_ticks: int = 0
var _bite_count: int = 0
var _acid_count: int = 0
var _terrain_ops: int = 0
var _emitted_env_ids: Dictionary = {}


## --- metadata ---------------------------------------------------------------

func original_name() -> String:
	return "Glassfang Hunt"


func source_variant() -> String:
	return "vessel"


func registry_source_path() -> String:
	return "src/game/skills/index.ts"


func target_semantics() -> String:
	return "target"


func supports_retarget() -> bool:
	# The original generator re-acquires the nearest enemy when its target dies.
	return true


func supports_drag_path() -> bool:
	# Original targeting is a picked enemy; a drag path can pre-select the aim.
	return true


func source_hz() -> float:
	return 60.0


func native_raster_density() -> int:
	return 2


func authored_duration_seconds() -> float:
	# ~0.05 + 0.08 + leap/bite cycles + finisher 0.6 s + 4.2 s pool afterlife.
	return 7.0


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
	# Every stage of this skill is driven by components whose numeric output was
	# source-locked against the original archive (motion oracle, Fang pixel
	# oracle, 11-kind particle oracle, pool lifecycle/SDF/shade oracles).
	return true


func source_material_blocker() -> String:
	return ""


## --- lifecycle --------------------------------------------------------------

func _init() -> void:
	canonical_id = &"venomwright:001"
	family = &"venomwright"
	original_skill_id = 1


func begin(cast_id: StringName, bus, params: Gold93SkillParameters) -> void:
	super.begin(cast_id, bus, params)
	_source = (SOURCE as GDScript).new()
	environment = (LIVE_ENV as GDScript).new()
	environment.reset()
	_bite_cursor = 0
	_cue_cursor = 0
	_env_cursor = 0
	_started = false
	_cast_done = false
	_afterlife_ticks = 0
	_bite_count = 0
	_acid_count = 0
	_terrain_ops = 0


func source_runtime():
	return _source


func environment_ref():
	return environment


func _caster_and_aim(aim: Dictionary) -> void:
	_caster_source = aim.get("source_origin", Vector2.ZERO)
	_cast_angle = float(aim.get("source_angle", 0.0))


func _pick_initial_target(targets: Array, aim: Dictionary) -> int:
	if targets.is_empty():
		return -1
	var aim_point: Vector2 = aim.get("source_aim", _caster_source)
	if not bool(aim.get("aim_is_set", false)):
		return int(targets[0].get("id", -1))
	var best_id: int = -1
	var best_d: float = INF
	for t in targets:
		if not t is Dictionary:
			continue
		var d: Dictionary = t
		if not bool(d.get("exists", true)) or float(d.get("dying", 0.0)) > 0.0:
			continue
		var dx: float = float(d.get("x", 0.0)) - aim_point.x
		var dy: float = float(d.get("y", 0.0)) - aim_point.y
		var dist: float = sqrt(dx * dx + dy * dy)
		if dist < best_d:
			best_d = dist
			best_id = int(d.get("id", -1))
	return best_id if best_id >= 0 else int(targets[0].get("id", -1))


func step_source_tick(targets: Array, aim: Dictionary) -> void:
	_source_tick += 1
	if not _started:
		_started = true
		_caster_and_aim(aim)
		_initial_target_id = _pick_initial_target(targets, aim)
		var ctx_seed: int = int(_context_ref.original_source_seed) if _context_ref != null else 0
		var cast_seed: int = _params.resolved_seed(ctx_seed)
		# Original World owns a separate RNG stream from the cast generator.
		var world_seed: int = cast_seed ^ 0x9E3779B9
		_source.begin(_caster_source.x, _caster_source.y, _cast_angle,
				_initial_target_id, cast_seed, world_seed)
	_source.step_source_60hz(targets)
	_drain_bites()
	_drain_world_cues()
	if environment != null:
		environment.capture(_source)
	_drain_environment()
	_check_end()


func update_aim(aim: Dictionary) -> void:
	_pending_aim = aim.duplicate(true)
	# The ORIGINAL generator fixes its cast angle at spawn. Re-aiming is only
	# applied when the host explicitly opts into the free-360 preview policy, so
	# default playback stays byte-identical to the authored source.
	if _params != null and _params.aim_policy == "free_360_preview" and _started:
		_cast_angle = float(aim.get("source_angle", _cast_angle))
		if _source != null and _source.motion != null:
			_source.motion.face = _cast_angle


## --- intent emission ---------------------------------------------------------

func _source_to_world() -> Transform2D:
	if _context_ref != null and _context_ref.has_method("source_to_world"):
		return _context_ref.source_to_world()
	return Transform2D.IDENTITY


func _drain_bites() -> void:
	if _source == null or _source.motion == null:
		return
	var bites: Array = _source.motion.bite_cues
	for i in range(_bite_cursor, bites.size()):
		var b: Dictionary = bites[i]
		var target_key := _target_key(int(b.get("enemy", -1)))
		var contact := Vector2(float(b.get("contact_x", 0.0)),
				float(b.get("contact_y", 0.0)))
		# Original w.hit(kind='bite') is a real authored damage cue; admission is
		# once-only and gameplay application belongs solely to the combat port.
		emit(Gold93Intents.damage(cast_id(), _source_tick, next_cursor(),
				target_key, float(b.get("amount", 0.0)), contact,
				_source_to_world(), &"venom_glassfang_bite",
				{"final": bool(b.get("final", false))}))
		emit(Gold93Intents.status(cast_id(), _source_tick, next_cursor(),
				target_key, &"stagger", float(b.get("stagger", 0.0)),
				0.0, {"source_cue": "bite"}))
		# Original hitE knockback is a source-only PRESENTATION cue: the VFX must
		# not move the real enemy or change HP.
		emit(Gold93Intents.enemy_visual(cast_id(), _source_tick, next_cursor(),
				target_key, &"knockback", &"body",
				{"knock_x": float(b.get("knock_x", 0.0)),
					"knock_y": float(b.get("knock_y", 0.0)),
					"presentation_only": true}))
		emit(Gold93Intents.enemy_visual(cast_id(), _source_tick, next_cursor(),
				target_key, &"bite_contact", &"body",
				{"final": bool(b.get("final", false))}))
		emit(Gold93Intents.sound(cast_id(), _source_tick, next_cursor(),
				&"venom_glassfang_bite", contact,
				{"final": bool(b.get("final", false))}))
		_bite_count += 1
	_bite_cursor = bites.size()


func _drain_world_cues() -> void:
	if _source == null:
		return
	var cues: Array = _source.cues
	for i in range(_cue_cursor, cues.size()):
		var c: Dictionary = cues[i]
		var kind := String(c.get("kind", ""))
		match kind:
			"acid_hit_candidate":
				var target_key := _target_key(int(c.get("enemy", -1)))
				var at := Vector2(float(c.get("at_x", 0.0)), float(c.get("at_y", 0.0)))
				emit(Gold93Intents.damage(cast_id(), _source_tick, next_cursor(),
						target_key, float(c.get("amount", 0.0)), at,
						_source_to_world(), &"venom_glassfang_acid",
						{"shared_pool_hit": true}))
				_acid_count += 1
			"vial":
				emit(Gold93Intents.projectile(cast_id(), _source_tick, next_cursor(),
						Vector2(float(c.get("x0", 0.0)), float(c.get("y0", 0.0))),
						Vector2(float(c.get("x1", 0.0)), float(c.get("y1", 0.0))),
						&"vial", {"duration": float(c.get("duration", 0.08)),
							"arc": float(c.get("arc", 4.0)),
							"spin": float(c.get("spin", 22.0))}))
			_:
				pass
	_cue_cursor = cues.size()


func _drain_environment() -> void:
	if environment == null:
		return
	# `snapshot()` is a live projection of the events still inside their authored
	# lifetime, so each authored event is turned into exactly ONE terrain intent
	# using a stable identity (no duplicate ground writes per tick).
	for e in environment.snapshot():
		if not e is Dictionary:
			continue
		var d: Dictionary = e
		var frame: int = int(d.get("frame", _source_tick))
		var op_name := String(d.get("kind", ""))
		var px: float = float(d.get("x", 0.0))
		var py: float = float(d.get("y", 0.0))
		var identity := "%d|%s|%.4f|%.4f" % [frame, op_name, px, py]
		if _emitted_env_ids.has(identity):
			continue
		_emitted_env_ids[identity] = true
		emit(Gold93Intents.terrain_visual(cast_id(), _source_tick, next_cursor(),
				Vector2(px, py), StringName(op_name), {
					"radius": float(d.get("radius", 0.0)),
					"size": float(d.get("size", 0.0)),
					"duration": float(d.get("duration", 0.0)),
					"c1": int(d.get("c1", 0)),
					"c2": int(d.get("c2", 0)),
					"lit": int(d.get("lit", 0)),
					"dark": int(d.get("dark", 0)),
					"edge": int(d.get("edge", 0)),
					"cosmetic_only": true,
				}))
		_terrain_ops += 1
	_env_cursor = int(environment.stats().get("received", 0))


func _target_key(source_id: int) -> String:
	if _context_ref != null and _context_ref.has_method("target_key_for_source"):
		var key: String = _context_ref.target_key_for_source(source_id)
		if not key.is_empty():
			return key
	return "source:%d" % source_id


## --- completion ---------------------------------------------------------------

func _check_end() -> void:
	if not _cast_done and _source != null and _source.motion != null:
		if bool(_source.motion.done):
			_cast_done = true
	if _cast_done:
		var pools_left: int = int(_source.active_pools.size()) if _source != null else 0
		_afterlife_ticks += 1
		# Original afterlife ends when the last 4.2 s acidic pool expires; the
		# absolute ceiling keeps a detached cast from running forever.
		if pools_left == 0 or _afterlife_ticks > POOL_AFTERLIFE_TICKS + 120:
			_finished = true


func cancel() -> void:
	super.cancel()
	if environment != null:
		environment.reset()
	if _source != null and _source.has_method("reset"):
		_source.reset()


func dispose() -> void:
	if environment != null:
		environment.reset()
	_source = null
	environment = null
	_emitted_env_ids.clear()
	super.dispose()


func stats() -> Dictionary:
	var base: Dictionary = super.stats()
	base["original_name"] = original_name()
	base["cast_done"] = _cast_done
	base["afterlife_ticks"] = _afterlife_ticks
	base["bites"] = _bite_count
	base["acid_candidates"] = _acid_count
	base["terrain_ops"] = _terrain_ops
	base["active_pools"] = int(_source.active_pools.size()) if _source != null else 0
	base["source_particles"] = int(_source.particles().size()) if _source != null else 0
	return base
