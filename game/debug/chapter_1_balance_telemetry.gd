class_name ChapterOneBalanceTelemetry
extends RefCounted

## Runtime-agnostic Chapter 1 observation collector. It records facts only;
## tuning/canon remains in authored gameplay data.

var _runs: Array[Dictionary] = []


func record_run(sample: Dictionary) -> bool:
	var level := int(sample.get("level", 0))
	var duration_seconds := float(sample.get("duration_seconds", -1.0))
	var outcome := String(sample.get("outcome", ""))
	if level < 1 or level > 10 or duration_seconds < 0.0 or outcome not in ["victory", "death", "abort"]:
		return false
	var normalized := {
		"level": level,
		"duration_seconds": duration_seconds,
		"outcome": outcome,
		"deaths": maxi(0, int(sample.get("deaths", 0))),
		"damage_dealt": maxf(0.0, float(sample.get("damage_dealt", 0.0))),
		"damage_taken": maxf(0.0, float(sample.get("damage_taken", 0.0))),
		"relay_q1_supports": maxi(0, int(sample.get("relay_q1_supports", 0))),
		"relay_q2_takeovers": maxi(0, int(sample.get("relay_q2_takeovers", 0))),
		"active_hero_seconds": (sample.get("active_hero_seconds", {}) as Dictionary).duplicate(true),
	}
	_runs.append(normalized)
	return true


func clear() -> void:
	_runs.clear()


func get_summary() -> Dictionary:
	var levels := {}
	for level in range(1, 11):
		levels[str(level)] = {
			"runs": 0, "victories": 0, "deaths": 0,
			"duration_total": 0.0, "damage_dealt": 0.0, "damage_taken": 0.0,
			"relay_q1_supports": 0, "relay_q2_takeovers": 0,
		}
	for run: Dictionary in _runs:
		var bucket: Dictionary = levels[str(run["level"])]
		bucket["runs"] += 1
		bucket["victories"] += 1 if run["outcome"] == "victory" else 0
		bucket["deaths"] += int(run["deaths"])
		bucket["duration_total"] += float(run["duration_seconds"])
		bucket["damage_dealt"] += float(run["damage_dealt"])
		bucket["damage_taken"] += float(run["damage_taken"])
		bucket["relay_q1_supports"] += int(run["relay_q1_supports"])
		bucket["relay_q2_takeovers"] += int(run["relay_q2_takeovers"])
	for level_key: String in levels:
		var bucket: Dictionary = levels[level_key]
		var count := int(bucket["runs"])
		bucket["victory_rate"] = float(bucket["victories"]) / float(count) if count > 0 else 0.0
		bucket["average_duration_seconds"] = float(bucket["duration_total"]) / float(count) if count > 0 else 0.0
		bucket.erase("duration_total")
	return {"schema": "chapter_1_balance_telemetry_v1", "sample_count": _runs.size(), "levels": levels}


func write_json(path: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(get_summary(), "\t") + "\n")
	file.close()
	return true
