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
