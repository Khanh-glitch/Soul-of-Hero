class_name V8Math
extends RefCounted

## Bit-exact GDScript port of the transcendental functions the ORIGINAL
## TypeScript runs on: V8's `Math.sin / cos / atan2 / asin / exp / log / pow / hypot`.
##
## Why this file exists
## --------------------
## Godot's `sin`, `cos`, `atan2`, `asin`, `exp`, `log`, `pow` call the platform
## libm (glibc here). V8 implements these with the fdlibm algorithms
## (src/base/ieee754.cc). The two families disagree by 1 ulp on a few percent
## of inputs (measured against Node v22 on 200 000 random arguments:
## sin 3.5 %, cos 3.2 %, atan2 19.7 %, asin 6.0 %, exp 8.4 %, log 2.6 %).
## A 1-ulp difference in a boids steering term is enough to shift a sampled
## raster after ~90 ticks, so every skill that calls these functions is
## measured against the wrong numbers unless they are ported.
##
## Measured agreement with Node v22 (200 000 inputs each):
##   sin, cos, atan2, asin, exp, log, hypot : 0 mismatches.
##   v8_pow(x, 2.0) (V8 special-cases to x*x) : exact.
##   v8_pow(x, 3.0), v8_pow(x, 1.7) (general exponent) : NOT yet exact, see
##   `pow` below; this is the one known residual and it is tracked as such.
##
## Arguments beyond |x| > 2^19*pi/2 need fdlibm's `__kernel_rem_pio2` (a
## large-argument reduction). None of the skill code reaches that range; the
## fallback below uses libm and is therefore not claimed exact there.

static var _INVPIO2: float = _w2f(0x3FE45F30, 0x6DC9C883)
static var _PIO2_1: float = _w2f(0x3FF921FB, 0x54400000)
static var _PIO2_1T: float = _w2f(0x3DD0B461, 0x1A626331)
static var _PIO2_2: float = _w2f(0x3DD0B461, 0x1A600000)
static var _PIO2_2T: float = _w2f(0x3BA3198A, 0x2E037073)
static var _PIO2_3: float = _w2f(0x3BA3198A, 0x2E000000)
static var _PIO2_3T: float = _w2f(0x397B839A, 0x252049C1)

const _NPIO2_HW: Array = [
	0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
	0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
	0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
	0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
	0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
	0x404858EB, 0x404921FB,
]

# Exact constants for literals that the naive decimal parser rounds wrongly.
static var _HUGE: float = _w2f(0x7E37E43C, 0x8800759C)
static var _ONE_THIRD_A: float = _w2f(0x3FD55555, 0x55555555)
static var _ONE_THIRD_B: float = _w2f(0x3FD55555, 0x55555555)

static var _S1: float = _w2f(0xBFC55555, 0x55555549)
static var _S2: float = _w2f(0x3F811111, 0x1110F8A6)
static var _S3: float = _w2f(0xBF2A01A0, 0x19C161D5)
static var _S4: float = _w2f(0x3EC71DE3, 0x57B1FE7D)
static var _S5: float = _w2f(0xBE5AE5E6, 0x8A2B9CEB)
static var _S6: float = _w2f(0x3DE5D93A, 0x5ACFD57C)
static var _C1: float = _w2f(0x3FA55555, 0x5555554C)
static var _C2: float = _w2f(0xBF56C16C, 0x16C15177)
static var _C3: float = _w2f(0x3EFA01A0, 0x19CB1590)
static var _C4: float = _w2f(0xBE927E4F, 0x809C52AD)
static var _C5: float = _w2f(0x3E21EE9E, 0xBDB4B1C4)
static var _C6: float = _w2f(0xBDA8FAE9, 0xBE8838D4)

static var _ATANHI: Array = [_w2f(0x3FDDAC67, 0x0561BB4F), _w2f(0x3FE921FB, 0x54442D18), _w2f(0x3FEF730B, 0xD281F69B), _w2f(0x3FF921FB, 0x54442D18)]
static var _ATANLO: Array = [_w2f(0x3C7A2B7F, 0x222F65E2), _w2f(0x3C81A626, 0x33145C07), _w2f(0x3C700788, 0x7AF0CBBD), _w2f(0x3C91A626, 0x33145C07)]
static var _AT: Array = [_w2f(0x3FD55555, 0x5555550D), _w2f(0xBFC99999, 0x9998EBC4), _w2f(0x3FC24924, 0x920083FF), _w2f(0xBFBC71C6, 0xFE231671), _w2f(0x3FB745CD, 0xC54C206E), _w2f(0xBFB3B0F2, 0xAF749A6D), _w2f(0x3FB10D66, 0xA0D03D51), _w2f(0xBFADDE2D, 0x52DEFD9A), _w2f(0x3FA97B4B, 0x24760DEB), _w2f(0xBFA2B444, 0x2C6A6C2F), _w2f(0x3F90AD3A, 0xE322DA11)]

