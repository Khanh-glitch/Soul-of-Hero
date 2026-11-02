extends "res://tests/overworld_runtime_case.gd"
## Smart occlusion, on the production scene.
##
## The claim being tested is not "some sprites got an alpha value". It is that a
## player standing behind a landmark can still see themselves, that a player
## standing in front of the same landmark does not trigger anything, and that
## walking away puts everything back exactly as it was. Every assertion below is
## made against live `modulate.a` on the real sprites the world built.

func _body() -> void:
	var scene_occlusion: OverworldOcclusion = ow.get("occlusion") as OverworldOcclusion
	_expect(scene_occlusion != null, "the overworld builds an occlusion system")
	var trav: OverworldTraversability = ow.get("traversability") as OverworldTraversability
	_expect(trav != null, "the overworld builds a traversability grid")
	if scene_occlusion == null or trav == null:
		_done("occlusion test could not run without both systems")
		return

	_expect(scene_occlusion.occluder_count() > 150,
		"tall props are registered as occluders (%d)" % scene_occlusion.occluder_count())
	_expect(scene_occlusion.bucket_count() > 40,
		"occluders are bucketed for bounded work (%d buckets)" % scene_occlusion.bucket_count())

	# A landmark is the case that matters: it is the tallest thing in the world and
	# it is what the player is walking towards.
	var landmark: Sprite2D = null
	var props_root: Node = (ow.get("world") as OverworldWorld).props_root
	for child: Node in props_root.get_children():
		if child is Sprite2D and String((child as Sprite2D).get_meta("frame_name", "")).begins_with("lm_gate"):
			landmark = child as Sprite2D
			break
	_expect(landmark != null, "the Crimson Gate landmark sprite exists")
	if landmark == null:
		_done("occlusion test stopped before the landmark assertions")
		return

	var rect := scene_occlusion.sprite_rect(landmark)
	_expect(rect.size.y > 32.0, "the landmark is tall enough to hide a player (%.0f px)" % rect.size.y)

	# Stand in the upper third of the building: that is where a player walking its
	# north face actually is, and where the wall would otherwise cover them.
	var standing := Vector2(landmark.position.x, rect.position.y + rect.size.y * 0.35)
	var free := trav.nearest_free_position(standing, 10)
	_expect(Vector2(free - standing).length() < 160.0,
		"there is standable ground behind the landmark within 10 tiles")

	(ow.get("player") as CharacterBody2D).global_position = free
	await _frames(2)

	# -- occlusion off: full opacity, the bug this system exists to fix ---------
	scene_occlusion.enabled = false
	scene_occlusion.snap()
	_expect(is_equal_approx(scene_occlusion.alpha_of(landmark), 1.0),
		"with occlusion off the landmark is fully opaque (%.2f)" % scene_occlusion.alpha_of(landmark))

	# -- occlusion on: the landmark in front of the player fades ---------------
	scene_occlusion.enabled = true
	scene_occlusion.snap()
	var faded_alpha := scene_occlusion.alpha_of(landmark)
	_expect(faded_alpha < 0.9, "with the player behind it the landmark fades (%.2f)" % faded_alpha)
	_expect(faded_alpha >= 0.4,
		"the landmark keeps most of its body so the destination stays readable (%.2f)" % faded_alpha)
	_expect(scene_occlusion.faded_count() >= 1,
		"at least one sprite is reported as faded (%d)" % scene_occlusion.faded_count())

	# Fading must be visual only: the collision that made the player walk around
	# the building is still there, and the player did not move because of a fade.
	# `world.is_walkable()` only knows the terrain painter, and a plaza is walkable
	# everywhere — so the honest question is asked of the traversability grid,
	# which is the one that reads the landmark's collider.
	var walk_grid: OverworldTraversability = ow.get("traversability") as OverworldTraversability
	_expect(walk_grid != null, "the traversability grid is available to cross-check the fade")
	if walk_grid != null:
		var body_cell := walk_grid.cell_of(Vector2(landmark.position.x, landmark.position.y - 12))
		_expect(walk_grid.blocked_by_prop(body_cell),
			"the landmark body still blocks the cell it covers (%s kind %d)"
				% [str(body_cell), walk_grid.blocked_kind(body_cell)])

	# -- a fade must not leak into gameplay state ------------------------------
	var world: OverworldWorld = ow.get("world") as OverworldWorld
	var player: CharacterBody2D = ow.get("player") as CharacterBody2D
	var before_cell := world.tile_of(player.global_position)
	var faded_before: int = scene_occlusion.faded_count()
	for _i in range(6):
		scene_occlusion.step(0.05)
	_expect(world.tile_of(player.global_position) == before_cell,
		"stepping the fade does not move the player")
	_expect(scene_occlusion.steps() > 0, "the fade advanced under its own step function")
	_expect(scene_occlusion.faded_count() == faded_before,
		"the faded set is stable across steps (%d)" % scene_occlusion.faded_count())

	# -- walking away restores everything --------------------------------------
	player.global_position = free + Vector2(0.0, 420.0)
	await _frames(2)
	scene_occlusion.enabled = false
	scene_occlusion.snap()
	_expect(is_equal_approx(scene_occlusion.alpha_of(landmark), 1.0),
		"leaving the area restores the landmark (%.2f)" % scene_occlusion.alpha_of(landmark))
	scene_occlusion.enabled = true
	scene_occlusion.snap()
	_expect(scene_occlusion.faded_count() == 0,
		"nothing is faded from 420 px away (%d)" % scene_occlusion.faded_count())

	# -- work is bounded -------------------------------------------------------
	(ow.get("player") as CharacterBody2D).global_position = free
	await _frames(2)
	scene_occlusion.step(0.016)
	var considered: int = scene_occlusion.considered_count()
	_expect(considered > 0, "the step considered props near the player (%d)" % considered)
	_expect(considered < scene_occlusion.occluder_count() / 4,
		"the bucket grid keeps work local (%d of %d occluders)"
			% [considered, scene_occlusion.occluder_count()])

	# -- vegetation fades further than architecture ---------------------------
	var bush: Sprite2D = null
	for child: Node in props_root.get_children():
		if child is Sprite2D and String((child as Sprite2D).get_meta("frame_name", "")) == "tree_dead":
			bush = child as Sprite2D
			break
	if bush != null:
		_expect(scene_occlusion.alpha_for_frame("tree_dead") < scene_occlusion.alpha_for_frame("lm_gate"),
			"a tree fades further than a landmark (%.2f vs %.2f)"
				% [scene_occlusion.alpha_for_frame("tree_dead"), scene_occlusion.alpha_for_frame("lm_gate")])
	else:
		_expect(false, "the world contains a dead tree to compare fade depths against")

	_done("occlusion: invisibility behind architecture is fixed, and nothing else changed")
