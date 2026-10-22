extends SceneTree

const MODEL := preload("res://game/combat/combat_balance_model.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_sequence_breakpoints()
	_test_survivability()
	_test_resource_tempo()
	_test_band_and_fail_closed_contracts()
	if _failures.is_empty():
		print("COMBAT BALANCE MODEL TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("COMBAT BALANCE MODEL TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _test_sequence_breakpoints() -> void:
	var multipliers := [1.0, 1.0, 1.2, 2.0]
	var durations := [0.34, 0.40, 0.52, 0.58]
	var hit_times := [0.10, 0.13, 0.20, 0.22]
	var actions: Array[Dictionary] = []
	for index: int in multipliers.size():
		actions.append({
			"id": StringName("sword_%d" % (index + 1)),
			"request": {
				"base": 200.0,
				"action_multiplier": multipliers[index],
			},
			"duration_seconds": durations[index],
			"hit_time_seconds": hit_times[index],
		})
	var skeleton := MODEL.sequence_ttk(700.0, actions)
	_expect(bool(skeleton.get("valid", false)), "valid content sequence produces a TTK snapshot")
	_expect(bool(skeleton.get("killed", false)), "the reference sequence kills a finite target")
	_expect(int(skeleton.get("hits_to_kill", 0)) == 4, "70 HP Skeleton dies on the authored fourth hit")
	_expect(StringName(skeleton.get("killing_action_id", &"")) == &"sword_4", "breakpoint identifies the exact killing action")
	_expect_close(float(skeleton.get("ttk_seconds", 0.0)), 1.48, "TTK uses the killing hit time, not the full final recovery")
	_expect(int(skeleton.get("cycle_damage", 0)) == 1040, "cycle damage comes from production resolver previews")
	_expect_close(float(skeleton.get("cycle_seconds", 0.0)), 1.84, "cycle duration sums authored action durations")
	_expect_close(float(skeleton.get("sustained_dps", 0.0)), 1040.0 / 1.84, "sustained DPS derives from the same sequence")
	_expect((skeleton.get("hit_ledger", []) as Array).size() == 4, "TTK exposes an auditable per-hit ledger")
	var armored_actions := actions.duplicate(true)
	for action: Dictionary in armored_actions:
		var request: Dictionary = action["request"]
		request["defense"] = {"rating": 50.0}
		action["request"] = request
	var armored := MODEL.sequence_ttk(700.0, armored_actions)
	_expect(int(armored.get("hits_to_kill", 0)) == 4, "hidden target defense cannot change the direct-damage breakpoint")
	_expect(int(armored.get("completed_cycles", 0)) == 0, "ignored hidden defense cannot add an invisible action cycle")


func _test_survivability() -> void:
	var snapshot := MODEL.survivability(1000.0, {"base": 140.0}, 0.85)
	_expect(bool(snapshot.get("valid", false)), "positive incoming profile produces survivability")
	_expect(int(snapshot.get("hits_to_die", 0)) == 8, "1000 HP survives seven 140-damage hits and dies on eight")
	_expect_close(float(snapshot.get("time_to_die_seconds", 0.0)), 6.8, "hits-to-die converts to authored attack cadence")
	var defended := MODEL.survivability(1000.0, {
		"base": 140.0,
		"defense": {"rating": 25.0},
	}, 0.85)
	_expect(int(defended.get("incoming_damage", 0)) == 140, "hidden defense cannot shrink direct incoming damage")
	var visible_barrier := MODEL.survivability(1250.0, {"base": 140.0}, 0.85)
	_expect(int(visible_barrier.get("hits_to_die", 0)) == 9, "a visible 250-point barrier increases survivability by direct subtraction")
	_expect(not bool(MODEL.survivability(0.0, {"base": 140.0}, 1.0).get("valid", true)), "zero HP fails closed")


func _test_resource_tempo() -> void:
	var tempo := MODEL.resource_tempo(100.0, 1.5, 32.0, 12.0, 72.0)
	_expect(bool(tempo.get("valid", false)), "valid Mana profile produces a tempo projection")
	_expect(int(tempo.get("casts", 0)) == 6, "event simulation respects both cooldown and regenerated Mana")
	_expect_close(float(tempo.get("casts_per_minute", 0.0)), 5.0, "casts per minute normalize a non-sixty-second observation window")
	var cast_times := tempo.get("cast_times", PackedFloat64Array()) as PackedFloat64Array
	_expect(cast_times.size() == 6, "tempo exposes every cast breakpoint")
	_expect_close(cast_times[0], 0.0, "full starting Mana permits an immediate cast")
	_expect_close(cast_times[5], 61.333333, "resource starvation delays the sixth cast beyond its raw cooldown")
	_expect(bool(tempo.get("resource_limited", false)), "tempo labels a profile whose cooldown recovery outpaces Mana recovery")
	var cooldown_limited := MODEL.resource_tempo(100.0, 100.0, 10.0, 12.0, 60.0)
	_expect(int(cooldown_limited.get("casts", 0)) == 6, "casts at t=0 and every 12 seconds include the window endpoint")
	_expect(not bool(cooldown_limited.get("resource_limited", true)), "abundant recovery identifies cooldown as the limiting resource")
	_expect(not bool(MODEL.resource_tempo(0.0, 1.0, 10.0, 5.0).get("valid", true)), "invalid resource profile fails closed")


func _test_band_and_fail_closed_contracts() -> void:
	var passed := MODEL.band_result(1.5, 1.0, 2.0)
	_expect(bool(passed.get("passed", false)), "value inside an inclusive target band passes")
	var above := MODEL.band_result(3.0, 1.0, 2.0)
	_expect(not bool(above.get("passed", true)) and float(above.get("distance_above", 0.0)) == 1.0, "band result explains overshoot")
	var swapped := MODEL.band_result(1.5, 2.0, 1.0)
	_expect(bool(swapped.get("passed", false)), "reversed author bounds normalize safely")
	_expect(not bool(MODEL.sequence_ttk(700.0, []).get("valid", true)), "empty action sequence fails closed")
	_expect(not bool(MODEL.sequence_ttk(700.0, [{"request": {"base": 200.0}, "duration_seconds": 0.0}]).get("valid", true)), "zero-duration action cannot enter balance simulation")
	var harmless := MODEL.sequence_ttk(700.0, [{
		"request": {"base": 0.0},
		"duration_seconds": 1.0,
	}])
	_expect(not bool(harmless.get("valid", true)), "zero-damage sequence fails instead of spinning to the hit cap")


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.4f, got %.4f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
