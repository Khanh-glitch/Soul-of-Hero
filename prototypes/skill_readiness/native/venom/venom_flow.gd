extends RefCounted

## Native port of the ORIGINAL `src/game/skills/lib.ts` flow network:
## `mkBranch` and `class FlowNet extends Fx`. A branching liquid network that
## grows along its branches, drawn through the shared `Field` rasteriser, and
## that ticks damage on enemies standing inside it.
##
## Expression order follows the original line by line. Points are
## Dictionaries `{x, y}` (and `{x, y, ang}` from `point_at`).

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")


## `mkBranch(pts, w, start, speed, seed = 1)`
static func mk_branch(pts: Array, w: float, start: float, speed: float, seed_: float = 1.0) -> Dictionary:
	var cum: Array = [0.0]
	for i in range(1, pts.size()):
		cum.append(float(cum[i - 1]) + V8M.v8_hypot(
				float(pts[i]["x"]) - float(pts[i - 1]["x"]),
				float(pts[i]["y"]) - float(pts[i - 1]["y"])))
	return {"pts": pts, "cum": cum, "len": float(cum[cum.size() - 1]), "w": w,
			"start": start, "speed": speed, "drawn": 0.0, "seed": seed_, "wm": 1.0}


## `wavyPath(x, y, ang, len, wob, step = 7, seed = 1, curve = 0)` from lib.ts 141-147.
static func wavy_path(x: float, y: float, ang: float, length: float, wob: float,
		step: float = 7.0, seed_: float = 1.0, curve: float = 0.0) -> Array:
	var pts: Array = [{"x": x, "y": y}]
	var a: float = ang
	var px: float = x
	var py: float = y
	var d: float = step
	while d <= length:
		a += curve * step + (M.hash_n(floor(d / step) * 3.0 + seed_ * 17.0) - 0.5) * wob
		px += V8M.v8_cos(a) * step
		py += V8M.v8_sin(a) * step * 0.95
		pts.append({"x": px, "y": py})
		d += step
	return pts


