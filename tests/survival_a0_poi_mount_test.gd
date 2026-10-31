extends "res://tests/survival_normal_input_gather_test.gd"
## WP-A0.5 — A0 site-mount authority against the REAL owner data.
##
## This test does not fabricate geography, an A1 cell or an A3 reward. It boots
## the production world, then asks the mount authority what the live owner data
## permits. Today that answer is a refusal for all three A8 sites, because A1's
## only runtime world document is 384x256 cells while the authored plan places
## those sites outside it. The refusal is the deliverable: it is named, it is
## measured from the shipped files, and it cannot be mistaken for a mount.
##
## What is proved here: identity resolution, cell agreement, extent refusal,
## A3 binding resolution/refusal, opt-in enforcement, and the entry/return
## receipt behaviour (unique, run-bound, unreplayable).
## What is NOT proved here: physical stand/enter/return/revisit at an A8 site.
## There is no reachable A8 site in the shipped world, so that stays NOT_TESTED.
const MOUNT_SCRIPT := preload("res://game/survival/a0_poi_mount.gd")
const A8_SITES := ["poi_crown_south_quarry", "poi_crown_south_orchard", "poi_crown_south_mill"]
const A8_CELLS := {
	"poi_crown_south_quarry": Vector2i(30, 280),
	"poi_crown_south_orchard": Vector2i(140, 360),
	"poi_crown_south_mill": Vector2i(120, 300),
}

var _mount: Node
var _world: Node


