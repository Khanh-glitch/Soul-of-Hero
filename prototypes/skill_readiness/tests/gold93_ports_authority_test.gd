extends SceneTree

## Proves the DI seams behave as the epic demands:
##  * VFX never mutates health while gameplay rules are unconfigured,
##  * an admitted source hit is applied at most once (no double hits),
##  * overlapping casts stay independent and cancellation is isolated,
##  * terrain writes stay cosmetic (no map/TileMap collision mutation).

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const INTENTS = preload("res://prototypes/skill_readiness/core/gold93_intents.gd")

var _failures: Array[String] = []


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_PORTS: " + message)


func _context(source_seed: int, actors: Array) -> Gold93CastContext:
	var caster := Node2D.new()
	root.add_child(caster)
	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), source_seed, true)
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors(actors)
	ctx.set_ports(bundle)
	return ctx


func _actors() -> Array:
	return [
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 410.0, "y": 205.0, "r": 7.0, "exists": true, "dying": 0.0},
	]


func _initialize() -> void:
	var runtime = RUNTIME.new()

	# --- 1. unconfigured gameplay never applies damage ------------------------
	var ctx := _context(20261028, _actors())
	var handle = runtime.cast(&"venomwright:001", ctx, PARAMS.diagnostic("venomwright"))
	handle.run_to_completion(4096)
	var bundle = ctx.ports_bundle()
	_check(bundle.combat.applied.is_empty(), "no HP mutation without user-approved rules")
	_check(bundle.combat.rejected > 0, "unconfigured combat must be recorded as rejected")
	var damage_intents: Array = handle.intents_by_kind(INTENTS.KIND_DAMAGE)
	_check(damage_intents.size() >= 5, "source-authored bite/acid intents must still be published")

	# --- 2. once-only hit admission -------------------------------------------
	var bus = INTENTS.Bus.new(&"unit")
	_check(bus.admit_hit(&"damage", 12, "source:1"), "first admission must pass")
	_check(not bus.admit_hit(&"damage", 12, "source:1"), "same source hit must be admitted once")
	_check(bus.admit_hit(&"damage", 13, "source:1"), "a different source cursor is a new hit")
	_check(bus.admit_hit(&"damage", 12, "source:2"), "a different target is a new hit")
	_check(bus.rejected_duplicates == 1, "duplicate admission counter must be accurate")

	# --- 3. configured port applies exactly once per admitted hit -------------
	var configured := PORTS.RecordingCombatPort.new()
	configured.configured = true
	configured.set_alive("source:1", true)
	var dmg := INTENTS.damage(&"unit", 100, 12, "source:1", 30.0,
			Vector2(10.0, 10.0), Transform2D.IDENTITY, &"bite")
	_check(configured.apply_damage("source:1", 30.0, Vector2(10.0, 10.0), &"bite", dmg),
			"configured combat port must accept an admitted hit")
	_check(not configured.apply_damage("source:1", 30.0, Vector2(10.0, 10.0), &"bite", dmg),
			"the same intent must not be applied twice")
	_check(configured.applied.size() == 1, "exactly one application recorded")

	# --- 4. terrain writes are cosmetic only ----------------------------------
	var terrain := PORTS.RecordingTerrainPort.new()
	_check(terrain.can_mutate_collision() == false, "VFX may never mutate map collision")
	terrain.mark_solid(Rect2(0.0, 0.0, 600.0, 340.0))
	_check(terrain.is_solid(Vector2(10.0, 10.0)), "read-only occupancy sampling must work")
	terrain.write_visual(Vector2(5.0, 5.0), &"splash", {"radius": 4.0})
	_check(terrain.writes.size() == 1, "cosmetic ground write recorded")
	_check(terrain.clear_visuals(&"cast") == 1, "cleanup must remove every owned ground mark")
	_check(terrain.writes.is_empty(), "no owned ground mark may survive cleanup")

	# --- 5. overlapping casts stay independent --------------------------------
	var ctx_a := _context(20261028, _actors())
	var ctx_b := _context(424242, _actors())
	var a = runtime.cast(&"venomwright:001", ctx_a, PARAMS.diagnostic("venomwright"))
	var b = runtime.cast(&"venomwright:001", ctx_b, PARAMS.diagnostic("venomwright"))
	a.start()
	b.start()
	for _i in range(120):
		a.tick_source(1)
		b.tick_source(1)
	_check(a.cast_id != b.cast_id, "concurrent casts must own distinct cast identities")
	_check(a.trace_digest() != b.trace_digest(), "different seeds must diverge while overlapping")
	_check(a.status == Gold93SkillHandle.Status.RUNNING, "cast A must survive concurrent stepping")
	_check(b.status == Gold93SkillHandle.Status.RUNNING, "cast B must survive concurrent stepping")

	# --- 6. cancelling one cast does not disturb the others -------------------
	var cursor_before: int = int(b.result().get("intents", {}).get("emitted", 0))
	_check(a.cancel(), "cancel must succeed on a running cast")
	_check(a.status == Gold93SkillHandle.Status.CANCELLED, "cancelled state")
	var emitted_at_cancel: int = int(a.result().get("intents", {}).get("emitted", 0))
	a.tick_source(30)
	_check(int(a.result().get("intents", {}).get("emitted", 0)) == emitted_at_cancel,
			"no stale intents after cancellation")
	b.tick_source(30)
	_check(int(b.result().get("intents", {}).get("emitted", 0)) > cursor_before,
			"the surviving cast keeps running normally")
	b.run_to_completion(4096)
	_check(b.status == Gold93SkillHandle.Status.FINISHED, "surviving cast must still complete")
	b.dispose()
	_check(b.status == Gold93SkillHandle.Status.DISPOSED, "dispose is idempotent-safe")

	if _failures.is_empty():
		print("GOLD93_PORTS: PASS / combat authority once-only / no unconfigured HP mutation / isolated concurrent casts / cosmetic terrain only")
		quit(0)
	else:
		print("GOLD93_PORTS: FAIL / %d problem(s)" % _failures.size())
		quit(1)
