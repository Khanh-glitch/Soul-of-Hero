## Bit-exact old/new A bloom comparison; no accepted visual details are removed.
extends SceneTree
class ReferenceFramebuffer extends AFramebuffer:
    func compute_bloom() -> void:
        # Original threshold/downsample and two separable blur passes. Shared by
        # the reference composite and the separate live-world source field.
        # bloom threshold + downsample
        bloom_a.fill(0.0)
        for y in range(H):
            # The source allocates floor(H / 4) rows. JS typed-array writes
            # outside that allocation are ignored; GDScript throws instead.
            # Preserve the source's discarded partial bottom block explicitly.
            if (y >> 2) >= bh:
                continue
            var by := (y >> 2) * bw
            for x in range(W):
                var i := (y * W + x) * 3
                var o := (by + (x >> 2)) * 3
                var l := buf[i] * 0.3 + buf[i + 1] * 0.55 + buf[i + 2] * 0.15
                if l > 0.65:
                    var k := ((l - 0.65) / (l + 1e-5)) * 0.0625
                    bloom_a[o] += buf[i] * k
                    bloom_a[o + 1] += buf[i + 1] * k
                    bloom_a[o + 2] += buf[i + 2] * k
        for pass_i in range(2):
            for y in range(bh):
                for x in range(bw):
                    var o := (y * bw + x) * 3
                    for c in range(3):
                        var s := 0.0
                        for k in range(-3, 4):
                            var xx: int = clampi(x + k, 0, bw - 1)
                            s += bloom_a[(y * bw + xx) * 3 + c] * float(WK[k + 3])
                        bloom_b[o + c] = s
            for y in range(bh):
                for x in range(bw):
                    var o := (y * bw + x) * 3
                    for c in range(3):
                        var s := 0.0
                        for k in range(-3, 4):
                            var yy: int = clampi(y + k, 0, bh - 1)
                            s += bloom_b[(yy * bw + x) * 3 + c] * float(WK[k + 3])
                        bloom_a[o + c] = s

func _initialize() -> void:
    var before := ReferenceFramebuffer.new()
    var after := AFramebuffer.new()
    var rng := DFx.source_rng(491701)
    var scenarios := ["empty", "sparse", "dense"]
    for scenario in scenarios:
        before.buf.fill(0.0)
        for p in range(AFramebuffer.W * AFramebuffer.H):
            var enable := scenario == "dense" or (scenario == "sparse" and p % 389 == 0)
            if enable:
                for c in range(3): before.buf[p * 3 + c] = rng.r(-0.2, 3.0)
        after.buf = before.buf.duplicate()
        before.compute_bloom()
        after.compute_bloom()
        if before.bloom_a != after.bloom_a or before.bloom_b != after.bloom_b:
            push_error("A bloom differs from unoptimized reference for " + scenario)
            quit(1)
            return
        var old_us: Array[float] = []
        var new_us: Array[float] = []
        for iteration in range(8):
            var start := Time.get_ticks_usec()
            if iteration % 2 == 0:
                before.compute_bloom()
                old_us.append(float(Time.get_ticks_usec() - start))
                start = Time.get_ticks_usec()
                after.compute_bloom()
                new_us.append(float(Time.get_ticks_usec() - start))
            else:
                after.compute_bloom()
                new_us.append(float(Time.get_ticks_usec() - start))
                start = Time.get_ticks_usec()
                before.compute_bloom()
                old_us.append(float(Time.get_ticks_usec() - start))
            if before.bloom_a != after.bloom_a or before.bloom_b != after.bloom_b:
                push_error("A bloom differs on timed iteration for " + scenario)
                quit(1)
                return
        old_us.sort()
        new_us.sort()
        print("A_BLOOM_EXACT_BENCH ", JSON.stringify({"scenario":scenario,"iterations":8,"old_p50_us":old_us[3],"new_p50_us":new_us[3],"scope":"fixed-input source CPU only; not world/GPU or device budget"}))
    print("A_BLOOM_EXACT_BENCH_COMPLETE")
    quit()
