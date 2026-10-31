extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## D063 / D073 / D074 — does a committed physical action survive a real restart,
## and does the same action pay twice when it is repeated afterwards?
##
## ## The two claims, kept apart
## 1. **Durability.** What process A committed must be readable by a genuinely
##    different OS process reading the same file. Re-reading it in the process that
##    wrote it proves nothing.
## 2. **Replay.** After the restart the player repeats the same physical action. The
##    product must refuse to pay twice — and it must refuse by *state*, not by an
##    in-memory flag that died with the old process.
##
## ## What is measured, and what is not
## The Waystation cannot be mounted in this composition (see `R9SEAM`: one stale A0
## data pin disables the A3 economy session the host requires), so the *waystation*
## half of claim 2 is unmeasurable and is reported as BLOCKED rather than assumed.
## Claim 1 is measured with an action a player really performs — committing a
## structure through the build system, which writes the same durable receipt store
## the Waystation uses — so the restart boundary itself is exercised instead of
## described.
##
## The placement is driven through `try_place(cell)` and labelled `API_NOT_CLICK`:
## headless cannot aim the pointer (measured in R9PLACE), and this probe is about the
## save boundary, not about the input path.

const CHILD_FLAG := "--a7-r9-child"
const SAVE_ARG := "--a7-r9-save="
const PIECE := "foundation_wood"
const GRANT_KEY := "a7_r9_restart_grant"
const TILE := 16


func _body() -> void:
	probe_id = "R9RESTART"
	probe_title = "one committed action, one durable receipt, and the same action after a real OS restart"
	owner_action = (
		"A0: fix the stale items.json pin reported by R9SEAM so the Waystation can mount; the save-side durability "
		+ "this probe does measure works, and the replayed-interaction rule cannot be measured until the host exists."
	)

	var args := OS.get_cmdline_user_args()
	if args.has(CHILD_FLAG):
		await _child(args)
		_done()
		return

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return

	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		return
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		_missing("a configured survival build system", "chapter1_overworld.gd")
		_done()
		return

	# ---- 1. one committed action, in this process ------------------------
	var granted := bool(save.call(&"grant_inventory_item", "oak_wood", "material", 40, GRANT_KEY))
	_note("FIXTURE_GRANT oak_wood=40 ok=%s (materials only; gathering is A0's own journey)" % str(granted))
	var cell := _legal_cell_near(_hero_cell(), build)
	if cell == Vector2i(-1, -1):
		_block("no legal cell within five tiles of the spawn for the durable action")
		return
	var receipts_before := (_snapshot().get("applied_transactions", {}) as Dictionary).size()
	var result: Dictionary = build.call(&"try_place", cell)
	await physics_frame
	_note("API_NOT_CLICK try_place(cell=%s)=%s" % [str(cell), JSON.stringify(result)])
	_expect(bool(result.get("ok", false)), "a legal cell accepts the structure commit")
	var receipts_after := (_snapshot().get("applied_transactions", {}) as Dictionary).size()
	var placed_after := int(build.call(&"placed_count"))
	var wood_after := _count(save, "oak_wood")
	_note("receipts %d -> %d, placed=%d, oak_wood=%d" % [receipts_before, receipts_after, placed_after, wood_after])
	_expect(receipts_after == receipts_before + 1, "the commit writes exactly one durable receipt")
	_expect(placed_after == 1, "the structure exists in this process")

	var saved := bool(save.call(&"save_now"))
	_expect(saved, "the action is flushed to disk before the restart")
	var path := String(ProjectSettings.globalize_path(save_path))
	_expect(FileAccess.file_exists(path), "the save file exists on disk at %s" % path)

	# ---- 2. read it back from a second OS process ------------------------
	var child := _run_second_process([CHILD_FLAG, SAVE_ARG + save_path])
	_note("child_exit=%d" % int(child["code"]))
	var report := _child_report(String(child["output"]))
	_note("child_report=%s" % JSON.stringify(report))
	if report.is_empty():
		_expect(false, "the second process reported what it observed instead of printing nothing")
		_done()
		return
	_expect(int(report.get("pid", 0)) != OS.get_process_id(), "the readback happened in a different OS process")
	_expect(bool(report.get("save_loaded", false)), "the second process loaded the save the first one wrote")
	_expect(bool(report.get("mounted", false)), "the second process mounted the shipped overworld")
	_expect(int(report.get("receipts", -1)) == receipts_after,
		"the receipt written before the restart is present after it (%s)" % str(report.get("receipts", -1)))
	_expect(int(report.get("placed", -1)) == placed_after,
		"the committed structure is rebuilt in the restarted process (%s)" % str(report.get("placed", -1)))
	_expect(int(report.get("oak_wood", -1)) == wood_after,
		"the material spent before the restart stays spent (%s)" % str(report.get("oak_wood", -1)))

	# ---- 3. the replayed action, which the Waystation owns ---------------
	var wallet := await _mount_production_world(true, Vector2i(1280, 720))
	var reason := blocked
	_note("waystation_mount_blocked=%s" % JSON.stringify(reason))
	_expect(wallet == null,
		"the Waystation host is unmountable, so the replayed-click half of D074 cannot be measured here")
	_block(
		"the replayed physical interaction is unmeasurable: the Waystation host requires the A3 economy session, "
		+ "which A0's stale items.json pin disables (%s). Durability of a committed action was measured across two "
		% reason + "processes; the duplicate-payment rule at the Waystation was not."
	)
	_done()


