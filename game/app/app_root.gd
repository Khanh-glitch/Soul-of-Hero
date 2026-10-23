extends Node

const DIRECT_GAME_SCENE := "res://game/main.tscn"
const HOME_SCENE_PATH := "res://game/ui/screens/home/home_map_screen.tscn"
const BOOT_MINIMUM_MSEC := 650
const BOOT_SLOW_NOTICE_MSEC := 1800
const BOOT_HARD_TIMEOUT_MSEC := 15000
const BOOT_CAPTURE_TIMEOUT_MSEC := BOOT_HARD_TIMEOUT_MSEC + 5000
const BOOT_POLL_SECONDS := 0.04
const CAMPAIGN_ENTRY_RUNTIME_TEST_ARGUMENT := "--campaign-entry-runtime-test"
const VISIBLE_REWARD_RUNTIME_TEST_ARGUMENT := "--visible-reward-runtime-test"
const FRESH_PLAYER_LOOP_ACCEPTANCE_TEST_ARGUMENT := "--fresh-player-loop-acceptance-test"
const HERO_SKILL_LIVE_RUNTIME_TEST_ARGUMENT := "--hero-skill-live-runtime-test"
const ARCHER_HERO_COMBAT_TEST_ARGUMENT := "--archer-hero-combat-test"
const GAMEPLAY_CLICK_AUTO_PICKUP_TEST_ARGUMENT := "--gameplay-click-auto-pickup-test"
const STARTUP_PROFILE_CHOICE_TEST_ARGUMENT := "--startup-profile-choice-test"
const DIRECT_GAME_ARGUMENTS := [
	"--smoke-test",
	"--living-arsenal-test",
	"--axe-knight-test",
	"--auxiliary-equipment-knight-test",
	"--axe-soul-team-test",
	"--hero-soul-instance-knight-test",
	"--axe-form-capture",
	"--sword-combo-capture",
]

@onready var route_host: Node = $RouteHost

var _current_route := &""
var _is_switching := false
var _boot_state := &"idle"
var _preloaded_home_scene: PackedScene


func _ready() -> void:
	# Browser-only boot visibility: a diagnostic marker, never an unlock/save action.
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.__soulHeroAppReady = true;")
	_apply_persisted_runtime_settings()
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_signal(&"settings_changed"):
		var settings_callback := Callable(self, "_apply_persisted_runtime_settings")
		if not save_service.is_connected(&"settings_changed", settings_callback):
			save_service.connect(&"settings_changed", settings_callback)
	if _should_direct_load_game():
		_direct_load_game.call_deferred()
		return
	AppFlow.attach_app_root(self)
	if OS.get_cmdline_user_args().has(STARTUP_PROFILE_CHOICE_TEST_ARGUMENT):
		var startup_choice_test: Node = (load("res://tests/startup_profile_choice_test.gd") as GDScript).new()
		add_child(startup_choice_test)
		startup_choice_test.start(self)
		AppFlow.open_boot()
		_finish_boot.call_deferred()
		return
	if OS.get_cmdline_user_args().has(ARCHER_HERO_COMBAT_TEST_ARGUMENT):
		var archer_combat_test: Node = (load("res://tests/archer_hero_combat_test.gd") as GDScript).new()
		add_child(archer_combat_test)
		archer_combat_test.start(self)
		return
	if OS.get_cmdline_user_args().has(GAMEPLAY_CLICK_AUTO_PICKUP_TEST_ARGUMENT):
		var click_pickup_test: Node = (load("res://tests/gameplay_click_auto_pickup_test.gd") as GDScript).new()
		add_child(click_pickup_test)
		click_pickup_test.start(self)
		return
	if OS.get_cmdline_user_args().has(HERO_SKILL_LIVE_RUNTIME_TEST_ARGUMENT):
		var hero_skill_test: Node = (load("res://tests/hero_skill_live_runtime_test.gd") as GDScript).new()
		add_child(hero_skill_test)
		hero_skill_test.start(self)
		return
	if OS.get_cmdline_user_args().has(VISIBLE_REWARD_RUNTIME_TEST_ARGUMENT):
		var visible_reward_test: Node = (load("res://tests/visible_progression_reward_runtime_test.gd") as GDScript).new()
		add_child(visible_reward_test)
		visible_reward_test.start(self)
		return
	if OS.get_cmdline_user_args().has(FRESH_PLAYER_LOOP_ACCEPTANCE_TEST_ARGUMENT):
		var fresh_loop_test: Node = (load("res://tests/fresh_player_loop_acceptance_test.gd") as GDScript).new()
		add_child(fresh_loop_test)
		fresh_loop_test.start(self)
		return
	if OS.get_cmdline_user_args().has(CAMPAIGN_ENTRY_RUNTIME_TEST_ARGUMENT):
		var campaign_entry_test: Node = (load("res://tests/campaign_entry_runtime_test.gd") as GDScript).new()
		add_child(campaign_entry_test)
		campaign_entry_test.start(self)
		return
	if AppFlow.has_active_run():
		AppFlow.retry_active_run()
	else:
		AppFlow.open_boot()
		_finish_boot.call_deferred()
		if OS.get_cmdline_user_args().has("--ui-shell-capture"):
			_capture_ui_shell.call_deferred()


