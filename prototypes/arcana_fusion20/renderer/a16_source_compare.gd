## Runs source A #16 original growth with neutral A material on black ONLY for source comparison.
## Not a SOH world composite or approval evidence.
extends SceneTree
const OUT := "res://artifacts/arcana20-a16-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    for tick in [90, 180, 270]:
        var source := AWorldseedGrowth.new()
        source.use_c_material = false
        source.setup()
        for i in range(1, tick + 1): source.update(1.0 / 60.0, float(i) / 60.0)
        var fb := AFramebuffer.new()
        fb.track_audit_writes = true
        fb.clear()
        source.render(fb, float(tick) / 60.0)
        var trace := FileAccess.open(OUT + "/native_%d.writes.u8" % tick, FileAccess.WRITE)
        trace.store_buffer(fb.audit_writes)
        trace.close()
        var raw := FileAccess.open(OUT + "/native_%d.rgb32f" % tick, FileAccess.WRITE)
        raw.store_buffer(fb.buf.to_byte_array())
        raw.close()
        var bytes := fb.present()
        # The original ImageData framebuffer is opaque. Normalize alpha for
        # this RGB-only source post diagnostic; never use it as a world mask.
        for p in range(AFramebuffer.W * AFramebuffer.H): bytes[p * 4 + 3] = 255
        var file := FileAccess.open(OUT + "/native_%d.rgba8" % tick, FileAccess.WRITE)
        file.store_buffer(bytes)
        file.close()
    print("A16_COMPONENT_CAPTURE_COMPLETE source-only")
    quit()
