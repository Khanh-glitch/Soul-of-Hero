class_name A6GuidanceModel
extends RefCounted

## D057 starter guidance, built from durable owner facts rather than from what the
## player happens to be carrying.
##
## The previous version had a real player-facing bug: it treated "6 materials in
## the bag" as "gathered six materials", so spending them on a wall and stashing
## the rest silently un-ticked a quest the player had genuinely completed. Carried
## inventory is *current state*; a completed step is *history*. They are not
## interchangeable, and A6 does not own the history.
##
## So the model asks A0 for `soh.a6.run_facts.v1`, which reports
##   * durable per-run actions (`true` once performed, `false` known-open),
##   * actions the owner has no record of — **unknown**, never assumed false,
##   * a physically validated shelter judgement, not a structure count.
##
## When the owner publishes nothing, the panel still teaches (that is its first
## job) but it does not tick anything: rows show "?" and the progress reads "—".
## A lone wall, floor or foundation is never presented as a home under D004/D059.
##
## Mode (D057): first run teaches, later runs are compact and optional. The run
## number comes only from the owner — a season clock or the run-facts projection.
## With no owner run identity the guide stays in first-run mode forever, because a
## novice who placed one wall must not be reclassified as a returning player.

const MODE_FIRST_RUN := "first_run"
const MODE_RETURNING := "returning"

const STATE_DONE := "done"
const STATE_OPEN := "open"
const STATE_UNKNOWN := "unknown"


static func build(inputs: Dictionary, clock: Dictionary = {}) -> Dictionary:
	var facts: Dictionary = inputs.get("run_facts", {})
	var current: Dictionary = inputs.get("current", {})
	var facts_available := bool(facts.get("available", false))
	var current_available := bool(current.get("available", false))
	if not facts_available and not current_available:
		return {
			"available": false,
			"reason": "guidance_inputs_missing",
			"mode": MODE_FIRST_RUN,
			"steps": [],
			"completed": 0,
			"unknown": 0,
			"total": 0,
			"provisional": true,
			"run_number": 1,
			"run_number_known": false,
		}
	var materials := int(current.get("materials", -1))
	if materials < 0:
		# Fall back to the owner's current snapshot when A6 cannot read the bag.
		materials = int(facts.get("holds_materials", -1))
	var structures := int(current.get("structures", 0))
	var recipes := int(current.get("recipes", 0))
	var steps: Array[Dictionary] = [
		_step(
			"gather",
			"Thu thập nguyên liệu",
			"Chặt cây, đập đá quanh nơi xuất phát",
			_gather_state(facts),
			_current_materials_note(materials),
		),
		_step(
			"shelter",
			"Dựng chỗ trú",
			"Đặt tường và cửa thành một phòng kín có mái",
			_shelter_state(facts),
			_current_structures_note(structures),
		),
		_step(
			"bed",
			"Đặt giường",
			"Giường cho bạn ngủ qua đêm và hồi sức",
			A6ProjectionContract.action_state(facts, "place_bed"),
			"Đang có giường" if bool(current.get("bed", false)) else "",
		),
		_step(
			"storage",
			"Đặt rương",
			"Cất đồ vào rương để khỏi mất khi chết",
			A6ProjectionContract.action_state(facts, "place_storage"),
			"Đang có rương" if bool(current.get("storage", false)) else "",
		),
		_step(
			"research",
			"Học một công thức",
			"Chế tạo một món đồ mới để mở đường",
			_recipe_state(facts, recipes),
			"%d công thức" % recipes if recipes > 0 else "",
		),
	]
	var completed := 0
	var unknown := 0
	for step: Dictionary in steps:
		match String(step.get("state", STATE_UNKNOWN)):
			STATE_DONE:
				completed += 1
			STATE_UNKNOWN:
				unknown += 1
	var run_number := 1
	var run_number_known := false
	if bool(clock.get("available", false)):
		run_number = maxi(1, int(clock.get("run_number", 1)))
		run_number_known = true
	elif facts_available and int(facts.get("run_number", 0)) > 0:
		run_number = int(facts["run_number"])
		run_number_known = true
	return {
		"available": true,
		"reason": "",
		"mode": MODE_FIRST_RUN if run_number <= 1 else MODE_RETURNING,
		"steps": steps,
		"completed": completed,
		"unknown": unknown,
		"total": steps.size(),
		"provisional": unknown > 0,
		"run_number": run_number,
		"run_number_known": run_number_known,
	}


static func _gather_state(facts: Dictionary) -> String:
	return A6ProjectionContract.action_state(facts, "gather_materials")


## A structurally validated room is durable evidence by itself: if A0 says the home
## is valid right now, the player demonstrably built it this run. The reverse is not
## true — "no valid home at this second" does not prove it was never built, so that
## only counts as open when the owner explicitly says the action is still open.
static func _shelter_state(facts: Dictionary) -> String:
	var action := A6ProjectionContract.action_state(facts, "valid_shelter")
	if action == STATE_DONE:
		return STATE_DONE
	var shelter := String(facts.get("shelter", STATE_UNKNOWN))
	if shelter == "validated":
		return STATE_DONE
	if action == STATE_OPEN or shelter == "invalid":
		return STATE_OPEN
	return STATE_UNKNOWN


## Learned recipes live in the run's own durable knowledge block, so a non-empty
## recipe set is proof regardless of whether the owner published run facts.
static func _recipe_state(facts: Dictionary, recipes: int) -> String:
	var action := A6ProjectionContract.action_state(facts, "learn_recipe")
	if action == STATE_DONE:
		return STATE_DONE
	if recipes > 0:
		return STATE_DONE
	return action


static func _step(
	step_id: String, title: String, hint: String, state: String, evidence: String
) -> Dictionary:
	return {
		"id": step_id,
		"title": title,
		"hint": hint,
		"state": state,
		"done": state == STATE_DONE,
		"unknown": state == STATE_UNKNOWN,
		"evidence": evidence,
	}


static func _current_materials_note(materials: int) -> String:
	if materials <= 0:
		return ""
	return "Đang mang %d nguyên liệu" % materials


static func _current_structures_note(structures: int) -> String:
	if structures <= 0:
		return ""
	return "Đang có %d khối đã dựng" % structures
