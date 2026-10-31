## Furnace Wyrm B source-authored PASS playback, separate from SOH combat authority.
## It consumes only the original B#02 software renderer pass export.
## Keep this isolated; visual parity with the native engines is NOT accepted.
extends CanvasLayer
class_name ArcanaB02Runtime

signal cast_started(spell_id: int, world_position: Vector2)
signal cast_finished(spell_id: int)
signal visual_contact(spell_id: int, target: Node2D, world_point: Vector2)

const SHADER := preload("res://prototypes/arcana_fusion20/r6/original_b02_source_pass.gdshader")
const DIR := "res://prototypes/arcana_fusion20/r6/assets/"
const PIXELS_PER_SECOND := 30.0

var overlay: ColorRect
var material: ShaderMaterial
var actor: Node2D
var caster: Node2D
var scene_camera: Camera2D
var world_anchor: Vector2
var timeline := 0.0
var active := false
var spell_id := 2
var _manifest: Dictionary = {}
var _contact_done := false
var _instance_serial := 0
var _hit_port: Node
var _pixel_scale := 1.0
var _loaded_spell := 0
const B_TEXTURES := {"b_fx":"b_fx.png", "b_mask":"b_mask.png",
    "b_disp_x":"b_disp_x.png", "b_disp_y":"b_disp_y.png", "b_light":"b_light.png",
    "b_ground":"b_ground.png"}


func _ready() -> void:
    layer = 10
    overlay = ColorRect.new()
    overlay.name = "SourceOriginalPassCompositor"
    overlay.color = Color.WHITE
    overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
    overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    overlay.size = get_viewport().get_visible_rect().size
    material = ShaderMaterial.new()
    material.shader = SHADER
    overlay.material = material
    add_child(overlay)
    overlay.visible = false
    set_process(true)


func _load_source_atlases(spell: int) -> bool:
    if _loaded_spell == spell:
        return true
    var old_textures: Dictionary = B_TEXTURES
    for k: String in old_textures.keys():
        material.set_shader_parameter(k, null)
    var textures: Dictionary = B_TEXTURES
    for k: String in textures.keys():
        var tex := ResourceLoader.load(DIR + textures[k], "Texture2D", ResourceLoader.CACHE_MODE_IGNORE) as Texture2D
        if tex == null:
            push_error("B02 missing original source atlas: %s" % textures[k])
            return false
        material.set_shader_parameter(k, tex)
    _loaded_spell = spell
    return true



func bind_host(target_actor: Node2D, camera: Camera2D, port: Node,
        caster_actor: Node2D = null) -> void:
    actor = target_actor
    caster = caster_actor
    scene_camera = camera
    _hit_port = port


func cast(spell: int, at_world: Vector2) -> bool:
    if spell != 2:
        return false
    if not _load_source_atlases(spell):
        return false
    var file := FileAccess.open(DIR + "b_manifest.json", FileAccess.READ)
    if file == null:
        push_error("B02 source manifest missing")
        return false
    var parsed: Variant = JSON.parse_string(file.get_as_text())
    if not parsed is Dictionary:
        return false
    _manifest = parsed as Dictionary
    if not _manifest.has("stats"):
        return false
    world_anchor = at_world
    timeline = 0.0
    spell_id = spell
    _contact_done = false
    _instance_serial += 1
    active = true
    overlay.visible = true
    cast_started.emit(spell_id, at_world)
    return true


func _process(delta: float) -> void:
    if not active or overlay == null:
        return
    timeline += minf(delta, 0.05)
    var duration := float(_manifest.get("time_seconds", 0.0))
    if timeline > duration + 0.08:
        active = false
        overlay.visible = false
        cast_finished.emit(spell_id)
        return
    var idx := mini(int(round(timeline * PIXELS_PER_SECOND)), int(_manifest.get("frames", 1)) - 1)
    var point := world_anchor
    var viewport_size := get_viewport().get_visible_rect().size
    var canvas_origin := point
    var cast_position := point - Vector2(158.0, -28.0)
    if scene_camera != null and is_instance_valid(scene_camera):
        # Camera2D may be LIMIT-CLAMPED near a world edge. Its actual screen
        # center, not a node-local canvas transform, is the ground truth.
        var screen_center := scene_camera.get_screen_center_position()
        canvas_origin = (point - screen_center) * scene_camera.zoom + viewport_size * 0.5
        if is_instance_valid(caster):
            cast_position = (caster.global_position - screen_center) * scene_camera.zoom + viewport_size * 0.5
    elif actor != null and is_instance_valid(actor):
        canvas_origin = actor.get_global_transform_with_canvas().origin
        if is_instance_valid(caster):
            cast_position = caster.get_global_transform_with_canvas().origin
    material.set_shader_parameter("viewport_pixels", viewport_size)
    material.set_shader_parameter("anchor_screen", canvas_origin)
    if spell_id == 2 and is_instance_valid(caster):
        var aim_vec := canvas_origin - cast_position
        var source_dir := Vector2(158.0,-28.0)
        var angle := aim_vec.angle() - source_dir.angle()
        var magnitude := maxf(0.2, aim_vec.length() / source_dir.length())
        material.set_shader_parameter("caster_screen", cast_position)
        material.set_shader_parameter("b_direction", angle)
        material.set_shader_parameter("b_distance_scale", magnitude)
    else:
        material.set_shader_parameter("caster_screen", canvas_origin - Vector2(158,-28))
        material.set_shader_parameter("b_direction", 0.0)
        material.set_shader_parameter("b_distance_scale", 1.0)
    material.set_shader_parameter("pixel_scale", _pixel_scale)
    material.set_shader_parameter("spell", spell_id)
    material.set_shader_parameter("frame_index", idx)
    var frames: Array = _manifest["stats"].get("hist", [])
    if idx >= 0 and idx < frames.size():
        var data: Dictionary = frames[idx]
        material.set_shader_parameter("b_ambient", float(data.get("ambient", 0.62)))
        material.set_shader_parameter("global_flash", Vector3.ZERO)
    # Contact is asserted ONCE from actual world position, only by SOH combat authority.
    if not _contact_done and timeline >= 4.98:
        _contact_done = true
        if is_instance_valid(actor) and CombatDamage.is_alive(actor):
            var radius := 22.0
            if actor.global_position.distance_to(world_anchor) <= radius:
                visual_contact.emit(spell_id, actor, world_anchor)
                if is_instance_valid(_hit_port):
                    _hit_port.request_hit(actor, 10, world_anchor, "b02-%d" % _instance_serial,
                        0, &"arcana_fusion20_02",
                        &"fire")
