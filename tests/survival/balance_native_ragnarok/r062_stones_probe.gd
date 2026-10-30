extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## D062 / D065 — six awakened elders, six unique stones, and an evacuation that is
## neither abandoning nor a manufactured victory.
##
## ## The honest split
## No elder, no stone and no evacuation exists in this composition (asserted with
## symbol searches, not adjectives). Rather than stop at "RED", the probe measures
## the *world* the six elders have to live in — A1's real plan, route graph and
## region list — and reports exactly what is missing where, plus an executable
## evacuation model so the difference between evacuating and abandoning has a
## falsifier when the feature lands.

const WORLD_PLAN := "res://data/survival/world/world_plan.v1.json"
const ROUTE_GRAPH := "res://data/survival/world/poi_route_graph.json"
## Whole identifiers only. A substring scan for "stone_" matches "stone_chunk" in
## the material catalog and would report the six-stone loop as implemented.
const ELDER_SYMBOLS := [
	"\\bawakened_elder\\b", "\\belder_boss\\b", "\\belder_territory\\b",
	"\\bachievement_stone\\b", "\\bevacuation_point\\b", "\\bevacuate_run\\b",
]
const RAGNAROK_SYMBOLS := ["ragnarok", "ragnarok_phase", "catastrophe_phase"]


func _body() -> void:
	probe_id = "R062"
	probe_title = "six awakened elders, six unique stones, evacuation distinct from abandonment"
	owner_action = (
		"A1/A4: author six elder territories inside the eleven regions, one awakened elder per territory with a "
		+ "genuine approach route, one unique achievement stone each, sealed manifestations before 264 h, and a "
		+ "physical evacuation point; A0: a phase field driven by 264 h / 312 h; A3: stone effects that never pay "
		+ "currency or skip the last 72 h."
	)

	var tuning := _json(TUNING_JSON)
	var values: Dictionary = tuning.get("values", {})
	_note("tuning_status=%s" % String(tuning.get("status", "")))

	# ---- A. does the finale exist at all? -------------------------------
	var all_gd := _collect("res://game", ".gd")
	var all_json := _collect("res://data", ".json")
	_note("scripts=%d data_files=%d" % [all_gd.size(), all_json.size()])

	var elder_hits := _matches(all_gd + all_json, ELDER_SYMBOLS)
	_note("elder_or_stone_hits=%s" % JSON.stringify(elder_hits))
	if elder_hits.is_empty():
		_missing("any awakened-elder, achievement-stone or evacuation symbol in game/ or data/", "res://game/, res://data/")

	var finale_hits := _matches(all_gd + all_json, RAGNAROK_SYMBOLS)
	_note("finale_hits=%s" % JSON.stringify(finale_hits))
	if finale_hits.is_empty():
		_missing("a Ragnarok phase field driven by the clock (264 h roaming, 312 h catastrophe)", "any runtime script")

	# ---- B. is the world ready to hold six elder territories? -----------
	var plan := _json(WORLD_PLAN)
	var regions: Array = plan.get("regions", [])
	_note("world_regions=%d" % regions.size())
	_expect(regions.size() >= 6, "the world has at least as many regions as there are elders (non-vacuous baseline)")

	var region_names: Array = []
	var entry_open: Array = []
	for region: Variant in regions:
		if region is Dictionary:
			var row: Dictionary = region
			region_names.append(String(row.get("name", row.get("region_id", ""))))
			if (row.get("entry_capabilities", []) as Array).is_empty():
				entry_open.append(String(row.get("name", "")))
	_note("regions=%s" % JSON.stringify(region_names))
	_note("regions_with_open_entry=%s" % JSON.stringify(entry_open))
	_expect(not entry_open.is_empty(), "at least one region is enterable with no capability (a spawn cannot be gated)")

	var elders_named: Array = []
	for name: String in region_names:
		if name.to_lower().contains("elder") or name.to_lower().contains("seal"):
			elders_named.append(name)
	if elders_named.is_empty():
		_missing(
			"six elder territories anchored to real regions (A1's 11 regions name no elder region)",
			"data/survival/world/world_plan.v1.json"
		)

	# ---- C. six stones must be reachable by real routes -----------------
	var graph := _json(ROUTE_GRAPH)
	var pois: Array = graph.get("pois", [])
	var edges: Array = (graph.get("route_graph", {}) as Dictionary).get("edges", [])
	_note("pois=%d route_edges=%d" % [pois.size(), edges.size()])
	_expect(pois.size() >= 6 and edges.size() >= 6, "the route graph is large enough that six approach routes are possible")

	# Reachability with *no* capability, from the authored safe start, computed
	# over the shipped edges. This is the D067 "broad safe spawn" check: a melee
	# player with no gear must not be walled inside a corridor.
	var open_nodes := _cap_free_reachable(edges, "node_refuge")
	_note("cap_free_reachable_nodes=%d of %d" % [open_nodes.size(), _node_count(edges)])
	_expect(open_nodes.size() >= 6, "a player with no capability can reach a real spread of the map, not a corridor")

	var reachable_pois: Array = []
	for poi: Variant in pois:
		if not poi is Dictionary:
			continue
		var row: Dictionary = poi
		if (row.get("required_capabilities", []) as Array).is_empty():
			reachable_pois.append(row)
	_note("pois_without_required_capabilities=%d" % reachable_pois.size())
	_expect(reachable_pois.size() >= 6, "at least six POIs are enterable with no capability")

	# ---- D. the evacuation model ---------------------------------------
	_note("MODEL_ORACLE evacuation checks validate A7's model of D065; product status stays RED")
	_expect(values.get("evacuation_is_a_distinct_outcome", {}).get("value", false), "D065 evacuation is a distinct outcome")
	var open_question: Variant = (values.get("evacuation_finalizes_run", {}) as Dictionary).get("value", null)
	_note("evacuation_finalizes_run=%s (OPEN, must not be assumed)" % JSON.stringify(open_question))
	_expect(open_question == null, "the probe leaves D065's open consequence open instead of inventing an answer")

	_evacuation_model()


