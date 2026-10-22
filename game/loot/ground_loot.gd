class_name GroundLoot
extends Area2D

const INVENTORY_STACK_CAPACITY := 50

const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const VFX_CATALOG := preload("res://game/vfx/vfx_catalog.gd")
const RARITY_AURA := preload("res://game/loot/loot_rarity_aura.gd")

@export_range(72.0, 160.0, 1.0) var auto_pickup_radius := 96.0

@onready var visual_root: Node2D = %VisualRoot
@onready var icon: Sprite2D = %Icon
@onready var collision_shape: CollisionShape2D = %CollisionShape2D

var _payload: Dictionary = {}
var _rarity_aura: LootRarityAura
var _landed := false
var _picked_up := false
var _launch_elapsed := 0.0
var _launch_duration := 0.48
var _launch_start_offset := Vector2.ZERO
var _launch_arc_height := 34.0
var _idle_phase := 0.0
var _save_service_override: Node
var _attraction_target: Node2D
var _attraction_elapsed := 0.0
var _pickup_retry_remaining := 0.0
var _attraction_trail_remaining := 0.0


func _ready() -> void:
	add_to_group(&"ground_loot")
	# Loot can be born directly from an enemy death inside a physics overlap
	# callback (for example when spikes land the killing blow). PhysicsServer is
	# still flushing that query, so collision state must enter through its
	# deferred seam just like every later launch/pickup transition.
	collision_shape.set_deferred(&"disabled", true)
	_idle_phase = float(get_instance_id() % 37) * 0.17
	if not _payload.is_empty():
		_apply_payload_presentation()
	_sync_interaction_group()


func _process(delta: float) -> void:
	if _picked_up:
		return
	if not _landed:
		_launch_elapsed += delta
		var progress := clampf(_launch_elapsed / maxf(0.05, _launch_duration), 0.0, 1.0)
		var eased := 1.0 - pow(1.0 - progress, 3.0)
		visual_root.position = _launch_start_offset.lerp(Vector2.ZERO, eased)
		visual_root.position.y -= sin(progress * PI) * _launch_arc_height
		visual_root.rotation = sin(progress * PI) * 0.22
		if progress >= 1.0:
			_land()
		return
	_pickup_retry_remaining = maxf(0.0, _pickup_retry_remaining - delta)
	if is_instance_valid(_attraction_target):
		_tick_attraction(delta)
		return
	_idle_phase += delta * 2.4
	visual_root.position.y = -2.0 + sin(_idle_phase) * 2.0
	if _requires_explicit_pickup() or not _has_inventory_room():
		return
	if _pickup_retry_remaining <= 0.0:
		var player := _nearest_player_in_radius()
		if is_instance_valid(player):
			_begin_attraction(player)


func configure(payload: Dictionary) -> bool:
	if not RuntimeLootCatalog.is_valid_payload(payload):
		return false
	_payload = payload.duplicate(true)
	if is_node_ready():
		_apply_payload_presentation()
		_sync_interaction_group()
	return true


func launch_from(
		source_position: Vector2,
		landing_position: Vector2,
		duration := 0.48,
		arc_height := 34.0
) -> void:
	global_position = landing_position
	_launch_start_offset = source_position - landing_position
	_launch_duration = maxf(0.12, duration)
	_launch_arc_height = maxf(8.0, arc_height)
	_launch_elapsed = 0.0
	_landed = false
	if is_instance_valid(collision_shape):
		collision_shape.set_deferred(&"disabled", true)
	if is_instance_valid(visual_root):
		visual_root.position = _launch_start_offset


func set_save_service_override(service: Node) -> void:
	_save_service_override = service


func can_interact(player: Node2D) -> bool:
	return (
		_requires_explicit_pickup()
		and
		_landed
		and not _picked_up
		and not is_instance_valid(_attraction_target)
		and not _payload.is_empty()
		and is_instance_valid(player)
		and player.is_in_group(&"player")
		and global_position.distance_to(player.global_position) <= auto_pickup_radius
	)


func interact(player: Node2D) -> bool:
	if not can_interact(player):
		return false
	_begin_attraction(player)
	return true


