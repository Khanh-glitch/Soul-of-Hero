@tool
class_name RewardBundleDefinition
extends Resource

## Save-stable, authored first-clear reward.
##
## AppFlow applies this mutation inside the same SaveService transaction that
## records level completion. A crash can therefore never persist completion
## without its reward, or pay the reward without completion.

const MAX_CURRENCY_REWARD := 999999
const PLAYER_LEVEL_CAP := 100
const SOUL_TEAM_RESERVE_CAPACITY := 1
const HERO_SOUL_GRANT_SCRIPT := preload("res://game/content/rewards/reward_hero_soul_grant.gd")
const AUXILIARY_EQUIPMENT_GRANT_SCRIPT := preload("res://game/content/rewards/reward_auxiliary_equipment_grant.gd")
const AUXILIARY_EQUIPMENT_DEFINITIONS := preload(
	"res://game/meta/equipment/auxiliary_equipment_definitions.gd"
)

@export_category("Identity")
@export var bundle_id: StringName

@export_category("Currencies")
@export_range(0, MAX_CURRENCY_REWARD, 1) var account_currency := 0
@export_range(0, MAX_CURRENCY_REWARD, 1) var hero_materials := 0
@export_range(0, MAX_CURRENCY_REWARD, 1) var monster_fragments := 0

@export_category("Player progression")
@export_range(0, PLAYER_LEVEL_CAP, 1) var player_level_grant := 0

@export_category("Hero recruitment shards")
@export var hero_shards: Dictionary = {}

@export_category("Stackable inventory")
@export var item_stacks: Array[RewardItemStack] = []

@export_category("Unique Hero Souls")
@export var hero_soul_grants: Array[Resource] = []

@export_category("Unique auxiliary equipment")
@export var auxiliary_equipment_grants: Array[Resource] = []


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, bundle_id, "Reward bundle ID")
	for amount: int in [account_currency, hero_materials, monster_fragments]:
		if amount < 0 or amount > MAX_CURRENCY_REWARD:
			errors.append("Reward currency amount must be between 0 and %d." % MAX_CURRENCY_REWARD)
	if player_level_grant < 0 or player_level_grant > PLAYER_LEVEL_CAP:
		errors.append("Player-level reward must be between 0 and %d." % PLAYER_LEVEL_CAP)
	for raw_hero_id: Variant in hero_shards.keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		var amount: Variant = hero_shards[raw_hero_id]
		if hero_id.is_empty() or hero_id == "axe_hero" or not amount is int or int(amount) < 1:
			errors.append("Hero shard rewards require a valid non-Axe Hero and a positive integer amount.")
	var item_ids := {}
	for index: int in item_stacks.size():
		var item := item_stacks[index]
		if item == null:
			errors.append("item_stacks[%d] cannot be null." % index)
			continue
		for child_error: String in item.get_validation_errors():
			errors.append("item_stacks[%d]: %s" % [index, child_error])
		var item_id := item.get_effective_item_id()
		if item_ids.has(item_id):
			errors.append("Reward bundle contains duplicate item ID '%s'." % item_id)
		else:
			item_ids[item_id] = true
	var grant_ids := {}
	var instance_ids := {}
	for index: int in hero_soul_grants.size():
		var grant: Resource = hero_soul_grants[index]
		if grant == null:
			errors.append("hero_soul_grants[%d] cannot be null." % index)
			continue
		if grant.get_script() != HERO_SOUL_GRANT_SCRIPT:
			errors.append("hero_soul_grants[%d] must use RewardHeroSoulGrant." % index)
			continue
		for child_error: String in grant.call(&"get_validation_errors"):
			errors.append("hero_soul_grants[%d]: %s" % [index, child_error])
		var grant_id: StringName = grant.get("grant_id")
		if grant_ids.has(grant_id):
			errors.append("Reward bundle contains duplicate Hero Soul grant ID '%s'." % grant_id)
		else:
			grant_ids[grant_id] = true
		var grant_soul: Dictionary = grant.call(&"create_soul_instance")
		var instance_id := String(grant_soul.get("instance_id", ""))
		if not instance_id.is_empty() and instance_ids.has(instance_id):
			errors.append("Reward bundle contains duplicate Hero Soul instance ID '%s'." % instance_id)
		else:
			instance_ids[instance_id] = true
	var auxiliary_grant_ids := {}
	var auxiliary_instance_ids := {}
	for index: int in auxiliary_equipment_grants.size():
		var grant: Resource = auxiliary_equipment_grants[index]
		if grant == null:
			errors.append("auxiliary_equipment_grants[%d] cannot be null." % index)
			continue
		if grant.get_script() != AUXILIARY_EQUIPMENT_GRANT_SCRIPT:
			errors.append("auxiliary_equipment_grants[%d] must use RewardAuxiliaryEquipmentGrant." % index)
			continue
		for child_error: String in grant.call(&"get_validation_errors"):
			errors.append("auxiliary_equipment_grants[%d]: %s" % [index, child_error])
		var grant_id: StringName = grant.get("grant_id")
		if auxiliary_grant_ids.has(grant_id):
			errors.append("Reward bundle contains duplicate auxiliary equipment grant ID '%s'." % grant_id)
		else:
			auxiliary_grant_ids[grant_id] = true
		var granted_item: Dictionary = grant.call(&"create_item_instance")
		var uuid := String(granted_item.get("uuid", ""))
		if not uuid.is_empty() and auxiliary_instance_ids.has(uuid):
			errors.append("Reward bundle contains duplicate auxiliary equipment UUID '%s'." % uuid)
		else:
			auxiliary_instance_ids[uuid] = true
	if (
		account_currency == 0
		and hero_materials == 0
		and monster_fragments == 0
		and player_level_grant == 0
		and hero_shards.is_empty()
		and item_stacks.is_empty()
		and hero_soul_grants.is_empty()
		and auxiliary_equipment_grants.is_empty()
	):
		errors.append("Reward bundle must grant at least one progression, currency, item stack, Hero Soul, or auxiliary-equipment reward.")
	return errors


