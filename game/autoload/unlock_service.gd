extends Node
class_name LivingArsenalUnlockService

## Central feature gate for progression-facing systems. It deliberately owns no
## UI: Hero Roster and Soul Team screens query these typed APIs.

signal hero_unlocked(hero_id: StringName)
signal feature_unlocked(feature_id: StringName)
signal unlock_rejected(category: StringName, item_id: StringName, reason: String)

## Deprecated compatibility signal. Schema v2 never emits weapon unlocks.
signal weapon_unlocked(weapon_id: StringName)

## Raw weapon ownership remains archived. `axe_hero` is intentionally absent:
## the approved Level 5 story recruitment is a new Hero identity and does not
## inherit legacy Axe ownership during save migration.
const LEGACY_WEAPON_IDS := [&"bow", &"axe", &"bow_hero"]
const NON_PERSISTENT_HERO_IDS := [&"relay_test_dummy", &"debug_relay_dummy"]

var _save_service: Node


func _ready() -> void:
	if _save_service == null:
		_save_service = get_node_or_null("/root/SaveService")


## Dependency injection seam used by isolated tests and developer profiles.
func configure_save_service(service: Node) -> bool:
	if service == null or not service.has_method("get_snapshot") or not service.has_method("transact_once"):
		return false
	_save_service = service
	return true


func is_hero_unlocked(hero_id: StringName) -> bool:
	var normalized := _normalize_hero_id(hero_id)
	if normalized.is_empty() or not _has_save_service():
		return false
	var snapshot: Dictionary = _save_service.call("get_snapshot")
	var progression: Dictionary = snapshot.get("progression", {})
	var heroes: Dictionary = progression.get("unlocked_heroes", {})
	return bool(heroes.get(normalized, false))


## Hero identity and Hero Weapon ownership are separate. Archer/Wizard consume
## 50 shards; Axe is admitted only by the story-specific campaign path below.
func unlock_hero(hero_id: StringName, transaction_key := "") -> bool:
	var normalized := _normalize_hero_id(hero_id)
	if normalized.is_empty():
		_reject(&"hero", hero_id, "Invalid or non-persistable Hero identifier.")
		return false
	if not _has_save_service():
		_reject(&"hero", hero_id, "SaveService is unavailable.")
		return false
	var was_unlocked := is_hero_unlocked(normalized)
	if was_unlocked:
		return true
	var key := transaction_key if not transaction_key.is_empty() else "unlock:hero:%s" % normalized
	if normalized == "axe_hero":
		_reject(&"hero", hero_id, "Axe can only be unlocked by its story recruitment.")
		return false
	if not _save_service.has_method(&"unlock_hero_with_shards"):
		return false
	var applied: bool = bool(_save_service.call(&"unlock_hero_with_shards", hero_id, key))
	if applied and not was_unlocked:
		hero_unlocked.emit(StringName(normalized))
	return applied


## Axe is the story-only exception. Other Heroes still use their shard economy.
func unlock_campaign_hero(
		hero_id: StringName,
		required_campaign_level: int,
		transaction_key := ""
) -> bool:
	if required_campaign_level < 1 or not _has_save_service():
		_reject(&"hero", hero_id, "Invalid campaign unlock requirement.")
		return false
	var snapshot: Dictionary = _save_service.call("get_snapshot")
	var progression: Dictionary = snapshot.get("progression", {})
	var campaign: Dictionary = progression.get("campaign", {})
	if int(campaign.get("level", 1)) < required_campaign_level:
		_reject(&"hero", hero_id, "Requires campaign Level %d." % required_campaign_level)
		return false
	var normalized := _normalize_hero_id(hero_id)
	if normalized == "axe_hero":
		if not _save_service.has_method(&"unlock_story_hero"):
			return false
		var key := transaction_key if not transaction_key.is_empty() \
			else "unlock:story:%s:level_%d" % [normalized, required_campaign_level]
		var applied := bool(_save_service.call(&"unlock_story_hero", hero_id, key))
		if applied:
			hero_unlocked.emit(hero_id)
		return applied
	return unlock_hero(hero_id, transaction_key)


func _snapshot_owns_hero_soul(snapshot: Dictionary, hero_id: String) -> bool:
	var inventory_value: Variant = snapshot.get("inventory", {})
	if not inventory_value is Dictionary:
		return false
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
	if not souls_value is Array:
		return false
	for raw_soul: Variant in souls_value:
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("hero_id", "")) == hero_id:
			return true
	return false


