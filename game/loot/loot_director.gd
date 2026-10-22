extends Node

## Runtime authority for source rarity and physical loot. It watches authored
## enemies/chests without requiring every combat script to know inventory rules.

const RARITY_RULES := preload("res://game/loot/loot_rarity_rules.gd")
const COMPLEXITY_RULES := preload(
	"res://game/meta/progression/complexity_progression_rules.gd"
)
const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const LOOT_CATALOG := preload("res://game/loot/loot_catalog.gd")
const GUARANTEED_LOOT_PROFILES := preload("res://game/loot/guaranteed_loot_profiles.gd")
const RARITY_AURA := preload("res://game/loot/loot_rarity_aura.gd")
const ENEMY_RARITY_PRESENTATION := preload(
	"res://game/characters/enemies/enemy_rarity_presentation.gd"
)
const GROUND_LOOT_SCENE := preload("res://game/loot/ground_loot.tscn")
const VFX_CATALOG := preload("res://game/vfx/vfx_catalog.gd")

const META_RARITY := &"loot_rarity"
const META_CONFIGURED := &"loot_source_configured"
const META_DROP_PROCESSED := &"loot_drop_processed"
const META_TARGET_PAYLOAD := &"loot_target_payload"
const SOURCE_DISPLAY_NAMES := {
	"skeleton": "Kiếm Sĩ Xương",
	"skeleton_swordsman": "Kiếm Sĩ Xương",
	"bone_reaper": "Tử Thần Xương",
	"bone_reaper_captain": "Đội Trưởng Tử Thần",
	"blood_vampire": "Ma Cà Rồng Máu",
	"crimson_reaper": "Tử Thần Huyết Sắc",
	"vampire_castellan": "Vampire Castellan",
	"coven_wraith": "Coven Wraith",
	"venom_bound_wraith": "Venom-Bound Wraith",
	"spirit_leech": "Spirit Leech",
	"hexwing_familiar": "Hexwing Familiar",
	"axe_soul_boss": "Axe Pactbreaker",
	"wizard_hero_boss": "Wizard of the Foundry Heart",
}

var _rng := RandomNumberGenerator.new()
var _roll_serial := 0
var _focus_poll_left := 0.0
var _source_poll_left := 0.0
var _focused_loot: GroundLoot


func _ready() -> void:
	add_to_group(&"loot_director")
	_rng.randomize()
	get_tree().node_added.connect(_on_node_added)
	for enemy: Node in get_tree().get_nodes_in_group(&"enemies"):
		call_deferred(&"_inspect_world_node_id", enemy.get_instance_id())
	for chest: Node in get_tree().get_nodes_in_group(&"loot_chests"):
		call_deferred(&"_inspect_world_node_id", chest.get_instance_id())


func _process(delta: float) -> void:
	_focus_poll_left -= delta
	if _focus_poll_left <= 0.0:
		_focus_poll_left = 0.10
		_update_nearest_loot_focus()
	_source_poll_left -= delta
	if _source_poll_left <= 0.0:
		_source_poll_left = 0.40
		_reconcile_live_source_roles()


func set_seed_for_tests(seed: int) -> void:
	_rng.seed = seed
	_roll_serial = 0


