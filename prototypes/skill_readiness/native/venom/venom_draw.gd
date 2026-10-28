class_name VenomDraw
extends RefCounted

## Native port of the ORIGINAL Venomwright free-form drawing helpers and of the
## liquid shading passes, transcribed 1:1 from `src/game/pixel.ts`:
##   `text`, `ball`, `shard`, `bubble`, `wormBody`, `glow`, `crystalPrism`,
##   `makeGround`, plus `Field.shade()` and `Field.vapor()`.
##
## `Field.shade` / `Field.vapor` live here (taking the field as their first
## argument) because GDScript inner classes cannot be extended from outside the
## file that declares them.

const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")

const GL: Dictionary = {
	"0": "111101101101111", "1": "010110010010111", "2": "111001111100111",
	"3": "111001111001111", "4": "101101111001001", "5": "111100111001111",
	"6": "111100111101111", "7": "111001001001001", "8": "111101111101111",
	"9": "111101111001111", "+": "000010111010000", "-": "000000111000000",
	".": "000000000000010", "%": "101001010100101", "x": "000101010101000",
	"!": "010010010000010", ":": "000010000010000", " ": "000000000000000",
	"F": "111100110100100", "s": "111100111001111",
}


static func text_w(s: String, sc: float = 1.0) -> float:
	return float(s.length()) * 4.0 * sc - sc


static func text(L, x: float, y: float, s: String, c: int, outline: int = 0,
		sc: float = 1.0) -> void:
	var gx: int = M.js_round(x * L.k)
	var gy: int = M.js_round(y * L.k)
	var gsc: int = maxi(1, M.js_round(sc * maxf(1.0, L.k * 0.95)))
	if outline != 0:
		for off in [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]]:
			_text_pass(L, gx, gy, gsc, s, outline, off[0], off[1])
	_text_pass(L, gx, gy, gsc, s, c, 0, 0)


static func _text_pass(L, gx: int, gy: int, gsc: int, s: String, col: int,
		ox: int, oy: int) -> void:
	var cx: int = gx + ox
	for ch in s:
		var g: String = String(GL.get(ch, GL[" "]))
		for i in range(15):
			if g[i] != "1":
				continue
			var px: int = cx + (i % 3) * gsc
			var py: int = gy + oy + int(floor(float(i) / 3.0)) * gsc
			for dy in range(gsc):
				L.raw_hline(px, px + gsc - 1, py + dy, col)
		cx += 4 * gsc


## A `Pal` is the original `{o,d,b,l,s}` five-tone ramp: outline, dark, base,
## light, specular.
static func pal(o: int, d: int, b: int, l: int, s: int) -> Dictionary:
	return {"o": o, "d": d, "b": b, "l": l, "s": s}


static func ball(L, cx: float, cy: float, r: float, p: Dictionary,
		ry: float = -1.0, outline: bool = true) -> void:
	if ry < 0.0:
		ry = r
	var k: float = L.k
	var gcx: int = M.js_round(cx * k)
	var gcy: int = M.js_round(cy * k)
	var grx: float = (r + 0.35) * k
	var gry: float = (ry + 0.35) * k
	var ir: int = int(ceil(r * k))
	var iy: int = int(ceil(ry * k))
	var mn: float = minf(grx, gry)
	for dy in range(-iy, iy + 1):
		for dx in range(-ir, ir + 1):
			var nx: float = float(dx) / grx
			var ny: float = float(dy) / gry
			var q: float = nx * nx + ny * ny
			if q > 1.0:
				continue
			var c: int
			if outline and (1.0 - sqrt(q)) * mn < maxf(1.0, 0.9 * k):
				c = int(p["o"])
			else:
				var bayer: int = M.BAYER[(((gcy + dy) & 3) << 2) | ((gcx + dx) & 3)]
				var I: float = (-nx * 0.45 - ny * 0.55 + sqrt(1.0 - q) * 0.72
						+ (float(bayer) - 7.5) * 0.014)
				if I < 0.22:
					c = int(p["d"])
				elif I < 0.62:
					c = int(p["b"])
				elif I < 0.92:
					c = int(p["l"])
				else:
					c = int(p["s"])
			L.raw_px(gcx + dx, gcy + dy, c)


