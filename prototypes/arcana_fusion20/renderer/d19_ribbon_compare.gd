## Controlled original RibbonBatch primitive inputs, neutral base only.
extends SceneTree
const OUT := "res://artifacts/arcana19-ribbon"
const CASES := "res://tools/arcana19_ribbon_compare/cases.json"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var cases: Array = JSON.parse_string(FileAccess.get_file_as_string(CASES))
    for entry in cases:
        var c: Dictionary = entry
        var fx := DFx.new()
        fx.t = float(c.time)
        fx.track_world_fields = true
        var rgba: Array = c.color
        var color := Color(float(rgba[0]), float(rgba[1]), float(rgba[2]), float(rgba[3]))
        fx.line(c.pts, c.width, color, c.opts)
        var file := FileAccess.open(OUT + "/%s.native.rgb32f" % c.name, FileAccess.WRITE)
        file.store_buffer(fx.buf.to_byte_array())
        file.close()
        var coverage := FileAccess.open(OUT + "/%s.native.coverage.u8" % c.name, FileAccess.WRITE)
        coverage.store_buffer(fx.world_influence)
        coverage.close()
        var triangle_fx := DFx.new()
        triangle_fx.t = float(c.time)
        triangle_fx.track_world_fields = true
        DRibbonTriangles.render(triangle_fx, c.pts, c.width, color, c.opts)
        var candidate_file := FileAccess.open(OUT + "/%s.triangle.rgb32f" % c.name, FileAccess.WRITE)
        candidate_file.store_buffer(triangle_fx.buf.to_byte_array())
        candidate_file.close()
        var candidate_coverage := FileAccess.open(OUT + "/%s.triangle.coverage.u8" % c.name, FileAccess.WRITE)
        candidate_coverage.store_buffer(triangle_fx.world_influence)
        candidate_coverage.close()
        for mode in ["native_ldr", "triangle_ldr"]:
            var clipped := DFx.new()
            clipped.t = float(c.time)
            clipped.track_world_fields = true
            clipped.rgba8_fragment_transfer = true
            if mode == "native_ldr": clipped.line(c.pts, c.width, color, c.opts)
            else: DRibbonTriangles.render(clipped, c.pts, c.width, color, c.opts)
            var f := FileAccess.open(OUT + "/%s.%s.rgb32f" % [c.name, mode], FileAccess.WRITE)
            f.store_buffer(clipped.buf.to_byte_array())
            f.close()
            f = FileAccess.open(OUT + "/%s.%s.coverage.u8" % [c.name, mode], FileAccess.WRITE)
            f.store_buffer(clipped.world_influence)
            f.close()
        print("D19_RIBBON_NATIVE_CAPTURE ", c.name)
    print("D19_RIBBON_CAPTURE_COMPLETE")
    quit()