func _finish_pickup(player: Node2D) -> bool:
	if _picked_up or not is_instance_valid(player):
		return false
	var events := _game_events()
	if _is_pickup_transaction_applied():
		var reconciled := false
		if bool(_payload.get("reconcile_missing_entitlement", false)) \
				and not _pickup_entitlement_present():
			reconciled = _commit_missing_entitlement_reconciliation()
			if not reconciled and not _pickup_entitlement_present():
				_cancel_attraction_for_retry()
				if events != null:
					events.emit_signal(
						&"toast_requested",
						"Tủ đồ chưa thể nhận Cung Linh Hồn — hãy thử lại.",
					)
				return false
		# A duplicated/reloaded world visual may race a receipt that already paid.
		# Retire it silently: no second grant and no second success event.
		_picked_up = true
		_attraction_target = null
		collision_shape.set_deferred(&"disabled", true)
		monitoring = false
		if events != null and events.has_signal(&"loot_pickup_resolved"):
			var resolved_payload := _payload.duplicate(true)
			resolved_payload["reconciled"] = reconciled
			events.emit_signal(&"loot_pickup_resolved", resolved_payload, reconciled)
		_play_pickup_animation()
		return true
	if not _commit_pickup():
		_cancel_attraction_for_retry()
		if events != null:
			events.emit_signal(&"toast_requested", "Tủ đồ chưa thể nhận vật phẩm — hãy thử lại.")
		return false
	_picked_up = true
	collision_shape.set_deferred(&"disabled", true)
	monitoring = false
	var committed_payload := _payload.duplicate(true)
	if events != null:
		events.emit_signal(&"loot_picked_up", committed_payload)
		if events.has_signal(&"loot_pickup_resolved"):
			events.emit_signal(&"loot_pickup_resolved", committed_payload, true)
		events.emit_signal(&"loot_focus_changed", null, "", &"normal", false)
	var rarity := RARITY_PALETTE.normalize(_payload.get("rarity", &"normal"))
	var tint := RARITY_PALETTE.color(rarity)
	VFX_CATALOG.spawn(
		get_parent(),
		&"world_sparkle",
		global_position + Vector2(0.0, -8.0),
		0.0,
		1.0 + float(RARITY_PALETTE.index(rarity)) * 0.08,
		tint,
		30
	)
	if events != null:
		events.emit_signal(&"combat_cue_requested", &"loot_pickup", global_position, {
			"source": &"ground_loot",
			"rarity": rarity,
			"family": _payload.get("family", &"material"),
		})
		events.emit_signal(
			&"toast_requested",
			"NHẶT  •  %s%s" % [
				String(_payload.get("display_name", "Vật phẩm")),
				" ×%d" % int(_payload.get("quantity", 1))
				if int(_payload.get("quantity", 1)) > 1 else "",
			]
		)
	_play_pickup_animation()
	return true


func get_focus_payload() -> Dictionary:
	var result := _payload.duplicate(true)
	result["rarity_name"] = RARITY_PALETTE.display_name(
		_payload.get("rarity", &"normal")
	)
	result["rarity_color"] = RARITY_PALETTE.color(
		_payload.get("rarity", &"normal")
	)
	# Ordinary loot remains magnet-only. Authoritative hero recruitment drops may
	# opt into a deliberate physical click without changing that default loop.
	result["can_pickup"] = _requires_explicit_pickup()
	result["auto_pickup"] = not _requires_explicit_pickup()
	result["node"] = self
	return result


func get_target_payload() -> Dictionary:
	return get_focus_payload()


func get_loot_payload() -> Dictionary:
	return _payload.duplicate(true)


func is_available_for_pickup() -> bool:
	return _landed and not _picked_up


func _apply_payload_presentation() -> void:
	var texture := load(String(_payload.get("icon_path", ""))) as Texture2D
	if texture == null:
		return
	icon.texture = texture
	icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	icon.scale = Vector2.ONE * 0.82
	var rarity := RARITY_PALETTE.normalize(_payload.get("rarity", &"normal"))
	if is_instance_valid(_rarity_aura):
		_rarity_aura.queue_free()
	_rarity_aura = RARITY_AURA.new() as LootRarityAura
	visual_root.add_child(_rarity_aura)
	visual_root.move_child(_rarity_aura, 0)
	_rarity_aura.position = Vector2.ZERO
	_rarity_aura.configure(rarity, RARITY_PALETTE.index(rarity) >= 4)


