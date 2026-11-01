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
## Whole-sprite alpha is not enough once a prop is large. Fading the Crimson Gate
## to 62 % also fades the contact shadow at its feet, and the building starts to
## look like it has been deleted rather than moved behind. So the fade is
## *selective*: a small canvas shader keeps the bottom `base_keep` fraction of the
## sprite fully opaque - plinth, shadow, threshold - and fades only the part drawn
## over the player, with a soft ramp at the boundary. The cut follows the player's
## height, so a player standing at the foot of the wall sees the wall fade from
## their shoulders up, not from the ground.
##
## Fading is visual only. Collision layers, positions and save state are untouched,
## and the runtime test asserts all three.
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

## How much of the sprite's height stays fully opaque, by kind: the base of a
## building has to survive or it reads as lifted off the ground.
const KEEP_LANDMARK := 0.24
const KEEP_ARCHITECTURE := 0.30
const KEEP_VEGETATION := 0.0      # a canopy can fade to the trunk and no further
const KEEP_DEFAULT := 0.22

const FADE_SHADER := preload("res://game/overworld/occlusion_fade.gdshader")

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
var _materials := {}                    # Sprite2D -> ShaderMaterial
var _extra_focus: Array[Node2D] = []    # enemies, summons: anything that must stay visible
## Whether occluder rects are computed in global space. The overworld builds every
## prop directly under one root, so local == global there; a dungeon nests its props
## under a y-sorted entity root inside a placed level, so local is not global.
var _global_space := false
var _stepped := 0
var _last_faded := 0
var _last_considered := 0


## Bind to a built world. Safe to call again after the world rebuilds.
func configure(world: OverworldWorld, player: Node2D) -> void:
	release_materials()
	_global_space = false
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


## Reuse the system on *any* scene whose obstacles are whole sprites.
##
## The Hollow Marches builds its props directly under one root, so its local and
## global space coincide. A Chapter 1 dungeon does not: it nests whole-sprite
## architecture under a y-sorted entity root that is itself placed in the level.
## This entry point takes a root to scan and a focus to keep visible, works in
## global space, and touches nothing but `material` on the sprites it fades -
## no collision, no node moves, no gameplay state.
func configure_sprites(root: Node, focus: Node2D) -> void:
	release_materials()
	_world = null
	_player = focus
	_global_space = true
	_buckets.clear()
	_occluders.clear()
	_fading.clear()
	_target_alpha.clear()
	_current.clear()
	if root == null:
		return
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if not node is Sprite2D:
			continue
		var sprite := node as Sprite2D
		if sprite.texture == null:
			continue
		if sprite.texture.get_size().y < MIN_OCCLUDER_HEIGHT:
			continue
		if sprite.z_index < 0:
			continue
		_occluders.append(sprite)
		_current[sprite] = 1.0
		_target_alpha[sprite] = 1.0
		var key := bucket_of(sprite.global_position)
		if not _buckets.has(key):
			_buckets[key] = []
		_buckets[key].append(sprite)


## Keep another character visible too. The Knight is not the only thing whose
## feet matter: an enemy or a summon standing behind the same wall has exactly the
## same problem, and a fade that only protects the player makes combat unreadable.
func add_focus(node: Node2D) -> void:
	if node != null and not _extra_focus.has(node):
		_extra_focus.append(node)


func clear_focus() -> void:
	_extra_focus.clear()


func focus_count() -> int:
	return _extra_focus.size() + (1 if _player != null else 0)


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
	# The value the shader was last handed, not `modulate.a`: with a selective fade
	# the sprite's modulate stays at 1 and the *upper body* is what fades, so the
	# old reading would have reported every prop as fully opaque.
	if not is_instance_valid(sprite):
		return 1.0
	return _current.get(sprite, 1.0)


## The sprite's on-screen rectangle, anchored where the author put its feet.
func sprite_rect(sprite: Sprite2D) -> Rect2:
	var size := sprite_size(sprite)
	var feet := sprite.global_position if _global_space else sprite.position
	return Rect2(feet.x - size.x * 0.5, feet.y - size.y, size.x, size.y)


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
	if _player == null or not is_instance_valid(_player):
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
	var considered := {}
	var centres: Array[Vector2i] = [bucket_of(feet)]
	for node: Node2D in _extra_focus:
		if node != null and is_instance_valid(node):
			centres.append(bucket_of(node.global_position))
	for centre: Vector2i in centres:
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
		_apply_fade(sprite, next)
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
	if _player == null or not is_instance_valid(_player):
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
		_apply_fade(sprite, want)
		if want < 1.0:
			_fading[sprite] = true
		else:
			_fading.erase(sprite)
	_last_faded = _fading.size()


