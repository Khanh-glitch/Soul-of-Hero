extends SceneTree
## Run only in a clean fa0c119c checkout. Actual V3 service + SaveService;
## fixture host and direct adapter calls, never player-journey evidence.
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
var cell := Vector2i(408, 199)
var failures := 0
func _initialize() -> void: _run.call_deferred()
func _host(poi: String) -> Dictionary:
	return {"contract":"soh.economy.world_host.v1", "poi_id":poi, "hero_cell":[cell.x,cell.y], "discovered":true, "session_id":"real-v3-fixture", "session_index":0, "sequence":0, "active_seconds":0, "world_revision":"fixture"}
func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	var path := "user://tests/a3_real_v3_migration.json"
	if FileAccess.file_exists(path): DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	var save := root.get_node("SaveService")
	if not bool(save.call(&"configure_storage", path, true)): _fail("fresh V3 save")
	var a := Adapter.new()
	var port: Node = save.call(&"create_pinned_economy_port", a)
	if port == null or not bool(a.call(&"configure", port)):
		_fail("pinned V3 adapter"); _finish(); return
	a.call(&"configure_world_host", Callable(self, "_host"))
	var steps := [
		{"cell":Vector2i(408,199),"req":{"poi_id":"poi_crown_waystation","action_id":"pry_locker"},"event":"real-v3.locker"},
		{"cell":Vector2i(406,202),"req":{"poi_id":"poi_crown_waystation","action_id":"cache_restock","instance_id":"node_waystation_cache"},"event":"real-v3.cache"},
		{"cell":Vector2i(410,202),"req":{"poi_id":"poi_crown_waystation","action_id":"seal_ledger"},"event":"real-v3.ledger"},
		{"cell":Vector2i(398,201),"req":{"poi_id":"poi_crown_waystation","action_id":"gather_deadfall","instance_id":"node_waystation_approach_deadfall"},"event":"real-v3.deadfall"},
		{"cell":Vector2i(442,234),"req":{"poi_id":"poi_crown_relay_shed","action_id":"hand_crank_bypass"},"event":"real-v3.relay"},
	]
	for step: Dictionary in steps:
		cell = step.cell
		var r: Dictionary = a.call(&"world_action", step.req, step.event)
		if not bool(r.get("ok", false)): _fail(str(step.event) + ": " + str(r))
	var totals: Dictionary = save.call(&"inventory_totals")
	if int(totals.get("iron_scrap", 0)) != 1 or int(totals.get("knowledge_spares", 0)) != 2 or int(totals.get("oak_wood", 0)) != 1: _fail("V3 paid source totals")
	var f := FileAccess.open("user://tests/a3_real_v3_migration_audit.json", FileAccess.WRITE)
	if f == null: _fail("audit output")
	else:
		f.store_string(JSON.stringify(save.call(&"get_snapshot"), "\t", true, true)); f.close()
	_finish()
func _fail(s: String) -> void:
	failures += 1
	print("FAIL V3: " + s)
func _finish() -> void:
	print("A0 REAL V3 MIGRATION PRODUCER %s" % ("PASSED" if failures == 0 else "FAILED"))
	quit(0 if failures == 0 else 1)