func _land() -> void:
	_landed = true
	visual_root.position = Vector2(0.0, -2.0)
	visual_root.rotation = 0.0
	collision_shape.set_deferred(&"disabled", false)
	var tint := RARITY_PALETTE.color(_payload.get("rarity", &"normal"))
	VFX_CATALOG.spawn(
		get_parent(),
		&"smoke_puff",
		global_position,
		-PI * 0.5,
		0.44,
		Color(tint.r, tint.g, tint.b, 0.30),
		6
	)
	var events := _game_events()
	if events != null:
		events.emit_signal(&"combat_cue_requested", &"loot_land", global_position, {
			"rarity": _payload.get("rarity", &"normal"),
		})


func _requires_explicit_pickup() -> bool:
	# Player-dropped items never re-enter the magnet loop.  They remain a
	# deliberate click pickup, even after the owner walks away and returns.
	return bool(_payload.get("requires_explicit_pickup", false)) \
		or bool(_payload.get("dropped_by_player", false))


func _has_inventory_room() -> bool:
	var service := _save_service()
	if service == null or not service.has_method(&"get_snapshot"):
		return true
	var snapshot_value: Variant = service.call(&"get_snapshot")
	if not snapshot_value is Dictionary:
		return true
	var inventory_value: Variant = (snapshot_value as Dictionary).get("inventory", {})
	if not inventory_value is Dictionary:
		return true
	var inventory := inventory_value as Dictionary
	var occupied := (inventory.get("hero_souls", []) as Array).size() \
		+ (inventory.get("auxiliary_equipment", []) as Array).size() \
		+ ((inventory.get("item_stacks", {}) as Dictionary).size())
	match StringName(_payload.get("kind", &"")):
		&"hero_soul":
			return occupied < 30
		&"auxiliary_equipment":
			return occupied < 30
		&"stackable":
			var stacks := inventory.get("item_stacks", {}) as Dictionary
			var item_id := String(_payload.get("item_id", "")).strip_edges().to_lower()
			for raw_stack_key: Variant in stacks.keys():
				var raw_stack: Variant = stacks[raw_stack_key]
				if not raw_stack is Dictionary:
					continue
				var stack := raw_stack as Dictionary
				var stack_item_id := String(stack.get("item_id", raw_stack_key)).strip_edges().to_lower()
				if stack_item_id == item_id and int(stack.get("quantity", 0)) < INVENTORY_STACK_CAPACITY:
					return true
			return occupied < 30
	return true


func _sync_interaction_group() -> void:
	if _requires_explicit_pickup():
		if not is_in_group(&"player_interactable"):
			add_to_group(&"player_interactable")
	elif is_in_group(&"player_interactable"):
		remove_from_group(&"player_interactable")


func _nearest_player_in_radius() -> Node2D:
	var nearest: Node2D
	var nearest_distance_squared := auto_pickup_radius * auto_pickup_radius
	for candidate: Node in get_tree().get_nodes_in_group(&"player"):
		if not candidate is Node2D or candidate.is_queued_for_deletion():
			continue
		var player := candidate as Node2D
		var distance_squared := global_position.distance_squared_to(player.global_position)
		if distance_squared <= nearest_distance_squared:
			nearest = player
			nearest_distance_squared = distance_squared
	return nearest


func _begin_attraction(player: Node2D) -> void:
	if _picked_up or not _landed or is_instance_valid(_attraction_target):
		return
	_attraction_target = player
	_attraction_elapsed = 0.0
	_attraction_trail_remaining = 0.0
	monitoring = false
	collision_shape.set_deferred(&"disabled", true)
	visual_root.position = Vector2.ZERO
	var events := _game_events()
	if events != null:
		events.emit_signal(&"loot_focus_changed", null, "", &"normal", false)


