class_name VenomSkillsLib
extends RefCounted

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")

## Native port of the ORIGINAL Venomwright `src/game/skills/lib.ts` helpers:
## the frame clock, `hitE`, `ringAt`, `visRing`, `mkPuffs`, `drawFlask`, the
## liquid table `LIQ`, `vialSprite`, `throwArc`, `handPos` and `castAnim`.
##
## NOTE ON GENERATORS: GDScript has no `function*` / `yield`. The skill bodies
## in the original are generators driven by `World.step`, so each one is hand
## converted into an explicit state machine (see venom_s1.gd) that reproduces
## the SAME suspend/resume points and the same yielded wait values. The
## conversion is mechanical, but the wait values and the RNG draw order must
## stay identical or the timeline desynchronises.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")
const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")

const F: float = 1.0 / 60.0


## `ticks(sec)` from the original: n = max(1, round(sec*60)), yielding i/n.
static func tick_count(sec: float) -> int:
	return maxi(1, M.js_round(sec * 60.0))


static func dist(a, b) -> float:
	return sqrt(V8M.v8_pow(float(a["x"]) - float(b["x"]), 2.0)
			+ V8M.v8_pow(float(a["y"]) - float(b["y"]), 2.0))


## Authored damage entry point. Every skill routes its numbers through this, so
## `c.d(frac)` -> ATK * frac / 100 is the only place skill damage is scaled.
static func hit_e(c, e, frac: float, o: Dictionary = {}) -> bool:
	var kx: float = 0.0
	var ky: float = 0.0
	if o.has("k"):
		var a: float = float(o.get("ang", 0.0))
		if o.has("from"):
			var fr = o["from"]
			a = V8M.v8_atan2(e.y - float(fr[1]), e.x - float(fr[0]))
		kx = V8M.v8_cos(a) * float(o["k"])
		ky = V8M.v8_sin(a) * float(o["k"])
	var opts: Dictionary = {
		"kind": String(o.get("kind", "impact")),
		"src": int(c.def["id"]),
		"kx": kx, "ky": ky,
	}
	if o.has("stag"):
		opts["stagger"] = o["stag"]
	if o.has("at"):
		opts["at"] = o["at"]
	if o.has("big"):
		opts["big"] = bool(o["big"])
	if o.has("heal"):
		opts["heal"] = float(o["heal"])
	if o.has("quiet"):
		opts["quiet"] = bool(o["quiet"])
	return c.w.hit(e, c.d(frac), opts)


static func ring_at(c, x: float, y: float, r1: float, dur: float, frac: float,
		o: Dictionary = {}):
	var h = o.get("h", null)
	if h == null:
		h = FX.Hits.new()
	var ring_opts: Dictionary = {}
	if o.has("r0"):
		ring_opts["r0"] = o["r0"]
	if o.has("w"):
		ring_opts["w"] = o["w"]
	if o.has("cols"):
		ring_opts["cols"] = o["cols"]
	if o.has("fill"):
		ring_opts["fill"] = bool(o["fill"])
	if o.has("dust"):
		ring_opts["dust"] = bool(o["dust"])
	if o.has("ease"):
		ring_opts["ease"] = o["ease"]
	ring_opts["hit"] = {
		"h": h,
		"amt": c.d(frac),
		"opts": {"kind": String(o.get("kind", "impact")), "src": int(c.def["id"])},
		"knock": float(o.get("knock", 0.0)),
		"stagger": o.get("stag", null),
		"max": o.get("max", 1e18),
		"cd": o.get("cd", 1e18),
	}
	return c.w.add(FX.Ring.new(x, y, r1, dur, ring_opts))


static func vis_ring(w, x: float, y: float, r1: float, dur: float, cols: Array,
		wd: float = 3.0, o: Dictionary = {}):
	var opts: Dictionary = {"w": wd, "cols": cols}
	for k in o:
		opts[k] = o[k]
	return w.add(FX.Ring.new(x, y, r1, dur, opts))


