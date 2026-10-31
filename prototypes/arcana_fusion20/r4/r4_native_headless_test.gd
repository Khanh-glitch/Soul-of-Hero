## Isolated R4 Godot 4.7 real-actor runtime gate.
## Run: godot --headless --path . --script res://prototypes/arcana_fusion20/r4/r4_native_headless_test.gd
extends SceneTree

const ENEMY_SCENE := preload("res://game/characters/enemies/skeleton_enemy.tscn")
const BRIDGE := preload("res://prototypes/arcana_fusion20/r4/arcana20_soh_native_hit_bridge.gd")

var failures: Array[String] = []
var confirmed_events := 0
var port_visuals := 0
var frame_packets := 0
var died_events := 0
var last_visual: Dictionary = {}


func _initialize() -> void:
    call_deferred("_run")


func _check(ok: bool, label: String) -> void:
    print("R4_%s %s" % ["PASS" if ok else "FAIL", label])
    if not ok:
        failures.append(label)


func _on_host_confirmed(_target: Node, _damage: int, _position: Vector2,
        _ctx: Dictionary) -> void:
    confirmed_events += 1


func _on_port_visual(_target: Node2D, before_png: PackedByteArray,
        _after_png: PackedByteArray, details: Dictionary) -> void:
    port_visuals += 1
    last_visual = details.duplicate(true)
    _check(before_png.size() > 50, "real_native_sprite_png_nonempty")


func _on_frame(_target: Node2D, png: PackedByteArray, details: Dictionary) -> void:
    frame_packets += 1
    _check(png.size() > 50 and details.get("size") == Vector2i(32,32),
        "native_atlas_frame_is_32x32_png")


func _on_died(_target: SkeletonEnemy) -> void:
    died_events += 1


func _spawn(parent: Node2D, world: Vector2) -> SkeletonEnemy:
    var enemy := ENEMY_SCENE.instantiate() as SkeletonEnemy
    enemy.position = world
    parent.add_child(enemy)
    enemy.set_physics_process(false)
    return enemy


func _run() -> void:
    var stage := Node2D.new()
    stage.name = "ArcanaR4IsolatedStage"
    root.add_child(stage)
    var camera := Camera2D.new()
    camera.name = "R4Camera"
    stage.add_child(camera)
    camera.enabled = true
    camera.make_current()
    var bridge := BRIDGE.new()
    bridge.name = "Arcana20NativeHitBridge"
    stage.add_child(bridge)
    bridge.source_a_hit_confirmed.connect(_on_port_visual)
    bridge.source_a_frame_ready.connect(_on_frame)
    var bus := root.get_node_or_null("GameEvents")
    _check(bus != null and bus.has_signal(&"combat_hit_confirmed"),
        "real_game_events_bus_present")
    if bus != null:
        bus.connect(&"combat_hit_confirmed", _on_host_confirmed)

    var enemy := _spawn(stage, Vector2(260,180))
    enemy.died.connect(_on_died)
    await process_frame
    var sprite := enemy.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
    _check(sprite != null and sprite.sprite_frames != null,
        "real_skeleton_animated_sprite")
    if sprite == null or sprite.sprite_frames == null:
        print("R4_RESULT FAIL missing_real_enemy")
        quit(1)
        return
    _check(sprite.sprite_frames.get_frame_count(&"idle") == 6,
        "official_SOH_idle_six_frames")
    _check(bridge.emit_current_frame(enemy), "capture_real_atlas_frame")
    sprite.play(&"idle")
    sprite.frame = 1
    var manual_frame: Dictionary = bridge.capture_current_frame(enemy)
    _check(manual_frame.get("frame_index", -1) == 1,
        "current_animation_frame_changes")

    var before_hp := enemy.health
    var cast := "r4-native-02-unique-cast"
    var visual_element := &"fire"
    _check(not bridge.request_hit(enemy,0,Vector2.ZERO,cast,0,
        &"arcana_fusion20_02",visual_element), "zero_damage_rejected")
    _check(enemy.health == before_hp and confirmed_events == 0 and port_visuals == 0,
        "rejected_hit_does_not_mutate_or_draw")
    _check(bridge.request_hit(enemy,10,Vector2(180,180),cast,0,
        &"arcana_fusion20_02",visual_element), "host_authorized_first_hit")
    _check(enemy.health == before_hp - 10 and confirmed_events == 1 and port_visuals == 1,
        "exactly_one_SOH_damage_and_A_event_payload")
    _check(last_visual.get("animation_before", "") == "idle"
        and last_visual.get("animation_after", "") == "hurt",
        "real_enemy_animation_switches_idle_to_hurt")
    _check(not bridge.request_hit(enemy,10,Vector2(180,180),cast,0,
        &"arcana_fusion20_02",visual_element), "same_hit_identity_rejected")
    _check(enemy.health == before_hp - 10 and confirmed_events == 1 and port_visuals == 1,
        "duplicate_has_zero_side_effects")
    _check(bridge.request_hit(enemy,5,Vector2(180,180),cast,1,
        &"arcana_fusion20_02",visual_element),
        "new_source_cursor_is_new_contact")
    _check(enemy.health == before_hp - 15 and confirmed_events == 2
        and port_visuals == 2, "multi_contact_exact_count")

    var enemy2 := _spawn(stage, Vector2(340,180))
    await process_frame
    _check(bridge.request_hit(enemy2,7,Vector2(220,180),cast,0,
        &"arcana_fusion20_02",visual_element),
        "different_target_same_cursor_allowed")
    _check(enemy2.health == enemy2.max_health - 7
        and confirmed_events == 3,
        "second_real_enemy_independent_damage")

    camera.global_position = Vector2(0,0)
    camera.force_update_scroll()
    await process_frame
    var world_before := enemy.global_position
    var screen_before := sprite.get_global_transform_with_canvas().origin
    camera.global_position = Vector2(40,20)
    camera.force_update_scroll()
    await process_frame
    var screen_after := sprite.get_global_transform_with_canvas().origin
    _check(enemy.global_position.is_equal_approx(world_before),
        "world_anchor_unchanged")
    _check((screen_after-screen_before).distance_to(Vector2(-40,-20)) <= 1.5,
        "real_camera_transform_moves_actor_minus_40_minus_20")

    var finishing := enemy.health
    _check(bridge.request_hit(enemy,finishing,Vector2(180,180),cast,2,
        &"arcana_fusion20_02",visual_element),
        "legitimate_fatal_damage")
    _check(enemy.health == 0 and died_events == 1 and port_visuals == 4,
        "real_skeleton_death_and_one_visual_packet")
    _check(not bridge.request_hit(enemy,10,Vector2(180,180),cast,3,
        &"arcana_fusion20_02",visual_element), "dead_target_rejected")
    _check(enemy.health == 0 and port_visuals == 4,
        "no_post_death_damage_or_visual")
    var stats: Dictionary = bridge.stats()
    _check(stats.get("damage_accepted_without_event", -1) == 0,
        "all_accepted_hits_have_real_GameEvents_receipt")
    _check(frame_packets >= 1, "real_source_frame_event_emitted")
    print("R4_STATS ", JSON.stringify(stats))
    print("R4_RESULT ", "PASS" if failures.is_empty() else "FAIL",
        " failures=", JSON.stringify(failures))
    quit(0 if failures.is_empty() else 1)
