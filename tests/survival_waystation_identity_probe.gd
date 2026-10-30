extends SceneTree
## Read-only test of the exact physical request against pinned V3 planning.
## This is not an alias, claim, receipt, movement or integration acceptance.
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
	_expect(configured, "real pinned A3 V3 adapter configured")
	if configured:
		var actual: Dictionary = Host.POINTS.cache
		var request := {"poi_id": Host.POI, "action_id": String(actual.action), "instance_id": String(actual.instance)}
		var world: Dictionary = adapter.call(&"_world_read", {})
		var result: Dictionary = adapter.call(&"_world_plan", world, request)
		print("A0_IDENTITY exact_physical_request=%s preflight=%s" % [str(request), str(result)])
		_expect(String(request.instance_id) == "si:r_ashen_crown:waystation_cache:01", "request is exact A1 physical instance")
		_expect(String(result.get("reason", "")) == "unknown_source_instance", "owner V3 rejects physical identity in planning before mutation")
		var bound := request.duplicate(true)
		bound.instance_id = "node_waystation_cache"
		var bound_plan: Dictionary = adapter.call(&"_world_plan", world, bound)
		_expect(String(bound_plan.get("kind", "")) == "source", "V3 exact node binding exists")
		_expect(String(bound_plan.get("key", "")) == "a1slice:poi_crown_waystation:cache_restock:1", "V3 bound node resolves canonical claim key")
		_expect((bound_plan.get("binding", {}) as Dictionary).get("stand_cells", []) == [[406.0, 202.0]], "V3 physical stand coordinates are unchanged")
	print("A0 WAYSTATION IDENTITY PROBE %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
