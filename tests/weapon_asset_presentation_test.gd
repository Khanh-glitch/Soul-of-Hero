extends SceneTree

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const FALLING_ARROW_SCENE := preload("res://game/weapons/effects/falling_arrow.tscn")
const FLYING_SWORD_SCENE := preload("res://game/weapons/effects/flying_sword.tscn")
const PIERCING_ARROW_SCENE := preload("res://game/weapons/effects/piercing_arrow.tscn")
const WEAPON_VISUAL_SCENE := preload("res://game/weapons/weapon_visual_2d.tscn")

const PRESENTATION_SOURCES := [
	"res://game/weapons/effects/falling_arrow.gd",
	"res://game/weapons/effects/flying_sword.gd",
	"res://game/weapons/effects/piercing_arrow.gd",
	"res://game/weapons/weapon_visual_2d.gd",
]

var _checks := 0
var _failures: Array[String] = []


func _init() -> void:
	call_deferred(&"_run")


func _run() -> void:
	for source_path: String in PRESENTATION_SOURCES:
		var source := FileAccess.get_file_as_string(source_path)
		_expect(not source.contains("func _draw"), "%s has no procedural _draw presentation" % source_path)
		_expect(not source.contains("draw_colored_polygon") and not source.contains("draw_arc("), "%s has no legacy vector weapon rendering" % source_path)

	var world := Node2D.new()
	world.name = "WeaponAssetPresentationTestWorld"
	root.add_child(world)
	var source_actor := Node2D.new()
	var target_actor := Node2D.new()
	target_actor.position = Vector2(48.0, 0.0)
	world.add_child(source_actor)
	world.add_child(target_actor)

	var falling := FALLING_ARROW_SCENE.instantiate() as FallingArrowEffect
	world.add_child(falling)
	falling.setup(source_actor, Vector2(24.0, 24.0), 10, &"bow", 2.0, 22.0)
	_expect(_sprite_has_texture(falling.get_node_or_null("TelegraphSprite")), "Falling Arrow telegraph is an asset-backed Sprite2D")
	_expect(_sprite_has_texture(falling.get_node_or_null("ArrowSprite")), "Falling Arrow projectile is an authored arrow sprite")

	var flying := FLYING_SWORD_SCENE.instantiate() as FlyingSwordEffect
	world.add_child(flying)
	flying.setup(source_actor, target_actor, Vector2.ZERO, 10, &"sword", Vector2.ZERO, 10.0, 10.0)
	_expect(_sprite_has_texture(flying.get_node_or_null("TrailSprite")), "Flying Sword trail uses an authored spritesheet")
	_expect(_sprite_has_texture(flying.get_node_or_null("BladeSprite")), "Flying Sword blade uses the licensed arsenal sprite")

	var piercing := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	world.add_child(piercing)
	piercing.setup(source_actor, Vector2.ZERO, Vector2.RIGHT, 10, &"bow", 10.0, 100.0)
	_expect(_sprite_has_texture(piercing.get_node_or_null("TrailSprite")), "Piercing Arrow trail uses an authored spritesheet")
	_expect(_sprite_has_texture(piercing.get_node_or_null("ArrowSprite")), "Piercing Arrow projectile uses the authored arrow sprite")

	var weapon_visual := WEAPON_VISUAL_SCENE.instantiate() as WeaponVisual2D
	world.add_child(weapon_visual)
	var weapon_sprite := weapon_visual.get_node_or_null("WeaponSprite") as Sprite2D
	var aura_sprite := weapon_visual.get_node_or_null("AuraSprite") as Sprite2D
	_expect(weapon_sprite != null and aura_sprite != null and aura_sprite.texture != null, "Weapon visual scene owns sprite and aura asset nodes")
	var observed_textures: Dictionary = {}
	for weapon_id: StringName in [&"bow", &"sword", &"axe"]:
		weapon_visual.set_weapon(weapon_id)
		if weapon_sprite != null and weapon_sprite.texture != null:
			observed_textures[weapon_sprite.texture.resource_path] = true
	_expect(observed_textures.size() == 3, "Bow, Sword, and Axe resolve three distinct imported textures")

	_expect(VfxCatalog.has_effect(&"bow_impact"), "VFX catalog owns the Bow impact presentation")
	var impact := VfxCatalog.spawn(world, &"bow_impact", Vector2.ZERO)
	var impact_sprite := impact.get_node_or_null("LicensedEffect") as AnimatedSprite2D if impact != null else null
	_expect(impact_sprite != null and impact_sprite.sprite_frames.get_frame_count(&"play") == 14, "Bow impact loads all 14 authored sparkle frames")

	world.queue_free()
	await process_frame
	_finish()


func _sprite_has_texture(node: Node) -> bool:
	return node is Sprite2D and (node as Sprite2D).texture != null


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("WEAPON ASSET PRESENTATION TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("WEAPON ASSET PRESENTATION TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
