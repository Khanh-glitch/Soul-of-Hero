extends RefCounted
## 21 THE LAST DISTILLATION -- native port of `s4.ts` lines 352-534 (original `distillation`).
## Candidate until the original-source differential passes.
##
## Native objects: `Column` (TS `class Column extends Fx`) and `Chamber`
## (TS `class Chamber extends Fx`). TS field `g` is `gv` here (GDScript `g` is the
## draw-hook parameter name). Mutable closure state lives in locals of the
## generator body or in these RefCounted/Fx objects, because GDScript lambdas
## capture locals by value.
## Math: `Math.sin/cos/atan2/hypot/pow` use the V8 ports (`V8M`), `Math.round` is
## `M.js_round`, `hash` is `M.hash_n`, `smoothstep` is `M.smoothstep`.
## Integer division: every JS `/` that can be fractional is written as float division.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")
const S3O = preload("res://prototypes/skill_readiness/native/venom/venom_s3_rot.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")


static func _p(k: String) -> int:
	return int(M.P[k])


## TS `class Column extends Fx` -- a rising transparent fluid column.
class Column extends FX.Fx:
	static func _p(k: String) -> int:
		return int(M.P[k])

	var bx: float = 0.0
	var by: float = 0.0
	var H: float = 0.0
	var cx: float = 0.0
	var cy: float = 0.0
	var ph: float = 0.0
	var cols: int = 0
	var merge: float = 0.0
	var gv: float = 0.0
	var cry: float = 0.0

	func _init(bx_: float, by_: float, H_: float, cx_: float, cy_: float, ph_: float, cols_: int) -> void:
		bx = bx_
		by = by_
		H = H_
		cx = cx_
		cy = cy_
		ph = ph_
		cols = cols_
		x = bx
		y = by
		sy = by
		kind = "summon"

	func pos() -> Dictionary:
		var m: float = M.smoothstep(merge)
		return {"x": M.lerpf(bx, cx, m), "y": M.lerpf(by, cy, m)}

	func upd(_w, _dt: float) -> void:
		var q: Dictionary = pos()
		sy = float(q["y"]) + 2.0

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var gr: float = M.smoothstep(gv) * (1.0 - M.smoothstep(merge))
		var q: Dictionary = pos()
		if gr < 0.03:
			return
		var qx: float = float(q["x"])
		var qy: float = float(q["y"])
		var Hh: int = M.js_round(H * gr)
		var r: float = 5.0 + gr * 2.0
		var lay: Array = [[_p("v1"), _p("y0"), _p("v3")], [_p("e1"), _p("e3"), _p("c0")], [_p("g0"), _p("g1"), _p("g2")], [_p("n1"), _p("n2"), _p("m0")]]
		var sd: int = L.dl
		L.dl = 13
		for yy in range(Hh):
			var u: float = float(yy) / maxf(1.0, float(Hh))
			var s_wob: float = 0.85 + 0.15 * V8M.v8_sin(float(yy) * 0.14 + t * 1.6 + ph)
			var f_top: float = 0.6 + float(yy) * 0.13 if yy < 3 else 1.0
			var f_bot: float = 0.7 if yy > Hh - 4 else 1.0
			var wd: int = M.js_round(r * s_wob * f_top * f_bot)
			var band: int = int(floor((1.0 - u) * 4.0 + float(cols))) % 4
			var ramp: Array = lay[band]
			var n: float = float(RNG.nz1(qx + float(yy) * 0.5, float(yy) * 0.4 - t * 6.0 + ph * 5.0)) / 255.0
			var c1: int
			if n > 0.66:
				c1 = ramp[2]
			elif n > 0.33:
				c1 = ramp[1]
			else:
				c1 = ramp[0]
			L.hline(M.js_round(qx - float(wd)), M.js_round(qx + float(wd)), M.js_round(qy - float(yy)), c1)
			L.px(M.js_round(qx - float(wd)), M.js_round(qy - float(yy)), _p("v0"))
			L.px(M.js_round(qx + float(wd)), M.js_round(qy - float(yy)), _p("v0"))
		L.dl = 16
		var yb: int = 2
		while yb < Hh - 1:
			L.px(M.js_round(qx - r + 1.0), M.js_round(qy - float(yb)), _p("y2"))
			yb += 2
		for i in range(4):
			var phb: float = fmod(t * (0.5 + float(i) * 0.2) + float(i) * 0.3 + ph, 1.0)
			DRAW.bubble(L, qx + V8M.v8_sin(float(i) * 2.0 + ph) * (r - 2.0), qy - phb * float(Hh), 1.0 + float(i % 2), _p("y0"), _p("v3"), _p("w"))
		L.ellipse(qx, qy - float(Hh), r, 2.0, _p("v3"))
		L.ellipse(qx, qy - float(Hh), r - 1.0, 1.0, _p("y2"))
		L.ellipse(qx, qy, r + 1.0, 2.5, _p("v0"))
		L.ellipse(qx, qy, r - 1.0, 1.5, _p("v2"))
		if cry > 0.05:
			for i in range(3):
				DRAW.crystal_prism(L, qx + float(i - 1) * 3.0, qy - 1.0, (3.0 + float(i) * 2.0) * cry * 2.0, 1.6, float(i - 1), _p("v2"), _p("v0"), _p("y2"), _p("k1"), t)
		L.dl = sd

	func lit(g, _w) -> void:
		var q: Dictionary = pos()
		var gr: float = M.smoothstep(gv) * (1.0 - M.smoothstep(merge))
		if gr > 0.05:
			var lit_cols: Array = [_p("y0"), _p("c1"), _p("g1"), _p("m1")]
			DRAW.glow(g.l, float(q["x"]), float(q["y"]) - H * gr * 0.5, 14.0, lit_cols[cols % 4], 0.18 * gr, 3)


