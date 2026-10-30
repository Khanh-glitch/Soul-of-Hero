extends Node2D

const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const SANDBOX_REGISTRY: LevelRegistry = preload("res://data/content/registries/sandbox_content_registry.tres")
const EncounterRuntimeStateScript := preload("res://game/content/encounters/encounter_runtime_state.gd")
const LevelFiveArcherRecruitmentRuntimeScript := preload("res://game/levels/objectives/level_5_archer_recruitment_runtime.gd")
const LevelSevenBeaconRuntimeScript := preload("res://game/levels/objectives/level_7_beacon_runtime.gd")
const LevelEightReliquaryRuntimeScript := preload("res://game/levels/objectives/level_8_reliquary_runtime.gd")
const LevelNineCrimsonGateRuntimeScript := preload("res://game/levels/objectives/level_9_crimson_gate_runtime.gd")
const LevelTenCastellanRuntimeScript := preload("res://game/levels/objectives/level_10_castellan_runtime.gd")
const ChapterTwoSpawnDirectorScript := preload("res://game/levels/objectives/chapter_2_spawn_director.gd")
const ChapterTwoLevelRuntimeScript := preload("res://game/levels/objectives/chapter_2_level_runtime.gd")
const DifficultyRulesScript := preload("res://game/meta/progression/difficulty_rules.gd")
const ProgressionPacingRulesScript := preload("res://game/meta/progression/progression_pacing_rules.gd")
const EncounterPackRulesScript := preload("res://game/content/encounters/encounter_pack_rules.gd")
const EnemyDifficultyScalerScript := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const EnemyRuntimeConfiguratorScript := preload(
	"res://game/characters/enemies/enemy_runtime_configurator.gd"
)
const NON_ENEMY_ENTITY_SCENES := {
	"coin": preload("res://game/world/interactables/coin.tscn"),
	"sigil": preload("res://game/world/interactables/sigil.tscn"),
	"soul_beacon": preload("res://game/world/interactables/soul_beacon.tscn"),
	"checkpoint": preload("res://game/world/interactables/checkpoint.tscn"),
	"chest": preload("res://game/world/interactables/chest.tscn"),
	"reliquary_branch_seal": preload("res://game/world/interactables/reliquary_branch_seal.tscn"),
	"gate_seal": preload("res://game/world/interactables/gate_seal.tscn"),
	"bow_reward": preload("res://game/world/interactables/bow_reward.tscn"),
	"exit_gate": preload("res://game/world/interactables/exit_gate.tscn"),
	"floor_door": preload("res://game/world/interactables/floor_door.tscn"),
	"spikes": preload("res://game/world/hazards/spikes.tscn"),
	"torch": preload("res://game/world/props/torch.tscn"),
}
const ENTITY_ID_META := &"level_entity_id"
const ENTITY_TYPE_META := &"level_entity_type"
const ENTITY_SIGNATURE_META := &"level_entity_config_signature"
const ENTITY_CONFIG_META := &"level_entity_config"

@onready var level: DungeonLevel = $Level
@onready var entity_root: Node2D = $Level/Entities
@onready var player: KnightController = $Knight

var _entity_signature := ""
var _player_spawn_position := Vector2.ZERO
var _entity_config_signatures: Dictionary = {}
var _encounter_runtime = EncounterRuntimeStateScript.new()
var _active_content_level: LevelDefinition
var _active_content_registry: LevelRegistry
var _special_level_runtime: Node
var _chapter_two_spawn_director: Node
var _enemy_xp_fractional_carry := 0.0
var _enemy_xp_fractional_carry_by_hero: Dictionary = {}
var _enemy_xp_carry_run_id := ""
var _processed_enemy_xp_receipts: Dictionary = {}
var _runtime_entities_cache: Array = []
var _runtime_plan_ready := false
var _enemy_population_context: Dictionary = {}
var _enemy_authority_errors := PackedStringArray()
var _reported_enemy_authority_errors: Dictionary = {}


func _ready() -> void:
	_install_debug_tools()
	_apply_active_run_level_source()
	_apply_level_presentation()
	_configure_active_run_session()
	_configure_active_run_soul_team()
	GameSession.configure_objective(int(level.level_data.get("metadata", {}).get("required_sigils", GameSession.DEFAULT_REQUIRED_SIGILS)))
	GameSession.reset_run()
	_configure_encounter_runtime()
	_refresh_runtime_plan()
	_prepare_top_down_entities()
	_place_player_and_camera()
	_spawn_level_entities()
	_configure_special_level_runtime()
	_report_web_level_readiness()
	_entity_signature = _get_entity_signature()
	if not GameEvents.map_changed.is_connected(_on_level_data_changed):
		GameEvents.map_changed.connect(_on_level_data_changed)
	# HUD may enter the tree before or after the character depending on editor
	# scene ordering. Re-emitting makes the registration deterministic.
	GameEvents.player_registered.emit(player)
	RealtimeBridge.publish_event("game_ready", get_runtime_snapshot())
	if OS.get_cmdline_user_args().has("--smoke-test"):
		var smoke_test: Node = (load("res://tests/smoke_test.gd") as GDScript).new()
		add_child(smoke_test)
		smoke_test.start(self)
	elif OS.get_cmdline_user_args().has("--living-arsenal-test"):
		var arsenal_test: Node = (load("res://tests/living_arsenal_runtime_test.gd") as GDScript).new()
		add_child(arsenal_test)
		arsenal_test.start(self)
	elif OS.get_cmdline_user_args().has("--axe-knight-test"):
		var axe_knight_test: Node = (load("res://tests/axe_knight_integration_test.gd") as GDScript).new()
		add_child(axe_knight_test)
		axe_knight_test.start(self)
	elif OS.get_cmdline_user_args().has("--auxiliary-equipment-knight-test"):
		var auxiliary_knight_test: Node = (load("res://tests/auxiliary_equipment_knight_integration_test.gd") as GDScript).new()
		add_child(auxiliary_knight_test)
		auxiliary_knight_test.start(self)
	elif OS.get_cmdline_user_args().has("--axe-soul-team-test"):
		var axe_soul_team_test: Node = (load("res://tests/axe_soul_team_runtime_test.gd") as GDScript).new()
		add_child(axe_soul_team_test)
		axe_soul_team_test.start(self)
	elif OS.get_cmdline_user_args().has("--hero-soul-instance-knight-test"):
		var soul_instance_test: Node = (load("res://tests/hero_soul_instance_knight_runtime_test.gd") as GDScript).new()
		add_child(soul_instance_test)
		soul_instance_test.start(self)
	elif OS.get_cmdline_user_args().has("--axe-form-capture"):
		var axe_form_capture: Node = (load("res://tests/axe_form_capture.gd") as GDScript).new()
		add_child(axe_form_capture)
		axe_form_capture.start(self)
	elif OS.get_cmdline_user_args().has("--sword-combo-capture"):
		var sword_combo_capture: Node = (load("res://tests/sword_combo_capture.gd") as GDScript).new()
		add_child(sword_combo_capture)
		sword_combo_capture.start(self)


