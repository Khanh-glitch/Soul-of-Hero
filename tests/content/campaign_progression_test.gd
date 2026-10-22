extends Node

const CAMPAIGN_PLAN: CampaignProgressionPlan = preload("res://data/content/progression/soul_hero_campaign_plan.tres")
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REPORT_PATH := "res://.artifacts/campaign_progression_report.json"

var _checks := 0
var _failures: Array[String] = []


class FakeSaveService extends Node:
	var snapshot := {
		"progression": {
			"campaign": {
				"chapter": 1,
				"level": 4,
				"unlocked_levels": ["chapter_1_level_5"],
				"completed_levels": {},
				"optional_objectives": {},
			},
			"unlocked_heroes": {"sword_hero": true},
			"features": {"soul_hero": false, "soul_relay": false},
		},
		"soul_team": {
			"active_hero": "sword_hero",
			"reserve_souls": ["", ""],
			"capacity": 2,
		},
		"applied_transactions": {},
	}


	func get_snapshot() -> Dictionary:
		return snapshot.duplicate(true)


	func transact_once(transaction_key: String, mutator: Callable, metadata: Dictionary = {}) -> bool:
		if snapshot["applied_transactions"].has(transaction_key):
			return false
		var candidate: Dictionary = snapshot.duplicate(true)
		if not bool(mutator.call(candidate)):
			return false
		candidate["applied_transactions"][transaction_key] = {"metadata": metadata.duplicate(true)}
		snapshot = candidate
		return true


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_approved_plan()
	_test_atomic_runtime_boundary()
	_test_validation_guards()
	_finish()


func _test_approved_plan() -> void:
	_expect(CAMPAIGN_PLAN != null, "campaign Hero progression plan loads")
	if CAMPAIGN_PLAN == null:
		return
	var errors := CAMPAIGN_PLAN.get_validation_errors()
	_expect(errors.is_empty(), "approved campaign Hero plan validates: %s" % "; ".join(errors))
	var archer := CAMPAIGN_PLAN.find_milestone(&"chapter_1_level_5_archer_recruitment")
	_expect(archer != null and archer.campaign_slot == 5 and archer.chapter_number == 1, "Archer recruitment belongs to Chapter 1 Level 5")
	_expect(archer != null and archer.boss_enemy_id == &"hooded_archer_miniboss", "Hooded Archer guards the authored physical Soul recovery")
	_expect(archer != null and archer.recruited_hero_id == &"archer_hero", "Level 5 pickup recruits the canonical Archer Hero")
	_expect(archer != null and archer.granted_feature_ids == PackedStringArray(["soul_hero", "soul_relay"]), "Archer pickup unlocks the Soul Hero and Soul Relay core together")
	_expect(archer != null and not archer.assign_recruited_hero_to_first_reserve, "Archer pickup never silently edits the Soul Team")
	_expect(
		archer != null
			and archer.implementation_status == CampaignMilestoneDefinition.ImplementationStatus.CONTENT_READY
			and not archer.is_playable_now(),
		"Archer milestone is CONTENT_READY while the legacy progression service remains disabled as a reward authority"
	)
	_expect(
		archer != null
			and archer.status_note.contains("generic LootDirector and GroundLoot reward core")
			and archer.status_note.contains("runtime only observes the physical pickup"),
		"Archer milestone keeps generic loot/pickup as authority and the Level 5 runtime as an observer",
	)

	var phase := CAMPAIGN_PLAN.find_narrative_phase(5)
	_expect(phase != null and phase.start_campaign_slot == 5 and phase.end_campaign_slot == 10, "Sword+Archer escape phase spans Levels 5-10")
	_expect(phase != null and phase.featured_hero_ids == PackedStringArray(["sword_hero", "archer_hero"]), "escape phase explicitly features Sword and Archer")
	_expect(CAMPAIGN_PLAN.find_narrative_phase(10) == phase and CAMPAIGN_PLAN.find_narrative_phase(11) == null, "escape phase includes Level 10 and ends before Chapter 2")

	_expect(CAMPAIGN_PLAN.find_milestone(&"chapter_2_level_15_axe_recruitment") == null, "Axe retreat at Level 15 is not a Hero recruitment milestone")
	var wizard := CAMPAIGN_PLAN.find_milestone(&"chapter_2_level_20_wizard_recruitment")
	_expect(wizard != null and wizard.campaign_slot == 20 and wizard.chapter_number == 2, "Wizard recruitment is reserved for global Level 20 in Chapter 2")
	_expect(wizard != null and wizard.boss_enemy_id == &"wizard_hero_boss" and wizard.recruited_hero_id == &"wizard_hero", "Wizard pickup is the canonical Chapter 2 Hero recruitment")
	_expect(
		wizard != null
			and wizard.implementation_status == CampaignMilestoneDefinition.ImplementationStatus.PLAYABLE
			and wizard.is_playable_now(),
		"Wizard milestone is PLAYABLE now that Level 20 owns the physical pickup runtime",
	)
	_expect(
		wizard != null
			and wizard.status_note.contains("generic LootDirector and GroundLoot")
			and wizard.status_note.contains("ChapterTwoLevelRuntime only observes"),
		"Wizard milestone keeps the generic physical pickup as its only reward authority",
	)

	var level_5 := CAMPAIGN_REGISTRY.find_campaign_level(5)
	_expect(level_5 != null and level_5.is_campaign_ready(), "Level 5 map and guardian run are registered as playable")
	_expect(not archer.is_playable_now(), "playable Level 5 keeps the legacy milestone from becoming a second reward authority")
	var level_11 := CAMPAIGN_REGISTRY.find_campaign_level(11)
	var level_15 := CAMPAIGN_REGISTRY.find_campaign_level(15)
	var level_20 := CAMPAIGN_REGISTRY.find_campaign_level(20)
	_expect(level_11 != null and level_11.is_campaign_ready(), "Chapter 2 begins with a playable Level 11 registry entry")
	_expect(level_15 != null and level_15.is_campaign_ready(), "Axe retreat is registered as a playable Chapter 2 Level 15 encounter")
	_expect(level_20 != null and level_20.is_campaign_ready(), "Wizard Soul pickup is registered as a playable Chapter 2 Level 20 encounter")
	_expect(CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false).size() == 20, "Campaign registry exposes all twenty playable levels")


