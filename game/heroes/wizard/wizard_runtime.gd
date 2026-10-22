class_name WizardRuntime
extends Node

## Runtime authority for Wizard's Hand kit and Reserve Soul loop. Data remains
## on HeroDefinition; this component owns only transient Shades, points, chain
## ledger, icons and presentation nodes.

const WIZARD_ID := &"wizard_hero"
const STAFF_ID := &"wizard_staff"
const COMBAT_DAMAGE := preload("res://game/combat/combat_damage.gd")
const CONTROL_LOCK := preload("res://game/heroes/wizard/wizard_control_lock.gd")
const RAISED_ENEMY := preload("res://game/heroes/ultimate/wizard_summoned_enemy.gd")
const DARK_VFX_1: Texture2D = preload("res://assets/library/downloaded/dark_vfx_01_02/Dark VFX 1/Dark VFX 1 (40x32).png")
const DARK_VFX_2: Texture2D = preload("res://assets/library/downloaded/dark_vfx_01_02/Dark VFX 2/Dark VFX 2 (48x64).png")

signal state_changed(snapshot: Dictionary)

var _player: Node2D
var _manager: HeroSoulManager
var _shades: Array[Dictionary] = []
var _points: Array[Dictionary] = []
var _frenzy: Dictionary = {}
var _rmb_chain_left := 0
var _rmb_internal_left := 0.0
var _rmb_window_left := 0.0
var _rmb_ledger: Dictionary = {}
var _soul_icons := 0
var _soul_icon_visuals: Array[AnimatedSprite2D] = []
var _soul_anchor: Dictionary = {}
var _return_dash_pending := false
var _support_avatar: Node2D
var _support_icon_count := 0
var _departure_nodes: Array[Node] = []
var _last_pointer := Vector2.ZERO
var _raise_defeated_active := false
var _raised_allies: Array[WizardSummonedEnemy] = []
var _raised_kill_ledger: Dictionary = {}

# Wizard is particle-heavy by design.  Cache the immutable asset frame grids so
# a cast never allocates dozens of AtlasTexture resources on the combat frame.
var _dark_vfx_1_cache: Dictionary = {}
var _dark_vfx_2_cache: SpriteFrames
var _dark_vfx_1_full_frames: SpriteFrames
var _burst_pool: Array[AnimatedSprite2D] = []
var _active_bursts: Array[Dictionary] = []


func configure(player: Node2D, manager: HeroSoulManager) -> void:
	_player = player
	_manager = manager
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"enemy_killed") and not events.enemy_killed.is_connected(_on_enemy_killed):
		events.enemy_killed.connect(_on_enemy_killed)
	if events != null and events.has_signal(&"player_died") and not events.player_died.is_connected(_on_player_died):
		events.player_died.connect(_on_player_died)
	if events != null and events.has_signal(&"map_changed") and not events.map_changed.is_connected(_on_map_changed):
		events.map_changed.connect(_on_map_changed)
	set_process(true)
	# Knight configures this runtime from its own _ready(). Defer node-pool
	# creation until the parent has finished entering the tree.
	_prewarm_visuals.call_deferred()
	_emit_state()


func _prewarm_visuals() -> void:
	# Keep every visible effect exactly as rich as before, but move immutable
	# texture/frame/node construction off the first LMB/RMB input frame.
	_dark_vfx_1_frames(0, 0, 10, 12.0, true)
	_dark_vfx_1_full_sequence()
	_dark_vfx_2_frames()
	for _index in 6:
		_acquire_burst()


func _process(delta: float) -> void:
	if _player == null:
		return
	_tick_shades(delta)
	_tick_points(delta)
	_tick_frenzy(delta)
	_tick_rmb(delta)
	_tick_soul_anchor(delta)
	_tick_soul_icons()
	_tick_bursts(delta)


func on_team_changed(_active: HeroDefinition, _reserve: HeroDefinition) -> void:
	if not _is_active_wizard():
		_rmb_chain_left = 0
		_rmb_internal_left = 0.0
		_rmb_window_left = 0.0
		_rmb_ledger.clear()
	if not _is_reserve_wizard():
		_clear_soul_icons()
		_clear_soul_anchor()
	_emit_state()


func is_active_wizard() -> bool:
	return _is_active_wizard()


func is_reserve_wizard() -> bool:
	return _is_reserve_wizard()


func has_dark_passage_chain() -> bool:
	return _rmb_chain_left > 0 and _rmb_window_left > 0.0


func start_wandering_shade(direction: Vector2) -> bool:
	if not _is_active_wizard() or _player == null:
		return false
	var hero := _active_wizard()
	if hero == null:
		return false
	var resolved := direction.normalized()
	if resolved.is_zero_approx():
		resolved = Vector2.RIGHT
	while _shades.size() >= hero.wizard_shade_max_active:
		_despawn_shade(0, true)
	var visual := AnimatedSprite2D.new()
	visual.name = "WanderingShade"
	visual.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	visual.sprite_frames = _dark_vfx_1_frames(0, 0, 10, 12.0, true)
	visual.animation = &"effect"
	visual.play()
	# Dark VFX 1 is 40 px wide, so this maps its visible diameter directly to
	# the travelling Shade's collision radius (2 × radius) instead of using a
	# cosmetic scale unrelated to the hit check.
	visual.scale = Vector2.ONE * _shade_visual_scale(hero)
	visual.modulate = Color(0.66, 0.16, 1.0, 0.82)
	visual.z_index = 8
	_effect_root().add_child(visual)
	# All live Wizard effects use their gameplay point as the scene position.
	# The sprite sheets already include their own visual silhouette; adding a
	# second arbitrary Y lift made shade/point VFX look detached from collision.
	var start := _player.global_position + resolved * 12.0
	visual.global_position = start
	_shades.append({
		"position": start,
		"velocity": resolved * hero.wizard_shade_speed,
		"remaining": hero.wizard_shade_lifetime_seconds,
		"visual": visual,
	})
	_spawn_burst(start, 0.38, Color(0.45, 0.08, 0.74, 0.42), 0.22)
	_emit_state()
	return true