## Browser playtest evidence: confirms that authored JSON entities became live
## scene nodes. Kept strictly read-only; never changes spawn/save/gameplay.
func _report_web_level_readiness() -> void:
	if not OS.has_feature("web"):
		return
	var counts := {}
	for child: Node in entity_root.get_children():
		if not child.has_meta(ENTITY_TYPE_META):
			continue
		var entity_type := String(child.get_meta(ENTITY_TYPE_META, ""))
		counts[entity_type] = int(counts.get(entity_type, 0)) + 1
	var report := {
		"layout": level.level_data_path,
		"authored_count": level.get_entities().size(),
		"instantiated_count": entity_root.get_child_count() - 1,
		"types": counts,
	}
	JavaScriptBridge.eval("window.__soulHeroLevelReady = " + JSON.stringify(report) + ";")


func _apply_active_run_level_source() -> void:
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow == null or not app_flow.has_method(&"get_active_run"):
		return
	var run: Dictionary = app_flow.call(&"get_active_run")
	if run.is_empty():
		return
	var data_path := String(run.get("layout_data_path", "")).strip_edges()
	if data_path.is_empty() or not FileAccess.file_exists(data_path):
		push_warning("Active run has no valid level layout: %s" % data_path)
		return
	if level.level_data_path != data_path:
		level.level_data_path = data_path
		level.reload_from_disk()


func _apply_level_presentation() -> void:
	var metadata: Dictionary = level.level_data.get("metadata", {})
	var tint := Color.WHITE
	var tint_value: Variant = metadata.get("world_tint", [])
	if tint_value is Array and (tint_value as Array).size() >= 3:
		var tint_channels: Array = tint_value as Array
		tint = Color(
			float(tint_channels[0]),
			float(tint_channels[1]),
			float(tint_channels[2]),
			float(tint_channels[3]) if tint_channels.size() >= 4 else 1.0,
		)
	var world_tint := get_node_or_null("WorldTint") as CanvasModulate
	if world_tint != null:
		world_tint.color = tint
	var backdrop := get_node_or_null("Background/Color") as Polygon2D
	if backdrop != null:
		backdrop.color = Color(0.028, 0.012, 0.060, 1.0) if bool(metadata.get("chapter_2_director", false)) else Color(0.036, 0.021, 0.058, 1.0)


func _configure_active_run_soul_team() -> void:
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow == null or not app_flow.has_method(&"get_active_run"):
		return
	var run: Dictionary = app_flow.call(&"get_active_run")
	if run.is_empty():
		return
	var team_value: Variant = run.get("soul_team", {})
	if not team_value is Dictionary:
		push_warning("Active run has no valid Soul Team snapshot; using the safe Sword fallback.")
		return
	if not player.has_method(&"configure_soul_team_from_run") \
			or not bool(player.call(&"configure_soul_team_from_run", team_value as Dictionary)):
		push_warning("Active run Soul Team could not be applied; using the safe Sword fallback.")


func _configure_active_run_session() -> void:
	var run: Dictionary = {}
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow != null and app_flow.has_method(&"get_active_run"):
		run = app_flow.call(&"get_active_run")
	var metadata: Dictionary = level.level_data.get("metadata", {})
	var stage_level := int(run.get("stage_level", run.get(
		"campaign_slot",
		metadata.get("difficulty_tier", 1),
	)))
	var level_id := StringName(run.get("level_id", level.level_data.get("name", "direct_level")))
	var run_id := String(run.get(
		"run_id",
		"direct_%s" % level.level_data_path.sha256_text().substr(0, 16),
	))
	var difficulty := DifficultyRulesScript.normalize_id(
		run.get("difficulty", DifficultyRulesScript.EASY)
	)
	GameSession.configure_run(run_id, level_id, stage_level, difficulty)
	_reset_enemy_experience_carry(run_id)


func _reset_enemy_experience_carry(run_id: String) -> void:
	_enemy_xp_carry_run_id = run_id
	_enemy_xp_fractional_carry = 0.0
	_enemy_xp_fractional_carry_by_hero.clear()
	_processed_enemy_xp_receipts.clear()


func _ensure_enemy_experience_run(run_id: String) -> void:
	if _enemy_xp_carry_run_id == run_id:
		return
	_reset_enemy_experience_carry(run_id)


func _install_debug_tools() -> void:
	if not OS.has_feature("debug"):
		return
	var panel_scene := load("res://game/debug/soul_relay_debug_panel.tscn") as PackedScene
	if panel_scene != null:
		add_child(panel_scene.instantiate())


func _prepare_top_down_entities() -> void:
	entity_root.y_sort_enabled = true
	if player.get_parent() != entity_root:
		player.reparent(entity_root, true)


func _place_player_and_camera() -> void:
	var spawn_position := _get_player_spawn_position()
	_player_spawn_position = spawn_position
	player.global_position = spawn_position
	GameSession.checkpoint = spawn_position
	_apply_camera_bounds()


func _apply_camera_bounds() -> void:
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		var metadata: Dictionary = level.level_data.get("metadata", {})
		var bounds: Array = metadata.get("camera_bounds", [0, 0, 1600, 896])
		if bounds.size() >= 4:
			camera.limit_left = int(bounds[0])
			camera.limit_top = int(bounds[1])
			camera.limit_right = int(bounds[2])
			camera.limit_bottom = int(bounds[3])
		camera.reset_smoothing()


