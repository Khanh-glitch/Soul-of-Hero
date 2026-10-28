class_name OverworldOcclusion
extends Node
## Smart occlusion for the Hollow Marches.
##
## The world is y-sorted: a landmark, a tree or a standing column whose feet are
## below the player's feet is drawn *after* the player, so walking along the north
## side of any building hides the Knight behind its wall. That is correct sorting
## and wrong legibility — the player loses sight of their own character at exactly
## the moment they are trying to walk into a door.
##
## A blind "fade everything in front" is the usual fix and it is worse than the
## problem: it also fades the fence post two tiles away, and it makes a landmark
## wash out while the player is still three tiles from it. What this class does
## instead:
##
##   * Only props that genuinely overlap the player's body rectangle are faded.
##     Overlap is tested against the sprite's real atlas rect, anchored at its
##     feet, so a tall tower with a narrow base does not fade for a player walking
##     past its empty corner.
##   * Only props drawn in front are faded (feet at or below the player's feet).
##     A prop behind the player never hides anything.
##   * Hysteresis: a prop enters the faded set on an inflated rectangle and only
##     leaves on a deflated one, so a player standing on the boundary does not make
##     it flicker.
##   * Fade depth depends on what is being hidden. A bush goes almost transparent;
##     a landmark keeps most of its body, because the player still needs to read
##     the destination they are walking into.
##   * Work is bounded: occluders are bucketed on a 128 px grid and only the
##     buckets around the player are visited.
##
## `snap()` resolves the alphas immediately, which is what the capture uses: a
## screenshot must not depend on how many frames of interpolation have elapsed.

## Sprites at least this tall can hide the player. A 16 px rock or a flat decal
## cannot, and fading it would only make the ground look unwell.
const MIN_OCCLUDER_HEIGHT := 26.0
## Only props this close to the player are considered at all.
const ACTIVE_RADIUS := 260.0
const BUCKET := 128.0
## Player body rectangle, measured up from the feet: the Knight's visual is about
## 15 px wide and 22 px tall, and the rectangle is deliberately a little larger so
## contact is caught a frame early rather than a frame late.
const PLAYER_HALF_WIDTH := 7.5
const PLAYER_HEIGHT := 20.0

const ENTER_PAD := 2.0
const EXIT_PAD := 5.0
const FADE_SECONDS := 0.12
const RESTORE_SECONDS := 0.18

## How much of a prop survives being in the way, by kind.
const ALPHA_DEFAULT := 0.42
const ALPHA_LANDMARK := 0.62
const ALPHA_VEGETATION := 0.30
const ALPHA_ARCHITECTURE := 0.50

const LANDMARK_PREFIX := "lm_"
const VEGETATION_PREFIXES := ["tree_", "bush"]
const ARCHITECTURE_PREFIXES := ["wall_stub", "column", "statue", "short_", "camp_", "cart", "sarcophagus"]

var enabled := true

var _world: OverworldWorld
var _player: Node2D
var _buckets := {}                      # Vector2i -> Array[Sprite2D]
var _occluders: Array[Sprite2D] = []
var _fading := {}                       # Sprite2D -> true
var _target_alpha := {}                 # Sprite2D -> float
var _current := {}                      # Sprite2D -> float
var _stepped := 0
var _last_faded := 0
var _last_considered := 0


## Bind to a built world. Safe to call again after the world rebuilds.
func configure(world: OverworldWorld, player: Node2D) -> void:
	_world = world
	_player = player
	_buckets.clear()
	_occluders.clear()
	_fading.clear()
	_target_alpha.clear()
	_current.clear()
	if world == null:
		return
	var root: Node = world.props_root
	if root == null:
		return
	for child: Node in root.get_children():
		if not child is Sprite2D:
			continue
		var sprite := child as Sprite2D
		var size := sprite_size(sprite)
		if size.y < MIN_OCCLUDER_HEIGHT:
			continue
		# Flat decals sit *under* the player by design (z_index -1) and can never
		# hide anything, so they are not occluders however large they are.
		if sprite.z_index < 0:
			continue
		_occluders.append(sprite)
		_current[sprite] = 1.0
		_target_alpha[sprite] = 1.0
		var key := bucket_of(sprite.position)
		if not _buckets.has(key):
			_buckets[key] = []
		_buckets[key].append(sprite)


func occluder_count() -> int:
	return _occluders.size()


func bucket_count() -> int:
	return _buckets.size()


## Sprites currently drawn below full opacity.
func faded_count() -> int:
	return _fading.size()


func faded_sprites() -> Array[Sprite2D]:
	var out: Array[Sprite2D] = []
	for sprite: Sprite2D in _fading.keys():
		if is_instance_valid(sprite):
			out.append(sprite)
	return out


func alpha_of(sprite: Sprite2D) -> float:
	if not is_instance_valid(sprite):
		return 1.0
	return sprite.modulate.a


## The sprite's on-screen rectangle, anchored where the author put its feet.
func sprite_rect(sprite: Sprite2D) -> Rect2:
	var size := sprite_size(sprite)
	return Rect2(sprite.position.x - size.x * 0.5, sprite.position.y - size.y, size.x, size.y)


func sprite_size(sprite: Sprite2D) -> Vector2:
	if sprite.texture == null:
		return Vector2.ZERO
	return sprite.texture.get_size()


func player_rect() -> Rect2:
	if _player == null or not is_instance_valid(_player):
		return Rect2()
	var feet := _player.global_position
	return Rect2(feet.x - PLAYER_HALF_WIDTH, feet.y - PLAYER_HEIGHT, PLAYER_HALF_WIDTH * 2.0, PLAYER_HEIGHT)


