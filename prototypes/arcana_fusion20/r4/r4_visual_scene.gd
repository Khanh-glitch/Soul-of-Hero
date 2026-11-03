## Manual native window inspection; real SOH enemy and CombatDamage only.
## The original source-A/B/C visual renderer is NOT native-ported in this fixture.
extends Node2D

const ENEMY_SCENE := preload("res://game/characters/enemies/skeleton_enemy.tscn")
const BRIDGE := preload("res://prototypes/arcana_fusion20/r4/arcana20_soh_native_hit_bridge.gd")

var enemy: SkeletonEnemy
var bridge: Node
var camera: Camera2D
var message: Label
var _serial := 0
var _last_token := ""


func _ready() -> void:
    camera = Camera2D.new()
    add_child(camera)
    camera.make_current()
    bridge = BRIDGE.new()
    add_child(bridge)
    bridge.source_a_hit_confirmed.connect(_on_visual)
    bridge.source_a_frame_ready.connect(_on_frame)
    enemy = ENEMY_SCENE.instantiate() as SkeletonEnemy
    enemy.position = Vector2(320, 210)
    add_child(enemy)
    enemy.set_physics_process(false)
    var hud := CanvasLayer.new()
    add_child(hud)
    message = Label.new()
    message.position = Vector2(16, 12)
    message.add_theme_color_override("font_color", Color.WHITE)
    hud.add_child(message)
    camera.position = Vector2(320,210)
    bridge.call_deferred("emit_current_frame", enemy)


func _process(delta: float) -> void:
    var movement := Vector2.ZERO
    if Input.is_key_pressed(KEY_A): movement.x -= 1
    if Input.is_key_pressed(KEY_D): movement.x += 1
    if Input.is_key_pressed(KEY_W): movement.y -= 1
    if Input.is_key_pressed(KEY_S): movement.y += 1
    camera.global_position += movement.normalized() * 160.0 * delta
    if not is_instance_valid(enemy):
        return
    var desc := "\nHP=%d / %d    Anim=%s frame=%d    Camera=%s" % [
        enemy.health, enemy.max_health,
        String(enemy.animated_sprite.animation), enemy.animated_sprite.frame,
        str(camera.global_position)]
    message.text = "ARCANA R4: genuine SOH actor / native hit gate\n1: hit  2: replay  3: lethal  WASD: camera\nA/B/C Gold rendering NOT yet native-integrated" + desc


func _unhandled_key_input(event: InputEvent) -> void:
    if not event is InputEventKey or not event.pressed or event.echo:
        return
    if not is_instance_valid(enemy) or enemy.health <= 0:
        return
    if event.keycode == KEY_1:
        _serial += 1
        _last_token = "r4-visual-%d" % _serial
        bridge.request_hit(enemy, 10, Vector2(230,180), _last_token, 0,
            &"arcana_fusion20_02", &"fire")
    elif event.keycode == KEY_2 and not _last_token.is_empty():
        bridge.request_hit(enemy, 10, Vector2(230,180), _last_token, 0,
            &"arcana_fusion20_02", &"fire")
    elif event.keycode == KEY_3:
        _serial += 1
        bridge.request_hit(enemy, enemy.health, Vector2(230,180),
            "r4-visual-fatal-%d" % _serial, 0, &"arcana_fusion20_02", &"fire")


func _on_visual(_target: Node2D, _before: PackedByteArray,
        _after: PackedByteArray, event: Dictionary) -> void:
    print("R4_NATIVE_CONFIRMED_A_FRAME_PACKET ", JSON.stringify({
        "cast_id":event.get("cast_id"), "damage":event.get("actual_damage"),
        "before":event.get("animation_before"), "after":event.get("animation_after")}))


func _on_frame(_target: Node2D, png: PackedByteArray, _details: Dictionary) -> void:
    print("R4_REAL_SOH_FRAME_CAPTURED bytes=", png.size())
