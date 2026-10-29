class_name VenomS2
extends RefCounted

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")

## Native port of the ORIGINAL Venomwright `src/game/skills/s2.ts`
## skills 6-10: Graft Caravan, Hatchery Fall, Brine Serpents, Molting
## Harvester, The Walking Crucible.
##
## The bodies are line-by-line translations of the original `function*`
## generators, driven by `VenomGen` (see `venom_gen.gd`), so the loop shape,
## wait values and RNG draw order are the authored ones.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")


## `export function plume(...)` -- the rising vapour column shared by several
## Caravan and Crucible effects.
static func plume(w, px: float, py: float, h: float, life: float, ramp: Array,
		r: float, seed: int = 1, delay: float = 0.0):
	return w.add(FX.Custom.new(px, py, life + delay, {
			"up": func(g, _a, f):
				var t: float = f.age - delay
				if t < 0:
					return
				var k: float = minf(1.0, t / 0.35)
				var fade: float = M.clampf((life - t) / 0.6, 0, 1)
				var L = g.s
				for i in range(7):
					var u: float = float(i) / 6.0
					var rr: float = (r * (1 - u * 0.35)) * (0.5 + 0.5 * k)
					DRAW.puff(L, px + V8M.v8_sin(g.t * 3 + float(i) * 1.3 + float(seed)) * 3 * u,
							py - u * h * k - 2, rr, ramp, 12 * fade,
							g.t + float(i) * 0.3, seed + i),
			"lit": func(g, _a, f):
				var t: float = f.age - delay
				if t > 0:
					DRAW.glow(g.l, px, py - h * 0.4, r * 1.4, int(ramp[3]),
							0.12 * M.clampf((life - t) / 0.6, 0, 1), 3)},
			py + 6))


# ---------------------------------------------------------------------------
# 06 GRAFT CARAVAN
# ---------------------------------------------------------------------------

