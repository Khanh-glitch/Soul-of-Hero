class_name VenomFx
extends RefCounted

## Native port of the shared scaffolding of the ORIGINAL Venomwright
## `src/game/fx.ts`: the `Fx` base class, the particle system, the ground
## effects (Splash / Embed / Flash / Ring / Pool / GroundDecal), the volumetric vapour
## puff, `Cloud`, `Proj` and `Shot`.
##
## Everything here is transcribed 1:1. The rules proven by the bit-exact ground
## parity test apply throughout:
##   * `Math.round` -> `M.js_round` (floor(v + 0.5)),
##   * packed colours are 0xAABBGGRR,
##   * a `for`-loop bound that calls the RNG is NEVER hoisted (the original
##     re-evaluates it every iteration, burning one draw per step),
##   * swap-remove (`L[i] = L[L.length-1]; L.pop()`) is preserved exactly,
##     because it changes the order in which particles are drawn.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")
const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")


# ---------------------------------------------------------------------------
# Fx — the base entity
# ---------------------------------------------------------------------------

class Fx extends RefCounted:
	var dead: bool = false
	var age: float = 0.0
	var x: float = 0.0
	var y: float = 0.0
	var r: float = 0.0
	var sy: float = 0.0
	var tank: bool = false
	var hp: float = 0.0
	var maxHp: float = 0.0
	var push: bool = false
	var kind: String = "fx"
	var resid: bool = false
	var hf: float = 0.0

	# Optional render hooks, dispatched by World.draw in z-order:
	#   gnd (on the ground) -> shd (shadow) -> up (upright, on the actor plane)
	#   -> air (above everything) -> lit (additive glow pass)
	func upd(_w, _dt: float) -> void:
		pass

	func hurt(_w, amt: float) -> void:
		hp -= amt
		hf = 0.12

	func gnd(_g, _w) -> void:
		pass

	func shd(_g, _w) -> void:
		pass

	func up(_g, _w) -> void:
		pass

	func air(_g, _w) -> void:
		pass

	func lit(_g, _w) -> void:
		pass


# ---------------------------------------------------------------------------
# Particles
# ---------------------------------------------------------------------------

class Part extends RefCounted:
	var k: String = "drop"
	var x: float = 0.0
	var y: float = 0.0
	var z: float = 0.0
	var vx: float = 0.0
	var vy: float = 0.0
	var vz: float = 0.0
	var age: float = 0.0
	var max: float = 1.0
	var size: float = 1.0
	var rot: float = 0.0
	var vr: float = 0.0
	var grav: float = 0.0
	var drag: float = 0.0
	var c1: int = 0
	var c2: int = 0
	var c3: int = 0
	var land: int = 0
	var seed: int = 0
	var glow: float = 0.0
	var bounce: int = 0
	var trail: float = 0.0
	var fn = null


