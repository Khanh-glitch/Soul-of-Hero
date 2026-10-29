extends RefCounted
## 18 BITTER RAIN -- native port of `s4.ts` lines 100-189 (original `rain`).
## Candidate until the original-source differential passes.
## Mutable closure state (`boil`, puddle network) lives in RefCounted `RainState`,
## because GDScript lambdas capture locals by value. Enemy and player objects are
## RefCounted, so closures read them live exactly where the TS reads them live.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")


class RainState extends RefCounted:
	var boil: float = 0.0
	## Puddles: Array of Dictionaries {x, y, r, t0}; TS `puddles`.
	var puddles: Array = []


static func rain(c):
	var box: Array = []
	var gen = GEN.new(func():
		_rain_body(c, box[0])
		return null)
	box.append(gen)
	return gen


static func _spawn(body: Callable):
	var box: Array = []
	var gen = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(gen)
	return gen


static func _p(k: String) -> int:
	return int(M.P[k])


static func _add_puddle(st, w, x: float, y: float, r: float) -> void:
	st.puddles.append({"x": x, "y": y, "r": r, "t0": w.time})
	if st.puddles.size() > 70:
		st.puddles.pop_front()


## Stable ascending sort by `hash(x*7 + y)`. JS `Array.sort` is stable; GDScript
## `sort_custom` is not, so equal keys keep their insertion order here.
static func _sorted_by_hash(arr: Array) -> Array:
	var out: Array = arr.duplicate()
	for i in range(1, out.size()):
		var cur = out[i]
		var key: float = M.hash_n(float(cur["x"]) * 7.0 + float(cur["y"]))
		var j: int = i - 1
		while j >= 0:
			var prev = out[j]
			var pkey: float = M.hash_n(float(prev["x"]) * 7.0 + float(prev["y"]))
			if pkey <= key:
				break
			out[j + 1] = prev
			j -= 1
		out[j + 1] = cur
	return out


## TS `landDrop(x, y, rad, pct, hh, cap, puddleR)`.
static func _land_drop(c, w, st, x: float, y: float, rad: float, pct: float, hh, cap: float, puddle_r: float) -> void:
	for e in w.enemies:
		if e.dying > 0.0:
			continue
		if V8M.v8_hypot(e.x - x, e.y - y) < e.r + rad and hh.ok(e, w.time, 0.0, cap):
			LIB.hit_e(c, e, pct, {"kind": "acid", "k": 60.0 if pct > 10.0 else 20.0,
					"from": [x, y], "stag": 0.25 if pct > 10.0 else 0.06,
					"at": [e.x, e.y - e.r * 0.6]})
			FX.drops(w, e.x, e.y, 7 if pct > 10.0 else 2, 60.0, _p("c1"), _p("c3"), _p("e2"),
					{"z": 6.0, "glow": 1.0})
			w.mark(e, "wet", 1.5)
	if puddle_r > 0.0:
		_add_puddle(st, w, x, y, puddle_r)
		w.add(FX.Splash.new(x, y, puddle_r * 0.9, _p("c1"), _p("c3")))
		if puddle_r > 4.0:
			LIB.vis_ring(w, x, y, puddle_r + 4.0, 0.2, [_p("c3"), _p("c1"), _p("e2")], 1.0)
			FX.drops(w, x, y, 4, 40.0, _p("c1"), _p("c3"), _p("e2"), {"z": 2.0, "up": 50.0, "glow": 1.0})


