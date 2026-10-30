class_name VenomS3
extends RefCounted

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")

## Native port of the ORIGINAL Venomwright `src/game/skills/s2.ts` skill 07
## HATCHERY FALL: the `Cocoon` summon (seamed shell, inner organisms, pulse
## band, insect transformation), the `Hatchling` summons (worm body, mandibles)
## and the full `hatchery()` cast: arc throw, impact ring / shake / shock /
## cracks decal, three rupture pulses releasing four hatchlings each, boids
## flocking with separation + alignment + cohesion, per-hatchling bite hits,
## the recall phase, the fuse-into-insect transformation and the final burst.
##
## PORT STATUS: written against the original source but NOT registered in
## `venom_skills.gd`, because it does not yet reproduce the original.
##
## Measured divergence (seed 7, oracle `venomwright_007.json`): the rendered
## raster matches the original for 89 ticks and then diverges at tick 90, and
## the boids-flock knockback angle drifts - hit 22 wants
## `ky=-3.414105`, the port produces `ky=-3.414103`. Hit counts (30/30) and
## cue counts (5/5) agree, so the authored timeline is right; something inside
## the hatchling flocking update accumulates a small error before the first
## rupture pulse.
##
## `Math.hypot` has been ported faithfully (`M.hypot`) and applied throughout
## this file, which was the most likely suspect - the original measures every
## distance with `Math.hypot` and the port used `sqrt(x*x + y*y)`. It did not
## close the gap, so the cause is still open.
##
## Register case 7 only once the differential reports a clean match. An
## unregistered generator cannot be counted as source-native-executable, and
## shipping it registered would turn the skill-7 differential shard red.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2P = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")


# ---------------------------------------------------------------------------
# 07 HATCHERY FALL
# ---------------------------------------------------------------------------


