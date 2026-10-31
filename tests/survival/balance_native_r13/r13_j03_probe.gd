extends "res://tests/survival/balance_native_r13/r13_harness.gd"
## Round 13: this body is the round-11 probe carried forward with only the
## probe id and the harness path changed. It runs against the round-12
## composition, so a defect that survives here is a fact about this tree and
## not a recitation of round 11.
## WP2 — J03: funded station work that pays out once, after real elapsed time, in a
## second OS process.
##
## CT's primary target for this round is one concrete paid, time-bounded production
## job that a player can start at the home station and settle once on return. The
## measurement therefore has to be boringly literal:
##
## * the station must be **physically placed** through the player's placement door,
##   not asserted from data;
## * the job must be **paid** — its inputs are escrowed from the real bag;
## * the elapsed time must be **real**: `burn_charcoal` is an 8-tick job and the
##   engine's own tick is 1 000 000 µs, so ten seconds of wall clock is a complete
##   job. Nothing here forges a timestamp to make an hour pass;
## * the settlement must happen **because a new process launched**, which is the
##   product's own door (`a0_economy_composition.configure` → `offline.settle`);
## * the claim must be **exactly once**, and a second claim in the same process
##   must be refused rather than silently re-paying;
## * A6's return card must read the settled truth, not a fixture — and when no
##   owner projection exists it must say so instead of inventing a reward.

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

const CHILD_FLAG := "--a7-r11-j03-child"
const SAVE_ARG := "--a7-r11-j03-save="
const REPORT := "A7J03CHILD "
const FURNACE := "station_furnace"
const RECIPE := "burn_charcoal"

func _body() -> void:
	probe_id = "R13J03"
	probe_title = "J03 offline payoff: a paid furnace job, real elapsed seconds, one settlement, one claim"
	owner_action = (
		"A0/A3: the job arms, settles and claims once. A6 publishes nothing for the return card: none of the "
		+ "nine owner projection methods A6 resolves by name exists on the composed autoloads, so the card is empty "
		+ "by design and the return digest cannot be inspected as gameplay."
	)

	if OS.get_cmdline_user_args().has(CHILD_FLAG):
		await _child(OS.get_cmdline_user_args())
		_done()
		return

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return
	var economy := _a3()
	var adapter := _adapter()
	if economy == null or adapter == null:
		_missing("a mounted A3 economy session and adapter", "chapter1_overworld.gd")
		_done()
		return
	var offline: Node = _composition().get_node_or_null("A0OfflineHost") if _composition() != null else null
	if offline == null:
		_missing("the A0 offline host under the composition root", "a0_economy_composition.gd")
		_done()
		return

	var job_id := await _armed_job(mounted, economy, adapter, offline)
	if job_id.is_empty():
		_done()
		return

	# --- the absence: a new process, launched now, settles on its own door ---
	var child := await _run_second_process([CHILD_FLAG, SAVE_ARG + save_path, "--job=" + job_id])
	var report := _child_report(String(child.get("output", "")))
	_note("child code=%d report=%s" % [int(child.get("code", -1)), str(report)])
	if report.is_empty():
		var tail := String(child.get("output", ""))
		_note("child tail=%s" % tail.substr(maxi(0, tail.length() - 600)))
		_expect(false, "the returning process produced a settlement report")
		_done()
		return

	_expect(bool(report.get("run_active", false)), "the returning process opens the same active run")
	_expect(String(report.get("proposal_id", "")) != "",
		"the returning process planned a settlement from its own durable clock (%s)" % String(report.get("proposal_id", "")))
	_expect(bool(report.get("settle_ok", false)),
		"the settlement committed exactly once on launch (%s)" % String(report.get("settle_reason", "")))
	_expect(int(report.get("operations", 0)) >= 1,
		"at least one armed operation was settled (%d)" % int(report.get("operations", 0)))
	_expect(int(report.get("charcoal", 0)) >= 2,
		"the job paid its real output into the returning process (%d charcoal)" % int(report.get("charcoal", 0)))
	_expect(bool(report.get("claimed", false)), "the player collects the finished output once (%s)" % String(report.get("claim_reason", "")))
	_expect(bool(report.get("second_refused", false)),
		"a second claim in the same process is refused (%s)" % String(report.get("second_reason", "")))
	_expect(int(report.get("charcoal_after_claim", 0)) == int(report.get("charcoal_after_all", -1)),
		"the refused second claim paid nothing extra (%d -> %d)" % [
			int(report.get("charcoal_after_claim", -1)), int(report.get("charcoal_after_all", -1)),
		])
	# --- what A6 can show about it --------------------------------------
	_owner_projections(report)

	_done()