class Particles extends RefCounted:
	var list: Array = []
	var n: int = 0

	func add(o: Dictionary):
		if list.size() > 4200:
			return null
		n += 1
		var p := Part.new()
		p.k = o.get("k", "drop")
		p.x = o.get("x", 0.0)
		p.y = o.get("y", 0.0)
		p.z = o.get("z", 0.0)
		p.vx = o.get("vx", 0.0)
		p.vy = o.get("vy", 0.0)
		p.vz = o.get("vz", 0.0)
		p.age = o.get("age", 0.0)
		p.max = o.get("max", 1.0)
		p.size = o.get("size", 1.0)
		p.rot = o.get("rot", 0.0)
		p.vr = o.get("vr", 0.0)
		p.grav = o.get("grav", 0.0)
		p.drag = o.get("drag", 0.0)
		p.c1 = o.get("c1", int(M.P["c1"]))
		p.c2 = o.get("c2", int(M.P["c3"]))
		p.c3 = o.get("c3", int(M.P["e1"]))
		p.land = o.get("land", 0)
		p.seed = o.get("seed", n)
		p.glow = o.get("glow", 0.0)
		p.bounce = o.get("bounce", 0)
		p.trail = o.get("trail", 0.0)
		p.fn = o.get("fn", null)
		list.append(p)
		return p

	func clear() -> void:
		list.clear()
		n = 0

	func update(w, dt: float) -> void:
		var L: Array = list
		for i in range(L.size() - 1, -1, -1):
			var p = L[i]
			p.age += dt
			var dead: bool = p.age >= p.max
			if p.fn != null:
				p.fn.call(p, w, dt)
			p.vz -= p.grav * dt
			if p.drag != 0.0:
				var kk: float = maxf(0.0, 1.0 - p.drag * dt)
				p.vx *= kk
				p.vy *= kk
				if p.k != "drop":
					p.vz *= kk
			p.x += p.vx * dt
			p.y += p.vy * dt
			p.z += p.vz * dt
			p.rot += p.vr * dt
			if p.land and p.z <= 0 and p.vz < 0 and not dead:
				p.z = 0
				if p.land == 3 and p.bounce < 2:
					p.vz = -p.vz * 0.4
					p.vx *= 0.55
					p.vy *= 0.55
					p.bounce += 1
					p.vr *= 0.5
				else:
					dead = true
					if p.land == 1:
						w.add(Splash.new(p.x, p.y, maxf(2, p.size * 1.3), p.c1, p.c2))
					elif p.land == 2:
						w.add(Embed.new(p.x, p.y, p.size, p.c1, p.c2, p.c3, 5 + (p.seed % 4)))
					elif p.land == 4:
						w.add(Splash.new(p.x, p.y, maxf(2, p.size * 1.3), p.c1, p.c2))
			if p.k == "bubble" and p.age >= p.max:
				w.parts.add({"k": "spark", "x": p.x, "y": p.y, "z": p.z + 1, "vx": 12,
						"vy": -6, "vz": 8, "max": 0.2, "c1": p.c3})
				w.parts.add({"k": "spark", "x": p.x, "y": p.y, "z": p.z + 1, "vx": -12,
						"vy": -5, "vz": 8, "max": 0.2, "c1": p.c3})
			if dead:
				L[i] = L[L.size() - 1]
				L.pop_back()

	func shadows(g) -> void:
		var L = g.s
		L.dl = 6
		for p in list:
			if p.z > 2 and (p.k == "drop" or p.k == "chip" or p.k == "shard"):
				L.dot(p.x, p.y, int(M.P["bk"]))
		L.dl = 16

	func draw(g) -> void:
		var L = g.s
		for p in list:
			var a: float = p.age / p.max
			var px: float = p.x
			var py: float = p.y - p.z
			match p.k:
				"drop":
					var s: float = p.size
					if p.trail and absf(p.vz) > 35:
						var tl: int = mini(4, int(floor(absf(p.vz) * 0.02)))
						for i in range(1, tl + 1):
							L.dl = 12 - i * 2
							L.dot(px, py - (-i * 1.2 if p.vz < 0 else i * 1.2), p.c3)
						L.dl = 16
					if s <= 1.2:
						L.dot(px, py, p.c1)
					elif s <= 2.2:
						L.disc(px, py, s * 0.5, p.c1)
						L.dot(px, py - 0.4, p.c2)
					elif s <= 3.2:
						L.disc(px, py, s * 0.5, p.c3)
						L.disc(px, py, s * 0.35, p.c1)
						L.dot(px - 0.5, py - 0.5, p.c2)
					else:
						L.disc(px, py, s * 0.55, p.c3)
						L.disc(px, py, s * 0.4, p.c1)
						L.dot(px - 0.6, py - 0.6, p.c2)
						L.dot(px + 0.2, py - 0.6, p.c2)
				"shard":
					DRAW.shard(L, px, py, p.rot, p.size, p.size * 0.42, p.c1, p.c2, p.c3)
				"chip":
					var cs: float = maxf(1.5, p.size)
					var ca: float = cos(p.rot)
					var sa: float = sin(p.rot)
					L.poly([px - ca * cs - sa * cs * 0.6, py - sa * cs + ca * cs * 0.6,
							px + ca * cs - sa * cs * 0.6, py + sa * cs + ca * cs * 0.6,
							px + ca * cs + sa * cs * 0.6, py + sa * cs - ca * cs * 0.6,
							px - ca * cs + sa * cs * 0.6, py - sa * cs - ca * cs * 0.6], p.c1)
					L.line(px - ca * cs - sa * cs * 0.6, py - sa * cs + ca * cs * 0.6,
							px + ca * cs - sa * cs * 0.6, py + sa * cs + ca * cs * 0.6, p.c3)
					L.dot(px, py, p.c2)
				"bubble":
					var wob: float = sin(p.age * 6 + float(p.seed)) * 0.8
					DRAW.bubble(L, px + wob, py, p.size, p.c1, p.c2, p.c3)
				"spore":
					L.dot(px, py, p.c1)
					if p.size > 1:
						L.dot(px + 0.8, py, p.c2)
						L.dot(px - 0.8, py, p.c2)
						L.dot(px, py + 0.8, p.c2)
						L.dot(px, py - 0.8, p.c2)
				"steam":
					var rr: float = p.size * (0.5 + a * 0.9)
					L.dl = maxi(1, M.js_round(9 * (1 - a)))
					L.disc(px, py, rr, p.c1)
					L.dl = maxi(1, M.js_round(7 * (1 - a)))
					L.disc(px - rr * 0.3, py - rr * 0.35, rr * 0.55, p.c2)
					L.dl = 16
				"dust":
					var dr: float = p.size * (0.6 + a * 0.8)
					L.dl = maxi(1, M.js_round(10 * (1 - a)))
					L.disc(px, py, dr, p.c1)
					L.dl = maxi(1, M.js_round(6 * (1 - a)))
					L.disc(px - 0.8, py - 0.8, dr * 0.6, p.c2)
					L.dl = 16
				"spark":
					L.dot(px, py, p.c1)
					if a < 0.7:
						L.dot(p.x - p.vx * 0.03, p.y - p.vy * 0.03 - p.z + p.vz * 0.03,
								M.mix(p.c1, int(M.P["k0"]), 0.5) if p.c2 != 0 else p.c1)
				"petal":
					var pc: float = cos(p.rot) * p.size
					var ps: float = sin(p.rot) * p.size * 0.6
					L.poly([px - pc, py - ps, px, py - ps * 0.5 - 1, px + pc, py + ps,
							px, py + ps * 0.5 + 1], p.c1)
					L.dot(px, py, p.c2)
				"ember":
					L.dot(px, py, p.c1)
					L.dot(px, py + 0.8, p.c2)
				"mote":
					L.dot(px, py, p.c1)
					if a < 0.5:
						L.dot(px + 0.8, py, p.c2)

	func glows(g) -> void:
		var L = g.l
		L.add = true
		L.a = 70
		for p in list:
			if p.glow > 0:
				L.disc(p.x, p.y - p.z, p.glow, p.c1)
		L.add = false
		L.a = 255


