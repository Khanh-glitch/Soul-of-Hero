## Immediate 4a62a6e1f source render as exact, same-host performance baseline.
extends SceneTree
class ReferenceGrowth extends AWorldseedGrowth:
    func render(fb: AFramebuffer, t: float) -> void:
        var crack := AMath.seg(t, CRACK, CRACK + 0.5)
        var fold := AMath.seg(t, FOLD, DURATION)
        var bloom_k := AMath.seg(t, BLOOM, BLOOM + 0.5)
        var seed_r := lerpf(7.0, 10.0, sin(t * 1.4) * 0.5 + 0.5) * (1.0 - crack * 0.35) * (1.0 - fold)
        if seed_r > 0.5:
            var rotation := t * 0.7
            ADraw.field(fb, C.x - seed_r * 1.4, C.y - seed_r * 1.4, C.x + seed_r * 1.4, C.y + seed_r * 1.4, func(x: int, y: int, out: Array) -> void:
                var dx := float(x) - C.x
                var dy := (float(y) - C.y) * 1.2
                var d := sqrt(dx * dx + dy * dy)
                if d > seed_r: return
                var a := atan2(dy, dx) + rotation
                var veins := absf(sin(a * 3.0 + d * 0.5))
                var h := 0.22 + (1.0 - d / seed_r) * 0.2 + veins * 0.35 * (1.0 - d / seed_r)
                if d > seed_r - 1.2: h = 0.62
                if use_c_material:
                    var material := CPalette.ramp_d(CPalette.P.leaf, h, CMath.bayer(x, y))
                    fb.blend(x, y, material.x, material.y, material.z, 1.0)
                else:
                    var color := ACommon.ramp_step("gold", AMath.cl01(h), 7.0) * 0.55
                    out[0] = color.x
                    out[1] = color.y
                    out[2] = color.z)
            ADraw.glow(fb, C.x, C.y, seed_r * 2.4, Vector3(1.0, 0.85, 0.4), 0.3 + crack * 0.6)
            if crack > 0.0:
                var i := -seed_r
                while i <= seed_r:
                    var k := 1.0 - absf(i) / seed_r
                    fb.add(C.x + i * 0.3, C.y + i, 2.4 * k * crack, 2.2 * k * crack, 1.6 * k * crack, 1.0)
                    i += 1.0
        # Original C resolves the inner gold and bloom petals before outer
        # leaves at overlapping pixels. For the C-material fusion, paint A's
        # smooth outer sheets first and inner sheets last; otherwise later green
        # sheets bury the selected C gold/bloom palette. The A-only reference
        # keeps its original ascending additive draw order unchanged.
        var layer_order := [3, 2, 1, 0] if use_c_material else [0, 1, 2, 3]
        for layer_index in layer_order:
            var li: int = int(layer_index)
            var layer: Dictionary = layers[li]
            var u := AMath.ease_out(AMath.seg(t, float(layer.t0), float(layer.t0) + 1.0 / float(layer.sp)), 2.0)
            if fold > 0.0: u *= 1.0 - AMath.ease_out(fold, 1.6)
            if u <= 0.01: continue
            var pulse := 1.0 + 0.18 * sin(t * 7.0 - li * 1.2) * maxf(0.0, 1.0 - (t - BLOOM) * 0.6) if bloom_k > 0.0 else 1.0
            # Every petal in a layer has the same length and transverse samples.
            # Cache their exact double-precision values, not a reduced sampling.
            var length := float(layer.len) * u * pulse
            var us := maxi(6, ceili(length))
            var vs := maxi(4, ceili(length * float(layer.w) * 0.9))
            var transverse: Array[float] = []
            var abs_transverse: Array[float] = []
            var veins: Array[float] = []
            var edges: Array[float] = []
            for jj in range(vs + 1):
                var v := float(jj) / float(vs) * 2.0 - 1.0
                var av := absf(v)
                transverse.append(v)
                abs_transverse.append(av)
                veins.append(exp(-pow(av * 4.0, 2.0)) * 0.3)
                edges.append(pow(av, 4.0) * 0.5)
            for petal in range(int(layer.count)):
                var a0 := float(layer.tilt) + float(petal) / float(layer.count) * AMath.TAU
                var tremble := sin(t * (3.0 + float(layer.tremble) * 3.0) + petal) * float(layer.tremble) * 0.02
                for ii in range(us + 1):
                    var uu := float(ii) / float(us)
                    # These source expressions depend on the radial sample only,
                    # not on the transverse sample. Compute them once per row;
                    # every original sample, material, and operation is retained.
                    var wave := maxf(0.0, sin(uu * 8.0 - t * 5.0 + li * 1.5))
                    var wave_add := wave * 0.2 * (1.6 if bloom_k > 0.0 else 0.6)
                    var taper := (1.0 - uu * 0.2) * AMath.smoothstep(0.02, 0.26, uu)
                    var a := a0 + tremble * uu + sin(uu * 2.5) * 0.12
                    var ca := cos(a)
                    var sa := sin(a)
                    var radius := (5.0 + li * 5.0) * u + length * uu
                    var width := length * float(layer.w) * sin(pow(uu, 0.6) * PI)
                    for jj in range(vs + 1):
                        var v: float = transverse[jj]
                        var av: float = abs_transverse[jj]
                        var cell := AMath.fbm(uu * 7.0 + petal * 2.0, av * 5.0 - t * 1.1, 3)
                        var h := 0.16 + cell * 0.26 + veins[jj] + edges[jj]
                        h += wave_add
                        h *= taper
                        if h < 0.05: continue
                        var x := C.x + ca * radius - sa * v * width
                        var y := C.y + (sa * radius + ca * v * width) / SQ - uu * uu * 10.0 * u
                        if use_c_material:
                            _ink_splat(fb, x, y, _c_surface(li, petal, uu, v, x, y, t))
                        else:
                            var ramp := "bloom" if float(layer.hue) < 0.5 else ("verdant" if li == 3 else "bio")
                            var color := ACommon.ramp_step(ramp, AMath.cl01(h), 8.0) * 0.42
                            fb.add(x, y, color.x, color.y, color.z)
        var core_u := AMath.seg(t, 4.0, BLOOM)
        if core_u > 0.0 and fold < 1.0:
            var radius := (3.0 + core_u * 9.0) * (1.0 + bloom_k * 1.4) * (1.0 - fold)
            ADraw.glow(fb, C.x, C.y - 4.0, radius * 1.9, Vector3(1.3, 1.2, 0.7), 0.3 + bloom_k * 0.55)
            for i in range(9):
                var a := float(i) / 9.0 * AMath.TAU + t * 0.8
                var color := CPalette.ramp(CPalette.P.gold, 0.8) if use_c_material else ACommon.ramp_step("gold", 0.8, 6.0)
                ADraw.streak(fb, C.x, C.y - 4.0, C.x + cos(a) * radius, C.y - 4.0 + sin(a) * radius / SQ, 1.4, 0.4, color, 0.8)
        if bloom_k > 0.0 and bloom_k < 1.0:
            var k := sin(bloom_k * PI)
            var color := CPalette.ramp(CPalette.P.bloom, 0.5) if use_c_material else ACommon.ramp_step("bloom", 0.5, 6.0)
            ADraw.pulse_ring(fb, C.x, C.y, bloom_k * 120.0, 30.0 * (1.0 - bloom_k) + 6.0, color, k * 0.22, SQ, 0.14, 1.3)
            fb.flash.x += 0.1 * k * k
            fb.flash.y += 0.09 * k * k
        pollen.each(func(p: Dictionary) -> void:
            var l := float(p.life) / float(p.max)
            var tw := 0.55 + 0.45 * sin(t * 7.0 + float(p.seed))
            var material := "gold" if float(p.k) < 0.5 else "bloom"
            var color := CPalette.ramp(CPalette.P[material], 0.5 + l * 0.4) if use_c_material else ACommon.ramp_step(material, 0.5 + l * 0.4, 6.0)
            fb.add(float(p.x), float(p.y), color.x * 0.6 * tw, color.y * 0.6 * tw, color.z * 0.6 * tw, l)
            if float(p.size) > 1.8:
                var angle := float(p.a) + float(p.av) * (float(p.max) - float(p.life))
                fb.add(float(p.x) + cos(angle) * 1.4, float(p.y) + sin(angle), color.x * 0.4, color.y * 0.4, color.z * 0.4, l * 0.7))

