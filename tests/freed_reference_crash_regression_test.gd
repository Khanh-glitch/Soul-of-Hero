extends SceneTree

const HERO_MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const WIZARD_RUNTIME_SCRIPT := preload("res://game/heroes/wizard/wizard_runtime.gd")
const SWORD_WAVE_SCENE: PackedScene = preload("res://game/heroes/sword/sword_crescent_wave.tscn")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ARCHER: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")


class DummyPlayer extends CharacterBody2D:
	func begin_soul_summon(_incoming: HeroDefinition, _attacker: Node) -> Vector2:
		return global_position


class OffsetWaveTarget extends CharacterBody2D:
	var max_health := 100
	var health := 100


	func _init() -> void:
		collision_layer = 4
		collision_mask = 0
		add_to_group(&"enemies")
		var collision := CollisionShape2D.new()
		var shape := CircleShape2D.new()
		shape.radius = 12.0
		collision.shape = shape
		add_child(collision)


	func take_damage(amount: int, _source_position := Vector2.ZERO) -> void:
		health = maxi(0, health - amount)


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var arena := Node2D.new()
	root.add_child(arena)
	var player := DummyPlayer.new()
	arena.add_child(player)
	var manager := HERO_MANAGER_SCRIPT.new()
	player.add_child(manager)
	_expect(manager.configure_team(player, SWORD, ARCHER), "Soul team configures for freed-reference regression")

	var stale_attacker := CharacterBody2D.new()
	arena.add_child(stale_attacker)
	manager.set("_primary_attacker", stale_attacker)
	stale_attacker.free()
	_expect(bool(manager.call(&"_begin_support_summon")), "support summon safely converts a freed attacker reference to null")
	_expect(manager.get("_primary_attacker") == null, "freed primary attacker is purged from runtime state")

	var wave_owner := CharacterBody2D.new()
	arena.add_child(wave_owner)
	var offset_target := OffsetWaveTarget.new()
	offset_target.global_position = Vector2(48.0, 20.0)
	arena.add_child(offset_target)
	await physics_frame
	var wave := SWORD_WAVE_SCENE.instantiate()
	arena.add_child(wave)
	wave.call(&"setup", wave_owner, Vector2.ZERO, Vector2.RIGHT, 10, 1, 275.0, 150.0, 28.0)
	wave_owner.free()
	wave.call(&"_physics_process", 0.20)
	wave.call(&"_physics_process", 0.20)
	_expect(is_instance_valid(wave), "Crescent Wave survives a freed owner during its physics query")
	_expect(
		offset_target.health == 90,
		"Crescent Wave sweeps the target collider instead of missing an off-center body",
	)

	var wizard_runtime := WIZARD_RUNTIME_SCRIPT.new()
	arena.add_child(wizard_runtime)
	wizard_runtime.call(&"configure", player, manager)
	arena.remove_child(wizard_runtime)
	wizard_runtime.call(&"_emit_state", &"owner_removed")
	_expect(not wizard_runtime.is_inside_tree(), "Wizard state emission safely ends after leaving the scene tree")
	wizard_runtime.free()
	arena.free()

	if _failures.is_empty():
		print("FREED REFERENCE CRASH REGRESSION TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FREED REFERENCE FAIL: " + failure)
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
