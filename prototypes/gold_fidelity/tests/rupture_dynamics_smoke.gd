extends SceneTree
const FX = preload("res://prototypes/gold_fidelity/gold_fx_dynamics.gd")
const WAVE = preload("res://prototypes/gold_fidelity/gold_rupture_schedule.gd")
var failures := 0
var cases := 0
func check(name: String, actual: float, gold: float) -> void:
    cases += 1
    if absf(actual-gold) > 0.0002:
        failures += 1
        push_error("%s mismatch: got %.10f expected %.10f" % [name, actual,gold])
func _initialize() -> void:
    # Expected states from direct execution of the actual gold src/engine/world.ts classes
    # using S01 spawned objects at 2.51666666666666 simulated seconds.
    var p := FX.part({"x":300.0,"y":141.0,"z":6.0,
        "vx":-102.22974175101805,"vy":-81.02533421183495,"vz":99.35791481286287,
        "grav":260.0,"drag":1.5,"life":0.4270427114330232,"bounce":0.4})
    for i in range(8): FX.step_part(p)
    check("part 8 ticks x",float(p["x"]),287.79971026778435)
    check("part 8 ticks y",float(p["y"]),131.33028416092867)
    check("part 8 ticks z",float(p["z"]),16.647721975048384)
    check("part 8 ticks vz",float(p["vz"]),64.69124814619624)
    for i in range(8): FX.step_part(p)
    check("part 16 ticks x",float(p["x"]),277.8109578675579)
    check("part 16 ticks z",float(p["z"]),22.673221727874548)
    var c := FX.chunk({"x":300.0,"y":141.0,"z":6.0,"vx":62.78743754213388,
        "vy":-180.19221084499668,"vz":142.22702524159104,
        "rot":-1.298940062839773,"spin":0.28797113802284,
        "life":1.2851401118561625,"bounce":0.3})
    for i in range(8): FX.step_chunk(c)
    check("chunk 8 ticks x",float(c["x"]),308.37165833895097)
    check("chunk 8 ticks y",float(c["y"]),116.97437188733375)
    check("chunk 8 ticks z",float(c["z"]),21.23027003221214)
    check("chunk 8 ticks rot",float(c["rot"]),-1.2605439111033943)
    for i in range(8): FX.step_chunk(c)
    check("chunk 16 ticks vz",float(c["vz"]),14.227025241591036)
    check("chunk 16 ticks z",float(c["z"]),27.927206731090944)
    var ring := {"t":8.0/60.0,"life":0.315,"r0":4.0,"r1":26.0,"wd":8.0,"s":3.78}
    check("ring radius",float(FX.ring_payload(ring)["radius"]),21.77995810861632)
    check("ring strength",float(FX.ring_payload(ring)["strength"]),2.18)
    check("light fade",FX.light_weight({"t":8.0/60.0,"life":0.25,"hold":0.0}),0.2177777777777778)
    var waves: Array[Dictionary] = WAVE.waves()
    check("source wave count",float(waves.size()),13.0)
    var expected_x: Array = [300,278,322,256,344,234,366,212,190,168,146,124,102]
    for i in waves.size():
        check("wave[%d] x" % i,float(waves[i]["source_x"]),float(expected_x[i]))
    var moved: Array[Dictionary] = WAVE.waves(Vector2(128,79))
    for i in waves.size():
        check("wave relative x",float(moved[i]["position"].x-waves[i]["position"].x),128)
        check("wave relative y",float(moved[i]["position"].y-waves[i]["position"].y),79)
    var slices: Array[Dictionary] = []
    var t := -0.001
    while t < 0.4:
        var following := minf(t + 1.0/60.0,0.4)
        slices.append_array(WAVE.between(t,following))
        t = following
    check("frame-partition event count",float(slices.size()),13.0)
    print("GOLD_RUPTURE_NATIVE: %s %d checks" % ["PASS" if failures==0 else "FAIL",cases])
    quit(0 if failures==0 else 1)
