class_name SpriteSheetVfxFactory
extends RefCounted

## Builds nearest-filtered SpriteFrames from a fixed grid without duplicating
## or cropping the licensed source sheet on disk.

## Combos may emit dozens of identical particles in a short window.  The grid
## is immutable after creation, so sharing it removes repeated AtlasTexture /
## SpriteFrames allocation without reducing particle count, resolution or FPS.
static var _grid_cache: Dictionary = {}

static func build_grid(
		texture: Texture2D,
		cell_size: Vector2i,
		frame_count: int,
		frames_per_second: float,
		columns: int = 6
) -> SpriteFrames:
	if texture == null:
		return SpriteFrames.new()
	var cache_key := "%d:%d:%d:%d:%d:%d" % [
		texture.get_instance_id(), cell_size.x, cell_size.y, frame_count,
		roundi(frames_per_second * 100.0), columns,
	]
	var cached := _grid_cache.get(cache_key) as SpriteFrames
	if cached != null:
		return cached
	var result := SpriteFrames.new()
	result.remove_animation(&"default")
	result.add_animation(&"play")
	result.set_animation_loop(&"play", false)
	result.set_animation_speed(&"play", frames_per_second)
	for index: int in frame_count:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(
			Vector2((index % columns) * cell_size.x, (index / columns) * cell_size.y),
			Vector2(cell_size)
		)
		result.add_frame(&"play", atlas)
	_grid_cache[cache_key] = result
	return result
