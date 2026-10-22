extends Node

## Real gameplay verification for the first two-Hero route. This test catches
## the former seam where AppFlow carried an Axe reserve in its payload but Main
## silently initialized a Sword-only Knight.

class DummyEnemy extends Node2D:
	var health := 500
	var stagger_received := 0.0

	func take_damage(amount: int, _source_position: Vector2) -> void:
		health = maxi(0, health - amount)

	func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
		stagger_received += amount


var _game: Node2D
var _checks := 0
var _failures: Array[String] = []


func start(game: Node2D) -> void:
	_game = game
	_run.call_deferred()


func _run() -> void:
	await get_tree().physics_frame
	var knight := get_tree().get_first_node_in_group(&"player") as KnightController
	_expect(knight != null, "live Knight exists for the Soul Team route")
	if knight == null:
		_finish()
		return
	_expect(
		knight.configure_soul_team_from_run({
			"active_hero": "sword_hero",
			"reserve_souls": ["axe_hero", ""],
			"capacity": 2,
		}),
		"production Sword/Axe run snapshot configures the live Knight",
	)
	var heroes := knight.get_hero_soul_manager()
	var weapons := knight.get_weapon_manager()
	_expect(
		heroes.active_hero != null and heroes.active_hero.hero_id == &"sword_hero"
			and heroes.reserve_soul != null and heroes.reserve_soul.hero_id == &"axe_hero",
		"Sword is active and Axe is the actual reserve Soul",
	)
	_expect(
		weapons.get_hand_weapon() != null and weapons.get_hand_weapon().weapon_id == &"sword"
			and weapons.get_spirit_weapon(0) != null and weapons.get_spirit_weapon(0).weapon_id == &"axe",
		"Hero Team synchronizes to the real Sword/Axe combat loadout",
	)

	var target := DummyEnemy.new()
	target.add_to_group(&"enemies")
	_game.add_child(target)
	target.global_position = knight.global_position + Vector2(38.0, 0.0)
	var health_before_drop := target.health
	_expect(
		heroes.update_crowd_pressure(3, true, target),
		"three nearby hostiles make reserve Axe ready through Crowd Pressure",
	)
	_expect(heroes.request_soul_relay(), "first Relay press summons reserve Axe")
	await get_tree().process_frame
	_expect(
		_find_effect(_game, &"AxeReaperDropEffect") != null,
		"Axe summon creates the visible Reaper Drop runtime effect",
	)
	await _physics_frames(29)
	_expect(target.health < health_before_drop, "Reaper Drop confirms real area damage")
	_expect(target.stagger_received > 0.0, "Reaper Drop confirms real stagger")
	_expect(heroes.takeover_open, "Axe authored takeover window opens during Reaper Drop")
	_expect(heroes.request_soul_relay(), "second Relay press takes control of Axe")
	await get_tree().process_frame
	_expect(
		heroes.active_hero.hero_id == &"axe_hero" and heroes.reserve_soul.hero_id == &"sword_hero",
		"successful Relay swaps live Active and Reserve identities",
	)
	_expect(
		weapons.get_hand_weapon().weapon_id == &"axe"
			and weapons.get_spirit_weapon(0).weapon_id == &"sword"
			and knight.get_active_character_form_id() == &"axe_warrior_rpg",
		"Relay equips Axe combat and its existing complete character form",
	)

	for threat_index: int in 3:
		heroes.register_melee_threat(
			StringName("axe_route_sword_ready_%d" % threat_index),
			target,
			knight,
			target.global_position,
			100.0,
		)
	var sword_summon := heroes.get_state_snapshot()
	_expect(
		heroes.state == HeroSoulManager.RelayState.SUMMONING
			and heroes.takeover_open
			and String(sword_summon.get("summon_context", "")) == "melee_threat_trigger",
		"third real threat automatically materializes Sword in its full one-Q takeover window",
	)
	_expect(heroes.request_soul_relay(), "one Q during triggered Soul Interception returns control to Sword")
	await get_tree().process_frame
	var orbit_effect := _find_effect(_game, &"AxeLastOrbitEffect") as AxeLastOrbitEffect
	_expect(
		orbit_effect != null,
		"outgoing Axe creates the visible Last Orbit departure effect",
	)
	_expect(
		heroes.active_hero.hero_id == &"sword_hero"
			and weapons.get_hand_weapon().weapon_id == &"sword"
			and knight.get_active_character_form_id() == &"free_knight",
		"completed return Relay restores Sword identity, weapon and form",
	)
	if orbit_effect != null:
		orbit_effect.call(&"_process", 0.8)
	await get_tree().process_frame
	_expect(_find_effect(_game, &"AxeLastOrbitEffect") == null, "Last Orbit completes and cleans itself up")
	target.queue_free()
	_finish()


func _find_effect(root_node: Node, class_id: StringName) -> Node:
	for child: Node in root_node.get_children():
		if (
			(class_id == &"AxeReaperDropEffect" and child is AxeReaperDropEffect)
			or (class_id == &"AxeLastOrbitEffect" and child is AxeLastOrbitEffect)
		):
			return child
		var nested := _find_effect(child, class_id)
		if nested != null:
			return nested
	return null


func _physics_frames(count: int) -> void:
	for _frame: int in count:
		await get_tree().physics_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("AXE SOUL TEAM RUNTIME FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("AXE SOUL TEAM RUNTIME PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("AXE SOUL TEAM RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
