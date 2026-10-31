extends SceneTree
## Read-only test of exact physical identity against pinned V3 and V5 planning.
## This is not an alias, claim, receipt, movement or integration acceptance.
const Old = preload("res://game/survival/economy/vendor/a3_world_source_c23292be.gd")
const Host = preload("res://game/survival/waystation_host.gd")
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
var checks := 0
var failures := 0

func _initialize() -> void:
	_run.call_deferred()

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok: failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _run() -> void:
	var adapter := Adapter.new()
	var configured: bool = adapter.call(&"configure", root.get_node("SaveService").call(&"create_pinned_economy_port", adapter))
	_expect(configured, "real pinned A3 V5 adapter configured")
	if configured:
		var actual: Dictionary = Host.POINTS.cache
		var request := {"poi_id": Host.POI, "action_id": String(actual.action), "instance_id": String(actual.instance)}
		var world: Dictionary = adapter.call(&"_world_read", {})
		var result: Dictionary = adapter.call(&"_world_plan", world, request)
		print("A0_IDENTITY exact_physical_request=%s preflight=%s" % [str(request), str(result)])
		_expect(String(request.instance_id) == "si:r_ashen_crown:waystation_cache:01", "request is exact A1 physical instance")
		var f := FileAccess.open("res://data/survival/connector/a0_legacy/world_source_bindings.c23292be.v3.json", FileAccess.READ)
		var legacy: Dictionary = JSON.parse_string(f.get_as_text()) if f != null else {}
		_expect(Old.binding_for(legacy, Host.POI, "cache_restock", request.instance_id).is_empty(), "legacy V3 rejected exact SI before mutation")
		_expect(String(result.get("kind", "")) == "source", "V5 plans the exact A1 physical SI")
		var bound := request.duplicate(true)
		bound.instance_id = "node_waystation_cache"
		var bound_plan: Dictionary = adapter.call(&"_world_plan", world, bound)
		_expect(String(bound_plan.get("kind", "")) == "source", "V5 explicitly authorizes V3 node alias")
		_expect(String(bound_plan.get("key", "")) == "a1slice:poi_crown_waystation:cache_restock:1", "alias resolves canonical claim key")
		_expect((bound_plan.get("binding", {}) as Dictionary).get("stand_cells", []) == [[406.0, 202.0]], "physical stand coordinates are unchanged")
		_expect(result.get("key", "") == bound_plan.get("key", ""), "SI and explicit alias share exactly one claim")
		var foreign := request.duplicate(true)
		foreign.instance_id = "si:r_ashen_crown:waystation_cache:99"
		var refused: Dictionary = adapter.call(&"_world_plan", world, foreign)
		_expect(String(refused.get("reason", "")) == "unknown_source_instance", "foreign physical SI fails closed")
	print("A0 WAYSTATION IDENTITY PROBE %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
