class_name VenomGlassfangCombatBridge
extends RefCounted

## The SINGLE game-facing damage seam for Venomwright skill 01.
## Original Gold owns timing/targets/cue production; real SOH CombatDamage
## alone owns health mutation, enemy events and damage confirmation.
## No visual component may call take_damage or bypass this bridge.
const COMBAT=preload("res://game/combat/combat_damage.gd")
const WEAPON_ID:StringName=&"venom_glassfang_hunt"
var hero:Node2D
var hero_id:String=""
var bound_targets:Dictionary={}
var bite_cursor:int=0
var world_cue_cursor:int=0
var confirmed_bites:int=0
var confirmed_acid:int=0
var rejected:int=0
var cast_generation:int=0

func begin(caster:Node2D,source_hero_id:String="",targets_by_id:Dictionary={})->void:
    cast_generation+=1
    hero=caster
    hero_id=source_hero_id
    bound_targets=targets_by_id.duplicate()
    bite_cursor=0
    world_cue_cursor=0
    confirmed_bites=0
    confirmed_acid=0
    rejected=0

func bind_target(source_id:int,native_enemy:Node)->void:
    bound_targets[source_id]=weakref(native_enemy) if is_instance_valid(native_enemy) else null

func _target(source_id:int)->Node:
    var record:Variant=bound_targets.get(source_id,null)
    if record is WeakRef:
        return record.get_ref() as Node
    if record is Node and is_instance_valid(record):
        return record as Node
    return null

func _apply(enemy_id:int,amount:int,source_hit:Vector2,
        world_to_native:Transform2D,cue:StringName)->bool:
    var target:Node=_target(enemy_id)
    if target==null or hero==null or not is_instance_valid(hero):
        rejected+=1
        return false
    if not COMBAT.is_alive(target):
        rejected+=1
        return false
    var hit:Vector2=world_to_native*source_hit
    var ctx:Dictionary={"hero_id":hero_id,"source_skill_id":1,
        "source_cast_generation":cast_generation,
        "cue_id":cue,"hit_position":hit,
        "damage_authority":"CombatDamage"}
    var accepted:bool=COMBAT.apply_confirmed(
        target,amount,hero.global_position,WEAPON_ID,ctx)
    if not accepted:
        rejected+=1
    return accepted

## Invoke exactly once following each original World.step(1/60).
## Repeated calls on the same frame are safe: both cursors are monotonic.
func consume(source_world,world_to_native:Transform2D)->Dictionary:
    if source_world==null or source_world.motion==null:
        return stats()
    var bites:Array=source_world.motion.bite_cues
    for index in range(bite_cursor,bites.size()):
        var bite:Dictionary=bites[index]
        var enemy_id:int=int(bite["enemy"])
        var hit:=Vector2(float(bite["contact_x"]),float(bite["contact_y"]))
        if _apply(enemy_id,int(bite["amount"]),hit,world_to_native,
                &"venom_glassfang_bite"):
            confirmed_bites+=1
            var target:Node=_target(enemy_id)
            if is_instance_valid(target):
                COMBAT.apply_stun(target,float(bite.get("stagger",0.0)),
                    {"hero_id":hero_id,"source_skill_id":1})
    bite_cursor=bites.size()
    var cues:Array=source_world.cues
    for index in range(world_cue_cursor,cues.size()):
        var c:Dictionary=cues[index]
        if String(c.get("kind",""))!="acid_hit_candidate":continue
        var enemy_id:int=int(c["enemy"])
        # Candidate is already source-confirmed by shared Hits cooldown;
        # CombatDamage alone decides whether the real enemy accepted it.
        var target:Node=_target(enemy_id)
        var source_hit:=Vector2.ZERO
        if target is Node2D:
            source_hit=world_to_native.affine_inverse()*(
                target as Node2D).global_position
        if _apply(enemy_id,int(c["amount"]),source_hit,world_to_native,
                &"venom_glassfang_acid"):
            confirmed_acid+=1
    world_cue_cursor=cues.size()
    return stats()

func stats()->Dictionary:
    return {"cast_generation":cast_generation,
        "confirmed_bites":confirmed_bites,
        "confirmed_acid":confirmed_acid,
        "rejected_candidates":rejected,
        "consumed_bite_cues":bite_cursor,
        "consumed_world_cues":world_cue_cursor}