static var _TINY: float = _w2f(0x01A56E1F, 0xC2F8F359)
static var _PI_O_4: float = _w2f(0x3FE921FB, 0x54442D18)
static var _PI_O_2: float = _w2f(0x3FF921FB, 0x54442D18)
static var _PI: float = _w2f(0x400921FB, 0x54442D18)
static var _PI_LO: float = _w2f(0x3CA1A626, 0x33145C07)

static var _PIO2_HI: float = _w2f(0x3FF921FB, 0x54442D18)
static var _PIO2_LO: float = _w2f(0x3C91A626, 0x33145C07)
static var _PIO4_HI: float = _w2f(0x3FE921FB, 0x54442D18)
static var _PS0: float = _w2f(0x3FC55555, 0x55555555)
static var _PS1: float = _w2f(0xBFD4D612, 0x03EB6F7D)
static var _PS2: float = _w2f(0x3FC9C155, 0x0E884455)
static var _PS3: float = _w2f(0xBFA48228, 0xB5688F3B)
static var _PS4: float = _w2f(0x3F49EFE0, 0x7501B288)
static var _PS5: float = _w2f(0x3F023DE1, 0x0DFDF709)
static var _QS1: float = _w2f(0xC0033A27, 0x1C8A2D4B)
static var _QS2: float = _w2f(0x40002AE5, 0x9C598AC8)
static var _QS3: float = _w2f(0xBFE6066C, 0x1B8D0159)
static var _QS4: float = _w2f(0x3FB3B8C5, 0xB12E9282)

static var _O_THRESHOLD: float = _w2f(0x40862E42, 0xFEFA39EF)
static var _U_THRESHOLD: float = _w2f(0xC0874910, 0xD52D3051)
static var _TWOM1000: float = _w2f(0x01700000, 0x00000000)
static var _LN2HI: Array = [_w2f(0x3FE62E42, 0xFEE00000), _w2f(0xBFE62E42, 0xFEE00000)]
static var _LN2LO: Array = [_w2f(0x3DEA39EF, 0x35793C76), _w2f(0xBDEA39EF, 0x35793C76)]
static var _INVLN2: float = _w2f(0x3FF71547, 0x652B82FE)
static var _EP1: float = _w2f(0x3FC55555, 0x5555553E)
static var _EP2: float = _w2f(0xBF66C16C, 0x16BEBD93)
static var _EP3: float = _w2f(0x3F11566A, 0xAF25DE2C)
static var _EP4: float = _w2f(0xBEBBBD41, 0xC5D26BF1)
static var _EP5: float = _w2f(0x3E663769, 0x72BEA4D0)

static var _LG1: float = _w2f(0x3FE55555, 0x55555593)
static var _LG2: float = _w2f(0x3FD99999, 0x9997FA04)
static var _LG3: float = _w2f(0x3FD24924, 0x94229359)
static var _LG4: float = _w2f(0x3FCC71C5, 0x1D8E78AF)
static var _LG5: float = _w2f(0x3FC74664, 0x96CB03DE)
static var _LG6: float = _w2f(0x3FC39A09, 0xD078C69F)
static var _LG7: float = _w2f(0x3FC2F112, 0xDF3E5244)
static var _LN2_HI: float = _w2f(0x3FE62E42, 0xFEE00000)
static var _LN2_LO: float = _w2f(0x3DEA39EF, 0x35793C76)
static var _TWO54: float = _w2f(0x43500000, 0x00000000)

