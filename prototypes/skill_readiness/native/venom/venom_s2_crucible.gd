extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s2.ts` skill 10,
## THE WALKING CRUCIBLE: `class Crucible extends Fx`, `function* crucible`,
## and the file-local helpers `L1` and `bubbleBig`.
##
## Line-by-line translation of s2.ts lines 531-684. Expression order, `yield`
## waits, RNG draw order and `w.run` spawn order follow the original. `yield*`
## is an inline call on the same driver. Each inner class carries its own
## helpers, because GDScript inner classes cannot call the outer script's static
## functions.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const FLOW = preload("res://prototypes/skill_readiness/native/venom/venom_flow.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")


static func _lerp(a: float, b: float, t: float) -> float:
	return a + (b - a) * t


## `class Crucible extends Fx`
class Crucible extends FX.Fx:
	const HIP: Array = [[-22.0, -9.0], [0.0, -13.0], [22.0, -9.0], [-22.0, 9.0], [0.0, 13.0], [22.0, 9.0]]
	const REST: Array = [[-38.0, -22.0], [0.0, -32.0], [38.0, -22.0], [-38.0, 22.0], [0.0, 32.0], [38.0, 22.0]]
	var asm: float = 0.0
	var z: float = 0.0
	var heat: float = 0.0
	var shake: float = 0.0
	var swell: float = 1.0
	var cs: float = 1.0
	var compress: float = 0.0
	var spread: float = 1.0
	var face: float = 0.0
	var tilt: float = 0.0
	var crouch: float = 0.0
	var foot: Array = []

	static func _lf(a: float, b: float, t: float) -> float:
		return a + (b - a) * t

	func _init(px: float, py: float) -> void:
		x = px
		y = py
		r = 28.0
		push = true
		tank = true
		hp = 5000.0
		maxHp = 5000.0
		kind = "summon"
		sy = py
		for i in range(6):
			var rx: float = REST[i][0]
			var ry: float = REST[i][1]
			foot.append({"x": px + rx, "y": py + ry, "tx": px + rx, "ty": py + ry, "lift": 0.0,
					"from": {"x": px + rx, "y": py + ry}})

	func upd(_w, _dt: float) -> void:
		sy = y

	func chamber(i: int) -> Array:
		var s: float = 1.0 if i % 2 != 0 else -1.0
		var rr: float = -1.0 if i < 2 else 1.0
		return [x + s * 30.0, y - (28.0 + z - crouch) + 4.0 + rr * 2.0 + (-4.0 if i < 2 else 6.0)]

	func shd(g, _w) -> void:
		g.s.dl = 9
		g.s.ellipse(x + 4.0, y + 8.0, 44.0 * asm, 18.0 * asm, int(M.P["bk"]))
		g.s.dl = 16

	func gnd(g, _w) -> void:
		if asm < 1.0:
			return
		g.s.dl = 5
		g.s.ellipse(x, y + 4.0, 38.0, 14.0, int(M.P["k0"]))
		g.s.dl = 16

	func _leg(L, i: int, bx: float, by: float, hot: int, heat_: float) -> void:
		var hx0: float = HIP[i][0]
		var hy0: float = HIP[i][1]
		var hx: float = bx + hx0
		var hy: float = by + hy0 * 0.5 + 6.0
		var f: Dictionary = foot[i]
		var fy: float = float(f["y"]) - V8M.v8_sin(float(f["lift"]) * PI) * 11.0
		var fx: float = float(f["x"])
		var dxl: float = fx - hx
		var side: float = -1.0 if hx0 < 0.0 else (1.0 if hx0 > 0.0 else 0.0)
		var kx: float = (hx + fx) / 2.0 + side * 6.0
		var ky: float = minf(hy, fy) - 10.0 + absf(dxl) * 0.15
		var k0: int = int(M.P["k0"])
		var i0: int = int(M.P["i0"])
		var i1: int = int(M.P["i1"])
		var i2: int = int(M.P["i2"])
		var iron: Dictionary = MATS.PAL()["iron"]
		L.line(hx, hy, kx, ky, k0, 7.0)
		L.line(kx, ky, fx, fy, k0, 7.0)
		L.line(hx, hy, kx, ky, i1, 5.0)
		L.line(kx, ky, fx, fy, i2, 5.0)
		L.line(hx - 1.0, hy - 1.0, kx - 1.0, ky - 1.0, i0)
		L.line(kx - 1.0, ky - 1.0, fx - 1.0, fy - 1.0, i0)
		DRAW.ball(L, hx, hy, 3.4, iron)
		DRAW.ball(L, kx, ky, 3.6, iron)
		L.disc(kx, ky, 1.0, M.mix(int(M.P["u1"]), hot, heat_))
		L.ellipse(fx, fy + 1.0, 6.0, 3.2, k0)
		L.ellipse(fx, fy, 5.2, 2.7, i1)
		L.ellipse(fx - 1.0, fy - 1.0, 3.0, 1.4, i0)

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var a: float = asm
		if a <= 0.01:
			return
		var sh: float = V8M.v8_sin(t * 88.0) * shake if shake > 0.0 else 0.0
		var bx: float = x + sh
		var by: float = y - (30.0 + z - crouch) + (1.0 - a) * 50.0
		var heat_: float = heat
		var hot: int = M.mix(int(M.P["c1"]), M.mix(int(M.P["g2"]), int(M.P["w"]), heat_), heat_)
		var iron: Dictionary = MATS.PAL()["iron"]
		var glass: Dictionary = MATS.PAL()["glassHi"]
		var k0: int = int(M.P["k0"])
		var i0: int = int(M.P["i0"])
		var i1: int = int(M.P["i1"])
		var i2: int = int(M.P["i2"])
		var i3: int = int(M.P["i3"])
		var u0: int = int(M.P["u0"])
		var u1: int = int(M.P["u1"])
		var u2: int = int(M.P["u2"])
		var n0: int = int(M.P["n0"])
		var wc: int = int(M.P["w"])
		for i in range(3):
			_leg(L, i, bx, by, hot, heat_)
		# platform body
		var rx: float = 28.0
		var ry: float = 14.0
		L.poly([bx - rx, by, bx - rx * 0.5, by - ry, bx + rx * 0.5, by - ry, bx + rx, by,
				bx + rx * 0.5, by + ry, bx - rx * 0.5, by + ry], n0)
		L.poly([bx - rx + 2.0, by, bx - rx * 0.5 + 1.0, by - ry + 2.0, bx + rx * 0.5 - 1.0, by - ry + 2.0,
				bx + rx - 2.0, by, bx + rx * 0.5 - 1.0, by + ry - 2.0, bx - rx * 0.5 + 1.0, by + ry - 2.0], i1)
		L.poly([bx - rx + 6.0, by, bx - rx * 0.5 + 2.0, by - ry + 5.0, bx + rx * 0.5 - 2.0, by - ry + 5.0,
				bx + rx - 6.0, by, bx + rx * 0.5 - 2.0, by + ry - 5.0, bx - rx * 0.5 + 2.0, by + ry - 5.0], i0)
		L.poly([bx - rx, by, bx - rx * 0.5, by + ry, bx + rx * 0.5, by + ry, bx + rx, by,
				bx + rx, by + 7.0, bx + rx * 0.5, by + ry + 7.0, bx - rx * 0.5, by + ry + 7.0,
				bx - rx, by + 7.0], i3)
		L.line(bx - rx * 0.5, by + ry + 7.0, bx + rx * 0.5, by + ry + 7.0, k0)
		L.line(bx - rx, by + 7.0, bx - rx * 0.5, by + ry + 7.0, k0)
		L.line(bx + rx, by + 7.0, bx + rx * 0.5, by + ry + 7.0, k0)
		for i in range(6):
			var an: float = (float(i) / 6.0) * M.TAU
			var x0: float = bx + V8M.v8_cos(an) * 22.0
			var y0: float = by + V8M.v8_sin(an) * 10.0
			L.px(M.js_round(x0), M.js_round(y0), u0)
			L.px(M.js_round(x0) + 1, M.js_round(y0), u2)
		# heat channels between chambers and the main reservoir
		var ctr: Array = [bx, by - 14.0]
		for i in range(4):
			var cc: Array = chamber(i)
			var cx0: float = cc[0]
			var cy0: float = cc[1]
			var cx: float = cx0 + sh
			var mid: Array = [(cx + ctr[0]) / 2.0, maxf(cy0, ctr[1]) + 8.0]
			var path = func(u: float) -> Array:
				return [_lf(_lf(cx, mid[0], u), _lf(mid[0], ctr[0], u), u),
						_lf(_lf(cy0, mid[1], u), _lf(mid[1], ctr[1], u), u)]
			var pv: Array = path.call(0.0)
			for k in range(1, 13):
				var q: Array = path.call(float(k) / 12.0)
				L.line(pv[0], pv[1], q[0], q[1], u0, 3.0)
				L.line(pv[0], pv[1], q[0], q[1], u1, 1.0)
				pv = q
			var flow: float = 0.0
			if compress > 0.0:
				flow = 1.0 - fmod(t * 1.6 + float(i) * 0.25, 1.0)
			else:
				flow = fmod(t * (0.6 + heat_) + float(i) * 0.25, 1.0)
			for k2 in range(3):
				var u: float = fmod(flow + float(k2) / 3.0, 1.0)
				var q2: Array = path.call(u)
				L.disc(q2[0], q2[1], 1.0, hot)
				L.px(M.js_round(q2[0]), M.js_round(q2[1]), wc)
		# central reservoir
		var rr: float = 14.0 * swell * (1.0 + heat_ * 0.08)
		LIB.draw_flask(L, bx, by - 20.0, rr, 0.5 + heat_ * 0.35,
				V8M.v8_sin(t * 2.0 + tilt) * 0.3 + tilt, LIB.LIQ()["acid"], t * (1.0 + heat_ * 3.0), glass)
		L.ring(bx, by - 20.0, rr + 1.0, 1.0, u1)
		L.rect(float(M.js_round(bx)) - 5.0, float(M.js_round(by - 20.0 - rr)) - 3.0, 10.0, 3.0, u1)
		L.rect(float(M.js_round(bx)) - 5.0, float(M.js_round(by - 20.0 - rr)) - 3.0, 10.0, 1.0, u2)
		var nb: int = int(floor(heat_ * 14.0))
		for i in range(nb):
			var px: float = bx + (M.hash_n(float(i) * 7.0) - 0.5) * rr * 1.2
			var py: float = by - 20.0 + (M.hash_n(float(i) * 11.0) - 0.5) * rr * 1.2
			var a2: float = M.hash_n(float(i) * 3.0) * M.TAU
			var s: int = 0
			while float(s) < 5.0 + heat_ * 7.0:
				a2 += (M.hash_n(float(s + i * 20)) - 0.5) * 0.9
				px += V8M.v8_cos(a2)
				py += V8M.v8_sin(a2) * 0.8
				L.px(M.js_round(px), M.js_round(py), wc if s % 2 != 0 else int(M.P["g2"]))
				s += 1
		# four chambers
		for i in range(4):
			var cc2: Array = chamber(i)
			var cx2: float = float(cc2[0]) + sh
			var cy2: float = cc2[1]
			var r2: float = 7.5 * cs
			if r2 < 1.5:
				continue
			L.line(cx2, cy2 + r2, cx2, cy2 + r2 + 5.0, u0, 3.0)
			var liq: Array = LIB.LIQ()["mag"] if i % 2 != 0 else (LIB.LIQ()["cyan"] if i == 2 else LIB.LIQ()["acid"])
			LIB.draw_flask(L, cx2, cy2, r2, 0.55 + heat_ * 0.3,
					tilt * 0.8 + V8M.v8_sin(t * 2.4 + float(i)) * 0.35, liq,
					t * (1.0 + heat_ * 2.0) + float(i), glass)
			L.ring(cx2, cy2, r2 + 1.0, 1.0, u1)
			L.rect(float(M.js_round(cx2)) - 2.0, float(M.js_round(cy2 - r2)) - 2.0, 5.0, 2.0, u2)
			if heat_ > 0.5:
				for k in range(int(floor((heat_ - 0.5) * 8.0))):
					var a3: float = M.hash_n(float(k + i * 5)) * M.TAU
					L.line(cx2 + V8M.v8_cos(a3) * 2.0, cy2 + V8M.v8_sin(a3) * 2.0,
							cx2 + V8M.v8_cos(a3 + 0.6) * r2 * 0.9, cy2 + V8M.v8_sin(a3 + 0.6) * r2 * 0.9, wc)
		for i in range(3, 6):
			_leg(L, i, bx, by, hot, heat_)

	func lit(g, _w) -> void:
		var by: float = y - (30.0 + z - crouch)
		DRAW.glow(g.l, x, by - 20.0, 28.0 * swell, M.mix(int(M.P["c1"]), int(M.P["g2"]), heat),
				0.22 + heat * 0.4, 5)
		for i in range(4):
			var cc: Array = chamber(i)
			var col: int = int(M.P["m1"]) if i % 2 != 0 else int(M.P["c1"])
			DRAW.glow(g.l, cc[0], cc[1], 11.0 * cs, col, 0.2 + heat * 0.2, 3)


## `function L1(L, x, y)`
static func _l1(L, x: float, y: float) -> void:
	L.line(x - 3.0, y - 1.0, x + 2.0, y + 2.0, int(M.P["n3"]))
	L.px(M.js_round(x - 2.0), M.js_round(y - 3.0), int(M.P["w"]))


## `function bubbleBig(g, x, y, r)`
static func _bubble_big(g, x: float, y: float, r: float) -> void:
	var L = g.s
	L.dl = 6
	L.disc(x, y, r - 1.0, int(M.P["c1"]))
	L.dl = 9
	L.disc(x + 1.0, y + 1.0, r * 0.6, int(M.P["e3"]))
	L.dl = 16
	L.ring(x, y, r, 1.0, int(M.P["c3"]))
	L.px(M.js_round(x - r * 0.5), M.js_round(y - r * 0.55), int(M.P["w"]))
	L.px(M.js_round(x - r * 0.5) + 1, M.js_round(y - r * 0.55), int(M.P["w"]))
	L.px(M.js_round(x + r * 0.5), M.js_round(y + r * 0.45), int(M.P["c2"]))


## `function* crucible(c)`: the ORIGINAL Walking Crucible cast.
static func crucible(c):
	var box: Array = []
	var g = GEN.new(func():
		_crucible_body(c, box[0])
		return null)
	box.append(g)
	return g


## Wrap a generator body that receives its own driver.
static func _spawn(body: Callable):
	var box: Array = []
	var g = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(g)
	return g


## `const stomp = (x, y, big = false) => { ... }`
static func _stomp(c, w, steps, x: float, y: float, big: bool = false) -> void:
	var k0: int = int(M.P["k0"])
	var i0: int = int(M.P["i0"])
	var i2: int = int(M.P["i2"])
	var i3: int = int(M.P["i3"])
	var c1: int = int(M.P["c1"])
	var wc: int = int(M.P["w"])
	var i1: int = int(M.P["i1"])
	LIB.ring_at(c, x, y, 40.0 if big else 17.0, 0.3 if big else 0.18, 15.0,
			{"kind": "impact", "knock": 150.0 if big else 110.0, "stag": 0.3, "h": steps, "max": 5,
			"cols": [wc, i1, i3], "w": 2.0, "dust": false})
	FX.dust(w, x, y, 8 if big else 3, 30.0 if big else 16.0, 5.0 if big else 3.0)
	w.shake(5.0 if big else 1.6, 0.35 if big else 0.14)
	if big:
		w.shock(x, y, 48.0, 0.3, 3.0)
	w.add(FX.GroundDecal.new(x, y, "cracks", 18.0 if big else 8.0, 5.0, floor(x * 7.0 + y),
			{"a": k0, "b": i3, "c": c1}, 0.0, 1.0))
	FX.chips(w, x, y, 6 if big else 2, 60.0, i0, i2, wc, {"z": 2.0, "size": [2, 3]})


## `findCluster`: the enemy with the most neighbours within 60, else (cx + 80, cy).
static func _find_cluster(w, cx: float, cy: float) -> Dictionary:
	var bx: float = 0.0
	var by: float = 0.0
	var bn: int = -1
	for e in w.enemies:
		if e.dying > 0:
			continue
		var n: int = 0
		for o in w.enemies:
			if o.dying <= 0 and V8M.v8_hypot(o.x - e.x, o.y - e.y) < 60.0:
				n += 1
		if n > bn:
			bn = n
			bx = e.x
			by = e.y
	if bn >= 0:
		return {"x": bx, "y": by}
	return {"x": cx + 80.0, "y": cy}


## `cr.foot.some((o, j) => o.lift > 0 && (j % 2) !== (i % 2))`
static func _other_lift(feet: Array, i: int) -> bool:
	for j in range(feet.size()):
		var o: Dictionary = feet[j]
		if float(o["lift"]) > 0.0 and (j % 2) != (i % 2):
			return true
	return false


## `(ww, pr) => { ww.add(new Custom(...)); ww.run(...) }` from the bubble's onEnd.
static func _bub_land(c, bubs, ww, X: float, Y: float) -> void:
	var c1: int = int(M.P["c1"])
	var up_fn = func(g, a: float) -> void:
		var sw: float = 1.0 + V8M.v8_sin(a * 30.0) * 0.06 * a
		_bubble_big(g, X, Y - 5.0 - a * 2.0, 7.0 * sw)
	var lit_fn = func(g, a: float) -> void:
		DRAW.glow(g.l, X, Y - 6.0, 12.0, c1, 0.2 + a * 0.3, 3)
	ww.add(FX.Custom.new(X, Y, 0.5, {"up": up_fn, "lit": lit_fn}, Y))
	ww.run(_spawn(func(gg): _bub_after(c, bubs, ww, X, Y, gg)))


## `ww.run((function* () { yield 0.5; ... })())`
static func _bub_after(c, bubs, ww, X: float, Y: float, g) -> void:
	g.y(0.5)
	var c1: int = int(M.P["c1"])
	var c3: int = int(M.P["c3"])
	var e2: int = int(M.P["e2"])
	var wc: int = int(M.P["w"])
	LIB.ring_at(c, X, Y - 2.0, 26.0, 0.24, 33.0,
			{"kind": "burst", "knock": 120.0, "stag": 0.35, "h": bubs, "max": 3,
			"cols": [wc, c1, e2], "w": 3.0})
	FX.drops(ww, X, Y, 16, 90.0, c1, c3, e2, {"z": 8.0, "up": 110.0, "glow": 1.0})
	ww.add(FX.Flash.new(X, Y - 5.0, 16.0, c3, 0.2, 5.0))
	ww.add(FX.Splash.new(X, Y, 8.0, c1, c3))
	ww.shake(2.0, 0.15)
	ww.add(FX.Pool.new(X, Y, 8.0, MATS.MAT()["acid"], 2.0, {"blobs": 3, "boil": 1}))


## `onLand` of one of the seven finale chunks.
static func _chunk_land(c, chunks, i: int, ww, s) -> void:
	var k0: int = int(M.P["k0"])
	var i0: int = int(M.P["i0"])
	var i1: int = int(M.P["i1"])
	var i2: int = int(M.P["i2"])
	var i3: int = int(M.P["i3"])
	var c1: int = int(M.P["c1"])
	var wc: int = int(M.P["w"])
	LIB.ring_at(c, s.x, s.y, 24.0, 0.22, 35.0,
			{"kind": "impact", "knock": 140.0, "stag": 0.4, "h": chunks, "max": 2,
			"cols": [wc, i1, i3], "w": 3.0, "dust": true})
	ww.shake(4.0, 0.25)
	ww.shock(s.x, s.y, 32.0, 0.25, 2.0)
	FX.chips(ww, s.x, s.y, 12, 100.0, i0, int(M.P["i2"]), wc, {"z": 4.0, "size": [2, 5]})
	FX.dust(ww, s.x, s.y, 5, 28.0, 5.0)
	ww.add(FX.GroundDecal.new(s.x, s.y, "crater", 9.0, 8.0, float(i + c.id),
			{"a": k0, "b": i2, "c": c1}, 0.0, 1.0))
	ww.add(FX.Embed.new(s.x, s.y, 5.0, i0, i3, wc, 9.0))


## `w.run((function* () { ... })())`: the finale after the release.
static func _finale(c, w, X: float, Y: float, sheets, chunks, fvap, g) -> void:
	var k0: int = int(M.P["k0"])
	var i0: int = int(M.P["i0"])
	var i2: int = int(M.P["i2"])
	var c1: int = int(M.P["c1"])
	var c2: int = int(M.P["c2"])
	var c3: int = int(M.P["c3"])
	var e0: int = int(M.P["e0"])
	var e2: int = int(M.P["e2"])
	var e3: int = int(M.P["e3"])
	var v0: int = int(M.P["v0"])
	var v2: int = int(M.P["v2"])
	var y0: int = int(M.P["y0"])
	var y1: int = int(M.P["y1"])
	var y2: int = int(M.P["y2"])
	var wc: int = int(M.P["w"])
	var cer: Dictionary = MATS.PAL()["cer"]
	g.y(0.28)
	w.shake(7.0, 0.5)
	w.shock(X, Y, 190.0, 0.7, 4.0)
	LIB.ring_at(c, X, Y, 165.0, 0.6, 85.0,
			{"kind": "acid", "knock": 160.0, "stag": 0.4, "h": sheets, "max": 2,
			"cols": [c3, c1, e2], "w": 10.0, "fill": true, "ease": 1.6})
	w.add(FX.Pool.new(X, Y, 44.0, MATS.MAT()["acid"], 8.0, {"blobs": 9, "boil": 3, "grow": 0.5}))
	g.y(0.3)
	w.shake(6.0, 0.4)
	w.shock(X, Y, 210.0, 0.7, 3.5)
	LIB.ring_at(c, X, Y, 185.0, 0.65, 85.0,
			{"kind": "acid", "knock": 160.0, "stag": 0.4, "h": sheets, "max": 2,
			"cols": [y1, v2, v0], "w": 9.0, "fill": true, "ease": 1.6})
	for i in range(7):
		var a: float = (float(i) / 7.0) * M.TAU + 0.3
		var d: float = 50.0 + c.rng.range(0.0, 40.0)
		var lx: float = X + V8M.v8_cos(a) * d
		var ly: float = Y + V8M.v8_sin(a) * d * 0.8
		var draw_fn = func(gg, x: float, y: float, _z, _s) -> void:
			DRAW.ball(gg.s, x, y, 6.0, cer, 5.0)
			_l1(gg.s, x, y)
		var land_fn = func(ww, s) -> void:
			_chunk_land(c, chunks, i, ww, s)
		w.add(FX.Shot.new(lx, ly, 120.0, 0.0, 0.0, -20.0, 260.0, 0.0, draw_fn, Callable(), land_fn, 4.0, 0.0))
		g.y(0.05)
	var big = FX.Cloud.new(X, Y, LIB.mk_puffs(c.rng, 18, 54.0, 14.0, 24.0, 8.0, 1.4),
			MATS.VAP()["green"], 5.0, c.id + 77)
	big.grow = {"from": 0.3, "to": 1.9, "dur": 1.5}
	big.dens = 12.0
	big.tickInfo = {"every": 0.7, "amt": c.d(22.0), "opts": {"kind": "acid", "src": int(c.def["id"])},
			"h": fvap, "max": 4, "mark": "miasma"}
	w.add(big)
	for i in range(6):
		var a2: float = (float(i) / 6.0) * M.TAU
		var ramp: Array = MATS.VAP()["pale"] if i % 2 != 0 else MATS.VAP()["green"]
		S2.plume(w, X + V8M.v8_cos(a2) * 36.0, Y + V8M.v8_sin(a2) * 26.0, 44.0 + float(i % 3) * 8.0,
				1.8, ramp, 13.0, i, float(i) * 0.05)
	w.add(FX.GroundDecal.new(X, Y, "crater", 50.0, 12.0, float(c.id + 3), {"a": k0, "b": i2, "c": c1}, 0.0, 1.2))
	w.add(FX.GroundDecal.new(X, Y, "veins", 90.0, 11.0, float(c.id + 4), {"a": e0, "b": e3, "c": c2}, 0.0, 1.5))
	for i in range(12):
		var ex: float = X + c.rng.range(-70.0, 70.0)
		var ey: float = Y + c.rng.range(-50.0, 50.0)
		var esz: float = c.rng.range(3.0, 6.0)
		w.add(FX.Embed.new(ex, ey, esz, v2, v0, y2, 10.0))


## The main ORIGINAL generator body (s2.ts `crucible`), on driver `g`.
static func _crucible_body(c, g) -> void:
	var w = c.w
	var k0: int = int(M.P["k0"])
	var i0: int = int(M.P["i0"])
	var i2: int = int(M.P["i2"])
	var i3: int = int(M.P["i3"])
	var c1: int = int(M.P["c1"])
	var c2: int = int(M.P["c2"])
	var c3: int = int(M.P["c3"])
	var c0: int = int(M.P["c0"])
	var e0: int = int(M.P["e0"])
	var e2: int = int(M.P["e2"])
	var e3: int = int(M.P["e3"])
	var v1: int = int(M.P["v1"])
	var v2: int = int(M.P["v2"])
	var y2: int = int(M.P["y2"])
	var wc: int = int(M.P["w"])
	LIB.cast_anim(w, c, true, 0.45)
	var cx: float = c.tx
	var cy: float = c.ty
	var cr = Crucible.new(cx, cy)
	cr.face = c.ang
	var steps = FX.Hits.new()
	var streams = FX.Hits.new()
	var bubs = FX.Hits.new()
	var vaps = FX.Hits.new()
	var shock1 = FX.Hits.new()
	var sheets = FX.Hits.new()
	var chunks = FX.Hits.new()
	var fvap = FX.Hits.new()
	w.add(FX.GroundDecal.new(cx, cy, "cracks", 52.0, 14.0, float(c.id), {"a": k0, "b": i3, "c": c1}, 0.0, 1.0))
	w.add(FX.GroundDecal.new(cx, cy, "veins", 40.0, 12.0, float(c.id + 1), {"a": e0, "b": e3, "c": c2}, 0.0, 1.0))
	w.add(cr)
	# assemble: the armour rises out of the ground
	for k in GEN.ticks(0.75):
		cr.asm = M.smoothstep(k)
		cr.z = 0.0
		cr.shake = (1.0 - k) * 1.8
		if int(floor(k * 60.0)) % 3 == 0:
			FX.dust(w, cx + c.rng.range(-36.0, 36.0), cy + c.rng.range(-6.0, 12.0), 1, 20.0, 5.0)
			FX.chips(w, cx + c.rng.range(-30.0, 30.0), cy + c.rng.range(-4.0, 10.0), 1, 40.0, i0, i2, wc,
					{"z": 0.0, "up": 100.0, "size": [2, 4]})
		g.y(GEN.F)
	cr.asm = 1.0
	cr.shake = 0.0
	for i in range(6):
		var f: Dictionary = cr.foot[i]
		f["x"] = cx + Crucible.REST[i][0]
		f["y"] = cy + Crucible.REST[i][1]
	_stomp(c, w, steps, cx, cy + 4.0, true)
	var T_WALK: float = 8.4
	var tm: float = 0.0
	var mode: int = 0
	var nextAtk: float = 0.9
	var shed: float = 0.0
	var goal: Dictionary = _find_cluster(w, cx, cy)
	var gT: float = 0.0
	while tm < T_WALK:
		cr.heat = M.clampf((tm - 0.8) / (T_WALK - 0.8), 0.0, 1.0)
		cr.tilt = V8M.v8_sin(tm * 2.2) * 0.25
		gT -= GEN.F
		if gT <= 0.0:
			goal = _find_cluster(w, cx, cy)
			gT = 1.0
		var dx: float = float(goal["x"]) - cr.x
		var dy: float = float(goal["y"]) - cr.y
		var d: float = V8M.v8_hypot(dx, dy)
		if d == 0.0 or is_nan(d):
			d = 1.0
		if d > 38.0:
			cr.x = M.clampf(cr.x + (dx / d) * 24.0 * GEN.F, 30.0, float(w.W) - 30.0)
			cr.y = M.clampf(cr.y + (dy / d) * 24.0 * GEN.F, 36.0, float(w.H) - 20.0)
			cr.face = V8M.v8_atan2(dy, dx)
		cr.z = absf(V8M.v8_sin(tm * 3.1)) * 1.4
		# tripod gait: feet re-plant toward their rest position
		for i in range(6):
			var f2: Dictionary = cr.foot[i]
			var rx: float = cr.x + Crucible.REST[i][0] * cr.spread
			var ry: float = cr.y + Crucible.REST[i][1] * cr.spread
			if float(f2["lift"]) > 0.0:
				f2["lift"] = float(f2["lift"]) + GEN.F * 2.6
				f2["x"] = _lerp(float(f2["from"]["x"]), float(f2["tx"]), M.smoothstep(float(f2["lift"])))
				f2["y"] = _lerp(float(f2["from"]["y"]), float(f2["ty"]), M.smoothstep(float(f2["lift"])))
				if float(f2["lift"]) >= 1.0:
					f2["lift"] = 0.0
					f2["x"] = f2["tx"]
					f2["y"] = f2["ty"]
					_stomp(c, w, steps, float(f2["x"]), float(f2["y"]), false)
			elif V8M.v8_hypot(float(f2["x"]) - rx, float(f2["y"]) - ry) > 20.0 and not _other_lift(cr.foot, i):
				f2["lift"] = 0.001
				f2["from"] = {"x": f2["x"], "y": f2["y"]}
				f2["tx"] = rx + (dx / d) * 8.0
				f2["ty"] = ry + (dy / d) * 5.0
		# chamber attacks in rotation
		if tm > nextAtk:
			nextAtk = tm + 0.82
			var ch: int = int(floor(tm / 0.82)) % 4
			var sxy: Array = cr.chamber(ch)
			var sx: float = sxy[0]
			var sy: float = sxy[1]
			var tg = w.nearest(float(goal["x"]), float(goal["y"]), 200.0)
			var tx: float = float(goal["x"]) if tg == null else float(tg.x)
			var ty: float = float(goal["y"]) if tg == null else float(tg.y)
			var ang: float = V8M.v8_atan2(ty - sy, tx - sx)
			var m: int = mode % 3
			mode += 1
			if m == 0:
				var net = FLOW.FlowNet.new(MATS.MAT()["acid"], 1.4)
				var ln: float = minf(90.0, V8M.v8_hypot(tx - sx, ty - sy) + 20.0)
				var ex: float = sx + V8M.v8_cos(ang) * ln
				var ey: float = sy + V8M.v8_sin(ang) * ln * 0.8 + 18.0
				var p0: Dictionary = {"x": sx, "y": sy + 12.0}
				var p1: Dictionary = {"x": _lerp(sx, ex, 0.5), "y": _lerp(sy + 12.0, ey, 0.5) - 10.0}
				var p2: Dictionary = {"x": ex, "y": ey}
				var m01: Dictionary = {"x": (p0["x"] + p1["x"]) / 2.0, "y": (p0["y"] + p1["y"]) / 2.0}
				var m12: Dictionary = {"x": (p1["x"] + p2["x"]) / 2.0, "y": (p1["y"] + p2["y"]) / 2.0}
				net.add(FLOW.mk_branch([p0, m01, p1, m12, p2], 5.0, 0.0, 300.0, float(ch)))
				net.tick = {"every": 0.28, "amt": c.d(20.0), "opts": {"kind": "acid", "src": int(c.def["id"])},
						"h": streams, "max": 5, "mark": "corrode", "markDur": 2.5}
				w.add(net)
				FX.drops(w, sx, sy + 8.0, 8, 60.0, c1, c3, e2, {"z": 14.0, "ang": ang, "spread": 1.0, "glow": 1.0})
			elif m == 1:
				var draw_b = func(gg, x: float, y: float, _z, a: float) -> void:
					_bubble_big(gg, x, y, 4.0 + a * 3.0)
				var on_end = func(ww, pr) -> void:
					_bub_land(c, bubs, ww, pr.tx, pr.ty)
				w.add(FX.Proj.new(sx, sy, tx, ty, 0.55, 22.0, draw_b, on_end, null, 4.0))
			else:
				var cl = FX.Cloud.new(sx, sy + 8.0, LIB.mk_puffs(c.rng, 7, 10.0, 8.0, 13.0, 5.0, 1.6),
						MATS.VAP()["green"], 3.4, c.id + ch)
				cl.vx = V8M.v8_cos(ang) * 30.0
				cl.vy = V8M.v8_sin(ang) * 26.0
				cl.grow = {"from": 0.5, "to": 1.5, "dur": 1.6}
				cl.tickInfo = {"every": 0.5, "amt": c.d(13.0), "opts": {"kind": "acid", "src": int(c.def["id"])},
						"h": vaps, "max": 6, "mark": "miasma"}
				w.add(cl)
		# overheating: shed armour and glass
		if cr.heat > 0.35 and tm > shed:
			shed = tm + 0.55
			var sa: float = c.rng.range(0.0, M.TAU)
			var px2: float = cr.x + V8M.v8_cos(sa) * 26.0
			var py2: float = cr.y - 34.0 + V8M.v8_sin(sa) * 12.0
			FX.chips(w, px2, py2, 2, 30.0, i0, i2, wc, {"z": 22.0, "up": 20.0, "size": [2, 4]})
			FX.shards(w, px2, py2, 2, 20.0, v2, v1, y2, {"z": 24.0, "up": 10.0, "land": 2, "size": [2, 4]})
			FX.drops(w, px2, py2, 2, 20.0, c1, c3, e2, {"z": 22.0, "up": 0.0, "glow": 1.0})
			if cr.heat > 0.6:
				FX.steam(w, cr.x + c.rng.range(-10.0, 10.0), cr.y - 60.0, 1, 8.0, v2, y2, 4.0,
						{"z": 6.0, "vz": 18.0})
		g.y(GEN.F)
		tm += GEN.F
	# plant all limbs and compress the reservoirs into one central chamber
	for i in range(6):
		cr.foot[i]["lift"] = 0.0
	for k in GEN.ticks(1.2):
		cr.heat = 1.0
		cr.compress = k
		cr.spread = _lerp(1.0, 1.3, M.smoothstep(k))
		cr.crouch = M.smoothstep(k) * 6.0
		cr.cs = _lerp(1.0, 0.3, M.smoothstep(k))
		cr.swell = _lerp(1.0, 1.75, M.smoothstep(k * k))
		cr.shake = 0.8 + k * 2.4
		for i in range(6):
			var f3: Dictionary = cr.foot[i]
			var tx2: float = cr.x + Crucible.REST[i][0] * cr.spread
			var ty2: float = cr.y + Crucible.REST[i][1] * cr.spread
			f3["x"] = _lerp(float(f3["x"]), tx2, 0.1)
			f3["y"] = _lerp(float(f3["y"]), ty2, 0.1)
		if int(floor(k * 60.0)) % 3 == 0:
			w.parts.add({"k": "spark", "x": cr.x + c.rng.range(-26.0, 26.0),
					"y": cr.y - 40.0 + c.rng.range(-20.0, 10.0), "z": 2.0, "vx": 0.0, "vy": -30.0,
					"vz": 30.0, "grav": 80.0, "max": 0.4, "c1": wc})
		if int(floor(k * 60.0)) % 8 == 0:
			w.shock(cr.x, cr.y - 30.0, 70.0, 0.4, 1.2)
		g.y(GEN.F)
	w.hitstop = 0.2
	cr.shake = 4.0
	g.y(0.25)
	var X: float = cr.x
	var Y: float = cr.y
	cr.dead = true
	cr.tank = false
	cr.push = false
	w.screen_flash(wc, 0.7, 0.3)
	w.shake(10.0, 0.8)
	w.shock(X, Y - 20.0, 150.0, 0.7, 5.0)
	w.add(FX.Flash.new(X, Y - 36.0, 60.0, wc, 0.5, 20.0))
	LIB.ring_at(c, X, Y, 125.0, 0.45, 120.0,
			{"kind": "burst", "knock": 220.0, "stag": 0.6, "h": shock1, "cols": [wc, c2, e2], "w": 6.0,
			"dust": true, "fill": true})
	FX.chips(w, X, Y - 30.0, 50, 200.0, i0, i2, wc, {"z": 24.0, "up": 220.0, "size": [3, 8]})
	FX.shards(w, X, Y - 30.0, 24, 170.0, v2, v1, y2, {"z": 24.0, "up": 200.0, "land": 2, "size": [4, 8]})
	FX.drops(w, X, Y - 30.0, 70, 190.0, c1, c3, c0, {"z": 24.0, "up": 220.0, "glow": 2.0, "size": [2, 5], "max": 3})
	w.run(_spawn(func(gg): _finale(c, w, X, Y, sheets, chunks, fvap, gg)))
	g.y(3.0)
