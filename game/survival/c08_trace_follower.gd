extends RefCounted
## C08 lawful creature perception, adapted onto the shipped SkeletonEnemy.
##
## This adapter is the ONLY consumer of `c08_trace_store.gd` in gameplay. It can
## make a creature walk toward a footprint, and nothing else: it cannot damage,
## cannot see through a wall, cannot be handed the player's position, and cannot
## be given a target by a test. The skeleton's own `_can_detect_target()` /
## `_has_line_of_sight()` path stays untouched and always wins, so direct
## observation and combat remain exactly what they were.
##
## ## The three rules this file exists to enforce
##
## 1. **Local, physical sensing.** A mark is read only from a bounded query
##    (`SENSE_RADIUS`, inside the store's own 128 px locality cap) and only when
##    the creature's own physics ray from its eye to the mark is clear. A wall,
##    a closed door body or a tree blocks the observation.
## 2. **Causal, contiguous pursuit.** The creature moves to ONE record, arrives at
##    it, and only then asks that record for its own `successor()`. Consecutive
##    links must be physically clear for the body's own collision mask. It never
##    asks "where is the newest trace" and it can never jump to the player or to
##    the home: a broken/expired/shortcut chain is a refusal, not a leap.
## 3. **Bounded excursion.** Beyond `PURSUIT_BOUND` from its own habitat the
##    creature stops pursuing and returns to patrol. A trail is an invitation to
##    investigate, not a GPS subscription.
##
## Nothing here is saved. Evidence is ephemeral K2 medium; a cold start has no
## live footprints, which is exactly what C09's offline ordering must see.

## A mark this far from the creature's body can be noticed.
const SENSE_RADIUS := 96.0
## Arrival tolerance at a record. The record is a physical place, so the creature
## must actually get there before it may read the next link.
const ARRIVE_RADIUS := 11.0
## How far apart two causally linked records may be for this body. Larger than the
## source spacing, small enough that a link cannot teleport across a wall.
const MAX_LINK := 48.0
## Standing on one mark for longer than this means the route is not walkable for
## this body, and pursuing further would be a lie.
const GOAL_TIMEOUT := 9.0
const MAX_HOPS := 160
## How long the creature will stand at the freshest mark of a chain that is still
## live before it decides the trail really ended. A walker who is still walking
## adds a mark every `spacing` pixels, so a chain that looks finished may simply
## be the current head: waiting a few seconds is perception, not a new rule.
const HEAD_WAIT := 8.0
## Hard bound measured from the creature's own habitat, not from the player.
const PURSUIT_BOUND := 1400.0

var source: Node = null
var skeleton: Node2D = null
var habitat := Vector2.ZERO

var sensed_count := 0
var hops := 0
var refused_links := 0
var max_hop := 0.0
var goal := Vector2.ZERO
var goal_trace := 0
var pursuing := false
var reached_end := false
var lost_reason := ""
var last_sensed_trace := 0
var window := ""
var history: Array[Dictionary] = []
var _goal_elapsed := 0.0
var _started := false
## The record the last pursuit ended on. Older-or-equal marks are cold evidence:
## re-sensing them would loop the creature on a trail it already followed.
var _cold_trace := 0
## Seconds spent standing at the current head of a chain that may still grow.
var _head_wait := 0.0
## Diagnostics: how often the skeleton actually consulted this adapter, and the
## last reason it declined. "It never sensed" and "it was never asked" are very
## different failures and must not look the same in an evidence window.
var drive_calls := 0
var block_reason := ""


func attach(target: Node2D, habitat_position: Vector2, trace_source: Node) -> bool:
	if target == null or not is_instance_valid(target) or trace_source == null or not is_instance_valid(trace_source):
		return false
	skeleton = target
	habitat = habitat_position
	source = trace_source
	_started = true
	return true


## Evidence-window delimiter. It resets counters ONLY; no creature state, no
## store content and no clock is touched, so a window boundary cannot manufacture
## or erase a pursuit.
func begin_window(label: String) -> void:
	window = label
	drive_calls = 0
	block_reason = ""
	sensed_count = 0
	hops = 0
	refused_links = 0
	max_hop = 0.0
	reached_end = false
	lost_reason = ""
	goal = Vector2.ZERO
	goal_trace = 0
	pursuing = false
	last_sensed_trace = 0
	_goal_elapsed = 0.0
	_cold_trace = 0
	_head_wait = 0.0
	history.clear()


## Called by the skeleton once per physics tick, only while it is not already in
## direct CHASE/ATTACK. Returns `{active, goal, trace_id}`.
func drive(target: Node2D, delta: float) -> Dictionary:
	drive_calls += 1
	if not _started or source == null or not is_instance_valid(source) or not is_instance_valid(target):
		block_reason = "detached"
		return {"active": false}
	skeleton = target
	if not bool(source.call(&"is_active")):
		block_reason = "source_inactive"
		return {"active": false}
	var clock: Dictionary = source.call(&"clock")
	if not bool(clock.get("ok", false)):
		block_reason = "clock_unavailable:" + String(clock.get("reason", ""))
		_stop("clock_unavailable")
		return {"active": false}
	var stamp := float(clock["stamp"])
	var store: Variant = source.get(&"store")
	if store == null:
		block_reason = "store_absent"
		return {"active": false}
	block_reason = ""
	if not pursuing:
		return _sense(store, stamp)
	# The creature must still be allowed to be here at all.
	if skeleton.global_position.distance_to(habitat) > PURSUIT_BOUND:
		_stop("outside_bound")
		return {"active": false}
	if goal_trace == 0 or not bool(store.call(&"is_live", goal_trace, stamp)):
		# The mark it was walking to has itself decayed: the trail went cold.
		_stop("expired")
		return {"active": false}
	if skeleton.global_position.distance_to(goal) <= ARRIVE_RADIUS:
		return _arrive(store, stamp, delta)
	_goal_elapsed += delta
	if _goal_elapsed > GOAL_TIMEOUT:
		_stop("goal_timeout")
		return {"active": false}
	return {"active": true, "goal": goal, "trace_id": goal_trace}


