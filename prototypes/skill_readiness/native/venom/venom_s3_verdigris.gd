extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s3.ts` skill 12,
## VERDIGRIS WAKE: `function* wake(c)` (s3.ts lines 68-122).
##
## Line-by-line translation. Expression order, `yield` waits, RNG draw order,
## `w.run` spawn order and the stable branch sort follow the original.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const FLOW = preload("res://prototypes/skill_readiness/native/venom/venom_flow.gd")


## `function* wake(c)` as a generator thread.
static func wake(c):
	var box: Array = []
	var g = GEN.new(func():
		_wake_body(c, box[0])
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


## Stable ascending sort by `start` (JavaScript `Array.prototype.sort` is stable).
static func _sort_by_start(arr: Array) -> Array:
	var out: Array = arr.duplicate()
	for i in range(1, out.size()):
		var cur = out[i]
		var j: int = i - 1
		while j >= 0 and float(out[j]["start"]) > float(cur["start"]):
			out[j + 1] = out[j]
			j -= 1
		out[j + 1] = cur
	return out


## `for (const b of all) w.run((function* () { ... })())` body: the rupture of one branch.
static func _rupture(c, w, net, b: Dictionary, burst, vap, g) -> void:
	for k in GEN.ticks(0.34):
		b["wm"] = 1.0 + k * 0.9
		var hd: Dictionary = net.point_at(b, float(b["len"]))
		var hx: float = float(hd["x"])
		net.discs = net.discs.filter(func(dd): return float(dd["x"]) != hx)
		g.y(GEN.F)
	var blen: float = float(b["len"])
	var pts: Array = [net.point_at(b, blen), net.point_at(b, blen * 0.55), net.point_at(b, blen * 0.2)]
	for i in range(pts.size()):
		var q: Dictionary = pts[i]
		var qx: float = float(q["x"])
		var qy: float = float(q["y"])
		LIB.ring_at(c, qx, qy, 24.0, 0.22, 30.0,
				{"kind": "acid", "knock": 100.0, "stag": 0.3, "h": burst, "max": 2,
				"cols": [int(M.P["v3"]), int(M.P["v2"]), int(M.P["e2"])], "w": 3.0})
		FX.drops(w, qx, qy, 12, 90.0, int(M.P["v2"]), int(M.P["c3"]), int(M.P["e2"]),
				{"z": 6.0, "up": 100.0, "glow": 2.0, "size": [2, 4]})
		FX.shards(w, qx, qy, 6, 80.0, int(M.P["c1"]), int(M.P["e3"]), int(M.P["c3"]),
				{"z": 4.0, "up": 90.0, "land": 1, "size": [1, 3]})
		w.add(FX.Flash.new(qx, qy - 3.0, 10.0, int(M.P["v3"]), 0.2, 3.0))
		w.add(FX.Splash.new(qx, qy, 8.0, int(M.P["v2"]), int(M.P["v3"])))
		w.shake(2.0, 0.12)
		w.shock(qx, qy, 26.0, 0.25, 1.5)
		var cl = FX.Cloud.new(qx, qy, LIB.mk_puffs(c.rng, 5, 7.0, 6.0, 11.0, 4.0, 1.8),
				MATS.VAP()["green"], 2.2, c.id + i)
		cl.vx = V8M.v8_cos(float(q["ang"]) + 1.57) * 14.0
		cl.vy = V8M.v8_sin(float(q["ang"]) + 1.57) * 10.0
		cl.grow = {"from": 0.4, "to": 1.5, "dur": 1.0}
		cl.tickInfo = {"every": 0.5, "amt": c.d(10.0), "opts": {"kind": "acid", "src": int(c.def["id"])},
				"h": vap, "max": 4, "mark": "miasma"}
		w.add(cl)
		if i == 0:
			w.add(FX.Pool.new(qx, qy, 9.0, MATS.MAT()["verd"], 3.0, {"blobs": 4, "boil": 1.6}))
	b["wm"] = 0.45


static func _wake_body(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c)
	var dx: float = V8M.v8_cos(c.ang)
	var dy: float = V8M.v8_sin(c.ang)
	g.y(0.04)
	var hp: Array = LIB.hand_pos(w)
	var hx: float = hp[0]
	var hy: float = hp[1]
	var ix: float = M.clampf(p.x + dx * 48.0, 12.0, float(w.W) - 12.0)
	var iy: float = M.clampf(p.y + dy * 48.0, 14.0, float(w.H) - 12.0)
	LIB.throw_arc(w, "vial", hx, hy, ix, iy, 0.1, 6.0, func(_ww, _pr) -> void: pass, 22.0)
	g.y(0.1)
	w.add(FX.Splash.new(ix, iy, 8.0, int(M.P["v2"]), int(M.P["c3"])))
	w.add(FX.Flash.new(ix, iy - 3.0, 10.0, int(M.P["v3"]), 0.2, 3.0))
	FX.shards(w, ix, iy, 6, 70.0, int(M.P["v2"]), int(M.P["v1"]), int(M.P["y2"]),
			{"z": 4.0, "land": 3, "size": [2, 3]})
	var net = FLOW.FlowNet.new(MATS.MAT()["verd"], 5.4)
	var tick_h = FX.Hits.new()
	var front = FX.Hits.new()
	var burst = FX.Hits.new()
	var vap = FX.Hits.new()
	var main_pts: Array = FLOW.wavy_path(ix, iy, c.ang, 150.0, 0.3, 7.0, float(c.id), 0.002 * c.rng.sign())
	var main: Dictionary = net.add(FLOW.mk_branch(main_pts, 5.0, 0.0, 320.0, 1.0))
	var sides: Array = []
	var rows: Array = [[38.0, 0.8, 70.0], [70.0, -0.9, 80.0], [100.0, 0.75, 62.0], [125.0, -0.7, 54.0]]
	for i in range(rows.size()):
		var row: Array = rows[i]
		var d: float = row[0]
		var a: float = row[1]
		var ln: float = row[2]
		var q: Dictionary = net.point_at(main, d)
		var b: Dictionary = FLOW.mk_branch(
				FLOW.wavy_path(float(q["x"]), float(q["y"]), float(q["ang"]) + a, ln, 0.4, 7.0,
						float(c.id + i + 3)),
				3.4, d / 320.0 + 0.04, 270.0, float(i + 2))
		sides.append(b)
		net.add(b)
		if i == 0:
			var q2: Dictionary = net.point_at(b, 40.0)
			net.add(FLOW.mk_branch(
					FLOW.wavy_path(float(q2["x"]), float(q2["y"]), float(q2["ang"]) - 0.8, 36.0, 0.4, 6.0,
							float(c.id + 40)),
					2.4, d / 320.0 + 0.2, 220.0, 9.0))
	net.tick = {"every": 0.5, "amt": c.d(25.0),
			"opts": {"kind": "acid", "src": int(c.def["id"]), "stagger": 0.1},
			"h": tick_h, "max": 2, "mark": "corrode", "markDur": 2.6}
	net.on_touch = func(ww, e) -> void:
		if front.ok(e, ww.time):
			LIB.hit_e(c, e, 70.0, {"kind": "acid", "k": 100.0, "from": [ix, iy], "stag": 0.3, "at": [e.x, e.y]})
			ww.mark(e, "corrode", 3.2, 3.0)
			FX.drops(ww, e.x, e.y, 6, 60.0, int(M.P["v2"]), int(M.P["c3"]), int(M.P["e2"]),
					{"z": 6.0, "glow": 1.0})
			ww.add(FX.Splash.new(e.x, e.y, 6.0, int(M.P["v2"]), int(M.P["v3"])))
	w.add(net)
	# the alchemist glides along the advancing current, sweeping a branch sideways
	g.y(0.06)
	var g0: Dictionary = net.point_at(main, 30.0)
	var g1: Dictionary = net.point_at(main, 62.0)
	var g2: Dictionary = net.point_at(main, 92.0)
	w.glide([{"x": g0["x"], "y": g0["y"]},
			{"x": float(g1["x"]) - dy * 8.0, "y": float(g1["y"]) + dx * 8.0},
			{"x": g2["x"], "y": g2["y"]}], 0.5)
	g.y(0.26)
	var sa: float = c.ang + 0.95 * c.rng.sign()
	var sq: Dictionary = {"x": p.x, "y": p.y}
	net.add(FLOW.mk_branch(FLOW.wavy_path(float(sq["x"]), float(sq["y"]), sa, 70.0, 0.35, 7.0, float(c.id + 55)),
			3.8, net.age + 0.02, 300.0, 11.0))
	for i in range(12):
		var a2: float = sa + (float(i) / 11.0 - 0.5) * 1.4
		w.parts.add({"k": "drop", "x": sq["x"], "y": sq["y"], "z": 8.0,
				"vx": V8M.v8_cos(a2) * 90.0, "vy": V8M.v8_sin(a2) * 90.0 * 0.8, "vz": 40.0,
				"grav": 200.0, "size": 2.0, "c1": int(M.P["v2"]), "c2": int(M.P["v3"]),
				"c3": int(M.P["e2"]), "land": 1, "max": 1.0, "glow": 1.0})
	w.shake(1.5, 0.15)
	# surface oxidises: dark residue along the edges while bright currents remain
	var t0: float = w.time
	while w.time - t0 < 1.9:
		net.crust = M.clampf((w.time - t0 - 0.2) / 1.5, 0.0, 1.0)
		g.y(GEN.F)
	# final gesture: branches swell and rupture in sequence
	p.cast = 0.4
	p.castMax = 0.4
	w.shake(1.0, 0.1)
	var all: Array = _sort_by_start(net.br)
	for b2 in all:
		var bb: Dictionary = b2
		w.run(_spawn(func(gg): _rupture(c, w, net, bb, burst, vap, gg)))
		g.y(0.16)
	net.life = net.age + 1.4
	g.y(1.8)
