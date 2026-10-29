class_name VenomActors
extends RefCounted

const V8M = preload("res://prototypes/skill_readiness/native/venom/v8_math.gd")

## Native port of the ORIGINAL Venomwright `src/game/actors.ts`:
## `enemyShadow`, `drawEnemy`, the per-status `overlays`, `drawEnemyBars`,
## `drawPlayer` and `playerGlow`.
##
## Every enemy variant (Imp / Armored Beetle Crab / Bone Cultist / Iron Brute /
## Stone Titan), every status overlay (corrode / infect / leech / crystal /
## remedy / miasma) and the player's plague-doctor silhouette are transcribed as
## authored. These are the enemy-bound and caster-bound effects the EPIC requires
## be preserved, so nothing here is simplified.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")


# ---------------------------------------------------------------------------
# colour-filter helpers
#
# The original builds a closure per enemy per frame (`tintFn`). GDScript has no
# closure over a mutable palette, so the filter is modelled as a small value
# object carrying the authored blend factors; `_tp` and `_ap` apply it.
# ---------------------------------------------------------------------------

class CF extends RefCounted:
	var pk: float = 0.0      # poison / acid blend toward P.c0
	var mk: float = 0.0      # miasma blend toward P.c1
	var ck: float = 0.0      # crystal blend toward P.y1
	var rk: float = 0.0      # remedy blend toward rcol
	var rcol: int = 0
	var fl: float = 0.0      # hit flash blend toward white
	# death compositing. The original wraps/overwrites the tint closure per death
	# kind, so these three modes reproduce that exact order.
	var poison_fade: float = -1.0   # >=0: after base filters, mix toward P.e1
	var death_white: bool = false   # normal death: mix(c, P.i0, 0.8), base discarded
	var pre_mix: int = 0            # imp head: pre-mix input by pre_k first
	var pre_k: float = 0.0

	func apply(c: int) -> int:
		if death_white:
			return M.mix(c, int(M.P["i0"]), 0.8)
		if pre_k != 0.0:
			c = M.mix(c, pre_mix, pre_k)
		if pk != 0.0:
			c = M.mix(c, int(M.P["c0"]), pk)
		if mk != 0.0:
			c = M.mix(c, int(M.P["c1"]), mk)
		if ck != 0.0:
			c = M.mix(c, int(M.P["y1"]), ck)
		if rk != 0.0:
			c = M.mix(c, rcol, rk)
		if fl != 0.0:
			c = M.mix(c, int(M.P["w"]), minf(1.0, fl * 1.2))
		if poison_fade >= 0.0:
			c = M.mix(c, int(M.P["e1"]), 0.4 + poison_fade * 0.5)
		return c


static func _tint_fn(e, w) -> CF:
	var c := CF.new()
	var t: float = w.time
	c.pk = 0.16 + e.tint * 0.45 if e.poison.size() > 0 else e.tint * 0.45
	var cry = e.st.get("crystal", null)
	var mia = e.st.get("miasma", null)
	var rem = e.st.get("remedy", null)
	c.ck = minf(0.7, cry.k * 0.7) if cry != null else 0.0
	c.mk = 0.22 + 0.14 * V8M.v8_sin(t * 7 + float(e.id)) if mia != null else 0.0
	c.rk = 0.45 if rem != null else 0.0
	c.rcol = M.mix(int(M.P["g2"]), int(M.P["e1"]), rem.k) if rem != null else 0
	c.fl = e.flash
	return c


static func _tp(p: Dictionary, c: CF) -> Dictionary:
	return {
		"o": c.apply(int(p["o"])), "d": c.apply(int(p["d"])),
		"b": c.apply(int(p["b"])), "l": c.apply(int(p["l"])),
		"s": c.apply(int(p["s"])),
	}


# ---------------------------------------------------------------------------
# shadows
# ---------------------------------------------------------------------------

static func enemy_shadow(g, e, is_player: bool = false) -> void:
	var L = g.s
	var r: float = 6.5 if is_player else e.r
	if not is_player and e.dying > 0 and e.dyKind != "poison" \
			and e.dyKind != "acid" and e.dyKind != "crystal":
		return
	var sp: float = 1.0
	if not is_player and e.spawn > 0:
		sp = maxf(0.0, 1.0 - e.spawn / 0.7)
	L.dl = 8
	L.ellipse(e.x, e.y + r * 0.55, r * 1.1 * sp, r * 0.52 * sp, int(M.P["bk"]))
	L.dl = 16


# ---------------------------------------------------------------------------
# enemies
# ---------------------------------------------------------------------------

