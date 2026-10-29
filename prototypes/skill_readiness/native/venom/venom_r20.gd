extends RefCounted
## 20 PLAGUE CARTOGRAPHY -- native port of `s4.ts` lines 257-351 (original `cartography`).
## Candidate until the original-source differential passes.
## Mutable closure state (branch list, next waypoint, current branch) lives in the
## RefCounted `CartState`, because GDScript lambdas capture locals by value.
## Branches are Dictionaries from venom_flow.gd (`mk_branch`), exactly as the TS
## branch objects are read and mutated in place.

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")
const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")
const FLOW = preload("res://prototypes/skill_readiness/native/venom/venom_flow.gd")


class CartState extends RefCounted:
	## TS `let cur: Branch | null`.
	var cur = null
	## TS `branches: Branch[]`.
	var branches: Array = []
	## TS `nextWp`.
	var next_wp: int = 0


## TS `class Pulse extends Fx` -- a travelling acid pulse along a flow branch.
class Pulse extends FX.Fx:
	static func _p(k: String) -> int:
		return int(M.P[k])

	var b: Dictionary
	var net
	var d: float = 0.0
	var d0: float = 0.0
	var dir: float = 1.0
	var cc
	var wh
	## TS `hit = new Set<number>()`.
	var hit: Dictionary = {}

	func _init(b_: Dictionary, net_, d0_: float, dir_: float, cc_, wh_) -> void:
		kind = "pulse"
		b = b_
		net = net_
		d0 = d0_
		dir = dir_
		cc = cc_
		wh = wh_
		## TS `update_()`: this.d = this.d0.
		d = d0
		push_error("GOLD93_D20 pulse dir=%.0f d0=%.2f len=%.2f" % [dir, d0, float(b["len"])])  # TEMP-DIAG

	func upd(w, _dt: float) -> void:
		d += dir * 230.0 * (1.0 / 60.0)
		if d < 0.0 or d > float(b["len"]):
			dead = true
			return
		var q: Dictionary = net.point_at(b, d)
		x = float(q["x"])
		y = float(q["y"])
		for e in w.enemies:
			if float(e.dying) > 0.0 or hit.has(e.id):
				continue
			if V8M.v8_hypot(float(e.x) - float(q["x"]), float(e.y) - float(q["y"])) < 10.0 + float(e.r) * 0.6 and wh.ok(e, w.time, 0.0, 2.0):
				hit[e.id] = true
				LIB.hit_e(cc, e, 30.0, {"kind": "acid", "k": 80.0, "ang": q["ang"], "stag": 0.3, "at": [e.x, e.y]})
				FX.drops(w, e.x, e.y, 6, 60.0, _p("c1"), _p("c3"), _p("e2"), {"z": 5.0, "glow": 1.0})
		if int(floor(age * 60.0)) % 2 == 0:
			w.parts.add({"k": "drop", "x": x, "y": y, "z": 3.0, "vx": 0.0, "vy": 0.0, "vz": 30.0, "grav": 160.0, "size": 1.0, "c1": _p("c3"), "c2": _p("w"), "c3": _p("c1"), "land": 1, "max": 0.6, "glow": 1})

	func gnd(g, _w) -> void:
		var L = g.s
		L.dl = 12
		L.disc(x, y, 5.0, _p("c1"))
		L.dl = 16
		L.disc(x, y, 3.0, _p("c3"))
		L.px(int(M.js_round(x)), int(M.js_round(y)), _p("w"))

	func lit(g, _w) -> void:
		DRAW.glow(g.l, x, y, 12.0, _p("c2"), 0.4, 3)


static func _p(k: String) -> int:
	return int(M.P[k])


static func cartography(c) -> Object:
	var box: Array = []
	var gen = GEN.new(func():
		_cartography_body(c, box[0])
		return null)
	box.append(gen)
	return gen


static func _spawn(body: Callable):
	var box: Array = []
	var gen = GEN.new(func():
		body.call(box[0])
		return null)
	box.append(gen)
	return gen


static func _start_branch(st: CartState, net, p) -> void:
	var pts: Array = [{"x": p.x, "y": p.y}, {"x": float(p.x) + 0.1, "y": float(p.y) + 0.1}]
	st.cur = FLOW.mk_branch(pts, 1.6, 0.0, 1e9, float(st.branches.size() + 1))
	net.add(st.cur)
	st.branches.append(st.cur)


