extends SceneTree
## A0 guarded production controller + actual pinned A1 visual bundle.
## Headless proves mounting/ownership/collision invariants only: not visuals,
## y-sort, walkability of a full player route, or product acceptance.
const SaveDiff = preload("res://tests/fixtures/a0_save_diff.gd")
const ART_HOST = preload("res://game/survival/a0_world_art_candidate.gd")
const SCENE := "res://game/overworld/chapter1_overworld.tscn"
var checks := 0
var failures := 0
var host: Node

func _initialize() -> void:
	_run.call_deferred()

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok: failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _count_collisions(node: Node) -> int:
	var count := 1 if node is CollisionObject2D else 0
	for child: Node in node.get_children():
		count += _count_collisions(child)
	return count

func _boot() -> Node:
	host = Node2D.new()
	root.add_child(host)
	var scene := load(SCENE) as PackedScene
	if scene == null: return null
	var ow := scene.instantiate()
	host.add_child(ow)
	ow.call(&"configure", {})
	var deadline := Time.get_ticks_msec() + 90000
	while Time.get_ticks_msec() < deadline and not bool(ow.call(&"is_world_ready")) and String(ow.get(&"build_error")).is_empty():
		await process_frame
	if not bool(ow.call(&"is_world_ready")):
		print("A1_ART_BUILD_ERROR ", ow.get(&"build_error"))
		return null
	return ow

func _dispose() -> void:
	if is_instance_valid(host): host.queue_free()
	await process_frame
	await process_frame

func _run() -> void:
	var save := root.get_node("SaveService")
	var path := "user://tests/a1_art_candidate_%d.json" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	_expect(bool(save.call(&"configure_storage", path, true)), "isolated real SaveService")
	ProjectSettings.set_setting("survival/a0_waystation_candidate", true)
	ProjectSettings.set_setting("survival/a0_world_art_candidate", false)
	var baseline := await _boot()
	_expect(baseline != null, "guarded Waystation controller boots without art")
	if baseline == null:
		_finish(); return
	_expect(baseline.get_node_or_null("A1RoadsidePresentation") == null, "art candidate defaults off")
	var baseline_count := _count_collisions(baseline)
	var baseline_gates: Dictionary = baseline.get(&"gates")
	_expect(baseline_gates.size() == 10, "baseline retains ten existing gates")
	await _dispose()
	# Overworld teardown may legitimately persist player state. Compare the art
	# build with the actual post-teardown generation, not its earlier snapshot.
	var before: Dictionary = save.call(&"get_snapshot")
	ProjectSettings.set_setting("survival/a0_world_art_candidate", true)
	var ow := await _boot()
	_expect(ow != null, "actual controller mounts explicit A1 visual candidate")
	if ow == null:
		_finish(); return
	var art := ow.get_node_or_null("A1RoadsidePresentation") as Node2D
	var hero := ow.get(&"player") as CharacterBody2D
	_expect(art != null, "source-pinned roadside presentation exists")
	_expect(hero != null and hero.get_parent().name == "Entities", "Hero keeps original parent and owner lifecycle")
	_expect(hero != null and hero.light_mask == 1, "Hero retains original VFX lighting mask")
	var lights := art.get_node_or_null("WarmLights") if art != null else null
	var lights_isolated := lights != null
	if lights != null:
		for light: Node in lights.get_children():
			lights_isolated = lights_isolated and light is PointLight2D and (light as PointLight2D).range_item_cull_mask == 2
	_expect(lights_isolated, "A1 lamps use only private world-art light mask")
	_expect(art != null and art.global_transform == Transform2D.IDENTITY, "A1 absolute-cell art uses canonical zero transform")
	_expect((ow.get(&"gates") as Dictionary).size() == 10, "all ten existing gates remain")
	_expect(_count_collisions(ow) == baseline_count and art != null and _count_collisions(art) == 0, "presentation adds no physics body or area")
	var ground := art.get_node_or_null("Ground") as TileMapLayer if art != null else null
	_expect(ground != null and ground.tile_set != null and ground.tile_set.get_physics_layers_count() == 0, "visual ground has no physics layers")
	_expect(ow.get_node_or_null("WaystationRuntime") != null, "existing physical Waystation host remains mounted")
	var after: Dictionary = save.call(&"get_snapshot")
	SaveDiff.report("a1-art-pre-vs-post-build", before, after)
	_expect(after == before, "visual mount writes no inventory, clock, state or receipt")
	var duplicate: Dictionary = ART_HOST.mount(ow, hero)
	_expect(not bool(duplicate.get("ok", false)) and String(duplicate.get("reason", "")) == "already_mounted", "duplicate visual mount rejected")
	var invalid_world := Node2D.new()
	invalid_world.position = Vector2(16, 0)
	root.add_child(invalid_world)
	var transformed: Dictionary = ART_HOST.mount(invalid_world, hero)
	_expect(not bool(transformed.get("ok", false)) and String(transformed.get("reason", "")) == "noncanonical_world_transform", "noncanonical art transform rejected")
	invalid_world.queue_free()
	var missing: Dictionary = ART_HOST.mount(null, hero)
	_expect(not bool(missing.get("ok", false)), "missing production owner fails closed")
	await _dispose()
	_finish()

func _finish() -> void:
	ProjectSettings.set_setting("survival/a0_waystation_candidate", false)
	ProjectSettings.set_setting("survival/a0_world_art_candidate", false)
	print("A0 A1 WORLD ART CANDIDATE %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
