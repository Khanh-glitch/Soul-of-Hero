class_name HeroSkillCombatRules
extends RefCounted

## Pure live-combat interpretation of the six per-Hero skill tracks persisted
## by SaveService. PlayerProgressionRules owns allocation validity and the
## rank-20 cap; this class owns the one deterministic meaning of each rank.
##
## The curves are deliberately linear and readable during the first campaign:
## every rank changes a real number, while Soul Ready gains its discrete
## threshold breaks at ranks 10 and 20 in addition to a per-rank ready window.

const PROGRESSION_RULES := preload("res://game/meta/progression/player_progression_rules.gd")

const NORMAL_DAMAGE_PERCENT_PER_RANK := 2.5
const ACTIVE_DAMAGE_PERCENT_PER_RANK := 3.0
const ACTIVE_COOLDOWN_RECOVERY_PERCENT_PER_RANK := 1.5
const DASH_COOLDOWN_RECOVERY_PERCENT_PER_RANK := 1.25
const DASH_DISTANCE_PERCENT_PER_RANK := 1.5
const DASH_INVULNERABILITY_PERCENT_PER_RANK := 0.75
const READY_WINDOW_PERCENT_PER_RANK := 2.5
const READY_RADIUS_PERCENT_PER_RANK := 1.0
const READY_THRESHOLD_RANK_STEP := 10
const SUMMON_DAMAGE_PERCENT_PER_RANK := 3.0
const DEPARTURE_DAMAGE_PERCENT_PER_RANK := 3.0


static func snapshot_from_save(save_snapshot: Dictionary, hero_id: StringName) -> Dictionary:
	var resolution := resolve_skill_allocations(save_snapshot)
	var allocations: Dictionary = resolution.get("allocations", {})
	var tracks_value: Variant = allocations.get(String(hero_id), allocations.get(hero_id, {}))
	var tracks := tracks_value as Dictionary if tracks_value is Dictionary else {}
	var snapshot := snapshot_from_ranks(hero_id, tracks)
	snapshot["player_level"] = int(resolution.get("player_level", 1))
	snapshot["resolution_issues"] = (resolution.get("issues", PackedStringArray()) as PackedStringArray).duplicate()
	return snapshot


static func snapshot_from_ranks(hero_id: StringName, track_ranks: Dictionary) -> Dictionary:
	var ranks := PROGRESSION_RULES.empty_skill_tracks()
	for track_id: StringName in PROGRESSION_RULES.SKILL_TRACK_IDS:
		var raw_rank: Variant = track_ranks.get(track_id, track_ranks.get(String(track_id), 0))
		var rank := int(raw_rank) if raw_rank is int else 0
		ranks[String(track_id)] = clampi(rank, 0, PROGRESSION_RULES.SKILL_RANK_CAP)

	var normal_rank := int(ranks[String(PROGRESSION_RULES.SKILL_TRACK_NORMAL_ATTACK)])
	var active_rank := int(ranks[String(PROGRESSION_RULES.SKILL_TRACK_ACTIVE_SKILL)])
	var dash_rank := int(ranks[String(PROGRESSION_RULES.SKILL_TRACK_DASH)])
	var ready_rank := int(ranks[String(PROGRESSION_RULES.SKILL_TRACK_SOUL_READY_CONDITION)])
	var summon_rank := int(ranks[String(PROGRESSION_RULES.SKILL_TRACK_SUMMON_SKILL)])
	var departure_rank := int(ranks[String(PROGRESSION_RULES.SKILL_TRACK_DEPARTURE_SKILL)])
	return {
		"hero_id": String(hero_id),
		"ranks": ranks,
		"normal_attack_damage_multiplier": _bonus_multiplier(normal_rank, NORMAL_DAMAGE_PERCENT_PER_RANK),
		"active_skill_damage_multiplier": _bonus_multiplier(active_rank, ACTIVE_DAMAGE_PERCENT_PER_RANK),
		"active_skill_cooldown_multiplier": _recovery_multiplier(active_rank, ACTIVE_COOLDOWN_RECOVERY_PERCENT_PER_RANK),
		"dash_cooldown_multiplier": _recovery_multiplier(dash_rank, DASH_COOLDOWN_RECOVERY_PERCENT_PER_RANK),
		"dash_distance_multiplier": _bonus_multiplier(dash_rank, DASH_DISTANCE_PERCENT_PER_RANK),
		"dash_invulnerability_multiplier": _bonus_multiplier(dash_rank, DASH_INVULNERABILITY_PERCENT_PER_RANK),
		"soul_ready_requirement_reduction": ready_rank / READY_THRESHOLD_RANK_STEP,
		"soul_ready_window_multiplier": _bonus_multiplier(ready_rank, READY_WINDOW_PERCENT_PER_RANK),
		"soul_ready_radius_multiplier": _bonus_multiplier(ready_rank, READY_RADIUS_PERCENT_PER_RANK),
		"summon_skill_damage_multiplier": _bonus_multiplier(summon_rank, SUMMON_DAMAGE_PERCENT_PER_RANK),
		"departure_skill_damage_multiplier": _bonus_multiplier(departure_rank, DEPARTURE_DAMAGE_PERCENT_PER_RANK),
	}


