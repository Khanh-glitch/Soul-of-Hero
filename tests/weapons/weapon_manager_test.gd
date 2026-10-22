extends SceneTree

const MANAGER_SCRIPT := preload("res://game/weapons/weapon_manager.gd")
const SWORD: WeaponDefinition = preload("res://game/weapons/data/sword.tres")
const BOW: WeaponDefinition = preload("res://game/weapons/data/bow.tres")
const AXE: WeaponDefinition = preload("res://game/weapons/data/axe.tres")

var _checks := 0
var _failures: Array[String] = []
var _swap_requests: Array[Dictionary] = []
var _swaps: Array[Dictionary] = []
var _spirit_actions: Array[Dictionary] = []
var _combo_resets: Array[StringName] = []
var _precast_cancellations: Array[StringName] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(SWORD.is_valid_definition(), "Sword definition validates")
	_expect(BOW.is_valid_definition(), "Bow definition validates")
	_expect(AXE.is_valid_definition(), "Axe definition validates")
	_expect(SWORD.normal_attack.combo_count == 3, "Sword has a three-hit Hand combo")
	_expect(SWORD.spirit_trigger.confirmed_event == &"hand_attack_instance_created" and SWORD.spirit_trigger.required_count == 3, "Sword Spirit requires three confirmed attack instances")
	_expect(BOW.spirit_trigger.confirmed_event == &"dash_started", "Bow Spirit listens to confirmed Dash")
	_expect(BOW.spirit_action.reverse_confirmed_event_vector, "Bow Spirit reverses the confirmed Dash vector")
	_expect(AXE.spirit_trigger.confirmed_event == &"hand_skill_resolved", "Axe Spirit listens to confirmed Hand-skill resolution")
	_expect(AXE.spirit_trigger.require_truthy_context_value and AXE.spirit_trigger.deduplication_context_key == &"skill_instance_id", "Axe Spirit requires a meaningful endpoint and stable skill receipt")

	var manager := MANAGER_SCRIPT.new() as WeaponManager
	root.add_child(manager)
	manager.set_process(false)
	manager.weapon_swap_requested.connect(_on_swap_requested)
	manager.weapon_swapped.connect(_on_weapon_swapped)
	manager.spirit_action_started.connect(_on_spirit_action_started)
	manager.hand_combo_reset.connect(_on_hand_combo_reset)
	manager.spirit_action_cancel_requested.connect(_on_spirit_action_cancel_requested)
	_expect(manager.configure_loadout(SWORD, [BOW], false), "one Hand plus one Spirit loadout configures")
	_expect(manager.get_active_spirit_slot_count() == 1, "second Spirit slot starts feature-gated")
	_expect(not manager.request_swap(1), "locked second Spirit slot cannot be selected")

	_expect(manager.notify_hand_attack_started() == 1, "Sword combo begins at hit one")
	_expect(manager.request_hand_skill(), "Sword Hand skill starts when ready")
	_expect(is_equal_approx(manager.get_hand_skill_cooldown_remaining(&"sword"), 4.0), "Sword Hand-skill cooldown comes from data")
	manager.notify_dash_started(Vector2.RIGHT)
	_expect(_spirit_actions.size() == 1 and _spirit_actions[0].weapon_id == &"bow", "Dash triggers Bow Spirit while Bow occupies a Spirit slot")
	_expect((_spirit_actions[0].context.action_direction as Vector2).is_equal_approx(Vector2.LEFT), "Reverse Piercing Shot receives the exact reverse Dash direction")
	_expect(is_equal_approx(manager.get_spirit_action_cooldown_remaining(&"bow"), 2.0), "Bow Spirit action starts its independent cooldown")
	manager.notify_spirit_effect_created(&"bow")

	manager.notify_action_uninterruptible()
	_expect(manager.request_swap(0), "valid swap request is accepted during an uninterruptible action")
	_expect(_swap_requests.size() == 1 and bool(_swap_requests[0].queued), "uninterruptible swap request is explicitly queued")
	manager.advance_time(0.5)
	_expect(manager.get_hand_weapon() == SWORD and not manager.is_swap_in_progress(), "queued swap does not cancel the current action")
	_expect(is_equal_approx(manager.get_hand_skill_cooldown_remaining(&"sword"), 3.5), "Hand-skill cooldown ticks while its weapon remains active")
	manager.notify_action_interruptible()
	_expect(manager.is_swap_in_progress(), "queued swap starts immediately when the action becomes interruptible")
	manager.advance_time(0.25)
	_expect(manager.get_hand_weapon() == BOW and manager.get_spirit_weapon(0) == SWORD, "0.25-second direct swap exchanges Hand with the selected Spirit slot")
	_expect(_combo_resets.has(&"sword") and manager.get_hand_combo_step(&"sword") == 0, "Hand combo resets when its weapon leaves Hand")
	_expect(is_equal_approx(manager.get_swap_cooldown_remaining(), 1.25), "shared 1.5-second swap cooldown starts with the transition")
	_expect(manager.get_spirit_action_cooldown_remaining(&"bow") < 1.51, "Spirit cooldown keeps ticking after Bow moves into Hand")
	_expect(_precast_cancellations.is_empty(), "an already-created Spirit effect is not cancelled by swapping it into Hand")
	var sword_skill_before_role_tick := manager.get_hand_skill_cooldown_remaining(&"sword")
	var bow_spirit_before_role_tick := manager.get_spirit_action_cooldown_remaining(&"bow")
	manager.advance_time(0.1)
	_expect(manager.get_hand_skill_cooldown_remaining(&"sword") < sword_skill_before_role_tick, "Sword Hand-skill cooldown continues while Sword occupies Spirit")
	_expect(manager.get_spirit_action_cooldown_remaining(&"bow") < bow_spirit_before_role_tick, "Bow Spirit-action cooldown continues while Bow occupies Hand")

	manager.notify_hand_attack_instance_created()
	manager.notify_hand_attack_instance_created()
	_expect(is_equal_approx(manager.get_spirit_trigger_progress(&"sword"), 2.0), "Sword Spirit records two confirmed attacks from the current Bow Hand")
	manager.advance_time(manager.get_swap_cooldown_remaining())
	_expect(manager.request_swap(0), "Sword Spirit can be selected directly once shared cooldown finishes")
	manager.advance_time(0.25)
	_expect(manager.get_hand_weapon() == SWORD, "Sword moves back into Hand")
	_expect(is_equal_approx(manager.get_spirit_trigger_progress(&"sword"), 2.0), "Sword trigger progress is preserved when Sword moves into Hand")
	manager.notify_hand_attack_instance_created()
	_expect(is_equal_approx(manager.get_spirit_trigger_progress(&"sword"), 2.0), "Sword trigger progress is paused while Sword occupies Hand")
	manager.advance_time(manager.get_swap_cooldown_remaining())
	_expect(manager.request_swap(0), "Bow is directly selectable from Spirit slot zero")
	manager.advance_time(0.25)
	var actions_before_sword_trigger := _spirit_actions.size()
	manager.notify_hand_attack_instance_created()
	_expect(_spirit_actions.size() == actions_before_sword_trigger + 1 and _spirit_actions[-1].weapon_id == &"sword", "preserved third attack triggers Flying Sword after Sword returns to Spirit")
	_expect(is_equal_approx(manager.get_spirit_trigger_progress(&"sword"), 0.0), "Sword trigger resets only after its Spirit action starts")

	var save_data := manager.to_save_data()
	var restored := MANAGER_SCRIPT.new() as WeaponManager
	root.add_child(restored)
	restored.set_process(false)
	_expect(restored.restore_loadout_from_save(save_data, {&"sword": SWORD, &"bow": BOW}), "stable weapon IDs restore the equipped loadout from save data")
	_expect(restored.get_hand_weapon().weapon_id == manager.get_hand_weapon().weapon_id, "restored Hand role matches saved role")

	var test_third := BOW.duplicate(true) as WeaponDefinition
	test_third.weapon_id = &"test_third"
	test_third.display_name = "Test Third"
	var gated := MANAGER_SCRIPT.new() as WeaponManager
	root.add_child(gated)
	gated.set_process(false)
	_expect(gated.configure_loadout(SWORD, [BOW, test_third], false), "underlying loadout supports two Spirit slots before the feature unlock")
	_expect(not gated.request_swap(1), "second direct-selection input remains blocked before unlock")
	gated.set_second_spirit_slot_enabled(true)
	_expect(gated.get_active_spirit_slot_count() == 2 and gated.request_swap(1), "feature gate unlocks direct selection of Spirit slot two")
	gated.advance_time(0.25)
	_expect(gated.get_hand_weapon().weapon_id == &"test_third", "slot-two selection swaps that exact weapon into Hand")

	var axe_spirit := MANAGER_SCRIPT.new() as WeaponManager
	root.add_child(axe_spirit)
	axe_spirit.set_process(false)
	axe_spirit.spirit_action_started.connect(_on_spirit_action_started)
	_expect(axe_spirit.configure_loadout(SWORD, [AXE], false), "Axe configures as the Level-5 Spirit weapon")
	var actions_before_axe := _spirit_actions.size()
	axe_spirit.notify_hand_skill_resolved({
		"source_weapon_id": &"sword",
		"skill_instance_id": 40,
		"endpoint": Vector2(120.0, 0.0),
		"has_meaningful_endpoint": false,
	})
	_expect(_spirit_actions.size() == actions_before_axe, "Axe Spirit ignores a skill without a meaningful endpoint")
	axe_spirit.notify_hand_skill_resolved({
		"source_weapon_id": &"sword",
		"skill_instance_id": 41,
		"endpoint": Vector2(120.0, 0.0),
		"has_meaningful_endpoint": true,
	})
	_expect(_spirit_actions.size() == actions_before_axe + 1 and _spirit_actions[-1].weapon_id == &"axe", "one resolved Hand skill starts one Axe Follow-through")
	_expect((_spirit_actions[-1].context.endpoint as Vector2).is_equal_approx(Vector2(120.0, 0.0)), "Follow-through preserves the Hand skill principal endpoint")
	axe_spirit.reset_all_cooldowns()
	axe_spirit.notify_hand_skill_resolved({
		"source_weapon_id": &"sword",
		"skill_instance_id": 41,
		"endpoint": Vector2(120.0, 0.0),
		"has_meaningful_endpoint": true,
	})
	_expect(_spirit_actions.size() == actions_before_axe + 1, "the same skill receipt cannot trigger Follow-through twice after cooldown reset")
	axe_spirit.notify_hand_skill_resolved({
		"source_weapon_id": &"sword",
		"skill_instance_id": 42,
		"endpoint": Vector2(180.0, 0.0),
		"has_meaningful_endpoint": true,
	})
	_expect(_spirit_actions.size() == actions_before_axe + 2, "a new resolved skill can trigger a new Follow-through")
	# Receipt 43 arrives during cooldown and is intentionally consumed. Replaying
	# it later must not create a delayed ghost action.
	axe_spirit.notify_hand_skill_resolved({
		"source_weapon_id": &"sword",
		"skill_instance_id": 43,
		"endpoint": Vector2(220.0, 0.0),
		"has_meaningful_endpoint": true,
	})
	axe_spirit.reset_all_cooldowns()
	axe_spirit.notify_hand_skill_resolved({
		"source_weapon_id": &"sword",
		"skill_instance_id": 43,
		"endpoint": Vector2(220.0, 0.0),
		"has_meaningful_endpoint": true,
	})
	_expect(_spirit_actions.size() == actions_before_axe + 2, "a skill consumed during cooldown cannot ghost-trigger after cooldown")

	manager.queue_free()
	restored.queue_free()
	gated.queue_free()
	axe_spirit.queue_free()
	if _failures.is_empty():
		print("WEAPON MANAGER TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		print("WEAPON MANAGER TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		for failure: String in _failures:
			print(" - ", failure)
		quit(1)


func _on_swap_requested(spirit_slot: int, hand_weapon: WeaponDefinition, requested_weapon: WeaponDefinition, queued: bool) -> void:
	_swap_requests.append({
		"slot": spirit_slot,
		"hand_id": hand_weapon.weapon_id,
		"requested_id": requested_weapon.weapon_id,
		"queued": queued,
	})


func _on_weapon_swapped(spirit_slot: int, previous_hand: WeaponDefinition, new_hand: WeaponDefinition) -> void:
	_swaps.append({
		"slot": spirit_slot,
		"previous_id": previous_hand.weapon_id,
		"new_id": new_hand.weapon_id,
	})


func _on_spirit_action_started(weapon: WeaponDefinition, spirit_slot: int, action: SpiritActionDefinition, context: Dictionary) -> void:
	_spirit_actions.append({
		"weapon_id": weapon.weapon_id,
		"slot": spirit_slot,
		"action_id": action.action_id,
		"context": context,
	})


func _on_hand_combo_reset(weapon: WeaponDefinition) -> void:
	_combo_resets.append(weapon.weapon_id)


func _on_spirit_action_cancel_requested(weapon: WeaponDefinition, _reason: StringName) -> void:
	_precast_cancellations.append(weapon.weapon_id)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
		push_error("FAIL  " + message)