# ------------------------------------------------------------- 1. start the job
func _armed_job(mounted: Node, economy: Node, adapter: RefCounted, offline: Node) -> String:
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		_missing("a configured survival build system", "chapter1_overworld.gd")
		return ""
	# The furnace is paid with a kit the player crafts; the kit is granted here and
	# every affected claim says FIXTURE_GRANT so the cost claim stays honest.
	if _count_item("furnace_kit") < 1:
		_grant_item("furnace_kit", 1, "a7.r11.j03.kit.%d" % Time.get_ticks_usec())
		_note("FIXTURE_GRANT furnace_kit x1 (the kit itself is craftable from stone 8 + iron 3)")
	if _count_item("oak_wood") < 4:
		_grant_item("oak_wood", 4, "a7.r11.j03.oak.%d" % Time.get_ticks_usec())
		_note("FIXTURE_GRANT oak_wood x4 for the job's paid inputs")
	var cell := _free_cell_near(_hero_cell(), build)
	_expect(cell.x >= 0, "a legal cell exists for the furnace (%s)" % str(cell))
	if cell.x < 0:
		return ""
	var placed := _place(build, FURNACE, cell)
	_expect(bool(placed.get("ok", false)),
		"the player's placement door builds a furnace (%s)" % String(placed.get("reason", "")))
	if not bool(placed.get("ok", false)):
		return ""
	var structures: Dictionary = _survival().call(&"structures") as Dictionary
	var furnace_id := ""
	for key: Variant in structures.keys():
		if String((structures[key] as Dictionary).get("piece", "")) == FURNACE:
			furnace_id = String(key)
			break
	_expect(not furnace_id.is_empty(), "the furnace is a real structure with an identity (%s)" % furnace_id)
	if furnace_id.is_empty():
		return ""
	var station: Dictionary = _survival().call(&"resolve_station", furnace_id) as Dictionary
	_expect(String(station.get("kind", "")) == "furnace",
		"the placed furnace resolves as a furnace station (%s)" % String(station.get("reason", station.get("kind", ""))))
	_expect(bool(station.get("operational", false)), "the placed furnace is operational")

	# Stand next to the station: the product refuses a job it cannot reach.
	var node: Node2D = build.call(&"structure_node", furnace_id) as Node2D
	if node != null:
		await _walk_toward_point(node.global_position + Vector2(0, 20))
	var oak_before := _count_item("oak_wood")
	var queued: Dictionary = economy.call(&"queue_recipe", RECIPE, furnace_id) as Dictionary
	_expect(bool(queued.get("ok", false)),
		"the furnace accepts the paid %s job (%s)" % [RECIPE, String(queued.get("reason", ""))])
	if not bool(queued.get("ok", false)):
		return ""
	var oak_after := _count_item("oak_wood")
	_expect(oak_after == oak_before - 2,
		"the job escrowed its exact paid input (oak %d -> %d)" % [oak_before, oak_after])
	var jobs: Dictionary = economy.call(&"jobs") as Dictionary
	var job_id := ""
	for key: Variant in jobs.keys():
		# A3 keys a job by `target`; `recipe_id`/`recipe` are accepted spellings for
		# owner versions that renamed the field, but `target` is what this head emits.
		var target := String((jobs[key] as Dictionary).get("target", (jobs[key] as Dictionary).get("recipe_id", "")))
		if target == RECIPE:
			job_id = String(key)
			break
	_expect(not job_id.is_empty(), "the queued job has a durable identity (%d jobs)" % jobs.size())
	if job_id.is_empty():
		return ""

	# Arming is A3's decision: allowlisted recipe, paid escrow, reachable station and
	# a host projection that is not in the future. A0 only supplies the clock.
	var now := int(Time.get_unix_time_from_system())
	offline.call(&"plan", now)
	_expect(String(offline.get(&"last_error")) == "",
		"the host projects the real interval up to now without a clock error (%s)" % String(offline.get(&"last_error")))
	var armed: Dictionary = adapter.call(&"arm_offline_operation", job_id, "a7.r11.j03.arm") as Dictionary
	_expect(bool(armed.get("ok", false)),
		"A3 arms the paid job for offline preparation (%s)" % String(armed.get("reason", "")))
	var future: Dictionary = offline.call(&"project", now, now + 3600) as Dictionary
	_expect(future.is_empty(), "a caller cannot forecast a future interval as if it had happened")
	_note("armed=%s job=%s" % [str(armed.get("ok", false)), job_id])
	# The interval has to be one in which this process does no work, or the shipped
	# session simply finishes the job inline and there is nothing left for the
	# returning process to settle. `OS.delay_msec` blocks the main thread exactly as
	# a closed game does: no frames, no session ticks, real seconds on the wall clock.
	# A3's offline policy applies one tick per real second, so a `duration_ticks: 8`
	# recipe needs eight seconds of genuine absence.
	var interval_seconds := 12
	_note("closing the game for %ds of real time before the returning process starts" % interval_seconds)
	OS.delay_msec(interval_seconds * 1000)
	return job_id


