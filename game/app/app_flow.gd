extends Node

## Product navigation and transient run state. Persistent progression remains
## owned by SaveService/UnlockService; this singleton stores IDs/snapshots only.

const BOOT_SCENE := "res://game/ui/screens/boot/boot_screen.tscn"
const TITLE_SCENE := "res://game/ui/screens/title/title_screen.tscn"
const HOME_SCENE := "res://game/ui/screens/home/home_map_screen.tscn"
# Compatibility constant for old tools/bookmarks. Product navigation now calls
# this place Home and enters it without opening a menu panel by default.
const HUB_SCENE := HOME_SCENE
const LEVEL_DETAILS_SCENE := "res://game/ui/screens/level_details/training_details_screen.tscn"
const SETTINGS_SCENE := "res://game/ui/screens/settings/settings_screen.tscn"
const CREDITS_SCENE := "res://game/ui/screens/credits/credits_screen.tscn"
const GAMEPLAY_SCENE := "res://game/main.tscn"
const DEFAULT_CAMPAIGN_LEVEL_ID := &"chapter_1_level_1"
const TRAINING_LEVEL_ID := &"training_crypt"
const CAMPAIGN_UNLOCK_RECONCILIATION_TRANSACTION := "campaign:unlock_reconciliation:v2"
const CAMPAIGN_VISIBLE_REWARD_RECONCILIATION_TRANSACTION := "campaign:visible_reward_reconciliation:v4"
const CAMPAIGN_CONTENT_ENTITLEMENT_RECONCILIATION_TRANSACTION := "campaign:content_entitlement_reconciliation:v6"
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const SANDBOX_REGISTRY: LevelRegistry = preload("res://data/content/registries/sandbox_content_registry.tres")
const CAMPAIGN_REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const DIFFICULTY_RULES := preload("res://game/meta/progression/difficulty_rules.gd")

var _app_root: Node
var _active_run: Dictionary = {}
var _last_result: Dictionary = {}
var _settings_return := &"home"
var _credits_return := &"home"
var _current_route := &""
var _current_home_function := &""
var _run_serial := 0


func attach_app_root(app_root: Node) -> void:
	_app_root = app_root
	var save_service := get_node_or_null("/root/SaveService")
	var already_had_v2_reconciliation := save_service != null \
		and save_service.has_method(&"is_transaction_applied") \
		and bool(save_service.call(
			&"is_transaction_applied",
			CAMPAIGN_UNLOCK_RECONCILIATION_TRANSACTION,
		))
	_reconcile_campaign_unlocks()
	# Profiles that already consumed v2 need the latest v4 entitlement pass. A
	# profile receiving v2 now gets the same repairs inside that one revision.
	if already_had_v2_reconciliation:
		_reconcile_campaign_visible_rewards()
	# v6 is deliberately independent from the older v2/v4/v5 receipts. It also
	# reconciles the Armor/Boots/Jewelry taxonomy in place by stable entitlement
	# UUID, while retaining every later Chapter 1 Soul and feature repair.
	_reconcile_campaign_content_entitlements()


func detach_app_root(app_root: Node) -> void:
	if _app_root == app_root:
		_app_root = null


func get_current_route() -> StringName:
	return _current_route


func get_current_hub_tab() -> StringName:
	return _current_home_function


func get_current_home_function() -> StringName:
	return _current_home_function


func open_boot() -> void:
	_show(BOOT_SCENE, {}, &"boot")


func open_title() -> void:
	_show(TITLE_SCENE, {}, &"title")


func open_home(function_id: StringName = &"") -> void:
	var normalized := function_id
	# Keep the old route as a compatibility alias for stale bookmarks and saved
	# UI state. New code and every player-facing label use Hero Roster.
	if normalized == &"arsenal":
		normalized = &"hero_roster"
	if normalized not in [&"", &"campaign", &"hero_roster", &"storage", &"modes", &"bestiary", &"settings", &"credits"]:
		normalized = &""
	_current_home_function = normalized
	_show(HOME_SCENE, {"function_id": normalized, "hub_tab": normalized}, &"home")


func open_hub(tab_id: StringName = &"") -> void:
	# Compatibility API for gameplay/tests that still use the old product term.
	open_home(tab_id)


func set_current_home_function(function_id: StringName) -> void:
	if function_id in [&"", &"campaign", &"hero_roster", &"storage", &"modes", &"bestiary", &"settings", &"credits"]:
		_current_home_function = function_id


func open_level_details(level_id: StringName = DEFAULT_CAMPAIGN_LEVEL_ID) -> void:
	var resolved_id := level_id
	var mode_id := &"campaign"
	if level_id == TRAINING_LEVEL_ID:
		mode_id = &"training"
	elif CAMPAIGN_REGISTRY.find_level(level_id) == null:
		resolved_id = DEFAULT_CAMPAIGN_LEVEL_ID
	_show(LEVEL_DETAILS_SCENE, {
		"level_id": resolved_id,
		"mode_id": mode_id,
		"level": get_level_details(resolved_id),
	}, &"level_details")


func open_settings(return_route: StringName = &"home") -> void:
	_settings_return = return_route
	_show(SETTINGS_SCENE, {"return_route": return_route}, &"settings")


func return_from_settings() -> void:
	if _settings_return in [&"home", &"hub"]:
		open_home()
	else:
		open_title()


func open_credits(return_route: StringName = &"home") -> void:
	_credits_return = return_route
	_show(CREDITS_SCENE, {"return_route": return_route}, &"credits")


