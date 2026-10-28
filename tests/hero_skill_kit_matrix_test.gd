extends SceneTree

## H2.0: 4-Hero × 8-rarity read-only contract matrix.
## Separates weapon skill ranks 1–5 (split budget) from the distinct
## six progression skill tracks capped at rank 20. No gameplay core edits.
const KITS := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const IDS := [
	&"sword_hero", &"archer_hero", &"axe_hero", &"wizard_hero",
]
const TOTAL_RANKS := [2, 4, 6, 2, 6, 2, 4, 6]
const EXPECTED_BANDS := [
	"basic", "basic", "basic", "advanced", "advanced",
	"legendary_plus", "legendary_plus", "legendary_plus",
]

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(PROGRESSION.SKILL_TRACK_IDS.size() == 6,
		"Hero progression has exactly six separate skill tracks")
	_expect(PROGRESSION.SKILL_RANK_CAP == 20,
		"Progression track cap is 20, not the weapon kit rank-5 cap")
	for hero_id: StringName in IDS:
		var base: Dictionary = KITS.base_stats(hero_id)
		_expect(base.has("max_hp") and float(base["max_hp"]) > 0.0
			and base.has("max_mana") and float(base["max_mana"]) > 0.0
			and base.has("power") and float(base["power"]) > 0.0,
			"%s has defined baseline combat resources" % hero_id)
		for rarity: int in 8:
			_check_hero_rarity(hero_id, rarity)
	_check_boundaries()
	_check_invalid_profiles()
	_finish()


func _check_hero_rarity(hero_id: StringName, rarity: int) -> void:
	var label := "%s rarity-%d" % [hero_id, rarity]
	var expected_band: String = EXPECTED_BANDS[rarity]
	_expect(KITS.total_ranks_for_rarity(rarity) == TOTAL_RANKS[rarity],
		"%s respects authored rank-budget table" % label)
	_expect(String(KITS.kit_id_for_rarity(rarity)) == expected_band,
		"%s selects correct kit band" % label)
	for seed: int in [0, 1, 42, 9001]:
		var stable := "%s:%d" % [hero_id, rarity]
		var ranks: Dictionary = KITS.roll_skill_ranks(rarity, seed, stable)
		_expect(KITS.validate_skill_ranks(rarity, ranks),
			"%s seed-%d produces valid 2-skill rank split" % [label, seed])
		_expect(ranks == KITS.roll_skill_ranks(rarity, seed, stable),
			"%s seed-%d is deterministic" % [label, seed])
		_expect(int(ranks.get("active_1", 0)) + int(ranks.get("active_2", 0))
			== TOTAL_RANKS[rarity],
			"%s seed-%d preserves total ranks" % [label, seed])
	var soul: Dictionary = SOULS.create_instance(
		hero_id, rarity, 5, &"h2_skill_matrix", 20261022
	)
	_expect(not soul.is_empty() and String(soul.get("hero_id", "")) == String(hero_id),
		"%s generates an exact-instance Hero Weapon" % label)
	if soul.is_empty():
		return
	var ranks_value: Variant = soul.get("skill_ranks", {})
	_expect(ranks_value is Dictionary
		and KITS.validate_skill_ranks(rarity, ranks_value as Dictionary),
		"%s persisted Soul ranks validate" % label)
	_expect(String(soul.get("skill_kit_id", "")) == expected_band,
		"%s persisted Soul kit ID matches canonical rarity" % label)
	var kit: Dictionary = KITS.kit_snapshot(hero_id, rarity, ranks_value)
	_expect(String(kit.get("hero_id", "")) == String(hero_id)
		and String(kit.get("kit_id", "")) == expected_band,
		"%s snapshot retains Hero and correct kit ID" % label)
	for action: String in ["active_1", "active_2"]:
		var profile_value: Variant = kit.get(action, {})
		var profile: Dictionary = profile_value if profile_value is Dictionary else {}
		_expect(not String(profile.get("id", "")).is_empty(),
			"%s %s has a canonical action ID" % [label, action])
		_expect(not String(profile.get("name", "")).is_empty(),
			"%s %s has a player-facing name" % [label, action])
		var rank := int((ranks_value as Dictionary).get(action, 0))
		var adjusted: Dictionary = KITS.rank_adjusted_profile(profile, rank)
		_expect(not adjusted.is_empty(),
			"%s %s rank-%d resolves readable profile" % [label, action, rank])
	if rarity >= 5:
		for action: String in ["passive", "soul", "departure"]:
			var details: Dictionary = kit.get(action, {})
			_expect(not String(details.get("id", "")).is_empty(),
				"%s legendary+ has %s action" % [label, action])
	if hero_id == &"sword_hero":
		var first: Dictionary = kit.get("active_1", {})
		_expect(String(first.get("id", "")).begins_with("k_night_"),
			"%s preserves K-Night override, not retired Sword kit" % label)
	var mutated := kit.duplicate(true)
	if mutated.get("active_1", {}) is Dictionary:
		mutated["active_1"]["id"] = "do_not_leak"
	var fresh: Dictionary = KITS.kit_snapshot(hero_id, rarity, ranks_value)
	_expect(String((fresh.get("active_1", {}) as Dictionary).get("id", ""))
		!= "do_not_leak",
		"%s snapshot mutation cannot pollute future kit reads" % label)


func _check_boundaries() -> void:
	_expect(KITS.effective_skill_multiplier(3, 1)
		> KITS.effective_skill_multiplier(2, 5),
		"Advanced minimum rank is stronger than Basic maximum")
	_expect(KITS.effective_skill_multiplier(5, 1)
		> KITS.effective_skill_multiplier(4, 5),
		"Legendary+ minimum rank is stronger than Advanced maximum")
	_expect(not KITS.validate_skill_ranks(2, {"active_1": 0, "active_2": 6}),
		"Rank-zero / rank-six cannot enter a weapon")
	_expect(not KITS.validate_skill_ranks(2, {"active_1": 2, "active_2": 2}),
		"Rare weapon rejects wrong total rank budget")
	_expect(KITS.total_ranks_for_rarity(-1) == 0
		and KITS.total_ranks_for_rarity(8) == 0,
		"Invalid rarity has no rank budget")


func _check_invalid_profiles() -> void:
	_expect(KITS.kit_snapshot(&"unknown_hero", 0).is_empty(),
		"Unknown Hero has no inferred skill kit")
	_expect(SOULS.create_instance(&"sword_hero", -1, 5, &"h2", 1).is_empty(),
		"Invalid weapon rarity cannot create a Soul")
	_expect(SOULS.create_instance(&"sword_hero", 8, 5, &"h2", 1).is_empty(),
		"Rarity above Eternal cannot create a Soul")


func _expect(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures.append(message)
		push_error("H2 SKILL MATRIX: " + message)


func _finish() -> void:
	if _failures.is_empty():
		print("H2 SKILL MATRIX TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	print("H2 SKILL MATRIX TEST FAILED - %d / %d" % [
		_failures.size(), _checks
	])
	quit(1)
