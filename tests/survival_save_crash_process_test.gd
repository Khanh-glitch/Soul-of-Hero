extends SceneTree
## Linux CI only: debug fault hook returns at a real SaveService write boundary,
## then SIGKILL terminates this Godot OS process with no reload/shutdown path.
## A second Godot process checks the original file, receipt and idempotent retry.
## This does not simulate power loss or establish filesystem fsync guarantees.
const BEFORE := 0.12345678901234566
var save: Node
var failures := 0
var checks := 0

func _initialize() -> void:
	_run.call_deferred()

func _check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var boundary := "after_primary_renamed" if args.has("--after-rename") else "after_temporary"
	var restart := args.has("--restart")
	var path := "user://tests/crash_" + boundary + ".json"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save = root.get_node("SaveService")
	_check(bool(save.call(&"configure_storage", path, true)), "authoritative profile opens")
	if not restart:
		_check(bool(save.call(&"update_settings", {"master_volume": BEFORE})), "exact float seeded")
		_check(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 2, "crash.original")), "original custody and receipt committed")
		_check(bool(save.call(&"configure_test_save_interruption", boundary)), "debug interruption armed")
		_check(not bool(save.call(&"grant_inventory_item", "stone_chunk", "material", 3, "crash.candidate")), "interrupted transaction returned no success")
		var totals: Dictionary = save.call(&"inventory_totals")
		_check(int(totals.get("oak_wood", 0)) == 2 and int(totals.get("stone_chunk", 0)) == 0, "unacknowledged candidate is absent from memory")
		if failures == 0:
			var marker := FileAccess.open("user://tests/ready_" + boundary + ".txt", FileAccess.WRITE)
			_check(marker != null, "write pre-kill marker")
			if marker != null:
				marker.store_string(boundary + "\n")
				marker.close()
		if failures == 0:
			print("A0 CRASH READY " + boundary)
			OS.kill(OS.get_process_id())
			# Should be unreachable on Linux; never treat a normal exit as a crash.
			_check(false, "SIGKILL unexpectedly returned")
	else:
		var totals: Dictionary = save.call(&"inventory_totals")
		var committed := boundary == "after_primary_renamed"
		_check(int(totals.get("oak_wood", 0)) == 2, "original inventory survives process death")
		_check(int(totals.get("stone_chunk", 0)) == (3 if committed else 0), "disk chooses one complete candidate generation")
		_check(bool(save.call(&"is_transaction_applied", "crash.original")), "original receipt survives")
		_check(bool(save.call(&"is_transaction_applied", "crash.candidate")) == committed, "candidate receipt agrees with custody")
		_check(float((save.call(&"get_snapshot") as Dictionary).get("settings", {}).get("master_volume", -1.0)) == BEFORE, "exact double survives process death")
		var retry := bool(save.call(&"grant_inventory_item", "stone_chunk", "material", 3, "crash.candidate"))
		_check(retry != committed, "same event retries only if not committed")
		_check(not bool(save.call(&"grant_inventory_item", "stone_chunk", "material", 3, "crash.candidate")), "duplicate event is rejected")
		_check(bool(save.call(&"reload_save")), "retry reload succeeds")
		totals = save.call(&"inventory_totals")
		_check(int(totals.get("oak_wood", 0)) == 2 and int(totals.get("stone_chunk", 0)) == 3, "retry yields exactly one new stack after reload")
	print("A0 SAVE CRASH %s - %d checks (%s)" % ["PASSED" if failures == 0 else "FAILED", checks, boundary])
	quit(0 if failures == 0 else 1)