func can_start_dark_passage(pointer: Vector2) -> bool:
	if not _is_active_wizard() or _player == null:
		return false
	if _rmb_chain_left > 0:
		return _rmb_internal_left <= 0.0 and _rmb_window_left > 0.0 and _choose_point(pointer) >= 0
	return _choose_point(pointer) >= 0


func start_dark_passage(pointer: Vector2) -> Dictionary:
	if not can_start_dark_passage(pointer):
		return {}
	_last_pointer = pointer
	var hero := _active_wizard()
	var starts_chain := _rmb_chain_left <= 0
	if starts_chain:
		_rmb_chain_left = hero.wizard_rmb_chain_stacks
		_rmb_ledger.clear()
	var point_index := _choose_point(pointer)
	if point_index < 0:
		return {}
	var point: Dictionary = _points[point_index]
	_points.remove_at(point_index)
	_free_marker(point)
	var destination := point.get("position", _player.global_position) as Vector2
	var origin := _player.global_position
	_player.global_position = destination
	_rmb_chain_left = maxi(0, _rmb_chain_left - 1)
	_rmb_internal_left = hero.wizard_rmb_internal_cooldown_seconds
	_rmb_window_left = hero.wizard_rmb_window_seconds if _rmb_chain_left > 0 else 0.0
	_resolve_passage_explosion(destination)
	# Dark VFX 2 is 48 px wide, so radius/24 maps its visible diameter to the
	# 2×radius gameplay circle instead of leaving the new 96-radius hitbox hidden.
	var passage_scale := maxf(1.0, hero.wizard_rmb_radius / 24.0)
	_spawn_burst(origin, passage_scale * 0.72, Color(0.20, 0.04, 0.42, 0.76), 0.36)
	_spawn_burst(destination, passage_scale, Color(0.60, 0.15, 0.92, 0.96), 0.68)
	_emit_state()
	return {"started_chain": starts_chain, "destination": destination, "remaining_stacks": _rmb_chain_left}


func activate_raise_defeated() -> bool:
	if not _is_active_wizard() or _player == null or _raise_defeated_active:
		return false
	_raise_defeated_active = true
	_raised_kill_ledger.clear()
	_spawn_burst(_player.global_position, 1.25, Color(0.72, 0.18, 1.0, 0.94), 0.72)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"toast_requested"):
		events.emit_signal(
			&"toast_requested",
			"TRIỆU HỒI  •  KẺ ĐỊCH BỊ HẠ SẼ TRỞ LẠI PHỤC VỤ WIZARD"
		)
	_emit_state(&"raise_defeated_activated")
	return true


func on_dash_started(origin: Vector2, _direction: Vector2) -> void:
	if _return_dash_pending:
		return
	if _is_active_wizard():
		var hero := _active_wizard()
		if hero != null:
			_remove_false_trail()
			_add_point(origin, null, hero.wizard_false_trail_lifetime_seconds, true)
	elif _is_reserve_wizard() and _soul_anchor.is_empty() and _soul_icons > 0 and _manager != null \
			and _manager.state == HeroSoulManager.RelayState.IDLE:
		_create_soul_anchor(origin)
	_emit_state()


func should_override_next_dash() -> bool:
	return _is_reserve_wizard() and not _soul_anchor.is_empty() and _anchor_is_valid()


func begin_soul_return(origin: Vector2) -> Vector2:
	if not should_override_next_dash() or _player == null:
		return origin
	_return_dash_pending = true
	var destination := _soul_anchor.get("position", origin) as Vector2
	_clear_soul_anchor()
	_player.global_position = destination
	_player.velocity = Vector2.ZERO
	var icon_count := _soul_icons
	_clear_soul_icons()
	if icon_count > 0 and _manager != null:
		_support_icon_count = icon_count
		_manager.begin_wizard_soul_return_opportunity(origin, _reserve_wizard().wizard_soul_summon_duration_seconds, icon_count)
	_spawn_burst(destination, 0.70, Color(0.32, 0.06, 0.64, 0.68), 0.32)
	_emit_state()
	return destination


func finish_return_dash() -> void:
	_return_dash_pending = false


func begin_soul_summon(world_position: Vector2, icon_count: int, duration: float) -> Vector2:
	_finish_support_avatar()
	_support_icon_count = clampi(icon_count, 0, _reserve_wizard().wizard_soul_icon_max if _reserve_wizard() != null else 5)
	var avatar := AnimatedSprite2D.new()
	avatar.name = "WizardSoulAvatar"
	avatar.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var wizard_library := load("res://game/characters/knight/wizard_animation_library.gd")
	if wizard_library != null:
		avatar.sprite_frames = wizard_library.build()
	avatar.animation = &"wizard_passage"
	avatar.play()
	avatar.global_position = world_position + Vector2(0.0, -33.0)
	avatar.scale = Vector2.ONE * 0.48
	avatar.modulate = Color(0.76, 0.42, 1.0, 0.92)
	avatar.z_index = 10
	_effect_root().add_child(avatar)
	_support_avatar = avatar
	_resolve_soul_summon_explosion(world_position, _support_icon_count)
	_spawn_burst(world_position, 1.18, Color(0.68, 0.18, 1.0, 0.94), 0.55)
	if duration > 0.0:
		get_tree().create_timer(duration, false).timeout.connect(_finish_support_avatar, CONNECT_ONE_SHOT)
	_emit_state()
	return world_position


