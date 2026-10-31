## D non-void quad primitive comparison, no battlefield or world post.
extends SceneTree
const OUT := "res://artifacts/arcana19-poly"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var cases: Array = JSON.parse_string(FileAccess.get_file_as_string("res://tools/arcana19_poly_compare/cases.json"))
    for item in cases:
        var c: Dictionary = item
        for variant in ["native", "triangle"]:
            var fx := DFx.new()
            fx.track_world_fields = true
            var rgba: Array = c.color
            var color := Color(float(rgba[0]), float(rgba[1]), float(rgba[2]), float(rgba[3]))
            if variant == "native": fx.poly(c.pts, color, c.opts)
            else: DPolyTriangles.render(fx, c.pts, color, c.opts)
            var file := FileAccess.open(OUT + "/%s.%s.rgb32f" % [c.name, variant], FileAccess.WRITE)
            file.store_buffer(fx.buf.to_byte_array())
            file.close()
            file = FileAccess.open(OUT + "/%s.%s.coverage.u8" % [c.name, variant], FileAccess.WRITE)
            file.store_buffer(fx.world_influence)
            file.close()
        print("D19_POLY_CAPTURE ", c.name)
    print("D19_POLY_CAPTURE_COMPLETE")
    quit()
