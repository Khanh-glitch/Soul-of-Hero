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
        var rgba: Array = c.color
        var color := Color(float(rgba[0]), float(rgba[1]), float(rgba[2]), float(rgba[3]))
        fx.line(c.pts, c.width, color, c.opts)
        var file := FileAccess.open(OUT + "/%s.native.rgb32f" % c.name, FileAccess.WRITE)
        file.store_buffer(fx.buf.to_byte_array())
        file.close()
        print("D19_RIBBON_NATIVE_CAPTURE ", c.name)
    print("D19_RIBBON_CAPTURE_COMPLETE")
    quit()