class Beetle extends FX.Fx:
	var hd: float = 0.0
	var z: float = 0.0
	var flask: bool = true
	var fade: float = 1.0
	var tilt: float = 0.0
	var legT: float = 0.0
	var sc: float = 1.0
	var spd: float = 0.0
	var u: float = 0.0
	var climb: float = 0.0
	var ruptured: bool = false
	var role: int = 0
	var vx: float = 0.0
	var vy: float = 0.0
	var big: bool = false

	func _init(px: float, py: float, hd_: float, big_: bool, role_: int) -> void:
		x = px
		y = py
		hd = hd_
		big = big_
		sc = 1.55 if big else 1.0
		r = 5 * sc
		kind = "summon"
		role = role_
		sy = py

	func upd(_w, _dt: float) -> void:
		sy = y

	func shd(g, _w) -> void:
		g.s.dl = M.js_round(8 * fade)
		g.s.ellipse(x, y + 2, 7 * sc, 3.4 * sc, int(M.P["bk"]))
		g.s.dl = 16

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var fx2: float = V8M.v8_cos(hd)
		var fy2: float = V8M.v8_sin(hd)
		var qx: float = -fy2
		var qy: float = fx2
		var bx: float = x
		var by: float = y - z
		L.dl = M.js_round(16 * fade)
		if L.dl < 1:
			return
		for i in range(3):
			for s in [-1.0, 1.0]:
				var ph: float = V8M.v8_sin(legT * 1.8 + (PI if i % 2 != 0 else 0) + (PI if s > 0 else 0))
				var sx: float = bx + fx2 * float(i - 1) * 3.4 * sc + qx * 3 * sc * s
				var sy2: float = by + fy2 * float(i - 1) * 3 * sc + qy * 3 * sc * s * 0.8 - 2
				var kx: float = sx + qx * s * 3 * sc
				var ky: float = sy2 + qy * s * 2.4 * sc - 2
				var ex: float = kx + qx * s * 2.4 * sc + fx2 * ph * 2.6 * sc
				var ey: float = ky + 4 + qy * s * 1.5 * sc + maxf(0.0, -ph) * -1
				L.line(sx, sy2, kx, ky, int(M.P["n1"]))
				L.line(kx, ky, ex, ey, int(M.P["n3"]))
				L.px(M.js_round(ex), M.js_round(ey), int(M.P["e3"]))
		DRAW.ball(L, bx - fx2 * 4 * sc, by - 4 * sc - fy2 * 2 * sc, 5.6 * sc,
				MATS.PAL()["chitin"], 4.8 * sc)
		DRAW.ball(L, bx - fx2 * 3.4 * sc, by - 6.2 * sc - fy2 * 1.6 * sc, 3.4 * sc,
				MATS.PAL()["cer"], 2.8 * sc)
		L.line(bx - fx2 * 6 * sc, by - 4.6 * sc, bx, by - 5.2 * sc, int(M.P["n3"]))
		DRAW.ball(L, bx + fx2 * 2.4 * sc, by - 3.6 * sc + fy2 * 1.4 * sc, 3.6 * sc,
				MATS.PAL()["chitin"], 3.2 * sc)
		DRAW.ball(L, bx + fx2 * 2.2 * sc, by - 5.5 * sc, 2 * sc,
				MATS.PAL()["cer"], 1.6 * sc)
		var hx: float = bx + fx2 * 6 * sc
		var hy: float = by - 3 * sc + fy2 * 2.5 * sc
		DRAW.ball(L, hx, hy, 2.5 * sc, MATS.PAL()["chitin"], 2.2 * sc)
		for s in [-1.0, 1.0]:
			DRAW.shard(L, hx + fx2 * 2 * sc + qx * s * 1.2, hy + fy2 * 2 * sc + qy * s * 1.2,
					hd + s * 0.5, 3.4 * sc, 0.9, int(M.P["i0"]), int(M.P["i2"]),
					int(M.P["w"]))
			L.px(M.js_round(hx + qx * s * 1.6 + fx2), M.js_round(hy + qy * s * 1.6 - 1),
					int(M.P["c1"]))
			L.line(hx + fx2 * sc, hy - 1, hx + fx2 * 5 * sc + qx * s * 2,
					hy - 2 + fy2 * 3 * sc + V8M.v8_sin(t * 9 + s) * 1.2, int(M.P["n3"]))
		var fx0: float = bx - fx2 * 3 * sc
		var fy0: float = by - 11.5 * sc
		if flask:
			LIB.draw_flask(L, fx0, fy0, 4.6 * sc, 0.68, tilt,
					LIB.LIQ()["mag"] if big else LIB.LIQ()["acid"], t * 1.4)
			L.rect(M.js_round(fx0 - 1), M.js_round(fy0 - 5.4 * sc), 3, 2,
					int(M.P["u1"]))
			L.px(M.js_round(fx0), M.js_round(fy0 - 6.4 * sc), int(M.P["u2"]))
			if big and V8M.v8_sin(t * 22) > 0:
				L.px(M.js_round(fx0 + 4), M.js_round(fy0 - 3), int(M.P["m2"]))
				L.px(M.js_round(fx0 - 4), M.js_round(fy0 + 1), int(M.P["w"]))
		else:
			L.poly([fx0 - 4, fy0 + 3, fx0 - 3, fy0 - 2, fx0 - 1, fy0 + 1, fx0,
					fy0 - 3, fx0 + 2, fy0 + 1, fx0 + 4, fy0 - 1, fx0 + 4, fy0 + 3],
					int(M.P["v1"]))
			L.px(M.js_round(fx0), M.js_round(fy0 - 3), int(M.P["v3"]))
		L.dl = 16

	func lit(g, _w) -> void:
		if flask:
			DRAW.glow(g.l, x - V8M.v8_cos(hd) * 3, y - z - 11, 7 * sc,
					int(M.P["m1"]) if big else int(M.P["c1"]), 0.28, 3)


## `function* caravan(c)` -- the ORIGINAL Graft Caravan cast.
static func caravan(c):
	var box: Array = []
	var g = GEN.new(func():
		_caravan(c, box[0])
		return null)
	box.append(g)
	return g


