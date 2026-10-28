extends SceneTree
## Original ARCANA III src/engine/fx.ts crackScar() geometry-only oracle.
## 3 original RNG seeds (including ARCANA zero->1), 4 original ages each.
## Checks EVERY fissure polygon + ALL rubble rectangles, source call order.
## Does NOT certify Pixi GPU, visual color, disc pit, or full skill playback.
const SCAR=preload("res://prototypes/gold_pair/arcana_source_crack_scar.gd")
const AGES=[0.0,1.1,3.5,5.2]
const CASES=[
    [1,[
        "6a3576fcba878933e58ef38aecc989382f4654d77f2fc9e6a2269b663f465a68",
        "6a3576fcba878933e58ef38aecc989382f4654d77f2fc9e6a2269b663f465a68",
        "0afbe27c07956a5dfc32068b88fc87c5b32a5935a2069a69701817c78303ad64",
        "5e761389b9c36db01b139ea10fc1ba56d064c2dba9ab3550dfc4a44f09211d3d"
    ],[50,50,42,29],[13,21]],
    [20261027,[
        "d44ec547c7587baec70d4705db7f687438775d0a524a1d07bd1c222378677da2",
        "d44ec547c7587baec70d4705db7f687438775d0a524a1d07bd1c222378677da2",
        "709a40f177c35bad6252893805518a5020557c89533233f989667647a1875c17",
        "a0957ac48e7407c69b9ca2a6cb74fe9411657dd2ffba410525a52fb3501e4dd9"
    ],[52,52,44,30],[14,22]],
    [0,[
        "6a3576fcba878933e58ef38aecc989382f4654d77f2fc9e6a2269b663f465a68",
        "6a3576fcba878933e58ef38aecc989382f4654d77f2fc9e6a2269b663f465a68",
        "0afbe27c07956a5dfc32068b88fc87c5b32a5935a2069a69701817c78303ad64",
        "5e761389b9c36db01b139ea10fc1ba56d064c2dba9ab3550dfc4a44f09211d3d"
    ],[50,50,42,29],[13,21]]
]
func _initialize()->void:
    var tested:int=0
    for c in CASES:
        var seed:int=int(c[0])
        var scar=SCAR.new()
        scar.configure(seed,240.0,174.0,8,68.0,5.5,0.7)
        if scar.stones.size()!=8:
            push_error("ARCANA_SCAR_ORACLE: expected 8 original rubble stones")
            quit(1)
            return
        for i in range(AGES.size()):
            var trace:PackedStringArray=scar.geometry_trace(float(AGES[i]))
            var expected_count:int=int(c[2][i])
            if trace.size()!=expected_count:
                push_error("ARCANA_SCAR_ORACLE: seed=%d age=%s expected cmds=%d got=%d first=%s" % [seed,str(AGES[i]),expected_count,trace.size(),str(trace[0])])
                quit(1)
                return
            var actual:String=scar.geometry_sha256(float(AGES[i]))
            var expected:String=String(c[1][i])
            if actual!=expected:
                push_error("ARCANA_SCAR_ORACLE: source SHA mismatch seed=%d age=%s expected=%s actual=%s first=%s" % [seed,str(AGES[i]),expected,actual,str(trace[0])])
                quit(1)
                return
            tested+=1
    if tested!=12:
        push_error("ARCANA_SCAR_ORACLE: incomplete source geometry coverage")
        quit(1)
        return
    print("ARCANA_SCAR_ORACLE: PASS / 12 exact original TypeScript fissure+stone geometry hashes / 3 seeds / 4 ages")
    quit(0)
