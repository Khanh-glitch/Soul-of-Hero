extends Node2D
## A0-owned C08 source adapter: real player movement -> run-local footprint
## evidence. Nothing here decides game rules.
##
## ## What this is
##
## One node the world mounts after its own build is READY. Every physics tick it
## reads four things from their existing owners and hands them to
## `c08_trace_store.gd`:
##
##   * the Hero's real `CharacterBody2D` position — the body the player moved,
##     after collision, not an input intent;
##   * the run identity and run-clock seconds from the **existing** K8 authority
##     (`/root/RunLifecycle`), never a local timer and never `Engine.time_scale`;
##   * the K2 surface identity of that real cell, from A1's authored reader when
##     the authored continent is mounted, or from the annex world's own authored
##     ground code. No biome/weather coefficient is invented: the tag is the
##     authored surface name and nothing else;
##   * whether the motion is trustworthy at all (alive, exterior, real surface).
##     A death, a worksite interior, a streamed-out cell or a missing surface is
##     `eligible=false`, which breaks the chain instead of drawing a bridge.
##
## ## What this is NOT
##
## It does not sense, chase, damage, save, or schedule anything. It is not a
## monster-AI subsystem: `c08_trace_follower.gd` is the only consumer, and only a
## creature that is physically standing next to the mark can read it.
##
## ## Owner-pending parameters (disclosed, not canonical)
##
## `spacing`, `lifetime` and `max_step` are explicit caller inputs because the
## Bible does not yet fix surface/weather lifetime (K2 `[CẦN ĐO]`). The defaults
## below are implementation placeholders owned by A1/A3 policy, not new rules.
## `configure_policy()` lets a native gate or the future owner set them.

const STORE := preload("res://game/survival/c08_trace_store.gd")
const SETTING := "survival/c08_footprints"
const MARKS_SETTING := "survival/c08_footprint_marks"
## Travelled pixels between two records. Distance, not frames, so evidence density
## does not depend on frame rate or on the test's speed control.
const DEFAULT_SPACING := 24.0
## Run-clock seconds a mark survives. Placeholder pending K2 surface/weather law.
const DEFAULT_LIFETIME := 240.0
## A single physics step longer than this is not one continuous movement (a
## teleport, a respawn, a site transition) and must not be linked.
const DEFAULT_MAX_STEP := 48.0
const MARK_LIMIT := 96
const PRUNE_INTERVAL := 1.0

var store: Variant = null
var spacing := DEFAULT_SPACING
var lifetime := DEFAULT_LIFETIME
var max_step := DEFAULT_MAX_STEP
## Why the last sample was refused, for evidence. Empty means it was accepted.
var last_reason := ""
var samples := 0
var records_written := 0
var samples_refused := 0
var clock_agrees := 0
var clock_checks := 0
var surface_named := ""

var _host: Node = null
var _player: Node2D = null
var _navigation: Variant = null
var _authority: Node = null
var _active := false
var _marks := false
var _prune_left := 0.0
var _last_surface := ""


func is_active() -> bool:
	return _active


func clock() -> Dictionary:
	return _run_clock()


func navigation() -> Variant:
	return _navigation


func run_id() -> String:
	return String(store.run_id()) if store != null else ""


func configure(host: Node, player: Node2D, navigation: Variant, authority: Node) -> bool:
	store = STORE.new()
	_host = host
	_player = player
	_navigation = navigation
	_authority = authority
	_active = bool(ProjectSettings.get_setting(SETTING, true))
	_marks = bool(ProjectSettings.get_setting(MARKS_SETTING, true)) and _active
	z_index = -1
	set_process(true)
	if not _active:
		visible = false
		return false
	if player == null or host == null:
		_active = false
		last_reason = "seats_absent"
		return false
	return true


