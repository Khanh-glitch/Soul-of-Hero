class_name RuntimeLootCatalog
extends RefCounted

## Converts one deterministic roll into a complete physical-loot payload. The
## payload already owns the exact item instance that SaveService will commit;
## opening a UI or waiting for a result screen can never reroll it.

const RARITY_RULES := preload("res://game/loot/loot_rarity_rules.gd")
const COMPLEXITY_RULES := preload(
	"res://game/meta/progression/complexity_progression_rules.gd"
)
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const AUXILIARY_PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const HERO_SOUL_COMBAT_AFFIXES := preload(
	"res://game/meta/hero_souls/hero_soul_combat_affixes.gd"
)
const ARCHER_SOUL_ASSETS := preload("res://game/loot/archer_soul_asset_catalog.gd")
const LOOT_ASSETS := preload("res://game/loot/loot_asset_catalog.gd")
const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

const ICON_HERO_SOUL := "res://assets/ui/loot/hero_soul.png"
const ICON_HERO_SOUL_SWORD := "res://assets/ui/loot/hero_soul_sword.png"
const ICON_HERO_SOUL_AXE := "res://assets/ui/loot/hero_soul_axe.png"
const ICON_SOUL_EMBER := "res://assets/ui/loot/soul_ember.png"
const ICON_WIZARD_SOUL := "res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons79.png"


static func build_payload(
		seed: int,
		rarity_value: Variant,
		item_level: int,
		source_kind: StringName,
		source_id: StringName = &"runtime",
		availability: Dictionary = {}
) -> Dictionary:
	var rarity := RARITY_RULES.normalize(rarity_value)
	var policy := COMPLEXITY_RULES.resolve_availability(availability)
	var restricted := not policy.is_empty()
	if restricted:
		rarity = COMPLEXITY_RULES.cap_rarity(rarity, policy)
	var rarity_index := RARITY_RULES.rarity_index(rarity)
	var level := clampi(item_level, 1, 100)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var hero_soul_chance := 0.045 + float(rarity_index) * 0.022
	var equipment_chance := 0.30 + float(rarity_index) * 0.035
	if source_kind in [&"chest", &"boss", &"miniboss"]:
		hero_soul_chance += 0.055
		equipment_chance += 0.08
	var family_roll := rng.randf()
	var payload: Dictionary
	if family_roll < hero_soul_chance:
		if not restricted or COMPLEXITY_RULES.allows_random_family(policy, &"hero_soul"):
			payload = _build_hero_soul(
				seed, rarity, level, source_kind, availability, policy,
			)
		else:
			payload = _build_material(seed, rarity, rarity_index, source_kind)
	elif family_roll < hero_soul_chance + equipment_chance:
		if not restricted or COMPLEXITY_RULES.allows_random_family(policy, &"equipment"):
			payload = _build_auxiliary(seed, rarity, level, policy)
		else:
			payload = _build_material(seed, rarity, rarity_index, source_kind)
		# Level-one characters have no auxiliary slot yet.  A physical drop
		# must never disappear merely because its rolled family is still gated.
		if payload.is_empty():
			payload = _build_material(seed, rarity, rarity_index, source_kind)
	else:
		payload = _build_material(seed, rarity, rarity_index, source_kind)
	if payload.is_empty():
		return {}
	# A LIVE-only auxiliary pool can own fewer unique affixes than a late rarity
	# requires.  In that case _build_auxiliary truthfully steps the item down to
	# the highest supported rarity instead of inventing effects or deleting the
	# equipment-family roll.
	rarity = RARITY_RULES.normalize(payload.get("rarity", rarity))
	var stable_key := "%s:%s:%s:%d:%d" % [
		String(source_id), String(source_kind), String(rarity), level, seed,
	]
	payload["loot_id"] = stable_key.sha256_text().substr(0, 24)
	payload["rarity"] = rarity
	payload["item_level"] = level
	payload["source"] = source_kind
	payload["source_id"] = source_id
	if restricted:
		payload["complexity"] = COMPLEXITY_RULES.metadata_for_payload(policy)
	return payload


static func availability_metadata(availability: Dictionary) -> Dictionary:
	return COMPLEXITY_RULES.metadata_for_payload(
		COMPLEXITY_RULES.resolve_availability(availability)
	)


