@tool
class_name LevelDefinition
extends Resource

## Campaign-level authoring contract sized for ten chapters of ten levels.
##
## SANDBOX content has campaign_slot 0 and never counts toward campaign
## completion. CAMPAIGN_DRAFT and CAMPAIGN_READY use slots 1..100 with derived
## chapter metadata, allowing the registry to validate ordering incrementally.

enum ContentStatus {
	SANDBOX,
	CAMPAIGN_DRAFT,
	CAMPAIGN_READY,
}

const LEVELS_PER_CHAPTER := 10
const CAMPAIGN_CHAPTER_CAPACITY := 10
const CAMPAIGN_LEVEL_CAPACITY := LEVELS_PER_CHAPTER * CAMPAIGN_CHAPTER_CAPACITY

@export_category("Identity")
@export var level_id: StringName
@export var display_name: String
@export var content_status := ContentStatus.SANDBOX
@export_multiline var objective_summary: String
@export var level_tags: PackedStringArray
@export_multiline var authoring_notes: String

@export_category("Campaign placement")
@export_range(0, CAMPAIGN_LEVEL_CAPACITY, 1) var campaign_slot := 0
@export_range(0, CAMPAIGN_CHAPTER_CAPACITY, 1) var chapter_number := 0
@export_range(0, LEVELS_PER_CHAPTER, 1) var chapter_level_number := 0

@export_category("Runtime sources")
@export var level_scene: PackedScene
@export_file("*.json") var layout_data_path: String
@export var runtime_driver_id: StringName = &"dungeon_level"

@export_category("Encounter sequence")
@export var encounter_ids: PackedStringArray
@export var entry_encounter_id: StringName

@export_category("Progression")
@export var unlock_requirements: LevelUnlockRequirements
@export var granted_feature_ids: PackedStringArray
@export var completion_reward_bundle_id: StringName
@export var completion_transaction_id: StringName
@export_range(0, 999999, 1) var recommended_mastery := 0
## Zero uses the campaign default (5 * campaign slot).
@export_range(0, 500, 1) var average_enemy_level := 0


static func is_valid_campaign_slot(value: int) -> bool:
	return value >= 1 and value <= CAMPAIGN_LEVEL_CAPACITY


static func is_valid_campaign_chapter(value: int) -> bool:
	return value >= 1 and value <= CAMPAIGN_CHAPTER_CAPACITY


static func get_chapter_for_campaign_slot(value: int) -> int:
	if not is_valid_campaign_slot(value):
		return 0
	return int((value - 1) / LEVELS_PER_CHAPTER) + 1


static func get_chapter_level_for_campaign_slot(value: int) -> int:
	if not is_valid_campaign_slot(value):
		return 0
	return ((value - 1) % LEVELS_PER_CHAPTER) + 1


static func get_first_campaign_slot_for_chapter(value: int) -> int:
	if not is_valid_campaign_chapter(value):
		return 0
	return ((value - 1) * LEVELS_PER_CHAPTER) + 1


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, level_id, "Level ID")
	if display_name.strip_edges().is_empty():
		errors.append("Level display name is required.")
	ContentId.append_duplicate_or_invalid_ids(errors, level_tags, "Level tags")
	ContentId.append_duplicate_or_invalid_ids(errors, encounter_ids, "Level encounter IDs")
	ContentId.append_duplicate_or_invalid_ids(errors, granted_feature_ids, "Level granted feature IDs")
	ContentId.append_if_invalid(errors, runtime_driver_id, "Level runtime driver ID")
	if encounter_ids.is_empty():
		errors.append("Level must contain at least one encounter ID.")
	ContentId.append_if_invalid(errors, entry_encounter_id, "Level entry encounter ID")
	if not entry_encounter_id.is_empty() and not encounter_ids.has(String(entry_encounter_id)):
		errors.append("Level entry encounter must be present in encounter_ids.")
	# Draft slots intentionally validate before a runtime map is authored. Only
	# CAMPAIGN_READY (and runnable sandbox content) may claim playability.
	if content_status != ContentStatus.CAMPAIGN_DRAFT and level_scene == null:
		errors.append("Level scene is required.")
	if content_status != ContentStatus.CAMPAIGN_DRAFT and layout_data_path.strip_edges().is_empty():
		errors.append("Level layout data path is required.")
	elif not layout_data_path.strip_edges().is_empty() and not FileAccess.file_exists(layout_data_path):
		errors.append("Level layout data path does not exist: %s" % layout_data_path)
	if unlock_requirements == null:
		errors.append("Level unlock requirements resource is required, even when empty.")
	else:
		for child_error: String in unlock_requirements.get_validation_errors():
			errors.append("unlock_requirements: %s" % child_error)
		if unlock_requirements.prerequisite_level_ids.has(String(level_id)):
			errors.append("Level cannot depend on itself.")
	var has_reward := not completion_reward_bundle_id.is_empty()
	var has_transaction := not completion_transaction_id.is_empty()
	if has_reward != has_transaction:
		errors.append("Level completion reward and transaction IDs must be configured together.")
	if has_reward:
		ContentId.append_if_invalid(errors, completion_reward_bundle_id, "Level completion reward ID")
		ContentId.append_if_invalid_transaction_key(errors, completion_transaction_id, "Level completion transaction ID")
	if recommended_mastery < 0:
		errors.append("Recommended mastery cannot be negative.")

	match content_status:
		ContentStatus.SANDBOX:
			if campaign_slot != 0 or chapter_number != 0 or chapter_level_number != 0:
				errors.append("SANDBOX level must use zero campaign/chapter placement.")
		ContentStatus.CAMPAIGN_DRAFT, ContentStatus.CAMPAIGN_READY:
			if not is_valid_campaign_slot(campaign_slot):
				errors.append("Campaign level must use a campaign slot from 1 to %d." % CAMPAIGN_LEVEL_CAPACITY)
			else:
				var expected_chapter := get_chapter_for_campaign_slot(campaign_slot)
				var expected_chapter_level := get_chapter_level_for_campaign_slot(campaign_slot)
				if chapter_number != expected_chapter or chapter_level_number != expected_chapter_level:
					errors.append(
					"Campaign slot %d requires chapter %d level %d metadata." % [
						campaign_slot,
						expected_chapter,
						expected_chapter_level,
					]
				)
		_:
			errors.append("Level content status is not supported.")
	return errors


func is_campaign_level() -> bool:
	return content_status == ContentStatus.CAMPAIGN_DRAFT or content_status == ContentStatus.CAMPAIGN_READY


func is_campaign_ready() -> bool:
	return content_status == ContentStatus.CAMPAIGN_READY


func resolved_average_enemy_level() -> int:
	if average_enemy_level > 0:
		return average_enemy_level
	return maxi(1, campaign_slot) * 5