# ---------------------------------------------------------------------------
# ground fx
# ---------------------------------------------------------------------------

class Splash extends Fx:
	var rad: float = 0.0
	var c1: int = 0
	var c2: int = 0

	func _init(px: float, py: float, rad_: float, a1: int, a2: int) -> void:
		x = px
		y = py
		rad = rad_
		c1 = a1
		c2 = a2

	func upd(_w, _dt: float) -> void:
		if age > 0.34:
			dead = true

	func gnd(g, _w) -> void:
		var a: float = age / 0.34
		var L = g.s
		var r: float = rad * (0.5 + a * 1.4)
		L.dl = M.js_round(14 * (1 - a * 0.8))
		var nn: int = 8
		for i in range(nn):
			var an: float = (float(i) / float(nn)) * M.TAU + M.hash_n(float(i) + x) * 0.5
			var rr: float = r * (0.8 + M.hash_n(i * 7 + y) * 0.4)
			var qx: float = x + cos(an) * rr
			var qy: float = y + sin(an) * rr * 0.8
			L.dot(qx, qy, c2 if a < 0.5 else c1)
			if a < 0.6:
				L.dot(x + cos(an) * rr * 0.6, y + sin(an) * rr * 0.5 - (1 - a) * 3, c1)
		L.ring(x, y, r * 0.8, 0.8, c1)
		L.dl = 16


class Embed extends Fx:
	var sz: float = 0.0
	var litC: int = 0
	var dark: int = 0
	var edge: int = 0
	var life: float = 0.0

	func _init(px: float, py: float, sz_: float, a1: int, a2: int, a3: int, life_: float) -> void:
		x = px
		y = py
		sy = py
		sz = sz_
		litC = a1
		dark = a2
		edge = a3
		life = life_

	func upd(_w, _dt: float) -> void:
		if age > life:
			dead = true

	func up(g, _w) -> void:
		var fade: float = (life - age) / 0.8 if life - age < 0.8 else 1.0
		var L = g.s
		L.dl = M.js_round(16 * fade)
		var s: float = maxf(2, sz)
		var lean: float = (M.hash_n(x * 3 + y) - 0.5) * 3
		var h: float = s * 1.4 + 1
		L.poly([x - 1.5, y, x + lean, y - h, x + 1.5, y], litC)
		L.poly([x, y, x + lean, y - h, x + 1.5, y], dark)
		L.dot(x + lean, y - h, edge)
		L.line(x - 1, y, x + lean * 0.8, y - h * 0.8, edge)
		L.dl = 16


