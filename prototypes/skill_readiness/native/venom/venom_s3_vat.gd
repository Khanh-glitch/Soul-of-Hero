extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s3.ts` skill 15,
## BREATH OF THE VAT: `function* vat(c)` (s3.ts lines 303-338).
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order
## (including short-circuit `&&` draws), stable cloud ordering and the cloud
## tick/mark options follow the original.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")


## `mk = (ramp, n, R, r0, r1, lay, life) => { const cl = new Cloud(ox, oy, mkPuffs(...), ramp, life, c.id + lay); ... }`
static func _mk(c, ox: float, oy: float, dx: float, dy: float, ramp: Array, n: int, R: float,
		r0: float, r1: float, lay: int, life: float):
	var cl = FX.Cloud.new(ox, oy, LIB.mk_puffs(c.rng, n, R, r0, r1, 8.0, 1.9, float(lay)),
			ramp, life, int(c.id) + lay)
	cl.vx = dx * 38.0
	cl.vy = dy * 38.0
	cl.grow = {"from": 0.3, "to": 1.0, "dur": 0.7}
	cl.dens = 12.0 - float(lay)
	return cl


static func _vat_body(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c, true, 0.4)
	var dx: float = V8M.v8_cos(c.ang)
	var dy: float = V8M.v8_sin(c.ang)
	g.y(0.05)
	var hp: Array = LIB.hand_pos(w)
	var hx: float = float(hp[0])
	var hy: float = float(hp[1])
	var ox: float = M.clampf(p.x + dx * 36.0, 20.0, w.W - 20.0)
	var oy: float = M.clampf(p.y + dy * 36.0, 24.0, w.H - 20.0)
	w.add(FX.Flash.new(hx, hy, 12.0, int(M.P["c2"]), 0.25, 2.0))
	FX.drops(w, hx, hy, 12, 60.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]), {"z": 6.0, "glow": 1.0})
	var ticks_ = FX.Hits.new()
	var er = FX.Hits.new()
	var VAPM: Dictionary = MATS.VAP()
	var A = _mk(c, ox, oy, dx, dy, VAPM["dark"], 18, 36.0, 17.0, 25.0, 0, 7.0)
	var B = _mk(c, ox, oy, dx, dy, VAPM["green"], 16, 30.0, 12.0, 19.0, 1, 7.0)
	var C = _mk(c, ox, oy, dx, dy, VAPM["pale"], 12, 26.0, 9.0, 14.0, 2, 7.0)
	# leading boundary folds over itself: front puffs roll along elongated orbits
	for cl in [A, B, C]:
		for pf in cl.puffs:
			if float(pf["x"]) * dx + float(pf["y"]) * dy > 8.0:
				pf["orb"] = 8.0 + absf(float(pf["x"])) * 0.1
				pf["sp"] = absf(float(pf["sp"])) * 1.5
	A.tickInfo = {"every": 0.5, "amt": c.d(18.0),
			"opts": {"kind": "acid", "src": int(c.def["id"]), "stagger": 0.1},
			"h": ticks_, "max": 6, "mark": "miasma"}
	A.dens = 11.0
	w.add(A)
	w.add(B)
	w.add(C)
	var side: float = c.rng.sign()
	var tm: float = 0.0
	var glided: bool = false
	var erupted: int = 0
	var all: Array = [A, B, C]
	while tm < 7.0:
		if tm > 1.2 and tm < 2.6:
			var rot: float = 0.5 * side * GEN.F / 1.4
			var ca: float = V8M.v8_cos(rot)
			var sa: float = V8M.v8_sin(rot)
			for cl in all:
				var vx: float = cl.vx * ca - cl.vy * sa
				var vy: float = cl.vx * sa + cl.vy * ca
				cl.vx = vx
				cl.vy = vy
		if tm > 1.15 and not glided:
			glided = true
			var px: float = A.x + (-dy * side) * 38.0
			var py: float = A.y + dx * side * 38.0
			w.glide([{"x": px, "y": py}, {"x": px + dx * 36.0 + dx * 0.0, "y": py + dy * 36.0}], 0.55)
			w.add(FX.Ring.new(p.x, p.y, 16.0, 0.3, {"w": 2.0,
					"cols": [int(M.P["c3"]), int(M.P["c1"]), int(M.P["e2"])]}))
		if tm > 3.3 and tm < 4.3:
			var k: float = M.smoothstep((tm - 3.3) / 1.0)
			for cl in all:
				cl.shrink = M.lerpf(1.0, 0.6, k)
			if int(floor(tm * 60.0)) % 4 == 0:
				var sx: float = A.x + c.rng.range(-18.0, 18.0)
				var sy: float = A.y + c.rng.range(-12.0, 12.0)
				w.parts.add({"k": "spark", "x": sx, "y": sy, "z": 6.0, "vx": 0.0, "vy": 0.0, "vz": 20.0,
						"max": 0.3, "c1": int(M.P["c3"])})
		if int(floor(tm * 60.0)) % 8 == 0:
			for e in w.enemies:
				# `e.dying <= 0 && e.st.miasma && c.rng.next() < 0.5` (short-circuit, RNG only when reached)
				if float(e.dying) <= 0.0 and e.st.get("miasma", null) != null and c.rng.next() < 0.5:
					var mx: float = e.x + c.rng.range(-4.0, 4.0)
					var my: float = e.y
					w.parts.add({"k": "mote", "x": mx, "y": my, "z": e.r + 2.0,
							"vx": c.rng.range(-8.0, 8.0), "vy": -4.0, "vz": 22.0, "max": 0.9,
							"c1": int(M.P["c3"]), "c2": int(M.P["c1"]), "glow": 1.0})
		if tm > 4.4 and erupted < 4 and tm > 4.4 + float(erupted) * 0.3:
			erupted += 1
			var pf2: Dictionary = A.puffs[int(floor(c.rng.next() * float(A.puffs.size())))]
			var q: Vector2 = A.pos(pf2, A.age)
			var X: float = q.x
			var Y: float = q.y
			LIB.ring_at(c, X, Y, 30.0, 0.26, 41.75,
					{"kind": "burst", "knock": 130.0, "stag": 0.4, "h": er, "max": 4,
					"cols": [int(M.P["w"]), int(M.P["c2"]), int(M.P["e2"])], "w": 3.0})
			w.add(FX.Flash.new(X, Y - 4.0, 22.0, int(M.P["c3"]), 0.3, 6.0))
			w.shake(4.0, 0.25)
			w.shock(X, Y, 50.0, 0.3, 2.5)
			if erupted == 4:
				w.screen_flash(int(M.P["c2"]), 0.25, 0.1)
			FX.drops(w, X, Y, 14, 100.0, int(M.P["c1"]), int(M.P["c3"]), int(M.P["e2"]),
					{"z": 8.0, "up": 110.0, "glow": 2.0})
			FX.chips(w, X, Y, 6, 90.0, int(M.P["k3"]), int(M.P["k1"]), int(M.P["e1"]),
					{"z": 8.0, "up": 90.0, "size": [2.0, 4.0]})
			var ramp_e: Array = VAPM["pale"] if erupted % 2 != 0 else VAPM["green"]
			var ex = FX.Cloud.new(X, Y, LIB.mk_puffs(c.rng, 7, 12.0, 9.0, 14.0, 6.0, 2.0, 1.0),
					ramp_e, 2.6, int(c.id) + erupted * 3)
			ex.grow = {"from": 0.3, "to": 1.8, "dur": 0.9}
			ex.vx = A.vx * 0.5
			ex.vy = A.vy * 0.5
			w.add(ex)
			A.shrink = minf(A.shrink, 0.6)
		if tm > 5.6:
			for cl in all:
				cl.life = minf(cl.life, cl.age + 1.4)
		g.y(GEN.F)
		tm += GEN.F
	g.y(1.6)


static func vat(c):
	var box: Array = []
	var gen = GEN.new(func():
		_vat_body(c, box[0])
		return null)
	box.append(gen)
	return gen
