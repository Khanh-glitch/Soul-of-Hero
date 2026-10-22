class_name HeroDefinition
extends Resource

## Immutable content contract for a playable Hero/Soul. Runtime state belongs to
## HeroSoulManager and the controlled character, never to this resource.

@export_category("Identity")
@export var hero_id: StringName
@export var display_name := ""
@export var title := ""
@export_multiline var role_summary := ""
## Empty by design until the authored narrative is uploaded. Presentation must
## render a reserved placeholder rather than inventing canon.
@export_multiline var lore := ""
@export var lore_pending := false
@export var production_ready := false
@export var debug_only := false
@export_enum("Normal:0", "Magic:1", "Rare:2", "Epic:3", "Legendary:4", "Crystal:5", "Mythic:6", "Eternal:7") var minimum_rarity := 0
@export_enum("Warrior", "Ranger", "Magician") var affinity := "Warrior"

@export_category("Hero base stats")
@export_range(1.0, 9999.0, 1.0) var base_max_hp := 100.0
@export_range(1.0, 999.0, 1.0) var base_power := 20.0
@export_range(0.0, 9999.0, 1.0) var base_max_mana := 100.0
@export_range(0.25, 3.0, 0.01) var base_move_speed_multiplier := 1.0

@export_category("Action authority")
## Optional canonical Hand-action source. Heroes that bind a primary weapon keep
## identity, progression, readiness and Relay data here, while normal/active Hand
## action numbers live only in the WeaponDefinition and its typed profiles.
@export var primary_weapon: WeaponDefinition

@export_category("Normal attack")
@export_range(1, 999, 1) var base_damage := 20
@export var combo_names: Array[String] = []
@export var combo_damage_multipliers: Array[float] = []
@export var combo_action_durations: Array[float] = []
@export var combo_hit_windows: Array[Vector2] = []
@export var combo_animation_names: Array[StringName] = []
@export_range(0.1, 10.0, 0.05) var combo_continuation_seconds := 2.0
@export var normal_attack_behavior_id: StringName = &"sword_combo"
@export var combo_pull_strengths: Array[float] = []
@export var combo_stagger_multipliers: Array[float] = []
@export_range(0.0, 5.0, 0.05) var final_charge_seconds := 0.0
@export_range(0.0, 2.0, 0.05) var final_charge_damage_bonus := 0.0
@export_range(0.0, 2.0, 0.05) var final_charge_area_bonus := 0.0
@export_range(0.0, 2.0, 0.05) var final_charge_stagger_bonus := 0.0
@export_range(0.0, 1.0, 0.05) var charge_move_speed_multiplier := 1.0
@export_range(0.0, 0.5, 0.01) var attack_buffer_seconds := 0.16
@export_range(0.1, 3.0, 0.05) var pursuit_fallback_multiplier := 1.4
@export_range(0.0, 120.0, 1.0) var combo_3_recoil_distance := 48.0
@export var sword_wave_scene: PackedScene
@export_range(40.0, 600.0, 1.0) var sword_wave_speed := 275.0
@export_range(16.0, 20000.0, 1.0) var sword_wave_distance := 150.0
@export_range(4.0, 96.0, 1.0) var sword_wave_width := 28.0
@export_range(0.0, 0.5, 0.01) var combo_4_dash_start_seconds := 0.12
@export_range(0.05, 0.6, 0.01) var combo_4_dash_duration_seconds := 0.30
@export_range(0.0, 100.0, 1.0) var combo_4_pass_distance := 30.0
@export_range(8.0, 160.0, 1.0) var combo_4_fallback_dash_distance := 60.0
@export_range(32.0, 400.0, 1.0) var combo_4_max_dash_distance := 240.0

@export_category("Archer spacing loop")
@export_range(1, 5, 1) var archer_focus_max := 2
@export_range(0.1, 20.0, 0.1) var archer_focus_timeout_seconds := 4.0
@export_range(0.0, 400.0, 1.0) var archer_focus_min_distance := 96.0
@export_range(0.0, 600.0, 1.0) var archer_focus_max_distance := 260.0
@export_range(0.0, 200.0, 1.0) var archer_close_pressure_radius := 72.0
@export_range(0.05, 3.0, 0.05) var archer_close_focus_decay_seconds := 0.45
@export_range(0.0, 120.0, 1.0) var archer_split_step_distance := 24.0
@export_range(0.05, 0.8, 0.01) var archer_split_step_duration := 0.16
@export var archer_projectile_speeds: Array[float] = []
@export var archer_projectile_ranges: Array[float] = []
@export var archer_projectile_widths: Array[float] = []
@export var archer_stagger_values: Array[float] = []
@export var archer_move_speed_multipliers: Array[float] = []
@export var archer_piercer_focus_damage_bonus: Array[int] = [0, 6, 12]
@export var archer_piercer_focus_target_caps: Array[int] = [1, 2, 4]

