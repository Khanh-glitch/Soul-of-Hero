class_name KNightRules
extends RefCounted

## Single authoritative design contract for K-Night. UI, item projection and
## runtime read these values instead of maintaining separate descriptions.

const HERO_ID := &"sword_hero"
const DISPLAY_NAME := "K-Night"
const TITLE := "Chiến Binh Âm Giới"

const RARITY_IDS: Array[StringName] = [
	&"normal", &"magic", &"rare", &"epic",
	&"legendary", &"crystal", &"mythic", &"eternal",
]
const RARITY_NAMES := [
	"Thường", "Phép thuật", "Hiếm", "Sử thi",
	"Huyền thoại", "Kim cương", "Thần thánh", "Bất tử",
]
const RARITY_COLORS := [
	Color("e8edf2"), Color("4f8dff"), Color("ffd84a"), Color("a96cff"),
	Color("ff8a32"), Color("38c8ff"), Color("ed4b55"), Color("35e5a1"),
]

const COMBO_WINDOW_SECONDS := 2.0
const COMBO_DAMAGE_RATIOS := [1.0, 1.2, 0.5, 1.0]
const COMBO_TWO_SLOW_RATIO := 0.30
const COMBO_TWO_SLOW_SECONDS := 1.0
const COMBO_FOUR_MISSING_HEALTH_RATIO := 0.80

const AFTERIMAGE_COUNTS := [1, 1, 2, 2, 3]
const AFTERIMAGE_TOTAL_RATIOS := [0.50, 0.75, 1.00, 1.20, 1.50]
const AFTERIMAGE_PER_ECHO_RATIOS := [0.50, 0.75, 0.50, 0.60, 0.50]
const AFTERIMAGE_DURATIONS := [3.0, 4.0, 5.0, 6.0, 7.0]
const AFTERIMAGE_COOLDOWNS := [8.0, 8.0, 6.0, 6.0, 5.0]
const AFTERIMAGE_MANA_COSTS := [16.0, 18.0, 20.0, 22.0, 24.0]
const AFTERIMAGE_INTERVAL_SECONDS := 0.10
const AFTERIMAGE_COLORS := [
	Color(1.0, 0.99, 0.96, 0.72),
	Color(0.025, 0.02, 0.035, 0.78),
	Color(0.72, 0.025, 0.035, 0.82),
]

# Quick, low-friction replacement for the former three-second charge skill.
const SOUL_CLEAVE_DAMAGE_RATIOS := [1.30, 1.55, 1.80, 2.05, 2.30]
const SOUL_CLEAVE_MANA_COSTS := [14.0, 15.0, 16.0, 17.0, 18.0]
const SOUL_CLEAVE_COOLDOWNS := [7.0, 7.0, 6.0, 6.0, 5.0]
const SOUL_CLEAVE_STUN_SECONDS := [0.15, 0.20, 0.25, 0.30, 0.35]
const SOUL_CLEAVE_HEAL_RATIOS := [0.08, 0.10, 0.12, 0.14, 0.16]
const SOUL_CLEAVE_HEAL_CAP_MAX_HP_RATIO := 0.08
const SOUL_CLEAVE_CONE_DEGREES := 150.0
const SOUL_CLEAVE_RANGE := 72.0

const VOID_PHANTOM_MANA_BONUS := 10.0
const VOID_PHANTOM_COOLDOWN_BONUS := 3.0
const VOID_PHANTOM_TARGETING_VIEW_RATIO := 1.0 / 3.0

const LEGION_RIDER_COUNTS := [5, 7, 9, 12, 15]
const LEGION_TOTAL_DAMAGE_RATIOS := [6.0, 7.0, 8.0, 9.0, 10.0]
const LEGION_MANA_COSTS := [32.0, 34.0, 36.0, 38.0, 40.0]
const LEGION_COOLDOWNS := [10.0, 9.0, 8.0, 7.0, 7.0]
const LEGION_DAMAGE_TICKS := 10
const LEGION_TICK_SECONDS := 0.20
const LEGION_MAX_CONTACT_SECONDS := 2.0
const LEGION_MAX_WALL_STUN_SECONDS := 5.0

const SOUL_GUARDIAN_PHANTOM_COUNTS := [1, 2, 3, 4, 5]
const SOUL_GUARDIAN_RELEASE_INTERVAL := 0.40
const SOUL_GUARDIAN_PUSH_VIEW_RATIO := 1.0 / 3.0
const SOUL_GUARDIAN_COOLDOWN := 20.0
const SOUL_GUARDIAN_DURATION := 5.0

const REVENGE_DAMAGE_RATIOS := [3.0, 4.0, 5.0]
const REVENGE_MISSING_HEALTH_RATIOS := [0.40, 0.45, 0.50]
const REVENGE_DAMAGE_WINDOW_SECONDS := 10.0
const REVENGE_RIDER_STUN_SECONDS := 0.50
const REVENGE_DURATION := 5.0
const REVENGE_COOLDOWN := 30.0

const FINAL_BREATH_DAMAGE_PER_MISSING_HP := 1.0
const VENGEFUL_SOUL_DURATION := 5.0
const VENGEFUL_SOUL_ATTACK_SPEED_MULTIPLIER := 3.0
const VENGEFUL_SOUL_POWER_RATIO := 1.0


static func clamp_skill_rank(rank: int) -> int:
	return clampi(rank, 1, 5)