class Flash extends Fx:
	var rad: float = 0.0
	var col: int = 0
	var dur: float = 0.22
	var z: float = 0.0

	func _init(px: float, py: float, rad_: float, col_: int, dur_: float = 0.22, z_: float = 0) -> void:
		x = px
		y = py
		rad = rad_
		col = col_
		dur = dur_
		z = z_

	func upd(_w, _dt: float) -> void:
		if age > dur:
			dead = true

	func air(g, _w) -> void:
		var a: float = age / dur
		var L = g.s
		var r: float = rad * (1 - a * 0.5)
		var yy: float = y - z
		L.dl = M.js_round(16 * (1 - a))
		L.disc(x, yy, r * 0.55, int(M.P["w"]))
		L.dl = M.js_round(12 * (1 - a))
		L.disc(x, yy, r * 0.8, col)
		L.dl = 16

	func lit(g, _w) -> void:
		DRAW.glow(g.l, x, y - z, rad * 2.2 * (1 - age / dur * 0.4), col,
				0.4 * (1 - age / dur), 5)


## Expanding hit ring. `o` mirrors the original option bag:
## { r0, w, cols:[Col,Col,Col], hit:{h,amt,opts,knock,stagger,cd,max}, fill, ease, dust }
class Ring extends Fx:
	var cur: float = 0.0
	var r1: float = 0.0
	var dur: float = 1.0
	var o: Dictionary = {}
	var col: Array = []

	func _init(px: float, py: float, r1_: float, dur_: float, o_: Dictionary = {}) -> void:
		x = px
		y = py
		r1 = r1_
		dur = dur_
		o = o_
		cur = o.get("r0", 0.0)
		col = o.get("cols", [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])])

	func upd(w, _dt: float) -> void:
		var t: float = M.clampf(age / dur, 0.0, 1.0)
		var e: float = 1 - pow(1 - t, float(o.get("ease", 2)))
		var prev: float = cur
		var r0: float = float(o.get("r0", 0.0))
		cur = r0 + (r1 - r0) * e
		var h: Dictionary = o.get("hit", {})
		if not h.is_empty():
			for en in w.enemies:
				if en.dying > 0:
					continue
				var dx: float = en.x - x
				var dy: float = en.y - y
				var d: float = sqrt(dx * dx + dy * dy)
				if (d - en.r <= cur and d + en.r >= prev - 4) or (d - en.r <= cur and o.get("fill", false)):
					var cd = h.get("cd", 1e18)
					var mx = h.get("max", 1e18)
					if not h["h"].ok(en, w.time, cd, mx):
						continue
					var kk: float = float(h.get("knock", 0.0))
					var nx: float = dx / d if d > 0.1 else 1.0
					var ny: float = dy / d if d > 0.1 else 0.0
					var opts: Dictionary = h["opts"].duplicate()
					opts["kx"] = nx * kk
					opts["ky"] = ny * kk
					opts["stagger"] = h.get("stagger", null)
					opts["at"] = [en.x - nx * en.r, en.y - ny * en.r]
					w.hit(en, float(h["amt"]), opts)
		if o.get("dust", false) and int(floor(age * 60)) % 2 == 0:
			var a: float = w.rng.next() * M.TAU
			w.parts.add({"k": "dust", "x": x + cos(a) * cur, "y": y + sin(a) * cur,
					"z": 1, "vx": cos(a) * 12, "vy": sin(a) * 12 - 4, "max": 0.5,
					"size": 3, "c1": int(M.P["i3"]), "c2": int(M.P["i2"])})
		if age >= dur:
			dead = true

	func gnd(g, _w) -> void:
		var t: float = age / dur
		var L = g.s
		var wd: float = maxf(1, float(o.get("w", 3)) * (1 - t * 0.7))
		if o.get("fill", false):
			L.dl = M.js_round(3 * (1 - t))
			L.disc(x, y, cur, col[2])
			L.dl = 16
		L.dl = M.js_round(16 * (1 - t * t))
		if L.dl == 0:
			L.dl = 1
		L.ring(x, y, maxf(0.5, cur - 1), wd + 1, col[2])
		L.ring(x, y, cur, maxf(0.8, wd - 1), col[1])
		L.ring(x, y, cur + 1, 0.8, col[0])
		L.dl = 16

	func lit(g, _w) -> void:
		var L = g.l
		L.add = true
		L.a = M.js_round(90 * (1 - age / dur))
		L.ring(x, y, cur, 2, col[1])
		L.add = false
		L.a = 255


