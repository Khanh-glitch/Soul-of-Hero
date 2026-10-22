class_name SpriteFrameFactory
extends RefCounted

## Small runtime atlas helper used by the world scenes. Keeping frame construction
## here means every scene remains drag-and-drop ready without generated .tres files.

static var _radial_texture_cache: Dictionary = {}


static func empty() -> SpriteFrames:
	var frames := SpriteFrames.new()
	if frames.has_animation(&"default"):
		frames.remove_animation(&"default")
	return frames


static func add_file_animation(
		frames: SpriteFrames,
		animation_name: StringName,
		file_paths: PackedStringArray,
		fps: float = 8.0,
		looped: bool = true
) -> void:
	_reset_animation(frames, animation_name, fps, looped)
	for file_path: String in file_paths:
		var texture := load(file_path) as Texture2D
		if texture == null:
			push_error("Missing animation frame: %s" % file_path)
			continue
		frames.add_frame(animation_name, texture)


static func add_strip_animation(
		frames: SpriteFrames,
		animation_name: StringName,
		texture_path: String,
		frame_size: Vector2i,
		frame_count: int,
		fps: float = 8.0,
		looped: bool = true
) -> void:
	_reset_animation(frames, animation_name, fps, looped)
	var texture := load(texture_path) as Texture2D
	if texture == null:
		push_error("Missing sprite strip: %s" % texture_path)
		return

	for frame_index: int in frame_count:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(
			Vector2(frame_index * frame_size.x, 0),
			Vector2(frame_size)
		)
		frames.add_frame(animation_name, atlas)


static func make_radial_texture(size: int = 64) -> Texture2D:
	var cached := _radial_texture_cache.get(size) as Texture2D
	if cached != null:
		return cached

	var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var center := Vector2(size - 1, size - 1) * 0.5
	var radius := maxf(center.x, 1.0)
	for y: int in size:
		for x: int in size:
			var distance := Vector2(x, y).distance_to(center) / radius
			var alpha := clampf(1.0 - distance, 0.0, 1.0)
			alpha = alpha * alpha
			image.set_pixel(x, y, Color(1.0, 1.0, 1.0, alpha))
	var texture := ImageTexture.create_from_image(image)
	_radial_texture_cache[size] = texture
	return texture


static func _reset_animation(
		frames: SpriteFrames,
		animation_name: StringName,
		fps: float,
		looped: bool
) -> void:
	if frames.has_animation(animation_name):
		frames.remove_animation(animation_name)
	frames.add_animation(animation_name)
	frames.set_animation_speed(animation_name, maxf(fps, 0.01))
	frames.set_animation_loop(animation_name, looped)