func _get_player_spawn_position() -> Vector2:
	var spawn_position := Vector2(104.0, 104.0)
	for raw_entity: Variant in _get_runtime_entities():
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) == "player":
			return _array_to_vector2(raw_entity.get("position", []), spawn_position)
	return spawn_position


func _spawn_level_entities() -> void:
	var existing_by_id: Dictionary = {}
	for child: Node in entity_root.get_children():
		if child == player or not child.has_meta(ENTITY_ID_META):
			continue
		var entity_id := String(child.get_meta(ENTITY_ID_META, ""))
		if entity_id.is_empty() or child.is_queued_for_deletion():
			continue
		if existing_by_id.has(entity_id):
			# Duplicate managed nodes should never survive a reload. Stable IDs are
			# the authority, regardless of the human-readable scene-tree name.
			_remove_level_entity(child)
			continue
		existing_by_id[entity_id] = child
		if (
			not _entity_config_signatures.has(entity_id)
			and child.has_meta(ENTITY_SIGNATURE_META)
		):
			_entity_config_signatures[entity_id] = String(
				child.get_meta(ENTITY_SIGNATURE_META, "")
			)

	var next_entity_ids: Dictionary = {}
	# Density variants are part of the live run, not the authored completion
	# contract. Spawn from the deterministic runtime projection so Easy/Medium/
	# Hard actually materialize their promised extra packs; encounter tracking
	# below still ignores their synthetic IDs and therefore cannot gate exits.
	for raw_entity: Variant in _get_runtime_entities():
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		var entity_type := String(entity.get("type", ""))
		if entity_type == "player":
			continue
		if not _can_instantiate_entity(entity, true):
			continue
		var resolved_enemy_definition := _resolve_enemy_definition(entity)
		var entity_id := String(entity.get("id", "")).strip_edges()
		if entity_id.is_empty():
			continue

		next_entity_ids[entity_id] = true
		var config_signature := _get_entity_config_signature(entity)
		var was_known := _entity_config_signatures.has(entity_id)
		var config_changed := (
			not was_known
			or String(_entity_config_signatures.get(entity_id, "")) != config_signature
		)
		var instance := existing_by_id.get(entity_id) as Node2D
		var replace_existing := false

		if instance != null:
			existing_by_id.erase(entity_id)
			var existing_type := String(instance.get_meta(ENTITY_TYPE_META, ""))
			var expected_definition_id := (
				resolved_enemy_definition.enemy_id
				if resolved_enemy_definition != null
				else &""
			)
			var existing_definition_id := StringName(instance.get_meta(
				EnemyRuntimeConfiguratorScript.DEFINITION_ID_META,
				&"",
			))
			var canonical_definition_changed := (
				expected_definition_id != existing_definition_id
			)
			if existing_type != entity_type or canonical_definition_changed:
				_remove_level_entity(instance)
				instance = null
				config_changed = true
				replace_existing = true
			elif config_changed:
				var previous_config: Dictionary = {}
				var previous_value: Variant = instance.get_meta(ENTITY_CONFIG_META, {})
				if previous_value is Dictionary:
					previous_config = previous_value
				_apply_entity_config(instance, entity, previous_config)

		# A known ID with no live node was consumed, opened-and-removed, or died
		# during this run. Editing its JSON must not duplicate score/objective state.
		# Delete the ID and add it again (or restart the run) to spawn it anew.
		if instance == null and (not was_known or replace_existing):
			if not _should_defer_level_entity_spawn(entity_id):
				instance = _instantiate_level_entity(entity)

		if instance != null:
			_set_entity_metadata(instance, entity, config_signature)
		_entity_config_signatures[entity_id] = config_signature

	# Nodes still present here were deleted from the JSON definition.
	for stale_id: Variant in existing_by_id.keys():
		_remove_level_entity(existing_by_id[stale_id] as Node)

	# Forget deleted IDs even when their runtime node had already been consumed.
	# Re-adding that ID later is therefore treated as a genuinely new entity.
	for known_id: Variant in _entity_config_signatures.keys():
		if not next_entity_ids.has(known_id):
			_entity_config_signatures.erase(known_id)
	_sync_encounter_gates()


func _instantiate_level_entity(entity: Dictionary) -> Node2D:
	var entity_type := String(entity.get("type", ""))
	var enemy_definition := _resolve_enemy_definition(entity, true)
	var instance: Node2D
	if enemy_definition != null:
		instance = EnemyRuntimeConfiguratorScript.instantiate_bound(
			enemy_definition
		) as Node2D
	elif NON_ENEMY_ENTITY_SCENES.has(entity_type):
		instance = (
			NON_ENEMY_ENTITY_SCENES[entity_type] as PackedScene
		).instantiate() as Node2D
	if instance == null:
		if enemy_definition != null:
			_record_enemy_authority_failure(
				entity,
				"definition '%s' could not bind its runtime controller"
				% enemy_definition.enemy_id,
			)
		return null
	instance.name = String(entity.get("id", entity_type)).to_pascal_case()
	_apply_entity_config(instance, entity)
	_set_entity_metadata(instance, entity, _get_entity_config_signature(entity))
	entity_root.add_child(instance)
	if enemy_definition != null:
		EnemyDifficultyScalerScript.apply_to(
			instance,
			GameSession.active_stage_level,
			GameSession.active_difficulty,
		)
	_connect_encounter_enemy(instance, StringName(entity.get("id", "")))
	return instance


