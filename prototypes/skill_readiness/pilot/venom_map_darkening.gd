extends RefCounted

## Host-only presentation: darkens the MAP while a major skill is active.
##
## Scope (by construction, not by filtering):
##   - It only changes `modulate` of the CanvasItems passed to `attach()`. The
##     real map passes its backdrop, geometry and decor tile layers. The Knight,
##     enemies, HUD, text, the venom VFX, glow, particles and hit flashes are not
##     attached, so they are never darkened.
##   - It multiplies RGB by `1 - strength * level` and leaves alpha alone, so
##     the original palette, geometry, timing and identity are kept.
##   - It is not part of the source-native parity renderer. Nothing in the
##     native raster or the GOLD hashes depends on it.
##
## Timing (sim-time, driven by `step(delta)`):
##   - level moves toward 1 while any owner is requesting darkening, using the
##     fade-in time; toward 0 when no owner requests it, using the fade-out time.
##   - Overlapping casts share one level and one owner set, so a second cast
##     starting while the first is still fading never restarts or flickers it.
##   - `enabled = false` (the Lab OFF setting for A/B) fades an active darkening
##     out and then leaves the targets exactly at their original modulate.
##   - `restore()` returns every target to its original modulate immediately.

const DEFAULT_STRENGTH: float = 0.12
const MIN_STRENGTH: float = 0.0
const MAX_STRENGTH: float = 0.25
const FADE_IN_SECONDS: float = 0.12
const FADE_OUT_SECONDS: float = 0.20

var enabled: bool = true
var strength: float = DEFAULT_STRENGTH
var fade_in_seconds: float = FADE_IN_SECONDS
var fade_out_seconds: float = FADE_OUT_SECONDS
## 0 = original, 1 = fully darkened by `strength`.
var level: float = 0.0

var _targets: Array = []
var _base: Array = []
var _owners: Dictionary = {}
var _touched: bool = false


## Attach the presentation targets (map layers only). Their current modulate is
## remembered as the original and restored exactly on `restore()`.
func attach(items: Array) -> void:
	restore()
	_targets.clear()
	_base.clear()
	for item in items:
		if item is CanvasItem:
			_targets.append(item)
			_base.append((item as CanvasItem).modulate)


func set_strength(value: float) -> void:
	strength = clampf(value, MIN_STRENGTH, MAX_STRENGTH)


## Gate 8 policy, pure: 0 at/below threshold, else the attenuation that would
## bring the baseline to the target luminance, capped.
static func adaptive_attenuation(mean_linear_luminance: float,
		threshold: float = ADAPTIVE_THRESHOLD, target: float = ADAPTIVE_TARGET,
		max_attenuation: float = ADAPTIVE_MAX_ATTENUATION) -> float:
	if mean_linear_luminance <= threshold:
		return 0.0
	var desired: float = 1.0 - target / maxf(0.00001, mean_linear_luminance)
	return clampf(desired, 0.0, max_attenuation)


## Strength actually applied at full level. Fixed mode: `strength`.
## Adaptive mode: Gate 8 policy on the sampled baseline (0 until sampled).
func effective_strength() -> float:
	if adaptive:
		if baseline_luminance < 0.0:
			return 0.0
		return minf(adaptive_attenuation(baseline_luminance), adaptive_cap)
	return strength


## Sample the PRE-FX map frame (call before any Gold FX is composited):
## mean sRGB->linear luminance over `roi` (full frame when empty), strided.
func sample_baseline(frame: Image, roi: Rect2i = Rect2i(), stride: int = 5) -> float:
	if frame == null:
		return baseline_luminance
	var r: Rect2i = roi if roi.size.x > 0 and roi.size.y > 0 else Rect2i(0, 0, frame.get_width(), frame.get_height())
	var x0: int = clampi(r.position.x, 0, frame.get_width())
	var y0: int = clampi(r.position.y, 0, frame.get_height())
	var x1: int = clampi(r.end.x, 0, frame.get_width())
	var y1: int = clampi(r.end.y, 0, frame.get_height())
	var step: int = maxi(1, stride)
	var total: float = 0.0
	var count: int = 0
	var y: int = y0
	while y < y1:
		var x: int = x0
		while x < x1:
			var lc: Color = frame.get_pixel(x, y).srgb_to_linear()
			total += lc.r * 0.2126 + lc.g * 0.7152 + lc.b * 0.0722
			count += 1
			x += step
		y += step
	baseline_samples = count
	baseline_luminance = total / float(count) if count > 0 else 0.0
	return baseline_luminance


## Bind authored scenery by node name under `level` (Gate 8 coverage:
## Backdrop/Geometry/Decor/CrucibleArt + optional parallax `background`).
## Entities, Knight, enemies and HUD are structurally excluded: they are not
## in MAP_NODE_NAMES and `level` itself is never attached.
func attach_by_names(level: Node, background: CanvasItem = null) -> int:
	var items: Array = []
	if level != null:
		for node_name in MAP_NODE_NAMES:
			var item = level.get_node_or_null(NodePath(node_name))
			if item is CanvasItem:
				items.append(item)
	if background != null:
		items.append(background)
	attach(items)
	return items.size()


## Owner-keyed request. Each active cast passes its own key; darkening stays on
## while at least one owner requests it.
func request(owner_key: String, active: bool) -> void:
	if active:
		_owners[owner_key] = true
	else:
		_owners.erase(owner_key)


func is_requested() -> bool:
	return not _owners.is_empty()


func target_count() -> int:
	return _targets.size()


## Current darkening multiplier applied to RGB (1.0 = original).
func multiplier() -> float:
	return 1.0 - strength * level


## Advance the presentation by `delta` seconds and apply it to the targets.
func step(delta: float) -> void:
	var want: float = 1.0 if (enabled and not _owners.is_empty()) else 0.0
	if level == want:
		if want == 0.0 and _touched:
			_apply_base()
		return
	var fi: float = ADAPTIVE_FADE_IN_SECONDS if adaptive else fade_in_seconds
	var fo: float = ADAPTIVE_FADE_OUT_SECONDS if adaptive else fade_out_seconds
	var seconds: float = fi if want > level else fo
	if seconds <= 0.0:
		level = want
	else:
		level = move_toward(level, want, maxf(delta, 0.0) / seconds)
	if level <= 0.0:
		_apply_base()
	else:
		_apply_level()


## Immediate return to the original modulate and no active request.
func restore() -> void:
	_owners.clear()
	level = 0.0
	_apply_base()


func _apply_level() -> void:
	var m: float = multiplier()
	for i in range(_targets.size()):
		var item = _targets[i]
		if not is_instance_valid(item):
			continue
		var b: Color = _base[i]
		(item as CanvasItem).modulate = Color(b.r * m, b.g * m, b.b * m, b.a)
	_touched = true


func _apply_base() -> void:
	if not _touched:
		return
	for i in range(_targets.size()):
		var item = _targets[i]
		if is_instance_valid(item):
			(item as CanvasItem).modulate = _base[i]
	_touched = false
