class_name VenomPixel
extends RefCounted

const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const RNG = preload("res://prototypes/skill_readiness/native/venom/venom_rng.gd")
const P: Dictionary = M.P

## Native port of the ORIGINAL Venomwright `src/game/pixel.ts`.
##
## Every function below is transcribed 1:1 from the recovered original
## TypeScript, including its exact JavaScript numeric semantics:
##   * `Math.round` rounds halves toward +Infinity -> `floor(v + 0.5)`,
##   * every packed colour is `0xAABBGGRR` stored as an unsigned 32-bit word,
##   * `>>`, `>>>`, `<<`, `|`, `^` and `Math.imul` are 32-bit operations.
## Deviating from any of these changes the raster byte-for-byte, so the helpers
## here are the single place where that semantics is implemented.
##
## The raster is a PackedByteArray in little-endian RGBA8 order, which is
## bit-identical to the original `Uint32Array` view on x86-64.

class Layer extends RefCounted:
	var bytes: PackedByteArray
	var W: int = 0
	var H: int = 0
	var k: float = 1.0
	var a: int = 255
	var dl: int = 16
	var add: bool = false

	func _init(w: int = 600, h: int = 340, k_: float = 1.0) -> void:
		W = w
		H = h
		k = k_
		bytes = PackedByteArray()
		bytes.resize(w * h * 4)

	func reset() -> Layer:
		a = 255
		dl = 16
		add = false
		return self

	func clear(c: int = 0xFF000000) -> void:
		var r: int = c & 255
		var g: int = (c >> 8) & 255
		var b: int = (c >> 16) & 255
		var i: int = 0
		var n: int = W * H
		# Writing four bytes per pixel keeps the layout identical to the
		# original Uint32Array view.
		while i < n:
			var o: int = i * 4
			bytes[o] = r
			bytes[o + 1] = g
			bytes[o + 2] = b
			bytes[o + 3] = 255
			i += 1

	func copy_from(other: Layer) -> void:
		bytes = other.bytes.duplicate()

	func raw_px(gx: int, gy: int, c: int) -> void:
		if gx < 0 or gy < 0 or gx >= W or gy >= H:
			return
		if dl < 16 and M.BAYER[((gy & 3) << 2) | (gx & 3)] >= dl:
			return
		var i: int = (gy * W + gx) * 4
		if add:
			var cr: int = c & 255
			var cg: int = (c >> 8) & 255
			var cb: int = (c >> 16) & 255
			var r: int = int(bytes[i]) + ((cr * a) >> 8)
			var g: int = int(bytes[i + 1]) + ((cg * a) >> 8)
			var b: int = int(bytes[i + 2]) + ((cb * a) >> 8)
			if r > 255:
				r = 255
			if g > 255:
				g = 255
			if b > 255:
				b = 255
			bytes[i] = r
			bytes[i + 1] = g
			bytes[i + 2] = b
			bytes[i + 3] = 255
		elif a == 255:
			bytes[i] = c & 255
			bytes[i + 1] = (c >> 8) & 255
			bytes[i + 2] = (c >> 16) & 255
			bytes[i + 3] = 255
		else:
			var ia: int = 255 - a
			var cr2: int = c & 255
			var cg2: int = (c >> 8) & 255
			var cb2: int = (c >> 16) & 255
			bytes[i] = int(float(cr2 * a + int(bytes[i]) * ia) / 255.0)
			bytes[i + 1] = int(float(cg2 * a + int(bytes[i + 1]) * ia) / 255.0)
			bytes[i + 2] = int(float(cb2 * a + int(bytes[i + 2]) * ia) / 255.0)
			bytes[i + 3] = 255

	func px(x: float, y: float, c: int) -> void:
		var gx: int = M.js_round(x * k)
		var gy: int = M.js_round(y * k)
		raw_px(gx, gy, c)
		if k >= 1.8:
			raw_px(gx + 1, gy, c)
			raw_px(gx, gy + 1, c)
			raw_px(gx + 1, gy + 1, c)

	func dot(x: float, y: float, c: int) -> void:
		raw_px(M.js_round(x * k), M.js_round(y * k), c)

	func raw_hline(x0: int, x1: int, y: int, c: int) -> void:
		if not (y >= 0 and y < H) or not (x0 <= x1):
			return
		if x0 < 0:
			x0 = 0
		if x1 >= W:
			x1 = W - 1
		if x0 > x1:
			return
		if a == 255 and dl == 16 and not add:
			var r: int = c & 255
			var g: int = (c >> 8) & 255
			var b: int = (c >> 16) & 255
			var base: int = (y * W + x0) * 4
			for i in range(x1 - x0 + 1):
				var o: int = base + i * 4
				bytes[o] = r
				bytes[o + 1] = g
				bytes[o + 2] = b
				bytes[o + 3] = 255
			return
		for x in range(x0, x1 + 1):
			raw_px(x, y, c)

	func hline(x0: float, x1: float, y: float, c: int) -> void:
		var gy: int = M.js_round(y * k)
		var gx0: int = M.js_round(x0 * k)
		var gx1: int = M.js_round(x1 * k)
		var sz: int = maxi(1, M.js_round(k))
		for j in range(sz):
			raw_hline(gx0, gx1, gy + j, c)

	func rect(x: float, y: float, w: float, h: float, c: int) -> void:
		var gx: int = M.js_round(x * k)
		var gy: int = M.js_round(y * k)
		var gw: int = maxi(1, M.js_round(w * k))
		var gh: int = maxi(1, M.js_round(h * k))
		for j in range(gh):
			raw_hline(gx, gx + gw - 1, gy + j, c)

	func disc(cx: float, cy: float, r: float, c: int) -> void:
		var gcx: int = M.js_round(cx * k)
		var gcy: int = M.js_round(cy * k)
		var gr: float = r * k
		var R: float = gr + 0.35
		var ri: int = int(ceil(gr))
		for dy in range(-ri, ri + 1):
			var w: int = int(floor(sqrt(maxf(0.0, R * R - float(dy * dy)))))
			raw_hline(gcx - w, gcx + w, gcy + dy, c)

	func ellipse(cx: float, cy: float, rx: float, ry: float, c: int) -> void:
		var gcx: int = M.js_round(cx * k)
		var gcy: int = M.js_round(cy * k)
		var grx: float = rx * k
		var gry: float = ry * k
		var RY: float = gry + 0.35
		var iy: int = int(ceil(gry))
		for dy in range(-iy, iy + 1):
			var q: float = 1.0 - float(dy * dy) / (RY * RY)
			if q < 0.0:
				continue
			var w: int = int(floor((grx + 0.35) * sqrt(q)))
			raw_hline(gcx - w, gcx + w, gcy + dy, c)

	func ring(cx: float, cy: float, r: float, w: float, c: int) -> void:
		var gcx: int = M.js_round(cx * k)
		var gcy: int = M.js_round(cy * k)
		var gr: float = r * k
		var gw: float = maxf(1.0, w * k)
		var ro: float = gr + 0.35
		var rin: float = maxf(0.0, gr - gw + 0.35)
		var ri: int = int(ceil(gr))
		for dy in range(-ri, ri + 1):
			var wo: int = int(floor(sqrt(maxf(0.0, ro * ro - float(dy * dy)))))
			var tt: float = rin * rin - float(dy * dy) - 0.01
			if absf(float(dy)) < rin and tt > 0.0:
				var wi: int = int(floor(sqrt(tt)))
				raw_hline(gcx - wo, gcx - wi - 1, gcy + dy, c)
				raw_hline(gcx + wi + 1, gcx + wo, gcy + dy, c)
			else:
				raw_hline(gcx - wo, gcx + wo, gcy + dy, c)

	func arc(cx: float, cy: float, r: float, w: float, a0: float, a1: float,
			c: int, ry: float = -1.0) -> int:
		if ry < 0.0:
			ry = r
		var gcx: int = M.js_round(cx * k)
		var gcy: int = M.js_round(cy * k)
		var gr: float = r * k
		var gry: float = ry * k
		var gw: float = maxf(1.0, w * k)
		var ri: int = int(ceil(gr))
		var span: float = fmod(a1 - a0, M.TAU)
		span = fmod(span + M.TAU, M.TAU)
		if span == 0.0:
			span = M.TAU
		var steps: int = maxi(12, int(ceil(span * maxf(gr, gry) * 1.4)))
		for i in range(steps + 1):
			var ang: float = a0 + (span * float(i)) / float(steps)
			var x: float = float(gcx) + cos(ang) * gr
			var y: float = float(gcy) + sin(ang) * gry
			if gw <= 1.2:
				raw_px(M.js_round(x), M.js_round(y), c)
			else:
				var rad: float = gw / 2.0 - 0.2
				var rri: int = int(ceil(rad))
				for dy in range(-rri, rri + 1):
					var ww: int = int(floor(sqrt(maxf(0.0, rad * rad - float(dy * dy)))))
					raw_hline(M.js_round(x) - ww, M.js_round(x) + ww, M.js_round(y) + dy, c)
		return ri

	func line(x0: float, y0: float, x1: float, y1: float, c: int, w: float = 1.0) -> void:
		var gx0: int = M.js_round(x0 * k)
		var gy0: int = M.js_round(y0 * k)
		var gx1: int = M.js_round(x1 * k)
		var gy1: int = M.js_round(y1 * k)
		var gw: int = maxi(1, M.js_round(w * k))
		var dx: int = absi(gx1 - gx0)
		var dy: int = -absi(gy1 - gy0)
		var sx: int = 1 if gx0 < gx1 else -1
		var sy: int = 1 if gy0 < gy1 else -1
		var err: int = dx + dy
		var n: int = 0
		while true:
			if gw <= 1:
				raw_px(gx0, gy0, c)
			elif gw <= 2:
				raw_px(gx0, gy0, c)
				raw_px(gx0 + 1, gy0, c)
				raw_px(gx0, gy0 + 1, c)
				raw_px(gx0 + 1, gy0 + 1, c)
			else:
				var rad: float = float(gw) / 2.0 - 0.2
				var rri: int = int(ceil(rad))
				for j in range(-rri, rri + 1):
					var ww: int = int(floor(sqrt(maxf(0.0, rad * rad - float(j * j)))))
					raw_hline(gx0 - ww, gx0 + ww, gy0 + j, c)
			if gx0 == gx1 and gy0 == gy1:
				break
			var e2: int = 2 * err
			if e2 >= dy:
				err += dy
				gx0 += sx
			if e2 <= dx:
				err += dx
				gy0 += sy
			n += 1
			if n > 2400:
				break

	func poly(pts: Array, c: int) -> void:
		var gpts: Array = []
		for i in range(0, pts.size(), 2):
			gpts.append(float(pts[i]) * k)
			gpts.append(float(pts[i + 1]) * k)
		var n: int = gpts.size() / 2
		if n < 3:
			return
		var mn: float = 1e9
		var mx: float = -1e9
		for i in range(n):
			var y: float = gpts[i * 2 + 1]
			if y < mn:
				mn = y
			if y > mx:
				mx = y
		var xs: Array = []
		var yy: int = int(ceil(mn - 0.5))
		var yend: int = int(floor(mx - 0.5))
		while yy <= yend:
			var ys: float = float(yy) + 0.5
			xs.clear()
			for i in range(n):
				var j: int = (i + 1) % n
				var ay: float = gpts[i * 2 + 1]
				var by: float = gpts[j * 2 + 1]
				if (ay <= ys and ys < by) or (by <= ys and ys < ay):
					xs.append(gpts[i * 2] + ((ys - ay) / (by - ay)) * (gpts[j * 2] - gpts[i * 2]))
			xs.sort()
			var q: int = 0
			while q + 1 < xs.size():
				raw_hline(int(ceil(xs[q] - 0.5)), int(ceil(xs[q + 1] - 0.5)) - 1, yy, c)
				q += 2
			yy += 1

	func tri(ax: float, ay: float, bx: float, by: float, cx: float, cy: float, c: int) -> void:
		poly([ax, ay, bx, by, cx, cy], c)


