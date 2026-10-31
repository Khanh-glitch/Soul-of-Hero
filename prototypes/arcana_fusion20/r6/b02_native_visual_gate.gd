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
    var origin := actor.global_position
    for timing: Dictionary in [{"label":"opening","time":1.3}, {"label":"peak","time":4.5}, {"label":"out","time":6.5}]:
        _check(fx.cast(2,origin),"original_B02_cast_"+str(timing.label))
        fx.timeline = float(timing.time)
        await get_tree().process_frame
        await get_tree().process_frame
        _check(_snap(stage,"B02_"+str(timing.label)),"native_screenshot_"+str(timing.label))
    _check(fx.spell_id==2,"only_original_source_B02")
    print("B02_RESULT ","PASS" if failures.is_empty() else "FAIL"," failures=",JSON.stringify(failures))
    get_tree().quit(0 if failures.is_empty() else 1)
