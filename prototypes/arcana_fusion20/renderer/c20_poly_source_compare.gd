## Isolated C20 polygons/passage with source contour generated only for mask.
extends SceneTree
const OUT := "res://artifacts/arcana20-c20-poly-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var effect := CRealityRipperFusion.new()
    effect.setup()
    effect.audit_polygons_only = true
    for tick in [270, 324, 378]:
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        var file := FileAccess.open(OUT + "/native_%d.light32f" % tick, FileAccess.WRITE)
        file.store_buffer(frame.light.to_byte_array())
        file.close()
    print("C20_POLYGON_CAPTURE_COMPLETE")
    quit()
