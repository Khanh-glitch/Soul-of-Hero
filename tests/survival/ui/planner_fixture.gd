extends RefCounted
## Explicit illustrative data, not a definition of A0/A1/A3 APIs.
static func snapshot() -> Dictionary:
	return {
		"revision": "fixture-1", "container_id": "fixture-chest", "transfer_enabled": true,
		"recipes": [
			{"id":"core_formula", "name":"Ember Core [fixture]", "revealed":true, "found":true, "learned":false, "station":"Research table", "can_research":false, "blocked_reason":"Requires a specimen and research material.", "ingredients":[{"name":"Iron Scrap", "have":0, "need":2, "source":"Abandoned Supplies"}]},
			{"id":"bandage", "name":"Field Bandage [fixture]", "revealed":true, "found":true, "learned":true, "station":"Worktable", "can_craft":true, "ingredients":[{"name":"Reed Fibre", "have":4, "need":2}]},
			{"id":"secret", "name":"SECRET FORMULA", "revealed":false, "found":true, "learned":true, "can_craft":true},
		],
		"bag": [{"id":"oak_wood#1", "name":"Oak Wood", "count":8}],
		"chest": [{"id":"iron_scrap", "name":"Iron Scrap", "count":2}],
		"places": [
			{"id":"road", "name":"Old Road [fixture]", "revealed":true, "position":Vector2(0.25,0.55), "route":"Return along the river", "hazard":"Watch for patrols", "activity":"Salvage and supplies"},
			{"id":"secret_place", "name":"SECRET PLACE", "revealed":false, "position":Vector2(0.8,0.2)},
		],
		"cores": [
			{"id":"core-instance-1", "name":"Ember Core [fixture]", "charges":3, "max_charges":8, "condition":"Worn", "equipped":false, "blueprint_found":true, "learned":false, "can_equip":true},
			{"id":"core-instance-2", "name":"Spent Core [fixture]", "charges":0, "max_charges":8, "condition":"Damaged", "equipped":false, "blueprint_found":false, "learned":false, "can_equip":true},
		],
		"hazards": [{"name":"Frost [fixture]", "revealed":true, "protection":"Low", "preparation":"Warm clothing or a shorter route"}, {"name":"SECRET HAZARD", "revealed":false}],
		"recovery": {"anchor":"Home bed [fixture]", "bed_status":"Active", "bag_status":"Dropped near Old Road", "preserved":"Learned formulas", "dropped":"Carried materials"},
	}