class Cocoon extends FX.Fx:
	var open: float = 0.0
	var pulseY: float = -1.0
	var ruptured: Array = [false, false, false]
	var trans: float = 0.0
	var glowAdd: float = 0.0
	var shake: float = 0.0
	var grow: float = 1.0
	var z: float = 0.0
	var vis: float = 1.0

	func _init(px: float, py: float) -> void:
		x = px
		y = py
		r = 12
		push = true
		kind = "summon"
		sy = py

	func upd(_w, _dt: float) -> void:
		sy = y

	func shd(g, _w) -> void:
		g.s.dl = 9
		g.s.ellipse(x + 2, y + 5, 14 * grow, 6, int(M.P["bk"]))
		g.s.dl = 16

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var bx: float = x + (V8M.v8_sin(t * 80) * shake if shake > 0 else 0)
		var cy: float = y - 14 - z
		var op: float = open
		if trans > 0.05:
			_draw_insect(g, bx, cy)
			if trans > 0.6:
				return
		var sc: float = (1 - M.smoothstep((trans - 0.05) * 3)) * grow
		if sc <= 0.05:
			return
		L.dl = M.js_round(16 * vis)
		DRAW.ball(L, bx, cy, 12 * sc + op * 1.5, MATS.PAL()["chitin"], 15 * sc)
		for i in range(-3, 4):
			var a: float = float(i) / 3.0 * 1.15
			var px: float = bx + V8M.v8_sin(a) * 12 * sc * (1 + op * 0.5)
			var top: float = cy - V8M.v8_cos(a) * 15 * sc
			var bot: float = cy + V8M.v8_cos(a) * 15 * sc
			var seam: float = (V8M.v8_sin(t * 4 + float(i)) + 1) / 2
			var rup: bool = (bool(ruptured[0]) if i < -1 else (bool(ruptured[1]) if i < 2 else bool(ruptured[2]))) and op > 0.3
			var col: int = int(M.P["k0"]) if rup else M.mix(
					int(M.P["e3"]),
					int(M.P["g2"]) if i % 2 != 0 else int(M.P["c2"]),
					seam * 0.8 + glowAdd)
			L.line(px, top + 2, px + (1.0 if a > 0 else -1.0) * op * 2, bot - 2, col)
			L.px(M.js_round(px + 1), M.js_round(cy - 4 + float(i)), int(M.P["k0"]))
			for k in range(4):
				L.px(M.js_round(px + (-1.0 if a > 0 else 1.0)),
						M.js_round(M.lerpf(top, bot, float(k + 1) / 5.0)),
						M.mix(int(M.P["n2"]), int(M.P["n3"]), float(k) / 4.0))
		for i in range(3):
			var ox: float = float(i - 1) * 5 * sc
			var oy: float = (float(-1) if i % 2 != 0 else 1.0) * 4 * sc
			var s: float = (0.6 + 0.4 * V8M.v8_sin(t * 2 + float(i) * 2)) * minf(1.0, age * 0.5 + 0.4)
			L.arc(bx + ox, cy + oy, 3 * s * sc + 0.5, 1.5, 0.4 + float(i), 4.2 + float(i),
					int(M.P["g1"]))
			L.px(M.js_round(bx + ox + 2), M.js_round(cy + oy - 1), int(M.P["c3"]))
		if pulseY >= 0:
			var py: float = cy + 15 * sc - pulseY * 30 * sc
			for dx in range(-10, 11):
				var q: float = sqrt(maxf(0.0, 1 - V8M.v8_pow((py - cy) / (15 * sc), 2.0))) * 12 * sc
				if absf(float(dx)) < q:
					L.px(M.js_round(bx + float(dx)), M.js_round(py), int(M.P["c3"]))
					if absi(dx) % 2 != 0:
						L.px(M.js_round(bx + float(dx)), M.js_round(py - 1), int(M.P["g2"]))
		for s in [-1.0, 1.0]:
			L.poly([bx + s * 6 * sc, cy - 12 * sc,
					bx + s * (11 + op * 7) * sc, cy - 11 * sc - op * 2,
					bx + s * (9 + op * 8) * sc, cy - 4 * sc,
					bx + s * 4 * sc, cy - 9 * sc], int(M.P["n1"]))
		L.dl = 16

	func _draw_insect(g, bx: float, cy: float) -> void:
		var L = g.s
		var t: float = g.t
		var k: float = M.smoothstep(minf(1.0, trans))
		var s: float = k
		var by: float = cy + 4 - k * 4
		var hot: Dictionary = MATS.PAL()["chitinHot"]
		var pc: int = M.mix(int(M.P["c1"]), int(M.P["g2"]), 0.3)
		for sd in [-1.0, 1.0]:
			L.dl = 9
			L.poly([bx + sd * 4 * s, by - 8 * s,
					bx + sd * 22 * s, by - 24 * s,
					bx + sd * 26 * s, by - 10 * s,
					bx + sd * 10 * s, by - 2 * s], pc)
			L.dl = 16
			for i in range(4):
				L.line(bx + sd * 5 * s, by - 7 * s,
						bx + sd * (14 + float(i) * 4) * s, by - (20 - float(i) * 3) * s,
						int(M.P["g1"]))
		for i in range(3):
			for sd in [-1.0, 1.0]:
				var ph: float = V8M.v8_sin(t * 6 + float(i) + sd) * 2
				L.line(bx + sd * 6 * s, by + float(i - 1) * 5 * s,
						bx + sd * (13 + float(i) * 2) * s,
						by + float(i - 1) * 8 * s + 6 + ph, int(M.P["n3"]), 2)
				L.line(bx + sd * (13 + float(i) * 2) * s,
						by + float(i - 1) * 8 * s + 6 + ph,
						bx + sd * (16 + float(i) * 2) * s,
						by + float(i - 1) * 8 * s + 12, int(M.P["n2"]))
		DRAW.ball(L, bx, by - 7 * s, 11 * s, MATS.PAL()["chitin"], 12 * s)
		for i in range(4):
			L.arc(bx, by - 7 * s, (4 + float(i) * 2.2) * s, 1, 0.3, 2.84,
					M.mix(int(M.P["e3"]), int(M.P["g2"]), (V8M.v8_sin(t * 5 - float(i)) + 1) / 2),
					(5 + float(i) * 2.2) * s)
		DRAW.ball(L, bx, by + 6 * s, 8 * s, hot, 7 * s)
		for sd in [-1.0, 1.0]:
			var ex: float = bx + sd * 13 * s
			var ey: float = by + 4 * s
			var tx: float = ex + sd * 5 * s
			var ty: float = ey + 18 * s
			L.line(bx + sd * 6 * s, by + 3 * s, ex, ey, int(M.P["n1"]), 4)
			DRAW.ball(L, ex, ey, 3 * s, hot)
			DRAW.shard(L, ex, ey, V8M.v8_atan2(ty - ey, tx - ex), 20 * s, 3.2 * s,
					int(M.P["g2"]), int(M.P["g0"]), int(M.P["w"]))
			for i in range(1, 6):
				L.px(M.js_round(M.lerpf(ex, tx, float(i) / 6.0) - sd * 2),
						M.js_round(M.lerpf(ey, ty, float(i) / 6.0)), int(M.P["k0"]))
		DRAW.ball(L, bx, by + 14 * s, 5.5 * s, hot, 5 * s)
		for sd in [-1.0, 1.0]:
			DRAW.shard(L, bx + sd * 3 * s, by + 18 * s, PI / 2 + sd * 0.55, 6 * s, 1.5,
					int(M.P["i0"]), int(M.P["i2"]), int(M.P["w"]))
			L.disc(bx + sd * 2.6 * s, by + 13 * s, 1.2 * s, int(M.P["c1"]))
			L.px(M.js_round(bx + sd * 2.6 * s), M.js_round(by + 13 * s), int(M.P["w"]))

	func lit(g, _w) -> void:
		DRAW.glow(g.l, x, y - 14, 16 + trans * 22,
				int(M.P["g2"]) if trans > 0.1 else int(M.P["c1"]),
				0.18 + glowAdd * 0.5 + trans * 0.35, 4)


