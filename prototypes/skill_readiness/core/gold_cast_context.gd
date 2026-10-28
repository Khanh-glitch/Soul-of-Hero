class_name Gold93CastContext
extends RefCounted

## A reusable input envelope for native Gold source spells.
## This is NOT a gameplay decision: resources, cast mode, damage and cooldown
## stay unset until the user supplies approved CombatRules/InputRules.
var caster_ref:WeakRef
var world_origin:Vector2=Vector2.ZERO
var aim_world:Vector2=Vector2.ZERO
var aim_direction:Vector2=Vector2.ZERO
var aim_is_set:bool=false
var drag_path:PackedVector2Array=PackedVector2Array()
var target_refs:Array[WeakRef]=[]
var original_source_seed:int=0
var fixed_source_tick:int=0
var world_to_screen:Transform2D=Transform2D.IDENTITY
var gameplay_rules:Dictionary={}
var user_input_rules:Dictionary={}
var ports:Dictionary={}
var is_diagnostic_lab:bool=true

func initialize(caster:Node2D,origin:Vector2,source_seed:int,
        diagnostic_lab:bool=true)->void:
    caster_ref=weakref(caster) if is_instance_valid(caster) else null
    world_origin=origin
    original_source_seed=source_seed
    fixed_source_tick=0
    aim_is_set=false
    aim_direction=Vector2.ZERO
    aim_world=origin
    drag_path=PackedVector2Array()
    target_refs.clear()
    gameplay_rules.clear()
    user_input_rules.clear()
    ports.clear()
    is_diagnostic_lab=diagnostic_lab

func set_world_aim(point:Vector2)->bool:
    var diff:Vector2=point-world_origin
    if diff.length_squared()<0.000001:
        return false
    aim_world=point
    aim_direction=diff.normalized()
    aim_is_set=true
    return true

func set_drag_path(points:PackedVector2Array)->bool:
    if points.size()<2:
        return false
    drag_path=points.duplicate()
    return set_world_aim(points[points.size()-1])

func bind_target(target:Node2D)->void:
    if is_instance_valid(target):
        target_refs.append(weakref(target))

func targets_alive()->Array[Node2D]:
    var out:Array[Node2D]=[]
    for record in target_refs:
        var obj:Node=record.get_ref() as Node
        if is_instance_valid(obj) and obj is Node2D and not obj.is_queued_for_deletion():
            out.append(obj as Node2D)
    return out

func bind_port(key:StringName,port:Callable)->void:
    if port.is_valid():
        ports[key]=port

func has_production_rules()->bool:
    if is_diagnostic_lab:
        return false
    # The rule schema is user-authored. A native cast is not gameplay-ready
    # until an explicitly approved rule packet is attached.
    return bool(gameplay_rules.get("user_approved",false)) and bool(
        user_input_rules.get("user_approved",false))

func to_diagnostic_row()->Dictionary:
    return {"source_seed":original_source_seed,
        "tick":fixed_source_tick,
        "aim_is_set":aim_is_set,
        "aim_direction":aim_direction,
        "drag_points":drag_path.size(),
        "living_targets":targets_alive().size(),
        "production_rules_ready":has_production_rules(),
        "diagnostic_lab":is_diagnostic_lab}