static func _caravan(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c, true, 0.4)
	var ox: float = p.x
	var oy: float = p.y
	var dx: float = V8M.v8_cos(c.ang)
	var dy: float = V8M.v8_sin(c.ang)
	var nx: float = -dy
	var ny: float = dx
	var R: float = minf(230, float(c.def["aim"]["range"]))
	var side: float = c.rng.sign()
	var p0: Dictionary = {"x": ox + dx * 16, "y": oy + dy * 16}
	var p3: Dictionary = {"x": M.clampf(ox + dx * R, 12, w.W - 12),
			"y": M.clampf(oy + dy * R, 14, w.H - 12)}
	var p1: Dictionary = {"x": M.lerpf(float(p0["x"]), float(p3["x"]), 0.33) + nx * 70 * side,
			"y": M.lerpf(float(p0["y"]), float(p3["y"]), 0.33) + ny * 70 * side}
	var p2: Dictionary = {"x": M.lerpf(float(p0["x"]), float(p3["x"]), 0.66) - nx * 70 * side,
			"y": M.lerpf(float(p0["y"]), float(p3["y"]), 0.66) - ny * 70 * side}
	var bez := func(u: float) -> Dictionary:
		var a: float = V8M.v8_pow(1 - u, 3.0)
		var b: float = 3 * V8M.v8_pow(1 - u, 2.0) * u
		var cc: float = 3 * (1 - u) * u * u
		var d: float = V8M.v8_pow(u, 3.0)
		return {"x": a * float(p0["x"]) + b * float(p1["x"]) + cc * float(p2["x"]) + d * float(p3["x"]),
				"y": a * float(p0["y"]) + b * float(p1["y"]) + cc * float(p2["y"]) + d * float(p3["y"])}
	var arc_len: float = 0.0
	var prev_q: Dictionary = bez.call(0.0)
	for i in range(1, 31):
		var nq: Dictionary = bez.call(float(i) / 30.0)
		arc_len += sqrt(V8M.v8_pow(float(nq["x"]) - float(prev_q["x"]), 2.0)
				+ V8M.v8_pow(float(nq["y"]) - float(prev_q["y"]), 2.0))
		prev_q = nq
	var L0: float = arc_len
	g.y(0.04)
	var roles: Array = [0, 1, 2, 0, 1, 0]
	var delays: Array = [0.0, 0.3, 0.6, 0.9, 1.2, 1.75]
	var beetles: Array = []
	var hits = FX.Hits.new()
	var pools = FX.Hits.new()
	var fin = FX.Hits.new()
	var vap = FX.Hits.new()
	var debris: Array = []
	var done: Array = []
	var final_done_box: Array = [false]
	var rupture := func(b, e):
		b.ruptured = true
		b.flask = false
		var fx3: float = b.x
		var fy3: float = b.y
		if e != null and hits.ok(e, w.time, 0, 3):
			LIB.hit_e(c, e, 50, {"kind": "acid", "k": 100,
					"from": [b.x, b.y], "stag": 0.3, "at": [e.x, e.y]})
			w.mark(e, "corrode", 2.5, 2.0)
		w.add(FX.Pool.new(fx3 + b.vx * 0.05, fy3, 10, MATS.MAT()["acid"], 3.4,
				{"blobs": 5, "boil": 1.4, "tick": {"every": 0.75, "amt": c.d(15),
						"opts": {"kind": "acid", "src": c.def["id"]},
						"h": pools, "max": 3}}))
		w.add(FX.Splash.new(fx3, fy3, 8, int(M.P["c1"]), int(M.P["c3"])))
		w.add(FX.Flash.new(fx3, fy3 - 6, 10, int(M.P["c2"]), 0.2, 6))
		FX.drops(w, fx3, fy3, 14, 80, int(M.P["c1"]), int(M.P["c3"]),
				int(M.P["e2"]), {"z": 8, "up": 100, "glow": 2, "ang": b.hd,
						"spread": 4.5})
		FX.shards(w, fx3, fy3, 6, 70, int(M.P["v2"]), int(M.P["v1"]),
				int(M.P["y2"]), {"z": 8, "land": 2, "size": [2, 4]})
		FX.chips(w, fx3, fy3, 4, 60, int(M.P["i0"]), int(M.P["i2"]),
				int(M.P["w"]), {"z": 6})
		debris.append({"x": fx3, "y": fy3})
		w.shake(1.5, 0.12)
		w.add(FX.Custom.new(fx3, fy3, 7, {"gnd": _caravan_debris(fx3, fy3)}))
	var detonate := func(b):
		final_done_box[0] = true
		b.dead = true
		var X: float = b.x
		var Y: float = b.y
		w.hitstop = 0.05
		w.screen_flash(int(M.P["m2"]), 0.45, 0.18)
		w.shake(8, 0.5)
		w.shock(X, Y, 110, 0.5, 4)
		w.add(FX.Flash.new(X, Y - 8, 40, int(M.P["w"]), 0.35, 8))
		LIB.ring_at(c, X, Y, 66, 0.34, 100, {"kind": "burst", "knock": 170,
				"stag": 0.4, "h": fin,
				"cols": [int(M.P["w"]), int(M.P["m2"]), int(M.P["c1"])],
				"w": 5, "dust": true})
		LIB.vis_ring(w, X, Y, 46, 0.3,
				[int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])], 3)
		for i in range(4):
			var a: float = (float(i) / 4.0) * M.TAU + 0.5
			plume(w, X + V8M.v8_cos(a) * 12, Y + V8M.v8_sin(a) * 8, 30 + float(i) * 4, 1.3,
					MATS.VAP()["green"] if i % 2 != 0 else MATS.VAP()["pale"],
					11, i, float(i) * 0.06)
		var cl = FX.Cloud.new(X, Y, LIB.mk_puffs(c.rng, 13, 28, 11, 19, 7, 1.6),
				MATS.VAP()["green"], 3.6, c.id)
		cl.grow = {"from": 0.4, "to": 1.7, "dur": 1.2}
		cl.dens = 12
		cl.tickInfo = {"every": 0.55, "amt": c.d(25),
				"opts": {"kind": "acid", "src": c.def["id"]}, "h": vap,
				"max": 2, "mark": "miasma"}
		w.add(cl)
		w.add(FX.Pool.new(X, Y, 30, MATS.MAT()["acid"], 5, {"blobs": 7,
				"boil": 2.4, "tick": {"every": 0.75, "amt": c.d(15),
						"opts": {"kind": "acid", "src": c.def["id"]},
						"h": pools, "max": 3}}))
		FX.drops(w, X, Y, 46, 150, int(M.P["c1"]), int(M.P["c3"]),
				int(M.P["e2"]), {"z": 10, "up": 170, "glow": 2,
						"size": [2, 4], "max": 2.4})
		FX.chips(w, X, Y, 14, 110, int(M.P["i0"]), int(M.P["i2"]),
				int(M.P["w"]), {"z": 10, "up": 140, "size": [2, 4]})
		for i in range(22):
			w.run(_caravan_shard(c, X, Y, i))
		w.add(FX.GroundDecal.new(X, Y, "pits", 34, 6, c.id,
				{"a": int(M.P["k0"]), "b": int(M.P["e3"]), "c": int(M.P["c1"])},
				0, 1))
	var tm: float = 0.0
	while tm < 6.5:
		for i in range(6):
			if beetles.size() <= i and tm >= float(delays[i]):
				while beetles.size() <= i:
					beetles.append(null)
				var big: bool = i == 5
				var q0: Dictionary = bez.call(0.01)
				var b = Beetle.new(float(q0["x"]), float(q0["y"]), V8M.v8_atan2(dy, dx),
						big, int(roles[i]))
				b.spd = 90 if big else 150 + float(i) * 6
				beetles[i] = b
				w.add(b)
				FX.dust(w, float(q0["x"]), float(q0["y"]), 3, 14, 3)
				w.add(FX.Splash.new(float(q0["x"]), float(q0["y"]), 4,
						int(M.P["i2"]), int(M.P["i0"])))
		for b in beetles:
			if b == null or b.dead or done.has(b):
				continue
			var q: Dictionary = bez.call(minf(1.0, b.u + 0.06))
			var tx: float = float(q["x"])
			var ty: float = float(q["y"])
			var react = null
			if (not b.ruptured) or b.big:
				var bd: float = 78.0 if b.role == 1 else (64.0 if b.role == 0 else 52.0)
				for e in w.enemies:
					if e.dying > 0:
						continue
					var d: float = sqrt(V8M.v8_pow(e.x - b.x, 2.0) + V8M.v8_pow(e.y - b.y, 2.0)) - e.r
					if d < bd:
						bd = d
						react = e
				if react != null and (M.hash_n(b.x) > 0.3 if b.role == 2 else true) \
						and (tm > float(delays[5]) + 0.55 if b.big else true):
					tx = react.x
					ty = react.y
				else:
					react = null
			var want: float = V8M.v8_atan2(ty - b.y, tx - b.x)
			var turn: float = float(11 if (b.role == 1 and react != null) else 5) * GEN.F
			b.hd += M.clampf(M.ang_diff(b.hd, want), -turn, turn)
			var climbing: bool = false
			for d2 in debris:
				if sqrt(V8M.v8_pow(float(d2["x"]) - b.x, 2.0) + V8M.v8_pow(float(d2["y"]) - b.y, 2.0)) < 7 \
						and (not b.ruptured) == false and b.climb <= 0:
					climbing = true
					break
			if climbing:
				b.climb = 0.01
			if b.climb > 0:
				b.climb += GEN.F
				b.z = V8M.v8_sin(M.clampf(b.climb / 0.42, 0, 1) * PI) * 4.5
				if b.climb > 0.42:
					b.climb = 0
					b.z = 0
			var sp: float = b.spd * (1.25 if (react != null and b.role == 0) else 1) \
					* (0.5 if b.climb > 0 else 1)
			var ox2: float = b.x
			var oy2: float = b.y
			b.x += V8M.v8_cos(b.hd) * sp * GEN.F
			b.y += V8M.v8_sin(b.hd) * sp * GEN.F
			b.vx = (b.x - ox2) / GEN.F
			b.vy = (b.y - oy2) / GEN.F
			b.u = M.clampf(b.u + (sp * GEN.F / L0) * M.clampf(
					V8M.v8_cos(M.ang_diff(b.hd, V8M.v8_atan2(float(q["y"]) - b.y, float(q["x"]) - b.x))) + 0.2,
					0.2, 1), 0, 1)
			b.legT += sp * GEN.F * 0.5
			b.tilt = M.lerpf(b.tilt, M.clampf(
					-V8M.v8_sin(M.ang_diff(V8M.v8_atan2(b.vy, b.vx), b.hd)) * 0.9
							+ V8M.v8_sin(b.legT * 0.9) * 0.2, -0.7, 0.7), 0.2)
			if M.hash_n(floor(tm * 60.0) + b.u * 100.0) > 0.9:
				w.parts.add({"k": "dust", "x": b.x - V8M.v8_cos(b.hd) * 5, "y": b.y + 2,
						"z": 0, "vz": 6, "max": 0.35, "size": 2,
						"c1": int(M.P["i3"]), "c2": int(M.P["i2"])})
			for e in w.enemies:
				if e.dying > 0:
					continue
				var d3: float = sqrt(V8M.v8_pow(e.x - b.x, 2.0) + V8M.v8_pow(e.y - b.y, 2.0))
				if d3 < e.r + b.r:
					if b.big and not final_done_box[0]:
						detonate.call(b)
						break
					if not b.big and not b.ruptured:
						rupture.call(b, e)
					elif not b.big:
						w.push(e, b.x, b.y, 18)
			if b.u >= 0.995 or b.x < 8 or b.x > w.W - 8 or b.y < 10 or b.y > w.H - 8:
				if b.big and not final_done_box[0]:
					detonate.call(b)
				elif not b.big:
					done.append(b)
		for b in done:
			if b.dead:
				continue
			b.fade -= GEN.F * 2.2
			if b.fade <= 0:
				b.dead = true
				FX.chips(w, b.x, b.y, 5, 50, int(M.P["i0"]), int(M.P["i2"]),
						int(M.P["w"]), {"z": 4})
				FX.dust(w, b.x, b.y, 4, 14, 3)
		if final_done_box[0]:
			break
		tm += GEN.F
		g.y(GEN.F)
	for b in beetles:
		if b != null and not b.dead:
			b.dead = true
	g.y(1.4)