func finish_soul_support() -> void:
	_finish_support_avatar()
	_support_icon_count = 0
	_emit_state()


func resolve_soul_takeover_destination(fallback: Vector2) -> Vector2:
	if is_instance_valid(_support_avatar):
		return _support_avatar.global_position + Vector2(0.0, 33.0)
	return fallback


func begin_departure(origin: Vector2, hero: HeroDefinition) -> void:
	if hero == null or hero.hero_id != WIZARD_ID:
		return
	var consumed := 0
	var candidate_indices: Array[int] = []
	for index: int in _points.size():
		var point := _points[index]
		var position := point.get("position", origin) as Vector2
		if position.distance_to(origin) <= hero.wizard_departure_point_radius:
			candidate_indices.append(index)
	candidate_indices.sort_custom(func(a: int, b: int) -> bool:
		return ( _points[a].get("position", origin) as Vector2 ).distance_squared_to(origin) < ( _points[b].get("position", origin) as Vector2 ).distance_squared_to(origin)
	)
	for index in candidate_indices.slice(0, 5):
		if index < _points.size():
			var point := _points[index]
			point["departure_consumed"] = true
			consumed += 1
	for point: Dictionary in _points:
		if bool(point.get("departure_consumed", false)):
			_free_marker(point)
	_points = _points.filter(func(point: Dictionary) -> bool: return not bool(point.get("departure_consumed", false)))
	var false_body := Node2D.new()
	false_body.name = "WizardGraveCollapse"
	false_body.global_position = origin
	_effect_root().add_child(false_body)
	_departure_nodes.append(false_body)
	var retargeted: Array[Node] = []
	for enemy: Node in _alive_enemies_in_radius(origin, hero.wizard_departure_point_radius, 0):
		# Grave Collapse hijacks only enemies that were actually marked by a
		# Wandering Shade; it is a payoff for setting up the network, not a free
		# full-screen taunt whenever Wizard relays out.
		if _frenzy.has(enemy.get_instance_id()) and enemy.has_method(&"set_priority_target"):
			enemy.call(&"set_priority_target", false_body)
			retargeted.append(enemy)
	_spawn_burst(origin, 0.92, Color(0.40, 0.06, 0.72, 0.84), hero.departure_duration_seconds)
	get_tree().create_timer(hero.departure_duration_seconds, false).timeout.connect(
		_resolve_departure.bind(origin, consumed, hero, false_body, retargeted), CONNECT_ONE_SHOT
	)
	_emit_state()


func clear_all(reason: StringName = &"cleanup") -> void:
	_clear_shades(false)
	_clear_points(false)
	_clear_frenzy()
	_clear_soul_icons()
	_clear_soul_anchor()
	_finish_support_avatar()
	_rmb_chain_left = 0
	_rmb_internal_left = 0.0
	_rmb_window_left = 0.0
	_rmb_ledger.clear()
	_return_dash_pending = false
	for node: Node in _departure_nodes:
		if is_instance_valid(node):
			node.queue_free()
	_departure_nodes.clear()
	_clear_raised_allies()
	_raise_defeated_active = false
	_raised_kill_ledger.clear()
	_emit_state(reason)


func get_state_snapshot() -> Dictionary:
	return {
		"active": _is_active_wizard(),
		"reserve": _is_reserve_wizard(),
		"shade_count": _shades.size(),
		"dark_point_count": _points.size(),
		"rmb_stacks_left": _rmb_chain_left,
		"rmb_internal_left": _rmb_internal_left,
		"rmb_window_left": _rmb_window_left,
		"soul_icons": _soul_icons,
		"soul_icon_max": _reserve_wizard().wizard_soul_icon_max if _reserve_wizard() != null else 5,
		"soul_anchor_seconds": float(_soul_anchor.get("remaining", 0.0)),
		"soul_anchor_active": not _soul_anchor.is_empty(),
		"raise_defeated_active": _raise_defeated_active,
		"raised_ally_count": _live_raised_ally_count(),
	}


func get_pending_support_icon_count() -> int:
	return _support_icon_count


func _tick_shades(delta: float) -> void:
	for index in range(_shades.size() - 1, -1, -1):
		var shade: Dictionary = _shades[index]
		var remaining := float(shade.get("remaining", 0.0)) - delta
		if remaining <= 0.0:
			_despawn_shade(index, true)
			continue
		var position := shade.get("position", Vector2.ZERO) as Vector2
		var velocity := shade.get("velocity", Vector2.RIGHT) as Vector2
		var next_position := position + velocity * delta
		var query := PhysicsRayQueryParameters2D.create(position, next_position, 1)
		query.exclude = [_player.get_rid()]
		var hit := _player.get_world_2d().direct_space_state.intersect_ray(query)
		if not hit.is_empty():
			var normal := hit.get("normal", Vector2.ZERO) as Vector2
			if not normal.is_zero_approx():
				# A bounce is not a despawn.  Let this *same* Dark VFX finish its
				# authored 1..16 sequence, then resume the travelling 1..10 loop.
				# Spawning a second finish sprite here made the ghost appear doubled
				# and caused the visible loop to cut back to frame 1 too early.
				_begin_shade_bounce_finish(shade)
				velocity = velocity.bounce(normal)
				next_position = (hit.get("position", position) as Vector2) + normal * 1.5
		shade["position"] = next_position
		shade["velocity"] = velocity
		shade["remaining"] = remaining
		var visual := shade.get("visual") as AnimatedSprite2D
		if is_instance_valid(visual):
			visual.global_position = next_position
			visual.rotation = velocity.angle()
			# Preserve trajectory rotation, but mirror vertically when travelling
			# left so the VFX's authored upper edge always remains world-up.
			visual.flip_v = velocity.x < 0.0
			if bool(shade.get("bounce_finish_active", false)) and not visual.is_playing():
				# Wall-contact completion reached frame 16: return to the authored
				# 1..10 travel loop on the existing ghost, with no visual pop.
				visual.sprite_frames = _dark_vfx_1_frames(0, 0, 10, 12.0, true)
				visual.animation = &"effect"
				visual.frame = 0
				visual.play()
				shade["bounce_finish_active"] = false
		var hero := _active_wizard()
		var consumed := false
		if hero != null:
			for enemy: Node in _alive_enemies_in_radius(next_position, hero.wizard_shade_hit_radius, 1):
				_resolve_shade_explosion(next_position)
				_despawn_shade(index, false)
				consumed = true
				break
		# Removing this entry shifts the array.  Do not write the stale
		# dictionary back over the next Shade in the same frame.
		if consumed:
			continue
		if index < _shades.size():
			_shades[index] = shade