func configure_world_source(source: Node, source_kind: StringName = &"") -> StringName:
	if not is_instance_valid(source):
		return &"normal"
	var resolved_kind := source_kind
	if resolved_kind.is_empty():
		resolved_kind = &"chest" if source.is_in_group(&"loot_chests") else &"enemy"
	var role := _enemy_role(source) if resolved_kind == &"enemy" else &"chest"
	var minimum := _minimum_rarity_for_role(role)
	if resolved_kind == &"enemy":
		var scaled_rarity := String(source.get_meta(&"enemy_rarity", "")).strip_edges()
		if not scaled_rarity.is_empty():
			minimum = _higher_rarity(minimum, scaled_rarity)
	elif resolved_kind == &"chest" and source.has_method(&"get_minimum_loot_rarity"):
		minimum = _higher_rarity(minimum, source.call(&"get_minimum_loot_rarity"))
	if source.has_meta(META_CONFIGURED):
		var configured_rarity := RARITY_RULES.normalize(
			source.get_meta(META_RARITY, &"normal")
		)
		if RARITY_RULES.rarity_index(configured_rarity) \
				>= RARITY_RULES.rarity_index(minimum):
			if resolved_kind == &"chest":
				# Family/jackpot presentation may have changed after initial spawn.
				_apply_source_rarity(source, configured_rarity, resolved_kind, role)
			if resolved_kind == &"enemy" and source.has_signal(&"died"):
				# Reconfiguration also repairs presentation if a runtime form swap or
				# late elite promotion replaced the sprite material/scale.
				ENEMY_RARITY_PRESENTATION.apply_to(source, configured_rarity)
				var existing_callback := _on_enemy_died
				if not source.is_connected(&"died", existing_callback):
					source.connect(&"died", existing_callback)
			return configured_rarity
	var override_value := "random"
	if resolved_kind == &"chest":
		override_value = String(source.get("rarity_override"))
	var rarity := (
		RARITY_RULES.normalize(override_value)
		if override_value != "random" and not override_value.is_empty()
		else RARITY_RULES.roll_world_rarity(
			_next_seed(),
			minimum,
			_difficulty_modifiers(),
			resolved_kind == &"chest"
		)
	)
	# Authored overrides may raise a chest floor, but may never undercut a
	# family/role floor (for example monster chests always start at Rare).
	rarity = _higher_rarity(rarity, minimum)
	var previous := RARITY_RULES.normalize(source.get_meta(META_RARITY, &"normal"))
	if source.has_meta(META_CONFIGURED):
		rarity = _higher_rarity(previous, rarity)
	_apply_source_rarity(source, rarity, resolved_kind, role)
	if resolved_kind == &"enemy" and source.has_signal(&"died"):
		var callback := _on_enemy_died
		if not source.is_connected(&"died", callback):
			source.connect(&"died", callback)
	return rarity


func spawn_chest_burst(chest: Node, forced_jackpot: Variant = null) -> Array[GroundLoot]:
	if not is_instance_valid(chest) or not chest is Node2D:
		return []
	var rarity := RARITY_RULES.normalize(chest.get_meta(META_RARITY, &"normal"))
	if not chest.has_meta(META_CONFIGURED):
		rarity = configure_world_source(chest, &"chest")
	var modifiers := _difficulty_modifiers()
	var jackpot := (
		bool(forced_jackpot)
		if forced_jackpot is bool
		else RARITY_RULES.is_jackpot(_next_seed(), &"chest", rarity, modifiers)
	)
	var count := 2 + floori(float(RARITY_RULES.rarity_index(rarity)) / 3.0)
	if jackpot:
		count += 3 + floori(float(RARITY_RULES.rarity_index(rarity)) / 2.0)
	var source_id := StringName(chest.get_meta(&"level_entity_id", chest.name))
	return _spawn_burst(
		chest as Node2D,
		&"chest",
		rarity,
		count,
		jackpot,
		source_id
	)


func get_world_source_payload(source: Node) -> Dictionary:
	if not is_instance_valid(source):
		return {}
	var stored: Variant = source.get_meta(META_TARGET_PAYLOAD, {})
	var result := (stored as Dictionary).duplicate(true) if stored is Dictionary else {}
	result["node"] = source
	return result


func get_focused_loot() -> GroundLoot:
	return _focused_loot if is_instance_valid(_focused_loot) else null


func _on_node_added(node: Node) -> void:
	# Passing a Node through the deferred queue can fail if a short-lived VFX is
	# freed before the call executes. Instance IDs resolve safely or become null.
	call_deferred(&"_inspect_world_node_id", node.get_instance_id())


func _inspect_world_node_id(instance_id: int) -> void:
	var instance := instance_from_id(instance_id)
	if instance is Node:
		_inspect_world_node(instance as Node)


func _inspect_world_node(node: Node) -> void:
	if not is_instance_valid(node):
		return
	if node.is_in_group(&"enemies") and node.has_signal(&"died"):
		configure_world_source(node, &"enemy")
	elif node.is_in_group(&"loot_chests"):
		configure_world_source(node, &"chest")


