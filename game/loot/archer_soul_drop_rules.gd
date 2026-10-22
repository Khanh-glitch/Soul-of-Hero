class_name ArcherSoulDropRules
extends RefCounted

## Deterministic Level 5 replay reward contract.
##
## The first physical pickup remains the authored Normal recruitment Soul. Every
## later clear rolls one more Archer Soul. All three curves decrease from low to
## high rarity, while Medium and Hard move probability mass monotonically toward
## every higher-rarity tail.

const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const DIFFICULTY_RULES := preload("res://game/meta/progression/difficulty_rules.gd")
const ARCHER_SOUL_ASSETS := preload("res://game/loot/archer_soul_asset_catalog.gd")
const FIRST_PICKUP_BUNDLE: RewardBundleDefinition = preload(
	"res://data/content/rewards/chapter_1_level_5_archer_soul_pickup.tres"
)

const HERO_ID := &"archer_hero"
const SOURCE_ID := &"chapter_1_level_5_archer_replay"
const AFFINITY := &"ranger"
const BOSS_ENTITY_ID := &"l5_hooded_archer_miniboss"
const ROLL_CHANNEL := "archer_soul_rarity"
const MAX_ITEM_LEVEL := 100
const FIRST_PICKUP_TRANSACTION_KEY := "campaign:chapter_1_level_5:archer_soul_pickup:v1"
const PROFILE_ID := &"level_5_archer_soul"

## Raw weights intentionally total 100 for easy auditing. Callers still consume
## normalized probabilities so later tuning cannot accidentally break the roll.
const REPLAY_RARITY_WEIGHTS := {
	"easy": [55.0, 24.0, 11.0, 5.0, 2.5, 1.2, 0.7, 0.6],
	"medium": [44.0, 25.0, 14.0, 8.0, 4.5, 2.4, 1.3, 0.8],
	"hard": [34.0, 24.0, 17.0, 10.0, 6.5, 4.0, 2.7, 1.8],
}


static func normalized_probabilities(difficulty_id: Variant) -> PackedFloat64Array:
	var difficulty := DIFFICULTY_RULES.normalize_id(difficulty_id)
	var raw: Array = REPLAY_RARITY_WEIGHTS[String(difficulty)]
	var total := 0.0
	for value: Variant in raw:
		total += maxf(0.0, float(value))
	var result := PackedFloat64Array()
	if total <= 0.0:
		result.resize(HERO_SOUL_RULES.MAX_RARITY + 1)
		result[HERO_SOUL_RULES.Rarity.NORMAL] = 1.0
		return result
	for value: Variant in raw:
		result.append(maxf(0.0, float(value)) / total)
	return result


static func rarity_from_unit_roll(difficulty_id: Variant, unit_roll: float) -> int:
	var probabilities := normalized_probabilities(difficulty_id)
	var needle := clampf(unit_roll, 0.0, 0.999999999)
	var cumulative := 0.0
	for rarity: int in probabilities.size():
		cumulative += probabilities[rarity]
		if needle < cumulative:
			return rarity
	return HERO_SOUL_RULES.MAX_RARITY


static func roll_rarity(run_id: String, difficulty_id: Variant) -> int:
	return rarity_from_unit_roll(
		difficulty_id,
		DIFFICULTY_RULES.deterministic_roll(
			_normalize_run_id(run_id),
			BOSS_ENTITY_ID,
			ROLL_CHANNEL,
		),
	)


static func create_replay_soul(
		run_id: String,
		difficulty_id: Variant,
		item_level: int,
) -> Dictionary:
	var normalized_run_id := _normalize_run_id(run_id)
	return HERO_SOUL_RULES.create_instance(
		HERO_ID,
		roll_rarity(normalized_run_id, difficulty_id),
		clampi(item_level, 1, MAX_ITEM_LEVEL),
		SOURCE_ID,
		_seed_from_run(normalized_run_id),
		AFFINITY,
		&"",
		PackedStringArray([
			"normal_attack", "ranged", "projectile", "active", "summon",
			"departure", "relay", "dash", "moving_attack",
		]),
	)


static func replay_transaction_key(run_id: String) -> String:
	return "campaign:chapter_1_level_5:archer_soul_replay:%s" % (
		_normalize_run_id(run_id).sha256_text().substr(0, 24)
	)