static func draw_enemy(g, e, w) -> void:
	var L = g.s
	var t: float = w.time
	var C := _tint_fn(e, w)
	var sink: float = 0.0
	var dl: int = 16
	var sy: float = 1.0
	if e.spawn > 0:
		var k: float = minf(1.0, e.spawn / 0.7)
		sink = k * 8
		dl = M.js_round(16 * (1 - k * 0.8))
	if e.dying > 0:
		var k: float = e.dyT
		if e.dyKind == "poison" or e.dyKind == "acid":
			var m: float = k / 0.75
			sy = 1 - m * 0.75
			dl = M.js_round(16 * (1 - m * m))
			# original wraps the existing filter: c => mix(base(c), P.e1, 0.4+m*0.5)
			C.poison_fade = m
		elif e.dyKind == "crystal":
			C.ck = 0.75
			if k > 0.3:
				return
		else:
			# original REPLACES the filter: c => mix(c, P.i0, 0.8)
			C.death_white = true
	var f: float = e.face
	var fx: float = V8M.v8_cos(f)
	var fy: float = V8M.v8_sin(f)
	var lg: float = e.lunge
	var sq: float = e.squash / 0.14 if e.squash > 0 else 0.0
	var h: float = (1 - sq * 0.22) * sy
	var bx: float = e.x + fx * lg * 3 + (V8M.v8_sin(t * 60) * 0.8 if e.stagger > 0 else 0.0)
	var by: float = e.y + sink + fy * lg * 1.5 + ((1 - sy) * 8 if sy < 1 else 0.0)
	L.dl = dl
	var sw: float = V8M.v8_sin(e.walk) * 1.8
	var show_face: bool = fy > -0.35
	var pal := MATS.PAL()

	if e.kind == "grunt":
		if e.variant == 0:
			_draw_imp(L, e, w, C, pal, bx, by, fx, fy, h, sw, lg, show_face)
		elif e.variant == 1:
			_draw_crab(L, e, w, C, pal, bx, by, fx, fy, h, lg, show_face)
		else:
			_draw_cultist(L, e, C, pal, bx, by, fx, fy, h, sw, lg, show_face)
	elif e.kind == "elite":
		_draw_brute(L, e, w, C, pal, bx, by, fx, fy, h, sw, lg, show_face, t)
	else:
		_draw_titan(g, e, w, C, pal, bx, by, fx, fy, h, lg, show_face, t)

	L.dl = 16
	if e.dying <= 0 and e.spawn <= 0.1:
		overlays(g, e, w, e.x, e.y, 46.0 if e.kind == "boss" else (20.0 if e.kind == "elite" else 12.0))
	if e.hover:
		var hh2: float = 46.0 if e.kind == "boss" else (20.0 if e.kind == "elite" else 13.0)
		var rr: float = e.r + 3
		var cy: float = e.y - hh2 * 0.4
		for s in [-1, 1]:
			for s2 in [-1, 1]:
				L.rect(e.x + float(s) * rr - (2 if s > 0 else 0),
						cy + float(s2) * (rr * 0.9) - (0 if s2 > 0 else 0), 3, 1,
						int(M.P["g2"]))
				L.rect(e.x + float(s) * rr - (0 if s > 0 else 0),
						cy + float(s2) * (rr * 0.9) - (2 if s2 > 0 else 0), 1, 3,
						int(M.P["g2"]))


static func _draw_imp(L, e, _w, C: CF, pal: Dictionary, bx: float, by: float,
		fx: float, fy: float, h: float, sw: float, lg: float, show_face: bool) -> void:
	var p: Dictionary = _tp(pal["imp"], C)
	var as_: float = V8M.v8_sin(e.walk + 1) * 2.2
	L.rect(bx - 3.5, by + sw, 2.5, 2.5, C.apply(int(M.P["r0"])))
	L.rect(bx + 1, by - sw, 2.5, 2.5, C.apply(int(M.P["r0"])))
	L.line(bx - 4, by - 4 * h, bx - 6.5 + fx * lg * 2, by - 1 + as_, C.apply(int(M.P["r1"])), 1.2)
	L.line(bx + 4, by - 4 * h, bx + 6.5 + fx * lg * 2, by - 1 - as_, C.apply(int(M.P["r1"])), 1.2)
	DRAW.ball(L, bx, by - 3.5 * h, 4.8, p, 4.2 * h)
	var hx: float = bx + fx * 1.8
	var hy: float = by - 8.5 * h + fy
	DRAW.ball(L, hx, hy, 3.5, _tp(pal["imp"], _with(C, "imp_head")), 3.2 * h)
	L.line(hx - 2, hy - 2, hx - 3.5, hy - 5.5, C.apply(int(M.P["i0"])))
	L.line(hx + 2, hy - 2, hx + 3.5, hy - 5.5, C.apply(int(M.P["i0"])))
	if show_face:
		L.dot(hx - 1.2 + fx, hy + fy * 0.6, C.apply(int(M.P["g2"])))
		L.dot(hx + 1.2 + fx, hy + fy * 0.6, C.apply(int(M.P["g2"])))
		L.dot(hx - 1.2 + fx, hy + fy * 0.6 - 0.5, C.apply(int(M.P["w"])))
		L.dot(hx + 1.2 + fx, hy + fy * 0.6 - 0.5, C.apply(int(M.P["w"])))


# The imp head palette is `tp(PAL.imp, c => C(mix(c, P.r3, 0.18)))` - the filter
# itself pre-mixes by 0.18 toward P.r3. Modelled as a derived CF.
static func _with(c: CF, which: String) -> CF:
	if which != "imp_head":
		return c
	var n := CF.new()
	n.pk = c.pk
	n.mk = c.mk
	n.ck = c.ck
	n.rk = c.rk
	n.rcol = c.rcol
	n.fl = c.fl
	# The death compositing must survive the derivation: the original wraps the
	# WHOLE closure (`const b = C; C = c => mix(b(c), P.e1, ...)`), so the imp
	# head is dissolved by exactly the same amount as the body. Dropping these
	# two fields left a dead imp with a tinted body and a living-coloured head.
	n.poison_fade = c.poison_fade
	n.death_white = c.death_white
	n.pre_mix = int(M.P["r3"])
	n.pre_k = 0.18
	return n