## TS `class Chamber extends Fx` -- the central distillation chamber.
class Chamber extends FX.Fx:
	static func _p(k: String) -> int:
		return int(M.P[k])

	var rad: float = 0.0
	var cry: float = 0.0
	var boil: float = 0.0
	var sep: float = 0.0
	var bright: float = 0.0
	var cyc: float = 0.0
	var gy: float = 0.0
	var h: float = 0.0

	func _init(x_: float, gy_: float, h_: float) -> void:
		x = x_
		y = gy_
		gy = gy_
		h = h_
		cyc = gy_ - h_
		sy = gy_ + 20.0
		kind = "summon"
		resid = false

	func shd(g, _w) -> void:
		g.s.dl = 8
		g.s.ellipse(x, gy + 8.0, rad * 1.05, rad * 0.38, _p("bk"))
		g.s.dl = 16

	func rings(g, front: bool) -> void:
		var L = g.s
		var t: float = g.t
		var R: float = rad
		if R < 6.0:
			return
		for i in range(3):
			var rx: float = R * (1.16 + float(i) * 0.06)
			var ry: float = R * (0.2 + float(i) * 0.1)
			var sgn: float = -1.0 if i % 2 != 0 else 1.0
			var tilt: float = t * (0.5 + float(i) * 0.2) * sgn
			var a: float = 0.0
			while a < M.TAU:
				var front_: bool = V8M.v8_sin(a + tilt) > 0.0
				if front_ == front:
					var px_: float = x + V8M.v8_cos(a + tilt) * rx
					var py_: float = cyc + V8M.v8_sin(a + tilt) * ry - R * 0.1 + float(i - 1) * R * 0.5
					var col_a: int
					if front:
						col_a = _p("u2") if i % 2 != 0 else _p("u1")
					else:
						col_a = _p("u0")
					L.px(M.js_round(px_), M.js_round(py_), col_a)
					L.px(M.js_round(px_), M.js_round(py_) + 1, _p("u0") if front else _p("k0"))
				a += 0.04

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var R: int = M.js_round(rad)
		if R < 2:
			if rad > 0.3:
				L.disc(x, cyc, 2.0, _p("w"))
			return
		rings(g, false)
		var cx_: int = M.js_round(x)
		var cy_: int = M.js_round(cyc)
		var L1: float = -0.28 - sep * 0.3 + V8M.v8_sin(t * 1.3) * 0.05
		var L2: float = 0.28 + sep * 0.28 + V8M.v8_sin(t * 1.1) * 0.05
		var ramps: Array = [
			[_p("v0"), _p("v1"), _p("y0"), _p("y1"), _p("v3")],
			[_p("e0"), _p("e1"), _p("e2"), _p("e3"), _p("c0"), _p("c1")],
			[_p("k0"), _p("k1"), _p("n0"), _p("e0"), _p("n1")]]
		var Rf: float = float(R)
		for dy in range(-R, R + 1):
			for dx in range(-R, R + 1):
				var q: int = dx * dx + dy * dy
				if q > R * R:
					continue
				var rr: float = sqrt(float(q))
				var edge: float = Rf - rr
				var px_i: int = cx_ + dx
				var py_i: int = cy_ + dy
				var ny: float = float(dy) / Rf
				var col_c: int
				if edge < 1.0:
					col_c = _p("k0")
				elif edge < 2.4:
					if dx + dy < 0:
						col_c = _p("v3")
					elif float(dx + dy) < Rf * 0.3:
						col_c = _p("v1")
					else:
						col_c = _p("v0")
				else:
					var wob: float = V8M.v8_sin(t * 1.4 + float(dx) * 0.09) * 0.06
					var layer: int
					if ny < L1 + wob:
						layer = 0
					elif ny < L2 - wob:
						layer = 1
					else:
						layer = 2
					var rp: Array = ramps[layer]
					var tx_off: float = t * (2.0 if layer == 0 else (-3.0 if layer == 1 else 1.0))
					var nn: float = float(RNG.nz1(float(px_i) * 0.14 + tx_off, float(py_i) * 0.14 + t * 1.6 + float(layer) * 9.0)) / 255.0
					var kf: float = floor((nn * 0.8 + (1.0 - absf(ny)) * 0.2 - ((float(dx) * 0.55 + float(dy) * 0.65) / Rf) * 0.18) * float(rp.size()) + (float(M.BAYER[((py_i & 3) << 2) | (px_i & 3)]) - 7.5) * 0.04)
					var k: int = int(kf)
					if k < 0:
						k = 0
					elif k >= rp.size():
						k = rp.size() - 1
					col_c = rp[k]
					if absf(ny - (L1 + wob)) < 0.03 or absf(ny - (L2 - wob)) < 0.03:
						col_c = _p("g2")
					if bright > 0.0:
						col_c = M.mix(col_c, _p("w"), bright)
				L.px(px_i, py_i, col_c)
		# dark biological matter drifting inside
		for i in range(5):
			var a2: float = t * 0.3 + float(i) * 1.3
			var sgn2: float = 1.0 if i % 2 != 0 else -1.0
			var bx_: float = float(cx_) + V8M.v8_cos(a2) * Rf * 0.45 * sgn2
			var by_: float = float(cy_) + Rf * 0.25 + V8M.v8_sin(a2 * 1.3) * Rf * 0.3
			DRAW.ball(L, bx_, by_, 2.5 + float(i % 3), MATS.PAL()["rot"], 2.0 + float(i % 3))
			L.px(M.js_round(bx_ + 1.0), M.js_round(by_ - 1.0), _p("m1"))
		# crystalline precipitates
		if cry > 0.02:
			for i in range(6):
				var ang: float = PI * (0.18 + float(i) * 0.13)
				var bx2: float = float(cx_) + V8M.v8_cos(ang) * Rf * 0.78
				var by2: float = float(cy_) + V8M.v8_sin(ang) * Rf * 0.78
				DRAW.crystal_prism(L, bx2, by2, (4.0 + float(i % 3) * 3.0) * cry * (Rf / 30.0), 2.0, (float(i) - 2.5) * 0.7, _p("v2"), _p("v0"), _p("y2"), _p("k1"), t)
		# dense bubbles, plus giant boiling ones
		for i in range(26):
			var sp: float = 0.18 + M.hash_n(float(i * 3)) * 0.35
			var phb: float = fmod(t * sp + M.hash_n(float(i)), 1.0)
			var bx3: float = float(cx_) + (M.hash_n(float(i * 7)) - 0.5) * Rf * 1.4 + V8M.v8_sin(t * 2.0 + float(i)) * 2.0
			var by3: float = float(cy_) + Rf * 0.9 - phb * Rf * 1.8
			if V8M.v8_hypot(bx3 - float(cx_), by3 - float(cy_)) < Rf - 3.0:
				DRAW.bubble(L, bx3, by3, 1.0 + floor(M.hash_n(float(i * 5)) * 3.0), _p("y0"), _p("y2"), _p("w"))
		var nb: int = int(floor(boil * 4.0))
		for i in range(nb):
			var phc: float = fmod(t * 0.5 + float(i) * 0.27, 1.0)
			var bx4: float = float(cx_) + (float(i) - 1.5) * Rf * 0.35
			var br: float = 4.0 + phc * 6.0
			DRAW.bubble(L, bx4, float(cy_) - Rf * 0.5 - phc * Rf * 0.3, br, _p("c1"), _p("c3"), _p("w"))
		L.arc(float(cx_), float(cy_), Rf - 3.0, 1.0, PI * 1.05, PI * 1.55, _p("w"))
		L.arc(float(cx_), float(cy_), Rf - 5.0, 1.0, PI * 1.15, PI * 1.35, _p("y2"))
		rings(g, true)

	func lit(g, _w) -> void:
		var R: float = rad
		if R < 1.0:
			return
		DRAW.glow(g.l, x, cyc, R * 1.5 + 6.0, M.mix(_p("c1"), _p("w"), bright), 0.28 + bright * 0.5, 5)
		if R < 8.0:
			DRAW.glow(g.l, x, cyc, 26.0, _p("w"), 0.9, 6)


