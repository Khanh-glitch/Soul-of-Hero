class_name VfxCatalog
extends RefCounted

## Runtime facade for the Inspector-authored VFX library.  Keep game code on
## stable IDs (`VfxCatalog.spawn(parent, &"bow_impact", ...)`) while designers
## freely tune texture, frames, tint, scale and sorting in one `.tres` file.

const OneShotVfx := preload("res://game/vfx/one_shot_spritesheet_vfx.gd")
const LIBRARY: VfxLibrary = preload("res://data/content/vfx/vfx_library.tres")

## Reuse completed one-shot nodes by effect ID. The pool grows to the real peak
## concurrent density and prevents combat hitches caused by repeat allocation.
static var _one_shot_pools: Dictionary = {}


static func spawn(
		parent: Node,
		effect_id: StringName,
		world_position: Vector2,
		angle := 0.0,
		scale_multiplier := 1.0,
		custom_tint := Color.TRANSPARENT,
		z := 100
) -> OneShotSpriteSheetVfx:
	if parent == null:
		return null
	var profile := get_effect(effect_id)
	if profile == null:
		return null
	var effect := _acquire_one_shot(effect_id)
	if effect == null:
		effect = OneShotVfx.new() as OneShotSpriteSheetVfx
		var new_pool := _pool_for(effect_id)
		new_pool.append(effect)
		_one_shot_pools[effect_id] = new_pool
	if effect.get_parent() != parent:
		if effect.get_parent() == null:
			parent.add_child(effect)
		else:
			effect.reparent(parent)
	var tint: Color = profile.tint if custom_tint.a <= 0.0 else custom_tint
	var resolved_z := profile.default_z_index if z == 100 else z
	if not effect.configure(
		profile.texture,
		profile.cell_size,
		profile.frame_count,
		profile.frames_per_second,
		profile.columns,
		world_position + profile.local_position_offset.rotated(angle),
		profile.base_scale * maxf(0.05, scale_multiplier),
		tint,
		angle + deg_to_rad(profile.rotation_offset_degrees),
		resolved_z,
		profile.use_monochrome_tint
	):
		return null
	return effect


static func get_effect(effect_id: StringName) -> VfxDefinition:
	return LIBRARY.find(effect_id) if LIBRARY != null else null


static func has_effect(effect_id: StringName) -> bool:
	return get_effect(effect_id) != null


static func get_validation_errors() -> PackedStringArray:
	if LIBRARY == null:
		return PackedStringArray(["VFX library could not be loaded."])
	return LIBRARY.get_validation_errors()


static func _pool_for(effect_id: StringName) -> Array[OneShotSpriteSheetVfx]:
	var value: Variant = _one_shot_pools.get(effect_id, [])
	var result: Array[OneShotSpriteSheetVfx] = []
	if value is Array:
		for candidate: Variant in value as Array:
			# Scene changes can free inactive pooled nodes. Checking liveness avoids
			# touching a freed Variant and lets the pool grow again cleanly.
			if is_instance_valid(candidate):
				result.append(candidate as OneShotSpriteSheetVfx)
	_one_shot_pools[effect_id] = result
	return result


static func _acquire_one_shot(effect_id: StringName) -> OneShotSpriteSheetVfx:
	var pool := _pool_for(effect_id)
	for effect: OneShotSpriteSheetVfx in pool:
		if is_instance_valid(effect) and effect.is_available():
			return effect
	return null
