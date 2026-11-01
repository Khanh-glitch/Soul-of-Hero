extends "res://tests/overworld_runtime_case.gd"
## The occlusion system, reused on a real Chapter 1 dungeon.
##
## The mission asks for the system to be reusable on a representative Chapter 1
## environment *without redesigning dungeon gameplay*. So this test does not touch
## the level: it loads the real `crypt_entrance.tscn`, lets the real Chapter 1 art
## layer build its prop set (`Chapter1EnvironmentArt.attach`), and then attaches the
## occlusion system to that scene through its generic entry point.
##
## What is asserted:
##
##   * the dungeon really has whole-sprite architecture to work with (the level's
##     own counter, not a guess),
##   * a prop standing in front of a character fades, and keeps a solid base,
##   * nothing in the level changed: same node count, same collision bodies, same
##     transform on every prop, no tile in the level edited,
##   * detaching restores every sprite to opaque.
##
## The point is the negative half. A visual system that "works" by moving the level
## around is not reusable, it is a redesign.

const LEVEL_SCENE := "res://game/levels/crypt_entrance.tscn"

var _level: Node2D


func _body() -> void:
	_level = await _load_level()
	_expect(_level != null, "the Chapter 1 level scene instantiates")
	if _level == null:
		_done("chapter 1 reuse test could not load the level")
		return

	var sprites := _tall_sprites(_level)
	_expect(sprites.size() >= 8,
		"the dungeon builds whole-sprite architecture to occlude (%d tall props)" % sprites.size())
	if sprites.is_empty():
		_done("chapter 1 reuse test stopped: the level has no tall props")
		return

	# A stand-in for a character: the level's own player node exists only once its
	# gameplay starts, and this test must not start it. A marker at the same height
	# uses the same body rectangle the real player would.
	var focus := Node2D.new()
	focus.name = "OcclusionFocus"
	_level.add_child(focus)

	# Pick the tallest prop and stand the focus inside its lower body, where a
	# player walking behind it would actually be.
	var tallest: Sprite2D = sprites[0]
	var best_height := 0.0
	for sprite: Sprite2D in sprites:
		if sprite.texture.get_size().y > best_height:
			best_height = sprite.texture.get_size().y
			tallest = sprite
	var rect := Rect2(tallest.global_position - Vector2(0.0, best_height), tallest.texture.get_size())
	focus.global_position = Vector2(rect.position.x + rect.size.x * 0.5,
		rect.position.y + rect.size.y * 0.6)

	var bodies_before := _collision_body_count(_level)
	var nodes_before := _node_count(_level)
	var sprites_before := _tall_sprites(_level).size()
	var tiles_before := _collision_tile_cells(_level)
	var transforms_before := _transform_fingerprint(_level)
	# A Chapter 1 dungeon's collision is *tiles*, not bodies: there are no
	# StaticBody2Ds in this level at all, which is exactly why a per-sprite visual
	# layer is safe to add to it. The assertion is that it stays that way.
	_expect(bodies_before == 0,
		"the dungeon's collision is tile-based, with no spawned bodies (%d)" % bodies_before)
	_expect(tiles_before > 0, "the level has collision tiles to leave alone (%d cells)" % tiles_before)
	_expect(tallest.material == null, "the prop starts with no fade material")

	var occlusion := OverworldOcclusion.new()
	occlusion.name = "ReusedOcclusion"
	_level.add_child(occlusion)
	occlusion.configure_sprites(_level, focus)
	_expect(occlusion.occluder_count() >= 8,
		"the system registers the dungeon's props (%d)" % occlusion.occluder_count())

	occlusion.enabled = true
	occlusion.snap()
	var alpha := occlusion.alpha_of(tallest)
	_expect(alpha < 0.95, "a prop in front of the character fades (%.2f)" % alpha)
	var material := occlusion.material_of(tallest)
	_expect(material != null, "the fade is applied through the shared shader material")
	if material != null:
		var keep: float = material.get_shader_parameter("base_keep")
		_expect(keep >= 0.15,
			"the prop's base stays solid in a dungeon too (keep %.2f)" % keep)

	# -- nothing about the level may change -----------------------------------
	_expect(_collision_body_count(_level) == bodies_before,
		"the occlusion adds no collision body to the dungeon (%d)" % bodies_before)
	_expect(_collision_tile_cells(_level) == tiles_before,
		"the occlusion edits no collision tile (%d cells)" % tiles_before)
	_expect(_tall_sprites(_level).size() == sprites_before,
		"the occlusion creates and removes no props (%d)" % sprites_before)
	# The system adds exactly one node - itself. Anything else means a visual layer
	# is building scene content behind the level's back.
	_expect(_node_count(_level) - nodes_before <= 1,
		"the occlusion adds at most one node (%d)" % (_node_count(_level) - nodes_before))
	_expect(_transform_fingerprint(_level) == transforms_before,
		"no prop moved (fingerprint %s)" % transforms_before.substr(0, 12))

	# -- detach restores everything ------------------------------------------
	occlusion.restore_all()
	_expect(is_equal_approx(occlusion.alpha_of(tallest), 1.0),
		"restoring puts the prop back to opaque (%.2f)" % occlusion.alpha_of(tallest))
	occlusion.release_materials()
	_expect(tallest.material == null, "releasing the system leaves no material on the prop")

	focus.queue_free()
	occlusion.queue_free()
	await _frames(2)
	_done("chapter 1 reuse: a dungeon prop fades for a character and the level is untouched")


func _load_level() -> Node2D:
	if not ResourceLoader.exists(LEVEL_SCENE):
		return null
	var packed := load(LEVEL_SCENE) as PackedScene
	if packed == null:
		return null
	var level := packed.instantiate() as Node2D
	if level == null:
		return null
	# Adding it to the tree runs the level's own `_ready`, which is what builds the
	# art through the real Chapter 1 presentation layer (kit props, lights, shadow).
	root.add_child(level)
	for _i in range(6):
		await process_frame
	return level


func _tall_sprites(root: Node) -> Array[Sprite2D]:
	var out: Array[Sprite2D] = []
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if not node is Sprite2D:
			continue
		var sprite := node as Sprite2D
		if sprite.texture == null or sprite.z_index < 0:
			continue
		if sprite.texture.get_size().y >= 26.0:
			out.append(sprite)
	return out


func _collision_body_count(root: Node) -> int:
	var count := 0
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if node is StaticBody2D:
			count += 1
	return count


## Cells in the level's tile layers that carry collision: the measure that matters
## in a tile-based dungeon.
func _collision_tile_cells(root: Node) -> int:
	var cells := 0
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if node is TileMapLayer:
			var layer := node as TileMapLayer
			var used := layer.get_used_cells()
			if layer.tile_set != null and layer.tile_set.get_physics_layers_count() > 0:
				cells += used.size()
	return cells


func _node_count(root: Node) -> int:
	var count := 0
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		count += 1
	return count


## A cheap fingerprint of every sprite's transform, so "no prop moved" is a
## measurement rather than an assurance.
func _transform_fingerprint(root: Node) -> String:
	var parts: Array[String] = []
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if node is Sprite2D or node is Node2D:
			var drawn := node as Node2D
			if node is Sprite2D:
				parts.append("%.1f,%.1f,%.1f" % [drawn.position.x, drawn.position.y, drawn.rotation])
	parts.sort()
	return str(parts.size()) + ":" + str(parts.hash())
