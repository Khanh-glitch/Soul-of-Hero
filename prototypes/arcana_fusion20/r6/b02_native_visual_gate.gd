## Native Godot 4.7 B02 original-source visual pilot. Screenshots are native viewport.
extends Node
const SCENE := preload("res://prototypes/arcana_fusion20/r6/b02_soh_world.tscn")
var failures: Array[String] = []

func _ready() -> void:
    call_deferred("_run")

func _check(ok: bool, detail: String) -> void:
    print("B02_%s %s" % ["PASS" if ok else "FAIL",detail])
    if not ok:
        failures.append(detail)

func _snap(stage: Node2D, name: String) -> bool:
    var path := "user://arcana_b02_pilot/" + name + ".png"
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://arcana_b02_pilot"))
    var image := stage.get_viewport().get_texture().get_image()
    if image == null or image.is_empty(): return false
    var code := image.save_png(path)
    if code == OK: print("B02_SCREENSHOT ",ProjectSettings.globalize_path(path))
    return code == OK

## A successful screenshot save is not visual acceptance.
func _world_pixels_visible(image: Image) -> bool:
    if image == null or image.is_empty():
        return false
    var varied := 0
    var reference := image.get_pixel(int(image.get_width() / 2), int(image.get_height() / 2))
    for yy in range(10, 30):
        for xx in range(8, 40):
            var x := int(xx * (image.get_width() - 1) / 48)
            var y := int(yy * (image.get_height() - 1) / 40)
            var color := image.get_pixel(x, y)
            if absf(color.r - reference.r) + absf(color.g - reference.g) + absf(color.b - reference.b) > 0.12:
                varied += 1
    return varied >= 35


func _visual_difference(first: Image, second: Image) -> int:
    if first == null or second == null or first.get_size() != second.get_size():
        return 0
    var changes := 0
    for y in range(int(first.get_height() * 0.15), int(first.get_height() * 0.90), 4):
        for x in range(int(first.get_width() * 0.18), int(first.get_width() * 0.95), 4):
            var a := first.get_pixel(x, y)
            var b := second.get_pixel(x, y)
            if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) > 0.15:
                changes += 1
    return changes


func _run() -> void:
    var stage := SCENE.instantiate() as Node2D
    add_child(stage)
    for i: int in range(300):
        await get_tree().process_frame
        if bool(stage.get("_ready_for_cast")): break
    _check(bool(stage.get("_ready_for_cast")),"SOH_overworld_ready")
    if not bool(stage.get("_ready_for_cast")):
        print("B02_RESULT FAIL world_not_ready")
        get_tree().quit(1)
        return
    var fx := stage.get("fx") as ArcanaB02Runtime
    _check(fx != null and fx.material != null and fx.material.shader != null,"original_B02_shader_loaded")
    if fx == null:
        get_tree().quit(1)
        return
    var actor := stage.get("skeleton") as Node2D
    _check(actor != null and actor.is_in_group(&"enemies"),"real_SOH_enemy_present")
    for n: String in ["b_fx","b_ground","b_light","b_disp_x","b_disp_y","b_mask"]:
        var t := fx.material.get_shader_parameter(n) as Texture2D
        _check(t != null and t.get_width() == 3072,"source_B_pass_"+n)
    var debug_hud := stage.get("hud") as Label
    if debug_hud != null:
        debug_hud.visible = false
    var origin := actor.global_position
    var visual_snapshots: Dictionary = {}
    for timing: Dictionary in [{"label":"opening","time":1.3}, {"label":"peak","time":5.12}, {"label":"out","time":6.5}]:
        _check(fx.cast(2,origin),"original_B02_cast_"+str(timing.label))
        fx.timeline = float(timing.time)
        await get_tree().process_frame
        await get_tree().process_frame
        _check(_snap(stage,"B02_"+str(timing.label)),"native_screenshot_"+str(timing.label))
        var image := stage.get_viewport().get_texture().get_image()
        _check(_world_pixels_visible(image), "native_visual_not_blank_" + str(timing.label))
        visual_snapshots[str(timing.label)] = image

    if visual_snapshots.has("opening") and visual_snapshots.has("peak") and visual_snapshots.has("out"):
        var changes_open_peak := _visual_difference(visual_snapshots["opening"], visual_snapshots["peak"])
        var changes_peak_out := _visual_difference(visual_snapshots["peak"], visual_snapshots["out"])
        print("B02_VISUAL_DIFF opening_to_peak=", changes_open_peak,
            " peak_to_out=", changes_peak_out)
        _check(changes_open_peak > 150 and changes_peak_out > 150,
            "real_skill_temporal_frame_difference")
    # Native framebuffer playback samples, no fake interpolated VFX artwork.
    var sample_times: Array[float] = [
        0.35, 0.9, 1.45, 2.05, 2.7, 3.35,
        3.95, 4.45, 4.85, 5.12, 5.55, 6.5
    ]
    for sample_i in range(sample_times.size()):
        _check(fx.cast(2,origin),"sample_cast_" + str(sample_i))
        fx.timeline = sample_times[sample_i]
        await get_tree().process_frame
        await get_tree().process_frame
        _check(_snap(stage,"B02_seq_%02d" % sample_i),
            "native_original_B_sequence_" + str(sample_i))
    _check(fx.spell_id==2,"only_original_source_B02")
    print("B02_RESULT ","PASS" if failures.is_empty() else "FAIL"," failures=",JSON.stringify(failures))
    get_tree().quit(0 if failures.is_empty() else 1)
