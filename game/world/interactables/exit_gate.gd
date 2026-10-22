class_name ExitGate
extends Area2D

signal gate_opened
signal player_exited

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const VfxFactory := preload("res://game/vfx/spritesheet_vfx_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const MONOCHROME_SHADER := preload("res://game/vfx/monochrome_tint.gdshader")
const FANTASY_PORTAL := preload("res://assets/vfx/world/fantasy_portal_64x64_12.png")
const SEAL_FRAME_PATHS := [
	"res://assets/environment/dungeon/items/coin/coin_1.png",
	"res://assets/environment/dungeon/items/coin/coin_2.png",
	"res://assets/environment/dungeon/items/coin/coin_3.png",
	"res://assets/environment/dungeon/items/coin/coin_4.png",
]

@export var locked_color := Color(0.74, 0.22, 0.43, 1.0)
@export var open_color := Color(0.22, 0.92, 0.95, 1.0)

@onready var seal: AnimatedSprite2D = %Seal
@onready var portal_light: PointLight2D = %PortalLight
@onready var gate_arch: Sprite2D = %GateArch

var is_open := false
var _elapsed := 0.0
var _current_sigils := 0
var _required_sigils := 3
var _requires_encounter_clear := false
var _encounter_cleared := true
var _remaining_encounter_enemies := 0
var _portal_vfx: AnimatedSprite2D


func _ready() -> void:
	seal.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		seal.sprite_frames,
		&"spin",
		PackedStringArray(SEAL_FRAME_PATHS),
		9.0,
		true
	)
	seal.play(&"spin")
	_create_portal_vfx()
	portal_light.texture = SpriteFramesFactory.make_radial_texture(96)
	_current_sigils = GameSession.sigils
	_required_sigils = GameSession.required_sigils
	GameEvents.sigil_collected.connect(_on_sigil_collected)
	_set_open(can_open())


func _process(delta: float) -> void:
	_elapsed += delta
	seal.rotation += delta * (1.5 if is_open else 0.45)
	portal_light.energy = (
		0.9 + sin(_elapsed * 4.0) * 0.12
		if is_open
		else 0.25 + sin(_elapsed * 2.0) * 0.05
	)


func _on_sigil_collected(current: int, required: int) -> void:
	_current_sigils = current
	_required_sigils = required
	_set_open(can_open())


func configure_encounter_requirement(required: bool, cleared: bool, remaining_enemies: int) -> void:
	# Sigils and enemy clears are optional rewards now; arriving at the exit is
	# the only completion condition.
	_requires_encounter_clear = false
	_encounter_cleared = true
	_remaining_encounter_enemies = 0
	if is_node_ready():
		_set_open(can_open())


func is_encounter_requirement_cleared() -> bool:
	return not _requires_encounter_clear or _encounter_cleared


func can_open() -> bool:
	return true


func _set_open(value: bool) -> void:
	if is_open == value and portal_light.color == (open_color if value else locked_color):
		return
	is_open = value
	var color := open_color if is_open else locked_color
	seal.modulate = color
	portal_light.color = color
	gate_arch.modulate = color.lerp(Color.WHITE, 0.62)
	_update_portal_tint(color)
	if is_open:
		VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -25.0), 0.0, 1.35, open_color, 7)
		VfxCatalog.spawn(get_parent(), &"world_portal", global_position + Vector2(0.0, -25.0), 0.0, 0.82, Color(open_color, 0.58), 6)
		gate_opened.emit()


func _create_portal_vfx() -> void:
	_portal_vfx = AnimatedSprite2D.new()
	_portal_vfx.name = "PortalAssetVfx"
	_portal_vfx.position = Vector2(0.0, -25.0)
	_portal_vfx.z_index = 0
	_portal_vfx.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_portal_vfx.sprite_frames = VfxFactory.build_grid(FANTASY_PORTAL, Vector2i(64, 64), 12, 18.0, 12)
	_portal_vfx.sprite_frames.set_animation_loop(&"play", true)
	_portal_vfx.scale = Vector2.ONE * 0.72
	var portal_material := ShaderMaterial.new()
	portal_material.shader = MONOCHROME_SHADER
	_portal_vfx.material = portal_material
	add_child(_portal_vfx)
	_portal_vfx.play(&"play")


func _update_portal_tint(color: Color) -> void:
	if not is_instance_valid(_portal_vfx):
		return
	var portal_material := _portal_vfx.material as ShaderMaterial
	if portal_material != null:
		portal_material.set_shader_parameter(&"tint", Color(color, 0.76 if is_open else 0.36))


func _on_body_entered(body: Node2D) -> void:
	if not body.is_in_group(&"player"):
		return
	if not is_open:
		if _current_sigils < _required_sigils and not is_encounter_requirement_cleared():
			GameEvents.toast_requested.emit(
				"Cổng đang khóa: cần %d/%d ấn ký và hạ %d kẻ địch" % [
					_current_sigils,
					_required_sigils,
					_remaining_encounter_enemies,
				]
			)
		elif not is_encounter_requirement_cleared():
			GameEvents.toast_requested.emit(
				"Cổng đang khóa: còn %d kẻ địch phải hạ" % _remaining_encounter_enemies
			)
		else:
			GameEvents.toast_requested.emit(
				"Cổng đang khóa: cần %d/%d ấn ký" % [_current_sigils, _required_sigils]
			)
		return
	if GameSession.objective_finished:
		return
	VfxCatalog.spawn(get_parent(), &"world_portal", body.global_position, 0.0, 0.78, Color(open_color, 0.62), 8)
	GameSession.complete_objective()
	player_exited.emit()
	GameEvents.toast_requested.emit("Nhiệm vụ hoàn thành!")