func return_from_credits() -> void:
	if _credits_return in [&"home", &"hub"]:
		open_home()
	else:
		open_title()


func start_training() -> void:
	_begin_run(
		TRAINING_LEVEL_ID,
		&"training",
		SANDBOX_REGISTRY.find_level(&"crypt_entrance_sandbox"),
		DIFFICULTY_RULES.EASY,
	)


func start_campaign_level(
		level_id: StringName = DEFAULT_CAMPAIGN_LEVEL_ID,
		difficulty_id: StringName = &"",
) -> bool:
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	if definition == null or not definition.is_campaign_ready() or not is_campaign_level_unlocked(level_id):
		return false
	var requested := get_selected_campaign_difficulty(level_id) \
		if difficulty_id.is_empty() else StringName(String(difficulty_id).strip_edges().to_lower())
	if not DIFFICULTY_RULES.is_valid_id(requested):
		return false
	if not is_campaign_level_completed(level_id) and requested != DIFFICULTY_RULES.EASY:
		return false
	if is_campaign_level_completed(level_id) \
			and requested != get_selected_campaign_difficulty(level_id) \
			and not select_campaign_level_difficulty(level_id, requested):
		return false
	_begin_run(level_id, &"campaign", definition, requested)
	return true


func start_level(level_id: StringName) -> bool:
	if level_id == TRAINING_LEVEL_ID:
		start_training()
		return true
	return start_campaign_level(level_id)


func get_selected_campaign_difficulty(level_id: StringName) -> StringName:
	# Difficulty tiers are a replay reward. A stale/migrated selection must never
	# bypass the first-clear Easy rule for an uncleared stage.
	if not is_campaign_level_completed(level_id):
		return DIFFICULTY_RULES.EASY
	var campaign := _get_campaign_progression()
	var selected_value: Variant = campaign.get("selected_difficulties", {})
	if selected_value is Dictionary:
		return DIFFICULTY_RULES.normalize_id(
			(selected_value as Dictionary).get(String(level_id), DIFFICULTY_RULES.EASY)
		)
	return DIFFICULTY_RULES.EASY


func get_available_campaign_difficulties(level_id: StringName) -> Array[StringName]:
	var result: Array[StringName] = []
	if CAMPAIGN_REGISTRY.find_level(level_id) == null or not is_campaign_level_unlocked(level_id):
		return result
	result.assign(DIFFICULTY_RULES.available_ids(is_campaign_level_completed(level_id)))
	return result


func get_difficulty_options(level_id: StringName) -> Array[Dictionary]:
	var available := get_available_campaign_difficulties(level_id)
	var options: Array[Dictionary] = []
	for option: Dictionary in DIFFICULTY_RULES.get_options():
		var copy := option.duplicate(true)
		copy["available"] = StringName(copy.get("id", &"")) in available
		copy["selected"] = StringName(copy.get("id", &"")) \
			== get_selected_campaign_difficulty(level_id)
		options.append(copy)
	return options


func select_campaign_level_difficulty(level_id: StringName, difficulty_id: StringName) -> bool:
	var normalized := StringName(String(difficulty_id).strip_edges().to_lower())
	if not DIFFICULTY_RULES.is_valid_id(normalized) \
			or normalized not in get_available_campaign_difficulties(level_id):
		return false
	if get_selected_campaign_difficulty(level_id) == normalized:
		return true
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"set_campaign_level_difficulty"):
		return false
	var revision := 0
	if save_service.has_method(&"get_value"):
		var revision_path: Array[String] = ["revision"]
		revision = int(save_service.call(&"get_value", revision_path, 0))
	return bool(save_service.call(
		&"set_campaign_level_difficulty",
		level_id,
		normalized,
		"campaign:difficulty:%s:%s:%d" % [level_id, normalized, revision + 1],
	))


func has_active_run() -> bool:
	return not _active_run.is_empty()


func get_active_run() -> Dictionary:
	return _active_run.duplicate(true)


func get_last_result() -> Dictionary:
	return _last_result.duplicate(true)


func complete_active_run(result: Dictionary = {}, persist_progression := true) -> void:
	if _active_run.is_empty():
		return
	_last_result = result.duplicate(true)
	_last_result["run_id"] = String(_active_run.get("run_id", "run"))
	_last_result["level_id"] = StringName(_active_run.get("level_id", TRAINING_LEVEL_ID))
	_last_result["mode_id"] = StringName(_active_run.get("mode_id", &"training"))
	_last_result["campaign_slot"] = int(_active_run.get("campaign_slot", 0))
	_last_result["level_display_name"] = String(_active_run.get("level_display_name", ""))
	_last_result["difficulty"] = StringName(_active_run.get("difficulty", DIFFICULTY_RULES.EASY))
	_last_result["difficulty_modifiers"] = (
		_active_run.get("difficulty_modifiers", {}) as Dictionary
	).duplicate(true)
	_last_result["outcome"] = &"victory"
	if not _last_result.has("duration_seconds"):
		var started_msec := int(_active_run.get("started_msec", Time.get_ticks_msec()))
		_last_result["duration_seconds"] = maxf(0.0, float(Time.get_ticks_msec() - started_msec) / 1000.0)
	if persist_progression and StringName(_active_run.get("mode_id", &"training")) == &"campaign":
		var reward_result := _commit_campaign_completion(
			StringName(_active_run.get("level_id", DEFAULT_CAMPAIGN_LEVEL_ID)),
			String(_active_run.get("run_id", "")),
		)
		if not reward_result.is_empty():
			_last_result["reward"] = reward_result
	var options := get_continuation_options()
	_last_result["continuation"] = options.duplicate(true)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"run_completion_ready"):
		events.emit_signal(
			&"run_completion_ready",
			_last_result.duplicate(true),
			options.duplicate(true),
		)