func _tick_points(delta: float) -> void:
	for index in range(_points.size() - 1, -1, -1):
		var point: Dictionary = _points[index]
		var target := point.get("target") as Node2D
		if target != null:
			if not COMBAT_DAMAGE.is_alive(target):
				_remove_point(index)
				continue
			point["position"] = target.global_position
		var remaining := float(point.get("remaining", 0.0)) - delta
		if remaining <= 0.0:
			_remove_point(index)
			continue
		point["remaining"] = remaining
		_update_marker(point)
		_points[index] = point


func _tick_frenzy(delta: float) -> void:
	for instance_key: Variant in _frenzy.keys():
		var state: Dictionary = _frenzy[instance_key]
		var target := state.get("target") as Node
		var remaining := float(state.get("remaining", 0.0)) - delta
		if remaining > 0.0 and is_instance_valid(target) and COMBAT_DAMAGE.is_alive(target):
			state["remaining"] = remaining
			var active_visual := state.get("visual") as Node2D
			if is_instance_valid(active_visual) and target is Node2D:
				active_visual.global_position = (target as Node2D).global_position + Vector2(0.0, -22.0)
			_frenzy[instance_key] = state
			continue
		if is_instance_valid(target) and target.has_method(&"set_priority_target"):
			target.call(&"set_priority_target", null)
		var visual := state.get("visual") as Node
		if is_instance_valid(visual):
			visual.queue_free()
		_frenzy.erase(instance_key)


func _tick_rmb(delta: float) -> void:
	if _rmb_chain_left <= 0:
		return
	_rmb_internal_left = maxf(0.0, _rmb_internal_left - delta)
	_rmb_window_left = maxf(0.0, _rmb_window_left - delta)
	if _rmb_window_left <= 0.0:
		_rmb_chain_left = 0
		_rmb_internal_left = 0.0
		_rmb_ledger.clear()
		_emit_state()


func _tick_soul_anchor(delta: float) -> void:
	if _soul_anchor.is_empty():
		return
	var remaining := float(_soul_anchor.get("remaining", 0.0)) - delta
	if remaining <= 0.0:
		_clear_soul_anchor()
		_emit_state()
		return
	_soul_anchor["remaining"] = remaining
	var marker := _soul_anchor.get("marker") as Sprite2D
	if is_instance_valid(marker):
		var base := 0.33 + minf(0.24, remaining * 0.03)
		marker.scale = Vector2.ONE * base
		marker.modulate.a = 0.52 + sin(remaining * 8.0) * 0.18


func _tick_soul_icons() -> void:
	for index in _soul_icon_visuals.size():
		var icon := _soul_icon_visuals[index]
		if not is_instance_valid(icon) or _player == null:
			continue
		var angle := Time.get_ticks_msec() * 0.003 + TAU * float(index) / maxf(1.0, float(_soul_icon_visuals.size()))
		icon.global_position = _player.global_position + Vector2(0.0, -26.0) + Vector2(cos(angle), sin(angle)) * 15.0


func _resolve_shade_explosion(position: Vector2) -> void:
	var hero := _active_wizard()
	if hero == null:
		return
	var targets := _alive_enemies_in_radius(position, hero.wizard_shade_explosion_radius, hero.wizard_shade_target_cap)
	var authored := float(hero.base_damage) * hero.wizard_shade_damage_ratio
	var damage := _scaled_damage(WIZARD_ID, &"normal_attack", authored)
	for target: Node in targets:
		COMBAT_DAMAGE.apply_confirmed(target, damage, position, STAFF_ID, {"hero_id": WIZARD_ID, "action_track": &"normal_attack", "cue_id": &"wizard_shade"})
		COMBAT_DAMAGE.apply_stagger(target, 1.0, {"source": &"wizard_shade"})
		if target is Node2D:
			_add_point((target as Node2D).global_position, target as Node2D, hero.wizard_dark_point_lifetime_seconds, false)
		_apply_frenzy(target, hero.wizard_frenzy_seconds)
	# Dark VFX 2 is 48 px wide.  radius / 24 gives its full visible diameter the
	# same world size as the actual radial damage area.
	_spawn_burst(
		position,
		maxf(0.35, hero.wizard_shade_explosion_radius / 24.0),
		Color(0.46, 0.10, 0.78, 0.70),
		0.34,
	)


