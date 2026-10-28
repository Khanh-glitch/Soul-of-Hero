extends SceneTree

## Original Pool.upd() compiled verbatim from source ZIP (World .time and .rng
## mocked only as INJECTION points). Independent golden fixture 253 ticks.
## Source reference: /original src/game/fx.ts Pool.upd, World.step age ordering.
const SRC=preload("res://prototypes/gold_pair/venom_source_pool_lifecycle.gd")
const RNG=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const F:float=1.0/60.0
const SOURCE_ROWS_SHA="94cf4c6e2a5a5c2bf09c79aee43c3845e3078055407c36974ca1bea95caa7c86"
const FIRST_BUBBLES=[
    [4,391.760075,176.977889,6.539258,0.830918,1.835919],
    [8,391.931422,176.475633,6.277694,0.883415,1.953550],
    [10,391.898255,176.420168,5.919546,0.560906,1.669841],
    [15,391.818077,176.937252,11.710039,0.696827,2.717132],
    [17,392.726181,178.287486,7.225029,0.705779,2.001323],
    [24,391.665043,177.050045,8.936611,0.742516,2.752143],
    [25,391.383111,176.678018,10.334632,0.714209,2.214587]
]

func _initialize()->void:
    var pool=SRC.new()
    var rng=RNG.new(0x20261027)
    pool.begin(391.72,176.95,6.5,4.2,rng,2.0,0.3,0.7,10,3,1)
    var target:Dictionary={"id":17,"x":391.72,"y":176.95,"r":6.0,"dying":0.0}
    var rows:PackedStringArray=PackedStringArray()
    for frame in range(1,254):
        target["x"]=391.72+5.0*sin(float(frame)*0.023)
        target["y"]=176.95+3.0*cos(float(frame)*0.031)
        pool.step_source_60hz([target])
        rows.append("%d|%d|%.6f|%.6f|%d|%d" %
            [frame,int(pool.dead),pool.age,pool.nt,rng.state,pool.events.size()])
    var ctx=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(("\n".join(rows)+"\n").to_utf8_buffer())
    var row_sha:String=ctx.finish().hex_encode()
    if row_sha!=SOURCE_ROWS_SHA:
        push_error("VENOM_POOL_LIFECYCLE: original 253 tick timing/RNG digest drift expected=%s native=%s first=%s last=%s" % [SOURCE_ROWS_SHA,row_sha,rows[0],rows[252]])
        quit(1)
        return
    if not pool.dead or pool.frame!=253 or pool.events.size()!=57 or rng.state!=3133980089:
        push_error("VENOM_POOL_LIFECYCLE: lifetime/events/RNG source mismatch frame=%d event=%d state=%d" % [pool.frame,pool.events.size(),rng.state])
        quit(1)
        return
    var bubbles:Array=[]
    var damage_frames:Array[int]=[]
    for ev in pool.events:
        if String(ev["k"])=="bubble":
            bubbles.append(ev)
        elif String(ev["k"])=="damage":
            damage_frames.append(int(ev["f"]))
            if int(ev["amount"])!=10 or int(ev["id"])!=17 or int(ev["src"])!=1:
                push_error("VENOM_POOL_LIFECYCLE: damage cue content source drift")
                quit(1)
                return
    if bubbles.size()!=54 or damage_frames!=[11,84,126]:
        push_error("VENOM_POOL_LIFECYCLE: original 54 bubble/3 damage frame ledger drift bubbles=%d hits=%s" % [bubbles.size(),str(damage_frames)])
        quit(1)
        return
    for i in range(FIRST_BUBBLES.size()):
        var expected=FIRST_BUBBLES[i]
        var actual:Dictionary=bubbles[i]
        for k in range(6):
            var got:float=float(actual["f"]) if k==0 else float(actual[["x","y","vz","max","size"][k-1]])
            if absf(got-float(expected[k]))>0.000003:
                push_error("VENOM_POOL_LIFECYCLE: original bubble coordinate drift index=%d field=%d expected=%s actual=%.8f" % [i,k,str(expected[k]),got])
                quit(1)
                return
    print("VENOM_POOL_LIFECYCLE: PASS / 253 source World ticks SHA / 54 Gold bubbles / 3 acid hit cues / no double damage")
    quit(0)