static func _draw_crab(L, e, _w, C: CF, pal: Dictionary, bx: float, by: float,
		fx: float, fy: float, h: float, lg: float, show_face: bool) -> void:
	var p: Dictionary = _tp(pal["crab"], C)
	for i in range(3):
		for s in [-1, 1]:
			var ph: float = V8M.v8_sin(e.walk + float(i) * 2.1 + (3.0 if s > 0 else 0.0))
			L.line(bx + float(s) * 3, by - 2 + float(i - 1) * 2,
					bx + float(s) * (7.5 + ph),
					by - 1 + float(i - 1) * 3 + V8M.v8_cos(e.walk + float(i)) * 0.7,
					C.apply(int(M.P["u0"])))
			L.dot(bx + float(s) * 5.2, by - 2 + float(i - 1) * 2.5, C.apply(int(M.P["u1"])))
	DRAW.ball(L, bx, by - 3.5 * h, 6.2, p, 4 * h)
	L.line(bx - 3.5, by - 5.8 * h, bx + 3.5, by - 5.8 * h, C.apply(int(M.P["u2"])))
	for s in [-1, 1]:
		var cx: float = bx + float(s) * 5.5 + fx * 3
		var cy: float = by - 2 + fy * 2 - lg * 1
		L.line(bx + float(s) * 4, by - 3, cx, cy, C.apply(int(M.P["u1"])))
		DRAW.ball(L, cx, cy, 2, _tp(pal["bone"], C))
		L.dot(cx + fx, cy + fy, C.apply(int(M.P["k0"])))
	if show_face:
		L.dot(bx - 1.6 + fx * 2, by - 6.8 * h + fy, C.apply(int(M.P["g2"])))
		L.dot(bx + 1.6 + fx * 2, by - 6.8 * h + fy, C.apply(int(M.P["g2"])))


static func _draw_cultist(L, e, C: CF, pal: Dictionary, bx: float, by: float,
		fx: float, fy: float, h: float, sw: float, lg: float, show_face: bool) -> void:
	var p: Dictionary = _tp(pal["bone"], C)
	var as_: float = V8M.v8_sin(e.walk) * 2.5
	L.rect(bx - 2.5, by + sw * 0.6, 2, 2.5, C.apply(int(M.P["i4"])))
	L.rect(bx + 0.5, by - sw * 0.6, 2, 2.5, C.apply(int(M.P["i4"])))
	L.line(bx - 3, by - 8 * h, bx - 5.5 + fx * lg * 3, by + 1 + as_, C.apply(int(M.P["i2"])))
	L.line(bx + 3, by - 8 * h, bx + 5.5 + fx * lg * 3, by + 1 - as_, C.apply(int(M.P["i2"])))
	L.dot(bx - 5.5 + fx * lg * 3, by + 1 + as_, C.apply(int(M.P["i0"])))
	L.dot(bx + 5.5 + fx * lg * 3, by + 1 - as_, C.apply(int(M.P["i0"])))
	DRAW.ball(L, bx, by - 5.2 * h, 3.8, p, 5.4 * h)
	var hx: float = bx + fx
	var hy: float = by - 12 * h + fy
	DRAW.ball(L, hx, hy, 3.3, _tp(pal["hood"], C), 3.2 * h)
	if show_face:
		L.dot(hx - 1.2 + fx, hy + 0.5, C.apply(int(M.P["r3"])))
		L.dot(hx + 1.2 + fx, hy + 0.5, C.apply(int(M.P["r3"])))
		L.dot(hx - 1.2 + fx, hy, C.apply(int(M.P["r2"])))
		L.dot(hx + 1.2 + fx, hy, C.apply(int(M.P["r2"])))


static func _draw_brute(L, e, w, C: CF, pal: Dictionary, bx: float, by: float,
		fx: float, fy: float, h: float, sw: float, lg: float, show_face: bool,
		t: float) -> void:
	var p: Dictionary = _tp(pal["brute"], C)
	var iron: Dictionary = _tp(pal["iron"], C)
	var as_: float = V8M.v8_sin(e.walk) * 2.8
	L.rect(bx - 5.5, by + 1 + sw, 4.5, 3.5, C.apply(int(M.P["r0"])))
	L.rect(bx + 1, by + 1 - sw, 4.5, 3.5, C.apply(int(M.P["r0"])))
	for s in [-1, 1]:
		L.line(bx + float(s) * 8, by - 9 * h, bx + float(s) * 11 + fx * lg * 3,
				by - 2 + as_ * float(s), C.apply(int(M.P["r1"])), 2.2)
		DRAW.ball(L, bx + float(s) * 11 + fx * lg * 3, by - 1 + as_ * float(s), 3, p)
	DRAW.ball(L, bx, by - 6.5 * h, 8.5, p, 7.5 * h)
	for i in range(-1, 2):
		var sx: float = bx + float(i) * 3.8
		var sy2: float = by - 13.5 * h
		L.tri(sx - 1.6, sy2 + 1, sx, sy2 - 3.2, sx + 1.6, sy2 + 1, C.apply(int(M.P["i1"])))
		L.dot(sx, sy2 - 2, C.apply(int(M.P["i0"])))
	DRAW.ball(L, bx - 8.5, by - 10.5 * h, 3.6, iron)
	DRAW.ball(L, bx + 8.5, by - 10.5 * h, 3.6, iron)
	var hx: float = bx + fx * 2
	var hy: float = by - 15.5 * h + fy * 1.5
	DRAW.ball(L, hx, hy, 4.8, iron, 4.2 * h)
	L.line(hx - 4.2, hy - 2, hx - 6.5, hy - 6.5, C.apply(int(M.P["i0"])))
	L.line(hx + 4.2, hy - 2, hx + 6.5, hy - 6.5, C.apply(int(M.P["i0"])))
	if show_face:
		L.rect(M.js_round(hx - 2.5 + fx), M.js_round(hy), 5.5, 1.2, C.apply(int(M.P["k0"])))
		L.dot(hx - 1.2 + fx, hy, C.apply(int(M.P["r3"])))
		L.dot(hx + 1.2 + fx, hy, C.apply(int(M.P["r3"])))
		L.dot(hx - 1.2 + fx, hy - 0.5, C.apply(int(M.P["r2"])))
		L.dot(hx + 1.2 + fx, hy - 0.5, C.apply(int(M.P["r2"])))
	if fy > -0.5:
		var pu: float = 0.5 + 0.5 * V8M.v8_sin(t * 4 + float(e.id))
		L.disc(bx, by - 6.5 * h, 2.2, C.apply(M.mix(int(M.P["r2"]), int(M.P["g2"]), pu)))
		L.dot(bx, by - 6.5 * h, C.apply(int(M.P["w"])))


