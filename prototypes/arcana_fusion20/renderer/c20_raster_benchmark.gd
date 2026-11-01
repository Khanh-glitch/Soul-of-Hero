## Controlled old-vs-sparse contour benchmark on the same software runner.
## Baseline is an immutable AVFX source script copied into artifacts by CI;
## this compares actual source fields and raw raster time, not GPU/device budget.
extends SceneTree
const BASELINE := "res://artifacts/arcana20-c20-benchmark/baseline_rift.gd"

func percentile(samples: Array[float], p: float) -> float:
    var sorted := samples.duplicate()
    sorted.sort()
    return sorted[floori(float(sorted.size() - 1) * p)]

# The immutable benchmark baseline predates the elected A pre-open world
# displacement. Apply that source formula independently to the old contour so
# both renders contain the same operations; compare every field without
# excluding, masking or relaxing any pixels. This is not a production path.
func add_a_pre_open_to_baseline(old: RefCounted, frame: CFrame, t: float) -> void:
    if t < 1.6 or t >= 3.0: return
    var a_time := 0.35 + CMath.inv(1.6, 3.0, t) * 0.65
    if a_time <= 0.35: return
    var ts: PackedFloat32Array = old.get("ts")
    var td: PackedFloat32Array = old.get("td")
    for pixel in range(CFrame.N):
        var s := float(ts[pixel])
        if s < 0.0 or absf(float(td[pixel])) >= 1.2: continue
        var offset: float = round((AMath.hash2(float(floori(s * 120.0)), float(floori(a_time * 18.0))) - 0.5) * 5.0)
        frame.D(pixel % CFrame.W, floori(float(pixel) / CFrame.W), offset, 0.0)

func _initialize() -> void:
    var script := load(BASELINE) as GDScript
    if script == null:
        push_error("Missing immutable raster benchmark baseline")
        quit(1)
        return
    var old: RefCounted = script.new()
    var revised := CRealityRipperFusion.new()
    old.call("setup")
    revised.setup()
    var a := CFrame.new()
    var b := CFrame.new()
    a.track_world_fragments = true
    b.track_world_fragments = true
    var ticks := [108, 270, 390, 444, 510, 570, 590, 600]
    for tick in range(1, ticks[-1] + 1):
        var t := float(tick) / 60.0
        # C particles without an explicit seed use a global deterministic
        # counter. Present the same counter state to both independent casts;
        # otherwise a dual-run test introduces false particle-light divergence.
        var initial_seed := CKit._auto_seed
        old.call("update", 1.0 / 60.0, t)
        var expected_seed := CKit._auto_seed
        CKit._auto_seed = initial_seed
        revised.update(1.0 / 60.0, t)
        if CKit._auto_seed != expected_seed:
            push_error("C20 benchmark particle seed consumption diverged at tick %d" % tick)
            quit(1)
            return
        if not tick in ticks: continue
        var old_samples: Array[float] = []
        var new_samples: Array[float] = []
        for rep in range(8):
            # Alternate order to reduce systematic thermal/load ordering bias.
            for variant in ([0, 1] if rep % 2 == 0 else [1, 0]):
                var frame := a if variant == 0 else b
                frame.clear()
                var start := Time.get_ticks_usec()
                if variant == 0:
                    old.call("render", frame, t)
                    add_a_pre_open_to_baseline(old, frame, t)
                else:
                    revised.render(frame, t)
                var elapsed := float(Time.get_ticks_usec() - start) / 1000.0
                if variant == 0: old_samples.append(elapsed)
                else: new_samples.append(elapsed)
            var live_a := a.live_light_fields()
            var live_b := b.live_light_fields()
            var mismatches: Array[String] = []
            if a.ground != b.ground: mismatches.append("ground")
            if a.ground_coverage != b.ground_coverage: mismatches.append("ground_coverage")
            if a.ink != b.ink: mismatches.append("ink")
            if a.light != b.light: mismatches.append("light")
            if a.disp != b.disp: mismatches.append("disp")
            if a.world_fragment != b.world_fragment: mismatches.append("fragment")
            if a.world_influence != b.world_influence: mismatches.append("influence")
            if live_a.index != live_b.index: mismatches.append("live_index")
            if live_a.operations != live_b.operations: mismatches.append("live_operations")
            if live_a.count != live_b.count or live_a.height != live_b.height: mismatches.append("live_dimensions")
            if a.invert != b.invert or a.desat != b.desat or a.chroma != b.chroma or a.flash != b.flash or a.shake != b.shake: mismatches.append("post_state")
            if a.field_activity != b.field_activity: mismatches.append("field_activity")
            if not mismatches.is_empty():
                push_error("C20 optimized source fields diverged from immutable baseline at tick %d, repetition %d: %s" % [tick, rep, str(mismatches)])
                quit(1)
                return
        print("C20_CONTROLLED_RASTER ", JSON.stringify({"tick": tick, "samples_each": old_samples.size(), "baseline_ms": [percentile(old_samples, 0.5), percentile(old_samples, 0.95), percentile(old_samples, 0.99)], "sparse_ms": [percentile(new_samples, 0.5), percentile(new_samples, 0.95), percentile(new_samples, 0.99)], "first_baseline_ms": old_samples[0], "first_optimized_ms": new_samples[0], "scope": "same shared CPU, alternating exact source-state render; baseline includes independent A pre-warp adaptation added after its immutable C render, so early timing includes that helper; 8 warm samples at one tick; excludes clear, scene, GPU and target-device performance"}))
    print("C20_CONTROLLED_RASTER_PASS")
    quit(0)