func complete_training(result: Dictionary = {}) -> void:
	# Compatibility surface for older HUD/test callers. Completion authority is
	# now mode-aware so a campaign run cannot accidentally be recorded as training.
	complete_active_run(result)


func abort_to_hub(tab_id: StringName = &"") -> void:
	_active_run.clear()
	_last_result.clear()
	open_home(tab_id)


func abort_to_home() -> void:
	_active_run.clear()
	_last_result.clear()
	open_home()


func retry_active_run() -> void:
	if _active_run.is_empty():
		start_campaign_level(DEFAULT_CAMPAIGN_LEVEL_ID)
		return
	_active_run["run_id"] = _new_run_id(StringName(_active_run.get("mode_id", &"run")))
	_active_run["started_msec"] = Time.get_ticks_msec()
	_last_result.clear()
	_configure_game_session_for_active_run()
	_show(GAMEPLAY_SCENE, _active_run.duplicate(true), &"gameplay")


## Lightweight post-clear contract. Presentation may render only Continue/Home,
## while this snapshot also powers the optional level/replay picker without a
## separate summary authority.
func get_continuation_options() -> Dictionary:
	var source := _last_result if not _last_result.is_empty() else _active_run
	var level_id := StringName(source.get("level_id", &""))
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	if definition == null:
		return {
			"can_continue": false,
			"can_replay": false,
			"can_return_home": true,
			"levels": [],
		}
	var next_definition := CAMPAIGN_REGISTRY.find_campaign_level(definition.campaign_slot + 1)
	var next_available := next_definition != null \
		and next_definition.is_campaign_ready() \
		and is_campaign_level_unlocked(next_definition.level_id)
	var level_options: Array[Dictionary] = []
	for candidate: LevelDefinition in CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false):
		if candidate == null or not candidate.is_campaign_ready():
			continue
		if not is_campaign_level_unlocked(candidate.level_id) \
				and not is_campaign_level_completed(candidate.level_id):
			continue
		level_options.append(get_level_details(candidate.level_id))
	return {
		"current_level_id": level_id,
		"current_difficulty": StringName(source.get("difficulty", DIFFICULTY_RULES.EASY)),
		"can_continue": next_available,
		"next_level_id": next_definition.level_id if next_available else &"",
		"can_replay": is_campaign_level_completed(level_id),
		"can_return_home": true,
		"levels": level_options,
	}


func continue_to_next_campaign_level() -> bool:
	var options := get_continuation_options()
	if not bool(options.get("can_continue", false)):
		return false
	var next_level_id := StringName(options.get("next_level_id", &""))
	# A first visit always begins on Easy; an already-cleared next stage remembers
	# the player's own farming difficulty.
	var difficulty := get_selected_campaign_difficulty(next_level_id) \
		if is_campaign_level_completed(next_level_id) else DIFFICULTY_RULES.EASY
	return start_campaign_level(next_level_id, difficulty)


func replay_completed_level(
		level_id: StringName = &"",
		difficulty_id: StringName = &"",
) -> bool:
	var replay_level := level_id
	if replay_level.is_empty():
		var options := get_continuation_options()
		replay_level = StringName(options.get("current_level_id", &""))
	if replay_level.is_empty() or not is_campaign_level_completed(replay_level):
		return false
	return start_campaign_level(replay_level, difficulty_id)


func start_campaign_level_from_picker(
		level_id: StringName,
		difficulty_id: StringName = &"",
) -> bool:
	return start_campaign_level(level_id, difficulty_id)


func return_home_after_completion() -> void:
	_active_run.clear()
	_last_result.clear()
	open_home(&"campaign")


func get_level_details(level_id: StringName) -> Dictionary:
	if level_id == TRAINING_LEVEL_ID:
		var sandbox := SANDBOX_REGISTRY.find_level(&"crypt_entrance_sandbox")
		return {
			"level_id": TRAINING_LEVEL_ID,
			"mode_id": &"training",
			"display_name": "Sân Tập Hầm Mộ",
			"objective_summary": sandbox.objective_summary if sandbox != null else "Luyện tập tự do trong hầm mộ.",
			"layout_data_path": sandbox.layout_data_path if sandbox != null else "res://data/levels/crypt_training_sandbox.json",
			"unlocked": true,
			"completed": false,
			"selected_difficulty": DIFFICULTY_RULES.EASY,
			"available_difficulties": [DIFFICULTY_RULES.EASY],
			"difficulty_options": DIFFICULTY_RULES.get_options(),
		}
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	if definition == null:
		return {}
	return {
		"level_id": definition.level_id,
		"mode_id": &"campaign",
		"display_name": definition.display_name,
		"objective_summary": definition.objective_summary,
		"layout_data_path": definition.layout_data_path,
		"campaign_slot": definition.campaign_slot,
		"chapter_number": definition.chapter_number,
		"chapter_level_number": definition.chapter_level_number,
		"recommended_mastery": definition.recommended_mastery,
		"unlocked": is_campaign_level_unlocked(definition.level_id),
		"completed": is_campaign_level_completed(definition.level_id),
		"selected_difficulty": get_selected_campaign_difficulty(definition.level_id),
		"available_difficulties": get_available_campaign_difficulties(definition.level_id),
		"difficulty_options": get_difficulty_options(definition.level_id),
	}