static func _caravan_debris(fx3: float, fy3: float):
	return func(g):
		var L = g.s
		for i in range(6):
			L.px(M.js_round(fx3 + (M.hash_n(float(i)) - 0.5) * 12),
					M.js_round(fy3 + (M.hash_n(float(i) * 3.0) - 0.5) * 8),
					int(M.P["i1"]) if i % 2 != 0 else int(M.P["i3"]))
			L.px(M.js_round(fx3 + (M.hash_n(float(i) * 5.0) - 0.5) * 12),
					M.js_round(fy3 + (M.hash_n(float(i) * 7.0) - 0.5) * 8),
					int(M.P["v2"]))


## `w.run((function* () { yield 0.15 + i * 0.045; ... })())`
static func _caravan_shard(c, X: float, Y: float, i: int):
	var box: Array = []
	var g = GEN.new(func():
		_caravan_shard_body(c, X, Y, i, box[0])
		return null)
	box.append(g)
	return g


static func _caravan_shard_body(c, X: float, Y: float, i: int, g) -> void:
	var w = c.w
	g.y(0.15 + float(i) * 0.045)
	var a: float = c.rng.range(0, M.TAU)
	var d: float = c.rng.range(5, 52)
	w.parts.add({"k": "shard", "x": X + V8M.v8_cos(a) * d, "y": Y + V8M.v8_sin(a) * d * 0.8,
			"z": 90, "vx": 0, "vy": 0, "vz": -40, "grav": 120,
			"size": c.rng.range(3, 6), "rot": c.rng.range(0, M.TAU),
			"vr": c.rng.range(-8, 8), "c1": int(M.P["v2"]),
			"c2": int(M.P["v1"]), "c3": int(M.P["y2"]), "land": 2, "max": 3})