func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/survival_a0_poi_mount.json"
	ProjectSettings.set_setting("survival/a0_a8_site_mount", true)
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	await _boot()
	_world = _host.get_child(0) if _host != null and _host.get_child_count() > 0 else null
	_expect(_world != null, "the production overworld boots for the site-mount probe")
	if _world != null:
		await _body()
	_teardown()
	await process_frame
	_finish()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	ProjectSettings.set_setting("survival/a0_a8_site_mount", false)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("A0 POI MOUNT AUTHORITY PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 POI MOUNT AUTHORITY FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _body() -> void:
	_mount = MOUNT_SCRIPT.new()
	_mount.name = "A0PoiMountProbe"
	_world.add_child(_mount)
	var physical := _world.get(&"world") as OverworldWorld
	_expect(physical != null, "the live world exposes its physical extents")
	if physical == null:
		return
	_expect(physical.width == 384 and physical.height == 256,
		"A1's shipped runtime world is 384x256 cells (%dx%d)" % [physical.width, physical.height])

	# --- the three A8 sites are real identities A1 also knows ---------------
	for poi_id: String in A8_SITES:
		var report: Dictionary = _mount.call(&"probe", _world, poi_id)
		print("A0_POI_PROBE ", JSON.stringify({"poi_id": poi_id, "reason": report.get("reason", ""),
			"cell": report.get("cell", []), "bounds": report.get("world_bounds", [])}))
		_expect(String(report.get("reason", "")) == "A1_RUNTIME_WORLD_EXTENT_ABSENT",
			"%s is refused because A1's runtime world does not reach it (got %s)" % [poi_id, report.get("reason", "")])
		var cell: Array = report.get("cell", [])
		_expect(cell.size() == 2 and Vector2i(int(cell[0]), int(cell[1])) == A8_CELLS[poi_id],
			"%s resolves to A1's authored cell %s" % [poi_id, str(A8_CELLS[poi_id])])
		_expect(not bool(report.get("ok", true)), "%s cannot be mounted today" % poi_id)

	# --- identity refusals --------------------------------------------------
	var unknown: Dictionary = _mount.call(&"probe", _world, "poi_does_not_exist")
	_expect(String(unknown.get("reason", "")) == "A8_SITE_UNKNOWN",
		"an undeclared poi_id is refused as A8_SITE_UNKNOWN")
	# The waystation exists in A1 and carries A3 bindings, but A8 publishes no
	# site for it: a real POI outside an owner's package is still not mountable.
	var waystation: Dictionary = _mount.call(&"probe", _world, "poi_crown_waystation")
	_expect(String(waystation.get("reason", "")) == "A8_SITE_UNKNOWN",
		"A1-only POI is not mountable without an A8 package entry")

	# --- A3 reward authority is separate from the site ----------------------
	var quarry_intent: Dictionary = _mount.call(&"handle_intent", {
		"contract_id": "soh.native_poi.intent.v3", "contract_version": 3,
		"site_instance_id": "poi_crown_south_quarry", "action_id": "quarry_face_harvest",
	})
	_expect(String(quarry_intent.get("reason", "")) == "A3_BINDING_ABSENT",
		"an A8 action without an A3 binding grants nothing (A3_BINDING_ABSENT)")
	var cache_intent: Dictionary = _mount.call(&"handle_intent", {
		"contract_id": "soh.native_poi.intent.v3", "contract_version": 3,
		"site_instance_id": "poi_crown_waystation", "action_id": "cache_restock",
	})
	_expect(String(cache_intent.get("reason", "")) == "A0_INTENT_HOST_PENDING"
		and String(cache_intent.get("binding_id", "")) == "a1_waystation_roadside_cache_v3",
		"an A3-approved action resolves to its exact binding and still grants nothing from this path")

	# --- opt-in is enforced in both directions ------------------------------
	ProjectSettings.set_setting("survival/a0_a8_site_mount", false)
	var disabled: Dictionary = _mount.call(&"mount", _world, player_ref(), A8_SITES[0])
	_expect(String(disabled.get("reason", "")) == "mount_not_enabled",
		"with the setting off the authority refuses before any probe")
	ProjectSettings.set_setting("survival/a0_a8_site_mount", true)
	var refused: Dictionary = _mount.call(&"mount", _world, player_ref(), A8_SITES[0])
	_expect(not bool(refused.get("ok", true))
		and String(refused.get("reason", "")) == "A1_RUNTIME_WORLD_EXTENT_ABSENT",
		"with the setting on the extent refusal still wins: no node is added")
	_expect(_world.get_node_or_null("A8Site_" + A8_SITES[0]) == null,
		"no A8 site node exists in the shipped world")

	# --- entry/return receipts: unique, run-bound, unreplayable -------------
	var save := _save()
	var site_id := "si:r_ashen_crown:waystation_cache:01"
	var start := player_ref().global_position
	var first: Dictionary = _mount.call(&"begin_transition", save, site_id, start)
	_expect(bool(first.get("ok", false)), "one entry receipt is committed for a real site identity")
	var again: Dictionary = _mount.call(&"begin_transition", save, site_id, start)
	_expect(String(again.get("reason", "")) == "A0_ENTRY_RECEIPT_ALREADY_PRESENT",
		"a second entry for the same site is refused, not doubled")
	var stored: Variant = (_save().call(&"get_snapshot") as Dictionary).get("site_transition", {}).get(site_id, null)
	_expect(stored is Dictionary and (stored as Dictionary).get("position", []).size() == 2,
		"the exact overworld position is stored in the single SaveService")
	var back: Dictionary = _mount.call(&"finish_transition", save, site_id)
	_expect(bool(back.get("ok", false))
		and Vector2(back.get("position", Vector2.ZERO)).is_equal_approx(start),
		"the return restores the owner-recorded position exactly")
	_expect(((_save().call(&"get_snapshot") as Dictionary).get("site_transition", {}) as Dictionary).is_empty(),
		"the entry record is cleared by its own return")

	# A return carrying another run's identity must fail closed. The stale record
	# is written through the same public commit path a real transition uses; only
	# the run id is wrong, which is exactly the attack this check exists for.
	var injected := bool(save.call(&"transact_once", "test.inject.stale.site.%d" % Time.get_ticks_usec(),
		func(candidate: Dictionary) -> bool:
			candidate["site_transition"] = {site_id: {"site_instance_id": site_id,
				"position": [start.x, start.y], "run_id": "run-from-a-previous-run", "run_epoch": 0}}
			return true,
		{"kind": "test_inject_stale_site_identity"}))
	_expect(injected, "a stale entry record can be placed through the public commit path")
	var stale: Dictionary = _mount.call(&"finish_transition", save, site_id)
	_expect(not bool(stale.get("ok", true))
		and String(stale.get("reason", "")) == "A0_RUN_IDENTITY_MISMATCH",
		"a return from a previous run is refused (A0_RUN_IDENTITY_MISMATCH)")

	# The run boundary itself clears every entry record: a new run cannot inherit a
	# position or a site claim from the run that ended.
	var lifecycle := root.get_node_or_null("RunLifecycle")
	_expect(lifecycle != null, "the run lifecycle is the one run identity")
	if lifecycle != null:
		var ended: Dictionary = lifecycle.call(&"end_run", "voluntary_exit", "")
		_expect(bool(ended.get("ok", false)), "the run can be ended for a new epoch")
		var started: Dictionary = lifecycle.call(&"start_run", "run-a0-poi-epoch")
		_expect(bool(started.get("ok", false)), "a new run opens a new epoch")
		var after_boundary: Dictionary = _mount.call(&"finish_transition", save, site_id)
		_expect(not bool(after_boundary.get("ok", true)),
			"no return can be replayed into a new run")
		_expect(((_save().call(&"get_snapshot") as Dictionary).get("site_transition", {}) as Dictionary).is_empty(),
			"the run boundary leaves no entry record behind")
		print("A0_POI_TRANSITION ", JSON.stringify({"entry": first.get("key", ""),
			"stored": stored, "return_reason": stale.get("reason", ""),
			"after_boundary": after_boundary.get("reason", "")}))
	print("A0_POI_MOUNT_PHYSICAL_NOT_TESTED no A8 site is reachable in A1's 384x256 runtime world")


func player_ref() -> CharacterBody2D:
	return _world.get(&"player") as CharacterBody2D
