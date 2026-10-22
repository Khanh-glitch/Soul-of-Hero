extends SceneTree

const RULES := preload("res://game/heroes/sword/k_night_rules.gd")
const KIT_RULES := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const LIBRARY := preload("res://game/heroes/hero_library_catalog.gd")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ECHO_SCENE: PackedScene = preload("res://game/heroes/sword/sword_soul_echo.tscn")
const INTERCEPTION_SCENE: PackedScene = preload("res://game/heroes/sword/soul_interception.tscn")
const CAVALRY_SCENE: PackedScene = preload("res://game/heroes/ultimate/knight_cavalry_charge.tscn")
const LIBRARY_SCENE: PackedScene = preload(
	"res://game/ui/screens/hub/tabs/components/hero_library_panel.tscn"
)
const REVENGE_RIDER := preload("res://game/heroes/sword/k_night_revenge_rider.gd")
const REVENGE_GUARD := preload("res://game/heroes/sword/knight_cavalry_guard.gd")
const VENGEFUL_SOUL := preload("res://game/heroes/sword/k_night_vengeful_soul.gd")


class PursuitTarget:
	extends CharacterBody2D

	var max_health := 1000
	var health := 1000

	func _init() -> void:
		collision_layer = 4
		collision_mask = 0
		add_to_group(&"enemies")
		var collision := CollisionShape2D.new()
		var shape := RectangleShape2D.new()
		shape.size = Vector2(18.0, 24.0)
		collision.shape = shape
		add_child(collision)

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> bool:
		health = maxi(0, health - amount)
		return true


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(960, 540)
	_test_identity_and_library_contract()
	_test_combo_contract()
	_test_active_skill_profiles()
	_test_soul_and_departure_contract()
	_test_per_enemy_source_contract()
	await _test_runtime_resources_load()
	await _test_common_afterimage_presentation()
	await _test_production_knight_common_swing_vfx()
	await _test_pursuit_wave_handoff()
	_finish()


func _test_identity_and_library_contract() -> void:
	_expect(SWORD.display_name == "K-Night", "Hero display name is K-Night")
	_expect(SWORD.title == "Chiến Binh Âm Giới", "K-Night title is authored")
	_expect(SWORD.lore.is_empty() and SWORD.lore_pending, "Lore remains intentionally blank")
	_expect(
		SWORD.base_max_hp == 1100.0
		and SWORD.base_max_mana == 110.0
		and SWORD.base_power == 20.0
		and SWORD.base_move_speed_multiplier == 1.0,
		"K-Night base HP, MP, damage and movement match the reset",
	)
	_expect(SWORD.validate().is_empty(), "K-Night HeroDefinition validates")
	_expect(
		RULES.RARITY_NAMES == [
			"Thường", "Phép thuật", "Hiếm", "Sử thi",
			"Huyền thoại", "Kim cương", "Thần thánh", "Bất tử",
		],
		"All eight Vietnamese rarity names are canonical",
	)
	var profile := LIBRARY.profile(&"sword_hero")
	_expect(
		not profile.is_empty()
		and bool(profile.get("lore_pending", false))
		and String(profile.get("lore", "")).is_empty(),
		"Hero Library exposes K-Night and preserves the lore placeholder",
	)
	_expect((profile.get("rarities", []) as Array).size() == 8, "Hero Library displays eight rarities")


func _test_combo_contract() -> void:
	_expect(SWORD.combo_step_count() == 4, "K-Night owns exactly four normal hits")
	_expect(SWORD.combo_continuation_seconds == 2.0, "Combo window is two seconds")
	_expect(
		SWORD.combo_damage_multipliers == [1.0, 1.2, 0.5, 1.0],
		"Four hit coefficients are 100/120/50/100 percent",
	)
	_expect(
		RULES.COMBO_TWO_SLOW_RATIO == 0.30
		and RULES.COMBO_TWO_SLOW_SECONDS == 1.0,
		"Hit 2 slows by 30 percent for one second",
	)
	_expect(
		RULES.execution_damage(20, 100.0, 1000.0) == 740,
		"Hit 4 adds exactly 80 percent of target missing HP",
	)