static func _draw_titan(g, e, w, C: CF, pal: Dictionary, bx: float, by: float,
		fx: float, fy: float, h: float, lg: float, show_face: bool, t: float) -> void:
	var L = g.s
	var p: Dictionary = _tp(pal["stone"], C)
	var sw2: float = V8M.v8_sin(e.walk * 0.7) * 3.2
	L.rect(bx - 13, by - 6 + sw2, 10, 10, C.apply(int(M.P["k2"])))
	L.rect(bx + 3, by - 6 - sw2, 10, 10, C.apply(int(M.P["k2"])))
	L.rect(bx - 13, by - 6 + sw2, 10, 2.5, C.apply(int(M.P["i3"])))
	L.rect(bx + 3, by - 6 - sw2, 10, 2.5, C.apply(int(M.P["i3"])))
	for s in [-1, 1]:
		L.line(bx + float(s) * 20, by - 22 * h, bx + float(s) * 24 + fx * lg * 4,
				by - 6 + sw2 * float(s) * 0.5, C.apply(int(M.P["k3"])), 6.5)
		DRAW.ball(L, bx + float(s) * 24 + fx * lg * 4, by - 3 + sw2 * float(s) * 0.5, 7.5, p)
	DRAW.ball(L, bx, by - 18 * h, 20, p, 16 * h)
	var lava: float = 0.5 + 0.5 * V8M.v8_sin(t * 2.5)
	var lc: int = C.apply(M.mix(int(M.P["r2"]), int(M.P["g2"]), lava))
	for i in range(7):
		var a0: float = -2.6 + float(i) * 0.48
		var r0: float = 4 + M.hash_n(i) * 6
		L.line(bx + V8M.v8_cos(a0) * r0, by - 18 * h + V8M.v8_sin(a0) * r0 * 0.8,
				bx + V8M.v8_cos(a0 + 0.3) * (r0 + 8),
				by - 18 * h + V8M.v8_sin(a0 + 0.3) * (r0 + 7) * 0.8, lc, 1.2)
	DRAW.ball(L, bx - 18, by - 29 * h, 5.5, p)
	DRAW.ball(L, bx + 18, by - 29 * h, 5.5, p)
	for s in [-1, 1]:
		for k in range(2):
			L.tri(bx + float(s) * (15 + k * 4) - 2.5, by - 32 * h,
					bx + float(s) * (17 + k * 4), by - 40 * h - float(k) * 2,
					bx + float(s) * (15 + k * 4) + 2.5, by - 32 * h,
					C.apply(int(M.P["i1"])))
	var hx: float = bx + fx * 2
	var hy: float = by - 36 * h + fy
	DRAW.ball(L, hx, hy, 9.5, p, 8.5 * h)
	for i in range(-2, 3):
		L.tri(hx + float(i) * 3.6 - 1.6, hy - 6, hx + float(i) * 3.6,
				hy - 13 - (2.0 - absf(float(i))) * 2.5,
				hx + float(i) * 3.6 + 1.6, hy - 6, C.apply(int(M.P["i1"])))
	if show_face:
		L.disc(hx - 3.2 + fx, hy + fy * 0.5, 1.8, lc)
		L.disc(hx + 3.2 + fx, hy + fy * 0.5, 1.8, lc)
		L.dot(hx - 3.2 + fx, hy, C.apply(int(M.P["w"])))
		L.dot(hx + 3.2 + fx, hy, C.apply(int(M.P["w"])))
	DRAW.glow(g.l, bx, by - 18, 24, int(M.P["r2"]), 0.14 + lava * 0.09, 3)


# ---------------------------------------------------------------------------
# status overlays (enemy-bound effects: corrode / infect / leech / crystal /
# remedy / miasma). These are authored visual state, not debug marks.
# ---------------------------------------------------------------------------