func _test_atomic_runtime_boundary() -> void:
	var legacy_service := CampaignProgressionService.new()
	var legacy_save := FakeSaveService.new()
	_expect(legacy_service.configure(CAMPAIGN_PLAN, legacy_save), "legacy runtime service accepts the valid authored plan")
	_expect(not legacy_service.apply_boss_defeat(&"chapter_1_level_5_archer_recruitment", &"hooded_archer_miniboss", &"chapter_1_level_5"), "CONTENT_READY milestone cannot bypass the physical pickup transaction")
	_expect(not legacy_save.snapshot["progression"]["unlocked_heroes"].has("archer_hero"), "disabled legacy authority mutates no Archer ownership")

	var playable_milestone := _make_playable_wizard_milestone()
	var playable_plan := CampaignProgressionPlan.new()
	playable_plan.plan_id = &"test_playable_progression"
	playable_plan.milestones = [playable_milestone]
	var service := CampaignProgressionService.new()
	var save := FakeSaveService.new()
	_expect(service.configure(playable_plan, save), "runtime service accepts a synthetic playable milestone")
	_expect(not service.apply_boss_defeat(playable_milestone.milestone_id, &"hooded_archer_miniboss", playable_milestone.level_id), "wrong defeated boss cannot trigger Wizard recruitment")
	_expect(not service.apply_boss_defeat(playable_milestone.milestone_id, playable_milestone.boss_enemy_id, &"chapter_2_level_19"), "wrong source level cannot trigger Wizard recruitment")

	var recruited: Array[StringName] = []
	var features: Array[StringName] = []
	service.hero_recruited.connect(func(hero_id: StringName) -> void: recruited.append(hero_id))
	service.feature_granted.connect(func(feature_id: StringName) -> void: features.append(feature_id))
	_expect(not service.apply_boss_defeat(playable_milestone.milestone_id, playable_milestone.boss_enemy_id, playable_milestone.level_id), "matching boss defeat still cannot bypass the physical Soul pickup")
	var progression: Dictionary = save.snapshot["progression"]
	_expect(not bool(progression["unlocked_heroes"].get("wizard_hero", false)), "boss defeat persists no Wizard identity")
	_expect(not bool(progression["features"].get("wizard_hero", false)), "boss defeat persists no pickup-owned Wizard feature")
	var completed_milestones: Dictionary = progression["campaign"].get("completed_milestones", {})
	_expect(not bool(completed_milestones.get(String(playable_milestone.milestone_id), false)), "boss defeat writes no recruitment milestone receipt")
	_expect(save.snapshot["soul_team"]["reserve_souls"][0] == "", "boss defeat never edits Reserve")
	_expect(recruited.is_empty() and features.is_empty(), "rejected boss-only recruitment emits no unlock signals")
	_expect(not service.apply_boss_defeat(playable_milestone.milestone_id, playable_milestone.boss_enemy_id, playable_milestone.level_id), "duplicate boss signal cannot apply the transaction twice")
	_expect(recruited.is_empty() and features.is_empty(), "duplicate boss signal emits no unlock celebration")
	legacy_service.free()
	legacy_save.free()
	service.free()
	save.free()