func apply_to_candidate(candidate: Dictionary) -> bool:
	if not get_validation_errors().is_empty():
		return false
	var staged := candidate.duplicate(true)
	if not _apply_economy_in_place(staged):
		return false
	if not _apply_player_level_grant_in_place(staged):
		return false
	if not _apply_hero_shards_in_place(staged):
		return false
	if not _apply_hero_soul_grants_in_place(staged, false):
		return false
	if not _apply_auxiliary_equipment_grants_in_place(staged, false):
		return false
	candidate.clear()
	candidate.merge(staged, true)
	return true


## Repairs content entitlements introduced after a profile already recorded its
## first-clear receipt. Economy rewards are deliberately excluded: only the
## deterministic unique Soul, Hero identity and features are reconciled. Team
## placement remains exclusively controlled by explicit wardrobe Equip.
func reconcile_unique_grants_to_candidate(candidate: Dictionary) -> bool:
	if not get_validation_errors().is_empty():
		return false
	var staged := candidate.duplicate(true)
	if not _apply_hero_soul_grants_in_place(staged, true):
		return false
	if not _apply_auxiliary_equipment_grants_in_place(staged, true):
		return false
	candidate.clear()
	candidate.merge(staged, true)
	return true


func _apply_player_level_grant_in_place(candidate: Dictionary) -> bool:
	if player_level_grant <= 0:
		return true
	var progression_value: Variant = candidate.get("progression", {})
	if not progression_value is Dictionary:
		return false
	var progression: Dictionary = (progression_value as Dictionary).duplicate(true)
	var player_value: Variant = progression.get("player", {})
	if not player_value is Dictionary:
		return false
	var player: Dictionary = (player_value as Dictionary).duplicate(true)
	var current_level_value: Variant = player.get("level", 1)
	if not current_level_value is int and not current_level_value is float:
		return false
	var current_level := int(current_level_value)
	if current_level < 1 or current_level > PLAYER_LEVEL_CAP:
		return false
	player["level"] = mini(PLAYER_LEVEL_CAP, current_level + player_level_grant)
	progression["player"] = player
	candidate["progression"] = progression
	return true