class Hatchling extends FX.Fx:
	var hd: float = 0.0
	var vx: float = 0.0
	var vy: float = 0.0
	var z: float = 0.0
	var cd: float = 0.0
	var tgt = null
	var idx: int = 0
	var recoil: float = 0.0
	var ph: float = 0.0
	var absorb: bool = false

	func _init(px: float, py: float, hd_: float, idx_: int) -> void:
		x = px
		y = py
		hd = hd_
		idx = idx_
		r = 3
		kind = "summon"
		sy = py
		ph = M.hash_n(float(idx) * 9.0) * M.TAU

	func upd(_w, _dt: float) -> void:
		sy = y

	func shd(g, _w) -> void:
		g.s.dl = 8
		g.s.ellipse(x, y + 2, 4, 2, int(M.P["bk"]))
		g.s.dl = 16

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var fx2: float = V8M.v8_cos(hd)
		var fy2: float = V8M.v8_sin(hd)
		var qx: float = -fy2
		var qy: float = fx2
		var by: float = y - z - 2
		var w2: float = V8M.v8_sin(t * 22 + ph) * 0.8
		for i in range(2):
			for s in [-1.0, 1.0]:
				var ph2: float = V8M.v8_sin(t * 28 + float(i) * 2 + (1.6 if s > 0 else 0.0))
				L.line(x - fx2 * float(i) * 2 + qx * s,
						by + 1 - fy2 * float(i) * 1.5 + qy * s * 0.6,
						x - fx2 * float(i) * 2 + qx * s * 4 + fx2 * ph2 * 1.5,
						by + 3 + qy * s * 2, int(M.P["n3"]))
		var segs: Array = [
			{"x": x - fx2 * 5 - qx * w2 * 1.4, "y": by - fy2 * 4, "r": 2.4},
			{"x": x - fx2 * 2.6 + qx * w2, "y": by - fy2 * 2, "r": 2.5},
			{"x": x + fx2 * 0.6, "y": by + fy2 * 0.4, "r": 2.3}]
		DRAW.worm_body(L, segs, MATS.PAL()["chitin"], {})
		L.px(M.js_round(float(segs[0]["x"])), M.js_round(float(segs[0]["y"]) - 1),
				int(M.P["c3"]) if V8M.v8_sin(t * 8 + ph) > 0 else int(M.P["c1"]))
		var hx: float = x + fx2 * 3.2
		var hy: float = by + fy2 * 2
		DRAW.ball(L, hx, hy, 1.9, MATS.PAL()["chitin"])
		L.px(M.js_round(hx + qx), M.js_round(hy + qy - 1), int(M.P["g2"]))
		L.px(M.js_round(hx - qx), M.js_round(hy - qy - 1), int(M.P["g2"]))
		DRAW.shard(L, hx + fx2, hy + fy2, hd + 0.4, 2.6, 0.7,
				int(M.P["i0"]), int(M.P["i2"]), int(M.P["w"]))
		DRAW.shard(L, hx + fx2, hy + fy2, hd - 0.4, 2.6, 0.7,
				int(M.P["i0"]), int(M.P["i2"]), int(M.P["w"]))

	func lit(g, _w) -> void:
		DRAW.glow(g.l, x, y - 3, 3.5, int(M.P["c1"]), 0.22, 2)