func _apply_entity_config(
	instance: Node2D,
	entity: Dictionary,
	previous_config: Dictionary = {},
) -> void:
	var position_changed: bool = (
		previous_config.is_empty()
		or previous_config.get("position", []) != entity.get("position", [])
	)
	if position_changed:
		instance.position = _array_to_vector2(entity.get("position", []), Vector2.ZERO)

	var entity_type := String(entity.get("type", ""))
	if _resolve_enemy_definition(entity) != null:
		var patrol_distance := float(entity.get("patrol", 72.0))
		var previous_patrol := float(previous_config.get("patrol", 72.0))
		var patrol_changed: bool = previous_config.is_empty() or not is_equal_approx(
			previous_patrol,
			patrol_distance
		)
		instance.set("patrol_distance", patrol_distance)
		if instance.is_node_ready() and (position_changed or patrol_changed):
			# Keep health/AI state on the same instance, but make edited patrol
			# settings and spawn positions effective immediately.
			instance.set("_spawn_position", instance.global_position)
			if instance.has_method(&"_choose_patrol_target"):
				instance.call(&"_choose_patrol_target")
	elif entity_type == "chest":
		instance.set("score_reward", int(entity.get("score_reward", 150)))
		instance.set("chest_family", String(entity.get("chest_family", "auto")))
		instance.set("contains_sigil", bool(entity.get("contains_sigil", false)))
		instance.set("guaranteed_jackpot", bool(entity.get("guaranteed_jackpot", false)))
		instance.set("rarity_override", String(entity.get("rarity_override", "random")))
		instance.set("interaction_message", _interaction_prompt(
			String(entity.get("interaction_message", "Nhấn chuột trái để mở rương")),
			"Nhấn chuột trái để mở rương",
		))
	elif entity_type == "reliquary_branch_seal":
		instance.set("branch_id", StringName(entity.get("branch_id", "")))
		instance.set("display_name", String(entity.get("display_name", "BRANCH RELIC")))
		instance.set("interaction_message", _interaction_prompt(
			String(entity.get("interaction_message", "Nhấn chuột trái để chọn nhánh thần vật")),
			"Nhấn chuột trái để chọn nhánh thần vật",
		))
	elif entity_type == "gate_seal":
		instance.set("seal_id", StringName(entity.get("seal_id", entity.get("id", ""))))
		instance.set("display_name", String(entity.get("display_name", "GATE SEAL")))
		instance.set("interaction_message", _interaction_prompt(
			String(entity.get("interaction_message", "Nhấn chuột trái để phá phong ấn cổng")),
			"Nhấn chuột trái để phá phong ấn cổng",
		))
	elif entity_type == "floor_door":
		instance.set("door_label", String(entity.get("label", "Door")))
		instance.set("interaction_message", _interaction_prompt(
			String(entity.get("message", "Nhấn chuột trái để đi qua cửa")),
			"Nhấn chuột trái để đi qua cửa",
		))
		instance.set("target_position", _array_to_vector2(entity.get("target_position", []), Vector2.ZERO))
	elif entity_type == "exit_gate" and instance.has_method(&"configure_encounter_requirement"):
		var gate_id := StringName(entity.get("id", ""))
		instance.call(
			&"configure_encounter_requirement",
			_encounter_runtime.is_gate_controlled(gate_id),
			_encounter_runtime.is_gate_unlocked(gate_id),
			_encounter_runtime.get_remaining_enemy_count(),
		)


func _interaction_prompt(raw_message: String, fallback: String) -> String:
	var message := raw_message.strip_edges()
	if message.is_empty():
		return fallback
	message = message.replace("Nhấn E để", "Nhấn chuột trái để")
	message = message.replace("nhấn E để", "nhấn chuột trái để")
	var lower := message.to_lower()
	if not lower.begins_with("press e"):
		return message
	if "chest" in lower or "claim" in lower or "open" in lower:
		return "Nhấn chuột trái để mở rương"
	if "reaper" in lower:
		return "Nhấn chuột trái để chọn nhánh Tử Thần"
	if "vampire" in lower:
		return "Nhấn chuột trái để chọn nhánh Ma Cà Rồng"
	if "bind" in lower or "branch" in lower:
		return "Nhấn chuột trái để chọn nhánh thần vật"
	if "break" in lower or "gate seal" in lower:
		return "Nhấn chuột trái để phá phong ấn cổng"
	if "return" in lower:
		return "Nhấn chuột trái để quay lại"
	if "continue" in lower:
		return "Nhấn chuột trái để đi tiếp"
	return fallback


func _set_entity_metadata(
	instance: Node,
	entity: Dictionary,
	config_signature: String,
) -> void:
	instance.set_meta(ENTITY_ID_META, String(entity.get("id", "")))
	instance.set_meta(ENTITY_TYPE_META, String(entity.get("type", "")))
	instance.set_meta(ENTITY_SIGNATURE_META, config_signature)
	instance.set_meta(ENTITY_CONFIG_META, entity.duplicate(true))
	var enemy_definition := _resolve_enemy_definition(entity)
	if enemy_definition != null:
		var enemy_role_tags := enemy_definition.role_tags.duplicate()
		instance.set_meta(&"enemy_role_tags", enemy_role_tags)
		if enemy_role_tags.has("boss") or enemy_role_tags.has("final_boss") \
				or enemy_role_tags.has("miniboss") or enemy_role_tags.has("midboss"):
			instance.set_meta(&"is_boss_enemy", true)
			instance.add_to_group(&"boss_enemies")
		if enemy_role_tags.has("boss") or enemy_role_tags.has("final_boss"):
			instance.add_to_group(&"bosses")
		elif enemy_role_tags.has("miniboss") or enemy_role_tags.has("midboss"):
			instance.add_to_group(&"minibosses")
		instance.set_meta(&"difficulty_id", String(GameSession.active_difficulty))
		instance.set_meta(&"stage_level", GameSession.active_stage_level)
		instance.set_meta(&"difficulty_modifiers", GameSession.get_difficulty_modifiers())
		instance.set_meta(
			EnemyDifficultyScalerScript.EXPERIENCE_POPULATION_CONTEXT_META,
			_enemy_population_context.duplicate(true),
		)
		instance.set_meta(&"density_bonus", bool(entity.get("density_bonus", false)))
		instance.set_meta(&"encounter_pack", bool(entity.get("encounter_pack", false)))
		instance.set_meta(&"encounter_floor", int(entity.get("encounter_floor", 0)))
		instance.set_meta(&"encounter_pack_index", int(entity.get("encounter_pack_index", 0)))
		instance.set_meta(&"encounter_pack_slot", int(entity.get("encounter_pack_slot", 0)))
		instance.set_meta(&"runtime_pack_member", bool(entity.get("runtime_pack_member", false)))
		var entity_id := StringName(entity.get("id", ""))
		var can_mutate := enemy_definition.density_eligible \
			and not _should_defer_level_entity_spawn(String(entity_id)) \
			and not bool(entity.get("objective_bound", false))
		var mutant := can_mutate and DifficultyRulesScript.should_spawn_mutant(
			GameSession.active_run_id,
			entity_id,
			GameSession.active_difficulty,
			GameSession.active_stage_level,
		)
		instance.set_meta(&"mutant", mutant)
		if mutant:
			# LootDirector consumes these before assigning its final loot_rarity and
			# asset-backed aura. A mutant is never visually/reward-wise Normal.
			instance.set_meta(&"loot_role", &"elite")
			instance.set_meta(&"enemy_rarity", &"rare")
		if bool(instance.get_meta(EnemyDifficultyScalerScript.APPLIED_META, false)):
			EnemyDifficultyScalerScript.finalize_experience_reward(
				instance,
				_enemy_population_context,
			)