# --------------------------------------------------------------------- child
func _child(args: PackedStringArray) -> void:
	var path := ""
	for arg: String in args:
		if arg.begins_with(SAVE_ARG):
			path = arg.trim_prefix(SAVE_ARG)
	var save := _save()
	var report := {"pid": OS.get_process_id(), "save_loaded": false, "mounted": false}
	if save == null or path.is_empty():
		print("A7CHILD_REPORT %s" % JSON.stringify(report))
		return
	# The product's own documented test door, restricted to user:// — it is what
	# makes "read from disk" true rather than "read from memory".
	if not bool(save.call(&"configure_storage", path, true)):
		print("A7CHILD_REPORT %s" % JSON.stringify(report))
		return
	report["save_loaded"] = bool(save.call(&"is_loaded"))
	report["receipts"] = (_snapshot().get("applied_transactions", {}) as Dictionary).size()
	report["oak_wood"] = _count(save, "oak_wood")

	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		print("A7CHILD_REPORT %s" % JSON.stringify(report))
		return
	var build: Node = mounted.get(&"survival_build")
	report["mounted"] = true
	report["placed"] = int(build.call(&"placed_count")) if build != null else -1
	_release_all()
	print("A7CHILD_REPORT %s" % JSON.stringify(report))


func _count(save: Node, item: String) -> int:
	if not save.has_method(&"inventory_totals"):
		return -1
	return int((save.call(&"inventory_totals") as Dictionary).get(item, 0))


func _legal_cell_near(origin: Vector2i, build: Node) -> Vector2i:
	for radius in range(1, 6):
		for offset: Vector2i in [
			Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius), Vector2i(0, -radius),
			Vector2i(radius, radius), Vector2i(-radius, radius), Vector2i(radius, -radius), Vector2i(-radius, -radius),
		]:
			var cell: Vector2i = origin + offset
			if String(build.call(&"validate_cell", cell)) == "":
				return cell
	return Vector2i(-1, -1)


func _child_report(output: String) -> Dictionary:
	var marker := "A7CHILD_REPORT "
	for line: String in output.split("\n"):
		var at := line.find(marker)
		if at < 0:
			continue
		var parsed: Variant = JSON.parse_string(line.substr(at + marker.length()))
		if parsed is Dictionary:
			return parsed
	return {}


## Run this same script as a second OS process. The engine is the same binary and
## the project is the same tree, so the only shared state is the save file.
func _run_second_process(extra: Array[String]) -> Dictionary:
	var command := OS.get_executable_path()
	var arguments: PackedStringArray = PackedStringArray([
		"--headless", "--path", String(ProjectSettings.globalize_path("res://")),
		"--script", "res://tests/survival/balance_native_r9/r9_restart_replay_probe.gd", "--",
	])
	for value: String in extra:
		arguments.append(value)
	var output: Array = []
	var code := OS.execute(command, arguments, output, true)
	var text := ""
	for chunk: Variant in output:
		text += str(chunk)
	return {"code": int(code), "output": text}


func _finish() -> void:
	_release_all()
	super._finish()
