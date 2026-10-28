class_name VenomS1
extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s1.ts`
## **Glassfang Hunt** (skill 1) - the `Fang` summon and the `glassfang`
## generator, including every bite, circle, lunge, the shattering finisher, the
## three bubbling acid pools, the embedded glass shards and the enemy-bound
## corrode after-effect.
##
## GENERATOR CONVERSION
## GDScript has no `function*` / `yield`, so `glassfang` is an explicit state
## machine (`Glassfang`) with one state per suspend point. The mapping is
## mechanical and preserves:
##   * the exact yielded wait values (0.05, 0.08, F, 0.6),
##   * the `ticks(sec)` loop counts (round(sec*60) iterations, i/n as k),
##   * the order of every RNG draw (caster rng for the circle angle and the
##     final pool placement, world rng for every particle burst).
## `World.step` resumes it exactly as the original scheduler did.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")

## Segment radii of the glass hunter's body, authored in the original.
const FR: Array = [4.6, 4.0, 4.4, 4.1, 3.6, 3.0, 2.2, 1.4]


# ---------------------------------------------------------------------------
# Fang - the segmented glass predator
# ---------------------------------------------------------------------------

class Fang extends FX.Fx:
	var ch = null
	var z: float = 0.0
	var heading: float = 0.0
	var open: float = 0.2
	var scale: float = 1.0

	func _init(px: float, py: float, ang: float) -> void:
		x = px
		y = py
		heading = ang
		ch = FX.Chain.new(px, py, 8, 4.2, ang)
		kind = "summon"
		sy = py

	func upd(_w, _dt: float) -> void:
		ch.move(x, y)
		sy = y

	func shd(g, _w) -> void:
		var L = g.s
		L.dl = 8
		var i: int = 0
		while i < 8:
			var q: Dictionary = ch.s[i]
			L.ellipse(q["x"], q["y"] + 2, float(FR[i]) * 0.9,
					float(FR[i]) * 0.45, int(M.P["bk"]))
			i += 2
		L.dl = 16

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var s: Array = ch.s
		var n: int = s.size()
		var pts: Array = []
		for i in range(n):
			var q: Dictionary = s[i]
			pts.append({"x": float(q["x"]),
					"y": float(q["y"]) - z - 3 + sin(t * 14 - float(i) * 0.9) * 0.5,
					"r": float(FR[i]) * scale})
		for i in range(1, 5):
			var a: float = atan2(float(s[i - 1]["y"]) - float(s[i]["y"]),
					float(s[i - 1]["x"]) - float(s[i]["x"]))
			var px: float = -sin(a)
			var py: float = cos(a)
			for sd in [-1, 1]:
				var sw: float = sin(t * 20 + float(i) * 1.5 + float(sd) * 1.6) * 2.2
				var bx: float = float(pts[i]["x"]) + px * float(FR[i]) * float(sd)
				var by: float = float(pts[i]["y"]) + py * float(FR[i]) * float(sd) + 1
				var kx: float = bx + px * 3 * float(sd) + cos(a) * sw * 0.5
				var ky: float = by + py * 3 * float(sd) * 0.8 - 1
				var ex: float = bx + px * 4.5 * float(sd) + cos(a) * sw
				var ey: float = by + 3 + py * 2 * float(sd)
				L.line(bx, by, kx, ky, int(M.P["v1"]))
				L.line(kx, ky, ex, ey, int(M.P["v3"]))
		var rev: Array = []
		for i in range(pts.size() - 1, -1, -1):
			rev.append(pts[i])
		DRAW.worm_body(L, rev, MATS.PAL()["glass"], {})
		for i in range(n):
			if i == 2 or i == 4:
				L.disc(float(pts[i]["x"]) + 0.5, float(pts[i]["y"]) + 0.5, 1.3,
						int(M.P["e0"]))
				L.px(float(M.js_round(float(pts[i]["x"]))),
						float(M.js_round(float(pts[i]["y"]))), int(M.P["k0"]))
		var pi: int = int(floor(fmod(t * 11, float(n + 2))))
		for k in range(3):
			var i: int = pi - k
			if i >= 0 and i < n:
				var c: int = int(M.P["c3"])
				if k == 1:
					c = int(M.P["c1"])
				elif k == 2:
					c = int(M.P["c0"])
				L.disc(float(pts[i]["x"]), float(pts[i]["y"]), 1.6 - float(k) * 0.5, c)
		for i in range(1, 6):
			DRAW.shard(L, float(pts[i]["x"]),
					float(pts[i]["y"]) - float(FR[i]) + 0.5,
					-PI / 2 + sin(float(i) + t * 3) * 0.2, 2.8, 0.9,
					int(M.P["y2"]), int(M.P["v2"]), int(M.P["w"]))
		var h: Dictionary = pts[0]
		var a: float = heading
		var fx: float = cos(a)
		var fy: float = sin(a)
		var qx: float = -fy
		var qy: float = fx
		var op: float = open * 0.55 + 0.2
		for sd in [-1, 1]:
			DRAW.shard(L, float(h["x"]) + fx * 3 + qx * float(sd) * 1.2,
					float(h["y"]) + fy * 3 + qy * float(sd) * 1.2,
					a + float(sd) * op, 5.4, 1.4,
					int(M.P["y2"]), int(M.P["v1"]), int(M.P["w"]))
		L.px(float(M.js_round(float(h["x"]) + fx + qx * 1.6)),
				float(M.js_round(float(h["y"]) + fy + qy * 1.6 - 1)), int(M.P["c2"]))
		L.px(float(M.js_round(float(h["x"]) + fx - qx * 1.6)),
				float(M.js_round(float(h["y"]) + fy - qy * 1.6 - 1)), int(M.P["c2"]))

	func lit(g, _w) -> void:
		var h: Dictionary = ch.s[0]
		DRAW.glow(g.l, float(h["x"]), float(h["y"]) - z - 3, 8, int(M.P["c1"]), 0.3, 3)
		var s3: Dictionary = ch.s[3]
		DRAW.glow(g.l, float(s3["x"]), float(s3["y"]) - z - 3, 6, int(M.P["c1"]),
				0.15, 2)


# ---------------------------------------------------------------------------
# Glassfang Hunt - generator converted to a state machine
# ---------------------------------------------------------------------------

class Glassfang extends RefCounted:
	var c = null
	var w = null
	var rng = null

	var tgt = null
	var hx: float = 0.0
	var hy: float = 0.0
	var cx: float = 0.0
	var cy: float = 0.0
	var fang = null
	var pool_hits = null

	# state machine
	var pc: int = 0
	var done: bool = false
	# leap sub-state
	var leap_n: int = 0
	var leap_i: int = 0
	var leap_x0: float = 0.0
	var leap_y0: float = 0.0
	var leap_z0: float = 0.0
	var leap_gx: float = 0.0
	var leap_gy: float = 0.0
	var leap_arc: float = 0.0
	var leap_resume: int = -1
	# loops
	var i: int = 0
	var tick_i: int = 0
	var tick_n: int = 0
	var a_retreat: float = 0.0
	var t0: float = 0.0
	var t1: float = 0.0
	var rr: float = 0.0

	func _init(cast) -> void:
		c = cast
		w = cast.w
		rng = cast.rng

	# --- authored helpers (closures in the original) ---

	func trail(x: float, y: float) -> void:
		w.add(FX.Splash.new(x, y, 4, int(M.P["c1"]), int(M.P["c3"])))
		w.add(FX.Pool.new(x, y, 4, MATS.MAT()["acid"], 0.9,
				{"blobs": 2, "grow": 0.1, "resid": false}))
		FX.shards(w, x, y, 3, 40, int(M.P["v2"]), int(M.P["v1"]), int(M.P["y2"]),
				{"z": 3, "size": [2.0, 3.0], "land": 1})

	func bite(e, pct: float, final: bool = false) -> void:
		var a: float = atan2(e.y - fang.y, e.x - fang.x)
		var px: float = e.x - cos(a) * e.r
		var py: float = e.y - sin(a) * e.r
		LIB.hit_e(c, e, pct, {"kind": "bite", "k": 160.0 if final else 80.0,
				"ang": a, "stag": 0.3, "at": [px, py], "big": final})
		FX.shards(w, px, py, 7, 80, int(M.P["y1"]), int(M.P["v1"]), int(M.P["y2"]),
				{"z": 6, "size": [2.0, 5.0], "ang": a, "spread": 2.8, "land": 3})
		LIB.vis_ring(w, px, py, 10, 0.2, [int(M.P["w"]), int(M.P["y1"]),
				int(M.P["v1"])], 2)
		w.add(FX.Flash.new(px, py, 6, int(M.P["y2"]), 0.14, 6))
		w.shake(3.0 if final else 1.5, 0.14)
		if not final:
			w.mark(e, "crystal", 0.45, 0.4)

	func contact(e, off: float = 0.0) -> Array:
		var a: float = atan2(fang.y - e.y, fang.x - e.x)
		return [e.x + cos(a + off) * (e.r + 3), e.y + sin(a + off) * (e.r + 3)]

	func start_leap(gx: float, gy: float, dur: float, arcH: float, resume: int) -> void:
		leap_x0 = fang.x
		leap_y0 = fang.y
		leap_z0 = fang.z
		leap_gx = gx
		leap_gy = gy
		leap_arc = arcH
		leap_n = LIB.tick_count(dur)
		leap_i = 0
		leap_resume = resume
		trail(leap_x0, leap_y0)
		pc = 100  # S_LEAP

	func alive(e) -> bool:
		return e != null and e.dying <= 0

	# --- resume: run until the next suspend point, return the wait value ---

	func resume():
		if done:
			return null
		match pc:
			0:  # castAnim(w, c); yield 0.05
				LIB.cast_anim(w, c)
				pc = 1
				return 0.05
			1:
				tgt = c.target if c.target != null else w.nearest(c.tx, c.ty, 110)
				var hp: Array = LIB.hand_pos(w)
				hx = float(hp[0])
				hy = float(hp[1])
				var tx: float = tgt.x if tgt != null else c.tx
				var ty: float = tgt.y if tgt != null else c.ty
				c.ang = atan2(ty - hy, tx - hx)
				cx = M.lerpf(hx, tx, 0.55)
				cy = M.lerpf(hy, ty, 0.55)
				LIB.throw_arc(w, "vial", hx, hy, cx, cy, 0.08, 4, func(_ww, _pp): return, 22)
				pc = 2
				return 0.08
			2:
				w.add(FX.Flash.new(cx, cy, 9, int(M.P["c2"]), 0.2, 8))
				FX.shards(w, cx, cy, 9, 80, int(M.P["v2"]), int(M.P["v1"]),
						int(M.P["y2"]), {"z": 8, "size": [2.0, 4.0], "land": 3})
				FX.drops(w, cx, cy, 8, 60, int(M.P["c1"]), int(M.P["c3"]),
						int(M.P["e2"]), {"z": 8, "glow": 2})
				fang = w.add(Fang.new(cx, cy, c.ang))
				fang.z = 8
				fang.open = 1
				pool_hits = FX.Hits.new()
				pc = 3
				# fall straight through to the loop head in the same tick
				return resume()
			3:  # S_LOOP_TOP: pre-leap onto the target, then enter the bite loop
				if tgt != null:
					var g: Array = contact(tgt)
					start_leap(float(g[0]), float(g[1]), 0.1, 10, 4)
					return resume()
				pc = 4
				return resume()
			4:  # for (let i = 0; i < 4; i++)
				if i >= 4:
					pc = 60  # final strike
					return resume()
				if not alive(tgt):
					tgt = w.nearest(fang.x, fang.y, 150)
					if tgt != null:
						var g: Array = contact(tgt)
						start_leap(float(g[0]), float(g[1]), 0.16, 12, 4)
						return resume()
				if tgt == null:
					pc = 60
					return resume()
				pc = 5
				return resume()
			5:  # bite + retreat
				fang.open = 1
				bite(tgt, 30)
				a_retreat = atan2(tgt.y - fang.y, tgt.x - fang.x)
				tick_n = LIB.tick_count(0.12)
				tick_i = 0
				pc = 6
				return resume()
			6:  # for (const k of ticks(0.12)) { ... yield F }
				if tick_i >= tick_n:
					pc = 7
					return resume()
				var k: float = float(tick_i + 1) / float(tick_n)
				fang.x -= cos(a_retreat) * 70 * LIB.F * (1 - k)
				fang.y -= sin(a_retreat) * 70 * LIB.F * (1 - k)
				fang.z = 6 * sin(k * PI)
				fang.open = 0.2
				tick_i += 1
				return LIB.F
			7:
				if not alive(tgt):
					i += 1
					pc = 4
					return resume()
				t0 = atan2(fang.y - tgt.y, fang.x - tgt.x)
				t1 = t0 + rng.sign() * rng.range(1.8, 2.4)
				rr = tgt.r + 13
				tick_n = LIB.tick_count(0.26)
				tick_i = 0
				pc = 8
				return resume()
			8:  # for (const k of ticks(0.26)) { circle; yield F }
				if tick_i >= tick_n:
					var g: Array = contact(tgt, 0)
					start_leap(float(g[0]), float(g[1]), 0.17, 13, 9)
					return resume()
				var k2: float = float(tick_i + 1) / float(tick_n)
				var th: float = M.lerpf(t0, t1, M.smoothstep(k2))
				var rad: float = M.lerpf(
						sqrt(pow(fang.x - tgt.x, 2.0) + pow(fang.y - tgt.y, 2.0)),
						rr, 0.3)
				fang.x = tgt.x + cos(th) * rad
				fang.y = tgt.y + sin(th) * rad
				fang.heading = th + PI + rng.range(-0.1, 0.1) * 0
				fang.open = 0.3
				fang.z = 0
				if int(floor(k2 * 12)) % 4 == 0:
					w.parts.add({"k": "spark", "x": fang.x, "y": fang.y, "z": 2,
							"vx": 0, "vy": 0, "vz": 10, "max": 0.2,
							"c1": int(M.P["c2"])})
				tick_i += 1
				return LIB.F
			9:  # after the lunge: i++ and loop
				i += 1
				pc = 4
				return resume()
			60:  # final strike
				var fin = tgt if alive(tgt) else null
				if fin != null:
					bite(fin, 55, true)
				var fx0: float = fang.x
				var fy0: float = fang.y
				FX.shards(w, fx0, fy0, 11, 105, int(M.P["v2"]), int(M.P["v1"]),
						int(M.P["y2"]), {"z": 6, "size": [5.0, 9.0], "up": 110,
						"land": 2})
				FX.shards(w, fx0, fy0, 6, 70, int(M.P["y1"]), int(M.P["v0"]),
						int(M.P["w"]), {"z": 8, "size": [3.0, 5.0], "up": 90,
						"land": 2})
				FX.drops(w, fx0, fy0, 28, 110, int(M.P["c2"]), int(M.P["c3"]),
						int(M.P["c1"]), {"z": 8, "up": 120, "glow": 2,
						"size": [1.0, 4.0], "max": 1.6})
				w.add(FX.Flash.new(fx0, fy0, 22, int(M.P["c3"]), 0.3, 8))
				LIB.vis_ring(w, fx0, fy0, 34, 0.35,
						[int(M.P["w"]), int(M.P["c2"]), int(M.P["c0"])], 3)
				w.screen_flash(int(M.P["c3"]), 0.25, 0.12)
				w.shock(fx0, fy0, 40, 0.3, 2)
				fang.dead = true
				if fin != null:
					w.mark(fin, "corrode", 2.2, 1)
					var fin_ref = fin
					var up_fn := func(g, a):
						var e = fin_ref
						var L = g.s
						if e == null:
							return
						var ex: float = e.x
						var ey: float = e.y - e.r - 2
						var kk: float = 1 - a
						L.dl = M.js_round(14 * kk + 2)
						L.disc(ex, ey, 6 * kk + 2, int(M.P["c1"]))
						L.dl = M.js_round(10 * kk + 2)
						L.disc(ex - 1, ey - 1, 4 * kk + 1, int(M.P["c3"]))
						L.dl = 16
						for ii in range(5):
							L.px(float(M.js_round(ex - 4 + float(ii) * 2)),
									float(M.js_round(ey + 4 + a * (6 + float(ii) * 3))),
									int(M.P["c2"]))
					var lit_fn := func(g, a):
						DRAW.glow(g.l, fin_ref.x, fin_ref.y - 6, 14 * (1 - a) + 4,
								int(M.P["c2"]), 0.5 * (1 - a), 4)
					w.add(FX.Custom.new(fin.x, fin.y, 0.7,
							{"up": up_fn, "lit": lit_fn}, fin.y + 1))
				for _pi in range(3):
					var a: float = rng.range(0.0, M.TAU)
					var d: float = rng.range(8, 22)
					var px: float = (fin.x if fin != null else fx0) + cos(a) * d
					var py: float = (fin.y if fin != null else fy0) + sin(a) * d * 0.8
					w.add(FX.Pool.new(px, py, 6.5, MATS.MAT()["acid"], 4.2,
							{"boil": 2, "blobs": 3, "tick": {
									"every": 0.7, "amt": c.d(10),
									"opts": {"kind": "acid", "src": int(c.def["id"])},
									"h": pool_hits, "max": 3}}))
					w.add(FX.Embed.new(px + 1, py - 1, 4 + _pi, int(M.P["v2"]),
							int(M.P["v0"]), int(M.P["y2"]), 6))
				pc = 61
				return 0.6
			61:
				done = true
				return null
			100:  # S_LEAP body: for (const k of ticks(dur)) { ...; yield F }
				if leap_i >= leap_n:
					fang.z = 0
					trail(leap_gx, leap_gy)
					pc = leap_resume
					return resume()
				var k3: float = float(leap_i + 1) / float(leap_n)
				fang.x = M.lerpf(leap_x0, leap_gx, k3)
				fang.y = M.lerpf(leap_y0, leap_gy, k3)
				fang.z = M.lerpf(leap_z0, 0, k3) + 4 * leap_arc * k3 * (1 - k3)
				fang.heading = atan2(leap_gy - leap_y0, leap_gx - leap_x0)
				fang.open = 1 if k3 > 0.55 else 0.4
				if leap_i % 3 == 0:
					FX.shards(w, fang.x, fang.y, 1, 20, int(M.P["v2"]),
							int(M.P["v1"]), int(M.P["y2"]),
							{"z": fang.z, "size": [2.0, 3.0], "land": 1})
				leap_i += 1
				return LIB.F
		return null

	func is_valid() -> bool:
		return not done


## Creates the Glassfang Hunt cast, mirroring `def.run(c)` in the original.
static func make(cast) -> Glassfang:
	return Glassfang.new(cast)


# ---------------------------------------------------------------------------
# 02 BLOOMING PARASITE
#
# Ported with `VenomGen`, the thread-backed generator protocol, so the body
# below is a line-by-line translation of the ORIGINAL `function* parasite(c)`
# -- `yield 0.05` becomes `g.y(0.05)` and every `for`/closure keeps the shape
# the author wrote.
# ---------------------------------------------------------------------------

const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")


static func MEMB() -> Dictionary:
	return DRAW.pal(int(M.P["e0"]), int(M.P["e1"]), int(M.P["e2"]),
			int(M.P["c0"]), int(M.P["c2"]))


static func MEMB_MAT() -> Dictionary:
	var m: Dictionary = MATS.MAT()["acid"].duplicate()
	m["dl"] = 12
	m["rim"] = int(M.P["c0"])
	m["ramp"] = [int(M.P["e0"]), int(M.P["e1"]), int(M.P["e2"]),
			int(M.P["e3"]), int(M.P["c0"])]
	m["vw"] = 4
	return m


class Growth extends FX.Fx:
	var g: float = 0.0
	var open_: float = 0.0
	var hm: float = 1.0
	var ign: float = 0.0
	var lean: float = 0.0
	var ph: float = 0.0
	var bx0: float = 0.0
	var by0: float = 0.0
	var start: float = 0.0
	var mw: float = 1.0
	var bx: float = 0.0
	var by: float = 0.0
	var H: float = 0.0

	func _init(bx_: float, by_: float, H_: float, ph_: float,
			start_: float) -> void:
		bx = bx_
		by = by_
		H = H_
		bx0 = bx_
		by0 = by_
		x = bx_
		y = by_
		sy = by_
		ph = ph_
		lean = (M.hash_n(ph_ * 100.0) - 0.5) * 8.0
		start = start_
		kind = "summon"

	func upd(_w, _dt: float) -> void:
		x = bx
		y = by
		sy = by

	func base() -> Dictionary:
		var gr: float = M.smoothstep(g)
		return {"x": bx + lean * gr, "y": 0.0}

	func top() -> Dictionary:
		var gr: float = M.smoothstep(g) * hm
		return {"x": bx + lean * gr, "y": by - H * gr}

	func gnd(gf, _w) -> void:
		var L = gf.s
		var gr: float = M.smoothstep(g)
		if gr < 0.05:
			return
		L.disc(bx, by + 1, 4 * gr + 1, int(M.P["k0"]))
		L.ring(bx, by + 1, 4 * gr + 1, 1, int(M.P["e2"]))
		L.dl = 8
		L.ring(bx, by + 1, 6 * gr + 2, 1, int(M.P["c0"]))
		L.dl = 16

	func up(gf, _w) -> void:
		var L = gf.s
		var t: float = gf.t
		var gr: float = M.smoothstep(g) * hm
		if gr < 0.03:
			return
		var N: int = 8
		var Hh: float = H * gr
		var pts: Array = []
		for i in range(N + 1):
			var u: float = float(i) / float(N)
			var sway: float = sin(t * 1.5 + ph + u * 3) * 2.2 * u
			pts.append({"x": bx + sway + lean * u * gr, "y": by - Hh * u,
					"r": M.lerpf(3.0, 1.6, u) * (0.6 + 0.4 * gr)})
		DRAW.ball(L, bx, by, 4 * gr + 1, VenomS1.MEMB(), 3 * gr + 1)
		var rev: Array = pts.duplicate()
		rev.reverse()
		DRAW.worm_body(L, rev, VenomS1.MEMB(),
				{"stripe": int(M.P["c2"]), "stripeT": t, "spec": false})
		for i in range(1, N, 2):
			var pu: bool = ign > 0 and ign * 8 > float(i)
			L.disc(pts[i]["x"] + 1, pts[i]["y"], 0.9,
					int(M.P["w"]) if pu else int(M.P["c1"]))
			if sin(t * 4 + float(i) + ph) > 0.5 or pu:
				L.px(M.js_round(float(pts[i]["x"]) + 1.0),
						M.js_round(float(pts[i]["y"])), int(M.P["c3"]))
		for s in [-1.0, 1.0]:
			var cx0: float = bx + s * 4
			var cy0: float = by - 1
			L.arc(cx0, cy0 - 2, 3, 1, -1.5 if s > 0 else 1.7,
					1.6 if s > 0 else 4.8, int(M.P["e3"]))
			L.px(M.js_round(cx0 + s * 3), M.js_round(cy0 - 2), int(M.P["c2"]))
		var tp: Dictionary = pts[N]
		var o: float = open_ * gr
		var len_: float = (3.4 + 5.5 * o) * (0.5 + 0.5 * gr)
		var order: Array = []
		for k in range(7):
			order.append({"k": k,
					"a": (float(k) / 7.0) * M.TAU + ph + t * 0.25})
		M.stable_sort(order, func(a, b): return sin(a["a"]) - sin(b["a"]))
		for q in order:
			var a: float = float(q["a"])
			var back: bool = sin(a) < 0
			var ex: float = cos(a) * len_
			var ey: float = sin(a) * len_ * 0.55 - o * 1.6 - (1 if back else 0)
			L.dl = 14
			DRAW.shard(L, tp["x"] + ex * 0.15, tp["y"] + ey * 0.15 - 1,
					atan2(ey, ex), len_, 1.7 + o * 1.4,
					int(M.P["e3"]) if back else int(M.P["c0"]),
					int(M.P["e2"]) if back else int(M.P["e3"]),
					int(M.P["c2"]))
			L.dl = 16
		L.ellipse(tp["x"], tp["y"] - 1, 2 + o * 2, 1 + o * 1.4, int(M.P["k0"]))
		L.px(M.js_round(float(tp["x"])), M.js_round(float(tp["y"]) - 1.0),
				int(M.P["c3"]) if sin(t * 6 + ph) > 0 else int(M.P["c1"]))
		if o > 0.6:
			for i in range(6):
				var aa: float = (float(i) / 6.0) * M.TAU
				L.px(M.js_round(float(tp["x"]) + cos(aa) * (2 + o * 2)),
						M.js_round(float(tp["y"]) - 1.0
								+ sin(aa) * (1 + o * 1.4)), int(M.P["i0"]))

	func lit(gf, _w) -> void:
		var tp: Dictionary = top()
		DRAW.glow(gf.l, tp["x"], tp["y"] - 1, 6 + open_ * 4, int(M.P["c1"]),
				0.2 + ign * 0.5, 3)
		if ign > 0.1:
			DRAW.glow(gf.l, tp["x"], tp["y"] + 2, 10, int(M.P["c3"]),
					ign * 0.4, 3)


## `function* parasite(c)` -- the ORIGINAL Blooming Parasite cast.
static func parasite(c):
	# The body needs its own generator handle to suspend on, and the handle
	# needs the body -- so hand it over through a box filled before the first
	# `resume()` (the body does not run until the scheduler asks for a value).
	var box: Array = []
	var g = GEN.new(func():
		_parasite(c, box[0])
		return null)
	box.append(g)
	return g


static func _parasite(c, g) -> void:
	var w = c.w
	LIB.cast_anim(w, c)
	g.y(0.05)
	var hp: Array = LIB.hand_pos(w)
	var hx: float = float(hp[0])
	var hy: float = float(hp[1])
	var cx: float = c.tx
	var cy: float = c.ty
	var R: float = 62
	LIB.throw_arc(w, "seed", hx, hy, cx, cy, 0.33, 28, func(): return 0, 9)
	g.y(0.33)
	var seedHits = FX.Hits.new()
	var touch = FX.Hits.new()
	var erupt = FX.Hits.new()
	var pulse = FX.Hits.new()
	var inf = FX.Hits.new()
	w.add(FX.Ring.new(cx, cy, 16, 0.2, {
			"w": 2, "cols": [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])],
			"hit": {"h": seedHits, "amt": c.d(15),
					"opts": {"kind": "impact", "src": c.def["id"]},
					"knock": 70, "stagger": 0.25}}))
	w.add(FX.Flash.new(cx, cy, 10, int(M.P["c2"]), 0.25))
	FX.dust(w, cx, cy, 6, 18, 3)
	w.shake(1.5, 0.15)
	# seed halves split, pale shell with glowing cells
	var _cast_shell := func(gf, a):
		var L = gf.s
		var k: float = M.smoothstep(a * 1.6)
		for s in [-1.0, 1.0]:
			DRAW.ball(L, cx + s * (1 + k * 5), cy - 2 - sin(k * 3) * 2,
					2.6 - k * 0.6, MATS.PAL()["seed"], 3.2)
		L.dl = M.js_round(16 * (1 - a))
		L.disc(cx, cy - 3, 2 + k * 5, int(M.P["c1"]))
		L.disc(cx, cy - 3, 1 + k * 3, int(M.P["c3"]))
		L.dl = 16
	w.add(FX.Custom.new(cx, cy, 0.7, {
			"up": _cast_shell,
			"lit": func(gf, a): DRAW.glow(gf.l, cx, cy - 3, 14,
					int(M.P["c2"]), 0.5 * (1 - a), 4)}, cy + 3))
	var growths: Array = []
	var spots: Array = [[0.0, 0.0, 40]]
	for i in range(6):
		var a: float = (float(i) / 6.0) * M.TAU + 0.4
		var d: float = 26 + M.hash_n(float(i) * 3.0 + float(c.id)) * 26
		spots.append([cos(a) * d, sin(a) * d * 0.85,
				26 + M.hash_n(float(i)) * 8])
	# hoisted before the membrane effect the way the original's `const startT`
	# is: the closure only reads it at draw time, never at construction.
	var startT: float = w.time
	for i in range(spots.size()):
		var sp: Array = spots[i]
		var gr = Growth.new(
				M.clampf(float(sp[0]) + cx, 10, w.W - 10),
				M.clampf(float(sp[1]) + cy, 14, w.H - 10),
				float(sp[2]), float(i) * 1.7 + 0.5, 0.05 + float(i) * 0.16)
		growths.append(gr)
		w.add(gr)
	# translucent mycelial membrane connecting the colony
	var _memb := func(gf):
		var f = gf.f
		f.reset()
		var k: float = M.smoothstep(
				(gf.t - startT) / 1.2 if gf.t - startT > 0 else 0.0)
		f.disc(cx, cy, 15 * k, 0.2)
		for gr in growths:
			f.capsule(cx, cy, gr.bx, gr.by + 1, 2.4 * k, 3 * k)
			f.disc(gr.bx, gr.by + 1,
					(7 + 2 * sin(gf.t * 2 + gr.ph)) * M.smoothstep(gr.g) * gr.mw,
					0.2)
		f.shade(gf.s, MEMB_MAT(), gf.t, {"seed": 3})
	var mem = w.add(FX.Custom.new(cx, cy, 8, {"gnd": _memb}))
	w.add(FX.GroundDecal.new(cx, cy, "veins", 46, 7.2, c.id,
			{"a": int(M.P["e0"]), "b": int(M.P["e3"]), "c": int(M.P["c2"])},
			0, 0.8))
	var spore_fn := func(cxx, cyy):
		return func(p, _w, dt):
			var dx: float = p.x - cxx
			var dy: float = p.y - cyy
			var d: float = sqrt(dx * dx + dy * dy)
			if d == 0.0:
				d = 1.0
			var sw: float = 24 + (p.seed % 7) * 2
			p.vx += ((-dy / d) * sw - p.vx) * dt * 2.2 \
					+ ((R * 0.7 - d) / R) * (dx / d) * 20 * dt
			p.vy += ((dx / d) * sw * 0.8 - p.vy) * dt * 2.2 \
					+ ((R * 0.7 - d) / R) * (dy / d) * 14 * dt
			p.vz += ((8 + (p.seed % 5) * 2 - p.z) * 3 - p.vz) * dt
	var nextE: Array = []
	var lash: Array = []
	for i in range(growths.size()):
		nextE.append(1.1 + float(i) * 0.4)
		lash.append(0.0)
	var lash_fx := func(gr, e):
		w.add(FX.Custom.new(gr.bx, gr.by, 0.34, {
				"up": func(gf, a):
					var L = gf.s
					var tp: Dictionary = gr.top()
					var ex: float = e.x
					var ey: float = e.y - e.r
					var k: float = minf(1.0, a * 3)
					var pts: Array = []
					for i in range(9):
						var u: float = float(i) / 8.0 * k
						var wob: float = sin(u * 9 + gf.t * 25) * (1 - a) * 3 \
								* sin(u * PI)
						pts.append({"x": M.lerpf(float(tp["x"]), ex, u)
										- (ey - float(tp["y"])) * 0.0 + wob * 0.3,
								"y": M.lerpf(float(tp["y"]), ey, u) + wob,
								"r": M.lerpf(1.8, 1.0, float(i) / 8.0)})
					DRAW.worm_body(L, pts, VenomS1.MEMB(), {"spec": false})
					L.disc(pts[8]["x"], pts[8]["y"], 1.8, int(M.P["c1"]))
					L.px(M.js_round(float(pts[8]["x"])),
							M.js_round(float(pts[8]["y"])), int(M.P["c3"]))},
				e.y + 2))
	var tm: float = 0.0
	var T_PULSE: float = 5.4
	while tm < T_PULSE:
		for i in range(growths.size()):
			var gr = growths[i]
			gr.g = M.clampf((tm - gr.start) / 0.7, 0.0, 1.0)
			gr.open_ = 0.5 + 0.5 * sin(tm * 2.4 + gr.ph) if gr.g > 0.6 \
					else gr.g * 0.5
			if gr.g > 0.8 and int(floor(tm * 60.0)) % 6 == i % 6 \
					and gr.open_ > 0.6:
				var tp: Dictionary = gr.top()
				for k in range(2):
					w.parts.add({"k": "spore",
							"x": float(tp["x"]) + c.rng.range(-2, 2),
							"y": float(tp["y"]) + 3, "z": 4,
							"vx": c.rng.range(-8, 8),
							"vy": c.rng.range(-4, 4), "vz": 10,
							"max": c.rng.range(1.6, 2.6),
							"c1": int(M.P["c1"]), "c2": int(M.P["e3"]),
							"size": k, "glow": 2, "fn": spore_fn.call(cx, cy)})
			lash[i] = float(lash[i]) - GEN.F
			if gr.g > 0.85 and float(lash[i]) <= 0:
				var best = null
				var bd: float = 40
				for e in w.enemies:
					if e.dying > 0:
						continue
					var d: float = sqrt(pow(e.x - gr.bx, 2.0)
							+ pow(e.y - gr.by, 2.0)) - e.r
					if d < bd and touch.n(e) < 3:
						bd = d
						best = e
				if best != null:
					lash[i] = 0.8
					if touch.ok(best, w.time, 0.4, 3):
						LIB.hit_e(c, best, 15, {"kind": "pierce", "k": 40,
								"from": [gr.bx, gr.by], "stag": 0.22,
								"at": [best.x, best.y - best.r]})
						lash_fx.call(gr, best)
						w.mark(best, "infect", 4.2, 1.0)
						if inf.ok(best, w.time):
							w.poison(best, c.d(55), 3.5, c.id, c.def["id"])
			if gr.g > 0.9 and tm >= float(nextE[i]):
				nextE[i] = float(nextE[i]) + 2.2
				LIB.ring_at(c, gr.bx, gr.by, 17, 0.22, 25,
						{"kind": "impact", "knock": 90, "stag": 0.3,
								"h": erupt, "max": 2,
								"cols": [int(M.P["c3"]), int(M.P["c1"]),
										int(M.P["e2"])], "w": 2})
				FX.drops(w, gr.bx, gr.by, 9, 60, int(M.P["c1"]),
						int(M.P["c3"]), int(M.P["e2"]),
						{"z": 4, "up": 90, "glow": 2})
				FX.steam(w, gr.bx, gr.by, 3, 14, int(M.P["e2"]),
						int(M.P["c0"]), 4)
				w.shake(1, 0.1)
		tm += GEN.F
		g.y(GEN.F)
	# contraction: cells ignite in sequence
	for k in GEN.ticks(0.75):
		for i in range(growths.size()):
			var gr = growths[i]
			gr.hm = M.lerpf(1.0, 0.45, M.smoothstep(k))
			gr.bx = M.lerpf(gr.bx0, cx, M.smoothstep(k) * 0.55)
			gr.by = M.lerpf(gr.by0, cy, M.smoothstep(k) * 0.55)
			gr.ign = M.clampf(k * 1.8 - float(i) * 0.13, 0.0, 1.0)
			gr.open_ = M.lerpf(gr.open_, 0.0, 0.1)
			gr.mw = 1 - M.smoothstep(k) * 0.2
		if int(floor(k * 60.0)) % 5 == 0:
			w.parts.add({"k": "spark", "x": cx + c.rng.range(-20, 20),
					"y": cy + c.rng.range(-10, 10), "z": c.rng.range(2, 20),
					"vx": 0, "vy": 0, "vz": 0, "max": 0.2,
					"c1": int(M.P["c3"])})
		g.y(GEN.F)
	# pulse + rupture
	w.add(FX.Flash.new(cx, cy, 36, int(M.P["c3"]), 0.4, 8))
	w.screen_flash(int(M.P["c2"]), 0.4, 0.18)
	w.shake(5, 0.4)
	w.shock(cx, cy, R + 24, 0.5, 3)
	LIB.ring_at(c, cx, cy, R + 14, 0.38, 100, {"kind": "burst", "knock": 150,
			"stag": 0.4, "h": pulse,
			"cols": [int(M.P["w"]), int(M.P["c1"]), int(M.P["e2"])],
			"w": 4, "dust": true})
	LIB.vis_ring(w, cx, cy, R * 0.6, 0.3,
			[int(M.P["c3"]), int(M.P["c0"]), int(M.P["e2"])], 3)
	for gr in growths:
		var tp: Dictionary = gr.top()
		gr.dead = true
		for i in range(9):
			var a: float = c.rng.range(0, M.TAU)
			var sp: float = c.rng.range(30, 100)
			w.parts.add({"k": "petal", "x": float(tp["x"]),
					"y": float(tp["y"]), "z": 14, "vx": cos(a) * sp,
					"vy": sin(a) * sp * 0.7, "vz": c.rng.range(30, 110),
					"grav": 70, "drag": 1.1, "size": c.rng.range(2, 4),
					"rot": c.rng.range(0, M.TAU), "vr": c.rng.range(-8, 8),
					"c1": int(M.P["g2"]) if i % 3 == 0 else int(M.P["c0"]),
					"c2": int(M.P["c3"]), "max": 1.9,
					"fn": func(p, _w, _dt):
						if p.z < 0:
							p.z = 0
							p.vz = 0
							p.vx *= 0.9
							p.vy *= 0.9})
		FX.chips(w, float(tp["x"]), float(tp["y"]), 5, 90, int(M.P["e2"]),
				int(M.P["e0"]), int(M.P["c1"]), {"z": 10, "up": 100,
						"size": [2, 4]})
		FX.chips(w, gr.bx, gr.by, 2, 60, int(M.P["i1"]), int(M.P["i3"]),
				int(M.P["i0"]), {"z": 4})
		FX.drops(w, gr.bx, gr.by, 8, 70, int(M.P["c1"]), int(M.P["c3"]),
				int(M.P["e2"]), {"z": 6, "glow": 2, "up": 100})
	# structured toxic cloud: three spiral arms
	for arm in range(3):
		for i in range(30):
			var a0: float = (float(arm) / 3.0) * M.TAU
			var d0: float = float(i) * 0.045
			w.parts.add({"k": "spore", "x": cx, "y": cy, "z": 6,
					"max": 1.9 + d0,
					"c1": int(M.P["c3"]) if i % 4 == 0 else int(M.P["c1"]),
					"c2": int(M.P["e3"]), "size": 2 if i % 6 == 0 else 1,
					"glow": 2, "seed": i,
					"fn": func(p, _w, _dt):
						var a: float = p.age
						var r: float = 6 + a * 58 + float(i) * 0.7
						var an: float = a0 + a * 2.1 + float(i) * 0.1 - d0
						p.x = cx + cos(an) * r
						p.y = cy + sin(an) * r * 0.85
						p.z = 5 + sin(a * 5 + float(i)) * 3 + a * 6})
	var cl = FX.Cloud.new(cx, cy,
			LIB.mk_puffs(c.rng, 9, 24, 10, 17, 6, 1.4),
			MATS.VAP()["pale"], 2.4, c.id)
	cl.grow = {"from": 0.4, "to": 1.6, "dur": 1.2}
	cl.dens = 9
	w.add(cl)
	g.y(1.2)


# ---------------------------------------------------------------------------
# 03 LEECHWATER RUSH
# ---------------------------------------------------------------------------


## Closure factories for the leech water callbacks.
##
## GDScript gives a lambda one slot per captured variable, so a closure created
## inside a `for` loop that captures the loop's own locals can end up reading
## the LAST iteration's values. Every per-iteration closure here is built by a
## factory instead, so each one gets its own scope holding its own values.
static func _mote_fn(sx: float, sy: float, off: float, delay: float, p):
	return func(q, _w, _dt):
		var u: float = M.clampf((q.age - delay) / 0.6, 0, 1)
		var px: float = M.lerpf(sx, p.x, u) + sin(u * PI) * off * 0.6
		var py: float = M.lerpf(sy, p.y - 6, u) - sin(u * PI) * 14 \
				+ sin(u * PI) * off * 0.2
		q.x = px
		q.y = py
		if u >= 1:
			q.age = q.max


static func _leech_crawl_up(e, i: int, a: float, sx: float, sy: float):
	return func(gf, a2):
		var L = gf.s
		var u: float = M.smoothstep(a2)
		var X: float = M.lerpf(sx, e.x + cos(float(i) * 2.4 + 1) * e.r * 0.85, u)
		var Y: float = M.lerpf(sy, e.y - e.r * 0.8 + sin(float(i) * 2.4 + 1) * 4, u) \
				- sin(u * PI) * 5
		DRAW.worm_body(L, [{"x": X, "y": Y, "r": 1.5},
				{"x": X - cos(a) * 2,
						"y": Y - sin(a) * 1.5 + sin(gf.t * 30) * 0.8, "r": 1.4},
				{"x": X - cos(a) * 4, "y": Y - sin(a) * 3, "r": 1}],
				MATS.PAL()["leech"], {"spec": false})
		L.px(M.js_round(X), M.js_round(Y), int(M.P["m2"]))


static func _leech_regroup_up(i: int, sx: float, sy: float, mcx: float,
		mcy: float):
	return func(gf, a):
		var L = gf.s
		var u: float = M.smoothstep(a)
		var X: float = M.lerpf(sx, mcx, u) + sin(u * 6 + float(i)) * 4
		var Y: float = M.lerpf(sy, mcy - 8, u) - sin(u * PI) * 16
		DRAW.worm_body(L, [{"x": X, "y": Y, "r": 1.4},
				{"x": X - 2, "y": Y + 1, "r": 1.3},
				{"x": X - 4, "y": Y + 1.5, "r": 1}],
				MATS.PAL()["leech"], {"spec": false})
		L.px(M.js_round(X), M.js_round(Y), int(M.P["m2"]))


## `function* leechwater(c)` -- the ORIGINAL Leechwater Rush cast.
static func leechwater(c):
	var box: Array = []
	var g = GEN.new(func():
		_leechwater(c, box[0])
		return null)
	box.append(g)
	return g


static func _leechwater(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c, true, 0.4)
	var ox: float = p.x
	var oy: float = p.y
	var dirx: float = cos(c.ang)
	var diry: float = sin(c.ang)
	var R: float = 150
	var half: float = 0.62
	g.y(0.03)
	w.glide([{"x": ox + dirx * 66, "y": oy + diry * 66}], 0.42)
	var lanes: int = 5
	var lane_ang: Array = []
	for i in range(lanes):
		lane_ang.append(c.ang + (float(i) / float(lanes - 1) - 0.5) * 2 * half * 0.85)
	var start: float = w.time
	var front := func() -> float:
		return minf(R, (w.time - start) * 440 + 14)
	var lane_at := func(i: int, s: float, t: float) -> Dictionary:
		var a: float = float(lane_ang[i]) + sin(s * 0.045 + float(i) * 1.7 + t * 1.2) * 0.1
		return {"x": ox + cos(a) * s + dirx * 6,
				"y": oy + sin(a) * s * 0.96 + diry * 6, "a": a}
	var orgs: Array = []
	for i in range(260):
		orgs.append({"l": i % lanes, "k": int(floor(float(i) / float(lanes))) % 7,
				"ph": M.hash_n(float(i) * 3.0 + float(c.id)) * M.TAU,
				"rs": 2 + M.hash_n(float(i)) * 7,
				"rn": 1 + M.hash_n(float(i) * 5.0) * 3.2,
				"sp": 4 + M.hash_n(float(i) * 7.0) * 5})
	# `mass` is assigned long after the closures that read it are created, so it
	# lives in a box: a captured local would otherwise stay at its captured value.
	var mass_box: Array = [null]
	var contact = FX.Hits.new()
	var drain = FX.Hits.new()
	var burst = FX.Hits.new()
	var attached: Dictionary = {}
	var _sw_gnd := func(gf, _a, f):
		var L = gf.s
		var fr: float = front.call()
		var t: float = gf.t - start
		var fld = gf.f
		var mass = mass_box[0]
		fld.reset()
		for i in range(lanes):
			var prev: Dictionary = lane_at.call(i, 4, t)
			var s: int = 10
			while s <= fr:
				var q: Dictionary = lane_at.call(i, float(s), t)
				var wd: float = (4.2 + 2.6 * sin(float(s) * 0.06 + float(i))) \
						* M.clampf((fr - float(s)) / 12 + 0.5, 0.4, 1) \
						* (maxf(0.0, 1 - mass["k"]) if mass != null else 1.0)
				fld.capsule(prev["x"], prev["y"], q["x"], q["y"], wd, wd)
				prev = q
				s += 8
		fld.disc(ox + dirx * 8, oy + diry * 8,
				6 * ((1 - mass["k"]) if mass != null else 1.0), 0.2)
		fld.shade(L, MATS.MAT()["leech"], gf.t, {"fx": 14, "fy": 3, "seed": 5})
		var fade: float = M.clampf((6.5 - f.age) / 0.9, 0, 1) if f.age > 5.6 else 1
		for o in orgs:
			if mass != null and mass["mode"] > 0:
				continue
			var s0: float = (float(o["k"]) / 7.0) * R \
					+ fmod(t * 40 + float(o["k"]) * 31, R * 0.9) * 0.5
			var sc: float = fmod(s0 + sin(t * 2 + float(o["k"])) * 5, R)
			var ang: float = float(o["ph"]) + t * float(o["sp"]) * 0.5
			var sp: float = M.clampf(sc + cos(ang) * float(o["rs"]), 4, fr)
			var q2: Dictionary = lane_at.call(int(o["l"]), sp, t)
			var nx: float = -sin(float(q2["a"]))
			var ny: float = cos(float(q2["a"]))
			if sp > fr - 1:
				continue
			var X: float = M.js_round(float(q2["x"]) + nx * sin(ang) * float(o["rn"]))
			var Y: float = M.js_round(float(q2["y"]) + ny * sin(ang) * float(o["rn"]))
			if M.hash_n(floor(float(o["ph"]) * 100.0) + f.age * 0) > fade:
				continue
			var bright: bool = sin(t * 7 + float(o["ph"]) * 3) > 0.45
			L.px(X, Y, int(M.P["w"]) if bright else (int(M.P["y2"]) if int(o["k"]) % 3 == 0 else int(M.P["y1"])))
			if int(o["k"]) % 2 == 0:
				L.dl = 9
				L.px(M.js_round(X - cos(float(q2["a"]))),
						M.js_round(Y - sin(float(q2["a"]))), int(M.P["y0"]))
				L.dl = 16
	var _sw_lit := func(gf):
		var fr2: float = front.call()
		for i in range(lanes):
			var s2: int = 14
			while s2 < fr2:
				var q3: Dictionary = lane_at.call(i, float(s2), gf.t - start)
				DRAW.glow(gf.l, q3["x"], q3["y"], 6, int(M.P["y0"]), 0.1, 2)
				s2 += 22
	var sw = w.add(FX.Custom.new(ox, oy, 6.5, {"gnd": _sw_gnd, "lit": _sw_lit}))
	var life_stream := func(e):
		for i in range(4):
			var sx: float = e.x + c.rng.range(-3, 3)
			var sy: float = e.y - e.r * 0.8
			var off: float = c.rng.range(-26, 26)
			var delay: float = float(i) * 0.04
			w.parts.add({"k": "mote", "x": sx, "y": sy, "z": 0,
					"max": 0.65 + delay,
					"c1": int(M.P["m2"]) if i % 2 != 0 else int(M.P["c2"]),
					"c2": int(M.P["m1"]), "glow": 2,
					"fn": _mote_fn(sx, sy, off, delay, p)})
	var regroup: bool = false
	var mcx: float = ox + dirx * 98
	var mcy: float = oy + diry * 98
	var leech_on := func(e):
		# organisms transform into leech forms that crawl up and attach
		for i in range(4):
			var a: float = float(i) * 1.7 + M.hash_n(float(e.id)) * 6
			var sx: float = e.x + cos(a) * 18
			var sy: float = e.y + sin(a) * 12
			w.add(FX.Custom.new(sx, sy, 0.38,
					{"up": _leech_crawl_up(e, i, a, sx, sy)}, e.y + 2))
	var tm: float = 0.0
	while tm < 2.9:
		var fr: float = front.call()
		for e in w.enemies:
			if e.dying > 0 or attached.has(e.id):
				continue
			var dx: float = e.x - ox
			var dy: float = e.y - oy
			var d: float = sqrt(dx * dx + dy * dy)
			if d - e.r > fr:
				continue
			var da: float = absf(M.ang_diff(c.ang, atan2(dy, dx)))
			da = maxf(0.0, da - asin(minf(1.0, e.r / maxf(d, e.r + 1))))
			if d > e.r + 4 and da > half:
				continue
			if contact.ok(e, w.time):
				LIB.hit_e(c, e, 50, {"kind": "bite", "k": 60,
						"from": [ox, oy], "stag": 0.25})
				attached[e.id] = w.time
				w.mark(e, "leech", 3.0, 4.0)
				w.mark(e, "infect", 3.0, 1.0)
				leech_on.call(e)
				FX.drops(w, e.x, e.y, 5, 40, int(M.P["y1"]), int(M.P["y2"]),
						int(M.P["n3"]), {"z": 4, "glow": 1})
		for e in w.enemies:
			if not attached.has(e.id) or e.dying > 0:
				continue
			var t0: float = float(attached[e.id])
			var k: int = int(floor((w.time - t0 - 0.35) / 0.4))
			if k >= 0 and k < 6 and drain.ok(e, w.time, 0.38, 6):
				LIB.hit_e(c, e, 15, {"kind": "bite", "heal": 0.15, "stag": 0.05,
						"at": [e.x, e.y - e.r]})
				life_stream.call(e)
				w.mark(e, "leech", 1.0, 4.0)
		if tm > 2.45 and not regroup:
			regroup = true
			mass_box[0] = {"x": mcx, "y": mcy, "mode": 0, "k": 0}
			w.add(FX.Pool.new(mcx, mcy, 16, MATS.MAT()["leech"], 1.7,
					{"grow": 0.5, "blobs": 4, "resid": false}))
			for e in w.enemies:
				if e.st.has("leech"):
					var sx: float = e.x
					var sy: float = e.y - e.r
					e.st.erase("leech")
					e.st.erase("infect")
					for i in range(3):
						w.add(FX.Custom.new(sx, sy, 0.55,
								{"up": _leech_regroup_up(i, sx, sy, mcx, mcy)},
								sy))
		if mass_box[0] != null:
			mass_box[0]["k"] = M.clampf((tm - 2.45) / 0.9, 0, 1.4)
		tm += GEN.F
		g.y(GEN.F)
	# regrouped twisting mass -> violent collapse
	if mass_box[0] != null:
		w.add(FX.Custom.new(mcx, mcy, 0.85, {
				"up": func(gf, a):
					var L = gf.s
					var t: float = gf.t
					var pts: Array = []
					for i in range(26):
						var u: float = float(i) / 25.0
						var an: float = u * M.TAU * 2.6 + t * 9
						var rad: float = (3 + 9 * sin(u * PI)) * (1 - a * 0.3)
						pts.append({"x": mcx + cos(an) * rad,
								"y": mcy - 4 - u * 26 + sin(an) * rad * 0.4,
								"r": 2.2 + sin(u * PI) * 2})
					DRAW.worm_body(L, pts, MATS.PAL()["leech"],
							{"stripe": int(M.P["y1"]), "stripeT": t})
					for i in range(24):
						var an2: float = float(i) * 0.9 + t * 6
						var rd: float = 8 + (i % 5) * 2.2
						L.px(M.js_round(mcx + cos(an2) * rd),
								M.js_round(mcy - 6 - fmod(float(i) * 1.2, 24)
										+ sin(an2) * rd * 0.4),
								int(M.P["y1"]) if i % 3 != 0 else int(M.P["w"])),
				"lit": func(gf, a): DRAW.glow(gf.l, mcx, mcy - 14, 14 + a * 6,
						int(M.P["y0"]), 0.3, 4)}, mcy + 4))
	g.y(0.85)
	w.screen_flash(int(M.P["y2"]), 0.45, 0.2)
	w.shake(5, 0.35)
	w.shock(mcx, mcy, 70, 0.4, 3)
	LIB.ring_at(c, mcx, mcy, 62, 0.34, 55, {"kind": "burst", "knock": 150,
			"stag": 0.4, "h": burst,
			"cols": [int(M.P["y2"]), int(M.P["y0"]), int(M.P["n2"])], "w": 4})
	w.add(FX.Flash.new(mcx, mcy, 30, int(M.P["y2"]), 0.35, 10))
	w.add(FX.Pool.new(mcx, mcy, 26, MATS.MAT()["leech"], 3.4,
			{"blobs": 6, "boil": 1.5, "grow": 0.25}))
	FX.drops(w, mcx, mcy, 36, 130, int(M.P["n3"]), int(M.P["y1"]),
			int(M.P["k1"]), {"z": 8, "up": 130, "size": [2, 4]})
	FX.shards(w, mcx, mcy, 14, 120, int(M.P["m1"]), int(M.P["n1"]),
			int(M.P["m2"]), {"z": 10, "up": 120, "size": [3, 6], "land": 1})
	for i in range(8):
		var a: float = (float(i) / 8.0) * M.TAU
		w.add(FX.Splash.new(mcx + cos(a) * 30, mcy + sin(a) * 26, 6,
				int(M.P["y1"]), int(M.P["y2"])))
	w.add(FX.GroundDecal.new(mcx, mcy, "pits", 30, 3.5, c.id,
			{"a": int(M.P["k0"]), "b": int(M.P["n3"]), "c": int(M.P["y1"])}, 0, 1))
	for e in w.enemies:
		e.st.erase("leech")
		e.st.erase("infect")
	g.y(0.6)


# ---------------------------------------------------------------------------
# 04 PORCELAIN BASTION
# ---------------------------------------------------------------------------

class Bastion extends FX.Fx:
	var z: float = 0.0
	var face: float = 0.0
	var fr: float = 0.0
	var swell: float = 0.0
	var asm: float = 0.0
	var leg: Array = []
	var slam: float = -1.0
	var slamLeg: int = 0
	var spawnK: float = 0.0
	var shake: float = 0.0
	var plateOff: float = 0.0
	var maxLife: float = 10.0

	func _init(px: float, py: float, max_life: float) -> void:
		x = px
		y = py
		r = 17
		push = true
		tank = true
		hp = 760
		maxHp = 760
		kind = "summon"
		sy = py
		maxLife = max_life
		for i in range(4):
			var sx: float = 1 if i % 2 != 0 else -1
			var syy: float = -1 if i < 2 else 1
			leg.append({"x": x + sx * 22, "y": y + syy * 14,
					"fx": sx * 22, "fy": syy * 14, "st": 1, "lift": 0})

	func upd(_w, _dt: float) -> void:
		sy = y

	func hurt(_w, amt: float) -> void:
		hp -= amt
		hf = 0.12

	func leg_pos(i: int) -> Array:
		var l: Dictionary = leg[i]
		var ca: float = cos(face)
		var sa: float = sin(face)
		return [x + float(l["fx"]) * ca - float(l["fy"]) * sa,
				y + float(l["fx"]) * sa + float(l["fy"]) * ca]

	func shd(g, _w) -> void:
		var L = g.s
		L.dl = 9
		L.ellipse(x + 3, y + 7, 27 * asm, 12 * asm, int(M.P["bk"]))
		L.dl = 16

	func gnd(g, _w) -> void:
		if asm < 1:
			return
		var L = g.s
		L.dl = 6
		L.ellipse(x, y + 4, 24, 10, int(M.P["k0"]))
		L.dl = 16

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var asmb: float = asm
		if asmb <= 0:
			return
		var sh: float = sin(t * 90) * shake if shake > 0 else 0
		var bx: float = x + sh
		var by: float = y - 12 - z + (1 - asmb) * 16
		var frb: float = fr
		var hurt_: bool = hf > 0
		for i in range(4):
			var l: Dictionary = leg[i]
			var lp: Array = leg_pos(i)
			var tx: float = float(lp[0])
			var ty: float = float(lp[1])
			var ca: float = cos(face)
			var sa: float = sin(face)
			var sx: float = 1 if i % 2 != 0 else -1
			var hx: float = bx + (sx * 11) * ca - ((1 if i >= 2 else -1) * 7) * sa
			var hy: float = by + 4 + ((1 if i >= 2 else -1) * 7) * ca * 0.5
			var fyy: float = ty - (sin(float(l["lift"]) * PI) * (16 if (i == slamLeg and slam >= 0) else 9) if float(l["lift"]) > 0 else 0)
			var fxx: float = tx
			var kx: float = (hx + fxx) / 2 + sx * 5
			var ky: float = minf(hy, fyy) - 6
			L.line(hx, hy, kx, ky, int(M.P["k0"]), 5)
			L.line(kx, ky, fxx, fyy, int(M.P["k0"]), 5)
			L.line(hx, hy, kx, ky, int(M.P["i1"]), 3)
			L.line(kx, ky, fxx, fyy, int(M.P["i2"]), 3)
			L.line(hx - 1, hy - 1, kx - 1, ky - 1, int(M.P["i0"]))
			DRAW.ball(L, kx, ky, 2.4, MATS.PAL()["copper"])
			DRAW.ball(L, fxx, fyy, 3, MATS.PAL()["cer"], 2)
			L.px(M.js_round(fxx - 1), M.js_round(fyy - 1), int(M.P["w"]))
		# body: layered ceramic plates around a transparent reservoir
		var spread: float = frb * 3 + plateOff
		var cer: Dictionary = MATS.PAL()["cer"]
		if hurt_:
			cer = cer.duplicate()
			cer["b"] = int(M.P["w"])
		DRAW.ball(L, bx, by + 2, 16, cer, 10)
		for i in range(7):
			var a: float = (float(i) / 7.0) * M.TAU + 0.3
			var qx: float = bx + cos(a) * (10 + spread)
			var qy: float = by + 1 + sin(a) * (6 + spread * 0.6)
			L.poly([bx + cos(a - 0.35) * 5, by + sin(a - 0.35) * 3,
					qx + cos(a - 0.3) * 4, qy + sin(a - 0.3) * 3,
					qx + cos(a + 0.3) * 4, qy + sin(a + 0.3) * 3,
					bx + cos(a + 0.35) * 5, by + sin(a + 0.35) * 3],
					int(M.P["i0"]) if i % 2 != 0 else int(M.P["i1"]))
			L.line(bx + cos(a) * 5, by + sin(a) * 3, qx, qy,
					int(M.P["n3"]) if i % 2 != 0 else int(M.P["u1"]), 1)
		for i in range(7):
			var a2: float = (float(i) / 7.0) * M.TAU + 0.3
			var vx: float = bx + cos(a2) * 12
			var vy: float = by + 1 + sin(a2) * 7
			var pu: float = (sin(t * 5 - float(i)) + 1) / 2
			L.line(bx + cos(a2) * 6, by + sin(a2) * 3.5, vx, vy,
					M.mix(int(M.P["e3"]), int(M.P["c2"]), pu))
		var rr: float = 7 + swell * 4
		LIB.draw_flask(L, bx, by - 3, rr, 0.8, sin(t * 3) * 0.25,
				LIB.LIQ()["acid"], t * (1 + frb * 2), MATS.PAL()["glassHi"])
		L.ring(bx, by - 3, rr + 1, 1, int(M.P["u1"]))
		for i in range(int(floor(frb * 9))):
			# bright fracture lines
			var fx2: float = bx + (M.hash_n(float(i) * 7.0) - 0.5) * 8
			var fy2: float = by - 3 + (M.hash_n(float(i) * 11.0) - 0.5) * 5
			var a3: float = M.hash_n(float(i) * 3.0 + 1.0) * M.TAU
				# `s < 6 + fr * 8` -- the bound is a FLOAT, so this runs ceili()
			# steps, not floor(): range(int(floor(...))) dropped the last segment.
			for s in range(ceili(6 + frb * 8)):
				a3 += (M.hash_n(float(s) + float(i) * 20.0) - 0.5) * 0.9
				fx2 += cos(a3)
				fy2 += sin(a3) * 0.7
				L.px(M.js_round(fx2), M.js_round(fy2),
						int(M.P["w"]) if sin(t * 9 - float(s)) > 0 else int(M.P["g2"]))
				L.px(M.js_round(fx2) + 1, M.js_round(fy2), int(M.P["c1"]))
		DRAW.ball(L, bx - 13, by - 4, 3.4, MATS.PAL()["cerB"], 3)
		DRAW.ball(L, bx + 13, by - 4, 3.4, MATS.PAL()["cerB"], 3)

	func lit(g, _w) -> void:
		var by: float = y - 12 - z
		DRAW.glow(g.l, x, by - 3, 16 + fr * 10, int(M.P["c1"]),
				0.2 + fr * 0.35, 4)


static func vis_ring_small(w, px: float, py: float) -> void:
	FX.dust(w, px, py, 2, 14, 3)
	w.parts.add({"k": "spark", "x": px, "y": py, "z": 1, "vx": 0, "vy": 0,
			"vz": 10, "max": 0.15, "c1": int(M.P["i0"])})


## `function* bastion(c)` -- the ORIGINAL Porcelain Bastion cast.
static func bastion(c):
	var box: Array = []
	var g = GEN.new(func():
		_bastion(c, box[0])
		return null)
	box.append(g)
	return g


static func _bastion(c, g) -> void:
	var w = c.w
	LIB.cast_anim(w, c)
	var cx: float = c.tx
	var cy: float = c.ty
	var b = Bastion.new(cx, cy, 10)
	b.asm = 0.001
	# telegraph: ground cracks, plates rising from beneath
	w.add(FX.GroundDecal.new(cx, cy, "cracks", 34, 9, c.id,
			{"a": int(M.P["k0"]), "b": int(M.P["i3"]), "c": int(M.P["c1"])}, 0, 1))
	w.add(b)
	var emerge = FX.Hits.new()
	var slams = FX.Hits.new()
	var rup = FX.Hits.new()
	var poolh = FX.Hits.new()
	for k in GEN.ticks(0.5):
		b.asm = M.smoothstep(k)
		b.z = (1 - M.smoothstep(k)) * 10
		b.plateOff = (1 - k) * 6
		b.shake = (1 - k) * 1.5
		if int(floor(k * 60.0)) % 4 == 0:
			FX.dust(w, cx + c.rng.range(-18, 18), cy + 6, 1, 10, 3)
			w.parts.add({"k": "chip", "x": cx + c.rng.range(-16, 16),
					"y": cy + c.rng.range(-4, 8), "z": 0, "vx": 0, "vy": 0,
					"vz": 60, "grav": 240, "size": 2, "c1": int(M.P["i0"]),
					"c2": int(M.P["i2"]), "c3": int(M.P["w"]), "land": 3,
					"max": 1.2, "rot": 0, "vr": 5})
		g.y(GEN.F)
	b.z = 0
	b.plateOff = 0
	b.shake = 0
	LIB.ring_at(c, cx, cy, 44, 0.3, 40, {"kind": "impact", "knock": 150,
			"stag": 0.4, "h": emerge,
			"cols": [int(M.P["w"]), int(M.P["i1"]), int(M.P["i3"])],
			"w": 3, "dust": true})
	w.shake(4, 0.3)
	w.shock(cx, cy, 50, 0.3, 2.5)
	FX.chips(w, cx, cy, 14, 100, int(M.P["i0"]), int(M.P["i2"]),
			int(M.P["w"]), {"z": 6, "up": 110, "size": [2, 4]})
	FX.dust(w, cx, cy, 8, 30, 5)
	var slamCd: float = 0.3
	var nextStep: float = 0.0
	var maxLife: float = 10.0
	var tm: float = 0.0
	while tm < maxLife and b.hp > 0:
		b.fr = maxf(1 - b.hp / b.maxHp, tm / maxLife * 0.9)
		b.swell = b.fr * b.fr
		# target the nearest enemy and walk toward it
		var tgt = w.nearest(b.x, b.y, 170)
		if tgt != null and b.slam < 0:
			var dx: float = tgt.x - b.x
			var dy: float = tgt.y - b.y
			var d: float = sqrt(dx * dx + dy * dy)
			var da: float = atan2(dy, dx) - b.face
			da = fmod(fmod(da + PI, M.TAU) + M.TAU, M.TAU) - PI
			b.face += da * 0.1
			if d > b.r + tgt.r + 14:
				b.x += cos(b.face) * 26 * GEN.F
				b.y += sin(b.face) * 26 * GEN.F
				b.z = absf(sin(tm * 6)) * 0.8
			b.x = M.clampf(b.x, 26, w.W - 26)
			b.y = M.clampf(b.y, 24, w.H - 22)
			slamCd -= GEN.F
			if slamCd <= 0 and d < b.r + tgt.r + 30:
				var bi: int = 0
				var bd: float = 1e9
				for i in range(4):
					var lp: Array = b.leg_pos(i)
					var dd: float = sqrt(pow(float(lp[0]) - tgt.x, 2.0)
							+ pow(float(lp[1]) - tgt.y, 2.0))
					if dd < bd:
						bd = dd
						bi = i
				b.slamLeg = bi
				b.slam = 0
		for i in range(4):
			# gait: planted feet re-step when the body walks away
			var l: Dictionary = b.leg[i]
			var lp2: Array = b.leg_pos(i)
			var lx: float = float(lp2[0])
			var ly: float = float(lp2[1])
			if float(l["lift"]) > 0:
				l["lift"] = minf(1.0, float(l["lift"]) + GEN.F * 5)
				if float(l["lift"]) >= 1:
					l["lift"] = 0
					if b.slam < 0 or i != b.slamLeg:
						vis_ring_small(w, lx, ly)
		if b.slam >= 0:
			b.slam += GEN.F
			var l2: Dictionary = b.leg[b.slamLeg]
			l2["lift"] = M.clampf(b.slam / 0.3, 0, 0.5)
			if b.slam > 0.3:
				var lp3: Array = b.leg_pos(b.slamLeg)
				var lx2: float = float(lp3[0])
				var ly2: float = float(lp3[1])
				l2["lift"] = 0
				b.slam = -1
				slamCd = 0.85
				LIB.ring_at(c, lx2, ly2, 30, 0.24, 35, {"kind": "impact",
						"knock": 130, "stag": 0.35, "h": slams, "max": 4,
						"cols": [int(M.P["w"]), int(M.P["i1"]),
								int(M.P["n3"])],
						"w": 3, "dust": true})
				w.shake(3, 0.2)
				w.shock(lx2, ly2, 38, 0.25, 2)
				FX.chips(w, lx2, ly2, 9, 90, int(M.P["i0"]), int(M.P["i2"]),
						int(M.P["w"]), {"z": 4, "up": 100, "size": [2, 4]})
				FX.dust(w, lx2, ly2, 4, 25, 4)
				# `tm * 100 + c.id` is a FLOAT seed in the original; only
				# `Rng` truncates it. Rounding it here changes the cracks.
				w.add(FX.GroundDecal.new(lx2, ly2, "cracks", 12, 4,
						tm * 100 + float(c.id),
						{"a": int(M.P["k0"]), "b": int(M.P["i3"]),
								"c": int(M.P["c1"])}, 0, 1))
		elif tm > nextStep:
			nextStep = tm + 0.55
			var i2: int = int(floor(tm * 2)) % 4
			var l3: Dictionary = b.leg[i2]
			if float(l3["lift"]) <= 0:
				l3["lift"] = 0.01
		tm += GEN.F
		g.y(GEN.F)
	# pressure builds: fractures spread, reservoir swells, plates bend
	for k in GEN.ticks(0.75):
		b.fr = 1
		b.swell = 0.4 + k * 1.1
		b.plateOff = k * 4
		b.shake = 0.6 + k * 1.6
		b.asm = 1
		if int(floor(k * 60.0)) % 4 == 0:
			w.parts.add({"k": "spark", "x": b.x + c.rng.range(-14, 14),
					"y": b.y - 12 + c.rng.range(-8, 8), "z": 4,
					"vx": c.rng.range(-30, 30), "vy": -10, "vz": 30,
					"grav": 100, "max": 0.4, "c1": int(M.P["g2"])})
			FX.drops(w, b.x + c.rng.range(-10, 10), b.y - 8, 1, 30,
					int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
					{"z": 14, "up": 40, "glow": 1})
		g.y(GEN.F)
	var bx: float = b.x
	var by: float = b.y
	b.dead = true
	b.tank = false
	b.push = false
	w.screen_flash(int(M.P["c3"]), 0.5, 0.2)
	w.shake(8, 0.55)
	w.shock(bx, by - 8, 100, 0.55, 4)
	w.hitstop = 0.06
	LIB.ring_at(c, bx, by, 72, 0.4, 120, {"kind": "burst", "knock": 190,
			"stag": 0.5, "h": rup,
			"cols": [int(M.P["w"]), int(M.P["c2"]), int(M.P["e2"])],
			"w": 5, "dust": true})
	w.add(FX.Flash.new(bx, by - 10, 36, int(M.P["c3"]), 0.4, 8))
	FX.chips(w, bx, by - 8, 36, 170, int(M.P["i0"]), int(M.P["i2"]),
			int(M.P["w"]), {"z": 14, "up": 190, "size": [3, 7]})
	FX.chips(w, bx, by - 8, 14, 120, int(MATS.PAL()["cerB"]["b"]),
			int(M.P["n0"]), int(M.P["w"]), {"z": 10, "up": 150,
					"size": [3, 5]})
	FX.shards(w, bx, by - 8, 12, 140, int(M.P["v2"]), int(M.P["v1"]),
			int(M.P["y2"]), {"z": 12, "up": 160, "size": [3, 6], "land": 2})
	FX.drops(w, bx, by - 8, 44, 150, int(M.P["c1"]), int(M.P["c3"]),
			int(M.P["c0"]), {"z": 12, "up": 180, "glow": 2,
					"size": [2, 4], "max": 2.4})
	w.add(FX.GroundDecal.new(bx, by, "crater", 24, 9, c.id,
			{"a": int(M.P["k0"]), "b": int(M.P["i2"]), "c": int(M.P["c1"])},
			0, 1.4))
	w.add(FX.Pool.new(bx, by, 26, MATS.MAT()["acid"], 6, {"blobs": 6,
			"boil": 1.8, "tick": {"every": 0.8, "amt": c.d(20),
					"opts": {"kind": "acid", "src": c.def["id"]},
					"h": poolh, "max": 3}}))
	for i in range(5):
		var a: float = c.rng.range(0, M.TAU)
		var d: float = c.rng.range(18, 40)
		w.add(FX.Splash.new(bx + cos(a) * d, by + sin(a) * d * 0.8, 5,
				int(M.P["c1"]), int(M.P["c3"])))
		w.add(FX.Embed.new(bx + cos(a) * d, by + sin(a) * d * 0.8, 3 + i % 3,
				int(M.P["i0"]), int(M.P["i3"]), int(M.P["w"]), 7))
	g.y(1.2)


# ---------------------------------------------------------------------------
# 05 BELLOWS TOAD
# ---------------------------------------------------------------------------

class Toad extends FX.Fx:
	var z: float = 0.0
	var f: float = 0.0
	var sq: float = 0.0
	var inf: float = 0.0
	var vis: float = 0.0

	func _init(px: float, py: float, f_: float) -> void:
		x = px
		y = py
		f = f_
		kind = "summon"
		sy = py

	func upd(_w, _dt: float) -> void:
		sy = y

	func mouth() -> Array:
		return [x + cos(f) * 9, y - z - 4 + sin(f) * 4]

	func shd(g, _w) -> void:
		g.s.dl = 8
		g.s.ellipse(x, y + 3, 10 * (1 + inf * 0.15), 5, int(M.P["bk"]))
		g.s.dl = 16

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var fx2: float = cos(f)
		var fy2: float = sin(f)
		var qx: float = -fy2
		var base: float = y - z
		var sx: float = 1 + sq * 0.28 + inf * 0.18
		var sy2: float = 1 - sq * 0.38 - inf * 0.08
		L.dl = M.js_round(vis * 16)
		if L.dl < 1:
			return
		for s in [-1.0, 1.0]:
			DRAW.ball(L, x - fx2 * 5 + qx * 8 * s, base - 1 - fy2 * 2, 3.6,
					MATS.PAL()["toad"], 2.4)
			DRAW.ball(L, x + fx2 * 5 + qx * 6 * s, base - 1 + fy2 * 2, 2.4,
					MATS.PAL()["toad"], 1.8)
			L.rect(M.js_round(x + qx * 10 * s - fx2 * 6), M.js_round(base + 1),
					3, 1, int(M.P["k0"]))
		DRAW.ball(L, x, base - 6 * sy2, 9 * sx, MATS.PAL()["toad"], 6.5 * sy2)
		L.dl = M.js_round(vis * 8)
		L.disc(x, base - 6 * sy2, 4.5 * sx, int(M.P["c1"]))
		L.dl = M.js_round(vis * 16)
		for i in range(2):
			L.arc(x - fx2 * 2, base - 7 * sy2, 4 + float(i) * 2.2, 1,
					atan2(-fy2, -fx2) - 1.1, atan2(-fy2, -fx2) + 1.1,
					int(M.P["k0"]), 3 + float(i) * 1.6)
		for i in range(6):
			var a: float = M.hash_n(float(i) * 3.0) * M.TAU
			var d: float = 2 + M.hash_n(float(i) * 7.0) * 5
			L.disc(x + cos(a) * d * sx, base - 7 * sy2 + sin(a) * d * 0.6, 0.9,
					int(M.P["e0"]))
		for s in [-1.0, 1.0]:
			var ex: float = x + fx2 * 3 + qx * 4.2 * s
			var ey: float = base - 11 * sy2 + fy2 * 1.5
			DRAW.ball(L, ex, ey, 2.4, MATS.PAL()["toad"])
			L.disc(ex + fx2 * 0.8, ey + fy2 * 0.6, 1.1, int(M.P["g2"]))
			L.px(M.js_round(ex + fx2 * 0.8), M.js_round(ey + fy2 * 0.6),
					int(M.P["k0"]))
		if inf > 0.02:
			var r: float = 3 + inf * 8.5
			var sx2: float = x + fx2 * (7 + inf * 6.5)
			var sy3: float = base - 3 + fy2 * (4 + inf * 4)
			DRAW.ball(L, sx2, sy3, r, MATS.PAL()["toadSac"], r * 0.85)
			for i in range(6):
				var a2: float = (float(i) / 6.0) * M.TAU + 0.4
				L.line(sx2, sy3, sx2 + cos(a2) * (r - 1),
						sy3 + sin(a2) * (r * 0.85 - 1),
						int(M.P["c2"]) if i % 2 != 0 else int(M.P["e3"]))
			var bx2: float = sx2 + sin(t * 7) * r * 0.35
			var by2: float = sy3 + cos(t * 5) * r * 0.3
			L.dl = 9
			L.disc(bx2, by2, r * 0.4, int(M.P["c1"]))
			L.dl = 6
			L.disc(bx2 - 1, by2 - 1, r * 0.22, int(M.P["c3"]))
			L.dl = M.js_round(vis * 16)
			L.px(M.js_round(sx2 - r * 0.5), M.js_round(sy3 - r * 0.5),
					int(M.P["w"]))
			L.px(M.js_round(sx2 - r * 0.5 + 1), M.js_round(sy3 - r * 0.5),
					int(M.P["w"]))
		L.dl = 16

	func lit(g, _w) -> void:
		if inf > 0.1:
			var fx2: float = cos(f)
			var r: float = 3 + inf * 8.5
			DRAW.glow(g.l, x + fx2 * (7 + inf * 6.5), y - z - 3, r * 1.3,
					int(M.P["c1"]), 0.3 * inf, 3)


## `function* toad(c)` -- the ORIGINAL Bellows Toad cast.
static func toad(c):
	var box: Array = []
	var g = GEN.new(func():
		_toad(c, box[0])
		return null)
	box.append(g)
	return g


static func _toad(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c)
	g.y(0.06)
	var sd: float = c.ang + PI / 2
	var sxp: float = M.clampf(p.x + cos(sd) * 22, 14, w.W - 14)
	var syp: float = M.clampf(p.y + sin(sd) * 22, 16, w.H - 14)
	var puddle = FX.Hits.new()
	var vap = FX.Hits.new()
	var glob = FX.Hits.new()
	var fin = FX.Hits.new()
	w.add(FX.Pool.new(sxp, syp, 14, MATS.MAT()["acid"], 5,
			{"grow": 0.3, "blobs": 5, "boil": 1.4}))
	LIB.ring_at(c, sxp, syp, 38, 0.24, 15, {"kind": "acid", "knock": 70,
			"stag": 0.2, "h": puddle,
			"cols": [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])],
			"w": 2})
	var toad = Toad.new(sxp, syp, c.ang)
	w.add(toad)
	for k in GEN.ticks(0.12):
		toad.vis = k
		toad.z = (1 - k) * -6 + sin(k * PI) * 6
		g.y(GEN.F)
	toad.vis = 1
	toad.z = 0
	FX.drops(w, sxp, syp, 10, 50, int(M.P["c1"]), int(M.P["c3"]),
			int(M.P["e2"]), {"z": 4, "up": 90, "glow": 1})
	# hop toward the target
	var tx: float = c.tx
	var ty: float = c.ty
	var face: float = atan2(ty - syp, tx - sxp)
	var hop: float = minf(46, sqrt(pow(tx - sxp, 2.0) + pow(ty - syp, 2.0)) * 0.5 + 10)
	toad.f = face
	var x0: float = toad.x
	var y0: float = toad.y
	for k in GEN.ticks(0.16):
		toad.x = x0 + cos(face) * hop * k
		toad.y = y0 + sin(face) * hop * k
		toad.z = sin(k * PI) * 14
		toad.sq = -0.3 if k < 0.15 else 0
		g.y(GEN.F)
	toad.z = 0
	toad.sq = 0.5
	w.add(FX.Splash.new(toad.x, toad.y, 6, int(M.P["c1"]), int(M.P["c3"])))
	FX.dust(w, toad.x, toad.y, 3, 14, 3)
	w.shake(1, 0.1)
	# compress and inhale: debris is drawn toward the open mouth
	for k in GEN.ticks(0.3):
		toad.sq = 0.5 + k * 0.4
		toad.inf = M.smoothstep(k) * 1.0
		var mp: Array = toad.mouth()
		var mx0: float = float(mp[0])
		var my0: float = float(mp[1])
		for i in range(2):
			var a: float = c.rng.range(-1.1, 1.1) + face
			var d: float = c.rng.range(26, 52)
			var ix: float = mx0 + cos(a) * d
			var iy: float = my0 + 4 + sin(a) * d * 0.7
			var kind: int = c.rng.int_n(3)
			w.parts.add({"k": "chip" if kind == 0 else ("drop" if kind == 1 else "dust"),
					"x": ix, "y": iy, "z": 1, "vx": 0, "vy": 0, "vz": 0,
					"size": 2,
					"max": 0.4,
					"c1": int(M.P["i2"]) if kind == 0 else (int(M.P["c1"]) if kind == 1 else int(M.P["i3"])),
					"c2": int(M.P["i3"]) if kind == 0 else int(M.P["c3"]),
					"c3": int(M.P["w"]), "rot": 0, "vr": 6,
					"fn": _inhale_fn(ix, iy, mx0, my0, face)})
		g.y(GEN.F)
	# violent forward blast: rolling vapour layers + heavy globules
	var mp2: Array = toad.mouth()
	var mx: float = float(mp2[0])
	var my: float = float(mp2[1])
	w.shake(3, 0.25)
	w.shock(mx, my, 40, 0.3, 2)
	w.add(FX.Flash.new(mx, my, 12, int(M.P["c3"]), 0.2, 4))
	var cosf: float = cos(face)
	var sinf: float = sin(face)
	var layers: Array = [
			[MATS.VAP()["dark"], 26, 14, 0],
			[MATS.VAP()["green"], 21, 11, 1],
			[MATS.VAP()["pale"], 14, 8, 2]]
	for lay_row in layers:
		var ramp: Array = lay_row[0]
		var rad: float = float(lay_row[2])
		var lay: int = int(lay_row[3])
		var pf: Array = []
		for i in range(11):
			pf.append({"x": (i % 4) * 7 - 3,
					"y": (c.rng.next() - 0.5) * 12,
					"r": rad * c.rng.range(0.7, 1.1),
					"ph": c.rng.range(0, M.TAU),
					"sp": c.rng.range(0.8, 2.2) * c.rng.sign(),
					"orb": c.rng.range(2, 5), "lay": lay})
		var cl = FX.Cloud.new(mx, my + 2, pf, ramp, 2.3, c.id + lay)
		cl.vx = cosf * (130 - lay * 10)
		cl.vy = sinf * (130 - lay * 10)
		cl.grow = {"from": 0.5, "to": 2.0, "dur": 1.3}
		cl.dens = 12 - lay
		if lay == 0:
			cl.tickInfo = {"every": 0.36, "amt": c.d(18),
					"opts": {"kind": "acid", "src": c.def["id"],
							"stagger": 0.12},
					"h": vap, "max": 3, "mark": "miasma"}
		w.add(cl)
		w.run(_cloud_decay(cl))
	for i in range(6):
		var a: float = face + (float(i) - 2.5) * 0.14 + c.rng.range(-0.03, 0.03)
		var sp: float = 150 + c.rng.range(-20, 30)
		w.add(FX.Shot.new(mx, my, 6, cos(a) * sp, sin(a) * sp, 18, 90, 5,
				func(gg, x, y, _z, s):
					var L = gg.s
					DRAW.ball(L, x, y, 3.2, MATS.PAL()["liquid"])
					L.px(M.js_round(x - 1), M.js_round(y - 1), int(M.P["w"]))
					L.dl = 8
					L.px(M.js_round(x - s.vx * 0.05),
							M.js_round(y - s.vy * 0.05), int(M.P["e3"]))
					L.px(M.js_round(x - s.vx * 0.09),
							M.js_round(y - s.vy * 0.09), int(M.P["e2"]))
					L.dl = 16,
				_toad_glob_hit(c, glob, i),
				_toad_glob_land(i), 1.4, 14))
	for k in GEN.ticks(0.28):
		toad.inf = M.lerpf(1, 0.1, k)
		toad.sq = M.lerpf(0.9, 0.1, k)
		g.y(GEN.F)
	g.y(0.3)
	# last exaggerated inflation, then burst
	for k in GEN.ticks(0.8):
		toad.inf = M.lerpf(0.1, 1.9, M.smoothstep(k))
		toad.sq = -0.35 * k
		toad.x += sin(k * 60) * 0.25
		if int(floor(k * 60.0)) % 6 == 0:
			FX.steam(w, toad.x, toad.y, 1, 10, int(M.P["e2"]),
					int(M.P["c0"]), 3, {"z": 8})
		g.y(GEN.F)
	var ex: float = toad.x
	var ey: float = toad.y
	toad.dead = true
	w.screen_flash(int(M.P["c2"]), 0.3, 0.14)
	w.shake(6, 0.4)
	w.shock(ex, ey, 80, 0.45, 3.5)
	LIB.ring_at(c, ex, ey, 62, 0.36, 90, {"kind": "burst", "knock": 160,
			"stag": 0.4, "h": fin,
			"cols": [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e1"])],
			"w": 5, "dust": false, "fill": false})
	LIB.vis_ring(w, ex, ey, 44, 0.3,
			[int(M.P["w"]), int(M.P["c2"]), int(M.P["e2"])], 3)
	w.add(FX.Flash.new(ex, ey - 6, 28, int(M.P["c3"]), 0.35, 8))
	FX.drops(w, ex, ey, 40, 130, int(M.P["c1"]), int(M.P["c3"]),
			int(M.P["e2"]), {"z": 8, "up": 130, "glow": 2, "size": [2, 4]})
	for i in range(20):
		var a: float = c.rng.range(0, M.TAU)
		var sp: float = c.rng.range(40, 120)
		w.parts.add({"k": "petal", "x": ex, "y": ey, "z": 10,
				"vx": cos(a) * sp, "vy": sin(a) * sp * 0.8,
				"vz": c.rng.range(30, 100), "grav": 80, "drag": 1.2,
				"size": c.rng.range(2, 4), "rot": c.rng.range(0, M.TAU),
				"vr": c.rng.range(-9, 9),
				"c1": int(MATS.PAL()["toadSac"]["b"]) if i % 2 != 0 else int(M.P["e2"]),
				"c2": int(M.P["c3"]), "max": 1.8,
				"fn": _petal_land()})
	w.add(FX.Pool.new(ex, ey, 18, MATS.MAT()["acid"], 3.2,
			{"blobs": 6, "boil": 1.4}))
	w.add(FX.GroundDecal.new(ex, ey, "pits", 20, 3.5, c.id,
			{"a": int(M.P["k0"]), "b": int(M.P["e3"]), "c": int(M.P["c1"])},
			0, 1))
	g.y(0.5)


## `w.run((function* () { for (let i = 0; i < 140; i++) { d(); yield F; } })())`
## -- the rolling vapour clouds decelerate for 140 frames.
static func _cloud_decay(cl):
	var box: Array = []
	var g = GEN.new(func():
		_cloud_decay_body(cl, box[0])
		return null)
	box.append(g)
	return g


static func _cloud_decay_body(cl, g) -> void:
	for _i in range(140):
		cl.vx *= 0.975
		cl.vy *= 0.975
		g.y(GEN.F)


static func _inhale_fn(sx: float, sy: float, mx: float, my: float, face: float):
	return func(q, _w, _dt):
		var u: float = pow(q.age / q.max, 1.7)
		var sw: float = sin(u * 3) * 6
		q.x = M.lerpf(sx, mx, u) - sin(face) * sw
		q.y = M.lerpf(sy, my, u) + cos(face) * sw
		q.z = M.lerpf(1, 5, u)


static func _petal_land():
	return func(q, _w, _dt):
		if q.z < 0:
			q.z = 0
			q.vz = 0
			q.vx *= 0.9
			q.vy *= 0.9


static func _toad_glob_hit(c, glob, i: int):
	return func(ww, s, e):
		if not glob.ok(e, ww.time, 0, 2):
			return false
		LIB.hit_e(c, e, 30, {"kind": "acid", "k": 60,
				"ang": atan2(s.vy, s.vx), "stag": 0.25, "at": [s.x, s.y]})
		ww.poison(e, c.d(36), 3, c.id, c.def["id"])
		ww.mark(e, "wet", 2)
		ww.add(FX.Pool.new(e.x, e.y, 9, MATS.MAT()["acid"], 2,
				{"blobs": 4, "seed": i * 7, "boil": 1}))
		FX.drops(ww, e.x, e.y, 9, 70, int(M.P["c1"]), int(M.P["c3"]),
				int(M.P["e2"]), {"z": 6, "up": 80, "glow": 1})
		ww.add(FX.Splash.new(e.x, e.y, 7, int(M.P["c1"]), int(M.P["c3"])))
		return true


static func _toad_glob_land(i: int):
	return func(ww, s):
		ww.add(FX.Pool.new(s.x, s.y, 7, MATS.MAT()["acid"], 1.8,
				{"blobs": 3, "seed": i, "boil": 1}))
		FX.drops(ww, s.x, s.y, 5, 50, int(M.P["c1"]), int(M.P["c3"]),
				int(M.P["e2"]), {"z": 2, "up": 60})