## `class FlowNet extends Fx`
class FlowNet extends FX.Fx:
	var br: Array = []
	var discs: Array = []
	var wmul: float = 1.0
	var crust: float = 0.0
	var seedN: int = 1
	var touched: Dictionary = {}
	var tick = null
	var on_touch = null
	var nt: float = 0.0
	var dash: bool = true
	var flowK: float = 1.0
	var mat: Dictionary = {}
	var crust_mat: Dictionary = {}
	var life: float = 0.0

	func _init(mat_: Dictionary, life_: float) -> void:
		mat = mat_
		life = life_
		kind = "flow"
		resid = true
		crust_mat = _crust()

	## `crustMat` from lib.ts. `hexn` swaps R and B, as in the original.
	static func _crust() -> Dictionary:
		var P: Dictionary = M.P
		return {"outline": int(P["k0"]), "rim": LIB._hexn(0x1f5e57), "rimLit": int(P["v0"]),
				"ramp": [int(P["k0"]), LIB._hexn(0x0b1f1a), LIB._hexn(0x123a30), LIB._hexn(0x1f5e57)],
				"hi": int(P["v0"]), "sh": int(P["k0"]), "vein": int(P["k1"]), "vw": 0, "dep": 4,
				"sc": 0.3, "fx": 0.0, "fy": 0.0, "amp": 0.8, "hiT": 0.4, "hiW": 3, "dl": 16}

	static func _lf(a: float, b: float, t: float) -> float:
		return a + (b - a) * t

	func add(b: Dictionary) -> Dictionary:
		br.append(b)
		return b

	func point_at(b: Dictionary, d_: float) -> Dictionary:
		var d: float = M.clampf(d_, 0.0, float(b["len"]))
		var cum: Array = b["cum"]
		var pts: Array = b["pts"]
		var i: int = 1
		while i < cum.size() - 1 and float(cum[i]) < d:
			i += 1
		var a: Dictionary = pts[i - 1]
		var c: Dictionary = pts[i]
		var s: float = float(cum[i]) - float(cum[i - 1])
		if s == 0.0:
			s = 1.0
		var u: float = M.clampf((d - float(cum[i - 1])) / s, 0.0, 1.0)
		return {"x": _lf(float(a["x"]), float(c["x"]), u), "y": _lf(float(a["y"]), float(c["y"]), u),
				"ang": V8M.v8_atan2(float(c["y"]) - float(a["y"]), float(c["x"]) - float(a["x"]))}

	func half_w(b: Dictionary, d: float, t: float) -> float:
		var tp: float = M.clampf((float(b["drawn"]) - d) / 12.0 + 0.45, 0.35, 1.0)
		return float(b["w"]) * float(b["wm"]) * wmul * tp * (1.0 + 0.1 * V8M.v8_sin(d * 0.25 - t * 4.0 + float(b["seed"])))

	func covers(x: float, y: float, pad: float) -> bool:
		for b in br:
			var pts: Array = b["pts"]
			var cum: Array = b["cum"]
			var i: int = 1
			while i < pts.size() and float(cum[i - 1]) < float(b["drawn"]):
				if float(cum[i - 1]) > float(b["drawn"]):
					break
				var hw: float = float(b["w"]) * float(b["wm"]) * wmul
				var bx: float = float(pts[i]["x"])
				var by: float = float(pts[i]["y"])
				if absf(bx - x) > hw + pad + 12.0 or absf(by - y) > hw + pad + 12.0:
					i += 1
					continue
				if _segd(x, y, pts[i - 1], pts[i]) <= hw + pad:
					return true
				i += 1
		for d in discs:
			if V8M.v8_hypot(x - float(d["x"]), y - float(d["y"])) < float(d["r"]) + pad:
				return true
		return false

	func _segd(px: float, py: float, a: Dictionary, b: Dictionary) -> float:
		var vx: float = float(b["x"]) - float(a["x"])
		var vy: float = float(b["y"]) - float(a["y"])
		var l2: float = vx * vx + vy * vy
		if l2 == 0.0:
			l2 = 1.0
		var t: float = M.clampf(((px - float(a["x"])) * vx + (py - float(a["y"])) * vy) / l2, 0.0, 1.0)
		return V8M.v8_hypot(px - (float(a["x"]) + vx * t), py - (float(a["y"]) + vy * t))

	func upd(w, dt: float) -> void:
		for b in br:
			b["drawn"] = M.clampf((age - float(b["start"])) * float(b["speed"]), 0.0, float(b["len"]))
		if age > life:
			dead = true
			return
		for e in w.enemies:
			if e.dying > 0 or touched.has(e.id):
				continue
			if covers(e.x, e.y, e.r * 0.6):
				touched[e.id] = true
				if on_touch != null:
					on_touch.call(w, e)
		if tick != null:
			nt -= dt
			if nt <= 0.0:
				nt += float(tick["every"])
				for e in w.enemies:
					if e.dying > 0 or not covers(e.x, e.y, e.r * 0.5):
						continue
					if tick.has("mark"):
						w.mark(e, String(tick["mark"]), float(tick.get("markDur", 2.5)), 2.0)
					if tick["h"].ok(e, w.time, float(tick["every"]) * 0.9, float(tick.get("max", 1e18))):
						var opts: Dictionary = tick["opts"].duplicate()
						opts["at"] = [e.x, e.y]
						w.hit(e, float(tick["amt"]), opts)
						if tick.has("poison"):
							var p: Array = tick["poison"]
							w.poison(e, float(p[0]), float(p[1]), int(p[2]), int(tick["opts"]["src"]))

	func gnd(g, _w) -> void:
		var f = g.f
		var L = g.s
		var t: float = g.t
		var rem: float = life - age
		var fade: float = maxf(0.1, rem) if rem < 1.0 else 1.0
		var stamp = func(extra: float, wm: float) -> void:
			for b in br:
				if float(b["drawn"]) < 1.0:
					continue
				var pts: Array = b["pts"]
				var cum: Array = b["cum"]
				var prev: Dictionary = pts[0]
				var pd: float = 0.0
				for i in range(1, pts.size()):
					if float(cum[i - 1]) >= float(b["drawn"]):
						break
					var end: float = minf(float(cum[i]), float(b["drawn"]))
					var q: Dictionary = point_at(b, end) if end < float(cum[i]) else pts[i]
					f.capsule(float(prev["x"]), float(prev["y"]), float(q["x"]), float(q["y"]),
							half_w(b, pd, t) * wm + extra, half_w(b, end, t) * wm + extra)
					prev = q
					pd = end
				var hd: Dictionary = point_at(b, float(b["drawn"]))
				if float(b["drawn"]) < float(b["len"]):
					f.disc(float(hd["x"]), float(hd["y"]),
							float(b["w"]) * float(b["wm"]) * wmul * 1.1 * wm + extra, 0.2)
			for d in discs:
				f.disc(float(d["x"]), float(d["y"]), float(d["r"]) * wm + extra, 0.3)
		if crust > 0.02:
			f.reset()
			stamp.call(crust * 2.4, 1.0)
			f.shade(L, crust_mat, t, {"dl": M.js_round(14.0 * fade)})
		f.reset()
		stamp.call(0.0, 1.0)
		f.shade(L, mat, t, {"seed": seedN, "fx": float(mat["fx"]) * flowK,
				"dl": (maxi(2, M.js_round(16.0 * fade)) if fade < 1.0 else 16)})
		# foaming edges + directional current dashes
		var fl: float = floor(t * 7.0)
		for b in br:
			var d: float = 3.0
			while d < float(b["drawn"]):
				var q: Dictionary = point_at(b, d)
				var hw: float = half_w(b, d, t) + 0.5
				var nx: float = -V8M.v8_sin(float(q["ang"]))
				var ny: float = V8M.v8_cos(float(q["ang"]))
				for s in [-1.0, 1.0]:
					if M.hash_n(floor(d) * 7.0 + (3.0 if s > 0.0 else 0.0) + fl * 13.0 + float(b["seed"]) * 31.0) > 0.45:
						var col: int = int(mat["rimLit"]) if M.hash_n(floor(d) + fl) > 0.5 else int(mat["rim"])
						L.dot(float(q["x"]) + nx * hw * s, float(q["y"]) + ny * hw * s, col)
				d += 4.0
			if dash:
				var k2: float = 0.0
				while k2 < float(b["drawn"]):
					var dd: float = fmod(k2 + t * float(b["speed"]) * 0.25 * flowK, maxf(14.0, float(b["drawn"])))
					var q2: Dictionary = point_at(b, dd)
					var off: float = V8M.v8_sin(dd * 0.4 + float(b["seed"])) * half_w(b, dd, t) * 0.4
					var qa: float = float(q2["ang"])
					L.dot(float(q2["x"]) - V8M.v8_sin(qa) * off, float(q2["y"]) + V8M.v8_cos(qa) * off, int(mat["hi"]))
					L.dot(float(q2["x"]) + V8M.v8_cos(qa) * 0.8 - V8M.v8_sin(qa) * off,
							float(q2["y"]) + V8M.v8_sin(qa) * 0.8 + V8M.v8_cos(qa) * off, int(mat["vein"]))
					k2 += 12.0
			if float(b["drawn"]) < float(b["len"]) and float(b["drawn"]) > 2.0:
				var h: Dictionary = point_at(b, float(b["drawn"]))
				var hw2: float = float(b["w"]) * wmul
				if M.hash_n(fl * 5.0 + float(b["seed"])) > 0.3:
					L.dot(float(h["x"]) + V8M.v8_cos(float(h["ang"])) * hw2,
							float(h["y"]) + V8M.v8_sin(float(h["ang"])) * hw2, int(mat["rimLit"]))

	func lit(g, _w) -> void:
		var rem: float = life - age
		if rem < 0.0:
			return
		var ramp: Array = mat["ramp"]
		for b in br:
			var d: float = 0.0
			while d < float(b["drawn"]):
				var q: Dictionary = point_at(b, d)
				DRAW.glow(g.l, float(q["x"]), float(q["y"]), half_w(b, d, g.t) * 1.8,
						int(ramp[ramp.size() - 2]), 0.1 * M.clampf(rem, 0.0, 1.0), 2)
				d += 16.0
		for dsc in discs:
			DRAW.glow(g.l, float(dsc["x"]), float(dsc["y"]), float(dsc["r"]) * 1.6,
					int(ramp[ramp.size() - 1]), 0.18, 3)
