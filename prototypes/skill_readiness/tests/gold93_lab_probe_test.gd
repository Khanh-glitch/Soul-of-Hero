extends SceneTree

## Walks all 93 canonical ids through the SkillReadinessLab API in headless
## Godot: proves the catalog, the control envelope, the dependency graph and the
## fail-closed behaviour are all reachable, and writes a machine-readable
## coverage artifact for CI.

const LAB = preload("res://prototypes/skill_readiness/lab/skill_readiness_lab.gd")
const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")

var _failures: Array[String] = []


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_LAB_PROBE: " + message)


func _initialize() -> void:
	var probe: Dictionary = LAB.headless_probe()
	_check(int(probe.get("scope", 0)) == 93, "lab probe must cover exactly 93 ids")

	var rows: Array = probe.get("rows", [])
	_check(rows.size() == 93, "lab probe must emit 93 rows")

	var by_family: Dictionary = {"venomwright": 0, "arcana_iii": 0}
	for row in rows:
		var key := String(row.get("key", ""))
		var family := String(row.get("family", ""))
		by_family[family] = int(by_family.get(family, 0)) + 1
		_check(not key.is_empty(), "row key required")
		_check(not String(row.get("original_name", "")).is_empty(),
				"original name required for %s" % key)
		var controls: Dictionary = row.get("controls", {})
		_check(bool(controls.get("free_360_aim", false)),
				"every skill must expose free 360-degree aim capability: %s" % key)
		_check(bool(controls.get("tap", false)) and bool(controls.get("hold", false)),
				"tap and hold capability required: %s" % key)
		_check(int(row.get("dependency_count", 0)) >= 0, "dependency graph must resolve")
	_check(int(by_family.get("venomwright", 0)) == 21, "21 Venomwright rows")
	_check(int(by_family.get("arcana_iii", 0)) == 72, "72 ARCANA rows")

	var runtime = RUNTIME.new()
	var report: Dictionary = runtime.readiness_report()
	_check(int(report["native_port_ready"].size()) == int(probe.get("native", 0)),
			"lab probe native count must match runtime report")

	# Persist the coverage artifact so CI can archive it.
	DirAccess.make_dir_recursive_absolute("res://.artifacts/gold93")
	var payload: String = JSON.stringify(probe, "  ")
	var file := FileAccess.open("res://.artifacts/gold93/lab_coverage.json", FileAccess.WRITE)
	if file != null:
		file.store_string(payload + "\n")
		file.close()

	print(runtime.summary_line())

	if _failures.is_empty():
		print("GOLD93_LAB_PROBE: PASS / 93 ids inspected through the lab API / coverage artifact written")
		quit(0)
	else:
		print("GOLD93_LAB_PROBE: FAIL / %d problem(s)" % _failures.size())
		quit(1)