## Persistent liquid pool with metaball blobs, boil bubbles and tick damage.
class Pool extends Fx:
	var blobs: Array = []
	var nt: float = 0.0
	var seed: int = 0
	var rad: float = 0.0
	var mat: Dictionary = {}
	var life: float = 0.0
	var o: Dictionary = {}

	func _init(px: float, py: float, rad_: float, mat_: Dictionary, life_: float, o_: Dictionary = {}) -> void:
		x = px
		y = py
		sy = py
		rad = rad_
		mat = mat_
		life = life_
		o = o_
		seed = int(o.get("seed", int(floor(M.hash_n(x * 13 + y) * 1000))))
		resid = o.get("resid", true)
		kind = "pool"
		r = rad_
		var rr = RNG.new(seed + 5)
		var n: int = int(o.get("blobs", 5))
		blobs.append({"dx": 0.0, "dy": 0.0, "r": rad_ * 0.62})
		for i in range(n):
			var a: float = rr.range(0.0, M.TAU)
			var d: float = rad_ * rr.range(0.25, 0.62)
			blobs.append({"dx": cos(a) * d, "dy": sin(a) * d * 0.9,
					"r": rad_ * rr.range(0.28, 0.5)})

	func upd(w, dt: float) -> void:
		if age > life:
			dead = true
			return
		var gs: float = M.smoothstep(age / float(o.get("grow", 0.3)))
		var boil = float(o.get("boil", 0.0))
		if boil != 0.0 and w.rng.next() < boil * dt * 60 * 0.1:
			var a: float = w.rng.range(0.0, M.TAU)
			var d: float = w.rng.range(0.0, rad * 0.7 * gs)
			w.parts.add({"k": "bubble", "x": x + cos(a) * d, "y": y + sin(a) * d * 0.8,
					"z": 0, "vz": w.rng.range(5, 12), "max": w.rng.range(0.4, 0.9),
					"size": w.rng.range(1.5, 3.2), "c1": mat["ramp"][3],
					"c2": mat["rim"], "c3": mat["hi"]})
		var tick: Dictionary = o.get("tick", {})
		if not tick.is_empty():
			nt -= dt
			if nt <= 0 and gs > 0.6:
				nt += float(tick["every"])
				for e in w.enemies:
					if e.dying > 0:
						continue
					var dx: float = e.x - x
					var dy: float = (e.y - y) * 1.1
					if sqrt(dx * dx + dy * dy) < rad * 0.85 * gs + e.r * 0.6 \
							and tick["h"].ok(e, w.time, float(tick["every"]) * 0.8,
									float(tick.get("max", 1e18))):
						var opts: Dictionary = tick["opts"].duplicate()
						opts["at"] = [e.x, e.y]
						w.hit(e, float(tick["amt"]), opts)

	func gnd(g, _w) -> void:
		var gs: float = M.smoothstep(age / float(o.get("grow", 0.3)))
		var rem: float = life - age
		var f = g.f
		f.reset()
		for b in blobs:
			f.disc(x + b["dx"] * gs, y + b["dy"] * gs,
					b["r"] * gs * (1 + sin(g.t * 3 + b["dx"]) * 0.03), 0.25)
		var dl: int = 16
		if rem < 1:
			dl = maxi(2, M.js_round(16 * rem))
		f.shade(g.s, mat, g.t, {"seed": seed, "fx": float(o.get("flowX", mat["fx"])),
				"fy": float(o.get("flowY", mat["fy"])), "dl": dl})

	func lit(g, _w) -> void:
		var gs: float = M.smoothstep(age / float(o.get("grow", 0.3)))
		var rem: float = life - age
		DRAW.glow(g.l, x, y, rad * 1.3 * gs, mat["ramp"][3],
				0.18 * M.clampf(rem, 0.0, 1.0), 3)