func _tick_attraction(delta: float) -> void:
	if not is_instance_valid(_attraction_target):
		_cancel_attraction_for_retry()
		return
	_attraction_elapsed += delta
	_attraction_trail_remaining -= delta
	var target_position := _attraction_target.global_position + Vector2(0.0, -10.0)
	var distance := global_position.distance_to(target_position)
	var speed := 210.0 + minf(410.0, _attraction_elapsed * 980.0)
	global_position = global_position.move_toward(target_position, speed * delta)
	visual_root.rotation += delta * 8.5
	visual_root.scale = Vector2.ONE * lerpf(1.0, 0.72, clampf(_attraction_elapsed / 0.42, 0.0, 1.0))
	if _attraction_trail_remaining <= 0.0:
		_attraction_trail_remaining = 0.075
		var tint := RARITY_PALETTE.color(_payload.get("rarity", &"normal"))
		VFX_CATALOG.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 0.34, Color(tint, 0.62), 24)
	if distance <= 7.0 or _attraction_elapsed >= 0.52:
		global_position = target_position
		_finish_pickup(_attraction_target)


func _cancel_attraction_for_retry() -> void:
	_attraction_target = null
	_attraction_elapsed = 0.0
	_pickup_retry_remaining = 0.70
	monitoring = true
	collision_shape.set_deferred(&"disabled", false)
	visual_root.position = Vector2(0.0, -2.0)
	visual_root.rotation = 0.0
	visual_root.scale = Vector2.ONE
	visual_root.modulate = Color.WHITE


func _commit_pickup() -> bool:
	var service := _save_service()
	if service == null:
		return false
	var transaction_key := _pickup_transaction_key()
	var metadata := {
		"source": String(_payload.get("source", &"runtime")),
		"source_id": String(_payload.get("source_id", &"runtime")),
		"rarity": String(_payload.get("rarity", &"normal")),
		"item_level": int(_payload.get("item_level", 1)),
		"display_name": String(_payload.get("display_name", "Vật phẩm")),
		"icon_path": String(_payload.get("icon_path", "")),
	}
	if StringName(_payload.get("pickup_commit_mode", &"")) == &"reward_bundle_unique":
		return _commit_unique_reward_bundle(service, transaction_key, metadata)
	match StringName(_payload.get("kind", &"")):
		&"stackable":
			if service.has_method(&"grant_inventory_item"):
				return bool(service.call(
					&"grant_inventory_item",
					StringName(_payload.get("item_id", &"")),
					StringName(_payload.get("inventory_kind", &"material")),
					int(_payload.get("quantity", 1)),
					transaction_key,
					metadata
				))
			return _fallback_stack_transaction(service, transaction_key, metadata)
		&"auxiliary_equipment":
			return service.has_method(&"grant_auxiliary_equipment") \
				and bool(service.call(
					&"grant_auxiliary_equipment",
					(_payload.get("item", {}) as Dictionary).duplicate(true),
					transaction_key,
					metadata
				))
		&"hero_soul":
			return service.has_method(&"grant_hero_soul") \
				and bool(service.call(
					&"grant_hero_soul",
					(_payload.get("item", {}) as Dictionary).duplicate(true),
					transaction_key,
					metadata
				))
	return false


func _save_service() -> Node:
	return _save_service_override if _save_service_override != null \
		else get_node_or_null("/root/SaveService")


func _pickup_transaction_key() -> String:
	var authored := String(_payload.get("pickup_transaction_key", "")).strip_edges()
	return authored if not authored.is_empty() \
		else "loot_pickup:%s" % String(_payload.get("loot_id", ""))


func _is_pickup_transaction_applied() -> bool:
	var service := _save_service()
	return service != null and service.has_method(&"is_transaction_applied") \
		and bool(service.call(&"is_transaction_applied", _pickup_transaction_key()))


