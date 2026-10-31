## Direct A20 simulation check; original A path supplied by the reference test.
## Fusion maps the same particle roles onto C's selected contour instead.
extends SceneTree
const DIR := "res://artifacts/arcana20-a20-debris"
func _initialize() -> void:
    var file := FileAccess.open(DIR + "/a20_original.json", FileAccess.READ)
    if file == null:
        push_error("missing original A20 debris reference")
        quit(1)
        return
    var source: Dictionary = JSON.parse_string(file.get_as_text())
    var path: Array = source.path
    var debris := ARealityRipperDebris.new()
    debris.setup()
    var results := {}
    for tick in [318, 320, 326, 336, 360, 420]:
        debris.advance_to(float(tick) / 60.0, func(u: float) -> Dictionary:
            return path[roundi(u * 26.0)])
        results[str(tick)] = debris.particles.duplicate(true)
    var out := FileAccess.open(DIR + "/a20_native.json", FileAccess.WRITE)
    out.store_string(JSON.stringify(results))
    out.close()
    print("A20_DEBRIS_NATIVE_CAPTURE_COMPLETE")
    quit()