func _test_active_skill_profiles() -> void:
	for rank: int in range(1, 6):
		var base_echo := RULES.afterimage_profile(rank, false)
		var void_echo := RULES.afterimage_profile(rank, true)
		var index := rank - 1
		_expect(
			int(base_echo["afterimage_count"]) == RULES.AFTERIMAGE_COUNTS[index]
			and is_equal_approx(
				float(base_echo["afterimage_ratio"]),
				float(RULES.AFTERIMAGE_PER_ECHO_RATIOS[index]),
			),
			"Afterimage count and per-copy damage are exact at rank %d" % rank,
		)
		_expect(
			is_equal_approx(
				float(void_echo["mana"]) - float(base_echo["mana"]), 10.0
			)
			and is_equal_approx(
				float(void_echo["cooldown"]) - float(base_echo["cooldown"]), 3.0
			),
			"Hư Ảnh adds exactly 10 MP and 3 cooldown seconds at rank %d" % rank,
		)
		var legion := RULES.legion_profile(rank)
		_expect(
			int(legion["rider_count"]) == RULES.LEGION_RIDER_COUNTS[index]
			and int(legion["damage_ticks"]) == 10
			and is_equal_approx(float(legion["tick_seconds"]), 0.2),
			"Underworld Legion rank %d owns its riders and ten 0.2s ticks" % rank,
		)
	var basic := KIT_RULES.kit_snapshot(
		&"sword_hero", 0, {"active_1": 1, "active_2": 1}
	)
	var advanced := KIT_RULES.kit_snapshot(
		&"sword_hero", 3, {"active_1": 1, "active_2": 1}
	)
	var high := KIT_RULES.kit_snapshot(
		&"sword_hero", 5, {"active_1": 1, "active_2": 1}
	)
	_expect(
		String((basic["active_1"] as Dictionary)["id"]) == "k_night_warrior_soul"
		and String((basic["active_2"] as Dictionary)["id"]) == "k_night_soul_cleave",
		"Common through Rare use the basic two-skill pool",
	)
	_expect(
		String((advanced["active_1"] as Dictionary)["id"]) == "k_night_void_phantom"
		and String((advanced["active_2"] as Dictionary)["id"]) == "k_night_underworld_legion",
		"Epic and later equipment use the advanced two-skill pool",
	)
	_expect(
		String((high["active_1"] as Dictionary)["id"]) == "k_night_void_phantom"
		and String((high["active_2"] as Dictionary)["id"]) == "k_night_underworld_legion",
		"Legendary-plus keeps the Epic active skill pool",
	)
	_expect(
		not bool(RULES.afterimage_profile(1, false).get("remote_approach", true))
		and bool(RULES.afterimage_profile(1, true).get("remote_approach", false)),
		"Common afterimages replay beside K-Night while Hư Ảnh approaches from behind",
	)
	_expect(
		is_equal_approx(RULES.AFTERIMAGE_INTERVAL_SECONDS, 0.10),
		"Combat afterimages follow each other by exactly 0.1 seconds",
	)
	var cleave := RULES.soul_cleave_profile(3)
	_expect(
		not cleave.has("charge")
		and float(cleave["damage_ratio"]) == 1.8
		and float(cleave["cooldown"]) == 6.0,
		"Đoạt Hồn Trảm is an immediate rank-3 cleave, not a charged action",
	)


func _test_soul_and_departure_contract() -> void:
	for rarity: int in range(8):
		var kit := KIT_RULES.kit_snapshot(
			&"sword_hero", rarity, KIT_RULES.roll_skill_ranks(rarity, 73, "k-night")
		)
		var soul := kit.get("soul", {}) as Dictionary
		var departure := kit.get("departure", {}) as Dictionary
		if rarity <= 4:
			_expect(
				String(soul.get("id", "")) == "k_night_soul_guardian"
				and String(departure.get("id", "")) == "k_night_final_breath",
				"Rarity %d uses Guardian and Final Breath" % rarity,
			)
		else:
			_expect(
				String(soul.get("id", "")) == "k_night_revenge_legion"
				and String(departure.get("id", "")) == "k_night_vengeful_soul",
				"Rarity %d uses Revenge Legion and Vengeful Soul" % rarity,
			)
	_expect(
		RULES.revenge_damage(20.0, 100.0, 1) == 100
		and RULES.revenge_damage(20.0, 100.0, 2) == 125
		and RULES.revenge_damage(20.0, 100.0, 3) == 150,
		"Revenge damage uses rank-specific 300/400/500 and 40/45/50 formulas",
	)
	_expect(
		RULES.wall_stun_seconds(0.0) == 5.0
		and is_equal_approx(RULES.wall_stun_seconds(1.0), 2.5)
		and RULES.wall_stun_seconds(2.0) == 0.0,
		"Wall stun falls linearly from five seconds to zero over two seconds",
	)


func _test_per_enemy_source_contract() -> void:
	var enemy_a := Node.new()
	var enemy_b := Node.new()
	var request_a := ENEMY_SCALER.build_runtime_damage_request(enemy_a, 12)
	var request_b := ENEMY_SCALER.build_runtime_damage_request(enemy_b, 12)
	_expect(
		int(request_a.get("source_enemy_instance_id", 0)) == enemy_a.get_instance_id()
		and int(request_b.get("source_enemy_instance_id", 0)) == enemy_b.get_instance_id()
		and request_a["source_enemy_instance_id"] != request_b["source_enemy_instance_id"],
		"Incoming hit requests preserve each individual enemy instance",
	)
	enemy_a.free()
	enemy_b.free()