func _test_validation_guards() -> void:
	var malformed := _make_playable_wizard_milestone()
	malformed.chapter_number = 1
	var errors := malformed.get_validation_errors()
	_expect(_has_error(errors, "belongs to chapter 2"), "milestone validator catches a slot/chapter mismatch")
	var auto_equip := _make_playable_wizard_milestone()
	auto_equip.assign_recruited_hero_to_first_reserve = true
	_expect(_has_error(auto_equip.get_validation_errors(), "explicit wardrobe Equip"), "milestone validator rejects pickup-driven auto-equip")
	var broken_phase := CampaignNarrativePhaseDefinition.new()
	broken_phase.phase_id = &"broken_phase"
	broken_phase.status_note = "test"
	broken_phase.start_campaign_slot = 10
	broken_phase.end_campaign_slot = 5
	broken_phase.narrative_goal = "test"
	_expect(_has_error(broken_phase.get_validation_errors(), "end slot cannot precede"), "narrative phase validator catches a reversed range")

	var final_milestone := _make_playable_wizard_milestone()
	final_milestone.milestone_id = &"chapter_10_final_recruitment"
	final_milestone.campaign_slot = 100
	final_milestone.chapter_number = 10
	final_milestone.level_id = &"chapter_10_level_100"
	final_milestone.reward_transaction_id = &"test:chapter_10_level_100:recruitment"
	_expect(final_milestone.get_validation_errors().is_empty(), "milestone validator accepts campaign slot 100 in Chapter 10")
	final_milestone.chapter_number = 9
	_expect(_has_error(final_milestone.get_validation_errors(), "belongs to chapter 10"), "milestone validator derives Chapter 10 from campaign slot 100")

	var final_phase := CampaignNarrativePhaseDefinition.new()
	final_phase.phase_id = &"chapter_10_finale"
	final_phase.status_note = "Synthetic Chapter 10 narrative boundary."
	final_phase.start_campaign_slot = 91
	final_phase.end_campaign_slot = 100
	final_phase.narrative_goal = "Verify the final campaign chapter range."
	_expect(final_phase.get_validation_errors().is_empty(), "narrative phase validator accepts the Chapter 10 range")
	final_phase.end_campaign_slot = 101
	_expect(_has_error(final_phase.get_validation_errors(), "slots 1-100"), "narrative phase validator rejects campaign slot 101")


func _make_playable_wizard_milestone() -> CampaignMilestoneDefinition:
	var milestone := CampaignMilestoneDefinition.new()
	milestone.milestone_id = &"test_wizard_recruitment"
	milestone.implementation_status = CampaignMilestoneDefinition.ImplementationStatus.PLAYABLE
	milestone.status_note = "Synthetic runtime contract for isolated verification."
	milestone.campaign_slot = 20
	milestone.chapter_number = 2
	milestone.level_id = &"chapter_2_level_20"
	milestone.boss_enemy_id = &"wizard_hero_boss"
	milestone.recruited_hero_id = &"wizard_hero"
	milestone.granted_feature_ids = PackedStringArray(["wizard_hero"])
	milestone.reward_transaction_id = &"test:chapter_2_level_20:wizard_recruitment"
	milestone.assign_recruited_hero_to_first_reserve = false
	milestone.narrative_summary = "Synthetic Wizard recruitment."
	return milestone


func _has_error(errors: PackedStringArray, fragment: String) -> bool:
	for message: String in errors:
		if message.contains(fragment):
			return true
	return false


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _finish() -> void:
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t"))
	if _failures.is_empty():
		print("CAMPAIGN PROGRESSION TEST PASSED - %d checks" % _checks)
	else:
		print("CAMPAIGN PROGRESSION TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	get_tree().quit(exit_code)
