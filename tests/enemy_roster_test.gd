extends SceneTree

const SWORDSMAN_SCENE: PackedScene = preload("res://game/characters/enemies/skeleton_enemy.tscn")
const REAPER_SCENE: PackedScene = preload("res://game/characters/enemies/skeleton_reaper.tscn")
const VAMPIRE_SCENE: PackedScene = preload("res://game/characters/enemies/vampire_enemy.tscn")
const DISC_SCENE: PackedScene = preload("res://game/characters/enemies/spectral_disc.tscn")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const PackRules := preload("res://game/content/encounters/encounter_pack_rules.gd")

class FakeSpiritManager:
	extends Node

	const TEST_SWORD: WeaponDefinition = preload("res://game/weapons/data/sword.tres")
	var progress := 2.0

	func get_spirit_slots() -> Array[WeaponDefinition]:
		return [TEST_SWORD]

	func get_spirit_trigger_progress(_weapon_id: StringName) -> float:
		return progress

	func set_spirit_trigger_progress(_weapon_id: StringName, value: float) -> bool:
		progress = value
		return true


class FakeVampireTarget:
	extends Node2D

	var health := 90
	var invulnerable := true
	var spirit_manager := FakeSpiritManager.new()

	func _init() -> void:
		add_child(spirit_manager)

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> bool:
		if invulnerable:
			return false
		health -= amount
		return true

	func get_weapon_manager() -> Node:
		return spirit_manager

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var stage := Node2D.new()
	get_root().add_child(stage)

	var swordsman := SWORDSMAN_SCENE.instantiate() as SkeletonEnemy
	var reaper := REAPER_SCENE.instantiate() as AdvancedDungeonEnemy
	var vampire := VAMPIRE_SCENE.instantiate() as AdvancedDungeonEnemy
	stage.add_child(swordsman)
	stage.add_child(reaper)
	stage.add_child(vampire)
	await process_frame

	_expect(swordsman != null and swordsman.is_in_group(&"enemies"), "Skeleton swordsman scene joins the enemy runtime group")
	_expect(reaper != null and reaper.get_archetype_id() == &"bone_reaper", "Skeleton 2 is configured as the Bone Reaper archetype")
	_expect(vampire != null and vampire.get_archetype_id() == &"blood_vampire", "Vampire is configured as the Blood Vampire archetype")
	_expect(reaper.is_in_group(&"enemy_bone_reaper"), "Bone Reaper publishes a stable archetype group")
	_expect(vampire.is_in_group(&"enemy_blood_vampire"), "Blood Vampire publishes a stable archetype group")

	_validate_animation_library(swordsman.get_node("AnimatedSprite2D") as AnimatedSprite2D, {
		&"idle": 6, &"move": 10, &"attack": 9, &"hurt": 5, &"death": 17,
	}, "Skeleton swordsman")
	_validate_animation_library(reaper.get_node("AnimatedSprite2D") as AnimatedSprite2D, {
		&"idle": 6, &"move": 10, &"attack": 15, &"hurt": 5, &"death": 15,
	}, "Bone Reaper")
	_validate_animation_library(vampire.get_node("AnimatedSprite2D") as AnimatedSprite2D, {
		&"idle": 6, &"move": 8, &"attack": 16, &"hurt": 5, &"death": 14,
	}, "Blood Vampire")

	_expect(reaper.get_telegraph_seconds() >= 0.5, "Bone Reaper exposes a readable ranged telegraph")
	_expect(vampire.get_telegraph_seconds() >= 0.4, "Blood Vampire exposes a readable lunge telegraph")
	_expect("quay lại" in reaper.get_ability_summary(), "Bone Reaper documents its outbound/return spectral disc")
	_expect("Spirit" in vampire.get_ability_summary(), "Blood Vampire documents its Spirit-drain identity")

	var reaper_sprite := reaper.get_node("AnimatedSprite2D") as AnimatedSprite2D
	reaper.call(&"_set_facing", Vector2.RIGHT)
	_expect(reaper_sprite.flip_h, "Reaper right-facing presentation uses horizontal flip")
	reaper.call(&"_set_facing", Vector2.LEFT)
	_expect(not reaper_sprite.flip_h, "Reaper left-facing presentation restores the authored lateral frame")
	var vampire_sprite := vampire.get_node("AnimatedSprite2D") as AnimatedSprite2D
	vampire.call(&"_set_facing", Vector2.RIGHT)
	_expect(vampire_sprite.flip_h, "Vampire uses the same two-direction visual contract")

	var disc := DISC_SCENE.instantiate() as SpectralDisc
	stage.add_child(disc)
	_expect(disc != null and disc.collision_mask == 2, "Spectral disc targets the player collision layer")
	_expect(disc.maximum_distance >= 120.0 and disc.travel_speed >= 160.0, "Spectral disc has a readable bounded travel profile")
	_expect(is_equal_approx(disc.maximum_distance, reaper.get_ability_range()), "Bone Reaper telegraph/cast range matches spectral disc travel")
	disc.free()

	var moved_target := Node2D.new()
	stage.add_child(moved_target)
	reaper.global_position = Vector2.ZERO
	moved_target.global_position = Vector2(0.0, 96.0)
	reaper.set("_target", moved_target)
	reaper.set("_locked_direction", Vector2.RIGHT)
	reaper.call(&"_spawn_spectral_disc")
	var locked_disc: SpectralDisc = null
	for candidate: Node in stage.get_children():
		if candidate is SpectralDisc:
			locked_disc = candidate as SpectralDisc
	_expect(locked_disc != null and locked_disc.get_travel_direction().dot(Vector2.RIGHT) > 0.998, "Bone Reaper projectile follows the direction locked by its telegraph after the target moves")
	if locked_disc != null:
		locked_disc.free()
	moved_target.free()

	var player := FakeVampireTarget.new()
	stage.add_child(player)
	vampire.health = 40
	vampire.global_position = player.global_position
	vampire.set("_target", player)
	vampire.set("_strike_has_hit", false)
	vampire.call(&"_attempt_strike_hit")
	_expect(player.health == 90 and vampire.health == 40 and is_equal_approx(player.spirit_manager.progress, 2.0), "Vampire cannot leech or drain Spirit progress through player invulnerability")
	player.invulnerable = false
	vampire.set("_strike_has_hit", false)
	vampire.call(&"_attempt_strike_hit")
	_expect(player.health == 74 and vampire.health == 48 and is_equal_approx(player.spirit_manager.progress, 1.0), "Vampire leech and one-step Spirit drain occur only after confirmed damage")

	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/levels/crypt_entrance.json"))
	_expect(parsed is Dictionary, "Canonical dungeon JSON remains parseable")
	if parsed is Dictionary:
		var validation: Dictionary = LevelSchemaValidator.validate_level(parsed)
		_expect(bool(validation.get("ok", false)), "Level schema accepts the redesigned Level 1 roster")
		var type_counts := {"skeleton": 0, "skeleton_reaper": 0, "vampire": 0}
		for raw_entity: Variant in (parsed as Dictionary).get("entities", []):
			if raw_entity is Dictionary:
				var entity_type := String((raw_entity as Dictionary).get("type", ""))
				if type_counts.has(entity_type):
					type_counts[entity_type] = int(type_counts[entity_type]) + 1
		_expect(int(type_counts.skeleton) == 12, "Level 1 keeps twelve stable Skeleton anchor markers instead of authoring a total runtime count")
		var level_one_weights := PackRules.get_family_weights(1, &"easy")
		_expect(float(level_one_weights.skeleton_reaper) == 0.0, "Level 1 teaches the Skeleton language before introducing a second archetype")
		_expect(float(level_one_weights.vampire) == 0.0, "Level 1 cannot roll a surprise Vampire before its lesson")
		var level_three_weights := PackRules.get_family_weights(3, &"easy")
		_expect(float(level_three_weights.skeleton_reaper) > 0.0, "Level 3 deliberately introduces the telegraphed Bone Reaper")
		_expect(float(level_three_weights.vampire) == 0.0, "Level 3 still withholds the Vampire until a later authored lesson")

	stage.queue_free()
	await process_frame
	_finish()


func _validate_animation_library(sprite: AnimatedSprite2D, expected: Dictionary, label: String) -> void:
	_expect(sprite != null and sprite.sprite_frames != null, "%s has a runtime SpriteFrames library" % label)
	if sprite == null or sprite.sprite_frames == null:
		return
	for animation_name: StringName in expected:
		_expect(sprite.sprite_frames.has_animation(animation_name), "%s has %s animation" % [label, animation_name])
		if sprite.sprite_frames.has_animation(animation_name):
			_expect(
				sprite.sprite_frames.get_frame_count(animation_name) == int(expected[animation_name]),
				"%s %s frame count matches the authored sheet" % [label, animation_name]
			)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("ENEMY ROSTER TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("ENEMY ROSTER TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)
