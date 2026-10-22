class_name OneShotSpriteSheetVfx
extends Node2D

const VfxFactory := preload("res://game/vfx/spritesheet_vfx_factory.gd")
const MONOCHROME_SHADER := preload("res://game/vfx/monochrome_tint.gdshader")

var _sprite: AnimatedSprite2D
var _monochrome_material: ShaderMaterial
var _configured := false
var _active := false


func configure(
		texture: Texture2D,
		cell_size: Vector2i,
		frame_count: int,
		frames_per_second: float,
		columns: int,
		world_position: Vector2,
		visual_scale: Vector2 = Vector2.ONE,
		tint := Color.WHITE,
		angle := 0.0,
		z := 100,
		monochrome := false
) -> bool:
	if texture == null or cell_size.x <= 0 or cell_size.y <= 0 or frame_count <= 0:
		return false
	global_position = world_position
	rotation = angle
	z_index = z
	top_level = true
	_ensure_sprite()
	_sprite.sprite_frames = VfxFactory.build_grid(
		texture,
		cell_size,
		frame_count,
		maxf(1.0, frames_per_second),
		maxi(1, columns)
	)
	_sprite.scale = visual_scale
	if monochrome:
		if _monochrome_material == null:
			_monochrome_material = ShaderMaterial.new()
			_monochrome_material.shader = MONOCHROME_SHADER
		_monochrome_material.resource_local_to_scene = true
		_monochrome_material.set_shader_parameter(&"tint", tint)
		_sprite.material = _monochrome_material
		_sprite.modulate = Color.WHITE
	else:
		_sprite.material = null
		_sprite.modulate = tint
	_configured = true
	_active = true
	visible = true
	if is_node_ready():
		_play_from_start()
	return true


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	if not _configured or not is_instance_valid(_sprite):
		visible = false
		_active = false
		return
	_play_from_start()


func is_available() -> bool:
	return not _active


func _ensure_sprite() -> void:
	if is_instance_valid(_sprite):
		return
	_sprite = AnimatedSprite2D.new()
	_sprite.name = "LicensedEffect"
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_sprite.animation_finished.connect(_finish)
	add_child(_sprite)


func _play_from_start() -> void:
	if not is_instance_valid(_sprite):
		return
	_sprite.stop()
	_sprite.frame = 0
	_sprite.play(&"play")


func _finish() -> void:
	if not is_instance_valid(_sprite):
		return
	_sprite.stop()
	_active = false
	visible = false
