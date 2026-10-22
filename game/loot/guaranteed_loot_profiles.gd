class_name GuaranteedLootProfiles
extends RefCounted

## Data-driven providers for authored guaranteed drops. LootDirector only knows
## the profile ID stored on a world source; each provider owns its payload and
## deterministic reward rules.

const ARCHER_RULES := preload("res://game/loot/archer_soul_drop_rules.gd")
const WIZARD_RULES := preload("res://game/loot/wizard_soul_drop_rules.gd")

const LEVEL_5_ARCHER_SOUL := &"level_5_archer_soul"
const LEVEL_20_WIZARD_SOUL := &"level_20_wizard_soul"


static func build_payload(
		profile_id: StringName,
		run_context: Dictionary,
		save_snapshot: Dictionary,
) -> Dictionary:
	match profile_id:
		LEVEL_5_ARCHER_SOUL:
			return ARCHER_RULES.build_guaranteed_payload(run_context, save_snapshot)
		LEVEL_20_WIZARD_SOUL:
			return WIZARD_RULES.build_guaranteed_payload(run_context, save_snapshot)
	return {}