static func shard(L, x: float, y: float, ang: float, len: float, wid: float,
		lit: int, dark: int, edge: int) -> void:
	if len < 1.5:
		L.px(x, y, lit)
		return
	var ca: float = cos(ang)
	var sa: float = sin(ang)
	var tx: float = x + ca * len
	var ty: float = y + sa * len
	var bx: float = x - ca * len * 0.4
	var by: float = y - sa * len * 0.4
	var mx: float = x + ca * len * 0.1
	var my: float = y + sa * len * 0.1
	var lx: float = mx - sa * wid
	var ly: float = my + ca * wid
	var rx: float = mx + sa * wid
	var ry: float = my - ca * wid
	L.tri(tx, ty, lx, ly, bx, by, lit)
	L.tri(tx, ty, rx, ry, bx, by, dark)
	L.line(tx, ty, lx, ly, edge)
	L.line(tx, ty, bx, by, M.mix(edge, lit, 0.5))


static func bubble(L, x: float, y: float, r: float, tint: int, edge: int,
		hi: int) -> void:
	if r < 1.0:
		L.dot(x, y, hi)
		return
	var sd: int = L.dl
	L.dl = 7
	L.disc(x, y, maxf(0.4, r - 0.8), tint)
	L.dl = sd
	L.ring(x, y, r, 0.8, edge)
	L.dot(x - r * 0.45, y - r * 0.5, hi)
	if r > 2.2:
		L.dot(x - r * 0.45 + 0.5, y - r * 0.5, hi)
		L.dot(x + r * 0.38, y + r * 0.42, edge)


static func worm_body(L, s: Array, p: Dictionary, opts: Dictionary = {}) -> void:
	var lo: float = float(opts.get("lightOff", 0.28))
	for i in range(s.size() - 1, -1, -1):
		L.disc(float(s[i]["x"]), float(s[i]["y"]), float(s[i]["r"]) + 1.0, int(p["o"]))
	for i in range(s.size() - 1, -1, -1):
		L.disc(float(s[i]["x"]), float(s[i]["y"]), float(s[i]["r"]), int(p["d"]))
	for i in range(s.size() - 1, -1, -1):
		L.disc(float(s[i]["x"]) - float(s[i]["r"]) * lo * 0.6,
				float(s[i]["y"]) - float(s[i]["r"]) * lo,
				float(s[i]["r"]) * 0.78, int(p["b"]))
	for i in range(s.size() - 1, -1, -1):
		if float(s[i]["r"]) > 1.2:
			L.disc(float(s[i]["x"]) - float(s[i]["r"]) * lo,
					float(s[i]["y"]) - float(s[i]["r"]) * lo * 1.5,
					float(s[i]["r"]) * 0.44, int(p["l"]))
	if opts.has("stripe"):
		var T: float = float(opts.get("stripeT", 0.0))
		var stripe: int = int(opts["stripe"])
		for i in range(s.size()):
			var kk: float = cos((float(i) / float(s.size())) * 9.0 - T * 7.0)
			if kk > 0.45:
				L.disc(float(s[i]["x"]), float(s[i]["y"]),
						maxf(0.4, float(s[i]["r"]) * 0.4 * kk), stripe)
	if bool(opts.get("spec", true)):
		var i2: int = 0
		while i2 < s.size():
			if float(s[i2]["r"]) > 1.8:
				L.dot(float(s[i2]["x"]) - float(s[i2]["r"]) * 0.45,
						float(s[i2]["y"]) - float(s[i2]["r"]) * 0.55, int(p["s"]))
			i2 += 2


static func glow(L, cx: float, cy: float, r: float, c: int, k: float = 0.5,
		bands: int = 4) -> void:
	L.add = true
	var n: int = maxi(2, mini(bands, int(ceil((r * L.k) / 2.5))))
	L.a = M.js_round((255.0 * k) / float(n))
	for i in range(n):
		L.disc(cx, cy, r * (1.0 - float(i) / float(n)), c)
	L.add = false
	L.a = 255


static func crystal_prism(L, x: float, y: float, h: float, w: float, lean: float,
		lit: int, dark: int, edge: int, core: int, t: float = 0.0) -> void:
	var tipx: float = x + lean
	var tipy: float = y - h
	var sh: float = h * 0.18 + 1.0
	L.poly([x - w, y, x - w + lean * 0.2, y - h + sh, tipx, tipy, tipx, y, x, y + 1.0], lit)
	L.poly([x, y + 1.0, tipx, y, tipx, tipy, x + w + lean * 0.2, y - h + sh, x + w, y], dark)
	L.line(x - w, y, x - w + lean * 0.2, y - h + sh, edge)
	L.line(x - w + lean * 0.2, y - h + sh, tipx, tipy, edge)
	L.line(tipx, tipy, x, y, M.mix(edge, lit, 0.6))
	L.line(tipx, tipy, x + w + lean * 0.2, y - h + sh, M.mix(edge, dark, 0.4))
	if h > 6.0:
		var cx: float = x + lean * 0.5
		var cy: float = y - h * 0.45
		L.line(cx, cy - h * 0.22, cx, cy + h * 0.25, core)
		if sin(t * 5.0 + x) > 0.1:
			L.dot(cx, cy - h * 0.1 + sin(t * 3.0 + y) * h * 0.15, edge)