## Pre-baked glowing ground decal. Pixel list is generated once (so the cracks /
## veins / pits never crawl) and replayed with a travelling highlight.
class GroundDecal extends Fx:
	var pxs: Array = []
	var glowCol: int = 0
	var size: float = 0.0
	var life: float = 0.0
	var cols: Dictionary = {}
	var pulse: float = 1.2

	func _init(px: float, py: float, kind_: String, size_: float, life_: float,
			seed: int, cols_: Dictionary, ang: float = 0, pulse_: float = 1.2) -> void:
		x = px
		y = py
		size = size_
		life = life_
		cols = cols_
		pulse = pulse_
		glowCol = cols_["c"]
		var r = RNG.new(seed * 7 + 3)
		if kind_ == "veins":
			_branch(r, 0.0, 0.0, 0.0, 0, 0)
			pxs.sort_custom(func(p, q): return (0 if p["g"] < 0 else 1) - (0 if q["g"] < 0 else 1))
		elif kind_ == "cracks":
			var n: int = 5 + int(floor(size / 10))
			for i in range(n):
				var x0: float = 0.0
				var y0: float = 0.0
				var a0: float = (float(i) / float(n)) * M.TAU + r.range(-0.3, 0.3)
				var len: float = size * r.range(0.4, 1.0)
				for k in range(int(len)):
					a0 += r.range(-0.4, 0.4)
					x0 += cos(a0)
					y0 += sin(a0) * 0.9
					_push(x0, y0, cols_["a"])
					if k % 3 == 0:
						_push(x0 + 1, y0 + 1, cols_["b"])
					if k % 7 == 0:
						_push(x0, y0, cols_["c"], k)
		elif kind_ == "pits":
			var pn: int = int(floor(size * 0.9))
			for i in range(pn):
				var a: float = r.range(0.0, M.TAU)
				var d: float = sqrt(r.next()) * size
				var pr: float = r.range(0.8, 2.4)
				var qx: float = cos(a) * d
				var qy: float = sin(a) * d * 0.9
				for dy in range(-2, 3):
					for dx in range(-3, 4):
						var q: float = sqrt(pow(float(dx) / 1.3, 2.0) + pow(float(dy), 2.0))
						if q < pr:
							_push(qx + dx, qy + dy, cols_["a"])
						elif q < pr + 1:
							_push(qx + dx, qy + dy, cols_["b"],
									i * 3 if r.next() < 0.3 else -1)
		elif kind_ == "crater":
			var a2: float = 0.0
			while a2 < M.TAU:
				var rr: float = size * (0.92 + M.hash_n(int(floor(a2 * 9)) + seed) * 0.12)
				_push(cos(a2) * rr, sin(a2) * rr * 0.85 - 1, cols_["b"])
				_push(cos(a2) * (rr + 1.4), sin(a2) * (rr + 1.4) * 0.85 - 1,
						cols_["c"] if a2 > 3.5 and a2 < 5.6 else cols_["b"])
				_push(cos(a2) * (rr - 1.3), sin(a2) * (rr - 1.3) * 0.85, cols_["a"])
				a2 += 0.04
			for i in range(int(size * 1.4)):
				var ca: float = r.range(0.0, M.TAU)
				var cd: float = r.range(size * 0.2, size * 0.88)
				_push(cos(ca) * cd, sin(ca) * cd * 0.85,
						cols_["c"] if i % 4 == 0 else cols_["a"],
						i * 2 if i % 4 == 0 else -1)
		elif kind_ == "crescent":
			for k in range(-1, 2):
				var a3: float = -1.15
				while a3 <= 1.15:
					var rr: float = size + float(k) * 1.1 + cos(a3 * 1.3) * 0
					var c: int = cols_["c"] if k == 0 else (cols_["b"] if k < 0 else cols_["a"])
					var qx: float = cos(a3 + ang) * rr
					var qy: float = sin(a3 + ang) * rr * 0.9
					var thick: float = (1 - absf(a3) / 1.3) * 2.3
					for t in range(int(thick)):
						_push(qx - cos(a3 + ang) * float(t) * 0.9,
								qy - sin(a3 + ang) * float(t) * 0.9, c,
								M.js_round((a3 + 1.2) * 20) if k == 0 else -1)
					a3 += 0.03
		elif kind_ == "scorch":
			for i in range(int(size * 2.4)):
				var sa: float = r.range(0.0, M.TAU)
				var sd: float = sqrt(r.next()) * size
				_push(cos(sa) * sd, sin(sa) * sd * 0.85,
						cols_["b"] if i % 9 == 0 else cols_["a"])

	func _push(px: float, py: float, c: int, g: int = -1) -> void:
		pxs.append({"x": px, "y": py, "c": c, "g": g})

	# veins: recursive branching, flattened to an explicit stack so GDScript does
	# not need a closure over `r`.
	func _branch(r, bx: float, by: float, a: float, len: int, depth: int, d0: int = 0) -> void:
		var stack: Array = [[bx, by, a, len, depth, d0]]
		while not stack.is_empty():
			var fr: Array = stack.pop_back()
			var x0: float = fr[0]
			var y0: float = fr[1]
			var a0: float = fr[2]
			var ln: int = fr[3]
			var dp: int = fr[4]
			var g0: int = fr[5]
			var branches: Array = []
			for i in range(ln):
				a0 += r.range(-0.45, 0.45)
				x0 += cos(a0)
				y0 += sin(a0) * 0.9
				var g: int = g0 + i
				_push(x0 + 1, y0, cols["a"])
				_push(x0, y0 + 1, cols["a"])
				_push(x0 - 1, y0, cols["a"])
				_push(x0, y0, cols["b"], g)
				if dp < 3 and i > 3 and r.next() < 0.12:
					branches.append([x0, y0, a0 + r.sign() * r.range(0.6, 1.2),
							int(floor(float(ln) * 0.55)), dp + 1, g])
			# original recurses immediately (depth-first); push in reverse so the
			# first branch is popped first
			for j in range(branches.size() - 1, -1, -1):
				stack.append(branches[j])

	func upd(_w, _dt: float) -> void:
		if age > life:
			dead = true

	func gnd(g, _w) -> void:
		var rem: float = life - age
		var vis: float = M.clampf(age / 0.12, 0.0, 1.0)
		var L = g.s
		var fade: float = rem / 1.2 if rem < 1.2 else 1.0
		var t: float = g.t * 22 * pulse
		for i in range(pxs.size()):
			var p: Dictionary = pxs[i]
			if fade < 1 and M.hash_n(i * 3 + 7) > fade:
				continue
			if vis < 1 and M.hash_n(i * 5 + 1) > vis:
				continue
			var c: int = p["c"]
			if p["g"] >= 0:
				var ph: float = fmod(fmod(t - float(p["g"]), 44.0) + 44.0, 44.0)
				if ph < 7:
					c = int(M.P["w"]) if ph < 2.5 else M.mix(cols["b"], int(M.P["w"]), 0.5)
			L.dot(x + p["x"], y + p["y"], c)

	func lit(g, _w) -> void:
		var rem: float = life - age
		var fade: float = rem / 1.2 if rem < 1.2 else 1.0
		var L = g.l
		L.add = true
		L.a = M.js_round(60 * fade)
		var t: float = g.t * 22 * pulse
		var i: int = 0
		while i < pxs.size():
			var p: Dictionary = pxs[i]
			if p["g"] >= 0:
				var ph: float = fmod(fmod(t - float(p["g"]), 44.0) + 44.0, 44.0)
				if ph < 7:
					L.dot(x + p["x"], y + p["y"], glowCol)
			i += 2
		L.add = false
		L.a = 255