static func is_valid_payload(payload: Dictionary) -> bool:
	if String(payload.get("loot_id", "")).is_empty() \
			or String(payload.get("display_name", "")).is_empty() \
			or not ResourceLoader.exists(String(payload.get("icon_path", ""))):
		return false
	var kind := StringName(payload.get("kind", &""))
	if kind == &"stackable":
		return not String(payload.get("item_id", "")).is_empty() \
			and int(payload.get("quantity", 0)) > 0 \
			and String(payload.get("inventory_kind", "")) in [
				"material", "consumable", "blueprint", "key_item",
			]
	if kind in [&"auxiliary_equipment", &"hero_soul"]:
		return payload.get("item", null) is Dictionary \
			and not (payload.get("item", {}) as Dictionary).is_empty()
	return false


## Rehydrates an inventory entry into the same physical-loot contract used by
## monster drops.  Player drops are explicit-pickup only, so walking over the
## item can never auto-magnet it back into a full bag or into the same slot.
static func build_inventory_drop_payload(
		kind_value: StringName,
		item: Dictionary,
		stack_item_id: StringName = &"",
) -> Dictionary:
	var kind := StringName(kind_value)
	var payload: Dictionary = {}
	var rarity := RARITY_RULES.normalize(item.get("rarity", &"normal"))
	match kind:
		&"hero_soul":
			if HERO_SOUL_RULES.validate_instance(item).size() > 0:
				return {}
			var hero_id := StringName(item.get("hero_id", &"sword_hero"))
			var icon_path := ICON_HERO_SOUL_SWORD
			var display_name := "Kiếm Linh Hồn"
			match hero_id:
				&"archer_hero":
					icon_path = ARCHER_SOUL_ASSETS.icon_path(RARITY_RULES.rarity_index(rarity))
					display_name = "Cung Linh Hồn"
				&"axe_hero":
					icon_path = ICON_HERO_SOUL_AXE
					display_name = "Rìu Linh Hồn"
				&"wizard_hero", &"mage_hero":
					icon_path = ICON_WIZARD_SOUL
					display_name = "Quyền Trượng Linh Hồn"
			payload = {
				"kind": &"hero_soul",
				"family": &"hero_soul",
				"display_name": display_name,
				"icon_path": icon_path,
				"quantity": 1,
				"rarity": rarity,
				"item": item.duplicate(true),
			}
		&"auxiliary_equipment":
			if not AUXILIARY_RULES.validate_item(item).is_empty():
				return {}
			var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
			if presentation.is_empty():
				return {}
			payload = {
				"kind": &"auxiliary_equipment",
				"family": &"equipment",
				"item_family": StringName(presentation.get("family", "equipment")),
				"definition_id": StringName(presentation.get("definition_id", "")),
				"display_name": String(presentation.get("display_name", "Trang Bị Linh Hồn")),
				"icon_path": String(presentation.get("icon_path", "")),
				"quantity": 1,
				"rarity": rarity,
				"item": item.duplicate(true),
			}
		&"stackable":
			var item_id := String(stack_item_id).strip_edges().to_lower()
			var quantity := int(item.get("quantity", 0))
			var inventory_kind := StringName(item.get("kind", &"material"))
			if item_id.is_empty() or quantity < 1 or inventory_kind not in [
				&"material", &"consumable", &"blueprint", &"key_item",
			]:
				return {}
			var is_stone := item_id.begins_with("soul_upgrade_stone_")
			var stone := AUXILIARY_PRESENTATION.upgrade_stone_presentation(String(rarity)) if is_stone else {}
			var item_definition := STACK_ITEM_CATALOG.find(StringName(item_id)) if STACK_ITEM_CATALOG != null else null
			var display_name := String(item.get("display_name", "")).strip_edges()
			if display_name.is_empty() and item_definition != null:
				display_name = item_definition.display_name
			if display_name.is_empty():
				display_name = String(stone.get("display_name", "Đá Nâng Cấp")) if is_stone else "Tinh Chất Linh Hồn"
			var icon_path := String(item.get("icon_path", "")).strip_edges()
			if icon_path.is_empty() and item_definition != null and item_definition.icon != null:
				icon_path = item_definition.icon.resource_path
			if icon_path.is_empty():
				icon_path = String(stone.get("icon_path", "")) if is_stone else ICON_SOUL_EMBER
			payload = {
				"kind": &"stackable",
				"family": &"upgrade_stone" if is_stone else &"material",
				"display_name": display_name,
				"icon_path": icon_path,
				"item_id": StringName(item_id),
				"inventory_kind": inventory_kind,
				"quantity": quantity,
				"rarity": rarity,
			}
		_:
			return {}
	if payload.is_empty() or not ResourceLoader.exists(String(payload.get("icon_path", ""))):
		return {}
	var identity := String(stack_item_id)
	if identity.is_empty():
		identity = String(item.get("instance_id", item.get("uuid", "inventory")))
	var entropy := "%s:%s:%d" % [identity, String(kind), Time.get_ticks_usec()]
	var loot_id := "player_drop_%s" % entropy.sha256_text().substr(0, 24)
	payload["loot_id"] = loot_id
	payload["source"] = &"player_drop"
	payload["source_id"] = StringName(identity)
	payload["item_level"] = clampi(int(item.get("item_level", 1)), 1, 100)
	payload["dropped_by_player"] = true
	payload["requires_explicit_pickup"] = true
	payload["pickup_transaction_key"] = "loot_pickup:%s" % loot_id
	return payload


