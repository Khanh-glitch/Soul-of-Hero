## Compare every 8-step displayed snapshot (plus canonical source ticks) to
## eager per-tick rendering. Both paths simulate every tick and all warp bends.
## No world image or performance acceptance is implied.
extends SceneTree
const TICKS := [72,192,312,489,510,528,558,582]
func _initialize() -> void:
    var eager := DConstellationEngine.new()
    var skipped := DConstellationEngine.new()
    eager.setup()
    skipped.setup()
    for e in [eager,skipped]:
        e.fx.track_world_fields = true
        e.fx.rgba8_fragment_transfer = true
        e.fx.rgba8_scene_blend = true
    var eager_us := 0
    var skipped_us := 0
    var visible_count := 0
    for tick in range(1,583):
        var dt := 0.0001 if tick == 1 else 1.0 / 60.0
        var visible := tick % 8 == 0 or tick in TICKS
        var t0 := Time.get_ticks_usec()
        eager.update(float(tick) / 60.0, dt)
        eager_us += Time.get_ticks_usec() - t0
        skipped.fx.raster_enabled = visible
        t0 = Time.get_ticks_usec()
        skipped.update(float(tick) / 60.0, dt)
        skipped_us += Time.get_ticks_usec() - t0
        if eager._nodes != skipped._nodes or eager._edges != skipped._edges or eager._pulses != skipped._pulses or eager.fx._pool != skipped.fx._pool or eager.fx.rng.s != skipped.fx.rng.s or eager.fx.flash_amt != skipped.fx.flash_amt or eager.fx.flash_col != skipped.fx.flash_col or eager.fx.shake != skipped.fx.shake or eager.fx.bloom_gain != skipped.fx.bloom_gain or eager.fx.warp_amt != skipped.fx.warp_amt or eager.fx.decal_fade != skipped.fx.decal_fade or eager.fx.world_bends != skipped.fx.world_bends:
            push_error("D19 skipped-step simulation, RNG or post metadata mismatch at tick %d" % tick)
            quit(1)
            return
        if visible:
            visible_count += 1
            if eager.fx.buf != skipped.fx.buf or eager.fx.world_influence != skipped.fx.world_influence or eager.fx.world_warp != skipped.fx.world_warp or eager.fx.world_warp_influence != skipped.fx.world_warp_influence or eager.fx.world_bends != skipped.fx.world_bends or eager._nodes != skipped._nodes or eager._edges != skipped._edges or eager._pulses != skipped._pulses or eager.fx._pool != skipped.fx._pool or eager.fx.rng.s != skipped.fx.rng.s or eager.fx.flash_amt != skipped.fx.flash_amt or eager.fx.bloom_gain != skipped.fx.bloom_gain:
                push_error("D19 skipped-step state or field mismatch at tick %d" % tick)
                quit(1)
                return
            if tick in TICKS:
                print("D19_STEP_ELISION_TICK ",tick," exact=true")
    print("D19_STEP_ELISION_RESULT ",JSON.stringify({"ticks":582,"visible_snapshots":visible_count,"eager_us":eager_us,"skip_us":skipped_us,"scope":"same-host source CPU only; every tick simulated, complete D warp and every selected additive field compared exactly; no world or device budget"}))
    print("D19_STEP_ELISION_COMPLETE")
    quit()
