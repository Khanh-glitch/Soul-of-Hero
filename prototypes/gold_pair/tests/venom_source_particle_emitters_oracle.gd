extends SceneTree

## Five independent verbatim original TypeScript source emissions generated
## from immutable user ZIP src/game/fx.ts, all using original Rng seed.
## Digests contain every original particle field including colors/rotation,
## positions/velocities and source RNG call ordering. Not guessed VFX art.
const EMITTERS=preload("res://prototypes/gold_pair/venom_source_particle_emitters.gd")
const CHECKS=[
    ["shards",3737189086,9,3857495180,
        "06f648f1cb67cc39fbf6e634e66c82ada043b17e1c5bba063e8348a67ef5c219"],
    ["drops",3737189087,10,3985377575,
        "14e7ff6aff3f79fbf069a942837890c792cede790b863cda73bc08d5ce75bcc2"],
    ["chips",3737189088,7,3353541906,
        "ce3d3e0c9e1b15ec3b5a4b525480fc2ccaaa3fdb95b1725284e107e0f9a80112"],
    ["steam",3737189089,6,2849588631,
        "986bed732ddf80653182e0340a886891b7b4f90942df6f456fc323fffcc15d2e"],
    ["dust",3737189090,5,2281694159,
        "d3ef70cf25290cced0d4458ab3c35786d2904239e8e26ae3c421202316965d35"]
]
func _initialize()->void:
    var count:int=0
    for row in CHECKS:
        var emit=EMITTERS.new(int(row[1]))
        match String(row[0]):
            "shards":
                emit.shards(310.2,175.8,9,90.0,4288723026,4285627686,4294768596,
                    {"z":8.0,"size":[5.0,9.0],"up":110.0,"land":2})
            "drops":
                emit.drops(311.8,181.4,10,82.0,4281395878,4288741358,4282871578,
                    {"z":6.0,"up":94.0,"glow":2.0,"max":1.6,
                     "size":[1.0,4.0],"land":1})
            "chips":
                emit.chips(325.4,187.1,7,60.0,4282871578,4280430090,4281395878,
                    {"z":5.0,"up":75.0,"size":[2.0,4.0]})
            "steam":
                emit.steam(340.0,200.0,6,20.0,4282871578,4280464751,4.0,
                    {"z":3.0,"vz":18.0,"max":0.8})
            "dust":
                emit.dust(360.0,190.0,5,18.0,3.0)
        var actual:String=emit.snapshot_hash()
        var expected:String=String(row[4])
        if actual!=expected:
            push_error("VENOM_SOURCE_EMITTERS: Gold %s original=%s native=%s" %
                [row[0],expected,actual])
            quit(1)
            return
        if emit.world.list.size()!=int(row[2]) or emit.rng.state!=int(row[3]):
            push_error("VENOM_SOURCE_EMITTERS: RNG draw count/size mismatch %s source state %d native %d" %
                [row[0],int(row[3]),emit.rng.state])
            quit(1)
            return
        count+=1
    if count!=5:
        push_error("VENOM_SOURCE_EMITTERS: only %d / 5 source functions" % count)
        quit(1)
        return
    print("VENOM_SOURCE_EMITTERS: PASS / 5 original TS full particle-field SHA / 37 Gold native generated particles / exact RNG ownership")
    quit(0)
