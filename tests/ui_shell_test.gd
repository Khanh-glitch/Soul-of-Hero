extends SceneTree

class FakeAppRoot:
	extends Node
	var scene_path := ""
	var payload: Dictionary = {}
	var route_id := &""

	func show_route(next_scene_path: String, next_payload: Dictionary, next_route_id: StringName) -> void:
		scene_path = next_scene_path
		payload = next_payload.duplicate(true)
		route_id = next_route_id

var _checks := 0
var _failures: Array[String] = []
var _flow: Node


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var fake_root := FakeAppRoot.new()
	root.add_child(fake_root)
	_flow = root.get_node_or_null("AppFlow")
	_expect(_flow != null, "AppFlow autoload exists")
	if _flow == null:
		quit(1)
		return
	_flow.call("attach_app_root", fake_root)

	_test_route_contract(fake_root)
	_test_sequential_campaign_unlock(fake_root)
	await _test_home_map()
	await _test_campaign_slots()
	_test_icon_manifest()
	_test_victory_authority()
	await _test_roster_copy()
	await _test_supporting_screens()

	_flow.call("detach_app_root", fake_root)
	fake_root.queue_free()
	if _failures.is_empty():
		print("UI SHELL TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("UI SHELL FAIL: %s" % failure)
		print("UI SHELL TEST FAILED — %d/%d checks" % [_failures.size(), _checks])
		quit(1)


func _test_route_contract(fake_root: FakeAppRoot) -> void:
	_flow.call("open_home")
	_expect(
		fake_root.route_id == &"home"
		and fake_root.scene_path == "res://game/ui/screens/home/home_map_screen.tscn"
		and StringName(fake_root.payload.get("function_id", &"")) == &"",
		"AppFlow opens the Home Map without an initial function overlay"
	)
	_flow.call("open_home", &"modes")
	_expect(
		fake_root.route_id == &"home"
		and fake_root.scene_path == "res://game/ui/screens/home/home_map_screen.tscn"
		and StringName(fake_root.payload.get("function_id", &"")) == &"modes",
		"AppFlow opens a requested Home Map function"
	)
	_flow.call("open_level_details", &"not_a_campaign_level")
	_expect(fake_root.route_id == &"level_details" and fake_root.payload.get("level_id") == &"chapter_1_level_1", "unknown campaign content safely resolves to playable Level 01 details")
	_expect(_flow.call("start_campaign_level", &"chapter_1_level_1"), "playable Level 01 starts through AppFlow")
	_expect(fake_root.route_id == &"gameplay" and bool(_flow.call("has_active_run")), "Level 01 creates an active gameplay run")
	var campaign_run: Dictionary = _flow.call("get_active_run")
	_expect(campaign_run.get("mode_id") == &"campaign" and campaign_run.get("level_id") == &"chapter_1_level_1", "Level 01 active run is campaign, not training")
	_expect(
		campaign_run.get("content_level_id") == &"chapter_1_level_1"
		and int(campaign_run.get("campaign_slot", 0)) == 1,
		"Level 01 run resolves the campaign registry entry rather than the sandbox definition"
	)
	_expect(String(campaign_run.get("layout_data_path", "")) == "res://data/levels/crypt_entrance.json", "Level 01 run carries its registry-authored layout source")
	var level_one_tutorial := _instantiate("res://game/tutorial/level_one_tutorial.tscn")
	_expect(
		(level_one_tutorial.get_node("TutorialPanel") as Control).visible,
		"Level 01 enables its onboarding tutorial"
	)
	level_one_tutorial.free()
	# Route coverage must never mutate the developer/player profile. Campaign
	# persistence is covered by the isolated save-service suite.
	var was_completed := bool(_flow.call("is_campaign_level_completed", &"chapter_1_level_1"))
	_flow.call("complete_active_run", {"score": 12, "sigils": 3}, false)
	_expect(fake_root.route_id == &"gameplay", "Campaign completion stays in gameplay for the continuation chooser")
	var campaign_result: Dictionary = _flow.call("get_last_result")
	_expect(campaign_result.get("mode_id") == &"campaign", "Campaign result retains campaign authority")
	_expect(
		bool(_flow.call("is_campaign_level_completed", &"chapter_1_level_1")) == was_completed,
		"UI route coverage leaves Campaign Level 01 persistence unchanged"
	)
	_flow.call("abort_to_hub", &"campaign")
	_flow.call("start_training")
	_expect(fake_root.route_id == &"gameplay" and bool(_flow.call("has_active_run")), "Training creates an active run")
	var started_run: Dictionary = _flow.call("get_active_run")
	_expect(started_run.get("mode_id") == &"training" and started_run.has("soul_team") and not started_run.has("loadout"), "Training remains a separate run with the canonical Soul Team snapshot")
	_expect(started_run.get("content_level_id") == &"crypt_entrance_sandbox" and int(started_run.get("campaign_slot", -1)) == 0, "Training keeps the sandbox content definition outside Campaign slot 1")
	var sandbox_tutorial := _instantiate("res://game/tutorial/level_one_tutorial.tscn")
	_expect(
		(sandbox_tutorial.get_node("TutorialPanel") as Control).visible,
		"Training sandbox keeps the Level 01 onboarding tutorial"
	)
	sandbox_tutorial.free()
	_flow.call("complete_training", {"score": 12, "sigils": 3})
	_expect(fake_root.route_id == &"gameplay", "Training completion stays in gameplay for the continuation chooser")
	var result: Dictionary = _flow.call("get_last_result")
	_expect(float(result.get("duration_seconds", -1.0)) >= 0.0, "Training result contains duration")
	var first_run: Dictionary = _flow.call("get_active_run")
	_flow.call("retry_active_run")
	var retried_run: Dictionary = _flow.call("get_active_run")
	_expect(fake_root.route_id == &"gameplay", "Retry returns to Training gameplay")
	_expect(String(retried_run.get("run_id", "")) != String(first_run.get("run_id", "")), "Retry creates a distinct run receipt")
	var retry_result: Dictionary = _flow.call("get_last_result")
	_expect(retry_result.is_empty(), "Retry clears the previous result snapshot")
	_flow.call("abort_to_hub", &"campaign")
	_expect(not bool(_flow.call("has_active_run")), "returning home clears the transient run")
	for slot: int in range(1, 8):
		var summary: Dictionary = _flow.call("get_campaign_level_summary", slot)
		_expect(not summary.is_empty(), "Campaign Level %02d is visible in the registered chapter" % slot)
		_expect(FileAccess.file_exists(String(summary.get("layout_data_path", ""))), "Campaign Level %02d points to a real map JSON" % slot)


func _test_sequential_campaign_unlock(fake_root: FakeAppRoot) -> void:
	_expect(not bool(_flow.call("is_campaign_level_unlocked", &"chapter_1_level_2")), "fresh profile keeps Level 02 locked before Level 01 victory")
	_expect(bool(_flow.call("start_campaign_level", &"chapter_1_level_1")), "Level 01 can start for sequential unlock coverage")
	_flow.call("complete_active_run", {"score": 100, "sigils": 3}, true)
	_expect(fake_root.route_id == &"gameplay", "persisted Level 01 victory keeps the continuous gameplay route")
	_expect(bool(_flow.call("is_campaign_level_completed", &"chapter_1_level_1")), "Level 01 victory persists completion")
	_expect(bool(_flow.call("is_campaign_level_unlocked", &"chapter_1_level_2")), "Level 01 victory unlocks Level 02")
	_expect(bool(_flow.call("start_campaign_level", &"chapter_1_level_2")), "newly unlocked Level 02 starts through AppFlow")
	var level_2_run: Dictionary = _flow.call("get_active_run")
	_expect(level_2_run.get("level_id") == &"chapter_1_level_2", "Level 02 run keeps its campaign ID")
	_expect(String(level_2_run.get("layout_data_path", "")) == "res://data/levels/chapter_1_level_2.json", "Level 02 run routes to its redesigned map")
	_flow.call("complete_active_run", {"score": 250, "sigils": 3, "required_sigils": 3}, false)
	var level_2_result: Dictionary = _flow.call("get_last_result")
	var level_2_display_name := String(level_2_run.get("level_display_name", ""))
	_expect(not level_2_display_name.is_empty(), "Level 02 run carries its authored display name")
	_expect(int(level_2_result.get("campaign_slot", 0)) == 2, "Level 02 result keeps its campaign slot")
	_expect(
		String(level_2_result.get("level_display_name", "")) == level_2_display_name,
		"Level 02 result keeps its authored display name"
	)
	var results_screen := _instantiate("res://game/ui/screens/results/training_results_screen.tscn")
	_expect((results_screen.get_node("Center/Card/Layout/Title") as Label).text == "HOÀN THÀNH MÀN 02", "Level 02 Results renders the dynamic stage number")
	var level_2_notice := (results_screen.get_node("Center/Card/Layout/Notice") as Label).text
	_expect("Màn 02" in level_2_notice, "Level 02 Results notice renders the dynamic stage number")
	_expect(level_2_display_name in level_2_notice, "Level 02 Results notice renders the authored display name")
	results_screen.free()
	var level_two_tutorial := _instantiate("res://game/tutorial/level_one_tutorial.tscn")
	_expect(
		not (level_two_tutorial.get_node("TutorialPanel") as Control).visible,
		"Level 02 suppresses the Level 01 onboarding tutorial"
	)
	_expect(not level_two_tutorial.is_processing(), "Level 02 tutorial instance disables its runtime polling")
	level_two_tutorial.free()
	_flow.call("abort_to_hub", &"campaign")


func _test_home_map() -> void:
	var home := _instantiate("res://game/ui/screens/home/home_map_screen.tscn")
	await process_frame
	await process_frame
	var world_root := home.get_node_or_null("%WorldRoot") as Node2D
	var map_world := home.get_node_or_null("%MapWorld")
	var player := home.get_node_or_null("%Player")
	var overlay := home.get_node_or_null("%FunctionOverlay") as Control
	var host := home.get_node_or_null("%ContentHost") as Control
	var back_button := home.get_node_or_null("%BackToMapButton") as Button
	_expect(
		world_root != null and map_world != null and map_world.get_parent() == world_root,
		"Home Map exposes a scrollable WorldRoot containing its map world"
	)
	_expect(player != null, "Home Map exposes the player avatar")
	_expect(
		home.call("get_world_size") == Vector2(1200.0, 1200.0),
		"Home Map exposes the authored 1200x1200 world size"
	)
	_expect(overlay != null and host != null and back_button != null, "Home Map exposes its function overlay contract")
	if overlay == null or host == null or back_button == null:
		home.free()
		return
	_expect(not overlay.visible and host.get_child_count() == 0, "Home Map starts without a function overlay")
	var module_ids: Array[StringName] = [&"campaign", &"hero_roster", &"modes", &"bestiary", &"settings", &"storage"]
	var destination_ids := _collect_group_ids_below(home, &"home_destination", &"function_id")
	var destinations_match := destination_ids.size() == module_ids.size() + 1 and destination_ids.has(&"credits")
	for function_id: StringName in module_ids:
		destinations_match = destinations_match and destination_ids.has(function_id)
	_expect(
		int(home.call("get_destination_count")) == module_ids.size() + 1
		and _count_group_below(home, &"home_destination") == module_ids.size() + 1
		and destinations_match,
		"Home Map exposes six module landmarks plus the Credits destination"
	)
	var world_bounds := Rect2(Vector2.ZERO, home.call("get_world_size"))
	var all_landmarks_inside_world := true
	var all_landmarks_walkable := true
	var all_landmarks_reachable := true
	for destination: Node in _nodes_in_group_below(home, &"home_destination"):
		all_landmarks_inside_world = all_landmarks_inside_world \
			and destination is Node2D \
			and world_bounds.has_point((destination as Node2D).position)
		if destination is Node2D and player != null:
			var destination_position := (destination as Node2D).position
			all_landmarks_walkable = all_landmarks_walkable \
				and bool(home.call("_is_walkable_position", destination_position))
			var route: Array = home.call("_find_world_path", (player as Node2D).position, destination_position)
			all_landmarks_reachable = all_landmarks_reachable \
				and not route.is_empty() \
				and (route[-1] as Vector2).distance_to(destination_position) < 0.1
	_expect(all_landmarks_inside_world, "all Home destinations stay inside the 1200x1200 world")
	_expect(all_landmarks_walkable, "all Home destinations stand on SC Demo's authored main-floor cells")
	_expect(all_landmarks_reachable, "all Home destinations have a main-floor route from the official demo spawn")
	if world_root != null and player != null:
		_expect(world_root.position != Vector2.ZERO, "Home Map starts with a non-zero camera offset")
		_expect(
			Rect2(Vector2.ZERO, home.size).has_point((player as Node2D).global_position),
			"the camera keeps the player visible in the logical viewport"
		)
	var campaign_destination := home.get_node_or_null("WorldRoot/DestinationLayer/Campaign") as Node2D
	if campaign_destination != null and player != null:
		home.call("_walk_to_destination", campaign_destination)
		_expect(bool(player.call("is_auto_moving")), "clicking a Home destination starts auto-navigation")
		Input.action_press(&"move_left")
		player.call("_physics_process", 1.0 / 60.0)
		Input.action_release(&"move_left")
		await process_frame
		_expect(
			home.get("_pending_destination") == null and not bool(player.call("is_auto_moving")),
			"manual movement immediately clears the pending Home destination"
		)
	var touch_event := InputEventScreenTouch.new()
	touch_event.pressed = true
	home.call("_input", touch_event)
	home.call("update_prompt")
	_expect((home.get_node("%PromptKey") as Label).text == "CHẠM", "Home prompt follows touch input modality")
	var keyboard_event := InputEventKey.new()
	keyboard_event.physical_keycode = KEY_W
	keyboard_event.pressed = true
	home.call("_input", keyboard_event)
	home.call("update_prompt")
	_expect((home.get_node("%PromptKey") as Label).text == "WASD", "Home prompt returns to keyboard modality")
	var home_source := FileAccess.get_file_as_string("res://game/ui/screens/home/home_map_screen.gd")
	_expect(
		"FUNCTION_SCENE_PATHS" in home_source
		and not "preload(\"res://game/ui/screens/hub/tabs/" in home_source,
		"Home Map lazily loads only the selected function scene"
	)
	for function_id: StringName in module_ids:
		home.call("open_function", function_id)
		await process_frame
		await process_frame
		_expect(bool(home.call("is_function_open")), "%s opens from its Home Map destination" % function_id)
		_expect(overlay.visible, "%s displays the function overlay" % function_id)
		_expect(host.get_child_count() == 1, "%s keeps exactly one function scene in the overlay" % function_id)
		home.call("close_function")
		await process_frame
		_expect(not bool(home.call("is_function_open")) and not overlay.visible and host.get_child_count() == 0, "%s returns cleanly to the map" % function_id)
	home.call("configure", {"function_id": &"bestiary"})
	await process_frame
	await process_frame
	_expect(bool(home.call("is_function_open")) and overlay.visible, "Home Map configure restores a requested function")
	back_button.pressed.emit()
	await process_frame
	_expect(not bool(home.call("is_function_open")) and not overlay.visible, "Back to Map closes the restored function")
	home.free()


func _test_campaign_slots() -> void:
	var campaign := _instantiate("res://game/ui/screens/hub/tabs/campaign_tab.tscn")
	await process_frame
	_expect(int(campaign.call("get_chapter_button_count")) == 10, "Campaign chapter picker creates ten dynamic chapter buttons")
	_expect((campaign as Control).get_combined_minimum_size().x <= 624.0, "Campaign chapter picker fits the 640px logical viewport")
	_expect(_count_group_below(campaign, &"campaign_slot_card") == 10, "Campaign chapter view creates ten honest slots")
	var level_one_card := campaign.get_node_or_null("SlotsGrid/CampaignSlot01")
	_expect(level_one_card != null and bool(level_one_card.get_meta(&"playable", false)), "Campaign Level 01 card is explicitly playable")
	var level_one_play := campaign.get_node_or_null("SlotsGrid/CampaignSlot01/Content/PlayButton") as Button
	_expect(level_one_play != null and not level_one_play.disabled, "Campaign Level 01 exposes an enabled Play button")
	if level_one_play != null:
		level_one_play.pressed.emit()
		_expect(_flow.call("get_current_route") == &"level_details", "Campaign Level 01 Play button routes to level details")
	for slot: int in range(2, 6):
		var card := campaign.get_node_or_null("SlotsGrid/CampaignSlot%02d" % slot)
		var title := campaign.get_node_or_null("SlotsGrid/CampaignSlot%02d/Content" % slot)
		_expect(card != null and title != null, "Campaign Level %02d renders an authored card instead of a missing slot" % slot)
	var level_two_card := campaign.get_node_or_null("SlotsGrid/CampaignSlot02")
	_expect(level_two_card != null and bool(level_two_card.get_meta(&"playable", false)), "completed Level 01 profile displays Level 02 as playable")
	campaign.call("_show_chapter", 2)
	await process_frame
	_expect(campaign.get_node_or_null("SlotsGrid/CampaignSlot11") != null, "Chapter 2 displays slots 11–20")
	_expect(campaign.get_node_or_null("SlotsGrid/CampaignSlot20") != null, "Campaign structural capacity reaches Level 20")
	campaign.call("_show_chapter", 10)
	await process_frame
	_expect(int(campaign.call("get_current_chapter")) == 10, "Campaign picker selects Chapter 10")
	_expect(campaign.get_node_or_null("SlotsGrid/CampaignSlot91") != null, "Chapter 10 starts at campaign slot 91")
	_expect(campaign.get_node_or_null("SlotsGrid/CampaignSlot100") != null, "Campaign structural capacity reaches Level 100")
	campaign.call("_show_chapter", 11)
	_expect(int(campaign.call("get_current_chapter")) == 10, "Campaign picker clamps requests beyond Chapter 10")
	campaign.free()


func _test_icon_manifest() -> void:
	_expect(LivingArsenalIcons.SWORD == Vector2i(1, 5), "Shikashi manifest maps the Sword Hero icon")
	_expect(LivingArsenalIcons.CAMPAIGN == Vector2i(12, 13), "Shikashi manifest maps the Campaign map icon")


func _test_victory_authority() -> void:
	var app_root_source := FileAccess.get_file_as_string("res://game/app/app_root.gd")
	var hud_source := FileAccess.get_file_as_string("res://game/ui/hud.gd")
	_expect(
		not "objective_completed.connect(_on_objective_completed)" in app_root_source
		and "app_flow.call(&\"complete_active_run\"" in hud_source,
		"Mode-aware victory waits for the HUD Continue action before Results routing"
	)


func _test_roster_copy() -> void:
	var bestiary := _instantiate("res://game/ui/screens/hub/tabs/bestiary_tab.tscn")
	await process_frame
	_expect(
		(bestiary.get_node("Cards/SkeletonOneCard/Content/Name") as Label).text == "CHIẾN BINH XƯƠNG",
		"Bestiary names the melee Skeleton Swordsman"
	)
	_expect(
		(bestiary.get_node("Cards/SkeletonTwoCard/Content/Name") as Label).text == "TỬ THẦN XƯƠNG",
		"Bestiary names the returning-projectile Bone Reaper"
	)
	_expect(
		"ÉP VỊ TRÍ" in (bestiary.get_node("Cards/VampireCard/Content/Role") as Label).text,
		"Bestiary describes the Blood Vampire without obsolete loadout language"
	)
	bestiary.free()

	var details := _instantiate("res://game/ui/screens/level_details/training_details_screen.tscn")
	await process_frame
	var enemy_copy := (details.get_node("Margin/Layout/Content/Mission/Body/Enemies") as Label).text
	_expect("Chiến binh Xương" in enemy_copy and "Tử thần Xương" in enemy_copy and "Ma cà rồng" in enemy_copy, "Training details list all three runtime enemies")
	var team_copy := (details.get_node("Margin/Layout/Content/Loadout/Body/LoadoutValue") as Label).text
	_expect("HERO CHỦ LỰC" in team_copy and "HERO DỰ BỊ" in team_copy, "Training details show the fixed two-Hero pair")
	details.free()


func _test_supporting_screens() -> void:
	for scene_path: String in [
		"res://game/ui/screens/hub/tabs/arsenal_tab.tscn",
		"res://game/ui/screens/hub/tabs/modes_tab.tscn",
		"res://game/ui/screens/hub/tabs/bestiary_tab.tscn",
		"res://game/ui/screens/hub/tabs/settings_tab.tscn",
		"res://game/ui/screens/level_details/training_details_screen.tscn",
		"res://game/ui/screens/results/training_results_screen.tscn",
		"res://game/ui/screens/settings/settings_screen.tscn",
		"res://game/ui/screens/credits/credits_screen.tscn",
	]:
		var screen := _instantiate(scene_path)
		await process_frame
		_expect(is_instance_valid(screen), "screen instantiates: %s" % scene_path.get_file())
		screen.free()

	var roster := _instantiate("res://game/ui/screens/hub/tabs/arsenal_tab.tscn")
	await process_frame
	_expect(roster.find_child("SwordHeroButton", true, false) is Button, "Hero Roster exposes Sword as its production Hero")
	_expect(
		"LINH HỒN CHIẾN BINH" in (
			roster.find_child("SkillSummary", true, false) as Label
		).text,
		"Hero Roster presents K-Night's current Common active skill",
	)
	var second_reserve := roster.find_child("ReserveTwoLabel", true, false) as Label
	_expect(second_reserve != null and not second_reserve.visible and bool(second_reserve.get_meta("_production_locked", false)), "retired second-reserve placeholder remains hidden for scene compatibility")
	var roster_copy := _collect_visible_text(roster).to_upper()
	_expect(
		not "LIVING ARSENAL" in roster_copy
			and not "KHO VŨ KHÍ" in roster_copy
			and not "LINH KHÍ" in roster_copy
			and "ĐỘI HÌNH / KHO TRANG BỊ" in roster_copy,
		"production Hero Roster uses the approved equipment/team presentation",
	)
	_expect((roster as Control).get_combined_minimum_size().x <= 624.0, "Hero Roster fits the 640px logical viewport without horizontal overflow")
	roster.free()

	var tutorial_source := FileAccess.get_file_as_string("res://game/tutorial/level_one_tutorial.gd")
	_expect(
		"sword_combo" in tutorial_source
		and "pursuit_execution" in tutorial_source
		and "soul_echo" in tutorial_source,
		"production tutorial covers all K-Night combo stages and Linh Hồn Chiến Binh",
	)
	_expect(not "bow_reward" in tutorial_source and not "weapon_swap" in tutorial_source, "production tutorial has no legacy reward or swap step")
	var level_document := FileAccess.get_file_as_string("res://data/levels/crypt_entrance.json")
	_expect(not "\"bow_reward\"" in level_document, "production training map has no legacy reward entity")


func _instantiate(scene_path: String) -> Node:
	var packed := load(scene_path) as PackedScene
	_expect(packed != null, "scene resource loads: %s" % scene_path.get_file())
	var instance := packed.instantiate()
	root.add_child(instance)
	return instance


func _count_group_below(node: Node, group: StringName) -> int:
	var count := 1 if node.is_in_group(group) else 0
	for child: Node in node.get_children():
		count += _count_group_below(child, group)
	return count


func _collect_group_ids_below(node: Node, group: StringName, property: StringName) -> Array[StringName]:
	var ids: Array[StringName] = []
	if node.is_in_group(group):
		ids.append(StringName(node.get(property)))
	for child: Node in node.get_children():
		ids.append_array(_collect_group_ids_below(child, group, property))
	return ids


func _nodes_in_group_below(node: Node, group: StringName) -> Array[Node]:
	var matches: Array[Node] = []
	if node.is_in_group(group):
		matches.append(node)
	for child: Node in node.get_children():
		matches.append_array(_nodes_in_group_below(child, group))
	return matches


func _collect_visible_text(node: Node) -> String:
	var values: Array[String] = []
	if node is Label and (node as Label).is_visible_in_tree():
		values.append((node as Label).text)
	elif node is Button and (node as Button).is_visible_in_tree():
		values.append((node as Button).text)
	for child: Node in node.get_children():
		values.append(_collect_visible_text(child))
	return "\n".join(values)


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)
