extends SceneTree

## Bit-exactness gate for the native Venomwright raster core.
##
## Builds the SAME ground the ORIGINAL `src/game/pixel.ts` `makeGround(Layer, 17)`
## produces at native resolution (1200x680, k=2) and compares the SHA-256 of the
## raw LE RGBA8 buffer against the reference produced by the original TypeScript.
##
## Reference (original source, node/TS):
##   ba1207e70d8a7b82b3d6a134a792bc5f9bec32d74a28236d0cf11d3c82487594
##
## If this mismatches, the Layer/Field/noise/hash port is not bit-exact and every
## downstream skill comparison is meaningless.

const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")

const EXPECT := "ba1207e70d8a7b82b3d6a134a792bc5f9bec32d74a28236d0cf11d3c82487594"


func _sha(b: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(b)
	return ctx.finish().hex_encode()


func _init() -> void:
	var L = PX.Layer.new(1200, 680, 2.0)
	DRAW.make_ground(L, 17)
	var got := _sha(L.bytes)
	var ok := got == EXPECT
	print(JSON.stringify({
		"test": "gold93_venom_ground_parity",
		"w": L.W, "h": L.H, "k": L.k,
		"ground_sha256": got,
		"expected_sha256": EXPECT,
		"bit_exact": ok,
	}))
	quit(0 if ok else 1)