func _exit_tree() -> void:
	if not _should_direct_load_game():
		AppFlow.detach_app_root(self)


func show_route(scene_path: String, payload: Dictionary, route_id: StringName) -> void:
	if _is_switching:
		call_deferred("show_route", scene_path, payload, route_id)
		return
	_is_switching = true
	get_tree().paused = false
	_release_virtual_actions()
	for child: Node in route_host.get_children():
		route_host.remove_child(child)
		child.queue_free()
	var packed: PackedScene
	if scene_path == HOME_SCENE_PATH and _preloaded_home_scene != null:
		packed = _preloaded_home_scene
		_preloaded_home_scene = null
	else:
		packed = load(scene_path) as PackedScene
	if packed == null:
		push_error("AppRoot could not load route scene: %s" % scene_path)
		_is_switching = false
		return
	var screen := packed.instantiate()
	route_host.add_child(screen)
	if screen.has_method(&"configure"):
		screen.call("configure", payload.duplicate(true))
	_current_route = route_id
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.__soulHeroRoute = " + JSON.stringify(String(route_id)) + ";")
	_publish_route_state(route_id, payload)
	_is_switching = false


func get_route_child_count() -> int:
	return route_host.get_child_count()


func get_current_route() -> StringName:
	return _current_route


func _finish_boot() -> void:
	_boot_state = &"loading"
	var started_msec := Time.get_ticks_msec()
	var loaded_home: PackedScene
	var failure_reason := ""
	var resource_progress := 0.0
	if OS.get_cmdline_user_args().has(STARTUP_PROFILE_CHOICE_TEST_ARGUMENT):
		# Godot 4.7 retains zero-ref threaded-loader internals until process exit in
		# short headless runs. The focused route test still validates the exact Home
		# resource and all post-load navigation, using a cache-isolated sync read.
		var test_resource := ResourceLoader.load(
			HOME_SCENE_PATH,
			"PackedScene",
			ResourceLoader.CACHE_MODE_IGNORE_DEEP,
		)
		if test_resource is PackedScene:
			loaded_home = test_resource
			resource_progress = 1.0
		else:
			failure_reason = "focused load returned an invalid Home scene"
	else:
		var request_error := ResourceLoader.load_threaded_request(HOME_SCENE_PATH)
		var can_poll := request_error == OK or request_error == ERR_BUSY
		if not can_poll:
			failure_reason = "threaded request failed: %s" % error_string(request_error)
		while is_inside_tree() and loaded_home == null and failure_reason.is_empty():
			var elapsed_msec := Time.get_ticks_msec() - started_msec
			var progress: Array = []
			var status := ResourceLoader.load_threaded_get_status(HOME_SCENE_PATH, progress)
			if not progress.is_empty():
				resource_progress = clampf(float(progress[0]), 0.0, 1.0)
			if status == ResourceLoader.THREAD_LOAD_LOADED:
				var threaded_resource := ResourceLoader.load_threaded_get(HOME_SCENE_PATH)
				if threaded_resource is PackedScene:
					loaded_home = threaded_resource
					resource_progress = 1.0
				else:
					failure_reason = "threaded load returned an invalid Home scene"
			elif status in [ResourceLoader.THREAD_LOAD_FAILED, ResourceLoader.THREAD_LOAD_INVALID_RESOURCE]:
				failure_reason = "threaded load ended with status %d" % status

			var time_progress := clampf(float(elapsed_msec) / float(BOOT_SLOW_NOTICE_MSEC), 0.0, 1.0)
			var display_progress := minf(0.96, 0.08 + time_progress * 0.16 + resource_progress * 0.72)
			var loading_status := (
				"Đang mở cổng — dữ liệu lớn hơn dự kiến"
				if elapsed_msec >= BOOT_SLOW_NOTICE_MSEC
				else "Đang dựng Thánh Địa"
			)
			_set_boot_progress(display_progress, loading_status)
			if loaded_home != null or not failure_reason.is_empty():
				break
			if elapsed_msec >= BOOT_HARD_TIMEOUT_MSEC:
				failure_reason = "threaded load exceeded %d ms" % BOOT_HARD_TIMEOUT_MSEC
				break
			await get_tree().create_timer(BOOT_POLL_SECONDS, true).timeout

	if not is_inside_tree():
		return
	if loaded_home == null:
		# A failed or stalled threaded request gets one explicit, synchronous retry
		# outside the shared cache. This also distinguishes a loader-thread problem
		# from an actually missing or malformed Home scene.
		_set_boot_progress(0.96, "Tải nền gặp sự cố — đang thử chế độ dự phòng")
		await get_tree().process_frame
		var fallback_resource := ResourceLoader.load(
			HOME_SCENE_PATH,
			"PackedScene",
			ResourceLoader.CACHE_MODE_IGNORE
		)
		if fallback_resource is PackedScene:
			loaded_home = fallback_resource
		else:
			_boot_state = &"failed"
			var message := "Không thể tải Thánh Địa. Hãy khởi động lại trò chơi."
			_set_boot_progress(0.96, message)
			push_error("Home boot failed (%s); direct fallback also failed." % failure_reason)
			if OS.get_cmdline_user_args().has("--ui-shell-capture"):
				await _save_route_capture("ui_shell_loading_failed")
				get_tree().quit(1)
			return

	# Keep the branded loading screen visible for a minimum interval even when
	# disk/cache loading completes immediately. It is never a maximum deadline.
	var remaining_msec := BOOT_MINIMUM_MSEC - (Time.get_ticks_msec() - started_msec)
	if remaining_msec > 0:
		await get_tree().create_timer(float(remaining_msec) / 1000.0, true).timeout
	if not is_inside_tree():
		return
	# Keep the exact Home resource that passed validation ready for Continue. The
	# player must choose Continue or New Game after loading instead of entering
	# Home implicitly.
	_preloaded_home_scene = loaded_home
	_set_boot_progress(1.0, "Đã mở cổng Thánh Địa")
	if OS.get_cmdline_user_args().has("--ui-shell-capture"):
		await _save_route_capture("ui_shell_loading")
	await get_tree().create_timer(0.12, true).timeout
	if is_inside_tree() and _current_route == &"boot" and not AppFlow.has_active_run():
		AppFlow.open_title()
	if not is_inside_tree():
		return
	if _current_route == &"title":
		# Loading is complete only after the authored profile choice is mounted.
		_boot_state = &"complete"
	else:
		_boot_state = &"failed"
		_set_boot_progress(0.96, "Không thể mở lựa chọn hồ sơ. Hãy khởi động lại trò chơi.")
		push_error("Home scene loaded, but AppFlow did not open the startup profile choice.")