static func overlays(g, e, w, x: float, y: float, H: float) -> void:
	var L = g.s
	var t: float = w.time
	var cy: float = y - H * 0.45
	var rx: float = e.r * 0.85
	var ry: float = H * 0.42

	var cor = e.st.get("corrode", null)
	if cor != null:
		var k: float = minf(1.0, cor.t / 1.0)
		var n: int = 3 + M.js_round(cor.k * 5)
		for i in range(n):
			if M.hash_n(i * 3 + e.id) > k:
				continue
			var pos := _ov_pos(e, i, 1, x, cy, rx, ry)
			var X: int = M.js_round(pos[0])
			var Y: int = M.js_round(pos[1])
			L.rect(X - 1, Y, 3, 2, int(M.P["k0"]))
			L.dot(X - 1.5, Y, int(M.P["c0"]))
			L.dot(X + 1.5, Y, int(M.P["c0"]))
			L.dot(X, Y - 1, int(M.P["c1"]))
			L.dot(X - 1, Y + 1.5, int(M.P["e2"]))
			L.dot(X + 1, Y + 1.5, int(M.P["e2"]))
			if V8M.v8_sin(t * 8 + float(i) * 2) > 0.45:
				L.dot(X, Y, int(M.P["c2"]))
			if i % 2 == 0:
				L.dl = 8
				L.dot(X, Y - 2 - int(floor(fmod(t * 7 + float(i) * 2, 5.0))), int(M.P["e3"]))
				L.dl = 16

	var inf = e.st.get("infect", null)
	if inf != null:
		var ki: float = minf(1.0, inf.t / 1.0)
		var ni: int = 4 + M.js_round(inf.k * 3)
		for i in range(ni):
			if M.hash_n(i + e.id) > ki:
				continue
			var a: float = (float(i) / float(ni)) * M.TAU + 0.3
			var X: int = M.js_round(x + V8M.v8_cos(a) * (rx + 1))
			var Y: int = M.js_round(cy + V8M.v8_sin(a) * (ry + 1))
			var pu: bool = V8M.v8_sin(t * 5 + float(i) * 1.7) > 0
			L.line(X, Y, x + V8M.v8_cos(a) * rx * 0.4, cy + V8M.v8_sin(a) * ry * 0.4, int(M.P["e1"]))
			L.disc(X, Y, 1, int(M.P["e3"]))
			L.dot(X, Y, int(M.P["c3"]) if pu else int(M.P["c1"]))

	var lee = e.st.get("leech", null)
	if lee != null:
		var nl: int = M.js_round(lee.k)
		for i in range(nl):
			var a: float = float(i) * 2.4 + 1
			var bx: float = x + V8M.v8_cos(a) * (rx + 0.5)
			var by: float = cy + V8M.v8_sin(a) * (ry + 0.5)
			var wg: float = V8M.v8_sin(t * 10 + float(i) * 2) * 1.2
			var dx: float = V8M.v8_cos(a)
			var dy: float = V8M.v8_sin(a) * 0.7
			DRAW.worm_body(L, [
					{"x": bx, "y": by, "r": 1.5},
					{"x": bx + dx * 2 + wg * -dy, "y": by + dy * 2 + wg * dx, "r": 1.4},
					{"x": bx + dx * 4 - wg * -dy, "y": by + dy * 4 - wg * dx, "r": 1.1},
			], MATS.PAL()["leech"], {"spec": false})
			if V8M.v8_sin(t * 6 + float(i)) > 0.1:
				L.dot(bx, by, int(M.P["m2"]))

	var cry = e.st.get("crystal", null)
	if cry != null and cry.k > 0.02:
		var lv: float = cry.k
		var n: int = 4 + M.js_round(lv * 5)
		for i in range(n):
			if M.hash_n(i * 11 + e.id) > lv * 1.6:
				continue
			var pos := _ov_pos(e, i, 3, x, cy, rx, ry)
			var px: float = pos[0]
			var py: float = pos[1]
			var hh: float = maxf(2, lv * (5 + M.hash_n(i + e.id * 3) * 9)
					* (2.0 if e.kind == "boss" else 1.0))
			var lean: float = (M.hash_n(i * 5 + e.id) - 0.5) * 6
			DRAW.crystal_prism(L, px, py + 2, hh, 1.6 + lv * 1.4, lean,
					int(M.P["v2"]), int(M.P["v0"]), int(M.P["y2"]),
					int(M.P["k1"]), t)
		for i in range(3):
			var bx: float = x + (M.hash_n(i + e.id) - 0.5) * rx * 1.4
			var by: float = cy + (M.hash_n(i * 3 + e.id) - 0.5) * ry
			var a: float = -1.57 + (M.hash_n(i * 9 + e.id) - 0.5) * 2
			for s in range(ceili(lv * 9)):
				a += (M.hash_n(s + i * 20 + e.id) - 0.5) * 0.9
				bx += V8M.v8_cos(a)
				by += V8M.v8_sin(a)
				L.dot(bx, by, int(M.P["y2"]) if s % 3 == 0 else int(M.P["y1"]))
				L.dot(bx + 0.8, by, int(M.P["v0"]))

	var rem = e.st.get("remedy", null)
	if rem != null:
		var k: float = rem.k
		var n: int = 9
		var col: int = M.mix(int(M.P["g2"]), int(M.P["e2"]), k)
		var col2: int = M.mix(int(M.P["c3"]), int(M.P["k1"]), k)
		for i in range(n):
			var a: float = (float(i) / float(n)) * M.TAU + t * 0.4 * (1 - k)
			var rr: float = 1 + (1 - k * 0.9) * 3
			var X: float = x + V8M.v8_cos(a) * (rx + rr)
			var Y: float = cy + V8M.v8_sin(a) * (ry + rr)
			L.arc(X, Y, 1.8 - k * 0.4, 1, a + 1.2, a + 4.2, col)
			L.dot(X, Y, col2)
		if k < 0.25 and V8M.v8_sin(t * 4 + float(e.id)) > 0.3:
			var X: float = x + V8M.v8_sin(t * 2) * 3
			var Y: float = cy - H * 0.55 - fmod(t * 10, 7.0)
			L.rect(X - 1, Y, 3, 1, int(M.P["c3"]))
			L.rect(X, Y - 1, 1, 3, int(M.P["c3"]))
		if k > 0.2:
			for i in range(5):
				var vx: float = x
				var vy: float = cy
				var a: float = (float(i) / 5.0) * M.TAU + 0.6
				var len: float = (rx + 2) * minf(1.0, (k - 0.2) * 1.4)
				for s in range(ceili(len)):
					a += (M.hash_n(s + i * 9 + e.id) - 0.5) * 0.7
					vx += V8M.v8_cos(a)
					vy += V8M.v8_sin(a) * 0.8
					L.dot(vx, vy, int(M.P["k0"]))
					L.dot(vx, vy + 1, int(M.P["m0"]))
					if s % 3 == 0 and V8M.v8_sin(t * 5 - float(s) * 0.5 + float(i)) > 0.3:
						L.dot(vx, vy, int(M.P["c1"]))

	var mia = e.st.get("miasma", null)
	if mia != null:
		for i in range(3):
			var X: float = x + (M.hash_n(i + e.id) - 0.5) * rx * 2
			var Y: float = cy - ry - fmod(t * 9 + float(i) * 5, 12.0)
			L.dot(X, Y, int(M.P["c2"]))
			if i == 0:
				L.dot(X + 1, Y, int(M.P["c3"]))