func _on_enemy_died(enemy: Node) -> void:
	if not is_instance_valid(enemy) or enemy.has_meta(META_DROP_PROCESSED) \
			or not enemy is Node2D:
		return
	enemy.set_meta(META_DROP_PROCESSED, true)
	var parent := enemy.get_parent()
	if parent == null:
		return
	var config_value: Variant = enemy.get_meta(&"level_entity_config", {})
	var request := {
		"parent_instance_id": parent.get_instance_id(),
		"global_position": (enemy as Node2D).global_position,
		"role": _enemy_role(enemy),
		"rarity": RARITY_RULES.normalize(enemy.get_meta(META_RARITY, &"normal")),
		"source_id": StringName(enemy.get_meta(
			&"level_entity_id",
			enemy.get_meta(&"runtime_enemy_id", enemy.name),
		)),
		"level_entity_config": (
			(config_value as Dictionary).duplicate(true)
			if config_value is Dictionary
			else {}
		),
	}
	# Enemy death can be emitted while PhysicsServer is flushing an overlap
	# query (notably when spikes land the killing blow). Adding GroundLoot's
	# Area2D in that callback produces an engine error. Snapshot the dying
	# source now, then create a plain proxy and all collision-bearing loot on the
	# next idle turn. This also survives enemies that queue_free immediately.
	call_deferred(&"_resolve_enemy_loot_request", request)


func _resolve_enemy_loot_request(request: Dictionary) -> void:
	var parent_value := instance_from_id(int(request.get("parent_instance_id", 0)))
	if not parent_value is Node or not is_instance_valid(parent_value):
		return
	var parent := parent_value as Node
	var source := Node2D.new()
	source.name = "DeferredLootSource"
	parent.add_child(source)
	source.global_position = request.get("global_position", Vector2.ZERO)
	source.set_meta(
		&"level_entity_config",
		(request.get("level_entity_config", {}) as Dictionary).duplicate(true),
	)

	var role := StringName(request.get("role", &"enemy"))
	# Guaranteed authored rewards are an additive core-loot profile. They use the
	# same GroundLoot launch, rarity presentation, magnet and Save transaction as
	# every other item; special level runtimes only observe the resolved pickup.
	_spawn_guaranteed_profile_drop(source)
	var rarity := RARITY_RULES.normalize(request.get("rarity", &"normal"))
	var role_floor := _minimum_rarity_for_role(role)
	rarity = _higher_rarity(rarity, role_floor)
	var modifiers := _difficulty_modifiers()
	var chance := RARITY_RULES.enemy_drop_chance(rarity, modifiers, role)
	var chance_rng := RandomNumberGenerator.new()
	chance_rng.seed = _next_seed()
	if chance_rng.randf() > chance:
		source.queue_free()
		return
	var source_kind := role if role in [&"boss", &"miniboss"] else &"enemy"
	var jackpot := RARITY_RULES.is_jackpot(
		_next_seed(),
		source_kind,
		rarity,
		modifiers
	)
	var count := 1
	if role == &"elite":
		count = 2
	elif role == &"miniboss":
		count = 2
	elif role == &"boss":
		count = 3
	if jackpot:
		count += 3 + floori(float(RARITY_RULES.rarity_index(rarity)) / 2.0)
	var source_id := StringName(request.get("source_id", &"enemy"))
	_spawn_burst(source, source_kind, rarity, count, jackpot, source_id, role)
	source.queue_free()


func _spawn_guaranteed_profile_drop(source: Node2D) -> GroundLoot:
	if not is_instance_valid(source):
		return null
	var config_value: Variant = source.get_meta(&"level_entity_config", {})
	if not config_value is Dictionary:
		return null
	var profile_id := StringName((config_value as Dictionary).get(
		"guaranteed_loot_profile",
		&"",
	))
	if profile_id.is_empty():
		return null
	var save_snapshot: Dictionary = {}
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_method(&"get_snapshot"):
		var snapshot_value: Variant = save_service.call(&"get_snapshot")
		if snapshot_value is Dictionary:
			save_snapshot = snapshot_value as Dictionary
	var session := get_node_or_null("/root/GameSession")
	var run_context := {
		"run_id": String(session.get("active_run_id")) if session != null else "",
		"difficulty": session.get("active_difficulty") if session != null else &"easy",
		"stage_level": int(session.get("active_stage_level")) if session != null else 5,
	}
	var payload: Dictionary = GUARANTEED_LOOT_PROFILES.build_payload(
		profile_id,
		run_context,
		save_snapshot,
	)
	if payload.is_empty() or not LOOT_CATALOG.is_valid_payload(payload):
		push_warning("Guaranteed loot profile '%s' produced no valid payload." % profile_id)
		return null
	var parent := source.get_parent()
	if parent == null:
		return null
	var loot := GROUND_LOOT_SCENE.instantiate() as GroundLoot
	if loot == null:
		return null
	if not loot.configure(payload):
		loot.free()
		return null
	var origin := source.global_position + Vector2(0.0, -8.0)
	var landing := source.global_position + Vector2(28.0, -5.0)
	_schedule_ground_loot(parent, loot, payload, origin, landing, 0.62, 46.0)
	return loot


