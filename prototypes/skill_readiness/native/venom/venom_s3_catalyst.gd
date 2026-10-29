extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s3.ts` skill 11,
## UNSEALED CATALYST: `function* catalyst(c)` (s3.ts lines 11-67).
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order and
## the live `w.fx` iteration follow the original. JavaScript `for...of` over an
## array sees entries pushed during iteration, so the native loop is index based
## and re-reads `size()` each step.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")


## `function* catalyst(c)` as a generator thread.
static func catalyst(c):
	var box: Array = []
	var g = GEN.new(func():
		_catalyst_body(c, box[0])
		return null)
	box.append(g)
	return g


## `const air = ...` for the first, rotating catalyst orb.
static func _orb_air(p, g, a: float) -> void:
	var L = g.s
	var t: float = g.t
	var x: float = p.x + 1.0
	var y: float = p.y - 26.0 - V8M.v8_sin(a * 3.0) * 1.5
	var k: float = a
	var k0: int = int(M.P["k0"])
	DRAW.ball(L, x, y, 7.0, MATS.PAL()["glassHi"], 7.0)
	# fluid rotating against the container
	L.dl = 16
	DRAW.ball(L, x, y + 1.0, 5.0, MATS.PAL()["liquid"], 4.5)
	var ang: float = -t * 9.0
	for i in range(3):
		var aa: float = ang + float(i) * 2.1
		L.disc(x + V8M.v8_cos(aa) * 3.0, y + 1.0 + V8M.v8_sin(aa) * 2.6, 0.9,
				int(M.P["w"]) if i == 0 else int(M.P["c2"]))
	L.arc(x, y + 1.0, 3.6, 1.0, ang, ang + 1.6, int(M.P["c3"]), 3.2)
	L.arc(x, y, 6.0, 1.0, t * 3.0, t * 3.0 + 1.2, int(M.P["w"]))
	for i in range(4):
		var aa2: float = t * 2.0 + float(i) * 1.57
		DRAW.shard(L, x + V8M.v8_cos(aa2) * 8.0, y - 9.0 + V8M.v8_sin(aa2) * 2.0, aa2 + 1.0, 3.2, 1.0,
				int(M.P["y2"]), int(M.P["v1"]), int(M.P["w"]))
	# luminous strands assembling into a pattern
	var n: int = 6
	var rad: float = 13.0
	for i in range(n):
		var a0: float = (float(i) / float(n)) * M.TAU + t
		var a1: float = (float(i + 2) / float(n)) * M.TAU + t
		if float(i) / float(n) < k * 1.3:
			L.line(x + V8M.v8_cos(a0) * rad, y + V8M.v8_sin(a0) * rad * 0.8,
					x + V8M.v8_cos(a1) * rad, y + V8M.v8_sin(a1) * rad * 0.8, int(M.P["c1"]))
		L.disc(x + V8M.v8_cos(a0) * rad, y + V8M.v8_sin(a0) * rad * 0.8, 1.0,
				int(M.P["c3"]) if float(i) / float(n) < k * 1.3 else int(M.P["e3"]))
	L.rect(float(M.js_round(x)) - 2.0, float(M.js_round(y)) - 9.0, 5.0, 2.0, int(M.P["u1"]))
	L.px(M.js_round(x), M.js_round(y) - 10, int(M.P["u2"]))


## `lit` of the orb.
static func _orb_lit(p, g, a: float) -> void:
	DRAW.glow(g.l, p.x, p.y - 26.0, 12.0 + a * 10.0, int(M.P["c1"]), 0.3 + a * 0.3, 4)


## `air` of the translucent sheets that wrap the body.
static func _sheet_air(p, g, a: float) -> void:
	var L = g.s
	var t: float = g.t
	var rise: float = M.smoothstep(minf(1.0, a * 1.3))
	var con: float = M.smoothstep(M.clampf((a - 0.65) / 0.35, 0.0, 1.0))
	for r in range(3):
		var pts: Array = []
		for i in range(18):
			var u: float = float(i) / 17.0
			var an: float = float(r) * 2.09 + u * 5.5 + t * 7.0
			var rad: float = (9.0 + 4.0 * V8M.v8_sin(u * 3.0 + t * 5.0)) * (1.0 - con * 0.85)
			var h: float = u * (8.0 + 30.0 * rise) * (1.0 - con * 0.5)
			pts.append({"x": p.x + V8M.v8_cos(an) * rad,
					"y": p.y - 3.0 - h + V8M.v8_sin(an) * rad * 0.45,
					"r": (2.6 - u * 1.2) * (1.0 - con * 0.4)})
		L.dl = 12
		DRAW.worm_body(L, pts, MATS.PAL()["liquid"], {"stripe": int(M.P["c3"]), "stripeT": t + float(r)})
		L.dl = 16


## `lit` of the sheets.
static func _sheet_lit(p, g, a: float) -> void:
	DRAW.glow(g.l, p.x, p.y - 10.0, 22.0 + a * 8.0, int(M.P["c1"]), 0.4, 4)


static func _catalyst_body(c, g) -> void:
	var w = c.w
	var p = w.player
	p.cast = 0.5
	p.castMax = 0.5
	w.add(FX.Custom.new(p.x, p.y, 0.47, {
		"air": func(gg, a: float) -> void: _orb_air(p, gg, a),
		"lit": func(gg, a: float) -> void: _orb_lit(p, gg, a),
	}, p.y))
	g.y(0.45)
	# seal breaks
	w.add(FX.Flash.new(p.x, p.y - 26.0, 22.0, int(M.P["w"]), 0.3, 0.0))
	w.screen_flash(int(M.P["c2"]), 0.4, 0.2)
	w.shake(3.0, 0.3)
	p.form = "venom"
	p.venomT = 14.0
	p.cat = 0.0
	FX.shards(w, p.x, p.y - 26.0, 12, 90.0, int(M.P["v2"]), int(M.P["v1"]), int(M.P["y2"]),
			{"z": 26.0, "up": 40.0, "land": 3, "size": [2, 4]})
	FX.drops(w, p.x, p.y - 26.0, 20, 80.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
			{"z": 26.0, "up": 60.0, "glow": 2.0})
	# existing summons / residues react to the release (live array, JS for...of semantics)
	var fi: int = 0
	while fi < w.fx.size():
		var f = w.fx[fi]
		if f.kind == "summon":
			w.add(FX.Flash.new(f.x, f.y - 10.0, 16.0, int(M.P["c1"]), 0.6, 6.0))
			w.add(FX.Ring.new(f.x, f.y, 18.0, 0.5, {"w": 2.0,
					"cols": [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])]}))
		elif f.resid:
			w.add(FX.Flash.new(f.x, f.y, 8.0, int(M.P["c2"]), 0.45))
		fi += 1
	var pulse = FX.Hits.new()
	# translucent sheets rise and wrap the body
	var dur: float = 0.85
	w.add(FX.Custom.new(p.x, p.y, dur, {
		"air": func(gg, a: float) -> void: _sheet_air(p, gg, a),
		"lit": func(gg, a: float) -> void: _sheet_lit(p, gg, a),
	}))
	g.y(0.32)
	# contraction, then eruption
	g.y(0.12)
	w.screen_flash(int(M.P["w"]), 0.55, 0.2)
	w.shake(6.0, 0.45)
	w.shock(p.x, p.y, 100.0, 0.5, 4.5)
	LIB.ring_at(c, p.x, p.y, 92.0, 0.45, 80.0,
			{"kind": "acid", "knock": 150.0, "stag": 0.4, "h": pulse,
			"cols": [int(M.P["w"]), int(M.P["c1"]), int(M.P["e2"])], "w": 5.0, "dust": false})
	LIB.vis_ring(w, p.x, p.y, 60.0, 0.38, [int(M.P["c3"]), int(M.P["c0"]), int(M.P["e1"])], 3.0)
	w.add(FX.Flash.new(p.x, p.y - 8.0, 40.0, int(M.P["c3"]), 0.4, 8.0))
	w.add(FX.GroundDecal.new(p.x, p.y, "veins", 82.0, 14.0, float(c.id),
			{"a": int(M.P["e0"]), "b": int(M.P["e3"]), "c": int(M.P["c2"])}, 0.0, 1.4))
	w.add(FX.GroundDecal.new(p.x - 36.0, p.y + 14.0, "veins", 36.0, 13.0, float(c.id + 1),
			{"a": int(M.P["e0"]), "b": int(M.P["e3"]), "c": int(M.P["c2"])}, 0.0, 1.4))
	w.add(FX.GroundDecal.new(p.x + 40.0, p.y - 12.0, "veins", 36.0, 13.0, float(c.id + 2),
			{"a": int(M.P["e0"]), "b": int(M.P["e3"]), "c": int(M.P["c2"])}, 0.0, 1.4))
	for i in range(28):
		var a: float = c.rng.range(0.0, M.TAU)
		var d: float = c.rng.range(8.0, 78.0)
		w.parts.add({"k": "bubble", "x": p.x + V8M.v8_cos(a) * d, "y": p.y + V8M.v8_sin(a) * d * 0.8,
				"z": 0.0, "vz": c.rng.range(10.0, 34.0), "max": c.rng.range(0.6, 1.8),
				"size": c.rng.range(2.0, 5.0), "c1": int(M.P["e3"]), "c2": int(M.P["c1"]),
				"c3": int(M.P["c3"]), "glow": 0.0})
	FX.drops(w, p.x, p.y, 30, 120.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
			{"z": 8.0, "up": 120.0, "glow": 2.0, "size": [1, 3]})
	for i in range(6):
		FX.steam(w, p.x + c.rng.range(-14.0, 14.0), p.y + c.rng.range(-6.0, 6.0), 1, 14.0,
				int(M.P["e1"]), int(M.P["c0"]), 5.0, {"z": 4.0, "vz": 18.0, "max": 1.4})
	g.y(0.9)
