## Faithful port of original B src/engine/fx.ts helpers used by the
## ported effects (crackTree, flick, sparkle, smoke). bolt/drawBolt are
## ported with the TEMPEST batch, not stubbed here.
extends RefCounted
class_name BFx

static func flick(seed: float, t: float, rate: float = 18.0) -> float:
    return BMath.hash1(seed * 31.7 + floor(t * rate))

static func crack_tree(rng: BMath.BRng, x: float, y: float, arms: int, len_: float, spread: float = 0.5, step: float = 3.0) -> Array:
    var out: Array = []
    var stack: Array = []
    var a0 := rng.r(0.0, BMath.TAU)
    for k in range(arms):
        stack.append({"x": x, "y": y, "a": a0 + (float(k) / float(arms)) * BMath.TAU + rng.r(-0.4, 0.4), "l": len_ * rng.r(0.6, 1.1), "d": 0.0, "g": 0})
    while not stack.is_empty():
        var b: Dictionary = stack.pop_back()
        var cx: float = b.x
        var cy: float = b.y
        var a: float = b.a
        var d: float = b.d
        var n := maxi(1, floori(float(b.l) / step))
        for s in range(n):
            a += rng.r(-spread, spread)
            var nx := cx + cos(a) * step
            var ny := cy + sin(a) * step
            d += step / len_
            out.append({"x0": cx, "y0": cy, "x1": nx, "y1": ny, "d": d, "gen": int(b.g)})
            cx = nx
            cy = ny
            if int(b.g) < 3 and rng.next() < 0.13:
                stack.append({"x": cx, "y": cy, "a": a + rng.sign() * rng.r(0.5, 1.1), "l": (float(b.l) - float(s) * step) * rng.r(0.3, 0.6), "d": d, "g": int(b.g) + 1})
    return out

static func sparkle(r: BRenderer, x: float, y: float, size: float, col: Vector3, k: float = 1.0) -> void:
    r.px(x, y, col, k * 1.5)
    var s := 1.0
    while s <= size:
        var f := k * (1.0 - s / (size + 1.0))
        r.px(x + s, y, col, f)
        r.px(x - s, y, col, f)
        r.px(x, y + s, col, f)
        r.px(x, y - s, col, f)
        s += 1.0

static func smoke(r: BRenderer, x: float, y: float, rad: float, col: Vector3, a: float) -> void:
    if a <= 0.0:
        return
    r.disc(x, y, rad, col, BMath.clampf2(a), BRenderer.DITHER)
