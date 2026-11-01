extends SceneTree

func _initialize() -> void:
    var f := CFrame.new()
    var reference := PackedFloat32Array()
    reference.resize(CFrame.N * 4)
    var prior := PackedFloat32Array()
    prior.resize(CFrame.N * 4)
    var legacy_times: Array[float] = []
    var current_times: Array[float] = []
    for sample in range(12):
        # Exercise real dirty array states; resets are outside timed scope.
        reference.fill(-3.25)
        prior.fill(-3.25)
        var t := Time.get_ticks_usec()
        for i in range(0, CFrame.N * 4, 4):
            reference[i] = 0.0
            reference[i + 1] = 0.0
            reference[i + 2] = 1.0
            reference[i + 3] = 0.0
        legacy_times.append(float(Time.get_ticks_usec() - t))
        t = Time.get_ticks_usec()
        prior.fill(0.0)
        for i in range(2, CFrame.N * 4, 4): prior[i] = 1.0
        current_times.append(float(Time.get_ticks_usec() - t))
        if prior != reference:
            push_error("C_FRAME_CLEAR_FAIL neutral array differs from reference")
            quit(1)
            return
        f.disp.fill(float(sample + 1))
        f.clear()
        if f.disp != reference:
            push_error("C_FRAME_CLEAR_FAIL frame clear differs from reference")
            quit(1)
            return
    legacy_times.sort()
    current_times.sort()
    print("C_FRAME_CLEAR_PERF ", JSON.stringify({"samples":12, "legacy_median_us":legacy_times[6], "bulk_median_us":current_times[6], "legacy_max_us":legacy_times[11], "bulk_max_us":current_times[11], "scope":"isolated neutral displacement initialization, same shared CPU host; excludes other frame fields, GPU, uploads"}))
    print("C_FRAME_CLEAR_PASS bit-exact neutral displacement for dirty inputs")
    quit(0)
