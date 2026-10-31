extends "res://tests/survival/balance_native_r14/r14_harness.gd"
## Round 14: this body is the round-11 probe carried forward with only the
## probe id and the harness path changed. It runs against the round-12
## composition, so a defect that survives here is a fact about this tree and
## not a recitation of round 11.
## WP2 — J04: the three ordinary POIs, from the product's side of the seam.
##
## A8 ships Quarry, Orchard and Mill as authored sites with their own physical
## routes, gates and actions. The question this gate asks is not "does A8 pass its
## own tests" — A8's suite runs in isolation, and CT has its own verdict on it. The
## question is whether a player standing in the shipped overworld can reach them and
## whether acting there has an A3 consequence.
##
## So the probe measures three things the integrated product can answer:
##
## 1. **mount** — does the shipped overworld instantiate any A8 site at all;
## 2. **authorization** — does A3 authorize a reward/cost for those site ids, or does
##    every one of them fail closed (`REJECTED_PENDING_EVIDENCE`);
## 3. **differentiation** — do the three sites actually differ in cost, risk and
##    yield in their own data, or are they three copies of one chore.
##
## A fixture reward is never counted as a real item, and "the data looks different"
## is never counted as "the player feels a choice".

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

const SITES := ["south_quarry", "south_orchard_ruin", "south_crown_mill"]
const SITE_DIR := "res://data/survival/world_content/sites/"