## Entry point (TS `function* distillation(c)`).
static func distillation(c):
	var box: Array = []
	var gen = GEN.new(func():
		_distillation_body(c, box[0])
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


## Wrapper so every `nz1` call site reads the same integer noise function.

static func _stream_from(c, w, cx: float, gy: float, sx: float, sy: float, n: int, dly: float) -> void:
	for i in range(n):
		var a0: float = V8M.v8_atan2(sy - gy, sx - cx)
		var r0: float = V8M.v8_hypot(sx - cx, (sy - gy) / 0.9)
		var sp: float = c.rng.range(0.8, 1.3)
		var dl: float = dly + float(i) * 0.03
		var size_v: int = int(c.rng.range(1.0, 3.5))
		var col1: int = _p("c3") if i % 3 == 0 else _p("c1")
		var fn := func(q):
			var u: float = M.clampf((q.age - dl) / (1.4 / sp), 0.0, 1.0)
			var rr: float = r0 * V8M.v8_pow(1.0 - u, 1.5)
			var an: float = a0 + u * u * 9.0 + u * 2.0
			q.x = cx + V8M.v8_cos(an) * rr
			q.y = gy + V8M.v8_sin(an) * rr * 0.9
			q.z = 3.0 + V8M.v8_sin(u * PI) * 14.0 * (1.0 - u * 0.5) + u * 20.0 * (1.0 if u > 0.8 else 0.0)
			if u == 0.0:
				q.z = -50.0
		w.parts.add({"k": "drop", "x": sx, "y": sy, "z": 2.0, "max": 1.4 / sp + dl, "size": size_v, "c1": col1, "c2": _p("w"), "c3": _p("e2"), "glow": 1, "fn": fn})


static func _distillation_body(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c, true, 0.5)
	var cx: float = float(c.tx)
	var cy: float = float(c.ty)
	var gy: float = M.clampf(cy + 14.0, 80.0, float(w.H) - 20.0)
	var H: float = 52.0
	var pullH = FX.Hits.new()
	var A = FX.Hits.new()
	var sheets = FX.Hits.new()
	var cry_h = FX.Hits.new()
	var vap = FX.Hits.new()
	var frag = FX.Hits.new()
	var after = FX.Hits.new()
	g.y(0.06)
	var residues: Array = []
	for f in w.fx:
		if f.resid and not f.dead and V8M.v8_hypot(float(f.x) - cx, float(f.y) - cy) < 360.0:
			residues.append(f)
	# gather poisonous matter from across the battlefield (or erupt an underground reservoir)
	w.add(FX.GroundDecal.new(cx, gy, "cracks", 56.0, 16.0, int(c.id), {"a": _p("k0"), "b": _p("i3"), "c": _p("c1")}, 0.0, 1.0))
	w.add(FX.GroundDecal.new(cx, gy, "veins", 70.0, 15.0, int(c.id) + 1, {"a": _p("e0"), "b": _p("e3"), "c": _p("c2")}, 0.0, 1.2))
	w.add(FX.Pool.new(cx, gy, 28.0, MATS.MAT()["venom"], 9.0, {"grow": 1.2, "blobs": 7, "boil": 2.4, "resid": false}))
	w.shake(3.0, 0.8)
	var gathered: Array = residues.slice(0, 14)
	for i in range(gathered.size()):
		var f: Object = gathered[i]
		_stream_from(c, w, cx, gy, float(f.x), float(f.y), 14, float(i) * 0.05)
		w.add(FX.Flash.new(f.x, f.y, 8.0, _p("c2"), 0.3, 0.0))
		var lf = f.get("life")
		if lf != null and float(lf) != 0.0:
			f.age = maxf(float(f.age), float(lf) - 1.2)
		else:
			f.dead = true
	var virtual_n: int = maxi(0, 7 - gathered.size())
	for i in range(virtual_n):
		var a: float = (float(i) / 7.0) * M.TAU
		var d: float = 60.0 + M.hash_n(float(i * 3 + int(c.id))) * 70.0
		_stream_from(c, w, cx, gy, cx + V8M.v8_cos(a) * d, gy + V8M.v8_sin(a) * d * 0.85, 14, float(i) * 0.06)
	for i in range(4):
		FX.steam(w, cx + c.rng.range(-18.0, 18.0), gy, 2, 14.0, _p("e2"), _p("c0"), 6.0, {"z": 2.0, "vz": 40.0})
	# immense transparent fluid structures rise around the gathering point
	var cols: Array = []
	for i in range(5):
		var a2: float = (float(i) / 5.0) * M.TAU + 0.3
		var d2: float = 54.0
		var col = Column.new(cx + V8M.v8_cos(a2) * d2, gy + V8M.v8_sin(a2) * d2 * 0.55, 56.0 + float(i % 2) * 14.0, cx, gy - H, float(i) * 1.7, i)
		cols.append(col)
		w.add(col)
	var chamber = Chamber.new(cx, gy, H)
	w.add(chamber)
	var tm: float = 0.0
	var nt: float = 0.5
	var next_deco: float = 0.0
	var gest: int = 0
	var gest_t: float = 0.9
	var circled: bool = false
	var T_SEAL: float = 5.6
	while tm < T_SEAL:
		for i in range(cols.size()):
			var col = cols[i]
			col.gv = M.clampf((tm - 0.5 - float(i) * 0.18) / 0.9, 0.0, 1.0)
			col.merge = M.clampf((tm - 2.4 - float(i) * 0.12) / 1.5, 0.0, 1.0)
			col.cry = M.clampf((tm - 2.2) / 1.6, 0.0, 1.0) * float(i % 2)
		chamber.rad = 40.0 * M.smoothstep(M.clampf((tm - 2.4) / 1.8, 0.0, 1.0))
		chamber.cry = M.clampf((tm - 3.2) / 2.2, 0.0, 1.0) * (1.0 if gest > 0 else 0.4)
		chamber.boil = M.clampf((tm - 3.8) / 1.5, 0.0, 1.0)
		chamber.sep = M.clampf((tm - 3.0) / 1.5, 0.0, 1.0) * 0.8
		# the alchemist glides around the structure, triggering reactions with rapid gestures
		if tm > 1.6 and not circled:
			circled = true
			var pts: Array = []
			var a0: float = V8M.v8_atan2(float(p.y) - gy, float(p.x) - cx)
			for i in range(1, 11):
				pts.append({"x": cx + V8M.v8_cos(a0 + float(i) * 0.55) * 74.0, "y": gy + V8M.v8_sin(a0 + float(i) * 0.55) * 74.0 * 0.6})
			w.glide(pts, 3.6)
		gest_t -= GEN.F
		if tm > 2.4 and gest_t <= 0.0:
			gest_t = 0.62
			gest += 1
			p.cast = 0.25
			p.castMax = 0.25
			p.face = V8M.v8_atan2(chamber.cyc - float(p.y), cx - float(p.x))
			var hp: Array = LIB.hand_pos(w)
			var hx: float = float(hp[0])
			var hy: float = float(hp[1])
			var tx: float = cx + c.rng.range(-18.0, 18.0)
			var ty: float = chamber.cyc + c.rng.range(-18.0, 18.0)
			var air_fn := func(gg, a):
				var L = gg.s
				var n: int = 14
				for k in range(n):
					var u: float = float(k) / float(n)
					if u > a * 1.6 + 0.2:
						break
					L.px(M.js_round(lerpf(hx, tx, u) + V8M.v8_sin(u * 20.0 + gg.t * 30.0) * 2.0), M.js_round(lerpf(hy, ty, u) + V8M.v8_cos(u * 16.0) * 2.0), _p("c3") if k % 2 != 0 else _p("w"))
			var lit_fn := func(gg, a):
				DRAW.glow(gg.l, tx, ty, 10.0, _p("c2"), 0.4 * (1.0 - a), 3)
			w.add(FX.Custom.new(hx, hy, 0.28, {"air": air_fn, "lit": lit_fn}))
			var flash_cols: Array = [_p("y1"), _p("c2"), _p("m2")]
			w.add(FX.Flash.new(tx, ty, 12.0, flash_cols[gest % 3], 0.25, 0.0))
			w.shake(1.5, 0.12)
			if gest % 3 == 0:
				chamber.bright = 0.5
			if gest % 3 == 1:
				FX.drops(w, cx, chamber.cyc - 30.0, 8, 60.0, _p("c1"), _p("c3"), _p("e2"), {"z": 0.0, "up": 60.0, "glow": 1.0})
		chamber.bright = maxf(0.0, chamber.bright - GEN.F * 2.0)
		# enemies beneath are pulled toward the unstable centre
		nt -= GEN.F
		for e in w.enemies:
			if float(e.dying) > 0.0:
				continue
			var ex: float = cx - float(e.x)
			var ey: float = gy - float(e.y)
			var d: float = V8M.v8_hypot(ex, ey)
			if d < 150.0 and d > 6.0 and tm > 0.3:
				var kind_mul: float = 1.0
				if e.kind == "boss":
					kind_mul = 0.2
				elif e.kind == "elite":
					kind_mul = 0.6
				var s: float = (22.0 + minf(1.0, tm / 5.0) * 40.0) * GEN.F * kind_mul
				e.x = float(e.x) + ex / d * s
				e.y = float(e.y) + ey / d * s
			if nt <= 0.0 and d < 120.0 and tm > 0.4 and pullH.ok(e, w.time, 0.45, 6):
				LIB.hit_e(c, e, 20.0, {"kind": "acid", "stag": 0.1, "at": [e.x, e.y]})
				w.mark(e, "corrode", 1.4, 2.0)
		if nt <= 0.0:
			nt = 0.5
		# ground becomes increasingly contaminated
		if tm > next_deco:
			next_deco = tm + 0.3
			var a3: float = c.rng.range(0.0, M.TAU)
			var d3: float = c.rng.range(20.0, 60.0 + tm * 12.0)
			var X: float = cx + V8M.v8_cos(a3) * d3
			var Y: float = gy + V8M.v8_sin(a3) * d3 * 0.8
			if X > 12.0 and X < float(w.W) - 12.0 and Y > 16.0 and Y < float(w.H) - 10.0:
				if c.rng.next() < 0.5:
					w.add(FX.GroundDecal.new(X, Y, "veins", 22.0 + tm * 3.0, 16.0, int(floor(X + Y)), {"a": _p("e0"), "b": _p("e3"), "c": _p("c2")}, 0.0, 1.3))
				else:
					w.add(FX.Pool.new(X, Y, 8.0 + c.rng.range(0.0, 5.0), MATS.MAT()["venom"], 12.0, {"blobs": 3, "boil": 1.4, "resid": false}))
		if int(floor(tm * 60.0)) % 7 == 0 and chamber.rad > 20.0:
			var mx: float = cx + c.rng.range(-40.0, 40.0)
			var my: float = chamber.cyc + c.rng.range(-40.0, 40.0)
			w.parts.add({"k": "mote", "x": mx, "y": my, "z": 0.0, "vz": 10.0, "max": 0.8, "c1": _p("c3"), "c2": _p("c1"), "glow": 1})
		g.y(GEN.F)
		tm += GEN.F
	# the final seal is released: the whole structure compresses into one impossibly bright droplet
	for k in GEN.ticks(0.55):
		chamber.rad = M.lerpf(40.0, 1.5, k * k)
		chamber.bright = k * k
		for cl in cols:
			cl.gv = 0.0
		chamber.cyc = M.lerpf(chamber.cyc, gy - H - 4.0, 0.05)
		w.shock(cx, chamber.cyc, 30.0 + (1.0 - k) * 60.0, 0.15, 1.0)
		if int(floor(k * 60.0)) % 3 == 0:
			var sx: float = cx + c.rng.range(-30.0, 30.0)
			var sy_: float = chamber.cyc + c.rng.range(-30.0, 30.0)
			var fn_spark := func(q):
				var u: float = q.age / q.max
				q.x = lerpf(q.x, cx, u * 0.4)
			w.parts.add({"k": "spark", "x": sx, "y": sy_, "z": 0.0, "vx": 0.0, "vy": 0.0, "vz": 0.0, "max": 0.2, "c1": _p("w"), "fn": fn_spark})
		g.y(GEN.F)
	chamber.rad = 0.5
	w.hitstop = 0.5
	var air_core := func(gg, _a):
		gg.s.disc(cx, chamber.cyc, 1.5, _p("w"))
		gg.s.px(M.js_round(cx), M.js_round(chamber.cyc), _p("c3"))
	var lit_core := func(gg, a):
		DRAW.glow(gg.l, cx, chamber.cyc, 24.0 + a * 10.0, _p("w"), 1.0, 6)
		DRAW.glow(gg.l, cx, chamber.cyc, 50.0, _p("c3"), 0.5, 5)
	w.add(FX.Custom.new(cx, chamber.cyc, 0.5, {"air": air_core, "lit": lit_core}))
	g.y(0.6)
	# multistage catastrophe
	var X0: float = cx
	var Y0: float = gy
	chamber.dead = true
	for cl in cols:
		cl.dead = true
	w.screen_flash(_p("w"), 0.95, 0.4)
	w.shake(14.0, 1.0)
	w.shock(X0, Y0 - 20.0, 190.0, 0.9, 6.0)
	w.hitstop = 0.05
	w.add(FX.Flash.new(X0, Y0 - 36.0, 80.0, _p("w"), 0.6, 0.0))
	LIB.ring_at(c, X0, Y0, 135.0, 0.5, 120.0, {"kind": "burst", "knock": 240.0, "stag": 0.7, "h": A, "cols": [_p("w"), _p("c3"), _p("c1")], "w": 7.0, "dust": true, "fill": true})
	LIB.vis_ring(w, X0, Y0, 80.0, 0.45, [_p("w"), _p("y1"), _p("v2")], 4.0)
	FX.chips(w, X0, Y0 - 30.0, 50, 220.0, _p("i0"), _p("i2"), _p("w"), {"z": 30.0, "up": 200.0, "size": [3.0, 6.0]})
	FX.drops(w, X0, Y0 - 30.0, 80, 220.0, _p("c1"), _p("c3"), _p("c0"), {"z": 30.0, "up": 240.0, "glow": 2.0, "size": [2.0, 5.0], "max": 3.0})
	w.run(_spawn(func(gg): _aftershock_a(gg, c, w, X0, Y0, sheets, cry_h, vap, chamber)))
	w.run(_spawn(func(gg): _fragments(gg, c, w, X0, Y0, frag)))
	g.y(2.2)
	# the alchemist emerges from the receding cloud, surrounded by luminous droplets
	for i in range(16):
		var fn_ring := func(q):
			var a4: float = q.age * 2.0 + float(i) * 0.4
			var r4: float = 9.0 + V8M.v8_sin(q.age * 3.0 + float(i)) * 3.0
			q.x = float(p.x) + V8M.v8_cos(a4) * r4
			q.y = float(p.y) + V8M.v8_sin(a4) * r4 * 0.5
			q.z = 6.0 + V8M.v8_sin(a4 * 1.3) * 4.0 + float(i % 4)
		w.parts.add({"k": "drop", "x": p.x, "y": p.y, "z": 8.0, "vx": 0.0, "vy": 0.0, "vz": 0.0, "max": 3.0, "size": 2, "c1": _p("c1"), "c2": _p("c3"), "c3": _p("e2"), "glow": 1, "fn": fn_ring})
	w.add(FX.Ring.new(p.x, p.y, 22.0, 0.5, {"w": 2.0, "cols": [_p("c3"), _p("c1"), _p("e2")]}))
	# the battlefield keeps reacting: aftershock bursts at the pools
	for i in range(9):
		var pools: Array = []
		for f2 in w.fx:
			if f2.kind == "pool" and not f2.dead:
				pools.append(f2)
		var q2 = null
		if pools.size() > 0:
			q2 = pools[c.rng.int_n(pools.size())]
		var X2: float = float(q2.x) if q2 != null else X0 + c.rng.range(-80.0, 80.0)
		var Y2: float = float(q2.y) if q2 != null else Y0 + c.rng.range(-60.0, 60.0)
		LIB.ring_at(c, X2, Y2, 18.0, 0.2, 20.0, {"kind": "acid", "knock": 80.0, "stag": 0.2, "h": after, "max": 2, "cols": [_p("c3"), _p("c1"), _p("e2")], "w": 2.0})
		FX.drops(w, X2, Y2, 9, 70.0, _p("c1"), _p("c3"), _p("e2"), {"z": 4.0, "up": 100.0, "glow": 1.0})
		w.add(FX.Flash.new(X2, Y2 - 3.0, 10.0, _p("c2"), 0.2, 2.0))
		w.shake(1.5, 0.1)
		FX.steam(w, X2, Y2, 2, 12.0, _p("e2"), _p("c0"), 4.0, {"z": 3.0, "vz": 20.0})
		g.y(0.4)
	g.y(1.2)


static func _aftershock_a(gg, c, w, X0: float, Y0: float, sheets, cry_h, vap, chamber) -> void:
	gg.y(0.15)
	w.shake(8.0, 0.6)
	LIB.ring_at(c, X0, Y0, 230.0, 0.9, 110.0, {"kind": "acid", "knock": 180.0, "stag": 0.5, "h": sheets, "max": 2, "cols": [_p("c3"), _p("c1"), _p("e2")], "w": 12.0, "fill": true, "ease": 1.7})
	w.add(FX.Pool.new(X0, Y0, 62.0, MATS.MAT()["acid"], 12.0, {"blobs": 11, "boil": 3.0, "grow": 0.7}))
	gg.y(0.3)
	LIB.ring_at(c, X0, Y0, 250.0, 1.0, 110.0, {"kind": "acid", "knock": 170.0, "stag": 0.5, "h": sheets, "max": 2, "cols": [_p("y1"), _p("v2"), _p("v0")], "w": 10.0, "fill": true, "ease": 1.7})
	w.shock(X0, Y0, 260.0, 1.0, 4.0)
	# massive crystalline structures erupt and shatter
	var cls: Array = []
	var W: float = float(w.W)
	var H: float = float(w.H)
	for i in range(6):
		var a: float = (float(i) / 6.0) * M.TAU + 0.4
		var d: float = 60.0 + float(i % 2) * 40.0
		var cl = S3O.Cluster.new(M.clampf(X0 + V8M.v8_cos(a) * d, 16.0, W - 16.0), M.clampf(Y0 + V8M.v8_sin(a) * d * 0.8, 40.0, H - 10.0), c.id + i * 5, 1.6)
		cl.g = 0.0
		cls.append(cl)
		w.add(cl)
	for k in GEN.ticks(0.45):
		for cl in cls:
			cl.g = M.smoothstep(k)
			cl.swell = 1.0 + k * 0.4
			cl.fr = k
		gg.y(GEN.F)
	w.shake(9.0, 0.5)
	w.screen_flash(_p("y2"), 0.35, 0.14)
	for cl in cls:
		cl.dead = true
		LIB.ring_at(c, cl.bx, cl.by, 44.0, 0.32, 140.0, {"kind": "crystal", "knock": 190.0, "stag": 0.5, "h": cry_h, "max": 1, "cols": [_p("w"), _p("y1"), _p("v1")], "w": 4.0})
		w.shock(cl.bx, cl.by, 64.0, 0.35, 3.0)
		FX.shards(w, cl.bx, cl.by, 22, 200.0, _p("c3"), _p("v2"), _p("w"), {"z": 14.0, "up": 220.0, "land": 2, "size": [3.0, 9.0]})
		FX.shards(w, cl.bx, cl.by, 10, 130.0, _p("y1"), _p("v0"), _p("y2"), {"z": 8.0, "up": 150.0, "land": 2, "size": [2.0, 5.0]})
		w.add(FX.Flash.new(cl.bx, cl.by - 10.0, 22.0, _p("w"), 0.3, 0.0))
		w.add(FX.GroundDecal.new(cl.bx, cl.by, "cracks", 20.0, 12.0, int(floor(cl.bx)), {"a": _p("k0"), "b": _p("v1"), "c": _p("y1")}, 0.0, 1.0))
	# dense chemical vapour bursts upward
	var big = FX.Cloud.new(X0, Y0, LIB.mk_puffs(c.rng, 22, 80.0, 16.0, 26.0, 8.0, 1.4), MATS.VAP()["green"], 6.5, c.id + 9)
	big.grow = {"from": 0.3, "to": 1.8, "dur": 1.6}
	big.dens = 12.0
	big.tickInfo = {"every": 0.75, "amt": c.d(27.5), "opts": {"kind": "acid", "src": int(c.def["id"])}, "h": vap, "max": 4, "mark": "miasma"}
	w.add(big)
	for i in range(8):
		var a2: float = (float(i) / 8.0) * M.TAU + 0.2
		var d2: float = 30.0 + float(i % 3) * 30.0
		var ramp: Array = MATS.VAP()["pale"] if i % 2 != 0 else MATS.VAP()["green"]
		S2.plume(w, X0 + V8M.v8_cos(a2) * d2, Y0 + V8M.v8_sin(a2) * d2 * 0.7, 62.0 + float(i % 3) * 10.0, 2.2, ramp, 14.0, i, float(i) * 0.06)
	w.add(FX.GroundDecal.new(X0, Y0, "crater", 56.0, 14.0, int(c.id) + 3, {"a": _p("k0"), "b": _p("i2"), "c": _p("c1")}, 0.0, 1.3))
	w.add(FX.GroundDecal.new(X0, Y0, "veins", 104.0, 13.0, int(c.id) + 4, {"a": _p("e0"), "b": _p("e3"), "c": _p("c2")}, 0.0, 1.6))
	w.add(FX.GroundDecal.new(X0, Y0, "scorch", 70.0, 12.0, int(c.id) + 5, {"a": _p("k0"), "b": _p("k3"), "c": _p("c1")}, 0.0, 1.0))


static func _fragments(gg, c, w, X0: float, Y0: float, frag) -> void:
	# thick fluid fragments strike in staggered impacts
	gg.y(0.35)
	for i in range(30):
		var a: float = c.rng.range(0.0, M.TAU)
		var d: float = c.rng.range(30.0, 210.0)
		var lx: float = M.clampf(X0 + V8M.v8_cos(a) * d, 10.0, float(w.W) - 10.0)
		var ly: float = M.clampf(Y0 + V8M.v8_sin(a) * d * 0.7, 18.0, float(w.H) - 8.0)
		var T: float = c.rng.range(0.7, 1.2)
		var vz: float = (T * 280.0 / 2.0) - 40.0 * 0.0 + 60.0
		var draw_fn := func(gq, x, y, _z, s):
			DRAW.ball(gq.s, x, y, 3.2, MATS.PAL()["liquid"])
			gq.s.px(M.js_round(x - 1.0), M.js_round(y - 1.0), _p("w"))
			gq.s.dl = 8
			gq.s.px(M.js_round(x - float(s.vx) * 0.04), M.js_round(y - float(s.vy) * 0.04 + 2.0), _p("c1"))
			gq.s.dl = 16
		var hit_fn := func(ww, s, e):
			if frag.ok(e, ww.time, 0.0, 4):
				LIB.hit_e(c, e, 25.0, {"kind": "acid", "k": 90.0, "from": [s.x, s.y], "stag": 0.3, "at": [e.x, e.y]})
				FX.drops(ww, e.x, e.y, 7, 70.0, _p("c1"), _p("c3"), _p("e2"), {"z": 6.0, "glow": 1.0})
				ww.add(FX.Splash.new(e.x, e.y, 7.0, _p("c1"), _p("c3")))
			return true
		var land_fn := func(ww, s):
			ww.add(FX.Splash.new(s.x, s.y, 8.0, _p("c1"), _p("c3")))
			ww.add(FX.Pool.new(s.x, s.y, 7.0, MATS.MAT()["acid"], 5.0, {"blobs": 3, "boil": 1.4}))
			FX.drops(ww, s.x, s.y, 6, 70.0, _p("c1"), _p("c3"), _p("e2"), {"z": 3.0, "up": 70.0, "glow": 1.0})
			LIB.vis_ring(ww, s.x, s.y, 12.0, 0.2, [_p("c3"), _p("c1"), _p("e2")], 1.0)
			ww.shake(1.5, 0.1)
			for e in ww.enemies:
				if float(e.dying) <= 0.0 and V8M.v8_hypot(float(e.x) - float(s.x), float(e.y) - float(s.y)) < float(e.r) + 8.0 and frag.ok(e, ww.time, 0.0, 4):
					LIB.hit_e(c, e, 25.0, {"kind": "acid", "k": 90.0, "from": [s.x, s.y], "stag": 0.3, "at": [e.x, e.y]})
		w.add(FX.Shot.new(X0, Y0 - 30.0, 40.0, (lx - X0) / T, (ly - Y0) / T, vz, 280.0, 5.0, draw_fn, hit_fn, land_fn, 4.0, 14.0))
		gg.y(0.04)
