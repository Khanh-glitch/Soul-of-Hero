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
