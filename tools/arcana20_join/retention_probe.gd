## Unmounted development-only retention probe on the real AppRoot route.
## Matched no-FX and FX processes sample engine counters after repeated
## start/cancel and an actual Home/overworld scene reload. This is not a GPU
## allocation trace, proof of no leaks, full-cast review or performance rating.
extends "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"

var retention_samples: Array = []

func _retention_sample(label: String) -> void:
    var row := {"label": label,
        "nodes": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
        "objects": Performance.get_monitor(Performance.OBJECT_COUNT),
        "resources": Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT),
        "static_bytes": Performance.get_monitor(Performance.MEMORY_STATIC),
        "texture_bytes": Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED),
        "video_bytes": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED)}
    retention_samples.append(row)
    print("AVFX_RETENTION_SAMPLE ", JSON.stringify(row))

func _settle(frames: int = 20) -> void:
    for _i in range(frames): await get_tree().process_frame
    await RenderingServer.frame_post_draw

func _enter_overworld_from_home() -> bool:
    var app: Node = host.get("app")
    var home: Node = app.get_node("RouteHost").get_child(0)
    var destinations: Dictionary = home.get("_destinations")
    var gate := destinations.get(&"campaign") as Node2D
    if gate == null: return false
    await host.call(&"_click", get_viewport().get_final_transform() * gate.get_global_transform_with_canvas().origin)
    var deadline := Time.get_ticks_msec() + 30000
    while Time.get_ticks_msec() < deadline and StringName(home.call(&"get_current_function")) != &"campaign":
        await get_tree().process_frame
    var enter := home.find_child("EnterOverworldButton", true, false) as Button
    if enter == null or not enter.is_visible_in_tree() or enter.disabled: return false
    await host.call(&"_click", get_viewport().get_final_transform() * enter.get_global_rect().get_center())
    if not await host.call(&"_wait_route", &"overworld", 30000): return false
    deadline = Time.get_ticks_msec() + 90000
    while Time.get_ticks_msec() < deadline and not is_instance_valid(host.get("renderer")):
        await get_tree().process_frame
    return is_instance_valid(host.get("renderer")) and is_instance_valid(host.get("player"))

func _exercise_round(skill: int, no_fx: bool, round_index: int) -> bool:
    var renderer := host.get("renderer") as Arcana20Renderer
    var selected := host.get("selector") as OptionButton
    selected.select(skill - 1)
    var id := Arcana20SourceCatalog.canonical_id(skill)
    for i in range(7): host.call(&"_spawn_enemy")
    var enemies: Array = host.get("spawned")
    if enemies.size() != 7: return false
    # Retention comparison is deliberately static: same real actor scenes in
    # both processes, so autonomous movement is not mistaken for a leak.
    for actor in enemies: (actor as Node2D).set_physics_process(false)
    await _settle()
    _retention_sample("round%d_baseline" % round_index)
    for i in range(3):
        var cast_ref: WeakRef
        if not no_fx:
            host.call(&"_cast_selected")
            if not renderer.is_active(id): return false
            cast_ref = weakref(renderer._casts[id])
        # Equivalent process-frame count, not elapsed-time/FPS measurement.
        for frame in range(30): await get_tree().process_frame
        if not no_fx:
            renderer.cancel_skill(id)
        await _settle()
        if not no_fx and cast_ref.get_ref() != null:
            push_error("AVFX_RETENTION_FAIL cast retained after cancellation")
            return false
        _retention_sample("round%d_after_%d" % [round_index, i + 1])
    return true

func start(wrapper: Node) -> void:
    host = wrapper
    var skill := int(OS.get_environment("AVFX_RETENTION_SKILL"))
    var no_fx := OS.get_environment("AVFX_RETENTION_NO_FX") == "1"
    if skill not in [9, 11, 14]: _fail("invalid retention skill"); return
    if not await _route(): _fail("retention initial actual route"); return
    if not await _exercise_round(skill, no_fx, 1): _fail("retention first round"); return
    var world_ref := weakref(host.get("world"))
    var renderer_ref := weakref(host.get("renderer"))
    get_tree().root.get_node("AppFlow").call(&"open_home")
    var app: Node = host.get("app")
    if not await host.call(&"_wait_route", &"home", 30000): _fail("retention Home transition"); return
    await _settle()
    if world_ref.get_ref() != null or renderer_ref.get_ref() != null:
        _fail("old world or renderer retained after actual route change"); return
    _retention_sample("home_after_unload")
    if not await _enter_overworld_from_home(): _fail("retention real scene reload"); return
    if not await _exercise_round(skill, no_fx, 2): _fail("retention second round"); return
    var folder := ProjectSettings.globalize_path("user://avfx_retention")
    DirAccess.make_dir_recursive_absolute(folder)
    var f := FileAccess.open(folder + "/retention.json", FileAccess.WRITE)
    f.store_string(JSON.stringify({"skill":skill, "no_fx":no_fx, "samples":retention_samples,
        "scope":"actual AppRoot/Home/overworld; seven real static Skeletons; two rounds of three starts/cancels; separate matched no-FX process; counter deltas include engine caches; not hardware allocation/leak proof"}, "  "))
    f.close()
    print("AVFX_RETENTION_PASS ", folder)
    get_tree().quit(0)
