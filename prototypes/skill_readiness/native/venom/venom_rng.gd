class_name VenomRng
extends RefCounted

## Native port of the ORIGINAL Venomwright RNG from `src/game/pixel.ts`
## (the `Rng` class and `mkNoise`/`nz1`/`nz2`).
##
## This script IS the RNG (rather than containing an inner `Rng` class) for a
## GDScript reason: an inner class cannot call the enclosing script's `static
## func`, and a script cannot reference its own `class_name` while compiling.
## Being the RNG itself lets the instance methods and the noise statics share
## one bit-exact mulberry32 implementation through ordinary static calls.
##
## The mulberry32 sequence and the two 64x64 value-noise lattices are transcribed
## exactly; `nz1`/`nz2` feed the ground, water, vapour and liquid shaders, so a
## single off-by-one here changes every pixel of every skill.

static func u32(v: int) -> int:
	return v & 0xFFFFFFFF


static func i32(v: int) -> int:
	v = v & 0xFFFFFFFF
	if v >= 0x80000000:
		v -= 0x100000000
	return v


static func imul(a: int, b: int) -> int:
	return i32(u32(a) * u32(b))


# ---------------------------------------------------------------------------
# instance: mulberry32
# ---------------------------------------------------------------------------

var s: int = 1


func _init(seed_: int = 1) -> void:
	s = u32(seed_)


func next() -> float:
	s = u32(s + 0x6D2B79F5)
	var t: int = s
	t = imul(i32(t ^ (u32(t) >> 15)), i32(u32(t) | 1))
	t = i32(t ^ i32(i32(t) + imul(i32(t ^ (u32(t) >> 7)), i32(u32(t) | 61))))
	return float(u32(i32(t ^ (u32(t) >> 14)))) / 4294967296.0


func range(a: float, b: float) -> float:
	return a + (b - a) * next()


func int_n(n: int) -> int:
	return int(floor(next() * float(n)))


func sign() -> float:
	return -1.0 if next() < 0.5 else 1.0


func pick(a: Array):
	return a[int_n(a.size())]


# ---------------------------------------------------------------------------
# value-noise lattices (original mkNoise)
# ---------------------------------------------------------------------------

static func _mk_noise(cells: int, seed: int) -> PackedByteArray:
	var lat: Array = []
	# The original built the lattice with `new Rng(seed)`; the sequence is
	# inlined here so the static lattice does not have to instantiate the
	# script that owns it (GDScript cannot self-reference by class_name).
	var st: int = u32(seed)
	for _i in range(cells * cells):
		st = u32(st + 0x6D2B79F5)
		var t: int = st
		t = imul(i32(t ^ (u32(t) >> 15)), i32(u32(t) | 1))
		t = i32(t ^ i32(i32(t) + imul(i32(t ^ (u32(t) >> 7)), i32(u32(t) | 61))))
		lat.append(float(u32(i32(t ^ (u32(t) >> 14)))) / 4294967296.0)
	var out := PackedByteArray()
	out.resize(4096)
	var cs: float = 64.0 / float(cells)
	for y in range(64):
		for x in range(64):
			var gx: float = float(x) / cs
			var gy: float = float(y) / cs
			var x0: int = int(floor(gx))
			var y0: int = int(floor(gy))
			var fx: float = gx - float(x0)
			var fy: float = gy - float(y0)
			fx = fx * fx * (3.0 - 2.0 * fx)
			fy = fy * fy * (3.0 - 2.0 * fy)
			var a: float = lat[(y0 % cells) * cells + (x0 % cells)]
			var b: float = lat[(y0 % cells) * cells + ((x0 + 1) % cells)]
			var c: float = lat[((y0 + 1) % cells) * cells + (x0 % cells)]
			var d: float = lat[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)]
			out[y * 64 + x] = int(floor((a + (b - a) * fx + (c - a + (d - c - (b - a)) * fx) * fy) * 255.0)) & 255
	return out


static var NZ1: PackedByteArray = _mk_noise(8, 11)
static var NZ2: PackedByteArray = _mk_noise(16, 29)
# Float mirrors (byte / 255.0, same division the call sites perform) so hot
# raster loops skip the int->float conversion + division per pixel.
static var NZ1F: PackedFloat64Array = _mk_noise_f(NZ1)
static var NZ2F: PackedFloat64Array = _mk_noise_f(NZ2)


static func _mk_noise_f(src: PackedByteArray) -> PackedFloat64Array:
	var out := PackedFloat64Array()
	out.resize(src.size())
	for i in range(src.size()):
		out[i] = float(src[i]) / 255.0
	return out


static func nz1(x: float, y: float) -> int:
	return NZ1[((int(floor(y)) & 63) << 6) | (int(floor(x)) & 63)]


static func nz2(x: float, y: float) -> int:
	return NZ2[((int(floor(y)) & 63) << 6) | (int(floor(x)) & 63)]