## Advance the fade one frame. Called by the overworld controller; a test may call
## it directly with a fixed delta.
func step(delta: float) -> void:
	if _world == null or _player == null or not is_instance_valid(_player):
		return
	if not enabled:
		_restore_all(delta)
		return
	_stepped += 1
	var rect := player_rect()
	var feet := _player.global_position
	# Buckets around the player only: the world holds thousands of props and the
	# fade cares about the handful within a screen.
	var radius_buckets := int(ceil(ACTIVE_RADIUS / BUCKET))
	var centre := bucket_of(feet)
	var considered := {}
	for by in range(-radius_buckets, radius_buckets + 1):
		for bx in range(-radius_buckets, radius_buckets + 1):
			var key := centre + Vector2i(bx, by)
			for sprite: Sprite2D in _buckets.get(key, []):
				if is_instance_valid(sprite):
					considered[sprite] = true

	# A prop that was faded but is no longer in range must still be restored.
	for sprite: Sprite2D in _fading.keys():
		if is_instance_valid(sprite):
			considered[sprite] = true

	for sprite: Sprite2D in considered.keys():
		if not is_instance_valid(sprite):
			_current.erase(sprite)
			_target_alpha.erase(sprite)
			_fading.erase(sprite)
			continue
		var want := _target_for(sprite, rect, feet)
		_target_alpha[sprite] = want
		var hiding := want < 1.0
		if hiding:
			_fading[sprite] = true
		else:
			_fading.erase(sprite)
		var from: float = _current.get(sprite, 1.0)
		var rate := FADE_SECONDS if want < from else RESTORE_SECONDS
		var next := move_toward(from, want, delta / maxf(rate, 0.001))
		_current[sprite] = next
		sprite.modulate.a = next
	_last_faded = _fading.size()
	_last_considered = considered.size()


## How many sprites the last `step()` looked at. The point of the bucket grid is
## that this is a small number next to `occluder_count()`, and a test can hold the
## system to that instead of to a wall-clock measurement.
func considered_count() -> int:
	return _last_considered


func steps() -> int:
	return _stepped


## Resolve every alpha immediately: the state a screenshot should show.
func snap() -> void:
	if _world == null or _player == null or not is_instance_valid(_player):
		return
	if not enabled:
		restore_all()
		return
	var rect := player_rect()
	var feet := _player.global_position
	for sprite: Sprite2D in _occluders:
		if not is_instance_valid(sprite):
			continue
		var want := _target_for(sprite, rect, feet)
		_target_alpha[sprite] = want
		_current[sprite] = want
		sprite.modulate.a = want
		if want < 1.0:
			_fading[sprite] = true
		else:
			_fading.erase(sprite)
	_last_faded = _fading.size()


func restore_all() -> void:
	for sprite: Sprite2D in _occluders:
		if not is_instance_valid(sprite):
			continue
		sprite.modulate.a = 1.0
		_current[sprite] = 1.0
		_target_alpha[sprite] = 1.0
	_fading.clear()
	_last_faded = 0


func _restore_all(delta: float) -> void:
	if _fading.is_empty():
		return
	for sprite: Sprite2D in _fading.keys():
		if not is_instance_valid(sprite):
			continue
		var from: float = _current.get(sprite, 1.0)
		if is_equal_approx(from, 1.0):
			sprite.modulate.a = 1.0
			continue
		var next := move_toward(from, 1.0, delta / RESTORE_SECONDS)
		_current[sprite] = next
		sprite.modulate.a = next
		if is_equal_approx(next, 1.0):
			_fading.erase(sprite)


func _target_for(sprite: Sprite2D, rect: Rect2, feet: Vector2) -> float:
	if not is_instance_valid(sprite):
		return 1.0
	if sprite.global_position.distance_to(feet) > ACTIVE_RADIUS:
		return 1.0
	# Behind the player: it is drawn first, so it cannot hide them.
	if sprite.position.y < feet.y - 1.0:
		return 1.0
	var faded: bool = _fading.has(sprite)
	var pad := EXIT_PAD if faded else ENTER_PAD
	var probe := Rect2(rect.position.x - pad, rect.position.y - pad, rect.size.x + pad * 2.0, rect.size.y + pad * 2.0)
	if not sprite_rect(sprite).intersects(probe):
		return 1.0
	return alpha_for_frame(frame_name(sprite))


## The frame a sprite is showing, read back from its name (`P_<n>_<frame>`) or,
## for swapped shortcut sprites, from the texture it now holds.
func frame_name(sprite: Sprite2D) -> String:
	# The world stamps the authored frame on every prop sprite; the node name
	# (`P_<n>_<frame>`) is the fallback for anything built without it.
	var stored := String(sprite.get_meta("frame_name", ""))
	if not stored.is_empty():
		return stored
	var node_name := String(sprite.name)
	var cut := node_name.find("_", 2)
	return node_name.substr(cut + 1) if cut > 0 else node_name


func alpha_for_frame(frame: String) -> float:
	if frame.begins_with(LANDMARK_PREFIX):
		return ALPHA_LANDMARK
	for prefix: String in ARCHITECTURE_PREFIXES:
		if frame.begins_with(prefix):
			return ALPHA_ARCHITECTURE
	for prefix: String in VEGETATION_PREFIXES:
		if frame.begins_with(prefix):
			return ALPHA_VEGETATION
	return ALPHA_DEFAULT


func bucket_of(position: Vector2) -> Vector2i:
	return Vector2i(floori(position.x / BUCKET), floori(position.y / BUCKET))
