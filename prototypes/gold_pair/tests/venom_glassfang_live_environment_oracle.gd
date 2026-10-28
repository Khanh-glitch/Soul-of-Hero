extends SceneTree

## Continuous 60Hz world/environment contract. This is not 1:1 Gold approval.
const RUNTIME=preload("res://prototypes/gold_pair/venom_glassfang_full_particle_runtime.gd")
const TIMELINE=preload("res://prototypes/gold_pair/venom_glassfang_live_environment.gd")

func _fail(message:String)->void:
    push_error("GLASSFANG_LIVE_ENV: "+message)
    quit(1)

func _initialize()->void:
    var runtime=RUNTIME.new()
    runtime.begin(260.0,160.0,atan2(30.0,115.0),
        17,1765485952,0x20261027)
    var environment=TIMELINE.new()
    var target:Dictionary={"id":17,"x":375.0,"y":190.0,
        "r":9.5,"dying":0.0,"hp":900,"exists":true}
    var bite_count:int=0
    var sampled:Array=[]
    for tick in range(1,331):
        target["x"]=375.0+8.0*sin(float(tick)*0.070)
        target["y"]=190.0+5.0*cos(float(tick)*0.055)
        runtime.step_source_60hz([target])
        environment.capture(runtime)
        if environment.last_tick!=tick:
            _fail("environment missed source World tick "+str(tick))
            return
        if int(target["hp"])!=900:
            _fail("visual environment touched actual enemy health")
            return
        for e in environment.snapshot():
            var age:float=float(e["age"])
            if age<0.0 or age>TIMELINE._life(e):
                _fail("expired or future event leaked into native frame "+str(tick))
                return
        if [15,31,63,96,147,177,220,330].has(tick):
            var snap:Array=environment.snapshot()
            sampled.append({"tick":tick,"count":snap.size()})
            if [15,147,177].has(tick) and snap.is_empty():
                _fail("source-active environmental FX missing at Gold tick "+str(tick))
                return
    if runtime.motion.bite_cues.size()!=5:
        _fail("Glassfang original five contact bites not reproduced")
        return
    if environment.last_bite!=5 or environment.last_cue!=runtime.cues.size():
        _fail("not all original World FX cues were consumed exactly once")
        return
    if environment.total_received<=20 or environment.total_expired<1:
        _fail("continuous FX world events not generated or recycled")
        return
    if runtime.emitters.world.frame!=330:
        _fail("original particles World 60Hz clock drift")
        return
    print("GLASSFANG_LIVE_ENV: PASS / 330 world ticks / "+
        str(environment.total_received)+" live source events / "+
        str(environment.total_expired)+" expired / 5 contact FX sequences / "+
        str(sampled))
    quit(0)