class Cloud extends Fx:
	var vx: float = 0.0
	var vy: float = 0.0
	var fade: float = 1.0
	var dens: float = 11.0
	var nt: float = 0.0
	var shrink: float = 1.0
	var heightOff: float = 0.0
	var grow: Dictionary = {}
	var tickInfo: Dictionary = {}
	var puffs: Array = []
	var ramp: Array = []
	var life: float = 0.0
	var seed: int = 1

	func _init(px: float, py: float, puffs_: Array, ramp_: Array, life_: float, seed_: int = 1) -> void:
		x = px
		y = py
		sy = py
		kind = "cloud"
		resid = true
		puffs = puffs_
		ramp = ramp_
		life = life_
		seed = seed_

	func pos(p: Dictionary, t: float) -> Vector2:
		var a: float = float(p["ph"]) + t * float(p["sp"])
		return Vector2(x + (float(p["x"]) + cos(a) * float(p["orb"])) * shrink,
				y + (float(p["y"]) + sin(a) * float(p["orb"]) * float(p.get("sq", 0.6))) * shrink)

	func upd(w, dt: float) -> void:
		x += vx * dt
		y += vy * dt
		if not grow.is_empty():
			shrink = M.lerpf(float(grow["from"]), float(grow["to"]),
					M.smoothstep(age / float(grow["dur"])))
		if age > life:
			dead = true
			return
		if not tickInfo.is_empty():
			nt -= dt
			if nt <= 0:
				nt += float(tickInfo["every"])
				for e in w.enemies:
					if e.dying > 0 or not covers(e.x, e.y, e.r * 0.5):
						continue
					if tickInfo.has("mark"):
						w.mark(e, tickInfo["mark"], float(tickInfo["every"]) * 2.2)
					if tickInfo["h"].ok(e, w.time, float(tickInfo["every"]) * 0.9,
							float(tickInfo.get("max", 1e18))):
						var opts: Dictionary = tickInfo["opts"].duplicate()
						opts["at"] = [e.x, e.y]
						w.hit(e, float(tickInfo["amt"]), opts)

	func covers(cx: float, cy: float, pad: float = 0.0) -> bool:
		var t: float = age
		for p in puffs:
			var q: Vector2 = pos(p, t)
			var ddx: float = cx - q.x
			var ddy: float = cy - q.y
			if sqrt(ddx * ddx + ddy * ddy) < float(p["r"]) * shrink * 0.85 * fade + pad:
				return true
		return false

	func air(g, _w) -> void:
		var L = g.s
		var t: float = age
		var list: Array = []
		for i in range(puffs.size()):
			var p: Dictionary = puffs[i]
			list.append({"p": p, "q": pos(p, t), "i": i,
					"d": sin(float(p["ph"]) + t * float(p["sp"])) * 0.5 + float(p.get("lay", 0.0))})
		list.sort_custom(func(a, b): return a["d"] < b["d"])
		var rem: float = life - age
		var f: float = rem / 1.2 if rem < 1.2 else 1.0
		for o in list:
			var p2: Dictionary = o["p"]
			var rr: float = float(p2["r"]) * shrink * (0.9 + 0.1 * sin(t * 2 + float(o["i"]))) \
					* (0.4 + 0.6 * f) * minf(1.0, age * 2.2 + 0.2)
			if rr < 1.5:
				continue
			var q: Vector2 = o["q"]
			DRAW.puff(L, q.x, q.y - heightOff, rr, ramp, dens * f * fade, g.t, seed + int(o["i"]))

	func lit(g, _w) -> void:
		var rem: float = life - age
		var m: float = 10.0
		for p in puffs:
			m = maxf(m, sqrt(pow(float(p["x"]), 2.0) + pow(float(p["y"]), 2.0)) + float(p["r"]))
		DRAW.glow(g.l, x, y, m * 0.8, ramp[3], 0.1 * M.clampf(rem, 0.0, 1.0), 2)


