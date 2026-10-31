## Native candidate C16 layered organism-only output, no battlefield or post.
extends SceneTree
const OUT := "res://artifacts/arcana20-c16-organism-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var growth := CWorldseedOrganism.new()
    for tick in [180,240,300,381,456,510,558]:
        var frame := CFrame.new()
        frame.track_world_fragments = true
        frame.clear()
        growth.render(frame,float(tick)/60.0)
        for kind in ["ink","light","disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick,kind],FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
        var coverage := FileAccess.open(OUT + "/native_%d.coverage.u8" % tick,FileAccess.WRITE)
        coverage.store_buffer(frame.world_influence)
        coverage.close()
        print("C16_ORGANISM_NATIVE ",tick)
    print("C16_ORGANISM_CAPTURE_COMPLETE")
    quit()