func _sense(store: Variant, stamp: float) -> Dictionary:
	var candidates: Array = store.call(&"nearby", skeleton.global_position, SENSE_RADIUS, stamp)
	for raw: Variant in candidates:
		if not raw is Dictionary:
			continue
		var record: Dictionary = raw
		var at: Vector2 = record.get("position", Vector2.ZERO)
		if skeleton.global_position.distance_to(at) > SENSE_RADIUS:
			continue
		if at.distance_to(habitat) > PURSUIT_BOUND:
			continue
		if not _clear_to(at):
			continue
		var id := int(record.get("id", 0))
		if id == 0 or id <= _cold_trace:
			continue
		sensed_count += 1
		last_sensed_trace = id
		goal = at
		goal_trace = id
		pursuing = true
		_goal_elapsed = 0.0
		_log("sensed", id, at, 0.0)
		return {"active": true, "goal": goal, "trace_id": goal_trace}
	return {"active": false}


func _arrive(store: Variant, stamp: float, delta: float) -> Dictionary:
	var arrived := goal_trace
	var successor: Dictionary = store.call(&"successor", arrived, stamp)
	if successor.is_empty():
		# No successor means one of two very different things. If the mark is
		# still live the walker may simply still be walking, and the freshest mark
		# is the current head of a chain that is still growing: stand on it for a
		# bounded moment and look again. Only cold evidence ends the trail.
		if bool(store.call(&"is_live", arrived, stamp)) and _head_wait < HEAD_WAIT:
			_head_wait += delta
			return {"active": true, "goal": goal, "trace_id": arrived}
		# The chain ends where the evidence ends. The creature stands at the last
		# real mark; it does not get to guess where the walker went next.
		reached_end = true
		_cold_trace = arrived
		_stop("chain_end")
		_log("chain_end", arrived, goal, 0.0)
		return {"active": false}
	var next_at: Vector2 = successor.get("position", Vector2.ZERO)
	var hop := goal.distance_to(next_at)
	if hop > MAX_LINK:
		refused_links += 1
		_stop("link_too_far")
		_log("refused_far", arrived, next_at, hop)
		return {"active": false}
	if not _link_clear(goal, next_at):
		refused_links += 1
		_stop("link_blocked")
		_log("refused_blocked", arrived, next_at, hop)
		return {"active": false}
	if hops >= MAX_HOPS:
		_stop("hop_limit")
		return {"active": false}
	hops += 1
	max_hop = maxf(max_hop, hop)
	_head_wait = 0.0
	goal = next_at
	goal_trace = int(successor.get("id", 0))
	_goal_elapsed = 0.0
	_log("hop", goal_trace, goal, hop)
	return {"active": true, "goal": goal, "trace_id": goal_trace}


func _stop(reason: String) -> void:
	pursuing = false
	if lost_reason.is_empty():
		lost_reason = reason
	goal = Vector2.ZERO
	goal_trace = 0
	_goal_elapsed = 0.0


func _log(event: String, id: int, at: Vector2, hop: float) -> void:
	if history.size() >= 512:
		return
	history.append({"event": event, "trace": id, "at": [at.x, at.y], "hop": hop,
		"from": [skeleton.global_position.x, skeleton.global_position.y]})


## Eye-to-mark ray on the creature's own physics space. Any collider blocks.
func _clear_to(at: Vector2) -> bool:
	return _ray(skeleton.global_position + Vector2(0.0, -7.0), at + Vector2(0.0, -6.0))


## A causal link must be walkable for this body: clear ray plus a free cell at
## both ends according to the world's own traversability, when available.
func _link_clear(from: Vector2, to: Vector2) -> bool:
	if not _ray(from + Vector2(0.0, -7.0), to + Vector2(0.0, -6.0)):
		return false
	var nav: Variant = source.call(&"navigation")
	if nav == null or not nav.has_method(&"cell_of"):
		return true
	var a := Vector2i(nav.call(&"cell_of", from))
	var b := Vector2i(nav.call(&"cell_of", to))
	if not bool(nav.call(&"in_bounds", a)) or not bool(nav.call(&"in_bounds", b)):
		return false
	if not bool(nav.call(&"is_free", a)) or not bool(nav.call(&"is_free", b)):
		return false
	return true


func _ray(from: Vector2, to: Vector2) -> bool:
	if not is_instance_valid(skeleton) or skeleton.get_world_2d() == null:
		return false
	var query := PhysicsRayQueryParameters2D.create(from, to, 1, [skeleton.get_rid()])
	return skeleton.get_world_2d().direct_space_state.intersect_ray(query).is_empty()


func snapshot() -> Dictionary:
	return {
		"schema": "soh.c08.trace_follower.v1",
		"window": window,
		"sensed": sensed_count,
		"hops": hops,
		"max_hop": max_hop,
		"refused_links": refused_links,
		"drive_calls": drive_calls,
		"block_reason": block_reason,
		"pursuing": pursuing,
		"reached_end": reached_end,
		"lost_reason": lost_reason,
		"last_sensed_trace": last_sensed_trace,
		"goal_trace": goal_trace,
		"goal": [goal.x, goal.y],
		"history": history.duplicate(true),
	}