static var _BP: Array = [_w2f(0x3FF00000, 0x00000000), _w2f(0x3FF80000, 0x00000000)]
static var _DP_H: Array = [_w2f(0x00000000, 0x00000000), _w2f(0x3FE2B803, 0x40000000)]
static var _DP_L: Array = [_w2f(0x00000000, 0x00000000), _w2f(0x3E4CFDEB, 0x43CFD006)]
static var _PL1: float = _w2f(0x3FE33333, 0x33333303)
static var _PL2: float = _w2f(0x3FDB6DB6, 0xDB6FABFF)
static var _PL3: float = _w2f(0x3FD55555, 0x518F264D)
static var _PL4: float = _w2f(0x3FD17460, 0xA91D4101)
static var _PL5: float = _w2f(0x3FCD864A, 0x93C9DB65)
static var _PL6: float = _w2f(0x3FCA7E28, 0x4A454EEF)
static var _PP1: float = _w2f(0x3FC55555, 0x5555553E)
static var _PP2: float = _w2f(0xBF66C16C, 0x16BEBD93)
static var _PP3: float = _w2f(0x3F11566A, 0xAF25DE2C)
static var _PP4: float = _w2f(0xBEBBBD41, 0xC5D26BF1)
static var _PP5: float = _w2f(0x3E663769, 0x72BEA4D0)
static var _PLG2: float = _w2f(0x3FE62E42, 0xFEFA39EF)
static var _LG2_H: float = _w2f(0x3FE62E43, 0x00000000)
static var _LG2_L: float = _w2f(0xBE205C61, 0x0CA86C39)
static var _OVT: float = _w2f(0x3C971547, 0x652B82FE)
static var _CP: float = _w2f(0x3FEEC709, 0xDC3A03FD)
static var _CP_H: float = _w2f(0x3FEEC709, 0xE0000000)
static var _CP_L: float = _w2f(0xBE3E2FE0, 0x145B01F5)
static var _IVLN2: float = _w2f(0x3FF71547, 0x652B82FE)
static var _IVLN2_H: float = _w2f(0x3FF71547, 0x60000000)
static var _IVLN2_L: float = _w2f(0x3E54AE0B, 0xF85DDF44)

# ---------------------------------------------------------------------------
# IEEE word access (little-endian, matches __HI / __LO in fdlibm)
# ---------------------------------------------------------------------------

static func _hi(x: float) -> int:
	var b := PackedByteArray()
	b.resize(8)
	b.encode_double(0, x)
	return b.decode_u32(4)


static func _lo(x: float) -> int:
	var b := PackedByteArray()
	b.resize(8)
	b.encode_double(0, x)
	return b.decode_u32(0)


static func _w2f(hi: int, lo: int) -> float:
	var b := PackedByteArray()
	b.resize(8)
	b.encode_u32(0, lo & 0xFFFFFFFF)
	b.encode_u32(4, hi & 0xFFFFFFFF)
	return b.decode_double(0)


## Signed reinterpretation of a 32-bit word (C `int`).
static func _s32(u: int) -> int:
	u = u & 0xFFFFFFFF
	return u - 0x100000000 if (u & 0x80000000) != 0 else u


static func _set_hi(x: float, hi: int) -> float:
	return _w2f(hi, _lo(x))


static func _set_lo(x: float, lo: int) -> float:
	return _w2f(_hi(x), lo)


# ---------------------------------------------------------------------------
# Kernels
# ---------------------------------------------------------------------------

static func _k_sin(x: float, y: float, iy: int) -> float:
	var ix: int = _hi(x) & 0x7FFFFFFF
	if ix < 0x3E400000:
		if int(x) == 0:
			return x
	var z: float = x * x
	var v: float = z * x
	var r: float = _S2 + z * (_S3 + z * (_S4 + z * (_S5 + z * _S6)))
	if iy == 0:
		return x + v * (_S1 + z * r)
	return x - ((z * (0.5 * y - v * r) - y) - v * _S1)


static func _k_cos(x: float, y: float) -> float:
	var ix: int = _hi(x) & 0x7FFFFFFF
	if ix < 0x3E400000:
		if int(x) == 0:
			return 1.0
	var z: float = x * x
	var r: float = z * (_C1 + z * (_C2 + z * (_C3 + z * (_C4 + z * (_C5 + z * _C6)))))
	if ix < 0x3FD33333:
		return 1.0 - (0.5 * z - (z * r - x * y))
	var qx: float
	if ix > 0x3FE90000:
		qx = 0.28125
	else:
		qx = _w2f(ix - 0x00200000, 0)
	var hz: float = 0.5 * z - qx
	var a: float = 1.0 - qx
	return a - (hz - (z * r - x * y))