func get_campaign_level_summary(campaign_slot: int) -> Dictionary:
	var definition := CAMPAIGN_REGISTRY.find_campaign_level(campaign_slot)
	return {} if definition == null else get_level_details(definition.level_id)


func is_campaign_level_unlocked(level_id: StringName) -> bool:
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	if definition == null or not definition.is_campaign_ready():
		return false
	var campaign := _get_campaign_progression()
	if not _meets_campaign_level_requirements(definition, campaign):
		return false
	if definition.campaign_slot == 1:
		return true
	var unlocked: Variant = campaign.get("unlocked_levels", [])
	if unlocked is Array and (unlocked as Array).has(String(level_id)):
		return true
	# Older saves may already contain a completion receipt from before sequential
	# unlocks were implemented. Prerequisites remain the durable source of truth,
	# so those profiles can continue without replaying an idempotent transaction.
	var prerequisites := definition.unlock_requirements.prerequisite_level_ids
	if prerequisites.is_empty():
		return false
	return true


func _meets_campaign_level_requirements(
		definition: LevelDefinition,
		campaign: Dictionary,
) -> bool:
	var requirements := definition.unlock_requirements
	if requirements == null:
		return false
	var completed_value: Variant = campaign.get("completed_levels", {})
	if not completed_value is Dictionary:
		return false
	var completed: Dictionary = completed_value
	for prerequisite_id: String in requirements.prerequisite_level_ids:
		if not bool(completed.get(prerequisite_id, false)):
			return false

	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"get_value"):
		return requirements.required_feature_ids.is_empty() \
			and requirements.minimum_account_level <= 0 \
			and requirements.minimum_total_mastery <= 0 \
			and requirements.custom_condition_id.is_empty()
	var features_path: Array[String] = ["progression", "features"]
	var features_value: Variant = save_service.call(
		&"get_value",
		features_path,
		{},
	)
	if not features_value is Dictionary:
		return false
	var features: Dictionary = features_value
	for feature_id: String in requirements.required_feature_ids:
		if not bool(features.get(feature_id, false)):
			return false
	var account_level_path: Array[String] = ["progression", "player", "level"]
	var account_level := int(save_service.call(
		&"get_value",
		account_level_path,
		1,
	))
	if account_level < requirements.minimum_account_level:
		return false
	if requirements.minimum_total_mastery > 0:
		var mastery_path: Array[String] = ["mastery"]
		var mastery_value: Variant = save_service.call(&"get_value", mastery_path, {})
		if not mastery_value is Dictionary \
				or _sum_campaign_mastery(mastery_value) < requirements.minimum_total_mastery:
			return false
	# There is no registered custom-condition evaluator yet. Unknown authored
	# conditions therefore fail closed instead of silently opening content.
	return requirements.custom_condition_id.is_empty()


func _sum_campaign_mastery(mastery: Dictionary) -> int:
	var total := 0
	for value: Variant in mastery.values():
		if value is int or value is float:
			total += maxi(0, int(value))
		elif value is Dictionary:
			var record: Dictionary = value
			var amount: Variant = record.get("total", record.get("xp", 0))
			if amount is int or amount is float:
				total += maxi(0, int(amount))
	return total


func is_campaign_level_completed(level_id: StringName) -> bool:
	var completed: Variant = _get_campaign_progression().get("completed_levels", {})
	return completed is Dictionary and bool((completed as Dictionary).get(String(level_id), false))


func _begin_run(
		level_id: StringName,
		mode_id: StringName,
		definition: LevelDefinition,
		difficulty_id: StringName = DIFFICULTY_RULES.EASY,
) -> void:
	if definition == null:
		push_error("AppFlow cannot start missing level content '%s'." % level_id)
		return
	var difficulty := DIFFICULTY_RULES.normalize_id(difficulty_id)
	var stage_level := maxi(1, definition.campaign_slot)
	_active_run = {
		"run_id": _new_run_id(mode_id),
		"level_id": level_id,
		"content_level_id": definition.level_id,
		"level_display_name": definition.display_name,
		"layout_data_path": definition.layout_data_path,
		"campaign_slot": definition.campaign_slot,
		"stage_level": stage_level,
		"average_enemy_level": definition.resolved_average_enemy_level(),
		"mode_id": mode_id,
		"difficulty": difficulty,
		"difficulty_modifiers": DIFFICULTY_RULES.stage_modifiers(stage_level, difficulty),
		"started_msec": Time.get_ticks_msec(),
		"soul_team": _get_soul_team(),
	}
	_last_result.clear()
	_configure_game_session_for_active_run()
	_show(GAMEPLAY_SCENE, _active_run.duplicate(true), &"gameplay")


func _get_soul_team() -> Dictionary:
	var soul_team := {
		"active_hero": "sword_hero",
		"reserve_souls": ["", ""],
		"capacity": 2,
		"selected_soul_instances": {},
	}
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_method(&"get_value"):
		var active_path: Array[String] = ["soul_team", "active_hero"]
		var reserves_path: Array[String] = ["soul_team", "reserve_souls"]
		var capacity_path: Array[String] = ["soul_team", "capacity"]
		var selections_path: Array[String] = ["soul_team", "selected_soul_instances"]
		soul_team = {
			"active_hero": String(save_service.call("get_value", active_path, "sword_hero")),
			"reserve_souls": save_service.call("get_value", reserves_path, ["", ""]),
			"capacity": int(save_service.call("get_value", capacity_path, 2)),
			"selected_soul_instances": save_service.call("get_value", selections_path, {}),
		}
	return soul_team.duplicate(true)