static func _ov_pos(e, i: int, s: int, x: float, cy: float, rx: float,
		ry: float) -> Array:
	var a: float = M.hash_n(e.id * 13 + i + s * 101) * M.TAU
	var d: float = sqrt(M.hash_n(e.id * 7 + i * 3 + s * 53))
	return [x + V8M.v8_cos(a) * rx * d, cy + V8M.v8_sin(a) * ry * d]


# ---------------------------------------------------------------------------
# health / poison / status bars
# ---------------------------------------------------------------------------

static func draw_enemy_bars(g, e, w) -> void:
	if e.dying > 0 or e.spawn > 0.3:
		return
	var L = g.s
	var recent: bool = w.time - e.lastHurt < 5
	if not (recent or e.poison.size() > 0 or e.kind != "grunt"):
		return
	var W: float = 46.0 if e.kind == "boss" else (22.0 if e.kind == "elite" else 14.0)
	var H: float = 58.0 if e.kind == "boss" else (26.0 if e.kind == "elite" else 16.0)
	var x0: float = e.x - W / 2
	var y0: float = e.y - H - 3
	var pct: float = maxf(0.0, e.hp / e.maxHp)
	L.rect(x0 - 1, y0 - 1, W + 2, 4, int(M.P["bk"]))
	L.rect(x0, y0, W, 2, int(M.P["r0"]))
	var fw: float = maxf(1.0 if pct > 0 else 0.0, W * pct)
	L.rect(x0, y0, fw, 2, int(M.P["r2"]) if pct > 0.5 else (int(M.P["g1"]) if pct > 0.25 else int(M.P["r1"])))
	L.rect(x0, y0, fw, 1, int(M.P["r3"]) if pct > 0.5 else int(M.P["g2"]))
	if e.poison.size() > 0:
		var rem: float = e.poison_left()
		var mx: float = e.poison_max()
		if mx <= 0:
			mx = 1.0
		var pw: float = maxf(1.0, W * (rem / mx))
		L.rect(x0 - 1, y0 + 3, W + 2, 3, int(M.P["bk"]))
		L.rect(x0, y0 + 4, W, 1, int(M.P["e0"]))
		L.rect(x0, y0 + 4, pw, 1, int(M.P["c3"]) if e.tint > 0.3 else int(M.P["c1"]))
		L.dot(x0 - 3, y0 + 4, int(M.P["c1"]))
		L.dot(x0 - 3, y0 + 3, int(M.P["c3"]))
		L.rect(x0 - 4, y0 + 4, 3, 1, int(M.P["e3"]))
		if e.poison.size() > 1:
			for i in range(mini(5, e.poison.size())):
				L.dot(x0 + W - 1 - float(i) * 2, y0 + 6, int(M.P["c1"]))
	var bits: Array = []
	if e.st.has("corrode"):
		bits.append(int(M.P["c0"]))
	if e.st.has("crystal"):
		bits.append(int(M.P["y1"]))
	if e.st.has("leech"):
		bits.append(int(M.P["m1"]))
	if e.st.has("infect"):
		bits.append(int(M.P["e3"]))
	if e.st.has("remedy"):
		bits.append(int(M.P["g2"]))
	if e.st.has("miasma"):
		bits.append(int(M.P["c2"]))
	for i in range(bits.size()):
		L.rect(x0 + float(i) * 3, y0 - 3, 2, 2, int(bits[i]))


# ---------------------------------------------------------------------------
# the Venomwright
# ---------------------------------------------------------------------------