## TS `drop(x, y, z, sz, bigDrop)`: one falling acid droplet (Shot).
static func _drop(c, w, st, big, small, x: float, y: float, z: float, sz: int, big_drop: bool) -> void:
	var vx: float = c.rng.range(-3.0, 3.0)
	var vy: float = c.rng.range(-3.0, 3.0)
	var vz: float = -75.0 - c.rng.range(0.0, 50.0)
	var draw_fn := func(gg, X: float, Y: float, _z, _s) -> void:
		var L = gg.s
		var n: int = 4 if big_drop else 2
		for i in range(1, n + 1):
			L.dl = 12 - i * 2
			L.px(float(M.js_round(X)), float(M.js_round(Y - float(i) * 2.0)), _p("e3"))
		L.dl = 16
		if sz >= 4:
			L.disc(X, Y, 2.0, _p("e2"))
			L.disc(X - 0.4, Y - 0.4, 1.4, _p("c1"))
			L.px(float(M.js_round(X - 1.0)), float(M.js_round(Y - 1.0)), _p("c3"))
		elif sz >= 2:
			L.rect(float(M.js_round(X)), float(M.js_round(Y)), 2.0, 2.0, _p("c1"))
			L.px(float(M.js_round(X)), float(M.js_round(Y)), _p("c3"))
		else:
			L.px(float(M.js_round(X)), float(M.js_round(Y)), _p("c2"))
	var hit_fn := func(ww, s, e) -> bool:
		if big.n(e) >= 3 and big_drop:
			return false
		if not big_drop and small.n(e) >= 10:
			return false
		_land_drop(c, ww, st, s.x, s.y, 0.0, 0.0, big if big_drop else small, 0.0, 0.0)
		var hh = big if big_drop else small
		if hh.ok(e, ww.time, 0.0, 3.0 if big_drop else 10.0):
			LIB.hit_e(c, e, 30.0 if big_drop else 6.0, {"kind": "acid", "k": 70.0 if big_drop else 20.0,
					"from": [s.x, s.y], "stag": 0.25 if big_drop else 0.06,
					"at": [e.x, e.y - e.r * 0.8]})
			FX.drops(ww, e.x, e.y, 7 if big_drop else 2, 60.0, _p("c1"), _p("c3"), _p("e2"),
					{"z": 8.0, "glow": 1.0})
			ww.add(FX.Splash.new(e.x, e.y, 8.0 if big_drop else 4.0, _p("c1"), _p("c3")))
		return true
	var land_fn := func(ww, s) -> void:
		if big_drop:
			_land_drop(c, ww, st, s.x, s.y, 6.0, 0.0, big, 3.0, 5.0 + c.rng.range(0.0, 3.0))
		else:
			_land_drop(c, ww, st, s.x, s.y, 3.0, 0.0, small, 10.0, 2.5 if sz > 1 else 0.0)
	w.add(FX.Shot.new(x, y, z, vx, vy, vz, 240.0, 6.0 if big_drop else 3.0,
			draw_fn, hit_fn, land_fn, 3.0, 12.0))


## TS `vialS(g, x, y, a, i)`: one glass vial of the vessel volley.
static func _vial_s(gg, x: float, y: float, a: float, i: int) -> void:
	var L = gg.s
	var X: int = M.js_round(x)
	var Y: int = M.js_round(y)
	DRAW.ball(L, float(X), float(Y), 2.8, MATS.PAL()["glassHi"])
	L.rect(float(X - 2), float(Y), 5.0, 2.0, _p("c1") if i % 2 != 0 else _p("c2"))
	L.px(float(X - 1), float(Y - 1), _p("w"))
	L.rect(float(X - 1), float(Y - 5), 3.0, 2.0, _p("u1"))
	if V8M.v8_sin(a * 30.0 + float(i)) > 0.3:
		L.px(float(X + 3), float(Y - 2), _p("c3"))


## TS `w.run((function*(){ yield (0.46+i*0.03)*0.62; ... })())` for one vessel.
static func _vessel_land(gg, w, pr, i: int) -> void:
	gg.y((0.46 + float(i) * 0.03) * 0.62)
	var bx: float = pr.x
	var by: float = pr.y
	var bz: float = pr.z
	pr.dead = true
	w.add(FX.Flash.new(bx, by - bz, 12.0, _p("c2"), 0.3, 0.0))
	FX.drops(w, bx, by, 16, 70.0, _p("c1"), _p("c3"), _p("e2"), {"z": bz, "up": 20.0, "glow": 1.0})
	FX.shards(w, bx, by, 6, 60.0, _p("v2"), _p("v1"), _p("y2"), {"z": bz, "size": [2.0, 4.0], "land": 1})