static func action_damage_multiplier(skill_snapshot: Dictionary, action_track: StringName) -> float:
	match action_track:
		PROGRESSION_RULES.SKILL_TRACK_NORMAL_ATTACK:
			return float(skill_snapshot.get("normal_attack_damage_multiplier", 1.0))
		PROGRESSION_RULES.SKILL_TRACK_ACTIVE_SKILL, &"ultimate":
			return float(skill_snapshot.get("active_skill_damage_multiplier", 1.0))
		PROGRESSION_RULES.SKILL_TRACK_SUMMON_SKILL:
			return float(skill_snapshot.get("summon_skill_damage_multiplier", 1.0))
		PROGRESSION_RULES.SKILL_TRACK_DEPARTURE_SKILL:
			return float(skill_snapshot.get("departure_skill_damage_multiplier", 1.0))
	return 1.0


static func effective_ready_requirement(base_requirement: int, skill_snapshot: Dictionary) -> int:
	return maxi(1, base_requirement - int(skill_snapshot.get("soul_ready_requirement_reduction", 0)))


static func effective_ready_window(base_seconds: float, skill_snapshot: Dictionary) -> float:
	return maxf(0.01, base_seconds * float(skill_snapshot.get("soul_ready_window_multiplier", 1.0)))


static func effective_ready_radius(base_radius: float, skill_snapshot: Dictionary) -> float:
	return maxf(0.0, base_radius * float(skill_snapshot.get("soul_ready_radius_multiplier", 1.0)))


## Accepts the compact persisted SaveService document. Missing allocations are
## a legal all-rank-zero profile. Any malformed/overspent global allocation
## fails closed for every Hero so corrupt data can never grant combat power.
static func resolve_skill_allocations(save_snapshot: Dictionary) -> Dictionary:
	var issues := PackedStringArray()
	var player_level := 1
	var raw_allocations: Variant = {}
	var progression_value: Variant = save_snapshot.get("progression", {})
	if progression_value is Dictionary:
		var player_value: Variant = (progression_value as Dictionary).get("player", {})
		if player_value is Dictionary:
			player_level = maxi(1, int((player_value as Dictionary).get("level", 1)))
			raw_allocations = (player_value as Dictionary).get("skill_allocations", {})
		else:
			issues.append("Save snapshot progression.player must be a Dictionary.")
	else:
		issues.append("Save snapshot progression must be a Dictionary.")

	if not raw_allocations is Dictionary:
		issues.append("Save snapshot skill_allocations must be a Dictionary.")
		return {"player_level": player_level, "allocations": {}, "issues": issues}
	var allocations := (raw_allocations as Dictionary).duplicate(true)
	if not PROGRESSION_RULES.validate_skill_allocations(player_level, allocations):
		issues.append("Persisted Hero skill allocation is invalid for player level %d." % player_level)
		allocations.clear()
	return {"player_level": player_level, "allocations": allocations, "issues": issues}


static func _bonus_multiplier(rank: int, percent_per_rank: float) -> float:
	return 1.0 + float(clampi(rank, 0, PROGRESSION_RULES.SKILL_RANK_CAP)) * percent_per_rank / 100.0


static func _recovery_multiplier(rank: int, percent_per_rank: float) -> float:
	return maxf(0.05, 1.0 - float(clampi(rank, 0, PROGRESSION_RULES.SKILL_RANK_CAP)) * percent_per_rank / 100.0)