func _remove_level_entity(instance: Node) -> void:
	if instance == null:
		return
	if instance.get_parent() == entity_root:
		entity_root.remove_child(instance)
	if not instance.is_queued_for_deletion():
		instance.queue_free()


func _should_defer_level_entity_spawn(entity_id: String) -> bool:
	if _active_content_level == null:
		return false
	var metadata: Dictionary = level.level_data.get("metadata", {})
	if bool(metadata.get("chapter_2_director", false)):
		for raw_entity: Variant in level.get_entities():
			if not raw_entity is Dictionary:
				continue
			var entity: Dictionary = raw_entity
			if String(entity.get("id", "")) == entity_id:
				return bool(entity.get("deferred_spawn", false))
	match _active_content_level.level_id:
		&"chapter_1_level_8":
			var branch_enemy_ids: Array = metadata.get("branch_enemy_ids", [])
			return branch_enemy_ids.has(entity_id)
		&"chapter_1_level_9":
			return String(metadata.get("crimson_reaper_id", "")) == entity_id
	return false


## Level-specific runtimes may materialize an authored deferred marker once.
## The stable JSON identity and encounter death bridge remain owned by Main.
func spawn_deferred_level_entity(entity_id: StringName) -> Node2D:
	for child: Node in entity_root.get_children():
		if StringName(child.get_meta(ENTITY_ID_META, "")) == entity_id:
			return child as Node2D
	for raw_entity: Variant in level.get_entities():
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if StringName(entity.get("id", "")) != entity_id:
			continue
		if not _can_instantiate_entity(entity, true):
			return null
		var instance := _instantiate_level_entity(entity)
		if instance != null:
			_entity_config_signatures[String(entity_id)] = _get_entity_config_signature(entity)
		return instance
	return null


func deactivate_encounter_enemies(entity_ids: PackedStringArray) -> int:
	var removed := _encounter_runtime.deactivate_tracked_enemies(entity_ids)
	_sync_encounter_gates()
	return removed


func _get_entity_config_signature(entity: Dictionary) -> String:
	# JSON object key order is not semantic. Sorting avoids resetting an actor
	# merely because an external editor reformatted the same entity definition.
	var sorted_keys: Array = entity.keys()
	sorted_keys.sort()
	var canonical_entity: Dictionary = {}
	for key: Variant in sorted_keys:
		canonical_entity[key] = entity[key]
	return JSON.stringify(canonical_entity).sha256_text()


func _array_to_vector2(value: Variant, fallback: Vector2) -> Vector2:
	if value is Array and value.size() >= 2:
		return Vector2(float(value[0]), float(value[1]))
	return fallback


func _get_entity_signature() -> String:
	return JSON.stringify(level.get_entities())


func _get_runtime_entities() -> Array:
	if not _runtime_plan_ready:
		_refresh_runtime_plan()
	return _runtime_entities_cache.duplicate(true)


func _refresh_runtime_plan() -> void:
	_runtime_entities_cache = _project_runtime_entities()
	_runtime_plan_ready = true
	var metadata: Dictionary = level.level_data.get("metadata", {})
	var enemy_entity_types := _enemy_entity_types()
	_enemy_population_context = EncounterPackRulesScript.build_population_context(
		metadata,
		GameSession.active_stage_level,
		GameSession.active_difficulty,
		_runtime_entities_cache,
		enemy_entity_types,
	)
	if (
		_active_content_level != null
		and _active_content_level.is_campaign_level()
		and not bool(_enemy_population_context.get("valid", false))
	):
		push_warning(
			"Campaign XP population failed closed: %s"
			% String(_enemy_population_context.get("error", "unknown population error"))
		)


