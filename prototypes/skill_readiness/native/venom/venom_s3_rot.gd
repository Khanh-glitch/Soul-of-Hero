extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s3.ts` skill 16,
## CRYSTAL ROT: `export class Cluster extends Fx` and `function* rot(c)`
## (s3.ts lines 339-419).
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order,
## shared `edges` / `clusters` containers (captured by reference, as JavaScript
## closures capture them), the pulse ticks and the synchronised detonation
## follow the original. Inner classes carry their own helpers.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")


## `class Cluster extends Fx` (crystal formation, summoned by the rot)
class Cluster extends FX.Fx:
	var g: float = 0.0
	var swell: float = 1.0
	var fr: float = 0.0
	var pulse: float = -1.0
	var bx: float = 0.0
	var by: float = 0.0
	var big: float = 1.0
	var sizes: Array = []

	func _init(bx_: float, by_: float, seed_: int, big_: float) -> void:
		bx = bx_
		by = by_
		big = big_
		x = bx_
		y = by_
		sy = by_
		for i in range(5):
			sizes.append((10.0 + M.hash_n(float(seed_) * 7.0 + float(i) * 3.0) * 14.0) * big_)
		kind = "summon"
		resid = false

	func upd(_w, _dt: float) -> void:
		sy = by + 3.0

	func gnd(gg, _w) -> void:
		if g < 0.05:
			return
		var L = gg.s
		L.dl = 9
		L.ellipse(bx, by + 2.0, 12.0 * g, 5.0 * g, int(M.P["k0"]))
		L.dl = 16
		for i in range(8):
			var a: float = (float(i) / 8.0) * M.TAU
			L.px(M.js_round(bx + V8M.v8_cos(a) * 12.0 * g), M.js_round(by + 2.0 + V8M.v8_sin(a) * 5.0 * g),
					int(M.P["v1"]))

	func up(gg, _w) -> void:
		var L = gg.s
		var t: float = gg.t
		var gr: float = M.smoothstep(g)
		if gr < 0.02:
			return
		var order: Array = [0, 3, 1, 4, 2]
		for i in order:
			var ox: float = float(i - 2) * 4.2 * big
			var h: float = float(sizes[i]) * gr * (1.0 + (swell - 1.0) * 0.5)
			var w2: float = (2.8 + float(i % 2)) * swell * big * 0.7
			var lean: float = float(i - 2) * 1.4
			var hot: bool = pulse >= 0.0 and absf(pulse * 1.4 - float(i) / 4.0) < 0.28
			DRAW.crystal_prism(L, bx + ox, by + 2.0 - (2.0 if i == 2 else 0.0) + float(i % 2) * 2.0,
					h, w2, lean,
					int(M.P["v3"]) if hot else int(M.P["v2"]),
					int(M.P["v1"]) if hot else int(M.P["v0"]),
					int(M.P["w"]) if hot else int(M.P["y2"]),
					int(M.P["c1"]) if hot else int(M.P["k1"]), t)
			if fr > 0.05:
				for k in range(int(floor(fr * 4.0))):
					var yy: float = by + 2.0 - h * (0.25 + float(k) * 0.2)
					L.line(bx + ox - w2, yy, bx + ox + w2, yy - 2.0, int(M.P["w"]))

	func lit(gg, _w) -> void:
		DRAW.glow(gg.l, bx, by - 8.0 * g, 12.0 + swell * 4.0,
				int(M.P["c2"]) if pulse >= 0.0 else int(M.P["y1"]),
				0.14 + (0.35 if pulse >= 0.0 else 0.0) + fr * 0.2, 3)


## `const alive = (e) => !!e && e.dying <= 0`
static func _alive(e) -> bool:
	return e != null and float(e.dying) <= 0.0


## Wrap a generator body in a `GEN` that receives its own driver.
static func _gen(body: Callable):
	var box: Array = []
	var gen = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(gen)
	return gen


static func _rot_body(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c)
	g.y(0.04)
	var tgt = c.target if c.target != null else w.nearest(c.tx, c.ty, 110.0)
	if tgt == null:
		return
	var hp: Array = LIB.hand_pos(w)
	var hx: float = float(hp[0])
	var hy: float = float(hp[1])
	var dur: float = M.clampf(V8M.v8_hypot(tgt.x - hx, tgt.y - hy) / 560.0, 0.1, 0.26)
	var end0 = func() -> int:
		return 0
	LIB.throw_arc(w, "crystal", hx, hy, tgt.x, tgt.y, dur, 8.0, end0, 16.0)
	g.y(dur)
	var growH = FX.Hits.new()
	var fin = FX.Hits.new()
	LIB.hit_e(c, tgt, 80.0, {"kind": "crystal", "k": 90.0, "from": [hx, hy], "stag": 0.4, "at": [tgt.x, tgt.y]})
	w.poison(tgt, c.d(60.0), 3, c.id, int(c.def["id"]))
	w.add(FX.Flash.new(tgt.x, tgt.y - 4.0, 12.0, int(M.P["y2"]), 0.2, 4.0))
	FX.shards(w, tgt.x, tgt.y, 8, 70.0, int(M.P["y1"]), int(M.P["v1"]), int(M.P["y2"]),
			{"z": 6.0, "size": [2.0, 4.0]})
	var cx: float = tgt.x
	var cy: float = tgt.y
	var clusters: Array = []
	var spots: Array = [[-26.0, 8.0, 1.0], [24.0, -10.0, 1.15], [4.0, 26.0, 0.9], [-8.0, -26.0, 1.0]]
	var edges: Array = []
	# `Custom(cx, cy, 8.5, { gnd })`: the edge web is drawn from the shared `edges` / `clusters` containers.
	var gnd_web = func(gg, _a) -> void:
		var L = gg.s
		var t: float = gg.t
		for ed in edges:
			var a: float = ed[0]
			var b: float = ed[1]
			var c2: float = ed[2]
			var d: float = ed[3]
			var n: int = int(ceil(V8M.v8_hypot(c2 - a, d - b) / 2.0))
			for i in range(n + 1):
				var u: float = float(i) / float(n)
				var X: int = M.js_round(M.lerpf(a, c2, u))
				var Y: int = M.js_round(M.lerpf(b, d, u) + V8M.v8_sin(u * 8.0) * 1.2)
				L.px(X, Y, int(M.P["k0"]))
				L.px(X, Y + 1, int(M.P["v0"]))
				var any_pulse: bool = false
				for k in clusters:
					if k.pulse >= 0.0:
						any_pulse = true
						break
				var hot: bool = any_pulse and absf(fmod(t * 2.2, 1.0) - u) < 0.08
				if hot:
					L.px(X, Y, int(M.P["c3"]))
				elif i % 6 == 0:
					L.px(X, Y, int(M.P["v2"]))
	w.add(FX.Custom.new(cx, cy, 8.5, {"gnd": gnd_web}))
	# growth spreads across the silhouette (branching, translucent, dark interior)
	var t0: float = w.time
	var ci: int = 0
	var tm: float = 0.0
	while tm < 1.3:
		var k: float = M.clampf((w.time - t0) / 0.9, 0.0, 1.0)
		if _alive(tgt):
			w.mark(tgt, "crystal", 3.0, k)
		if ci < spots.size() and tm > 0.25 + float(ci) * 0.13:
			var sp: Array = spots[ci]
			var cl := Cluster.new(M.clampf(cx + float(sp[0]), 14.0, float(w.W) - 14.0),
					M.clampf(cy + float(sp[1]), 24.0, float(w.H) - 10.0),
					int(c.id) + ci * 3, float(sp[2]))
			clusters.append(cl)
			w.add(cl)
			edges.append([tgt.x, tgt.y, cl.bx, cl.by])
			ci += 1
			LIB.ring_at(c, cl.bx, cl.by, 20.0, 0.2, 40.0,
					{"kind": "crystal", "knock": 110.0, "stag": 0.35, "h": growH, "max": 2,
					"cols": [int(M.P["y2"]), int(M.P["y1"]), int(M.P["v1"])], "w": 2.0, "dust": true})
			FX.dust(w, cl.bx, cl.by, 4, 20.0, 4.0)
			FX.chips(w, cl.bx, cl.by, 4, 60.0, int(M.P["k3"]), int(M.P["k2"]), int(M.P["v1"]),
					{"z": 2.0, "size": [2.0, 3.0]})
			w.shake(1.5, 0.12)
		for cl2 in clusters:
			cl2.g = M.clampf(cl2.g + GEN.F * 2.2, 0.0, 1.0)
		g.y(GEN.F)
		tm += GEN.F
	# the alchemist relocates and fires a second reagent
	var sd: float = c.rng.sign()
	var px: float = M.clampf(p.x - V8M.v8_sin(c.ang) * 44.0 * sd, 12.0, float(w.W) - 12.0)
	var py: float = M.clampf(p.y + V8M.v8_cos(c.ang) * 44.0 * sd, 14.0, float(w.H) - 12.0)
	w.glide([{"x": px, "y": py}], 0.34)
	g.y(0.36)
	LIB.cast_anim(w, c, false, 0.3)
	p.face = V8M.v8_atan2(cy - p.y, cx - p.x)
	g.y(0.06)
	var hp2: Array = LIB.hand_pos(w)
	var h2x: float = float(hp2[0])
	var h2y: float = float(hp2[1])
	var core_cb = func() -> void:
		pass
	LIB.throw_arc(w, "crystal", h2x, h2y, cx, cy, 0.28, 14.0, core_cb, 18.0)
	g.y(0.28)
	w.add(FX.Flash.new(cx, cy - 6.0, 14.0, int(M.P["c3"]), 0.3, 6.0))
	# luminous pulse travels through the connected formation, crystals swell and crack
	for k2 in GEN.ticks(0.7):
		for i in range(clusters.size()):
			var cl3: Cluster = clusters[i]
			cl3.pulse = M.clampf(k2 * 1.5 - float(i) * 0.12, 0.0, 1.2)
			cl3.swell = 1.0 + M.smoothstep(k2) * 0.45
			cl3.fr = k2
			if cl3.pulse > 0.99 and int(floor(k2 * 60.0)) % 3 == 0:
				var sx: float = cl3.bx + c.rng.range(-8.0, 8.0)
				var sy: float = cl3.by
				var sz: float = c.rng.range(2.0, 18.0)
				w.parts.add({"k": "spark", "x": sx, "y": sy, "z": sz, "vx": 0.0, "vy": 0.0, "vz": 0.0,
						"max": 0.25, "c1": int(M.P["w"])})
		if _alive(tgt):
			w.mark(tgt, "crystal", 1.0, 1.0)
		w.shock(cx, cy, 20.0 + k2 * 40.0, 0.15, 0.8)
		g.y(GEN.F)
	# synchronised detonation
	w.hitstop = 0.06
	w.screen_flash(int(M.P["y2"]), 0.5, 0.2)
	w.shake(8.0, 0.55)
	for cl4 in clusters:
		var X: float = cl4.bx
		var Y: float = cl4.by
		cl4.dead = true
		LIB.ring_at(c, X, Y, 46.0, 0.3, 155.0,
				{"kind": "crystal", "knock": 190.0, "stag": 0.5, "h": fin, "max": 1,
				"cols": [int(M.P["w"]), int(M.P["y1"]), int(M.P["v1"])], "w": 4.0, "dust": false})
		w.shock(X, Y, 60.0, 0.35, 3.0)
		w.add(FX.Flash.new(X, Y - 10.0, 22.0, int(M.P["w"]), 0.3, 4.0))
		FX.shards(w, X, Y, 22, 190.0, int(M.P["c3"]), int(M.P["v2"]), int(M.P["w"]),
				{"z": 12.0, "up": 200.0, "land": 2, "size": [3.0, 8.0]})
		FX.shards(w, X, Y, 12, 130.0, int(M.P["y1"]), int(M.P["v0"]), int(M.P["y2"]),
				{"z": 8.0, "up": 150.0, "land": 2, "size": [2.0, 5.0]})
		var puffs: Array = LIB.mk_puffs(c.rng, 6, 10.0, 8.0, 13.0, 5.0, 1.8)
		var dcl = FX.Cloud.new(X, Y, puffs,
				[int(M.P["v0"]), int(M.P["v1"]), int(M.P["c0"]), int(M.P["c3"])], 2.6, int(c.id) + 5)
		dcl.grow = {"from": 0.4, "to": 1.7, "dur": 1.0}
		dcl.dens = 9.0
		w.add(dcl)
		w.add(FX.GroundDecal.new(X, Y, "cracks", 18.0, 6.0, floor(X),
				{"a": int(M.P["k0"]), "b": int(M.P["v1"]), "c": int(M.P["y1"])}, 0.0, 1.0))
		FX.steam(w, X, Y, 3, 14.0, int(M.P["v1"]), int(M.P["y2"]), 5.0, {"z": 6.0, "vz": 20.0})
	FX.shards(w, cx, cy, 10, 120.0, int(M.P["y1"]), int(M.P["v0"]), int(M.P["w"]),
			{"z": 8.0, "up": 120.0, "land": 2})
	for e in w.enemies:
		if e.st.get("crystal", null) != null and float(e.dying) <= 0.0:
			FX.shards(w, e.x, e.y, 10, 100.0, int(M.P["y1"]), int(M.P["v1"]), int(M.P["w"]),
					{"z": e.r, "up": 100.0, "size": [2.0, 5.0]})
			w.add(FX.Flash.new(e.x, e.y - 4.0, 10.0, int(M.P["y2"]), 0.2, 2.0))
			e.st.erase("crystal")
	g.y(1.4)


static func rot(c):
	var box: Array = []
	var gen = GEN.new(func():
		_rot_body(c, box[0])
		return null)
	box.append(gen)
	return gen
