extends SceneTree

const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ARCHER: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")
const DUMMY: HeroDefinition = preload("res://game/heroes/data/relay_test_dummy.tres")
const KNIGHT_ANIMATIONS := preload("res://game/characters/knight/knight_animation_library.gd")

class FakePlayer:
	extends Node2D
	var summon_calls := 0
	var relay_calls := 0
	var support_finished := 0
	var last_incoming: StringName
	var last_outgoing: StringName

	func begin_soul_summon(incoming: HeroDefinition, _attacker: Node) -> Vector2:
		summon_calls += 1
		last_incoming = incoming.hero_id
		return Vector2(88.0, 44.0)

	func complete_soul_relay(incoming: HeroDefinition, outgoing: HeroDefinition, destination: Vector2) -> bool:
		relay_calls += 1
		last_incoming = incoming.hero_id
		last_outgoing = outgoing.hero_id
		global_position = destination
		return true

	func finish_soul_support(_incoming: HeroDefinition) -> void:
		support_finished += 1


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(SWORD.validate().is_empty(), "Sword Hero definition validates")
	_expect(SWORD.production_ready and not SWORD.debug_only, "Sword is production content")
	_expect(SWORD.combo_step_count() == 4, "Sword owns exactly four normal combo steps")
	_expect(SWORD.combo_damage(1) == 20 and SWORD.combo_damage(3) == 24, "Sword data applies 100/100/120 percent damage")
	_expect(SWORD.combo_damage(4) == 40 and SWORD.combo_damage(4, true) == 28, "Pursuit execution has full and lower fallback damage")
	_expect(SWORD.active_skill_enabled and SWORD.active_skill_name == "Cường Hóa Linh Hồn", "the persistent enhancement is the approved enabled Active Skill")
	_expect(is_equal_approx(SWORD.active_skill_cooldown_seconds, 10.0), "enhancement cancellation cooldown is data-driven at 10 seconds")
	_expect(SWORD.soul_echo_damage_ratios.size() == 4 and SWORD.soul_echo_delays.size() == 4, "Soul Echo exposes per-step ratios and delays")
	var sword_frames: SpriteFrames = KNIGHT_ANIMATIONS.build()
	var expected_frame_counts := [4, 6, 10, 10]
	for step: int in 4:
		var animation_name := StringName("sword_combo_%d" % (step + 1))
		_expect(sword_frames.has_animation(animation_name), "Combo %d has a dedicated authored animation" % (step + 1))
		_expect(sword_frames.get_frame_count(animation_name) == expected_frame_counts[step], "Combo %d loads its fixed frame count" % (step + 1))
	_expect(SWORD.combo_animation_names == [&"sword_combo_1", &"sword_combo_2", &"sword_combo_3", &"sword_combo_4"], "Sword data cannot fall back to locomotion animation names")
	_expect(SWORD.sword_wave_scene != null and SWORD.sword_wave_distance >= 150.0, "Crescent Recoil owns a configured travelling sword wave")
	_expect(SWORD.combo_3_recoil_distance >= 48.0, "Crescent Recoil moves Sword substantially farther backward")
	_expect(DUMMY.debug_only and not DUMMY.production_ready, "Relay Test Dummy cannot become release content")

	var player := FakePlayer.new()
	root.add_child(player)
	player.global_position = Vector2.ZERO
	var attacker := Node2D.new()
	root.add_child(attacker)
	attacker.global_position = Vector2(24.0, 0.0)
	var stranger := Node2D.new()
	root.add_child(stranger)

	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	_expect(manager.configure_team(player, DUMMY, SWORD), "debug team configures one Active and one Reserve Soul")
	_expect(not manager.register_melee_threat(&"wrong_target", attacker, stranger, attacker.global_position, 100.0), "threat aimed at another target gives no readiness")
	_expect(not manager.register_melee_threat(&"too_far", attacker, player, Vector2(400, 0), 500.0), "threat outside Sword radius gives no readiness")
	_expect(manager.register_melee_threat(&"attack_1", attacker, player, attacker.global_position, 100.0), "first unique nearby melee threat counts")
	_expect(not manager.register_melee_threat(&"attack_1", attacker, player, attacker.global_position, 100.0), "same attack instance is deduplicated")
	_expect(manager.register_melee_threat(&"attack_2", attacker, player, attacker.global_position, 100.0), "second unique threat counts")
	_expect(manager.register_melee_threat(&"attack_3", attacker, player, attacker.global_position, 100.0), "third unique threat triggers Sword Soul Interception")
	var threat_snapshot := manager.get_state_snapshot()
	_expect(
		manager.state == HeroSoulManager.RelayState.SUMMONING
			and manager.takeover_open
			and String(threat_snapshot.summon_context) == "melee_threat_trigger"
			and player.summon_calls == 1,
		"Sword materializes from its trigger and exposes a full one-Q visual window"
	)
	_expect(manager.request_soul_relay(), "one Q while the triggered Sword is visible completes Relay")
	_expect(manager.active_hero == SWORD and manager.reserve_soul == DUMMY, "Relay atomically exchanges Active Hero and Reserve Soul")
	_expect(player.relay_calls == 1 and player.last_outgoing == &"relay_test_dummy", "Departure ownership belongs to the replaced Hero")
	_expect(manager.support_cooldown_left <= 0.0, "successful Relay never applies unused-support cooldown")

	_expect(manager.configure_team(player, DUMMY, SWORD), "team can reset for support-only scenario")
	_ready_sword(manager, player, attacker, 10)
	_expect(manager.state == HeroSoulManager.RelayState.SUMMONING, "support-only summon starts automatically on the third threat")
	manager.call("_process", SWORD.summon_duration_seconds + 0.01)
	_expect(manager.state == HeroSoulManager.RelayState.SUPPORT_COOLDOWN, "unused completed support starts cooldown")
	_expect(is_equal_approx(manager.support_cooldown_left, 10.0), "Sword unused-support cooldown is exactly 10 seconds")
	_expect(not manager.register_melee_threat(&"cooldown_threat", attacker, player, attacker.global_position, 100.0), "cooldown blocks readiness accrual")
	manager.call("_process", 10.01)
	_expect(manager.state == HeroSoulManager.RelayState.IDLE, "support cooldown returns to idle")

	_ready_sword(manager, player, attacker, 20)
	_expect(
		manager.state == HeroSoulManager.RelayState.SUMMONING and manager.takeover_open,
		"a later valid trigger creates a fresh visible Sword opportunity"
	)
	_expect(manager.request_soul_relay(), "the refreshed Sword opportunity remains a one-Q takeover")

	_expect(manager.configure_team(player, DUMMY, ARCHER), "Archer can be equipped as the Reserve for a Dash opportunity")
	var dash_origin := Vector2(144.0, 72.0)
	var finished_before_dash := player.support_finished
	_expect(
		manager.begin_archer_dash_relay_opportunity(dash_origin, 2.0),
		"confirmed Bow Dash starts the contextual Archer support window"
	)
	_expect(
		manager.state == HeroSoulManager.RelayState.SUMMONING
			and manager.takeover_open
			and manager.summon_position == dash_origin,
		"Dash opportunity opens takeover immediately at the exact Dash origin"
	)
	var dash_snapshot := manager.get_state_snapshot()
	_expect(
		String(dash_snapshot.summon_context) == "archer_dash"
			and is_equal_approx(float(dash_snapshot.summon_duration), 2.0),
		"Dash opportunity publishes its two-second Archer context"
	)
	manager.call("_process", 1.99)
	_expect(manager.state == HeroSoulManager.RelayState.SUMMONING and manager.takeover_open, "Archer remains takeable for the full two-second window")
	manager.call("_process", 0.02)
	_expect(
		manager.state == HeroSoulManager.RelayState.IDLE
			and manager.support_cooldown_left <= 0.0
			and player.support_finished == finished_before_dash + 1,
		"unused Dash opportunity expires cleanly without an extra support cooldown"
	)

	_expect(manager.configure_team(player, DUMMY, ARCHER), "Dash Relay scenario resets the Hero team")
	var takeover_origin := Vector2(-36.0, 18.0)
	_expect(manager.begin_archer_dash_relay_opportunity(takeover_origin, 2.0), "second Dash opens another Archer opportunity")
	_expect(manager.request_soul_relay(), "Q anywhere in the Dash window takes control of Archer")
	_expect(
		manager.active_hero == ARCHER
			and manager.reserve_soul == DUMMY
			and player.global_position == takeover_origin,
		"Dash takeover swaps Hero identity and lands at the standing Archer"
	)

	manager.queue_free()
	player.queue_free()
	attacker.queue_free()
	stranger.queue_free()
	if _failures.is_empty():
		print("SOUL RELAY TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("SOUL RELAY TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _ready_sword(manager: HeroSoulManager, player: Node2D, attacker: Node2D, serial: int) -> void:
	for offset: int in SWORD.melee_threats_required:
		manager.register_melee_threat(
			StringName("ready_%d_%d" % [serial, offset]),
			attacker,
			player,
			attacker.global_position,
			100.0
		)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
