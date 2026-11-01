extends RefCounted
## A text report of one rendered frame, printed into the CI log.
##
## Why this exists: the native capture runs on a runner whose PNGs this project
## cannot download back (`gh run download` fails at the blob host), so for a long
## time the only frames anyone could *look* at were offline Pillow composites of
## the atlas — supporting evidence, not proof that Godot drew the world. A frame
## that is 1280x720 and non-blank can still be a wall, a sky, or four tiles
## magnified ten times; three capture bugs were exactly that.
##
## So the capture describes what it rendered, in text, in the log:
##
##   OVERWORLD LOOK <station> colours=<n> flat=<pct> mean=<l> std=<s> top=<palette>
##   OVERWORLD MAP <station> <row> <32-character luminance map>
##
## The numbers catch the failure modes that matter:
##   colours  - a handful means the camera is looking at one flat surface
##   flat     - share of the frame taken by its single most common colour
##   std      - luminance spread; ~0 means an empty frame
##   map      - the composition, dark to light, at 32x16
##
## The map is optional evidence for a human eye, and the numbers are the part a
## gate can use. Nothing here writes files or touches the scene tree, so it can
## also be pointed at any PNG offline (tools/captures/frame_report_probe.gd).

const RAMP := " .:-=+*#%@"
const COLS := 32
const ROWS := 16
const SAMPLE_STEP := 3
## Luminance delta that counts as an edge between neighbouring samples.
const EDGE_DELTA := 0.04


## Pack a colour into 4 bits per channel: 4096 buckets, a step of 16 per channel.
##
## Three bits was the first attempt and it lied: `rock` (92,92,108) and `stone`
## (100,102,120) are two different materials on screen, but a 36-step bucket
## merged them, so a plaza of rock paving with flagstone plazas around it
## measured as "58pct one colour" when it was really two stones plus mortar. A
## ruler that flatters the art is as bad as one that flatters the code.
const BITS := 4
const LEVELS := (1 << BITS) - 1
const STEP := 256 >> BITS


static func _bucket(colour: Color) -> int:
	var r := int(clampf(colour.r, 0.0, 1.0) * float(LEVELS))
	var g := int(clampf(colour.g, 0.0, 1.0) * float(LEVELS))
	var b := int(clampf(colour.b, 0.0, 1.0) * float(LEVELS))
	return (r << (BITS * 2)) | (g << BITS) | b


static func _hex(bucket: int) -> String:
	var r := (bucket >> (BITS * 2)) & LEVELS
	var g := (bucket >> BITS) & LEVELS
	var b := bucket & LEVELS
	return "%02x%02x%02x" % [r * STEP, g * STEP, b * STEP]


static func stats(image: Image) -> Dictionary:
	var width := image.get_width()
	var height := image.get_height()
	var cell_w := maxi(1, width / COLS)
	var cell_h := maxi(1, height / ROWS)
	var means := PackedFloat32Array()
	means.resize(COLS * ROWS)
	var counts := {}
	var sampled := 0
	# Edge density: how often a sampled pixel differs from its left neighbour.
	# `flat` alone turned out to be the wrong ruler for "does this surface have
	# structure" - it punishes large coherent patches, which are exactly what
	# makes weathered stone read as stone rather than noise. A flat fill has
	# edges near zero; paving with joints, grain and rubble sits well above it.
	var compared := 0
	var edges := 0
	for gy in ROWS:
		for gx in COLS:
			var total := 0.0
			var n := 0
			var y := gy * cell_h
			var y_end := mini(height, y + cell_h)
			while y < y_end:
				var x := gx * cell_w
				var x_end := mini(width, x + cell_w)
				var previous := -1.0
				while x < x_end:
					var colour := image.get_pixel(x, y)
					var luminance := colour.get_luminance()
					total += luminance
					var key := _bucket(colour)
					counts[key] = int(counts.get(key, 0)) + 1
					sampled += 1
					n += 1
					if previous >= 0.0:
						compared += 1
						if absf(luminance - previous) > EDGE_DELTA:
							edges += 1
					previous = luminance
					x += SAMPLE_STEP
				y += SAMPLE_STEP
			means[gy * COLS + gx] = total / float(maxi(1, n))

	var mean := 0.0
	for value in means:
		mean += value
	mean /= float(means.size())
	var variance := 0.0
	for value in means:
		variance += (value - mean) * (value - mean)
	variance /= float(means.size())

	var sorted_keys := counts.keys()
	sorted_keys.sort_custom(func(a, b): return int(counts[a]) > int(counts[b]))
	var palette: Array[String] = []
	for i in mini(4, sorted_keys.size()):
		var key := int(sorted_keys[i])
		palette.append("%s:%d" % [_hex(key), int(round(100.0 * int(counts[key]) / float(maxi(1, sampled))))])
	var flat := 0.0
	if not sorted_keys.is_empty():
		flat = 100.0 * int(counts[sorted_keys[0]]) / float(maxi(1, sampled))

	var rows := PackedStringArray()
	for gy in ROWS:
		var line := ""
		for gx in COLS:
			var value: float = means[gy * COLS + gx]
			var index := int(clampf(value, 0.0, 0.999) * float(RAMP.length()))
			line += RAMP[index]
		rows.append(line)

	var edge_share := 0.0
	if compared > 0:
		edge_share = 100.0 * float(edges) / float(compared)

	return {
		"colours": counts.size(),
		"edges": edge_share,
		"flat": flat,
		"mean": mean,
		"spread": sqrt(variance),
		"palette": palette,
		"map": rows,
	}


static func report(image: Image, station: String) -> void:
	var info := stats(image)
	# No '%' anywhere in the output: the CI annotation carries these lines through
	# a % -> %25 escape, and a stray sign there is one more thing to get wrong.
	print("OVERWORLD LOOK %s colours=%d edges=%dpct flat=%dpct mean=%.3f std=%.3f top=%s" % [
		station, int(info["colours"]), int(round(float(info["edges"]))),
		int(round(float(info["flat"]))),
		float(info["mean"]), float(info["spread"]),
		",".join(PackedStringArray(info["palette"])),
	])
	var rows: PackedStringArray = info["map"]
	for index in rows.size():
		print("OVERWORLD MAP %s %02d %s" % [station, index, rows[index]])
