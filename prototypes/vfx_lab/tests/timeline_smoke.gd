extends SceneTree

const Timeline = preload("res://prototypes/vfx_lab/vfx_timeline.gd")

func _initialize() -> void:
	var failures := 0
	for id in [1, 2, 3]:
		var duration: float = Timeline.duration_of(id)
		var whole: Array[Dictionary] = Timeline.events_between(id, -0.001, duration)
		var collected: Array[Dictionary] = []
		var prev := -0.001
		while prev < duration:
			var finish := minf(prev + 0.137, duration)
			collected.append_array(Timeline.events_between(id, prev, finish))
			prev = finish
		if whole != collected or whole.is_empty():
			push_error("Timeline step partition mismatch for %d" % id)
			failures += 1
		if Timeline.events_between(id, 0.9, 0.1).size() != 0:
			push_error("Backward time must not emit forward cues")
			failures += 1
	if Timeline.point_to_segment(Vector2(20, 10), Vector2(0, 0), Vector2(40, 0)) != 10.0:
		push_error("Spatial segment projection incorrect")
		failures += 1
	if Timeline.body_crystal_strength(0.2) != 0.0 or Timeline.body_crystal_strength(1.14) != 1.0 or Timeline.body_crystal_strength(3.3) != 0.0:
		push_error("Crystal attachment lifecycle incorrect")
		failures += 1
	print("VFX_LAB_TIMELINE: %s" % ("PASS" if failures == 0 else "FAIL %d" % failures))
	quit(0 if failures == 0 else 1)
