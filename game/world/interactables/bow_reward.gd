class_name BowReward
extends Area2D

signal claimed(player: Node)

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

@export var bob_height := 3.0
@export var bob_speed := 2.3
@export_range(0.0, 60.0, 0.5) var activation_delay_seconds := 12.0

@onready var reward_label: Label = $RewardLabel
@onready var reward_aura: Sprite2D = %RewardAura
@onready var bow_curve: Line2D = %BowCurve
@onready var bow_string: Line2D = %BowString
@onready var arrow_sprite: Sprite2D = %ArrowSprite

var _origin_y := 0.0
var _elapsed := 0.0
var _claiming := false
var _active := false
var _activation_remaining := 0.0
var _gate_poll_remaining := 0.0


func _ready() -> void:
	collision_layer = 1 << 5
	collision_mask = 1 << 1
	_origin_y = position.y
	_activation_remaining = activation_delay_seconds
	body_entered.connect(_on_body_entered)
	# The durable unlock is authoritative. On a returning profile the Bow is
	# already rendered in its saved Hand/Spirit slot, so this pickup stays gone.
	if UnlockService.is_weapon_unlocked(&"bow"):
		queue_free()
		return
	monitoring = false
	reward_label.text = "CUNG LINH HỒN  •  HOÀN THÀNH HƯỚNG DẪN"
	_refresh_asset_visuals()


func _process(delta: float) -> void:
	_elapsed += delta
	position.y = _origin_y + sin(_elapsed * bob_speed) * bob_height
	if not _active:
		_activation_remaining = maxf(0.0, _activation_remaining - delta)
		_gate_poll_remaining -= delta
		if _gate_poll_remaining <= 0.0:
			_gate_poll_remaining = 0.25
			_try_activate()
	_refresh_asset_visuals()


func _try_activate() -> void:
	if _active or _activation_remaining > 0.0:
		return
	var tutorials: Dictionary = SaveService.get_snapshot().get("tutorials", {})
	for required_step: String in ["movement", "attack", "dash_slash", "dash"]:
		if not bool(tutorials.get(required_step, false)):
			return
	_active = true
	monitoring = true
	reward_label.text = "CUNG LINH HỒN"
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, 2.0), 0.0, 1.25, Color(0.36, 0.88, 1.0, 0.92), 8)
	VfxCatalog.spawn(get_parent(), &"echo_anchor", global_position + Vector2(0.0, 2.0), 0.0, 0.78, Color(0.44, 0.88, 1.0, 0.66), 7)
	GameEvents.toast_requested.emit("Cung Linh Hồn đã thức tỉnh ở hành lang phía Đông")


func _on_body_entered(body: Node) -> void:
	if not _active or _claiming or not body.has_method(&"grant_bow_reward"):
		return
	_claiming = true
	if not bool(body.call(&"grant_bow_reward")):
		_claiming = false
		return
	claimed.emit(body)
	monitoring = false
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 1.45, Color(0.58, 0.94, 1.0, 0.96), 9)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "scale", Vector2(1.6, 1.6), 0.22)
	tween.tween_property(self, "modulate:a", 0.0, 0.22)
	tween.chain().tween_callback(queue_free)


func _refresh_asset_visuals() -> void:
	var glow_scale := 1.0 if _active else 0.45
	reward_aura.frame = int(floor(_elapsed * 13.0)) % maxi(1, reward_aura.hframes)
	reward_aura.scale = Vector2.ONE * (0.92 + sin(_elapsed * 4.2) * 0.10)
	reward_aura.modulate = Color(0.36, 0.88, 1.0, (0.22 + sin(_elapsed * 4.0) * 0.05) * glow_scale)
	bow_curve.default_color = Color(0.84, 0.60, 0.34, 0.96 if _active else 0.48)
	bow_string.default_color = Color(0.75, 0.96, 1.0, 0.96 if _active else 0.48)
	arrow_sprite.modulate = Color(1.0, 0.90, 0.62, 1.0 if _active else 0.52)
