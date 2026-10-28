class_name VenomSourceDecalCanvas
extends Node2D

## Isolated display adapter for the ORIGINAL Venomwright CPU Decal.gnd() output.
## No approximating sprites or authored texture sheets. A source pixel is a
## nearest-filtered RGBA8 pixel. Coordinates remain in original 600x340 space.
##
## This is a PREVIEW/TEST component, NOT Level2 TileMap acceptance:
## - caller must provide exact source-to-map transform and 60Hz source clock;
## - the source skill owns the Decal lifecycle, target contact and damage;
## - CPU raster->texture upload cost is NOT performance-qualified.
const DECAL = preload("res://prototypes/gold_pair/venom_source_decal.gd")
const SOURCE_WIDTH: int = 600
const SOURCE_HEIGHT: int = 340

var source_sprite: Sprite2D
var source_decal: VenomSourceDecal
var _frame_image: Image
var _frame_texture: ImageTexture

func _ready() -> void:
    _frame_image = Image.create(SOURCE_WIDTH, SOURCE_HEIGHT, false, Image.FORMAT_RGBA8)
    _frame_texture = ImageTexture.create_from_image(_frame_image)
    source_sprite = Sprite2D.new()
    source_sprite.name = "SourceRGBA600x340"
    source_sprite.centered = false
    source_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    source_sprite.texture = _frame_texture
    add_child(source_sprite)
    set_process(false) # NEVER run on a variable-rate display clock.

func begin_source_decal(world_x: float, world_y: float, decal_kind: String,
        decal_size: float, duration: float, seed: int, palette: Dictionary,
        angle: float = 0.0, source_pulse: float = 1.2) -> void:
    source_decal = DECAL.new()
    source_decal.configure(world_x, world_y, decal_kind, decal_size,
        duration, seed, palette, angle, source_pulse)

func set_source_to_map_transform(source_to_map: Transform2D) -> void:
    # Identity = the original logical 600x340 canvas, NOT an arbitrary
    # position in the Godot Level2 map. Calibrate the map adapter separately.
    assert(source_sprite != null)
    source_sprite.transform = source_to_map

func render_source_frame(source_world_time: float, source_age: float) -> PackedByteArray:
    if source_decal == null or _frame_texture == null:
        push_error("VenomSourceDecalCanvas must be ready and configured before rendering")
        return PackedByteArray()
    var rgba: PackedByteArray = source_decal.ground_bytes(source_world_time, source_age)
    if rgba.size() != SOURCE_WIDTH * SOURCE_HEIGHT * 4:
        push_error("VenomSourceDecalCanvas unexpected original RGBA frame length")
        return PackedByteArray()
    _frame_image.set_data(SOURCE_WIDTH, SOURCE_HEIGHT, false, Image.FORMAT_RGBA8, rgba)
    _frame_texture.update(_frame_image)
    return rgba

func is_source_lifetime_over(source_age: float) -> bool:
    return source_decal != null and source_age >= source_decal.life
