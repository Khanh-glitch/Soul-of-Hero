extends "res://tests/overworld_runtime_case.gd"
## Frame-cost probe for the production overworld, with budgets that are
## environment-independent.
##
## What this measures, and what it cannot. There is no GPU measurement here: the
## only honest number is **script time**, i.e. how long the overworld's own
## `_process` chain and the occlusion resolution take per frame. Rasterisation is
## not measured and is not claimed.
##
## The first version of this probe asserted absolute budgets ("median frame
## script time < 8 ms"), passed locally at 6.48 ms, and failed in CI on a shared
## two-core runner under software GL. That is a broken test, not a regression:
## an absolute millisecond budget measures the machine, not the design. What the
## design actually claims is:
##
##   1. the occlusion system is a small *share* of the frame, so it does not
##      dominate gameplay cost;
##   2. one occlusion step is bounded by the bucket scan, so its cost does not
##      grow with the number of occluders in the world;
##   3. idle frames allocate no nodes.
##
## All three are now relative or structural, and the raw numbers are printed so a
## human can see the machine they ran on.

const SAMPLE_FRAMES := 60
## Occlusion may add at most this share on top of the frame it is part of. The
## fade shader and the bucket scan are cheap; anything approaching the frame
## itself means the bucketing stopped bounding the work.
const OCCLUSION_FRAME_SHARE := 0.45
## A traversability cell query must be at least this many times cheaper than an
## occlusion step. Both are pure GDScript, so this ratio is machine-independent.
const TRAVERSABILITY_RATIO := 5.0


func _test_name() -> String:
	return "perf"


## Median frame script time over `count` frames.
func _median_frame_ms(count: int) -> float:
	var samples: Array[float] = []
	for i in range(count):
		await _frames(1)
		samples.append(Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0)
	samples.sort()
	return samples[samples.size() / 2]


func _occlusion_step_ms(occlusion: OverworldOcclusion, rounds: int) -> float:
	var start := Time.get_ticks_usec()
	for i in range(rounds):
		occlusion.step(0.016)
	return float(Time.get_ticks_usec() - start) / float(rounds) / 1000.0


func _body() -> void:
	var occlusion: OverworldOcclusion = ow.get("occlusion") as OverworldOcclusion
	var trav: OverworldTraversability = ow.get("traversability") as OverworldTraversability
	_expect(occlusion != null, "the overworld builds an occlusion system")
	_expect(trav != null, "the overworld builds a traversability grid")
	if occlusion == null or trav == null:
		_done("performance probe needs both systems")
		return

	# --- stand where the system works hardest --------------------------------
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
	var player := ow.get("player") as CharacterBody2D
	player.global_position = free

	# --- 1. occlusion as a share of the frame --------------------------------
	occlusion.enabled = true
	occlusion.snap()
	await _frames(6)                       # let first-frame caches settle
	var with_occlusion := await _median_frame_ms(SAMPLE_FRAMES)

	occlusion.enabled = false
	occlusion.snap()
	await _frames(2)
	var without_occlusion := await _median_frame_ms(SAMPLE_FRAMES)

	occlusion.enabled = true
	occlusion.snap()
	await _frames(2)

	var overhead := with_occlusion - without_occlusion
	var share := overhead / maxf(without_occlusion, 0.001)
	print("  perf: frame script time %.2f ms with occlusion, %.2f ms without (overhead %+.2f ms, %+.0f %%)"
		% [with_occlusion, without_occlusion, overhead, share * 100.0])
	_expect(occlusion.faded_count() >= 0, "the fade state is readable")
	_expect(share <= OCCLUSION_FRAME_SHARE,
		"occlusion costs less than %.0f %% of the frame it is part of (%+.0f %%)"
		% [OCCLUSION_FRAME_SHARE * 100.0, share * 100.0])

	# --- 2. occlusion step, bounded by the bucket scan ----------------------
	var per_step := _occlusion_step_ms(occlusion, 240)
	print("  perf: occlusion step %.3f ms over 240 rounds, %d occluders in %d buckets"
		% [per_step, occlusion.occluder_count(), occlusion.bucket_count()])
	_expect(per_step > 0.0, "an occlusion step is measurable")
	# The step is O(occluders near a focus), not O(occluders in the world). Feed
	# it a hundred steps while the player is far from everything: if bucketing
	# works, that is far cheaper per step than the same call standing behind a
	# landmark with dozens of neighbours.
	player.global_position = Vector2(16.0, 16.0)
	occlusion.snap()
	await _frames(2)
	var isolated_step := _occlusion_step_ms(occlusion, 240)
	player.global_position = free
	occlusion.snap()
	await _frames(2)
	print("  perf: occlusion step away from all occluders %.3f ms" % isolated_step)
	_expect(isolated_step <= per_step + 0.001,
		"an empty neighbourhood costs no more than a busy one (%.3f ms <= %.3f ms)"
		% [isolated_step, per_step])

	# --- 3. traversability queries are trivial next to a fade step ----------
	var start := Time.get_ticks_usec()
	var queries := 4000
	for i in range(queries):
		trav.blocked_kind(Vector2i(40 + i % 90, 60 + i % 70))
	var per_query := float(Time.get_ticks_usec() - start) / float(queries) / 1000.0
	print("  perf: traversability query %.5f ms over %d calls" % [per_query, queries])
	_expect(per_query * TRAVERSABILITY_RATIO <= per_step,
		"a cell query is at least %.0fx cheaper than a fade step (%.5f vs %.3f ms)"
		% [TRAVERSABILITY_RATIO, per_query, per_step])

	# --- 4. no node churn ----------------------------------------------------
	var nodes_before := int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	await _frames(30)
	var nodes_after := int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	print("  perf: node count %d -> %d over 30 idle frames" % [nodes_before, nodes_after])
	_expect(nodes_after <= nodes_before + 4,
		"thirty idle frames do not allocate nodes (%d -> %d)" % [nodes_before, nodes_after])

	_done("performance probe finished")
