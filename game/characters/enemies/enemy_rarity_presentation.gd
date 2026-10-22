class_name EnemyRarityPresentation
extends RefCounted

## Applies an idempotent rarity treatment directly to the enemy silhouette.
## The authored shader material replaces the old circular rear auras, while
## scale remains visual-only so collision and navigation footprints stay fair.

const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const GLOW_MATERIAL: ShaderMaterial = preload(
	"res://game/characters/enemies/enemy_rarity_glow_material.tres"
)

const BASE_SCALE_META := &"enemy_rarity_base_visual_scale"
const APPLIED_SCALE_META := &"enemy_rarity_visual_scale_multiplier"
const PRESENTED_RARITY_META := &"enemy_rarity_presented"
const GLOW_COLOR_META := &"enemy_rarity_glow_color"
const SCALE_MULTIPLIERS := [1.0, 1.05, 1.10, 1.16, 1.23, 1.30, 1.38, 1.47]


static func apply_to(enemy: Node, rarity_value: Variant) -> bool:
	if not is_instance_valid(enemy):
		return false
	_remove_legacy_rear_auras(enemy)
	var sprite := enemy.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
	if sprite == null:
		return false

	var rarity := RARITY_PALETTE.normalize(rarity_value)
	var rarity_index := RARITY_PALETTE.index(rarity)
	var previous_multiplier := maxf(
		0.01,
		float(enemy.get_meta(APPLIED_SCALE_META, 1.0))
	)
	var base_scale := sprite.scale
	var stored_base: Variant = (
		enemy.get_meta(BASE_SCALE_META)
		if enemy.has_meta(BASE_SCALE_META)
		else base_scale
	)
	if stored_base is Vector2:
		base_scale = stored_base as Vector2
		var expected_scale := base_scale * previous_multiplier
		# A live character-form replacement can swap the visual node's authored
		# scale. Treat a material reset as a new unscaled base; known gameplay
		# scaling uses multiply_base_visual_scale() below.
		if not sprite.scale.is_equal_approx(expected_scale):
			base_scale = (
				sprite.scale
				if not sprite.material is ShaderMaterial
				else sprite.scale / previous_multiplier
			)
	enemy.set_meta(BASE_SCALE_META, base_scale)

	var scale_multiplier := scale_multiplier_for(rarity)
	sprite.scale = base_scale * scale_multiplier
	var material := GLOW_MATERIAL.duplicate(true) as ShaderMaterial
	var rarity_color := RARITY_PALETTE.color(rarity)
	material.set_shader_parameter(&"rarity_color", rarity_color)
	material.set_shader_parameter(
		&"outline_pixels",
		0.0 if rarity_index == 0 else 0.92 + float(rarity_index) * 0.13
	)
	material.set_shader_parameter(
		&"glow_strength",
		0.0 if rarity_index == 0 else 0.26 + float(rarity_index) * 0.075
	)
	material.set_shader_parameter(
		&"body_tint_strength",
		0.0 if rarity_index == 0 else 0.045 + float(rarity_index) * 0.018
	)
	sprite.material = material
	enemy.set_meta(APPLIED_SCALE_META, scale_multiplier)
	enemy.set_meta(PRESENTED_RARITY_META, rarity)
	enemy.set_meta(GLOW_COLOR_META, rarity_color)
	return true


static func scale_multiplier_for(rarity_value: Variant) -> float:
	return float(SCALE_MULTIPLIERS[RARITY_PALETTE.index(rarity_value)])


static func multiply_base_visual_scale(enemy: Node, multiplier: float) -> bool:
	if not is_instance_valid(enemy) or multiplier <= 0.0:
		return false
	var sprite := enemy.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
	if sprite == null:
		return false
	var applied_multiplier := maxf(
		0.01,
		float(enemy.get_meta(APPLIED_SCALE_META, 1.0))
	)
	var base_scale := sprite.scale / applied_multiplier
	if enemy.has_meta(BASE_SCALE_META):
		var stored: Variant = enemy.get_meta(BASE_SCALE_META)
		if stored is Vector2:
			base_scale = stored as Vector2
	base_scale *= multiplier
	enemy.set_meta(BASE_SCALE_META, base_scale)
	sprite.scale = base_scale * applied_multiplier
	return true


static func _remove_legacy_rear_auras(enemy: Node) -> void:
	for node_name: StringName in [&"LootRarityAura", &"EliteAura"]:
		var legacy := enemy.get_node_or_null(NodePath(String(node_name)))
		if legacy != null and not legacy.is_queued_for_deletion():
			legacy.queue_free()
