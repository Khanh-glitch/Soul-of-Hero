extends SceneTree

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(640, 360)
	# Load after autoload registration. Preloading Main while a --script test is
	# itself compiling resolves its dependency graph before singleton names exist.
	var game_scene := load("res://game/main.tscn") as PackedScene
	var game := game_scene.instantiate() as Node2D
	root.add_child(game)
	await process_frame
	await physics_frame

	var knight := get_first_node_in_group(&"player")
	var hud := game.get_node_or_null("HUD") as CanvasLayer
	_expect(knight != null, "production Knight is present")
	_expect(hud != null, "production HUD is present")
	if knight == null or hud == null:
		_finish(game)
		return
	knight.set_physics_process(false)
	_expect(not (hud.get_node("%WeaponPanel") as Control).visible, "permanent bottom combo/weapon strip stays removed")

	_expect(bool(knight.call(&"configure_soul_team_from_run", {
		"active_hero": "sword_hero",
		"reserve_souls": ["axe_hero", ""],
		"capacity": 2,
	})), "live Sword/Axe team configures for HUD verification")
	hud.call(&"_sync_hero_hud")
	var sword_cost := ceili(float(knight.call(&"get_active_skill_mana_cost")))
	_expect(_label(hud, "%HandLabel").text == "KIẾM SĨ • NHỊP 1/4", "hidden action state retains the authored four-step Sword sequence")
	_expect(_label(hud, "%HandStatus").text == "CƯỜNG HÓA  •  SẴN SÀNG  •  %d MANA" % sword_cost, "Sword HUD names the enhancement, readiness and Hero Weapon Mana cost")
	_expect(_label(hud, "%AttackSlotStatus").text == "ĐÁNH\n1/4", "desktop Sword action deck reports the next combo step")
	_expect(_label(hud, "%SkillSlotStatus").text == "CƯỜNG HÓA\n%d MANA" % sword_cost, "desktop Sword action deck reports enhancement Mana cost")
	_expect(not _button(hud, "%HeavyAttackButton").disabled, "ready Sword Soul Echo is enabled")
	_expect("PHI MÃ" in _label(hud, "%UltimateStatus").text and "15 MP" in _label(hud, "%UltimateStatus").text, "Sword HUD exposes the Knight R ultimate")

	knight.set(&"soul_echo_cooldown_remaining", 2.4)
	hud.call(&"_sync_hero_hud")
	_expect("2.4s" in _label(hud, "%HandStatus").text and "%d MANA" % sword_cost in _label(hud, "%HandStatus").text, "Sword HUD reads both live cooldown and Mana cost")
	_expect(_button(hud, "%HeavyAttackButton").disabled, "Sword skill button disables during its cooldown")
	knight.set(&"soul_echo_cooldown_remaining", 0.0)

	_expect(bool(knight.call(&"configure_soul_team_from_run", {
		"active_hero": "axe_hero",
		"reserve_souls": ["sword_hero", ""],
		"capacity": 2,
	})), "live Axe/Sword team configures for HUD verification")
	hud.call(&"_sync_hero_hud")
	var axe_cost := ceili(float(knight.call(&"get_active_skill_mana_cost")))
	_expect(_label(hud, "%HandLabel").text == "CHIẾN BINH RÌU • TỤ LỰC 0%", "Axe action state reports live charge")
	_expect(_label(hud, "%HandStatus").text == "NÉM / THU HỒI • SẴN SÀNG • %d MANA" % axe_cost, "Axe action state uses concise Vietnamese copy")
	_expect(_label(hud, "%AttackSlotStatus").text == "TỤ LỰC\n0%", "Axe action state starts at zero charge")
	_expect(not _button(hud, "%HeavyAttackButton").disabled, "ready Axe Throw is enabled")

	_expect(bool(knight.call(&"_begin_axe_charge")), "real Axe charge starts")
	knight.call(&"_handle_action", 0.575)
	var live_charge := float(knight.call(&"get_axe_charge_ratio"))
	hud.call(&"_sync_hero_hud")
	var expected_percent := clampi(roundi(live_charge * 100.0), 0, 100)
	_expect(expected_percent > 0, "real Axe charge clock advances")
	_expect(_label(hud, "%HandLabel").text.ends_with("TỤ LỰC %d%%" % expected_percent), "Axe state reads get_axe_charge_ratio at runtime")
	_expect(_label(hud, "%AttackSlotStatus").text == "TỤ LỰC\n%d%%" % expected_percent, "charge state mirrors the live percentage")

	_expect(bool(knight.call(&"_release_axe_charge")), "real Axe charge releases into Cleave")
	knight.call(&"_handle_action", 1.0)
	_expect(bool(knight.call(&"request_action", "skill")), "real Axe Throw starts through the production action route")
	await process_frame
	hud.call(&"_sync_hero_hud")
	var manager := knight.call(&"get_weapon_manager") as Node
	var cooldown_after_throw := float(manager.call(&"get_hand_skill_cooldown_remaining", &"axe"))
	_expect(cooldown_after_throw > 0.01, "Axe Throw starts the real WeaponManager cooldown")
	_expect(bool(knight.call(&"is_axe_away")), "thrown Axe is actually away")
	_expect(_label(hud, "%HandStatus").text == "THU HỒI • SẴN SÀNG • MIỄN PHÍ", "away Axe switches to free recall")
	_expect(_label(hud, "%SkillSlotStatus").text == "THU HỒI\nMIỄN PHÍ", "recall state is available immediately")
	_expect(not _button(hud, "%HeavyAttackButton").disabled, "Recall stays enabled while Throw cooldown is active")

	var throw_effect := knight.get("_axe_throw_effect") as Node
	_expect(throw_effect != null, "production Axe Throw effect exists")
	if throw_effect != null:
		throw_effect.call(&"_finish")
		await process_frame
		hud.call(&"_sync_hero_hud")
		_expect(not bool(knight.call(&"is_axe_away")), "Axe returns to the Hero")
		_expect(_label(hud, "%SkillSlotStatus").text.begins_with("NÉM\n"), "returned Axe switches back to throw")
		_expect(_button(hud, "%HeavyAttackButton").disabled, "Throw stays disabled until its live cooldown finishes")

	manager.call(
		&"advance_time",
		float(manager.call(&"get_hand_skill_cooldown_remaining", &"axe")) + 0.1,
	)
	hud.call(&"_sync_hero_hud")
	_expect(_label(hud, "%HandStatus").text == "NÉM / THU HỒI • SẴN SÀNG • %d MANA" % axe_cost, "Axe returns to ready with its Mana cost when cooldown ends")
	_expect(not _button(hud, "%HeavyAttackButton").disabled, "Axe Throw re-enables when its cooldown ends")

	var mobile := OS.get_environment("GODOT_FORCE_TOUCH_CONTROLS") == "1"
	var virtual_controls := hud.get_node("HUDRoot/VirtualControls") as Control
	if mobile:
		_expect(virtual_controls.visible, "mobile production controls are visible")
		_expect(_button(hud, "%LightAttackButton").text == "TỤ LỰC\n0%", "mobile Axe attack button uses Vietnamese charge copy")
		_expect(_button(hud, "%HeavyAttackButton").text == "NÉM\n%d MANA" % axe_cost, "mobile Axe skill button exposes throw Mana cost")
	else:
		_expect(not virtual_controls.visible, "desktop keeps virtual controls hidden")

	_finish(game)


func _label(hud: CanvasLayer, unique_path: String) -> Label:
	return hud.get_node(unique_path) as Label


func _button(hud: CanvasLayer, unique_path: String) -> Button:
	return hud.get_node(unique_path) as Button


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish(game: Node) -> void:
	if is_instance_valid(game):
		game.queue_free()
	await process_frame
	if _failures.is_empty():
		print("HERO-AWARE HUD RUNTIME TEST PASSED — %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("HERO-AWARE HUD FAIL: %s" % failure)
	quit(1)
