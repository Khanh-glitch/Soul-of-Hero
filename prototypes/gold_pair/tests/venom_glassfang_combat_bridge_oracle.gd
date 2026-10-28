extends SceneTree
## Proves actual CombatDamage.apply_confirmed owns SOH health/events.
## Operates on disposable Node2D enemies; no production map mutation.
const RUNTIME=preload("res://prototypes/gold_pair/venom_glassfang_full_particle_runtime.gd")
const BRIDGE=preload("res://prototypes/gold_pair/venom_glassfang_combat_bridge.gd")

class NativeEnemy:
    extends Node2D
    var health:int=900
    var calls:int=0
    func take_damage(amount:int,_from:Vector2)->void:
        health=maxi(0,health-amount)
        calls+=1

func _fail(message:String)->void:
    push_error("GLASSFANG_COMBAT_BRIDGE: "+message)
    quit(1)

func _initialize()->void:
    var hero:=Node2D.new()
    hero.name="RealCombatCaster"
    root.add_child(hero)
    hero.global_position=Vector2(260.0,160.0)
    var target:=NativeEnemy.new()
    target.name="NativeEnemyCombatDamage"
    root.add_child(target)
    target.global_position=Vector2(375.0,190.0)
    var bridge=BRIDGE.new()
    bridge.begin(hero,"venomwright",{17:weakref(target)})
    var runtime=RUNTIME.new()
    runtime.begin(260.0,160.0,atan2(30.0,115.0),
        17,1765485952,0x20261027)
    var source_target:Dictionary={"id":17,"x":375.0,"y":190.0,
        "r":9.5,"dying":0.0,"hp":900,"exists":true}
    var hits_so_far:int=0
    for tick in range(1,331):
        source_target["x"]=375.0+8.0*sin(float(tick)*0.070)
        source_target["y"]=190.0+5.0*cos(float(tick)*0.055)
        runtime.step_source_60hz([source_target])
        var stat:Dictionary=bridge.consume(runtime,Transform2D.IDENTITY)
        var calls_after_first:int=target.calls
        var hp_after_first:int=target.health
        bridge.consume(runtime,Transform2D.IDENTITY)
        if target.calls!=calls_after_first or target.health!=hp_after_first:
            _fail("same-frame bridge repeat double-applied CombatDamage at tick "+str(tick))
            return
        if int(stat["confirmed_bites"])>5 or int(stat["confirmed_acid"])>3:
            _fail("source cue cap exceeded at tick "+str(tick))
            return
        hits_so_far=int(stat["confirmed_bites"])+int(stat["confirmed_acid"])
        if hits_so_far!=target.calls:
            _fail("confirmed damage count not backed by real take_damage")
            return
        if int(source_target["hp"])!=900:
            _fail("VFX or bridge illegally mutated original source fixture")
            return
    var outcome:Dictionary=bridge.stats()
    if int(outcome["confirmed_bites"])!=5:
        _fail("not all five original bite contacts applied")
        return
    if target.calls!=5+int(outcome["confirmed_acid"]):
        _fail("each accepted cue must apply to real enemy exactly once")
        return
    var expected_health:int=900-4*30-55-10*int(outcome["confirmed_acid"])
    if target.health!=expected_health:
        _fail("real CombatDamage HP result differs from original cue ledger")
        return
    if (int(outcome["consumed_bite_cues"])!=5
            or int(outcome["consumed_world_cues"])!=runtime.cues.size()):
        _fail("bridge did not consume all real original source cues")
        return
    # Despawned targets must be rejected rather than deferred or replayed.
    target.queue_free()
    print("GLASSFANG_COMBAT_BRIDGE: PASS / 330 source ticks / 5 real bite hits / "+
        str(outcome["confirmed_acid"])+" acid hits / health="+str(expected_health)+
        " / no double damage")
    quit(0)
