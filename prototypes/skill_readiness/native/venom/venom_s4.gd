class_name VenomS4
extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/skills/s2.ts` skill 08
## BRINE SERPENTS: the `Serpent` summon (16-segment Chain body, tapering
## radius, trail field shaded through MAT.brine, wormBody draw with stripe,
## per-segment scales, spikes and head shards), the `Ribbon` rupture
## projectile, and the full `serpents()` cast: three-role AI (seek / coil /
## lunge / visit / free), the reveal ramp, the rise-and-tighten phase, the
## 16-step head-to-tail rupture and the closing brine pools.
##
## PORT STATUS: written against the original source. Deliberately kept in its
## OWN script that `venom_skills.gd` does NOT preload. Adding it to
## `venom_s3.gd` broke the load of `venom_skills.gd` and took five
## differential shards and the runtime contract red at once (run 40815135917),
## because every shard preloads that registry. Keeping an unverified port in an
## unreferenced file means it cannot take the family down while it is being
## debugged.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const LIB = preload("res://prototypes/skill_readiness/native/venom/venom_skills_lib.gd")
const GEN = preload("res://prototypes/skill_readiness/native/venom/venom_gen.gd")

# ---------------------------------------------------------------------------
# 08 BRINE SERPENTS
# ---------------------------------------------------------------------------
# Port of the ORIGINAL `src/game/skills/s2.ts` `serpents()` together with its
# two authored effect classes, `Serpent` and `Ribbon`.
#
# Everything below is a line-by-line translation: the three-role serpent AI
# (seek / coil / lunge / visit / free), the `Chain` body with its tapering
# radius, the trail field that is shaded through `MAT.brine`, the reveal ramp,
# the rise-and-tighten phase, and the 16-step head-to-tail rupture that emits
# two `Ribbon` projectiles per serpent every other step.

## The ORIGINAL `SERP` palette. `hxn(0x0d2b2a)` rotates the byte channels.
static func SERP() -> Dictionary:
	return DRAW.pal(int(M.P["k0"]), LIB._hexn(0x0d2b2a), int(M.P["v0"]),
			int(M.P["v1"]), int(M.P["v3"]))


class Serpent extends FX.Fx:
	var ch = null
	var z: float = 0.0
	var hd: float = 0.0
	var reveal: float = 0.0
	var n: int = 16
	var gone: int = 0
	var trail: Array = []
	var mode: String = "seek"
	var tgt = null
	var aux: int = 0
	var auxT: float = 0.0
	var seq: Array = []
	var si: int = 0
	var bitten: bool = false
	var role: int = 0
	var ph: float = 0.0

	func _init(px: float, py: float, hd_: float, role_: int, ph_: float) -> void:
		x = px
		y = py
		hd = hd_
		ch = FX.Chain.new(px, py, 16, 3.1, hd_)
		kind = "summon"
		sy = py
		role = role_
		ph = ph_

	func upd(_w, _dt: float) -> void:
		ch.move(x, y)
		sy = y
		var l = null
		if trail.size() > 0:
			l = trail[trail.size() - 1]
		if l == null or M.hypot(float(l["x"]) - x, float(l["y"]) - y) > 3.0:
			trail.append({"x": x, "y": y})
			if trail.size() > 18:
				trail.remove_at(0)

	func rad(i: int) -> float:
		var u: float = float(i) / float(n)
		var base: float = 3.1 if i == 0 else 3.5 * (1.0 - u * 0.75) + 0.6
		return base * (1.0 - z * 0.015)

	func gnd(g, _w) -> void:
		var f = g.f
		var s: Array = ch.s
		f.reset()
		var k: float = clampf(1.0 - z / 9.0, 0.0, 1.0)
		var gn: int = gone
		for i in range(n - 1):
			if i < gn:
				continue
			f.capsule(float(s[i]["x"]), float(s[i]["y"]) + z * 0.6,
					float(s[i + 1]["x"]), float(s[i + 1]["y"]) + z * 0.6,
					(rad(i) + 0.8) * k, (rad(i + 1) + 0.8) * k)
		for i in range(trail.size() - 1):
			var r: float = 1.0 + (float(i) / float(trail.size())) * 1.6
			f.capsule(float(trail[i]["x"]), float(trail[i]["y"]),
					float(trail[i + 1]["x"]), float(trail[i + 1]["y"]),
					r * k, (r + 0.4) * k)
		f.shade(g.s, MATS.MAT()["brine"], g.t, {"seed": ph, "fx": 18})

	func up(g, _w) -> void:
		var L = g.s
		var t: float = g.t
		var s: Array = ch.s
		var vis: int = int(floor(reveal * float(n)))
		if vis < 1:
			return
		var pts: Array = []
		for i in range(n - 1, -1, -1):
			if i < gone or i > vis:
				continue
			pts.append({"x": float(s[i]["x"]),
					"y": float(s[i]["y"]) - 2.0 - z, "r": rad(i)})
		if pts.size() == 0:
			return
		DRAW.worm_body(L, pts,
				DRAW.pal(int(M.P["k0"]), LIB._hexn(0x0d2b2a), int(M.P["v0"]),
						int(M.P["v1"]), int(M.P["v3"])),
				{"stripe": int(M.P["y1"]), "stripeT": t * 0.6})
		for i in range(n):
			if i < gone or i > vis:
				continue
			var q: Dictionary = s[i]
			var nxt: Dictionary = s[mini(n - 1, i + 1)]
			var a: float = atan2(float(q["y"]) - float(nxt["y"]),
					float(q["x"]) - float(nxt["x"]))
			var px_: float = -sin(a)
			var py_: float = cos(a)
			var r: float = rad(i)
			var yy: float = float(q["y"]) - 2.0 - z
			L.px(M.js_round(float(q["x"]) + px_ * r * 0.8),
					M.js_round(yy + py_ * r * 0.8), int(M.P["v3"]))
			L.px(M.js_round(float(q["x"]) - px_ * r * 0.8),
					M.js_round(yy - py_ * r * 0.8), int(M.P["v0"]))
			if i > 0 and i % 2 == 1:
				DRAW.shard(L, float(q["x"]), yy - r + 0.5,
						-PI / 2.0 + sin(float(i) + t * 2.0) * 0.2,
						2.4 - float(i) * 0.07, 0.9, int(M.P["y2"]),
						int(M.P["v2"]), int(M.P["w"]))
			if i % 3 == 0 and reveal > 0.7:
				L.px(M.js_round(float(q["x"])), M.js_round(yy), int(M.P["c2"]))
		if vis >= 1:
			var h: Dictionary = s[0]
			var a2: float = hd
			var fx2: float = cos(a2)
			var fy2: float = sin(a2)
			var qx: float = -fy2
			var qy: float = fx2
			var hy: float = float(h["y"]) - 2.0 - z
			var op: float = 0.8 if mode == "lunge" else 0.3 + 0.2 * sin(t * 6.0)
			for sd in [-1.0, 1.0]:
				DRAW.shard(L, float(h["x"]) + fx2 * 2.5 + qx * sd,
						hy + fy2 * 2.5 + qy * sd, a2 + sd * op, 4.8, 1.2,
						int(M.P["y2"]), int(M.P["v2"]), int(M.P["w"]))
			L.px(M.js_round(float(h["x"]) + qx * 1.6 + fx2),
					M.js_round(hy + qy * 1.6 - 1.0), int(M.P["c3"]))
			L.px(M.js_round(float(h["x"]) - qx * 1.6 + fx2),
					M.js_round(hy - qy * 1.6 - 1.0), int(M.P["c3"]))

	func lit(g, _w) -> void:
		var h: Dictionary = ch.s[0]
		DRAW.glow(g.l, float(h["x"]), float(h["y"]) - 3.0 - z, 7.0,
				int(M.P["y1"]), 0.2 * reveal, 3)
		if reveal > 0.5:
			var m: Dictionary = ch.s[6]
			DRAW.glow(g.l, float(m["x"]), float(m["y"]) - 3.0 - z, 5.0,
					int(M.P["v2"]), 0.1, 2)


class Ribbon extends FX.Fx:
	var len_: float = 0.0
	var w0: float = 2.0
	var a: float = 0.0
	var L_: float = 0.0
	var cc = null
	var hh = null
	var pz = null
	var pool = null

	func _init(px: float, py: float, a_: float, L2: float, cc_, hh_, pz_,
			pool_ = null) -> void:
		x = px
		y = py
		a = a_
		L_ = L2
		cc = cc_
		hh = hh_
		pz = pz_
		kind = "ribbon"
		pool = MATS.MAT()["brine"] if pool_ == null else pool_

	func upd(w, _dt: float) -> void:
		var k: float = clampf(age / 0.3, 0.0, 1.0)
		len_ = L_ * (1.0 - pow(1.0 - k, 2.0))
		w0 = 2.0 + 5.0 * k * (1.0 - clampf((age - 0.7) / 0.7, 0.0, 1.0))
		if age > 1.4:
			dead = true
			return
		var ex: float = x + cos(a) * len_
		var ey: float = y + sin(a) * len_ * 0.9
		for e in w.enemies:
			if e.dying > 0:
				continue
			if w.seg_dist(e.x, e.y, x, y, ex, ey) < w0 + e.r * 0.7 \
					and hh.ok(e, w.time, 0.0, 2):
				LIB.hit_e(cc, e, 50, {"kind": "acid", "k": 110, "ang": a,
						"stag": 0.3, "at": [e.x, e.y]})
				if pz.ok(e, w.time):
					w.poison(e, cc.d(50), 3, cc.id, cc.def["id"])

	func gnd(g, _w) -> void:
		var f = g.f
		f.reset()
		var ex: float = x + cos(a) * len_
		var ey: float = y + sin(a) * len_ * 0.9
		f.capsule(x, y, ex, ey, w0, w0 * 0.7)
		f.disc(ex, ey, w0 * 0.9, 0.2)
		var dl: int = 16
		if age > 1.0:
			dl = maxi(2, M.js_round(16.0 * (1.4 - age) / 0.4))
		f.shade(g.s, MATS.MAT()["acid"], g.t,
				{"seed": float(int(floor(x))), "dl": dl})


static func serpents(c):
	var box: Array = []
	var g = GEN.new(func():
		_serpents(c, box[0])
		return null)
	box.append(g)
	return g


static func _serpents(c, g) -> void:
	var w = c.w
	LIB.cast_anim(w, c)
	g.y(0.04)
	var hp: Array = LIB.hand_pos(w)
	var hx: float = float(hp[0])
	var hy: float = float(hp[1])
	var tg: Array = []
	for e in c.targets:
		if e.dying <= 0:
			tg.append(e)
	if tg.size() < 3:
		var more: Array = []
		for e in w.enemies:
			if e.dying <= 0 and not tg.has(e):
				more.append(e)
		M.stable_sort(more, func(a, b): return M.hypot(a.x - c.tx, a.y - c.ty)
				- M.hypot(b.x - c.tx, b.y - c.ty))
		for e in more:
			tg.append(e)
		tg = tg.slice(0, mini(3, tg.size()))
	while tg.size() > 0 and tg.size() < 3:
		tg.append(tg[tg.size() - 1])
	var ox: float = M.lerpf(hx, c.tx, 0.4)
	var oy: float = M.lerpf(hy, c.ty, 0.4)
	LIB.throw_arc(w, "flask", hx, hy, ox, oy, 0.1, 5,
			func(_ww, _p): return null, 22)
	g.y(0.1)
	w.add(FX.Flash.new(ox, oy, 10, int(M.P["v3"]), 0.2, 5))
	FX.shards(w, ox, oy, 8, 80, int(M.P["v2"]), int(M.P["v1"]),
			int(M.P["y2"]), {"z": 6, "land": 3, "size": [2, 4]})
	FX.drops(w, ox, oy, 12, 70, int(M.P["n3"]), int(M.P["v2"]),
			int(M.P["k1"]), {"z": 6, "up": 80})
	var bites = FX.Hits.new()
	var ribs = FX.Hits.new()
	var pz = FX.Hits.new()
	var tick = FX.Hits.new()
	var S: Array = []
	for i in range(3):
		var s = Serpent.new(ox, oy, c.ang + float(i - 1) * 0.9, i, float(i) * 2.1)
		s.tgt = tg[i] if i < tg.size() else null
		if i == 2:
			for q in [tg[2] if tg.size() > 2 else null,
					tg[0] if tg.size() > 0 else null,
					tg[1] if tg.size() > 1 else null]:
				if q != null:
					s.seq.append(q)
		S.append(s)
		w.add(s)
	var tm: float = 0.0
	var T_RISE: float = 3.5
	var T_RUP: float = 4.3
	while tm < T_RUP:
		for s in S:
			s.reveal = clampf((tm - 0.1) / 0.8 + float(s.role) * -0.05, 0.0, 1.0)
			if tm < T_RISE:
				var e = s.tgt
				if not (e != null and e.dying <= 0):
					e = w.nearest(s.x, s.y, 220)
					s.tgt = e
				if s.mode == "seek" and e != null:
					var dx: float = e.x - s.x
					var dy: float = e.y - s.y
					var d: float = M.hypot(dx, dy)
					if d == 0.0:
						d = 1.0
					var want: float = atan2(dy, dx) + sin(tm * 5.5 + s.ph) * 0.62 \
							* clampf(d / 50.0, 0.1, 1.0)
					s.hd += clampf(M.ang_diff(s.hd, want), -7.0 * GEN.F,
							7.0 * GEN.F)
					var sp: float = 200.0 if s.role == 1 else 150.0
					s.x += cos(s.hd) * sp * GEN.F
					s.y += sin(s.hd) * sp * GEN.F
					if d < e.r + 6.0:
						if s.role == 0:
							s.mode = "coil"
							s.auxT = 0.0
							s.aux = 0
						elif s.role == 1:
							s.mode = "lunge"
							s.auxT = 0.0
							_bite(w, c, s, e, 40.0, 130.0, bites)
						else:
							s.mode = "visit"
							s.auxT = 0.0
							_bite(w, c, s, e, 40.0, 70.0, bites)
				elif s.mode == "coil" and e != null:
					s.auxT += GEN.F
					var th: float = s.auxT * 7.0 + s.ph
					var rr: float = e.r + 4.5
					s.x = e.x + cos(th) * rr
					s.y = e.y + sin(th) * rr * 0.9
					s.hd = th + PI / 2.0
					w.mark(e, "coil", 0.2, 1.0)
					e.kx *= 0.5
					e.ky *= 0.5
					if s.auxT > 0.2 * float(s.aux + 1) and s.aux < 3:
						s.aux += 1
						if tick.ok(e, w.time, 0.3, 3):
							LIB.hit_e(c, e, 20, {"kind": "pierce", "stag": 0.1,
									"at": [e.x, e.y]})
						w.add(FX.Splash.new(e.x + cos(th) * rr,
								e.y + sin(th) * rr, 4, int(M.P["v2"]),
								int(M.P["y1"])))
					if s.auxT > 1.5:
						s.mode = "free"
				elif s.mode == "lunge" and e != null:
					s.auxT += GEN.F
					var a3: float = atan2(e.y - s.y, e.x - s.x)
					if s.auxT < 0.2:
						s.x += cos(s.hd) * 230.0 * GEN.F
						s.y += sin(s.hd) * 230.0 * GEN.F
					else:
						s.hd += 8.0 * GEN.F
						s.x += cos(s.hd) * 120.0 * GEN.F
						s.y += sin(s.hd) * 120.0 * GEN.F
					if s.auxT > 1.0:
						s.mode = "seek"
						s.si += 1
						s.tgt = tg[s.si % 3] if tg.size() > 0 else null
				elif s.mode == "visit":
					s.auxT += GEN.F
					s.hd += 6.0 * GEN.F
					s.x += cos(s.hd) * 110.0 * GEN.F
					s.y += sin(s.hd) * 110.0 * GEN.F
					if s.auxT > 0.35:
						s.mode = "seek"
						s.si += 1
						s.tgt = s.seq[s.si % s.seq.size()] if s.seq.size() > 0 \
								else null
				elif s.mode == "free":
					var cc: Dictionary = _centroid(tg, ox, oy)
					s.hd += clampf(M.ang_diff(s.hd,
							atan2(cc["y"] - s.y, cc["x"] - s.x) + 1.2),
							-6.0 * GEN.F, 6.0 * GEN.F)
					s.x += cos(s.hd) * 90.0 * GEN.F
					s.y += sin(s.hd) * 90.0 * GEN.F
				else:
					s.hd += 3.0 * GEN.F
					s.x += cos(s.hd) * 60.0 * GEN.F
					s.y += sin(s.hd) * 60.0 * GEN.F
				s.x = clampf(s.x, 8.0, w.W - 8.0)
				s.y = clampf(s.y, 10.0, w.H - 10.0)
				if int(floor(tm * 60.0)) % 5 == 0 and s.reveal > 0.2:
					w.parts.add({"k": "drop", "x": s.x, "y": s.y, "z": 3,
							"vx": c.rng.range(-10, 10),
							"vy": c.rng.range(-8, 8), "vz": 30, "grav": 200,
							"size": 1, "c1": int(M.P["v2"]),
							"c2": int(M.P["y1"]), "c3": int(M.P["n3"]),
							"land": 1, "max": 1})
			else:
				var k2: float = clampf((tm - T_RISE) / (T_RUP - T_RISE), 0.0, 1.0)
				var cc2: Dictionary = _centroid(tg, ox, oy)
				s.z = M.smoothstep(k2) * 9.0
				s.ch.gap = M.lerpf(3.1, 2.0, M.smoothstep(k2))
				s.mode = "tight"
				var th2: float = tm * 6.0 + s.ph
				var rr2: float = M.lerpf(14.0, 8.0, k2)
				var ccx: float = cc2["x"] + float(s.role - 1) * 18.0
				var ccy: float = cc2["y"]
				if s.role == 0 and s.tgt != null and s.tgt.dying <= 0:
					ccx = s.tgt.x
					ccy = s.tgt.y
				s.x = M.lerpf(s.x, ccx + cos(th2) * rr2, 0.14)
				s.y = M.lerpf(s.y, ccy + sin(th2) * rr2 * 0.8, 0.14)
				s.hd = th2 + PI / 2.0
		g.y(GEN.F)
		tm += GEN.F
	w.screen_flash(int(M.P["v3"]), 0.25, 0.12)
	w.shake(5, 0.4)
	var released: int = 0
	for i in range(16):
		for s in S:
			var q: Dictionary = s.ch.s[i]
			var nx: Dictionary = s.ch.s[mini(15, i + 1)]
			var a4: float = atan2(float(q["y"]) - float(nx["y"]),
					float(q["x"]) - float(nx["x"])) + PI / 2.0
			s.gone = i + 1
			FX.drops(w, float(q["x"]), float(q["y"]), 3, 60, int(M.P["v2"]),
					int(M.P["y1"]), int(M.P["n3"]),
					{"z": 6 + s.z, "up": 90, "glow": 1})
			FX.shards(w, float(q["x"]), float(q["y"]), 2, 80, int(M.P["y1"]),
					int(M.P["v1"]), int(M.P["y2"]),
					{"z": 6 + s.z, "land": 1, "size": [2, 4]})
			if i % 2 == 0:
				w.add(Ribbon.new(float(q["x"]), float(q["y"]),
						a4 + (0.0 if (i % 4) != 0 else PI)
								+ c.rng.range(-0.25, 0.25),
						c.rng.range(30, 46), c, ribs, pz))
				w.add(Ribbon.new(float(q["x"]), float(q["y"]),
						a4 + PI + (0.0 if (i % 4) != 0 else PI)
								+ c.rng.range(-0.25, 0.25),
						c.rng.range(26, 40), c, ribs, pz))
				released += 1
			if i % 4 == 0:
				w.add(FX.Flash.new(float(q["x"]), float(q["y"]) - 4.0 - s.z, 7,
						int(M.P["y2"]), 0.18, 4))
				w.shock(float(q["x"]), float(q["y"]), 26, 0.2, 1.5)
		if i % 2 == 0:
			w.shake(3, 0.12)
		g.y(0.045)
	for s in S:
		s.dead = true
		var p0: Dictionary = s.ch.s[0]
		w.add(FX.Pool.new(float(p0["x"]), float(p0["y"]), 9,
				MATS.MAT()["brine"], 2.5,
				{"blobs": 4, "resid": true, "boil": 1}))
	g.y(1.4)


## The ORIGINAL `bite` closure inside `serpents()`.
static func _bite(w, c, s, e, pct: float, k: float, bites) -> void:
	var a: float = atan2(e.y - s.y, e.x - s.x)
	if bites.ok(e, w.time, 0.3, 2):
		LIB.hit_e(c, e, pct, {"kind": "bite", "k": k, "ang": a, "stag": 0.35,
				"at": [e.x - cos(a) * e.r, e.y - sin(a) * e.r]})
	else:
		FX.drops(w, e.x, e.y, 4, 40, int(M.P["n3"]), int(M.P["v2"]),
				int(M.P["k1"]), {"z": 5})
	w.add(FX.Splash.new(e.x, e.y, 5, int(M.P["v2"]), int(M.P["y1"])))


## The ORIGINAL `centroid` closure: the mean of the still-living locked
## targets, falling back to the throw origin when none remain.
static func _centroid(tg: Array, ox: float, oy: float) -> Dictionary:
	var sx: float = 0.0
	var sy_: float = 0.0
	var n: int = 0
	for e in tg:
		if e != null and e.dying <= 0:
			sx += e.x
			sy_ += e.y
			n += 1
	if n == 0:
		return {"x": ox, "y": oy}
	return {"x": sx / float(n), "y": sy_ / float(n)}
