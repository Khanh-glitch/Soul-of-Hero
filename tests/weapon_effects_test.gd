extends SceneTree

const FALLING_ARROW_SCENE := preload("res://game/weapons/effects/falling_arrow.tscn")
const PIERCING_ARROW_SCENE := preload("res://game/weapons/effects/piercing_arrow.tscn")
const FLYING_SWORD_SCENE := preload("res://game/weapons/effects/flying_sword.tscn")
const AXE_THROW_SCENE := preload("res://game/weapons/effects/axe_throw.tscn")
const AXE_FOLLOW_THROUGH_SCENE := preload("res://game/weapons/effects/axe_follow_through.tscn")

class DummyEnemy:
	extends CharacterBody2D

	var health := 100
	var max_health := 100
	var stagger_received := 0.0
	var stagger_events: Array[Dictionary] = []

	func take_damage(amount: int, _source_position: Vector2 = Vector2.ZERO) -> void:
		health = maxi(0, health - amount)

	func apply_stagger(amount: float, context: Dictionary = {}) -> void:
		stagger_received += amount
		stagger_events.append(context.duplicate(true))


var _arena: Node2D
var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_arena = Node2D.new()
	_arena.name = "WeaponEffectsTestArena"
	root.add_child(_arena)

	var source := _make_source(Vector2.ZERO)
	var nearest := _make_enemy(Vector2(50.0, 0.0))
	var pointer_choice := _make_enemy(Vector2(35.0, 50.0))
	_make_enemy(Vector2(-20.0, 0.0))
	await _physics_frames(2)

	var selected := TargetingService.acquire_nearest(source, Vector2.ZERO, Vector2.RIGHT, 100.0, 180.0)
	_expect(selected == nearest, "targeting selects nearest enemy in facing half-space")
	var narrow_targets := TargetingService.acquire_up_to(source, Vector2.ZERO, Vector2.RIGHT, 100.0, 40.0, 3)
	_expect(narrow_targets.size() == 1 and narrow_targets[0] == nearest, "targeting cone excludes off-angle and behind enemies")
	var pointer_targets := TargetingService.acquire_near_point(
		source,
		Vector2.ZERO,
		pointer_choice.global_position + Vector2(5.0, 0.0),
		100.0,
		12.0,
		1
	)
	_expect(
		pointer_targets.size() == 1 and pointer_targets[0] == pointer_choice,
		"pointer targeting deliberately selects the enemy under the cursor instead of the nearer facing target"
	)
	var out_of_range_pointer := _make_enemy(Vector2(140.0, 0.0))
	await _physics_frames(1)
	_expect(
		TargetingService.acquire_near_point(
			source, Vector2.ZERO, out_of_range_pointer.global_position, 100.0, 12.0, 1
		).is_empty(),
		"pointer targeting still enforces weapon range from the player"
	)

	var falling_target := _make_enemy(Vector2(160.0, 0.0))
	var falling_arrow := FALLING_ARROW_SCENE.instantiate() as FallingArrowEffect
	_arena.add_child(falling_arrow)
	falling_arrow.impact_visual_seconds = 0.04
	falling_arrow.setup(source, falling_target.global_position, 25, &"bow", 0.04, 14.0)
	await _physics_frames(10)
	_expect(falling_target.health == 75, "Falling Arrow applies one delayed confirmed AoE hit")
	_expect(not is_instance_valid(falling_arrow), "Falling Arrow cleans itself up after impact presentation")

	var piercing_y := 160.0
	var piercing_a := _make_enemy(Vector2(45.0, piercing_y))
	var piercing_b := _make_enemy(Vector2(85.0, piercing_y))
	_make_wall(Vector2(125.0, piercing_y), Vector2(8.0, 72.0))
	await _physics_frames(2)
	var piercing_arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	_arena.add_child(piercing_arrow)
	piercing_arrow.setup(
		source, Vector2(0.0, piercing_y), Vector2.RIGHT, 15, &"bow",
		900.0, 400.0, Color(0.35, 0.88, 1.0), 5, 9.0, 14.0
	)
	var piercing_shape := piercing_arrow.get_node("HitShape").shape as RectangleShape2D
	_expect(is_equal_approx(piercing_arrow.projectile_width, 14.0) and is_equal_approx(piercing_shape.size.y, 14.0), "Piercing Arrow applies its authored gameplay width to sweep and collision")
	await _physics_frames(20)
	_expect(piercing_a.health == 85 and piercing_b.health == 85, "Piercing Arrow hits each enemy once while continuing")
	_expect(not is_instance_valid(piercing_arrow), "Piercing Arrow stops at World and cleans itself up")

	var sword_y := 260.0
	source.global_position = Vector2(0.0, sword_y)
	var sword_target := _make_enemy(Vector2(84.0, sword_y))
	var flying_sword := FLYING_SWORD_SCENE.instantiate() as FlyingSwordEffect
	_arena.add_child(flying_sword)
	flying_sword.maximum_lifetime = 2.0
	flying_sword.setup(source, sword_target, source.global_position, 30, &"sword", Vector2.ZERO, 800.0, 900.0)
	await _physics_frames(35)
	_expect(sword_target.health == 70, "Flying Sword deals one readable outbound slash")
	_expect(not is_instance_valid(flying_sword), "Flying Sword returns to its current owner position and cleans up")

	var axe_y := 360.0
	source.global_position = Vector2(0.0, axe_y)
	var axe_near := _make_enemy(Vector2(42.0, axe_y))
	var axe_far := _make_enemy(Vector2(78.0, axe_y))
	var throw_result := {"completed": 0, "endpoint": Vector2.ZERO, "primary": null, "manual": false, "return_position": Vector2.ZERO, "cross_cut_count": 0}
	var axe_throw := AXE_THROW_SCENE.instantiate() as AxeThrowEffect
	_arena.add_child(axe_throw)
	axe_throw.cross_cut_confirmed.connect(func(_target: Node, _bonus: float) -> void: throw_result.cross_cut_count = int(throw_result.cross_cut_count) + 1)
	axe_throw.completed.connect(func(_hits: int, endpoint: Vector2, primary: Node, manual: bool) -> void:
		throw_result.completed = int(throw_result.completed) + 1
		throw_result.endpoint = endpoint
		throw_result.primary = primary
		throw_result.manual = manual
		throw_result.return_position = axe_throw.global_position
	)
	_expect(axe_throw.setup(source, source.global_position, Vector2.RIGHT, 20, 12.0, 28.0, &"axe", 900.0, 900.0, 120.0, 2.0, 14.0, 7.0, true), "Axe Throw accepts a valid data-driven setup")
	await _physics_frames(10)
	_expect(axe_throw.request_recall(true), "manual Skill recall turns the outbound Axe around")
	_expect(not axe_throw.request_recall(true), "a second recall request cannot duplicate the return")
	await _physics_frames(20)
	_expect(axe_near.health == 60 and axe_far.health == 60, "Throw & Recall damages each target once outbound and once returning")
	_expect(int(throw_result.cross_cut_count) == 2, "each target hit on both paths confirms exactly one Cross Cut")
	_expect(axe_near.stagger_received == 52.0 and axe_far.stagger_received == 52.0, "Cross Cut return adds the configured extra stagger")
	_expect(throw_result.primary == axe_near, "Axe Throw deterministically reports the nearest outbound target")
	_expect((throw_result.endpoint as Vector2).distance_to(Vector2(120.0, axe_y)) < 2.0, "Axe skill preserves its outbound principal endpoint")
	_expect(bool(throw_result.manual) and int(throw_result.completed) == 1 and not is_instance_valid(axe_throw), "manual Axe return completes once and cleans up")

	var reshape_y := 450.0
	source.global_position = Vector2(0.0, reshape_y)
	var return_only := _make_enemy(Vector2(62.0, reshape_y + 30.0))
	var reshape_result := {"completed": 0, "return_position": Vector2.ZERO, "endpoint": Vector2.ZERO}
	var reshape_cross_cuts := 0
	var reshaped_throw := AXE_THROW_SCENE.instantiate() as AxeThrowEffect
	_arena.add_child(reshaped_throw)
	reshaped_throw.cross_cut_confirmed.connect(func(_target: Node, _bonus: float) -> void: reshape_cross_cuts += 1)
	reshaped_throw.completed.connect(func(_hits: int, endpoint: Vector2, _primary: Node, _manual: bool) -> void:
		reshape_result.completed = int(reshape_result.completed) + 1
		reshape_result.endpoint = endpoint
		reshape_result.return_position = reshaped_throw.global_position
	)
	reshaped_throw.setup(source, source.global_position, Vector2.RIGHT, 18, 10.0, 28.0, &"axe", 900.0, 300.0, 120.0, 2.0, 12.0, 6.0, true)
	await _physics_frames(10)
	source.global_position = Vector2(0.0, reshape_y + 60.0)
	reshaped_throw.request_recall(true)
	await _physics_frames(10)
	source.global_position = Vector2(0.0, reshape_y + 72.0)
	await _physics_frames(35)
	_expect(return_only.health == 82 and reshape_cross_cuts == 0, "an enemy only on the reshaped return path is hit once without Cross Cut")
	_expect(int(reshape_result.completed) == 1 and (reshape_result.return_position as Vector2).distance_to(source.global_position) < 7.0, "return path follows the owner's current position and cleans up once")
	_expect((reshape_result.endpoint as Vector2).distance_to(Vector2(120.0, reshape_y)) < 2.0, "reshaping the return does not overwrite the principal outbound endpoint")

	var follow_y := 590.0
	source.global_position = Vector2(0.0, follow_y)
	var follow_target := _make_enemy(Vector2(62.0, follow_y))
	var follow_hits: Array[StringName] = []
	var follow_result := {"completed": 0}
	var follow := AXE_FOLLOW_THROUGH_SCENE.instantiate() as AxeFollowThroughEffect
	_arena.add_child(follow)
	follow.target_hit.connect(func(_target: Node, _damage: int, phase: StringName, _stagger: float) -> void: follow_hits.append(phase))
	follow.completed.connect(func(_count: int) -> void: follow_result.completed = int(follow_result.completed) + 1)
	_expect(follow.setup(source, source.global_position, Vector2(125.0, follow_y), follow_target, 20, 14.0, &"axe", 900.0, 900.0, 2.0, 13.0, 7.0), "Follow-through accepts a meaningful endpoint")
	await _physics_frames(30)
	_expect(follow_target.health == 60 and follow_hits == [&"outbound", &"return"], "Follow-through damages once outbound and once on return")
	_expect(int(follow_result.completed) == 1 and not is_instance_valid(follow), "Follow-through completes once and cleans up")

	var meaningless := AXE_FOLLOW_THROUGH_SCENE.instantiate() as AxeFollowThroughEffect
	_arena.add_child(meaningless)
	_expect(not meaningless.setup(source, source.global_position, source.global_position, null, 20, 14.0, &"axe", 900.0, 900.0, 2.0, 13.0, 7.0), "Follow-through rejects a skill without target or meaningful endpoint")
	await _physics_frames(2)
	_expect(not is_instance_valid(meaningless), "rejected Follow-through setup cleans itself up")

	if _failures.is_empty():
		print("WEAPON EFFECTS TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("WEAPON EFFECTS TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _make_source(at: Vector2) -> CharacterBody2D:
	var source := CharacterBody2D.new()
	source.collision_layer = 2
	source.collision_mask = 0
	source.global_position = at
	var collision := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 5.0
	collision.shape = shape
	source.add_child(collision)
	_arena.add_child(source)
	return source


func _make_enemy(at: Vector2) -> DummyEnemy:
	var enemy := DummyEnemy.new()
	enemy.collision_layer = 4
	enemy.collision_mask = 0
	enemy.global_position = at
	var collision := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 7.0
	collision.shape = shape
	enemy.add_child(collision)
	_arena.add_child(enemy)
	return enemy


func _make_wall(at: Vector2, size: Vector2) -> StaticBody2D:
	var wall := StaticBody2D.new()
	wall.collision_layer = 1
	wall.collision_mask = 0
	wall.global_position = at
	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = size
	collision.shape = shape
	wall.add_child(collision)
	_arena.add_child(wall)
	return wall


func _physics_frames(count: int) -> void:
	for _frame: int in count:
		await physics_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
