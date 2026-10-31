## Native candidate C16 membrane-only output, no battlefield or post.
extends SceneTree
const OUT := "res://artifacts/arcana20-c16-membranes-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var growth := CWorldseedMembranes.new()
    growth.setup()
    for tick in [210,240,300,381,456,510,558]:
        var frame := CFrame.new()
        frame.clear()
        growth.render(frame,float(tick)/60.0)
        for kind in ["ink","light","disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick,kind],FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
        print("C16_MEMBRANES_NATIVE ",tick)
    print("C16_MEMBRANES_CAPTURE_COMPLETE")
    quit()
