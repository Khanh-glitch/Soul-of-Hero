## Source C17's authored whole-stage black ink, above world/actors and below
## HUD. The sole subsequently authored C light is redrawn from source light
## in camera space. Bloom, other casts' ordering and final visual approval open.
extends CanvasLayer
class_name Arcana20CStageBlackout
const SHADER := preload("res://prototypes/arcana_fusion20/renderer/world_pass/c_stage_blackout.gdshader")
var _material: ShaderMaterial
var _texture: ImageTexture
var _source_to_world := Transform2D.IDENTITY
func _ready() -> void:
    layer = 9
    var rect := ColorRect.new()
    rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _material = ShaderMaterial.new()
    _material.shader = SHADER
    rect.material = _material
    add_child(rect)
func consume(frame: Arcana20SourcePassFrame) -> void:
    _source_to_world = frame.source_to_world
    var image := Image.create_from_data(CFrame.W, CFrame.H, false, Image.FORMAT_RGBAF, frame.c_light.to_byte_array())
    if _texture == null: _texture = ImageTexture.create_from_image(image)
    else: _texture.update(image)
    _material.set_shader_parameter("source_light", _texture)
    _sync_transform()
func _process(_delta: float) -> void:
    _sync_transform()
func _sync_transform() -> void:
    if _material == null or not is_inside_tree(): return
    var source_to_screen := get_viewport().get_final_transform() * get_viewport().get_canvas_transform() * _source_to_world
    var inverse := source_to_screen.affine_inverse()
    _material.set_shader_parameter("inv_x", inverse.x)
    _material.set_shader_parameter("inv_y", inverse.y)
    _material.set_shader_parameter("inv_origin", inverse.origin)
