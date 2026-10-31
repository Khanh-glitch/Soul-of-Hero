extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP1/WP4 — the composition seams, at current owner heads.
##
## Three questions, each answerable without a rendered frame:
##
## 1. **Does A0's own source fence still disagree with A3's bytes?** Round 9 found
##    one drifted pin. CT's order is explicit: recompute on the *new* composition
##    and do not infer either way. So every pin is recomputed here and the drifted
##    file's consequence is identified, not assumed.
## 2. **Is the survival economy actually configured for a player?** A fence
##    mismatch turns `economy_session` into `null` and, with the Waystation flag,
##    stops the overworld from building at all.
## 3. **Is A0's new profile port reachable from production?** The file exists. The
##    question is whether anything in `game/` calls it, which is a different claim
##    and the one that decides whether A3 V7 can ever run.

const FENCE := "res://game/survival/economy/a0_v5_source_pins.gd"
const OVERWORLD := "res://game/overworld/chapter1_overworld.gd"


func _body() -> void:
	probe_id = "R10SEAM"
	probe_title = "current-head seam: A0 source fence, economy session, and whether the new profile port is wired"
	owner_action = (
		"A0: re-pin `a0_v5_source_pins.DATA[items.json]` to A3's current bytes (or vendor A3's catalogue as A0's own "
		+ "and drop the duplicate), and mount `a0_profile_port` from the composition root — `ensure_run` and "
		+ "`configure_meta_profile_port` currently have zero production callers, so V7 cannot run for a player."
	)

	# ---- 1. the fence, recomputed on current bytes ----------------------
	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return
	var fence_script: Script = load(FENCE) as Script
	if fence_script == null:
		_missing("A0's composition fence %s" % FENCE, "refs/live/arena-dea2428e")
		_done()
		return
	var constants: Dictionary = fence_script.get_script_constant_map()
	var data_pins: Dictionary = constants.get("DATA", {})
	var script_pins: Dictionary = constants.get("SCRIPTS", {})
	_note("fence: %d data pins, %d script pins" % [data_pins.size(), script_pins.size()])
	_expect(data_pins.size() >= 7, "the fence still pins the survival data it protects")

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
	_note("drifted_pins=%s" % JSON.stringify(drift))

	var verdict := String(fence_script.call(&"verify")) if fence_script.has_method(&"verify") else ""
	_note("fence_verify=%s" % JSON.stringify(verdict))

	# The consequence is read from A3's own catalogue rather than memory: the item
	# the pinned file lacks is the currency A3 V7 mints and banks.
	var items_path := "res://data/survival/items/items.json"
	var items_text := FileAccess.get_file_as_string(items_path) if FileAccess.file_exists(items_path) else ""
	_expect(items_text.contains("ragnarok_unbanked"),
		"the composed catalogue is A3's (it contains the V7 currency `ragnarok_unbanked`)")
	if drift.size() == 1 and drift[0] == items_path:
		_note(
			"one drifted pin, and it is the file whose only difference from A0's pinned bytes is the V7 currency "
			+ "item: A0's fence and A3's V7 catalogue cannot both be satisfied by a composing player"
		)
	_expect(drift.size() <= 1, "at most one pin drifts, so this is a single-file conflict rather than a stale fence")

	# ---- 2. what the player actually gets -------------------------------
	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		return
	var session: Variant = mounted.get(&"economy_session")
	var build: Variant = mounted.get(&"survival_build")
	_note("economy_session=%s survival_build=%s build_error=%s" % [
		"null" if session == null else str(session),
		"null" if build == null else "present",
		JSON.stringify(String(mounted.get(&"build_error"))),
	])
	# The catalogue itself is intact — A3's data loads in a bare service — so a null
	# session is a *wiring* failure, not missing data. That distinction is the point.
	var bare := _make_a3(save, null)
	var recipe_count := 0
	if bare != null:
		var catalog: Variant = bare.get(&"catalog")
		if catalog is Dictionary:
			recipe_count = ((catalog as Dictionary).get("recipes", {}) as Dictionary).size()
	_note("catalogue_recipes=%d (loaded by a bare A3 service, no port)" % recipe_count)
	_expect(recipe_count > 0, "A3's catalogue is present and parses in this composition")
	# Stated as the contract, not as the observation: a PASS here must mean the
	# product works, so "the session is null" is the failure, and the reason is a
	# separate check.
	_expect(session != null,
		"the shipped overworld configures the survival economy (economy_session=%s, fence=%s)"
		% ["null" if session == null else "present", JSON.stringify(verdict)])
	_expect(not verdict.begins_with("a3_data_pin_mismatch"),
		"A0's source fence agrees with the A3 bytes it composes (%s)" % JSON.stringify(verdict))
	var panel_source := FileAccess.get_file_as_string(OVERWORLD)
	_expect(panel_source.contains("func _build_economy_panel() -> void:") and panel_source.contains("if economy_session == null:"),
		"the overworld's economy panel returns early when the session is null")

	# ---- 3. is the new A0 profile port reachable? ------------------------
	var port_script: Script = load(PROFILE_PORT) as Script
	_expect(port_script != null, "A0's profile port file exists in the composed tree (SOURCE_PRESENT)")
	var port_methods: Array[String] = []
	if port_script != null:
		for method: Dictionary in port_script.get_script_method_list():
			port_methods.append(String(method["name"]))
	for required: String in ["run_context", "endpoint_authority", "source_authority", "read_profile",
			"apply_profile_delta", "ensure_run", "commit_meta_deposit", "commit_profile_delta"]:
		_expect(port_methods.has(required), "the port declares `%s`" % required)

	var production_calls := {
		"configure_meta_profile_port": _callers_outside("game/survival/economy/economy_service.gd", "configure_meta_profile_port"),
		"ensure_run": _callers_outside("game/survival/economy/a0_profile_port.gd", "ensure_run"),
		"commit_meta_deposit": _callers_outside("game/survival/economy/a0_profile_port.gd", "commit_meta_deposit"),
		# The *file*, not the contract string: A3 legitimately mentions
		# `soh.economy.a0_profile_port.v1` in its contract constants, and matching
		# that would have counted a comment as a mount.
		"a0_profile_port.gd": _callers_outside("game/survival/economy/a0_profile_port.gd", "a0_profile_port.gd"),
	}
	_note("production_callers=%s" % JSON.stringify(production_calls))
	for name: String in production_calls.keys():
		_expect(not (production_calls[name] as Array).is_empty(),
			"some production path mounts `%s`, so the boundary is reachable rather than dead code" % name)

	# `SaveService` must not be able to hand the port out either: if it could, some
	# UI could wire it without a composition-root call.
	var save_source := FileAccess.get_file_as_string("res://game/autoload/save_service.gd")
	_expect(not save_source.contains("a0_profile_port"),
		"SaveService is not a second wallet door: it neither preloads nor exposes the profile port")
	_expect(save_source.contains("func transact_once("),
		"SaveService still offers the single atomic mutator the port depends on")

	# ---- 4. the composed world with the flag on -------------------------
	# The first world is still in the tree; two overworlds would share autoloads and
	# make every later observation ambiguous.
	if is_instance_valid(production):
		production.queue_free()
		await process_frame
	production = null
	var forced := await _mount_production_world(true, Vector2i(1280, 720))
	var forced_reason := blocked
	blocked = ""
	if forced != null:
		_expect(forced.get(&"economy_session") != null,
			"with survival/a0_waystation_candidate=true the economy session configures")
		_expect(waystation_host != null, "the Waystation host mounts")
	else:
		# A refused build is a product outcome, not an environment limit, so it is
		# asserted rather than recorded as a blocker.
		_note("forced_build_refused=%s" % JSON.stringify(forced_reason))
		_expect(forced_reason.contains("requires the A3 economy session"),
			"the forced Waystation build is refused by the same missing economy session")

	_note(
		"VERDICT: the port exists and is well-formed, and it is not part of the player's path; the fence conflict "
		+ "is what keeps A3 V7 — and, with the candidate flag, the Waystation — out of the product."
	)
	_done()


## Files that *call* `needle`, ignoring the declared owner and ignoring hits that
## only appear in a doc comment.
func _callers_outside(declaring_file: String, needle: String) -> Array[String]:
	var out: Array[String] = []
	var stack: Array[String] = ["res://game"]
	while not stack.is_empty():
		var path: String = stack.pop_back()
		var dir := DirAccess.open(path)
		if dir == null:
			continue
		for sub: String in dir.get_directories():
			stack.append(path.path_join(sub))
		for file: String in dir.get_files():
			if not file.ends_with(".gd"):
				continue
			var full := path.path_join(file)
			if full.ends_with(declaring_file):
				continue
			var text := FileAccess.get_file_as_string(full)
			for line: String in text.split("\n"):
				var stripped := line.strip_edges()
				if stripped.begins_with("#"):
					continue
				if stripped.contains(needle):
					out.append("%s:%s" % [full.get_file(), stripped.substr(0, 60)])
					break
	return out
