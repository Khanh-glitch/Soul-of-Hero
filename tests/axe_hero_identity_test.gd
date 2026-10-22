extends SceneTree

const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const AXE_WEAPON: WeaponDefinition = preload("res://game/weapons/data/axe.tres")
const CHARGE_MATH := preload("res://game/weapons/axe_charge_math.gd")

class FakePlayer:
	extends Node2D
	var departures: Array[StringName] = []

	func begin_soul_summon(_incoming: HeroDefinition, attacker: Node) -> Vector2:
		return attacker.global_position if is_instance_valid(attacker) and attacker is Node2D else global_position

	func complete_soul_relay(incoming: HeroDefinition, outgoing: HeroDefinition, destination: Vector2) -> bool:
		departures.append(outgoing.departure_behavior_id)
		global_position = destination
		return true


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(AXE.validate().is_empty(), "Axe production Hero definition validates")
	_expect(AXE.production_ready and AXE.minimum_rarity == 1 and AXE.affinity == "Warrior", "Axe is a Magic-minimum Warrior Identity")
	_expect(AXE.primary_weapon == AXE_WEAPON, "Axe Hero binds the canonical Axe WeaponDefinition")
	_expect(AXE.combo_names.is_empty() and AXE.active_skill_name.is_empty(), "Axe Hero no longer authors a second combo or active-skill number set")
	var attack := AXE.resolved_normal_attack()
	var skill := AXE.resolved_active_skill()
	_expect(attack == AXE_WEAPON.normal_attack and AXE.combo_step_count() == 1 and AXE.combo_damage(1) == 30, "Hero-facing normal attack resolves to the one live 30-damage Heavy Cleave")
	var quick := CHARGE_MATH.evaluate(attack, 0.0)
	var full := CHARGE_MATH.evaluate(attack, attack.maximum_charge_seconds)
	_expect(int(quick.damage) == 30 and int(full.damage) == 60 and is_equal_approx(attack.maximum_charge_seconds, 1.15), "resolved Axe charge preserves the live 30-to-60 damage over 1.15 seconds")
	_expect(skill == AXE_WEAPON.hand_skill and AXE.resolved_active_skill_behavior_id() == &"throw_and_recall", "Throw & Recall behavior resolves from the canonical Weapon skill")
	_expect(is_equal_approx(AXE.resolved_active_skill_cooldown_seconds(), 6.5) and is_equal_approx(AXE.resolved_active_skill_mana_cost(), 24.0), "resolved Throw uses the live 6.5-second cooldown and 24 Mana cost")
	_expect(is_equal_approx(skill.cross_hit_stagger_bonus, 28.0) and skill.stop_outbound_on_world, "Cross Cut resolves to 28 stagger and the live world-stop rule without phantom bonus damage")
	var variant := AXE.duplicate(true) as HeroDefinition
	var variant_weapon := AXE_WEAPON.duplicate(true) as WeaponDefinition
	var variant_skill := AXE_WEAPON.hand_skill.duplicate(true) as WeaponSkillProfile
	variant_weapon.hand_skill = variant_skill
	variant.primary_weapon = variant_weapon
	variant_skill.cooldown_seconds = 7.25
	variant_skill.mana_cost = 31.0
	_expect(is_equal_approx(variant.resolved_active_skill_cooldown_seconds(), 7.25) and is_equal_approx(variant.resolved_active_skill_mana_cost(), 31.0), "one Weapon skill mutation reaches every Hero-facing resolved accessor")
	_expect(is_equal_approx(AXE.resolved_active_skill_cooldown_seconds(), 6.5) and is_equal_approx(AXE.resolved_active_skill_mana_cost(), 24.0), "authority mutation fixture cannot alter the production Axe resource")
	_expect(AXE.ready_condition_behavior_id == &"crowd_pressure" and AXE.crowd_hostiles_required == 3, "Crowd Pressure requires three hostiles")
	_expect(AXE.summon_behavior_id == &"reaper_drop" and AXE.takeover_windows.size() == 3, "Reaper Drop exposes early, mid, and late takeover windows")
	_expect(AXE.departure_behavior_id == &"last_orbit" and is_equal_approx(AXE.unused_support_cooldown_seconds, 12.0), "Last Orbit and 12-second no-Relay cooldown are authored")

	var player := FakePlayer.new()
	root.add_child(player)
	var attacker := Node2D.new()
	root.add_child(attacker)
	attacker.global_position = Vector2(60.0, 0.0)
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	_expect(manager.configure_team(player, SWORD, AXE), "Sword Active and Axe Reserve configure as production Heroes")
	_expect(not manager.register_melee_threat(&"wrong_readiness", attacker, player, attacker.global_position, 100.0), "legacy melee receipts cannot ready Crowd Pressure")
	_expect(not manager.update_crowd_pressure(3, false, attacker), "three passive hostiles do not satisfy Crowd Pressure")
	_expect(manager.update_crowd_pressure(3, true, attacker), "three hostiles including an active threat ready Axe")
	_expect(manager.request_soul_relay(), "Axe begins Reaper Drop at the densest-cluster seam")
	manager.call("_process", 0.16)
	_expect(manager.request_soul_relay(), "Sword to Axe Relay succeeds in the early Reaper Drop window")
	_expect(manager.active_hero == AXE and manager.reserve_soul == SWORD and player.departures[-1] == &"returning_blade", "Sword departs with Returning Blade after Sword to Axe")

	for index: int in SWORD.melee_threats_required:
		manager.register_melee_threat(StringName("return_%d" % index), attacker, player, attacker.global_position, 100.0)
	var sword_summon := manager.get_state_snapshot()
	_expect(
		manager.state == HeroSoulManager.RelayState.SUMMONING
			and manager.takeover_open
			and String(sword_summon.get("summon_context", "")) == "melee_threat_trigger",
		"Sword's third melee threat automatically starts Soul Interception and its one-Q takeover window",
	)
	_expect(manager.request_soul_relay(), "one Q during triggered Soul Interception completes Axe to Sword Relay")
	_expect(manager.active_hero == SWORD and manager.reserve_soul == AXE and player.departures[-1] == &"last_orbit", "Axe departs with Last Orbit after Axe to Sword")

	if _failures.is_empty():
		print("AXE HERO IDENTITY TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("AXE HERO IDENTITY TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
