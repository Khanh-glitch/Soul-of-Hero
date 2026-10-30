extends SceneTree
## Adversarial fixture using real A3 V5 and SaveService, not physical evidence.
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
var checks := 0
var failures := 0
var identity := {}
var cell := Vector2i(400, 217)

func _initialize() -> void:
	_run.call_deferred()
func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok: failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])
func _host(poi: String) -> Dictionary:
	var host := {"contract": "soh.economy.world_host.v1", "poi_id": poi, "hero_cell": [cell.x, cell.y], "discovered": true, "session_index": 0, "session_id": "fixture", "sequence": 0, "active_seconds": 0, "world_revision": "fixture"}
	host.merge(identity, true)
	return host
func _run() -> void:
	var save := root.get_node("SaveService")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	var path := "user://tests/roadside_capacity_%d.json" % Time.get_ticks_usec()
	_expect(bool(save.call(&"configure_storage", path, true)), "isolated real disk save")
	var adapter := Adapter.new()
	var port: Node = save.call(&"create_pinned_economy_port", adapter)
	_expect(port != null and bool(adapter.call(&"configure", port)), "real pinned V5 adapter")
	if port == null:
		_finish(); return
	adapter.call(&"configure_world_host", Callable(self, "_host"))
	var request := {"poi_id": "poi_crown_waystation", "action_id": "salvage_roadside_supplies_02", "instance_id": "si:r_ashen_crown:roadside_supply:02"}
	identity = {"world_instance_id": request.instance_id, "source_class_id": "sc_roadside_supply_cache_v1", "region_id": "r_ashen_crown"}
	var added := 0
	for n in range(35):
		if not bool(save.call(&"grant_inventory_item", "stone_chunk", "material", 50, "roadside.fill.%d" % n)): break
		added += 1
	_expect(added >= 2, "bag filled with real stacks")
	var full: Dictionary = save.call(&"get_snapshot")
	var r: Dictionary = adapter.call(&"world_action", request, "roadside.try.full")
	_expect(not bool(r.get("ok", true)) and str(r.get("reason", "")) == "inventory_full" and (save.call(&"get_snapshot") as Dictionary) == full, "full bag consumes no source, receipt or clock")
	_expect(bool(save.call(&"consume_inventory_item", "stone_chunk", 100, "roadside.free")), "freed two real bag slots")
	var before: Dictionary = save.call(&"inventory_totals")
	r = adapter.call(&"world_action", request, "roadside.try.full")
	var after: Dictionary = save.call(&"inventory_totals")
	_expect(bool(r.get("ok", false)) and int(after.get("iron_scrap", 0)) == int(before.get("iron_scrap", 0)) + 3 and int(after.get("knowledge_spares", 0)) == int(before.get("knowledge_spares", 0)) + 2, "retry after capacity grants exactly the V5 one-time reward")
	r = adapter.call(&"world_action", request, "roadside.try.full")
	_expect(bool(r.get("ok", false)) and bool(r.get("duplicate", false)) and (save.call(&"inventory_totals") as Dictionary) == after, "same event is idempotent")
	r = adapter.call(&"world_action", request, "roadside.try.again")
	_expect(not bool(r.get("ok", true)) and (save.call(&"inventory_totals") as Dictionary) == after, "new event cannot re-open one-time source")
	var durable: Dictionary = save.call(&"get_snapshot")
	var receipts: Dictionary = durable.world_slice.pois.poi_crown_waystation.reward_receipts
	_expect(receipts.has("a3src:r_ashen_crown:roadside_supply:02:claim:1") and int(durable.world_slice.pois.poi_crown_waystation.roadside_salvage_02_claim_count) == 1, "one canonical durable claim")
	_expect(bool(save.call(&"reload_save")) and (save.call(&"inventory_totals") as Dictionary) == after, "reload conserves reward")
	r = adapter.call(&"world_action", request, "roadside.try.again2")
	_expect(not bool(r.get("ok", true)) and (save.call(&"inventory_totals") as Dictionary) == after, "reload cannot revive one-time source")
	_finish()
func _finish() -> void:
	print("A0 A3 V5 ROADSIDE AUTHORITY %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
