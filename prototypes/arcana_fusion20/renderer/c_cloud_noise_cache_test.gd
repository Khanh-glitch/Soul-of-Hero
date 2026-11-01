## Test the candidate in isolation before any use by the source renderer.
extends SceneTree
func _initialize() -> void:
    var original_us: Array[float] = []
    var cached_us: Array[float] = []
    for z in [0.0, 0.4, 0.999, 1.0, 1.4, 1.9]:
        var expected := PackedFloat64Array()
        expected.resize(CFrame.N)
        var t := Time.get_ticks_usec()
        for y in range(CFrame.H):
            for x in range(CFrame.W):
                expected[y * CFrame.W + x] = CMath.noise3(float(x) * 0.08, float(y) * 0.12, z)
        original_us.append(float(Time.get_ticks_usec() - t))
        t = Time.get_ticks_usec()
        var cache := CCloudNoiseCache.new(z)
        for y in range(CFrame.H):
            for x in range(CFrame.W):
                var actual := cache.value(x, y)
                if actual != expected[y * CFrame.W + x]:
                    push_error("C_CLOUD_CACHE_FAIL z=%s x=%d y=%d expected=%.17g actual=%.17g" % [z, x, y, expected[y * CFrame.W + x], actual])
                    quit(1)
                    return
        cached_us.append(float(Time.get_ticks_usec() - t))
    original_us.sort(); cached_us.sort()
    print("C_CLOUD_CACHE_PERF ", JSON.stringify({"samples":6, "original_median_us":original_us[3], "cached_median_us":cached_us[3], "scope":"full source grid, cache construction included; shared CPU host; not render or device FPS"}))
    print("C_CLOUD_CACHE_PASS all values bit-exact for six z samples")
    quit(0)