func _configure_game_session_for_active_run() -> void:
	if _active_run.is_empty():
		return
	var session := get_node_or_null("/root/GameSession")
	if session == null or not session.has_method(&"configure_run"):
		return
	session.call(
		&"configure_run",
		String(_active_run.get("run_id", "")),
		StringName(_active_run.get("level_id", &"")),
		int(_active_run.get("stage_level", _active_run.get("campaign_slot", 1))),
		StringName(_active_run.get("difficulty", DIFFICULTY_RULES.EASY)),
	)


func _get_campaign_progression() -> Dictionary:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"get_value"):
		return {}
	var campaign_path: Array[String] = ["progression", "campaign"]
	var value: Variant = save_service.call("get_value", campaign_path, {})
	return value if value is Dictionary else {}


func _commit_campaign_completion(level_id: StringName, completed_run_id := "") -> Dictionary:
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	var save_service := get_node_or_null("/root/SaveService")
	if definition == null or save_service == null or not save_service.has_method(&"transact_once"):
		return {}
	var transaction_key := String(definition.completion_transaction_id)
	if transaction_key.is_empty():
		transaction_key = "campaign:%s:complete" % level_id
	var reward_bundle: RewardBundleDefinition
	if not definition.completion_reward_bundle_id.is_empty():
		reward_bundle = CAMPAIGN_REWARDS.find_bundle(definition.completion_reward_bundle_id)
		if reward_bundle == null:
			push_error(
				"Campaign level '%s' references missing reward bundle '%s'." % [
					level_id,
					definition.completion_reward_bundle_id,
				]
			)
			return {
				"bundle_id": String(definition.completion_reward_bundle_id),
				"grant_rule": "first_clear",
				"granted": false,
				"already_claimed": false,
				"error": "missing_bundle",
			}
	var previous_player_level := _get_player_level(save_service)

	var applied := bool(save_service.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			if reward_bundle != null and not reward_bundle.apply_to_candidate(candidate):
				return false
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			# LevelDefinition is the campaign feature contract. Apply those grants in
			# this same completion/reward transaction so a crash cannot persist the
			# clear without its declared feature grants (or apply them through a second authority).
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			for feature_id: String in definition.granted_feature_ids:
				features[feature_id] = true
			progression["features"] = features
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
			completed[String(level_id)] = true
			campaign["completed_levels"] = completed
			var unlocked: Array = []
			var raw_unlocked: Variant = campaign.get("unlocked_levels", [])
			if raw_unlocked is Array:
				unlocked = (raw_unlocked as Array).duplicate()
			if not unlocked.has(String(level_id)):
				unlocked.append(String(level_id))
			var next_level := CAMPAIGN_REGISTRY.find_campaign_level(definition.campaign_slot + 1)
			if next_level != null and next_level.is_campaign_ready() \
					and not unlocked.has(String(next_level.level_id)):
				unlocked.append(String(next_level.level_id))
			var highest_unlocked_average := definition.resolved_average_enemy_level()
			if next_level != null and next_level.is_campaign_ready():
				highest_unlocked_average = next_level.resolved_average_enemy_level()
			campaign["average_enemy_level_cap"] = maxi(
				int(campaign.get("average_enemy_level_cap", 5)),
				highest_unlocked_average,
			)
			campaign["unlocked_levels"] = unlocked
			campaign["chapter"] = maxi(int(campaign.get("chapter", 1)), definition.chapter_number)
			campaign["level"] = maxi(int(campaign.get("level", 1)), definition.campaign_slot)
			progression["campaign"] = campaign
			candidate["progression"] = progression
			# A Level 10 first clear also stamps the originating run receipt inside
			# this same atomic mutation. Replaying a completion callback after a
			# crash can therefore never misclassify that first-clear run as a paid
			# Hunt replay.
			if level_id == &"chapter_1_level_10" and not completed_run_id.strip_edges().is_empty():
				var transactions: Dictionary = candidate.get("applied_transactions", {}).duplicate(true)
				transactions[_level_ten_run_receipt_id(completed_run_id)] = {
					"applied_at_unix": int(Time.get_unix_time_from_system()),
					"metadata": {
						"kind": "campaign_boss_first_clear_run_receipt",
						"level_id": "chapter_1_level_10",
					},
				}
				candidate["applied_transactions"] = transactions
			return true,
		{
			"kind": "campaign_level_completion",
			"level_id": String(level_id),
			"reward_bundle_id": String(definition.completion_reward_bundle_id),
			"grant_rule": "first_clear",
		}
	))
	if reward_bundle == null:
		return {}
	var current_player_level := _get_player_level(save_service)
	if applied and current_player_level > previous_player_level:
		_emit_completion_level_up(
			save_service,
			current_player_level,
			current_player_level - previous_player_level,
		)
	var reward_result := reward_bundle.to_summary()
	reward_result["unlocks"] = Array(definition.granted_feature_ids)
	_annotate_auxiliary_reward_outcomes(reward_result, save_service, applied)
	reward_result["transaction_id"] = transaction_key
	reward_result["granted"] = applied
	var already_claimed := false
	if not applied and save_service.has_method(&"is_transaction_applied"):
		already_claimed = bool(save_service.call(&"is_transaction_applied", transaction_key))
	reward_result["already_claimed"] = already_claimed
	if level_id == &"chapter_1_level_10" and already_claimed:
		reward_result["replay_reward"] = _commit_level_ten_replay_bounty(
			save_service,
			completed_run_id,
		)
	if not applied and not already_claimed:
		reward_result["error"] = "commit_failed"
	reward_result["first_clear"] = applied
	reward_result["replay"] = already_claimed
	reward_result["previous_player_level"] = previous_player_level
	reward_result["current_player_level"] = current_player_level
	reward_result["player_level_gained"] = maxi(0, current_player_level - previous_player_level) if applied else 0
	return reward_result


