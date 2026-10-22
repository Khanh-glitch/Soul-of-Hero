@tool
class_name CampaignNarrativePhaseDefinition
extends Resource

## Story/party contract spanning one or more campaign slots. This is not a map
## definition and never fabricates LevelDefinition entries.

enum PartyRule {
	NARRATIVE_ONLY,
	REQUIRE_FEATURED_HEROES,
}

@export_category("Identity")
@export var phase_id: StringName
@export var implementation_status := CampaignMilestoneDefinition.ImplementationStatus.FUTURE
@export_multiline var status_note := ""

@export_category("Campaign range")
@export_range(1, LevelDefinition.CAMPAIGN_LEVEL_CAPACITY, 1) var start_campaign_slot := 1
@export_range(1, LevelDefinition.CAMPAIGN_LEVEL_CAPACITY, 1) var end_campaign_slot := 1

@export_category("Story party")
@export var party_rule := PartyRule.NARRATIVE_ONLY
@export var featured_hero_ids: PackedStringArray
@export var required_feature_ids: PackedStringArray
@export_multiline var narrative_goal := ""


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, phase_id, "Campaign narrative phase ID")
	ContentId.append_duplicate_or_invalid_ids(errors, featured_hero_ids, "Featured Hero IDs")
	ContentId.append_duplicate_or_invalid_ids(errors, required_feature_ids, "Narrative phase feature IDs")
	if not LevelDefinition.is_valid_campaign_slot(start_campaign_slot) or not LevelDefinition.is_valid_campaign_slot(end_campaign_slot):
		errors.append("Campaign narrative phase range must stay within slots 1-%d." % LevelDefinition.CAMPAIGN_LEVEL_CAPACITY)
	if end_campaign_slot < start_campaign_slot:
		errors.append("Campaign narrative phase end slot cannot precede its start slot.")
	if implementation_status not in CampaignMilestoneDefinition.ImplementationStatus.values():
		errors.append("Campaign narrative phase implementation status is unsupported.")
	if party_rule not in PartyRule.values():
		errors.append("Campaign narrative phase party rule is unsupported.")
	if party_rule == PartyRule.REQUIRE_FEATURED_HEROES and featured_hero_ids.size() < 2:
		errors.append("A required story party must feature at least two Heroes.")
	if status_note.strip_edges().is_empty():
		errors.append("Campaign narrative phase status note is required.")
	if narrative_goal.strip_edges().is_empty():
		errors.append("Campaign narrative phase goal is required.")
	return errors


func contains_campaign_slot(campaign_slot: int) -> bool:
	return campaign_slot >= start_campaign_slot and campaign_slot <= end_campaign_slot


func is_playable_now() -> bool:
	return implementation_status == CampaignMilestoneDefinition.ImplementationStatus.PLAYABLE
