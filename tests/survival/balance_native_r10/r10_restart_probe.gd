extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP2 — A0 settlement across two real OS processes.
##
## The claim under test is A0's own ("home-only separate restart passes"), so the
## measurement has to be A0's too: process A commits, process B is a *different PID*
## reading the same file, and nothing crosses between them except bytes on disk.
##
## What is committed here is deliberately ordinary: a run record created by A0's own
## port, a paid structure through the build system, and one A0 wallet receipt. The
## probe then checks in the child that the run identity, the receipts and the spent
## materials all survived — and that the run clock kept moving forward, which is the
## part a "restart" claim usually forgets.

const CHILD_FLAG := "--a7-r10-child"
const SAVE_ARG := "--a7-r10-save="
const GRANT_KEY := "a7_r10_restart_grant"
const PIECE := "foundation_wood"


func _body() -> void:
	probe_id = "R10RESTART"
	probe_title = "run record, paid structure and wallet receipt survive a genuine second OS process"
	owner_action = (
		"A0: none requested for durability. The run record and receipts survive a restart on the real port; see "
		+ "R10SEAM for the mount gap and R10PORT for the expiry gate."
	)

	if OS.get_cmdline_user_args().has(CHILD_FLAG):
		await _child(OS.get_cmdline_user_args())
		_done()
		return

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return
	var port := _make_port(save, Callable(self, "_hero_cell"))
	if port == null:
		_missing("a configured A0 profile port", PROFILE_PORT)
		_done()
		return
	var run: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS, "a7-r10-restart")
	_expect(not run.is_empty(), "process A creates the durable run through the real port")
	var wallet: Dictionary = port.call(&"commit_profile_delta", "a7-r10-restart-deposit", 4, {"kind": "probe"})
	_expect(bool(wallet.get("ok", false)), "process A commits one wallet receipt")

	# A paid structure through the build system: the same durable receipt store the
	# Waystation uses, driven by the product's own placement door.
	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		return
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		_missing("a configured survival build system", "chapter1_overworld.gd")
		_done()
		return
	_expect(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 40, GRANT_KEY)),
		"the product inventory accepts the materials the placement will spend (FIXTURE_GRANT)")
	var cell := _legal_cell(_hero_cell(), build)
	if cell == Vector2i(-1, -1):
		_block("no legal cell near the spawn for the paid structure")
		return
	var placement: Dictionary = build.call(&"try_place", cell)
	await physics_frame
	_note("API_NOT_CLICK try_place(%s)=%s" % [str(cell), JSON.stringify(placement)])
	_expect(bool(placement.get("ok", false)), "the paid structure commits")

	var receipts := _receipt_count()
	var wood := _count(save, "oak_wood")
	var placed := int(build.call(&"placed_count"))
	var balance := int(port.call(&"balance"))
	var run_id := String((port.call(&"run_context") as Dictionary).get("run_id", ""))
	var started := int((port.call(&"run_context") as Dictionary).get("run_started_at_unix", 0))
	_expect(bool(save.call(&"save_now")), "process A flushes to disk before the restart")
	_note("A: receipts=%d placed=%d oak_wood=%d balance=%d run=%s started=%d" % [
		receipts, placed, wood, balance, run_id, started,
	])

	var child := _run_second_process([CHILD_FLAG, SAVE_ARG + save_path])
	_note("child_exit=%d" % int(child["code"]))
	var report := _child_report(String(child["output"]))
	_note("child=%s" % JSON.stringify(report))
	if report.is_empty():
		_expect(false, "the second process reported what it observed")
		_done()
		return
	_expect(int(report.get("pid", 0)) != OS.get_process_id(), "the readback happened in a different OS process")
	_expect(int(report.get("receipts", -1)) == receipts, "every committed receipt survived the restart")
	_expect(int(report.get("placed", -1)) == placed, "the paid structure was rebuilt in the new process")
	_expect(int(report.get("oak_wood", -1)) == wood, "the materials spent before the restart stay spent")
	_expect(int(report.get("balance", -1)) == balance, "the wallet balance survived the restart")
	_expect(String(report.get("run_id", "")) == run_id, "the run identity is the same run, not a new one")
	_expect(int(report.get("started", 0)) == started, "the run start did not move across the restart")
	_expect(int(report.get("now", 0)) >= int(report.get("started", 0)),
		"the run clock in the new process is at or after the start, so time kept moving forward")
	_done()


# --------------------------------------------------------------------- child
func _child(args: PackedStringArray) -> void:
	var path := ""
	for arg: String in args:
		if arg.begins_with(SAVE_ARG):
			path = arg.trim_prefix(SAVE_ARG)
	var save := _save()
	var report := {"pid": OS.get_process_id()}
	if save == null or path.is_empty():
		print("A7CHILD_REPORT %s" % JSON.stringify(report))
		return
	if not bool(save.call(&"configure_storage", path, true)):
		print("A7CHILD_REPORT %s" % JSON.stringify(report))
		return
	report["receipts"] = _receipt_count()
	report["oak_wood"] = _count(save, "oak_wood")
	var port := _make_port(save, Callable(self, "_hero_cell"))
	if port != null:
		var ctx: Dictionary = port.call(&"run_context")
		report["run_id"] = String(ctx.get("run_id", ""))
		report["started"] = int(ctx.get("run_started_at_unix", 0))
		report["now"] = int(ctx.get("now_unix", 0))
		report["balance"] = int(port.call(&"balance"))
	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted != null:
		var build: Variant = mounted.get(&"survival_build")
		report["placed"] = int((build as Node).call(&"placed_count")) if build != null else -1
	_release_all()
	print("A7CHILD_REPORT %s" % JSON.stringify(report))


func _inventory_totals() -> Dictionary:
	var save := _save()
	return save.call(&"inventory_totals") as Dictionary if save != null else {}


func _count(save: Node, item: String) -> int:
	if not save.has_method(&"inventory_totals"):
		return -1
	return int((save.call(&"inventory_totals") as Dictionary).get(item, 0))


func _legal_cell(origin: Vector2i, build: Node) -> Vector2i:
	for radius in range(1, 6):
		for offset: Vector2i in [Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius),
				Vector2i(0, -radius), Vector2i(radius, radius), Vector2i(-radius, -radius)]:
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


func _run_second_process(extra: Array[String]) -> Dictionary:
	var arguments: PackedStringArray = PackedStringArray([
		"--headless", "--path", String(ProjectSettings.globalize_path("res://")),
		"--script", "res://tests/survival/balance_native_r10/r10_restart_probe.gd", "--",
	])
	for value: String in extra:
		arguments.append(value)
	var output: Array = []
	var code := OS.execute(OS.get_executable_path(), arguments, output, true)
	var text := ""
	for chunk: Variant in output:
		text += str(chunk)
	return {"code": int(code), "output": text}


func _finish() -> void:
	_release_all()
	super._finish()