func _spawn_burst(
		source: Node2D,
		source_kind: StringName,
		source_rarity: StringName,
	count: int,
	jackpot: bool,
	source_id: StringName,
	_drop_role: StringName = &""
) -> Array[GroundLoot]:
	var result: Array[GroundLoot] = []
	var parent := source.get_parent()
	if parent == null:
		return result
	var origin := source.global_position + Vector2(0.0, -7.0)
	var modifiers := _difficulty_modifiers()
	var availability := _loot_availability()
	var complexity_policy := COMPLEXITY_RULES.resolve_availability(availability)
	var safe_count := clampi(count, 1, 12)
	if jackpot:
		_play_jackpot_feedback(parent, origin, source_rarity, safe_count)
	for drop_index: int in safe_count:
		var drop_seed := _next_seed()
		var drop_rarity := RARITY_RULES.roll_drop_rarity(
			drop_seed,
			source_rarity,
			modifiers
		)
		if not complexity_policy.is_empty():
			drop_rarity = COMPLEXITY_RULES.cap_rarity(drop_rarity, complexity_policy)
		var item_level := _current_item_level()
		var payload: Dictionary = LOOT_CATALOG.build_payload(
			drop_seed,
			drop_rarity,
			item_level,
			source_kind,
			source_id,
			availability
		)
		if payload.is_empty():
			continue
		var loot := GROUND_LOOT_SCENE.instantiate() as GroundLoot
		if loot == null:
			continue
		if not loot.configure(payload):
			loot.free()
			continue
		var angle := -PI * 0.5 + TAU * float(drop_index) / float(safe_count)
		angle += float(posmod(drop_seed, 17) - 8) * 0.018
		var distance := 23.0 + float(drop_index % 3) * 8.0
		if jackpot:
			distance += 10.0
		var landing := source.global_position + Vector2.from_angle(angle) * distance
		_schedule_ground_loot(
			parent,
			loot,
			payload,
			origin,
			landing,
			0.42 + float(drop_index % 4) * 0.055,
			32.0 + float(drop_index % 3) * 7.0,
		)
		result.append(loot)
	return result


## Enemy death can be emitted while an Area2D overlap is still being flushed
## (for example when spikes land the killing blow). Build and configure the
## ordinary GroundLoot immediately, then attach its physics body on one shared
## deferred seam for enemies, bosses, and chests.
func _schedule_ground_loot(
		parent: Node,
		loot: GroundLoot,
		payload: Dictionary,
		origin: Vector2,
		landing: Vector2,
		duration: float,
		arc_height: float,
) -> void:
	call_deferred(
		&"_attach_ground_loot",
		parent.get_instance_id(),
		loot,
		payload.duplicate(true),
		origin,
		landing,
		duration,
		arc_height,
	)


## Used by the Field Codex before it removes the source entry from SaveService.
## The item is already a fully configured GroundLoot and is flagged for manual
## pickup, so it cannot magnet back to the player during this hand-off.
func spawn_player_drop(payload: Dictionary, player: Node2D) -> GroundLoot:
	if not is_instance_valid(player) or not LOOT_CATALOG.is_valid_payload(payload):
		return null
	var parent := player.get_parent()
	if parent == null or parent.is_queued_for_deletion():
		return null
	var loot := GROUND_LOOT_SCENE.instantiate() as GroundLoot
	if loot == null or not loot.configure(payload):
		if loot != null:
			loot.free()
		return null
	parent.add_child(loot)
	var phase := float(posmod(String(payload.get("loot_id", "")).hash(), 11)) * 0.23
	var origin := player.global_position + Vector2(0.0, -8.0)
	var landing := player.global_position + Vector2.from_angle(phase) * 30.0
	loot.launch_from(origin, landing, 0.30, 18.0)
	GameEvents.loot_spawned.emit(loot, payload.duplicate(true))
	return loot