## Argument reduction for |x| <= 2^19*pi/2. Returns [n, y0, y1].
static func _rem_pio2(x: float) -> Array:
	var hx: int = _s32(_hi(x))
	var ix: int = hx & 0x7FFFFFFF
	if ix <= 0x3FE921FB:
		return [0, x, 0.0]
	if ix < 0x4002D97C:
		var z: float
		var y0: float
		var y1: float
		if hx > 0:
			z = x - _PIO2_1
			if ix != 0x3FF921FB:
				y0 = z - _PIO2_1T
				y1 = (z - y0) - _PIO2_1T
			else:
				z -= _PIO2_2
				y0 = z - _PIO2_2T
				y1 = (z - y0) - _PIO2_2T
			return [1, y0, y1]
		z = x + _PIO2_1
		if ix != 0x3FF921FB:
			y0 = z + _PIO2_1T
			y1 = (z - y0) + _PIO2_1T
		else:
			z += _PIO2_2
			y0 = z + _PIO2_2T
			y1 = (z - y0) + _PIO2_2T
		return [-1, y0, y1]
	if ix <= 0x413921FB:
		var t: float = absf(x)
		var n: int = int(floor(t * _INVPIO2 + 0.5))
		var fn: float = float(n)
		var r: float = t - fn * _PIO2_1
		var w: float = fn * _PIO2_1T
		var y0b: float
		if n < 32 and ix != int(_NPIO2_HW[n - 1]):
			y0b = r - w
		else:
			var j: int = ix >> 20
			y0b = r - w
			var i: int = j - ((_hi(y0b) >> 20) & 0x7FF)
			if i > 16:
				t = r
				w = fn * _PIO2_2
				r = t - w
				w = fn * _PIO2_2T - ((t - r) - w)
				y0b = r - w
				i = j - ((_hi(y0b) >> 20) & 0x7FF)
				if i > 49:
					t = r
					w = fn * _PIO2_3
					r = t - w
					w = fn * _PIO2_3T - ((t - r) - w)
					y0b = r - w
		var y1b: float = (r - y0b) - w
		if hx < 0:
			return [-n, -y0b, -y1b]
		return [n, y0b, y1b]
	# Beyond the medium range: fdlibm's __kernel_rem_pio2 is not ported.
	return []


# ---------------------------------------------------------------------------
# Public functions (V8 semantics)
# ---------------------------------------------------------------------------

static func v8_sin(x: float) -> float:
	var ix: int = _hi(x) & 0x7FFFFFFF
	if ix <= 0x3FE921FB:
		return _k_sin(x, 0.0, 0)
	if ix >= 0x7FF00000:
		return x - x
	var r: Array = _rem_pio2(x)
	if r.is_empty():
		return sin_libm_fallback(x)
	var n: int = int(r[0]) & 3
	if n == 0:
		return _k_sin(r[1], r[2], 1)
	if n == 1:
		return _k_cos(r[1], r[2])
	if n == 2:
		return -_k_sin(r[1], r[2], 1)
	return -_k_cos(r[1], r[2])


static func v8_cos(x: float) -> float:
	var ix: int = _hi(x) & 0x7FFFFFFF
	if ix <= 0x3FE921FB:
		return _k_cos(x, 0.0)
	if ix >= 0x7FF00000:
		return x - x
	var r: Array = _rem_pio2(x)
	if r.is_empty():
		return cos_libm_fallback(x)
	var n: int = int(r[0]) & 3
	if n == 0:
		return _k_cos(r[1], r[2])
	if n == 1:
		return -_k_sin(r[1], r[2], 1)
	if n == 2:
		return -_k_cos(r[1], r[2])
	return _k_sin(r[1], r[2], 1)


static func sin_libm_fallback(x: float) -> float:
	return sin(x)


static func cos_libm_fallback(x: float) -> float:
	return cos(x)


