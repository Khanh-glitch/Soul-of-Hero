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
	var seconds: float = fade_in_seconds if want > level else fade_out_seconds
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
		var item: Object = _targets[i]
		if not is_instance_valid(item):
			continue
		var b: Color = _base[i]
		(item as CanvasItem).modulate = Color(b.r * m, b.g * m, b.b * m, b.a)
	_touched = true


func _apply_base() -> void:
	if not _touched:
		return
	for i in range(_targets.size()):
		var item: Object = _targets[i]
		if is_instance_valid(item):
			(item as CanvasItem).modulate = _base[i]
	_touched = false