func _pickup_entitlement_present() -> bool:
	if StringName(_payload.get("kind", &"")) != &"hero_soul":
		return true
	var expected_value: Variant = _payload.get("item", {})
	if not expected_value is Dictionary:
		return false
	var expected_id := String((expected_value as Dictionary).get("instance_id", ""))
	var service := _save_service()
	if expected_id.is_empty() or service == null or not service.has_method(&"get_snapshot"):
		return false
	var snapshot_value: Variant = service.call(&"get_snapshot")
	if not snapshot_value is Dictionary:
		return false
	var inventory_value: Variant = (snapshot_value as Dictionary).get("inventory", {})
	if not inventory_value is Dictionary:
		return false
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
	if not souls_value is Array:
		return false
	for raw_soul: Variant in souls_value:
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("instance_id", "")) == expected_id:
			return true
	return false


func _commit_unique_reward_bundle(
		service: Node,
		transaction_key: String,
		metadata: Dictionary,
) -> bool:
	if not service.has_method(&"transact_once"):
		return false
	var bundle_path := String(_payload.get("reward_bundle_path", ""))
	var bundle := load(bundle_path) as RewardBundleDefinition
	if bundle == null or not bundle.get_validation_errors().is_empty():
		return false
	return bool(service.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			return bundle.reconcile_unique_grants_to_candidate(candidate),
		metadata,
	))


func _commit_missing_entitlement_reconciliation() -> bool:
	var service := _save_service()
	if service == null or not service.has_method(&"get_snapshot"):
		return false
	var snapshot: Dictionary = service.call(&"get_snapshot")
	var source_key := _pickup_transaction_key()
	var repair_key := "loot_reconcile:%s:%d" % [
		source_key.sha256_text().substr(0, 20),
		int(snapshot.get("revision", 0)),
	]
	var metadata := {
		"kind": "loot_entitlement_reconciliation",
		"source_transaction": source_key,
		"loot_profile": String(_payload.get("loot_profile", "")),
		"source_id": String(_payload.get("source_id", "")),
	}
	if StringName(_payload.get("pickup_commit_mode", &"")) == &"reward_bundle_unique":
		return _commit_unique_reward_bundle(service, repair_key, metadata)
	if StringName(_payload.get("kind", &"")) == &"hero_soul" \
			and service.has_method(&"grant_hero_soul"):
		return bool(service.call(
			&"grant_hero_soul",
			(_payload.get("item", {}) as Dictionary).duplicate(true),
			repair_key,
			metadata,
		))
	return false


func _fallback_stack_transaction(
		service: Node,
		transaction_key: String,
		metadata: Dictionary
) -> bool:
	if not service.has_method(&"transact_once"):
		return false
	var item_id := String(_payload.get("item_id", ""))
	var inventory_kind := String(_payload.get("inventory_kind", "material"))
	var quantity := int(_payload.get("quantity", 1))
	return bool(service.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var stacks: Dictionary = inventory.get("item_stacks", {}).duplicate(true)
			var record: Dictionary = stacks.get(item_id, {}).duplicate(true)
			if not record.is_empty() and String(record.get("kind", "")) != inventory_kind:
				return false
			var next_quantity := int(record.get("quantity", 0)) + quantity
			if next_quantity <= 0 or next_quantity > INVENTORY_STACK_CAPACITY:
				return false
			stacks[item_id] = {
				"kind": inventory_kind,
				"quantity": next_quantity,
				"display_name": String(_payload.get("display_name", "Vật phẩm")),
				"icon_path": String(_payload.get("icon_path", "")),
				"rarity": String(_payload.get("rarity", &"normal")),
				"item_level": int(_payload.get("item_level", 1)),
			}
			inventory["item_stacks"] = stacks
			candidate["inventory"] = inventory
			return true,
		{"kind": "inventory_item_grant", "source": metadata.duplicate(true)}
	))


func _play_pickup_animation() -> void:
	_attraction_target = null
	var tween := create_tween().set_parallel(true)
	tween.tween_property(visual_root, "position:y", -20.0, 0.18) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(visual_root, "scale", Vector2.ONE * 1.28, 0.18)
	tween.tween_property(visual_root, "modulate:a", 0.0, 0.18)
	tween.chain().tween_callback(queue_free)


func _game_events() -> Node:
	return get_node_or_null("/root/GameEvents")