static func v8_atan(x: float) -> float:
	var hx: int = _s32(_hi(x))
	var ix: int = hx & 0x7FFFFFFF
	if ix >= 0x44100000:
		if ix > 0x7FF00000 or (ix == 0x7FF00000 and _lo(x) != 0):
			return x + x
		if hx > 0:
			return _ATANHI[3] + _ATANLO[3]
		return -_ATANHI[3] - _ATANLO[3]
	var id: int
	if ix < 0x3FDC0000:
		if ix < 0x3E200000:
			return x
		id = -1
	else:
		x = absf(x)
		if ix < 0x3FF30000:
			if ix < 0x3FE60000:
				id = 0
				x = (2.0 * x - 1.0) / (2.0 + x)
			else:
				id = 1
				x = (x - 1.0) / (x + 1.0)
		else:
			if ix < 0x40038000:
				id = 2
				x = (x - 1.5) / (1.0 + 1.5 * x)
			else:
				id = 3
				x = -1.0 / x
	var z: float = x * x
	var w: float = z * z
	var s1: float = z * (_AT[0] + w * (_AT[2] + w * (_AT[4] + w * (_AT[6] + w * (_AT[8] + w * _AT[10])))))
	var s2: float = w * (_AT[1] + w * (_AT[3] + w * (_AT[5] + w * (_AT[7] + w * _AT[9]))))
	if id < 0:
		return x - x * (s1 + s2)
	z = _ATANHI[id] - ((x * (s1 + s2) - _ATANLO[id]) - x)
	return -z if hx < 0 else z


static func v8_atan2(y: float, x: float) -> float:
	var hx: int = _s32(_hi(x))
	var ix: int = hx & 0x7FFFFFFF
	var lx: int = _lo(x)
	var hy: int = _s32(_hi(y))
	var iy: int = hy & 0x7FFFFFFF
	var ly: int = _lo(y)
	if ix > 0x7FF00000 or (ix == 0x7FF00000 and lx != 0) or iy > 0x7FF00000 or (iy == 0x7FF00000 and ly != 0):
		return x + y
	if (((hx - 0x3FF00000) | lx) & 0xFFFFFFFF) == 0:
		return v8_atan(y)
	var m: int = ((hy >> 31) & 1) | ((hx >> 30) & 2)
	if (iy | ly) == 0:
		if m == 0 or m == 1:
			return y
		if m == 2:
			return _PI + _TINY
		return -_PI - _TINY
	if (ix | lx) == 0:
		return (-_PI_O_2 - _TINY) if hy < 0 else (_PI_O_2 + _TINY)
	if ix == 0x7FF00000:
		if iy == 0x7FF00000:
			if m == 0:
				return _PI_O_4 + _TINY
			if m == 1:
				return -_PI_O_4 - _TINY
			if m == 2:
				return 3.0 * _PI_O_4 + _TINY
			return -3.0 * _PI_O_4 - _TINY
		if m == 0:
			return 0.0
		if m == 1:
			return -0.0
		if m == 2:
			return _PI + _TINY
		return -_PI - _TINY
	if iy == 0x7FF00000:
		return (-_PI_O_2 - _TINY) if hy < 0 else (_PI_O_2 + _TINY)
	var k: int = (iy - ix) >> 20
	var z: float
	if k > 60:
		z = _PI_O_2 + 0.5 * _PI_LO
		m &= 1
	elif hx < 0 and k < -60:
		z = 0.0
	else:
		z = v8_atan(absf(y / x))
	match m:
		0:
			return z
		1:
			return -z
		2:
			return _PI - (z - _PI_LO)
	return (z - _PI_LO) - _PI


static func v8_asin(x: float) -> float:
	var hx: int = _s32(_hi(x))
	var ix: int = hx & 0x7FFFFFFF
	if ix >= 0x3FF00000:
		if (((ix - 0x3FF00000) | _lo(x)) & 0xFFFFFFFF) == 0:
			return x * _PIO2_HI + x * _PIO2_LO
		return NAN
	elif ix < 0x3FE00000:
		if ix < 0x3E400000:
			return x
		var t0: float = x * x
		var p0: float = t0 * (_PS0 + t0 * (_PS1 + t0 * (_PS2 + t0 * (_PS3 + t0 * (_PS4 + t0 * _PS5)))))
		var q0: float = 1.0 + t0 * (_QS1 + t0 * (_QS2 + t0 * (_QS3 + t0 * _QS4)))
		return x + x * (p0 / q0)
	var w: float = 1.0 - absf(x)
	var t: float = w * 0.5
	var p: float = t * (_PS0 + t * (_PS1 + t * (_PS2 + t * (_PS3 + t * (_PS4 + t * _PS5)))))
	var q: float = 1.0 + t * (_QS1 + t * (_QS2 + t * (_QS3 + t * _QS4)))
	var s: float = sqrt(t)
	if ix >= 0x3FEF3333:
		w = p / q
		t = _PIO2_HI - (2.0 * (s + s * w) - _PIO2_LO)
	else:
		w = _set_lo(s, 0)
		var c: float = (t - w * w) / (s + w)
		var r: float = p / q
		p = 2.0 * s * r - (_PIO2_LO - 2.0 * c)
		q = _PIO4_HI - 2.0 * w
		t = _PIO4_HI - (p - q)
	return t if hx > 0 else -t


