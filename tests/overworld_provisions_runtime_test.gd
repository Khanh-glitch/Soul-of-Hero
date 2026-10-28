extends SceneTree
## Provisions drain rates: construct OverworldState directly with authored
## world_data, disable process (_flush_save is a no-op without SaveService),
## then exercise drain_provisions() to verify wild/hazard/safe rates and
## camp-restore math.

const StateScript := load("res://game/overworld/overworld_state.gd")
const WORLD_DATA_PATH := "res://data/overworld/hollow_marches.json"

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("PROV_FAIL: " + m); print("PROV_FAIL:", m)

func _run() -> void:
	var f := FileAccess.open(WORLD_DATA_PATH, FileAccess.READ)
	var d: Dictionary = JSON.parse_string(f.get_as_text()); f.close()
	var surv: Dictionary = d.get("survival", {}) as Dictionary
	var wild := float(surv.get("drain_per_second_wild", 0.0))
	var hazard := float(surv.get("drain_per_second_hazard", wild))
	var safe_rate := float(surv.get("drain_per_second_safe", 0.0))
	var camp_restore := int(surv.get("camp_restore", 0))
	var max_p := int(surv.get("max", 100))
	var start_p := int(surv.get("start", 80))
	expect(wild > 0.0, "wild drain rate positive (%.2f)" % wild)
	expect(hazard >= wild, "hazard (%.2f) >= wild (%.2f)" % [hazard, wild])
	expect(safe_rate <= wild, "safe (%.2f) <= wild" % safe_rate)
	expect(camp_restore > 0, "camp_restore positive (%d)" % camp_restore)

	var state := StateScript.new()
	state.set_process(false)
	root.add_child(state)
	await process_frame
	state.call("configure", d, Vector2(904.0, 3720.0), &"camp_refuge")
	state.set_process(false)
	state.set("provisions", start_p)
	expect(int(state.get("max_provisions")) == max_p, "max_provisions=%d (authored %d)" % [int(state.get("max_provisions")), max_p])
	expect(int(state.get("provisions")) == start_p, "start provisions=%d" % start_p)

	# 10s of wild drain — must decrease, magnitude near authored rate.
	var dt := 1.0 / 60.0
	state.set("provisions", start_p)
	for _i in range(10 * 60): state.call("drain_provisions", dt, false, false)
	var drained := start_p - int(state.get("provisions"))
	expect(drained > 0, "wild drain decreases provisions (%d over 10s)" % drained)

	# Hazard drains faster than wild over 5s windows from full.
	state.set("provisions", max_p)
	for _i in range(5 * 60): state.call("drain_provisions", dt, true, false)
	var hazard_drop := max_p - int(state.get("provisions"))
	state.set("provisions", max_p)
	for _i in range(5 * 60): state.call("drain_provisions", dt, false, false)
	var wild_drop := max_p - int(state.get("provisions"))
	expect(hazard_drop > wild_drop, "hazard(%d) > wild(%d) drop over 5s" % [hazard_drop, wild_drop])

	# Safe zone is no-op.
	state.set("provisions", max_p)
	var before_safe := int(state.get("provisions"))
	for _i in range(5 * 60): state.call("drain_provisions", dt, false, true)
	expect(int(state.get("provisions")) == before_safe, "safe-zone drain is no-op")

	# Clamps at 0.
	state.set("provisions", 1)
	for _i in range(60 * 60): state.call("drain_provisions", dt, true, false)
	expect(int(state.get("provisions")) == 0, "provisions clamp at 0")

	# Camp restore caps at max.
	state.set("provisions", 0)
	state.call("activate_camp", &"camp_refuge", Vector2.ZERO)
	expect(int(state.get("provisions")) == mini(max_p, camp_restore), "camp restore yields min(restore,max)=%d (got %d)" % [mini(max_p, camp_restore), int(state.get("provisions"))])
	expect(state.call("get_last_camp_id") == &"camp_refuge", "last_camp_id updates")

	state.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_PROVISIONS_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_PROVISIONS_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)