func _emit_completion_level_up(
		save_service: Node,
		current_level: int,
		levels_gained: int,
) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events == null or levels_gained <= 0:
		return
	var xp := 0
	var required := 0
	if save_service != null and save_service.has_method(&"get_player_progression_snapshot"):
		var snapshot: Dictionary = save_service.call(&"get_player_progression_snapshot")
		xp = int(snapshot.get("xp", 0))
		required = int(snapshot.get("xp_required", 0))
	if events.has_signal(&"player_experience_changed"):
		events.emit_signal(&"player_experience_changed", xp, required, 0)
	if events.has_signal(&"player_level_changed"):
		events.emit_signal(&"player_level_changed", current_level, levels_gained)


## Chapter bosses remain worth replaying without duplicating their first-clear
## Soul, player level, or feature entitlements. The active run ID is hashed into
## a per-clear receipt: repeating the completion callback after a crash is safe,
## while a genuine Retry/new run receives one fresh, deliberately smaller bounty.
func _commit_level_ten_replay_bounty(save_service: Node, completed_run_id: String) -> Dictionary:
	const REPLAY_CURRENCIES := {
		"account": 120,
		"hero_materials": 2,
		"monster_fragments": 1,
	}
	var normalized_run_id := completed_run_id.strip_edges()
	if normalized_run_id.is_empty() or save_service == null \
			or not save_service.has_method(&"transact_once"):
		return {
			"grant_rule": "completed_boss_run",
			"granted": false,
			"already_claimed": false,
			"currencies": REPLAY_CURRENCIES.duplicate(true),
			"error": "missing_run_receipt",
		}
	var run_receipt_id := _level_ten_run_receipt_id(normalized_run_id)
	if save_service.has_method(&"is_transaction_applied") \
			and bool(save_service.call(&"is_transaction_applied", run_receipt_id)):
		return {
			"grant_rule": "completed_boss_run",
			"granted": false,
			"already_claimed": true,
			"first_clear_run": true,
			"transaction_id": run_receipt_id,
			"currencies": REPLAY_CURRENCIES.duplicate(true),
		}
	var transaction_key := "campaign:chapter_1_level_10:replay:%s" % normalized_run_id.sha256_text().substr(0, 20)
	var applied := bool(save_service.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var currencies_value: Variant = candidate.get("currencies", {})
			if not currencies_value is Dictionary:
				return false
			var currencies: Dictionary = (currencies_value as Dictionary).duplicate(true)
			for currency_id: String in REPLAY_CURRENCIES:
				var current: Variant = currencies.get(currency_id, 0)
				if not current is int and not current is float:
					return false
				var next_amount := int(current) + int(REPLAY_CURRENCIES[currency_id])
				if int(current) < 0 or next_amount < int(current):
					return false
				currencies[currency_id] = next_amount
			candidate["currencies"] = currencies
			return true,
		{
			"kind": "campaign_boss_replay_reward",
			"level_id": "chapter_1_level_10",
			"run_receipt": normalized_run_id,
		}
	))
	var already_claimed := not applied and save_service.has_method(&"is_transaction_applied") \
		and bool(save_service.call(&"is_transaction_applied", transaction_key))
	return {
		"grant_rule": "completed_boss_run",
		"transaction_id": transaction_key,
		"granted": applied,
		"already_claimed": already_claimed,
		"currencies": REPLAY_CURRENCIES.duplicate(true),
	}


func _level_ten_run_receipt_id(run_id: String) -> String:
	return "campaign:chapter_1_level_10:first_clear_run:%s" % run_id.strip_edges().sha256_text().substr(0, 20)


