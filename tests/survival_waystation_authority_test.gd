extends SceneTree
## Adversarial FIXTURE test of pinned A3 V3 + actual A0 SaveService. This does
## not prove player input, physical reach, production mount or OS restart.
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
var save: Node
var adapter: RefCounted
var port: Node
var checks := 0
var failures: Array[String] = []
var cell := Vector2i(408, 199)
var fixture_session := "fixture-world"
var fixture_index := 0
var fixture_sequence := 0
var fixture_seconds := 0
var discovered := true

func _initialize() -> void:
	_run.call_deferred()

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok: failures.append(label)
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _host(poi: String) -> Dictionary:
	return {"contract": "soh.economy.world_host.v1", "poi_id": poi, "hero_cell": [cell.x, cell.y],
		"discovered": discovered, "session_index": fixture_index, "session_id": fixture_session,
		"sequence": fixture_sequence, "active_seconds": fixture_seconds, "world_revision": "fixture"}

func _generic_world_edit(doc: Dictionary) -> bool:
	doc["world_slice"] = {"capabilities": ["cap_salvage"]}
	return true

func _run() -> void:
	save = root.get_node("SaveService")
	var path := "user://tests/waystation_authority_%d.json" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	_expect(bool(save.call(&"configure_storage", path, true)), "real SaveService isolated disk")
	var old: Dictionary = save.call(&"get_snapshot")
	_expect(not bool(save.call(&"transact_once", "fixture.world.spoof", Callable(self, "_generic_world_edit"), {})), "generic transaction cannot create world rights")
	_expect((save.call(&"get_snapshot") as Dictionary) == old, "rejected generic edit leaves no receipt or mutation")
	adapter = Adapter.new()
	port = save.call(&"create_pinned_economy_port", adapter)
	_expect(port != null, "production A0 shim and exact A3 V3 SHA bind real facade")
	if port == null:
		_finish(); return
	_expect(bool(adapter.call(&"configure", port)), "A3 V3 catalogs and canonical bindings configure")
	adapter.call(&"configure_world_host", Callable(self, "_host"))
	var locker := {"poi_id": "poi_crown_waystation", "action_id": "pry_locker"}
	var cache := {"poi_id": "poi_crown_waystation", "action_id": "cache_restock", "instance_id": "node_waystation_cache"}
	discovered = false
	var r: Dictionary = adapter.call(&"world_action", locker, "fixture.undiscovered")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "NOT_DISCOVERED", "undiscovered physical right rejected")
	discovered = true
	cell = Vector2i(407, 199)
	r = adapter.call(&"world_action", locker, "fixture.wrong.cell")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "OUT_OF_RANGE", "wrong stand rejected")
	cell = Vector2i(408, 199)
	var totals: Dictionary = save.call(&"inventory_totals")
	r = adapter.call(&"world_action", locker, "fixture.locker")
	_expect(bool(r.get("ok", false)) and (save.call(&"inventory_totals") as Dictionary) == totals, "locker grants capability and zero items")
	cell = Vector2i(406, 202)
	r = adapter.call(&"world_action", cache, "fixture.cache")
	totals = save.call(&"inventory_totals")
	_expect(bool(r.get("ok", false)) and int(totals.get("iron_scrap", 0)) == 3 and int(totals.get("knowledge_spares", 0)) == 2, "A3 commits canonical cache reward")
	var committed: Dictionary = save.call(&"get_snapshot")
	var poi: Dictionary = ((committed.get("world_slice", {}) as Dictionary).get("pois", {}) as Dictionary).get("poi_crown_waystation", {})
	_expect((poi.get("reward_receipts", {}) as Dictionary).has("a1slice:poi_crown_waystation:cache_restock:1"), "same candidate records canonical receipt")
	_expect(not bool(save.call(&"transact_once", "fixture.world.erase", Callable(self, "_generic_world_edit"), {})), "generic transaction cannot overwrite granted world rights")
	r = adapter.call(&"world_action", cache, "fixture.cache")
	_expect((save.call(&"inventory_totals") as Dictionary) == totals, "replayed original event grants nothing")
	r = adapter.call(&"world_action", cache, "fixture.cache.new")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "COOLDOWN" and (save.call(&"inventory_totals") as Dictionary) == totals, "new event cannot bypass cooldown")
	_expect(bool(save.call(&"reload_save")), "disk reload succeeds")
	var loaded: Dictionary = save.call(&"get_snapshot")
	_expect(loaded.get("world_slice", {}) == committed.get("world_slice", {}) and loaded.get("inventory", {}) == committed.get("inventory", {}) and loaded.get("applied_transactions", {}) == committed.get("applied_transactions", {}), "same-process disk reload preserves custody and rights")
	fixture_index += 1
	fixture_session = "fixture-world-after-reload"
	fixture_sequence = 0
	fixture_seconds = 0
	r = adapter.call(&"world_action", cache, "fixture.restart")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "COOLDOWN" and (save.call(&"inventory_totals") as Dictionary) == totals, "new session grants no offline cooldown")
	_finish()

func _finish() -> void:
	print("A0 WAYSTATION AUTHORITY %s - %d checks (FIXTURE)" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)
