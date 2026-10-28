extends SceneTree
## SHA256 of source original TypeScript Decal.gnd() on 600x340 RGBA k=1.
## All 24 hashes independently generated from original ZIP source.
const DECAL = preload("res://prototypes/gold_pair/venom_source_decal.gd")
const TIMES = [0.04,0.25,3.55,4.0]
const PALETTE = {"a":0xFF332211,"b":0xFF665544,"c":0xFF998877}
const CASES = [
    ["veins",34,17,2428,["c45a2486197f8a8011ef25ee4c2f81d3dd608f517312dde954eb7d95000670c0","086169086f0a4f89a53c5d887f52c50747b6614f54f6e28e553bf8e09ef07e9b","842a1feb733224643f74f0cabeb52df02e862e227023342ddd648fc03f666677","3d30697642e9d25937415d5fbbcb3aa05809bf1eeef4cea237c0700bb7c314ce"]],
    ["cracks",31,31,279,["9e0441e4d7d6c8840df2be0e06ef5edf60437b743ef0638c5e234fca979f0bd6","a9ab2369c1631b623b2cbbb52ce3ebf6d313a0d063e8f7a85406beafbdfb2060","2754b1371b301e89bfcc75684aede43ba83a01d9988af9260b5a5f4c5eb5a680","1242bbbc2002e5c318225c5c43a02251f68e5e4a116af016cd4d507423953a3f"]],
    ["pits",28,47,633,["d133341bd7e1080a173f64db787b17417be35044302da076de27c427fea4ae75","b98a4c0b72ec5042e5c39d4a7a243dd68835ee29bd2a00dbe1f4abc312d2c027","90d5500fe7d54695150e440939e0cdc17accec200e33a19e65b936eec22957e6","ea615c4b0683392e756c60b664d0ebab1a5e97cf33964bb8549fec2229ca591f"]],
    ["crater",29,101,515,["de65a98ef90613192fafd9da3fc9b952a21a0c69e1209dee9aac5a9457dd1e50","f397c33ecb2904a592717c55f32f3693eb7e955560a3ff94d6330a56cb02c9a4","f002733ccb666cda388cef51daf3dea7db61fdd67da9adcdd45b0872391bf028","9817f7f8026f7b27172df1726a156f88e71318a9fa58545ce0cb6f2cf9301dfb"]],
    ["crescent",35,213,411,["b3c6fa1d3fa66c1b023d9c446c96d61f8f518e7ba908122ab60fe20a60a639bd","84ae86a76668b471b0685e83fc08cedcc4ff3de00f1de23a9336cc71f07e2a48","8c085b980efbd45ed5fd508648f09d8fcbc1d781d2d45d456192d0a208d2ff98","e4c511887f877f895322b755b49c341a39a6535b94812cf1a2182d7c54d2afa6"]],
    ["scorch",33,79,80,["84d6ed6f619be94f15b92b37a06f1391e6fbbccad3e3165f4f5229946cd34fe4","7d037edcd8f6b5a42afe78f0c9c9a255c670ac5dffdd44fa5d9399eba0d097b9","6806085e4182a2ece2c487a93b5959271a8df662a2a22bf4e48ab255c224c179","c721cec8c27d8f7b2d6a44ce66d80ed49297dc4225762d0c0a57a6ab18b542eb"]]
]
func _initialize() -> void:
    var tested := 0
    for c in CASES:
        var decal = DECAL.new()
        decal.configure(305.25,170.5,String(c[0]),float(c[1]),4.2,int(c[2]),PALETTE,0.37,1.2)
        if decal.points.size()!=int(c[3]):
            push_error("VENOM_DECAL_ORACLE: %s points expected=%s got=%d" % [c[0],str(c[3]),decal.points.size()])
            quit(1)
            return
        for i in range(TIMES.size()):
            var bytes: PackedByteArray = decal.ground_bytes(float(TIMES[i]),float(TIMES[i]))
            var ctx := HashingContext.new()
            ctx.start(HashingContext.HASH_SHA256)
            ctx.update(bytes)
            var actual: String = ctx.finish().hex_encode()
            var expected := String(c[4][i])
            if actual != expected:
                push_error("VENOM_DECAL_ORACLE: %s age=%s expected=%s got=%s" % [c[0],str(TIMES[i]),expected,actual])
                quit(1)
                return
            tested += 1
    print("VENOM_DECAL_ORACLE: PASS / 6 variants / 24 original TypeScript RGBA hashes / exact 600x340 k1")
    quit(0)
