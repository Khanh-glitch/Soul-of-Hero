extends "res://tests/survival/balance_native_r14/r14_harness.gd"
## R14EXT — is A1's authored continent actually the world the runtime loads?
##
## Round 12 measured one number: A0's only runtime world document is 384x256 and
## 108 of A1's 118 authored POIs have cells outside it. At the round-13 A0 head
## there is a *second* world source: a bounded 448x256 "waystation candidate"
## (legacy frame + A1's chunk 6:3 annex), gated behind
## `survival/a0_waystation_candidate` and default **off**.
##
## So the honest question is no longer "does A0 load A1's world" but "what does
## the product load by default, and what happens when the gate is opened?" This
## probe measures both, in one run:
##
##   1. **DEFAULT** — the shipped setting, exactly as a player gets it.
##   2. **COUNTERFACTUAL_SETTING** — the same product with
##      `survival/a0_waystation_candidate` forced true at runtime. The note says
##      so; the verdict never claims a player can turn it on.
##
## For each it reports the loaded extent, how many authored POI cells are inside
## it, whether the annex host mounted, and what A0's own mount authority answers
## for the three A8 sites. No file is edited and no bounds are enlarged: the flag
## is the product's own switch.

func _body() -> void:
	probe_id = "R14EXT"
	probe_title = "the loaded world vs the authored one: default gate and the product's own waystation candidate"
	owner_action = (
		"A0 (arena_dea2428e) owns the number: either the default world source becomes one that "
		+ "contains A1's authored continent, or the contract states that the 384x256 Marches is the "
		+ "playable world and A1's 1024x768 frame is authoring reference only. Today the product has "
		+ "both answers in one tree (a gated 448x256 annex) and ships the smaller one."
	)

	var default_report := await _measure(false)
	var forced_report := await _measure(true)
	_note("DEFAULT grid=%s document=%s pois inside=%d/%d standable=%d annex_host=%s"
		% [str(default_report["extent"]), String(default_report["extent"].get("document_bounds", "")),
			int(default_report["pois_inside"]), int(default_report["pois_authored"]),
			int(default_report["pois_standable"]), str(default_report["annex_host"])])
	_note("COUNTERFACTUAL_SETTING grid=%s document=%s pois inside=%d/%d standable=%d annex_host=%s build_error=%s"
		% [str(forced_report["extent"]), String(forced_report["extent"].get("document_bounds", "")),
			int(forced_report["pois_inside"]), int(forced_report["pois_authored"]),
			int(forced_report["pois_standable"]), str(forced_report["annex_host"]),
			String(forced_report["build_error"])])

	_expect(int(default_report["pois_inside"]) > 0,
		"the default world contains some authored POIs (%d of %d)"
		% [int(default_report["pois_inside"]), int(default_report["pois_authored"])])
	_expect(int(default_report["pois_inside"]) >= 100,
		"the default world contains the authored continent (%d of %d POIs standable)"
		% [int(default_report["pois_inside"]), int(default_report["pois_authored"])])

	var default_sites := default_report["sites"] as Array
	var refused := 0
	for row: Dictionary in default_sites:
		if not bool(row.get("ok", false)):
			refused += 1
	_note("DEFAULT A8 mount authority: %d of %d sites refused" % [refused, default_sites.size()])
	var forced_sites := forced_report["sites"] as Array
	var forced_ok := 0
	for row: Dictionary in forced_sites:
		if bool(row.get("ok", false)):
			forced_ok += 1
	_note("COUNTERFACTUAL_SETTING A8 mount authority: %d of %d sites accepted"
		% [forced_ok, forced_sites.size()])

	# The gap between the two is the product's own measurement of what the gate
	# is worth. If it is zero, the annex buys nothing for POIs.
	var delta := int(forced_report["pois_inside"]) - int(default_report["pois_inside"])
	_note("POIs gained by opening the product's own gate: %d" % delta)
	_expect(delta != 0 or bool(forced_report["annex_host"]),
		"the gated annex source changes something measurable (delta=%d, host=%s)"
		% [delta, str(forced_report["annex_host"])])

	_note("display facts: %s" % str(_display_facts()))
	_done()


## Mount the shipped overworld with the gate either as shipped or forced, then
## measure what that mount actually contains. Freeing the world between mounts is
## deliberate: two live worlds would share one SaveService and one run.
func _measure(force_waystation: bool) -> Dictionary:
	var report := {
		"force": force_waystation, "mounted": false, "extent": {}, "pois_authored": 0,
		"pois_inside": 0, "annex_host": false, "build_error": "", "sites": [],
	}
	if is_instance_valid(mounted_world):
		mounted_world.free()
		mounted_world = null
		hero = null
	await process_frame
	var mounted := await _mount_world_ready(force_waystation)
	if mounted == null:
		report["build_error"] = String(blocked)
		return report
	report["mounted"] = true
	# The extent of the grid the product actually built, not of a document the
	# probe assumed: the candidate path swaps A0's data source wholesale, so
	# reading a fixed path would describe the old world twice.
	var world_node: Node = mounted.get(&"world") as Node
	report["annex_host"] = mounted.get_node_or_null("WaystationRuntime") != null
	var walk: RefCounted = mounted.get(&"traversability") as RefCounted
	var loaded_w := 0
	var loaded_h := 0
	if walk != null:
		loaded_w = int(walk.get(&"width"))
		loaded_h = int(walk.get(&"height"))
	var document := ""
	var bounds: Variant = mounted.get(&"world_data")
	if bounds is Dictionary:
		var b: Dictionary = (bounds as Dictionary).get("world_bounds", {})
		document = "%sx%s" % [str(b.get("w", "?")), str(b.get("h", "?"))]
	report["extent"] = {"loaded_w": loaded_w, "loaded_h": loaded_h, "document_bounds": document}
	report["pois_authored"] = 0
	report["pois_inside"] = 0
	report["pois_standable"] = 0
	var graph := _json(R14_A1_GRAPH)
	var pois: Array = graph.get("pois", []) if graph.get("pois") is Array else []
	for row: Variant in pois:
		if not row is Dictionary:
			continue
		report["pois_authored"] = int(report["pois_authored"]) + 1
		var cell: Variant = (row as Dictionary).get("cell", null)
		if not cell is Array or (cell as Array).size() < 2:
			continue
		var c := Vector2i(int((cell as Array)[0]), int((cell as Array)[1]))
		if walk != null and bool(walk.call(&"in_bounds", c)):
			report["pois_inside"] = int(report["pois_inside"]) + 1
			if bool(walk.call(&"is_free", c)):
				report["pois_standable"] = int(report["pois_standable"]) + 1
	report["sites"] = _a8_mount_report(mounted)
	if world_node != null:
		_note("mounted world node=%s children=%d" % [String(world_node.name), world_node.get_child_count()])
	return report