func _initialize() -> void:
    var old := ReferenceGrowth.new()
    var candidate := AWorldseedGrowth.new()
    old.setup()
    candidate.setup()
    var a := AFramebuffer.new()
    var b := AFramebuffer.new()
    a.track_world_fields = true
    b.track_world_fields = true
    var ticks := [180, 270, 330, 390, 450, 480, 510, 539]
    for tick in range(1, 540):
        var t := float(tick) / 60.0
        old.update(1.0 / 60.0, t)
        candidate.update(1.0 / 60.0, t)
        if tick not in ticks: continue
        var old_samples: Array[float] = []
        var new_samples: Array[float] = []
        for sample in range(4):
            a.clear()
            b.clear()
            var start := Time.get_ticks_usec()
            if sample % 2 == 0:
                old.render(a, t)
                old_samples.append(float(Time.get_ticks_usec() - start))
                start = Time.get_ticks_usec()
                candidate.render(b, t)
                new_samples.append(float(Time.get_ticks_usec() - start))
            else:
                candidate.render(b, t)
                new_samples.append(float(Time.get_ticks_usec() - start))
                start = Time.get_ticks_usec()
                old.render(a, t)
                old_samples.append(float(Time.get_ticks_usec() - start))
            if a.buf != b.buf or a.world_coverage != b.world_coverage or a.world_multiplier != b.world_multiplier or a.world_warp != b.world_warp or a.world_influence != b.world_influence or a.flash != b.flash:
                push_error("A16 cached-noise world source fields changed at tick %d" % tick)
                quit(1)
                return
        old_samples.sort()
        new_samples.sort()
        print("A16_NOISE_CACHE_EXACT ", JSON.stringify({"tick":tick,"old_p50_us":old_samples[1],"new_p50_us":new_samples[1],"samples":4,"baseline":"4a62a6e1f","scope":"same-host fixed-tick CPU only; no target-device or GPU claim"}))
    print("A16_NOISE_CACHE_EXACT_COMPLETE")
    quit()
