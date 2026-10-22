class_name AxeChargeMath
extends RefCounted

## Pure, deterministic charge evaluation shared by runtime and tests. All
## balance originates in WeaponAttackProfile; this helper owns no tuning.


static func evaluate(profile: WeaponAttackProfile, held_seconds: float) -> Dictionary:
	if profile == null or not profile.charge_enabled or profile.combo_damage.is_empty():
		return {}
	var ratio := clampf(held_seconds / maxf(profile.maximum_charge_seconds, 0.001), 0.0, 1.0)
	var base_damage := profile.combo_damage[0]
	var base_stagger := profile.combo_stagger[0] if not profile.combo_stagger.is_empty() else 0.0
	return {
		"charge_seconds": maxf(0.0, held_seconds),
		"charge_ratio": ratio,
		"damage": roundi(base_damage * lerpf(
			profile.quick_release_damage_multiplier,
			profile.full_charge_damage_multiplier,
			ratio
		)),
		"arc_degrees": lerpf(
			profile.quick_release_arc_degrees,
			profile.full_charge_arc_degrees,
			ratio
		),
		"stagger": base_stagger * lerpf(1.0, profile.full_charge_stagger_multiplier, ratio),
		"knockback": profile.combo_knockback[0] if not profile.combo_knockback.is_empty() else 0.0,
	}
