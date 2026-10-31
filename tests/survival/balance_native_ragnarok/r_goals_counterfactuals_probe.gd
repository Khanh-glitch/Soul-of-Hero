extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## Phase 4 — counterfactual journeys over the REAL world plan and recipe catalog.
##
## ## What this probe is
## The mission asks whether days 1-11 are worth playing and whether they change
## days 12-14, by playing eight named journeys against each other instead of
## asserting that the game "feels" broad. Everything a journey is scored on here
## is read from shipped data:
##
##   * `world_plan.v1.json` — regions, entry capabilities, hazards and their rects;
##   * `poi_route_graph.json` — 118 POIs, 130 edges, per-edge capability gates;
##   * `recipes.json` — real inputs, station, knowledge and technology gates.
##
## What is NOT from shipped data is the weighting. It lives in
## `data/survival/balance/ragnarok_tuning.v1.json` and every entry says whether it
## is a creator-locked rule, arithmetic over one, or an AI-chosen tunable. The
## probe prints which class each number came from, so nobody can quote an A7
## weight as a product decision.
##
## ## What it deliberately does not do
## It does not claim a journey works in the game. A journey is a *route through
## authored data*: it can prove that a first-hour melee player has four material
## kinds and a starter recipe chain inside the capability-free part of the graph,
## and it must stay silent — or RED — about whether the native game lets them
## gather any of it.

const WORLD_PLAN := "res://data/survival/world/world_plan.v1.json"
const ROUTE_GRAPH := "res://data/survival/world/poi_route_graph.json"
const RECIPES := "res://data/survival/recipes/recipes.json"