static func is_legendary_plus(rarity: int) -> bool:
	return rarity >= 5


static func soul_rank_for_rarity(rarity: int) -> int:
	return clampi(rarity - 4, 1, 3) if is_legendary_plus(rarity) \
		else clampi(rarity + 1, 1, 5)


static func rarity_name(rarity: int) -> String:
	return RARITY_NAMES[clampi(rarity, 0, RARITY_NAMES.size() - 1)]


static func rarity_color(rarity: int) -> Color:
	return RARITY_COLORS[clampi(rarity, 0, RARITY_COLORS.size() - 1)]


static func afterimage_profile(rank: int, remote_approach := false) -> Dictionary:
	var index := clamp_skill_rank(rank) - 1
	return {
		"id": &"k_night_void_phantom" if remote_approach else &"k_night_warrior_soul",
		"name": "Hư Ảnh" if remote_approach else "Linh Hồn Chiến Binh",
		"aim": "self",
		"skill_rank": index + 1,
		"afterimage_count": AFTERIMAGE_COUNTS[index],
		"afterimage_total_ratio": AFTERIMAGE_TOTAL_RATIOS[index],
		"afterimage_ratio": AFTERIMAGE_PER_ECHO_RATIOS[index],
		"afterimage_interval": AFTERIMAGE_INTERVAL_SECONDS,
		"duration": AFTERIMAGE_DURATIONS[index],
		"mana": AFTERIMAGE_MANA_COSTS[index] + (
			VOID_PHANTOM_MANA_BONUS if remote_approach else 0.0
		),
		"cooldown": AFTERIMAGE_COOLDOWNS[index] + (
			VOID_PHANTOM_COOLDOWN_BONUS if remote_approach else 0.0
		),
		"cooldown_anchor": "effect_end",
		"remote_approach": remote_approach,
		"targeting_view_ratio": VOID_PHANTOM_TARGETING_VIEW_RATIO,
		"exact_rank_scaling": true,
	}


static func soul_cleave_profile(rank: int) -> Dictionary:
	var index := clamp_skill_rank(rank) - 1
	return {
		"id": &"k_night_soul_cleave",
		"name": "Đoạt Hồn Trảm",
		"description": "Chém bán nguyệt tức thời, làm khựng mục tiêu và hồi một phần sát thương đã gây.",
		"aim": "cone",
		"skill_rank": index + 1,
		"damage_ratio": SOUL_CLEAVE_DAMAGE_RATIOS[index],
		"mana": SOUL_CLEAVE_MANA_COSTS[index],
		"cooldown": SOUL_CLEAVE_COOLDOWNS[index],
		"stun": SOUL_CLEAVE_STUN_SECONDS[index],
		"heal_ratio": SOUL_CLEAVE_HEAL_RATIOS[index],
		"heal_cap_max_hp_ratio": SOUL_CLEAVE_HEAL_CAP_MAX_HP_RATIO,
		"range": SOUL_CLEAVE_RANGE,
		"cone_degrees": SOUL_CLEAVE_CONE_DEGREES,
		"exact_rank_scaling": true,
	}


static func legion_profile(rank: int) -> Dictionary:
	var index := clamp_skill_rank(rank) - 1
	return {
		"id": &"k_night_underworld_legion",
		"name": "Binh Đoàn Âm Giới",
		"aim": "line",
		"skill_rank": index + 1,
		"rider_count": LEGION_RIDER_COUNTS[index],
		"damage_ratio": LEGION_TOTAL_DAMAGE_RATIOS[index],
		"damage_ticks": LEGION_DAMAGE_TICKS,
		"tick_seconds": LEGION_TICK_SECONDS,
		"mana": LEGION_MANA_COSTS[index],
		"cooldown": LEGION_COOLDOWNS[index],
		"range": 12000.0,
		"width": 108.0 + float(index) * 12.0,
		"exact_rank_scaling": true,
	}


static func skill_profile(skill_id: StringName, rank: int) -> Dictionary:
	match skill_id:
		&"k_night_warrior_soul":
			return afterimage_profile(rank, false)
		&"k_night_soul_cleave":
			return soul_cleave_profile(rank)
		&"k_night_void_phantom":
			return afterimage_profile(rank, true)
		&"k_night_underworld_legion":
			return legion_profile(rank)
	return {}


static func wall_stun_seconds(contact_seconds: float) -> float:
	var normalized := clampf(
		contact_seconds / LEGION_MAX_CONTACT_SECONDS,
		0.0,
		1.0
	)
	return LEGION_MAX_WALL_STUN_SECONDS * (1.0 - normalized)


static func execution_damage(base_damage: int, current_hp: float, maximum_hp: float) -> int:
	var missing := maxf(0.0, maximum_hp - maxf(0.0, current_hp))
	return maxi(1, base_damage + roundi(missing * COMBO_FOUR_MISSING_HEALTH_RATIO))


static func revenge_damage(
		received_from_target: float,
		missing_health: float,
		legendary_rank: int,
) -> int:
	var index := clampi(legendary_rank, 1, 3) - 1
	return maxi(0, roundi(
		maxf(0.0, received_from_target) * REVENGE_DAMAGE_RATIOS[index]
		+ maxf(0.0, missing_health) * REVENGE_MISSING_HEALTH_RATIOS[index]
	))
