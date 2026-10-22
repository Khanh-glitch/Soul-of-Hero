extends SceneTree

const SWORD: HeroDefinition = preload(
	"res://game/heroes/data/sword_hero.tres"
)


func _initialize() -> void:
	_capture.call_deferred()


func _capture() -> void:
	root.size = Vector2i(960, 540)
	var background_layer := CanvasLayer.new()
	background_layer.layer = -20
	root.add_child(background_layer)
	var background := ColorRect.new()
	background.size = Vector2(960.0, 540.0)
	background.color = Color("090b16")
	background_layer.add_child(background)

	var stage := Node2D.new()
	root.add_child(stage)
	var knight_scene := load(
		"res://game/characters/knight/knight.tscn"
	) as PackedScene
	var knight := knight_scene.instantiate()
	knight.global_position = Vector2(480.0, 300.0)
	stage.add_child(knight)
	await process_frame
	await physics_frame
	var manager := knight.call(&"get_hero_soul_manager") as HeroSoulManager
	manager.configure_team(knight, SWORD, null)
	manager.configure_combat_stats_from_save(
		{},
		SWORD.base_max_hp,
		SWORD.base_max_mana,
	)
	knight.call(&"request_action", "skill", Vector2(600.0, 300.0))
	knight.call(&"request_action", "attack", Vector2(600.0, 300.0))

	var captured := false
	var production_echo: SwordSoulEchoEffect
	for _frame: int in 120:
		await physics_frame
		for child: Node in stage.get_children():
			if not child is SwordSoulEchoEffect:
				continue
			production_echo = child as SwordSoulEchoEffect
			var visual := child.get_node_or_null("EchoVisual") as Node2D
			if visual == null or not visual.visible:
				continue
			await process_frame
			var image := root.get_texture().get_image()
			var output_path := ProjectSettings.globalize_path(
				"res://.artifacts/k_night_common_afterimage.png"
			)
			image.save_png(output_path)
			print("K-NIGHT VFX CAPTURE SAVED: %s" % output_path)
			captured = true
			break
		if captured:
			break
	if not captured:
		push_error("K-NIGHT VFX CAPTURE FAILED: afterimage never became visible")
		quit(1)
		return
	for _frame: int in 36:
		await physics_frame
	var movement_captured := false
	for _frame: int in 24:
		knight.global_position += Vector2(4.0, 0.0)
		await process_frame
		var movement_ghosts := production_echo.find_children(
			"MovementAfterimage",
			"AnimatedSprite2D",
			true,
			false,
		)
		if movement_ghosts.is_empty():
			continue
		var movement_image := root.get_texture().get_image()
		var movement_path := ProjectSettings.globalize_path(
			"res://.artifacts/k_night_movement_afterimages.png"
		)
		movement_image.save_png(movement_path)
		print("K-NIGHT MOVEMENT VFX CAPTURE SAVED: %s" % movement_path)
		movement_captured = true
		break
	if not movement_captured:
		push_error("K-NIGHT MOVEMENT VFX CAPTURE FAILED: movement ghosts never became visible")
		quit(1)
		return
	quit(0)
