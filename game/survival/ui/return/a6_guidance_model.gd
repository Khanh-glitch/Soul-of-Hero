class_name A6GuidanceModel
extends RefCounted

## D057 starter guidance, derived from committed A0 state.
##
## The model owns no progress of its own: it maps five real survival milestones
## onto whatever the player has already done, so an explorer who built a bed
## before ever reading the guide sees that step already ticked. Nothing here is
## gated, timed or rewarded — A6 never grants an item. A3 remains the only
## authority that may pay a reward for a completed step, and it does so from its
## own receipt, not from this list.
##
## Mode: the first run teaches; later runs stay compact and optional. When the
## owner does not publish a run number yet, the mode is inferred from real
## progress (nothing done → teach; anything done → compact), never from a timer.

const MODE_FIRST_RUN := "first_run"
const MODE_RETURNING := "returning"

const MATERIALS_FOR_GATHER := 6


static func build(facts: Dictionary, clock: Dictionary = {}) -> Dictionary:
	if not bool(facts.get("available", false)):
		return {
			"available": false,
			"reason": String(facts.get("reason", "guidance_facts_missing")),
			"mode": MODE_FIRST_RUN,
			"steps": [],
			"completed": 0,
			"total": 0,
		}
	var materials := maxi(0, int(facts.get("materials", 0)))
	var structures := maxi(0, int(facts.get("structures", 0)))
	var recipes := maxi(0, int(facts.get("recipes", 0)))
	var steps: Array[Dictionary] = [
		_step(
			"gather",
			"Thu thập nguyên liệu",
			"Chặt cây, đập đá quanh nơi xuất phát",
			materials >= MATERIALS_FOR_GATHER,
			"%d nguyên liệu" % materials,
		),
		_step(
			"shelter",
			"Dựng chỗ trú",
			"Đặt tường hoặc cửa để có một căn phòng",
			structures >= 1,
			"%d khối đã dựng" % structures,
		),
		_step(
			"bed",
			"Đặt giường",
			"Giường cho bạn ngủ qua đêm và hồi sức",
			bool(facts.get("bed", false)),
			"Đã có giường" if bool(facts.get("bed", false)) else "",
		),
		_step(
			"storage",
			"Đặt rương",
			"Cất đồ vào rương để khỏi mất khi chết",
			bool(facts.get("storage", false)),
			"Đã có rương" if bool(facts.get("storage", false)) else "",
		),
		_step(
			"research",
			"Học một công thức",
			"Chế tạo một món đồ mới để mở đường",
			recipes >= 1,
			"%d công thức" % recipes,
		),
	]
	var completed := 0
	for step: Dictionary in steps:
		if bool(step.get("done", false)):
			completed += 1
	var mode := _resolve_mode(clock, completed)
	return {
		"available": true,
		"reason": "",
		"mode": mode,
		"steps": steps,
		"completed": completed,
		"total": steps.size(),
	}


static func _step(
	step_id: String, title: String, hint: String, done: bool, evidence: String
) -> Dictionary:
	return {
		"id": step_id,
		"title": title,
		"hint": hint,
		"done": done,
		"evidence": evidence,
	}


static func _resolve_mode(clock: Dictionary, completed: int) -> String:
	if bool(clock.get("available", false)):
		return MODE_FIRST_RUN if int(clock.get("run_number", 1)) <= 1 else MODE_RETURNING
	return MODE_RETURNING if completed > 0 else MODE_FIRST_RUN