func _apply_hero_shards_in_place(candidate: Dictionary) -> bool:
	if hero_shards.is_empty():
		return true
	var progression_value: Variant = candidate.get("progression", {})
	if not progression_value is Dictionary:
		return false
	var progression := (progression_value as Dictionary).duplicate(true)
	var stored_value: Variant = progression.get("hero_shards", {})
	if not stored_value is Dictionary:
		return false
	var stored := (stored_value as Dictionary).duplicate(true)
	for raw_hero_id: Variant in hero_shards.keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		stored[hero_id] = int(stored.get(hero_id, 0)) + int(hero_shards[raw_hero_id])
	progression["hero_shards"] = stored
	candidate["progression"] = progression
	return true


func _apply_economy_in_place(candidate: Dictionary) -> bool:
	var currencies_value: Variant = candidate.get("currencies", {})
	var inventory_value: Variant = candidate.get("inventory", {})
	if not currencies_value is Dictionary or not inventory_value is Dictionary:
		return false

	var currencies: Dictionary = (currencies_value as Dictionary).duplicate(true)
	if not _add_currency(currencies, "account", account_currency):
		return false
	if not _add_currency(currencies, "hero_materials", hero_materials):
		return false
	if not _add_currency(currencies, "monster_fragments", monster_fragments):
		return false

	var inventory: Dictionary = (inventory_value as Dictionary).duplicate(true)
	var stored_stacks_value: Variant = inventory.get("item_stacks", {})
	if not stored_stacks_value is Dictionary:
		return false
	var stored_stacks: Dictionary = (stored_stacks_value as Dictionary).duplicate(true)
	for item: RewardItemStack in item_stacks:
		var item_key := String(item.get_effective_item_id())
		var kind_id := String(item.get_kind_id())
		var record := {"kind": kind_id, "quantity": 0}
		if stored_stacks.has(item_key):
			var record_value: Variant = stored_stacks[item_key]
			if not record_value is Dictionary:
				return false
			record = (record_value as Dictionary).duplicate(true)
			if String(record.get("kind", "")) != kind_id:
				return false
		var current_quantity: Variant = record.get("quantity", 0)
		if not current_quantity is int and not current_quantity is float:
			return false
		var next_quantity := int(current_quantity) + item.quantity
		if int(current_quantity) < 0 or next_quantity > RewardItemStack.MAX_QUANTITY:
			return false
		record["kind"] = kind_id
		record["quantity"] = next_quantity
		stored_stacks[item_key] = record

	inventory["item_stacks"] = stored_stacks
	candidate["currencies"] = currencies
	candidate["inventory"] = inventory
	return true