func _project_runtime_entities() -> Array:
	var authored: Array = level.get_entities().duplicate(true)
	var level_metadata: Dictionary = level.level_data.get("metadata", {})
	# Chapter 2 owns density through its queue-based Spawn Director. Feeding its
	# full authored marker list into the Chapter 1 pack projection would bypass
	# the deliberate 7/8/9 simultaneous-threat ceiling.
	if bool(level_metadata.get("chapter_2_director", false)):
		return authored
	var enemy_entity_types := _enemy_entity_types()
	var density_excluded_types := _density_excluded_enemy_types()
	if EncounterPackRulesScript.uses_pack_model(level_metadata):
		var excluded_entity_ids: Array = []
		for raw_entity: Variant in authored:
			if not raw_entity is Dictionary:
				continue
			var entity: Dictionary = raw_entity
			var entity_id := String(entity.get("id", ""))
			if _should_defer_level_entity_spawn(entity_id) \
					or bool(entity.get("objective_bound", false)):
				excluded_entity_ids.append(entity_id)
		var layers_value: Variant = level.level_data.get("layers", {})
		var walkable_cells: Array = []
		if layers_value is Dictionary:
			var backdrop_value: Variant = (layers_value as Dictionary).get("Backdrop", [])
			if backdrop_value is Array:
				walkable_cells = backdrop_value
		return EncounterPackRulesScript.project_runtime_entities(
			authored,
			level_metadata,
			GameSession.active_stage_level,
			GameSession.active_difficulty,
			GameSession.active_run_id,
			enemy_entity_types,
			density_excluded_types,
			excluded_entity_ids,
			walkable_cells,
		)
	var eligible: Array[Dictionary] = []
	for raw_entity: Variant in authored:
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		var entity_type := String(entity.get("type", ""))
		var entity_id := String(entity.get("id", ""))
		if not _is_enemy_entity_type(entity_type) \
				or not _is_density_eligible_enemy_type(entity_type) \
				or _should_defer_level_entity_spawn(entity_id) \
				or bool(entity.get("objective_bound", false)):
			continue
		eligible.append(entity)
	var bonus_count := DifficultyRulesScript.density_bonus_count(
		eligible.size(),
		GameSession.active_difficulty,
	)
	if eligible.is_empty() or bonus_count <= 0:
		return authored
	var cadence_anchor_value: Variant = level_metadata.get("density_cadence_anchor", [])
	var cadence_anchor: Array = cadence_anchor_value if cadence_anchor_value is Array else []
	for bonus_index: int in bonus_count:
		var source := eligible[(bonus_index * 5) % eligible.size()]
		var bonus := source.duplicate(true)
		var source_id := String(source.get("id", "enemy"))
		bonus["id"] = "%s__density_%02d" % [source_id, bonus_index + 1]
		bonus["source_entity_id"] = source_id
		bonus["density_bonus"] = true
		bonus["required_for_completion"] = false
		var source_position := _array_to_vector2(source.get("position", []), Vector2.ZERO)
		if bonus_index == 0 and cadence_anchor.size() >= 2:
			var cadence_position := _array_to_vector2(cadence_anchor, source_position)
			bonus["position"] = [cadence_position.x, cadence_position.y]
			bonus["density_cadence_scout"] = true
		else:
			var angle_seed := float((source_id.hash() + bonus_index * 97) % 360)
			var offset := Vector2.from_angle(deg_to_rad(angle_seed)) * (
				24.0 + float(bonus_index % 3) * 8.0
			)
			bonus["position"] = [source_position.x + offset.x, source_position.y + offset.y]
		authored.append(bonus)
	return authored


func _is_enemy_entity_type(entity_type: String) -> bool:
	return (
		_active_content_registry != null
		and _active_content_registry.find_enemy_by_layout_type(
			StringName(entity_type)
		) != null
	)


func _is_density_eligible_enemy_type(entity_type: String) -> bool:
	if _active_content_registry == null:
		return false
	var definition := _active_content_registry.find_enemy_by_layout_type(
		StringName(entity_type)
	)
	return definition != null and definition.density_eligible


func _enemy_entity_types() -> Array:
	var result: Array = []
	if _active_content_registry == null:
		return result
	for entity_type: String in _active_content_registry.get_layout_enemy_types():
		result.append(entity_type)
	return result


func _density_excluded_enemy_types() -> Array:
	var result: Array = []
	if _active_content_registry == null:
		return result
	for entity_type: String in _active_content_registry.get_density_excluded_layout_types():
		result.append(entity_type)
	return result


func _resolve_enemy_definition(
	entity: Dictionary,
	report_failure := false,
) -> EnemyDefinition:
	var entity_type := String(entity.get("type", "")).strip_edges()
	if _active_content_registry == null:
		if report_failure and not NON_ENEMY_ENTITY_SCENES.has(entity_type):
			_record_enemy_authority_failure(entity, "no active content registry")
		return null
	var explicit_id := StringName(
		String(entity.get("enemy_definition_id", "")).strip_edges()
	)
	if not explicit_id.is_empty():
		var explicit_definition := _active_content_registry.find_enemy(explicit_id)
		if explicit_definition == null and report_failure:
			_record_enemy_authority_failure(
				entity,
				"unknown explicit enemy_definition_id '%s'" % explicit_id,
			)
		return explicit_definition
	var definition := _active_content_registry.find_enemy_by_layout_type(
		StringName(entity_type)
	)
	if definition == null and report_failure \
			and not NON_ENEMY_ENTITY_SCENES.has(entity_type):
		_record_enemy_authority_failure(
			entity,
			"layout type '%s' has no registry alias" % entity_type,
		)
	return definition


func _can_instantiate_entity(entity: Dictionary, report_failure := false) -> bool:
	var entity_type := String(entity.get("type", "")).strip_edges()
	if NON_ENEMY_ENTITY_SCENES.has(entity_type):
		return true
	return _resolve_enemy_definition(entity, report_failure) != null


func _record_enemy_authority_failure(entity: Dictionary, reason: String) -> void:
	if _active_content_level == null or not _active_content_level.is_campaign_level():
		return
	var entity_id := String(entity.get("id", "<missing-id>"))
	var key := "%s|%s" % [entity_id, reason]
	if _reported_enemy_authority_errors.has(key):
		return
	_reported_enemy_authority_errors[key] = true
	var message := "Campaign enemy '%s' failed closed: %s." % [entity_id, reason]
	_enemy_authority_errors.append(message)
	push_warning(message)


func get_enemy_authority_errors() -> PackedStringArray:
	return _enemy_authority_errors.duplicate()


func _on_level_data_changed(source: String) -> void:
	GameSession.configure_objective(int(level.level_data.get("metadata", {}).get("required_sigils", GameSession.DEFAULT_REQUIRED_SIGILS)))
	var next_signature := _get_entity_signature()
	if next_signature != _entity_signature:
		_entity_signature = next_signature
		_runtime_plan_ready = false
		_refresh_runtime_plan()
		var next_spawn := _get_player_spawn_position()
		if not next_spawn.is_equal_approx(_player_spawn_position):
			_player_spawn_position = next_spawn
			player.global_position = next_spawn
			GameSession.checkpoint = next_spawn
		_spawn_level_entities()
		RealtimeBridge.publish_event("level_entities_reloaded", {
			"count": entity_root.get_child_count(),
			"source": source,
		})
	_apply_camera_bounds()