## Owner/test hook for the three parameters the Bible has not fixed yet. Recorded
## in `snapshot()` so no run can quietly use an undocumented lifetime.
func configure_policy(next_spacing: float, next_lifetime: float, next_max_step: float) -> bool:
	if not is_finite(next_spacing) or next_spacing <= 0.0:
		return false
	if not is_finite(next_lifetime) or next_lifetime <= 0.0:
		return false
	if not is_finite(next_max_step) or next_max_step <= 0.0:
		return false
	spacing = next_spacing
	lifetime = next_lifetime
	max_step = next_max_step
	return true


func _physics_process(delta: float) -> void:
	if not _active or store == null or not is_instance_valid(_player):
		last_reason = "inactive"
		return
	_prune_left -= delta
	var clock := _run_clock()
	if not bool(clock.get("ok", false)):
		last_reason = String(clock.get("reason", "run_clock_unavailable"))
		# No trustworthy clock means no trustworthy chronology: stop the chain.
		store.sample(Vector2.ZERO, 0.0, "", false, spacing, lifetime, max_step)
		return
	var run_id := String(clock["run_id"])
	if String(store.run_id()) != run_id:
		# A new (or first) run never inherits another run's evidence.
		store.reset(run_id)
	var stamp := float(clock["stamp"])
	var agrees := int(clock.get("agrees", -1))
	if agrees >= 0:
		clock_checks += 1
		if agrees == 1:
			clock_agrees += 1
	var eligible := true
	var reason := ""
	if bool(_player.get(&"dead")):
		reason = "hero_dead"
	elif _in_interior():
		reason = "worksite_interior"
	elif _host != null and _host.has_method(&"is_world_ready") and not bool(_host.call(&"is_world_ready")):
		reason = "world_not_ready"
	var surface := ""
	if reason.is_empty():
		surface = surface_at(_player.global_position)
		if surface.is_empty():
			reason = "surface_unavailable"
		# A streamed-out or non-walkable cell is not trustworthy movement.
		elif _navigation != null and _navigation.has_method(&"is_free"):
			var cell: Vector2i = _navigation.call(&"cell_of", _player.global_position)
			if not bool(_navigation.call(&"in_bounds", cell)) or not bool(_navigation.call(&"is_free", cell)):
				reason = "cell_not_walkable"
	eligible = reason.is_empty()
	last_reason = reason
	_last_surface = surface
	var written: int = store.sample(_player.global_position, stamp, surface, eligible,
		spacing, lifetime, max_step)
	samples += 1
	if eligible:
		if written > 0:
			records_written += 1
	else:
		samples_refused += 1
	if _prune_left <= 0.0:
		store.prune(stamp)
		_prune_left = PRUNE_INTERVAL
	if _marks:
		queue_redraw()


## The K2 surface identity of a real world position. Two truthful sources, no
## fallback invention: A1's authored `cell_surface()` on the continent, or the
## annex world's own authored ground code family. Unknown is `""`.
func surface_at(world_position: Vector2) -> String:
	if _authority != null and is_instance_valid(_authority) and _authority.has_method(&"cell_surface"):
		var cell := Vector2i(floori(world_position.x / 16.0), floori(world_position.y / 16.0))
		var named := String(_authority.call(&"cell_surface", cell))
		if not named.is_empty():
			return named
	if _host != null and is_instance_valid(_host):
		var world: Variant = _host.get(&"world")
		if world != null and is_instance_valid(world) and world.has_method(&"ground_code_at"):
			var code := String(world.call(&"ground_code_at", world_position))
			return _ground_family(world, code)
	return ""


func _ground_family(world: Variant, code: String) -> String:
	if code.is_empty():
		return ""
	var meta: Variant = world.get(&"tiles_meta")
	if not meta is Dictionary:
		return ""
	var ground: Variant = ((meta as Dictionary).get("codes", {}) as Dictionary).get("ground", {})
	if not ground is Dictionary or not (ground as Dictionary).has(code):
		return ""
	var names: Variant = (ground as Dictionary)[code]
	if not names is Array or (names as Array).is_empty():
		return ""
	# The authored atlas names variants like `grass0`; the surface family is the
	# authored name with the variant index removed. Nothing else is derived.
	var raw := String((names as Array)[0])
	var digits := raw.length()
	while digits > 0 and raw.substr(digits - 1, 1).is_valid_int():
		digits -= 1
	var family := raw.substr(0, digits)
	return family if not family.is_empty() else raw