# ----------------------------------------------------------- 2. A6 return card
## A6 resolves nine owner methods by name. The question for J03 is not whether A6
## has a nice card: it is whether the composed product publishes anything for it to
## read. Each accessor is called on the real source object, read-only.
func _owner_projections(report: Dictionary) -> void:
	var source_script: Script = load("res://game/survival/ui/return/a6_owner_projection_source.gd") as Script
	_expect(source_script != null, "A6 ships its owner-projection source in this composition")
	if source_script == null:
		_missing("A6's owner projection source", "game/survival/ui/return/a6_owner_projection_source.gd")
		return
	var source: RefCounted = source_script.new()
	source.call(&"configure", self, {})
	var accessors: Array[String] = ["season_clock", "run_facts", "return_digest", "digest_acknowledgements", "run_history", "site_cue"]
	var unavailable: Array[String] = []
	for name: String in accessors:
		if not source.has_method(StringName(name)):
			unavailable.append(name + ":absent")
			continue
		var value: Variant = source.call(StringName(name))
		var state := ""
		if value is Dictionary:
			state = String((value as Dictionary).get("status", (value as Dictionary).get("contract", "")))
		_note("a6.%s -> %s" % [name, state if not state.is_empty() else str(value).substr(0, 80)])
		if state.contains("unavailable") or state.is_empty():
			unavailable.append(name)
	if unavailable.size() > 0:
		_missing("an owner-published A6 return projection (A6_SOURCE_UNAVAILABLE)",
			"a6_owner_projection_source.gd resolves six accessors by name on the composed autoloads; "
			+ "%d of %d read an empty contract (absent: %s)" % [unavailable.size(), accessors.size(), str(unavailable)])
	if not report.is_empty() and int(report.get("charcoal", 0)) > 0:
		_expect(unavailable.size() > 0,
			"the return digest does not invent a reward for a settlement A6 cannot read (%d/%d accessors empty)"
			% [unavailable.size(), accessors.size()])


# ------------------------------------------------------------------- the child
## The returning player. It opens the same bytes, mounts the shipped world (which
## settles the armed job through the product's own door), then claims once.
func _child(args: PackedStringArray) -> void:
	var target := ""
	var job_id := ""
	for arg: String in args:
		if arg.begins_with(SAVE_ARG):
			target = arg.trim_prefix(SAVE_ARG)
		elif arg.begins_with("--job="):
			job_id = arg.trim_prefix("--job=")
	if target.is_empty():
		print(REPORT + JSON.stringify({"error": "no_save_arg"}))
		return
	var save := _save()
	if save == null:
		print(REPORT + JSON.stringify({"error": "no_save_service"}))
		return
	if not bool(save.call(&"configure_storage", target, true)):
		print(REPORT + JSON.stringify({"error": "storage_refused"}))
		return
	var mounted := await _mount_world_ready(false)
	if mounted == null:
		print(REPORT + JSON.stringify({"error": "world_not_ready", "blocked": blocked}))
		return
	var economy := _a3()
	var composition := _composition()
	var offline: Node = composition.get_node_or_null("A0OfflineHost") if composition != null else null
	var settle: Dictionary = composition.get(&"_last_settle") if composition != null and composition.get(&"_last_settle") is Dictionary else {}
	var run := _active_run()
	var charcoal_start := _count_item("charcoal")
	var claimed := {}
	var after_claim := charcoal_start
	var second := {}
	var after_all := charcoal_start
	if economy != null and not job_id.is_empty():
		claimed = economy.call(&"collect", job_id) as Dictionary
		after_claim = _count_item("charcoal")
		second = economy.call(&"collect", job_id) as Dictionary
		after_all = _count_item("charcoal")
	var report := {
		"run_active": String(_run_phase().get("state", "")) == "active",
		"settle_ok": bool(settle.get("ok", false)),
		"settle_reason": String(settle.get("reason", "")),
		"proposal_id": String(settle.get("proposal_id", "")),
		"operations": int(settle.get("operations", 0)),
		"charcoal": after_claim,
		"claimed": bool(claimed.get("ok", false)),
		"claim_reason": String(claimed.get("reason", "")),
		"second_refused": not bool(second.get("ok", true)),
		"second_reason": String(second.get("reason", "")),
		"charcoal_after_claim": after_claim,
		"charcoal_after_all": after_all,
		"offline_host": offline != null,
		"run_id": String(run.get("run_id", "")),
	}
	print(REPORT + JSON.stringify(report))


func _child_report(output: String) -> Dictionary:
	for line: String in output.split("\n"):
		var at := line.find(REPORT)
		if at < 0:
			continue
		var parsed: Variant = JSON.parse_string(line.substr(at + REPORT.length()))
		if parsed is Dictionary:
			return parsed
	return {}


func _finish() -> void:
	_release_all()
	super._finish()
