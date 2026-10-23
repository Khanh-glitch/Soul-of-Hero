extends Node

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)

var _slot := 3
var _point := "combat"
var _out_path := "res://.artifacts/pilot_capture.png"
var _sim_frames := 90
var _save_path := ""
var _app_root: Node


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--level-slot="):
			_slot = clampi(int(argument.get_slice("=", 1)), 1, 10)
		elif argument.begins_with("--capture-point="):
			_point = argument.get_slice("=", 1).strip_edges().to_lower()
		elif argument.begins_with("--out="):
			_out_path = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--sim-frames="):
			_sim_frames = maxi(12, int(argument.get_slice("=", 1)))
	_run.call_deferred()


func _run() -> void:
	_save_path = OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if _save_path.is_empty():
		_save_path = "user://tests/pilot_visual_%d_%d.json" % [_slot, Time.get_ticks_usec()]
	SaveService.call(&"configure_storage", _save_path, true)
	_seed_campaign_entry()

	var level_id := StringName("chapter_1_level_%d" % _slot)
	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	await get_tree().process_frame
	AppFlow.start_campaign_level(level_id)
	for _frame: int in 8:
		await get_tree().process_frame
	await get_tree().physics_frame

	var route_host := _app_root.get_node_or_null("RouteHost")
	var game := (
		route_host.get_child(0) as Node2D
		if route_host != null and route_host.get_child_count() > 0
		else null
	)
	if game != null:
		var entity_root := game.get_node_or_null("Level/Entities") as Node2D
		var player := (
			entity_root.get_node_or_null("Knight") as CharacterBody2D
			if entity_root != null
			else null
		)
		if player != null:
			player.global_position = _anchor_for(_slot, _point)
			player.set_physics_process(false)
			var camera := player.get_node_or_null("Camera") as Camera2D
			if camera != null:
				camera.reset_smoothing()
				camera.force_update_scroll()
			for _f: int in _sim_frames:
				await get_tree().physics_frame
				await get_tree().process_frame
				if "current_health" in player and "max_health" in player:
					player.set("current_health", player.get("max_health"))
			await RenderingServer.frame_post_draw
			var image := get_viewport().get_texture().get_image()
			DirAccess.make_dir_recursive_absolute(
				ProjectSettings.globalize_path(_out_path).get_base_dir()
			)
			image.save_png(ProjectSettings.globalize_path(_out_path))
			print("PILOT VISUAL CAPTURE SAVED: slot=%d point=%s out=%s" % [_slot, _point, _out_path])

	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
		await get_tree().process_frame
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := _save_path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
	get_tree().quit(0)


func _anchor_for(slot: int, point: String) -> Vector2:
	if slot == 3 and point == "combat":
		# Right behind the central scriptorium archive cover island in Camp 1:
		# both East SkeletonReapers (105,11) & (105,19) fire SpectralDiscs while 5 Skeletons charge!
		return Vector2(93.0 * 16.0 + 8.0, 14.0 * 16.0 + 8.0)
	if slot == 3 and point == "vault":
		return Vector2(54.0 * 16.0 + 8.0, 13.0 * 16.0 + 8.0)
	if slot == 4 and point == "combat":
		# Inside Octagonal Elite Pin Arena beside central reliquary cover + active floor spikes:
		# twin cross-firing SkeletonReapers (39,46) & (57,52) throw SpectralDiscs while 3 Skeletons converge!
		return Vector2(49.0 * 16.0 + 8.0, 52.0 * 16.0 + 8.0)
	if slot == 4 and point == "spiral":
		# Inside Floor 1 Great Three-Turn Concentric Spiral showing all coils + Central Bullseye Shrine!
		return Vector2(45.0 * 16.0 + 8.0, 15.0 * 16.0 + 8.0)
	return Vector2(14.0 * 16.0 + 8.0, 14.0 * 16.0 + 8.0)


func _seed_campaign_entry() -> bool:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_level_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_level_ids.append(String(level.level_id))
	return bool(
		SaveService.call(
			&"transact_once",
			"tests:pilot_combat_visual_capture:%d:%s" % [_slot, _point],
			func(candidate: Dictionary) -> bool:
				var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
				var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
				campaign["unlocked_levels"] = ready_level_ids.duplicate()
				var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
				for level: LevelDefinition in ready_levels:
					for prerequisite_id: String in level.unlock_requirements.prerequisite_level_ids:
						completed[prerequisite_id] = true
				campaign["completed_levels"] = completed
				progression["campaign"] = campaign
				var features: Dictionary = progression.get("features", {}).duplicate(true)
				for level: LevelDefinition in ready_levels:
					for feature_id: String in level.unlock_requirements.required_feature_ids:
						features[feature_id] = true
				progression["features"] = features
				candidate["progression"] = progression
				return true,
			{
				"kind": "isolated_pilot_visual_capture",
				"campaign_slot": _slot,
			}
		)
	)
