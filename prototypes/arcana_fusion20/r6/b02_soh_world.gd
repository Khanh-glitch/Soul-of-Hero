## R6 #02 authentic production-overworld visual pilot, isolated from the running main campaign.
## Instantiates chapter1_overworld.tscn, which itself builds authentic authored SOH terrain,
## player/hero, camera, collision, resources and map props.
## Source VFX are NOT redrawn: rendered by the R5 original-pass shader.
extends Node2D

const WORLD_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")
const SKELETON_SCENE := preload("res://game/characters/enemies/skeleton_enemy.tscn")
const R4 := preload("res://prototypes/arcana_fusion20/r4/arcana20_soh_native_hit_bridge.gd")
const R5 := preload("res://prototypes/arcana_fusion20/r6/original_b02_runtime.gd")
const A_FIRE := preload("res://prototypes/arcana_fusion20/r6/source_a_fire_on_soh_sprite.gd")

var overworld: Chapter1Overworld
var skeleton: SkeletonEnemy
var port: Node
var fx: ArcanaB02Runtime
var selection := 2
var hud: Label
var a_fire: ArcanaAOnBodyFire
var _ready_for_cast := false


func _ready() -> void:
    overworld = WORLD_SCENE.instantiate() as Chapter1Overworld
    if overworld == null:
        push_error("R5 unable to instantiate SOH production world")
        return
    overworld.name = "ProductionOverworld"
    add_child(overworld)
    if overworld.is_world_ready():
        _on_world_ready()
    else:
        overworld.world_ready.connect(_on_world_ready, CONNECT_ONE_SHOT)


func _on_world_ready() -> void:
    if not is_instance_valid(overworld.player) or not is_instance_valid(overworld.camera):
        push_error("R5 SOH native map did not spawn its player and camera")
        return
    var caster := overworld.player as Node2D
    var camera := overworld.camera as Camera2D
    var starting_point := caster.global_position + Vector2(70,-6)
    if overworld.has_method(&"_nearest_walkable"):
        starting_point = overworld.call(&"_nearest_walkable", starting_point)
    skeleton = SKELETON_SCENE.instantiate() as SkeletonEnemy
    skeleton.global_position = starting_point
    add_child(skeleton)
    skeleton.set_physics_process(false)
    a_fire = A_FIRE.new()
    a_fire.name = "ArcanaSourceAOnBodyBurn"
    skeleton.add_child(a_fire)
    if not a_fire.bind_actor(skeleton):
        push_error("Original A burn: real SOH skeleton animation missing")
    port = R4.new()
    port.name = "ConfirmedSOHCombatPort"
    add_child(port)
    port.source_a_hit_confirmed.connect(_on_source_a_hit_confirmed)
    fx = R5.new()
    fx.name = "OriginalSourcePassPlayback"
    add_child(fx)
    fx.bind_host(skeleton,camera,port,caster)
    var ui := CanvasLayer.new()
    ui.layer = 20
    add_child(ui)
    hud = Label.new()
    hud.position = Vector2(16,12)
    hud.add_theme_color_override("font_color",Color.WHITE)
    ui.add_child(hud)
    _ready_for_cast = true
    fx.cast(2,skeleton.global_position)
    print("B02_SOH_OVERWORLD_READY")


func _process(_dt: float) -> void:
    if not _ready_for_cast:
        return
    var hp_text := "dead" if not is_instance_valid(skeleton) else str(skeleton.health)
    hud.text = "ARCANA B#02 - ORIGINAL SOURCE PASS / REAL SOH OVERWORLD\n1: B#02 Furnace Wyrm | left click: cast | Player: SOH controls\nReal Skeleton HP=%s | 30Hz original B passes | VISUAL APPROVAL PENDING" % hp_text


func _unhandled_input(event: InputEvent) -> void:
    if not _ready_for_cast:
        return
    if event is InputEventKey and event.pressed and not event.echo:
        if event.keycode == KEY_1:
            selection = 2
        
    if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
        # Existing SOH camera transform resolves this to actual map world coordinates.
        fx.cast(selection,get_global_mouse_position())

## Only a REAL CombatDamage receipt can ignite A's source-authored body fire.
func _on_source_a_hit_confirmed(target: Node2D, _before: PackedByteArray,
        _after: PackedByteArray, details: Dictionary) -> void:
    if target != skeleton or not is_instance_valid(a_fire):
        return
    if String(details.get("element","")) != "fire":
        return
    a_fire.ignite(int(details.get("actual_damage",0)),
        details.get("hit_world",skeleton.global_position))
