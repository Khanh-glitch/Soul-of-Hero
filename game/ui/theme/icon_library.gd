class_name LivingArsenalIcons
extends RefCounted

const ATLAS: Texture2D = preload("res://assets/ui/fantasy_icons.png")

const SWORD := Vector2i(1, 5)
const BOW := Vector2i(3, 6)
const AXE := Vector2i(10, 5)
# The atlas has no clean staff silhouette at the shared 32px scale; the
# arcane Soul glyph remains legible at button size and distinguishes Wizard
# from the physical-weapon identities.
const STAFF := Vector2i(13, 4)
const CAMPAIGN := Vector2i(12, 13)
const ARSENAL := Vector2i(0, 10)
const MODES := Vector2i(9, 17)
const BESTIARY := Vector2i(8, 13)
const SETTINGS := Vector2i(4, 4)
const LOCK := Vector2i(1, 17)
const BOOK := Vector2i(6, 13)
const BACK := Vector2i(5, 2)
const PLAY := Vector2i(2, 2)
const RETRY := Vector2i(6, 2)
const HOME := Vector2i(12, 13)
const CHECK := Vector2i(2, 2)
const SOUL := Vector2i(13, 4)


static func texture(cell: Vector2i) -> AtlasTexture:
	var atlas_texture := AtlasTexture.new()
	atlas_texture.atlas = ATLAS
	atlas_texture.region = Rect2(Vector2(cell * 32), Vector2(32, 32))
	return atlas_texture


static func apply_to_button(button: Button, cell: Vector2i, max_width := 18) -> void:
	button.icon = texture(cell)
	button.expand_icon = true
	button.add_theme_constant_override(&"icon_max_width", max_width)


static func sprite_frame(path: String, frame_size := Vector2i(32, 32)) -> AtlasTexture:
	var source := load(path) as Texture2D
	var atlas_texture := AtlasTexture.new()
	atlas_texture.atlas = source
	atlas_texture.region = Rect2(Vector2.ZERO, Vector2(frame_size))
	return atlas_texture