func _resolve_passage_explosion(position: Vector2) -> void:
	var hero := _active_wizard()
	if hero == null:
		return
	var targets := _alive_enemies_in_radius(position, hero.wizard_rmb_radius, hero.wizard_rmb_target_cap)
	var density := mini(targets.size(), 6)
	for target: Node in targets:
		var count := int(_rmb_ledger.get(target.get_instance_id(), 0)) + 1
		_rmb_ledger[target.get_instance_id()] = count
		var effective_density := density
		if target.is_in_group(&"boss_enemies") or target.is_in_group(&"bosses"):
			effective_density = mini(effective_density, 3)
		var ratio := _ratio_at(hero.wizard_rmb_density_damage_ratios, effective_density)
		if count == 2:
			ratio *= hero.wizard_rmb_repeat_multiplier
		var damage := _scaled_damage(WIZARD_ID, &"active_skill", float(hero.base_damage) * ratio)
		COMBAT_DAMAGE.apply_confirmed(target, damage, position, STAFF_ID, {"hero_id": WIZARD_ID, "action_track": &"active_skill", "cue_id": &"wizard_passage", "density": density, "exposure": count})
		COMBAT_DAMAGE.apply_stagger(target, 12.0, {"source": &"wizard_passage", "density": density})
		if count == 2:
			_apply_repeat_control(target)


func _resolve_soul_summon_explosion(position: Vector2, icon_count: int) -> void:
	var hero := _reserve_wizard()
	if hero == null:
		hero = _active_wizard()
	if hero == null:
		return
	var ratio := _ratio_at(hero.wizard_soul_summon_damage_ratios, icon_count)
	var damage := _scaled_damage(WIZARD_ID, &"summon_skill", float(hero.base_damage) * ratio)
	for target: Node in _alive_enemies_in_radius(position, hero.wizard_rmb_radius, hero.wizard_rmb_target_cap):
		COMBAT_DAMAGE.apply_confirmed(target, damage, position, &"wizard_soul", {"hero_id": WIZARD_ID, "action_track": &"summon_skill", "cue_id": &"wizard_soul_reversal", "icons": icon_count})
		COMBAT_DAMAGE.apply_stagger(target, 12.0, {"source": &"wizard_soul_reversal"})


func _resolve_departure(
		origin: Vector2,
		consumed: int,
		hero: HeroDefinition,
		false_body: Node,
		retargeted: Array[Node],
) -> void:
	if not is_instance_valid(false_body) or false_body.is_queued_for_deletion():
		return
	for enemy: Node in retargeted:
		if not is_instance_valid(enemy) or not enemy.has_method(&"set_priority_target"):
			continue
		enemy.call(&"set_priority_target", _player if _frenzy.has(enemy.get_instance_id()) else null)
	false_body.queue_free()
	_departure_nodes.erase(false_body)
	var ratio := _ratio_at(hero.wizard_departure_damage_ratios, consumed)
	var damage := _scaled_damage(WIZARD_ID, &"departure_skill", float(hero.base_damage) * ratio)
	for target: Node in _alive_enemies_in_radius(origin, hero.wizard_departure_radius, hero.wizard_rmb_target_cap):
		COMBAT_DAMAGE.apply_confirmed(target, damage, origin, &"wizard_soul", {"hero_id": WIZARD_ID, "action_track": &"departure_skill", "cue_id": &"wizard_grave_collapse", "points": consumed})
		COMBAT_DAMAGE.apply_stagger(target, 16.0, {"source": &"wizard_grave_collapse"})
		if not target.is_in_group(&"boss_enemies") and not target.is_in_group(&"bosses"):
			_apply_control_lock(target, 1.25)
	_spawn_burst(
		origin,
		maxf(0.35, hero.wizard_departure_radius / 24.0),
		Color(0.58, 0.10, 0.90, 0.96),
		0.56,
	)
	_emit_state()


func _choose_point(pointer: Vector2) -> int:
	if _points.is_empty() or _player == null:
		return -1
	var hero := _active_wizard()
	if hero == null:
		return -1
	var stack_index := hero.wizard_rmb_chain_stacks - _rmb_chain_left + 1
	var defensive := stack_index == 2 and _health_ratio() <= 0.5
	var selected := -1
	var selected_density := 0
	for index in _points.size():
		var point: Dictionary = _points[index]
		var position := point.get("position", _player.global_position) as Vector2
		var density := mini(_alive_enemies_in_radius(position, hero.wizard_rmb_radius, hero.wizard_rmb_target_cap).size(), 6)
		if selected < 0:
			selected = index
			selected_density = density
			continue
		var wins := density < selected_density if defensive else density > selected_density
		if density == selected_density:
			var candidate_distance := position.distance_squared_to(pointer)
			var current_position := _points[selected].get("position", _player.global_position) as Vector2
			var selected_distance := current_position.distance_squared_to(pointer)
			wins = candidate_distance < selected_distance
		if wins:
			selected = index
			selected_density = density
	return selected


func _create_soul_anchor(position: Vector2) -> void:
	var hero := _reserve_wizard()
	if hero == null or _soul_icons <= 0:
		return
	var spent := _soul_icons
	_clear_soul_icons()
	var marker := _create_marker(position, Color(0.70, 0.18, 1.0, 0.86), 0.44)
	_soul_anchor = {"position": position, "remaining": float(spent) * hero.wizard_soul_anchor_seconds_per_icon, "marker": marker, "icons": spent}
	_spawn_burst(position, 0.72, Color(0.54, 0.10, 0.90, 0.74), 0.30)


func _add_point(position: Vector2, target: Node2D, lifetime: float, false_trail: bool) -> void:
	var hero := _active_wizard()
	if hero == null:
		return
	while _points.size() >= hero.wizard_dark_point_maximum:
		_remove_point(0)
	var marker := _create_marker(position, Color(0.50, 0.12, 0.84, 0.82), 0.28 if false_trail else 0.34)
	_points.append({
		"position": position,
		"target": target,
		"remaining": lifetime,
		"false_trail": false_trail,
		"marker": marker,
		"base_scale": marker.scale,
	})