static func hatchery(c):
	var box: Array = []
	var g = GEN.new(func():
		_hatchery(c, box[0])
		return null)
	box.append(g)
	return g


static func _hatchery(c, g) -> void:
	var w = c.w
	LIB.cast_anim(w, c)
	g.y(0.04)
	var hp: Array = LIB.hand_pos(w)
	var hx: float = float(hp[0])
	var hy: float = float(hp[1])
	var cx: float = c.tx
	var cy: float = c.ty
	LIB.throw_arc(w, "cocoon", hx, hy, cx, cy, 0.42, 38, func(_ww, _p): return null, 5)
	g.y(0.42)
	var cocoon = Cocoon.new(cx, cy)
	w.add(cocoon)
	var impact = FX.Hits.new()
	var bites = FX.Hits.new()
	var fin = FX.Hits.new()
	var res = FX.Hits.new()
	LIB.ring_at(c, cx, cy, 34, 0.28, 40, {"kind": "impact", "knock": 150,
			"stag": 0.4, "h": impact,
			"cols": [int(M.P["w"]), int(M.P["g1"]), int(M.P["n3"])],
			"w": 3, "dust": true})
	w.shake(5, 0.3)
	w.shock(cx, cy, 42, 0.3, 2.5)
	w.add(FX.GroundDecal.new(cx, cy, "cracks", 24, 9, c.id,
			{"a": int(M.P["k0"]), "b": int(M.P["n3"]), "c": int(M.P["g1"])}, 0, 1))
	FX.chips(w, cx, cy, 10, 90, int(M.P["n2"]), int(M.P["n0"]), int(M.P["g1"]),
			{"z": 4, "up": 90})
	FX.dust(w, cx, cy, 8, 30, 5)
	var n_open: int = LIB.tick_count(0.45)
	for i in range(1, n_open + 1):
		var k: float = float(i) / float(n_open)
		cocoon.open = M.smoothstep(k)
		cocoon.z = V8M.v8_sin(k * PI) * -1
		g.y(GEN.F)
	var swarm: Array = []
	var released: int = 0
	var tm: float = 0.0
	var pulse_t: Array = [0.15, 0.7, 1.25]
	var T_RET: float = 4.6
	var T_END: float = 5.7
	var phase: int = 0
	var released_box: Array = [0]
	var release := func(sec: int):
		cocoon.ruptured[sec] = true
		cocoon.glowAdd = 0.3
		w.shake(1.5, 0.12)
		for i in range(4):
			var a: float = float(sec - 1) * 1.0 + float(i - 1.5) * 0.7 + PI / 2
			var hh = Hatchling.new(cx + V8M.v8_cos(a) * 9, cy - 4 + V8M.v8_sin(a) * 4, a, released_box[0])
			released_box[0] += 1
			hh.vx = V8M.v8_cos(a) * 60
			hh.vy = V8M.v8_sin(a) * 50
			hh.z = 10
			swarm.append(hh)
			w.add(hh)
		FX.drops(w, cx + float(sec - 1) * 8, cy - 8, 12, 70,
				int(M.P["g2"]), int(M.P["c3"]), int(M.P["c1"]),
				{"z": 10, "glow": 1, "up": 80})
		FX.shards(w, cx, cy - 8, 3, 60, int(M.P["n2"]), int(M.P["n0"]),
				int(M.P["g1"]), {"z": 12, "land": 3, "size": [2, 4]})
		w.add(FX.Flash.new(cx + float(sec - 1) * 8, cy - 12, 10,
				int(M.P["g2"]), 0.25, 8))
	while tm < T_END:
		for s in range(3):
			var q: float = tm - float(pulse_t[s])
			if q >= 0 and q < 0.4:
				cocoon.pulseY = q / 0.4
			if q >= 0.4 and q < 0.4 + GEN.F and not bool(cocoon.ruptured[s]):
				release.call(s)
		if tm > 1.8 and cocoon.pulseY >= 0 and tm - float(pulse_t[2]) > 0.4:
			cocoon.pulseY = -1
		if tm > T_RET and phase == 0:
			phase = 1
		var live: Array = []
		for h in swarm:
			if not h.dead and not h.absorb:
				live.append(h)
		var gx: float = 0.0
		var gy: float = 0.0
		for h in live:
			gx += h.x
			gy += h.y
		if live.size() > 0:
			gx /= float(live.size())
			gy /= float(live.size())
		for h in live:
			h.z = maxf(0.0, h.z - 90 * GEN.F)
			h.cd -= GEN.F
			h.recoil -= GEN.F
			var has_tgt: bool = h.tgt != null and float(h.tgt.dying) <= 0
			if phase == 0 and not has_tgt:
				var cand: Array = []
				for e in w.enemies:
					if e.dying <= 0:
						cand.append({"e": e,
								"d": M.hypot(e.x - h.x, e.y - h.y)})
				M.stable_sort(cand, func(a, b): return float(a["d"]) - float(b["d"]))
				h.tgt = cand[mini(cand.size() - 1, h.idx % 3)]["e"] if cand.size() > 0 else null
			var tx: float = h.x
			var ty: float = h.y
			if phase == 1:
				tx = cx
				ty = cy - 4
			elif h.tgt != null:
				tx = h.tgt.x
				ty = h.tgt.y
			else:
				tx = cx
				ty = cy
			var d: float = M.hypot(tx - h.x, ty - h.y)
			if d == 0.0:
				d = 1.0
			var ux: float = (tx - h.x) / d
			var uy: float = (ty - h.y) / d
			var sw: float = V8M.v8_sin(tm * 3.2 + h.ph) * (0.8 if phase == 0 else 0.5) \
					* M.clampf(d / 40, 0.2, 1)
			var vx: float = ux - uy * sw
			var vy: float = uy + ux * sw
			var sx: float = 0.0
			var sy: float = 0.0
			var ax: float = 0.0
			var ay: float = 0.0
			var n: int = 0
			for o in live:
				if o == h:
					continue
				var dx: float = h.x - o.x
				var dy: float = h.y - o.y
				var dd: float = M.hypot(dx, dy)
				if dd < 7 and dd > 0.1:
					sx += dx / dd * (7 - dd) * 0.25
					sy += dy / dd * (7 - dd) * 0.25
				if dd < 32:
					ax += o.vx
					ay += o.vy
					n += 1
			if n > 0:
				vx += (ax / float(n) / 90) * 0.35
				vy += (ay / float(n) / 90) * 0.35
			vx += sx
			vy += sy
			vx += ((gx - h.x) / 100) * 0.12
			vy += ((gy - h.y) / 100) * 0.12
			var vl: float = M.hypot(vx, vy)
			if vl == 0.0:
				vl = 1.0
			var spd: float = (-35.0 if h.recoil > 0 else (105.0 if phase == 1 else 88.0)) \
					* (1 + 0.1 * V8M.v8_sin(h.ph))
			h.vx += (vx / vl * spd - h.vx) * 0.14
			h.vy += (vy / vl * spd - h.vy) * 0.14
			if w.get("hatch_trace") and h.idx == 0:
				print("GOLD93_HTR t=%d tm=%.12f tx=%.12f ty=%.12f d=%.12f sw=%.12f vx=%.12f vy=%.12f vl=%.12f spd=%.12f nvx=%.12f nvy=%.12f" % [w.frame, tm, tx, ty, d, sw, vx, vy, vl, spd, h.vx, h.vy])
			h.x += h.vx * GEN.F
			h.y += h.vy * GEN.F
			h.hd += M.ang_diff(h.hd, V8M.v8_atan2(h.vy, h.vx)) * 0.25 \
					* (0 if h.recoil > 0 else 1)
			h.x = M.clampf(h.x, 6, w.W - 6)
			h.y = M.clampf(h.y, 8, w.H - 6)
			if phase == 1 and M.hypot(h.x - cx, h.y - cy + 4) < 7:
				h.absorb = true
				h.dead = true
				cocoon.glowAdd = minf(1.0, cocoon.glowAdd + 0.1)
				w.add(FX.Flash.new(cx, cy - 10, 8, int(M.P["g2"]), 0.15, 4))
			if phase == 1 and int(floor(tm * 60.0)) % 3 == 0:
				w.parts.add({"k": "mote", "x": h.x, "y": h.y, "z": 3, "max": 0.3,
						"c1": int(M.P["c2"]), "c2": int(M.P["g1"]), "glow": 1})
			if phase == 0:
				for e in w.enemies:
					if e.dying > 0 or h.cd > 0:
						continue
					if M.hypot(e.x - h.x, e.y - h.y) < e.r + 3.5 \
							and bites.ok(e, w.time, 0.2, 6):
						LIB.hit_e(c, e, 14, {"kind": "bite", "k": 40,
								"from": [h.x, h.y], "stag": 0.12, "at": [h.x, h.y]})
						h.cd = 0.55
						h.recoil = 0.14
						w.parts.add({"k": "spark", "x": h.x, "y": h.y, "z": 4,
								"vx": h.vx * 0.3, "vy": -10, "vz": 20, "max": 0.2,
								"c1": int(M.P["g2"])})
		if phase == 1 and live.size() == 0 and tm > T_RET + 0.3:
			break
		g.y(GEN.F)
		tm += GEN.F
	for h in swarm:
		if not h.dead:
			h.dead = true
			w.add(FX.Flash.new(h.x, h.y, 5, int(M.P["g2"]), 0.15, 3))
	var n_fuse: int = LIB.tick_count(1.0)
	for i in range(1, n_fuse + 1):
		var k: float = float(i) / float(n_fuse)
		cocoon.trans = k
		cocoon.shake = 0.4 + k * 1.4
		cocoon.z = k * 4
		if int(floor(k * 60.0)) % 4 == 0:
			w.parts.add({"k": "spark", "x": cx + c.rng.range(-16, 16),
					"y": cy - 14 + c.rng.range(-14, 14), "z": 2, "vx": 0, "vy": 0,
					"vz": 20, "max": 0.3, "c1": int(M.P["g2"])})
		g.y(GEN.F)
	g.y(0.35)
	var n_collapse: int = LIB.tick_count(0.22)
	for i in range(1, n_collapse + 1):
		var k: float = float(i) / float(n_collapse)
		cocoon.trans = 1 - k * 0.2
		cocoon.shake = 3
		g.y(GEN.F)
	cocoon.dead = true
	cocoon.push = false
	w.screen_flash(int(M.P["g2"]), 0.45, 0.18)
	w.shake(7, 0.5)
	w.shock(cx, cy - 10, 100, 0.5, 4)
	w.hitstop = 0.05
	LIB.ring_at(c, cx, cy, 82, 0.42, 110, {"kind": "burst", "knock": 190,
			"stag": 0.5, "h": fin,
			"cols": [int(M.P["w"]), int(M.P["g2"]), int(M.P["c1"])],
			"w": 5, "dust": true})
	w.add(FX.Flash.new(cx, cy - 12, 38, int(M.P["c3"]), 0.4, 10))
	FX.chips(w, cx, cy - 12, 38, 170, int(M.P["n2"]), int(M.P["n0"]),
			int(M.P["g1"]), {"z": 14, "up": 180, "size": [3, 7]})
	FX.chips(w, cx, cy - 12, 12, 130, int(M.P["g2"]), int(M.P["g0"]),
			int(M.P["w"]), {"z": 14, "up": 150, "size": [3, 5]})
	FX.drops(w, cx, cy - 12, 46, 150, int(M.P["c1"]), int(M.P["c3"]),
			int(M.P["e2"]), {"z": 14, "up": 170, "glow": 2, "size": [2, 4],
					"max": 2.4})
	for i in range(24):
		w.parts.add({"k": "mote", "x": cx, "y": cy - 10, "z": 12,
				"vx": c.rng.range(-80, 80), "vy": c.rng.range(-60, 60),
				"vz": c.rng.range(20, 100), "grav": 40,
				"max": c.rng.range(1.2, 2.4), "c1": int(M.P["c2"]),
				"c2": int(M.P["g1"]), "glow": 2, "drag": 1.2})
	w.add(FX.Pool.new(cx, cy, 28, MATS.MAT()["acid"], 6, {"blobs": 7,
			"boil": 2, "tick": {"every": 0.85, "amt": c.d(15.33),
					"opts": {"kind": "acid", "src": c.def["id"]}, "h": res,
					"max": 3}}))
	w.add(FX.GroundDecal.new(cx, cy, "crater", 20, 8, c.id,
			{"a": int(M.P["k0"]), "b": int(M.P["n3"]), "c": int(M.P["g1"])}, 0, 1.2))
	for i in range(4):
		var a: float = (float(i) / 4.0) * M.TAU
		S2P.plume(w, cx + V8M.v8_cos(a) * 14, cy + V8M.v8_sin(a) * 9, 24, 1.0, MATS.VAP()["gold"],
				9, i, float(i) * 0.05)
	g.y(1.1)
