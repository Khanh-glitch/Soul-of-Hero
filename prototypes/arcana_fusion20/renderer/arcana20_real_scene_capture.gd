## Diagnostic capture of the renderer on real SOH game/main.tscn.
## NOT Control Tower binding, combat integration, overworld coverage or
## visual approval. Intended to reveal compositing/placement problems.
## Requires a real display/GL context (e.g. Xvfb + llvmpipe), not headless.
extends SceneTree

const STEP := 1.0 / 60.0
const OUTPUT := "res://prototypes/arcana_fusion20/renderer/evidence_out/real-scene"
var _failures: Array[String] = []

func _init() -> void:
    call_deferred("_run")

func _run() -> void:
    DirAccess.make_dir_recursive_absolute(OUTPUT)
    var packed := load("res://game/main.tscn") as PackedScene
    if packed == null:
        _fail("could not load actual game/main.tscn")
        quit(1)
        return
    var game := packed.instantiate() as Node2D
    root.add_child(game)
    current_scene = game
    for i in range(8):
        await process_frame
    var knight := game.get_node_or_null("Knight") as Node2D
    var camera := game.get_node_or_null("Knight/Camera") as Camera2D
    var enemy_scene := load("res://game/characters/enemies/skeleton_enemy.tscn") as PackedScene
    if knight == null or camera == null or enemy_scene == null:
        _fail("actual knight, camera or skeleton scene missing")
        quit(1)
        return
    knight.set_physics_process(false)
    knight.global_position = Vector2(520, 320)
    camera.position_smoothing_enabled = false
    camera.reset_smoothing()
    for other in get_nodes_in_group("enemies"):
        other.set_physics_process(false)
    var enemy := enemy_scene.instantiate() as Node2D
    game.add_child(enemy)
    enemy.global_position = knight.global_position + Vector2(150, 0)
    enemy.set_physics_process(false)
    # Retain actual HUD/game environment; hide the interactive tutorial overlay.
    var tutorial := game.get_node_or_null("LevelOneTutorial")
    if tutorial is CanvasItem:
        tutorial.visible = false
    var renderer := Arcana20Renderer.new()
    game.add_child(renderer)
    var times: Array = []
    var visual_events: Array = []
    renderer.visual_event.connect(func(cid: StringName, kind: StringName, pos: Vector2, t: float) -> void:
        visual_events.append({"id": String(cid), "kind": String(kind), "x": pos.x, "y": pos.y, "source_time": t}))
    await process_frame
    await _save("baseline.png")
    for id in range(1, 21):
        var cid := Arcana20SourceCatalog.canonical_id(id)
        enemy.global_position = knight.global_position + Vector2(150, 0)
        camera.offset = Vector2.ZERO
        if not renderer.cast_skill(cid, knight.global_position, enemy.global_position):
            _fail("cast refused %s" % cid)
            continue
        var player: Node = renderer._casts[cid]
        player.set_process(false)
        _set_rendering(player, false)
        var dur: float = float(player.get("duration"))
        var points := [0.5, dur * 0.55, dur * 0.93]
        var current_tick := 0
        var started := Time.get_ticks_usec()
        for j in range(points.size()):
            var want_tick := mini(int(round(float(points[j]) / STEP)), int(floor(dur / STEP)) - 1)
            while current_tick < want_tick:
                player.call("advance", STEP)
                current_tick += 1
            # Simulated movement of the real actor and real camera, not a
            # test battlefield sprite. The cast remains anchored to cast-time
            # target; this deliberately exposes moving-target mismatch.
            enemy.global_position = knight.global_position + Vector2(150 + j * 12, -j * 5)
            camera.offset = Vector2(j * 10, j * -4)
            _render_now(player)
            await process_frame
            await process_frame
            await _save("skill_%02d_%d.png" % [id, j])
        var ms := float(Time.get_ticks_usec() - started) / 1000.0
        times.append({"id": id, "capture_wall_ms": ms, "sample_times": points,
            "note": "offline seek/capture time, not gameplay frame-time"})
        renderer.cancel_skill(cid)
        await process_frame
        print("::notice::REAL_SCENE_CAPTURE skill=", id, " wall_ms=", snappedf(ms, 0.1))
    # Short real-time overlap probe: timings are diagnostic runner timings,
    # not a hardware budget approval or a stress test of all combinations.
    camera.offset = Vector2.ZERO
    var a := Arcana20SourceCatalog.canonical_id(2)
    var b := Arcana20SourceCatalog.canonical_id(10)
    var overlap_times: Array[float] = []
    if renderer.cast_skill(a, knight.global_position, enemy.global_position) and renderer.cast_skill(b, knight.global_position, enemy.global_position):
        var previous := Time.get_ticks_usec()
        for i in range(60):
            await process_frame
            var now := Time.get_ticks_usec()
            overlap_times.append(float(now - previous) / 1000.0)
            previous = now
        await _save("overlap_02_10.png")
        renderer.cancel_skill(a)
        if renderer.is_active(a) or not renderer.cast_skill(a, knight.global_position, enemy.global_position):
            _fail("overlap cancel/recast failed")
    else:
        _fail("overlap casts refused")
    renderer.cancel_all()
    if not renderer.active_casts().is_empty():
        _fail("overlap cleanup left active casts")
    var sorted_times := overlap_times.duplicate()
    sorted_times.sort()
    var overlap_stats: Dictionary = {"samples": overlap_times.size(), "frame_ms": overlap_times,
        "p95_ms": sorted_times[mini(sorted_times.size() - 1, int(floor(float(sorted_times.size()) * 0.95)))] if not sorted_times.is_empty() else -1.0,
        "note": "60-frame runner measurement with #02 and #10; diagnostic only, not a hardware acceptance budget"}
    var f := FileAccess.open(OUTPUT + "/manifest.json", FileAccess.WRITE)
    f.store_string(JSON.stringify({"scene": "res://game/main.tscn", "level": "res://game/levels/crypt_entrance.tscn",
        "enemy": "res://game/characters/enemies/skeleton_enemy.tscn", "camera": "actual Knight/Camera with explicit offsets",
        "limitations": "visual-only AVFX direct cast, not PR30 binding/combat, no overworld/bright scene, no measured real-time performance, not owner approved",
        "samples": times, "visual_events": visual_events, "overlap_probe": overlap_stats}, "  "))
    f.close()
    if _failures.is_empty():
        print("ARCANA20_REAL_SCENE_CAPTURE PASS screenshots=62")
    quit(0 if _failures.is_empty() else 1)

func _set_rendering(player: Node, enabled: bool) -> void:
    if player is FusionPlayer:
        for part in player._pending:
            part.node.set("render_enabled", enabled)
    elif player is ASourcePlayer or player is CSourcePlayer or player is DSourcePlayer:
        player.set("render_enabled", enabled)

func _render_now(player: Node) -> void:
    if player is FusionPlayer:
        for part in player._pending:
            part.node.set("render_enabled", true)
            part.node.call("_render_frame")
            part.node.set("render_enabled", false)
    elif player is BSourcePlayer:
        player.call("_render_frame")
    else:
        player.set("render_enabled", true)
        player.call("_render_frame")
        player.set("render_enabled", false)

func _save(filename: String) -> void:
    await RenderingServer.frame_post_draw
    var img := root.get_texture().get_image()
    if img == null or img.is_empty() or img.save_png(OUTPUT + "/" + filename) != OK:
        _fail("failed to capture %s" % filename)

func _fail(message: String) -> void:
    _failures.append(message)
    print("::error::ARCANA20_REAL_SCENE_FAIL ", message)