func _reconcile_campaign_unlocks() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"transact_once"):
		return
	save_service.call(
		&"transact_once",
		CAMPAIGN_UNLOCK_RECONCILIATION_TRANSACTION,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			var completed_reward_bundles: Array[RewardBundleDefinition] = []
			var earned_level_delta := 0
			var unlocked: Array = []
			var raw_unlocked: Variant = campaign.get("unlocked_levels", [])
			if raw_unlocked is Array:
				unlocked = (raw_unlocked as Array).duplicate()
			for level: LevelDefinition in CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false):
				var should_unlock := level.campaign_slot == 1
				if not should_unlock and level.unlock_requirements != null:
					var prerequisites := level.unlock_requirements.prerequisite_level_ids
					should_unlock = not prerequisites.is_empty()
					for prerequisite_id: String in prerequisites:
						if not bool(completed.get(prerequisite_id, false)):
							should_unlock = false
							break
				if should_unlock and not unlocked.has(String(level.level_id)):
					unlocked.append(String(level.level_id))
				if bool(completed.get(String(level.level_id), false)):
					for feature_id: String in level.granted_feature_ids:
						features[feature_id] = true
				if bool(completed.get(String(level.level_id), false)) \
						and not level.completion_reward_bundle_id.is_empty():
					var reward_bundle := CAMPAIGN_REWARDS.find_bundle(level.completion_reward_bundle_id)
					if reward_bundle == null:
						return false
					completed_reward_bundles.append(reward_bundle)
					earned_level_delta += maxi(0, reward_bundle.player_level_grant)
			campaign["unlocked_levels"] = unlocked
			progression["campaign"] = campaign
			progression["features"] = features
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			player["level"] = maxi(
				int(player.get("level", 1)),
				mini(100, 1 + earned_level_delta),
			)
			progression["player"] = player
			candidate["progression"] = progression
			for reward_bundle: RewardBundleDefinition in completed_reward_bundles:
				if not reward_bundle.reconcile_unique_grants_to_candidate(candidate):
					return false
			# A profile receiving v2 for the first time already receives every v4
			# repair above. Stamp both receipts in this same atomic revision; only
			# profiles that had an older v2 receipt need the separate v4 pass.
			var transactions: Dictionary = candidate.get("applied_transactions", {}).duplicate(true)
			if not transactions.has(CAMPAIGN_VISIBLE_REWARD_RECONCILIATION_TRANSACTION):
				transactions[CAMPAIGN_VISIBLE_REWARD_RECONCILIATION_TRANSACTION] = {
					"applied_at_unix": int(Time.get_unix_time_from_system()),
					"metadata": {
						"kind": "campaign_visible_reward_reconciliation",
						"registry": String(CAMPAIGN_REGISTRY.registry_id),
						"content_entitlement_version": 4,
					},
				}
			candidate["applied_transactions"] = transactions
			return true,
		{
			"kind": "campaign_unlock_and_unique_reward_reconciliation",
			"registry": String(CAMPAIGN_REGISTRY.registry_id),
			"content_entitlement_version": 2,
		},
	)


## Content entitlement migration for profiles that completed campaign levels
## before player-level and deterministic tutorial equipment rewards existed.
## Stackables and currencies are intentionally excluded. The minimum level is
## derived from completed first-clear bundles instead of incremented, making the
## repair deterministic and safe alongside unrelated/manual level grants.
func _reconcile_campaign_visible_rewards() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"transact_once"):
		return
	save_service.call(
		&"transact_once",
		CAMPAIGN_VISIBLE_REWARD_RECONCILIATION_TRANSACTION,
		func(candidate: Dictionary) -> bool:
			var progression_value: Variant = candidate.get("progression", {})
			if not progression_value is Dictionary:
				return false
			var progression: Dictionary = (progression_value as Dictionary).duplicate(true)
			var campaign_value: Variant = progression.get("campaign", {})
			var player_value: Variant = progression.get("player", {})
			if not campaign_value is Dictionary or not player_value is Dictionary:
				return false
			var completed_value: Variant = (campaign_value as Dictionary).get("completed_levels", {})
			if not completed_value is Dictionary:
				return false
			var completed: Dictionary = completed_value
			var completed_bundles: Array[RewardBundleDefinition] = []
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			var earned_level_delta := 0
			for level: LevelDefinition in CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false):
				if not bool(completed.get(String(level.level_id), false)):
					continue
				for feature_id: String in level.granted_feature_ids:
					features[feature_id] = true
				if level.completion_reward_bundle_id.is_empty():
					continue
				var bundle := CAMPAIGN_REWARDS.find_bundle(level.completion_reward_bundle_id)
				if bundle == null:
					return false
				completed_bundles.append(bundle)
				earned_level_delta += maxi(0, bundle.player_level_grant)
			if completed_bundles.is_empty():
				return false

			# Unlock the deterministic minimum level first so tutorial equipment can
			# be auto-equipped only when its slot is genuinely available.
			var player: Dictionary = (player_value as Dictionary).duplicate(true)
			var current_level := int(player.get("level", 1))
			var minimum_earned_level := mini(100, 1 + earned_level_delta)
			player["level"] = maxi(current_level, minimum_earned_level)
			progression["player"] = player
			progression["features"] = features
			candidate["progression"] = progression

			for bundle: RewardBundleDefinition in completed_bundles:
				if not bundle.reconcile_unique_grants_to_candidate(candidate):
					return false
			return true,
		{
			"kind": "campaign_visible_reward_reconciliation",
			"registry": String(CAMPAIGN_REGISTRY.registry_id),
			"content_entitlement_version": 4,
		},
	)


