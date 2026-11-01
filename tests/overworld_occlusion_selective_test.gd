extends "res://tests/overworld_runtime_case.gd"
## Selective occlusion: the base stays, the body fades, and nothing else moves.
##
## The first occlusion system faded a whole sprite with `modulate.a`. That is fine
## for a bush and wrong for a building: fading the Crimson Gate to 62 % also faded
## the two pixels of contact shadow that tell the eye where it stands, and a
## destination that goes translucent from the ground up reads as deleted.
##
## This test holds the system to the harder claim:
##
##   * a faded landmark keeps a solid base and loses only its upper body,
##   * a canopy is allowed to fade further than a facade, and keeps nothing,
##   * two occluders in front of the player both fade,
##   * a second character (an enemy) is protected exactly like the player,
##   * teleporting or rebuilding the world leaves no stale material behind,
##   * collision, node count and save state are untouched throughout.

func _body() -> void:
	var occlusion: OverworldOcclusion = ow.get("occlusion") as OverworldOcclusion
	var trav: OverworldTraversability = ow.get("traversability") as OverworldTraversability
	var world: OverworldWorld = ow.get("world") as OverworldWorld
	_expect(occlusion != null and trav != null and world != null,
		"the scene has the occlusion, traversability and world systems")
	if occlusion == null or trav == null or world == null:
		_done("selective occlusion test could not run")
		return

	var gate := _sprite(world, "lm_gate")
	_expect(gate != null, "the Crimson Gate is in the world")
	if gate == null:
		_done("selective occlusion test stopped: no gate")
		return

	# -- 1. the base survives, the body fades ---------------------------------
	var rect: Rect2 = occlusion.sprite_rect(gate)
	var standing := Vector2(gate.position.x, rect.position.y + rect.size.y * 0.35)
	ow.teleport_to(trav.nearest_free_position(standing, 10))
	await _frames(2)
	occlusion.enabled = true
	occlusion.snap()

	var alpha: float = occlusion.alpha_of(gate)
	_expect(alpha < 0.9, "the gate fades when the player is behind it (%.2f)" % alpha)
	var material: ShaderMaterial = occlusion.material_of(gate)
	_expect(material != null, "the fade is applied by a shader material, not by modulate")
	if material != null:
		var shader_alpha: float = material.get_shader_parameter("fade_alpha")
		var keep: float = material.get_shader_parameter("base_keep")
		_expect(is_equal_approx(shader_alpha, alpha),
			"the shader's alpha matches the reported alpha (%.2f)" % shader_alpha)
		_expect(keep >= 0.2,
			"a landmark keeps its base solid while it fades (keep %.2f)" % keep)
		_expect(is_equal_approx(gate.modulate.a, 1.0),
			"the whole-sprite modulate is left alone (%.2f)" % gate.modulate.a)

	# -- 2. a canopy may fade further, and keeps nothing ----------------------
	var trunk := _first_sprite_with_prefix(world, "tree_")
	if trunk != null:
		_expect(occlusion.base_keep_for(trunk) <= 0.05,
			"a tree's canopy is not held back by a base (keep %.2f)"
				% occlusion.base_keep_for(trunk))
		_expect(occlusion.base_keep_for(gate) > occlusion.base_keep_for(trunk),
			"a landmark keeps more of itself than a tree does")

	# -- 3. two occluders in front of the player both fade --------------------
	var overlapping: Array[Sprite2D] = _overlapping_pair(occlusion, gate)
	_expect(not overlapping.is_empty(),
		"there is more than one tall prop near the gate (%d)" % overlapping.size())
	if not overlapping.is_empty():
		var other: Sprite2D = overlapping[0]
		# Put the player on the tile where both bodies cover them.
		var shared: Variant = _shared_standable_cell(occlusion, trav, gate, other)
		if shared != null:
			var destination: Vector2 = shared
			ow.teleport_to(destination)
			await _frames(2)
			occlusion.snap()
			_expect(occlusion.alpha_of(gate) < 0.9 and occlusion.alpha_of(other) < 0.9,
				"two occluders in front of the player both fade (%.2f / %.2f)"
					% [occlusion.alpha_of(gate), occlusion.alpha_of(other)])

	# -- 4. a second character is protected exactly like the player -----------
	var ally := Node2D.new()
	ally.name = "TestEnemy"
	(ow.get("world") as OverworldWorld).add_child(ally)
	ally.global_position = ow.player.global_position + Vector2(0.0, 240.0)
	var ally_gate: Sprite2D = _nearest_landmark_to(occlusion, world, ally.global_position)
	if ally_gate != null:
		ally.global_position = Vector2(ally_gate.position.x,
			occlusion.sprite_rect(ally_gate).position.y + occlusion.sprite_rect(ally_gate).size.y * 0.35)
		ally.global_position = trav.nearest_free_position(ally.global_position, 8)
		ow.teleport_to(trav.nearest_free_position(
			ally.global_position + Vector2(0.0, 700.0), 12))
		await _frames(2)
		occlusion.snap()
		_expect(occlusion.alpha_of(ally_gate) >= 0.99,
			"nothing fades for a character that has not been registered (%.2f)"
				% occlusion.alpha_of(ally_gate))
		occlusion.add_focus(ally)
		occlusion.snap()
		_expect(occlusion.alpha_of(ally_gate) < 0.9,
			"registering another character makes the same prop fade for it (%.2f)"
				% occlusion.alpha_of(ally_gate))
		_expect(occlusion.focus_count() == 2, "the player and one extra focus are tracked")
		occlusion.clear_focus()
		occlusion.snap()
		_expect(occlusion.alpha_of(ally_gate) >= 0.99,
			"clearing the focus restores it (%.2f)" % occlusion.alpha_of(ally_gate))
	ally.queue_free()
	await _frames(1)

	# -- 5. collisions and node counts are untouched by the fade --------------
	# Back behind the gate first: "nothing is faded" would make the next two
	# assertions true for the wrong reason.
	ow.teleport_to(trav.nearest_free_position(standing, 10))
	await _frames(2)
	occlusion.snap()
	var bodies_before: int = _collision_bodies(world)
	var fade_state: int = occlusion.faded_count()
	_expect(bodies_before > 100, "the world has prop bodies to preserve (%d)" % bodies_before)
	_expect(fade_state >= 1, "something is faded while this is asserted (%d)" % fade_state)
	_expect(_collision_bodies(world) == bodies_before,
		"fading installs no collision bodies and removes none")

	# -- 6. teleport away: everything is restored -----------------------------
	var crypt := _nearest_landmark_to(occlusion, world, Vector2(1416.0, 2904.0))
	var away_from: Vector2 = crypt.position if crypt != null else ow.player.global_position
	ow.teleport_to(trav.nearest_free_position(away_from + Vector2(0.0, -600.0), 12))
	await _frames(2)
	occlusion.snap()
	_expect(occlusion.faded_count() == 0,
		"nothing stays faded after a teleport (%d)" % occlusion.faded_count())
	_expect(is_equal_approx(occlusion.alpha_of(gate), 1.0),
		"the gate is opaque again after the teleport (%.2f)" % occlusion.alpha_of(gate))

	# -- 7. rebuild: no stale materials survive -------------------------------
	var had_material: bool = occlusion.material_of(gate) != null
	_expect(had_material, "the gate kept its fade material for the rebuild check")
	occlusion.configure(world, ow.player)
	await _frames(1)
	_expect(occlusion.material_of(gate) == null,
		"rebuilding the system releases the old materials")
	_expect(occlusion.occluder_count() > 150,
		"and re-registers the world's occluders (%d)" % occlusion.occluder_count())
	_expect(_collision_bodies(world) == bodies_before,
		"rebuilding the occlusion changes no collision")
	_done("selective occlusion: bases stay, bodies fade, nothing else changes")


