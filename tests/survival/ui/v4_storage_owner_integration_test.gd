extends SceneTree
## Composition test: A6 emits a normalized request, then the actual A0
## ChestInventoryPanel validates context and performs transfers through the real
## A0 SurvivalService + SaveService. The test host does not mutate inventory.
const OVERWORLD_PATH := "res://game/overworld/chapter1_overworld.tscn"
const PANEL_PATH := "res://game/survival/chest_inventory_panel.gd"
const VIEW := preload("res://game/survival/ui/survival_view_adapter.gd")
const COMMAND := preload("res://game/survival/ui/a0_storage_command_adapter.gd")
const WOOD := "oak_wood"
const IRON := "iron_scrap"
const STONE := "stone_chunk"
var checks := 0
var failures: Array[String] = []
var save_path := ""
var host: Node2D
var panel: Node


func _initialize() -> void:
	call_deferred("_run")


func _expect(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr("FAIL: ", message)


func _save() -> Node:
	return root.get_node_or_null("SaveService")


func _survival() -> Node:
	return root.get_node_or_null("SurvivalService")


func _give(item_id: String, quantity: int) -> bool:
	return bool(
		_save().call(
			&"grant_inventory_item",
			item_id,
			"material",
			quantity,
			"a6_v4.give.%s.%d" % [item_id, Time.get_ticks_usec()],
			{"source": "a6_v4_native_test"}
		)
	)


func _find_buildable(overworld: Node) -> Vector2i:
	var world: Object = overworld.get("world")
	var build: Object = overworld.get("survival_build")
	var player: Node2D = overworld.get("player") as Node2D
	if world == null or build == null or player == null:
		return Vector2i(-1, -1)
	var origin: Vector2i = world.call(&"tile_of", player.global_position)
	for radius in range(0, 8):
		for dx in range(-radius, radius + 1):
			for dy in range(-radius, radius + 1):
				var cell := origin + Vector2i(dx, dy) + Vector2i(-2, 2)
				if String(build.call(&"validate_cell", cell)).is_empty():
					return cell
	return Vector2i(-1, -1)


func _intent(
	request_id: String, container_id: String, item_id: String, direction: String, amount: int
) -> Dictionary:
	return {
		"schema": "soh.ui.intent.v2",
		"request_id": request_id,
		"container_id": container_id,
		"item_id": item_id,
		"stack_key": item_id,
		"direction": direction,
		"amount": amount,
		"sequence": 0,
		"revision": "owner-current"
	}


func _submit_owner_panel(command: Dictionary) -> bool:
	if String(command.get("status", "")) != "validated_for_a0_host":
		return false
	var button_name := (
		("Deposit_" if String(command.direction) == "deposit" else "Take_")
		+ String(command.item_id)
	)
	var button := panel.find_child(button_name, true, false) as Button
	if button == null:
		return false
	(panel.get("_quantity") as SpinBox).value = int(command.amount)
	button.pressed.emit()
	return String((panel.get("_notice") as Label).text) == "Transfer complete."


func _run() -> void:
	var save := _save()
	var survival := _survival()
	_expect(save != null and survival != null, "current A0 SaveService and SurvivalService exist")
	if save == null or survival == null:
		await _finish()
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/a6_v4_storage_%d.json" % Time.get_ticks_usec()
	save.call(&"configure_storage", save_path, true)
	_expect(
		_give(WOOD, 4) and _give(IRON, 1) and _give(STONE, 9),
		"fixture funds an A0 chest and exact stack transfer"
	)
	var packed := load(OVERWORLD_PATH) as PackedScene
	_expect(packed != null, "current A0 overworld scene loads")
	if packed == null:
		await _finish()
		return
	host = Node2D.new()
	host.name = "A6V4OwnerIntegrationHost"
	root.add_child(host)
	var overworld := packed.instantiate()
	host.add_child(overworld)
	if overworld.has_method(&"configure"):
		overworld.call(&"configure", {})
	var deadline := Time.get_ticks_msec() + 90000
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if overworld.has_method(&"is_world_ready") and bool(overworld.call(&"is_world_ready")):
			break
		if (
			overworld.has_method(&"is_world_ready")
			and not String(overworld.get("build_error")).is_empty()
		):
			printerr("A0 world build error: ", String(overworld.get("build_error")))
			break
	_expect(
		overworld.has_method(&"is_world_ready") and bool(overworld.call(&"is_world_ready")),
		"A0 world becomes ready for a real chest placement"
	)
	if not overworld.has_method(&"is_world_ready") or not bool(overworld.call(&"is_world_ready")):
		await _finish()
		return
	var build: Object = overworld.get("survival_build")
	var hero := overworld.get("player") as Node2D
	var cell := _find_buildable(overworld)
	_expect(cell != Vector2i(-1, -1), "A0 identifies a real buildable cell")
	build.call(&"select_piece", "chest_wood")
	var placed: Dictionary = build.call(&"try_place", cell)
	var container_id := String(placed.get("entity_id", ""))
	_expect(
		bool(placed.get("ok", false)) and not container_id.is_empty(),
		"A0 places and persists the paid chest"
	)
	if container_id.is_empty():
		await _finish()
		return
	var chest_node := build.call(&"structure_node", container_id) as Node2D
	_expect(chest_node != null and hero != null, "A0 chest and Knight nodes are available")
	if chest_node == null or hero == null:
		await _finish()
		return
	hero.global_position = chest_node.global_position + Vector2(0, 12)
	var panel_script := load(PANEL_PATH) as Script
	_expect(panel_script != null, "current A0 selective chest panel loads")
	if panel_script == null:
		await _finish()
		return
	panel = panel_script.new()
	panel.name = "A0OwnerChestPanelUnderTest"
	root.add_child(panel)
	await process_frame
	_expect(
		bool(panel.call(&"open_chest", chest_node, hero, survival)),
		"A0 panel validates and opens for an in-range live Knight"
	)
	var start := VIEW.storage(save, survival, container_id)
	var stone_row: Dictionary = _find_row(start.bag, STONE)
	_expect(
		int(stone_row.get("count", 0)) == 9 and bool(stone_row.get("transferable", false)),
		"read-only A6 view shows exact A0 bag quantity and sweepability"
	)
	_expect(
		start.transfer_enabled == false,
		"read-only projection does not claim interaction authorization"
	)
	var deposit_intent := _intent("deposit-001", container_id, STONE, "deposit", 6)
	var deposit := COMMAND.normalize_intent("transfer", STONE, deposit_intent)
	var before_command: Dictionary = (save.call(&"get_snapshot") as Dictionary).duplicate(true)
	_expect(
		(
			String(deposit.get("status", "")) == "validated_for_a0_host"
			and deposit.get("mutated", true) == false
		),
		"A6 emits a shape-only command and never mutates storage"
	)
	_expect(
		(save.call(&"get_snapshot") as Dictionary) == before_command,
		"A6 adapter has no inventory side effect"
	)
	_expect(
		_submit_owner_panel(deposit),
		"actual A0 chest-panel deposit commits the requested exact quantity"
	)
	var after_deposit := VIEW.storage(save, survival, container_id)
	_expect(
		(
			int(_save_count(save, STONE)) == 3
			and int(_survival_count(survival, container_id, STONE)) == 6
		),
		"A0 transaction conserves exact quantity across bag and chest"
	)
	_expect(
		(
			int(_find_row(after_deposit.bag, STONE).get("count", 0)) == 3
			and int(_find_row(after_deposit.chest, STONE).get("count", 0)) == 6
		),
		"A6 projection refresh reads authoritative quantities"
	)
	var withdraw := COMMAND.normalize_intent(
		"transfer", STONE, _intent("withdraw-001", container_id, STONE, "withdraw", 2)
	)
	_expect(
		(
			_submit_owner_panel(withdraw)
			and int(_save_count(save, STONE)) == 5
			and int(_survival_count(survival, container_id, STONE)) == 4
		),
		"actual A0 chest-panel withdrawal commits exact quantity"
	)
	var before_overdraw: Dictionary = (save.call(&"get_snapshot") as Dictionary).duplicate(true)
	var overdraw_receipt := (
		"survival.chest.ui.%s.%d"
		% [String(panel.get("_session_id")), int(panel.get("_serial")) + 1]
	)
	var overdraw := COMMAND.normalize_intent(
		"transfer", STONE, _intent("withdraw-overdraw", container_id, STONE, "withdraw", 5)
	)
	_expect(
		not _submit_owner_panel(overdraw), "A0 refuses withdrawal beyond the exact chest quantity"
	)
	_expect(
		(
			(save.call(&"get_snapshot") as Dictionary) == before_overdraw
			and not bool(save.call(&"is_transaction_applied", overdraw_receipt))
		),
		"A0 overdraw rejection leaves the save and receipt ledger unchanged"
	)
	var core_command := COMMAND.normalize_intent(
		"transfer",
		"soh_i_000000000011_a1c0ffee",
		_intent("core-transfer", container_id, "soh_i_000000000011_a1c0ffee", "deposit", 1)
	)
	var before_core_request: Dictionary = (save.call(&"get_snapshot") as Dictionary).duplicate(true)
	_expect(
		(
			String(core_command.get("status", "")) == "rejected"
			and (save.call(&"get_snapshot") as Dictionary) == before_core_request
		),
		"A6 adapter refuses generic transfer of a unique A3 token without mutation"
	)
	var stack_key_command := COMMAND.normalize_intent(
		"transfer",
		"oak_wood#stack_2",
		_intent("stack-key", container_id, "oak_wood#stack_2", "deposit", 1)
	)
	_expect(
		String(stack_key_command.get("status", "")) == "rejected",
		"stack key is not mistaken for A0's canonical item_id"
	)
	var bad_direction := COMMAND.normalize_intent(
		"transfer", STONE, _intent("bad-direction", container_id, STONE, "move", 1)
	)
	_expect(
		String(bad_direction.get("status", "")) == "rejected",
		"unknown transfer direction fails closed"
	)
	var bad_amount := COMMAND.normalize_intent(
		"transfer", STONE, _intent("bad-amount", container_id, STONE, "deposit", 0)
	)
	_expect(
		String(bad_amount.get("status", "")) == "rejected",
		"zero quantity fails closed before it reaches A0"
	)
	var fractional_intent := _intent("fractional-amount", container_id, STONE, "deposit", 1)
	fractional_intent["amount"] = 1.5
	var fractional := COMMAND.normalize_intent("transfer", STONE, fractional_intent)
	_expect(
		String(fractional.get("status", "")) == "rejected",
		"fractional quantity fails closed instead of silently rounding"
	)
	var missing_revision_intent := _intent("missing-revision", container_id, STONE, "deposit", 1)
	missing_revision_intent.erase("revision")
	_expect(
		String(COMMAND.normalize_intent("transfer", STONE, missing_revision_intent).get("status", "")) == "rejected",
		"storage intent without its source revision fails closed"
	)
	var malformed_item := COMMAND.normalize_intent(
		"transfer", "private item id", _intent("malformed-item", container_id, "private item id", "deposit", 1)
	)
	_expect(
		String(malformed_item.get("status", "")) == "rejected",
		"noncanonical internal item key is rejected before reaching A0"
	)
	var malformed_request := _intent("bad request id", container_id, STONE, "deposit", 1)
	_expect(
		String(COMMAND.normalize_intent("transfer", STONE, malformed_request).get("status", "")) == "rejected",
		"malformed request correlation key fails closed"
	)
	# Fill the A0 chest to its real slot limit through its actual current panel.
	for index in range(11):
		var item_id := "v4_chest_slot_%02d" % index
		_expect(_give(item_id, 1), "fund chest slot %d" % index)
		panel.call(&"_refresh")
		var request := COMMAND.normalize_intent(
			"transfer", item_id, _intent("slot-%02d" % index, container_id, item_id, "deposit", 1)
		)
		_expect(_submit_owner_panel(request), "A0 accepts stackable slot %d" % index)
		await process_frame
	_expect(
		(survival.call(&"container_contents", container_id) as Dictionary).size() == 12,
		"real A0 chest reaches twelve occupied item slots"
	)
	_expect(_give("v4_chest_overflow", 1), "fund a thirteenth stack")
	panel.call(&"_refresh")
	var chest_before_overflow: Dictionary = (
		(survival.call(&"container_contents", container_id) as Dictionary).duplicate(true)
	)
	var overflow := COMMAND.normalize_intent(
		"transfer",
		"v4_chest_overflow",
		_intent("slot-overflow", container_id, "v4_chest_overflow", "deposit", 1)
	)
	_expect(
		(
			not _submit_owner_panel(overflow)
			and String((panel.get("_notice") as Label).text).contains("Cannot transfer")
		),
		"full chest shows A0's honest failure feedback"
	)
	_expect(
		(
			(
				(survival.call(&"container_contents", container_id) as Dictionary)
				== chest_before_overflow
			)
			and _save_count(save, "v4_chest_overflow") == 1
		),
		"full chest rejection preserves authoritative bag and chest quantities"
	)
	# Test a real full-bag withdrawal failure through the A0 panel too.
	var capacity: Dictionary = save.call(&"get_inventory_capacity_snapshot")
	var filler_index := 0
	while (
		int(capacity.get("bag_used", 0)) < int(capacity.get("bag_capacity", 0))
		and filler_index < 64
	):
		var filler := "v4_bag_fill_%02d" % filler_index
		if not _give(filler, 1):
			break
		filler_index += 1
		capacity = save.call(&"get_inventory_capacity_snapshot")
	_expect(
		int(capacity.get("bag_used", -1)) == int(capacity.get("bag_capacity", -2)),
		"real A0 bag reaches its authoritative capacity"
	)
	var bag_before_withdraw: Dictionary = (save.call(&"inventory_totals") as Dictionary).duplicate(
		true
	)
	var chest_before_withdraw: Dictionary = (
		(survival.call(&"container_contents", container_id) as Dictionary).duplicate(true)
	)
	var bag_slot_item := "v4_chest_slot_00"
	var full_bag_withdraw := COMMAND.normalize_intent(
		"transfer",
		bag_slot_item,
		_intent("full-bag-take", container_id, bag_slot_item, "withdraw", 1)
	)
	_expect(
		(
			not _submit_owner_panel(full_bag_withdraw)
			and String((panel.get("_notice") as Label).text).contains("Cannot transfer")
		),
		"full bag withdrawal is rejected by A0 with visible feedback"
	)
	_expect(
		(
			(save.call(&"inventory_totals") as Dictionary) == bag_before_withdraw
			and (
				(survival.call(&"container_contents", container_id) as Dictionary)
				== chest_before_withdraw
			)
		),
		"full-bag rejection changes neither authoritative inventory nor chest"
	)
	# A0 itself owns reach/death checks; a request shape is not authorization.
	panel.call(&"close_panel")
	hero.global_position = chest_node.global_position + Vector2(240, 0)
	_expect(
		not bool(panel.call(&"open_chest", chest_node, hero, survival)),
		"A0 refuses to open storage outside reach"
	)
	if failures.is_empty():
		print("A6 V4 A0 STORAGE OWNER INTEGRATION PASSED - %d checks" % checks)
	else:
		printerr("A6 V4 A0 STORAGE OWNER INTEGRATION FAILED - %d/%d" % [failures.size(), checks])
		for failure: String in failures:
			printerr(" - ", failure)
	await _finish()


func _find_row(rows: Array, item_id: String) -> Dictionary:
	for raw: Variant in rows:
		if raw is Dictionary and String(raw.get("id", "")) == item_id:
			return raw
	return {}


func _save_count(save: Node, item_id: String) -> int:
	return int((save.call(&"inventory_totals") as Dictionary).get(item_id, 0))


func _survival_count(survival: Node, container_id: String, item_id: String) -> int:
	return int((survival.call(&"container_contents", container_id) as Dictionary).get(item_id, 0))


func _finish() -> void:
	if panel != null and is_instance_valid(panel):
		panel.queue_free()
	if host != null and is_instance_valid(host):
		host.queue_free()
	await process_frame
	if not save_path.is_empty() and FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	quit(1 if not failures.is_empty() else 0)
