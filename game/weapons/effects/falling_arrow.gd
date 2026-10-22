class_name FallingArrowEffect
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

signal impact_confirmed(position: Vector2, hit_count: int)
signal target_hit(target: Node, damage: int)
signal completed(position: Vector2, hit_count: int)

const DEFAULT_ENEMY_MASK := 4
const MAX_IMPACT_TARGETS := 32

@export_range(0.05, 2.0, 0.01) var delay_seconds := 0.35
@export_range(4.0, 128.0, 1.0) var impact_radius := 22.0
@export_range(0.02, 1.0, 0.01) var impact_visual_seconds := 0.18
@export_flags_2d_physics var enemy_collision_mask := DEFAULT_ENEMY_MASK
@export var telegraph_color := Color(0.95, 0.24, 0.16, 0.82)
@export var arrow_color := Color(0.95, 0.82, 0.34, 1.0)

var _source: WeakRef
var _impact_position := Vector2.ZERO
var _damage := 0
var _weapon_id: StringName = &"bow"
var _remaining := 0.0
var _impact_visual_remaining := 0.0
var _configured := false
var _impacted := false
var _hit_count := 0

@onready var _telegraph_sprite: Sprite2D = %TelegraphSprite
@onready var _arrow_sprite: Sprite2D = %ArrowSprite


func _ready() -> void:
	top_level = true
	if _configured:
		global_position = _impact_position
	_sync_asset_visuals(0.0)


## Add the scene to a world/effects root, then call setup with the locked world
## position. A negative delay/radius keeps the scene defaults.
func setup(
		source: Node2D,
		locked_position: Vector2,
		damage_amount: int,
		source_weapon_id: StringName = &"bow",
		custom_delay_seconds: float = -1.0,
		custom_impact_radius: float = -1.0
) -> void:
	_source = weakref(source)
	_impact_position = locked_position
	_damage = maxi(0, damage_amount)
	_weapon_id = source_weapon_id
	if custom_delay_seconds >= 0.0:
		delay_seconds = maxf(0.01, custom_delay_seconds)
	if custom_impact_radius >= 0.0:
		impact_radius = maxf(1.0, custom_impact_radius)
	_remaining = delay_seconds
	_configured = true
	if is_inside_tree():
		global_position = _impact_position
		_sync_asset_visuals(0.0)


func setup_for_target(
		source: Node2D,
		target: Node2D,
		damage_amount: int,
		source_weapon_id: StringName = &"bow",
		prediction_seconds: float = 0.15,
		custom_delay_seconds: float = -1.0,
		custom_impact_radius: float = -1.0
) -> void:
	var locked_position := TargetingService.predict_target_position(target, prediction_seconds)
	setup(source, locked_position, damage_amount, source_weapon_id, custom_delay_seconds, custom_impact_radius)


func _physics_process(delta: float) -> void:
	if not _configured:
		return
	if not _impacted:
		_remaining = maxf(0.0, _remaining - delta)
		if _remaining <= 0.0:
			_impact()
	else:
		_impact_visual_remaining = maxf(0.0, _impact_visual_remaining - delta)
		if _impact_visual_remaining <= 0.0:
			completed.emit(_impact_position, _hit_count)
			queue_free()
	_sync_asset_visuals(delta)


func _impact() -> void:
	_impacted = true
	_impact_visual_remaining = impact_visual_seconds
	_telegraph_sprite.visible = false
	_arrow_sprite.visible = false
	VfxCatalog.spawn(
		get_parent(),
		&"bow_impact",
		_impact_position,
		0.0,
		maxf(0.72, impact_radius / 17.0),
		arrow_color,
		9
	)
	var circle := CircleShape2D.new()
	circle.radius = impact_radius
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = circle
	query.transform = Transform2D(0.0, _impact_position)
	query.collision_mask = enemy_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		query.exclude = [source.get_rid()]

	var hit_ids: Dictionary = {}
	for result: Dictionary in get_world_2d().direct_space_state.intersect_shape(query, MAX_IMPACT_TARGETS):
		var collider: Variant = result.get("collider")
		if not collider is Node:
			continue
		var target := collider as Node
		var target_id := target.get_instance_id()
		if hit_ids.has(target_id):
			continue
		hit_ids[target_id] = true
		if CombatDamage.apply_confirmed(target, _damage, _impact_position, _weapon_id, {
			"hero_id": &"archer_hero",
			"source_kind": &"projectile",
		}):
			_hit_count += 1
			target_hit.emit(target, _damage)
	impact_confirmed.emit(_impact_position, _hit_count)


func _sync_asset_visuals(delta: float) -> void:
	if not is_instance_valid(_telegraph_sprite) or not is_instance_valid(_arrow_sprite):
		return
	if not _configured:
		_telegraph_sprite.visible = false
		_arrow_sprite.visible = false
		return
	if _impacted:
		_telegraph_sprite.visible = false
		_arrow_sprite.visible = false
		return

	var progress := 1.0 - clampf(_remaining / maxf(delay_seconds, 0.001), 0.0, 1.0)
	var pulse := 0.90 + sin(progress * TAU * 2.0) * 0.08
	_telegraph_sprite.visible = true
	_telegraph_sprite.rotation += delta * 1.8
	_telegraph_sprite.scale = Vector2.ONE * maxf(0.2, impact_radius / 18.0) * pulse
	_telegraph_sprite.modulate = Color(telegraph_color, 0.52 + progress * 0.34)

	var fall_progress := clampf((progress - 0.18) / 0.82, 0.0, 1.0)
	_arrow_sprite.visible = progress >= 0.12
	_arrow_sprite.position = Vector2(0.0, lerpf(-52.0, -3.0, fall_progress * fall_progress))
	_arrow_sprite.modulate = arrow_color
