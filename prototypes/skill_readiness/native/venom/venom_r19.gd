extends RefCounted
## 19 FALSE REMEDY -- native port of `s4.ts` lines 190-256 (original `remedy`).
## Candidate until the original-source differential passes.
## `st` (k, shrink, imp) is shared by closures and mutated by the body, so it lives
## in RefCounted `RemState`. Enemies are RefCounted and read live, as the TS does.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")


class RemState extends RefCounted:
	var k: float = 0.0
	var shrink: float = 0.0
	var imp: float = 0.0


static func remedy(c):
	var box: Array = []
	var gen = GEN.new(func():
		_remedy_body(c, box[0])
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


static func _alive(e) -> bool:
	return e != null and e.dying <= 0.0


static func _remedy_body(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c)
	g.y(0.04)
	var tgt = c.target if c.target != null else w.nearest(float(c.tx), float(c.ty), 110.0)
	if tgt == null:
		return
	var hp: Array = LIB.hand_pos(w)
	var hx: float = hp[0]
	var hy: float = hp[1]
	var dur: float = M.clampf(V8M.v8_hypot(tgt.x - hx, tgt.y - hy) / 520.0, 0.1, 0.24)
	LIB.throw_arc(w, "gold", hx, hy, tgt.x, tgt.y, dur, 10.0, func(_a = null, _b = null) -> void: pass, 12.0)
	g.y(dur)
	var rup = FX.Hits.new()
	LIB.hit_e(c, tgt, 40.0, {"kind": "acid", "k": 40.0, "from": [hx, hy], "stag": 0.25, "at": [tgt.x, tgt.y]})
	var st := RemState.new()
	var cx0: float = tgt.x
	var cy0: float = tgt.y
	w.add(FX.Flash.new(tgt.x, tgt.y - 6.0, 16.0, _p("g2"), 0.3, 0.0))
	FX.drops(w, tgt.x, tgt.y, 12, 60.0, _p("g2"), _p("c3"), _p("c1"), {"z": 8.0, "glow": 1.0})

	# seeds and veins: pure functions of the cast id, no RNG
	var seeds: Array = []
	for i in range(11):
		seeds.append({"a": M.hash_n(float(i * 5 + c.id)) * M.TAU, "d": 4.0 + M.hash_n(float(i * 9 + c.id)) * 22.0})
	var veins: Array = []
	for i in range(7):
		veins.append({"a": float(i) / 7.0 * M.TAU + 0.2, "len": 16.0 + M.hash_n(float(i + c.id)) * 14.0, "ph": i})

	var gnd := func(gg, _a, f) -> void:
		var L = gg.s
		var t: float = gg.t
		var e = tgt
		var cx: float = e.x if _alive(e) else cx0
		var cy: float = e.y if _alive(e) else cy0
		var k: float = st.k
		var sc: float = (1.0 - st.shrink) * M.smoothstep(minf(1.0, f.age * 4.0))
		var R: float = 28.0 * sc * (1.0 - k * 0.25)
		if sc < 0.04:
			return
		var pts: Array = []
		for s in seeds:
			pts.append({"x": cx + V8M.v8_cos(s["a"] + t * 0.3 * (1.0 - k)) * s["d"] * sc * (1.0 - k * 0.45),
					"y": cy + V8M.v8_sin(s["a"] + t * 0.3 * (1.0 - k)) * s["d"] * 0.85 * sc * (1.0 - k * 0.45)})
		var wall: int = M.mix(_p("g2"), _p("e2"), k)
		var wall2: int = M.mix(_p("c3"), _p("k1"), k)
		var inner: int = M.mix(_p("g1"), _p("e0"), k)
		var y0: int = int(floor(cy - R))
		var y1: int = int(floor(cy + R))
		var x0: int = int(floor(cx - R))
		var x1: int = int(floor(cx + R))
		for y in range(y0, y1 + 1):
			for x in range(x0, x1 + 1):
				var ddx: float = float(x) - cx
				var ddy: float = (float(y) - cy) / 0.85
				var rr: float = V8M.v8_hypot(ddx, ddy)
				if rr > R:
					continue
				var d1: float = 1e9
				var d2: float = 1e9
				for q in pts:
					var d: float = V8M.v8_hypot(float(x) - q["x"], (float(y) - q["y"]) / 0.85)
					if d < d1:
						d2 = d1
						d1 = d
					elif d < d2:
						d2 = d
				var edge: float = d2 - d1
				var bay: int = M.BAYER[((y & 3) << 2) | (x & 3)]
				if float(bay) > 16.0 - (rr / R) * 10.0 - 2.0:
					continue
				if edge < 1.7:
					L.px(float(x), float(y), wall2 if rr > R - 1.5 else wall)
				elif bay < 6:
					L.px(float(x), float(y), inner)
		if k > 0.15:
			for v in veins:
				var vx: float = cx
				var vy: float = cy
				var an: float = v["a"]
				var ln: float = v["len"] * minf(1.0, (k - 0.15) * 1.6) * sc
				var s: int = 0
				while float(s) < ln:
					an += (M.hash_n(float(s + int(v["ph"]) * 9)) - 0.5) * 0.7
					vx += V8M.v8_cos(an)
					vy += V8M.v8_sin(an) * 0.85
					L.px(float(M.js_round(vx)), float(M.js_round(vy)), _p("k0"))
					L.px(float(M.js_round(vx)), float(M.js_round(vy) + 1), _p("m0"))
					if V8M.v8_sin(t * 5.0 - float(s) * 0.5 + float(v["ph"])) > 0.4:
						L.px(float(M.js_round(vx)), float(M.js_round(vy)), _p("c1"))
					s += 1
		if k < 0.3:
			for i in range(4):
				var sx: int = M.js_round(cx + V8M.v8_cos(float(i) * 1.7 + t) * 14.0)
				var sy: int = M.js_round(cy - fmod(t * 12.0 + float(i) * 8.0, 22.0))
				L.rect(float(sx - 1), float(sy), 3.0, 1.0, _p("c3"))
				L.rect(float(sx), float(sy - 1), 1.0, 3.0, _p("c3"))
	var lit := func(gg, _a, _f) -> void:
		var e = tgt
		if _alive(e):
			DRAW.glow(gg.l, e.x, e.y - 4.0, 22.0 * (1.0 - st.shrink), M.mix(_p("g2"), _p("c1"), st.k), 0.28 * (1.0 - st.k * 0.4), 4)
	w.add(FX.Custom.new(cx0, cy0, 6.0, {"gnd": gnd, "lit": lit}))

	# it looks restorative for a moment...
	w.mark(tgt, "remedy", 6.0, 0.0)
	for _k in GEN.ticks(0.7):
		if _alive(tgt):
			w.mark(tgt, "remedy", 6.0, 0.0)
		g.y(GEN.F)

	# ...then its internal structure changes
	var T0: float = w.time
	var poisoned := false
	var moved := false
	var thrown := false
	while w.time - T0 < 1.5:
		var kk: float = M.clampf((w.time - T0) / 0.8, 0.0, 1.0)
		st.k = M.smoothstep(kk)
		if _alive(tgt):
			w.mark(tgt, "remedy", 6.0, st.k)
		if kk > 0.4 and not poisoned:
			poisoned = true
			if _alive(tgt):
				w.poison(tgt, c.d(120.0), 3.0, c.id, c.def["id"])
		if w.time - T0 > 0.55 and not moved:
			moved = true
			var a: float = c.ang + PI
			w.glide([{"x": p.x + V8M.v8_cos(a) * 40.0, "y": p.y + V8M.v8_sin(a) * 40.0}], 0.35)
		if w.time - T0 > 1.0 and not thrown:
			thrown = true
			w.run(_spawn(func(gg): _throw_vial(gg, w, c, p, tgt, cx0, cy0)))
		g.y(GEN.F)
	g.y(0.12)

	var X: float = tgt.x if _alive(tgt) else cx0
	var Y: float = tgt.y if _alive(tgt) else cy0
	for k in GEN.ticks(0.28):
		st.shrink = M.smoothstep(k) * 0.85
		if int(floor(k * 60.0)) % 2 == 0:
			for i in range(2):
				var a: float = c.rng.range(0.0, M.TAU)
				var sx0: float = X + V8M.v8_cos(a) * 24.0
				var sy0: float = Y + V8M.v8_sin(a) * 18.0
				w.parts.add({"k": "mote", "x": sx0, "y": sy0, "z": 4.0, "max": 0.25,
						"c1": _p("c1"), "c2": _p("e3"), "glow": 1.0,
						"fn": func(q, _ww, _dt) -> void:
							var u: float = q.age / q.max
							q.x = M.lerpf(sx0, X, u)
							q.y = M.lerpf(sy0, Y, u)})
		g.y(GEN.F)
	st.shrink = 1.0
	w.hitstop = 0.04
	w.screen_flash(_p("c1"), 0.3, 0.14)
	w.shake(6.0, 0.4)
	w.shock(X, Y, 70.0, 0.4, 3.0)
	LIB.ring_at(c, X, Y, 40.0, 0.3, 135.0, {"kind": "burst", "knock": 170.0, "stag": 0.5, "h": rup,
			"cols": [_p("c3"), _p("e3"), _p("k1")], "w": 4.0, "dust": false})
	w.add(FX.Flash.new(X, Y - 6.0, 26.0, _p("c2"), 0.3, 4.0))
	w.add(FX.Pool.new(X, Y, 26.0, MATS.MAT()["rot"], 4.5, {"blobs": 6, "boil": 1.2, "grow": 0.2}))
	w.add(FX.Pool.new(X + 5.0, Y - 2.0, 17.0, MATS.MAT()["venom"], 4.2, {"blobs": 5, "boil": 1.4, "grow": 0.25}))
	w.add(FX.Pool.new(X - 4.0, Y + 3.0, 10.0, MATS.MAT()["acid"], 3.8, {"blobs": 4, "boil": 1.4, "grow": 0.3}))
	FX.shards(w, X, Y, 18, 150.0, _p("c0"), _p("e1"), _p("c3"), {"z": 8.0, "up": 160.0, "land": 2, "size": [3.0, 7.0]})
	FX.shards(w, X, Y, 8, 110.0, _p("m2"), _p("m0"), _p("w"), {"z": 8.0, "up": 130.0, "land": 2, "size": [2.0, 4.0]})
	FX.drops(w, X, Y, 30, 130.0, _p("e3"), _p("c1"), _p("k1"), {"z": 8.0, "up": 130.0, "size": [2.0, 4.0], "glow": 1.0})
	var cl = FX.Cloud.new(X, Y, LIB.mk_puffs(c.rng, 8, 16.0, 10.0, 15.0, 6.0, 1.8), MATS.VAP()["dark"], 3.0, c.id)
	cl.grow = {"from": 0.4, "to": 1.8, "dur": 1.0}
	cl.dens = 12.0
	w.add(cl)
	S2.plume(w, X, Y, 34.0, 1.2, MATS.VAP()["green"], 11.0, 4)
	if _alive(tgt):
		tgt.st.erase("remedy")
	for e in w.enemies:
		if e.st.has("remedy") and e != tgt:
			e.st.erase("remedy")
	g.y(1.5)


## TS: `w.run((function* () { castAnim(w, c, false, 0.3); p.face = atan2; yield 0.08; throwArc(vial) })())`
static func _throw_vial(gg, w, c, p, tgt, cx0: float, cy0: float) -> void:
	LIB.cast_anim(w, c, false, 0.3)
	p.face = V8M.v8_atan2(tgt.y - p.y, tgt.x - p.x)
	gg.y(0.08)
	var hp: Array = LIB.hand_pos(w)
	var x1: float = hp[0]
	var y1: float = hp[1]
	var tx: float = tgt.x if _alive(tgt) else cx0
	var ty: float = tgt.y if _alive(tgt) else cy0
	LIB.throw_arc(w, "vial", x1, y1, tx, ty, 0.3, 14.0, func(_a = null, _b = null) -> void: pass, 16.0)