@export_category("Wizard control and Soul circuit")
## All Wizard values are authored as coefficients of the Hero's runtime Power.
## The component converts them to the normal CombatResolver input before applying
## the active Hero Soul / equipment / skill-track modifiers.
@export_range(0.0, 4.0, 0.01) var wizard_shade_damage_ratio := 0.15
@export_range(16.0, 600.0, 1.0) var wizard_shade_speed := 92.0
@export_range(0.1, 20.0, 0.1) var wizard_shade_lifetime_seconds := 10.0
@export_range(2.0, 96.0, 1.0) var wizard_shade_hit_radius := 10.0
@export_range(8.0, 256.0, 1.0) var wizard_shade_explosion_radius := 56.0
@export_range(1, 16, 1) var wizard_shade_target_cap := 6
@export_range(1, 12, 1) var wizard_shade_max_active := 4
@export_range(0.1, 30.0, 0.1) var wizard_dark_point_lifetime_seconds := 10.0
@export_range(1, 16, 1) var wizard_dark_point_maximum := 8
@export_range(0.1, 20.0, 0.1) var wizard_false_trail_lifetime_seconds := 6.0
@export_range(1, 6, 1) var wizard_rmb_chain_stacks := 3
@export_range(0.05, 5.0, 0.05) var wizard_rmb_internal_cooldown_seconds := 1.0
@export_range(0.1, 8.0, 0.1) var wizard_rmb_window_seconds := 2.0
@export_range(8.0, 320.0, 1.0) var wizard_rmb_radius := 72.0
@export_range(1, 16, 1) var wizard_rmb_target_cap := 6
@export var wizard_rmb_density_damage_ratios := PackedFloat32Array([0.0, 0.60, 0.75, 1.05, 1.50, 2.10, 2.85])
@export_range(0.0, 1.0, 0.01) var wizard_rmb_repeat_multiplier := 0.40
@export_range(0.1, 30.0, 0.1) var wizard_frenzy_seconds := 10.0
@export_range(1, 8, 1) var wizard_soul_icon_max := 5
@export_range(0.1, 6.0, 0.1) var wizard_soul_anchor_seconds_per_icon := 2.0
@export var wizard_soul_summon_damage_ratios := PackedFloat32Array([0.0, 0.60, 0.85, 1.15, 1.55, 2.10])
@export_range(0.1, 6.0, 0.1) var wizard_soul_summon_duration_seconds := 2.0
@export var wizard_departure_damage_ratios := PackedFloat32Array([0.70, 0.90, 1.15, 1.45, 1.80, 2.20])
@export_range(16.0, 320.0, 1.0) var wizard_departure_radius := 80.0
@export_range(16.0, 480.0, 1.0) var wizard_departure_point_radius := 160.0

