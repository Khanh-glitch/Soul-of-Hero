extends SceneTree

const HUD := preload("res://game/survival/ui/player_first_hud.gd")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
var checks := 0
var failures: Array[String] = []


class FakeStorageSave:
	extends RefCounted

	func inventory_totals() -> Dictionary:
		return {"oak_wood": 5, "soh_i_000000000011_a1c0ffee": 1, "core_ember": 1}

	func get_inventory_stacks() -> Dictionary:
		return {
			"oak_wood": {"item_id": "oak_wood", "quantity": 3},
			"oak_wood_stack_2": {"item_id": "oak_wood", "quantity": 2},
			"soh_i_000000000011_a1c0ffee":
			{"item_id": "soh_i_000000000011_a1c0ffee", "quantity": 1, "kind": "key_item"},
			"core_ember": {"item_id": "core_ember", "quantity": 1}
		}


class FakeStorageSurvival:
	extends RefCounted

	func container_contents(_id: String) -> Dictionary:
		return {"stone_chunk": 2}

	func is_sweepable_item(item_id: String) -> bool:
		return not item_id.begins_with("soh_i_")

	func item_definition(item_id: String) -> Dictionary:
		return (
			{"label": "Oak Wood", "kind": "material"}
			if item_id == "oak_wood"
			else {"label": "Stone Chunk", "kind": "material"}
		)


func _initialize() -> void:
	call_deferred("_run")


func _check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr("FAIL: ", message)