func live_traces(limit: int = MARK_LIMIT) -> Array[Dictionary]:
	var empty: Array[Dictionary] = []
	if store == null:
		return empty
	var clock := _run_clock()
	if not bool(clock.get("ok", false)):
		return empty
	return store.records(float(clock["stamp"]), limit)


func live_count() -> int:
	if store == null:
		return 0
	var clock := _run_clock()
	if not bool(clock.get("ok", false)):
		return 0
	return store.live_count(float(clock["stamp"]))


func snapshot() -> Dictionary:
	var clock := _run_clock()
	return {
		"schema": "soh.c08.trace_source.v1",
		"setting": SETTING,
		"enabled": _active,
		"run_id": run_id(),
		"run_clock_ok": bool(clock.get("ok", false)),
		"run_clock_reason": String(clock.get("reason", "")),
		"run_clock_agrees_with_phase": int(clock.get("agrees", -1)),
		"stamp": float(clock.get("stamp", -1.0)),
		"spacing": spacing,
		"lifetime": lifetime,
		"max_step": max_step,
		"samples": samples,
		"records_written": records_written,
		"samples_refused": samples_refused,
		"last_reason": last_reason,
		"last_surface": _last_surface,
		"live": live_count(),
		"total_records": int(store.total_count()) if store != null else 0,
	}


## The run clock is read from the existing K8 owner. `span` is seconds since that
## run started; `agrees` cross-checks the derived span against the phase's own
## `seconds_elapsed` so a drifting local timer cannot masquerade as authority.
func _run_clock() -> Dictionary:
	var lifecycle := get_node_or_null("/root/RunLifecycle")
	if lifecycle == null or not lifecycle.has_method(&"phase"):
		return {"ok": false, "reason": "run_authority_absent"}
	var phase: Dictionary = lifecycle.call(&"phase")
	if String(phase.get("state", "")) != "active":
		return {"ok": false, "reason": "run_not_active"}
	var run_id := String(phase.get("run_id", ""))
	var started := int(phase.get("run_started_at_unix", 0))
	if run_id.is_empty() or started <= 0:
		return {"ok": false, "reason": "run_identity_incomplete"}
	var span := Time.get_unix_time_from_system() - float(started)
	if not is_finite(span) or span < 0.0:
		return {"ok": false, "reason": "run_clock_unavailable"}
	var phase_span := int(phase.get("seconds_elapsed", -1))
	var agrees := -1
	if phase_span >= 0:
		agrees = 1 if absi(int(span) - phase_span) <= 2 else 0
	return {"ok": true, "reason": "", "run_id": run_id, "stamp": span, "agrees": agrees,
		"run_started_at_unix": started}


func _in_interior() -> bool:
	if _authority == null or not is_instance_valid(_authority):
		return false
	if not _authority.has_method(&"inside_site"):
		return false
	return not String(_authority.call(&"inside_site")).is_empty()


func _draw() -> void:
	if not _marks or store == null:
		return
	for record: Dictionary in live_traces(MARK_LIMIT):
		var at: Vector2 = record.get("position", Vector2.ZERO) - global_position
		# Debug presentation only: a small mark under the body, never gameplay
		# collision and never final art. A surface change is shown by tint.
		var tint := Color(0.72, 0.62, 0.42, 0.45)
		if String(record.get("surface", "shallow")).contains("shallow"):
			tint = Color(0.38, 0.52, 0.64, 0.45)
		draw_circle(at + Vector2(0, 5), 1.6, tint)
		draw_circle(at + Vector2(3, 7), 1.3, tint)