## TS: 26 large drops, one every 0.035 s, scattered over the disc.
static func _big_drops(gg, c, w, st, big, small, cx: float, cy: float, R: float) -> void:
	for i in range(26):
		var a: float = c.rng.range(0.0, M.TAU)
		var d: float = sqrt(c.rng.next()) * R * 0.95
		_drop(c, w, st, big, small, cx + cos(a) * d, cy + sin(a) * d * 0.85, 66.0, 4, true)
		gg.y(0.035)


## TS: 14 turbulent clusters of six small drops, one cluster every 0.11 s.
static func _small_clusters(gg, c, w, st, big, small, cx: float, cy: float, R: float) -> void:
	for k in range(14):
		var a: float = c.rng.range(0.0, M.TAU)
		var d: float = c.rng.range(0.0, R * 0.8)
		var ccx: float = cx + cos(a) * d
		var ccy: float = cy + sin(a) * d * 0.85
		for i in range(6):
			var px: float = ccx + c.rng.range(-9.0, 9.0)
			var py: float = ccy + c.rng.range(-7.0, 7.0)
			var pz: float = 60.0 + c.rng.range(0.0, 12.0)
			var psz: int = 2 if c.rng.next() < 0.4 else 1
			_drop(c, w, st, big, small, px, py, pz, psz, false)
		gg.y(0.11)


