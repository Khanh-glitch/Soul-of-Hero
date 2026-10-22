extends SceneTree

const LevelRosterDefinition = preload("res://game/content/rosters/level_roster_definition.gd")
const LevelRosterEntry = preload("res://game/content/rosters/level_roster_entry.gd")
const RosterCampDefinition = preload("res://game/content/rosters/roster_camp_definition.gd")
const RosterCampMember = preload("res://game/content/rosters/roster_camp_member.gd")
const LevelRosterResolver = preload("res://game/content/rosters/level_roster_resolver.gd")
const EliteEnemyApplicator = preload("res://game/characters/enemies/elite_enemy_applicator.gd")
const REGISTRY = preload("res://data/content/registries/campaign_content_registry.tres")
const TRIPLE_ELITE = preload("res://data/content/elite_modifiers/triple_stat_elite.tres")
const ENEMY_RARITY_PRESENTATION := preload(
	"res://game/characters/enemies/enemy_rarity_presentation.gd"
)
const SKELETON_SCENE: PackedScene = preload("res://game/characters/enemies/skeleton_enemy.tscn")
const REAPER_SCENE: PackedScene = preload("res://game/characters/enemies/skeleton_reaper.tscn")
const REPORT_PATH := "res://.artifacts/level_roster_report.json"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred(&"_run")


func _run() -> void:
	_test_campaign_capacity()
	_test_authored_rosters()
	_test_elite_resolution()
	_test_invalid_allocation()
	_test_runtime_elite_application()
	_finish()


func _test_campaign_capacity() -> void:
	_expect(LevelRosterDefinition.CAMPAIGN_LEVEL_CAPACITY == 100, "level rosters share the one hundred-slot campaign capacity")
	var roster := LevelRosterDefinition.new()
	roster.roster_id = &"chapter_10_level_100_roster"
	roster.campaign_slot = 100
	var entry := LevelRosterEntry.new()
	entry.entry_id = &"final_enemy"
	entry.combatant_id = &"skeleton_swordsman"
	roster.entries = [entry]
	_expect(roster.get_validation_errors().is_empty(), "level roster validator accepts campaign slot 100")
	roster.campaign_slot = 101
	_expect(_has_error(roster.get_validation_errors(), "between 1 and 100"), "level roster validator rejects campaign slot 101")


func _test_authored_rosters() -> void:
	var errors := REGISTRY.get_validation_errors()
	_expect(errors.is_empty(), "campaign registry with ten Chapter 1 roster plans validates: %s" % "; ".join(errors))
	_expect(REGISTRY.get_ordered_campaign_rosters().size() == 10, "registry exposes all ten ordered Chapter 1 roster plans")
	var expected_counts := {
		1: {&"skeleton_swordsman": 12},
		2: {&"skeleton_swordsman": 15},
		3: {&"skeleton_swordsman": 15, &"bone_reaper": 5},
		4: {&"skeleton_swordsman": 10, &"bone_reaper": 5},
		5: {&"skeleton_swordsman": 10, &"bone_reaper": 5, &"blood_vampire": 1, &"hooded_archer_miniboss": 1},
	}
	for slot: int in expected_counts:
		var roster := REGISTRY.find_campaign_roster(slot)
		_expect(roster != null, "campaign slot %d resolves a roster" % slot)
		if roster == null:
			continue
		_expect(roster.authoring_status == LevelRosterDefinition.AuthoringStatus.DESIGN_LOCKED, "slot %d is design-locked until camps/map positions exist" % slot)
		var total := 0
		for combatant_id: StringName in expected_counts[slot]:
			var count: int = expected_counts[slot][combatant_id]
			total += count
			_expect(roster.get_count_for(combatant_id) == count, "slot %d count for %s is %d" % [slot, combatant_id, count])
		_expect(roster.get_total_count() == total, "slot %d exact stage total is %d" % [slot, total])

	var level_1 := REGISTRY.find_campaign_roster(1)
	_expect(level_1.elite_policy == null, "Level 1 has no elite roll")
	var level_2 := REGISTRY.find_campaign_roster(2)
	_expect(is_equal_approx(level_2.elite_policy.chance_per_camp, 0.2), "Level 2 elite chance is 20% per camp")
	var level_3 := REGISTRY.find_campaign_roster(3)
	_expect(is_equal_approx(level_3.elite_policy.chance_per_camp, 0.2), "Level 3 elite chance is 20% per camp")
	var level_4 := REGISTRY.find_campaign_roster(4)
	_expect(is_equal_approx(level_4.elite_policy.chance_per_camp, 0.4), "Level 4 elite chance is 40% per camp")
	var level_5 := REGISTRY.find_campaign_roster(5)
	_expect(is_equal_approx(level_5.elite_policy.chance_per_camp, 0.2), "Level 5 elite chance is 20% per camp")
	_expect(level_5.get_entry(&"vampire").unique and not level_5.get_entry(&"vampire").elite_eligible, "Level 5 Vampire is unique and excluded from elites")
	var archer_entry := level_5.get_entry(&"hooded_archer")
	_expect(archer_entry.combatant_kind == LevelRosterEntry.CombatantKind.ENEMY, "Hooded Archer resolves through its registered EnemyDefinition")
	_expect(archer_entry.unique and archer_entry.miniboss and not archer_entry.elite_eligible, "Archer is one unique miniboss excluded from elites")
	var elite_axes := TRIPLE_ELITE.get_combat_axes()
	_expect(
		is_equal_approx(float(elite_axes.get("health", 0.0)), 2.25)
			and is_equal_approx(float(elite_axes.get("damage", 0.0)), 1.35)
			and is_equal_approx(float(elite_axes.get("attack_rate", 0.0)), 1.15),
		"shared Elite authors durability, damage and cadence as separate pressure axes",
	)
	_expect(
		float(elite_axes.get("sustained_dps", 99.0)) < 2.0,
		"shared Elite cannot accidentally compose damage and cadence into 9x sustained DPS",
	)
	_expect(
		TRIPLE_ELITE.visual_scale_multiplier > 1.0
			and TRIPLE_ELITE.minimum_rarity == &"rare",
		"elite has a larger silhouette and an authored Rare presentation floor",
	)