@export_category("Permanent active skill")
@export var active_skill_enabled := false
@export var active_skill_name := ""
@export var active_skill_behavior_id: StringName = &"soul_echo"
@export_range(0.1, 60.0, 0.1) var active_skill_cooldown_seconds := 12.0
@export_range(0.0, 999.0, 0.5) var active_skill_mana_cost := 0.0
## Toggle enhancements pay this amount on each normal attack only while active.
@export_range(0.0, 999.0, 0.5) var active_skill_attack_mana_cost := 0.0
@export var active_skill_toggle_persistent := false
@export_range(0.1, 12.0, 0.1) var soul_echo_duration_seconds := 4.0
@export_range(40.0, 800.0, 1.0) var throw_outbound_speed := 340.0
@export_range(40.0, 800.0, 1.0) var throw_return_speed := 470.0
@export_range(0.1, 6.0, 0.1) var throw_automatic_recall_seconds := 1.4
@export_range(2.0, 96.0, 1.0) var throw_path_width := 14.0
@export_range(0.0, 2.0, 0.05) var cross_cut_bonus_ratio := 0.5
@export var throw_blocks_world_geometry := true
@export var soul_echo_damage_ratios: Array[float] = []
@export var soul_echo_delays: Array[float] = []
@export_range(8.0, 300.0, 1.0) var soul_echo_targeting_range := 128.0
@export_range(4.0, 80.0, 1.0) var soul_echo_safe_offset := 26.0
@export_range(4.0, 120.0, 1.0) var soul_echo_hitbox_reach := 38.0
@export_range(0.0, 60.0, 1.0) var soul_echo_slash_lunge_distance := 9.0
@export var soul_echo_scene: PackedScene
@export var soul_echo_wave_scene: PackedScene
@export var soul_echo_tint := Color(1.0, 0.99, 0.93, 0.72)
@export var soul_echo_trail_tint := Color(1.0, 1.0, 1.0, 0.32)
@export var soul_echo_anchor_vfx_id: StringName = &"echo_anchor"
@export var soul_echo_ribbon_vfx_id: StringName = &"echo_ribbon"
@export var soul_echo_pursuit_marker_vfx_id: StringName = &"pursuit_marker"
@export_range(40.0, 600.0, 1.0) var soul_echo_wave_speed := 260.0
@export_range(16.0, 300.0, 1.0) var soul_echo_wave_distance := 112.0
@export_range(4.0, 96.0, 1.0) var soul_echo_wave_width := 28.0
@export_range(0.0, 180.0, 1.0) var soul_echo_combo_2_angle_degrees := 38.0
@export_range(8.0, 120.0, 1.0) var soul_echo_combo_2_cross_distance := 46.0
@export_range(0.0, 100.0, 1.0) var soul_echo_recoil_distance := 22.0
@export_range(0.0, 180.0, 1.0) var soul_echo_execution_angle_degrees := 42.0
@export_range(8.0, 160.0, 1.0) var soul_echo_execution_distance := 58.0
@export_range(8.0, 160.0, 1.0) var soul_echo_fallback_distance := 48.0
@export_range(0.05, 1.0, 0.01) var soul_echo_slash_visual_seconds := 0.24
@export_range(0.05, 1.0, 0.01) var soul_echo_cross_visual_seconds := 0.26
@export_range(0.05, 1.0, 0.01) var soul_echo_recoil_visual_seconds := 0.28
@export_range(0.05, 1.0, 0.01) var soul_echo_execution_visual_seconds := 0.30
@export var soul_echo_activate_cue: StringName = &"soul_echo_activate"
@export var soul_echo_attack_cues: Array[StringName] = []
@export_range(40.0, 20000.0, 1.0) var archer_mark_target_range := 300.0
@export_range(1.0, 360.0, 1.0) var archer_mark_facing_cone_degrees := 150.0
@export_range(0.1, 12.0, 0.1) var archer_mark_duration_seconds := 4.0
@export_range(1, 999, 1) var archer_soul_line_damage := 44
@export_range(0.0, 200.0, 1.0) var archer_soul_line_stagger := 14.0
@export_range(40.0, 1200.0, 1.0) var archer_soul_line_speed := 640.0
@export_range(32.0, 20000.0, 1.0) var archer_soul_line_range := 360.0
@export_range(2.0, 64.0, 1.0) var archer_soul_line_width := 16.0
@export_range(1, 16, 1) var archer_soul_line_target_cap := 5

@export_category("Soul readiness")
@export var ready_condition_behavior_id: StringName = &"melee_threats"
@export_range(1, 20, 1) var melee_threats_required := 3
@export_range(16.0, 500.0, 1.0) var melee_threat_radius := 150.0
@export_range(0.1, 30.0, 0.1) var ready_lifetime_seconds := 6.0
@export_range(1, 20, 1) var crowd_hostiles_required := 3
@export_range(16.0, 500.0, 1.0) var crowd_pressure_radius := 150.0
@export var crowd_requires_active_threat := true
@export_range(0.1, 5.0, 0.05) var clear_shot_hold_seconds := 1.0
@export_range(16.0, 600.0, 1.0) var clear_shot_min_distance := 112.0
@export_range(16.0, 800.0, 1.0) var clear_shot_max_distance := 280.0