func _set_boot_progress(value: float, status_text := "Đang dựng Thánh Địa") -> void:
	if route_host.get_child_count() != 1:
		return
	var boot_screen := route_host.get_child(0)
	if boot_screen.has_method(&"set_loading_progress"):
		boot_screen.call(&"set_loading_progress", value, status_text)


func _should_direct_load_game() -> bool:
	# UI route capture must stay inside AppRoot even when the editor has an MCP
	# token in its environment; otherwise the capture run silently opens gameplay
	# and never reaches the shell screenshots.
	if OS.get_cmdline_user_args().has("--ui-shell-capture"):
		return false
	if OS.get_cmdline_user_args().has(STARTUP_PROFILE_CHOICE_TEST_ARGUMENT):
		return false
	if OS.get_cmdline_user_args().has(GAMEPLAY_CLICK_AUTO_PICKUP_TEST_ARGUMENT):
		return false
	if not OS.get_environment("GODOT_MCP_TOKEN").strip_edges().is_empty():
		return true
	var arguments := OS.get_cmdline_user_args()
	for required_argument: String in DIRECT_GAME_ARGUMENTS:
		if arguments.has(required_argument):
			return true
	return false


func _direct_load_game() -> void:
	get_tree().paused = false
	var error := get_tree().change_scene_to_file(DIRECT_GAME_SCENE)
	if error != OK:
		push_error("Could not direct-load gameplay scene: %s" % error_string(error))


func _release_virtual_actions() -> void:
	for button: Node in get_tree().get_nodes_in_group(&"virtual_action_buttons"):
		if button.has_method(&"release_action"):
			button.call(&"release_action")


func _publish_route_state(route_id: StringName, payload: Dictionary) -> void:
	var bridge := get_node_or_null("/root/RealtimeBridge")
	if bridge != null and bridge.has_method(&"publish_event"):
		bridge.call("publish_event", "ui_route_changed", {
			"route": String(route_id),
			"hub_tab": String(AppFlow.get_current_hub_tab()),
			"home_function": String(AppFlow.get_current_home_function()),
			"level_id": String(payload.get("level_id", "")),
		})


