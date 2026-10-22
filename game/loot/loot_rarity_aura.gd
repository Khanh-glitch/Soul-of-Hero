class_name LootRarityAura
extends AnimatedSprite2D

## Asset-backed rarity marker. It intentionally uses the authored interaction
## sparkle strip rather than drawing circles/particles from code.

const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const SPARKLE_TEXTURE := preload("res://assets/vfx/world/interaction_sparkle_32x32_8.png")
const FRAME_SIZE := Vector2i(32, 32)
const FRAME_COUNT := 8

static var _shared_frames: SpriteFrames


func configure(rarity_value: Variant, large := false) -> void:
	name = "LootRarityAura"
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	centered = true
	sprite_frames = _build_frames()
	var rarity_index := RARITY_PALETTE.index(rarity_value)
	var tint := RARITY_PALETTE.color(rarity_value)
	tint.a = clampf(0.34 + float(rarity_index) * 0.065, 0.34, 0.84)
	modulate = tint
	var base_scale := 0.72 + float(rarity_index) * 0.045
	if large:
		base_scale *= 1.35
	scale = Vector2.ONE * base_scale
	# Draw behind the owning sprite without dropping below the dungeon floor's
	# canvas layer (a negative z-index made faint Normal/Magic auras disappear).
	z_index = 0
	show_behind_parent = true
	speed_scale = 0.72 + float(rarity_index) * 0.08
	play(&"glow")


func _build_frames() -> SpriteFrames:
	if _shared_frames != null:
		return _shared_frames
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	frames.add_animation(&"glow")
	frames.set_animation_loop(&"glow", true)
	frames.set_animation_speed(&"glow", 12.0)
	for frame_index: int in FRAME_COUNT:
		var atlas := AtlasTexture.new()
		atlas.atlas = SPARKLE_TEXTURE
		atlas.region = Rect2(
			Vector2(frame_index * FRAME_SIZE.x, 0),
			Vector2(FRAME_SIZE)
		)
		frames.add_frame(&"glow", atlas)
	_shared_frames = frames
	return _shared_frames