## Produces the exact standard GroundLoot payload consumed by LootDirector.
## First acquisition is Normal and uses the authored reward bundle so its Hero
## identity/features commit atomically. Every later run uses the replay curve.
## If an old receipt exists without its deterministic Soul, the first payload is
## emitted again and GroundLoot's generic reconciliation seam repairs it.
static func build_guaranteed_payload(
		run_context: Dictionary,
		save_snapshot: Dictionary,
) -> Dictionary:
	# Recruitment rewards are now ten durable shards on first-clear results.
	# No Hero Weapon or physical Soul pickup is produced by this legacy profile.
	return {}
	# Compatibility implementation below remains unreachable for old inspectors.
	var run_id := _normalize_run_id(String(run_context.get("run_id", "")))
	var difficulty := DIFFICULTY_RULES.normalize_id(run_context.get("difficulty", &"easy"))
	var item_level := clampi(int(run_context.get("stage_level", 5)), 1, MAX_ITEM_LEVEL)
	var fixed_soul := _first_clear_soul()
	var fixed_receipt := _snapshot_has_transaction(save_snapshot, FIRST_PICKUP_TRANSACTION_KEY)
	var fixed_soul_owned := _snapshot_owns_instance(
		save_snapshot,
		String(fixed_soul.get("instance_id", "")),
	)
	var first_clear := not fixed_receipt or not fixed_soul_owned
	var soul := fixed_soul if first_clear else create_replay_soul(
		run_id,
		difficulty,
		item_level,
	)
	var transaction_key := FIRST_PICKUP_TRANSACTION_KEY if first_clear \
		else replay_transaction_key(run_id)
	var rarity_index := int(soul.get("rarity", HERO_SOUL_RULES.Rarity.NORMAL))
	var rarity_id := StringName(HERO_SOUL_RULES.rarity_name(rarity_index).to_lower())
	return {
		"kind": &"hero_soul",
		"family": &"hero_soul",
		"display_name": "Cung Linh Hồn",
		"icon_path": ARCHER_SOUL_ASSETS.icon_path(rarity_index),
		"quantity": 1,
		"item": soul,
		"loot_id": transaction_key.sha256_text().substr(0, 24),
		"rarity": rarity_id,
		"item_level": int(soul.get("item_level", item_level)),
		"source": &"miniboss",
		"source_id": BOSS_ENTITY_ID,
		"loot_profile": PROFILE_ID,
		"pickup_transaction_key": transaction_key,
		"pickup_commit_mode": &"reward_bundle_unique" if first_clear else &"hero_soul",
		"reward_bundle_path": FIRST_PICKUP_BUNDLE.resource_path if first_clear else "",
		"reconcile_missing_entitlement": true,
		"guaranteed_entitlement": true,
		"first_clear": first_clear,
		"run_id": run_id,
		"difficulty": difficulty,
	}


static func high_rarity_tail_probability(
		difficulty_id: Variant,
		minimum_rarity: int,
) -> float:
	var probabilities := normalized_probabilities(difficulty_id)
	var result := 0.0
	for rarity: int in range(clampi(minimum_rarity, 0, probabilities.size()), probabilities.size()):
		result += probabilities[rarity]
	return result


static func _normalize_run_id(run_id: String) -> String:
	var normalized := run_id.strip_edges()
	return normalized if not normalized.is_empty() else "direct_level_5_run"


static func _seed_from_run(run_id: String) -> int:
	var raw := "%s|%s|archer_soul_affixes" % [run_id, String(BOSS_ENTITY_ID)]
	return maxi(1, raw.sha256_text().substr(0, 8).hex_to_int() & 0x7fffffff)


static func _first_clear_soul() -> Dictionary:
	var grants: Array = FIRST_PICKUP_BUNDLE.hero_soul_grants
	var grant: Resource = grants.front() if not grants.is_empty() else null
	return grant.call(&"create_soul_instance") if grant != null else {}


static func _snapshot_has_transaction(snapshot: Dictionary, transaction_key: String) -> bool:
	var value: Variant = snapshot.get("applied_transactions", {})
	return value is Dictionary and (value as Dictionary).has(transaction_key)


static func _snapshot_owns_instance(snapshot: Dictionary, instance_id: String) -> bool:
	if instance_id.is_empty():
		return false
	var inventory_value: Variant = snapshot.get("inventory", {})
	if not inventory_value is Dictionary:
		return false
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
	if not souls_value is Array:
		return false
	for raw_soul: Variant in souls_value:
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id:
			return true
	return false