@export_category("Summon and Relay")
@export var summon_skill_name := ""
@export var summon_behavior_id: StringName
@export_range(0.1, 4.0, 0.01) var summon_duration_seconds := 1.0
@export var takeover_windows: Array[Vector2] = []
@export_range(0.0, 60.0, 0.1) var unused_support_cooldown_seconds := 10.0
@export var departure_skill_name := ""
@export var departure_behavior_id: StringName
@export_range(0.1, 4.0, 0.01) var departure_duration_seconds := 0.5
@export_range(1, 999, 1) var archer_summon_damage := 28
@export_range(0.0, 200.0, 1.0) var archer_summon_stagger := 18.0
@export_range(40.0, 1200.0, 1.0) var archer_summon_projectile_speed := 620.0
@export_range(32.0, 20000.0, 1.0) var archer_summon_range := 360.0
@export_range(2.0, 64.0, 1.0) var archer_summon_width := 14.0
@export_range(1, 16, 1) var archer_summon_target_cap := 6
@export_range(1, 9, 1) var archer_departure_projectile_count := 3
@export_range(0.0, 90.0, 1.0) var archer_departure_spread_degrees := 12.0
@export_range(1, 999, 1) var archer_departure_damage := 12
@export_range(0.0, 200.0, 1.0) var archer_departure_stagger := 8.0
@export_range(40.0, 1200.0, 1.0) var archer_departure_projectile_speed := 520.0
@export_range(32.0, 20000.0, 1.0) var archer_departure_range := 260.0
@export_range(1, 8, 1) var archer_departure_per_target_cap := 2

@export_category("Ultimate (R)")
@export var ultimate_name := ""
@export var ultimate_behavior_id: StringName
@export_range(0.0, 999.0, 0.5) var ultimate_mana_cost := 0.0
@export_range(0.0, 60.0, 0.1) var ultimate_cooldown_seconds := 0.0
## Zero means the ultimate owns a persistent state until the current stage ends.
@export_range(0.0, 60.0, 0.1) var ultimate_duration_seconds := 0.0
@export_range(0.0, 10.0, 0.05) var ultimate_power_multiplier := 1.0


func validate() -> PackedStringArray:
	var errors := PackedStringArray()
	if hero_id.is_empty():
		errors.append("hero_id is required")
	if display_name.strip_edges().is_empty():
		errors.append("display_name is required")
	if debug_only and production_ready:
		errors.append("debug_only content cannot be production_ready")
	if base_max_hp <= 0.0 or base_power <= 0.0 or base_max_mana < 0.0 \
			or base_move_speed_multiplier <= 0.0:
		errors.append("Hero base stats must be positive (Mana may be zero)")
	var uses_primary_weapon := primary_weapon != null
	if uses_primary_weapon:
		for weapon_error: String in primary_weapon.get_validation_errors():
			errors.append("primary weapon: %s" % weapon_error)
	else:
		var local_count := combo_names.size()
		if local_count <= 0:
			errors.append("at least one combo step is required")
		for values: Array in [
			combo_damage_multipliers,
			combo_action_durations,
			combo_hit_windows,
			combo_animation_names,
		]:
			if values.size() != local_count:
				errors.append("all combo arrays must have %d entries" % local_count)
		for index: int in combo_hit_windows.size():
			var window := combo_hit_windows[index]
			if window.x < 0.0 or window.y <= window.x:
				errors.append("combo hit window %d is invalid" % (index + 1))
	var count := combo_step_count()
	if active_skill_enabled:
		if resolved_active_skill_name().strip_edges().is_empty():
			errors.append("enabled active skill requires a name")
		if resolved_active_skill_behavior_id().is_empty():
			errors.append("enabled active skill requires a behavior id")
		if resolved_active_skill_mana_cost() <= 0.0:
			errors.append("enabled active skill requires a positive Mana cost")
	if active_skill_enabled and resolved_active_skill_behavior_id() == &"soul_echo":
		if soul_echo_damage_ratios.size() != count or soul_echo_delays.size() != count:
			errors.append("Soul Echo ratio/delay arrays must match combo step count")
		if soul_echo_attack_cues.size() != count:
			errors.append("Soul Echo cue array must match combo step count")
		if soul_echo_scene == null:
			errors.append("enabled Soul Echo requires an effect scene")
		if soul_echo_wave_scene == null:
			errors.append("enabled Soul Echo requires a wave scene")
		if soul_echo_anchor_vfx_id.is_empty() or soul_echo_ribbon_vfx_id.is_empty() or soul_echo_pursuit_marker_vfx_id.is_empty():
			errors.append("enabled Soul Echo requires anchor, ribbon, and pursuit-marker VFX ids")
	var has_ultimate := not ultimate_name.strip_edges().is_empty() \
		or not ultimate_behavior_id.is_empty()
	if has_ultimate and (ultimate_name.strip_edges().is_empty() or ultimate_behavior_id.is_empty()):
		errors.append("ultimate name and behavior must be authored together")
	if has_ultimate and ultimate_cooldown_seconds <= 0.0:
		errors.append("ultimate requires a positive cooldown")
	if ready_condition_behavior_id not in [&"melee_threats", &"crowd_pressure", &"clear_shot", &"wizard_soul_icons"]:
		errors.append("unsupported ready condition behavior")
	if not uses_primary_weapon and normal_attack_behavior_id == &"archer_focus_chain":
		for values: Array in [
			archer_projectile_speeds,
			archer_projectile_ranges,
			archer_projectile_widths,
			archer_stagger_values,
			archer_move_speed_multipliers,
		]:
			if values.size() != count:
				errors.append("Archer projectile/movement arrays must match combo step count")
				break
		if count != 3:
			errors.append("Archer Focus chain requires exactly three steps")
		if archer_focus_min_distance >= archer_focus_max_distance:
			errors.append("Archer Focus distance band is invalid")
		if archer_piercer_focus_damage_bonus.size() != archer_focus_max + 1 \
				or archer_piercer_focus_target_caps.size() != archer_focus_max + 1:
			errors.append("Archer Piercer Focus arrays must cover zero through maximum Focus")
	if ready_condition_behavior_id == &"clear_shot" and clear_shot_min_distance >= clear_shot_max_distance:
		errors.append("clear_shot distance band is invalid")
	if ready_condition_behavior_id == &"wizard_soul_icons":
		if wizard_rmb_density_damage_ratios.size() < 7:
			errors.append("Wizard RMB ratios must cover density zero through six")
		if wizard_soul_summon_damage_ratios.size() < wizard_soul_icon_max + 1:
			errors.append("Wizard Soul summon ratios must cover zero through icon maximum")
		if wizard_departure_damage_ratios.size() < wizard_soul_icon_max + 1:
			errors.append("Wizard departure ratios must cover zero through point maximum")
	if summon_skill_name.strip_edges().is_empty() or summon_behavior_id.is_empty():
		errors.append("summon skill and behavior are required")
	if departure_skill_name.strip_edges().is_empty() or departure_behavior_id.is_empty():
		errors.append("departure skill and behavior are required")
	for index: int in takeover_windows.size():
		var window := takeover_windows[index]
		if window.x < 0.0 or window.y <= window.x or window.y > summon_duration_seconds:
			errors.append("takeover window %d is outside summon duration" % (index + 1))
	return errors