func _test_elite_resolution() -> void:
	var level_2 := REGISTRY.find_campaign_roster(2)
	var level_2_camps: Array[RosterCampDefinition] = [
		_make_camp(&"camp_a", {&"skeleton_1": 5}),
		_make_camp(&"camp_b", {&"skeleton_1": 5}),
		_make_camp(&"camp_c", {&"skeleton_1": 5}),
	]
	var resolved_2 := LevelRosterResolver.resolve(level_2, level_2_camps, 20260715)
	_expect(resolved_2.is_valid(), "Level 2 camp allocation resolves")
	_expect(resolved_2.get_total_count() == 15 and resolved_2.count_units(&"skeleton_swordsman") == 15, "elite promotion preserves Level 2 exact count")
	_expect(resolved_2.count_elites(&"skeleton_swordsman") >= 1, "Level 2 guarantee produces at least one Skeleton 1 elite")
	var resolved_2_repeat := LevelRosterResolver.resolve(level_2, level_2_camps, 20260715)
	_expect(resolved_2.get_signature() == resolved_2_repeat.get_signature(), "same roster/camps/seed resolves deterministically")

	var level_3 := REGISTRY.find_campaign_roster(3)
	var level_3_camps: Array[RosterCampDefinition] = [
		_make_camp(&"camp_a", {&"skeleton_1": 5, &"skeleton_2": 2}),
		_make_camp(&"camp_b", {&"skeleton_1": 5, &"skeleton_2": 2}),
		_make_camp(&"camp_c", {&"skeleton_1": 5, &"skeleton_2": 1}),
	]
	var resolved_3 := LevelRosterResolver.resolve(level_3, level_3_camps, 7)
	_expect(resolved_3.is_valid(), "Level 3 mixed camps resolve")
	_expect(resolved_3.get_total_count() == 20, "Level 3 total remains 20 after elite replacement")
	_expect(resolved_3.count_elites(&"skeleton_swordsman") >= 1, "Level 3 guarantees Skeleton 1 elite")
	_expect(resolved_3.count_elites(&"bone_reaper") >= 1, "Level 3 guarantees Skeleton 2 elite")

	var level_4 := REGISTRY.find_campaign_roster(4)
	_expect(is_equal_approx(level_4.elite_policy.chance_per_camp, 0.4), "Level 4 resolver consumes the authored 40% policy")

	var level_5 := REGISTRY.find_campaign_roster(5)
	var level_5_camps: Array[RosterCampDefinition] = [
		_make_camp(&"camp_a", {&"skeleton_1": 4, &"skeleton_2": 2}),
		_make_camp(&"camp_b", {&"skeleton_1": 3, &"skeleton_2": 2, &"vampire": 1}),
		_make_camp(&"camp_c", {&"skeleton_1": 3, &"skeleton_2": 1}),
		_make_camp(&"boss", {&"hooded_archer": 1}),
	]
	var resolved_5 := LevelRosterResolver.resolve(level_5, level_5_camps, 99)
	_expect(resolved_5.is_valid() and resolved_5.get_total_count() == 17, "Level 5 resolves all 17 units")
	_expect(resolved_5.count_elites(&"skeleton_swordsman") >= 1 and resolved_5.count_elites(&"bone_reaper") >= 1, "Level 5 guarantees one elite of each eligible Skeleton type")
	_expect(resolved_5.count_elites(&"blood_vampire") == 0, "Level 5 Vampire never becomes elite")
	_expect(resolved_5.count_elites(&"hooded_archer_miniboss") == 0, "Hooded Archer never receives a second elite promotion")


