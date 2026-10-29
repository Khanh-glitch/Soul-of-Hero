extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s3.ts` skill 14,
## REACTION CASCADE: `class Frag extends Fx`, `function* cascade(c)` and
## `vialSpriteG` (s3.ts lines 211-302).
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order,
## closure-shared mutable state (`ri`, `last`, `frags`, `reached`), the
## growing `for (const f of frags)` walk, stable sorts and particle `fn`
## callbacks follow the original. Inner classes carry their own helpers
## (they cannot call outer static functions).

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")


## `const alive = (e) => !!e && e.dying <= 0`
static func _alive(e) -> bool:
	return e != null and float(e.dying) <= 0.0


## Shared mutable closure state of one `cascade` call (`let last`, `let ri`, `const frags`, `const reached`).
class St extends RefCounted:
	var ri: int = 0
	var last = null
	var frags: Array = []
	var reached: Dictionary = {}
	var react = null
	var fin = null


## `class Frag extends Fx`
class Frag extends FX.Fx:
	var vx: float = 0.0
	var vy: float = 0.0
	var arrived: bool = false
	var trail_t: float = 0.0
	var tgt = null
	var gen_v: int = 0
	var kind_r: int = 0
	var done: bool = false

	func _init(x_: float, y_: float, ang: float, tgt_, gen_: int, kr: int) -> void:
		x = x_
		y = y_
		vx = V8M.v8_cos(ang) * 120.0
		vy = V8M.v8_sin(ang) * 120.0
		kind = "frag"
		tgt = tgt_
		gen_v = gen_
		kind_r = kr

	static func _alive(e) -> bool:
		return e != null and float(e.dying) <= 0.0

	func upd(w, dt: float) -> void:
		if not _alive(tgt):
			var n = w.nearest(x, y, 140.0)
			if n != null:
				tgt = n
			else:
				dead = true
				arrived = true
				return
		var e = tgt
		var dx: float = e.x - x
		var dy: float = e.y - y
		var d: float = V8M.v8_hypot(dx, dy)
		if d == 0.0 or is_nan(d):
			d = 1.0
		var sp: float = 190.0
		var want: float = V8M.v8_atan2(dy, dx)
		var cur: float = V8M.v8_atan2(vy, vx)
		var da: float = want - cur
		da = fmod(fmod(da + PI, M.TAU) + M.TAU, M.TAU) - PI
		var na: float = cur + M.clampf(da, -6.5 * dt, 6.5 * dt)
		var s: float = minf(sp, V8M.v8_hypot(vx, vy) + 420.0 * dt)
		vx = V8M.v8_cos(na) * s
		vy = V8M.v8_sin(na) * s
		x += vx * dt
		y += vy * dt
		if fmod(age * 60.0, 1.0) < 1.0:
			var cr: int = int(M.P["y1"]) if kind_r == 2 else (int(M.P["c3"]) if kind_r == 3 else int(M.P["c1"]))
			var hv: float = M.hash_n(age * 60.0)
			upd_part(w, cr, hv)
		if d < e.r + 2.0:
			arrived = true
			dead = true

	func upd_part(w, cr: int, hv: float) -> void:
		w.parts.add({"k": "drop", "x": x, "y": y, "z": 5.0,
				"vx": -vx * 0.05 + (hv - 0.5) * 8.0, "vy": -vy * 0.05, "vz": 6.0,
				"grav": 80.0, "size": 2.0, "c1": cr, "c2": int(M.P["w"]), "c3": int(M.P["e2"]),
				"max": 0.4, "glow": 1.0})

	func air(gg, _w) -> void:
		var L = gg.s
		var cols: int = [int(M.P["c1"]), int(M.P["m2"]), int(M.P["y1"]), int(M.P["g2"])][kind_r]
		DRAW.ball(L, x, y - 5.0, 2.6, MATS.PAL()["liquid"])
		L.disc(x, y - 5.0, 1.2, cols)
		L.px(M.js_round(x - 1.0), M.js_round(y - 6.0), int(M.P["w"]))

	func lit(gg, _w) -> void:
		DRAW.glow(gg.l, x, y - 5.0, 7.0,
				[int(M.P["c1"]), int(M.P["m1"]), int(M.P["y1"]), int(M.P["g1"])][kind_r], 0.4, 3)


## `vialSpriteG(g, x, y, a)`
static func _vial_sprite(gg, x: float, y: float, a: float) -> void:
	var L = gg.s
	var pu: bool = V8M.v8_sin(a * 60.0) > 0.0
	DRAW.ball(L, x, y, 3.6, MATS.PAL()["liquid"])
	L.disc(x + 1.0, y + 1.0, 1.5, int(M.P["k0"]))
	L.px(M.js_round(x - 2.0), M.js_round(y - 2.0), int(M.P["w"]) if pu else int(M.P["c3"]))
	if pu:
		L.px(M.js_round(x + 2.0), M.js_round(y - 1.0), int(M.P["m2"]))


## Stable ascending sort of `{e, d}` candidates by `d` (JavaScript sort is stable).
static func _sort_by_d(arr: Array) -> Array:
	var out: Array = arr.duplicate()
	for i in range(1, out.size()):
		var cur = out[i]
		var j: int = i - 1
		while j >= 0 and float(out[j]["d"]) > float(cur["d"]):
			out[j + 1] = out[j]
			j -= 1
		out[j + 1] = cur
	return out


## `const contact = (e, big = false) => { ... }`
static func _contact(w, e, big: bool) -> void:
	w.add(FX.Flash.new(e.x, e.y - 4.0, 22.0 if big else 14.0, int(M.P["w"]), 0.22, 4.0))
	LIB.vis_ring(w, e.x, e.y, 30.0 if big else 16.0, 0.2,
			[int(M.P["w"]), int(M.P["c2"]), int(M.P["e2"])], 2.0)
	w.shock(e.x, e.y, 26.0, 0.25, 1.5)
	w.shake(3.0 if big else 1.5, 0.12)
	FX.drops(w, e.x, e.y, 10, 90.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
			{"z": 6.0, "up": 90.0, "glow": 2.0})


## `const launch = (from, gen, n) => { ... }`
static func _launch(c, w, st: St, from, gen: int, n: int) -> void:
	var cand: Array = []
	for e in w.enemies:
		if not (float(e.dying) <= 0.0):
			continue
		if st.reached.has(e.id):
			continue
		var blocked: bool = false
		for f in st.frags:
			if f.tgt == e and not f.dead:
				blocked = true
				break
		if blocked:
			continue
		var d: float = V8M.v8_hypot(e.x - from.x, e.y - from.y)
		if d < 125.0:
			cand.append({"e": e, "d": d})
	cand = _sort_by_d(cand)
	if cand.size() > n:
		cand = cand.slice(0, n)
	for i in range(cand.size()):
		var o: Dictionary = cand[i]
		var sgn: float = 1.0 if i % 2 != 0 else -1.0
		var ang: float = V8M.v8_atan2(o["e"].y - from.y, o["e"].x - from.x) + sgn * 1.0 + c.rng.range(-0.3, 0.3)
		var f := Frag.new(from.x, from.y, ang, o["e"], gen, (st.ri + i) % 4)
		st.frags.append(f)
		w.add(f)


## Wrap a generator body in a `GEN` that receives its own driver (same pattern as the other ports).
static func _gen(body: Callable):
	var box: Array = []
	var gen = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(gen)
	return gen


## `const reaction = (e, type) => { ... }`
static func _reaction(c, w, st: St, e, typ: int) -> void:
	var X: float = e.x
	var Y: float = e.y
	var cols_t: Array = [int(M.P["c1"]), int(M.P["m2"]), int(M.P["y1"]), int(M.P["c3"])]
	var pop = func() -> void:
		LIB.ring_at(c, X, Y, 24.0, 0.22, 55.0,
				{"kind": "crystal" if typ == 2 else "burst", "knock": 110.0, "stag": 0.35,
				"h": st.react, "max": 1,
				"cols": [int(M.P["w"]), cols_t[typ], int(M.P["e2"])], "w": 3.0})
	if typ == 0:
		# swelling fluid
		var up0 = func(gg, a: float) -> void:
			var r: float = 3.0 + a * 14.0 * (1.0 + V8M.v8_sin(a * 40.0) * 0.05)
			DRAW.ball(gg.s, X, Y - 6.0, r, MATS.PAL()["liquid"], r * 0.9)
			gg.s.dl = 8
			gg.s.disc(X + 1.0, Y - 5.0, r * 0.5, int(M.P["c2"]))
			gg.s.dl = 16
		var lit0 = func(gg, a: float) -> void:
			DRAW.glow(gg.l, X, Y - 6.0, 10.0 + a * 14.0, int(M.P["c1"]), 0.4, 3)
		w.add(FX.Custom.new(X, Y, 0.4, {"up": up0, "lit": lit0}, Y + 2.0))
		var body0 = func(gg) -> void:
			gg.y(0.38)
			pop.call()
			FX.drops(w, X, Y, 16, 100.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
					{"z": 8.0, "up": 100.0, "glow": 2.0})
			w.add(FX.Splash.new(X, Y, 9.0, int(M.P["c1"]), int(M.P["c3"])))
			w.add(FX.Pool.new(X, Y, 8.0, MATS.MAT()["acid"], 2.0, {"blobs": 4, "boil": 1.0}))
		w.run(_gen(body0))
	elif typ == 1:
		# rupturing membranes
		var up1 = func(gg, a: float) -> void:
			var r: float = 4.0 + a * 15.0
			gg.s.dl = 8
			gg.s.disc(X, Y - 8.0, r, int(M.P["m1"]))
			gg.s.dl = 16
			gg.s.ring(X, Y - 8.0, r, 1.0, int(M.P["m2"]))
			gg.s.ring(X, Y - 8.0, r * 0.6, 1.0, int(M.P["c3"]))
			gg.s.px(M.js_round(X - r * 0.5), M.js_round(Y - 8.0 - r * 0.5), int(M.P["w"]))
			if a > 0.7:
				for i in range(4):
					var an: float = float(i) * 1.7
					gg.s.line(X + V8M.v8_cos(an) * r * 0.4, Y - 8.0 + V8M.v8_sin(an) * r * 0.4,
							X + V8M.v8_cos(an) * r, Y - 8.0 + V8M.v8_sin(an) * r, int(M.P["k0"]))
		var lit1 = func(gg, a: float) -> void:
			DRAW.glow(gg.l, X, Y - 8.0, 12.0 + a * 10.0, int(M.P["m1"]), 0.4, 3)
		w.add(FX.Custom.new(X, Y, 0.42, {"up": up1, "lit": lit1}, Y + 2.0))
		var body1 = func(gg) -> void:
			gg.y(0.4)
			pop.call()
			for i in range(10):
				var a: float = c.rng.range(0.0, M.TAU)
				var vz: float = c.rng.range(30.0, 80.0)
				var fn_petal = func(q, _ww, _dt: float) -> void:
					if q.z < 0.0:
						q.z = 0.0
						q.vz = 0.0
				w.parts.add({"k": "petal", "x": X, "y": Y, "z": 8.0,
						"vx": V8M.v8_cos(a) * 60.0, "vy": V8M.v8_sin(a) * 50.0, "vz": vz,
						"grav": 80.0, "drag": 1.2, "size": 3.0, "rot": a, "vr": 7.0,
						"c1": int(M.P["m1"]), "c2": int(M.P["m2"]), "max": 1.4, "fn": fn_petal})
			FX.drops(w, X, Y, 10, 80.0, int(M.P["m2"]), int(M.P["w"]), int(M.P["m1"]),
					{"z": 8.0, "glow": 1.0})
		w.run(_gen(body1))
	elif typ == 2:
		# crystalline growth
		w.mark(e, "crystal", 0.8, 0.5)
		var up2 = func(gg, a: float) -> void:
			var k: float = M.smoothstep(minf(1.0, a * 2.0))
			var L = gg.s
			if a > 0.9:
				return
			for i in range(4):
				DRAW.crystal_prism(L, X + (float(i) - 1.5) * 4.0, Y + 3.0 + float(i % 2) * 2.0,
						(6.0 + float(i % 3) * 5.0) * k, 1.8, float(i) - 1.5,
						int(M.P["v2"]), int(M.P["v0"]), int(M.P["y2"]), int(M.P["k1"]), gg.t)
		var lit2 = func(gg, a: float) -> void:
			DRAW.glow(gg.l, X, Y - 6.0, 10.0, int(M.P["y1"]), 0.3 * (1.0 - a), 3)
		w.add(FX.Custom.new(X, Y, 0.55, {"up": up2, "lit": lit2}, Y + 4.0))
		var body2 = func(gg) -> void:
			gg.y(0.45)
			pop.call()
			FX.shards(w, X, Y, 12, 100.0, int(M.P["y1"]), int(M.P["v1"]), int(M.P["y2"]),
					{"z": 6.0, "up": 100.0, "land": 2, "size": [3.0, 6.0]})
		w.run(_gen(body2))
	else:
		# boiling vapour
		var body3 = func(gg) -> void:
			for i in range(6):
				FX.steam(w, X + c.rng.range(-5.0, 5.0), Y, 2, 20.0, int(M.P["e2"]), int(M.P["c3"]), 5.0,
						{"z": 3.0, "vz": 40.0})
				FX.drops(w, X, Y, 2, 50.0, int(M.P["g2"]), int(M.P["c3"]), int(M.P["c1"]),
						{"z": 4.0, "up": 90.0, "glow": 1.0})
				gg.y(0.05)
			pop.call()
			S2.plume(w, X, Y, 22.0, 0.9, MATS.VAP()["pale"], 9.0, st.ri + 3)
		w.run(_gen(body3))
	st.ri += 1


static func _cascade_body(c, g) -> void:
	var w = c.w
	var st := St.new()
	LIB.cast_anim(w, c)
	g.y(0.04)
	var tgt = c.target if c.target != null else w.nearest(c.tx, c.ty, 100.0)
	if tgt == null:
		return
	var hp: Array = LIB.hand_pos(w)
	var hx: float = float(hp[0])
	var hy: float = float(hp[1])
	var dur: float = M.clampf(V8M.v8_hypot(tgt.x - hx, tgt.y - hy) / 780.0, 0.08, 0.2)
	var draw_v = func(gg, x: float, y: float, _z: float, a: float) -> void:
		_vial_sprite(gg, x, y, a)
	var end_v = func() -> int:
		return 0
	var pr = FX.Proj.new(hx, hy, tgt.x, tgt.y, dur, 5.0, draw_v, end_v)
	pr.lit_fn = func(gg, _w) -> void:
		DRAW.glow(gg.l, pr.x, pr.y - pr.z, 8.0, int(M.P["c2"]), 0.45, 3)
	w.add(pr)
	g.y(dur)
	st.reached[tgt.id] = true
	st.react = FX.Hits.new()
	st.fin = FX.Hits.new()
	st.last = tgt
	st.ri = 0
	LIB.hit_e(c, tgt, 60.0, {"kind": "burst", "k": 90.0, "from": [hx, hy], "stag": 0.3, "at": [tgt.x, tgt.y]})
	_contact(w, tgt, true)
	_launch(c, w, st, tgt, 1, 3)
	var idle: float = 0.0
	var tm: float = 0.0
	while tm < 6.0:
		# `for (const f of frags)` observes frags appended during the walk.
		var fi: int = 0
		while fi < st.frags.size():
			var f = st.frags[fi]
			fi += 1
			if (not f.arrived) or f.done:
				continue
			f.done = true
			var e = f.tgt
			if not _alive(e):
				continue
			st.reached[e.id] = true
			st.last = e
			LIB.hit_e(c, e, 45.0, {"kind": "burst", "k": 70.0,
					"ang": V8M.v8_atan2(f.vy, f.vx), "stag": 0.3, "at": [e.x, e.y]})
			_contact(w, e, false)
			_reaction(c, w, st, e, f.kind_r)
			_launch(c, w, st, e, f.gen_v + 1, 0 if f.gen_v >= 3 else 2)
		var pending: bool = false
		for f2 in st.frags:
			if not f2.arrived:
				pending = true
				break
		idle = 0.0 if pending else idle + GEN.F
		if idle > 0.5:
			break
		g.y(GEN.F)
		tm += GEN.F
	# final target: the accumulated energy detonates
	var X: float = st.last.x
	var Y: float = st.last.y
	w.hitstop = 0.05
	w.screen_flash(int(M.P["w"]), 0.5, 0.2)
	w.shake(8.0, 0.5)
	w.shock(X, Y, 110.0, 0.5, 4.0)
	w.add(FX.Flash.new(X, Y - 6.0, 44.0, int(M.P["w"]), 0.4, 6.0))
	LIB.ring_at(c, X, Y, 66.0, 0.4, 140.0,
			{"kind": "burst", "knock": 180.0, "stag": 0.5, "h": st.fin,
			"cols": [int(M.P["w"]), int(M.P["c2"]), int(M.P["m1"])], "w": 5.0, "dust": false})
	LIB.vis_ring(w, X, Y, 46.0, 0.35, [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])], 3.0)
	var air_f = func(gg, a: float) -> void:
		var L = gg.s
		var t: float = gg.t
		for arm in range(4):
			var pts: Array = []
			for i in range(16):
				var u: float = float(i) / 15.0
				var an: float = float(arm) * 1.571 + u * 2.6 + t * 3.5
				var rr: float = u * 62.0 * M.smoothstep(minf(1.0, a * 1.6))
				pts.append({"x": X + V8M.v8_cos(an) * rr, "y": Y - 4.0 + V8M.v8_sin(an) * rr * 0.8,
						"r": (3.4 - u * 2.0) * (1.0 - a * 0.6)})
			L.dl = maxi(3, M.js_round(14.0 * (1.0 - a)))
			DRAW.worm_body(L, pts, MATS.PAL()["liquid"], {"stripe": int(M.P["c3"]), "stripeT": t})
			L.dl = 16
	var lit_f = func(gg, a: float) -> void:
		DRAW.glow(gg.l, X, Y, 50.0, int(M.P["c1"]), 0.3 * (1.0 - a), 4)
	w.add(FX.Custom.new(X, Y, 1.0, {"air": air_f, "lit": lit_f}, Y + 8.0))
	for i in range(30):
		var a: float = (float(i) / 30.0) * M.TAU + c.rng.range(-0.1, 0.1)
		var sp: float = c.rng.range(100.0, 160.0)
		if i % 2 != 0:
			w.parts.add({"k": "chip", "x": X, "y": Y, "z": 8.0,
					"vx": V8M.v8_cos(a) * sp, "vy": V8M.v8_sin(a) * sp * 0.8, "vz": 60.0,
					"grav": 200.0, "size": 3.0, "c1": int(M.P["g2"]), "c2": int(M.P["g0"]), "c3": int(M.P["w"]),
					"land": 3, "max": 2.4, "rot": 0.0, "vr": 9.0, "glow": 2.0})
		else:
			w.parts.add({"k": "drop", "x": X, "y": Y, "z": 8.0,
					"vx": V8M.v8_cos(a) * sp, "vy": V8M.v8_sin(a) * sp * 0.8, "vz": 80.0,
					"grav": 200.0, "size": 3.0, "c1": int(M.P["c1"]), "c2": int(M.P["c3"]), "c3": int(M.P["e2"]),
					"land": 1, "max": 2.4, "glow": 2.0})
	w.add(FX.Pool.new(X, Y, 20.0, MATS.MAT()["acid"], 4.0, {"blobs": 6, "boil": 1.4}))
	g.y(1.4)


static func cascade(c):
	var box: Array = []
	var gen = GEN.new(func():
		_cascade_body(c, box[0])
		return null)
	box.append(gen)
	return gen