static func draw_player(g, p, w) -> void:
	var L = g.s
	var t: float = w.time
	var f: float = p.face
	var fx: float = V8M.v8_cos(f)
	var fy: float = V8M.v8_sin(f)
	var qx: float = -fy
	var qy: float = fx
	var venom: bool = p.form == "venom"
	var moving: bool = sqrt(p.vx * p.vx + p.vy * p.vy) > 10
	var bob: float = absf(V8M.v8_sin(p.walk)) * 1.2 if moving else V8M.v8_sin(t * 2) * 0.4
	var x: float = p.x
	var y: float = p.y
	var cy: float = y - 5 - bob
	var ck: float = p.cast / p.castMax if p.cast > 0 else 0.0
	var hurt: bool = p.hurtT > 0
	var pal := MATS.PAL()
	var coat: int = int(M.P["e0"]) if venom else int(M.P["n1"])
	var coatL: int = int(M.P["e1"]) if venom else int(M.P["n2"])
	var coatD: int = int(M.P["k1"]) if venom else int(M.P["n0"])
	var _at := func(fw: float, sd: float, up: float) -> Array:
		return [x + fx * fw + qx * sd, cy + fy * fw * 0.8 + qy * sd * 0.8 - up]

	# boots
	var sw: float = V8M.v8_sin(p.walk) * 3
	for s in [-1, 1]:
		L.rect(x + qx * 2 * float(s) + fx * sw * float(s) - 1,
				y + qy * 2 * float(s) + fy * sw * float(s) * 0.6 + 0, 3, 2,
				_CF(int(M.P["u0"]), hurt))
	# cloak tail
	var sway: float = V8M.v8_sin(t * 4 + p.walk * 0.5) * 1.5 \
			+ (V8M.v8_sin(p.walk * 2) * 1.2 if moving else 0.0)
	var ext: float = 9 + (3 if moving else 0) + (6 if p.path != null else 0)
	var t0: Array = _at.call(-1, 5.2, 1)
	var t1: Array = _at.call(-1, -5.2, 1)
	var tt: Array = _at.call(-ext, sway, -2)
	L.poly([t0[0], t0[1], t1[0], t1[1], tt[0] + qx * 3 - fx, tt[1] + qy * 2,
			tt[0] - qx * 3 - fx, tt[1] - qy * 2], _CF(coatD, hurt))
	var a0: Array = _at.call(-1, 4.2, 1)
	var a1: Array = _at.call(-1, -4.2, 1)
	L.poly([a0[0], a0[1], a1[0], a1[1], tt[0] + qx * 1.5, tt[1] + qy,
			tt[0] - qx * 1.5, tt[1] - qy], _CF(coat, hurt))
	L.line(t0[0], t0[1], tt[0] + qx * 3 - fx, tt[1] + qy * 2, _CF(int(M.P["u1"]), hurt))
	L.line(t1[0], t1[1], tt[0] - qx * 3 - fx, tt[1] - qy * 2, _CF(int(M.P["u1"]), hurt))
	# backpack rack of bubbling alchemical flasks
	var bp: Array = _at.call(-5.5, 0, 4)
	L.rect(bp[0] - 3, bp[1] - 2, 7, 5, _CF(int(M.P["u0"]), hurt))
	L.rect(bp[0] - 3, bp[1] - 2, 7, 1, _CF(int(M.P["u1"]), hurt))
	var fc: Array = [int(M.P["c1"]), int(M.P["y1"]), int(M.P["g2"])]
	for i in range(3):
		var fxp: float = bp[0] - 2 + float(i) * 2.5
		var fyp: float = bp[1] - 4 - (1 if i == 1 else 0)
		L.rect(fxp, fyp, 2, 3, _CF(int(M.P["v1"]), hurt))
		L.dot(fxp, fyp + 1, fc[i])
		L.dot(fxp + 1, fyp + 2, fc[i])
		L.dot(fxp, fyp, int(M.P["v3"]))
		if V8M.v8_sin(t * 4 + float(i) * 2) > 0.7:
			L.dot(fxp, fyp - 1 - int(floor(fmod(t * 6, 3.0))), fc[i])
	# torso
	_torso(L, x, cy, qx, qy, fx, fy, 6.6, 5, _CF(coatD, hurt))
	_torso(L, x, cy, qx, qy, fx, fy, 5.6, 4.1, _CF(coat, hurt))
	_torso(L, x, cy, qx, qy, fx, fy, 3.8, 2.8, _CF(coatL, hurt))
	var b0: Array = _at.call(1, -3, 0)
	var b1: Array = _at.call(1, 3, 0)
	L.line(b0[0], b0[1], b1[0], b1[1], _CF(int(M.P["u1"]), hurt))
	for i in range(2):
		var v: Array = _at.call(1.5, 3.6 if i else -3.6, -1)
		L.dot(v[0], v[1], int(M.P["c1"]) if i else int(M.P["y1"]))
		L.dot(v[0], v[1] + 1, int(M.P["v1"]))
	if venom:
		for i in range(3):
			var s: Array = _at.call(-1 + i, -3 + i * 2, 1)
			var pu: bool = V8M.v8_sin(t * 5 + float(i) * 1.5) > -0.2
			L.line(s[0], s[1], s[0] + qx * 2 + fx, s[1] + qy * 1.5 + fy,
					int(M.P["c1"]) if pu else int(M.P["e3"]))
	# shoulders
	for s in [-1, 1]:
		var sh: Array = _at.call(0, float(s) * 5.8, 3)
		DRAW.ball(L, sh[0], sh[1], 2.2, pal["copper"])
	# left arm
	var la0: Array = _at.call(0, -5.5, 3)
	var la1: Array = _at.call(4, -5.5, 1)
	L.line(la0[0], la0[1], la1[0], la1[1], _CF(coat, hurt), 2)
	L.dot(la1[0], la1[1], _CF(int(M.P["i1"]), hurt))
	# head: hat, plague mask, polished bone beak
	var hd: Array = _at.call(0.5, 0, 7.5)
	L.disc(hd[0], hd[1] + 1, 6.4, _CF(int(M.P["n0"]), hurt))
	L.disc(hd[0], hd[1] + 1, 5.4, _CF(int(M.P["n1"]), hurt))
	L.ring(hd[0], hd[1] + 1, 5.4, 1, _CF(int(M.P["n2"]), hurt))
	L.disc(hd[0] - 0.4, hd[1] - 0.4, 3.4, _CF(int(M.P["n2"]), hurt))
	L.disc(hd[0] - 1, hd[1] - 1, 2, _CF(int(M.P["n3"]), hurt))
	L.ring(hd[0], hd[1] + 0.5, 3.8, 1, _CF(int(M.P["g1"]), hurt))
	L.dot(hd[0] - 3, hd[1] - 1, int(M.P["g2"]))
	var bx0: Array = _at.call(2.5, 0, 6.2)
	var bt: Array = _at.call(10, 0, 4.8)
	var b1x: Array = _at.call(3, 2.3, 6.3)
	var b2x: Array = _at.call(3, -2.3, 6.3)
	L.poly([b1x[0], b1x[1], bt[0], bt[1], bx0[0], bx0[1]], _CF(int(M.P["i0"]), hurt))
	L.poly([b2x[0], b2x[1], bt[0], bt[1], bx0[0], bx0[1]], _CF(int(M.P["i2"]), hurt))
	L.line(b1x[0], b1x[1], bt[0], bt[1], _CF(int(M.P["i4"]), hurt))
	L.line(b2x[0], b2x[1], bt[0], bt[1], _CF(int(M.P["i4"]), hurt))
	L.dot(bt[0], bt[1], _CF(int(M.P["i3"]), hurt))
	if fy > -0.5:
		for s in [-1, 1]:
			var gg: Array = _at.call(3.4, float(s) * 1.9, 6.4)
			var pu: float = 0.5 + 0.5 * V8M.v8_sin(t * 3)
			L.disc(gg[0], gg[1], 0.8,
					int(M.P["c1"]) if venom else M.mix(int(M.P["y0"]), int(M.P["y1"]), pu))
			L.dot(gg[0], gg[1], int(M.P["w"]))
	# casting arm + vial
	var ext2: float = 4.5 + ck * 5
	var ca0: Array = _at.call(0, 5.5, 3)
	var ca1: Array = _at.call(ext2, 5.6 - ck * 1.5, 2 + ck * 3)
	L.line(ca0[0], ca0[1], ca1[0], ca1[1], _CF(coat, hurt), 2)
	L.dot(ca1[0], ca1[1], _CF(int(M.P["i1"]), hurt))
	if venom:
		DRAW.ball(L, ca1[0] + fx, ca1[1] + fy - 1, 2.6, pal["liquid"])
		L.dot(ca1[0] + fx + 1, ca1[1] + fy + 3, int(M.P["c1"]))
	else:
		DRAW.ball(L, ca1[0] + fx, ca1[1] + fy - 1, 2.3, pal["glassHi"])
		L.rect(ca1[0] + fx - 1, ca1[1] + fy - 1, 3, 2, int(M.P["c1"]))
		L.dot(ca1[0] + fx - 1, ca1[1] + fy - 2, int(M.P["w"]))
		L.rect(ca1[0] + fx - 1, ca1[1] + fy - 4, 2, 1, int(M.P["u1"]))
	# venom orbitals
	if venom:
		for i in range(3):
			var a: float = t * 2.2 + float(i) * 2.09
			var X: float = x + V8M.v8_cos(a) * 11
			var Y: float = cy + 4 + V8M.v8_sin(a) * 5 - 2 - V8M.v8_sin(t * 3 + float(i)) * 1.5
			DRAW.ball(L, X, Y, 1.8, pal["liquid"])
			if V8M.v8_sin(a) > 0.2:
				L.dot(X - 0.5, Y - 0.5, int(M.P["w"]))


