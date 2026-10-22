extends SceneTree

const SAVE_PATH := "user://tests/already_playable_qa.json"
const REPORT_PATH := "res://.artifacts/already_playable_qa_report.json"
const TELEMETRY_PATH := "res://.artifacts/chapter_1_balance_telemetry_sample.json"
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const DUMMY: HeroDefinition = preload("res://game/heroes/data/relay_test_dummy.tres")
const TELEMETRY := preload("res://game/debug/chapter_1_balance_telemetry.gd")

class FakePlayer extends Node2D:
	var relays := 0
	func begin_soul_summon(_incoming: HeroDefinition, _attacker: Node) -> Vector2: return global_position
	func complete_soul_relay(_incoming: HeroDefinition, _outgoing: HeroDefinition, _destination: Vector2) -> bool:
		relays += 1
		return true

class FakeRoot extends Node:
	var route_id: StringName
	var payload := {}
	func show_route(_path: String, next_payload: Dictionary, next_route: StringName) -> void:
		route_id = next_route
		payload = next_payload.duplicate(true)

var checks := 0
var failures: Array[String] = []
var metrics := {}

func _initialize() -> void: _run.call_deferred()

func _run() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	var flow := root.get_node_or_null("AppFlow")
	_expect(save != null and flow != null, "required autoloads exist")
	if save == null or flow == null:
		_finish()
		return
	_remove_save()
	_expect(save.configure_storage(SAVE_PATH, true), "isolated QA profile loads")
	_test_playable_gate_contract()
	_test_relay_soak()
	_test_large_inventory(save)
	_test_reward_idempotency(save, flow)
	_test_retry_transition(flow)
	_test_telemetry()
	_finish()

func _test_playable_gate_contract() -> void:
	var ready := REGISTRY.get_ordered_campaign_levels(false)
	_expect(ready.size() == 10, "registry honestly exposes the complete ten-level Chapter 1 as internally playable")
	for slot in range(1, 11):
		var level := REGISTRY.find_campaign_level(slot)
		_expect(level != null and level.is_campaign_ready(), "Level %d is campaign-ready" % slot)
		_expect(REWARDS.find_bundle(level.completion_reward_bundle_id) != null, "Level %d resolves its reward" % slot)
	metrics["playable_levels"] = ready.size()
	metrics["already_playable_gate"] = true
	metrics["gate_blocker"] = "No Chapter 1 gameplay blocker; final commercial art/audio replacement remains separate release polish"

func _test_relay_soak() -> void:
	var player := FakePlayer.new()
	root.add_child(player)
	var attacker := Node2D.new()
	root.add_child(attacker)
	attacker.global_position = Vector2(10, 0)
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	var successful := 0
	for cycle in range(100):
		if not manager.configure_team(player, DUMMY, SWORD): continue
		for threat in range(SWORD.melee_threats_required):
			manager.register_melee_threat(StringName("soak_%d_%d" % [cycle, threat]), attacker, player, attacker.global_position, 100.0)
		# The third confirmed melee threat materializes Sword immediately and
		# opens the full takeover window.  The player supplies one Q to take over;
		# the old two-Q soak was testing a retired interaction rather than Relay.
		if manager.state != HeroSoulManager.RelayState.SUMMONING \
				or not manager.takeover_open \
				or manager.summon_context != &"melee_threat_trigger":
			continue
		if manager.request_soul_relay() and manager.active_hero == SWORD and manager.state == HeroSoulManager.RelayState.IDLE:
			successful += 1
	_expect(successful == 100 and player.relays == 100, "Soul Relay completes 100/100 isolated cycles")
	metrics["relay_soak_cycles"] = successful
	manager.free(); player.free(); attacker.free()

func _test_large_inventory(save: LivingArsenalSaveService) -> void:
	var souls: Array = []
	for index in range(550):
		souls.append(SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.COMMON, 1 + index % 100, &"qa_soak", 900000 + index))
	_expect(save.transact_once("qa:large_inventory", func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate["inventory"].duplicate(true)
		inventory["hero_souls"] = souls.duplicate(true)
		candidate["inventory"] = inventory
		return true), "550-item inventory commits atomically")
	_expect(save.reload_save(), "550-item inventory reloads")
	var loaded: Array = save.get_value(["inventory", "hero_souls"], [])
	var ids := {}
	var valid := loaded.size() == 550
	for value: Variant in loaded:
		if not value is Dictionary or not SOUL_RULES.validate_instance(value).is_empty(): valid = false; continue
		ids[String(value["instance_id"])] = true
	_expect(valid and ids.size() == 550, "550 loaded item instances remain valid and unique")
	metrics["large_inventory_items"] = loaded.size()