func _test_runtime_resources_load() -> void:
	var knight_scene: PackedScene = load("res://game/characters/knight/knight.tscn")
	_expect(knight_scene != null, "Production Knight scene loads with K-Night scripts")
	var stage := Node2D.new()
	root.add_child(stage)
	var echo := ECHO_SCENE.instantiate()
	var interception := INTERCEPTION_SCENE.instantiate()
	var rider := REVENGE_RIDER.new()
	var guard := REVENGE_GUARD.new()
	var soul := VENGEFUL_SOUL.new()
	for node: Node in [echo, interception, rider, guard, soul]:
		_expect(node != null, "%s runtime resource instantiates" % node.get_class())
		node.free()
	var source := Node2D.new()
	stage.add_child(source)
	var cavalry := CAVALRY_SCENE.instantiate()
	stage.add_child(cavalry)
	_expect(
		bool(cavalry.call(&"setup", source, Vector2.ZERO, Vector2.RIGHT, 600, 15, 10)),
		"Fifteen-rider ten-tick cavalry configures",
	)
	_expect(
		cavalry.get_node_or_null("SpectralRider15") != null,
		"Fifteen-rider formation is visually complete",
	)
	cavalry.queue_free()
	var library_panel := LIBRARY_SCENE.instantiate()
	root.add_child(library_panel)
	await process_frame
	_expect(
		library_panel.get_node_or_null("%HeroDetail") != null
		and library_panel.find_child("LorePlaceholder", true, false) != null,
		"Hero Library panel builds K-Night details and blank lore placeholder",
	)
	library_panel.queue_free()
	stage.queue_free()
	await process_frame


func _test_common_afterimage_presentation() -> void:
	var stage := Node2D.new()
	root.add_child(stage)
	var source := Node2D.new()
	var source_sprite := AnimatedSprite2D.new()
	source_sprite.name = "Sprite"
	var frames := SpriteFrames.new()
	for animation: StringName in [
		&"sword_combo_1", &"sword_combo_2", &"sword_combo_3", &"sword_combo_4",
	]:
		frames.add_animation(animation)
		var image := Image.create(12, 18, false, Image.FORMAT_RGBA8)
		image.fill(Color.WHITE)
		frames.add_frame(animation, ImageTexture.create_from_image(image))
	source_sprite.sprite_frames = frames
	source.add_child(source_sprite)
	stage.add_child(source)
	var echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(echo)
	echo.world_collision_mask = 0
	echo.configure_rank_profile(RULES.afterimage_profile(1, false))
	_expect(echo.setup(source, SWORD, 1), "Common afterimage runtime configures")
	var started_contexts: Array[Dictionary] = []
	echo.echo_attack_started.connect(func(_step: int, context: Dictionary) -> void:
		started_contexts.append(context.duplicate(true))
	)
	_expect(
		echo.queue_combo_attack(1, 20, {
			"attack_instance_id": 991,
			"origin": Vector2(80.0, 80.0),
			"direction": Vector2.RIGHT,
		}),
		"A normal swing queues its Common afterimage without requiring a hit target",
	)
	await create_timer(0.16, false).timeout
	var visual := echo.get_node_or_null("EchoVisual") as Node2D
	_expect(
		started_contexts.size() == 1
		and StringName(started_contexts[0].get("approach_mode", &"")) == &"source_replay"
		and not bool(started_contexts[0].get("remote_approach", true)),
		"Common item emits exactly one source-replay afterimage",
	)
	_expect(
		visual != null
		and visual.visible
		and visual.global_position.distance_to(Vector2(80.0, 80.0)) < 12.0,
		"Common afterimage visibly overlaps about seventy percent beside K-Night",
	)
	source.global_position += Vector2(8.0, 0.0)
	await process_frame
	await create_timer(0.09, false).timeout
	_expect(
		echo.find_child("MovementAfterimage", true, false) is AnimatedSprite2D,
		"Movement during Linh Hồn Chiến Binh leaves a short body afterimage",
	)
	echo.cancel(&"test_cleanup")
	stage.queue_free()
	await process_frame


