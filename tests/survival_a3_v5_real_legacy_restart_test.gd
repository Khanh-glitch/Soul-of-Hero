extends SceneTree
## Second OS process. Previous profile came from actual pinned V3 service,
## not this test's fabricated state. Both phases use fixture host coordinates.
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
const Migration = preload("res://game/survival/economy/a0_world_slice_v5_migration.gd")
const Diff = preload("res://tests/fixtures/a0_save_diff.gd")
var checks := 0
var failures := 0
func _initialize() -> void: _run.call_deferred()
func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok: failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])
func _host(poi: String) -> Dictionary:
	return {"contract":"soh.economy.world_host.v1", "poi_id":poi, "hero_cell":[406,202], "discovered":true, "session_id":"real-v5-fixture", "session_index":1, "sequence":0, "active_seconds":0, "world_revision":"fixture", "world_instance_id":"si:r_ashen_crown:waystation_cache:01", "interaction_node_id":"node_waystation_cache", "source_class_id":"sc_waystation_timed_cache_v1", "region_id":"r_ashen_crown", "canonical_poi_id":"poi_crown_waystation"}
func _same_values(a: Variant, b: Variant) -> bool:
	for difference: String in Diff.collect(a, b):
		if difference.begins_with("VALUE "): return false
	return true
func _run() -> void:
	var original: Variant = Diff.read_json("user://tests/a3_real_v3_migration_audit.json")
	_expect(original is Dictionary, "independent V3 producer audit exists")
	if not original is Dictionary: _finish(); return
	var save := root.get_node("SaveService")
	var path := "user://tests/a3_real_v3_migration.json"
	_expect(bool(save.call(&"configure_storage", path, true)), "V5 real SaveService migrates V3 primary")
	var current: Dictionary = save.call(&"get_snapshot")
	for section: String in ["inventory", "survival", "applied_transactions"]:
		_expect(_same_values(original.get(section), current.get(section)), "V3 " + section + " values conserved")
	var world: Dictionary = current.get("world_slice", {}).duplicate(true)
	if not world.is_empty():
		var way: Dictionary = world.pois.poi_crown_waystation
		for field: String in Migration.NEW_FIELDS:
			_expect(way.has(field) and int(way[field]) == 0, "new unclaimed field " + field)
			way.erase(field)
	_expect(_same_values(original.world_slice, world), "every legacy world value and canonical receipt conserved")
	_expect(FileAccess.file_exists(path + ".bak") and _same_values(Diff.read_json(path + ".bak"), original), "unmodified V3 snapshot retained as migration backup")
	var totals: Dictionary = save.call(&"inventory_totals")
	_expect(int(totals.get("iron_scrap",0)) == 1 and int(totals.get("knowledge_spares",0)) == 2 and int(totals.get("oak_wood",0)) == 1, "exact post-Relay inventory conserved")
	var adapter := Adapter.new()
	var port: Node = save.call(&"create_pinned_economy_port", adapter)
	_expect(port != null and bool(adapter.call(&"configure", port)), "V5 adapter attaches after migration")
	if port != null:
		adapter.call(&"configure_world_host", Callable(self, "_host"))
		var old := {"poi_id":"poi_crown_waystation", "action_id":"cache_restock", "instance_id":"node_waystation_cache"}
		var r: Dictionary = adapter.call(&"world_action", old, "real-v3.cache")
		_expect(not bool(r.get("ok", true)) and str(r.get("reason", "")) == "event_id_conflict", "legacy event signature fails closed after migration")
		old.instance_id = "si:r_ashen_crown:waystation_cache:01"
		r = adapter.call(&"world_action", old, "real-v5.cache.new")
		_expect(not bool(r.get("ok", true)) and str(r.get("reason", "")) == "COOLDOWN" and (save.call(&"inventory_totals") as Dictionary) == totals, "no offline credit or duplicate via physical SI")
	_finish()
func _finish() -> void:
	print("A0 REAL V3 TO V5 RESTART %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
