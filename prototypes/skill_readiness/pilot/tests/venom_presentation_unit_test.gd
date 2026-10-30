extends SceneTree

## Unit gates for the 006/010 real-map presentation fix. Headless, no map needed.
##
##   A. Coverage raster (overlay only): unpainted pixels stay transparent, partial
##      draws accumulate coverage, additive light does not add coverage, and the
##      GOLD mode (cov = false) still writes alpha 255 everywhere.
##   B. Map darkening controller: OFF never touches the map, ON fades to exactly
##      the configured luminance and back, overlapping requests never flicker,
##      only attached targets change, and restore is bit-exact.
##
## Pass line: "GOLD93_VENOM_PRESENTATION_UNIT: PASS".

const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const DARKEN = preload("res://prototypes/skill_readiness/pilot/venom_map_darkening.gd")

var _failures: int = 0
var _checks: int = 0


func _check(ok: bool, label: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		print("GOLD93_VENOM_PRESENTATION_UNIT FAIL: " + label)


func _init() -> void:
	_test_coverage_raster()
	_test_darkening()
	var verdict: String = "PASS" if _failures == 0 else "FAIL"
	print("GOLD93_VENOM_PRESENTATION_UNIT: %s | checks %d | failures %d" % [verdict, _checks, _failures])
	quit(0 if _failures == 0 else 1)


func _alpha(L, x: int, y: int) -> int:
	return int(L.bytes[(y * L.W + x) * 4 + 3])


func _rgb(L, x: int, y: int) -> Array:
	var o: int = (y * L.W + x) * 4
	return [int(L.bytes[o]), int(L.bytes[o + 1]), int(L.bytes[o + 2])]


func _test_coverage_raster() -> void:
	# GOLD path: alpha stays 255 everywhere, even for partial and additive draws.
	var g = PX.Layer.new(4, 2, 1.0)
	g.clear(0xFF000000)
	g.reset()
	g.raw_px(0, 0, 0xFF00FF00)
	g.a = 70
	g.raw_px(1, 0, 0xFF00FF00)
	g.a = 255
	g.add = true
	g.a = 70
	g.raw_px(2, 0, 0xFF00FF00)
	g.reset()
	_check(_alpha(g, 0, 0) == 255 and _alpha(g, 1, 0) == 255 and _alpha(g, 2, 0) == 255 and _alpha(g, 3, 1) == 255,
		"GOLD mode alpha stays 255 (cov=false)")

	# Coverage path: transparent start.
	var L = PX.Layer.new(4, 2, 1.0)
	L.cov = true
	L.clear_transparent()
	L.reset()
	_check(_alpha(L, 3, 1) == 0 and _rgb(L, 3, 1) == [0, 0, 0], "clear_transparent gives RGBA 0")

	L.raw_px(0, 0, 0xFF00FF00)  # opaque green
	_check(_alpha(L, 0, 0) == 255 and _rgb(L, 0, 0) == [0, 255, 0], "opaque draw sets coverage 255")

	L.a = 70
	L.raw_px(1, 0, 0xFF00FF00)  # 27% coverage over empty
	L.reset()
	_check(_alpha(L, 1, 0) == 70, "partial draw over empty gives coverage == a (got %d)" % _alpha(L, 1, 0))
	_check(_rgb(L, 1, 0) == [0, 70, 0], "partial draw premultiplied RGB = colour * a (got %s)" % str(_rgb(L, 1, 0)))

	L.a = 70
	L.raw_px(1, 0, 0xFF00FF00)  # second partial draw accumulates coverage
	L.reset()
	var cov_after: int = _alpha(L, 1, 0)
	_check(cov_after > 110 and cov_after < 130, "stacked partial draws accumulate coverage (got %d)" % cov_after)

	L.add = true
	L.a = 255
	L.raw_px(2, 0, 0xFF101010)  # additive light on an empty pixel
	L.reset()
	_check(_alpha(L, 2, 0) == 0, "additive light does not add coverage")
	_check(_rgb(L, 2, 0) == [15, 15, 15], "additive light adds RGB on empty pixel, (16*255)>>8 = 15 (got %s)" % str(_rgb(L, 2, 0)))

	# Dithered draws leave holes (coverage 0), which is the point of the fix:
	# GOLD shows the ground there, the overlay shows the map there.
	L.dl = 0
	L.raw_px(3, 1, 0xFF00FF00)
	L.reset()
	_check(_alpha(L, 3, 1) == 0, "dithered-out pixel stays uncovered")


func _test_darkening() -> void:
	# Two fake map layers and one non-map item that must never change.
	var a := Node2D.new()
	var b := Node2D.new()
	var other := Node2D.new()
	a.modulate = Color(0.68, 0.73, 0.82, 1.0)
	b.modulate = Color(0.74, 0.78, 0.86, 1.0)
	other.modulate = Color(1, 1, 1, 0.5)
	var base_a: Color = a.modulate
	var base_b: Color = b.modulate

	var d = DARKEN.new()
	d.attach([a, b])
	_check(d.target_count() == 2, "attach keeps only the map targets")

	# OFF: no request ever changes the map (exact A/B baseline).
	d.enabled = false
	d.request("cast_1", true)
	for _i in range(60):
		d.step(1.0 / 60.0)
	_check(a.modulate == base_a and b.modulate == base_b, "OFF leaves the map exactly at original modulate")
	_check(other.modulate == Color(1, 1, 1, 0.5), "non-map item is never touched")

	# ON: fade in ~0.12 s to exactly (1 - 0.12) of RGB, alpha preserved.
	d.enabled = true
	d.request("cast_1", false)
	d.restore()
	d.request("cast_1", true)
	d.step(0.06)
	var mid: float = a.modulate.r
	_check(mid < base_a.r and mid > base_a.r * (1.0 - 0.12), "fade-in is partial at 60 ms (r=%f)" % mid)
	d.step(0.07)  # total 0.13 s > 0.12 s fade-in
	var expected_r: float = base_a.r * (1.0 - DARKEN.DEFAULT_STRENGTH)
	_check(absf(a.modulate.r - expected_r) < 0.0001, "full darkening is 12%% of RGB (got %f want %f)" % [a.modulate.r, expected_r])
	_check(absf(a.modulate.a - base_a.a) < 0.0001, "alpha is unchanged while darkened")
	_check(other.modulate == Color(1, 1, 1, 0.5), "non-map item still untouched while darkened")

	# Overlapping casts: a second owner joins, the first ends. No brightening.
	d.request("cast_2", true)
	var prev: float = a.modulate.r
	var no_flicker: bool = true
	d.request("cast_1", false)
	for _i in range(30):
		d.step(1.0 / 60.0)
		if a.modulate.r > prev + 0.000001:
			no_flicker = false
		prev = a.modulate.r
	_check(no_flicker, "overlapping cast keeps darkening monotonic (no flicker)")
	_check(absf(a.modulate.r - expected_r) < 0.0001, "still fully darkened while cast_2 is active")

	# Release the last owner: fade out ~0.20 s back to the exact original.
	d.request("cast_2", false)
	d.step(0.10)
	_check(a.modulate.r > base_a.r * (1.0 - 0.12) and a.modulate.r < base_a.r, "fade-out is partial at 100 ms")
	d.step(0.11)  # total 0.21 s > 0.20 s
	_check(a.modulate == base_a and b.modulate == base_b, "fade-out returns exactly to the original modulate")

	# (adaptive Gate 8 checks live in _test_adaptive_darkening below.)
	# Strength clamps and the Lab-adjustable value.
	d.set_strength(0.9)
	_check(absf(d.strength - DARKEN.MAX_STRENGTH) < 0.0001, "strength clamps to max")
	d.set_strength(0.10)
	d.request("cast_3", true)
	for _i in range(20):
		d.step(1.0 / 60.0)
	_check(absf(a.modulate.r - base_a.r * 0.90) < 0.0001, "Lab strength 10%% applies exactly")

	# Freed targets are skipped safely.
	b.free()
	d.step(1.0 / 60.0)
	_check(is_instance_valid(a), "freed target does not break the controller")

	d.restore()
	_check(a.modulate == base_a, "restore is exact and immediate")
	a.free()
	other.free()


func _test_adaptive_darkening() -> void:
	# Gate 8 policy (pure): dark baseline -> 0, bright baseline -> capped.
	_check(DARKEN.adaptive_attenuation(0.10) == 0.0, "adaptive: dark map (0.10) gets no darkening")
	_check(DARKEN.adaptive_attenuation(0.23) == 0.0, "adaptive: at threshold gets no darkening")
	var bright: float = DARKEN.adaptive_attenuation(0.44)
	_check(absf(bright - DARKEN.ADAPTIVE_MAX_ATTENUATION) < 0.0001, "adaptive: bright map (0.44) caps at max attenuation (got %f)" % bright)
	var mid: float = DARKEN.adaptive_attenuation(0.27)
	_check(mid > 0.39 and mid < 0.42, "adaptive: 0.27 luminance -> ~0.407 attenuation (got %f)" % mid)

	# Adaptive controller: unsampled baseline darkens nothing; after sampling a
	# bright baseline it reaches the policy strength and restores exactly.
	var a := Node2D.new()
	a.modulate = Color(0.74, 0.78, 0.86, 1.0)
	var base: Color = a.modulate
	var d = DARKEN.new()
	d.attach([a])
	d.adaptive = true
	_check(d.effective_strength() == 0.0, "adaptive: no baseline sampled -> no darkening")
	d.baseline_luminance = 0.44
	d.request("cast_a", true)
	for _i in range(30):
		d.step(1.0 / 60.0)
	var want: float = base.r * (1.0 - DARKEN.ADAPTIVE_MAX_ATTENUATION)
	_check(absf(a.modulate.r - want) < 0.0001, "adaptive: full level applies policy strength (got %f want %f)" % [a.modulate.r, want])
	d.request("cast_a", false)
	for _i in range(40):
		d.step(1.0 / 60.0)
	_check(a.modulate == base, "adaptive: fade-out restores exactly")
	a.free()
