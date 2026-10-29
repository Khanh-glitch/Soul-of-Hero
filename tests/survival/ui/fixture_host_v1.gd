extends RefCounted
## FAKE TEST/DEMO ONLY. Not SOH economy, saving, or production behavior.
const DATA := preload("res://tests/survival/ui/planner_fixture.gd")
var state: Dictionary
var receipts: Dictionary = {}
var signatures: Dictionary = {}

func _init(research_ready := false) -> void:
	state = DATA.snapshot()
	state["schema"] = "soh.ui.snapshot.v1"
	state["sequence"] = 1
	state["revision"] = "fixture-rev-1"
	state["bag"] = [{"id":"oak_wood", "name":"Oak Wood [fixture]", "count":8, "kind":"material"}]
	state.recipes[0]["sample_item_id"] = "core_specimen"
	if research_ready:
		state.recipes[0]["can_research"] = true
		state.recipes[0]["blocked_reason"] = ""
		state.recipes[0]["research_warning"] = "Research consumes one Core specimen in this fixture. Continue?"
		state.bag.append({"id":"core_specimen", "name":"Core specimen [fixture]", "count":1})
	state.cores[0]["formula_id"] = "core_formula"
	state["capacity_status"] = "Satchel 1/8 · Chest 1/2 [fixture]"
	state["placement"] = {"name":"Wooden Door [fixture]", "status":"Move closer [fixture]", "costs":[{"name":"Oak Wood", "have":8, "required":4, "missing":0, "sources":["Known oak tree"]}]}
	state["field_entries"] = [{"revealed":true, "title":"Frost [fixture]", "text":"Prepare protection before travel."}, {"revealed":false, "title":"Secret", "text":"Never displayed."}]
	state["respawns"] = [{"id":"home", "name":"Home bed [fixture]", "available":true}, {"id":"ruined", "name":"Ruined bed [fixture]", "available":false, "reason":"No valid bed."}]

func snapshot() -> Dictionary:
	state["capacity_status"] = "Satchel %d/8 · Chest %d/2 [fixture]" % [state.bag.size(), state.chest.size()]
	var amount := int(_find("bag", "oak_wood").get("count", 0))
	state.placement.costs[0]["have"] = amount
	state.placement.costs[0]["missing"] = maxi(0, 4 - amount)
	state["satchel"] = state.bag.duplicate(true)
	for row: Dictionary in state.satchel:
		row["stack_key"] = "%s#fixture" % row.id
	return state.duplicate(true)

func dispatch(action: String, id: String, payload: Dictionary) -> Dictionary:
	var key := String(payload.get("request_id", ""))
	var signature := {"action":action, "id":id, "payload":payload.duplicate(true)}
	if receipts.has(key):
		if signatures[key] != signature: return _response(key, false, "Fixture rejected conflicting request ID.")
		var replay: Dictionary = receipts[key].duplicate(true)
		replay["snapshot"] = snapshot()
		return replay
	var accepted := false
	var message := "Fixture rejected request."
	if key.is_empty() or payload.get("schema", "") != "soh.ui.intent.v1":
		return _response(key, false, "Fixture rejected malformed request.")
	if int(payload.get("sequence", -1)) != int(state.sequence) or payload.get("revision", "") != state.revision:
		var stale := _response(key, false, "Fixture rejected stale state; refresh.")
		receipts[key] = stale.duplicate(true)
		signatures[key] = signature
		return stale
	match action:
		"transfer":
			var source := "bag" if payload.get("direction", "") == "deposit" else "chest"
			var dest := "chest" if source == "bag" else "bag"
			var amount := int(payload.get("amount", 0))
			var from := _find(source, id)
			var to := _find(dest, id)
			if String(payload.get("direction", "")) in ["deposit", "withdraw"] and String(payload.get("container_id", "")) == String(state.container_id) and amount > 0 and int(from.get("count", 0)) >= amount:
				# A tiny fixture capacity to exercise rejection without touching SaveService.
				var capacity := 2 if dest == "chest" else 8
				if not to.is_empty() or (state[dest] as Array).size() < capacity:
					from["count"] = int(from.count) - amount
					if from.count == 0: (state[source] as Array).erase(from)
					if to.is_empty():
						to = {"id": id, "name": from.get("name", id), "count": 0}
						(state[dest] as Array).append(to)
					to["count"] = int(to.count) + amount
					accepted = true
					message = "Fixture transfer accepted."
				else: message = "Fixture destination is full."
		"craft", "research":
			var rec := _find("recipes", id)
			if bool(rec.get("revealed", false)) and bool(rec.get("can_" + action, false)):
				if action == "research":
					var sample := _find("bag", String(rec.get("sample_item_id", "")))
					if int(sample.get("count", 0)) > 0:
						sample["count"] = int(sample.count) - 1
						if sample.count == 0: (state.bag as Array).erase(sample)
						rec["learned"] = true
						rec["can_research"] = false
						for core: Dictionary in state.cores:
							if core.get("formula_id", "") == id: core["learned"] = true
						accepted = true
					else: message = "Fixture specimen missing."
				else:
					rec["queue_status"] = "Queued [fixture]"
					accepted = true
				if accepted: message = "Fixture %s accepted." % action
		"equip_core":
			var core := _find("cores", id)
			if bool(core.get("can_equip", false)) and int(core.get("charges", 0)) > 0:
				core["equipped"] = true
				accepted = true
				message = "Fixture Core equipped."
		"select_respawn":
			var bed := _find("respawns", id)
			if bool(bed.get("available", false)):
				state.recovery["anchor"] = String(bed.get("name", "Unknown"))
				accepted = true
				message = "Fixture respawn selected."
	if accepted:
		state["sequence"] = int(state.sequence) + 1
		state["revision"] = "fixture-rev-%d" % state.sequence
	var result := _response(key, accepted, message)
	receipts[key] = result.duplicate(true)
	signatures[key] = signature
	return result

func _find(key: String, id: String) -> Dictionary:
	for row: Variant in state.get(key, []):
		if row is Dictionary and String(row.get("id", "")) == id: return row
	return {}

func _response(key: String, accepted: bool, message: String) -> Dictionary:
	return {"schema":"soh.ui.response.v1", "request_id":key, "status":"accepted" if accepted else "rejected", "message":message, "snapshot":snapshot()}
