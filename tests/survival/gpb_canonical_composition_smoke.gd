extends SceneTree
## GP-B isolated native smoke: verify R13 canonical service is mounted with
## the existing A0 SaveService restricted economy port. NOT player acceptance.
const Pins = preload("res://game/survival/economy/a0_v5_source_pins.gd")
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
const Custody = preload("res://game/survival/economy/a3_economy_service.gd")
var _checks := 0

func _initialize() -> void:
	_run.call_deferred()

func _reject(reason: String) -> void:
	printerr("GPB_NATIVE_FAIL " + reason)
	quit(1)

func _check(condition: bool, name: String) -> bool:
	if not condition:
		_reject(name)
		return false
	_checks += 1
	return true

func _empty_station(_id: String) -> Dictionary:
	return {}

func _run() -> void:
	if not _check(Pins.verify().is_empty(), "A3_OWNER_CATALOG_PIN"): return
	var save := root.get_node_or_null("SaveService")
	if not _check(save != null, "A0_SAVE_AUTOLOAD"): return
	var adapter := Adapter.new()
	var port: Node = save.call(&"create_pinned_economy_port", adapter)
	if not _check(port != null, "CANONICAL_ADAPTER_HASH_PIN"): return
	if not _check(bool(adapter.configure(port, Callable(self, "_empty_station"))), "CANONICAL_CATALOG_CONFIGURATION"): return
	if not _check(adapter.jobs() is Dictionary, "ONE_CANONICAL_QUEUE"): return
	var custody := Custody.new()
	var custody_script := custody.get_script() as Script
	print("GPB_CUSTODY_DIAG script_path=%s identity=%s sha=%s" % [
		String(custody_script.resource_path),
		str(custody_script == Custody),
		String(custody_script.source_code).sha256_text()])
	var custody_port: Node = save.call(&"create_pinned_source_custody_port", custody)
	if not _check(custody_port != null, "PINNED_CUSTODY_CAPABILITY_PORT"): return
	if not _check(bool(custody.configure(custody_port, adapter)), "A3_SOURCE_CUSTODY_CONFIGURATION"): return
	if not _check(not custody.a8_authorization().get("approved", false), "QUARRY_UNAUTHORISED_FAIL_CLOSED"): return
	var spoof := custody.authenticate_source({"source_id":"a1_waystation_roadside_cache_v3","owner":"A1"})
	if not _check(not bool(spoof.get("ok", false)), "OWNER_STRING_MUST_NOT_AUTHORIZE"): return
	if not _check(not custody.is_source_authenticated("a1_waystation_roadside_cache_v3"), "NO_PHANTOM_SOURCE_RIGHT"): return
	var current := save.call(&"get_snapshot") as Dictionary
	var state := current.get("mastery", {}) as Dictionary
	if not _check(not state.has("a3_station_jobs") and not state.has("a3_learned_recipes"), "NO_PARALLEL_A3_AUTHORITY"): return
	print("GPB_NATIVE_SMOKE_PASS checks=%d canonical=R13 custody=fail_closed" % _checks)
	quit(0)