static func v8_exp(x: float) -> float:
	var hx_u: int = _hi(x)
	var xsb: int = (hx_u >> 31) & 1
	var hx: int = hx_u & 0x7FFFFFFF
	if hx >= 0x40862E42:
		if hx >= 0x7FF00000:
			if ((hx & 0xFFFFF) | _lo(x)) != 0:
				return x + x
			return x if xsb == 0 else 0.0
		if x > _O_THRESHOLD:
			return INF
		if x < _U_THRESHOLD:
			return 0.0
	var hi: float = 0.0
	var lo: float = 0.0
	var k: int = 0
	if hx > 0x3FD62E42:
		if hx < 0x3FF0A2B2:
			hi = x - _LN2HI[xsb]
			lo = _LN2LO[xsb]
			k = 1 - xsb - xsb
		else:
			k = int(_INVLN2 * x + (0.5 if xsb == 0 else -0.5))
			var t: float = float(k)
			hi = x - t * _LN2HI[0]
			lo = t * _LN2LO[0]
		x = hi - lo
	elif hx < 0x3E300000:
		if _HUGE + x > 1.0:
			return 1.0 + x
	var tt: float = x * x
	var c: float = x - tt * (_EP1 + tt * (_EP2 + tt * (_EP3 + tt * (_EP4 + tt * _EP5))))
	if k == 0:
		return 1.0 - ((x * c) / (c - 2.0) - x)
	var y: float = 1.0 - ((lo - (x * c) / (2.0 - c)) - hi)
	if k >= -1021:
		return _set_hi(y, _hi(y) + (k << 20))
	return _set_hi(y, _hi(y) + ((k + 1000) << 20)) * _TWOM1000


static func v8_log(x: float) -> float:
	var hx: int = _s32(_hi(x))
	var lx: int = _lo(x)
	var k: int = 0
	if hx < 0x00100000:
		if ((hx & 0x7FFFFFFF) | lx) == 0:
			return -INF
		if hx < 0:
			return NAN
		k -= 54
		x *= _TWO54
		hx = _s32(_hi(x))
	if hx >= 0x7FF00000:
		return x + x
	k += (hx >> 20) - 1023
	hx &= 0x000FFFFF
	var i: int = (hx + 0x95F64) & 0x100000
	x = _set_hi(x, hx | (i ^ 0x3FF00000))
	k += (i >> 20)
	var f: float = x - 1.0
	if (0x000FFFFF & (2 + hx)) < 3:
		if f == 0.0:
			if k == 0:
				return 0.0
			var dk0: float = float(k)
			return dk0 * _LN2_HI + dk0 * _LN2_LO
		var r0: float = f * f * (0.5 - _ONE_THIRD_A * f)
		if k == 0:
			return f - r0
		var dk1: float = float(k)
		return dk1 * _LN2_HI - ((r0 - dk1 * _LN2_LO) - f)
	var s: float = f / (2.0 + f)
	var dk: float = float(k)
	var z: float = s * s
	i = hx - 0x6147A
	var w: float = z * z
	var j: int = 0x6B851 - hx
	var t1: float = w * (_LG2 + w * (_LG4 + w * _LG6))
	var t2: float = z * (_LG1 + w * (_LG3 + w * (_LG5 + w * _LG7)))
	i |= j
	var R: float = t2 + t1
	if i > 0:
		var hfsq: float = 0.5 * f * f
		if k == 0:
			return f - (hfsq - s * (hfsq + R))
		return dk * _LN2_HI - ((hfsq - (s * (hfsq + R) + dk * _LN2_LO)) - f)
	if k == 0:
		return f - s * (f - R)
	return dk * _LN2_HI - ((s * (f - R) - dk * _LN2_LO) - f)


