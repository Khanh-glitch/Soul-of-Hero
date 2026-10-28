extends SceneTree

## Original TypeScript Pool.gnd() under native Field.disc(), captured from
## exact source archives with Field.shade temporarily observationally disabled:
## 10 *complete* 600x340 float32 SDF field SHA256, not approximate outlines.
const POOL=preload("res://prototypes/gold_pair/venom_source_pool_sdf.gd")
const CASES=[
    ["trail",335.23,182.42,4.0,0.9,2,0.1,696,
        [[0.0,"bde920e1c37ac0bc5db568e557a0379305db7c636bc79b8ea5cc2fbc281c4cea",0],
         [0.04,"2e879ac242d600baa8e06064772f88371be2c020236308b6e154196859c5f959",8],
         [0.1,"685c4a7c1de2b8653d6486c2b1bd2eafcbf65d7366a364195d770bfbb30d5ee3",41],
         [0.45,"a611f63e0260e88046de90b29bc322fff700051f4fa798d6491dbf348df2b4eb",41],
         [0.88,"d4d2e39d729b182725e18279d2dae3dd8bf8a29332b69d7e065fda1457f6fea7",39]]],
    ["finisher",391.72,176.95,6.5,4.2,3,0.3,404,
        [[0.0,"bde920e1c37ac0bc5db568e557a0379305db7c636bc79b8ea5cc2fbc281c4cea",0],
         [0.09,"d2acd2f25bbaab9ad353dbcbb3f4b23bd8a3364db0f343311b6dd3ac27d72dc4",7],
         [0.3,"54304e525847dbad168b08c426d6b0ded0da253057966278f5f3f1ba59985612",84],
         [1.4,"c63565b9df46110627e09c3591a152ab2d0610a584c7e8c518b751b921fb4f43",80],
         [4.08,"2016c3c6c99fa7799cd512463e94c597ab7c8cd16ec45674ca975ea6a990cd7a",85]]]
]
func _initialize()->void:
    var tested:int=0
    for c in CASES:
        var pool=POOL.new()
        pool.configure(float(c[1]),float(c[2]),float(c[3]),float(c[4]),int(c[5]),float(c[6]))
        if pool.seed!=int(c[7]):
            push_error("VENOM_POOL_SDF: source Gold blob seed drift %s native=%d gold=%d" % [c[0],pool.seed,int(c[7])])
            quit(1)
            return
        if pool.blobs.size()!=int(c[5])+1:
            push_error("VENOM_POOL_SDF: original number of distance-field blobs changed")
            quit(1)
            return
        for row in c[8]:
            var age:float=float(row[0])
            pool.seek_source_age(age,age+0.53)
            var hash:String=pool.source_hash()
            var expected:String=String(row[1])
            var count:int=pool.count_active()
            if hash!=expected or count!=int(row[2]):
                push_error("VENOM_POOL_SDF: %s age=%.3f original=%s native=%s Gold pixels=%d native=%d bbox=%s" %
                    [c[0],age,expected,hash,int(row[2]),count,str([pool.x0,pool.y0,pool.x1,pool.y1])])
                quit(1)
                return
            tested+=1
    if tested!=10:
        push_error("VENOM_POOL_SDF: insufficient original source checks")
        quit(1)
        return
    print("VENOM_POOL_SDF: PASS / 10 exact source Float32 600x340 full-field SHA256 / 2 original Glassfang Pool types / both lifetimes")
    quit(0)