func _configure_encounter_runtime() -> void:
	var resolved := _resolve_runtime_content()
	_active_content_level = resolved.get("level") as LevelDefinition
	_active_content_registry = resolved.get("registry") as LevelRegistry
	_enemy_authority_errors.clear()
	_reported_enemy_authority_errors.clear()
	# Registered sandbox runs use the same authored marker/death projection as
	# campaign encounters. Their slot remains zero and AppFlow never commits a
	# campaign completion or campaign reward for Training.
	if (
		_active_content_level == null
		or _active_content_registry == null
		or (
			not _active_content_level.is_campaign_level()
			and _active_content_level.content_status != LevelDefinition.ContentStatus.SANDBOX
		)
	):
		_encounter_runtime.clear()
		GameSession.update_encounter_objective(0, 0, true)
		return

	var errors: PackedStringArray = _encounter_runtime.configure(
		_active_content_level,
		_active_content_registry,
		level.get_entities(),
	)
	for error: String in errors:
		push_warning("Encounter runtime: %s" % error)
	var snapshot: Dictionary = _encounter_runtime.get_snapshot()
	GameSession.update_encounter_objective(
		int(snapshot.get("defeated_enemies", 0)),
		int(snapshot.get("total_enemies", 0)),
		bool(snapshot.get("complete", true)),
	)


func _configure_special_level_runtime() -> void:
	if is_instance_valid(_chapter_two_spawn_director):
		_chapter_two_spawn_director.queue_free()
	_chapter_two_spawn_director = null
	if is_instance_valid(_special_level_runtime):
		_special_level_runtime.queue_free()
	_special_level_runtime = null
	if _active_content_level == null or _active_content_registry == null:
		return
	if _active_content_level.chapter_number == 2:
		var director: Node = ChapterTwoSpawnDirectorScript.new()
		director.name = "ChapterTwoSpawnDirector"
		add_child(director)
		var director_errors: PackedStringArray = director.configure(self, entity_root, level.get_entities())
		if director_errors.is_empty():
			_chapter_two_spawn_director = director
		else:
			for error: String in director_errors:
				push_warning("Chapter 2 spawn director: %s" % error)
			director.queue_free()
	var encounter := _active_content_registry.find_encounter(_active_content_level.entry_encounter_id)
	if encounter == null:
		push_warning("Special level runtime cannot resolve its entry encounter.")
		return
	var runtime_script: Script
	var runtime_name := ""
	var runtime_label := ""
	match _active_content_level.level_id:
		&"chapter_1_level_5":
			runtime_script = LevelFiveArcherRecruitmentRuntimeScript
			runtime_name = "Level5ArcherRecruitmentRuntime"
			runtime_label = "Level 5 Archer recruitment runtime"
		&"chapter_1_level_7":
			runtime_script = LevelSevenBeaconRuntimeScript
			runtime_name = "Level7BeaconRuntime"
			runtime_label = "Level 7 Beacon runtime"
		&"chapter_1_level_8":
			runtime_script = LevelEightReliquaryRuntimeScript
			runtime_name = "Level8ReliquaryRuntime"
			runtime_label = "Level 8 Reliquary runtime"
		&"chapter_1_level_9":
			runtime_script = LevelNineCrimsonGateRuntimeScript
			runtime_name = "Level9CrimsonGateRuntime"
			runtime_label = "Level 9 Crimson Gate runtime"
		&"chapter_1_level_10":
			runtime_script = LevelTenCastellanRuntimeScript
			runtime_name = "Level10CastellanRuntime"
			runtime_label = "Level 10 Vampire Castellan runtime"
		&"chapter_2_level_15", &"chapter_2_level_18", &"chapter_2_level_20":
			runtime_script = ChapterTwoLevelRuntimeScript
			runtime_name = "ChapterTwoLevelRuntime"
			runtime_label = "Chapter 2 special objective runtime"
		_:
			return
	# Keep the special runtime behind its preloaded script boundary. Casting to
	# the script's global class here makes Main depend on editor class-cache
	# refresh order while the companion script is being imported.
	var runtime: Node = runtime_script.new()
	runtime.name = runtime_name
	add_child(runtime)
	var errors: PackedStringArray = runtime.configure(self, entity_root, encounter)
	if not errors.is_empty():
		for error: String in errors:
			push_warning("%s: %s" % [runtime_label, error])
		runtime.queue_free()
		return
	_special_level_runtime = runtime


func _resolve_runtime_content() -> Dictionary:
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow != null and app_flow.has_method(&"get_active_run"):
		var run: Dictionary = app_flow.call(&"get_active_run")
		var content_level_id := StringName(run.get("content_level_id", run.get("level_id", "")))
		if not content_level_id.is_empty():
			# Array literals containing preloaded Resources are inferred as
			# Array[Resource]. Godot cannot assign that container to the narrower
			# Array[LevelRegistry] at runtime, even though every element is valid.
			# Populate the typed container explicitly so the real AppFlow route does
			# not abort while entering a campaign level.
			var preferred_registries: Array[LevelRegistry] = []
			if StringName(run.get("mode_id", &"campaign")) == &"campaign":
				preferred_registries.assign([CAMPAIGN_REGISTRY, SANDBOX_REGISTRY])
			else:
				preferred_registries.assign([SANDBOX_REGISTRY, CAMPAIGN_REGISTRY])
			for registry: LevelRegistry in preferred_registries:
				var definition := registry.find_level(content_level_id)
				if definition != null:
					return {"level": definition, "registry": registry}

	# Direct gameplay/test loads have no AppFlow run. Prefer production content
	# when a sandbox definition happens to share the same layout JSON.
	for registry: LevelRegistry in [CAMPAIGN_REGISTRY, SANDBOX_REGISTRY]:
		for definition: LevelDefinition in registry.level_definitions:
			if definition != null and definition.layout_data_path == level.level_data_path:
				return {"level": definition, "registry": registry}
	return {}


func _connect_encounter_enemy(instance: Node, entity_id: StringName) -> void:
	if (
		instance == null
		or not instance.has_signal(&"died")
	):
		return
	var callback := _on_encounter_enemy_died.bind(entity_id)
	if not instance.is_connected(&"died", callback):
		instance.connect(&"died", callback)


func _on_encounter_enemy_died(enemy: Node, entity_id: StringName) -> void:
	_grant_enemy_experience(enemy, entity_id)
	if _encounter_runtime.is_tracked_enemy(entity_id) \
			and _encounter_runtime.mark_enemy_defeated(entity_id):
		_sync_encounter_gates()