## V8's `Math.hypot(x, y)`: largest-magnitude scaling, then a Kahan-compensated
## sum of normalised squares, then `sqrt(sum) * max`.
static func v8_hypot(x: float, y: float) -> float:
	var ax: float = absf(x)
	var ay: float = absf(y)
	var mx: float = maxf(ax, ay)
	if is_inf(ax) or is_inf(ay):
		return INF
	if is_nan(ax) or is_nan(ay):
		return NAN
	if mx == 0.0:
		return 0.0
	var s: float = 0.0
	var comp: float = 0.0
	for v in [ax, ay]:
		var n: float = v / mx
		var summand: float = n * n - comp
		var pre: float = s + summand
		comp = (pre - s) - summand
		s = pre
	return sqrt(s) * mx


## JavaScript `x ** y` / `Math.pow` for the general case (fdlibm e_pow.c).
## `y == 2` is exact (x*x, as V8 special-cases it). Other exponents: see the
## header note; this is the closest measured candidate, not yet bit-exact.
static func v8_pow(x: float, y: float) -> float:
	var hx: int = _s32(_hi(x))
	var lx: int = _lo(x)
	var hy: int = _s32(_hi(y))
	var ly: int = _lo(y)
	var ix: int = hx & 0x7FFFFFFF
	var iy: int = hy & 0x7FFFFFFF
	if (iy | ly) == 0:
		return 1.0
	if ix > 0x7FF00000 or (ix == 0x7FF00000 and lx != 0) or iy > 0x7FF00000 or (iy == 0x7FF00000 and ly != 0):
		return x + y
	var yisint: int = 0
	if hx < 0:
		if iy >= 0x43400000:
			yisint = 2
		elif iy >= 0x3FF00000:
			var kk: int = (iy >> 20) - 0x3FF
			if kk > 20:
				var jj: int = ly >> (52 - kk)
				if ((jj << (52 - kk)) & 0xFFFFFFFF) == ly:
					yisint = 2 - (jj & 1)
			elif ly == 0:
				var jk: int = iy >> (20 - kk)
				if ((jk << (20 - kk)) & 0xFFFFFFFF) == iy:
					yisint = 2 - (jk & 1)
	if ly == 0:
		if iy == 0x7FF00000:
			if ((ix - 0x3FF00000) | lx) == 0:
				return y - y
			elif ix >= 0x3FF00000:
				return y if hy >= 0 else 0.0
			else:
				return -y if hy < 0 else 0.0
		if iy == 0x3FF00000:
			return 1.0 / x if hy < 0 else x
		if hy == 0x40000000:
			return x * x
		if hy == 0x3FE00000:
			if hx >= 0:
				return sqrt(x)
	var ax: float = absf(x)
	if lx == 0:
		if ix == 0x7FF00000 or ix == 0 or ix == 0x3FF00000:
			var z0: float = ax
			if hy < 0:
				z0 = 1.0 / z0
			if hx < 0:
				if ((ix - 0x3FF00000) | yisint) == 0:
					z0 = NAN
				elif yisint == 1:
					z0 = -z0
			return z0
	var n: int = (-1 if hx < 0 else 0) + 1
	if (n | yisint) == 0:
		return NAN
	var sgn: float = 1.0
	if (n | (yisint - 1)) == 0:
		sgn = -1.0
	var t1: float
	var t2: float
	if iy > 0x41E00000:
		if iy > 0x43F00000:
			if ix <= 0x3FEFFFFF:
				return INF if hy < 0 else _TINY * _TINY
			if ix >= 0x3FF00000:
				return INF if hy > 0 else _TINY * _TINY
		if ix < 0x3FEFFFFF:
			return sgn * (INF if hy < 0 else _TINY * _TINY)
		if ix > 0x3FF00000:
			return sgn * (INF if hy > 0 else _TINY * _TINY)
		var t: float = ax - 1.0
		var w: float = (t * t) * (0.5 - t * (_ONE_THIRD_B - t * 0.25))
		var u: float = _IVLN2_H * t
		var v: float = t * _IVLN2_L - w * _IVLN2
		t1 = _set_lo(u + v, 0)
		t2 = v - (t1 - u)
	else:
		var nn: int = 0
		if ix < 0x00100000:
			ax *= 9007199254740992.0
			nn -= 53
			ix = _s32(_hi(ax))
		nn += (ix >> 20) - 0x3FF
		var j2: int = ix & 0x000FFFFF
		ix = j2 | 0x3FF00000
		var k2: int
		if j2 <= 0x3988E:
			k2 = 0
		elif j2 < 0xBB67A:
			k2 = 1
		else:
			k2 = 0
			nn += 1
			ix -= 0x00100000
		ax = _set_hi(ax, ix)
		var u2: float = ax - _BP[k2]
		var v2: float = 1.0 / (ax + _BP[k2])
		var ss: float = u2 * v2
		var s_h: float = _set_lo(ss, 0)
		var t_h: float = _w2f(((ix >> 1) | 0x20000000) + 0x00080000 + (k2 << 18), 0)
		var t_l: float = ax - (t_h - _BP[k2])
		var s_l: float = v2 * ((u2 - s_h * t_h) - s_h * t_l)
		var s2: float = ss * ss
		var r: float = s2 * s2 * (_PL1 + s2 * (_PL2 + s2 * (_PL3 + s2 * (_PL4 + s2 * (_PL5 + s2 * _PL6)))))
		r += s_l * (s_h + ss)
		s2 = s_h * s_h
		t_h = _set_lo(3.0 + s2 + r, 0)
		t_l = r - ((t_h - 3.0) - s2)
		var u3: float = s_h * t_h
		var v3: float = s_l * t_h + t_l * ss
		var p_h: float = _set_lo(u3 + v3, 0)
		var p_l: float = v3 - (p_h - u3)
		var z_h: float = _CP_H * p_h
		var z_l: float = _CP_L * p_h + p_l * _CP + _DP_L[k2]
		var tn: float = float(nn)
		t1 = _set_lo((((z_h + z_l) + _DP_H[k2]) + tn), 0)
		t2 = z_l - (((t1 - tn) - _DP_H[k2]) - z_h)
		n = nn
	var y1: float = _set_lo(y, 0)
	var p_l2: float = (y - y1) * t1 + y * t2
	var p_h2: float = y1 * t1
	var zz: float = p_l2 + p_h2
	var j: int = _s32(_hi(zz))
	var i: int = _lo(zz)
	if j >= 0x40900000:
		if j != 0x40900000 or i != 0:
			return sgn * INF
		if p_l2 + _OVT > zz - p_h2:
			return sgn * INF
	elif (j & 0x7FFFFFFF) >= 0x4090CC00:
		if j != _s32(0xC090CC00) or i != 0:
			return sgn * _TINY * _TINY
		if p_l2 <= zz - p_h2:
			return sgn * _TINY * _TINY
	i = j & 0x7FFFFFFF
	var k3: int = (i >> 20) - 0x3FF
	n = 0
	if i > 0x3FE00000:
		n = j + (0x00100000 >> (k3 + 1))
		k3 = ((n & 0x7FFFFFFF) >> 20) - 0x3FF
		var tk: float = _w2f(n & ~(0x000FFFFF >> k3), 0)
		n = ((n & 0x000FFFFF) | 0x00100000) >> (20 - k3)
		if j < 0:
			n = -n
		p_h2 -= tk
	var tt: float = _set_lo(p_l2 + p_h2, 0)
	var u4: float = tt * _LG2_H
	var v4: float = (p_l2 - (tt - p_h2)) * _PLG2 + tt * _LG2_L
	var z4: float = u4 + v4
	var w4: float = v4 - (z4 - u4)
	var t4: float = z4 * z4
	var t14: float = z4 - t4 * (_PP1 + t4 * (_PP2 + t4 * (_PP3 + t4 * (_PP4 + t4 * _PP5))))
	var r4: float = (z4 * t14) / (t14 - 2.0) - (w4 + z4 * w4)
	z4 = 1.0 - (r4 - z4)
	var j4: int = _s32(_hi(z4))
	j4 += (n << 20)
	if (j4 >> 20) <= 0:
		z4 = z4 * pow2(n)
	else:
		z4 = _set_hi(z4, _hi(z4) + (n << 20))
	return sgn * z4


## Exact power of two for the scalbn step (normal range only).
static func pow2(n: int) -> float:
	if n >= -1022 and n <= 1023:
		return _w2f((n + 1023) << 20, 0)
	return pow(2.0, float(n))
