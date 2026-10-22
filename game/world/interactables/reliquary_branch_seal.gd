class_name ReliquaryBranchSeal
extends Area2D

signal branch_chosen(branch_id: StringName, seal: ReliquaryBranchSeal)

const SpriteFramesFactory := preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const FLAG_PATHS := [
	"res://assets/environment/dungeon/items/flag/flag_1.png",
	"res://assets/environment/dungeon/items/flag/flag_2.png",
	"res://assets/environment/dungeon/items/flag/flag_3.png",
	"res://assets/environment/dungeon/items/flag/flag_4.png",
]

enum SealState {
	AVAILABLE,
	CHOSEN,
	LOCKED,
}

@export var branch_id: StringName = &"reaper"
@export var display_name := "REAPER RELIC"
@export var interaction_message := "Nhấn chuột trái để chọn nhánh Thần Vật. Lựa chọn này là vĩnh viễn."

@onready var _sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var _glow: PointLight2D = %Glow
@onready var _label: Label = %BranchLabel
@onready var _barrier_shape: CollisionShape2D = %BarrierShape
@onready var _aura: Sprite2D = %SealAura
@onready var _slash_a: Line2D = %SealSlashA
@onready var _slash_b: Line2D = %SealSlashB

var _nearby_player: Node2D
var _state := SealState.AVAILABLE
var _elapsed := 0.0
var _choice_authority: Callable


func _ready() -> void:
	add_to_group(&"player_interactable")
	_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(_sprite.sprite_frames, &"pulse", FLAG_PATHS, 7.0, true)
	_sprite.play(&"pulse")
	_glow.texture = SpriteFramesFactory.make_radial_texture(84)
	_refresh_presentation()


func _process(delta: float) -> void:
	_elapsed += delta
	_sprite.position.y = -18.0 + sin(_elapsed * 2.6) * 1.5
	_glow.energy = (0.75 if _state == SealState.AVAILABLE else 0.38) + sin(_elapsed * 4.0) * 0.08
	_aura.frame = int(floor(_elapsed * 12.0)) % maxi(1, _aura.hframes)
	_aura.scale = Vector2.ONE * (0.86 + sin(_elapsed * 3.4) * 0.08)


func can_interact(player: Node2D) -> bool:
	return is_instance_valid(player) and player == _nearby_player and _state == SealState.AVAILABLE


func interact(player: Node2D) -> bool:
	if not is_instance_valid(player) or player != _nearby_player:
		return false
	if _state == SealState.LOCKED:
		_toast("Thần vật đã tắt khi bạn chọn nhánh còn lại.")
		return true
	if _state == SealState.CHOSEN:
		_toast("%s đã được chọn." % display_name)
		return true
	# A level runtime can make branch materialisation transactional.  Rejecting
	# the request leaves this seal AVAILABLE, so a transient spawn/Elite failure
	# cannot consume the player's one irreversible choice.
	if _choice_authority.is_valid() \
			and not bool(_choice_authority.call(branch_id, self)):
		_toast("Chưa thể liên kết thần vật. Hãy thử lại.")
		return true
	_state = SealState.CHOSEN
	_refresh_presentation()
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -4.0), 0.0, 1.0, Color("79f0c8"), 8)
	VfxCatalog.spawn(get_parent(), &"echo_anchor", global_position + Vector2(0.0, -4.0), 0.0, 0.72, Color(0.48, 0.94, 0.78, 0.68), 7)
	branch_chosen.emit(branch_id, self)
	return true


func set_choice_authority(authority: Callable) -> void:
	_choice_authority = authority


func set_branch_state(value: int) -> void:
	_state = clampi(value, SealState.AVAILABLE, SealState.LOCKED)
	if is_node_ready():
		_refresh_presentation()


func get_branch_state() -> int:
	return _state


func _on_body_entered(body: Node2D) -> void:
	if not body.is_in_group(&"player"):
		return
	_nearby_player = body
	if _state == SealState.AVAILABLE:
		_toast(interaction_message)
	elif _state == SealState.LOCKED:
		_toast("%s đã bị khóa bởi lựa chọn đầu tiên." % display_name)


func _on_body_exited(body: Node2D) -> void:
	if body == _nearby_player:
		_nearby_player = null


func _refresh_presentation() -> void:
	var color := _branch_color()
	match _state:
		SealState.CHOSEN:
			color = Color("79f0c8")
		SealState.LOCKED:
			color = Color("5f5968")
	_sprite.modulate = color
	_glow.color = color
	_label.text = "%s\n%s" % [display_name, _state_name()]
	_label.modulate = color.lightened(0.18)
	_aura.modulate = Color(color, 0.52 if _state == SealState.AVAILABLE else 0.30)
	_slash_a.default_color = Color(color, 0.88)
	_slash_b.default_color = Color(color, 0.88)
	_barrier_shape.set_deferred(&"disabled", _state == SealState.CHOSEN)


func _branch_color() -> Color:
	return Color("f29a52") if branch_id == &"reaper" else Color("d86aff")


func _state_name() -> String:
	match _state:
		SealState.CHOSEN:
			return "ĐÃ CHỌN"
		SealState.LOCKED:
			return "ĐÃ KHÓA"
	return "CHUỘT TRÁI"


func _toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"toast_requested"):
		events.emit_signal(&"toast_requested", message)
