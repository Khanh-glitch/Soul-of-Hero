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

const _INVPIO2 := 6.36619772367581382433e-01
const _PIO2_1 := 1.57079632673412561417e+00
const _PIO2_1T := 6.07710050650619224932e-11
const _PIO2_2 := 6.07710050630396597660e-11
const _PIO2_2T := 2.02226624879595063154e-21
const _PIO2_3 := 2.02226624871116645580e-21
const _PIO2_3T := 8.47842766036889956997e-32

const _NPIO2_HW: Array = [
	0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
	0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
	0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
	0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
	0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
	0x404858EB, 0x404921FB,
]

const _S1 := -1.66666666666666324348e-01
const _S2 := 8.33333333332248946124e-03
const _S3 := -1.98412698298579493134e-04
const _S4 := 2.75573137070700676789e-06
const _S5 := -2.50507602534068634195e-08
const _S6 := 1.58969099521155010221e-10
const _C1 := 4.16666666666666019037e-02
const _C2 := -1.38888888888741095749e-03
const _C3 := 2.48015872894767294178e-05
const _C4 := -2.75573143513906633035e-07
const _C5 := 2.08757232129817482790e-09
const _C6 := -1.13596475577881948265e-11

const _ATANHI: Array = [4.63647609000806093515e-01, 7.85398163397448278999e-01,
		9.82793723247329054082e-01, 1.57079632679489655800e+00]
const _ATANLO: Array = [2.26987774529616870924e-17, 3.06161699786838301793e-17,
		1.39033110312309984516e-17, 6.12323399573676603587e-17]
const _AT: Array = [3.33333333333329318027e-01, -1.99999999998764832476e-01,
		1.42857142725034663711e-01, -1.11111104054623557880e-01,
		9.09088713343650656196e-02, -7.69187620504482999495e-02,
		6.66107313738753120669e-02, -5.83357013379057348645e-02,
		4.97687799461593236017e-02, -3.65315727442169155270e-02,
		1.62858201153657823623e-02]

const _TINY := 1.0e-300
const _PI_O_4 := 7.8539816339744827900e-01
const _PI_O_2 := 1.5707963267948965580e+00
const _PI := 3.1415926535897931160e+00
const _PI_LO := 1.2246467991473531772e-16

const _PIO2_HI := 1.57079632679489655800e+00
const _PIO2_LO := 6.12323399573676603587e-17
const _PIO4_HI := 7.85398163397448278999e-01
const _PS0 := 1.66666666666666657415e-01
const _PS1 := -3.25565818622400915405e-01
const _PS2 := 2.01212532134862925881e-01
const _PS3 := -4.00555345006794114027e-02
const _PS4 := 7.91534994289814532176e-04
const _PS5 := 3.47933107596021167570e-05
const _QS1 := -2.40339491173441421878e+00
const _QS2 := 2.02094576023350569471e+00
const _QS3 := -6.88283971605453293030e-01
const _QS4 := 7.70381505559019352791e-02

const _O_THRESHOLD := 7.09782712893383973096e+02
const _U_THRESHOLD := -7.45133219101941108420e+02
const _TWOM1000 := 9.33263618503218878990e-302
const _LN2HI: Array = [6.93147180369123816490e-01, -6.93147180369123816490e-01]
const _LN2LO: Array = [1.90821492927058770002e-10, -1.90821492927058770002e-10]
const _INVLN2 := 1.44269504088896338700e+00
const _EP1 := 1.66666666666666019037e-01
const _EP2 := -2.77777777770155933842e-03
const _EP3 := 6.61375632143793436117e-05
const _EP4 := -1.65339022054652515390e-06
const _EP5 := 4.13813679705723846039e-08

const _LG1 := 6.666666666666735130e-01
const _LG2 := 3.999999999940941908e-01
const _LG3 := 2.857142874366239149e-01
const _LG4 := 2.222219843214978396e-01
const _LG5 := 1.818357216161805012e-01
const _LG6 := 1.531383769920937332e-01
const _LG7 := 1.479819860511658591e-01
const _LN2_HI := 6.93147180369123816490e-01
const _LN2_LO := 1.90821492927058770002e-10
const _TWO54 := 1.80143985094819840000e+16

const _BP: Array = [1.0, 1.5]
const _DP_H: Array = [0.0, 5.84962487220764160156e-01]
const _DP_L: Array = [0.0, 1.35003920212974897128e-08]
const _PL1 := 5.99999999999994648725e-01
const _PL2 := 4.28571428578550184252e-01
const _PL3 := 3.33333329818377432918e-01
const _PL4 := 2.72728123808534006489e-01
const _PL5 := 2.30660745775561754067e-01
const _PL6 := 2.06975017800338417784e-01
const _PP1 := 1.66666666666666019037e-01
const _PP2 := -2.77777777770155933842e-03
const _PP3 := 6.61375632143793436117e-05
const _PP4 := -1.65339022054652515390e-06
const _PP5 := 4.13813679705723846039e-08
const _PLG2 := 6.93147180559945286227e-01
const _LG2_H := 6.93147182464599609375e-01
const _LG2_L := -1.90465429995776804525e-09
const _OVT := 8.0085662595372944372e-0017
const _CP := 9.61796693925975554329e-01
const _CP_H := 9.61796700954437255859e-01
const _CP_L := -7.02846165095275826516e-09
const _IVLN2 := 1.44269504088896338700e+00
const _IVLN2_H := 1.44269502162933349609e+00
const _IVLN2_L := 1.92596299112661746887e-08

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
		if 1.0e300 + x > 1.0:
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
		var r0: float = f * f * (0.5 - 0.33333333333333333 * f)
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
		var w: float = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25))
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
