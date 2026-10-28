class_name VenomWorld
extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/world.ts`.
##
## Simulation only: enemies, player, tasks (the coroutine scheduler the skill
## generators yield into), damage / poison / status, deaths, respawns and the
## full `draw()` z-order. Nothing here is re-authored; every constant and every
## RNG draw order is transcribed.

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")
const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")
const FX = preload("res://prototypes/skill_readiness/native/venom/venom_fx.gd")
const MATS = preload("res://prototypes/skill_readiness/native/venom/venom_mats.gd")
const ACT = preload("res://prototypes/skill_readiness/native/venom/venom_actors.gd")

const ATK: float = 100.0

var EID: int = 1


func reset_ids() -> void:
	EID = 1


# ---------------------------------------------------------------------------
# Enemy / Player
# ---------------------------------------------------------------------------

class Enemy extends RefCounted:
	var id: int = 0
	var kind: String = "grunt"
	var variant: int = 0
	var x: float = 0.0
	var y: float = 0.0
	var kx: float = 0.0
	var ky: float = 0.0
	var r: float = 6.0
	var hp: float = 100.0
	var maxHp: float = 100.0
	var speed: float = 30.0
	var face: float = PI / 2
	var walk: float = 0.0
	var flash: float = 0.0
	var tint: float = 0.0
	var squash: float = 0.0
	var stagger: float = 0.0
	var spawn: float = 0.5
	var dying: float = 0.0
	var dyT: float = 0.0
	var dyKind: String = "impact"
	var dyDir: float = 0.0
	var des: float = 40.0
	var orb: float = 1.0
	var atkT: float = 0.6
	var lunge: float = 0.0
	var slow: float = 0.0
	var lastHurt: float = -99.0
	var hover: bool = false
	var pull: float = 0.0
	var st: Dictionary = {}
	var poison: Array = []
	var p_every: float = 0.5

	func _init(k: String, v: int, eid: int) -> void:
		kind = k
		variant = v
		id = eid
		if k == "grunt":
			r = 6
			hp = 260
			maxHp = 260
			speed = 26 + float(v) * 3
		elif k == "elite":
			r = 9.5
			hp = 900
			maxHp = 900
			speed = 22
		else:
			r = 22
			hp = 8000
			maxHp = 8000
			speed = 12

	func poison_left() -> float:
		var m: float = 0.0
		for p in poison:
			if float(p["rem"]) > m:
				m = float(p["rem"])
		return m

	func poison_max() -> float:
		var m: float = 0.0
		for p in poison:
			if float(p["max"]) > m:
				m = float(p["max"])
		return m


class Player extends RefCounted:
	var x: float = 0.0
	var y: float = 0.0
	var vx: float = 0.0
	var vy: float = 0.0
	var face: float = 0.0
	var hp: float = 1000.0
	var maxHp: float = 1000.0
	var form: String = "vessel"
	var cat: float = 0.0
	var venomT: float = 0.0
	var walk: float = 0.0
	var cast: float = 0.0
	var castMax: float = 0.3
	var castKind: int = 0
	var speed: float = 88.0
	var path = null
	var mt = null
	var hurtT: float = 0.0
	var trail: float = 0.0
	var shimmer: float = 0.0
	var aura: float = 0.0


# ---------------------------------------------------------------------------
# World
# ---------------------------------------------------------------------------

var W: float = 600.0
var H: float = 340.0
var time: float = 0.0
var frame: int = 0
var rng
var seed: int = 1
var enemies: Array = []
var player = null
var fx: Array = []
var parts = null
var nums: Array = []
var tasks: Array = []
var shocks: Array = []
var shakeT: float = 0.0
var shakeM: float = 0.0
var shakeD: float = 0.25
var flashC: int = 0
var flashA: float = 0.0
var flashT: float = 0.0
var flashD: float = 1.0
var hitstop: float = 0.0
var dim: float = 0.0
var dimTo: float = 0.0
var stats: Dictionary = {}
var cfg: Dictionary = {"density": 16, "boss": false, "wave": false, "respawn": true}
var respawnQ: Array = []
var nextWave: float = 0.0
var bossT: float = 0.0
var input: Dictionary = {"x": 0, "y": 0}
var uid: int = 1
var overlay = null
var lab: bool = false
var lastHeal: float = 0.0
var castLog: Array = []
var formEnded: float = -999.0


func _init(w: float = 600.0, h: float = 340.0) -> void:
	W = w
	H = h
	rng = RNG.new(1)
	player = Player.new()
	parts = FX.Particles.new()
	stats = {"total": 0.0, "kills": 0, "hits": 0, "ev": []}
	reset(1)


# ---------- setup ----------

func reset(seed_: int, formation: bool = false) -> void:
	seed = seed_
	rng = RNG.new(seed_)
	enemies = []
	fx = []
	parts.clear()
	nums = []
	tasks = []
	shocks = []
	time = 0.0
	frame = 0
	respawnQ = []
	shakeT = 0.0
	flashA = 0.0
	hitstop = 0.0
	dim = 0.0
	nextWave = 6
	bossT = 0.0
	var p = player
	p.x = W * 0.3 if formation else W / 2.0
	p.y = H * 0.55
	p.vx = 0.0
	p.vy = 0.0
	p.face = 0.0
	p.path = null
	p.mt = null
	p.cast = 0.0
	p.hp = p.maxHp
	p.form = "vessel"
	p.venomT = 0.0
	fill_enemies(formation)


func count() -> int:
	var n: int = 0
	for e in enemies:
		if e.dying <= 0 and e.kind != "boss":
			n += 1
	return n


func has_boss() -> bool:
	for e in enemies:
		if e.kind == "boss" and e.dying <= 0:
			return true
	return false


func fill_enemies(formation: bool) -> void:
	var n: int = int(cfg["density"])
	var elites: int = maxi(1, M.js_round(float(n) / 8.0))
	for i in range(n):
		var e = Enemy.new("elite" if i < elites else "grunt",
				int(floor(rng.next() * 3)), EID)
		EID += 1
		place(e, formation)
		e.spawn = 0.0 if formation else rng.range(0.1, 0.9)
		enemies.append(e)
	if bool(cfg["boss"]):
		var b = Enemy.new("boss", 0, EID)
		EID += 1
		place(b, formation)
		b.spawn = 0.8
		enemies.append(b)


func place(e, formation: bool, edge: bool = false) -> void:
	var p = player
	var r = rng
	e.des = 70.0 if e.kind == "boss" else (40.0 + r.next() * 40.0 if e.kind == "elite" else 28.0 + r.next() * 110.0)
	e.orb = r.sign()
	for _tries in range(20):
		if edge:
			var s: int = r.int_n(4)
			e.x = 10.0 if s == 0 else (W - 10.0 if s == 1 else r.range(10.0, W - 10.0))
			e.y = 10.0 if s == 2 else (H - 10.0 if s == 3 else r.range(10.0, H - 10.0))
		elif formation:
			var a: float = r.range(-1.0, 1.0)
			var d: float = r.range(70.0, minf(W * 0.62, 260.0))
			e.x = p.x + cos(a) * d
			e.y = p.y + sin(a) * d * 0.9
		else:
			e.x = r.range(16.0, W - 16.0)
			e.y = r.range(16.0, H - 16.0)
		e.x = M.clampf(e.x, 12.0, W - 12.0)
		e.y = M.clampf(e.y, 12.0, H - 12.0)
		if sqrt(pow(e.x - p.x, 2.0) + pow(e.y - p.y, 2.0)) < 55:
			continue
		var ok: bool = true
		for o in enemies:
			if sqrt(pow(o.x - e.x, 2.0) + pow(o.y - e.y, 2.0)) < o.r + e.r + 1:
				ok = false
				break
		if ok:
			break
	e.face = atan2(p.y - e.y, p.x - e.x)


# ---------- helpers ----------

func add(f):
	fx.append(f)
	return f


func run(gen, name_: String = "") -> void:
	tasks.append({"gen": gen, "wait": 0.0, "name": name_})


func alive() -> Array:
	var out: Array = []
	for e in enemies:
		if e.dying <= 0 and e.spawn <= 0.2:
			out.append(e)
	return out


func near(x: float, y: float, r: float) -> Array:
	var out: Array = []
	for e in enemies:
		if e.dying <= 0 and sqrt(pow(e.x - x, 2.0) + pow(e.y - y, 2.0)) < r + e.r:
			out.append(e)
	return out


func nearest(x: float, y: float, maxD: float = 1e9, ex: Array = []) -> Enemy:
	var b = null
	var bd: float = maxD
	for e in enemies:
		if e.dying > 0 or ex.has(e.id):
			continue
		var d: float = sqrt(pow(e.x - x, 2.0) + pow(e.y - y, 2.0)) - e.r
		if d < bd:
			bd = d
			b = e
	return b


func in_cone(x: float, y: float, ang: float, range_: float, half: float) -> Array:
	var out: Array = []
	for e in enemies:
		if e.dying > 0:
			continue
		var dx: float = e.x - x
		var dy: float = e.y - y
		var d: float = sqrt(dx * dx + dy * dy)
		if d - e.r > range_:
			continue
		if d < e.r + 3:
			out.append(e)
			continue
		var da: float = atan2(dy, dx) - ang
		da = absf(fmod(fmod(da + PI, M.TAU) + M.TAU, M.TAU) - PI)
		if da <= half + asin(minf(1.0, e.r / d)):
			out.append(e)
	return out


func seg_dist(px: float, py: float, ax: float, ay: float, bx: float,
		by: float) -> float:
	var vx: float = bx - ax
	var vy: float = by - ay
	var l2: float = vx * vx + vy * vy
	if l2 == 0.0:
		l2 = 1.0
	var t: float = M.clampf(((px - ax) * vx + (py - ay) * vy) / l2, 0.0, 1.0)
	return sqrt(pow(px - (ax + vx * t), 2.0) + pow(py - (ay + vy * t), 2.0))


func shake(m: float, d: float = 0.25) -> void:
	if m >= shakeM or shakeT <= 0:
		shakeM = m
		shakeT = d
		shakeD = d


func shock(x: float, y: float, max_: float, dur: float, amp: float = 3) -> void:
	if shocks.size() < 4:
		shocks.append({"x": x, "y": y, "r": 0.0, "max": max_, "t": 0.0,
				"dur": dur, "amp": amp})


func screen_flash(c: int, a: float, dur: float = 0.2) -> void:
	flashC = c
	flashA = a
	flashT = dur
	flashD = dur


func mark(e, key: String, dur: float, k: float = 1.0) -> void:
	var s = e.st.get(key, null)
	if s != null:
		s["t"] = maxf(float(s["t"]), dur)
		s["max"] = maxf(float(s["max"]), dur)
		s["k"] = k
	else:
		e.st[key] = {"t": dur, "max": dur, "k": k}


func stk(e, key: String):
	return e.st.get(key, null)


func push(e, x: float, y: float, v: float) -> void:
	var d: float = sqrt(pow(e.x - x, 2.0) + pow(e.y - y, 2.0))
	if d == 0.0:
		d = 1.0
	var w: float = 0.12 if e.kind == "boss" else (0.5 if e.kind == "elite" else 1.0)
	e.kx += ((e.x - x) / d) * v * w
	e.ky += ((e.y - y) / d) * v * w


func heal_player(a: float) -> void:
	var p = player
	p.hp = minf(p.maxHp, p.hp + a)
	lastHeal = time
	if a >= 2:
		nums.append({"x": p.x, "y": p.y - 22, "vy": -14, "t": 0.8,
				"txt": "+" + str(M.js_round(a)), "c": int(M.P["c1"]), "big": false})


func poison(e, total: float, dur: float, key: int, src: int,
		every: float = 0.5) -> void:
	if e.dying > 0:
		return
	var n: int = maxi(1, M.js_round(dur / every))
	for p in e.poison:
		if int(p["key"]) == key:
			p["rem"] = maxf(float(p["rem"]), dur)
			p["max"] = maxf(float(p["max"]), dur)
			return
	e.poison.append({"key": key, "rem": dur, "max": dur, "tick": every,
			"per": total / float(n), "src": src})
	e.p_every = every


func hit(e, amt: float, o: Dictionary) -> bool:
	if e.dying > 0:
		return false
	amt = maxf(1, float(M.js_round(amt)))
	var kind: String = String(o.get("kind", "impact"))
	var is_poison: bool = kind == "poison"
	e.hp -= amt
	e.lastHurt = time
	stats["total"] = float(stats["total"]) + amt
	stats["hits"] = int(stats["hits"]) + 1
	stats["ev"].append({"t": time, "a": amt})
	var pl = player
	pl.cat = minf(100.0, pl.cat + (amt / 55.0 if pl.form == "vessel" else 0.0))
	if o.has("heal"):
		heal_player(amt * float(o["heal"]))
	var w: float = 0.12 if e.kind == "boss" else (0.5 if e.kind == "elite" else 1.0)
	if float(o.get("kx", 0.0)) != 0.0 or float(o.get("ky", 0.0)) != 0.0:
		e.kx += float(o.get("kx", 0.0)) * w
		e.ky += float(o.get("ky", 0.0)) * w
		e.dyDir = atan2(float(o.get("ky", 0.0)), float(o.get("kx", 0.0)))
	if is_poison:
		e.tint = 1
	else:
		e.flash = 1
		e.squash = 0.14
	if not is_poison:
		e.stagger = maxf(e.stagger, float(o.get("stagger", 0.1))
				* (0.2 if e.kind == "boss" else (0.6 if e.kind == "elite" else 1.0)))
	var at = o.get("at", null)
	var ex: float = float(at[0]) if at != null else e.x
	var ey: float = float(at[1]) if at != null else e.y
	if not bool(o.get("quiet", false)):
		contact(e, kind, ex, ey, o)
	var col: int = int(M.P["i0"])
	if kind == "poison":
		col = int(M.P["c1"])
	elif kind == "crystal":
		col = int(M.P["y1"])
	elif kind == "acid":
		col = int(M.P["c2"])
	elif kind == "burst":
		col = int(M.P["g2"])
	nums.append({"x": e.x + (M.hash_n(frame * 7 + e.id) - 0.5) * 8,
			"y": e.y - e.r - 8, "vy": -22, "t": 0.7 if is_poison else 0.9,
			"txt": str(int(amt)), "c": col,
			"big": amt >= 70 or bool(o.get("big", false))})
	if nums.size() > 90:
		nums.remove_at(0)
	if e.hp <= 0:
		kill(e, kind)
		return true
	return false


func contact(e, kind: String, x: float, y: float, o: Dictionary) -> void:
	var r = rng
	var z: float = e.r * 0.7
	match kind:
		"poison":
			if r.next() < 0.7:
				FX.drops(self, e.x, e.y, 2, 22, int(M.P["c1"]), int(M.P["c3"]),
						int(M.P["e1"]), {"z": z, "up": 20, "size": [1.0, 2.0]})
		"acid":
			FX.drops(self, x, y, 4, 40, int(M.P["c1"]), int(M.P["c3"]),
					int(M.P["e2"]), {"z": z, "up": 40, "size": [1.0, 3.0]})
		"crystal":
			FX.shards(self, x, y, 4, 60, int(M.P["y1"]), int(M.P["v1"]),
					int(M.P["y2"]), {"z": z, "size": [2.0, 4.0], "up": 50})
		"burst":
			FX.drops(self, x, y, 5, 70, int(M.P["g2"]), int(M.P["c3"]),
					int(M.P["c1"]), {"z": z, "up": 60})
			FX.chips(self, x, y, 2, 50, int(M.P["i1"]), int(M.P["i3"]),
					int(M.P["i0"]), {"z": z})
		"bite":
			var a: float = atan2(float(o.get("ky", 0.0)), float(o.get("kx", 1.0)))
			FX.shards(self, x, y, 3, 60, int(M.P["y1"]), int(M.P["v2"]),
					int(M.P["y2"]), {"z": z, "ang": a, "spread": 2,
					"size": [2.0, 3.0]})
			add(FX.Splash.new(x, y, 4, int(M.P["c1"]), int(M.P["c3"])))
		"pierce":
			FX.shards(self, x, y, 3, 50, int(M.P["c2"]), int(M.P["e2"]),
					int(M.P["c3"]), {"z": z, "size": [2.0, 3.0]})
		_:
			FX.chips(self, x, y, 3, 55, int(M.P["i1"]), int(M.P["i3"]),
					int(M.P["i0"]), {"z": z, "size": [2.0, 3.0]})
			FX.drops(self, x, y, 2, 40, int(M.P["c1"]), int(M.P["c3"]),
					int(M.P["e1"]), {"z": z, "up": 40, "size": [1.0, 2.0]})


func kill(e, kind: String) -> void:
	e.dying = 0.75 if (kind == "poison" or kind == "acid") else (
			0.38 if kind == "crystal" else 0.16)
	e.dyT = 0.0
	e.dyKind = kind
	e.hp = 0
	stats["kills"] = int(stats["kills"]) + 1
	player.cat = minf(100.0, player.cat + (3.0 if player.form == "vessel" else 0.0))
	respawnQ.append(time + 1.4 + rng.next() * 0.8)
	e.poison.clear()
	nums.append({"x": e.x, "y": e.y - e.r - 16, "vy": -12, "t": 0.9,
			"txt": "x", "c": int(M.P["r3"]), "big": false})


func death_fx(e) -> void:
	var k: String = e.dyKind
	var z: float = e.r * 0.6
	if k == "poison" or k == "acid":
		add(FX.Pool.new(e.x, e.y, e.r * 1.1 + 2, MATS.MAT()["acid"], 2.6,
				{"blobs": 3, "resid": true, "boil": 0.8}))
		FX.steam(self, e.x, e.y, 3, 8, int(M.P["e2"]), int(M.P["c1"]), 3,
				{"vz": 18})
	elif k == "crystal":
		FX.shards(self, e.x, e.y, 10 + (8 if e.kind != "grunt" else 0), 90,
				int(M.P["y1"]), int(M.P["v1"]), int(M.P["y2"]),
				{"z": z, "up": 90, "size": [3.0, 7.0]})
		FX.shards(self, e.x, e.y, 4, 40, int(M.P["w"]), int(M.P["y1"]),
				int(M.P["y2"]), {"z": z, "up": 50, "size": [2.0, 4.0], "land": 3})
		add(FX.Ring.new(e.x, e.y, e.r * 2.4, 0.3,
				{"w": 2, "cols": [int(M.P["w"]), int(M.P["y1"]), int(M.P["v1"])]}))
	else:
		FX.chips(self, e.x, e.y, 6, 85, int(M.P["r2"]), int(M.P["r0"]),
				int(M.P["r3"]), {"z": z, "up": 90, "size": [2.0, 4.0],
				"ang": e.dyDir, "spread": 3.5})
		FX.chips(self, e.x, e.y, 3, 60, int(M.P["i1"]), int(M.P["i3"]),
				int(M.P["i0"]), {"z": z})
		FX.drops(self, e.x, e.y, 7, 80, int(M.P["r3"]), int(M.P["g2"]),
				int(M.P["r2"]), {"z": z, "up": 90, "ang": e.dyDir,
				"spread": 3.5, "size": [1.0, 3.0]})
		add(FX.Ring.new(e.x, e.y, e.r * 2, 0.22,
				{"w": 2, "cols": [int(M.P["i0"]), int(M.P["r3"]), int(M.P["r1"])]}))
	if e.kind == "boss":
		shake(5, 0.5)
		add(FX.Ring.new(e.x, e.y, 70, 0.6,
				{"w": 4, "cols": [int(M.P["i0"]), int(M.P["g2"]), int(M.P["r1"])]}))
		FX.chips(self, e.x, e.y, 30, 120, int(M.P["i1"]), int(M.P["i3"]),
				int(M.P["i0"]), {"z": 10, "up": 120, "size": [3.0, 6.0]})


# ---------- simulation ----------

func step(dt: float) -> void:
	if shakeT > 0:
		shakeT -= dt
	if flashT > 0:
		flashT -= dt
	if hitstop > 0:
		hitstop -= dt
		dim += (0.35 - dim) * 0.3
		for s in shocks:
			s["t"] += dt * 0.1
		return
	dim += (0.0 - dim) * minf(1.0, dt * 6)
	time += dt
	frame += 1
	for i in range(tasks.size() - 1, -1, -1):
		var t: Dictionary = tasks[i]
		t["wait"] = float(t["wait"]) - dt
		var n: int = 0
		while float(t["wait"]) < -1e-6 and n < 60:
			n += 1
			if not t["gen"].is_valid():
				tasks.remove_at(i)
				break
			var r = t["gen"].resume()
			if not t["gen"].is_valid():
				tasks.remove_at(i)
				break
			t["wait"] = float(t["wait"]) + (float(r) if r != null else 1.0 / 60.0)
	update_player(dt)
	update_enemies(dt)
	for f in fx:
		f.age += dt
		if f.hf:
			f.hf = maxf(0.0, f.hf - dt)
		f.upd(self, dt)
	for i in range(fx.size() - 1, -1, -1):
		if fx[i].dead:
			fx.remove_at(i)
	parts.update(self, dt)
	for n in nums:
		n["t"] = float(n["t"]) - dt
		n["y"] = float(n["y"]) + float(n["vy"]) * dt
		n["vy"] = float(n["vy"]) * 0.94
	var keep: Array = []
	for n in nums:
		if float(n["t"]) > 0:
			keep.append(n)
	nums = keep
	for s in shocks:
		s["t"] = float(s["t"]) + dt
		s["r"] = float(s["max"]) * M.clampf(float(s["t"]) / float(s["dur"]), 0.0, 1.0)
	var ks: Array = []
	for s in shocks:
		if float(s["t"]) < float(s["dur"]):
			ks.append(s)
	shocks = ks
	var ev: Array = stats["ev"]
	while ev.size() > 0 and float(ev[0]["t"]) < time - 5:
		ev.remove_at(0)
	spawn_logic()
	var p = player
	if p.form == "venom":
		p.venomT -= dt
		if p.venomT <= 0:
			p.form = "vessel"
			p.venomT = 0.0
			formEnded = time
	else:
		p.cat = minf(100.0, p.cat + dt * 1.2)


func update_player(dt: float) -> void:
	var p = player
	p.cast = maxf(0.0, p.cast - dt)
	p.hurtT = maxf(0.0, p.hurtT - dt)
	p.aura += dt
	if p.path != null:
		var q: Dictionary = p.path
		q["t"] = float(q["t"]) + dt
		var f: float = M.clampf(float(q["t"]) / float(q["dur"]), 0.0, 1.0)
		var e: float = 2 * f * f if f < 0.5 else 1 - pow(-2 * f + 2, 2) / 2
		var dist: float = (0.2 * f + 0.8 * e) * float(q["total"])
		var i: int = 1
		var lens: Array = q["len"]
		while i < lens.size() - 1 and float(lens[i]) < dist:
			i += 1
		var pts: Array = q["pts"]
		var a: Dictionary = pts[i - 1]
		var b: Dictionary = pts[i]
		var seg: float = float(lens[i]) - float(lens[i - 1])
		if seg == 0.0:
			seg = 1.0
		var u: float = M.clampf((dist - float(lens[i - 1])) / seg, 0.0, 1.0)
		var nx: float = float(a["x"]) + (float(b["x"]) - float(a["x"])) * u
		var ny: float = float(a["y"]) + (float(b["y"]) - float(a["y"])) * u
		var dx: float = nx - p.x
		var dy: float = ny - p.y
		if sqrt(dx * dx + dy * dy) > 0.2:
			p.face = atan2(dy, dx)
		p.vx = dx / dt
		p.vy = dy / dt
		p.x = nx
		p.y = ny
		p.walk += dt * 14
		p.trail = 1
		if float(q["t"]) >= float(q["dur"]):
			p.path = null
	else:
		var mx: float = float(input["x"])
		var my: float = float(input["y"])
		if mx == 0.0 and my == 0.0 and p.mt != null:
			var dx: float = float(p.mt["x"]) - p.x
			var dy: float = float(p.mt["y"]) - p.y
			var d: float = sqrt(dx * dx + dy * dy)
			if d < 3:
				p.mt = null
			else:
				mx = dx / d
				my = dy / d
		elif mx != 0.0 or my != 0.0:
			p.mt = null
		var l: float = sqrt(mx * mx + my * my)
		if l == 0.0:
			l = 1.0
		var sp: float = p.speed * (1.1 if p.form == "venom" else 1.0)
		var tgt: float = sp if (mx != 0.0 or my != 0.0) else 0.0
		p.vx += ((mx / l) * tgt - p.vx) * minf(1.0, dt * 14)
		p.vy += ((my / l) * tgt - p.vy) * minf(1.0, dt * 14)
		p.x = M.clampf(p.x + p.vx * dt, 8.0, W - 8.0)
		p.y = M.clampf(p.y + p.vy * dt, 10.0, H - 8.0)
		if sqrt(p.vx * p.vx + p.vy * p.vy) > 6:
			p.walk += dt * sqrt(p.vx * p.vx + p.vy * p.vy) * 0.14
			if p.cast <= 0:
				p.face = atan2(p.vy, p.vx)
		p.trail = maxf(0.0, p.trail - dt * 4)
	for f in fx:
		if f.push:
			var dx: float = p.x - f.x
			var dy: float = p.y - f.y
			var d: float = sqrt(dx * dx + dy * dy)
			var m: float = f.r + 5
			if d < m and d > 0.1:
				p.x += (dx / d) * (m - d)
				p.y += (dy / d) * (m - d)
	if p.form == "venom" and frame % 9 == 0:
		var a: float = rng.range(0.0, M.TAU)
		parts.add({"k": "steam", "x": p.x + cos(a) * 6, "y": p.y + sin(a) * 3,
				"z": 6, "vx": cos(a) * 4, "vy": -2, "vz": 10, "size": 3,
				"max": 0.9, "c1": int(M.P["e1"]), "c2": int(M.P["c0"]),
				"drag": 1})


func glide(pts: Array, dur: float) -> void:
	var p = player
	var all: Array = [{"x": p.x, "y": p.y}]
	for q in pts:
		all.append({"x": M.clampf(float(q["x"]), 10.0, W - 10.0),
				"y": M.clampf(float(q["y"]), 12.0, H - 10.0)})
	var len: Array = [0.0]
	for i in range(1, all.size()):
		var a: Dictionary = all[i - 1]
		var b: Dictionary = all[i]
		len.append(float(len[i - 1]) + sqrt(pow(float(b["x"]) - float(a["x"]), 2.0)
				+ pow(float(b["y"]) - float(a["y"]), 2.0)))
	p.path = {"pts": all, "len": len,
			"total": maxf(1.0, float(len[len.size() - 1])), "t": 0.0, "dur": dur}
	p.mt = null


func update_enemies(dt: float) -> void:
	var p = player
	var list: Array = enemies
	var tanks: Array = []
	for f in fx:
		if f.tank and not f.dead:
			tanks.append(f)
	for i in range(list.size() - 1, -1, -1):
		var e = list[i]
		e.flash = maxf(0.0, e.flash - dt * 7)
		e.tint = maxf(0.0, e.tint - dt * 3.5)
		e.squash = maxf(0.0, e.squash - dt)
		e.lunge = maxf(0.0, e.lunge - dt * 3)
		e.hover = false
		var dead_keys: Array = []
		for k in e.st:
			var s: Dictionary = e.st[k]
			s["t"] = float(s["t"]) - dt
			if float(s["t"]) <= 0:
				dead_keys.append(k)
		for k in dead_keys:
			e.st.erase(k)
		if e.dying > 0:
			e.dyT += dt
			e.dying -= dt
			e.x += e.kx * dt * 0.5
			e.y += e.ky * dt * 0.5
			e.kx *= 0.9
			e.ky *= 0.9
			if e.dying <= 0:
				death_fx(e)
				list.remove_at(i)
			continue
		if e.poison.size() > 0:
			var ev: float = e.p_every
			for k in range(e.poison.size() - 1, -1, -1):
				var s: Dictionary = e.poison[k]
				s["rem"] = float(s["rem"]) - dt
				s["tick"] = float(s["tick"]) - dt
				if float(s["tick"]) <= 0:
					s["tick"] = float(s["tick"]) + ev
					if hit(e, float(s["per"]),
							{"kind": "poison", "src": s["src"], "quiet": true}):
						break
				if float(s["rem"]) <= 0:
					e.poison.remove_at(k)
			if e.dying > 0:
				continue
			if frame % 20 == i % 20:
				FX.drops(self, e.x + rng.range(-3, 3), e.y, 1, 6,
						int(M.P["c1"]), int(M.P["c3"]), int(M.P["e1"]),
						{"z": e.r + 2, "up": -10, "size": [1.0, 2.0],
						"land": 1, "max": 1})
		if e.spawn > 0:
			e.spawn -= dt
			if e.spawn > 0.1 and frame % 4 == 0:
				dust_at(e.x, e.y)
			continue
		e.x += e.kx * dt
		e.y += e.ky * dt
		var kd: float = maxf(0.0, 1 - 5.5 * dt)
		e.kx *= kd
		e.ky *= kd
		if e.stagger > 0:
			e.stagger -= dt
		var bound = e.st.get("coil", null)
		if e.stagger <= 0 and bound == null:
			var tx: float = p.x
			var ty: float = p.y
			var tank = null
			var td: float = 1e9
			for t in tanks:
				var d: float = sqrt(pow(t.x - e.x, 2.0) + pow(t.y - e.y, 2.0)) - t.r
				if d < 70 and d < td:
					td = d
					tank = t
			if tank != null:
				tx = tank.x
				ty = tank.y
			var dx: float = tx - e.x
			var dy: float = ty - e.y
			var d: float = sqrt(dx * dx + dy * dy)
			if d == 0.0:
				d = 1.0
			var reach: float = ((tank.r if tank != null else 5.0)) + e.r + 3.0
			var slow: float = 0.4 if e.slow > 0 else 1.0
			if e.slow > 0:
				e.slow -= dt
			var sp: float = e.speed * slow * (0.8 if e.st.has("miasma") else 1.0)
			var mx: float = 0.0
			var my: float = 0.0
			if d > maxf(e.des, reach):
				mx = dx / d
				my = dy / d
			elif d > reach + 2:
				mx = (-dy / d) * e.orb * 0.35 + (dx / d) * 0.1
				my = (dx / d) * e.orb * 0.35 + (dy / d) * 0.1
			e.x += mx * sp * dt
			e.y += my * sp * dt
			if mx != 0.0 or my != 0.0:
				e.walk += dt * sp * 0.22
			var fa: float = atan2(dy, dx)
			var da: float = fa - e.face
			da = fmod(fmod(da + PI, M.TAU) + M.TAU, M.TAU) - PI
			e.face += da * minf(1.0, dt * 8)
			if d < reach + 2:
				e.atkT -= dt
				if e.atkT <= 0:
					e.atkT = 1.6 if e.kind == "boss" else 1.1 + M.hash_n(e.id) * 0.4
					e.lunge = 1
					if tank != null:
						tank.hurt(self, 30.0 if e.kind == "boss" else (
								12.0 if e.kind == "elite" else 5.0))
						parts.add({"k": "spark", "x": tank.x - (tank.x - e.x) * 0.1,
								"y": e.y, "z": 6, "vx": 0, "vy": -10, "vz": 20,
								"max": 0.2, "c1": int(M.P["i0"])})
					elif p.hp > 1:
						p.hp = maxf(1.0, p.hp - (25.0 if e.kind == "boss" else (
								8.0 if e.kind == "elite" else 3.0)))
						p.hurtT = 0.12
		for f in fx:
			if f.push:
				var dx: float = e.x - f.x
				var dy: float = e.y - f.y
				var d: float = sqrt(dx * dx + dy * dy)
				var m: float = f.r + e.r
				if d < m and d > 0.1:
					e.x += (dx / d) * (m - d)
					e.y += (dy / d) * (m - d)
		e.x = M.clampf(e.x, e.r, W - e.r)
		e.y = M.clampf(e.y, e.r + 3, H - e.r)
	# soft separation
	for i in range(list.size()):
		var a = list[i]
		if a.dying > 0:
			continue
		for j in range(i + 1, list.size()):
			var b = list[j]
			if b.dying > 0:
				continue
			var dx: float = b.x - a.x
			var dy: float = b.y - a.y
			var m: float = (a.r + b.r) * 0.95
			if absf(dx) > m or absf(dy) > m:
				continue
			var d: float = sqrt(dx * dx + dy * dy)
			if d < m and d > 0.01:
				var k: float = (m - d) * 0.5
				var wa: float = b.r / (a.r + b.r)
				var wb: float = a.r / (a.r + b.r)
				a.x -= (dx / d) * k * 2 * wa * 0.5
				a.y -= (dy / d) * k * 2 * wa * 0.5
				b.x += (dx / d) * k * 2 * wb * 0.5
				b.y += (dy / d) * k * 2 * wb * 0.5


func spawn_logic() -> void:
	while respawnQ.size() > 0 and float(respawnQ[0]) <= time:
		respawnQ.remove_at(0)
		if not bool(cfg["respawn"]) or bool(cfg["wave"]):
			continue
		if count() < int(cfg["density"]):
			spawn_one(false)
	if bool(cfg["wave"]) and time > nextWave \
			and count() <= int(ceil(float(cfg["density"]) * 0.3)):
		nextWave = time + 5
		var need: int = int(cfg["density"]) - count()
		var side: int = rng.int_n(4)
		for i in range(need):
			spawn_one(true, side)
	if bool(cfg["boss"]) and not has_boss() and respawnQ.size() == 0:
		bossT += 1.0 / 60.0
		if bossT > 6:
			bossT = 0.0
			var b = Enemy.new("boss", 0, EID)
			EID += 1
			place(b, false, true)
			b.spawn = 1
			enemies.append(b)


func spawn_one(edge: bool, side: int = -1) -> void:
	var elites: int = 0
	for e in enemies:
		if e.kind == "elite" and e.dying <= 0:
			elites += 1
	var e = Enemy.new(
			"elite" if elites < maxi(1, M.js_round(float(cfg["density"]) / 8.0)) else "grunt",
			rng.int_n(3), EID)
	EID += 1
	place(e, false, true)
	if side >= 0:
		e.x = 8.0 if side == 0 else (W - 8.0 if side == 1 else rng.range(30.0, W - 30.0))
		e.y = 10.0 if side == 2 else (H - 10.0 if side == 3 else rng.range(30.0, H - 30.0))
	e.spawn = 0.7
	enemies.append(e)


func kill_all() -> void:
	for e in enemies:
		if e.dying <= 0:
			e.dying = 0.1
			e.dyKind = "burst"
	respawnQ.clear()


func shake_off() -> Array:
	if shakeT <= 0:
		return [0, 0]
	var k: float = minf(1.0, shakeT / shakeD) * shakeM
	var f: int = frame
	return [M.js_round((M.hash_n(f * 3) - 0.5) * 2 * k),
			M.js_round((M.hash_n(f * 5 + 9) - 0.5) * 2 * k)]


# ---------- drawing ----------

func draw(g) -> void:
	g.t = time
	var L = g.s
	for f in fx:
		if f.has_method("gnd"):
			f.gnd(g, self)
	if overlay != null:
		overlay.call(g)
	for e in enemies:
		ACT.enemy_shadow(g, e)
	ACT.enemy_shadow(g, player, true)
	var pl = player
	g.s.dl = 7
	g.s.ring(pl.x, pl.y + 3, 10, 1,
			int(M.P["c1"]) if pl.form == "venom" else int(M.P["v2"]))
	g.s.dl = 16
	for f in fx:
		if f.has_method("shd"):
			f.shd(g, self)
	parts.shadows(g)
	var items: Array = []
	for e in enemies:
		items.append({"y": e.y, "k": "enemy", "o": e})
	items.append({"y": player.y, "k": "player", "o": player})
	for f in fx:
		if f.has_method("up"):
			items.append({"y": f.sy if f.sy != 0.0 else f.y, "k": "fx", "o": f})
	items.sort_custom(func(a, b): return float(a["y"]) < float(b["y"]))
	for it in items:
		match it["k"]:
			"enemy":
				ACT.draw_enemy(g, it["o"], self)
			"player":
				ACT.draw_player(g, it["o"], self)
			"fx":
				it["o"].up(g, self)
	for f in fx:
		if f.has_method("air"):
			f.air(g, self)
	parts.draw(g)
	for e in enemies:
		ACT.draw_enemy_bars(g, e, self)
	for n in nums:
		var sc: float = 2.0 if bool(n["big"]) else 1.0
		var w: float = DRAW.text_w(String(n["txt"]), sc)
		L.dl = M.js_round(float(n["t"]) * 64) if float(n["t"]) < 0.25 else 16
		DRAW.text(L, float(n["x"]) - w / 2, float(n["y"]), String(n["txt"]),
				int(n["c"]), int(M.P["bk"]), sc)
		L.dl = 16
	for f in fx:
		if f.has_method("lit"):
			f.lit(g, self)
	parts.glows(g)
	ACT.player_glow(g, player, self)
	g.l.reset()


func grade() -> Array:
	return [dim, 1, 0.0 if player.form == "venom" else 0, 1]


func flash_arr() -> Array:
	if flashT <= 0:
		return [0, 0, 0, 0]
	var c: int = flashC
	return [float(c & 255) / 255.0, float((c >> 8) & 255) / 255.0,
			float((c >> 16) & 255) / 255.0, flashA * (flashT / flashD)]


func dps() -> float:
	var ev: Array = stats["ev"]
	if ev.size() == 0:
		return 0.0
	var s: float = 0.0
	var t0: float = time - 3
	for e in ev:
		if float(e["t"]) >= t0:
			s += float(e["a"])
	return s / 3


func dust_at(x: float, y: float) -> void:
	parts.add({"k": "dust", "x": x + (rng.next() - 0.5) * 8, "y": y + 2, "z": 0,
			"vx": 0, "vy": 0, "vz": 10, "size": 3, "max": 0.5,
			"c1": int(M.P["i3"]), "c2": int(M.P["i2"])})