static func _reservoir_pulse(gg, c, w, q: Dictionary, d: Dictionary, i: int) -> void:
	gg.y(float(i) * 0.3)
	for k in GEN.ticks(0.35):
		d["r"] = 2.0 + 9.0 * M.smoothstep(k)
		gg.y(GEN.F)
		if int(floor(k * 60.0)) % 3 == 0:
			w.parts.add({"k": "bubble", "x": float(q["x"]) + c.rng.range(-5.0, 5.0), "y": float(q["y"]) + c.rng.range(-3.0, 3.0), "z": 0.0, "vz": 24.0, "max": 0.6, "size": 2.0, "c1": _p("v1"), "c2": _p("c3"), "c3": _p("w")})


static func _cartography_body(c, g) -> void:
	var w = c.w
	var p = w.player
	LIB.cast_anim(w, c, true, 0.3)
	var route: Array = []
	if c.route.size() >= 2:
		route = c.route.slice(0, 7)
	if route.size() < 2:
		var cx: float = float(c.tx)
		var cy: float = float(c.ty)
		var r: float = 70.0
		var a0: float = float(c.ang)
		var idx: Array = [0, 2, 4, 1, 3]
		route = []
		for i in idx:
			route.append({
				"x": M.clampf(cx + V8M.v8_cos(a0 + (float(i) / 5.0) * M.TAU) * r, 16.0, float(w.W) - 16.0),
				"y": M.clampf(cy + V8M.v8_sin(a0 + (float(i) / 5.0) * M.TAU) * r * 0.85, 22.0, float(w.H) - 14.0)})
	var clamped: Array = []
	for q in route:
		clamped.append({"x": M.clampf(float(q["x"]), 14.0, float(w.W) - 14.0), "y": M.clampf(float(q["y"]), 20.0, float(w.H) - 12.0)})
	route = clamped
	var closing: Dictionary = route[0]
	var net = FLOW.FlowNet.new(MATS.MAT()["verd"], 12.0)
	var chan = FX.Hits.new()
	var res = FX.Hits.new()
	var wv = FX.Hits.new()
	var flood = FX.Hits.new()
	net.on_touch = func(ww, e):
		if chan.ok(e, ww.time, 0.36, 5):
			LIB.hit_e(c, e, 22.0, {"kind": "acid", "k": 40.0, "from": [p.x, p.y], "stag": 0.15, "at": [e.x, e.y]})
			ww.mark(e, "corrode", 2.2, 2.0)
	net.tick = {"every": 0.4, "amt": c.d(22.0), "opts": {"kind": "acid", "src": int(c.def["id"]), "stagger": 0.08}, "h": chan, "max": 5, "mark": "corrode", "markDur": 2.2}
	w.add(net)
	var pts: Array = [{"x": p.x, "y": p.y}]
	pts.append_array(route)
	var total: float = 0.0
	for i in range(1, pts.size()):
		total += V8M.v8_hypot(float(pts[i]["x"]) - float(pts[i - 1]["x"]), float(pts[i]["y"]) - float(pts[i - 1]["y"]))
	var last_route: Dictionary = route[route.size() - 1]
	total += V8M.v8_hypot(float(closing["x"]) - float(last_route["x"]), float(closing["y"]) - float(last_route["y"]))
	var dur: float = M.clampf(total / 210.0, 1.0, 2.0)
	g.y(0.04)
	w.glide(route, dur)
	# the streams are laid down along the alchemist's actual movement
	var st := CartState.new()
	_start_branch(st, net, p)
	var nodes: Array = [{"x": p.x, "y": p.y}]
	var last_x: float = float(p.x)
	var last_y: float = float(p.y)
	while p.path != null:
		if V8M.v8_hypot(float(p.x) - last_x, float(p.y) - last_y) > 5.0 and st.cur != null:
			last_x = float(p.x)
			last_y = float(p.y)
			var b: Dictionary = st.cur
			var pts_b: Array = b["pts"]
			var n0: int = pts_b.size()
			pts_b.append({"x": float(p.x) + V8M.v8_sin(float(n0) * 1.7) * 0.8, "y": float(p.y) + V8M.v8_cos(float(n0) * 1.3) * 0.8})
			var n: int = pts_b.size()
			var cum: Array = b["cum"]
			cum.append(float(cum[n - 2]) + V8M.v8_hypot(float(pts_b[n - 1]["x"]) - float(pts_b[n - 2]["x"]), float(pts_b[n - 1]["y"]) - float(pts_b[n - 2]["y"])))
			b["len"] = float(cum[n - 1])
			b["w"] = minf(3.4, 1.4 + float(st.branches.size()) * 0.45)
		if st.next_wp < route.size():
			var nw: Dictionary = route[st.next_wp]
			if V8M.v8_hypot(float(p.x) - float(nw["x"]), float(p.y) - float(nw["y"])) < 7.0:
				nodes.append({"x": nw["x"], "y": nw["y"]})
				st.next_wp += 1
				if st.next_wp < route.size():
					_start_branch(st, net, p)
		if int(floor(w.time * 60.0)) % 3 == 0:
			FX.drops(w, p.x, p.y, 2, 30.0, _p("v2"), _p("c3"), _p("e2"), {"z": 3.0, "up": 30.0, "glow": 1.0})
		g.y(GEN.F)
	# final connection closes the loop
	var last_p: Dictionary = route[route.size() - 1]
	var cb_pts: Array = FLOW.wavy_path(float(last_p["x"]), float(last_p["y"]), V8M.v8_atan2(float(closing["y"]) - float(last_p["y"]), float(closing["x"]) - float(last_p["x"])), V8M.v8_hypot(float(closing["x"]) - float(last_p["x"]), float(closing["y"]) - float(last_p["y"])), 0.15, 7.0, float(c.id + 5))
	var cb: Dictionary = FLOW.mk_branch(cb_pts, 2.4, net.age, 380.0, 8.0)
	cb["pts"][cb["pts"].size() - 1] = {"x": closing["x"], "y": closing["y"]}
	net.add(cb)
	st.branches.append(cb)
	g.y(float(cb["len"]) / 380.0 + 0.05)
	w.add(FX.Flash.new(closing["x"], closing["y"], 12.0, _p("v3"), 0.3, 0.0))
	# channels widen into thick flowing currents with foaming edges and branching offshoots
	var offs: Array = []
	for i in range(st.branches.size()):
		var b2: Dictionary = st.branches[i]
		var q: Dictionary = net.point_at(b2, float(b2["len"]) * (0.35 + 0.3 * M.hash_n(float(i + c.id))))
		var turn: float = 1.0 if i % 2 != 0 else -1.0
		var nb: Dictionary = FLOW.mk_branch(FLOW.wavy_path(float(q["x"]), float(q["y"]), float(q["ang"]) + turn * 1.0, 24.0 + M.hash_n(float(i * 3)) * 16.0, 0.4, 6.0, float(c.id + i + 9)), 2.2, net.age + 0.05, 160.0, float(20 + i))
		offs.append(nb)
		net.add(nb)
	for k in GEN.ticks(0.55):
		for b3 in st.branches:
			b3["w"] = M.lerpf(float(b3["w"]), 5.2, 0.08)
		g.y(GEN.F)
	net.life = net.age + 9.0
	# intersections become turbulent mixing reservoirs
	var segs: Array = []
	for i in range(pts.size() - 1):
		segs.append([float(pts[i]["x"]), float(pts[i]["y"]), float(pts[i + 1]["x"]), float(pts[i + 1]["y"])])
	segs.append([float(last_p["x"]), float(last_p["y"]), float(closing["x"]), float(closing["y"])])
	var inter: Array = []
	for i in range(segs.size()):
		for j in range(i + 2, segs.size()):
			var s1: Array = segs[i]
			var s2: Array = segs[j]
			var sa: float = s1[0]
			var sb: float = s1[1]
			var sc2: float = s1[2]
			var sd: float = s1[3]
			var se: float = s2[0]
			var sf: float = s2[1]
			var sg: float = s2[2]
			var sh: float = s2[3]
			var den: float = (sc2 - sa) * (sh - sf) - (sd - sb) * (sg - se)
			if absf(den) < 1e-6:
				continue
			var u: float = ((se - sa) * (sh - sf) - (sf - sb) * (sg - se)) / den
			var v: float = ((se - sa) * (sd - sb) - (sf - sb) * (sc2 - sa)) / den
			if u > 0.04 and u < 0.96 and v > 0.04 and v < 0.96:
				inter.append({"x": sa + u * (sc2 - sa), "y": sb + u * (sd - sb)})
	var reservoirs_all: Array = nodes.slice(1)
	reservoirs_all.append_array(inter)
	var reservoirs: Array = reservoirs_all.slice(0, 12)
	var discs_idx: Array = []
	for q2 in reservoirs:
		var dd: Dictionary = {"x": q2["x"], "y": q2["y"], "r": 2.0}
		net.discs.append(dd)
		discs_idx.append(dd)
	for i in range(reservoirs.size()):
		var qr: Dictionary = reservoirs[i]
		var dr: Dictionary = discs_idx[i]
		w.run(_spawn(func(gg): _reservoir_pulse(gg, c, w, qr, dr, i)))
	g.y(0.5)
	# the reservoirs activate in sequence, sending new waves along the channels
	for i in range(reservoirs.size()):
		var q3: Dictionary = reservoirs[i]
		var d3: Dictionary = discs_idx[i]
		LIB.ring_at(c, q3["x"], q3["y"], 28.0, 0.24, 55.0, {"kind": "burst", "knock": 130.0, "stag": 0.4, "h": res, "max": 2, "cols": [_p("w"), _p("c2"), _p("e2")], "w": 3.0})
		w.add(FX.Flash.new(q3["x"], float(q3["y"]) - 3.0, 18.0, _p("c3"), 0.28, 3.0))
		FX.drops(w, q3["x"], q3["y"], 14, 100.0, _p("c1"), _p("c3"), _p("e2"), {"z": 6.0, "up": 120.0, "glow": 2.0})
		w.shake(2.5, 0.15)
		w.shock(q3["x"], q3["y"], 36.0, 0.25, 2.0)
		S2.plume(w, q3["x"], q3["y"], 24.0, 0.9, MATS.VAP()["pale"], 8.0, i)
		var best: Variant = null
		var bd: float = 12.0
		for b4 in net.br:
			var s: float = 0.0
			while s <= float(b4["len"]):
				var o: Dictionary = net.point_at(b4, s)
				var dist: float = V8M.v8_hypot(float(o["x"]) - float(q3["x"]), float(o["y"]) - float(q3["y"]))
				if dist < bd:
					bd = dist
					best = {"b": b4, "d": s}
				s += 6.0
		push_error("GOLD93_D20 act %d q=%.2f,%.2f br=%d best=%s bd=%.2f" % [i, float(q3["x"]), float(q3["y"]), net.br.size(), str(best != null), bd])  # TEMP-DIAG
		if best != null:
			w.add(Pulse.new(best["b"], net, best["d"], 1.0, c, wv))
			w.add(Pulse.new(best["b"], net, best["d"], -1.0, c, wv))
		for kk in GEN.ticks(0.12):
			d3["r"] = M.lerpf(11.0, 6.0, kk)
			g.y(GEN.F)
		g.y(0.1)
	g.y(0.4)
	# sweeping flood
	w.screen_flash(_p("v3"), 0.3, 0.14)
	w.shake(7.0, 0.5)
	net.crust = 0.0
	for k in GEN.ticks(0.5):
		for b5 in net.br:
			b5["w"] = M.lerpf(float(b5["w"]), 15.0, 0.12)
		for d5 in discs_idx:
			d5["r"] = M.lerpf(float(d5["r"]), 22.0, 0.1)
		if int(floor(k * 60.0)) % 4 == 0:
			w.shake(4.0, 0.1)
		g.y(GEN.F)
	for i in range(reservoirs.size()):
		var q4: Dictionary = reservoirs[i]
		LIB.ring_at(c, q4["x"], q4["y"], 62.0, 0.5, 125.0, {"kind": "acid", "knock": 150.0, "stag": 0.5, "h": flood, "max": 1, "cols": [_p("v3"), _p("v2"), _p("e2")], "w": 6.0, "fill": true, "ease": 1.8})
		FX.shards(w, q4["x"], q4["y"], 10, 130.0, _p("v3"), _p("v1"), _p("y2"), {"z": 8.0, "up": 130.0, "land": 2, "size": [3.0, 6.0]})
		FX.chips(w, q4["x"], q4["y"], 3, 80.0, _p("k3"), _p("k1"), _p("v1"), {"z": 8.0, "up": 100.0})
		var cl = FX.Cloud.new(q4["x"], q4["y"], LIB.mk_puffs(c.rng, 6, 12.0, 9.0, 15.0, 6.0, 1.8), MATS.VAP()["green"], 3.2, c.id + 3)
		cl.grow = {"from": 0.4, "to": 1.7, "dur": 1.2}
		cl.vx = c.rng.range(-14.0, 14.0)
		cl.vy = c.rng.range(-10.0, 10.0)
		w.add(cl)
		w.shock(q4["x"], q4["y"], 80.0, 0.5, 2.5)
		if i % 2 == 0:
			w.add(FX.Pool.new(q4["x"], q4["y"], 22.0, MATS.MAT()["verd"], 4.0, {"blobs": 5, "boil": 2.0}))
	net.life = net.age + 2.2
	g.y(2.6)