static func _build_auxiliary(
		seed: int,
		rarity: StringName,
		item_level: int,
		policy: Dictionary = {}
) -> Dictionary:
	var restricted := not policy.is_empty()
	var allowed_slots: Variant = policy.get(
		"allowed_auxiliary_slots",
		PackedStringArray(),
	)
	var affix_map := {}
	if restricted:
		var affix_map_value: Variant = policy.get("allowed_auxiliary_affixes", null)
		if not affix_map_value is Dictionary:
			return {}
		affix_map = affix_map_value as Dictionary
	var slots := PackedStringArray()
	var effective_rarity := rarity
	var requested_rarity_index := AUXILIARY_DEFINITIONS.rarity_index(String(rarity))
	for candidate_rarity_index: int in range(requested_rarity_index, -1, -1):
		var candidate_rarity := String(AUXILIARY_DEFINITIONS.RARITY_IDS[candidate_rarity_index])
		var required_affix_count := AUXILIARY_DEFINITIONS.affix_count(candidate_rarity)
		slots.clear()
		for candidate_slot: String in AUXILIARY_DEFINITIONS.SLOT_IDS:
			if item_level < AUXILIARY_DEFINITIONS.unlock_level(candidate_slot):
				continue
			if restricted:
				if candidate_slot not in allowed_slots or not affix_map.has(candidate_slot):
					continue
				var filter_value: Variant = affix_map[candidate_slot]
				if (not filter_value is PackedStringArray and not filter_value is Array) \
						or filter_value.size() < required_affix_count:
					continue
			slots.append(candidate_slot)
		if not slots.is_empty():
			effective_rarity = StringName(candidate_rarity)
			break
	if slots.is_empty():
		return {}
	var slot := String(slots[posmod(seed, slots.size())])
	var allowed_affixes: Variant = null
	if restricted:
		allowed_affixes = affix_map[slot]
	var item := AUXILIARY_RULES.generate_item(
		StringName(slot),
		effective_rarity,
		item_level,
		seed,
		&"runtime_drop",
		allowed_affixes,
	)
	if item.is_empty():
		return {}
	var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
	if presentation.is_empty():
		return {}
	return {
		"kind": &"auxiliary_equipment",
		"family": &"equipment",
		"item_family": StringName(presentation.get("family", "equipment")),
		"definition_id": StringName(presentation.get("definition_id", "")),
		"display_name": String(presentation.get("display_name", "Trang Bị Linh Hồn")),
		"icon_path": String(presentation.get("icon_path", "")),
		"quantity": 1,
		"rarity": effective_rarity,
		"item": item,
	}


