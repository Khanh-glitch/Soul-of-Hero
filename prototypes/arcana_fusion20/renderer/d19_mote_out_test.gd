## Full fixed-clock comparison against the pre-OUT engine and genuine mote
## convergence. OUT is authored, not source parity or creator approval.
extends SceneTree
const STEP := 1.0/60.0
func _initialize() -> void:
    var old := DConstellationBeforeOut.new()
    var current := DConstellationEngine.new()
    old.setup()
    current.setup()
    old.fx.raster_enabled = false
    current.fx.raster_enabled = false
    var samples := {}
    for tick in range(1,588):
        var t := float(tick)*STEP
        old.update(t,STEP)
        current.update(t,STEP)
        if tick <= 516:
            if old._nodes != current._nodes or old._edges != current._edges or old._pulses != current._pulses or old.fx._pool != current.fx._pool or old.fx.rng.s != current.fx.rng.s:
                printerr("D19_OUT_PRE_MISMATCH tick=",tick)
                quit(1)
                return
        if tick in [516,540,564,582,587]:
            var max_radius := 0.0
            var max_alpha := 0.0
            for p in current.fx._pool:
                var radius := Vector2(float(p.x)-DConstellationEngine.CENTER.x,float(p.y)-DConstellationEngine.CENTER.y).length()
                max_radius = maxf(max_radius,radius)
                max_alpha = maxf(max_alpha,float(p.a))
            samples[tick] = {"count":current.fx._pool.size(),"max_radius":max_radius,"max_alpha":max_alpha}
    var first: Dictionary = samples[516]
    var last: Dictionary = samples[587]
    if int(last.count) <= 0 or float(last.max_radius) >= 2.0 or float(last.max_alpha) > 0.02 or float(first.max_radius) < 2.0:
        printerr("D19_OUT_FAILURE ",JSON.stringify(samples))
        quit(1)
        return
    print("D19_OUT_SAMPLES ",JSON.stringify(samples))
    print("D19_OUT_COMPLETE pre_out_exact_ticks=516")
    quit()