func _run() -> void:
	var hud: Control = HUD.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(hud)
	await process_frame
	_check(
		not hud.set_projection({"schema": "unknown", "provenance": "A0_OWNER_PROJECTION"}),
		"reject unknown HUD schema"
	)
	_check(
		not hud.set_projection({"schema": "soh.ui.player_hud.v1", "provenance": "UNKNOWN_OWNER"}),
		"reject unknown provenance"
	)
	var snapshot := {
		"schema": "soh.ui.player_hud.v1",
		"provenance": "FIXTURE_PROJECTION",
		"mode": "exploration",
		"needs":
		[
			{"label": "Health", "current": 84, "maximum": 100},
			{"label": "Malformed", "current": "?", "maximum": 0}
		],
		"danger": {"status": "unknown", "label": "Do not reveal this"},
		"bag": {"used": 12, "capacity": 12},
		"core":
		{
			"name": "Ember Core",
			"instance_id": "soh_i_000000000011_a1c0ffee",
			"ownership_state": "In satchel · unequipped",
			"uses": 8,
			"max_uses": 8,
			"condition": 91,
			"max_condition": 100,
			"readiness": "BLOCKED_PENDING_A4"
		},
		"feedback":
		{
			"status": "committed",
			"kind": "core_acquired",
			"provenance": "FIXTURE_PROJECTION",
			"item_name": "Ember Core"
		}
	}
	_check(hud.set_projection(snapshot), "accept versioned fixture projection")
	await process_frame
	_check(hud._phase.text.contains("EXPLORING"), "use supplied exploration state")
	_check(
		hud._needs.get_child_count() == 1 and hud._needs.get_child(0).text == "Health  84 / 100",
		"render only validated needs"
	)
	_check(not hud._risk.visible, "unknown danger is not converted into a hazard claim")
	_check(
		hud._bag.text.contains("PACK FULL") and hud._bag.text.contains("12 / 12"),
		"full pack state is explicit and numeric"
	)
	_check(
		hud._provenance.text == "FIXTURE PROJECTION", "fixture projection is visibly distinguished"
	)
	_check(
		hud._core_panel.visible and hud._core_title.text.contains("EMBER CORE"),
		"physical Core is visible as an owned object"
	)
	_check(
		hud._core_state.text == "In satchel · unequipped",
		"satchel ownership is distinct from equipped state"
	)
	_check(
		(
			hud._core_details.text.contains("Charges 8 / 8")
			and hud._core_details.text.contains("Condition 91 / 100")
			and hud._core_details.text.contains("soh_i_")
		),
		"instance identity, finite charges and condition stay together"
	)
	_check(
		hud._core_readiness.text.contains("BLOCKED_PENDING_A4"),
		"readiness remains separate and owner supplied"
	)
	_check(
		hud._feedback.text.contains("PREVIEW") and hud._feedback.text.contains("CORE SECURED"),
		"committed fixture feedback is labeled preview and avoids rarity language"
	)
	_check(
		(
			hud.find_children("*", "Button", true, false).is_empty()
			and hud.mouse_filter == Control.MOUSE_FILTER_IGNORE
		),
		"passive HUD has no click target and ignores pointer input"
	)
	var pending := snapshot.duplicate(true)
	pending.feedback.status = "pending"
	_check(hud.set_projection(pending), "accept pending owner status")
	await process_frame
	_check(not hud._feedback.visible, "pending action does not announce loot or commit")
	var equipped := ADAPTER.core_instance(
		{
			"instance_id": "soh_i_000000000011_a1c0ffee",
			"item_id": "core_ember",
			"location": "bag",
			"uses": 8,
			"max_uses": 8,
			"condition": 91,
			"max_condition": 100,
			"revision": 4,
			"origin": "owner-record"
		},
		"Ember Core",
		true,
		false,
		false,
		"Not verified"
	)
	_check(
		(
			equipped.ownership_state == "Equipped · unused so far"
			and equipped.readiness == "Not verified"
		),
		"equipped unused Core is not labeled ready"
	)
	var stored := ADAPTER.core_ownership_state(
		{"location": "storage", "uses": 2, "max_uses": 8}, false
	)
	_check(stored == "Stored · not equipped", "stored Core state remains separate")
	var recovery := ADAPTER.core_ownership_state(
		{"location": "death_bag", "uses": 2, "max_uses": 8}, false
	)
	_check(
		recovery == "In recovery custody · owner state required",
		"recovery custody does not claim recoverability"
	)
	_check(
		hud.find_children("*", "Button", true, false).is_empty(),
		"HUD adds no automatic equip/cast action or interactive button"
	)
	var storage := ADAPTER.storage(
		FakeStorageSave.new(),
		FakeStorageSurvival.new(),
		"chest-1",
		{
			"soh_i_000000000011_a1c0ffee":
			{
				"instance_id": "soh_i_000000000011_a1c0ffee",
				"item_id": "core_ember",
				"location": "bag",
				"condition": 91,
				"max_condition": 100,
				"uses": 8,
				"max_uses": 8,
				"revision": 4,
				"origin": "fixture"
			}
		},
		{
			"core_ember":
			{"id": "core_ember", "label": "Ember Core", "kind": "skill_core", "storage": "instance"}
		}
	)
	var unique_row := {}
	var material_row := {}
	for row: Dictionary in storage.bag:
		if row.id == "soh_i_000000000011_a1c0ffee":
			unique_row = row
		if row.id == "oak_wood":
			material_row = row
	_check(
		storage.transfer_enabled == false and storage.context_validation == "A0 host required",
		"read-only storage projection does not authorize transfer"
	)
	_check(
		(
			unique_row.protected
			and not unique_row.transferable
			and unique_row.instance_id == "soh_i_000000000011_a1c0ffee"
			and unique_row.physical_item_id == "core_ember"
		),
		"A3 unique token maps to its physical Core without losing identity"
	)
	_check(
		(
			material_row.transferable
			and material_row.count == 5
			and material_row.stack_keys == ["oak_wood", "oak_wood_stack_2"]
			and storage.chest[0].count == 2
		),
		"aggregated material quantity preserves exact owner stack identities"
	)
	var hud_source := FileAccess.get_file_as_string("res://game/survival/ui/player_first_hud.gd")
	_check(
		(
			not hud_source.contains("Input.")
			and not hud_source.contains("_unhandled_input")
			and not hud_source.contains("_process(")
		),
		"passive HUD does not poll gameplay actions"
	)
	if failures.is_empty():
		print("A6 PLAYER-FIRST HUD PASSED - %d checks" % checks)
		quit(0)
	else:
		printerr("A6 PLAYER-FIRST HUD FAILED - %d/%d" % [failures.size(), checks])
		quit(1)