static func _rain_body(c, g) -> void:
	var w = c.w
	var cx: float = float(c.tx)
	var cy: float = float(c.ty)
	var R: float = 86.0
	LIB.cast_anim(w, c)
	g.y(0.05)
	var hp: Array = LIB.hand_pos(w)
	var hx: float = hp[0]
	var hy: float = hp[1]
	var big = FX.Hits.new()
	var small = FX.Hits.new()
	var col = FX.Hits.new()
	var pud = FX.Hits.new()
	var st := RainState.new()

	# glowing puddle network
	var net_gnd := func(gg, _a, f) -> void:
		var fld = gg.f
		var L = gg.s
		if st.puddles.is_empty():
			return
		fld.reset()
		for q in st.puddles:
			var k: float = M.smoothstep((gg.t - float(q["t0"])) / 0.3)
			fld.disc(q["x"], q["y"], q["r"] * k * (1.0 + st.boil * 0.12 * V8M.v8_sin(gg.t * 9.0 + q["x"])), 0.3)
		for i in range(st.puddles.size()):
			for j in range(i + 1, st.puddles.size()):
				var a = st.puddles[i]
				var b = st.puddles[j]
				var d: float = V8M.v8_hypot(a["x"] - b["x"], a["y"] - b["y"])
				if d < 30.0:
					fld.capsule(a["x"], a["y"], b["x"], b["y"], 1.4 + st.boil * 0.8, 1.4 + st.boil * 0.8)
		var rem: float = f.life - f.age
		var dl_v: int = maxi(2, M.js_round(16.0 * rem)) if rem < 1.0 else 16
		fld.shade(L, MATS.MAT()["acid"], gg.t, {"fx": 5.0 + st.boil * 18.0, "fy": 3.0, "dl": dl_v, "seed": 6})
	var net_lit := func(gg, _a, _f) -> void:
		var n: int = st.puddles.size()
		var i: int = 0
		while i < n:
			var q = st.puddles[i]
			DRAW.glow(gg.l, q["x"], q["y"], q["r"] * 1.5, _p("c1"), 0.1 + st.boil * 0.2, 2)
			i += 2
	var net_fx = FX.Custom.new(cx, cy, 11.0, {"gnd": net_gnd, "lit": net_lit})
	net_fx.resid = true
	net_fx.kind = "pool"
	w.add(net_fx)

	# vessels follow readable arcs; their ground shadows show where they will land
	var targets := [[0.0, 0.0], [-40.0, -14.0], [38.0, -18.0], [-26.0, 30.0], [30.0, 28.0]]
	for i in range(targets.size()):
		var dx: float = targets[i][0]
		var dy: float = targets[i][1]
		var ex: float = M.clampf(cx + dx, 14.0, w.W - 14.0)
		var ey: float = M.clampf(cy + dy, 20.0, w.H - 12.0)
		var vi: int = i
		var draw_v := func(gg, x: float, y: float, _z, a: float) -> void:
			_vial_s(gg, x, y, a, vi)
		var pr = FX.Proj.new(hx, hy, ex, ey, 0.46 + float(i) * 0.03, 120.0, draw_v,
				func(_a = null, _b = null) -> void: pass, null, 3.0)
		pr.lit_fn = func(gg, _w) -> void:
			DRAW.glow(gg.l, pr.x, pr.y - pr.z, 7.0, _p("c1"), 0.4, 3)
		w.add(pr)
		var ring_gnd := func(gg, a, _f) -> void:
			var L = gg.s
			L.dl = 8
			L.ring(ex, ey, 7.0 + V8M.v8_sin(a * 20.0) * 1.0, 1.0, _p("c1"))
			L.dl = 5
			L.disc(ex, ey, 6.0, _p("k0"))
			L.dl = 16
		w.add(FX.Custom.new(ex, ey, 0.5 + float(i) * 0.03, {"gnd": ring_gnd}))
		w.run(_spawn(func(gg): _vessel_land(gg, w, pr, vi)))
	g.y(0.22)

	# suspended clouds of poisonous droplets
	var cl1 = FX.Cloud.new(cx, cy, LIB.mk_puffs(c.rng, 14, 52.0, 16.0, 24.0, 6.0, 1.2, 0),
			MATS.VAP()["dark"], 3.6, c.id)
	cl1.heightOff = 66.0
	cl1.grow = {"from": 0.3, "to": 1.1, "dur": 0.6}
	cl1.dens = 11.0
	var cl2 = FX.Cloud.new(cx, cy, LIB.mk_puffs(c.rng, 10, 44.0, 12.0, 19.0, 6.0, 1.4, 1),
			MATS.VAP()["green"], 3.6, c.id + 1)
	cl2.heightOff = 70.0
	cl2.grow = {"from": 0.3, "to": 1.1, "dur": 0.6}
	cl2.dens = 9.0
	w.add(cl1)
	w.add(cl2)
	w.shake(2.5, 0.3)
	w.shock(cx, cy - 40.0, 80.0, 0.4, 2.0)

	# large drops fall first, then turbulent clusters of small ones
	w.run(_spawn(func(gg): _big_drops(gg, c, w, st, big, small, cx, cy, R)))
	g.y(0.25)
	w.run(_spawn(func(gg): _small_clusters(gg, c, w, st, big, small, cx, cy, R)))

	# puddle network deals damage over time
	var t0: float = w.time
	var nt: float = 0.2
	var p = w.player
	var moved := false
	while w.time - t0 < 3.2:
		nt -= GEN.F
		if nt <= 0.0:
			nt = 0.8
			for e in w.enemies:
				if e.dying > 0.0:
					continue
				var touching := false
				for q in st.puddles:
					if V8M.v8_hypot(e.x - q["x"], e.y - q["y"]) < q["r"] * 0.9 + e.r * 0.4 and w.time - float(q["t0"]) > 0.3:
						touching = true
						break
				if touching:
					w.mark(e, "corrode", 1.8, 1.0)
					if pud.ok(e, w.time, 0.7, 3):
						LIB.hit_e(c, e, 20.0, {"kind": "acid", "stag": 0.08, "at": [e.x, e.y]})
		if w.time - t0 > 1.8 and not moved:
			moved = true
			var a0: float = V8M.v8_atan2(p.y - cy, p.x - cx)
			var pts: Array = []
			for i in range(1, 7):
				pts.append({"x": cx + V8M.v8_cos(a0 + float(i) * 0.4) * (R + 14.0),
						"y": cy + V8M.v8_sin(a0 + float(i) * 0.4) * (R + 14.0) * 0.85})
			w.glide(pts, 1.1)
		st.boil = M.clampf((w.time - t0 - 2.0) / 1.2, 0.0, 1.0)
		if st.boil > 0.0 and int(floor(w.time * 60.0)) % 2 == 0 and not st.puddles.is_empty():
			var q = st.puddles[c.rng.int_n(st.puddles.size())]
			w.parts.add({"k": "bubble", "x": q["x"] + c.rng.range(-q["r"], q["r"]) * 0.6, "y": q["y"],
					"z": 0.0, "vz": c.rng.range(14.0, 32.0), "max": c.rng.range(0.5, 1.0),
					"size": c.rng.range(1.5, 3.2), "c1": _p("e3"), "c2": _p("c1"), "c3": _p("c3")})
		g.y(GEN.F)

	# puddles boil and throw up towering columns of luminous vapour
	w.screen_flash(_p("c2"), 0.2, 0.1)
	var cols: Array = []
	var cand: Array = _sorted_by_hash(st.puddles)
	for q in cand:
		if cols.size() >= 3:
			break
		var clear := true
		for o in cols:
			if not (V8M.v8_hypot(o["x"] - q["x"], o["y"] - q["y"]) > 38.0):
				clear = false
				break
		if clear:
			cols.append({"x": q["x"], "y": q["y"]})
	while cols.size() < 3:
		var rx: float = cx + c.rng.range(-50.0, 50.0)
		var ry: float = cy + c.rng.range(-40.0, 40.0)
		cols.append({"x": rx, "y": ry})
	for i in range(cols.size()):
		var q = cols[i]
		var qx: float = q["x"]
		var qy: float = q["y"]
		LIB.ring_at(c, qx, qy, 28.0, 0.26, 53.33, {"kind": "burst", "knock": 140.0, "stag": 0.45,
				"h": col, "max": 3, "cols": [_p("w"), _p("c2"), _p("e2")], "w": 3.0})
		S2.plume(w, qx, qy, 70.0, 2.0, MATS.VAP()["pale"], 13.0, i + 3)
		S2.plume(w, qx + 4.0, qy + 2.0, 54.0, 1.8, MATS.VAP()["green"], 15.0, i + 8, 0.05)
		var up_fn := func(gg, a: float, _f) -> void:
			var L = gg.s
			var h: float = 56.0 * M.smoothstep(minf(1.0, a * 4.0))
			L.dl = M.js_round(12.0 * (1.0 - a))
			L.rect(float(M.js_round(qx)) - 1.0, float(M.js_round(qy - h)), 3.0, float(M.js_round(h)), _p("c3"))
			L.dl = 16
		var lit_fn := func(gg, a: float, _f) -> void:
			for k in range(4):
				DRAW.glow(gg.l, qx, qy - 14.0 * float(k) * M.smoothstep(minf(1.0, a * 4.0)), 10.0,
						_p("c2"), 0.25 * (1.0 - a), 3)
		w.add(FX.Custom.new(qx, qy, 1.6, {"up": up_fn, "lit": lit_fn}, qy + 4.0))
		FX.drops(w, qx, qy, 22, 110.0, _p("c1"), _p("c3"), _p("e2"),
				{"z": 6.0, "up": 190.0, "glow": 2.0, "size": [2.0, 4.0]})
		FX.chips(w, qx, qy, 5, 80.0, _p("k3"), _p("k1"), _p("e1"),
				{"z": 8.0, "up": 150.0, "size": [2.0, 4.0]})
		w.add(FX.Flash.new(qx, qy - 6.0, 18.0, _p("c3"), 0.3, 4.0))
		w.shake(3.5, 0.25)
		w.shock(qx, qy, 50.0, 0.3, 2.5)
		g.y(0.28)
	st.boil = 1.0
	g.y(1.8)
	st.boil = 0.0
