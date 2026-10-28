class_name VenomMath
extends RefCounted

## Native port of the pure numeric/colour/noise core of the ORIGINAL Venomwright
## `src/game/pixel.ts`.
##
## These helpers are kept in their own script (rather than inside
## `venom_pixel.gd`) for one hard GDScript reason: an inner class cannot reach a
## `static func` of the enclosing script unqualified, and a script cannot
## reference its own `class_name` while it is being compiled. Splitting the pure
## helpers out lets `VenomPixel.Layer`, `VenomPixel.Field` and every drawing
## routine share one bit-exact implementation through a `const` preload.
##
## Semantics preserved from TypeScript:
##   * `Math.round` rounds halves toward +Infinity -> floor(v + 0.5)
##   * packed colours are 0xAABBGGRR
##   * `>>`, `>>>`, `<<`, `|`, `^` and `Math.imul` are 32-bit

const TAU: float = 6.283185307179586
const BAYER: PackedByteArray = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

# ---------------------------------------------------------------------------
# 32-bit integer semantics
# ---------------------------------------------------------------------------

static func u32(v: int) -> int:
	return v & 0xFFFFFFFF


static func i32(v: int) -> int:
	v = v & 0xFFFFFFFF
	if v >= 0x80000000:
		v -= 0x100000000
	return v


static func imul(a: int, b: int) -> int:
	return i32(u32(a) * u32(b))


# `Math.imul(n, 0x27d4eb2d)` style hash used for ground and geometry jitter.
static func hash_n(n: int) -> float:
	n = i32(n)
	n = i32(i32(n ^ 61) ^ (u32(n) >> 16))
	n = i32(n + i32(u32(n) << 3))
	n = i32(n ^ (u32(n) >> 4))
	n = imul(n, 0x27d4eb2d)
	n = i32(n ^ (u32(n) >> 15))
	return float(u32(n)) / 4294967296.0


# ---------------------------------------------------------------------------
# Colours (0xAABBGGRR)
# ---------------------------------------------------------------------------

static func rgb(r: int, g: int, b: int) -> int:
	return u32(0xFF000000 | (b << 16) | (g << 8) | r)


static func hex(s: String) -> int:
	var v: int = s.lstrip("#").hex_to_int()
	return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255)


static func mix(a: int, b: int, t: float) -> int:
	var ar: int = a & 255
	var ag: int = (a >> 8) & 255
	var ab: int = (a >> 16) & 255
	var br: int = b & 255
	var bg: int = (b >> 8) & 255
	var bb: int = (b >> 16) & 255
	return rgb(int(ar + (br - ar) * t), int(ag + (bg - ag) * t), int(ab + (bb - ab) * t))


static func clampf(v: float, a: float, b: float) -> float:
	return a if v < a else (b if v > b else v)


static func lerpf(a: float, b: float, t: float) -> float:
	return a + (b - a) * t


static func smoothstep(t: float) -> float:
	t = clampf(t, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


static func ang_diff(a: float, b: float) -> float:
	var d: float = fmod(b - a, TAU)
	if d > PI:
		d -= TAU
	if d < -PI:
		d += TAU
	return d


# JavaScript `Math.round` (halves go up).
static func js_round(v: float) -> int:
	return int(floor(v + 0.5))


# ---------------------------------------------------------------------------
# Original palette
# ---------------------------------------------------------------------------

const P: Dictionary = {
	"k0": 0xFF080904, 	"k1": 0xFF101508, 	"k2": 0xFF1B220E, 	"k3": 0xFF273215,
	"e0": 0xFF222E0A, 	"e1": 0xFF354D12, 	"e2": 0xFF476F1A, 	"e3": 0xFF529A27,
	"c0": 0xFF22B56F, 	"c1": 0xFF30EAA6, 	"c2": 0xFF58FAD4, 	"c3": 0xFFA0FFEE,
	"g0": 0xFF227496, 	"g1": 0xFF32A4C8, 	"g2": 0xFF58D6F2, 	"i0": 0xFFCFE5EE,
	"i1": 0xFF9BBFCE, 	"i2": 0xFF6E8F9E, 	"i3": 0xFF4C626E, 	"i4": 0xFF2A363E,
	"v0": 0xFF494E18, 	"v1": 0xFF717D26, 	"v2": 0xFFA0B852, 	"v3": 0xFFCCE495,
	"u0": 0xFF17274E, 	"u1": 0xFF275296, 	"u2": 0xFF3E7CCA, 	"n0": 0xFF160709,
	"n1": 0xFF2C1014, 	"n2": 0xFF481C22, 	"n3": 0xFF682D37, 	"y0": 0xFFB6A542,
	"y1": 0xFFEBE08E, 	"y2": 0xFFFCF7D4, 	"m0": 0xFF5E1278, 	"m1": 0xFF9522C2,
	"m2": 0xFFC86FF8, 	"w": 0xFFFFFFFF, 	"bk": 0xFF060402, 	"r0": 0xFF14143E,
	"r1": 0xFF223176, 	"r2": 0xFF2E52B4, 	"r3": 0xFF4A8CE2,
}


# ---------------------------------------------------------------------------
# Rng — original mulberry32 variant
# ---------------------------------------------------------------------------
