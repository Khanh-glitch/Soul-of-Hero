extends SceneTree
## Static contract: authored JSON declares the required anchors — refuge, 10
## landmarks with campaign_level_ids, ≥3 camps/discoveries/shortcuts, and a
## survival block with sane rates. This is a DATA CHECK only.

const WORLD_DATA_PATH := "res://data/overworld/hollow_marches.json"
const REGISTRY_PATH := "res://data/overworld/landmark_registry.json"

var failures: Array[String] = []
var checks := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var f := FileAccess.open(WORLD_DATA_PATH, FileAccess.READ)
	_expect(f != null, "hollow_marches.json accessible")
	var wd: Dictionary = {}
	if f != null:
		var text := f.get_as_text(); f.close()
		var parsed = JSON.parse_string(text)
		_expect(parsed is Dictionary, "hollow_marches.json parses as Dictionary")
		if parsed is Dictionary:
			wd = parsed
	var rf := FileAccess.open(REGISTRY_PATH, FileAccess.READ)
	var reg: Dictionary = {}
	if rf != null:
		var rt := rf.get_as_text(); rf.close()
		var rp = JSON.parse_string(rt)
		if rp is Dictionary:
			reg = rp

	_expect(int(wd.get("tile_size", 0)) == 16, "tile_size == 16")
	var wb: Dictionary = wd.get("world_bounds", {}) as Dictionary
	_expect(int(wb.get("w", 0)) >= 200 and int(wb.get("h", 0)) >= 200, "world bounds ≥ 200x200")

	var camps: Array = wd.get("camps", []) as Array
	var discoveries: Array = wd.get("discoveries", []) as Array
	var shortcuts: Array = wd.get("shortcuts", []) as Array
	var landmarks: Array = wd.get("landmarks", []) as Array
	_expect(camps.size() >= 3, "≥3 camps authored (got %d)" % camps.size())
	_expect(discoveries.size() >= 3, "≥3 discoveries (got %d)" % discoveries.size())
	_expect(shortcuts.size() >= 3, "≥3 shortcuts (got %d)" % shortcuts.size())
	_expect(landmarks.size() == 10, "exactly 10 landmarks (got %d)" % landmarks.size())

	var refuge: Dictionary = wd.get("refuge", {}) as Dictionary
	_expect(not refuge.is_empty() and refuge.has("pos"), "refuge with pos authored")

	for lm in landmarks:
		if not (lm is Dictionary):
			failures.append("non-dict landmark entry"); continue
		var d: Dictionary = lm as Dictionary
		_expect(String(d.get("campaign_level_id", "")).begins_with("chapter_1_level_"),
			"landmark %s declares campaign_level_id" % d.get("id", "?"))

	# Survival block invariants.
	var surv: Dictionary = wd.get("survival", {}) as Dictionary
	if not surv.is_empty():
		_expect(String(surv.get("resource_id", "")) == "provisions", "survival.resource_id == 'provisions'")
		var max_p := int(surv.get("max", 0))
		var start_p := int(surv.get("start", 0))
		_expect(max_p > 0 and start_p > 0 and start_p <= max_p, "start/max sane")
		var wild := float(surv.get("drain_per_second_wild", -1.0))
		var hazard := float(surv.get("drain_per_second_hazard", -1.0))
		var safe := float(surv.get("drain_per_second_safe", -1.0))
		_expect(wild >= 0.0 and hazard >= wild and safe <= wild, "rates ordered safe≤wild≤hazard")
		if wild > 0.0:
			_expect(float(max_p) / wild >= 120.0, "wild drain lasts ≥ 2 min")
		_expect(is_equal_approx(safe, 0.0), "safe drain is 0")

	# Registry bijectivity.
	var by_world: Dictionary = reg.get("camp_levels_by_world_id", {}) as Dictionary
	_expect(by_world.size() == 10, "registry camp_levels_by_world_id has 10 entries")
	var by_campaign: Dictionary = {}
	for wid in by_world.keys():
		by_campaign[String(by_world[wid])] = String(wid)
	_expect(by_campaign.size() == 10, "derived campaign→world map bijective")

	if failures.size() > 0:
		push_error("OVERWORLD_STATIC_CONTRACTS FAIL")
		quit(1)
		return
	print("OVERWORLD_STATIC_CONTRACTS PASSED - %d checks" % checks)
	quit(0)


func _expect(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures.append(msg)
		push_error("OW_STATIC_FAIL: " + msg)