## Deterministic puff cloud layout. RNG order per puff:
## angle, sqrt(next()) radius, r, ph, sp, sp-sign, orb.
static func mk_puffs(rng, n: int, R: float, rmin: float, rmax: float, orb: float,
		sp: float, lay: float = 0.0) -> Array:
	var a: Array = []
	for _i in range(n):
		var ang: float = rng.range(0.0, M.TAU)
		var d: float = sqrt(rng.next()) * R
		a.append({
			"x": V8M.v8_cos(ang) * d, "y": V8M.v8_sin(ang) * d * 0.8,
			"r": rng.range(rmin, rmax),
			"ph": rng.range(0.0, M.TAU),
			"sp": rng.range(0.5, sp) * rng.sign(),
			"orb": rng.range(1.0, orb),
			"lay": lay,
		})
	return a


# ---------------------------------------------------------------------------
# flask with sloshing liquid, meniscus and bubbles
# ---------------------------------------------------------------------------

static func draw_flask(L, cx: float, cy: float, r: float, fill: float, tilt: float,
		liq: Array, t: float, glass: Dictionary = {}, bubbles: bool = true) -> void:
	var pal: Dictionary = glass if glass.size() > 0 else MATS.PAL()["glassHi"]
	var sd: int = L.dl
	L.dl = 7
	L.disc(cx, cy, r, int(pal["b"]))
	L.dl = sd
	var lvl: float = (1 - fill * 2) * (r - 1)
	var rr: float = (r - 0.6) * (r - 0.6)
	var dx: float = -floor(r) + 1.0
	while dx <= floor(r) - 1:
		var yb: float = floor(sqrt(maxf(0.0, rr - dx * dx)))
		var ys: float = maxf(-yb, float(M.js_round(lvl + tilt * dx)))
		var y: float = ys
		while y <= yb:
			var d: float = y - ys
			var n: float = float(RNG.nz1((cx + dx) * 0.22 + t * 3,
					(cy + y) * 0.22 - t * 2)) / 255.0
			var c: int
			if d <= 0.6:
				c = int(liq[3])
			elif d < 2.2:
				c = int(liq[2])
			elif n > 0.62:
				c = int(liq[2])
			elif n > 0.3:
				c = int(liq[1])
			else:
				c = int(liq[0])
			L.dot(cx + dx, cy + y, c)
			y += 0.5
		dx += 0.5
	L.ring(cx, cy, r, 0.9, int(pal["d"]))
	L.arc(cx, cy, maxf(1, r - 0.8), 0.8, PI * 1.08, PI * 1.55, int(pal["s"]))
	L.dot(cx + r * 0.52, cy + r * 0.52, int(pal["l"]))
	if bubbles and r > 2.8:
		for i in range(3):
			var ph: float = fmod(t * (0.6 + float(i) * 0.25) + float(i) * 0.37, 1.0)
			var bx: float = cx + V8M.v8_sin(float(i) * 2.4 + t) * (r * 0.45)
			var by: float = cy + r * 0.6 - ph * r * 1.1
			if by > cy + lvl + tilt * (bx - cx) + 0.8:
				L.dot(bx, by, int(liq[3]))


static func _hexn(n: int) -> int:
	return M.u32(0xFF000000 | ((n & 255) << 16) | (n & 0xFF00) | ((n >> 16) & 255))


static func LIQ() -> Dictionary:
	var P: Dictionary = M.P
	return {
		"acid": [P["e1"], P["e2"], P["c0"], P["c2"]],
		"gold": [P["g0"], P["g1"], P["g2"], P["c3"]],
		"cyan": [P["v0"], P["v1"], P["v2"], P["y2"]],
		"mag": [P["m0"], P["m1"], P["m2"], P["w"]],
		"dark": [P["k1"], P["e0"], P["e1"], P["e3"]],
		"merc": [_hexn(0x15484A), _hexn(0x4C8F8A), _hexn(0xB5E6DF), P["w"]],
	}


# ---------------------------------------------------------------------------
# thrown vessels
# ---------------------------------------------------------------------------

static func _glow_for(kind: String) -> int:
	var P: Dictionary = M.P
	match kind:
		"vial", "flask", "heavy":
			return int(P["c1"])
		"seed":
			return int(P["c2"])
		"cocoon":
			return int(P["g1"])
		"bead", "crystal":
			return int(P["y1"])
		"gold":
			return int(P["g2"])
		"globule":
			return int(P["c2"])
	return int(P["c1"])


