class_name ArcanaUtil
extends RefCounted

## Native port of the ORIGINAL ARCANA III `src/engine/util.ts` pure helpers:
## deterministic mulberry32 RNG (per-playback reseed, zero seed maps to 1),
## easing, prog/sstep and the sin-hash value noise. This is the ARCANA family
## foundation ONLY: the PixiJS8 multipass renderer (core/draw/post/sprites)
## is a separate port and no visual parity is claimed from this file.
## Evidence: reference/arcana_node/results/vectors.json (original util.ts
## executed under Node) vs tests/gold93_arcana_reference_test.gd.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")

const W: int = 480
const H: int = 270
const CX: float = 240.0
const CY: float = 150.0
const YS: float = 0.7

static func _u32(v: int) -> int:
	return v & 0xFFFFFFFF


static func _i32(v: int) -> int:
	v = v & 0xFFFFFFFF
	return v - 0x100000000 if v >= 0x80000000 else v


static func _imul(a: int, b: int) -> int:
	return _i32(_u32(a) * _u32(b))


var _seed: int = 1


func reseed(s: int = 1) -> void:
	_seed = _u32(s)
	if _seed == 0:
		_seed = 1


func rand() -> float:
	_seed = _u32(_seed + 0x6D2B79F5)
	var t: int = _seed
	t = _imul(_i32(t ^ (_u32(t) >> 15)), _i32(_u32(t) | 1))
	t = _i32(t ^ _i32(_i32(t) + _imul(_i32(t ^ (_u32(t) >> 7)), _i32(_u32(t) | 61))))
	return float(_u32(_i32(t ^ (_u32(t) >> 14)))) / 4294967296.0


func rr(a: float, b: float) -> float:
	return a + (b - a) * rand()


static func clampf_(v: float, a: float = 0.0, b: float = 1.0) -> float:
	return a if v < a else (b if v > b else v)


static func lerpf_(a: float, b: float, t: float) -> float:
	return a + (b - a) * t


static func prog(t: float, a: float, b: float) -> float:
	return clampf_((t - a) / (b - a))


static func sstep(a: float, b: float, x: float) -> float:
	var t: float = clampf_((x - a) / (b - a))
	return t * t * (3.0 - 2.0 * t)


static func ease(name: String, t: float) -> float:
	match name:
		"lin": return t
		"in": return t * t
		"in3": return t * t * t
		"out": return 1.0 - (1.0 - t) * (1.0 - t)
		"out3": return 1.0 - V8M.v8_pow(1.0 - t, 3.0)
		"io": return 2.0 * t * t if t < 0.5 else 1.0 - V8M.v8_pow(-2.0 * t + 2.0, 2.0) / 2.0
		"io3": return 4.0 * t * t * t if t < 0.5 else 1.0 - V8M.v8_pow(-2.0 * t + 2.0, 3.0) / 2.0
		"outExpo": return 1.0 if t >= 1.0 else 1.0 - V8M.v8_pow(2.0, -10.0 * t)
		"inExpo": return 0.0 if t <= 0.0 else V8M.v8_pow(2.0, 10.0 * t - 10.0)
		"outBack": return 1.0 + 2.70158 * V8M.v8_pow(t - 1.0, 3.0) + 1.70158 * V8M.v8_pow(t - 1.0, 2.0)
		"sin": return V8M.v8_sin(t * PI)
	return t


static func hash1(n: float) -> float:
	var s: float = V8M.v8_sin(n * 127.1 + 311.7) * 43758.5453
	return s - floor(s)


static func hash2(x: float, y: float) -> float:
	var s: float = V8M.v8_sin(x * 127.1 + y * 311.7) * 43758.5453
	return s - floor(s)


static func vnoise(x: float, y: float) -> float:
	var xi: float = floor(x)
	var yi: float = floor(y)
	var xf: float = x - xi
	var yf: float = y - yi
	var u: float = xf * xf * (3.0 - 2.0 * xf)
	var v: float = yf * yf * (3.0 - 2.0 * yf)
	return lerpf_(lerpf_(hash2(xi, yi), hash2(xi + 1.0, yi), u),
		lerpf_(hash2(xi, yi + 1.0), hash2(xi + 1.0, yi + 1.0), u), v)