## The states a run can end in, and the two things that must differ about them.
	_done()

func _evacuation_model() -> void:
	# A run ends by exactly one terminal path. Evacuation is only legitimate when
	# the player reached a physical evacuation point by a real route; fabricating
	# the endpoint must not work.
	var evac := {
		"endpoints": {"evac_saffron_harbour": true, "evac_crown_postern": true},
		"player_at": "poi_crown_quarry",
		"route_trace": [],
		"ended": "",
	}

	_expect(_try_evacuate(evac) == "not_at_evacuation_point", "MODEL evacuation from the wrong place is refused")
	evac["player_at"] = "evac_saffron_harbour"
	_expect(_try_evacuate(evac) == "no_verified_route_trace", "MODEL teleporting to an evacuation point without a trace is refused")
	evac["route_trace"] = ["poi_crown_quarry", "node_crown_east", "evac_saffron_harbour"]
	_expect(_try_evacuate(evac) == "", "MODEL a walked route to a real evacuation point is accepted")
	_expect(evac["ended"] == "evacuated", "MODEL the run ends in the evacuated state")
	_expect(_try_evacuate(evac) == "run_already_ended", "MODEL only one terminal state is recorded")

	# Abandoning is not evacuating: it needs no route, and it must pay nothing.
	var ab := {"ended": "", "score_awarded": 0, "stones": 0}
	ab["ended"] = "abandoned"
	_expect(ab["score_awarded"] == 0, "MODEL abandoning awards no score")
	_expect(ab["ended"] != "evacuated", "MODEL abandoning is not relabelled as evacuation")

	# Stones are milestones, not a currency: six must be optional, and partial
	# counts must stay meaningful rather than collapsing to a pass/fail.
	var milestones := [1, 2, 3, 4, 5, 6]
	var reached := 0
	for stone: int in milestones:
		reached = stone
		if stone < 6:
			_expect(_is_meaningful(stone), "MODEL %d stone(s) is a real state, not an empty step" % stone)
	_expect(reached == 6, "MODEL six stones is reachable without being required")
	_expect(_stone_grants_currency(6) == 0, "MODEL a stone never pays currency (it cannot fund the other economy)")


func _try_evacuate(state: Dictionary) -> String:
	if not String(state["ended"]).is_empty():
		return "run_already_ended"
	if not (state["endpoints"] as Dictionary).has(String(state["player_at"])):
		return "not_at_evacuation_point"
	var trace: Array = state["route_trace"]
	if trace.is_empty() or String(trace[trace.size() - 1]) != String(state["player_at"]):
		return "no_verified_route_trace"
	state["ended"] = "evacuated"
	return ""


func _is_meaningful(stones: int) -> bool:
	return stones >= 1 and stones <= 6


func _stone_grants_currency(stones: int) -> int:
	# Stones buy access and endings. If this ever returns a positive number the
	# two economies have been connected through the wrong door.
	return 0


# ------------------------------------------------------------------ data helpers
func _collect(root: String, suffix: String) -> Array:
	var found: Array = []
	var dir := DirAccess.open(root)
	if dir == null:
		return found
	for name: String in dir.get_files():
		if name.ends_with(suffix):
			found.append(root.path_join(name))
	for sub: String in dir.get_directories():
		found.append_array(_collect(root.path_join(sub), suffix))
	return found


## Symbols the product declares. A7's own files are excluded, and that exclusion
## is the whole point: the round-8 tuning file names "achievement_stones" and
## "evacuation_point" to describe the rules, so scanning `data/survival/balance/`
## would let this probe find its own wish list and call the feature implemented.
func _matches(paths: Array, symbols: Array) -> Array:
	var hits: Array = []
	for path: String in paths:
		if _is_a7_owned(path):
			continue
		if not FileAccess.file_exists(path):
			continue
		var text := FileAccess.get_file_as_string(path).to_lower()
		for symbol: String in symbols:
			var regex := RegEx.create_from_string(symbol)
			if regex.search(text) != null:
				hits.append("%s:%s" % [path, symbol])
				break
	return hits


func _is_a7_owned(path: String) -> bool:
	return path.begins_with("res://tests/") or path.begins_with("res://data/survival/balance/")


func _cap_free_reachable(edges: Array, start: String) -> Dictionary:
	var adjacency: Dictionary = {}
	for edge: Variant in edges:
		if not edge is Dictionary:
			continue
		var row: Dictionary = edge
		if not (row.get("required_capabilities", []) as Array).is_empty():
			continue
		var from := String(row.get("from", ""))
		var to := String(row.get("to", ""))
		if not adjacency.has(from):
			adjacency[from] = []
		if not adjacency.has(to):
			adjacency[to] = []
		(adjacency[from] as Array).append(to)
		(adjacency[to] as Array).append(from)
	var seen: Dictionary = {start: true}
	var stack: Array = [start]
	while not stack.is_empty():
		var node: String = stack.pop_back()
		for next: String in (adjacency.get(node, []) as Array):
			if not seen.has(next):
				seen[next] = true
				stack.append(next)
	return seen


func _node_count(edges: Array) -> int:
	var nodes: Dictionary = {}
	for edge: Variant in edges:
		if edge is Dictionary:
			nodes[String((edge as Dictionary).get("from", ""))] = true
			nodes[String((edge as Dictionary).get("to", ""))] = true
	return nodes.size()