## Versioned content-entitlement repair for profiles whose older v2/v4/v5
## receipts predate later Chapter 1 promotions or the equipment taxonomy v6.
## Economy and stackable loot stay excluded:
## only deterministic unique grants, the minimum earned Player Level, declared
## features and legitimate sequential unlocks are reconstructed.
func _reconcile_campaign_content_entitlements() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"transact_once"):
		return
	save_service.call(
		&"transact_once",
		CAMPAIGN_CONTENT_ENTITLEMENT_RECONCILIATION_TRANSACTION,
		func(candidate: Dictionary) -> bool:
			var progression_value: Variant = candidate.get("progression", {})
			if not progression_value is Dictionary:
				return false
			var progression: Dictionary = (progression_value as Dictionary).duplicate(true)
			var campaign_value: Variant = progression.get("campaign", {})
			var player_value: Variant = progression.get("player", {})
			var features_value: Variant = progression.get("features", {})
			if not campaign_value is Dictionary or not player_value is Dictionary \
					or not features_value is Dictionary:
				return false
			var campaign: Dictionary = (campaign_value as Dictionary).duplicate(true)
			var completed_value: Variant = campaign.get("completed_levels", {})
			if not completed_value is Dictionary:
				return false
			var completed: Dictionary = completed_value
			var features: Dictionary = (features_value as Dictionary).duplicate(true)
			# Soul Focus was the retired crystal equipment slot. Crystals are upgrade
			# materials now, so v6 removes the stale feature instead of advertising a
			# live slot that no longer exists. Completed Level 7 grants soul_jewelry.
			features.erase("soul_focus")
			var completed_bundles: Array[RewardBundleDefinition] = []
			var earned_level_delta := 0
			var highest_completed_slot := 0

			# First gather every entitlement. This pass runs before unlock rebuilding so
			# Level 9's repaired boss-gate feature can legitimately satisfy Level 10.
			for level: LevelDefinition in CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false):
				if not bool(completed.get(String(level.level_id), false)):
					continue
				highest_completed_slot = maxi(highest_completed_slot, level.campaign_slot)
				for feature_id: String in level.granted_feature_ids:
					features[feature_id] = true
				if level.completion_reward_bundle_id.is_empty():
					continue
				var bundle := CAMPAIGN_REWARDS.find_bundle(level.completion_reward_bundle_id)
				if bundle == null:
					return false
				completed_bundles.append(bundle)
				earned_level_delta += maxi(0, bundle.player_level_grant)

			var player: Dictionary = (player_value as Dictionary).duplicate(true)
			var minimum_earned_level := mini(100, 1 + earned_level_delta)
			player["level"] = maxi(int(player.get("level", 1)), minimum_earned_level)
			progression["player"] = player
			progression["features"] = features

			# Rebuild the durable cache from authored requirements. Unknown/stale IDs
			# are discarded; is_campaign_level_unlocked still revalidates at runtime.
			var legitimate_unlocked: Array = []
			for level: LevelDefinition in CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false):
				if not level.is_campaign_ready():
					continue
				var should_unlock := level.campaign_slot == 1
				var requirements := level.unlock_requirements
				if requirements == null:
					should_unlock = false
				elif not should_unlock:
					should_unlock = not requirements.prerequisite_level_ids.is_empty()
					for prerequisite_id: String in requirements.prerequisite_level_ids:
						if not bool(completed.get(prerequisite_id, false)):
							should_unlock = false
							break
				if should_unlock and requirements != null:
					for feature_id: String in requirements.required_feature_ids:
						if not bool(features.get(feature_id, false)):
							should_unlock = false
							break
				if should_unlock:
					legitimate_unlocked.append(String(level.level_id))
			campaign["unlocked_levels"] = legitimate_unlocked
			if highest_completed_slot > 0:
				campaign["level"] = maxi(int(campaign.get("level", 1)), highest_completed_slot)
				campaign["chapter"] = maxi(
					int(campaign.get("chapter", 1)),
					LevelDefinition.get_chapter_for_campaign_slot(highest_completed_slot),
				)
			progression["campaign"] = campaign
			candidate["progression"] = progression

			for bundle: RewardBundleDefinition in completed_bundles:
				if not bundle.reconcile_unique_grants_to_candidate(candidate):
					return false
			return true,
		{
			"kind": "campaign_content_entitlement_reconciliation",
			"registry": String(CAMPAIGN_REGISTRY.registry_id),
			"content_entitlement_version": 6,
		},
	)


func _get_player_level(save_service: Node) -> int:
	if save_service == null or not save_service.has_method(&"get_value"):
		return 1
	var path: Array[String] = ["progression", "player", "level"]
	return clampi(int(save_service.call(&"get_value", path, 1)), 1, 100)


func _annotate_auxiliary_reward_outcomes(
		reward_result: Dictionary,
		save_service: Node,
		first_clear_applied: bool,
) -> void:
	var summaries_value: Variant = reward_result.get("auxiliary_equipment", [])
	if not summaries_value is Array or save_service == null \
			or not save_service.has_method(&"get_value"):
		return
	var loadout_path: Array[String] = ["auxiliary_loadout"]
	var loadout_value: Variant = save_service.call(&"get_value", loadout_path, {})
	if not loadout_value is Dictionary:
		return
	var loadout: Dictionary = loadout_value
	var summaries: Array = (summaries_value as Array).duplicate(true)
	for index: int in summaries.size():
		var summary_value: Variant = summaries[index]
		if not summary_value is Dictionary:
			continue
		var summary: Dictionary = (summary_value as Dictionary).duplicate(true)
		var equipped := String(loadout.get(String(summary.get("slot", "")), "")) \
			== String(summary.get("uuid", ""))
		summary["equipped"] = equipped
		summary["auto_equipped"] = first_clear_applied \
			and bool(summary.get("equip_if_slot_empty", false)) and equipped
		summaries[index] = summary
	reward_result["auxiliary_equipment"] = summaries


func _new_run_id(mode_id: StringName = &"run") -> String:
	_run_serial += 1
	return "%s_%d_%d" % [mode_id, Time.get_ticks_msec(), _run_serial]


func _show(scene_path: String, payload: Dictionary, route_id: StringName) -> void:
	if not is_instance_valid(_app_root) or not _app_root.has_method(&"show_route"):
		push_error("AppFlow has no attached AppRoot for route '%s'." % route_id)
		return
	_current_route = route_id
	_app_root.call("show_route", scene_path, payload, route_id)