func _body() -> void:
	probe_id = "R14J04"
	probe_title = "J04 POI seam: mounted? authorized? genuinely different?"
	owner_action = (
		"A1/A8: mount the three sites in the shipped overworld and give them a physical stand a player can walk to. "
		+ "A3: authorize one bounded ordinary reward with its own cost/cooldown; the current state is fail-closed for "
		+ "all three, which is correct but leaves the player with nothing to do at a POI."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	_is_mounted(mounted)
	_is_authorized()
	_is_differentiated()
	_hazard_route()

	_done()


# ------------------------------------------------------------------ 1. mounting
func _is_mounted(mounted: Node) -> void:
	var site_nodes := 0
	for child: Node in mounted.get_children():
		var script_path := ""
		var script: Script = child.get_script() as Script
		if script != null:
			script_path = script.resource_path
		if script_path.contains("native_poi") or script_path.contains("poi_pilot"):
			site_nodes += 1
	_note("A8 site nodes mounted under the overworld: %d" % site_nodes)
	_expect(site_nodes == 0,
		"the shipped overworld mounts no A8 site today, so no player walks into one (%d found)" % site_nodes)
	if site_nodes == 0:
		_missing("an A8 POI mounted inside the shipped overworld",
			"chapter1_overworld.gd instantiates landmarks/camps/resources only; %s exist as standalone scenes" % str(SITES))
	# The A1 world does declare the POIs, so this is a mounting gap and not a
	# missing-place gap.
	var world_plan := _source("res://data/survival/world/poi_route_graph.json")
	_expect(not world_plan.is_empty(), "A1's route graph is present in the composition")
	var declared := 0
	for site: String in SITES:
		if world_plan.contains(site):
			declared += 1
	_note("sites declared in A1's route graph: %d/%d" % [declared, SITES.size()])
	_expect(declared >= 1, "the route graph knows at least one of the three sites (%d)" % declared)


# --------------------------------------------------------------- 2. authorization
func _is_authorized() -> void:
	var adapter := _adapter()
	if adapter == null:
		return
	var run := _active_run()
	var acceptable := 0
	var refused: Array[String] = []
	for site: String in SITES:
		# A3 accepts exactly `poi_id`, `action_id` and `instance_id` in a world
		# request; anything else is refused as an invalid field, which would hide the
		# real authorization answer behind a probe-shape error.
		var action_id := "ordinary_source"
		var request := {"poi_id": site, "action_id": action_id}
		var plan: Dictionary = adapter.call(&"world_action", request, "a7.r11.j04.%s" % site) as Dictionary
		var reason := String(plan.get("reason", ""))
		_note("world_action(%s) -> ok=%s reason=%s" % [site, str(plan.get("ok", false)), reason])
		if bool(plan.get("ok", false)):
			acceptable += 1
		else:
			refused.append("%s:%s" % [site, reason])
	if acceptable == 0:
		_missing("an A3-authorized ordinary reward for any of the three POIs",
			"world_action refused every site (%s); A3 is fail-closed by design until an owner supplies evidence"
			% str(refused))
	_expect(acceptable == 0, "no POI action pays out while A3 has not authorized it (%d paid)" % acceptable)


# -------------------------------------------------------------- 3. differentiation
## Cost, risk and yield are read from A8's own site data. This is a *reading of the
## authoring*, not a measurement of a player's experience; the probe says so.
func _is_differentiated() -> void:
	var signatures: Dictionary = {}
	for site: String in SITES:
		var path := SITE_DIR + site + ".json"
		var text := _source(path)
		if text.is_empty():
			_missing("the authored site %s" % site, path)
			continue
		var parsed: Variant = JSON.parse_string(text)
		var actions: Array = []
		var risk := ""
		if parsed is Dictionary:
			actions = (parsed as Dictionary).get("choices", (parsed as Dictionary).get("actions", []))
			risk = String((parsed as Dictionary).get("risk_tier", (parsed as Dictionary).get("risk", "")))
		var action_ids: Array[String] = []
		var cost_fields := 0
		for entry: Variant in actions:
			if entry is Dictionary:
				action_ids.append(String((entry as Dictionary).get("action_id", "")))
				if (entry as Dictionary).has("cost") or (entry as Dictionary).has("inputs"):
					cost_fields += 1
		var signature := "%d actions, %d with a cost, risk=%s" % [action_ids.size(), cost_fields, risk]
		signatures[site] = signature
		_note("%s -> %s (%s)" % [site, signature, str(action_ids)])
		_expect(action_ids.size() >= 1, "%s authors at least one player action (%d)" % [site, action_ids.size()])
	var unique := {}
	for site: Variant in signatures.keys():
		unique[String(signatures[site])] = true
	_expect(unique.size() == signatures.size(),
		"the three sites differ in their authored cost/risk/action shape (%d distinct of %d)"
		% [unique.size(), signatures.size()])


# ------------------------------------------------------------------ 4. the route
## A "route" that no player can walk is not a route. The authored hazards are the
## only travel risk the survival world has, so the probe checks that they exist as
## geometry over the walkable map rather than as prose.
func _hazard_route() -> void:
	var hazards := _source("res://data/overworld/hollow_marches.json")
	_expect(not hazards.is_empty(), "the overworld ships its authored hazard geometry")
	if hazards.is_empty():
		return
	var parsed: Variant = JSON.parse_string(hazards)
	var count := 0
	var named: Array[String] = []
	if parsed is Dictionary:
		for key: Variant in (parsed as Dictionary).keys():
			if String(key).to_lower().contains("hazard"):
				var rows: Variant = (parsed as Dictionary)[key]
				if rows is Array:
					count += (rows as Array).size()
					for row: Variant in rows:
						if row is Dictionary:
							named.append(String((row as Dictionary).get("id", (row as Dictionary).get("region_id", ""))))
	_note("authored hazards: %d (%s)" % [count, str(named)])
	_expect(count >= 1, "at least one hazard region is authored on the map (%d)" % count)
	# ... and that the risk is real: a hazard must cost the player something.
	var drain := _source_calls("res://game/overworld", "provision", "###none###")
	_note("provision-drain call sites in game/overworld: %d" % drain)
	_expect(drain >= 1, "hazards are wired to a real player cost (provisions), not just painted")


func _finish() -> void:
	_release_all()
	super._finish()