func restore_all() -> void:
	for sprite: Sprite2D in _occluders:
		if not is_instance_valid(sprite):
			continue
		_apply_fade(sprite, 1.0)
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
			_apply_fade(sprite, 1.0)
			continue
		var next := move_toward(from, 1.0, delta / RESTORE_SECONDS)
		_current[sprite] = next
		_apply_fade(sprite, next)
		if is_equal_approx(next, 1.0):
			_fading.erase(sprite)


func _target_for(sprite: Sprite2D, rect: Rect2, feet: Vector2) -> float:
	if not is_instance_valid(sprite):
		return 1.0
	var faded: bool = _fading.has(sprite)
	var pad := EXIT_PAD if faded else ENTER_PAD
	var drawn := sprite_rect(sprite)
	# The player first, then anything else that has to stay visible (an enemy, a
	# summon). Overlapping occluders each get tested against each focus: two walls
	# in front of the Knight both fade, which is what a player expects.
	#
	# The radius test belongs to the *focus*, not to the player: a prop two hundred
	# pixels from an enemy standing behind it still hides that enemy, even when the
	# Knight is across the march. (Getting this wrong made the ally support look
	# like it worked in `focus_count()` and do nothing on screen.)
	if _hides(sprite, drawn, rect, feet, pad):
		return alpha_for_frame(frame_name(sprite))
	for node: Node2D in _extra_focus:
		if node == null or not is_instance_valid(node):
			continue
		var other_feet := node.global_position
		if sprite.global_position.distance_to(other_feet) > ACTIVE_RADIUS:
			continue
		var other := Rect2(other_feet.x - PLAYER_HALF_WIDTH, other_feet.y - PLAYER_HEIGHT,
			PLAYER_HALF_WIDTH * 2.0, PLAYER_HEIGHT)
		if _hides(sprite, drawn, other, other_feet, pad):
			return alpha_for_frame(frame_name(sprite))
	return 1.0


## Does this sprite stand in front of the given body rectangle, and is it close
## enough to that body to matter?
func _hides(sprite: Sprite2D, drawn: Rect2, body: Rect2, feet: Vector2, pad: float) -> bool:
	if sprite.global_position.distance_to(feet) > ACTIVE_RADIUS:
		return false
	# Behind the body: it is drawn first, so it cannot hide it.
	var sprite_feet_y := sprite.global_position.y if _global_space else sprite.position.y
	if sprite_feet_y < feet.y - 1.0:
		return false
	var probe := Rect2(body.position.x - pad, body.position.y - pad,
		body.size.x + pad * 2.0, body.size.y + pad * 2.0)
	return drawn.intersects(probe)


## How much of this sprite's height must stay solid while it is faded.
func base_keep_for(sprite: Sprite2D) -> float:
	var frame := frame_name(sprite)
	if frame.begins_with(LANDMARK_PREFIX):
		return KEEP_LANDMARK
	for prefix: String in VEGETATION_PREFIXES:
		if frame.begins_with(prefix):
			return KEEP_VEGETATION
	for prefix: String in ARCHITECTURE_PREFIXES:
		if frame.begins_with(prefix):
			return KEEP_ARCHITECTURE
	return KEEP_DEFAULT


## Push one alpha into the sprite. A sprite that is fully opaque gets its modulate
## back and keeps no material, so the common case costs nothing.
func _apply_fade(sprite: Sprite2D, alpha: float) -> void:
	if not is_instance_valid(sprite):
		return
	if is_equal_approx(alpha, 1.0):
		sprite.modulate.a = 1.0
		var existing: ShaderMaterial = _materials.get(sprite, null)
		if existing != null:
			existing.set_shader_parameter("fade_alpha", 1.0)
		return
	var material: ShaderMaterial = _material_for(sprite)
	if material == null:
		return
	material.set_shader_parameter("fade_alpha", alpha)
	material.set_shader_parameter("base_keep", base_keep_for(sprite))


func _material_for(sprite: Sprite2D) -> ShaderMaterial:
	var cached: ShaderMaterial = _materials.get(sprite, null)
	if cached != null and is_instance_valid(sprite) and sprite.material == cached:
		return cached
	var material := ShaderMaterial.new()
	material.shader = FADE_SHADER
	sprite.material = material
	_materials[sprite] = material
	return material


## The material currently fading a sprite, for tests and for the capture.
func material_of(sprite: Sprite2D) -> ShaderMaterial:
	return _materials.get(sprite, null)


## Clear every shader material this system installed. Used when the world is rebuilt.
func release_materials() -> void:
	for sprite: Sprite2D in _materials.keys():
		if is_instance_valid(sprite):
			sprite.material = null
	_materials.clear()


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
