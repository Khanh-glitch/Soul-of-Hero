extends SceneTree

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(640, 360)
	var scene := load("res://game/main.tscn") as PackedScene
	var game := scene.instantiate() as Node2D
	root.add_child(game)
	await process_frame
	await physics_frame
	var knight := get_first_node_in_group(&"player")
	_expect(knight != null, "production Knight is available")
	if knight == null:
		_finish(game)
		return
	knight.set_physics_process(false)
	_expect(
		bool(knight.call(&"configure_soul_team_from_run", {
			"active_hero": "sword_hero",
			"reserve_souls": ["archer_hero"],
		})),
		"two-Hero team configures",
	)
	var initial := knight.call(&"get_hero_health_snapshot") as Dictionary
	_expect(
		int(initial.active_current) == int(initial.active_maximum)
			and int(initial.reserve_current) == int(initial.reserve_maximum),
		"both Heroes start with their own full HP pool",
	)

	knight.set("health", maxi(1, roundi(float(knight.get("max_health")) * 0.5)))
	knight.call(&"_emit_health")
	var outgoing_health := int(knight.get("health"))
	var manager := knight.call(&"get_hero_soul_manager") as Node
	_expect(bool(manager.call(&"force_relay_after_hero_defeat")), "forced transfer can select the living reserve")
	var after_relay := knight.call(&"get_hero_health_snapshot") as Dictionary
	_expect(
		int(after_relay.active_current) == int(after_relay.active_maximum),
		"incoming Hero keeps its independent full HP",
	)
	_expect(
		int(after_relay.reserve_current) == outgoing_health,
		"outgoing Hero keeps its damaged HP as the reserve Soul",
	)
	knight.call(&"_tick_timers", 1.0)
	var after_regen := knight.call(&"get_hero_health_snapshot") as Dictionary
	var expected_regen := mini(
		int(after_regen.reserve_maximum),
		roundi(float(outgoing_health) + float(after_regen.reserve_maximum) * 0.10),
	)
	_expect(
		int(after_regen.reserve_current) == expected_regen,
		"reserve Soul regenerates ten percent maximum HP each second",
	)

	knight.set("current_action", "")
	knight.set("dash_cooldown_remaining", 0.0)
	knight.set("mana", knight.get("max_mana"))
	knight.set("stamina", 37.0)
	var mana_before := float(knight.get("mana"))
	var stamina_before := float(knight.get("stamina"))
	_expect(bool(knight.call(&"request_action", "dash")), "Dash remains usable through its public route")
	_expect(is_equal_approx(mana_before - float(knight.get("mana")), 11.0), "Dash spends half its former 22 cost as 11 mana")
	_expect(is_equal_approx(stamina_before, float(knight.get("stamina"))), "Dash no longer consumes stamina")
	knight.call(&"_finish_action")

	var active_hero := manager.get("active_hero") as HeroDefinition
	var reserve_hero := manager.get("reserve_soul") as HeroDefinition
	var active_key := String(active_hero.hero_id)
	var reserve_key := String(reserve_hero.hero_id)
	knight.set("_hero_health_current", {
		active_key: 1.0,
		reserve_key: 0.0,
	})
	knight.set("health", 1)
	knight.set("invulnerability_remaining", 0.0)
	_expect(bool(knight.call(&"take_resolved_damage", 2)), "last living Hero accepts lethal damage")
	await create_timer(1.8).timeout
	_expect(bool(knight.get("dead")) and int(knight.get("health")) == 0, "both empty pools end the run without checkpoint resurrection")
	_finish(game)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish(game: Node) -> void:
	paused = false
	if is_instance_valid(game):
		game.queue_free()
	if _failures.is_empty():
		print("HERO HEALTH POOL RUNTIME TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("HERO HEALTH POOL FAIL: " + failure)
		print("HERO HEALTH POOL RUNTIME TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)
