## Native candidate C16 core-only output, no battlefield or post.
extends SceneTree
const OUT := "res://artifacts/arcana20-c16-core-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var growth := CWorldseedCore.new()
    for tick in [270,300,360,381,423,456,510,540,558]:
        var frame := CFrame.new()
        frame.track_world_fragments = true
        frame.clear()
        var started := Time.get_ticks_usec()
        growth.render(frame,float(tick)/60.0)
        var render_us := Time.get_ticks_usec() - started
        for kind in ["ink","light","disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick,kind],FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
        var coverage := FileAccess.open(OUT + "/native_%d.coverage.u8" % tick,FileAccess.WRITE)
        coverage.store_buffer(frame.world_influence)
        coverage.close()
        print("C16_CORE_NATIVE ",tick," render_us=",render_us)
    print("C16_CORE_CAPTURE_COMPLETE")
    quit()
