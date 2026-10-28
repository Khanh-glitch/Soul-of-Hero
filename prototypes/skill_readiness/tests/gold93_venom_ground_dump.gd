extends SceneTree

## Diagnostic: dumps the native ground raster so it can be diffed byte-for-byte
## against the original TypeScript output (`/tmp/ground_ref.bin`).

const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")


func _init() -> void:
	var L = PX.Layer.new(1200, 680, 2.0)
	DRAW.make_ground(L, 17)
	var f := FileAccess.open("/tmp/ground_native.bin", FileAccess.WRITE)
	f.store_buffer(L.bytes)
	f.close()
	print("dumped ", L.bytes.size(), " bytes")
	quit()
