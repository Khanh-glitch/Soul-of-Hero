extends SceneTree
## Real SaveService and disk; the workflow invokes a second Godot process.
## Fault hooks are debug-only simulated boundaries, not an OS power failure.
const PATH := "user://tests/a0_precision.json"
const BEFORE := 0.12345678901234566
const AFTER := 0.9876543210987654
var save: Node
var checks := 0
var failures := 0

func _initialize() -> void:
	_run.call_deferred()

func _check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _volume() -> float:
	return float((save.call(&"get_snapshot") as Dictionary).get("settings", {}).get("master_volume", -1.0))

func _bytes() -> String:
	var file := FileAccess.open(PATH, FileAccess.READ)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text

func _run() -> void:
	save = root.get_node("SaveService")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	_check(bool(save.call(&"configure_storage", PATH, true)), "isolated profile opens")
	var second := OS.get_cmdline_user_args().has("--restart")
	if second:
		_check(_volume() == AFTER, "second OS process restores exact post-rename float")
		_check(int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 2, "second process preserves inventory")
		_check(bool(save.call(&"is_transaction_applied", "precision.inventory")), "second process preserves receipt")
	else:
		_check(bool(save.call(&"update_settings", {"master_volume": BEFORE})), "persist nontrivial double precision value")
		_check(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 2, "precision.inventory")), "commit ordinary inventory and receipt")
		var before_disk := _bytes()
		var raw: Variant = JSON.parse_string(before_disk)
		_check(raw is Dictionary and float(raw.get("settings", {}).get("master_volume", -1.0)) == BEFORE, "on-disk JSON decodes to exactly the committed double")
		_check(bool(save.call(&"reload_save")) and _volume() == BEFORE, "same-process reload preserves the exact double")
		_check(bool(save.call(&"configure_test_save_interruption", "after_temporary")), "arm temporary boundary")
		_check(not bool(save.call(&"update_settings", {"master_volume": AFTER})), "pre-rename update reports failure")
		_check(_bytes() == before_disk and _volume() == BEFORE, "pre-rename failure leaves exact primary bytes and memory")
		_check(bool(save.call(&"reload_save")) and _volume() == BEFORE, "pre-rename reload retains old exact double")
		_check(bool(save.call(&"configure_test_save_interruption", "after_primary_renamed")), "arm post-rename boundary")
		_check(not bool(save.call(&"update_settings", {"master_volume": AFTER})), "post-rename update reports ambiguous failure")
		_check(_volume() == BEFORE, "lost acknowledgement does not mutate memory")
		_check(bool(save.call(&"reload_save")) and _volume() == AFTER, "post-rename reload sees exact new double")
		_check(bool(save.call(&"is_transaction_applied", "precision.inventory")) and int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 2, "fault boundaries preserve inventory and receipt")
	print("A0 SAVE PRECISION %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