func _apply_hero_soul_grants_in_place(candidate: Dictionary, allow_existing_instances: bool) -> bool:
	if hero_soul_grants.is_empty():
		return true
	var inventory_value: Variant = candidate.get("inventory", {})
	var progression_value: Variant = candidate.get("progression", {})
	if not inventory_value is Dictionary or not progression_value is Dictionary:
		return false
	var inventory: Dictionary = (inventory_value as Dictionary).duplicate(true)
	var souls_value: Variant = inventory.get("hero_souls", [])
	if not souls_value is Array:
		return false
	var souls: Array = (souls_value as Array).duplicate(true)
	var souls_by_instance_id := {}
	for raw_soul: Variant in souls:
		if not raw_soul is Dictionary:
			return false
		var instance_id := String((raw_soul as Dictionary).get("instance_id", ""))
		if instance_id.is_empty() or souls_by_instance_id.has(instance_id):
			return false
		souls_by_instance_id[instance_id] = raw_soul

	var progression: Dictionary = (progression_value as Dictionary).duplicate(true)
	var heroes_value: Variant = progression.get("unlocked_heroes", {})
	var features_value: Variant = progression.get("features", {})
	if not heroes_value is Dictionary or not features_value is Dictionary:
		return false
	var heroes: Dictionary = (heroes_value as Dictionary).duplicate(true)
	var features: Dictionary = (features_value as Dictionary).duplicate(true)
	var team_required := false
	for grant: Resource in hero_soul_grants:
		team_required = team_required or bool(grant.get("assign_to_first_reserve"))

	var soul_team := {}
	var reserves: Array = []
	if team_required:
		var soul_team_value: Variant = candidate.get("soul_team", {})
		if not soul_team_value is Dictionary:
			return false
		soul_team = (soul_team_value as Dictionary).duplicate(true)
		var reserves_value: Variant = soul_team.get("reserve_souls", [])
		if not reserves_value is Array or (reserves_value as Array).size() > SOUL_TEAM_RESERVE_CAPACITY:
			return false
		reserves = (reserves_value as Array).duplicate()
		while reserves.size() < SOUL_TEAM_RESERVE_CAPACITY:
			reserves.append("")

	for grant: Resource in hero_soul_grants:
		var soul: Dictionary = grant.call(&"create_soul_instance")
		var instance_id := String(soul.get("instance_id", ""))
		var granted_hero_id := String(grant.get("hero_id"))
		if souls_by_instance_id.has(instance_id):
			var existing: Variant = souls_by_instance_id[instance_id]
			if (
				not allow_existing_instances
				or not existing is Dictionary
				or String((existing as Dictionary).get("hero_id", "")) != granted_hero_id
			):
				return false
		else:
			souls.append(soul.duplicate(true))
			souls_by_instance_id[instance_id] = soul
		heroes[granted_hero_id] = true
		var granted_feature_ids: PackedStringArray = grant.get("granted_feature_ids")
		for feature_id: String in granted_feature_ids:
			features[feature_id] = true
		if bool(grant.get("assign_to_first_reserve")):
			var hero_id := granted_hero_id
			var active_id := String(soul_team.get("active_hero", ""))
			if active_id != hero_id and not reserves.has(hero_id):
				for index: int in reserves.size():
					if String(reserves[index]).is_empty():
						reserves[index] = hero_id
						break

	inventory["hero_souls"] = souls
	progression["unlocked_heroes"] = heroes
	progression["features"] = features
	candidate["inventory"] = inventory
	candidate["progression"] = progression
	if team_required:
		soul_team["reserve_souls"] = reserves
		soul_team["capacity"] = SOUL_TEAM_RESERVE_CAPACITY
		candidate["soul_team"] = soul_team
	return true


func _apply_auxiliary_equipment_grants_in_place(
		candidate: Dictionary,
		allow_existing_instances: bool,
) -> bool:
	if auxiliary_equipment_grants.is_empty():
		return true
	var inventory_value: Variant = candidate.get("inventory", {})
	if not inventory_value is Dictionary:
		return false
	var inventory: Dictionary = (inventory_value as Dictionary).duplicate(true)
	var items_value: Variant = inventory.get("auxiliary_equipment", [])
	if not items_value is Array:
		return false
	var items: Array = (items_value as Array).duplicate(true)
	var loadout_value: Variant = candidate.get("auxiliary_loadout", {})
	var progression_value: Variant = candidate.get("progression", {})
	if not loadout_value is Dictionary or not progression_value is Dictionary:
		return false
	var loadout: Dictionary = (loadout_value as Dictionary).duplicate(true)
	var player_value: Variant = (progression_value as Dictionary).get("player", {})
	if not player_value is Dictionary:
		return false
	var player_level := int((player_value as Dictionary).get("level", 1))
	var items_by_uuid := {}
	var item_index_by_uuid := {}
	for item_index: int in items.size():
		var raw_item: Variant = items[item_index]
		if not raw_item is Dictionary:
			return false
		var uuid := String((raw_item as Dictionary).get("uuid", ""))
		if uuid.is_empty() or items_by_uuid.has(uuid):
			return false
		items_by_uuid[uuid] = raw_item
		item_index_by_uuid[uuid] = item_index

	for grant: Resource in auxiliary_equipment_grants:
		var granted_item: Dictionary = grant.call(&"create_item_instance")
		var uuid := String(granted_item.get("uuid", ""))
		if items_by_uuid.has(uuid):
			var existing: Variant = items_by_uuid[uuid]
			if not allow_existing_instances or not existing is Dictionary:
				return false
			var existing_item := existing as Dictionary
			if not _auxiliary_reward_matches(existing_item, granted_item):
				# The UUID is the entitlement identity; authored balance fields are
				# allowed to evolve. Preserve player protection and upgrade investment
				# while replacing the old deterministic roll in place, so reconciliation
				# never creates a duplicate reward after a tuning update.
				var reconciled_item := granted_item.duplicate(true)
				reconciled_item["favorite"] = bool(existing_item.get("favorite", false))
				reconciled_item["locked"] = bool(existing_item.get("locked", false))
				# Entitlement reconciliation may replace authored slot/affix fields, but
				# player-funded progression belongs to the owned UUID and must survive
				# every content revision just like protection state.
				reconciled_item["upgrade_rank"] = int(existing_item.get("upgrade_rank", 0))
				var was_equipped := false
				var next_slot := String(reconciled_item.get("slot", ""))
				for raw_loadout_slot: Variant in loadout.keys():
					if String(loadout.get(raw_loadout_slot, "")) != uuid:
						continue
					was_equipped = true
					if String(raw_loadout_slot) != next_slot:
						loadout[raw_loadout_slot] = ""
				if was_equipped \
						and String(loadout.get(next_slot, "")).is_empty() \
						and player_level >= _auxiliary_unlock_level(next_slot):
					loadout[next_slot] = uuid
				var existing_index := int(item_index_by_uuid.get(uuid, -1))
				if existing_index < 0 or existing_index >= items.size():
					return false
				items[existing_index] = reconciled_item
				items_by_uuid[uuid] = reconciled_item
		else:
			items.append(granted_item.duplicate(true))
			items_by_uuid[uuid] = granted_item
			item_index_by_uuid[uuid] = items.size() - 1
		if bool(grant.get("equip_if_slot_empty")):
			var slot_id := String(granted_item.get("slot", ""))
			if String(loadout.get(slot_id, "")).is_empty() \
					and player_level >= _auxiliary_unlock_level(slot_id):
				loadout[slot_id] = uuid
	inventory["auxiliary_equipment"] = items
	candidate["inventory"] = inventory
	candidate["auxiliary_loadout"] = loadout
	return true


