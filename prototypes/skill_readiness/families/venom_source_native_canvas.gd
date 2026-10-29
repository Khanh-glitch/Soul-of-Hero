class_name VenomSourceNativeCanvas
extends Node2D

## Display surface for the SOURCE-NATIVE Venomwright engine.
##
## The `prototypes/gold_pair` canvases consume the older component set's event
## snapshots. The source-native port (`venom_world` / `venom_engine`) instead
## produces two complete ORIGINAL raster buffers per tick - `scene` and `glow`
## - exactly as the original TypeScript did. This node uploads those buffers
## and composites them the way the original `display.ts` does:
##
##   scene  drawn opaque, nearest-neighbour, integer-scaled
##   glow   ADDED on top (the original glow layer is an additive pass)
##
## Nothing here resamples, filters or redesigns the pixels: the buffer is
## uploaded at its authored 1200x680 and scaled by whole pixels only, so the
## pixel-art stays crisp at any display resolution.

const DENSITY_SCALE: int = 2

var scene_sprite: Sprite2D
var glow_sprite: Sprite2D
var _scene_img: Image
var _glow_img: Image
var _scene_tex: ImageTexture
var _glow_tex: ImageTexture
var _w: int = 0
var _h: int = 0
var frames_presented: int = 0

## Authoring palette note: the original writes 0xAABBGGRR into a Uint32 view,
## and `venom_pixel.Layer` stores those same four bytes in RGBA byte order, so
## the buffer can be uploaded as FORMAT_RGBA8 without swizzling.
func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	scene_sprite = Sprite2D.new()
	scene_sprite.name = "SourceNative_scene"
	scene_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	scene_sprite.centered = false
	add_child(scene_sprite)

	glow_sprite = Sprite2D.new()
	glow_sprite.name = "SourceNative_glow"
	glow_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	glow_sprite.centered = false
	# The original glow layer is an additive pass over the scene.
	glow_sprite.material = _additive_material()
	add_child(glow_sprite)


func _additive_material() -> CanvasItemMaterial:
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return m


func set_source_density(_d: int) -> void:
	pass


func set_source_to_map_transform(xform: Transform2D) -> void:
	transform = xform


func bind_layers(W: int, H: int) -> void:
	if _w == W and _h == H and _scene_img != null:
		return
	_w = W
	_h = H
	_scene_img = Image.create(W, H, false, Image.FORMAT_RGBA8)
	_glow_img = Image.create(W, H, false, Image.FORMAT_RGBA8)
	_scene_tex = ImageTexture.create_from_image(_scene_img)
	_glow_tex = ImageTexture.create_from_image(_glow_img)
	scene_sprite.texture = _scene_tex
	glow_sprite.texture = _glow_tex


## Uploads one authored tick. `scene` / `glow` are `venom_pixel.Layer`.
func present(scene, glow) -> void:
	if scene == null or glow == null:
		return
	bind_layers(int(scene.W), int(scene.H))
	# `Image.data` is a read-only derived property in Godot 4 - assigning to it
	# silently fails with a "!p_data.has(width)" error. `set_data()` is the
	# in-place upload the proven gold_pair canvases use.
	_scene_img.set_data(_w, _h, false, Image.FORMAT_RGBA8, scene.bytes)
	_glow_img.set_data(_w, _h, false, Image.FORMAT_RGBA8, glow.bytes)
	_scene_tex.update(_scene_img)
	_glow_tex.update(_glow_img)
	frames_presented += 1


func release() -> void:
	frames_presented = 0


## Whole-pixel display scale for a target height, so 1080p / 1440p / 2160p
## stay crisp. The authored buffer is 680 px tall, so 2160p gets a 3x integer
## scale (2040 px) rather than a fractional 3.17x that would blur the art.
static func integer_scale_for(target_height: int, source_height: int = 680) -> int:
	return maxi(1, int(floor(float(target_height) / float(source_height))))