func _attach_ground_loot(
		parent_instance_id: int,
		loot: GroundLoot,
		payload: Dictionary,
		origin: Vector2,
		landing: Vector2,
		duration: float,
		arc_height: float,
) -> void:
	if not is_instance_valid(loot):
		return
	var parent_instance := instance_from_id(parent_instance_id)
	if not parent_instance is Node or (parent_instance as Node).is_queued_for_deletion():
		loot.free()
		return
	(parent_instance as Node).add_child(loot)
	loot.launch_from(origin, landing, duration, arc_height)
	GameEvents.loot_spawned.emit(loot, payload)


func _play_jackpot_feedback(
		parent: Node,
		origin: Vector2,
		rarity: StringName,
		drop_count: int
) -> void:
	var tint := RARITY_PALETTE.color(rarity)
	for burst_index: int in 3:
		VFX_CATALOG.spawn(
			parent,
			&"world_sparkle",
			origin + Vector2.from_angle(TAU * float(burst_index) / 3.0) * 12.0,
			TAU * float(burst_index) / 3.0,
			1.25 + float(burst_index) * 0.22,
			tint,
			40 + burst_index
		)
	GameEvents.combat_cue_requested.emit(&"loot_jackpot", origin, {
		"rarity": rarity,
		"drop_count": drop_count,
	})
	GameEvents.toast_requested.emit("NỔ HŨ  •  %d VẬT PHẨM!" % drop_count)


func _update_nearest_loot_focus() -> void:
	var player := get_tree().get_first_node_in_group(&"player") as Node2D
	var nearest: GroundLoot
	var nearest_distance_squared := INF
	if is_instance_valid(player):
		for candidate: Node in get_tree().get_nodes_in_group(&"ground_loot"):
			var loot := candidate as GroundLoot
			if loot == null or not loot.can_interact(player):
				continue
			var distance_squared := player.global_position.distance_squared_to(loot.global_position)
			if distance_squared < nearest_distance_squared:
				nearest = loot
				nearest_distance_squared = distance_squared
	if nearest == _focused_loot and (nearest == null or is_instance_valid(nearest)):
		return
	_focused_loot = nearest
	if nearest == null:
		GameEvents.loot_focus_changed.emit(null, "", &"normal", false)
		return
	var payload := nearest.get_focus_payload()
	GameEvents.loot_focus_changed.emit(
		nearest,
		String(payload.get("display_name", "Vật phẩm")),
		RARITY_RULES.normalize(payload.get("rarity", &"normal")),
		bool(payload.get("can_pickup", false))
	)


func _reconcile_live_source_roles() -> void:
	for enemy: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not is_instance_valid(enemy) or enemy.has_meta(META_DROP_PROCESSED):
			continue
		var role := _enemy_role(enemy)
		var current := RARITY_RULES.normalize(enemy.get_meta(META_RARITY, &"normal"))
		var minimum := _minimum_rarity_for_role(role)
		var authored_rarity := String(enemy.get_meta(&"enemy_rarity", "")).strip_edges()
		if not authored_rarity.is_empty():
			minimum = _higher_rarity(minimum, authored_rarity)
		if RARITY_RULES.rarity_index(current) < RARITY_RULES.rarity_index(minimum):
			_apply_source_rarity(enemy, minimum, &"enemy", role)


func _apply_source_rarity(
		source: Node,
		rarity: StringName,
		source_kind: StringName,
		role: StringName
) -> void:
	source.set_meta(META_RARITY, rarity)
	source.set_meta(META_CONFIGURED, true)
	if source.has_method(&"set_loot_rarity"):
		source.call(&"set_loot_rarity", rarity)
	var display_name := _source_display_name(source)
	source.set_meta(META_TARGET_PAYLOAD, {
		"kind": source_kind,
		"role": role,
		"display_name": display_name,
		"rarity": rarity,
		"rarity_name": RARITY_PALETTE.display_name(rarity),
		"rarity_color": RARITY_PALETTE.color(rarity),
	})
	if source_kind == &"enemy":
		ENEMY_RARITY_PRESENTATION.apply_to(source, rarity)
		return
	var aura := source.get_node_or_null("LootRarityAura") as LootRarityAura
	if aura == null:
		aura = RARITY_AURA.new() as LootRarityAura
		source.add_child(aura)
	aura.position = Vector2(0.0, -15.0 if source_kind == &"chest" else -8.0)
	aura.configure(rarity, role in [&"boss", &"miniboss"])