# ---------------------------------------------------------------------------
# Ground
# ---------------------------------------------------------------------------

static func make_ground(L, seed: int, stage: int = 5) -> void:
	var W: int = L.W
	var H: int = L.H
	var k: float = L.k
	var r = RNG.new(seed)
	var base: Array = [M.P["k1"], M.P["k2"], M.hex("#13251f"), M.hex("#0e1e1b"),
		M.hex("#173429")]
	var tw: int = M.js_round(28.0 * k)
	var th: int = M.js_round(20.0 * k)
	var ty: int = -1
	while float(ty) * float(th) < float(H + th):
		var off: float = float(ty & 1) * (float(tw) / 2.0)
		var tx: int = -1
		while float(tx) * float(tw) < float(W + tw):
			var x0: int = int(float(tx) * float(tw) + off)
			var y0: int = ty * th
			var tone: int = int(base[int(floor(M.hash_n(tx * 73 + ty * 131 + seed)
					* float(base.size())))])
			for j in range(th):
				L.raw_hline(x0, x0 + tw - 1, y0 + j, tone)
			L.raw_hline(x0, x0 + tw - 1, y0, M.hex("#1f3a30"))
			for j in range(th):
				L.raw_px(x0, y0 + j, M.hex("#1b3329"))
			L.raw_hline(x0, x0 + tw - 1, y0 + th - 1, int(M.P["k0"]))
			for j in range(th):
				L.raw_px(x0 + tw - 1, y0 + j, int(M.P["k0"]))
			for k2 in range(7):
				var px: int = x0 + 2 + int(floor(M.hash_n(tx * 5 + ty * 17 + k2 * 3)
						* float(tw - 4)))
				var py: int = y0 + 2 + int(floor(M.hash_n(tx * 11 + ty * 7 + k2 * 9)
						* float(th - 4)))
				L.raw_px(px, py, M.hex("#1e3d31") if M.hash_n(k2 + tx) > 0.5
						else int(M.P["k0"]))
			tx += 1
		ty += 1
	if stage < 2:
		return
	# moss & dark soil patches via noise dither
	for y in range(H):
		for x in range(W):
			var n: float = float(RNG.nz1((float(x) / k) * 0.11 + 3.0,
					(float(y) / k) * 0.11)) / 255.0
			var n2: float = float(RNG.nz2((float(x) / k) * 0.3,
					(float(y) / k) * 0.3)) / 255.0
			var b: float = float(M.BAYER[((y & 3) << 2) | (x & 3)]) / 16.0
			if n > 0.62 and n2 + b * 0.5 > 0.8:
				L.raw_px(x, y, M.hex("#143a2a"))
			elif n < 0.25 and n2 + b * 0.4 > 0.9:
				L.raw_px(x, y, M.hex("#0b1713"))
			if n > 0.72 and n2 > 0.58 and b > 0.65:
				L.raw_px(x, y, M.hex("#1c5238"))
	if stage < 3:
		return
	# cracks
	var cracks: int = int(floor(float(W * H) / (12000.0 * k * k)))
	for _k2 in range(cracks):
		var x: float = r.range(0.0, float(W))
		var y: float = r.range(0.0, float(H))
		var a: float = r.range(0.0, M.TAU)
		# The original `for (let i = 0; i < (r.int(40) + 25) * k; i++)` re-evaluates
		# the bound EVERY iteration, so `r.int(40)` burns one RNG draw per step
		# (including the final failing check). Hoisting it changes the stream and
		# therefore every crack path, so the condition is kept inline.
		var i: int = 0
		while float(i) < float((r.int_n(40) + 25) * int(k)):
			L.raw_px(M.js_round(x), M.js_round(y), int(M.P["k0"]))
			if i % 5 == 0:
				L.raw_px(M.js_round(x) + 1, M.js_round(y) + 1, M.hex("#1f3a30"))
			a += r.range(-0.45, 0.45)
			x += cos(a)
			y += sin(a)
			i += 1
	if stage < 4:
		return
	# faint central alchemical sigil
	var cx: float = float(W) / 2.0
	var cy: float = float(H) / 2.0
	var rr: float = minf(float(W), float(H)) * 0.34
	var rune: int = M.hex("#1d4a3b")
	var rune2: int = M.hex("#16372c")
	_rune_ring(L, cx, cy, rr, rune2)
	_rune_ring(L, cx, cy, rr - 6.0 * k, rune)
	_rune_ring(L, cx, cy, rr * 0.55, rune2)
	for i in range(12):
		var a2: float = (float(i) / 12.0) * M.TAU
		var x0f: float = cx + cos(a2) * (rr - 6.0 * k)
		var y0f: float = cy + sin(a2) * (rr - 6.0 * k)
		var x1f: float = cx + cos(a2 + 0.5) * rr * 0.55
		var y1f: float = cy + sin(a2 + 0.5) * rr * 0.55
		var steps2: int = int(ceil(sqrt((x1f - x0f) * (x1f - x0f) + (y1f - y0f) * (y1f - y0f))))
		if steps2 <= 0:
			continue
		var s2: int = 0
		while s2 <= steps2:
			L.raw_px(M.js_round(x0f + ((x1f - x0f) * float(s2)) / float(steps2)),
					M.js_round(y0f + ((y1f - y0f) * float(s2)) / float(steps2)), rune2)
			s2 += 2
	if stage < 5:
		return
	# stepped vignette at the screen edges
	for y in range(H):
		for x in range(W):
			var e: float = minf(float(x), minf(float(y), minf(float(W - 1 - x),
					float(H - 1 - y))))
			if e < 14.0 * k:
				var b3: float = float(M.BAYER[((y & 3) << 2) | (x & 3)])
				if b3 > (e / k) + 3.0:
					L.raw_px(x, y, int(M.P["k0"]))