func _remove_false_trail() -> void:
	for index in range(_points.size() - 1, -1, -1):
		if bool(_points[index].get("false_trail", false)):
			_remove_point(index)


func _remove_point(index: int) -> void:
	if index < 0 or index >= _points.size():
		return
	var point: Dictionary = _points[index]
	_free_marker(point)
	_points.remove_at(index)


func _clear_points(show_burst: bool) -> void:
	for point: Dictionary in _points:
		if show_burst:
			_spawn_burst(point.get("position", Vector2.ZERO) as Vector2, 0.45, Color(0.42, 0.08, 0.75, 0.55), 0.20)
		_free_marker(point)
	_points.clear()


func _clear_shades(drop_points: bool) -> void:
	for index in range(_shades.size() - 1, -1, -1):
		_despawn_shade(index, drop_points)


func _despawn_shade(index: int, create_ground_point: bool) -> void:
	if index < 0 or index >= _shades.size():
		return
	var shade: Dictionary = _shades[index]
	var position := shade.get("position", Vector2.ZERO) as Vector2
	var visual := shade.get("visual") as AnimatedSprite2D
	if is_instance_valid(visual):
		var angle := visual.rotation
		var flip_vertical := visual.flip_v
		var current_frame := visual.frame
		visual.queue_free()
		_spawn_shade_finish(position, current_frame, angle, flip_vertical)
	_shades.remove_at(index)
	if create_ground_point and _is_active_wizard():
		var hero := _active_wizard()
		_add_point(position, null, hero.wizard_dark_point_lifetime_seconds, false)
		_spawn_burst(position, 0.48, Color(0.42, 0.08, 0.75, 0.54), 0.20)


func _spawn_shade_finish(position: Vector2, first_frame: int, angle: float, flip_vertical: bool) -> void:
	# Continue from the traveller's actual frame, then finish 1→16 exactly once.
	# This keeps the visual seamless even if it hit a wall mid-loop.
	var finish := AnimatedSprite2D.new()
	finish.name = "WanderingShadeFinish"
	finish.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	finish.sprite_frames = _dark_vfx_1_full_sequence()
	finish.animation = &"effect"
	finish.global_position = position
	var hero := _active_wizard()
	finish.scale = Vector2.ONE * (_shade_visual_scale(hero) if hero != null else 0.82)
	finish.modulate = Color(0.74, 0.34, 1.0, 0.96)
	finish.rotation = angle
	finish.flip_v = flip_vertical
	finish.z_index = 8
	_effect_root().add_child(finish)
	finish.frame = clampi(first_frame, 0, 15)
	finish.play()
	finish.animation_finished.connect(finish.queue_free, CONNECT_ONE_SHOT)


func _shade_frame(shade: Dictionary) -> int:
	var visual := shade.get("visual") as AnimatedSprite2D
	return visual.frame if is_instance_valid(visual) else 0


func _begin_shade_bounce_finish(shade: Dictionary) -> void:
	if bool(shade.get("bounce_finish_active", false)):
		return
	var visual := shade.get("visual") as AnimatedSprite2D
	if not is_instance_valid(visual):
		return
	# The full sequence has 16 frames.  Begin at the current travelling frame
	# so a collision always progresses through the remaining authored frames,
	# ending precisely on frame 16 before it loops back to travel frame 1.
	var current_frame := clampi(visual.frame, 0, 15)
	visual.sprite_frames = _dark_vfx_1_full_sequence()
	visual.animation = &"effect"
	visual.frame = current_frame
	visual.play()
	shade["bounce_finish_active"] = true


func _shade_visual_scale(hero: HeroDefinition) -> float:
	return maxf(0.35, hero.wizard_shade_hit_radius / 20.0) if hero != null else 0.82


func _apply_frenzy(target: Node, duration: float) -> void:
	if not is_instance_valid(target) or not target is Node2D or _player == null:
		return
	var key := target.get_instance_id()
	var state: Dictionary = _frenzy.get(key, {})
	state["target"] = target
	state["remaining"] = maxf(float(state.get("remaining", 0.0)), duration)
	if not state.has("visual"):
		var marker := _create_marker((target as Node2D).global_position + Vector2(0.0, -22.0), Color(0.92, 0.28, 1.0, 0.86), 0.18)
		state["visual"] = marker
	_frenzy[key] = state
	if target.has_method(&"set_priority_target"):
		target.call(&"set_priority_target", _player)


func _clear_frenzy() -> void:
	for state: Dictionary in _frenzy.values():
		var target := state.get("target") as Node
		if is_instance_valid(target) and target.has_method(&"set_priority_target"):
			target.call(&"set_priority_target", null)
		var visual := state.get("visual") as Node
		if is_instance_valid(visual):
			visual.queue_free()
	_frenzy.clear()


func _apply_repeat_control(target: Node) -> void:
	if target.is_in_group(&"boss_enemies") or target.is_in_group(&"bosses"):
		COMBAT_DAMAGE.apply_stagger(target, 18.0, {"source": &"wizard_repeat_boss"})
		return
	var duration := 0.35 if target.is_in_group(&"elite_enemies") else 0.65
	_apply_control_lock(target, duration)


func _apply_control_lock(target: Node, duration: float) -> void:
	if not is_instance_valid(target) or duration <= 0.0:
		return
	var existing := target.get_node_or_null("WizardControlLock") as WizardControlLock
	if existing == null:
		existing = CONTROL_LOCK.new() as WizardControlLock
		existing.name = "WizardControlLock"
		target.add_child(existing)
	existing.refresh(target, duration)