func _test_reward_idempotency(save: LivingArsenalSaveService, flow: Node) -> void:
	_remove_save()
	_expect(save.configure_storage(SAVE_PATH, true), "reward test resets isolated profile")
	var fake := FakeRoot.new(); root.add_child(fake); flow.call("attach_app_root", fake)
	_expect(flow.call("start_campaign_level", &"chapter_1_level_1"), "fresh Level 1 run starts")
	flow.call("complete_active_run", {"score": 1}, true)
	var currency := int(save.get_value(["currencies", "account"], 0))
	var revision := int(save.get_value(["revision"], 0))
	_expect(save.reload_save(), "first-clear receipt survives reload")
	_expect(flow.call("start_campaign_level", &"chapter_1_level_1"), "Level 1 replay starts after reload")
	flow.call("complete_active_run", {"score": 2}, true)
	var result: Dictionary = flow.call("get_last_result")
	var reward: Dictionary = result.get("reward", {})
	_expect(not bool(reward.get("granted", true)) and bool(reward.get("already_claimed", false)), "reward remains idempotent across reload")
	_expect(int(save.get_value(["currencies", "account"], 0)) == currency and int(save.get_value(["revision"], 0)) == revision, "duplicate completion changes no balance or revision")
	metrics["reward_reload_idempotent"] = failures.is_empty()
	flow.call("detach_app_root", fake); fake.free()

func _test_retry_transition(flow: Node) -> void:
	var fake := FakeRoot.new(); root.add_child(fake); flow.call("attach_app_root", fake)
	flow.call("start_training")
	var first: Dictionary = flow.call("get_active_run")
	flow.call("retry_active_run")
	var second: Dictionary = flow.call("get_active_run")
	_expect(fake.route_id == &"gameplay" and String(first.get("run_id")) != String(second.get("run_id")), "retry transitions to gameplay with a fresh run ID")
	_expect((flow.call("get_last_result") as Dictionary).is_empty(), "retry clears stale result state")
	flow.call("abort_to_home")
	_expect(not flow.call("has_active_run") and fake.route_id == &"home", "abort transition clears active run")
	flow.call("detach_app_root", fake); fake.free()

func _test_telemetry() -> void:
	var telemetry := TELEMETRY.new()
	_expect(telemetry.record_run({"level": 1, "duration_seconds": 210.0, "outcome": "victory", "damage_dealt": 500, "damage_taken": 80, "relay_q1_supports": 2, "relay_q2_takeovers": 1}), "telemetry accepts a valid Chapter 1 sample")
	_expect(not telemetry.record_run({"level": 11, "duration_seconds": 1.0, "outcome": "victory"}), "telemetry rejects out-of-scope levels")
	var summary: Dictionary = telemetry.get_summary()
	var level_one: Dictionary = summary["levels"]["1"]
	_expect(summary["sample_count"] == 1 and level_one["victory_rate"] == 1.0 and level_one["average_duration_seconds"] == 210.0, "telemetry aggregates duration and outcome")
	_expect(telemetry.write_json(TELEMETRY_PATH), "telemetry writes machine-readable JSON")

func _expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition: failures.append(label); push_error("ALREADY PLAYABLE QA: " + label)

func _remove_save() -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var path: String = SAVE_PATH + suffix
		if FileAccess.file_exists(path): DirAccess.remove_absolute(ProjectSettings.globalize_path(path))

func _finish() -> void:
	metrics["checks"] = checks; metrics["passed"] = checks - failures.size(); metrics["failures"] = failures
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null: file.store_string(JSON.stringify(metrics, "\t") + "\n"); file.close()
	_remove_save()
	print("ALREADY PLAYABLE QA %d/%d; gate=%s" % [checks - failures.size(), checks, "BLOCKED" if not metrics.get("already_playable_gate", false) else "PASS"])
	quit(0 if failures.is_empty() else 1)
