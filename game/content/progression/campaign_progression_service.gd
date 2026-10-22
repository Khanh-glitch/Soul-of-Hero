class_name CampaignProgressionService
extends Node

## Legacy boss-milestone guard. Boss defeat is combat state, never direct Hero
## ownership: Archer/Wizard recruitment comes from durable shard rewards while
## Axe remains restricted to the explicit story unlock path.

signal milestone_applied(milestone_id: StringName)
signal hero_recruited(hero_id: StringName) # Deprecated; boss defeat never emits it.
signal feature_granted(feature_id: StringName) # Deprecated; pickup owns features.
signal milestone_rejected(milestone_id: StringName, reason: String)

const DEFAULT_PLAN: CampaignProgressionPlan = preload("res://data/content/progression/soul_hero_campaign_plan.tres")

var _plan: CampaignProgressionPlan = DEFAULT_PLAN
var _save_service: Node


func _ready() -> void:
	if _save_service == null:
		_save_service = get_node_or_null("/root/SaveService")


func configure(plan: CampaignProgressionPlan, save_service: Node) -> bool:
	if plan == null or not plan.get_validation_errors().is_empty():
		return false
	if save_service == null or not save_service.has_method(&"get_snapshot") or not save_service.has_method(&"transact_once"):
		return false
	_plan = plan
	_save_service = save_service
	return true


func get_plan() -> CampaignProgressionPlan:
	return _plan


func apply_boss_defeat(
		milestone_id: StringName,
		defeated_boss_id: StringName,
		source_level_id: StringName
) -> bool:
	var milestone := _plan.find_milestone(milestone_id) if _plan != null else null
	if milestone == null:
		return _reject(milestone_id, "Unknown campaign milestone.")
	if not milestone.is_playable_now():
		return _reject(milestone_id, "Milestone content is not playable yet.")
	if milestone.boss_enemy_id != defeated_boss_id:
		return _reject(milestone_id, "Defeated boss does not match the milestone contract.")
	if milestone.level_id != source_level_id:
		return _reject(milestone_id, "Source level does not match the milestone contract.")
	if not _has_save_service():
		return _reject(milestone_id, "SaveService is unavailable.")
	var snapshot: Dictionary = _save_service.call("get_snapshot")
	var progression: Dictionary = snapshot.get("progression", {})
	var campaign: Dictionary = progression.get("campaign", {})
	var unlocked_levels: Variant = campaign.get("unlocked_levels", [])
	if not unlocked_levels is Array or not (unlocked_levels as Array).has(String(source_level_id)):
		return _reject(milestone_id, "Source campaign level is not unlocked in this profile.")

	return _reject(
		milestone_id,
		"Boss defeat cannot grant Hero ownership directly; apply the authored shard reward bundle."
	)


func _has_save_service() -> bool:
	if _save_service == null:
		_save_service = get_node_or_null("/root/SaveService")
	return _save_service != null and _save_service.has_method(&"get_snapshot") and _save_service.has_method(&"transact_once")


func _reject(milestone_id: StringName, reason: String) -> bool:
	milestone_rejected.emit(milestone_id, reason)
	return false