# ---------------------------------------------------------------------------
# projectiles
# ---------------------------------------------------------------------------

class Proj extends Fx:
	var x0: float = 0.0
	var y0: float = 0.0
	var z: float = 0.0
	var tx: float = 0.0
	var ty: float = 0.0
	var dur: float = 0.0
	var arc: float = 0.0
	var draw_fn = null
	var on_end = null
	var on_tick = null
	var shadow: float = 2.0

	func _init(px: float, py: float, tx_: float, ty_: float, dur_: float, arc_: float,
			draw_: Callable, on_end_: Callable, on_tick_ = null, shadow_: float = 2.0) -> void:
		x = px
		y = py
		x0 = px
		y0 = py
		tx = tx_
		ty = ty_
		dur = dur_
		arc = arc_
		draw_fn = draw_
		on_end = on_end_
		on_tick = on_tick_
		shadow = shadow_
		kind = "proj"

	func upd(w, _dt: float) -> void:
		var a: float = M.clampf(age / dur, 0.0, 1.0)
		x = M.lerpf(x0, tx, a)
		y = M.lerpf(y0, ty, a)
		z = 4 * arc * a * (1 - a) + 6
		if on_tick != null:
			on_tick.call(w, self, a)
		if a >= 1:
			dead = true
			z = 0
			on_end.call(w, self)

	func air(g, _w) -> void:
		var a: float = M.clampf(age / dur, 0.0, 1.0)
		var L = g.s
		L.dl = 6
		L.ellipse(x, y, shadow, shadow * 0.6, int(M.P["bk"]))
		L.dl = 16
		draw_fn.call(g, x, y - z, z, a, self)


class Shot extends Fx:
	var z: float = 0.0
	var vx: float = 0.0
	var vy: float = 0.0
	var vz: float = 0.0
	var hits_done: Dictionary = {}
	var grav: float = 0.0
	var hr: float = 0.0
	var draw_fn = null
	var on_hit = null
	var on_land = null
	var life: float = 3.0
	var hz: float = 12.0
	var trail_fn = null

	func _init(px: float, py: float, z_: float, vx_: float, vy_: float, vz_: float,
			grav_: float, hr_: float, draw_: Callable, on_hit_: Callable,
			on_land_: Callable, life_: float = 3.0, hz_: float = 12.0,
			trail_: Callable = Callable()) -> void:
		x = px
		y = py
		z = z_
		vx = vx_
		vy = vy_
		vz = vz_
		grav = grav_
		hr = hr_
		draw_fn = draw_
		on_hit = on_hit_
		on_land = on_land_
		life = life_
		hz = hz_
		trail_fn = trail_
		kind = "shot"

	func upd(w, dt: float) -> void:
		vz -= grav * dt
		x += vx * dt
		y += vy * dt
		z += vz * dt
		if trail_fn != null and trail_fn.is_valid():
			trail_fn.call(w, self)
		if on_hit != null and on_hit.is_valid() and z < hz:
			for e in w.enemies:
				if e.dying > 0 or hits_done.has(e.id):
					continue
				var dx: float = e.x - x
				var dy: float = e.y - y
				if sqrt(dx * dx + dy * dy) < e.r + hr:
					hits_done[e.id] = true
					if on_hit.call(w, self, e):
						dead = true
						return
		if z <= 0 and vz < 0:
			dead = true
			z = 0
			if on_land != null and on_land.is_valid():
				on_land.call(w, self)
			return
		if age > life:
			dead = true
			if on_land != null and on_land.is_valid():
				on_land.call(w, self)
