extends SceneTree
const G = preload("res://prototypes/gold_fidelity/hairline_ground.gd")
## Source ground.ts with same uniform RGBA initial buffer. Hashes from running
## the real TypeScript against the 28 gold-captured command arguments.
const EVENTS = [[300,1.2616972261716168],[278,0.9572913836829852],[322,2.1498163709559033],[256,0.7997319419079016],[344,2.2002795832373687],[234,1.3451744821530323],[366,2.0556352677431446],[212,1.0478246097129325],[190,1.2113824541822562],[168,1.2012104620367776],[146,1.3390725658882896],[124,1.2472226547685008],[102,1.0917216290396194]]
const SHA0 = "32a4a46fd0003e3cd50e744a2261cef1ebcab2fbca834aa7cbf16f1f01659c52"
const SHA1 = "ef3544a8dc64ed7cfe9fc8ecaef7e0fcf9a57171debfce3581bb8b0b8e8b6b2f"
const SHA2 = "c2f4a8a396fe5aba355b9b358d9a8f27fbd531e7dbfe9f093ba99bb1d42cbde2"
const SHA14 = "e03602c0ac725d39af1299f9c7676ee38b69db85a71074254af85e6ab6299b04"
const SHA28 = "36cf6b98447d91a7ec610a0ad5bf7f73f5f2f2f150890645a3ffccc5e63e906b"
func _check(actual: String, target: String, checkpoint: int) -> int:
    if actual==target:
        print("GOLD_GROUND_SHA: exact after %d operations" % checkpoint)
        return 0
    push_error("GOLD_GROUND_SHA: mismatch after %d expected %s, native %s" % [checkpoint,target,actual])
    return 1
func _initialize() -> void:
    var ground := G.new()
    ground.fill(40,44,56,255)
    var failures:=_check(ground.sha256(),SHA0,0)
    ground.source_first_groove()
    failures+=_check(ground.sha256(),SHA1,1)
    ground.source_second_groove()
    failures+=_check(ground.sha256(),SHA2,2)
    for i in EVENTS.size():
        var x: float = EVENTS[i][0]
        ground.crack(x,150.0,float(EVENTS[i][1]),16.0,1)
        ground.rubble(int(x),151,7)
        if i==5: failures+=_check(ground.sha256(),SHA14,14)
    failures+=_check(ground.sha256(),SHA28,28)
    print("GOLD_GROUND_SOURCE_CPU: %s 28 operations" % ("PASS" if failures==0 else "FAIL %d" % failures))
    quit(0 if failures==0 else 1)
