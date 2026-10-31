## Controlled-seed C20 particles only; no world, contour, blocks or post.
extends SceneTree
const OUT := "res://artifacts/arcana20-c20-particles-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    for tick in [270, 324, 396, 420, 450, 480, 510]:
        var effect := CRealityRipperFusion.new()
        effect.setup()
        effect.audit_particles_only = true
        for i in range(1, tick + 1): effect.update(1.0 / 60.0, float(i) / 60.0)
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        for kind in ["ink", "light", "disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick, kind], FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
    print("C20_PARTICLES_CAPTURE_COMPLETE")
    quit()
