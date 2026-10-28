extends SceneTree

## Original unchanged user ZIP TypeScript: fx.ts Particles.update() 240-step
## source execution (World step injected 1/60). Four original FX lifecycles
## plus drops/spores/sparks. Complete 240-state source text SHA256 archived as
## adf3882b08b4844216dce7cf012696629185d9cd11c5661740520a38340d8d42.
const PORT=preload("res://prototypes/gold_pair/venom_source_particles_world.gd")
const ROWS=[
    [1,8,0,310.638333,180.155000,9.487778],
    [10,8,0,314.583333,177.950000,20.002778],
    [21,8,0,319.405000,175.255000,25.826667],
    [40,6,0,327.733333,170.600000,17.677778],
    [60,3,1,354.696054,189.682660,15.648440],
    [120,0,2,0.0,0.0,0.0],
    [180,0,2,0.0,0.0,0.0],
    [240,0,2,0.0,0.0,0.0]
]
func _initialize()->void:
    var parts=PORT.new()
    parts.reset()
    parts.add({"k":"drop","x":310.2,"y":180.4,"z":8.0,"vx":26.3,"vy":-14.7,"vz":93.1,
        "grav":230.0,"size":2.7,"c1":4281395878,"c2":4288741358,"c3":4282871578,
        "land":1,"max":2.0,"glow":2.0,"trail":1})
    parts.add({"k":"shard","x":320.7,"y":184.9,"z":6.0,"vx":-31.8,"vy":18.4,"vz":116.0,
        "grav":240.0,"size":4.6,"rot":0.3,"vr":-8.2,"c1":4288723026,
        "c2":4285627686,"c3":4294768596,"land":2,"max":3.0})
    parts.add({"k":"shard","x":322.1,"y":180.3,"z":3.0,"vx":18.1,"vy":8.6,"vz":76.0,
        "grav":240.0,"size":5.4,"rot":1.2,"vr":5.2,"c1":4288723026,
        "c2":4285627686,"c3":4294768596,"land":3,"max":3.0})
    parts.add({"k":"bubble","x":331.1,"y":172.3,"z":2.0,"vx":0.0,"vy":0.0,"vz":9.5,
        "grav":0.0,"drag":0.5,"max":0.35,"size":2.3,"c1":4283603495,
        "c2":4281395878,"c3":4288741358})
    parts.add({"k":"spark","x":326.6,"y":166.4,"z":7.0,"vx":28.0,"vy":-11.0,
        "vz":16.0,"grav":60.0,"drag":0.9,"max":0.21,
        "c1":4284021460,"c2":4283603495,"size":1.0})
    parts.add({"k":"steam","x":338.3,"y":190.4,"z":4.0,"vx":3.2,"vy":-1.9,
        "vz":15.6,"drag":1.5,"max":0.9,"c1":4282871578,"c2":4280464751,"size":3.1})
    parts.add({"k":"spore","x":344.1,"y":184.6,"z":6.0,"vx":12.3,"vy":5.9,
        "vz":11.2,"drag":0.3,"max":1.6,"c1":4284021460,"c2":4283603495,"size":2.0})
    parts.add({"k":"chip","x":303.2,"y":177.3,"z":3.0,"vx":32.0,"vy":12.0,
        "vz":65.0,"grav":260.0,"size":3.2,"rot":1.2,"vr":8.4,
        "c1":4283603495,"c2":4281683218,"c3":4281395878,"land":3,"max":3.5})
    var passed:int=0
    for tick in range(1,241):
        parts.step_source_60hz()
        for check in ROWS:
            if int(check[0])!=tick:continue
            if parts.list.size()!=int(check[1]) or parts.events.size()!=int(check[2]):
                _fail("source Gold array swap/land counts at tick=%d expected=%s current=%s" %
                    [tick,str(check),str(parts.source_stats())])
                return
            if int(check[1])>0:
                var first:Dictionary=parts.list[0]
                for k in range(3):
                    var actual:float=float(first[["x","y","z"][k]])
                    var expected:float=float(check[k+3])
                    if absf(actual-expected)>0.000015:
                        _fail("source Gold physics at tick=%d axis=%d expected=%.6f actual=%.8f" %
                            [tick,k,expected,actual])
                        return
            passed+=1
    if parts.frame!=240 or parts.list.size()!=0 or parts.events.size()!=2:
        _fail("source 240-frame afterlife must clean all particles, keep environment cues")
        return
    if String(parts.events[0]["kind"])!="splash" or int(parts.events[0]["frame"])!=51:
        _fail("Gold droplet landed on wrong tick or environmental Splash event lost")
        return
    if String(parts.events[1]["kind"])!="embed" or int(parts.events[1]["duration"])!=7:
        _fail("Gold shard must crystallize into 7s permanent Embed residue")
        return
    if parts.n!=10:
        _fail("original bubble expiry must append two sparks in Gold insertion order")
        return
    if passed!=ROWS.size():
        _fail("source numeric checkpoints incomplete")
        return
    print("VENOM_SOURCE_PARTICLE_WORLD: PASS / original 240-tick 60Hz particle physics / 8 Gold checkpoints / source Bubble spark emission / Splash and 7s Embed aftermath")
    quit(0)

func _fail(msg:String)->void:
    push_error("VENOM_SOURCE_PARTICLE_WORLD: "+msg)
    quit(1)