func _on_enemy_killed(enemy: Node, weapon_id: StringName) -> void:
	if _raise_defeated_active and _is_active_wizard():
		_queue_raise_defeated_enemy(enemy)
	if not _is_reserve_wizard() or _manager == null:
		return
	if weapon_id in [STAFF_ID, &"wizard_soul", WIZARD_ID]:
		return
	if _manager.state == HeroSoulManager.RelayState.SUMMONING:
		return
	var hero := _reserve_wizard()
	if hero == null:
		return
	_soul_icons = mini(hero.wizard_soul_icon_max, _soul_icons + 1)
	_sync_soul_icon_visuals()
	_emit_state()


func _on_player_died() -> void:
	clear_all(&"death")


func _on_map_changed(_source: String) -> void:
	_clear_raised_allies()
	_raise_defeated_active = false
	_raised_kill_ledger.clear()
	_emit_state(&"stage_changed")


func _queue_raise_defeated_enemy(enemy: Node) -> void:
	if not is_instance_valid(enemy) or _is_boss_enemy(enemy) \
			or enemy.is_in_group(&"wizard_summons"):
		return
	var enemy_id := enemy.get_instance_id()
	if _raised_kill_ledger.has(enemy_id):
		return
	var snapshot: Dictionary = RAISED_ENEMY.capture_snapshot(enemy)
	if snapshot.is_empty():
		return
	_raised_kill_ledger[enemy_id] = true
	call_deferred(&"_spawn_raised_enemy", snapshot)


func _spawn_raised_enemy(snapshot: Dictionary) -> void:
	if not _raise_defeated_active or not _is_active_wizard() or _player == null:
		return
	var ally := RAISED_ENEMY.new() as WizardSummonedEnemy
	_effect_root().add_child(ally)
	if not ally.setup(_player, snapshot):
		return
	_raised_allies.append(ally)
	_spawn_burst(ally.global_position, 0.82, Color(0.76, 0.20, 1.0, 0.92), 0.54)
	_emit_state(&"enemy_raised")


func _clear_raised_allies() -> void:
	for ally: WizardSummonedEnemy in _raised_allies:
		if is_instance_valid(ally):
			ally.queue_free()
	_raised_allies.clear()


func _live_raised_ally_count() -> int:
	var count := 0
	for ally: WizardSummonedEnemy in _raised_allies:
		if is_instance_valid(ally) and not ally.is_queued_for_deletion():
			count += 1
	return count


func _is_boss_enemy(enemy: Node) -> bool:
	if bool(enemy.get_meta(&"is_boss_enemy", false)):
		return true
	for group: StringName in [&"boss_enemies", &"bosses", &"boss", &"minibosses"]:
		if enemy.is_in_group(group):
			return true
	return false


func _sync_soul_icon_visuals() -> void:
	while _soul_icon_visuals.size() > _soul_icons:
		var removed: AnimatedSprite2D = _soul_icon_visuals.pop_back()
		if is_instance_valid(removed):
			removed.queue_free()
	while _soul_icon_visuals.size() < _soul_icons:
		var icon := AnimatedSprite2D.new()
		icon.name = "WizardSoulIcon"
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon.sprite_frames = _dark_vfx_1_frames(0, 0, 10, 12.0, true)
		icon.animation = &"effect"
		icon.play()
		icon.modulate = Color(0.78, 0.26, 1.0, 0.94)
		icon.scale = Vector2.ONE * 0.34
		icon.z_index = 11
		_effect_root().add_child(icon)
		_soul_icon_visuals.append(icon)


func _clear_soul_icons() -> void:
	_soul_icons = 0
	for icon: AnimatedSprite2D in _soul_icon_visuals:
		if is_instance_valid(icon):
			icon.queue_free()
	_soul_icon_visuals.clear()


func _clear_soul_anchor() -> void:
	var marker := _soul_anchor.get("marker") as Node
	if is_instance_valid(marker):
		marker.queue_free()
	_soul_anchor.clear()


func _anchor_is_valid() -> bool:
	return not _soul_anchor.is_empty() and float(_soul_anchor.get("remaining", 0.0)) > 0.0


func _finish_support_avatar() -> void:
	if is_instance_valid(_support_avatar):
		_support_avatar.queue_free()
	_support_avatar = null


func _alive_enemies_in_radius(position: Vector2, radius: float, cap: int) -> Array[Node]:
	var ranked: Array[Dictionary] = []
	if get_tree() == null:
		return []
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not COMBAT_DAMAGE.is_alive(candidate):
			continue
		var candidate_2d := candidate as Node2D
		var distance := candidate_2d.global_position.distance_squared_to(position)
		if radius > 0.0 and distance > radius * radius:
			continue
		ranked.append({"node": candidate, "distance": distance})
	ranked.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.distance) < float(b.distance))
	var targets: Array[Node] = []
	for record: Dictionary in ranked:
		if cap > 0 and targets.size() >= cap:
			break
		targets.append(record.node as Node)
	return targets


func _scaled_damage(hero_id: StringName, track: StringName, authored: float) -> int:
	if _player != null and _player.has_method(&"scale_hero_action_damage"):
		return int(_player.call(&"scale_hero_action_damage", hero_id, track, authored))
	return maxi(1, roundi(authored))


func _ratio_at(ratios: PackedFloat32Array, index: int) -> float:
	if ratios.is_empty():
		return 0.0
	return float(ratios[clampi(index, 0, ratios.size() - 1)])


func _health_ratio() -> float:
	if _player == null:
		return 1.0
	var health := float(_player.get("health"))
	var maximum := maxf(1.0, float(_player.get("max_health")))
	return clampf(health / maximum, 0.0, 1.0)


