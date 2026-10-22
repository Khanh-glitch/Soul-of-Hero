@tool
class_name CampaignMilestoneDefinition
extends Resource

## Authored, save-stable reward contract for a story boss recruitment.
##
## A milestone may be documented before its level exists. FUTURE content is
## intentionally rejected by CampaignProgressionService until production flips
## the status after the boss encounter and level routing are actually playable.

enum ImplementationStatus {
	FUTURE,
	CONTENT_READY,
	PLAYABLE,
}

@export_category("Identity")
@export var milestone_id: StringName
@export var implementation_status := ImplementationStatus.FUTURE
@export_multiline var status_note := ""

@export_category("Campaign trigger")
@export_range(1, LevelDefinition.CAMPAIGN_LEVEL_CAPACITY, 1) var campaign_slot := 1
@export_range(1, LevelDefinition.CAMPAIGN_CHAPTER_CAPACITY, 1) var chapter_number := 1
@export var level_id: StringName
@export var boss_enemy_id: StringName

@export_category("Durable rewards")
@export var recruited_hero_id: StringName
@export var granted_feature_ids: PackedStringArray
@export var reward_transaction_id: StringName
@export var assign_recruited_hero_to_first_reserve := false

@export_category("Story intent")
@export_multiline var narrative_summary := ""


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, milestone_id, "Campaign milestone ID")
	ContentId.append_if_invalid(errors, level_id, "Campaign milestone level ID")
	ContentId.append_if_invalid(errors, boss_enemy_id, "Campaign milestone boss enemy ID")
	ContentId.append_if_invalid(errors, recruited_hero_id, "Recruited Hero ID")
	ContentId.append_duplicate_or_invalid_ids(errors, granted_feature_ids, "Granted feature IDs")
	ContentId.append_if_invalid_transaction_key(errors, reward_transaction_id, "Campaign milestone transaction ID")
	if not LevelDefinition.is_valid_campaign_slot(campaign_slot):
		errors.append("Campaign milestone slot must be between 1 and %d." % LevelDefinition.CAMPAIGN_LEVEL_CAPACITY)
	else:
		var expected_chapter := LevelDefinition.get_chapter_for_campaign_slot(campaign_slot)
		if chapter_number != expected_chapter:
			errors.append("Campaign milestone slot %d belongs to chapter %d." % [campaign_slot, expected_chapter])
	if implementation_status not in ImplementationStatus.values():
		errors.append("Campaign milestone implementation status is unsupported.")
	if status_note.strip_edges().is_empty():
		errors.append("Campaign milestone status note is required.")
	if narrative_summary.strip_edges().is_empty():
		errors.append("Campaign milestone narrative summary is required.")
	if granted_feature_ids.has("second_spirit"):
		errors.append("Legacy second_spirit cannot be granted by a Hero milestone.")
	if assign_recruited_hero_to_first_reserve:
		errors.append("Hero pickup cannot auto-assign a Reserve; explicit wardrobe Equip is required.")
	return errors


func is_playable_now() -> bool:
	return implementation_status == ImplementationStatus.PLAYABLE