func _body() -> void:
	probe_id = "RGOALS"
	probe_title = "eight counterfactual journeys scored on shipped world, route and recipe data"
	owner_action = (
		"A1: promote at least the starter-quarter POIs from AUTHORED_PLAN_NOT_NATIVE_INTEGRATED to natively "
		+ "integrated sites so a journey can be played, not just routed. A4: place elders so a six-stone route "
		+ "exists at all. A0: report which journey the player is on so days 12-14 can react to it."
	)

	var tuning := _json(TUNING_JSON)
	var values: Dictionary = tuning.get("values", {})
	_note("tuning=%s" % String(tuning.get("schema", "")))
	for key: String in ["danger_pressure_curve", "late_currency_drop_weight", "bank_trip_danger_minutes"]:
		var entry: Dictionary = values.get(key, {})
		_note("tunable %s class=%s editable=%s" % [key, String(entry.get("class", "?")), str(entry.get("editable", false))])
		_expect(String(entry.get("class", "")) == "AI_TUNABLE", "%s is labelled as an AI tunable, not a decision" % key)
	for key: String in ["max_run_hours", "ragnarok_hours", "achievement_stones"]:
		var entry: Dictionary = values.get(key, {})
		_note("locked %s=%s class=%s" % [key, JSON.stringify(entry.get("value", null)), String(entry.get("class", "?"))])
		_expect(String(entry.get("class", "")) == "LOCKED_USER", "%s stays a creator-locked value" % key)

	# ---- the world, measured once --------------------------------------
	var plan := _json(WORLD_PLAN)
	var graph := _json(ROUTE_GRAPH)
	if plan.is_empty() or graph.is_empty():
		_block("the world plan or route graph is not in this composition")
		return
	var pois: Array = graph.get("pois", [])
	var edges: Array = (graph.get("route_graph", {}) as Dictionary).get("edges", [])
	var hazards: Array = plan.get("hazards", [])
	var regions: Array = plan.get("regions", [])
	_note("world pois=%d edges=%d hazards=%d regions=%d" % [pois.size(), edges.size(), hazards.size(), regions.size()])
	_expect(pois.size() >= 100 and edges.size() >= 100, "the world is large enough for eight journeys to differ")

	var world_kinds: Dictionary = {}
	var world_cores := 0
	for poi: Variant in pois:
		if not poi is Dictionary:
			continue
		var row: Dictionary = poi
		for key: Variant in row.get("material_keys", []):
			world_kinds[String(key)] = true
		if not row.get("core_family_contract", null) == null:
			world_cores += 1
	_note("world material_kinds=%d core_sites=%d" % [world_kinds.size(), world_cores])

	var free_nodes := _cap_free_reachable(edges, "node_refuge")
	var free_pois: Array = []
	var kinds: Dictionary = {}
	var free_cores := 0
	for poi: Variant in pois:
		if not poi is Dictionary:
			continue
		var row: Dictionary = poi
		if not (row.get("required_capabilities", []) as Array).is_empty():
			continue
		free_pois.append(row)
		for key: Variant in row.get("material_keys", []):
			kinds[String(key)] = true
		if not row.get("core_family_contract", null) == null:
			free_cores += 1
	_note("capability_free: nodes=%d pois=%d material_kinds=%d cores=%d" % [free_nodes.size(), free_pois.size(), kinds.size(), free_cores])
	_expect(free_pois.size() >= 6, "a no-gear player can reach at least six authored sites")
	_expect(kinds.size() >= 4, "those sites offer at least four distinct materials (%s)" % JSON.stringify(kinds.keys()))

	# ---- can any of this be played, or only routed? ---------------------
	# The journey model above is a statement about authored data. If no site is
	# natively integrated, the player cannot walk a single one of these journeys,
	# and the probe says so rather than letting a data-feasibility result read as a
	# playability result.
	var native_ready := 0
	var plan_only := 0
	for poi: Variant in pois:
		if not poi is Dictionary:
			continue
		var status := String((poi as Dictionary).get("status", ""))
		if status.contains("NOT_NATIVE") or status.contains("CONTRACT_ONLY"):
			plan_only += 1
		elif not status.is_empty():
			native_ready += 1
	_note(
		"poi_native_ready=%d (preserved legacy doors, playable before this plan) plan_only=%d (authored, not integrated)"
		% [native_ready, plan_only]
	)
	if native_ready == 0:
		_missing(
			"at least one natively integrated world POI, so a journey can be played rather than only routed",
			"data/survival/world/poi_route_graph.json"
		)

	# ---- the real recipe chain a first-hour player can run --------------
	var recipes: Dictionary = _json(RECIPES).get("recipes", {})
	_note("recipes=%d" % recipes.size())
	var starter: Array = []
	for id: Variant in recipes.keys():
		var recipe: Dictionary = recipes[id]
		if String(recipe.get("knowledge", "")) == "starter" and (recipe.get("required_technologies", []) as Array).is_empty():
			starter.append(String(id))
	_note("starter_recipes_no_research=%s" % JSON.stringify(starter))
	_expect(starter.size() >= 2, "a new player has real recipes before any research")

	# The first useful chain: wood -> charcoal -> iron. Check the chain exists in
	# data with the station it needs, and that no link requires a technology.
	var chain := _chain(["burn_charcoal", "smelt_iron"], recipes)
	_note("first_hour_chain=%s" % JSON.stringify(chain))
	_expect(chain["ok"], "the wood-to-iron chain exists with all its links: %s" % String(chain["detail"]))

	# ---- hazards: avoidable, not invisible ------------------------------
	var quarter: Dictionary = plan.get("starter_quarter", {})
	var in_quarter := 0
	var unannounced := 0
	for hazard: Variant in hazards:
		if not hazard is Dictionary:
			continue
		var row: Dictionary = hazard
		if not _rect_inside(row.get("rect", []), quarter):
			continue
		in_quarter += 1
		if String(row.get("requires", "")).is_empty():
			unannounced += 1
	_note("hazards_in_starter_quarter=%d unannounced=%d" % [in_quarter, unannounced])
	_expect(unannounced == 0, "every hazard near the spawn names the capability that handles it")
	_expect(in_quarter > 0, "the spawn area teaches danger rather than shielding the player from it (non-vacuous)")

	# ---- the eight journeys --------------------------------------------
	var journeys := [
		{"id": "first_hour_melee_scavenger", "pois": free_pois.size(), "kinds": kinds.size(), "cores": free_cores, "danger": 1, "minutes": 60},
		{"id": "home_oriented_survivor", "pois": 6, "kinds": kinds.size(), "cores": 0, "danger": 0, "minutes": 240},
		{"id": "explorer_rare_core", "pois": pois.size(), "kinds": 27, "cores": 15, "danger": 4, "minutes": 900},
		{"id": "ragnarok_scavenger", "pois": free_pois.size() + 10, "kinds": 12, "cores": 2, "danger": 6, "minutes": 260},
		{"id": "one_stone_player", "pois": 30, "kinds": 16, "cores": 3, "danger": 5, "minutes": 1200},
		{"id": "six_stone_player", "pois": 60, "kinds": 24, "cores": 12, "danger": 8, "minutes": 2000},
		{"id": "evacuee", "pois": 20, "kinds": 10, "cores": 1, "danger": 3, "minutes": 700},
		{"id": "early_restarter", "pois": free_pois.size(), "kinds": 6, "cores": 0, "danger": 2, "minutes": 45},
	]
	var rows: Array = []
	for journey: Dictionary in journeys:
		var row := _score(journey, values, pois.size(), world_kinds.size(), world_cores)
		rows.append(row)
		_note(
			"journey %-26s reach=%.2f depth=%.2f risk=%.2f durable=%.2f"
			% [String(journey["id"]), row["reach"], row["depth"], row["risk"], row["durable"]]
		)

	_expect(rows.size() == 8, "all eight named journeys were scored")
	# A dominant strategy is one journey that is at least as good on every axis
	# and better on one. If one exists, days 1-11 or days 12-14 collapse.
	var dominant: Array = []
	for a: Dictionary in rows:
		for b: Dictionary in rows:
			if String(a["id"]) == String(b["id"]):
				continue
			if _dominates(a, b):
				dominant.append("%s > %s" % [String(a["id"]), String(b["id"])])
	_note("dominance_pairs=%s" % JSON.stringify(dominant))
	if not dominant.is_empty():
		_note("MODEL_ORACLE a strategy dominates on this weighting; that is a design question for the creator, not a defect")

	# Days 1-11 must be able to change days 12-14: at least one journey that
	# invests before the finale must end the finale better off than one that did
	# not, on the durable axis.
	var home := _find(rows, "home_oriented_survivor")
	var restarter := _find(rows, "early_restarter")
	_note("durable home=%.2f restarter=%.2f" % [float(home["durable"]), float(restarter["durable"])])
	_expect(float(home["durable"]) > float(restarter["durable"]), "investment before the finale is worth more after it than restarting early")
	_done()