## Explicit legacy read: this reports what the old profile owned, never whether
## that archived content may be loaded in the current game.
func was_legacy_weapon_owned(weapon_id: StringName) -> bool:
	var normalized := _normalize_id(weapon_id)
	if normalized.is_empty() or not _has_save_service():
		return false
	var snapshot: Dictionary = _save_service.call("get_snapshot")
	var audit: Dictionary = snapshot.get("legacy_audit", {})
	var ownership: Dictionary = audit.get("weapon_ownership", {})
	return bool(ownership.get(normalized, false))


## Deprecated runtime query. Sword maps to the production Sword Hero; archived
## Bow/Axe never become available through this compatibility surface.
func is_weapon_unlocked(weapon_id: StringName) -> bool:
	var normalized := _normalize_id(weapon_id)
	return normalized == "sword" and is_hero_unlocked(&"sword_hero")


## Deprecated writes are rejected so legacy rewards cannot reactivate archived
## weapon content after a schema-v2 migration.
func unlock_weapon(weapon_id: StringName, _transaction_key := "") -> bool:
	_reject(&"legacy_weapon", weapon_id, "Weapon unlocks are archived; use a HeroDefinition save ID.")
	return false


func unlock_campaign_weapon(
		weapon_id: StringName,
		_required_campaign_level: int,
		_transaction_key := ""
) -> bool:
	_reject(&"legacy_weapon", weapon_id, "Campaign weapon rewards are disabled in SOUL OF HERO.")
	return false


func is_feature_unlocked(feature_id: StringName) -> bool:
	var normalized := _normalize_id(feature_id)
	if normalized == "second_spirit":
		return false
	if normalized.is_empty() or not _has_save_service():
		return false
	var snapshot: Dictionary = _save_service.call("get_snapshot")
	var progression: Dictionary = snapshot.get("progression", {})
	var features: Dictionary = progression.get("features", {})
	return bool(features.get(normalized, false))


## Unknown but well-formed feature IDs are allowed so future content can add a
## data-defined gate without modifying this service.
func unlock_feature(feature_id: StringName, transaction_key := "") -> bool:
	var normalized := _normalize_id(feature_id)
	if normalized == "second_spirit":
		_reject(&"legacy_feature", feature_id, "The old Spirit-slot feature is archived.")
		return false
	if normalized.is_empty():
		_reject(&"feature", feature_id, "Invalid feature identifier.")
		return false
	if not _has_save_service():
		_reject(&"feature", feature_id, "SaveService is unavailable.")
		return false
	var was_unlocked := is_feature_unlocked(normalized)
	var key := transaction_key if not transaction_key.is_empty() else "unlock:feature:%s" % normalized
	var applied: bool = _save_service.call(
		"transact_once",
		key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			features[normalized] = true
			progression["features"] = features
			candidate["progression"] = progression
			return true,
		{"kind": "feature_unlock", "id": normalized}
	)
	if applied and not was_unlocked:
		feature_unlocked.emit(StringName(normalized))
	return applied


func _has_save_service() -> bool:
	if _save_service == null:
		_save_service = get_node_or_null("/root/SaveService")
	return _save_service != null and _save_service.has_method("get_snapshot") and _save_service.has_method("transact_once")


func _normalize_id(raw_id: StringName) -> String:
	var normalized := String(raw_id).strip_edges().to_lower()
	if normalized.is_empty() or normalized.length() > 64:
		return ""
	const ALLOWED := "abcdefghijklmnopqrstuvwxyz0123456789_"
	for index: int in normalized.length():
		if ALLOWED.find(normalized[index]) < 0:
			return ""
	return normalized


func _normalize_hero_id(raw_id: StringName) -> String:
	var normalized := _normalize_id(raw_id)
	if normalized.is_empty():
		return ""
	if StringName(normalized) in LEGACY_WEAPON_IDS or StringName(normalized) in NON_PERSISTENT_HERO_IDS:
		return ""
	if normalized in ["sword", "bow", "axe"]:
		return ""
	return normalized


func _reject(category: StringName, item_id: StringName, reason: String) -> void:
	unlock_rejected.emit(category, item_id, reason)
