## Controlled original SpriteBatch primitive inputs, neutral base only.
extends SceneTree
const OUT := "res://artifacts/arcana19-sprite"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var cases: Array = JSON.parse_string(FileAccess.get_file_as_string("res://tools/arcana19_sprite_compare/cases.json"))
    for item in cases:
        var c: Dictionary = item
        for mode in ["native", "native_ldr"]:
            var fx := DFx.new()
            fx.t = float(c.time)
            fx.track_world_fields = true
            fx.rgba8_fragment_transfer = mode == "native_ldr"
            var rgba: Array = c.color
            var color := Color(float(rgba[0]), float(rgba[1]), float(rgba[2]), float(rgba[3]))
            fx.sp(float(c.x), float(c.y), float(c.size), color, int(c.shape), c.opts)
            var file := FileAccess.open(OUT + "/%s.%s.rgb32f" % [c.name, mode], FileAccess.WRITE)
            file.store_buffer(fx.buf.to_byte_array())
            file.close()
            file = FileAccess.open(OUT + "/%s.%s.coverage.u8" % [c.name, mode], FileAccess.WRITE)
            file.store_buffer(fx.world_influence)
            file.close()
        print("D19_SPRITE_CAPTURE ", c.name)
    print("D19_SPRITE_CAPTURE_COMPLETE")
    quit()