func _test_production_knight_common_swing_vfx() -> void:
	var stage := Node2D.new()
	root.add_child(stage)
	var knight_scene := load("res://game/characters/knight/knight.tscn") as PackedScene
	var knight := knight_scene.instantiate()
	stage.add_child(knight)
	await process_frame
	await physics_frame
	var manager := knight.call(&"get_hero_soul_manager") as HeroSoulManager
	_expect(manager != null, "Production K-Night exposes its Hero Soul manager")
	if manager == null:
		stage.queue_free()
		await process_frame
		return
	manager.configure_team(knight, SWORD, null)
	manager.configure_combat_stats_from_save({}, SWORD.base_max_hp, SWORD.base_max_mana)
	var live_profile: Dictionary = knight.call(
		&"get_active_hero_skill_profile", &"active_1"
	)
	_expect(
		StringName(live_profile.get("id", &"")) == &"k_night_warrior_soul"
		and int(live_profile.get("afterimage_count", 0)) == 1
		and not bool(live_profile.get("remote_approach", true)),
		"Production controller resolves an empty/Common loadout to one local white afterimage",
	)
	_expect(
		bool(knight.call(&"request_action", "skill", Vector2(160.0, 80.0))),
		"Production controller activates Linh Hồn Chiến Binh",
	)
	var production_echo: SwordSoulEchoEffect
	for child: Node in stage.get_children():
		if child is SwordSoulEchoEffect:
			production_echo = child as SwordSoulEchoEffect
			break
	_expect(production_echo != null, "Production skill creates the afterimage runtime node")
	var started_contexts: Array[Dictionary] = []
	if production_echo != null:
		production_echo.echo_attack_started.connect(
			func(_step: int, context: Dictionary) -> void:
				started_contexts.append(context.duplicate(true))
		)
	_expect(
		bool(knight.call(&"request_action", "attack", Vector2(180.0, 80.0))),
		"Production K-Night starts a normal swing without an enemy target",
	)
	var saw_visible_body := false
	for _frame: int in 90:
		await physics_frame
		if production_echo != null:
			var visual := production_echo.get_node_or_null("EchoVisual") as Node2D
			saw_visible_body = saw_visible_body or (visual != null and visual.visible)
		if saw_visible_body and not started_contexts.is_empty():
			break
	_expect(
		started_contexts.size() == 1
		and StringName(started_contexts[0].get("approach_mode", &"")) == &"source_replay",
		"The production attack emits exactly one Common source-replay afterimage even on a miss",
	)
	_expect(
		saw_visible_body,
		"The production afterimage body becomes visibly rendered during its delayed swing",
	)
	stage.queue_free()
	await process_frame


func _test_pursuit_wave_handoff() -> void:
	var stage := Node2D.new()
	root.add_child(stage)
	var knight_scene := load("res://game/characters/knight/knight.tscn") as PackedScene
	var knight := knight_scene.instantiate()
	knight.global_position = Vector2(120.0, 260.0)
	stage.add_child(knight)
	var target := PursuitTarget.new()
	target.global_position = Vector2(470.0, 252.0)
	stage.add_child(target)
	await process_frame
	await physics_frame
	var manager := knight.call(&"get_hero_soul_manager") as HeroSoulManager
	manager.configure_team(knight, SWORD, null)
	manager.configure_combat_stats_from_save({}, SWORD.base_max_hp, SWORD.base_max_mana)
	knight.set("_sword_combo_next_step", 3)
	knight.set("_sword_combo_window_remaining", SWORD.combo_continuation_seconds)
	_expect(
		bool(knight.call(&"request_action", "attack", target.global_position)),
		"Hit 3 launches its pursuit wave",
	)
	_expect(
		bool(knight.call(&"request_action", "attack", target.global_position)),
		"An early Hit 4 press buffers while the wave is travelling",
	)
	var saw_wave_damage := false
	var saw_pursuit_target := false
	var saw_pursuit_action := false
	var start_x: float = float(knight.global_position.x)
	for _frame: int in 300:
		await physics_frame
		saw_wave_damage = saw_wave_damage or target.health < target.max_health
		saw_pursuit_target = saw_pursuit_target or (
			knight.call(&"get_current_combat_target") == target
		)
		saw_pursuit_action = saw_pursuit_action or (
			String(knight.get("current_action")) == "sword_attack_4"
		)
		if saw_wave_damage \
				and saw_pursuit_target \
				and saw_pursuit_action \
				and knight.global_position.x > start_x + 40.0:
			break
	_expect(
		saw_wave_damage and saw_pursuit_target,
		"The exact unit struck by Hit 3 becomes the pursuit owner",
	)
	_expect(
		saw_pursuit_action and knight.global_position.x > start_x + 40.0,
		"Buffered Hit 4 reliably dashes toward the marked unit after wave impact",
	)
	stage.queue_free()
	await process_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("K-NIGHT RESET TEST PASSED — %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("K-NIGHT FAIL: %s" % failure)
	print("K-NIGHT RESET TEST FAILED — %d/%d checks failed" % [
		_failures.size(), _checks,
	])
	quit(1)