func _grant_enemy_experience(enemy: Node, entity_id: StringName) -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if enemy == null or save_service == null \
			or not save_service.has_method(&"grant_hero_experience"):
		return
	if not EnemyDifficultyScalerScript.is_experience_reward_current(enemy):
		EnemyDifficultyScalerScript.finalize_experience_reward(
			enemy,
			_enemy_population_context,
		)
	if not EnemyDifficultyScalerScript.is_experience_reward_current(enemy):
		push_warning(
			"Enemy XP failed closed for '%s': combat/reward projection is stale or invalid."
			% entity_id
		)
		return
	var reward_units := float(enemy.get_meta(&"experience_reward", 0.0))
	if reward_units <= 0.0:
		return
	var run_id := GameSession.active_run_id
	if run_id.is_empty():
		run_id = "direct_run"
	_ensure_enemy_experience_run(run_id)
	var receipt_source := "%s:%s" % [run_id, entity_id]
	if _processed_enemy_xp_receipts.has(receipt_source):
		return
	var hero_id := String(enemy.get_meta(&"last_damage_hero_id", "")).strip_edges().to_lower()
	if hero_id.is_empty() and player != null:
		var manager: Variant = player.get("hero_soul_manager")
		if manager is HeroSoulManager and (manager as HeroSoulManager).active_hero != null:
			hero_id = String((manager as HeroSoulManager).active_hero.hero_id)
	if hero_id.is_empty():
		hero_id = "sword_hero"
	var carry_before := float(_enemy_xp_fractional_carry_by_hero.get(hero_id, 0.0))
	var experience_projection: Dictionary = enemy.get_meta(
		EnemyDifficultyScalerScript.EXPERIENCE_PROJECTION_META,
		{},
	)
	var carry_projection := ProgressionPacingRulesScript.resolve_fractional_carry(
		carry_before,
		reward_units,
	)
	var whole_xp := int(carry_projection["whole_xp"])
	var carry_after := float(carry_projection["carry"])
	if whole_xp <= 0:
		_enemy_xp_fractional_carry_by_hero[hero_id] = carry_after
		_enemy_xp_fractional_carry = carry_after
		_processed_enemy_xp_receipts[receipt_source] = true
		return
	var transaction_key := "xp:enemy:%s" % receipt_source.sha256_text().substr(0, 32)
	var transaction: Variant = save_service.call(
		&"grant_hero_experience",
		StringName(hero_id),
		whole_xp,
		transaction_key,
		{
			"run_id": run_id,
			"level_id": String(GameSession.active_level_id),
			"entity_id": String(entity_id),
			"stage_level": GameSession.active_stage_level,
			"difficulty": String(GameSession.active_difficulty),
			"reward_units": reward_units,
			"fractional_carry_before": carry_before,
			"fractional_carry_after": carry_after,
			"committed_whole_xp": whole_xp,
			"population_plan_signature": String(experience_projection.get(
				"population_plan_signature",
				"",
			)),
			"experience_projection_revision": int(experience_projection.get("revision", 0)),
			"combat_projection_revision": int(experience_projection.get(
				"combat_projection_revision",
				0,
			)),
			"final_score": float(experience_projection.get("final_score", 0.0)),
			"threat_weight": float(experience_projection.get("threat_weight", 0.0)),
		},
	)
	if transaction is Dictionary and bool((transaction as Dictionary).get("applied", false)):
		_enemy_xp_fractional_carry = carry_after
		_enemy_xp_fractional_carry_by_hero[hero_id] = carry_after
		_processed_enemy_xp_receipts[receipt_source] = true
	elif transaction is Dictionary \
			and bool((transaction as Dictionary).get("already_applied", false)):
		# A durable receipt means this kill was processed by an earlier instance.
		# Do not add its fractional units to the current run a second time.
		_processed_enemy_xp_receipts[receipt_source] = true


func _sync_encounter_gates() -> void:
	var snapshot: Dictionary = _encounter_runtime.get_snapshot()
	var remaining := int(snapshot.get("remaining_enemies", 0))
	GameSession.update_encounter_objective(
		int(snapshot.get("defeated_enemies", 0)),
		int(snapshot.get("total_enemies", 0)),
		bool(snapshot.get("complete", true)),
	)
	for child: Node in entity_root.get_children():
		if (
			String(child.get_meta(ENTITY_TYPE_META, "")) != "exit_gate"
			or not child.has_method(&"configure_encounter_requirement")
		):
			continue
		var gate_id := StringName(child.get_meta(ENTITY_ID_META, ""))
		child.call(
			&"configure_encounter_requirement",
			_encounter_runtime.is_gate_controlled(gate_id),
			_encounter_runtime.is_gate_unlocked(gate_id),
			remaining,
		)


func reload_level_content() -> void:
	level.reload_from_disk()


func record_encounter_event(event_id: StringName, amount: int = 1) -> bool:
	if not _encounter_runtime.record_custom_event(event_id, amount):
		return false
	_sync_encounter_gates()
	return true


func get_runtime_snapshot() -> Dictionary:
	var snapshot := {
		"player": player.get_realtime_state(),
		"session": {
			"score": GameSession.score,
			"enemy_xp_fractional_carry": _enemy_xp_fractional_carry,
			"sigils": GameSession.sigils,
			"required_sigils": GameSession.required_sigils,
			"checkpoint": [GameSession.checkpoint.x, GameSession.checkpoint.y],
			"objective_finished": GameSession.objective_finished,
			"encounter": _encounter_runtime.get_snapshot(),
			"run": GameSession.get_run_configuration(),
		},
		"level": {
			"name": level.level_data.get("name", "Crypt Entrance"),
			"geometry_cells": level.geometry.get_used_cells().size(),
			"entities": entity_root.get_child_count(),
			"enemy_population": _enemy_population_context.duplicate(true),
		},
	}
	if is_instance_valid(_special_level_runtime) and _special_level_runtime.has_method(&"get_snapshot"):
		snapshot["special_objective"] = _special_level_runtime.call(&"get_snapshot")
	if is_instance_valid(_chapter_two_spawn_director) and _chapter_two_spawn_director.has_method(&"get_snapshot"):
		snapshot["chapter_2_spawn_director"] = _chapter_two_spawn_director.call(&"get_snapshot")
	return snapshot