func _test_invalid_allocation() -> void:
	var roster := REGISTRY.find_campaign_roster(2)
	var wrong_camps: Array[RosterCampDefinition] = [_make_camp(&"camp_a", {&"skeleton_1": 14})]
	var resolution := LevelRosterResolver.resolve(roster, wrong_camps, 1)
	_expect(not resolution.is_valid() and _has_error(resolution.errors, "requires 15"), "resolver rejects camps that silently drop an authored unit")


func _test_runtime_elite_application() -> void:
	var skeleton := SKELETON_SCENE.instantiate() as Node2D
	root.add_child(skeleton)
	var sprite := skeleton.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
	var base_sprite_scale := sprite.scale
	_expect(EliteEnemyApplicator.apply_to(skeleton, TRIPLE_ELITE), "elite modifier applies to Skeleton 1 runtime")
	_expect(int(skeleton.get("max_health")) == roundi(70.0 * TRIPLE_ELITE.health_multiplier) and int(skeleton.get("health")) == int(skeleton.get("max_health")), "Skeleton Elite applies only its authored health axis and refills")
	_expect(int(skeleton.get("contact_damage")) == roundi(14.0 * TRIPLE_ELITE.damage_multiplier), "Skeleton Elite applies only its authored damage axis")
	_expect(is_equal_approx(float(skeleton.get("chase_speed")), 58.0 * TRIPLE_ELITE.movement_multiplier), "Skeleton Elite applies only its authored movement axis")
	_expect(is_equal_approx(float(skeleton.get("attack_cooldown")), 0.85 / TRIPLE_ELITE.attack_rate_multiplier), "Skeleton Elite applies only its authored attack-rate axis")
	var applied_axes: Dictionary = skeleton.get_meta(&"elite_combat_axes", {})
	_expect(applied_axes == TRIPLE_ELITE.get_combat_axes(), "Skeleton Elite publishes its complete combat-axis snapshot")
	var expected_visual_scale := base_sprite_scale \
		* TRIPLE_ELITE.visual_scale_multiplier \
		* ENEMY_RARITY_PRESENTATION.scale_multiplier_for(TRIPLE_ELITE.minimum_rarity)
	_expect(sprite.scale.is_equal_approx(expected_visual_scale), "elite composes its body and rarity scale only on the visual sprite")
	_expect(skeleton.has_meta(&"elite_modifier_id") and skeleton.is_in_group(&"elite_enemies"), "elite runtime identity is queryable")
	_expect(
		skeleton.get_node_or_null("EliteAura") == null
			and skeleton.get_node_or_null("LootRarityAura") == null
			and sprite.material is ShaderMaterial
			and StringName(skeleton.get_meta(&"enemy_rarity_presented", &"")) == &"rare",
		"elite uses a Rare silhouette glow with no circular rear aura",
	)
	_expect(not EliteEnemyApplicator.apply_to(skeleton, TRIPLE_ELITE), "elite modifier cannot stack twice")
	skeleton.free()

	var reaper := REAPER_SCENE.instantiate() as Node2D
	root.add_child(reaper)
	_expect(EliteEnemyApplicator.apply_to(reaper, TRIPLE_ELITE), "elite modifier applies to Skeleton 2 runtime profile")
	var profile: Dictionary = reaper.get("_profile")
	_expect(int(profile.get("max_health", 0)) == roundi(86.0 * TRIPLE_ELITE.health_multiplier) and int(reaper.get("health")) == int(profile.get("max_health", 0)), "Skeleton 2 Elite applies its authored health axis")
	_expect(int(profile.get("damage", 0)) == roundi(14.0 * TRIPLE_ELITE.damage_multiplier), "Skeleton 2 Elite applies its authored projectile-damage axis")
	_expect(is_equal_approx(float(profile.get("cooldown", 0.0)), 2.1 / TRIPLE_ELITE.attack_rate_multiplier), "Skeleton 2 Elite applies its authored attack-rate axis")
	reaper.free()


func _make_camp(camp_id: StringName, allocations: Dictionary) -> RosterCampDefinition:
	var camp := RosterCampDefinition.new()
	camp.camp_id = camp_id
	for entry_id: StringName in allocations:
		var member := RosterCampMember.new()
		member.entry_id = entry_id
		member.count = int(allocations[entry_id])
		camp.members.append(member)
	return camp


func _has_error(errors: PackedStringArray, needle: String) -> bool:
	for error: String in errors:
		if error.contains(needle):
			return true
	return false


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)
		push_error("LEVEL ROSTER FAIL: %s" % label)


func _finish() -> void:
	var report := {"checks": _checks, "passed": _checks - _failures.size(), "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	print("LEVEL_ROSTER %d/%d" % [_checks - _failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
