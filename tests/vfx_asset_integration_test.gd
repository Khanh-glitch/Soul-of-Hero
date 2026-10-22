extends SceneTree

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const AXE_THROW_SCENE := preload("res://game/weapons/effects/axe_throw.tscn")
const SPECTRAL_DISC_SCENE := preload("res://game/characters/enemies/spectral_disc.tscn")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")

var _checks := 0
var _failures: Array[String] = []


func _init() -> void:
	call_deferred(&"_run")


func _run() -> void:
	for effect_id: StringName in [
		&"blade_impact", &"axe_impact", &"bone_impact", &"echo_impact",
		&"axe_charge", &"axe_cleave", &"axe_trail",
		&"pursuit_marker", &"echo_ribbon", &"echo_anchor",
		&"blood_impact", &"smoke_puff", &"skeleton_death", &"reaper_trail",
		&"vampire_absorb", &"vampire_blink_departure", &"vampire_blink_arrival",
		&"vampire_tether", &"world_portal", &"world_sparkle",
	]:
		_expect(VfxCatalog.has_effect(effect_id), "catalog owns %s" % effect_id)
	_expect(
		SWORD.soul_echo_anchor_vfx_id == &"echo_anchor"
		and SWORD.soul_echo_ribbon_vfx_id == &"echo_ribbon"
		and SWORD.soul_echo_pursuit_marker_vfx_id == &"pursuit_marker",
		"Sword data owns the production Soul Echo VFX references"
	)

	var world := Node2D.new()
	get_root().add_child(world)
	var one_shot := VfxCatalog.spawn(world, &"echo_impact", Vector2(24.0, 18.0), PI * 0.25)
	_expect(one_shot != null, "catalog spawns an authored one-shot")
	if one_shot != null:
		var sprite := one_shot.get_node_or_null("LicensedEffect") as AnimatedSprite2D
		_expect(sprite != null, "one-shot owns an AnimatedSprite2D")
		_expect(sprite != null and sprite.sprite_frames.get_frame_count(&"play") == 7, "Echo impact loads all seven authored frames")
		_expect(sprite != null and sprite.material is ShaderMaterial, "Echo impact uses neutral monochrome tinting")

	var axe_throw := AXE_THROW_SCENE.instantiate()
	world.add_child(axe_throw)
	var axe_sprite := axe_throw.get_node_or_null("AxeSprite") as AnimatedSprite2D
	_expect(axe_sprite != null, "Axe throw uses an authored AnimatedSprite2D")
	_expect(axe_sprite != null and axe_sprite.sprite_frames.get_frame_count(&"play") == 8, "Axe throw uses all eight pre-rendered spin angles")
	_expect(axe_sprite != null and axe_sprite.sprite_frames.get_animation_loop(&"play"), "Axe throw spin animation loops")

	var spectral_disc := SPECTRAL_DISC_SCENE.instantiate()
	world.add_child(spectral_disc)
	var skull_sprite := spectral_disc.get_node_or_null("FloatingSkullAsset") as AnimatedSprite2D
	_expect(skull_sprite != null, "Bone Reaper projectile uses the authored Floating Skull asset")
	_expect(skull_sprite != null and skull_sprite.sprite_frames.get_animation_loop(&"play"), "Floating Skull animation loops")
	_expect(skull_sprite != null and skull_sprite.sprite_frames.get_frame_count(&"play") == 4, "Floating Skull uses all four source frames")
	_expect(skull_sprite != null and skull_sprite.material == null, "Floating Skull preserves the source palette without a monochrome shader")
	var all_skull_frames_loaded := skull_sprite != null
	if skull_sprite != null:
		for frame_index: int in skull_sprite.sprite_frames.get_frame_count(&"play"):
			all_skull_frames_loaded = (
				all_skull_frames_loaded
				and skull_sprite.sprite_frames.get_frame_texture(&"play", frame_index) != null
			)
	_expect(all_skull_frames_loaded, "Floating Skull frame textures are imported and loadable")
	var skull_hitbox := spectral_disc.get_node_or_null("CollisionShape2D") as CollisionShape2D
	var skull_shape := skull_hitbox.shape as CircleShape2D if skull_hitbox != null else null
	_expect(
		spectral_disc.collision_layer == 16 and spectral_disc.collision_mask == 2,
		"Floating Skull keeps the spectral projectile collision routing"
	)
	_expect(skull_shape != null and is_equal_approx(skull_shape.radius, 9.0), "Floating Skull keeps the spectral projectile hitbox")

	for production_asset: String in [
		"res://assets/vfx/axe/axe_charge_64x64_12.png",
		"res://assets/vfx/axe/axe_cleave_64x48_6.png",
		"res://assets/vfx/axe/axe_spin_32x32_8.png",
		"res://assets/vfx/sword/sword_pursuit_marker_24x24_6.png",
		"res://assets/vfx/sword/sword_echo_ribbon_48x24_6.png",
		"res://assets/characters/enemies/floating_skull/v1/idle_01.png",
		"res://assets/characters/enemies/floating_skull/v1/idle_02.png",
		"res://assets/characters/enemies/floating_skull/v1/idle_03.png",
		"res://assets/characters/enemies/floating_skull/v1/idle_04.png",
		"res://assets/vfx/enemy/vampire_blink_departure_48x48_10.png",
		"res://assets/vfx/enemy/vampire_tether_32x16_4.png",
		"res://assets/vfx/world/fantasy_portal_64x64_12.png",
	]:
		_expect(FileAccess.file_exists(production_asset), "production repack exists: %s" % production_asset)

	var combat_sources: Array[String] = [
		"res://game/vfx/vfx_catalog.gd",
		"res://game/heroes/sword/sword_soul_echo.gd",
		"res://game/heroes/sword/sword_crescent_wave.gd",
		"res://game/heroes/sword/sword_echo_wave.gd",
		"res://game/heroes/sword/returning_blade.gd",
		"res://game/heroes/sword/soul_interception.gd",
		"res://game/characters/knight/knight.gd",
		"res://game/characters/enemies/advanced_enemy.gd",
		"res://game/characters/enemies/spectral_disc.gd",
		"res://game/world/interactables/checkpoint.gd",
		"res://game/world/interactables/exit_gate.gd",
		"res://game/world/interactables/floor_door.gd",
		"res://game/world/interactables/sigil.gd",
	]
	var restricted_effect_free := true
	for source_path: String in combat_sources:
		var source := FileAccess.get_file_as_string(source_path)
		for restricted_token: String in ["Effect_Anima", "Effect_Worm", "Effect_Tentacles", "soul_anima"]:
			if source.contains(restricted_token):
				restricted_effect_free = false
	_expect(restricted_effect_free, "combat runtime never references rejected Anima, Worm, or Tentacles effects")
	_expect(
		not FileAccess.get_file_as_string("res://game/characters/enemies/spectral_disc.gd").contains("ElectricShield"),
		"Bone Reaper disc no longer disguises an electric shield as a weapon"
	)

	world.queue_free()
	await process_frame
	_finish()


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("VFX ASSET INTEGRATION TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("VFX ASSET INTEGRATION TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
