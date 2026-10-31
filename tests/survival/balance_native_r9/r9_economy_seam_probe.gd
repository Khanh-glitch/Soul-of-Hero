extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## The seam between A0 and A3, measured at the point where the player meets it.
##
## ## What happened first
## A probe that mounts the shipped overworld with the Waystation candidate enabled
## came back `BLOCKED: the production overworld never reached READY`. That is a
## harness-shaped sentence about an owner-shaped problem, so this probe follows the
## product's own error text to the cause instead of stopping at the symptom.
##
## Product's chain, in its own words:
##
## 1. `chapter1_overworld._build_economy_session()` configures A3's session; on
##    failure it warns *"Economy session unavailable; crafting remains disabled"*
##    and sets `economy_session = null`.
## 2. `economy_session.configure()` calls A0's fence
##    `a0_v5_source_pins.verify()` and refuses when it returns a mismatch.
## 3. With the Waystation candidate on, the overworld then calls
##    `_fail("Waystation candidate requires the A3 economy session")`.
##
## So one stale hash disables the entire survival economy for a player and makes
## the Waystation unmountable. This probe recomputes every pin and names the file.
##
## ## What it does not do
## It does not edit, re-pin or work around the fence. Widening a fence to make a
## test green is exactly the failure mode the fence exists to prevent.

const FENCE := "res://game/survival/economy/a0_v5_source_pins.gd"
const SESSION := "res://game/survival/economy/economy_session.gd"


func _body() -> void:
	probe_id = "R9SEAM"
	probe_title = "one stale A0 data pin turns the survival economy off and makes the Waystation unmountable"
	owner_action = (
		"A0: refresh `a0_v5_source_pins.DATA[\"res://data/survival/items/items.json\"]` to the sha256 of A3's current "
		+ "owner bytes (or ask A3 to revert items.json). The fence itself, the drift check and the fail-closed "
		+ "behaviour are all correct and should stay."
	)

	# ---- 1. the fence, recomputed ---------------------------------------
	if not FileAccess.file_exists(FENCE):
		_missing("A0's signature fence %s" % FENCE, "refs/live/arena-dea2428e")
		_done()
		return
	var fence_script: Script = load(FENCE) as Script
	if fence_script == null:
		_missing("a loadable fence script", FENCE)
		_done()
		return
	var data_pins: Dictionary = fence_script.get_script_constant_map().get("DATA", {})
	var script_pins: Dictionary = fence_script.get_script_constant_map().get("SCRIPTS", {})
	_note("fence declares %d data pins and %d script pins" % [data_pins.size(), script_pins.size()])
	_expect(data_pins.size() >= 7, "the fence pins the survival data it protects (>=7 files)")
	_expect(script_pins.size() >= 3, "the fence pins the vendor scripts it protects (>=3 files)")

	var drift: Array[String] = []
	for path: String in data_pins.keys():
		if not FileAccess.file_exists(path):
			drift.append("missing:%s" % path)
			continue
		var actual := FileAccess.get_sha256(path)
		var expected := String(data_pins[path])
		if actual != expected:
			drift.append(path)
			_note("DRIFT %s pin=%s actual=%s" % [path, expected.substr(0, 12), actual.substr(0, 12)])
	_expect(drift.size() == 1,
		"exactly one pinned data file has drifted from its pin (found %d: %s)" % [drift.size(), JSON.stringify(drift)])
	_expect(drift.has("res://data/survival/items/items.json"),
		"the drifted file is A3's items.json, the catalogue the whole economy is built from")
	# A control: the recipes file is pinned to A3's current bytes, so the fence is
	# not simply stale for everything — this is drift in one file, not a wholesale
	# version mismatch, and that narrows the fix to one hash.
	_expect(not drift.has("res://data/survival/recipes/recipes.json"),
		"recipes.json still matches its pin, so this is one drifted file rather than a stale fence")

	# ---- 2. what the product's own verifier says ------------------------
	var verdict := ""
	if fence_script.has_method(&"verify"):
		verdict = String(fence_script.call(&"verify"))
	elif fence_script.can_instantiate():
		var instance: RefCounted = fence_script.new()
		verdict = String(instance.call(&"verify"))
	_note("fence_verify=%s" % JSON.stringify(verdict))
	_expect(verdict == "a3_data_pin_mismatch:res://data/survival/items/items.json",
		"the fence refuses with exactly the items.json mismatch and nothing else")

	var session_source := FileAccess.get_file_as_string(SESSION) if FileAccess.file_exists(SESSION) else ""
	_expect(session_source.contains("preload(\"res://game/survival/economy/a0_v5_source_pins.gd\")")
		and session_source.contains("V5_PINS.verify()"),
		"A3's session consults the fence before it will configure (positive control for the source read)")
	_note("session_fence_use=%s" % str(session_source.contains("V5_PINS.verify()")))

	# ---- 3. the player-visible consequence ------------------------------
	# Flag OFF: the world builds, but without an economy session. That is the state
	# every shipped player is in today.
	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_without_flag_blocked=%s" % blocked)
		_expect(false, "the shipped overworld mounts with the flag at its shipped default")
		_done()
		return
	var session: Variant = mounted.get(&"economy_session")
	_note("economy_session_without_flag=%s survival_build=%s save=%s survival=%s" % [
		"null" if session == null else str(session),
		str(mounted.get(&"survival_build") != null), str(_save() != null), str(_survival() != null),
	])
	_expect(session == null,
		"a shipped player gets no economy session at all, so crafting and every meta-economy action are absent")
	_expect(_save() != null and _survival() != null and mounted.get(&"survival_build") != null,
		"the null session is the fence's doing, not a missing SaveService, SurvivalService or build system")
	_expect(String(mounted.get(&"build_error")) == "",
		"without the Waystation flag the world still reaches READY — the failure is contained to the economy")
	_note("workshop_structure_count=%s" % str((mounted.get(&"survival_build") as Node).call(&"placed_count") if mounted.get(&"survival_build") != null and (mounted.get(&"survival_build") as Node).has_method(&"placed_count") else "n/a"))

	# Flag ON in the same process: now the missing session is fatal.
	mounted.queue_free()
	await process_frame
	production = null
	var forced := await _mount_production_world(true, Vector2i(1280, 720))
	var forced_reason := blocked
	# This is not "the sandbox cannot measure it": the product refuses to build with
	# its own switch. Recording the harness's blocker would hide a defect behind the
	# environment, so the blocker is converted into an assertion and cleared.
	blocked = ""
	_note("forced_mount_blocked=%s" % JSON.stringify(forced_reason))
	_expect(forced != null, "the shipped overworld builds with survival/a0_waystation_candidate=true, its own door")
	_expect(forced_reason.contains("Waystation candidate requires the A3 economy session"),
		"the refusal names the economy session as the dependency, so the blame lands on the right seam")

	_note(
		"VERDICT: the Waystation is not merely switched off in this composition — its declared prerequisite is "
		+ "failed by one stale hash, so no player can reach it and no round-9 interaction probe can observe a real "
		+ "interaction until A0 re-pins items.json. Everything downstream of that click is therefore unmeasured."
	)
	_done()