func _auxiliary_reward_matches(existing: Dictionary, authored: Dictionary) -> bool:
	return (
		String(existing.get("slot", "")) == String(authored.get("slot", ""))
		and String(existing.get("rarity", "")) == String(authored.get("rarity", ""))
		and int(existing.get("item_level", 0)) == int(authored.get("item_level", 0))
		and existing.get("primary", {}) == authored.get("primary", {})
		and existing.get("affixes", []) == authored.get("affixes", [])
	)


func _auxiliary_unlock_level(slot_id: String) -> int:
	if not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_slot(slot_id):
		return PLAYER_LEVEL_CAP + 1
	return AUXILIARY_EQUIPMENT_DEFINITIONS.unlock_level(slot_id)


func to_summary() -> Dictionary:
	var currencies := {}
	if account_currency > 0:
		currencies["account"] = account_currency
	if hero_materials > 0:
		currencies["hero_materials"] = hero_materials
	if monster_fragments > 0:
		currencies["monster_fragments"] = monster_fragments
	var items: Array[Dictionary] = []
	for item: RewardItemStack in item_stacks:
		if item != null:
			items.append(item.to_summary())
	var hero_souls: Array[Dictionary] = []
	for grant: Resource in hero_soul_grants:
		if grant != null:
			hero_souls.append(grant.call(&"to_summary"))
	var auxiliary_equipment: Array[Dictionary] = []
	for grant: Resource in auxiliary_equipment_grants:
		if grant != null:
			auxiliary_equipment.append(grant.call(&"to_summary"))
	return {
		"bundle_id": String(bundle_id),
		"grant_rule": "first_clear",
		"player_level_grant": player_level_grant,
		"hero_shards": hero_shards.duplicate(true),
		"currencies": currencies,
		"items": items,
		"hero_souls": hero_souls,
		"auxiliary_equipment": auxiliary_equipment,
	}


func _add_currency(currencies: Dictionary, currency_id: String, amount: int) -> bool:
	var current_value: Variant = currencies.get(currency_id, 0)
	if not current_value is int and not current_value is float:
		return false
	var next_value := int(current_value) + amount
	if int(current_value) < 0 or next_value < 0:
		return false
	currencies[currency_id] = next_value
	return true