# ---------------------------------------------------------------------------
# Field — signed distance field used by every liquid / vapour pass
# ---------------------------------------------------------------------------

class Field extends RefCounted:
	var h: PackedFloat32Array
	var W: int = 0
	var H: int = 0
	var k: float = 1.0
	var x0: int = 1000000000
	var y0: int = 1000000000
	var x1: int = -1
	var y1: int = -1

	func _init(w: int = 600, h_: int = 340, k_: float = 1.0) -> void:
		W = w
		H = h_
		k = k_
		self.h = PackedFloat32Array()
		self.h.resize(w * h_)

	func reset() -> void:
		if x1 < 0:
			return
		for y in range(y0, y1 + 1):
			var base: int = y * W
			for x in range(x0, x1 + 1):
				self.h[base + x] = 0.0
		x0 = 1000000000
		y0 = 1000000000
		x1 = -1
		y1 = -1

	func _box(a: float, b: float, c: float, d: float) -> bool:
		a = maxf(2.0, floor(a))
		b = maxf(2.0, floor(b))
		c = minf(float(W - 3), ceil(c))
		d = minf(float(H - 3), ceil(d))
		var ai: int = int(a)
		var bi: int = int(b)
		var ci: int = int(c)
		var di: int = int(d)
		if ai > ci or bi > di:
			return false
		if ai < x0:
			x0 = ai
		if bi < y0:
			y0 = bi
		if ci > x1:
			x1 = ci
		if di > y1:
			y1 = di
		return true

	func disc(cx: float, cy: float, r: float, goo: float = 0.0) -> void:
		var gx: float = cx * k
		var gy: float = cy * k
		var gr: float = r * k
		if gr <= 0.0 or not _box(gx - gr - 1.0, gy - gr - 1.0, gx + gr + 1.0, gy + gr + 1.0):
			return
		var xa: int = maxi(2, int(floor(gx - gr - 1.0)))
		var xb: int = mini(W - 3, int(ceil(gx + gr + 1.0)))
		var ya: int = maxi(2, int(floor(gy - gr - 1.0)))
		var yb: int = mini(H - 3, int(ceil(gy + gr + 1.0)))
		for y in range(ya, yb + 1):
			for x in range(xa, xb + 1):
				var dx: float = float(x) + 0.5 - gx
				var dy: float = float(y) + 0.5 - gy
				var v: float = gr - sqrt(dx * dx + dy * dy) + 0.5
				if v <= 0.0:
					continue
				var i: int = y * W + x
				var o: float = h[i]
				if goo != 0.0 and o > 0.0:
					h[i] = maxf(o, v) + goo * minf(o, v)
				elif v > o:
					h[i] = v

	func ellipse(cx: float, cy: float, rx: float, ry: float) -> void:
		var gx: float = cx * k
		var gy: float = cy * k
		var grx: float = rx * k
		var gry: float = ry * k
		if not _box(gx - grx - 1.0, gy - gry - 1.0, gx + grx + 1.0, gy + gry + 1.0):
			return
		var m: float = minf(grx, gry)
		var xa: int = maxi(2, int(floor(gx - grx - 1.0)))
		var xb: int = mini(W - 3, int(ceil(gx + grx + 1.0)))
		var ya: int = maxi(2, int(floor(gy - gry - 1.0)))
		var yb: int = mini(H - 3, int(ceil(gy + gry + 1.0)))
		for y in range(ya, yb + 1):
			for x in range(xa, xb + 1):
				var nx: float = (float(x) + 0.5 - gx) / grx
				var ny: float = (float(y) + 0.5 - gy) / gry
				var q: float = sqrt(nx * nx + ny * ny)
				var v: float = (1.0 - q) * m + 0.5
				if v > 0.0 and v > h[y * W + x]:
					h[y * W + x] = v

	func capsule(ax: float, ay: float, bx: float, by: float, ra: float, rb: float = -1.0) -> void:
		if rb < 0.0:
			rb = ra
		var gax: float = ax * k
		var gay: float = ay * k
		var gbx: float = bx * k
		var gby: float = by * k
		var gra: float = ra * k
		var grb: float = rb * k
		var mr: float = maxf(gra, grb)
		if mr <= 0.0 or not _box(minf(gax, gbx) - mr - 1.0, minf(gay, gby) - mr - 1.0,
				maxf(gax, gbx) + mr + 1.0, maxf(gay, gby) + mr + 1.0):
			return
		var vx: float = gbx - gax
		var vy: float = gby - gay
		var l2: float = vx * vx + vy * vy
		if l2 == 0.0:
			l2 = 1.0
		var xa: int = maxi(2, int(floor(minf(gax, gbx) - mr - 1.0)))
		var xb: int = mini(W - 3, int(ceil(maxf(gax, gbx) + mr + 1.0)))
		var ya: int = maxi(2, int(floor(minf(gay, gby) - mr - 1.0)))
		var yb: int = mini(H - 3, int(ceil(maxf(gay, gby) + mr + 1.0)))
		for y in range(ya, yb + 1):
			for x in range(xa, xb + 1):
				var pxx: float = float(x) + 0.5 - gax
				var pyy: float = float(y) + 0.5 - gay
				var t: float = M.clampf((pxx * vx + pyy * vy) / l2, 0.0, 1.0)
				var dx: float = pxx - vx * t
				var dy: float = pyy - vy * t
				var v: float = gra + (grb - gra) * t - sqrt(dx * dx + dy * dy) + 0.5
				if v > 0.0 and v > h[y * W + x]:
					h[y * W + x] = v