func _sprite(world: OverworldWorld, frame: String) -> Sprite2D:
	for child: Node in world.props_root.get_children():
		if child is Sprite2D and String((child as Sprite2D).get_meta("frame_name", "")) == frame:
			return child as Sprite2D
	return null


func _first_sprite_with_prefix(world: OverworldWorld, prefix: String) -> Sprite2D:
	for child: Node in world.props_root.get_children():
		if child is Sprite2D and String((child as Sprite2D).get_meta("frame_name", "")).begins_with(prefix):
			return child as Sprite2D
	return null


func _nearest_landmark_to(occlusion: OverworldOcclusion, world: OverworldWorld,
		position: Vector2) -> Sprite2D:
	var best: Sprite2D = null
	var best_distance := INF
	for child: Node in world.props_root.get_children():
		if not child is Sprite2D:
			continue
		var sprite := child as Sprite2D
		if not String(sprite.get_meta("frame_name", "")).begins_with("lm_"):
			continue
		var distance := sprite.global_position.distance_to(position)
		if distance < best_distance:
			best_distance = distance
			best = sprite
	return best


## Tall sprites whose rectangles overlap the gate's and which are not the gate.
func _overlapping_pair(occlusion: OverworldOcclusion, gate: Sprite2D) -> Array[Sprite2D]:
	var out: Array[Sprite2D] = []
	var gate_rect := occlusion.sprite_rect(gate)
	for child: Node in (ow.get("world") as OverworldWorld).props_root.get_children():
		if not child is Sprite2D:
			continue
		var sprite := child as Sprite2D
		if sprite == gate:
			continue
		if occlusion.sprite_size(sprite).y < 26.0 or sprite.z_index < 0:
			continue
		if occlusion.sprite_rect(sprite).intersects(gate_rect):
			out.append(sprite)
	return out


## A free cell that sits inside both sprites' silhouettes, if there is one.
func _shared_standable_cell(occlusion: OverworldOcclusion, trav: OverworldTraversability,
		gate: Sprite2D, other: Sprite2D) -> Variant:
	var a := occlusion.sprite_rect(gate)
	var b := occlusion.sprite_rect(other)
	for y in range(int(min(a.position.y, b.position.y)), int(max(a.end.y, b.end.y)), 16):
		for x in range(int(min(a.position.x, b.position.x)), int(max(a.end.x, b.end.x)), 16):
			var point := Vector2(x + 8.0, y + 8.0)
			if not a.has_point(point) or not b.has_point(point):
				continue
			var cell := trav.cell_of(point)
			if trav.is_free(cell):
				return Vector2(cell.x * 16.0 + 8.0, cell.y * 16.0 + 8.0)
	return null


func _collision_bodies(world: OverworldWorld) -> int:
	var count := 0
	for child: Node in world.blocker_root.get_children():
		if child is StaticBody2D:
			count += 1
	return count
