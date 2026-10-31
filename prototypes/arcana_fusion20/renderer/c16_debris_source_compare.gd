## Selected original C16 debris only, controlled-seed source comparison.
extends SceneTree
const OUT := "res://artifacts/arcana20-c16-debris-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    CKit._auto_seed = 0
    for tick in [450, 456, 457, 480, 510, 540, 590]:
        var effect := CWorldseedDebris.new()
        effect.setup()
        for i in range(1, tick + 1): effect.update(1.0 / 60.0, float(i) / 60.0)
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        for kind in ["ink", "light", "disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick, kind], FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
        print("C16_DEBRIS_COUNT ", tick, " ", effect.particles.size())
    print("C16_DEBRIS_CAPTURE_COMPLETE")
    quit()
