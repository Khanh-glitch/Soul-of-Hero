extends SceneTree

const REPORT_PATH := "res://.artifacts/health_potion_loot_report.json"
const ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(
		not ResourceLoader.exists("res://data/content/items/health_potion.tres"),
		"health potion content resource has been removed",
	)
	_expect(
		not ResourceLoader.exists("res://game/loot/health_potion_drop_policy.gd"),
		"health potion random-drop policy has been removed",
	)
	_expect(ITEM_CATALOG.find(&"health_potion") == null, "item catalog no longer exposes health potion")
	_expect(ITEM_CATALOG.find(&"soul_ember") != null, "remaining stackable loot is still catalogued")
	var director_source := FileAccess.get_file_as_string("res://game/loot/loot_director.gd")
	var codex_source := FileAccess.get_file_as_string("res://game/ui/field_codex.gd")
	_expect("health_potion" not in director_source, "loot director cannot roll a health potion")
	_expect("health_potion" not in codex_source, "Field Codex no longer offers a potion action")
	_finish()


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := {
		"suite": "health_potion_removal",
		"passed": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "  "))
	if _failures.is_empty():
		print("HEALTH POTION REMOVAL TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print("HEALTH POTION REMOVAL TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)