static func _CF(c: int, hurt: bool) -> int:
	return M.mix(c, int(M.P["r3"]), 0.6) if hurt else c


static func _torso(L, x: float, cy: float, qx: float, qy: float, fx: float,
		fy: float, rr: float, ry: float, c: int) -> void:
	var pts: Array = []
	for k in range(12):
		var a: float = (float(k) / 12.0) * M.TAU
		var sd: float = V8M.v8_cos(a) * rr
		var fw: float = V8M.v8_sin(a) * ry
		pts.append(x + qx * sd + fx * fw)
		pts.append(cy + 1 + (qy * sd + fy * fw) * 0.8)
	L.poly(pts, c)


static func player_glow(g, p, w) -> void:
	var venom: bool = p.form == "venom"
	var t: float = w.time
	if venom:
		DRAW.glow(g.l, p.x, p.y - 6, 18 + V8M.v8_sin(t * 4) * 1.5, int(M.P["c0"]), 0.24, 4)
	else:
		DRAW.glow(g.l, p.x, p.y - 6, 11, int(M.P["v2"]), 0.12, 3)
	var f: float = p.face
	var ck: float = p.cast / p.castMax if p.cast > 0 else 0.0
	DRAW.glow(g.l, p.x + V8M.v8_cos(f) * (5 + ck * 5), p.y - 5 + V8M.v8_sin(f) * 4 - 2,
			6 + ck * 3, int(M.P["c2"]) if venom else int(M.P["c1"]), 0.35, 3)