static func _build_hero_soul(
		seed: int,
		rarity: StringName,
		item_level: int,
		source_kind: StringName,
		availability: Dictionary,
		policy: Dictionary = {}
) -> Dictionary:
	var rarity_index := RARITY_RULES.rarity_index(rarity)
	var hero_id := &"sword_hero"
	var display_name := "Hero Weapon — Kiếm Sĩ"
	var icon_path := ICON_HERO_SOUL_SWORD
	var affinity := HERO_SOUL_RULES.AFFINITY_WARRIOR
	# Axe is story-only. Generic boss/chest rolls must never unlock that Hero;
	# after the durable story entitlement exists they may roll weapon copies.
	var axe_available := bool(availability.get("axe_hero_unlocked", false))
	var archer_available := bool(availability.get("archer_hero_unlocked", false))
	var wizard_available := bool(availability.get("wizard_hero_unlocked", false))
	if rarity_index >= HERO_SOUL_RULES.Rarity.MAGIC \
			and axe_available \
			and (posmod(seed, 5) >= 3 or source_kind == &"boss"):
		hero_id = &"axe_hero"
		display_name = "Hero Weapon — Chiến Binh Rìu"
		icon_path = ICON_HERO_SOUL_AXE
	if not policy.is_empty() or archer_available or wizard_available:
		var candidates := PackedStringArray(["sword_hero"])
		if archer_available:
			candidates.append("archer_hero")
		if rarity_index >= HERO_SOUL_RULES.Rarity.MAGIC and axe_available:
			candidates.append("axe_hero")
		if wizard_available:
			candidates.append("wizard_hero")
		hero_id = StringName(candidates[posmod(seed, candidates.size())])
		match hero_id:
			&"axe_hero":
				display_name = "Rìu Linh Hồn"
				icon_path = ICON_HERO_SOUL_AXE
			&"archer_hero":
				display_name = "Cung Linh Hồn"
				icon_path = ARCHER_SOUL_ASSETS.icon_path(rarity_index)
				affinity = HERO_SOUL_RULES.AFFINITY_RANGER
			&"wizard_hero":
				display_name = "Quyền Trượng Linh Hồn"
				icon_path = LOOT_ASSETS.WIZARD_HERO_SOUL_ICON_PATH
				affinity = HERO_SOUL_RULES.AFFINITY_MAGICIAN
	var item: Dictionary
	if policy.is_empty():
		item = HERO_SOUL_RULES.create_instance(
			hero_id,
			rarity_index,
			item_level,
			&"runtime_drop",
			seed,
			affinity,
		)
	else:
		var contract := HERO_SOUL_COMBAT_AFFIXES.prototype_fusion_roll_contract(hero_id)
		if contract.is_empty():
			return {}
		var contract_allowed := PackedStringArray(contract.get(
			"allowed_affix_ids", PackedStringArray(),
		))
		var policy_allowed_value: Variant = policy.get(
			"allowed_hero_soul_affixes", null,
		)
		if not policy_allowed_value is PackedStringArray and not policy_allowed_value is Array:
			return {}
		var allowed_intersection := PackedStringArray()
		for affix_id: String in policy_allowed_value:
			if contract_allowed.has(affix_id) \
					and HERO_SOUL_COMBAT_AFFIXES.is_live_affix(affix_id):
				allowed_intersection.append(affix_id)
		if rarity_index > HERO_SOUL_RULES.Rarity.NORMAL and allowed_intersection.is_empty():
			return {}
		item = HERO_SOUL_RULES.create_instance(
			hero_id,
			rarity_index,
			item_level,
			&"runtime_drop",
			seed,
			affinity,
			&"",
			PackedStringArray(contract.get("supported_action_tags", PackedStringArray())),
			allowed_intersection,
		)
	if item.is_empty():
		return {}
	if not policy.is_empty():
		var allowed_ids := PackedStringArray(policy.get(
			"allowed_hero_soul_affixes", PackedStringArray(),
		))
		for raw_affix: Variant in item.get("affixes", []):
			if not raw_affix is Dictionary \
					or not allowed_ids.has(String((raw_affix as Dictionary).get("affix_id", ""))):
				return {}
	return {
		"kind": &"hero_soul",
		"family": &"hero_soul",
		"display_name": display_name,
		"icon_path": icon_path,
		"quantity": 1,
		"item": item,
	}


static func _build_material(
		seed: int,
		rarity: StringName,
		rarity_index: int,
		source_kind: StringName
) -> Dictionary:
	var stone_rng := RandomNumberGenerator.new()
	stone_rng.seed = seed ^ 0x4D3
	var stone_chance := 0.18 + float(rarity_index) * 0.045
	if source_kind in [&"boss", &"miniboss", &"chest"]:
		stone_chance += 0.12
	if stone_rng.randf() < minf(stone_chance, 0.62):
		var stone := AUXILIARY_PRESENTATION.upgrade_stone_presentation(String(rarity))
		if not stone.is_empty():
			return {
				"kind": &"stackable", "family": &"upgrade_stone",
				"display_name": String(stone.get("display_name", "Soul Upgrade Stone")),
				"icon_path": String(stone.get("icon_path", "")),
				"item_id": StringName(stone.get("item_id", "")),
				"inventory_kind": &"material", "quantity": 1 + int(source_kind in [&"boss", &"chest"]),
				"rarity": rarity,
			}
	var quantity := 1 + rarity_index
	if source_kind in [&"chest", &"boss"]:
		quantity += 1 + floori(float(rarity_index) / 2.0)
	return {
		"kind": &"stackable",
		"family": &"material",
		"display_name": "Tinh Chất Linh Hồn",
		"icon_path": ICON_SOUL_EMBER,
		"item_id": &"soul_ember",
		"inventory_kind": &"material",
		"quantity": quantity,
		"rarity": rarity,
	}
