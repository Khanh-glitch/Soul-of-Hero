@tool
class_name CampaignProgressionPlan
extends Resource

## Roadmap authority for recruitment milestones and multi-level narrative phases.
## Playable level/enemy authority remains in LevelRegistry; keeping these two
## catalogs separate prevents future story decisions from appearing launchable.

const CURRENT_SCHEMA_VERSION := 1

@export var plan_id: StringName = &"soul_hero_campaign_progression"
@export var schema_version := CURRENT_SCHEMA_VERSION
@export var milestones: Array[CampaignMilestoneDefinition] = []
@export var narrative_phases: Array[CampaignNarrativePhaseDefinition] = []

var _milestone_by_id: Dictionary = {}
var _indices_ready := false


func rebuild_index() -> void:
	_milestone_by_id.clear()
	for milestone: CampaignMilestoneDefinition in milestones:
		if milestone != null and not _milestone_by_id.has(milestone.milestone_id):
			_milestone_by_id[milestone.milestone_id] = milestone
	_indices_ready = true


func find_milestone(milestone_id: StringName) -> CampaignMilestoneDefinition:
	_ensure_indices()
	return _milestone_by_id.get(milestone_id) as CampaignMilestoneDefinition


func get_milestones_for_slot(campaign_slot: int) -> Array[CampaignMilestoneDefinition]:
	var result: Array[CampaignMilestoneDefinition] = []
	for milestone: CampaignMilestoneDefinition in milestones:
		if milestone != null and milestone.campaign_slot == campaign_slot:
			result.append(milestone)
	return result


func find_narrative_phase(campaign_slot: int) -> CampaignNarrativePhaseDefinition:
	for phase: CampaignNarrativePhaseDefinition in narrative_phases:
		if phase != null and phase.contains_campaign_slot(campaign_slot):
			return phase
	return null


func get_validation_errors() -> PackedStringArray:
	rebuild_index()
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, plan_id, "Campaign progression plan ID")
	if schema_version != CURRENT_SCHEMA_VERSION:
		errors.append("Campaign progression plan schema_version must be %d." % CURRENT_SCHEMA_VERSION)
	var milestone_ids := {}
	var transaction_ids := {}
	for index: int in milestones.size():
		var milestone := milestones[index]
		if milestone == null:
			errors.append("milestones[%d] cannot be null." % index)
			continue
		for child_error: String in milestone.get_validation_errors():
			errors.append("milestones[%d]: %s" % [index, child_error])
		if milestone_ids.has(milestone.milestone_id):
			errors.append("Duplicate campaign milestone ID '%s'." % milestone.milestone_id)
		else:
			milestone_ids[milestone.milestone_id] = true
		if transaction_ids.has(milestone.reward_transaction_id):
			errors.append("Duplicate campaign milestone transaction ID '%s'." % milestone.reward_transaction_id)
		else:
			transaction_ids[milestone.reward_transaction_id] = true
	_validate_phases(errors)
	return errors


func _validate_phases(errors: PackedStringArray) -> void:
	var phase_ids := {}
	for index: int in narrative_phases.size():
		var phase := narrative_phases[index]
		if phase == null:
			errors.append("narrative_phases[%d] cannot be null." % index)
			continue
		for child_error: String in phase.get_validation_errors():
			errors.append("narrative_phases[%d]: %s" % [index, child_error])
		if phase_ids.has(phase.phase_id):
			errors.append("Duplicate campaign narrative phase ID '%s'." % phase.phase_id)
		else:
			phase_ids[phase.phase_id] = true
		for featured_hero: String in phase.featured_hero_ids:
			if featured_hero == "sword_hero":
				continue
			if not _has_hero_recruitment_by_slot(StringName(featured_hero), phase.start_campaign_slot):
				errors.append("Narrative phase '%s' features Hero '%s' before a recruitment milestone grants it." % [phase.phase_id, featured_hero])
		for feature_id: String in phase.required_feature_ids:
			if not _has_feature_grant_by_slot(StringName(feature_id), phase.start_campaign_slot):
				errors.append("Narrative phase '%s' requires feature '%s' before a milestone grants it." % [phase.phase_id, feature_id])


func _has_hero_recruitment_by_slot(hero_id: StringName, campaign_slot: int) -> bool:
	for milestone: CampaignMilestoneDefinition in milestones:
		if milestone != null and milestone.recruited_hero_id == hero_id and milestone.campaign_slot <= campaign_slot:
			return true
	return false


func _has_feature_grant_by_slot(feature_id: StringName, campaign_slot: int) -> bool:
	for milestone: CampaignMilestoneDefinition in milestones:
		if milestone != null and milestone.campaign_slot <= campaign_slot and milestone.granted_feature_ids.has(String(feature_id)):
			return true
	return false


func _ensure_indices() -> void:
	if not _indices_ready:
		rebuild_index()
