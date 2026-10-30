extends SceneTree
## Two-OS-process world cooldown/receipt proof. Run the SAME save path in two
## separate Godot invocations: A3_RESTART_PHASE=1 writes, A3_RESTART_PHASE=2
## reloads in a fresh process/session. This is a native SaveService fixture, not
## an A0 production mount and not a human playtest.
const Economy = preload("res://game/survival/economy/economy_service.gd")
const SAVE_PATH := "user://tests/a3_world_restart_shared.json"
const EXPECTED_PATH := "user://tests/a3_world_restart_expected.json"
const WORLD_CONTRACT := "soh.economy.world_host.v1"
var failures: Array[String] = []
var checks := 0
var save: Node
var eco: RefCounted
var session_index := 1
var session_id := "restart-world-1"
var active_seconds := 0
var sequence := 0
var revision := 1
var hero_cell := Vector2i(408, 199)

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _world_host(poi_id: String) -> Dictionary:
	return {"contract": WORLD_CONTRACT, "poi_id": poi_id, "discovered": true,
		"hero_cell": hero_cell, "active_seconds": active_seconds,
		"session_id": session_id, "session_index": session_index,
		"sequence": sequence, "world_revision": revision}

func _resolve(_id: String) -> Dictionary:
	return {}

func _count(id: String) -> int:
	return int(eco.inventory_totals().get(id, 0))

func _run() -> void:
	var phase := OS.get_environment("A3_RESTART_PHASE")
	if phase != "1" and phase != "2":
		print("A3 RESTART FAILED - set A3_RESTART_PHASE=1 or 2")
		quit(1); return
	save = get_root().get_node_or_null("SaveService")
	if save == null:
		save = SaveService.new()
		save.name = "SaveService"
		get_root().add_child(save)
	_expect(bool(save.call(&"configure_storage", SAVE_PATH, phase == "1")), "configure shared save phase " + phase)
	eco = Economy.new()
	_expect(eco.configure(save, _resolve), "configure economy phase " + phase)
	eco.configure_world_host(_world_host)
	if phase == "1":
		_phase_one()
	else:
		_phase_two()
	if failures.is_empty():
		print("A3 WORLD RESTART PHASE %s PASSED - %d checks" % [phase, checks])
		quit(0)
	else:
		print("A3 WORLD RESTART PHASE %s FAILED - %d/%d" % [phase, failures.size(), checks])
		for f in failures: print("  - " + f)
		quit(1)

func _phase_one() -> void:
	session_index = 1
	session_id = "restart-world-1"
	active_seconds = 0
	sequence = 0
	hero_cell = Vector2i(408, 199)
	var locker: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "pry_locker"}, "restart.locker")
	_expect(bool(locker.ok), "phase1 locker capability")
	hero_cell = Vector2i(406, 202)
	var claim: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock",
		"instance_id": "si:r_ashen_crown:waystation_cache:01"}, "restart.cache.1")
	_expect(bool(claim.ok) and String(claim.transaction_key) == "a1slice:poi_crown_waystation:cache_restock:1", "phase1 canonical cache claim")
	_expect(_count("iron_scrap") == 3 and _count("knowledge_spares") == 2, "phase1 canonical quantities")
	var expected := {"scrap": _count("iron_scrap"), "spares": _count("knowledge_spares"),
		"transaction_key": String(claim.transaction_key), "session_index": session_index}
	var file := FileAccess.open(EXPECTED_PATH, FileAccess.WRITE)
	_expect(file != null, "phase1 writes expected marker")
	if file != null:
		file.store_string(JSON.stringify(expected))
		file.close()

func _phase_two() -> void:
	# Fresh OS process: host counters restart at zero and the session index rises.
	session_index = 2
	session_id = "restart-world-2"
	active_seconds = 0
	sequence = 0
	hero_cell = Vector2i(406, 202)
	var file := FileAccess.open(EXPECTED_PATH, FileAccess.READ)
	_expect(file != null, "phase2 reads expected marker")
	if file == null: return
	var expected: Dictionary = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(_count("iron_scrap") == int(expected.get("scrap", -1)) and _count("knowledge_spares") == int(expected.get("spares", -1)), "phase2 reload conserves inventory exactly")
	var replay: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock",
		"instance_id": "si:r_ashen_crown:waystation_cache:01"}, "restart.cache.1")
	_expect(bool(replay.ok) and String(replay.result) == "ALREADY_APPLIED", "phase2 same event id is idempotent across OS restart")
	_expect(String(replay.transaction_key) == String(expected.get("transaction_key", "")), "phase2 replay returns original canonical key")
	var early: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock",
		"instance_id": "node_waystation_cache"}, "restart.cache.early")
	_expect(not bool(early.ok) and String(early.reason) == "COOLDOWN", "phase2 node alias cannot reclaim before cooldown")
	_expect(int(early.get("remaining_active_seconds", 0)) == 1800, "phase2 no offline credit: full 1800 active seconds remain")
	active_seconds = 1799
	sequence = 1
	var tick: Dictionary = eco.advance_world_time("poi_crown_waystation", "restart.time.1799")
	_expect(bool(tick.ok), "phase2 advances 1799 active seconds")
	var still: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock",
		"instance_id": "si:r_ashen_crown:waystation_cache:01"}, "restart.cache.still")
	_expect(not bool(still.ok) and int(still.get("remaining_active_seconds", 0)) == 1, "phase2 one active second remains")
	active_seconds = 1800
	sequence = 2
	var ready: Dictionary = eco.advance_world_time("poi_crown_waystation", "restart.time.1")
	_expect(bool(ready.ok), "phase2 advances final active second")
	var claim2: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock",
		"instance_id": "si:r_ashen_crown:waystation_cache:01"}, "restart.cache.2")
	_expect(bool(claim2.ok) and String(claim2.transaction_key) == "a1slice:poi_crown_waystation:cache_restock:2", "phase2 generation 2 after real active time")
	_expect(_count("iron_scrap") == 6 and _count("knowledge_spares") == 4, "phase2 exactly one additional canonical reward")