static func _rune_ring(L, cx: float, cy: float, r: float, c: int) -> void:
	var ri: int = int(ceil(r))
	for dy in range(-ri, ri + 1):
		var wo: int = int(floor(sqrt(maxf(0.0, pow(r + 0.35, 2.0) - float(dy * dy)))))
		L.raw_px(int(cx) - wo, int(cy) + dy, c)
		L.raw_px(int(cx) + wo, int(cy) + dy, c)


# ---------------------------------------------------------------------------
# Liquid shading passes (original Field.shade / Field.vapor)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# volumetric vapour puff (original `puff()` from fx.ts)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# volumetric vapour
# ---------------------------------------------------------------------------

static func puff(L, cx: float, cy: float, r: float, ramp: Array, dl: float,
		t: float, seed: int, outline: bool = false) -> void:
	var k: float = L.k
	var gcx: int = M.js_round(cx * k)
	var gcy: int = M.js_round(cy * k)
	var gr: float = r * k
	var ri: int = int(ceil(gr))
	var R: float = gr + 0.4
	var sd: int = L.dl
	for dy in range(-ri, ri + 1):
		for dx in range(-ri, ri + 1):
			var q: float = (float(dx * dx) + float(dy * dy)) / (R * R)
			if q > 1:
				continue
			var gx: int = gcx + dx
			var gy: int = gcy + dy
			var wx: float = float(gx) / k
			var wy: float = float(gy) / k
			var n: float = float(RNG.nz1(wx * 0.22 + float(seed) * 7 + t * 2.2,
					wy * 0.22 + t * 1.3)) / 255.0
			var n2: float = float(RNG.nz2(wx * 0.5 - t * 3 + float(seed), wy * 0.5)) / 255.0
			var s: float = -(float(dx) / R) * 0.55 - (float(dy) / R) * 0.65 \
					+ (n - 0.5) * 0.9 + (n2 - 0.5) * 0.3 - q * 0.3
			var idx: int = 0 if s < -0.45 else (1 if s < -0.05 else (2 if s < 0.38 else 3))
			var keep: float = dl * (1 - q * q * 0.75) + (n2 - 0.5) * 4
			if M.BAYER[((gy & 3) << 2) | (gx & 3)] >= keep:
				continue
			L.dl = 16
			L.raw_px(gx, gy, ramp[0] if outline and q > 0.8 else ramp[mini(idx, ramp.size() - 1)])
	L.dl = sd
