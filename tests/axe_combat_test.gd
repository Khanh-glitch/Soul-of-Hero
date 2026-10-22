extends SceneTree

const AXE: WeaponDefinition = preload("res://game/weapons/data/axe.tres")
const CHARGE_MATH := preload("res://game/weapons/axe_charge_math.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(AXE.is_valid_definition(), "Axe definition validates")
	var attack := AXE.normal_attack
	_expect(attack.charge_enabled and attack.movement_allowed, "Heavy Cleave is a mobile hold-charge attack")
	_expect(is_equal_approx(attack.movement_speed_multiplier, 0.36), "Heavy Cleave charge slowdown comes from data")

	var quick := CHARGE_MATH.evaluate(attack, 0.0)
	var halfway := CHARGE_MATH.evaluate(attack, attack.maximum_charge_seconds * 0.5)
	var full := CHARGE_MATH.evaluate(attack, attack.maximum_charge_seconds)
	var overheld := CHARGE_MATH.evaluate(attack, 99.0)
	var negative := CHARGE_MATH.evaluate(attack, -1.0)
	_expect(is_equal_approx(float(quick.charge_ratio), 0.0) and int(quick.damage) == 30, "quick release is viable at 30 damage")
	_expect(is_equal_approx(float(quick.arc_degrees), 70.0) and is_equal_approx(float(quick.stagger), 20.0), "quick release uses the narrow data-driven arc and base stagger")
	_expect(is_equal_approx(float(halfway.charge_ratio), 0.5) and int(halfway.damage) == 45, "half charge interpolates damage deterministically")
	_expect(is_equal_approx(float(halfway.arc_degrees), 110.0) and is_equal_approx(float(halfway.stagger), 32.5), "half charge interpolates arc and stagger")
	_expect(is_equal_approx(float(full.charge_ratio), 1.0) and int(full.damage) == 60, "full charge reaches its configured damage cap")
	_expect(is_equal_approx(float(full.arc_degrees), 150.0) and is_equal_approx(float(full.stagger), 45.0), "full charge reaches its configured arc and stagger caps")
	_expect(int(overheld.damage) == int(full.damage) and is_equal_approx(float(overheld.arc_degrees), float(full.arc_degrees)), "overholding cannot exceed full-charge balance")
	_expect(int(negative.damage) == int(quick.damage) and is_equal_approx(float(negative.charge_seconds), 0.0), "negative time safely resolves as quick release")
	_expect(is_equal_approx(float(quick.knockback), 9.0) and is_equal_approx(float(full.knockback), 9.0), "charge keeps Axe knockback moderate instead of scaling like a hammer")

	var skill := AXE.hand_skill
	_expect(skill.behavior_id == &"throw_and_recall" and is_equal_approx(skill.outbound_speed, 340.0) and is_equal_approx(skill.return_speed, 470.0), "Throw & Recall travel speeds are data-driven")
	_expect(is_equal_approx(skill.automatic_recall_seconds, 1.4) and is_equal_approx(skill.path_width, 14.0), "Throw & Recall timer and path width are data-driven")
	_expect(is_equal_approx(skill.cross_hit_stagger_bonus, 28.0) and skill.stop_outbound_on_world, "Cross Cut bonus and outbound stop rule are data-driven")
	_expect(AXE.spirit_trigger.confirmed_event == &"hand_skill_resolved", "Axe Spirit trigger uses confirmed skill resolution")
	_expect(AXE.spirit_trigger.required_context_key == &"has_meaningful_endpoint" and AXE.spirit_trigger.require_truthy_context_value, "Axe Spirit rejects meaningless resolutions")
	_expect(AXE.spirit_trigger.deduplication_context_key == &"skill_instance_id", "Axe Spirit deduplicates one action per skill")
	_expect(AXE.spirit_action.behavior_id == &"follow_through_endpoint_and_return" and AXE.spirit_action.outbound_speed > 0.0 and AXE.spirit_action.return_speed > 0.0, "Follow-through has outbound and return travel data")

	if _failures.is_empty():
		print("AXE COMBAT TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("AXE COMBAT TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
