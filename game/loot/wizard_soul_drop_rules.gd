class_name WizardSoulDropRules
extends RefCounted

## Level 20 never turns a boss death into an automatic Hero grant. The first
## clear is a protected Normal recruitment pickup; repeat clears are real
## boss-weighted Rare+ Wizard Soul rolls.

const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const WIZARD_SOUL_ASSETS := preload("res://game/loot/wizard_soul_asset_catalog.gd")
const FIRST_PICKUP_BUNDLE: RewardBundleDefinition = preload(
	"res://data/content/rewards/chapter_2_level_20_wizard_soul_pickup.tres"
)

const HERO_ID := &"wizard_hero"
const BOSS_ENTITY_ID := &"l20_wizard"
const PROFILE_ID := &"level_20_wizard_soul"
const FIRST_PICKUP_TRANSACTION_KEY := "campaign:chapter_2_level_20:wizard_soul_pickup:v1"


static func build_guaranteed_payload(
		_run_context: Dictionary,
		save_snapshot: Dictionary,
) -> Dictionary:
	# Recruitment rewards are now ten durable shards on first-clear results.
	# No Hero Weapon or physical Soul pickup is produced by this legacy profile.
	return {}
	# Compatibility implementation below remains unreachable for old inspectors.
	var receipt_applied := _snapshot_has_transaction(save_snapshot, FIRST_PICKUP_TRANSACTION_KEY)
	var soul := _fixed_soul() if not receipt_applied else _repeat_soul(_repeat_seed(_run_context, save_snapshot))
	var soul_owned := _snapshot_owns_instance(save_snapshot, String(soul.get("instance_id", "")))
	var rarity_index := int(soul.get("rarity", HERO_SOUL_RULES.Rarity.NORMAL))
	return {
		"kind": &"hero_soul",
		"family": &"hero_soul",
		"display_name": "Wizard Soul",
		"icon_path": WIZARD_SOUL_ASSETS.icon_path(rarity_index),
		"quantity": 1,
		"item": soul,
		"loot_id": _loot_key(receipt_applied, soul),
		"rarity": StringName(HERO_SOUL_RULES.rarity_name(rarity_index).to_lower()),
		"item_level": 20,
		"source": &"boss",
		"source_id": BOSS_ENTITY_ID,
		"loot_profile": PROFILE_ID,
		"pickup_transaction_key": FIRST_PICKUP_TRANSACTION_KEY if not receipt_applied else "loot_pickup:%s" % _loot_key(true, soul),
		"pickup_commit_mode": &"reward_bundle_unique" if not receipt_applied else &"",
		"reward_bundle_path": FIRST_PICKUP_BUNDLE.resource_path if not receipt_applied else "",
		"reconcile_missing_entitlement": not receipt_applied,
		"guaranteed_entitlement": not receipt_applied,
		"requires_explicit_pickup": true,
		"first_clear": not receipt_applied or not soul_owned,
	}


static func _fixed_soul() -> Dictionary:
	var grants: Array = FIRST_PICKUP_BUNDLE.hero_soul_grants
	var grant: Resource = grants.front() if not grants.is_empty() else null
	return grant.call(&"create_soul_instance") if grant != null else {}


static func _repeat_seed(run_context: Dictionary, save_snapshot: Dictionary) -> int:
	var material := "wizard_replay:%s:%d" % [String(run_context.get("run_id", "")), int(save_snapshot.get("revision", 0))]
	return int(material.sha256_text().substr(0, 8).hex_to_int())


static func _repeat_soul(seed: int) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var roll := rng.randf()
	var rarity := HERO_SOUL_RULES.Rarity.RARE
	if roll >= 0.56 and roll < 0.87:
		rarity = HERO_SOUL_RULES.Rarity.EPIC
	elif roll >= 0.87 and roll < 0.98:
		rarity = HERO_SOUL_RULES.Rarity.LEGENDARY
	elif roll >= 0.98:
		rarity = HERO_SOUL_RULES.Rarity.CRYSTAL
	return HERO_SOUL_RULES.create_instance(HERO_ID, rarity, 20, &"wizard_boss_replay", seed, HERO_SOUL_RULES.AFFINITY_MAGICIAN)


static func _loot_key(repeat: bool, soul: Dictionary) -> String:
	if not repeat:
		return FIRST_PICKUP_TRANSACTION_KEY.sha256_text().substr(0, 24)
	return ("wizard_boss_replay:%s" % String(soul.get("instance_id", ""))).sha256_text().substr(0, 24)


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
