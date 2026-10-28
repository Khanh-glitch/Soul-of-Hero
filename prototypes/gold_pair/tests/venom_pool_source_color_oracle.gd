extends SceneTree

## Independent oracle produced by running original ZIP src/game/fx.ts Pool.gnd()
## using ORIGINAL pixel.ts Field.shade, Layer and MAT.acid unchanged.
## Validates both 4096-byte procedural noise tiles, BOTH pool types and
## all 10 complete 600x340 RGBA8 pixel buffers; never update Gold hashes on FAIL.
const NOISE=preload("res://prototypes/gold_pair/venom_source_noise.gd")
const SHADE=preload("res://prototypes/gold_pair/venom_source_pool_shade.gd")
const NOISE_SHA=[
    "6a8bed4507e93b0885dba171e239e4dc7d0ce15de9af9d48bf794a0274fc178a",
    "5a4a35b2ecbb2a4cfc8a9d6483c45b3f0937f452d8bbe17c6b85708d0e700269"
]
const CASES=[
    ["trail",335.23,182.42,4.0,0.9,2,0.1,696,[
        [0.0,"bde920e1c37ac0bc5db568e557a0379305db7c636bc79b8ea5cc2fbc281c4cea",0],
        [0.04,"80f02be5fe1cfbe3fa071a9a96564dfd27bc6fc6c1c9627fa35d1f81cfec0fd8",7],
        [0.1,"3bf8b1f799c1bf83278f9b74a968e4e29281e56216192c5d8ec18e4d505e7226",34],
        [0.45,"75a023b3eaffe24809652cde7cde7b6e04c63eb04c5bb99bb9d1491ea2d54d48",17],
        [0.88,"fb6a122d796a2d924d7fc299c2ecaeaf1ea029ebf807cdcc80ed71cdef32f69b",5]
    ]],
    ["finisher",391.72,176.95,6.5,4.2,3,0.3,404,[
        [0.0,"bde920e1c37ac0bc5db568e557a0379305db7c636bc79b8ea5cc2fbc281c4cea",0],
        [0.09,"53673caa75911f16bdb2b694f20db59b0b7f25e854ff41798b3175b6ee14a2ef",7],
        [0.3,"4c759de7b8d090bc7090e391aef4a83dd38e02b69b0038391badaf8f8ec91d19",84],
        [1.4,"d29e7842694514fa9c48a84dfd0316fad1287406dadd027c58a178d87a93d804",80],
        [4.08,"037e3c20d135892ef5fbe18c78c6aff8d702d08d9d11697423cddcfb041d7a41",11]
    ]]
]
func _initialize()->void:
    var shade=SHADE.new()
    var actual_noise=[NOISE.sha(shade.noise.nz1),NOISE.sha(shade.noise.nz2)]
    for i in range(2):
        if actual_noise[i]!=NOISE_SHA[i]:
            push_error("VENOM_POOL_COLOR: original noise tile %d drift expected=%s got=%s" % [i,NOISE_SHA[i],actual_noise[i]])
            quit(1)
            return
    var tests:int=0
    for c in CASES:
        shade.begin(float(c[1]),float(c[2]),float(c[3]),float(c[4]),int(c[5]),float(c[6]))
        if shade.pool.seed!=int(c[7]):
            push_error("VENOM_POOL_COLOR: original pool seed mismatch")
            quit(1)
            return
        for check in c[8]:
            var age:float=float(check[0])
            var rgba:PackedByteArray=shade.source_frame(age,age+0.53)
            if rgba.size()!=600*340*4:
                push_error("VENOM_POOL_COLOR: full pixel buffer dimensions wrong")
                quit(1)
                return
            var hash:String=shade.full_rgba_sha(rgba)
            var expected:String=String(check[1])
            var painted:int=0
            for k in range(3,rgba.size(),4):
                if rgba[k]!=0:painted+=1
            if hash!=expected or painted!=int(check[2]):
                push_error("VENOM_POOL_COLOR: kind=%s age=%.3f original=%s native=%s sourcePixels=%d nativePixels=%d" %
                    [c[0],age,expected,hash,int(check[2]),painted])
                quit(1)
                return
            tests+=1
    if tests!=10:
        push_error("VENOM_POOL_COLOR: incomplete source checks")
        quit(1)
        return
    print("VENOM_POOL_COLOR: PASS / 2 original noise tiles / 10 whole RGBA Gold hashes / 600x340 acid pools")
    quit(0)
