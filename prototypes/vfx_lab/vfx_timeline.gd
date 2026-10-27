class_name VfxLabTimeline
extends RefCounted

## One presentation clock; combat authority does not belong in the VFX layer.
const DURATION := {1: 6.0, 2: 7.0, 3: 7.0}
const EVENTS := {
	1: [[0.35, "cut_a"], [0.47, "impact_a"], [1.05, "cut_b"], [1.17, "impact_b"], [1.75, "cut_c"], [1.87, "impact_c"], [2.48, "collapse"]],
	2: [[0.23, "seed_contact"], [0.48, "grow_0"], [0.61, "grow_1"], [0.74, "grow_2"], [0.87, "grow_3"], [2.14, "second_reagent"], [2.84, "shatter"]],
	3: [[0.55, "dash"], [0.82, "contact"], [1.1, "pressure"], [2.8, "rupture"]]
}

static func duration_of(skill_id: int) -> float:
	return float(DURATION.get(skill_id, 6.0))

static func events_between(skill_id: int, start: float, finish: float) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for item in EVENTS.get(skill_id, []):
		var t: float = float(item[0])
		if start < t and t <= finish:
			result.append({"t": t, "cue": StringName(item[1])})
	return result

static func clamp_time(skill_id: int, time: float) -> float:
	return clampf(time, 0.0, duration_of(skill_id))

static func segment_fraction(point: Vector2, a: Vector2, b: Vector2) -> float:
	var ab: Vector2 = b - a
	if ab.length_squared() < 0.0001:
		return 0.0
	return clampf((point - a).dot(ab) / ab.length_squared(), 0.0, 1.0)

static func point_to_segment(point: Vector2, a: Vector2, b: Vector2) -> float:
	return point.distance_to(a.lerp(b, segment_fraction(point, a, b)))

static func body_crystal_strength(time: float) -> float:
	if time < 0.23 or time >= 3.22:
		return 0.0
	if time < 1.13:
		return clampf((time - 0.23) / 0.9, 0.0, 1.0)
	return 1.0
