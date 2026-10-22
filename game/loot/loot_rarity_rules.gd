class_name LootRarityRules
extends RefCounted

## Deterministic rarity and jackpot rules shared by enemies, chests and their
## physical drops. Difficulty is passed in as data so this file stays testable
## and does not become another gameplay authority.

const IDS := [
	"normal", "magic", "rare", "epic", "legendary", "crystal", "mythic", "eternal",
]
const BASE_WORLD_WEIGHTS := [
	70.0, 20.0, 7.0, 2.25, 0.48, 0.09, 0.018, 0.0015,
]
const BASE_DROP_WEIGHTS := [
	59.0, 24.0, 10.0, 4.0, 1.35, 0.38, 0.085, 0.012,
]


static func normalize(value: Variant) -> StringName:
	if value is int or value is float:
		return StringName(IDS[clampi(int(value), 0, IDS.size() - 1)])
	var normalized := String(value).strip_edges().to_lower().replace(" ", "_")
	if normalized == "common":
		normalized = "normal"
	elif normalized == "uncommon":
		normalized = "magic"
	return StringName(normalized if normalized in IDS else "normal")


static func rarity_index(value: Variant) -> int:
	return maxi(0, IDS.find(String(normalize(value))))


static func roll_world_rarity(
		seed: int,
		minimum_rarity: Variant = &"normal",
		difficulty_modifiers: Dictionary = {},
		is_chest := false
) -> StringName:
	var luck := maxf(0.25, float(difficulty_modifiers.get("luck", 1.0)))
	var rare_multiplier := maxf(
		0.25,
		float(difficulty_modifiers.get(
			"rare_chest_chance" if is_chest else "rare_drop_chance",
			1.0
		))
	)
	return _roll_from_weights(
		seed,
		BASE_WORLD_WEIGHTS,
		rarity_index(minimum_rarity),
		luck,
		rare_multiplier
	)


static func roll_drop_rarity(
		seed: int,
		source_rarity: Variant,
		difficulty_modifiers: Dictionary = {}
) -> StringName:
	var source_index := rarity_index(source_rarity)
	var luck := maxf(0.25, float(difficulty_modifiers.get("luck", 1.0)))
	var rare_multiplier := maxf(
		0.25,
		float(difficulty_modifiers.get("rare_drop_chance", 1.0))
	)
	# A source's rarity is a genuine reward floor: spotting a Rare enemy or
	# chest always matters, while luck still controls how often it upgrades.
	return _roll_from_weights(
		seed,
		BASE_DROP_WEIGHTS,
		source_index,
		luck,
		rare_multiplier
	)


static func enemy_drop_chance(
		source_rarity: Variant,
		difficulty_modifiers: Dictionary,
		role: StringName = &"standard"
) -> float:
	var base := 0.34
	match role:
		&"elite":
			base = 0.74
		&"miniboss":
			base = 1.0
		&"boss":
			base = 1.0
	var rarity_bonus := 0.055 * float(rarity_index(source_rarity))
	var luck := clampf(float(difficulty_modifiers.get("luck", 1.0)), 0.25, 3.0)
	return clampf((base + rarity_bonus) * (0.72 + luck * 0.28), 0.0, 1.0)


static func jackpot_chance(
		source_kind: StringName,
		source_rarity: Variant,
		difficulty_modifiers: Dictionary = {}
) -> float:
	var base := 0.025
	if source_kind == &"chest":
		base = 0.12
	elif source_kind == &"boss":
		base = 0.20
	elif source_kind == &"miniboss":
		base = 0.10
	var rarity_bonus := 0.035 * float(rarity_index(source_rarity))
	var luck := clampf(float(difficulty_modifiers.get("luck", 1.0)), 0.25, 3.0)
	return clampf((base + rarity_bonus) * luck, 0.0, 0.92)


static func is_jackpot(
		seed: int,
		source_kind: StringName,
		source_rarity: Variant,
		difficulty_modifiers: Dictionary = {}
) -> bool:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	return rng.randf() < jackpot_chance(source_kind, source_rarity, difficulty_modifiers)


static func _roll_from_weights(
		seed: int,
		weights: Array,
		minimum_index: int,
		luck: float,
		rare_multiplier: float
) -> StringName:
	var floor_index := clampi(minimum_index, 0, IDS.size() - 1)
	var adjusted := PackedFloat32Array()
	adjusted.resize(IDS.size())
	var total := 0.0
	for index: int in IDS.size():
		if index < floor_index:
			adjusted[index] = 0.0
			continue
		var tier_distance := float(index - floor_index)
		var weight := float(weights[index])
		# Luck progressively favours upper tiers without making Normal/Magic
		# disappear. The explicit rare multiplier begins at Rare.
		weight *= pow(luck, tier_distance * 0.72)
		if index >= 2:
			weight *= rare_multiplier
		adjusted[index] = maxf(0.0, weight)
		total += adjusted[index]
	if total <= 0.0:
		return StringName(IDS[floor_index])
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var cursor := rng.randf() * total
	for index: int in IDS.size():
		cursor -= adjusted[index]
		if cursor <= 0.0:
			return StringName(IDS[index])
	return StringName(IDS[IDS.size() - 1])
