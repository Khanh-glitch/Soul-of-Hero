extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s4.ts` skill 17
## REVERSE EXTRACTION (`function* extraction(c)`, original lines 11-99).
##
## Line-by-line translation of the authored phases: the vortex forms and draws
## the battlefield in (drain of nearby enemies and residual puddles), the
## vessel compression, the directional burst with its acid wave, the enemy
## hits and the trailing acid pools. Expression order, yield waits, RNG draw
## order and the shared `vort` state follow the original.
##
## UNVERIFIED: registered only as a candidate (venom_candidates.gd). Promotion
## needs a PASS from the differential in CI.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")


## Shared vortex state (`const vort = { k, core, spin, collapse }`). A class,
## because GDScript lambdas capture locals by value.
class Vort extends RefCounted:
	var k: float = 0.0
	var core: float = 0.0
	var spin: float = 0.0
	var collapse: float = 0.0


static func _smooth(t: float) -> float:
	return M.smoothstep(t)


static func _pts_to_seg(X: float, Y: float, r: float) -> Dictionary:
	return {"x": X, "y": Y, "r": r}


static func extraction(c):
	var box: Array = []
	var gen = GEN.new(func():
		_extraction_body(c, box[0])
		return null)
	box.append(gen)
	printerr("R17 extraction factory gen_null=%s" % str(gen == null))
	return gen


static func _extraction_body(c, g) -> void:
	printerr("R17 body start")
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c, true, 0.5)
	var dx: float = V8M.v8_cos(c.ang)
	var dy: float = V8M.v8_sin(c.ang)
	g.y(0.04)
	var vx: float = M.clampf(p.x + dx * 78.0, 30.0, w.W - 30.0)
	var vy: float = M.clampf(p.y + dy * 78.0, 34.0, w.H - 24.0)
	var R: float = 74.0
	var pull = FX.Hits.new()
	var wave = FX.Hits.new()
	var res = FX.Hits.new()
	var vort := Vort.new()

	# ---- the vortex: ground layer, glow ----------------------------------
	var vortex_gnd := func(gg, _a, _f) -> void:
		var L = gg.s
		var fld = gg.f
		var t: float = gg.t
		var k: float = vort.k * (1.0 - vort.collapse)
		if k < 0.02:
			return
		fld.reset()
		for arm in range(4):
			var pv = null
			for i in range(16):
				var u: float = float(i) / 15.0
				var an: float = float(arm) * 1.571 + u * 4.6 * (1.0 - vort.collapse * 0.5) - t * (4.0 + vort.spin * 3.0)
				var rr: float = (5.0 + u * u * R * 0.62 + u * 12.0) * k
				var X: float = vx + V8M.v8_cos(an) * rr
				var Y: float = vy + V8M.v8_sin(an) * rr * 0.9
				if pv != null:
					fld.capsule(pv[0], pv[1], X, Y, (4.2 - u * 3.0) * k + 0.6, (4.2 - (u + 1.0 / 15.0) * 3.0) * k + 0.6)
				pv = [X, Y]
		fld.disc(vx, vy, 11.0 * k, 0.2)
		fld.shade(L, MATS.MAT()["acid"], t, {"fx": -16.0, "fy": 8.0, "seed": 2})
		fld.reset()
		fld.disc(vx, vy, (3.0 + vort.core * 9.0) * k, 0.0)
		fld.shade(L, MATS.MAT()["ink"], t, {"fx": 5.0, "fy": 2.0})
		for i in range(18):
			var an2: float = float(i) * 0.35 - t * 6.0 + float(i)
			var rr2: float = (14.0 + float(i % 6) * 5.0) * k
			L.px(float(M.js_round(vx + V8M.v8_cos(an2) * rr2)), float(M.js_round(vy + V8M.v8_sin(an2) * rr2 * 0.9)),
					int(M.P["c3"]) if i % 3 != 0 else int(M.P["g2"]))
	var vortex_lit := func(gg, _a, _f) -> void:
		DRAW.glow(gg.l, vx, vy, 30.0 * vort.k * (1.0 - vort.collapse * 0.6), int(M.P["c1"]), 0.25 + vort.core * 0.3, 4)
	w.add(FX.Custom.new(vx, vy, 6.0, {"gnd": vortex_gnd, "lit": vortex_lit}))

	# feed(cnt, mult): spawns inward drops and drains residual puddles
	var feed := func(cnt: int, mult: float = 1.0) -> void:
		var res_: Array = []
		for f in w.fx:
			if f.resid and V8M.v8_hypot(f.x - vx, f.y - vy) < 150.0:
				res_.append(f)
		for i in range(cnt):
			var src = null
			if res_.size() > 0 and c.rng.next() < 0.7:
				src = res_[c.rng.int_n(res_.size())]
			var a0: float = V8M.v8_atan2(src.y - vy, src.x - vx) if src != null else c.rng.range(0.0, M.TAU)
			var r0: float = V8M.v8_hypot(src.x - vx, src.y - vy) if src != null else c.rng.range(62.0, 105.0)
			var sp: float = c.rng.range(0.9, 1.3) * mult
			var part_fn := func(q, _ww, _dt) -> void:
				var u: float = q.age / q.max
				var rr: float = r0 * V8M.v8_pow(1.0 - u, 1.4)
				var an: float = a0 + u * u * 6.5 + u * 1.5
				q.x = vx + V8M.v8_cos(an) * rr
				q.y = vy + V8M.v8_sin(an) * rr * 0.9
				q.z = 2.0 + V8M.v8_sin(u * M.PI) * 7.0 * (1.0 - u)
			w.parts.add({"k": "drop", "x": vx, "y": vy, "z": 2.0, "max": 0.9 / sp, "size": float(int(c.rng.range(1.0, 3.5))),
					"c1": int(M.P["c1"]), "c2": int(M.P["c3"]), "c3": int(M.P["e2"]), "glow": 1, "fn": part_fn})
		for f in res_:
			var d: float = V8M.v8_hypot(f.x - vx, f.y - vy)
			if d < 7.0:
				f.dead = true
				w.add(FX.Splash.new(vx, vy, 5.0, int(M.P["c1"]), int(M.P["c3"])))
			else:
				var s: float = (2.2 + vort.k * 2.0) / 60.0 * 60.0 / 60.0
				f.x += (vx - f.x) * s * 0.08
				f.y += (vy - f.y) * s * 0.08

	# ---- the vortex forms and draws the battlefield in ----------------------
	var tm: float = 0.0
	var nt: float = 0.0
	var healAcc: int = 0
	while tm < 2.1:
		vort.k = _smooth(tm / 0.4)
		vort.core = _smooth(tm / 1.8)
		vort.spin = tm / 2.0
		if int(floor(tm * 60.0)) % 3 == 0:
			feed.call(2 + int(floor(tm)))
		nt -= GEN.F
		for e in w.enemies:
			if e.dying > 0.0:
				continue
			var ex: float = vx - e.x
			var ey: float = vy - e.y
			var d: float = V8M.v8_hypot(ex, ey)
			if d < R + e.r and d > 5.0:
				var kf: float = 1.0
				if e.kind == "boss":
					kf = 0.2
				elif e.kind == "elite":
					kf = 0.6
				var s: float = (26.0 + 34.0 * (1.0 - d / R)) * GEN.F * kf
				e.x += ex / d * s
				e.y += ey / d * s
				if not e.st.has("corrode"):
					w.mark(e, "corrode", 0.5, 1)
			if nt <= 0.0 and tm > 0.25 and d < R * 0.8 and pull.ok(e, w.time, 0.4, 4):
				LIB.hit_e(c, e, 25.0, {"kind": "acid", "stag": 0.12, "heal": 0.06, "at": [e.x, e.y]})
				healAcc += 1
				var ex_pos: float = e.x
				var ey_pos: float = e.y
				var mote_fn := func(q, _ww, _dt) -> void:
					var u: float = q.age / q.max
					q.x = M.lerpf(ex_pos, p.x, u)
					q.y = M.lerpf(ey_pos, p.y - 6.0, u) - V8M.v8_sin(u * M.PI) * 10.0
				w.parts.add({"k": "mote", "x": e.x, "y": e.y, "z": 6.0, "max": 0.5, "c1": int(M.P["c2"]), "c2": int(M.P["c1"]),
						"glow": 1, "fn": mote_fn})
		if nt <= 0.0:
			nt = 0.4
		g.y(GEN.F)
		tm += GEN.F

	# ---- everything is drawn into a small vessel ---------------------------
	var hp: Array = LIB.hand_pos(w)
	var hx: float = hp[0]
	var hy: float = hp[1]
	p.cast = 0.8
	p.castMax = 0.8
	var vessel_air := func(gg, a) -> void:
		var L = gg.s
		var t: float = gg.t
		for s in range(3):
			var pts: Array = []
			for i in range(14):
				var u: float = float(i) / 13.0
				var tt: float = M.clampf(u + a * 0.2, 0.0, 1.0)
				var X: float = M.lerpf(vx, hx, tt) + V8M.v8_sin(u * 6.0 + float(s) * 2.0 + t * 10.0) * 7.0 * (1.0 - tt) * (1.0 - a)
				var Y: float = M.lerpf(vy, hy, tt) + V8M.v8_cos(u * 5.0 + float(s)) * 5.0 * (1.0 - tt) - V8M.v8_sin(tt * M.PI) * 8.0
				pts.append(_pts_to_seg(X, Y, (2.4 - u * 1.4) * (1.0 - a * 0.5)))
			L.dl = 13
			DRAW.worm_body(L, pts, MATS.PAL()["liquid"], {"stripe": int(M.P["c3"]), "stripeT": t})
			L.dl = 16
	w.add(FX.Custom.new(vx, vy, 0.5, {"air": vessel_air}))
	for k in GEN.ticks(0.5):
		vort.collapse = _smooth(k)
		vort.core = 1.0
		if int(floor(k * 60.0)) % 2 == 0:
			feed.call(2, 1.7)
		g.y(GEN.F)
	vort.k = 0.0

	# compressed vessel: impossible concentration of liquid and light
	var hold_air := func(gg, a) -> void:
		var L = gg.s
		var hp2: Array = LIB.hand_pos(w)
		var X: float = hp2[0]
		var Y: float = hp2[1] - 3.0
		DRAW.ball(L, X, Y, 3.2, MATS.PAL()["glassHi"])
		L.disc(X, Y, 2.0, int(M.P["w"]))
		var r: float = 2.0 + V8M.v8_sin(a * 40.0) * 0.6
		L.ring(X, Y, 4.0 + a * 3.0, 1.0, int(M.P["c3"]))
		L.px(float(M.js_round(X)), float(M.js_round(Y)), int(M.P["c2"]))
		for i in range(6):
			var an: float = float(i) * 1.05 + gg.t * 8.0
			L.px(float(M.js_round(X + V8M.v8_cos(an) * (7.0 - a * 4.0))),
					float(M.js_round(Y + V8M.v8_sin(an) * (7.0 - a * 4.0))), int(M.P["c3"]))
	var hold_lit := func(gg, a) -> void:
		var hp3: Array = LIB.hand_pos(w)
		DRAW.glow(gg.l, hp3[0], hp3[1] - 3.0, 12.0 + a * 14.0, int(M.P["w"]), 0.6, 5)
	w.add(FX.Custom.new(hx, hy, 0.4, {"air": hold_air, "lit": hold_lit}))
	g.y(0.4)

	# ---- violent directional burst -------------------------------------------
	var ox: float = p.x
	var oy: float = p.y
	w.screen_flash(int(M.P["c3"]), 0.5, 0.18)
	w.shake(6.0, 0.45)
	w.shock(ox + dx * 24.0, oy + dy * 24.0, 80.0, 0.4, 3.5)
	var reach: float = 200.0
	var start: float = w.time
	var sp_b: float = 420.0
	var ang: float = c.ang
	var front := func() -> float:
		return min(reach, (w.time - start) * sp_b + 8.0)
	var hw := func(d: float) -> float:
		return 9.0 + d * 0.3
	var wave_gnd := func(gg, _a, f) -> void:
		var fr: float = front.call()
		var fld = gg.f
		var L = gg.s
		var t: float = gg.t
		fld.reset()
		var fade: float = M.clampf((2.2 - f.age) / 0.8, 0.1, 1.0) if f.age > 1.4 else 1.0
		for layer in range(3):
			var pv = null
			var d: float = 6.0
			while d <= fr:
				var off: float = V8M.v8_sin(d * 0.07 + t * 5.0 + float(layer) * 2.0) * (3.5 if layer > 0 else 0.0) * (1.0 + d * 0.01)
				var X: float = ox + dx * d - dy * off
				var Y: float = oy + dy * d + dx * off
				var r: float = hw.call(d) * (1.0 - float(layer) * 0.28) * M.clampf((fr - d) / 14.0 + 0.5, 0.45, 1.0)
				if pv != null:
					fld.capsule(pv[0], pv[1], X, Y, r, r)
				pv = [X, Y]
				d += 7.0
		var hd: float = hw.call(fr)
		fld.disc(ox + dx * fr, oy + dy * fr, hd * 1.0, 0.25)
		fld.shade(L, MATS.MAT()["acid"], t, {"fx": 60.0, "fy": 5.0, "dl": M.js_round(16.0 * fade), "seed": 4})
		var dd: float = 10.0
		while dd < fr:
			var h: float = hw.call(dd)
			for s in [-1.0, 1.0]:
				if M.hash_n(float(int(floor(dd)) * 3 + int(floor(t * 8.0)) + (9 if s > 0.0 else 0))) > 0.5:
					L.px(float(M.js_round(ox + dx * dd - dy * h * s)), float(M.js_round(oy + dy * dd + dx * h * s)), int(M.P["c3"]))
			dd += 5.0
	var wave_lit := func(gg, a) -> void:
		var fr: float = front.call()
		var d: float = 10.0
		while d < fr:
			DRAW.glow(gg.l, ox + dx * d, oy + dy * d, hw.call(d) * 1.6, int(M.P["c1"]), 0.16 * (1.0 - a), 3)
			d += 24.0
	w.add(FX.Custom.new(ox, oy, 2.2, {"gnd": wave_gnd, "lit": wave_lit}))

	var hit: Dictionary = {}
	var lastPool: float = 0.0
	var t2: float = 0.0
	while t2 < 0.55:
		var fr2: float = front.call()
		for e in w.enemies:
			if e.dying > 0.0 or hit.has(e.id):
				continue
			var rx: float = e.x - ox
			var ry: float = e.y - oy
			var along: float = rx * dx + ry * dy
			var lat: float = abs(-rx * dy + ry * dx)
			if along > -4.0 and along - e.r < fr2 and lat < hw.call(max(0.0, along)) + e.r:
				hit[e.id] = true
				if wave.ok(e, w.time):
					LIB.hit_e(c, e, 140.0, {"kind": "acid", "k": 200.0, "ang": ang, "stag": 0.5, "big": true, "heal": 0.04, "at": [e.x, e.y]})
					FX.drops(w, e.x, e.y, 10, 90.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]), {"z": 6.0, "glow": 1, "ang": ang, "spread": 2.0})
					w.mark(e, "corrode", 3.0, 2)
		while lastPool + 30.0 < fr2:
			lastPool += 30.0
			var X2: float = ox + dx * lastPool + c.rng.range(-8.0, 8.0)
			var Y2: float = oy + dy * lastPool + c.rng.range(-8.0, 8.0)
			w.add(FX.Pool.new(X2, Y2, 9.0 + c.rng.range(0.0, 3.0), MATS.MAT()["acid"], 5.5,
					{"blobs": 4, "boil": 1.4, "grow": 0.3, "tick": {"every": 0.9, "amt": c.d(22.5), "opts": {"kind": "acid", "src": int(c.def["id"])}, "h": res, "max": 2}}))
			w.add(FX.GroundDecal.new(X2, Y2, "pits", 8.0, 5.0, int(floor(X2 * 3.0)),
					{"a": int(M.P["k0"]), "b": int(M.P["e3"]), "c": int(M.P["c1"])}, 0.0, 1.0))
		if int(floor(t2 * 60.0)) % 2 == 0:
			var d2: float = fr2
			var h2: float = hw.call(d2)
			FX.drops(w, ox + dx * d2, oy + dy * d2, 3, 110.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
					{"z": 6.0, "up": 90.0, "glow": 1, "ang": ang, "spread": 1.4})
			FX.chips(w, ox + dx * d2 - dy * h2, oy + dy * d2 + dx * h2, 1, 60.0, int(M.P["k3"]), int(M.P["k1"]), int(M.P["e1"]), {"z": 5.0})
		g.y(GEN.F)
		t2 += GEN.F
	g.y(1.5)
