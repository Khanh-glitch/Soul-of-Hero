extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP5 — the A6 return UI on a composed build, and the projections it needs.
##
## A6's return layer is written to read *owner projections* by optional method name
## and to show `unavailable` rather than guess. So the interesting question for a
## composed product is not "does the panel render" — it cannot, headless — but
## "does any owner publish the facts the panel is allowed to show".
##
## This probe mounts the real A6 layer against the composed `SaveService` and reads
## the four projections through A6's own source object. Each one that comes back
## `unavailable` is named, together with the exact owner methods A6 looked for and
## the number of them that exist in the composed `game/` tree. That is the precise
## `A6_SOURCE_UNAVAILABLE` report CT asked for, and it is why no part of this probe
## may conclude "the return UI works".

const LAYER_SCENE := "res://game/survival/ui/return/a6_survival_return_layer.tscn"
const SOURCE := "res://game/survival/ui/return/a6_owner_projection_source.gd"


func _body() -> void:
	probe_id = "R10A6"
	probe_title = "A6 return UI: mounted on the composition, and the owner projections it is allowed to show"
	owner_action = (
		"A0: publish at least one of `get_season_projection` / `get_run_guidance_facts` / `get_offline_return_digest` "
		+ "and the acknowledgement write A6 emits requires. Until an owner answers, A6's cards can only ever say "
		+ "`unavailable`, which is correct behaviour and not a return experience."
	)

	# ---- 1. which owner methods exist at all ----------------------------
	var wanted := {
		"season_clock": ["get_season_projection", "get_run_season_projection", "get_run_projection"],
		"run_facts": ["get_run_guidance_facts", "get_run_facts_projection", "get_guidance_projection"],
		"return_digest": ["get_offline_return_digest", "get_return_digest"],
		"site_cue": ["get_site_cue_projection", "get_signs_projection"],
		"run_history": ["get_profile_history_projection", "get_run_history_projection"],
	}
	var published: Dictionary = {}
	for projection: String in wanted.keys():
		var found: Array[String] = []
		for method: String in wanted[projection]:
			if _method_exists_anywhere(method):
				found.append(method)
		published[projection] = found
		_note("projection %s: owner_methods_present=%s" % [projection, JSON.stringify(found)])
	var missing_total := 0
	for projection: String in published.keys():
		missing_total += (published[projection] as Array).size()

	# ---- 2. what A6 itself reports on the real autoloads ----------------
	var source_script: Script = load(SOURCE) as Script
	var layer_available := ResourceLoader.exists(LAYER_SCENE)
	_expect(layer_available, "A6's return layer scene ships in the composed tree")
	if source_script == null:
		_missing("A6's owner projection source", SOURCE)
		_done()
		return
	var reader: RefCounted = source_script.new()
	reader.call(&"configure", self, {})
	var observed: Dictionary = {}
	for projection: String in ["season_clock", "run_facts", "return_digest", "digest_ack", "run_history", "site_cue"]:
		if not reader.has_method(projection):
			continue
		var value: Variant = reader.call(projection)
		var row: Dictionary = value if value is Dictionary else {}
		observed[projection] = String(row.get("status", row.get("contract", "empty")))
	_note("a6_projection_status=%s" % JSON.stringify(observed))

	var fabricated := 0
	for projection: String in observed.keys():
		var status := String(observed[projection])
		if status not in ["empty", "unavailable", "UNAVAILABLE", "unknown"]:
			fabricated += 1
	_note("projections_with_data=%d of %d" % [fabricated, observed.size()])

	if observed.is_empty():
		_missing("any readable projection accessor on A6's source", SOURCE)
	else:
		# Stated as the product requirement, so a PASS means a player can see
		# something. Zero owner methods in `game/` means the cards can only be empty,
		# which is A6 behaving correctly and no return experience existing.
		_expect(missing_total > 0,
			"an owner publishes at least one projection A6 is allowed to show (0 of %d candidate methods exist in "
			% _candidate_count(wanted) + "game/, so every A6 card is empty: A6_SOURCE_UNAVAILABLE)")
		# And the negative: with nothing published, A6 must not invent a number.
		_expect(fabricated == 0,
			"A6 invents nothing when no owner publishes: %d of %d accessors returned data" % [fabricated, observed.size()])

	# ---- 3. the layer mounts without a display ---------------------------
	var layer_ok := false
	if layer_available:
		var packed: PackedScene = load(LAYER_SCENE) as PackedScene
		if packed != null:
			var layer: Node = packed.instantiate()
			if layer != null:
				root.add_child(layer)
				await process_frame
				await process_frame
				layer_ok = is_instance_valid(layer) and layer.is_inside_tree()
				_note("a6_layer_mounted=%s children=%d" % [str(layer_ok), layer.get_child_count()])
				layer.queue_free()
				await process_frame
	_expect(layer_ok, "A6's return layer instantiates and enters the tree on the composition")
	_note("VISUAL_NOT_REVIEWED: no frame was rasterised (headless), so no card was seen by a human")

	# ---- 4. does A6 write? ---------------------------------------------
	var save := _save()
	var before := JSON.stringify(_snapshot().get("profile", {}))
	if save != null and layer_ok:
		# Mount again and let a tick pass: if A6 wrote to the save, the profile would
		# change. A6's own contract says it never writes; this is the composed check.
		var packed_again: PackedScene = load(LAYER_SCENE) as PackedScene
		var layer2: Node = packed_again.instantiate()
		root.add_child(layer2)
		await process_frame
		await physics_frame
		layer2.queue_free()
		await process_frame
	var after := JSON.stringify(_snapshot().get("profile", {}))
	_expect(before == after, "mounting and ticking A6's layer writes nothing into the owner profile")
	_done()


func _candidate_count(wanted: Dictionary) -> int:
	var total := 0
	for projection: String in wanted.keys():
		total += (wanted[projection] as Array).size()
	return total


## True when some `.gd` file under `game/` declares `func <method>(`.
func _method_exists_anywhere(method: String) -> bool:
	var stack: Array[String] = ["res://game"]
	var needle := "func %s(" % method
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
			if FileAccess.get_file_as_string(path.path_join(file)).contains(needle):
				return true
	return false
