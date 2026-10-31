## Realtime-authoritative 20/20 elemental source-A body connection smoke, Godot 4.7.
## A PASS here certifies 20 registry/real native frame/contact bindings, NOT Gold visuals.
extends SceneTree

const ENEMY_SCENE = preload("res://game/characters/enemies/skeleton_enemy.tscn")
const R4 = preload("res://prototypes/arcana_fusion20/r4/arcana20_soh_native_hit_bridge.gd")
const BINDING = preload("res://prototypes/arcana_fusion20/soh_binding/arcana20_soh_binding.gd")
const REGISTRY = preload("res://prototypes/arcana_fusion20/soh_binding/arcana20_soh_registry.gd")

var failures: Array[String] = []
var actual_contacts := 0


func _initialize() -> void:
    call_deferred("_run")


func _check(ok: bool, key: String) -> void:
    print("ARCANA20_BIND_%s %s" % ["PASS" if ok else "FAIL",key])
    if not ok:
        failures.append(key)


func _on_contact(_skill_id: StringName, _actor: Node2D,
        _element: StringName, damage: int) -> void:
    _check(damage > 0, "positive_combat_authority_damage")
    actual_contacts += 1


func _run() -> void:
    var stage := Node2D.new()
    root.add_child(stage)
    var camera := Camera2D.new()
    camera.enabled = true
    stage.add_child(camera)
    camera.make_current()

    var source_bridge := R4.new()
    stage.add_child(source_bridge)
    var binding := BINDING.new()
    stage.add_child(binding)
    _check(binding.attach_to_bridge(source_bridge), "listen_native_R4_authority")
    binding.elemental_contact_confirmed.connect(_on_contact)

    var issues: Array[String] = REGISTRY.validate_catalog()
    _check(issues.is_empty(), "all_twenty_slots_source_voting_and_override")
    _check(REGISTRY.lookup(&"arcana_fusion20_19")["source_visual_lead"] == "D",
        "constellation_engine_final_D_override")
    _check(not bool(REGISTRY.lookup(&"arcana_fusion20_04")["creator_visual_voted"]),
        "redesign_is_not_fake_creator_approval")
    _check(REGISTRY.lookup(&"arcana_fusion20_21").is_empty(),
        "unknown_skill_fails_closed")

    var enemies: Array[SkeletonEnemy] = []
    for id in range(1, 21):
        var target := ENEMY_SCENE.instantiate() as SkeletonEnemy
        stage.add_child(target)
        target.position = Vector2(100 + (id % 5) * 55,100 + (id / 5) * 50)
        target.set_physics_process(false)
        enemies.append(target)
    await process_frame
    await process_frame

    for id in range(1, 21):
        var actor := enemies[id-1]
        var skill := REGISTRY.canonical_id(id)
        var details: Dictionary = REGISTRY.lookup(skill)
        var element: StringName = details["source_element"]
        var before_hp: int = actor.health
        var camera_before := actor.get_global_transform_with_canvas().origin
        var approved: bool = source_bridge.request_hit(actor, 1, Vector2(50,75),
            "arcana20-slot-%02d" % id, 0, skill, element)
        _check(approved, "real_SOH_hit_accepted_%02d" % id)
        _check(actor.health == before_hp - 1, "exactly_one_HP_change_%02d" % id)
        var body = binding.get_actor_visual(actor)
        _check(body != null and body.intensity(element) > 0.0,
            "actual_animated_SOH_sprite_receives_%02d" % id)
        _check(not source_bridge.request_hit(actor, 1, Vector2(50,75),
            "arcana20-slot-%02d" % id, 0, skill, element),
            "no_duplicate_damage_%02d" % id)
        _check(actor.health == before_hp - 1,
            "no_duplicate_HP_%02d" % id)
        if id == 2:
            var sprite := actor.get_node("AnimatedSprite2D") as AnimatedSprite2D
            _check(sprite != null and sprite.sprite_frames.get_frame_count(&"idle") == 6,
                "real_source_sprite_six_idle_frames")
            camera.global_position += Vector2(40, 20)
            camera.force_update_scroll()
            await process_frame
            var camera_after := actor.get_global_transform_with_canvas().origin
            _check(camera_after.distance_to(camera_before) > 1.0,
                "visual_actor_tracks_real_camera_motion")

    _check(actual_contacts == 20, "20_unique_real_damage_receipts")
    var stats: Dictionary = binding.diagnostics()
    _check(int(stats.get("unique_receipts",-1)) == 20, "20_receipts_unique")
    _check(int(stats.get("live_bound_actors",-1)) == 20, "20_real_SOH_actor_bindings")
    _check(int(source_bridge.stats().get("damage_accepted_without_event",-1)) == 0,
        "every_hit_has_true_GameEvents_confirmation")
    var fire = binding.get_actor_visual(enemies[1])
    if fire != null:
        var old := fire.intensity(&"fire")
        fire._process(0.5)
        _check(fire.intensity(&"fire") < old, "authored_status_decay_no_second_damage")
    print("ARCANA20_BIND_RESULT ","PASS" if failures.is_empty() else "FAIL",
        " failures=",JSON.stringify(failures)," receipts=",JSON.stringify(stats))
    quit(0 if failures.is_empty() else 1)
