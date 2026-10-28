extends "res://tests/overworld_runtime_case.gd"
## Frame-cost probe for the production overworld, with budgets that fail the gate.
##
## What this measures — and what it cannot. This container has no GPU, so the
## only honest number here is **script time**: how long the overworld's own
## `_process` chain and the occlusion resolution take per frame. Rasterisation is
## not measured and is not claimed. The budgets below are set from the 60 Hz
## frame (16.6 ms), not from what the machine happened to do:
##
##   * whole-game script time per frame  < 8.0 ms (leaves the frame to physics
##     and rendering even on the browser build, which is the slowest target)
##   * one occlusion `step()`           < 2.0 ms (bounded by the bucket scan;
##     if this grows, the bucket grid stopped bounding it)
##   * traversability query, worst case  < 0.5 ms
##
## They are deliberately loose: a regression that doubles the cost still trips
## them, while a slow CI runner does not produce a false red.

const FRAME_BUDGET_MS := 8.0
const OCCLUSION_STEP_BUDGET_MS := 2.0
const TRAVERSABILITY_BUDGET_MS := 0.5
const SAMPLE_FRAMES := 90


func _test_name() -> String:
	return "perf"


func _body() -> void:
	var occlusion: OverworldOcclusion = ow.get("occlusion") as OverworldOcclusion
	var trav: OverworldTraversability = ow.get("traversability") as OverworldTraversability
	_expect(occlusion != null, "the overworld builds an occlusion system")
	_expect(trav != null, "the overworld builds a traversability grid")
	if occlusion == null or trav == null:
		_done("performance probe needs both systems")
		return

	# --- frame script time, with the player standing in the busiest place -----
	var landmark: Sprite2D = null
	var props_root: Node = (ow.get("world") as OverworldWorld).props_root
	for child: Node in props_root.get_children():
		if child is Sprite2D and String((child as Sprite2D).get_meta("frame_name", "")).begins_with("lm_gate"):
			landmark = child as Sprite2D
			break
	_expect(landmark != null, "the probe can find a landmark to stand behind")
	if landmark == null:
		_done("performance probe stopped before the frame sample")
		return

	var rect: Rect2 = occlusion.sprite_rect(landmark)
	var standing := Vector2(landmark.position.x, rect.position.y + rect.size.y * 0.35)
	var free: Vector2 = trav.nearest_free_position(standing, 10)
	(ow.get("player") as CharacterBody2D).global_position = free
	occlusion.enabled = true
	occlusion.snap()
	await _frames(6)                      # let the first-frame caches settle

	var samples: Array[float] = []
	for i in range(SAMPLE_FRAMES):
		await _frames(1)
		samples.append(float(Performance.get_monitor(Performance.TIME_PROCESS)) * 1000.0)
	samples.sort()
	var median := samples[samples.size() / 2]
	var worst := samples[samples.size() - 1]
	print("  perf: frame script time median %.2f ms, worst %.2f ms over %d frames"
		% [median, worst, SAMPLE_FRAMES])
	_expect(median < FRAME_BUDGET_MS,
		"median frame script time stays inside the budget (%.2f ms < %.1f ms)" % [median, FRAME_BUDGET_MS])
	_expect(worst < FRAME_BUDGET_MS * 4.0,
		"worst frame does not blow up (%.2f ms < %.1f ms)" % [worst, FRAME_BUDGET_MS * 4.0])

	# --- occlusion step, called flat out --------------------------------------
	var start := Time.get_ticks_usec()
	var rounds := 240
	for i in range(rounds):
		occlusion.step(0.016)
	var per_step := float(Time.get_ticks_usec() - start) / float(rounds) / 1000.0
	print("  perf: occlusion step %.3f ms over %d rounds (%d faded)"
		% [per_step, rounds, occlusion.faded_count()])
	_expect(per_step < OCCLUSION_STEP_BUDGET_MS,
		"one occlusion step stays inside the budget (%.3f ms < %.1f ms)" % [per_step, OCCLUSION_STEP_BUDGET_MS])

	# --- traversability queries ----------------------------------------------
	start = Time.get_ticks_usec()
	var queries := 400
	for i in range(queries):
		var cell := Vector2i(40 + i % 90, 60 + i % 70)
		trav.blocked_kind(cell)
	var per_query := float(Time.get_ticks_usec() - start) / float(queries) / 1000.0
	print("  perf: traversability query %.4f ms over %d calls" % [per_query, queries])
	_expect(per_query < TRAVERSABILITY_BUDGET_MS,
		"a traversability query stays inside the budget (%.4f ms < %.1f ms)" % [per_query, TRAVERSABILITY_BUDGET_MS])

	# --- the world is not leaking nodes per frame ----------------------------
	var nodes_before := int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	await _frames(30)
	var nodes_after := int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	print("  perf: node count %d -> %d over 30 frames" % [nodes_before, nodes_after])
	_expect(nodes_after <= nodes_before + 4,
		"thirty idle frames do not allocate nodes (%d -> %d)" % [nodes_before, nodes_after])

	_done("performance probe finished")
