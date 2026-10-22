class_name DamageSpikes
extends Area2D

signal damaged(body: Node2D, amount: int)

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const SPIKE_FRAME_PATHS := [
	"res://assets/environment/dungeon/items/spikes/peaks_1.png",
	"res://assets/environment/dungeon/items/spikes/peaks_2.png",
	"res://assets/environment/dungeon/items/spikes/peaks_3.png",
	"res://assets/environment/dungeon/items/spikes/peaks_4.png",
]

@export_range(1, 999, 1) var damage: int = 20
@export_range(0.1, 5.0, 0.05) var damage_interval: float = 0.8
@export var affects_player := true
@export var affects_enemies := true
@export var damage_owner: StringName = &"dungeon"
@export var damage_faction: StringName = &"neutral_hazard"

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var damage_timer: Timer = %DamageTimer

var _tracked_bodies: Dictionary = {}
var _next_damage_at_msec: Dictionary = {}


func _ready() -> void:
	add_to_group(&"dungeon_hazards")
	set_meta(&"damage_owner", damage_owner)
	set_meta(&"damage_faction", damage_faction)
	animated_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		animated_sprite.sprite_frames,
		&"active",
		PackedStringArray(SPIKE_FRAME_PATHS),
		8.0,
		true
	)
	animated_sprite.play(&"active")
	# A short sampler plus one deadline per target prevents a body that entered
	# late from inheriting another target's cooldown.
	damage_timer.wait_time = minf(0.05, damage_interval)
	damage_timer.one_shot = false


func _on_body_entered(body: Node2D) -> void:
	if not can_damage_body(body):
		return
	var body_id := body.get_instance_id()
	if not _tracked_bodies.has(body_id):
		_tracked_bodies[body_id] = body
		_damage_body(body, Time.get_ticks_msec())
	if damage_timer.is_stopped():
		damage_timer.start()


func _on_body_exited(body: Node2D) -> void:
	var body_id := body.get_instance_id()
	_tracked_bodies.erase(body_id)
	_next_damage_at_msec.erase(body_id)
	if _tracked_bodies.is_empty():
		damage_timer.stop()


func _on_damage_timer_timeout() -> void:
	var now_msec := Time.get_ticks_msec()
	for raw_body_id: Variant in _tracked_bodies.keys():
		var body := _tracked_bodies.get(raw_body_id) as Node2D
		if not is_instance_valid(body) or not can_damage_body(body):
			_tracked_bodies.erase(raw_body_id)
			_next_damage_at_msec.erase(raw_body_id)
			continue
		if now_msec >= int(_next_damage_at_msec.get(raw_body_id, 0)):
			_damage_body(body, now_msec)
	if _tracked_bodies.is_empty():
		damage_timer.stop()


func can_damage_body(body: Node) -> bool:
	if body == null or not body.has_method(&"take_damage"):
		return false
	return (
		(affects_player and body.is_in_group(&"player"))
		or (affects_enemies and body.is_in_group(&"enemies"))
	)


func get_damage_contract() -> Dictionary:
	return {
		"owner": damage_owner,
		"faction": damage_faction,
		"damage": damage,
		"cooldown_seconds": damage_interval,
		"affects_player": affects_player,
		"affects_enemies": affects_enemies,
	}


func _damage_body(body: Node2D, now_msec: int) -> bool:
	if not can_damage_body(body):
		return false
	var body_id := body.get_instance_id()
	_next_damage_at_msec[body_id] = now_msec + ceili(damage_interval * 1000.0)
	var confirmed: Variant = body.call(&"take_damage", damage, global_position)
	if confirmed is bool and not bool(confirmed):
		return false
	damaged.emit(body, damage)
	return true
