class_name VenomEngine
extends RefCounted

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")

## Native port of the ORIGINAL Venomwright casting pipeline from
## `src/game/engine.ts` / `src/game/skills/index.ts` (as exercised by the
## oracle driver): `buildGfx`, `resolve`, `autoAim` and `cast`.
##
## `cast()` reproduces the ORIGINAL cast identity exactly, because that identity
## seeds the cast RNG and therefore decides every random element of the skill:
##     rng = Rng((world.seed * 1315423911 + castId * 2654435761 + skillId * 97) >>> 0)

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")
const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const WORLD = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")

const RW: int = 1200
const RH: int = 680
const RK: float = 2.0
const WW: float = 600.0
const WH: float = 340.0


## The `Cast` object handed to every skill generator.
class CastObj extends RefCounted:
	var w = null
	var id: int = 0
	var def: Dictionary = {}
	var ox: float = 0.0
	var oy: float = 0.0
	var ang: float = 0.0
	var tx: float = 0.0
	var ty: float = 0.0
	var target = null
	var targets: Array = []
	var route: Array = []
	var rng = null
	var dx: float = 0.0
	var dy: float = 0.0

	## Authored damage scaling: every skill number is a percentage of ATK.
	func d(pct: float) -> float:
		return WORLD.ATK * pct / 100.0


static func build_gfx() -> Dictionary:
	var scene = PX.Layer.new(RW, RH, RK)
	var glow = PX.Layer.new(RW, RH, RK)
	var field = PX.Field.new(RW, RH, RK)
	return {"s": scene, "l": glow, "f": field, "t": 0.0, "W": RW, "H": RH, "k": RK}


## Same ground the oracle uses: `makeGround(Layer, 17)` at native resolution.
static func make_ground_buffer():
	var L = PX.Layer.new(RW, RH, RK)
	DRAW.make_ground(L, 17)
	return L


static func resolve(w, def: Dictionary, mx: float, my: float) -> Dictionary:
	var p = w.player
	var ai: Dictionary = def["aim"]
	var dx: float = mx - p.x
	var dy: float = my - p.y
	var d: float = sqrt(dx * dx + dy * dy)
	if d == 0.0:
		d = 1.0
	var ang: float = V8M.v8_atan2(dy, dx)
	var dd: float = minf(d, float(ai["range"]))
	var r: Dictionary = {
		"ang": ang,
		"tx": p.x + (dx / d) * dd,
		"ty": p.y + (dy / d) * dd,
		"target": null, "targets": [], "route": [], "ok": true,
	}
	var al: Array = []
	for e in w.enemies:
		if e.dying <= 0:
			al.append(e)
	var kind: String = String(ai["kind"])
	if kind == "target":
		var best = null
		var bd: float = 1e9
		for e in al:
			var dm: float = sqrt(V8M.v8_pow(e.x - mx, 2.0) + V8M.v8_pow(e.y - my, 2.0)) - e.r
			if dm < bd and dm < 26:
				bd = dm
				best = e
		if best != null and sqrt(V8M.v8_pow(best.x - p.x, 2.0) + V8M.v8_pow(best.y - p.y, 2.0)) \
				- best.r > float(ai["range"]) + 4:
			best = null
		r["target"] = best
		r["ok"] = best != null
	elif kind == "multi":
		var cand: Array = []
		for e in al:
			if sqrt(V8M.v8_pow(e.x - p.x, 2.0) + V8M.v8_pow(e.y - p.y, 2.0)) - e.r < float(ai["range"]):
				cand.append(e)
		M.stable_sort(cand, func(a, b):
			return (sqrt(V8M.v8_pow(a.x - mx, 2.0) + V8M.v8_pow(a.y - my, 2.0))
					- sqrt(V8M.v8_pow(b.x - mx, 2.0) + V8M.v8_pow(b.y - my, 2.0))))
		var n: int = int(ai.get("n", 3))
		r["targets"] = cand.slice(0, mini(n, cand.size()))
		r["ok"] = r["targets"].size() > 0
	elif kind == "dir" or kind == "path" or kind == "cone":
		r["tx"] = p.x + V8M.v8_cos(ang) * float(ai["range"])
		r["ty"] = p.y + V8M.v8_sin(ang) * float(ai["range"])
	elif kind == "drag":
		r["route"] = []
		r["tx"] = mx
		r["ty"] = my
	elif kind == "self":
		r["tx"] = p.x
		r["ty"] = p.y
	return r


static func auto_aim(w, def: Dictionary) -> Dictionary:
	var p = w.player
	var al: Array = []
	for e in w.enemies:
		if e.dying <= 0:
			al.append(e)
	var cx: float = p.x + 120
	var cy: float = p.y
	if al.size() > 0:
		var bn: int = -1
		var bi: int = 0
		for i in range(al.size()):
			var e = al[i]
			var n: int = 0
			for o in al:
				if sqrt(V8M.v8_pow(o.x - e.x, 2.0) + V8M.v8_pow(o.y - e.y, 2.0)) < 55:
					n += 1
			if n > bn:
				bn = n
				bi = i
		var c0 = al[bi]
		var sx: float = 0.0
		var sy: float = 0.0
		var cnt: int = 0
		for o in al:
			if sqrt(V8M.v8_pow(o.x - c0.x, 2.0) + V8M.v8_pow(o.y - c0.y, 2.0)) < 55:
				sx += o.x
				sy += o.y
				cnt += 1
		cx = sx / float(cnt)
		cy = sy / float(cnt)
	var dist: float = sqrt(V8M.v8_pow(cx - p.x, 2.0) + V8M.v8_pow(cy - p.y, 2.0))
	var ai: Dictionary = def["aim"]
	if String(ai["kind"]) == "ground" and dist > float(ai["range"]):
		var k: float = float(ai["range"]) / dist
		cx = p.x + (cx - p.x) * k
		cy = p.y + (cy - p.y) * k
	return resolve(w, def, cx, cy)


## Builds the cast and starts its generator. `run_fn` is the skill's generator
## factory (see venom_s1.gd); the original calls `def.run(c)`.
static func cast(w, def: Dictionary, r: Dictionary, run_fn: Callable) -> CastObj:
	var p = w.player
	var id: int = w.uid
	w.uid += 1
	var seedv: int = M.u32(int(w.seed) * 1315423911 + id * 2654435761
			+ int(def["id"]) * 97)
	var c := CastObj.new()
	c.w = w
	c.id = id
	c.def = def
	c.ox = p.x
	c.oy = p.y
	c.ang = float(r["ang"])
	c.tx = float(r["tx"])
	c.ty = float(r["ty"])
	c.target = r.get("target", null)
	c.targets = r.get("targets", [])
	c.route = r.get("route", [])
	c.rng = RNG.new(seedv)
	c.dx = V8M.v8_cos(c.ang)
	c.dy = V8M.v8_sin(c.ang)
	p.face = c.ang
	p.cast = float(def["cast"]) + 0.15
	p.castMax = p.cast
	w.run(run_fn.call(c), String(def.get("name", "")))
	w.castLog.append({"t": w.time, "id": int(def["id"])})
	return c