func _create_marker(position: Vector2, color: Color, scale_value: float) -> AnimatedSprite2D:
	# Dark Points must read as part of Wizard's kit, not as a generic generated
	# circle.  This is a real frame animation from the supplied Dark VFX sheet.
	var marker := AnimatedSprite2D.new()
	marker.name = "WizardDarkPoint"
	marker.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	marker.sprite_frames = _dark_vfx_1_frames(0, 0, 10, 12.0, true)
	marker.animation = &"effect"
	marker.play()
	marker.global_position = position
	marker.scale = Vector2.ONE * (scale_value * 1.55)
	marker.modulate = color
	marker.z_index = 6
	_effect_root().add_child(marker)
	return marker


func _update_marker(point: Dictionary) -> void:
	var marker := point.get("marker") as Node2D
	if not is_instance_valid(marker):
		return
	marker.global_position = point.get("position", marker.global_position) as Vector2
	var pulse := 0.92 + sin(float(point.get("remaining", 0.0)) * 7.0) * 0.10
	marker.scale = point.get("base_scale", marker.scale) as Vector2 * pulse


func _free_marker(point: Dictionary) -> void:
	var marker := point.get("marker") as Node
	if is_instance_valid(marker):
		marker.queue_free()


func _spawn_burst(position: Vector2, scale_value: float, color: Color, lifetime: float) -> void:
	if _player == null:
		return
	var burst := _acquire_burst()
	if burst == null:
		return
	burst.global_position = position
	burst.scale = Vector2.ONE * scale_value
	burst.modulate = color
	burst.z_index = 9
	burst.rotation = 0.0
	burst.frame = 0
	burst.visible = true
	burst.play(&"effect")
	# Preserve the entire authored animation; formerly the short timers cut it
	# off and allocated a SceneTreeTimer on every hit.
	_active_bursts.append({"node": burst, "remaining": maxf(lifetime, 16.0 / 24.0)})


func _acquire_burst() -> AnimatedSprite2D:
	for burst: AnimatedSprite2D in _burst_pool:
		if is_instance_valid(burst) and not burst.visible:
			return burst
	var burst := AnimatedSprite2D.new()
	burst.name = "WizardDarkBurst"
	burst.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	burst.sprite_frames = _dark_vfx_2_frames()
	burst.animation = &"effect"
	burst.visible = false
	burst.z_index = 9
	_effect_root().add_child(burst)
	_burst_pool.append(burst)
	return burst


func _tick_bursts(delta: float) -> void:
	for index in range(_active_bursts.size() - 1, -1, -1):
		var state: Dictionary = _active_bursts[index]
		var burst := state.get("node") as AnimatedSprite2D
		var remaining := float(state.get("remaining", 0.0)) - delta
		if not is_instance_valid(burst) or remaining <= 0.0:
			if is_instance_valid(burst):
				burst.stop()
				burst.hide()
			_active_bursts.remove_at(index)
			continue
		state["remaining"] = remaining
		_active_bursts[index] = state


func _dark_vfx_1_frames(row: int, first_frame: int, count: int, fps: float, looped: bool) -> SpriteFrames:
	var cache_key := "%d:%d:%d:%d:%s" % [row, first_frame, count, roundi(fps * 100.0), looped]
	var cached := _dark_vfx_1_cache.get(cache_key) as SpriteFrames
	if cached != null:
		return cached
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	frames.add_animation(&"effect")
	frames.set_animation_speed(&"effect", fps)
	frames.set_animation_loop(&"effect", looped)
	var texture := DARK_VFX_1
	for index in count:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(Vector2((first_frame + index) * 40, row * 32), Vector2(40, 32))
		frames.add_frame(&"effect", atlas)
	_dark_vfx_1_cache[cache_key] = frames
	return frames


func _dark_vfx_1_full_sequence() -> SpriteFrames:
	if _dark_vfx_1_full_frames != null:
		return _dark_vfx_1_full_frames
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	frames.add_animation(&"effect")
	frames.set_animation_speed(&"effect", 24.0)
	frames.set_animation_loop(&"effect", false)
	var texture := DARK_VFX_1
	for index in 16:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		var row := 0 if index < 10 else 1
		var column := index if index < 10 else index - 10
		atlas.region = Rect2(Vector2(column * 40, row * 32), Vector2(40, 32))
		frames.add_frame(&"effect", atlas)
	_dark_vfx_1_full_frames = frames
	return frames


func _dark_vfx_2_frames() -> SpriteFrames:
	if _dark_vfx_2_cache != null:
		return _dark_vfx_2_cache
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	frames.add_animation(&"effect")
	frames.set_animation_speed(&"effect", 24.0)
	frames.set_animation_loop(&"effect", false)
	var texture := DARK_VFX_2
	for index in 16:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(Vector2(index * 48, 0), Vector2(48, 64))
		frames.add_frame(&"effect", atlas)
	_dark_vfx_2_cache = frames
	return frames


func _effect_root() -> Node:
	if _player != null and _player.get_parent() != null:
		return _player.get_parent()
	return self


func _active_wizard() -> HeroDefinition:
	if _manager != null and _manager.active_hero != null and _manager.active_hero.hero_id == WIZARD_ID:
		return _manager.active_hero
	return null


func _reserve_wizard() -> HeroDefinition:
	if _manager != null and _manager.reserve_soul != null and _manager.reserve_soul.hero_id == WIZARD_ID:
		return _manager.reserve_soul
	return null


func _is_active_wizard() -> bool:
	return _active_wizard() != null


func _is_reserve_wizard() -> bool:
	return _reserve_wizard() != null


func _emit_state(reason: StringName = &"") -> void:
	var snapshot := get_state_snapshot()
	snapshot["reason"] = String(reason)
	state_changed.emit(snapshot)
	if not is_inside_tree():
		return
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"wizard_state_changed"):
		events.emit_signal(&"wizard_state_changed", snapshot)