static func vial_sprite(g, x: float, y: float, kind: String, rot: float,
		a: float = 0.0) -> void:
	var L = g.s
	var P: Dictionary = M.P
	var pal := MATS.PAL()
	match kind:
		"vial":
			DRAW.ball(L, x, y, 2.4, pal["glassHi"])
			L.rect(x - 1, y, 3, 2, int(P["c1"]))
			L.dot(x - 1, y - 1, int(P["w"]))
			L.dot(x + V8M.v8_cos(rot) * 3, y + V8M.v8_sin(rot) * 3, int(P["u1"]))
		"flask":
			DRAW.ball(L, x, y, 3.2, pal["glassHi"])
			L.rect(x - 2, y, 5, 3, int(P["c1"]))
			L.dot(x - 1, y - 1, int(P["w"]))
			L.dot(x + V8M.v8_cos(rot) * 4, y + V8M.v8_sin(rot) * 4, int(P["u2"]))
		"seed":
			DRAW.ball(L, x, y, 2.8, pal["seed"], 3.4)
			L.dot(x, y - 1, int(P["c2"]))
			L.dot(x + V8M.v8_cos(rot), y + V8M.v8_sin(rot), int(P["e3"]))
		"cocoon":
			DRAW.ball(L, x, y, 6.5, pal["chitin"], 8.5)
			for i in range(-1, 2):
				L.line(x + float(i) * 3, y - 6, x + float(i) * 2, y + 6, int(P["g1"]))
			L.dot(x - 2, y - 3, int(P["c2"]))
			L.dot(x + 2, y + 1, int(P["c2"]))
		"bead":
			DRAW.ball(L, x, y, 2.4, pal["merc"])
			L.dot(x - 1, y - 1, int(P["w"]))
		"crystal":
			DRAW.shard(L, x, y, rot, 4.2, 1.8, int(P["y1"]), int(P["v1"]), int(P["y2"]))
		"gold":
			DRAW.ball(L, x, y, 2.6, pal["gold"])
			L.dot(x - 1, y - 1, int(P["w"]))
			L.rect(x - 1, y, 3, 1.2, int(P["c3"]))
		"globule":
			var pu: bool = V8M.v8_sin(a * 40) > 0
			DRAW.ball(L, x, y, 3.8, pal["liquid"])
			L.disc(x + 1, y + 1, 1.5, int(P["k0"]))
			L.dot(x - 2, y - 2, int(P["w"]) if pu else int(P["c3"]))
			if pu:
				L.dot(x + 2, y - 1, int(P["m2"]))
		"heavy":
			DRAW.ball(L, x, y, 3.2, pal["glass"])
			L.rect(x - 2, y, 5, 3, int(P["e3"]))
			L.dot(x - 1, y - 1, int(P["w"]))


static func throw_arc(w, kind: String, x0: float, y0: float, x1: float,
		y1: float, dur: float, arc: float, on_end: Callable, spin: float = 14.0):
	var gcol: int = _glow_for(kind)
	var draw_fn := func(g, x, y, _z, a):
		vial_sprite(g, x, y, kind, a * spin, a)
	var p = FX.Proj.new(x0, y0, x1, y1, dur, arc, draw_fn, on_end, null,
			6.0 if kind == "cocoon" else 2.5)
	# Assigned after construction so the lambda captures the finished Proj.
	p.lit_fn = func(g, _w):
		DRAW.glow(g.l, p.x, p.y - p.z, 9.0 if kind == "cocoon" else 6.0, gcol, 0.4, 3)
	w.add(p)
	return p


static func hand_pos(w) -> Array:
	var p = w.player
	return [p.x + V8M.v8_cos(p.face) * 8, p.y - 7 + V8M.v8_sin(p.face) * 5]


static func cast_anim(w, c, face: bool = true, t: float = 0.32) -> void:
	var p = w.player
	p.cast = t
	p.castMax = t
	if face:
		p.face = c.ang


static func rotate(x: float, y: float, a: float) -> Array:
	return [x * V8M.v8_cos(a) - y * V8M.v8_sin(a), x * V8M.v8_sin(a) + y * V8M.v8_cos(a)]