func _source_display_name(source: Node) -> String:
	if source.has_method(&"get_display_name"):
		return String(source.call(&"get_display_name"))
	var metadata_name := String(source.get_meta(&"display_name", "")).strip_edges()
	if not metadata_name.is_empty():
		return metadata_name
	var source_id := String(source.get_meta(&"level_entity_type", ""))
	if source.has_method(&"get_archetype_id"):
		source_id = String(source.call(&"get_archetype_id"))
	if SOURCE_DISPLAY_NAMES.has(source_id):
		return String(SOURCE_DISPLAY_NAMES[source_id])
	return source.name.to_pascal_case()


func _enemy_role(enemy: Node) -> StringName:
	if enemy.is_in_group(&"bosses"):
		return &"boss"
	if enemy.is_in_group(&"minibosses"):
		return &"miniboss"
	if StringName(enemy.get_meta(&"loot_role", &"")) == &"elite" \
			or bool(enemy.get_meta(&"mutant", false)):
		return &"elite"
	if enemy.is_in_group(&"elite_enemies") or enemy.has_meta(&"elite_modifier_id"):
		return &"elite"
	return &"standard"


func _minimum_rarity_for_role(role: StringName) -> StringName:
	match role:
		&"boss":
			return &"epic"
		&"miniboss":
			return &"rare"
		&"elite":
			return &"magic"
	return &"normal"


func _higher_rarity(left: Variant, right: Variant) -> StringName:
	return RARITY_RULES.normalize(
		left
		if RARITY_RULES.rarity_index(left) >= RARITY_RULES.rarity_index(right)
		else right
	)


func _difficulty_modifiers() -> Dictionary:
	var session := get_node_or_null("/root/GameSession")
	if session != null and session.has_method(&"get_difficulty_modifiers"):
		var value: Variant = session.call(&"get_difficulty_modifiers")
		if value is Dictionary:
			return (value as Dictionary).duplicate(true)
	return {
		"luck": 1.0,
		"rare_drop_chance": 1.0,
		"rare_chest_chance": 1.0,
	}


func _current_item_level() -> int:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_method(&"get_player_progression_snapshot"):
		var snapshot: Variant = save_service.call(&"get_player_progression_snapshot")
		if snapshot is Dictionary:
			return clampi(int((snapshot as Dictionary).get("player_level", 1)), 1, 100)
	return 1


func _loot_availability() -> Dictionary:
	var stage_level := 1
	var session := get_node_or_null("/root/GameSession")
	if session != null:
		var stage_value: Variant = session.get("active_stage_level")
		if stage_value is int:
			stage_level = int(stage_value)
	var features := {}
	var heroes := {}
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_method(&"get_snapshot"):
		var snapshot: Variant = save_service.call(&"get_snapshot")
		if snapshot is Dictionary:
			var progression: Variant = (snapshot as Dictionary).get("progression", {})
			if progression is Dictionary:
				var feature_value: Variant = (progression as Dictionary).get("features", {})
				if feature_value is Dictionary:
					features = (feature_value as Dictionary).duplicate(true)
				var hero_value: Variant = (progression as Dictionary).get(
					"unlocked_heroes",
					{},
				)
				if hero_value is Dictionary:
					heroes = (hero_value as Dictionary).duplicate(true)
	return {
		"active_stage_level": stage_level,
		"feature_state": features,
		"complexity_policy": COMPLEXITY_RULES.policy_for_stage(stage_level, features),
		"axe_hero_unlocked": bool(heroes.get("axe_hero", false)),
		"archer_hero_unlocked": bool(heroes.get("archer_hero", false)),
		"wizard_hero_unlocked": bool(heroes.get("wizard_hero", false)),
	}


func _next_seed() -> int:
	_roll_serial += 1
	return int(_rng.randi()) ^ (_roll_serial * 7919)
