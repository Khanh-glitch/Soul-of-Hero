extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s3.ts` skill 13,
## MERCURY GARDEN: `class Flower extends Fx`, `function* garden(c)` and the
## `MERC_DARK` material (s3.ts lines 123-210).
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order,
## `w.run` spawn order, the stable JavaScript sorts and the particle `fn`
## callbacks follow the original. Each inner class carries its own helpers.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")


## `const MERC_DARK = { ...MAT.merc, ramp: [...], rim: hxn(0x3c8582), rimLit: hxn(0x8fc9c3) }`
static func merc_dark() -> Dictionary:
	var m: Dictionary = MATS.MAT()["merc"].duplicate()
	m["ramp"] = [int(M.P["k0"]), LIB._hexn(0x06181a), LIB._hexn(0x0a2a2c), LIB._hexn(0x15484a), LIB._hexn(0x2c6663)]
	m["rim"] = LIB._hexn(0x3c8582)
	m["rimLit"] = LIB._hexn(0x8fc9c3)
	return m


## Stable ascending sort of `Array` by a float key (JavaScript `Array.prototype.sort` is stable).
static func _stable_sort(arr: Array, key: Callable) -> Array:
	var out: Array = arr.duplicate()
	for i in range(1, out.size()):
		var cur = out[i]
		var kc: float = float(key.call(cur))
		var j: int = i - 1
		while j >= 0 and float(key.call(out[j])) > kc:
			out[j + 1] = out[j]
			j -= 1
		out[j + 1] = cur
	return out


## `class Flower extends Fx`
class Flower extends FX.Fx:
	var g: float = 0.0
	var open: float = 0.0
	var blade: float = 0.0
	var ph: float = 0.0
	var per: float = 0.0
	var lean: float = 0.0
	var bx: float = 0.0
	var by: float = 0.0
	var hgt: float = 0.0
	var start: float = 0.0

	static func _lf(a: float, b: float, t: float) -> float:
		return a + (b - a) * t

	func _init(bx_: float, by_: float, h_: float, ph_: float, start_: float) -> void:
		bx = bx_
		by = by_
		hgt = h_
		start = start_
		x = bx_
		y = by_
		sy = by_
		ph = ph_
		per = 1.5 + M.hash_n(ph_ * 7.0) * 1.1
		lean = (M.hash_n(ph_ * 3.0) - 0.5) * 7.0
		kind = "summon"

	func upd(_w, _dt: float) -> void:
		sy = by

	func top() -> Dictionary:
		var gr: float = M.smoothstep(g)
		return {"x": bx + lean * gr, "y": by - hgt * gr}

	func up(gg, _w) -> void:
		var L = gg.s
		var t: float = gg.t
		var gr: float = M.smoothstep(g)
		if gr < 0.03:
			return
		var N: int = 7
		var pts: Array = []
		for i in range(N + 1):
			var u: float = float(i) / float(N)
			pts.append({"x": bx + lean * u * gr + V8M.v8_sin(t * 1.4 + ph + u * 3.0) * 1.6 * u,
					"y": by - hgt * gr * u,
					"r": _lf(2.7, 1.5, u)})
		var rev: Array = pts.duplicate()
		rev.reverse()
		DRAW.worm_body(L, rev, MATS.PAL()["merc"], {"stripe": int(M.P["w"]), "stripeT": t * 0.6})
		for s in [-1.0, 1.0]:
			var q: Dictionary = pts[3]
			DRAW.shard(L, float(q["x"]), float(q["y"]),
					-0.5 + (0.0 if s > 0.0 else PI + 1.0), 7.0 * gr, 2.0,
					int(M.P["y1"]), int(M.P["v0"]), int(M.P["w"]))
		var tp: Dictionary = pts[N]
		var tpx: float = float(tp["x"])
		var tpy: float = float(tp["y"])
		var o: float = open
		var bl: float = blade
		var rings: Array = [[6, 6.0 + 8.0 * o + bl * 8.0, 2.3 - bl * 1.0], [5, 4.0 + 5.0 * o + bl * 6.0, 1.8 - bl * 0.7]]
		for ri in range(rings.size()):
			var n: int = int(rings[ri][0])
			var len_: float = float(rings[ri][1])
			var wd: float = float(rings[ri][2])
			var items: Array = []
			for k in range(n):
				var a: float = (float(k) / float(n)) * M.TAU + (M.TAU / (2.0 * float(n)) if ri != 0 else 0.0) + ph
				items.append({"k": k, "a": a})
			items = _stable_sort(items, func(it): return V8M.v8_sin(float(it["a"])))
			for it in items:
				var k2: int = int(it["k"])
				var a2: float = float(it["a"])
				var ex: float = V8M.v8_cos(a2) * len_
				var ey: float = V8M.v8_sin(a2) * len_ * 0.55 - o * 2.0 - float(ri) * 1.5 - bl * 3.0
				var back: bool = V8M.v8_sin(a2) < 0.0
				var sh: float = V8M.v8_sin(t * 1.7 + float(k2) * 1.3 + ph + float(ri))
				var lit: int = int(M.P["w"]) if sh > 0.55 else (int(M.P["y1"]) if sh > 0.05 else int(M.P["v1"]))
				var dk: int = int(M.P["v0"]) if sh > 0.0 else LIB._hexn(0x0a2a2c)
				DRAW.shard(L, tpx + ex * 0.12, tpy + ey * 0.12 - 1.0 - float(ri),
						V8M.v8_atan2(ey, ex), V8M.v8_hypot(ex, ey) * (1.0 + bl * 0.2),
						wd + o * 1.2, M.mix(lit, dk, 0.4) if back else lit, dk, int(M.P["w"]))
				var spv: float = fmod(t * 1.1 + float(k2) * 0.3, 1.0)
				L.px(M.js_round(tpx + ex * spv * 0.9), M.js_round(tpy + ey * spv * 0.9 - 1.0 - float(ri)),
						int(M.P["w"]))
		DRAW.ball(L, tpx, tpy - 1.0, 2.2, MATS.PAL()["merc"])

	func lit(gg, _w) -> void:
		var tp: Dictionary = top()
		DRAW.glow(gg.l, float(tp["x"]), float(tp["y"]) - 2.0, 8.0 + open * 4.0,
				int(M.P["y1"]), 0.15 + open * 0.15, 3)


## Body of one of the twelve delayed steam puffs: `w.run((function* () { yield i * 0.22; steam(...) })())`.
static func _steam_later(c, w, cx: float, cy: float, delay: float, g) -> void:
	g.y(delay)
	FX.steam(w, cx + c.rng.range(-30.0, 30.0), cy + c.rng.range(-18.0, 18.0), 1, 6.0,
			int(M.P["v2"]), int(M.P["y2"]), 4.0, {"z": 2.0, "vz": 16.0, "max": 1.4})


## Wrap a generator body that receives its own driver.
static func _spawn(body: Callable):
	var box: Array = []
	var gen = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(gen)
	return gen


## `flowerBurst = (f, i) => { ... }`
static func _flower_burst(c, w, f: Flower, bursts) -> void:
	var tp: Dictionary = f.top()
	var mx: float = float(tp["x"])
	var my: float = float(tp["y"])
	LIB.ring_at(c, f.bx, f.by, 22.0, 0.22, 24.0,
			{"kind": "impact", "knock": 100.0, "stag": 0.3, "h": bursts, "max": 5,
			"cols": [int(M.P["w"]), int(M.P["y1"]), int(M.P["v1"])], "w": 2.0})
	w.add(FX.Flash.new(mx, my, 7.0, int(M.P["w"]), 0.14, 0.0))
	for k in range(8):
		var a: float = c.rng.range(0.0, M.TAU)
		var sp: float = c.rng.range(30.0, 80.0)
		var fn_cb = func(q, ww, _dt: float) -> void:
			if float(q.age) > 0.5 and String(q.k) == "drop":
				q.k = "shard"
				q.size = 3.0
				q.c1 = int(M.P["y1"])
				q.c2 = int(M.P["v1"])
				q.c3 = int(M.P["w"])
				q.vr = 12.0
				q.glow = 2.0
			if float(q.age) > 0.8:
				var t2: Dictionary = f.top()
				var dx: float = float(t2["x"]) - float(q.x)
				var dy: float = float(t2["y"]) - (float(q.y) - float(q.z))
				var d: float = V8M.v8_hypot(dx, dy)
				if d == 0.0 or is_nan(d):
					d = 1.0
				q.vx = float(q.vx) + (dx / d) * 260.0 * (1.0 / 60.0)
				q.vy = float(q.vy) + (dy / d) * 260.0 * (1.0 / 60.0)
				q.vz = float(q.vz) * 0.9
				q.grav = 0.0
				q.z = float(q.z) + (-float(q.z)) * 0.0
				if d < 4.0:
					q.age = q.max
		w.parts.add({"k": "drop", "x": mx, "y": my + 3.0, "z": 2.0,
				"vx": V8M.v8_cos(a) * sp, "vy": V8M.v8_sin(a) * sp * 0.7,
				"vz": c.rng.range(50.0, 100.0), "grav": 150.0, "size": 2.0,
				"c1": int(M.P["y1"]), "c2": int(M.P["w"]), "c3": int(M.P["v1"]),
				"max": 1.6, "glow": 1.0, "fn": fn_cb})


static func garden(c):
	var box: Array = []
	var gen = GEN.new(func():
		_garden_body(c, box[0])
		return null)
	box.append(gen)
	return gen


static func _garden_body(c, g) -> void:
	var w = c.w
	LIB.cast_anim(w, c)
	var cx: float = c.tx
	var cy: float = c.ty
	var air_cb = func(gg, a: float) -> void:
		var L = gg.s
		var z: float = (1.0 - a) * (1.0 - a) * 120.0 + 4.0
		DRAW.ball(L, cx, cy - z, 2.4, MATS.PAL()["merc"])
		L.px(M.js_round(cx - 1.0), M.js_round(cy - z - 1.0), int(M.P["w"]))
		for i in range(1, 4):
			L.dl = 12 - i * 3
			L.px(M.js_round(cx), M.js_round(cy - z - float(i) * 3.0), int(M.P["y1"]))
		L.dl = 16
	var gnd_cb = func(gg, a: float) -> void:
		var L = gg.s
		L.dl = M.js_round(5.0 + a * 6.0)
		L.ellipse(cx, cy, 2.0 + a * 5.0, 1.0 + a * 2.5, int(M.P["bk"]))
		L.dl = 16
	w.add(FX.Custom.new(cx, cy, 0.34, {"air": air_cb, "gnd": gnd_cb}))
	g.y(0.34)
	var bursts = FX.Hits.new()
	var blades = FX.Hits.new()
	var pool = FX.Hits.new()
	LIB.ring_at(c, cx, cy, 20.0, 0.2, 24.0,
			{"kind": "impact", "knock": 100.0, "stag": 0.3, "h": bursts, "max": 5,
			"cols": [int(M.P["w"]), int(M.P["y1"]), int(M.P["v1"])], "w": 2.0})
	w.shock(cx, cy, 30.0, 0.3, 2.0)
	w.shake(2.0, 0.15)
	w.add(FX.Flash.new(cx, cy, 12.0, int(M.P["w"]), 0.2, 2.0))
	FX.drops(w, cx, cy, 14, 80.0, int(M.P["y1"]), int(M.P["w"]), int(M.P["v1"]),
			{"z": 3.0, "up": 70.0, "glow": 1.0})
	var merc = w.add(FX.Pool.new(cx, cy, 30.0, MATS.MAT()["merc"], 7.4, {
		"grow": 0.9, "blobs": 7, "boil": 0.4, "resid": true,
		"tick": {"every": 1.0, "amt": c.d(10.0), "opts": {"kind": "acid", "src": int(c.def["id"])},
				"h": pool, "max": 1}}))
	var fl: Array = []
	var spots: Array = [[0.0, 0.0, 36.0]]
	for i in range(7):
		var a: float = (float(i) / 7.0) * M.TAU + 0.3
		var d: float = 26.0 + M.hash_n(float(i * 5 + c.id)) * 34.0
		spots.append([V8M.v8_cos(a) * d, V8M.v8_sin(a) * d * 0.85, 20.0 + M.hash_n(float(i)) * 12.0])
	for i in range(spots.size()):
		var sp: Array = spots[i]
		var f: Flower = Flower.new(M.clampf(cx + float(sp[0]), 10.0, float(w.W) - 10.0),
				M.clampf(cy + float(sp[1]), 16.0, float(w.H) - 10.0),
				float(sp[2]), float(i) * 1.9 + 0.4, 0.15 + float(i) * 0.2)
		fl.append(f)
		w.add(f)
	var prev: Array = []
	for _i in range(fl.size()):
		prev.append(0.0)
	var tm: float = 0.0
	var T_COL: float = 4.6
	while tm < T_COL:
		for i in range(fl.size()):
			var f2: Flower = fl[i]
			f2.g = M.clampf((tm - f2.start) / 0.8, 0.0, 1.0)
			if f2.g > 0.8:
				f2.open = M.smoothstep(0.5 + 0.5 * V8M.v8_sin(tm * M.TAU / f2.per + f2.ph))
			else:
				f2.open = f2.g * 0.4
			if f2.g > 0.9 and f2.open > 0.88 and float(prev[i]) <= 0.88 and tm > 0.5:
				_flower_burst(c, w, f2, bursts)
			prev[i] = f2.open
		g.y(GEN.F)
		tm += GEN.F
	# structural collapse: petals fold into liquid-metal blades and burst outward
	for k in GEN.ticks(0.3):
		for f3 in fl:
			f3.blade = M.smoothstep(k)
			f3.open = _lerp(f3.open, 0.2, 0.2)
		g.y(GEN.F)
	w.screen_flash(int(M.P["w"]), 0.3, 0.12)
	w.shake(5.0, 0.35)
	w.shock(cx, cy, 90.0, 0.4, 3.0)
	for i in range(fl.size()):
		var f4: Flower = fl[i]
		var tp: Dictionary = f4.top()
		var tpx: float = float(tp["x"])
		var tpy: float = float(tp["y"])
		var n: int = 6
		for k2 in range(n):
			var a2: float = (float(k2) / float(n)) * M.TAU + float(i) * 0.5
			var sp2: float = 200.0
			var draw_s = func(gg, x: float, y: float, _z, s) -> void:
				var L = gg.s
				var an: float = V8M.v8_atan2(float(s.vy), float(s.vx))
				DRAW.shard(L, x, y, an, 10.0, 2.2, int(M.P["w"]), int(M.P["y1"]), int(M.P["w"]))
				DRAW.shard(L, x - V8M.v8_cos(an) * 4.0, y - V8M.v8_sin(an) * 4.0, an, 6.0, 1.6,
						int(M.P["y1"]), int(M.P["v1"]), int(M.P["w"]))
				L.dl = 8
				L.px(M.js_round(x - V8M.v8_cos(an) * 9.0), M.js_round(y - V8M.v8_sin(an) * 9.0), int(M.P["y1"]))
				L.dl = 16
			var hit_s = func(ww, s, e) -> bool:
				if blades.ok(e, ww.time, 0.0, 3.0):
					LIB.hit_e(c, e, 50.0, {"kind": "pierce", "k": 130.0,
							"ang": V8M.v8_atan2(float(s.vy), float(s.vx)), "stag": 0.3, "at": [e.x, e.y]})
					FX.shards(ww, e.x, e.y, 5, 70.0, int(M.P["y1"]), int(M.P["v1"]), int(M.P["w"]),
							{"z": 6.0, "size": [2, 4]})
					ww.add(FX.Flash.new(e.x, e.y - 4.0, 7.0, int(M.P["w"]), 0.12, 0.0))
				return false
			w.add(FX.Shot.new(tpx, tpy + 2.0, 5.0, V8M.v8_cos(a2) * sp2, V8M.v8_sin(a2) * sp2 * 0.85, 0.0, 0.0, 4.0,
					draw_s, hit_s, Callable(), 0.52, 14.0))
		FX.shards(w, tpx, tpy, 8, 90.0, int(M.P["y1"]), int(M.P["v1"]), int(M.P["w"]),
				{"z": 8.0, "up": 90.0, "land": 3, "size": [2, 5]})
		FX.drops(w, tpx, tpy, 8, 70.0, int(M.P["y1"]), int(M.P["w"]), int(M.P["v1"]),
				{"z": 6.0, "glow": 1.0})
		f4.dead = true
	merc.age = merc.life - 3.4
	w.add(FX.Pool.new(cx, cy, 34.0, merc_dark(), 3.4, {"grow": 0.2, "blobs": 8, "resid": true}))
	for i in range(12):
		var delay: float = float(i) * 0.22
		w.run(_spawn(func(gg): _steam_later(c, w, cx, cy, delay, gg)))
	g.y(3.2)


static func _lerp(a: float, b: float, t: float) -> float:
	return a + (b - a) * t
