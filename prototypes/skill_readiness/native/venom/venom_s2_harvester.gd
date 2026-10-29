extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s2.ts` skill 9,
## MOLTING HARVESTER: `class Harvester`, `class Cleave` and `function* harvester`.
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order,
## `w.run` spawn order and the shared `swing` counter follow the original.
## `yield* f(...)` becomes an inline call on the same driver (`g`), which is
## what the JS delegation does: one generator, one thread.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")


static func _lerp(a: float, b: float, t: float) -> float:
	return a + (b - a) * t


## `Hits`-compatible cap used by the pre-molt and rapid sweeps: the ORIGINAL
## passes `{ ok: (e) => ... }` cast to `Hits`; it ignores cd/max and counts
## per enemy id.
class CapOk extends RefCounted:
	var cap: int = 0
	var m: Dictionary = {}

	func _init(cap_: int) -> void:
		cap = cap_

	func ok(e, _now = 0.0, _cd = 0.0, _mx = 0.0) -> bool:
		var n: int = int(m.get(e.id, 0))
		if n >= cap:
			return false
		m[e.id] = n + 1
		return true


## `class Harvester extends Fx`
class Harvester extends FX.Fx:
	var hd: float = 0.0
	var z: float = 0.0
	var stage: int = 0
	var rise: float = 0.0
	var armA: Array = [0.0, 0.0]
	var arm: float = 1.0
	var raise: float = 0.0
	var plates: Array = [true, true, true, true, true, true, true, true]
	var crack: float = 0.0
	var fade: float = 1.0
	var shake: float = 0.0
	var legT: float = 0.0
	var moving: bool = false
	var flash: float = 0.0

	## Inner classes cannot call the outer script's static helpers, so each
	## inner class carries its own copy.
	static func _lf(a: float, b: float, t: float) -> float:
		return a + (b - a) * t

	func _init(px: float, py: float, hd_: float) -> void:
		x = px
		y = py
		hd = hd_
		r = 11.0
		push = true
		kind = "summon"
		sy = py

	func upd(_w, _dt: float) -> void:
		sy = y

	func shd(g, _w) -> void:
		g.s.dl = M.js_round(9.0 * fade)
		g.s.ellipse(x + 2.0, y + 6.0, 22.0 * rise, 9.0 * rise, int(M.P["bk"]))
		g.s.dl = 16

	func arm_geo(i: int) -> Dictionary:
		var f: float = hd
		var fx: float = V8M.v8_cos(f)
		var fy: float = V8M.v8_sin(f)
		var qx: float = -fy
		var qy: float = fx
		var sd: float = -1.0 if i == 0 else 1.0
		var y0: float = y - 8.0 - z - (1.0 - rise) * 14.0
		var sx: float = x + fx * 4.0 + qx * 9.0 * sd
		var syy: float = y0 + fy * 3.2 + qy * 7.0 * sd - 3.0
		var ang: float = f + sd * 1.0 + float(armA[i]) * -sd * 1.0
		var ex: float = sx + V8M.v8_cos(ang) * 9.0
		var ey: float = syy + V8M.v8_sin(ang) * 7.0
		var bang: float = ang + sd * -0.55 - sd * raise * 0.5
		var bl: float = 20.0 * arm
		var tx: float = ex + V8M.v8_cos(bang) * bl
		var ty: float = ey + V8M.v8_sin(bang) * bl * 0.8
		return {"sx": sx, "sy": syy, "ex": ex, "ey": ey, "tx": tx, "ty": ty, "bang": bang, "ang": ang}

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var f: float = hd
		var fx: float = V8M.v8_cos(f)
		var fy: float = V8M.v8_sin(f)
		var qx: float = -fy
		var qy: float = fx
		var sh: float = V8M.v8_sin(t * 85.0) * shake if shake > 0.0 else 0.0
		if rise <= 0.02:
			return
		var xx: float = x + sh
		var yy: float = y - 8.0 - z - (1.0 - rise) * 14.0
		var mol: bool = stage == 1
		var pal: Dictionary = MATS.PAL()["chitinHot"] if mol else MATS.PAL()["chitin"]
		var lc: int = int(M.P["g2"]) if mol else int(M.P["c1"])
		var flash_on: bool = flash > 0.0
		L.dl = M.js_round(16.0 * fade)
		if L.dl < 1:
			return
		var at = func(fw: float, sd: float, up_: float) -> Array:
			return [xx + fx * fw + qx * sd, yy + fy * fw * 0.8 + qy * sd * 0.8 - up_]
		for i in range(2):
			for s in [-1.0, 1.0]:
				var ph: float = V8M.v8_sin(legT + float(i) * 2.2 + (PI if s > 0.0 else 0.0)) * (1.0 if moving else 0.2)
				var hA: Array = at.call(-3.0 + float(i) * -7.0, s * 7.0, 1.0)
				var kA: Array = at.call(-3.0 + float(i) * -7.0 + ph * 2.0, s * 15.0, 6.0)
				var eA: Array = at.call(-5.0 + float(i) * -7.0 + ph * 4.0, s * 21.0, -3.0)
				L.line(hA[0], hA[1], kA[0], kA[1], int(M.P["k0"]), 4.0)
				L.line(kA[0], kA[1], eA[0], eA[1], int(M.P["k0"]), 3.0)
				L.line(hA[0], hA[1], kA[0], kA[1], int(M.P["u1"]) if mol else int(M.P["n2"]), 2.0)
				L.line(kA[0], kA[1], eA[0], eA[1], int(M.P["u2"]) if mol else int(M.P["n3"]), 1.0)
				L.px(M.js_round(kA[0]), M.js_round(kA[1] - 1.0), lc)
		var ab: Array = at.call(-14.0, 0.0, 2.0)
		var abx: float = ab[0]
		var aby: float = ab[1]
		DRAW.ball(L, abx, aby, 12.0, _flash_pal(pal) if flash_on else pal, 9.5)
		for i in range(5):
			var pu: float = (V8M.v8_sin(t * 5.0 - float(i) * 0.9) + 1.0) / 2.0
			L.arc(abx, aby, 3.0 + float(i) * 2.0, 1.0, f + PI * 0.6, f + PI * 1.4,
					M.mix(int(M.P["g0"]) if mol else int(M.P["e1"]), lc,
							pu * (0.4 + (0.5 if mol else 0.2))),
					2.5 + float(i) * 1.7)
		L.line(abx + fx * 4.0, aby + fy * 3.0, abx - fx * 10.0, aby - fy * 8.0, lc)
		for i in range(plates.size()):
			if not plates[i]:
				continue
			var a: float = f + PI + (float(i) - 3.5) * 0.36
			var ppx: float = abx + V8M.v8_cos(a) * 9.0
			var ppy: float = aby + V8M.v8_sin(a) * 7.2
			DRAW.ball(L, ppx, ppy - 1.0, 3.2, MATS.PAL()["chitin"], 2.6)
			L.px(M.js_round(ppx - 1.0), M.js_round(ppy - 3.0), int(M.P["e3"]))
		var th: Array = at.call(0.0, 0.0, 3.0)
		DRAW.ball(L, th[0], th[1], 8.0, pal, 6.6)
		L.line(th[0] - 4.0, th[1] - 3.0, th[0] + 4.0, th[1] - 3.0, lc)
		for s2 in [0, 1]:
			var A: Dictionary = arm_geo(s2)
			L.line(A["sx"], A["sy"], A["ex"], A["ey"], int(M.P["k0"]), 5.0)
			L.line(A["sx"], A["sy"], A["ex"], A["ey"], int(M.P["u1"]) if mol else int(M.P["n2"]), 3.0)
			DRAW.ball(L, A["ex"], A["ey"], 3.0, pal)
			DRAW.shard(L, A["ex"], A["ey"], V8M.v8_atan2(A["ty"] - A["ey"], A["tx"] - A["ex"]),
					20.0 * arm, 3.6,
					int(M.P["g2"]) if mol else int(M.P["i1"]),
					int(M.P["g0"]) if mol else int(M.P["i3"]),
					int(M.P["w"]))
			for k in range(1, 7):
				var kt: float = float(k) / 7.0
				L.px(M.js_round(_lf(A["ex"], A["tx"], kt) - V8M.v8_sin(A["bang"]) * 2.0),
						M.js_round(_lf(A["ey"], A["ty"], kt) + V8M.v8_cos(A["bang"]) * 2.0),
						int(M.P["k0"]))
		var hdp: Array = at.call(10.0, 0.0, 4.0)
		var hdx: float = hdp[0]
		var hdy: float = hdp[1]
		DRAW.ball(L, hdx, hdy, 5.2, pal, 4.6)
		for s3 in [-1.0, 1.0]:
			DRAW.shard(L, hdx + fx * 4.0 + qx * 2.0 * s3, hdy + fy * 3.0 + qy * 2.0 * s3, f + s3 * 0.45,
					6.5, 1.6, int(M.P["i0"]), int(M.P["i2"]), int(M.P["w"]))
			L.disc(hdx + fx * 2.0 + qx * 2.6 * s3, hdy + fy * 1.4 + qy * 2.6 * s3 - 1.0, 1.3, lc)
			L.px(M.js_round(hdx + fx * 2.0 + qx * 2.6 * s3), M.js_round(hdy + fy * 1.4 + qy * 2.6 * s3 - 1.0),
					int(M.P["w"]))
		var ncrack: int = int(floor(crack * 8.0))
		for i in range(ncrack):
			var cx: float = abx + (M.hash_n(float(i) * 5.0) - 0.5) * 14.0
			var cy: float = aby + (M.hash_n(float(i) * 9.0) - 0.5) * 10.0
			var ca: float = M.hash_n(float(i) * 3.0) * M.TAU
			var s: int = 0
			while float(s) < 5.0 + crack * 5.0:
				ca += (M.hash_n(float(s + i * 13)) - 0.5) * 0.9
				cx += V8M.v8_cos(ca)
				cy += V8M.v8_sin(ca) * 0.8
				L.px(M.js_round(cx), M.js_round(cy), int(M.P["c2"]) if s % 2 != 0 else int(M.P["c3"]))
				s += 1
		L.dl = 16

	## `Object.assign({}, pal, { b: P.w })`
	static func _flash_pal(pal: Dictionary) -> Dictionary:
		var out: Dictionary = pal.duplicate()
		out["b"] = int(M.P["w"])
		return out

	func lit(g, _w) -> void:
		DRAW.glow(g.l, x, y - 12.0, 22.0, int(M.P["g2"]) if stage != 0 else int(M.P["c1"]),
				(0.28 if stage != 0 else 0.15) * rise * fade, 4)
		if flash > 0.0:
			DRAW.glow(g.l, x, y - 12.0, 34.0, int(M.P["w"]), 0.4, 4)


## `class Cleave extends Fx`: the expanding gigantic crescent.
class Cleave extends FX.Fx:
	var hit = FX.Hits.new()
	var cx: float = 0.0
	var cy: float = 0.0
	var a: float = 0.0
	var cc = null

	func _init(px: float, py: float, a_: float, cc_) -> void:
		x = px
		y = py
		cx = px
		cy = py
		a = a_
		cc = cc_
		kind = "cleave"

	func rad() -> float:
		return 22.0 + age * 60.0

	func upd(w, _dt: float) -> void:
		cx = x + V8M.v8_cos(a) * age * 270.0
		cy = y + V8M.v8_sin(a) * age * 270.0 * 0.9
		if age > 0.55:
			dead = true
			return
		var R: float = rad()
		for e in w.enemies:
			if e.dying > 0:
				continue
			var dx: float = e.x - cx
			var dy: float = e.y - cy
			var d: float = V8M.v8_hypot(dx, dy)
			if d < R + e.r and d > R - 14.0 - e.r \
					and absf(M.ang_diff(a, V8M.v8_atan2(dy, dx))) < 1.1 \
					and hit.ok(e, w.time):
				LIB.hit_e(cc, e, 110.0, {"kind": "pierce", "k": 220.0, "ang": a, "stag": 0.5,
						"big": true, "at": [e.x, e.y]})
		if int(floor(age * 60.0)) % 2 == 0:
			var R2: float = rad()
			var aa: float = a + (M.hash_n(age * 100.0) - 0.5) * 2.0
			FX.shards(w, cx + V8M.v8_cos(aa) * R2, cy + V8M.v8_sin(aa) * R2, 1, 60.0,
					int(M.P["g2"]), int(M.P["g0"]), int(M.P["w"]),
					{"z": 5.0, "ang": aa, "spread": 0.6, "size": [3, 6], "land": 3})
			FX.drops(w, cx + V8M.v8_cos(aa) * R2, cy + V8M.v8_sin(aa) * R2, 2, 80.0,
					int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
					{"z": 6.0, "ang": aa, "spread": 0.6, "glow": 1.0})

	func gnd(g, _w) -> void:
		var L = g.s
		var R: float = rad()
		var k: float = 1.0 - age / 0.55
		var cols: Array = [int(M.P["w"]), int(M.P["c3"]), int(M.P["c1"]), int(M.P["e3"]), int(M.P["e1"])]
		for i in range(5):
			L.dl = maxi(1, M.js_round((16.0 if i == 0 else 14.0 - float(i) * 3.0) * k))
			L.arc(cx - V8M.v8_cos(a) * float(i) * 5.0, cy - V8M.v8_sin(a) * float(i) * 5.0 * 0.9,
					R - float(i) * 5.0, 4.0 if i == 0 else 3.0, a - 1.05, a + 1.05,
					cols[i], (R - float(i) * 5.0) * 0.9)
		L.dl = 16

	func lit(g, _w) -> void:
		DRAW.glow(g.l, cx + V8M.v8_cos(a) * rad(), cy + V8M.v8_sin(a) * rad() * 0.9, 28.0,
				int(M.P["c2"]), 0.3 * (1.0 - age / 0.55), 4)


## Shared per-cast state. The ORIGINAL closes over `hv`, `c`, `w`, `swing`,
## `deb` and `emerge`; GDScript lambdas copy values, so mutable state lives here.
static func _spawn(body: Callable):
	var box: Array = []
	var g = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(g)
	return g


static func _next_swing(st) -> int:
	var n: int = int(st["swing"][0])
	st["swing"][0] = n + 1
	return n


## `const mk = (x, y, vx, vy, vz, sz, bounce) => w.add(new Shot(...))`
static func _mk(st, x: float, y: float, vx: float, vy: float, vz: float, sz: float, bounce: int):
	var w = st["w"]
	var c = st["c"]
	var deb = st["deb"]
	var draw_fn = func(g, X, Y, _z, _s):
		DRAW.ball(g.s, X, Y, sz, MATS.PAL()["chitin"], sz * 0.8)
		g.s.px(M.js_round(X - sz * 0.4), M.js_round(Y - sz * 0.6), int(M.P["e3"]))
	var on_land = func(ww, s):
		ww.add(FX.Ring.new(s.x, s.y, 15.0 + sz, 0.2, {"w": 2.0,
				"cols": [int(M.P["i0"]), int(M.P["i2"]), int(M.P["n3"])],
				"hit": {"h": deb, "amt": c.d(25), "opts": {"kind": "impact", "src": c.def["id"]},
						"knock": 90.0, "stagger": 0.3, "max": 2}}))
		FX.dust(ww, s.x, s.y, 3, 22.0, 4.0)
		FX.chips(ww, s.x, s.y, 4, 70.0, int(M.P["n2"]), int(M.P["n0"]), int(M.P["n3"]), {"z": 3.0})
		ww.shake(1.5, 0.12)
		ww.add(FX.GroundDecal.new(s.x, s.y, "cracks", 7.0, 5.0, floor(s.x),
				{"a": int(M.P["k0"]), "b": int(M.P["n3"]), "c": int(M.P["c1"])}, 0.0, 1.0))
		if bounce > 0:
			_mk(st, s.x, s.y, s.vx * 0.5, s.vy * 0.5, 120.0, sz * 0.8, bounce - 1)
	return w.add(FX.Shot.new(x, y, 10.0, vx, vy, vz, 300.0, 0.0, draw_fn, Callable(), on_land, 4.0, 12.0))


## `const sweep = function* (i, dur, amp, pct, hh) { ... }`
static func _sweep(st, i: int, dur: float, amp: float, pct: float, hh, g) -> void:
	var c = st["c"]
	var w = st["w"]
	var hv: Harvester = st["hv"]
	var sw = FX.Hits.new()
	var dir: float = 1.0 if i == 0 else -1.0
	for k in GEN.ticks(dur):
		hv.armA[i] = _lerp(-amp, amp, M.smoothstep(k)) * dir
		var A: Dictionary = hv.arm_geo(i)
		for e in w.enemies:
			if e.dying > 0:
				continue
			var d: float = minf(w.seg_dist(e.x, e.y, A["ex"], A["ey"], A["tx"], A["ty"]),
					w.seg_dist(e.x, e.y, A["sx"], A["sy"], A["ex"], A["ey"]))
			if d < e.r + 3.5 and sw.ok(e, w.time) and hh.ok(e, w.time, 0.0, 99.0):
				LIB.hit_e(c, e, pct, {"kind": "pierce", "k": 150.0, "from": [A["sx"], A["sy"]],
						"stag": 0.35, "at": [e.x, e.y]})
		if int(floor(k * 60.0)) % 3 == 0:
			FX.shards(w, A["tx"], A["ty"] + 2.0, 1, 40.0, int(M.P["n3"]), int(M.P["n1"]), int(M.P["c1"]),
					{"z": 3.0, "size": [2, 3], "land": 3})
			w.parts.add({"k": "spark", "x": A["tx"], "y": A["ty"] + 3.0, "z": 2.0, "vx": 0.0, "vy": 0.0,
					"vz": 10.0, "max": 0.2, "c1": int(M.P["c2"])})
		g.y(GEN.F)
	var A2: Dictionary = hv.arm_geo(i)
	var sid: int = _next_swing(st)
	w.add(FX.GroundDecal.new(hv.x + V8M.v8_cos(hv.hd) * 24.0, hv.y + V8M.v8_sin(hv.hd) * 22.0,
			"crescent", 20.0, 5.5, c.id + sid,
			{"a": int(M.P["k0"]), "b": int(M.P["e1"]), "c": int(M.P["c1"])},
			hv.hd + (0.2 if i != 0 else -0.2), 1.0))
	w.shake(1.5, 0.1)
	FX.dust(w, A2["tx"], A2["ty"] + 3.0, 3, 20.0, 4.0)


## `const walk = function* (dur, sp) { ... }` -- inlined as `yield* walk(...)`.
static func _walk(st, g, dur: float, sp: float) -> void:
	var c = st["c"]
	var w = st["w"]
	var hv: Harvester = st["hv"]
	hv.moving = true
	for _j in GEN.ticks(dur):
		hv.x = M.clampf(hv.x + V8M.v8_cos(c.ang) * sp * GEN.F, 18.0, float(w.W) - 18.0)
		hv.y = M.clampf(hv.y + V8M.v8_sin(c.ang) * sp * GEN.F, 20.0, float(w.H) - 18.0)
		hv.legT += sp * GEN.F * 0.4
		hv.z = absf(V8M.v8_sin(hv.legT)) * 0.8
		g.y(GEN.F)
	hv.moving = false


## `function* harvester(c)` -- the ORIGINAL Molting Harvester cast.
static func harvester(c):
	var box: Array = []
	var g = GEN.new(func():
		_harvester_body(c, box[0])
		return null)
	box.append(g)
	return g


static func _harvester_body(c, g) -> void:
	var w = c.w
	LIB.cast_anim(w, c, true, 0.4)
	var p = w.player
	var sx: float = M.clampf(p.x + V8M.v8_cos(c.ang) * 54.0, 24.0, float(w.W) - 24.0)
	var sy: float = M.clampf(p.y + V8M.v8_sin(c.ang) * 54.0, 24.0, float(w.H) - 24.0)
	var hv = Harvester.new(sx, sy, c.ang)
	w.add(hv)
	var emerge = FX.Hits.new()
	var deb = FX.Hits.new()
	var st: Dictionary = {"c": c, "w": w, "hv": hv, "swing": [0], "deb": deb}
	var k0: int = int(M.P["k0"])
	var n3: int = int(M.P["n3"])
	var c1: int = int(M.P["c1"])
	var n2: int = int(M.P["n2"])
	var n0: int = int(M.P["n0"])
	var wc: int = int(M.P["w"])
	var i1: int = int(M.P["i1"])
	w.add(FX.GroundDecal.new(sx, sy, "cracks", 30.0, 8.0, c.id,
			{"a": k0, "b": n3, "c": c1}, 0.0, 1.0))
	for k in GEN.ticks(0.38):
		hv.rise = M.smoothstep(k)
		hv.z = (1.0 - k) * -10.0
		hv.shake = (1.0 - k) * 2.0
		if int(floor(k * 60.0)) % 3 == 0:
			FX.dust(w, sx + c.rng.range(-16.0, 16.0), sy + c.rng.range(-4.0, 8.0), 1, 18.0, 4.0)
			FX.chips(w, sx + c.rng.range(-12.0, 12.0), sy, 1, 50.0, n2, n0, n3, {"z": 2.0, "up": 80.0})
		g.y(GEN.F)
	hv.z = 0.0
	hv.rise = 1.0
	hv.shake = 0.0
	LIB.ring_at(c, sx, sy, 30.0, 0.24, 30.0, {"kind": "impact", "knock": 150.0, "stag": 0.4,
			"h": emerge, "cols": [wc, i1, n3], "w": 3.0, "dust": true})
	w.shake(4.0, 0.3)
	w.shock(sx, sy, 40.0, 0.3, 2.5)
	# pre-molt: walk + alternating cutting sweeps (hits capped by per-sweep contact)
	var cap4 = CapOk.new(4)
	for s in range(4):
		w.run(_spawn(func(gg): _sweep(st, s % 2, 0.34, 1.0, 30.0, cap4, gg)))
		_walk(st, g, 0.36, 62.0)
		hv.crack = float(s + 1) / 5.0
	# violent molt
	hv.crack = 1.0
	for k in GEN.ticks(0.5):
		hv.shake = 1.0 + k * 2.5
		if int(floor(k * 60.0)) % 3 == 0:
			w.parts.add({"k": "spark", "x": hv.x + c.rng.range(-14.0, 14.0),
					"y": hv.y - 10.0 + c.rng.range(-8.0, 8.0), "z": 3.0, "vx": 0.0, "vy": -20.0,
					"vz": 40.0, "grav": 90.0, "max": 0.35, "c1": int(M.P["c3"])})
		g.y(GEN.F)
	hv.stage = 1
	hv.crack = 0.0
	hv.shake = 0.0
	hv.arm = 1.35
	hv.flash = 0.2
	w.screen_flash(int(M.P["c3"]), 0.2, 0.09)
	w.shake(5.0, 0.35)
	for i in range(8):
		hv.plates[i] = false
		var a: float = hv.hd + PI + (float(i) - 3.5) * 0.5
		var px: float = hv.x + V8M.v8_cos(a) * 12.0
		var py: float = hv.y + V8M.v8_sin(a) * 8.0
		var sp: float = c.rng.range(70.0, 120.0)
		var va: float = a + c.rng.range(-0.4, 0.4)
		_mk(st, px, py, V8M.v8_cos(va) * sp, V8M.v8_sin(va) * sp * 0.8,
				c.rng.range(120.0, 200.0), c.rng.range(3.0, 5.0), 1 if i % 3 == 0 else 0)
	FX.chips(w, hv.x, hv.y - 8.0, 18, 130.0, n2, n0, int(M.P["e3"]),
			{"z": 10.0, "up": 130.0, "size": [2, 5]})
	FX.drops(w, hv.x, hv.y - 8.0, 20, 100.0, int(M.P["g2"]), int(M.P["c3"]), c1,
			{"z": 10.0, "glow": 2.0, "up": 120.0})
	for _i in GEN.ticks(0.3):
		hv.flash -= GEN.F
		g.y(GEN.F)
	hv.flash = 0.0
	# newly exposed limbs: rapid attacks
	var cap3 = CapOk.new(3)
	for s in range(3):
		w.run(_spawn(func(gg): _sweep(st, s % 2, 0.16, 1.15, 30.0, cap3, gg)))
		_walk(st, g, 0.19, 66.0)
	_walk(st, g, 0.12, 50.0)
	# gigantic cleave
	for k in GEN.ticks(0.38):
		hv.raise = M.smoothstep(k)
		hv.armA[0] = _lerp(0.0, -0.6, k)
		hv.armA[1] = _lerp(0.0, 0.6, k)
		hv.shake = k * 1.2
		hv.z = k * 3.0
		g.y(GEN.F)
	hv.shake = 0.0
	for k in GEN.ticks(0.12):
		hv.raise = _lerp(1.0, -0.4, k)
		hv.armA[0] = _lerp(-0.6, 1.1, k)
		hv.armA[1] = _lerp(0.6, -1.1, k)
		hv.z = _lerp(3.0, 0.0, k)
		g.y(GEN.F)
	w.add(Cleave.new(hv.x + V8M.v8_cos(hv.hd) * 14.0, hv.y + V8M.v8_sin(hv.hd) * 12.0, hv.hd, c))
	w.shake(7.0, 0.4)
	w.shock(hv.x + V8M.v8_cos(hv.hd) * 30.0, hv.y + V8M.v8_sin(hv.hd) * 26.0, 90.0, 0.4, 4.0)
	w.screen_flash(int(M.P["c2"]), 0.25, 0.1)
	w.add(FX.GroundDecal.new(hv.x + V8M.v8_cos(hv.hd) * 34.0, hv.y + V8M.v8_sin(hv.hd) * 30.0,
			"crescent", 38.0, 7.0, c.id + 99,
			{"a": k0, "b": int(M.P["e1"]), "c": c1}, hv.hd, 1.0))
	FX.chips(w, hv.x + V8M.v8_cos(hv.hd) * 30.0, hv.y + V8M.v8_sin(hv.hd) * 26.0, 24, 160.0, n2, n0,
			int(M.P["g1"]), {"z": 8.0, "up": 100.0, "ang": hv.hd, "spread": 1.6, "size": [3, 6]})
	g.y(0.5)
	for k in GEN.ticks(0.6):
		hv.fade = 1.0 - k
		hv.z = k * -6.0
		if int(floor(k * 60.0)) % 4 == 0:
			FX.dust(w, hv.x + c.rng.range(-14.0, 14.0), hv.y + 4.0, 1, 14.0, 4.0)
		g.y(GEN.F)
	hv.dead = true
	FX.drops(w, hv.x, hv.y, 14, 70.0, c1, int(M.P["c3"]), int(M.P["e2"]), {"z": 6.0, "glow": 1.0})
	w.add(FX.Pool.new(hv.x, hv.y, 14.0, MATS.MAT()["acid"], 2.4, {"blobs": 4, "boil": 1}))