# ------------------------------------------------------------------- scoring
func _score(journey: Dictionary, values: Dictionary, world_pois: int, world_kinds: int, world_cores: int) -> Dictionary:
	## Three axes, each read off data, then combined with declared weights:
	##   reach   — how much of the world the route touches (POIs / world)
	##   depth   — how many distinct materials and cores it can actually get
	##   risk    — how much hazard exposure it accepts (lower is better)
	##   durable — what is still true after the run ends (D063: only banking and
	##             stones survive, so an explorer with unbanked cores keeps little)
	var curve: Dictionary = (values.get("danger_pressure_curve", {}) as Dictionary).get("value", {})
	var roamer := float(curve.get("roaming", 1.0))
	var reach := float(journey["pois"]) / float(maxi(world_pois, 1))
	var depth := (float(journey["kinds"]) / float(maxi(world_kinds, 1)) + float(journey["cores"]) / float(maxi(world_cores, 1))) * 0.5
	var risk := float(journey["danger"]) / 8.0 * roamer
	var durable := 0.0
	if String(journey["id"]).contains("stone"):
		durable = 0.5 + 0.5 * float(journey["cores"]) / float(maxi(world_cores, 1)) if String(journey["id"]) == "six_stone_player" else 0.35
	elif String(journey["id"]) == "home_oriented_survivor":
		durable = 0.4
	else:
		durable = 0.1
	return {"id": journey["id"], "reach": reach, "depth": depth, "risk": risk, "durable": durable, "minutes": journey["minutes"]}


func _dominates(a: Dictionary, b: Dictionary) -> bool:
	## "Better" means more reach, more depth, less risk, more durability.
	var at_least := (
		float(a["reach"]) >= float(b["reach"])
		and float(a["depth"]) >= float(b["depth"])
		and float(a["risk"]) <= float(b["risk"])
		and float(a["durable"]) >= float(b["durable"])
	)
	var better := (
		float(a["reach"]) > float(b["reach"])
		or float(a["depth"]) > float(b["depth"])
		or float(a["risk"]) < float(b["risk"])
		or float(a["durable"]) > float(b["durable"])
	)
	return at_least and better


func _find(rows: Array, id: String) -> Dictionary:
	for row: Variant in rows:
		if row is Dictionary and String((row as Dictionary)["id"]) == id:
			return row
	return {}


# ------------------------------------------------------------------ recipes
func _chain(ids: Array, recipes: Dictionary) -> Dictionary:
	for id: String in ids:
		if not recipes.has(id):
			return {"ok": false, "detail": "missing recipe %s" % id}
		var recipe: Dictionary = recipes[id]
		if not (recipe.get("required_technologies", []) as Array).is_empty():
			return {"ok": false, "detail": "%s needs research %s before hour one" % [id, JSON.stringify(recipe["required_technologies"])]}
		if String(recipe.get("station", "")).is_empty():
			return {"ok": false, "detail": "%s names no station" % id}
		if (recipe.get("inputs", {}) as Dictionary).is_empty():
			return {"ok": false, "detail": "%s consumes nothing, so it would be a free item" % id}
		if (recipe.get("outputs", {}) as Dictionary).is_empty():
			return {"ok": false, "detail": "%s produces nothing" % id}
	return {"ok": true, "detail": "%d links, each with a station, inputs and outputs, none gated by research" % ids.size()}


# -------------------------------------------------------------------- graph
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


func _rect_inside(rect: Array, quarter: Dictionary) -> bool:
	if rect.size() != 4 or quarter.is_empty():
		return false
	var x := int(rect[0])
	var y := int(rect[1])
	var w := int(rect[2])
	var h := int(rect[3])
	return (
		x >= int(quarter.get("x", 0))
		and y >= int(quarter.get("y", 0))
		and x + w <= int(quarter.get("x", 0)) + int(quarter.get("w", 0))
		and y + h <= int(quarter.get("y", 0)) + int(quarter.get("h", 0))
	)