func resolved_normal_attack() -> WeaponAttackProfile:
	return primary_weapon.normal_attack if primary_weapon != null else null


func resolved_active_skill() -> WeaponSkillProfile:
	return primary_weapon.hand_skill if primary_weapon != null else null


func resolved_active_skill_name() -> String:
	if primary_weapon != null:
		var skill := resolved_active_skill()
		return skill.display_name if skill != null else ""
	return active_skill_name


func resolved_active_skill_behavior_id() -> StringName:
	if primary_weapon != null:
		var skill := resolved_active_skill()
		return skill.behavior_id if skill != null else &""
	return active_skill_behavior_id


func resolved_active_skill_cooldown_seconds() -> float:
	if primary_weapon != null:
		var skill := resolved_active_skill()
		return skill.cooldown_seconds if skill != null else 0.0
	return active_skill_cooldown_seconds


func resolved_active_skill_mana_cost() -> float:
	if primary_weapon != null:
		var skill := resolved_active_skill()
		return skill.mana_cost if skill != null else 0.0
	return active_skill_mana_cost


func combo_step_count() -> int:
	var attack := resolved_normal_attack()
	if attack != null:
		return attack.combo_count
	return combo_names.size()


func combo_damage(step: int, use_pursuit_fallback := false) -> int:
	var attack := resolved_normal_attack()
	if attack != null:
		if attack.combo_damage.is_empty():
			return base_damage
		var attack_index := clampi(step - 1, 0, attack.combo_damage.size() - 1)
		return maxi(1, roundi(attack.combo_damage[attack_index]))
	if combo_damage_multipliers.is_empty():
		return base_damage
	var index := clampi(step - 1, 0, combo_damage_multipliers.size() - 1)
	var multiplier := combo_damage_multipliers[index]
	if use_pursuit_fallback and step == 4:
		multiplier = minf(multiplier, pursuit_fallback_multiplier)
	return maxi(1, roundi(float(base_damage) * multiplier))