func _apply_persisted_runtime_settings(provided_settings: Dictionary = {}) -> void:
	var settings := provided_settings
	if settings.is_empty():
		var save_service := get_node_or_null("/root/SaveService")
		if save_service == null or not save_service.has_method(&"get_value"):
			return
		var settings_path: Array[String] = ["settings"]
		var raw: Variant = save_service.call(&"get_value", settings_path, {})
		if not raw is Dictionary:
			return
		settings = raw
	_apply_bus_volume(&"Master", float(settings.get("master_volume", 1.0)))
	_apply_bus_volume(&"Music", float(settings.get("music_volume", 0.8)))
	_apply_bus_volume(&"SFX", float(settings.get("sfx_volume", 1.0)))
	_apply_bus_volume(&"UI", float(settings.get("sfx_volume", 1.0)))
	if DisplayServer.get_name() == "headless" or OS.get_cmdline_user_args().has("--ui-shell-capture"):
		return
	DisplayServer.window_set_mode(
		DisplayServer.WINDOW_MODE_FULLSCREEN
		if bool(settings.get("fullscreen", false))
		else DisplayServer.WINDOW_MODE_WINDOWED
	)


func _apply_bus_volume(bus_name: StringName, linear_value: float) -> void:
	var bus_index := AudioServer.get_bus_index(bus_name)
	if bus_index < 0:
		return
	var safe_value := clampf(linear_value, 0.0, 1.0)
	AudioServer.set_bus_volume_db(bus_index, -80.0 if safe_value <= 0.001 else linear_to_db(safe_value))


func _capture_ui_shell() -> void:
	# Use the same boot completion signal as production navigation. Captures must
	# never conceal a stalled/failed preload by forcing the profile choice open.
	var deadline_msec := Time.get_ticks_msec() + BOOT_CAPTURE_TIMEOUT_MSEC
	while is_inside_tree() and _boot_state in [&"idle", &"loading"]:
		if Time.get_ticks_msec() >= deadline_msec:
			push_error("UI shell capture timed out while waiting for startup loading.")
			get_tree().quit(1)
			return
		await get_tree().create_timer(BOOT_POLL_SECONDS, true).timeout
	if not is_inside_tree():
		return
	if _boot_state != &"complete" or _current_route != &"title":
		push_error("UI shell capture cannot continue because the startup profile choice did not open.")
		get_tree().quit(1)
		return
	await _save_route_capture("ui_shell_startup_choice")
	AppFlow.open_home()
	await get_tree().process_frame
	if _current_route != &"home":
		push_error("UI shell capture could not Continue from the startup profile choice.")
		get_tree().quit(1)
		return
	await _save_route_capture("ui_shell_home_map")
	for function_id: StringName in [&"campaign", &"hero_roster", &"modes", &"bestiary", &"settings"]:
		AppFlow.open_home(function_id)
		await _save_route_capture("ui_shell_home_%s" % function_id)
		if function_id == &"hero_roster":
			var roster_tabs := route_host.find_child("RosterTabs", true, false) as TabContainer
			if roster_tabs != null and roster_tabs.get_tab_count() > 2:
				roster_tabs.current_tab = 2
				await _save_route_capture("ui_shell_home_hero_skills")
	AppFlow.open_level_details(&"chapter_1_level_1")
	await _save_route_capture("ui_shell_level_01_details")
	AppFlow.open_credits(&"home")
	await _save_route_capture("ui_shell_credits")
	AppFlow.start_campaign_level(&"chapter_1_level_1")
	await get_tree().process_frame
	AppFlow.complete_active_run(
		{"score": 1250, "sigils": 3, "required_sigils": 3, "duration_seconds": 67.0},
		false
	)
	await _save_route_capture("ui_shell_campaign_continuation")
	AppFlow.abort_to_home()
	AppFlow.open_level_details(&"chapter_1_level_1")
	await _save_route_capture("ui_shell_level_01_details")
	AppFlow.open_level_details(&"training_crypt")
	await _save_route_capture("ui_shell_training_details")
	get_tree().quit(0)


func _save_route_capture(file_stem: String) -> void:
	# Let newly-instantiated Controls finish theme/layout and allow the font/icon
	# atlases to reach the render thread. Rapid route capture could otherwise
	# produce a valid layout with random labels missing from a single frame.
	await get_tree().create_timer(0.22, true).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	# The dummy headless renderer has no readable viewport texture. Route logic is
	# covered by ui_shell_test; visual captures require a real rendering driver.
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	image.save_png("res://.artifacts/%s.png" % file_stem)
