extends Node
class_name LivingArsenalSaveService

## Versioned, crash-resistant local progression storage.
##
## Runtime systems should use [method transact_once] for rewards and unlocks. The
## transaction key is committed in the same snapshot as the mutation, preventing
## a result/reward screen from paying twice after a reload or crash.

signal save_loaded(snapshot: Dictionary)
signal save_committed(snapshot: Dictionary)
signal save_recovered(source: String)
signal save_migrated(from_version: int, to_version: int, backup_path: String)
signal save_failed(message: String)
signal transaction_applied(transaction_key: String)
signal save_reset()
signal settings_changed(settings: Dictionary)
signal hero_progression_changed(hero_id: StringName, snapshot: Dictionary)
signal hero_shards_changed(hero_id: StringName, amount: int)
signal hero_identity_unlocked(hero_id: StringName)

const UNIQUE_OWNERSHIP_GUARD := preload("res://game/survival/economy/unique_ownership_guard.gd")
const ECONOMY_SAVE_FACADE := preload("res://game/survival/economy/economy_save_facade.gd")
# Immutable, first-party A3 integration fixture. Production composition must
# explicitly review/re-pin future adapter revisions; a caller label is never
# evidence of authority.
const PINNED_A3_SCRIPT_SHA256 := "b1ee9792b4460e956ec6c59437269078e4f6767f76d35145e680dcc03ba3806c"
const PINNED_A0_ADAPTER_SHA256 := "2b539f3320828c2fa850b6057c735e032153d5a1e8fa1b8ade63d2e3380ed2ce"

const CURRENT_SCHEMA_VERSION := 4
const CURRENT_HERO_SOUL_RULES_VERSION := 4
const LEGACY_HERO_SOUL_RULES_VERSION := 1
const CURRENT_SKILL_ECONOMY_VERSION := 2
const CURRENT_STAT_ECONOMY_VERSION := 2
const CURRENT_AUXILIARY_EQUIPMENT_VERSION := 4
const MAX_FREE_STAT_REALLOCATION_CREDITS := 1
const MAX_AUXILIARY_UPGRADE_RANK := 5
const AUXILIARY_UPGRADE_STONE_PREFIX := "soul_upgrade_stone_"
const AUXILIARY_UPGRADE_STONE_ICON_ROOT := "res://assets/library/downloaded/rpg_icons_400/Icon%d.png"
## A run owns exactly one fixed active/reserve pair. The array remains in the
## save shape for backward compatibility, but only one reserve is canonical.
const SOUL_TEAM_RESERVE_CAPACITY := 1
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const HERO_SOUL_COMBAT_AFFIXES := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const PLAYER_PROGRESSION_RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const HERO_PROGRESSION_RULES := preload("res://game/meta/progression/hero_progression_rules.gd")
const HERO_SKILL_KIT_RULES := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const DIFFICULTY_RULES := preload("res://game/meta/progression/difficulty_rules.gd")
const LOOT_RARITY_RULES := preload("res://game/loot/loot_rarity_rules.gd")
const AUXILIARY_EQUIPMENT_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_EQUIPMENT_DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")
const DEFAULT_SAVE_PATH := "user://soul_of_hero_save.json"
const LEGACY_DEFAULT_SAVE_PATH := "user://living_arsenal_save.json"
const TEST_PATH_ENVIRONMENT_VARIABLE := "SOUL_OF_HERO_SAVE_PATH"
const LEGACY_TEST_PATH_ENVIRONMENT_VARIABLE := "LIVING_ARSENAL_SAVE_PATH"
const UI_SHELL_CAPTURE_SAVE_PATH := "user://tests/ui_shell_route_capture.json"
const MAX_TRANSACTION_KEY_LENGTH := 160
## Every stackable inventory record occupies one of the shared 30 bag slots.
## Consumables, upgrade stones and materials may hold up to fifty per slot.
## Further copies fill another free bag slot of the same item rather than
## silently exceeding the visible stack cap.
const MAX_INVENTORY_STACK_QUANTITY := 50
## Physical cabinet capacity.  Stackables remain stack-based; individual Soul
## and equipment drops must stay on the ground when their relevant cabinet is
## full so the player can sell, fuse, or deliberately discard first.
const INVENTORY_SLOT_CAPACITY := 30
const HOME_STORAGE_SLOT_CAPACITY := 50
const HERO_UNLOCK_SHARD_COST := 50
const INVENTORY_ITEM_KIND_IDS := ["material", "consumable", "blueprint", "key_item"]
const RESET_PROGRESSION_KEEP_SETTINGS_TOKEN := "RESET_SOUL_OF_HERO_PROGRESSION_KEEP_SETTINGS"
const LEGACY_RESET_PROGRESSION_KEEP_SETTINGS_TOKEN := "RESET_LIVING_ARSENAL_PROGRESSION_KEEP_SETTINGS"
const RESET_ALL_TOKEN := "RESET_SOUL_OF_HERO_SAVE"
const LEGACY_RESET_ALL_TOKEN := "RESET_LIVING_ARSENAL_SAVE"
const SETTINGS_NUMERIC_RANGES := {
	"master_volume": [0.0, 1.0],
	"music_volume": [0.0, 1.0],
	"sfx_volume": [0.0, 1.0],
	"screen_shake": [0.0, 1.0],
	"aim_assist": [0.0, 1.0],
	"ui_scale": [0.75, 1.5],
	"joystick_opacity": [0.25, 1.0],
	"joystick_size": [0.75, 1.5],
	"button_scale": [0.75, 1.5],
}
const SETTINGS_BOOLEAN_KEYS := [
	"vibration",
	"damage_numbers",
	"reduced_flashes",
	"reduced_motion",
	"fullscreen",
	"show_fps",
	"high_contrast",
	"left_handed",
]
const SETTINGS_STRING_OPTIONS := {
	"telegraph_palette": ["standard", "colorblind", "high_contrast"],
}

var _save_path := DEFAULT_SAVE_PATH
var _backup_path := DEFAULT_SAVE_PATH + ".bak"
var _temporary_path := DEFAULT_SAVE_PATH + ".tmp"
var _migration_backup_path := DEFAULT_SAVE_PATH + ".pre_v3.bak"
var _legacy_import_path := LEGACY_DEFAULT_SAVE_PATH
var _data: Dictionary = {}
var _is_loaded := false
var _commit_in_progress := false
var _migrations: Dictionary = {}
var _economy_capability := RefCounted.new()
var _disk_commit_capability := RefCounted.new()
var _economy_adapter: RefCounted
var _economy_facade: Node
var _economy_mutation_active := false
var _transaction_mutation_active := false
var _economy_quarantine_reason := ""
var _economy_quarantine_path := ""



func _init() -> void:
	_migrations[0] = Callable(self, "_migrate_v0_to_v1")
	_migrations[1] = Callable(self, "_migrate_v1_to_v2")
	_migrations[2] = Callable(self, "_migrate_v2_to_v3")
	_migrations[3] = Callable(self, "_migrate_v3_to_v4")
	var override_path := OS.get_environment(TEST_PATH_ENVIRONMENT_VARIABLE)
	if override_path.is_empty():
		override_path = OS.get_environment(LEGACY_TEST_PATH_ENVIRONMENT_VARIABLE)
	if OS.is_debug_build() and _is_safe_user_path(override_path):
		_set_storage_paths(override_path)
		_legacy_import_path = ""
	elif OS.is_debug_build() and OS.get_cmdline_user_args().has("--ui-shell-capture"):
		# Route captures may be launched directly from the editor/CLI. Keep them
		# away from the player's default profile even when no wrapper script set an
		# explicit save override before this autoload initializes.
		_set_storage_paths(UI_SHELL_CAPTURE_SAVE_PATH)
		_legacy_import_path = ""


func _ready() -> void:
	load_save()


## Overrides storage for automated tests or development profiles. Production
## builds ignore the environment override, and this method accepts user:// only.
func configure_storage(path: String, load_immediately := true) -> bool:
	if not _is_safe_user_path(path):
		_push_failure("Save path must be a JSON file below user://.")
		return false
	_set_storage_paths(path)
	_legacy_import_path = ""
	_data.clear()
	_is_loaded = false
	_economy_quarantine_reason = ""
	_economy_quarantine_path = ""
	if load_immediately:
		return load_save()
	return true


## Registers a future one-version migration. Built-in migrations are installed
## during _init; a migration receives and must return a Dictionary.
func register_migration(from_version: int, migration: Callable) -> bool:
	if from_version < 0 or from_version >= CURRENT_SCHEMA_VERSION or not migration.is_valid():
		return false
	_migrations[from_version] = migration
	return true


func load_save() -> bool:
	# A manual retry may succeed after the user restores or repairs the file.
	_economy_quarantine_reason = ""
	_economy_quarantine_path = ""
	if (
			not FileAccess.file_exists(_save_path)
			and not _legacy_import_path.is_empty()
			and FileAccess.file_exists(_legacy_import_path)
	):
		return _import_legacy_default_save()

	var primary := _read_and_prepare(_save_path)
	if bool(primary.get("economy_quarantine", false)):
		return _quarantine_economy_save(_save_path, String(primary.get("error", "invalid_ownership")))
	if bool(primary.get("ok", false)):
		var primary_snapshot: Dictionary = primary.get("data", {}).duplicate(true)
		if bool(primary.get("was_migrated", false)):
			var source_version := int(primary.get("source_version", 0))
			if not _preserve_pre_migration_backup(_save_path):
				_accept_loaded_data(primary_snapshot, "")
				_push_failure("Could not preserve the pre-v2 save; migration was not committed.")
				return false
			if not _commit_snapshot(primary_snapshot, false, _disk_commit_capability):
				_accept_loaded_data(primary_snapshot, "")
				_push_failure("Prepared the current schema in memory, but could not commit the migrated save.")
				return false
			_accept_loaded_data(primary_snapshot, "")
			save_migrated.emit(source_version, CURRENT_SCHEMA_VERSION, _migration_backup_path)
			return true
		if bool(primary.get("hero_soul_rules_migrated", false)) \
				or bool(primary.get("hero_soul_selection_migrated", false)) \
				or bool(primary.get("skill_economy_migrated", false)) \
				or bool(primary.get("stat_economy_migrated", false)) \
				or bool(primary.get("auxiliary_equipment_migrated", false)):
			# Rules generations are independent from the outer save schema. Rotate
			# the untouched profile to the ordinary backup, then persist the
			# normalized inventory so a future load cannot reinterpret rarity 5.
			if not _commit_snapshot(primary_snapshot, true, _disk_commit_capability):
				_accept_loaded_data(primary_snapshot, "")
				_push_failure("Prepared a rules migration in memory, but could not commit the upgraded profile.")
				return false
			_accept_loaded_data(primary_snapshot, "")
			return true
		_accept_loaded_data(primary_snapshot, "")
		return true

	var backup := _read_and_prepare(_backup_path)
	if bool(backup.get("economy_quarantine", false)):
		return _quarantine_economy_save(_backup_path, String(backup.get("error", "invalid_ownership")))
	if bool(backup.get("ok", false)):
		var recovered: Dictionary = backup.get("data", {}).duplicate(true)
		if bool(backup.get("was_migrated", false)):
			if not _preserve_pre_migration_backup(_backup_path):
				_accept_loaded_data(recovered, "backup")
				_push_failure("Recovered an old backup in memory, but could not preserve its pre-v2 generation.")
				return false
		_accept_loaded_data(recovered, "backup")
		# Never rotate a corrupt primary over the known-good backup.
		if not _commit_snapshot(recovered, false, _disk_commit_capability):
			_push_failure("Recovered the backup in memory, but could not repair the primary save.")
		if bool(backup.get("was_migrated", false)):
			save_migrated.emit(int(backup.get("source_version", 0)), CURRENT_SCHEMA_VERSION, _migration_backup_path)
		return true

	var migration_backup := _read_and_prepare(_migration_backup_path)
	if bool(migration_backup.get("economy_quarantine", false)):
		return _quarantine_economy_save(_migration_backup_path, String(migration_backup.get("error", "invalid_ownership")))
	if bool(migration_backup.get("ok", false)):
		var migration_recovery: Dictionary = migration_backup.get("data", {}).duplicate(true)
		if not _preserve_pre_migration_backup(_migration_backup_path):
			_accept_loaded_data(migration_recovery, "migration_backup")
			_push_failure("Loaded the permanent migration backup in memory, but could not prepare rollback storage.")
			return false
		_accept_loaded_data(migration_recovery, "migration_backup")
		if not _commit_snapshot(migration_recovery, false, _disk_commit_capability):
			_push_failure("Recovered the permanent migration backup in memory, but could not repair the primary save.")
		if bool(migration_backup.get("was_migrated", false)):
			save_migrated.emit(
				int(migration_backup.get("source_version", 0)),
				CURRENT_SCHEMA_VERSION,
				_migration_backup_path
			)
		return true

	var defaults := _default_data()
	_accept_loaded_data(defaults, "defaults" if FileAccess.file_exists(_save_path) else "")
	if not _commit_snapshot(defaults, false, _disk_commit_capability):
		_push_failure("Loaded safe defaults in memory, but could not create the save file.")
		return false
	return true


## A quarantined file remains untouched on disk. No profile writes, resets or
## fallback-overwrite are allowed until an explicit repair/reload or a different
## development profile is selected. This is fail-closed, not a recovery UI.
func get_economy_quarantine() -> Dictionary:
	return {"active": not _economy_quarantine_reason.is_empty(),
		"reason": _economy_quarantine_reason, "path": _economy_quarantine_path}


func _quarantine_economy_save(path: String, reason: String) -> bool:
	_economy_quarantine_reason = reason
	_economy_quarantine_path = path
	_data = _default_data()
	_is_loaded = true
	var message := "Save ownership requires recovery (%s); original bytes were not modified." % reason
	push_warning(message)
	save_failed.emit(message)
	return false


func reload_save() -> bool:
	return load_save()


func is_loaded() -> bool:
	return _is_loaded


## Always returns a deep copy so callers cannot mutate progression without a
## validated commit.
func get_snapshot() -> Dictionary:
	_ensure_loaded()
	return _data.duplicate(true)


func get_value(path: Array[String], fallback: Variant = null) -> Variant:
	_ensure_loaded()
	var cursor: Variant = _data
	for segment: String in path:
		if not cursor is Dictionary or not (cursor as Dictionary).has(segment):
			return fallback
		cursor = (cursor as Dictionary)[segment]
	if cursor is Dictionary or cursor is Array:
		return cursor.duplicate(true)
	return cursor


## Returns derived point totals, stat values and per-Identity skill ranks without
## persisting duplicate "unspent" counters that could drift from player level.
func get_player_progression_snapshot() -> Dictionary:
	_ensure_loaded()
	var progression: Dictionary = _data.get("progression", {})
	var player: Dictionary = progression.get("player", {})
	var player_level := int(player.get("level", 1))
	var current_xp := int(player.get("xp", 0))
	var required_xp := PLAYER_PROGRESSION_RULES.xp_required_for_level(player_level)
	var stat_allocation: Dictionary = player.get("stat_allocation", {})
	var skill_allocations: Dictionary = player.get("skill_allocations", {})
	return {
		"player_level": player_level,
		"xp": current_xp,
		"xp_required": required_xp,
		"xp_to_next": maxi(0, required_xp - current_xp),
		"xp_progress": clampf(float(current_xp) / float(required_xp), 0.0, 1.0) \
			if required_xp > 0 else 1.0,
		"stats": PLAYER_PROGRESSION_RULES.stat_snapshot(player_level, stat_allocation),
		"stat_economy": {
			"version": int(player.get("stat_economy_version", CURRENT_STAT_ECONOMY_VERSION)),
			"free_reallocation_credits": int(player.get("free_stat_reallocation_credits", 0)),
		},
		"skills": PLAYER_PROGRESSION_RULES.skill_snapshot(player_level, skill_allocations),
	}


## Commits every confirmed combat XP gain immediately. Transaction IDs are
## supplied by the run/enemy authority, making duplicate death callbacks safe
## without delaying feedback until a result screen.
func grant_player_experience(
		amount: int,
		transaction_key: String,
		source_metadata: Dictionary = {},
) -> Dictionary:
	if amount < 1 or not _is_valid_transaction_key(transaction_key):
		return {}
	var before := get_player_progression_snapshot()
	var resolution := PLAYER_PROGRESSION_RULES.resolve_experience_gain(
		int(before.get("player_level", 1)),
		int(before.get("xp", 0)),
		amount,
	)
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			player["level"] = int(resolution.get("level", player.get("level", 1)))
			player["xp"] = int(resolution.get("xp", player.get("xp", 0)))
			progression["player"] = player
			candidate["progression"] = progression
			return true,
		{
			"kind": "player_experience_grant",
			"amount": amount,
			"source": source_metadata.duplicate(true),
		},
	)
	resolution["applied"] = applied
	resolution["transaction_id"] = transaction_key
	resolution["already_applied"] = not applied and is_transaction_applied(transaction_key)
	if applied:
		_emit_player_progression_events(
			int(resolution.get("level", 1)),
			int(resolution.get("xp", 0)),
			int(resolution.get("xp_required", 0)),
			amount,
			int(resolution.get("levels_gained", 0)),
		)
	return resolution


func get_highest_unlocked_average_enemy_level() -> int:
	_ensure_loaded()
	var campaign: Dictionary = (_data.get("progression", {}) as Dictionary).get("campaign", {})
	var authored := int(campaign.get("average_enemy_level_cap", 0))
	if authored > 0:
		return authored
	return HERO_PROGRESSION_RULES.default_average_enemy_level(
		maxi(1, int(campaign.get("level", 1)))
	)


func get_hero_progression_snapshot(hero_id: StringName) -> Dictionary:
	_ensure_loaded()
	var normalized := String(hero_id).strip_edges().to_lower()
	if not _is_persistable_hero_id(normalized):
		return {}
	var progression: Dictionary = _data.get("progression", {})
	var records: Dictionary = progression.get("heroes", {})
	var record: Dictionary = HERO_PROGRESSION_RULES.empty_record(StringName(normalized))
	if records.get(normalized, {}) is Dictionary:
		record.merge((records.get(normalized, {}) as Dictionary), true)
	var level := int(record.get("level", 1))
	var xp := int(record.get("xp", 0))
	var required := HERO_PROGRESSION_RULES.xp_required_for_level(level)
	return {
		"hero_id": normalized,
		"level": level,
		"xp": xp,
		"xp_required": required,
		"xp_to_next": maxi(0, required - xp),
		"xp_progress": clampf(float(xp) / float(required), 0.0, 1.0) if required > 0 else 1.0,
		"level_cap": get_highest_unlocked_average_enemy_level(),
		"stats": HERO_PROGRESSION_RULES.combat_stats(StringName(normalized), record),
		"stat_allocation": (record.get("stat_allocation", {}) as Dictionary).duplicate(true),
		"skill_allocations": (record.get("skill_allocations", {}) as Dictionary).duplicate(true),
	}


func grant_hero_experience(
		hero_id: StringName,
		amount: int,
		transaction_key: String,
		source_metadata: Dictionary = {},
) -> Dictionary:
	var normalized := String(hero_id).strip_edges().to_lower()
	if amount < 1 or not _is_persistable_hero_id(normalized) \
			or not _is_valid_transaction_key(transaction_key):
		return {}
	# Callables capture scalar/Dictionary assignments by value in GDScript.
	# A one-element reference box preserves the exact resolution produced by the
	# atomic mutator for the caller and UI.
	var resolution_box: Array[Dictionary] = [{}]
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var unlocked: Dictionary = progression.get("unlocked_heroes", {})
			if not bool(unlocked.get(normalized, false)):
				return false
			var records: Dictionary = progression.get("heroes", {}).duplicate(true)
			var record: Dictionary = HERO_PROGRESSION_RULES.empty_record(StringName(normalized))
			if records.get(normalized, {}) is Dictionary:
				record.merge((records.get(normalized, {}) as Dictionary), true)
			var campaign: Dictionary = progression.get("campaign", {})
			var cap := int(campaign.get("average_enemy_level_cap", 0))
			if cap <= 0:
				cap = HERO_PROGRESSION_RULES.default_average_enemy_level(
					maxi(1, int(campaign.get("level", 1)))
				)
			var candidate_resolution := HERO_PROGRESSION_RULES.resolve_experience_gain(
				int(record.get("level", 1)), int(record.get("xp", 0)), amount, cap
			)
			resolution_box[0] = candidate_resolution
			record["level"] = int(candidate_resolution.get("level", 1))
			record["xp"] = int(candidate_resolution.get("xp", 0))
			record["base_stats"] = HERO_SKILL_KIT_RULES.base_stats(StringName(normalized))
			records[normalized] = record
			progression["heroes"] = records
			candidate["progression"] = progression
			return true,
		{
			"kind": "hero_experience_grant",
			"hero_id": normalized,
			"amount": amount,
			"source": source_metadata.duplicate(true),
		},
	)
	var resolution := resolution_box[0].duplicate(true)
	resolution["applied"] = applied
	resolution["transaction_id"] = transaction_key
	resolution["already_applied"] = not applied and is_transaction_applied(transaction_key)
	if applied:
		var hero_snapshot := get_hero_progression_snapshot(StringName(normalized))
		hero_progression_changed.emit(StringName(normalized), hero_snapshot)
		var events := get_node_or_null("/root/GameEvents")
		if events != null and events.has_signal(&"hero_experience_changed"):
			events.emit_signal(
				&"hero_experience_changed",
				StringName(normalized),
				int(hero_snapshot.get("xp", 0)),
				int(hero_snapshot.get("xp_required", 0)),
				int(resolution.get("xp_applied", 0)),
			)
		var levels_gained := int(resolution.get("levels_gained", 0))
		if levels_gained > 0 and events != null and events.has_signal(&"hero_level_changed"):
			events.emit_signal(
				&"hero_level_changed",
				StringName(normalized),
				int(hero_snapshot.get("level", 1)),
				levels_gained,
			)
	return resolution


## Consumes XP stones from the bag and grants their XP to exactly one Hero in
## one transaction. A fully capped Hero rejects the action without spending a
## stone. If the final stone crosses the cap, excess XP is deliberately lost:
## it is never banked for a later stage.
func consume_hero_xp_stone(
		hero_id: StringName,
		item_id: StringName,
		quantity: int,
		transaction_key: String,
) -> Dictionary:
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	var normalized_item := String(item_id).strip_edges().to_lower()
	if not _is_persistable_hero_id(normalized_hero) or quantity < 1 \
			or not _is_valid_identifier(normalized_item) \
			or not _is_valid_transaction_key(transaction_key):
		return {}
	var item_definition := STACK_ITEM_CATALOG.find(StringName(normalized_item))
	if item_definition == null or item_definition.item_kind != "consumable" \
			or item_definition.hero_xp_value <= 0:
		return {}
	var requested_xp := item_definition.hero_xp_value * quantity
	var resolution_box: Array[Dictionary] = [{}]
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var unlocked: Dictionary = progression.get("unlocked_heroes", {})
			if not bool(unlocked.get(normalized_hero, false)):
				return false
			var records: Dictionary = progression.get("heroes", {}).duplicate(true)
			var record: Dictionary = HERO_PROGRESSION_RULES.empty_record(StringName(normalized_hero))
			if records.get(normalized_hero, {}) is Dictionary:
				record.merge((records.get(normalized_hero, {}) as Dictionary), true)
			var campaign: Dictionary = progression.get("campaign", {})
			var cap := int(campaign.get("average_enemy_level_cap", 0))
			if cap <= 0:
				cap = HERO_PROGRESSION_RULES.default_average_enemy_level(
					maxi(1, int(campaign.get("level", 1)))
				)
			var candidate_resolution := HERO_PROGRESSION_RULES.resolve_experience_gain(
				int(record.get("level", 1)), int(record.get("xp", 0)), requested_xp, cap
			)
			resolution_box[0] = candidate_resolution
			if int(candidate_resolution.get("xp_applied", 0)) <= 0:
				return false
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var stacks: Dictionary = inventory.get("item_stacks", {}).duplicate(true)
			var matching_keys := _matching_inventory_stack_keys(stacks, normalized_item)
			var available := 0
			for stack_key: String in matching_keys:
				var raw_record: Variant = stacks.get(stack_key, {})
				if not raw_record is Dictionary:
					return false
				available += int((raw_record as Dictionary).get("quantity", 0))
			if available < quantity:
				return false
			var remaining := quantity
			for stack_key: String in matching_keys:
				if remaining <= 0:
					break
				var stack_record := (stacks[stack_key] as Dictionary).duplicate(true)
				var current_quantity := int(stack_record.get("quantity", 0))
				var consumed := mini(remaining, current_quantity)
				remaining -= consumed
				if consumed >= current_quantity:
					stacks.erase(stack_key)
				else:
					stack_record["quantity"] = current_quantity - consumed
					stacks[stack_key] = stack_record
			record["level"] = int(candidate_resolution.get("level", 1))
			record["xp"] = int(candidate_resolution.get("xp", 0))
			record["base_stats"] = HERO_SKILL_KIT_RULES.base_stats(StringName(normalized_hero))
			records[normalized_hero] = record
			progression["heroes"] = records
			inventory["item_stacks"] = stacks
			candidate["progression"] = progression
			candidate["inventory"] = inventory
			return true,
		{
			"kind": "hero_xp_stone_consume",
			"hero_id": normalized_hero,
			"item_id": normalized_item,
			"quantity": quantity,
			"xp_requested": requested_xp,
		},
	)
	var resolution := resolution_box[0].duplicate(true)
	resolution["applied"] = applied
	resolution["transaction_id"] = transaction_key
	resolution["already_applied"] = not applied and is_transaction_applied(transaction_key)
	if applied:
		hero_progression_changed.emit(
			StringName(normalized_hero), get_hero_progression_snapshot(StringName(normalized_hero))
		)
	return resolution


func get_hero_shards(hero_id: StringName) -> int:
	var normalized := String(hero_id).strip_edges().to_lower()
	if normalized == "axe_hero":
		return 0
	return int(get_value(["progression", "hero_shards", normalized], 0))


func grant_hero_shards(
		hero_id: StringName,
		amount: int,
		transaction_key: String,
		source_metadata: Dictionary = {},
) -> bool:
	var normalized := String(hero_id).strip_edges().to_lower()
	if normalized == "axe_hero" or amount < 1 or not _is_persistable_hero_id(normalized) \
			or not _is_valid_transaction_key(transaction_key):
		return false
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var shards: Dictionary = progression.get("hero_shards", {}).duplicate(true)
			shards[normalized] = int(shards.get(normalized, 0)) + amount
			progression["hero_shards"] = shards
			candidate["progression"] = progression
			return true,
		{"kind": "hero_shard_grant", "hero_id": normalized, "amount": amount, "source": source_metadata.duplicate(true)},
	)
	if applied:
		hero_shards_changed.emit(StringName(normalized), get_hero_shards(StringName(normalized)))
	return applied


func unlock_hero_with_shards(hero_id: StringName, transaction_key: String) -> bool:
	var normalized := String(hero_id).strip_edges().to_lower()
	if normalized == "axe_hero" or normalized == "sword_hero" \
			or not _is_persistable_hero_id(normalized) \
			or not _is_valid_transaction_key(transaction_key):
		return false
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var heroes: Dictionary = progression.get("unlocked_heroes", {}).duplicate(true)
			if bool(heroes.get(normalized, false)):
				return false
			var shards: Dictionary = progression.get("hero_shards", {}).duplicate(true)
			if int(shards.get(normalized, 0)) < HERO_UNLOCK_SHARD_COST:
				return false
			shards[normalized] = int(shards.get(normalized, 0)) - HERO_UNLOCK_SHARD_COST
			heroes[normalized] = true
			var records: Dictionary = progression.get("heroes", {}).duplicate(true)
			records[normalized] = HERO_PROGRESSION_RULES.empty_record(StringName(normalized))
			progression["hero_shards"] = shards
			progression["unlocked_heroes"] = heroes
			progression["heroes"] = records
			candidate["progression"] = progression
			_ensure_starter_hero_weapon_in_candidate(candidate, normalized, "shard_unlock")
			return true,
		{"kind": "hero_unlock_shards", "hero_id": normalized, "cost": HERO_UNLOCK_SHARD_COST},
	)
	if applied:
		hero_shards_changed.emit(StringName(normalized), get_hero_shards(StringName(normalized)))
		hero_identity_unlocked.emit(StringName(normalized))
	return applied


func unlock_story_hero(hero_id: StringName, transaction_key: String) -> bool:
	var normalized := String(hero_id).strip_edges().to_lower()
	if normalized != "axe_hero" or not _is_valid_transaction_key(transaction_key):
		return false
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var heroes: Dictionary = progression.get("unlocked_heroes", {}).duplicate(true)
			if bool(heroes.get(normalized, false)):
				return false
			heroes[normalized] = true
			var records: Dictionary = progression.get("heroes", {}).duplicate(true)
			records[normalized] = HERO_PROGRESSION_RULES.empty_record(StringName(normalized))
			progression["unlocked_heroes"] = heroes
			progression["heroes"] = records
			candidate["progression"] = progression
			_ensure_starter_hero_weapon_in_candidate(candidate, normalized, "story_unlock")
			return true,
		{"kind": "hero_unlock_story", "hero_id": normalized},
	)
	if applied:
		hero_identity_unlocked.emit(StringName(normalized))
	return applied


## Authoritative content rewards may grant one or more player levels. Stat and
## Skill Points are derived from level, so this one atomic mutation unlocks both
## pools without maintaining fragile duplicate counters.
func grant_player_levels(amount: int, transaction_key: String, source_metadata: Dictionary = {}) -> bool:
	if amount < 1 or not _is_valid_transaction_key(transaction_key):
		return false
	var previous_level := int(get_player_progression_snapshot().get("player_level", 1))
	var applied := transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			var current_level := int(player.get("level", 1))
			var next_level := mini(PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP, current_level + amount)
			if next_level <= current_level:
				return false
			player["level"] = next_level
			if next_level >= PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP:
				player["xp"] = 0
			progression["player"] = player
			candidate["progression"] = progression
			return true,
		{"kind": "player_level_grant", "amount": amount, "source": source_metadata.duplicate(true)}
	)
	if applied:
		var snapshot := get_player_progression_snapshot()
		var current_level := int(snapshot.get("player_level", previous_level))
		_emit_player_progression_events(
			current_level,
			int(snapshot.get("xp", 0)),
			int(snapshot.get("xp_required", 0)),
			0,
			maxi(0, current_level - previous_level),
		)
	return applied


func set_campaign_level_difficulty(
		level_id: StringName,
		difficulty_id: StringName,
		transaction_key: String,
) -> bool:
	var normalized_level := String(level_id).strip_edges().to_lower()
	var normalized_difficulty := StringName(String(difficulty_id).strip_edges().to_lower())
	if not _is_valid_identifier(normalized_level) \
			or not DIFFICULTY_RULES.is_valid_id(normalized_difficulty) \
			or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			var selected: Dictionary = campaign.get("selected_difficulties", {}).duplicate(true)
			if StringName(selected.get(normalized_level, &"")) == normalized_difficulty:
				return false
			selected[normalized_level] = String(normalized_difficulty)
			campaign["selected_difficulties"] = selected
			progression["campaign"] = campaign
			candidate["progression"] = progression
			return true,
		{
			"kind": "campaign_level_difficulty_selection",
			"level_id": normalized_level,
			"difficulty": String(normalized_difficulty),
		},
	)


func grant_inventory_item(
		item_id: StringName,
		kind_id: StringName,
		quantity: int,
		transaction_key: String,
		source_metadata: Dictionary = {},
) -> bool:
	var normalized_item := String(item_id).strip_edges().to_lower()
	var normalized_kind := String(kind_id).strip_edges().to_lower()
	if not _is_valid_identifier(normalized_item) or normalized_kind not in INVENTORY_ITEM_KIND_IDS \
			or quantity < 1 or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			return add_items_to_candidate(
				candidate, normalized_item, normalized_kind, quantity, source_metadata,
			),
		{
			"kind": "inventory_item_grant",
			"item_id": normalized_item,
			"item_kind": normalized_kind,
			"quantity": quantity,
			"source": source_metadata.duplicate(true),
		},
	)


## The inventory's stack map as committed, as a copy.
##
## Callers that only want to read the bag should use this rather than
## `get_value(["inventory", "item_stacks"], {})`. That path works from GDScript
## source, but [method Object.call] passes variants and then rejects an untyped
## array where `get_value` expects `Array[String]` — the failure is a runtime
## error inside the reader, which shows up as "the bag is empty" everywhere
## downstream. One accessor with no array to type is one fewer way to get that
## wrong.
## Total quantity of every item in the committed bag, merged across stacks.
##
## A stack is keyed by its item id when it is the item's first stack, and the
## record then omits `item_id` entirely (see `_with_inventory_stack_metadata`).
## Anything that counts by reading `record.item_id` alone therefore reports zero
## for the *most common* stack shape — so the base id is resolved here, through
## the same helper the mutation path uses, and no caller has to know the rule.
func inventory_totals() -> Dictionary:
	var stacks := get_inventory_stacks()
	var totals: Dictionary = {}
	for raw_key: Variant in stacks.keys():
		var stack_key := String(raw_key).strip_edges().to_lower()
		var raw_record: Variant = stacks[raw_key]
		if not raw_record is Dictionary:
			continue
		var record: Dictionary = raw_record
		var item_id := _inventory_stack_base_id(stack_key, record)
		var quantity := int(record.get("quantity", 0))
		if item_id.is_empty() or quantity <= 0:
			continue
		totals[item_id] = int(totals.get(item_id, 0)) + quantity
	return totals


## Total quantity of one item in the committed bag.
func inventory_total(item_id: String) -> int:
	return int(inventory_totals().get(item_id.strip_edges().to_lower(), 0))


func get_inventory_stacks() -> Dictionary:
	_ensure_loaded()
	var inventory: Variant = _data.get("inventory", {})
	if not inventory is Dictionary:
		return {}
	var stacks: Variant = (inventory as Dictionary).get("item_stacks", {})
	if not stacks is Dictionary:
		return {}
	return (stacks as Dictionary).duplicate(true)


## Adds items to the inventory of a *candidate* save document.
##
## This is the body of [method grant_inventory_item] without the transaction
## wrapper, and it exists so that a composite action can pay or grant items in the
## same commit as its own state change. Survival construction is the first user:
## "consume the timber and create the wall" must be one commit, or a crash between
## them either destroys the materials or hands out a free wall. Systems that own
## their state inside the save document (CT-02, CT-03, CT-07) call this from inside
## their own `transact_once` mutator; nothing else should call it directly, because
## a candidate that is never committed silently discards the grant.
##
## Returns false when the grant cannot be applied at all (unknown kind, bad stack
## contents, or a full bag). A `false` return must be treated as "the whole
## transaction is rejected" — the caller returns false from its mutator, which
## leaves the committed document untouched.
func add_items_to_candidate(
		candidate: Dictionary,
		item_id: String,
		kind_id: String,
		quantity: int,
		source_metadata: Dictionary = {},
) -> bool:
	if item_id.strip_edges().to_lower().begins_with("soh_i_"):
		return false
	return _add_items_to_candidate_internal(candidate, item_id, kind_id, quantity, source_metadata)


func _add_items_to_candidate_internal(
		candidate: Dictionary,
		item_id: String,
		kind_id: String,
		quantity: int,
		source_metadata: Dictionary = {},
) -> bool:
	var normalized_item := String(item_id).strip_edges().to_lower()
	var normalized_kind := String(kind_id).strip_edges().to_lower()
	if not _is_valid_identifier(normalized_item) or normalized_kind not in INVENTORY_ITEM_KIND_IDS \
			or quantity < 1:
		return false
	var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
	var stacks: Dictionary = inventory.get("item_stacks", {}).duplicate(true)
	var remaining := quantity
	var matching_keys := _matching_inventory_stack_keys(stacks, normalized_item)
	for stack_key: String in matching_keys:
		var existing_value: Variant = stacks.get(stack_key, {})
		if not existing_value is Dictionary:
			return false
		var existing := (existing_value as Dictionary).duplicate(true)
		if String(existing.get("kind", "")).strip_edges().to_lower() != normalized_kind:
			return false
		var current_quantity := int(existing.get("quantity", 0))
		if current_quantity < 0 or current_quantity > MAX_INVENTORY_STACK_QUANTITY:
			return false
		var added := mini(remaining, MAX_INVENTORY_STACK_QUANTITY - current_quantity)
		if added <= 0:
			continue
		stacks[stack_key] = _with_inventory_stack_metadata(
			existing, normalized_item, stack_key, normalized_kind, current_quantity + added, source_metadata,
		)
		remaining -= added
		if remaining <= 0:
			break
	while remaining > 0:
		if _candidate_inventory_slot_count_for_stacks(inventory, stacks) >= INVENTORY_SLOT_CAPACITY:
			return false
		var stack_key := _next_inventory_stack_key(stacks, normalized_item)
		var added := mini(remaining, MAX_INVENTORY_STACK_QUANTITY)
		stacks[stack_key] = _with_inventory_stack_metadata(
			{}, normalized_item, stack_key, normalized_kind, added, source_metadata,
		)
		remaining -= added
	inventory["item_stacks"] = stacks
	candidate["inventory"] = inventory
	return true


func consume_inventory_item(
	item_id: StringName,
	quantity: int,
	transaction_key: String,
) -> bool:
	var normalized_item := String(item_id).strip_edges().to_lower()
	if not _is_valid_identifier(normalized_item) or quantity < 1 \
			or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			return remove_items_from_candidate(candidate, normalized_item, quantity),
		{
			"kind": "inventory_item_consume",
			"item_id": normalized_item,
			"quantity": quantity,
		},
	)


## Removes items from the inventory of a *candidate* save document.
##
## The counterpart to [method add_items_to_candidate]. All-or-nothing: when the
## candidate cannot cover `quantity`, nothing is removed and the caller must abort
## its transaction. That is what stops a partially paid construction.
func remove_items_from_candidate(
		candidate: Dictionary,
		item_id: String,
		quantity: int,
) -> bool:
	if item_id.strip_edges().to_lower().begins_with("soh_i_"):
		return false
	return _remove_items_from_candidate_internal(candidate, item_id, quantity)


func _remove_items_from_candidate_internal(
		candidate: Dictionary,
		item_id: String,
		quantity: int,
) -> bool:
	var normalized_item := String(item_id).strip_edges().to_lower()
	if not _is_valid_identifier(normalized_item) or quantity < 1:
		return false
	var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
	var stacks: Dictionary = inventory.get("item_stacks", {}).duplicate(true)
	var matching_keys := _matching_inventory_stack_keys(stacks, normalized_item)
	var available := 0
	for stack_key: String in matching_keys:
		var raw_record: Variant = stacks.get(stack_key, {})
		if not raw_record is Dictionary:
			return false
		available += int((raw_record as Dictionary).get("quantity", 0))
	if available < quantity:
		return false
	var remaining := quantity
	for stack_key: String in matching_keys:
		if remaining <= 0:
			break
		var record := (stacks[stack_key] as Dictionary).duplicate(true)
		var current_quantity := int(record.get("quantity", 0))
		var consumed := mini(remaining, current_quantity)
		remaining -= consumed
		if consumed >= current_quantity:
			stacks.erase(stack_key)
		else:
			record["quantity"] = current_quantity - consumed
			stacks[stack_key] = record
	inventory["item_stacks"] = stacks
	candidate["inventory"] = inventory
	return true


## Removes an entire visible stack after the UI has successfully materialized a
## player-dropped GroundLoot.  The separate transaction kind makes drop audits
## intelligible without changing ordinary consumption semantics.
func drop_inventory_item(
	stack_key_value: StringName,
	quantity: int,
	transaction_key: String,
) -> bool:
	var stack_key := String(stack_key_value).strip_edges().to_lower()
	if not _is_valid_identifier(stack_key) or quantity < 1 \
			or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var stacks: Dictionary = inventory.get("item_stacks", {}).duplicate(true)
			var raw_record: Variant = stacks.get(stack_key, {})
			if not raw_record is Dictionary:
				return false
			var record := (raw_record as Dictionary).duplicate(true)
			# A3 tokens have coupled attribute records; plain GroundLoot does not
			# yet provide an atomic transfer of that ownership.
			if _inventory_stack_base_id(stack_key, record).begins_with("soh_i_"):
				return false
			var current_quantity := int(record.get("quantity", 0))
			if current_quantity != quantity:
				return false
			stacks.erase(stack_key)
			inventory["item_stacks"] = stacks
			candidate["inventory"] = inventory
			return true,
		{
			"kind": "inventory_item_drop",
			"stack_key": stack_key,
			"quantity": quantity,
		},
	)


## Equipped Souls are protected because removing them would invalidate the live
## team.  Unequip/swap first, then a drag outside the bag can drop the copy.
func drop_hero_soul(instance_id: String, transaction_key: String) -> bool:
	var normalized_id := instance_id.strip_edges().to_lower()
	if normalized_id.is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var souls_value: Variant = inventory.get("hero_souls", [])
			if not souls_value is Array:
				return false
			var team_value: Variant = candidate.get("soul_team", {})
			var team := team_value as Dictionary if team_value is Dictionary else {}
			var selected_value: Variant = team.get("selected_soul_instances", {})
			var selected := selected_value as Dictionary if selected_value is Dictionary else {}
			for selected_id: Variant in selected.values():
				if String(selected_id).strip_edges().to_lower() == normalized_id:
					return false
			var remaining: Array = []
			var found := false
			for raw_soul: Variant in souls_value as Array:
				if raw_soul is Dictionary \
						and String((raw_soul as Dictionary).get("instance_id", "")).strip_edges().to_lower() == normalized_id:
					if bool((raw_soul as Dictionary).get("favorite", false)) \
							or bool((raw_soul as Dictionary).get("locked", false)):
						return false
					found = true
					continue
				remaining.append(raw_soul)
			if not found:
				return false
			inventory["hero_souls"] = remaining
			candidate["inventory"] = inventory
			return true,
		{"kind": "hero_soul_drop", "instance_id": normalized_id},
	)


## Equipped auxiliary items are likewise protected; this prevents an external
## drag from silently stripping live combat stats.
func drop_auxiliary_equipment(uuid: String, transaction_key: String) -> bool:
	var normalized_uuid := uuid.strip_edges().to_lower()
	if normalized_uuid.is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var items_value: Variant = inventory.get("auxiliary_equipment", [])
			if not items_value is Array:
				return false
			var loadout_value: Variant = candidate.get("auxiliary_loadout", {})
			var loadout := loadout_value as Dictionary if loadout_value is Dictionary else {}
			for equipped_uuid: Variant in loadout.values():
				if String(equipped_uuid).strip_edges().to_lower() == normalized_uuid:
					return false
			var remaining: Array = []
			var found := false
			for raw_item: Variant in items_value as Array:
				if raw_item is Dictionary \
						and String((raw_item as Dictionary).get("uuid", "")).strip_edges().to_lower() == normalized_uuid:
					if bool((raw_item as Dictionary).get("favorite", false)) \
							or bool((raw_item as Dictionary).get("locked", false)):
						return false
					found = true
					continue
				remaining.append(raw_item)
			if not found:
				return false
			inventory["auxiliary_equipment"] = remaining
			candidate["inventory"] = inventory
			return true,
		{"kind": "auxiliary_equipment_drop", "uuid": normalized_uuid},
	)


func allocate_player_stat(stat_id: StringName, amount: int, transaction_key: String) -> bool:
	var normalized_stat := StringName(String(stat_id).strip_edges().to_lower())
	if amount < 1 or normalized_stat not in PLAYER_PROGRESSION_RULES.STAT_IDS \
			or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			var allocation: Dictionary = player.get("stat_allocation", {}).duplicate(true)
			var key := String(normalized_stat)
			allocation[key] = int(allocation.get(key, 0)) + amount
			if not PLAYER_PROGRESSION_RULES.validate_stat_allocation(int(player.get("level", 1)), allocation):
				return false
			player["stat_allocation"] = allocation
			progression["player"] = player
			candidate["progression"] = progression
			return true,
		{"kind": "player_stat_allocation", "stat_id": String(normalized_stat), "amount": amount}
	)


## Replaces the complete allocation atomically for profiles migrated into the
## Power economy. The current build remains active until a valid out-of-combat
## replacement commits, avoiding a forced zero-stat intermediate state.
func reallocate_player_stats(
		replacement: Dictionary,
		is_outside_combat: bool,
		transaction_key: String,
) -> bool:
	if not is_outside_combat or not _is_valid_transaction_key(transaction_key):
		return false
	var normalized := {}
	for raw_key: Variant in replacement.keys():
		if StringName(raw_key) not in PLAYER_PROGRESSION_RULES.STAT_IDS:
			return false
	for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
		var raw_value: Variant = replacement.get(stat_id, replacement.get(String(stat_id), null))
		if not raw_value is int:
			return false
		normalized[String(stat_id)] = int(raw_value)
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			if int(player.get("stat_economy_version", 0)) != CURRENT_STAT_ECONOMY_VERSION \
					or int(player.get("free_stat_reallocation_credits", 0)) < 1:
				return false
			if not PLAYER_PROGRESSION_RULES.validate_stat_allocation(
					int(player.get("level", 1)), normalized):
				return false
			var current_value: Variant = player.get("stat_allocation", {})
			if not current_value is Dictionary or (current_value as Dictionary) == normalized:
				return false
			player["stat_allocation"] = normalized.duplicate(true)
			player["free_stat_reallocation_credits"] = (
				int(player.get("free_stat_reallocation_credits", 0)) - 1
			)
			progression["player"] = player
			candidate["progression"] = progression
			return true,
		{
			"kind": "player_stat_reallocation",
			"economy_version": CURRENT_STAT_ECONOMY_VERSION,
		},
	)


func allocate_hero_skill(
	hero_id: StringName,
	track_id: StringName,
	amount: int,
	transaction_key: String
) -> bool:
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	var normalized_track := StringName(String(track_id).strip_edges().to_lower())
	if (
			amount < 1
			or not _is_persistable_hero_id(normalized_hero)
			or normalized_track not in PLAYER_PROGRESSION_RULES.SKILL_TRACK_IDS
			or not _is_valid_transaction_key(transaction_key)
	):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var features: Dictionary = progression.get("features", {})
			if not bool(features.get("skill_allocation", false)):
				return false
			var unlocked_heroes: Dictionary = progression.get("unlocked_heroes", {})
			if not bool(unlocked_heroes.get(normalized_hero, false)) \
					or not _candidate_owns_hero(candidate, normalized_hero):
				return false
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			var allocations: Dictionary = player.get("skill_allocations", {}).duplicate(true)
			var tracks: Dictionary = PLAYER_PROGRESSION_RULES.empty_skill_tracks()
			if allocations.get(normalized_hero) is Dictionary:
				tracks = (allocations[normalized_hero] as Dictionary).duplicate(true)
			var track_key := String(normalized_track)
			tracks[track_key] = int(tracks.get(track_key, 0)) + amount
			allocations[normalized_hero] = tracks
			if not PLAYER_PROGRESSION_RULES.validate_skill_allocations(int(player.get("level", 1)), allocations):
				return false
			player["skill_allocations"] = allocations
			progression["player"] = player
			candidate["progression"] = progression
			return true,
		{
			"kind": "hero_skill_allocation",
			"hero_id": normalized_hero,
			"track_id": String(normalized_track),
			"amount": amount,
		}
	)


func respec_hero_skills(
	hero_id: StringName,
	is_outside_combat: bool,
	transaction_key: String
) -> bool:
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	if not _is_persistable_hero_id(normalized_hero) or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var features: Dictionary = progression.get("features", {})
			if not bool(features.get("skill_respec", false)):
				return false
			var player: Dictionary = progression.get("player", {}).duplicate(true)
			var allocations: Dictionary = player.get("skill_allocations", {}).duplicate(true)
			var result: Dictionary = PLAYER_PROGRESSION_RULES.respec_hero_identity(
				int(player.get("level", 1)),
				StringName(normalized_hero),
				allocations,
				is_outside_combat
			)
			if result.is_empty() or int(result.get("refunded_points", 0)) <= 0:
				return false
			var currencies: Dictionary = candidate.get("currencies", {}).duplicate(true)
			var cost := int(result.get("cost", 0))
			if int(currencies.get("account", 0)) < cost:
				return false
			currencies["account"] = int(currencies.get("account", 0)) - cost
			player["skill_allocations"] = (result.get("allocations", {}) as Dictionary).duplicate(true)
			progression["player"] = player
			candidate["progression"] = progression
			candidate["currencies"] = currencies
			return true,
		{"kind": "hero_skill_respec", "hero_id": normalized_hero}
	)


## Read-only record retained for migration support and player-support audits.
## Runtime loadout code must never treat this archive as currently usable content.
func get_legacy_audit() -> Dictionary:
	_ensure_loaded()
	return (_data.get("legacy_audit", {}) as Dictionary).duplicate(true)


func save_now() -> bool:
	_ensure_loaded()
	return _commit_candidate(_data.duplicate(true))


## Overwrites a nested state path with a deep-copied value WITHOUT appending a
## transaction receipt. Intended for throttled auto-saves (e.g. overworld
## position/provisions state) where content-hash transaction keys would grow
## unbounded. IMPORTANT: do NOT use this for first-clear rewards or other
## one-shot entitlements — those must continue to use transact_once for
## idempotent delivery. Returns false if the path is invalid or commit fails.
func patch_state_path(path: Array, value: Variant) -> bool:
	_ensure_loaded()
	if path.is_empty():
		_push_failure("patch_state_path requires a non-empty path.")
		return false
	for segment in path:
		if not (segment is String or segment is StringName):
			_push_failure("patch_state_path path segments must be strings.")
			return false
		if String(segment).is_empty():
			_push_failure("patch_state_path path segment is empty.")
			return false
	var candidate := _data.duplicate(true)
	var target: Dictionary = candidate
	for i in range(path.size() - 1):
		var segment := String(path[i])
		var child: Variant = target.get(segment, {})
		if not child is Dictionary:
			child = {}
		target[segment] = child
		target = child
	target[String(path[-1])] = value if not value is Dictionary else (value as Dictionary).duplicate(true)
	return _commit_candidate(candidate)


func is_transaction_applied(transaction_key: String) -> bool:
	_ensure_loaded()
	var transactions: Dictionary = _data.get("applied_transactions", {})
	return transactions.has(transaction_key)


## Bind only the reviewed A3 adapter, not arbitrary client-supplied metadata.
## This is in-process code isolation, not a security boundary against hostile
## scripts with reflection; production UI must not receive this facade.
func create_pinned_economy_port(adapter: RefCounted) -> Node:
	if adapter == null:
		return null
	if not _is_pinned_economy_adapter(adapter):
		return null
	if _economy_facade != null and is_instance_valid(_economy_facade):
		_economy_facade.queue_free()
	_economy_capability = RefCounted.new()
	_economy_adapter = adapter
	_economy_facade = ECONOMY_SAVE_FACADE.new()
	_economy_facade.bind(self, adapter, _economy_capability)
	add_child(_economy_facade)
	return _economy_facade


func _is_pinned_economy_adapter(adapter: RefCounted) -> bool:
	if adapter == null:
		return false
	var script: Variant = adapter.get_script()
	if not script is Script or String(script.source_code).sha256_text() != PINNED_A0_ADAPTER_SHA256:
		return false
	var parent: Script = script.get_base_script()
	return parent != null and String(parent.source_code).sha256_text() == PINNED_A3_SCRIPT_SHA256


func _economy_transact_once(capability: RefCounted, adapter: RefCounted, key: String, mutator: Callable, metadata: Dictionary) -> bool:
	if capability != _economy_capability or adapter != _economy_adapter or mutator.get_object() != adapter:
		return false
	if not _is_pinned_economy_adapter(adapter):
		return false
	return _transact_once_internal(key, mutator, metadata, capability)


func _economy_add_to_candidate(capability: RefCounted, candidate: Dictionary, item_id: String, kind: String, quantity: int, metadata: Dictionary) -> bool:
	if capability != _economy_capability or not _economy_mutation_active:
		return false
	var id := item_id.strip_edges().to_lower()
	if id.begins_with("soh_i_"):
		if quantity != 1 or kind != "key_item":
			return false
		var inventory: Dictionary = candidate.get("inventory", {})
		var stacks: Dictionary = inventory.get("item_stacks", {})
		if not _matching_inventory_stack_keys(stacks, id).is_empty():
			return false
	return _add_items_to_candidate_internal(candidate, id, kind, quantity, metadata)


func _economy_remove_from_candidate(capability: RefCounted, candidate: Dictionary, item_id: String, quantity: int) -> bool:
	if capability != _economy_capability or not _economy_mutation_active:
		return false
	var id := item_id.strip_edges().to_lower()
	if id.begins_with("soh_i_"):
		var inventory: Dictionary = candidate.get("inventory", {})
		var stacks: Dictionary = inventory.get("item_stacks", {})
		var keys := _matching_inventory_stack_keys(stacks, id)
		if quantity != 1 or keys.size() != 1 or keys[0] != id:
			return false
		var record: Variant = stacks[id]
		if not record is Dictionary or String(record.get("kind", "")) != "key_item" or int(record.get("quantity", 0)) != 1:
			return false
	return _remove_items_from_candidate_internal(candidate, id, quantity)


## Applies a mutation and its transaction receipt as one durable snapshot.
## Returns false for an already-applied key, rejected mutation, or I/O failure.
## The mutator receives a deep-copy Dictionary and may return false to reject it.
func transact_once(
	transaction_key: String,
	mutator: Callable,
	metadata: Dictionary = {}
) -> bool:
	return _transact_once_internal(transaction_key, mutator, metadata, null)


func _transact_once_internal(
	transaction_key: String,
	mutator: Callable,
	metadata: Dictionary,
	capability: RefCounted,
) -> bool:
	_ensure_loaded()
	var economy_authorized := capability != null and capability == _economy_capability
	if capability != null and not economy_authorized:
		return false
	if _transaction_mutation_active or _commit_in_progress:
		return false
	if not _is_valid_transaction_key(transaction_key):
		_push_failure("Invalid transaction key: %s" % transaction_key)
		return false
	if not mutator.is_valid():
		_push_failure("Transaction %s has no valid mutator." % transaction_key)
		return false
	if is_transaction_applied(transaction_key):
		return false

	var candidate := _data.duplicate(true)
	_transaction_mutation_active = true
	_economy_mutation_active = economy_authorized
	var mutation_result: Variant = mutator.call(candidate)
	_economy_mutation_active = false
	_transaction_mutation_active = false
	if mutation_result is bool and not bool(mutation_result):
		return false

	var transactions: Dictionary = candidate.get("applied_transactions", {}).duplicate(true)
	transactions[transaction_key] = {
		"applied_at_unix": int(Time.get_unix_time_from_system()),
		"metadata": metadata.duplicate(true),
	}
	candidate["applied_transactions"] = transactions
	var committed := _commit_candidate(candidate, capability)
	if not committed:
		return false
	transaction_applied.emit(transaction_key)
	return true


func set_tutorial_completed(tutorial_id: StringName, transaction_key := "") -> bool:
	var normalized_id := String(tutorial_id).strip_edges().to_lower()
	if not _is_valid_identifier(normalized_id):
		return false
	var key := transaction_key
	if key.is_empty():
		key = "tutorial:%s" % normalized_id
	return transact_once(
		key,
		func(candidate: Dictionary) -> bool:
			var tutorials: Dictionary = candidate.get("tutorials", {}).duplicate(true)
			tutorials[normalized_id] = true
			candidate["tutorials"] = tutorials
			return true,
		{"kind": "tutorial", "id": normalized_id}
	)


## Stores the fixed two-Hero run pair: one active Hero and one reserve Hero.
func set_soul_team(
	active_hero: StringName,
	reserve_hero_ids: Array[StringName],
	transaction_key: String
) -> bool:
	var active_id := String(active_hero).strip_edges().to_lower()
	if (
			not _is_persistable_hero_id(active_id)
			or reserve_hero_ids.size() > SOUL_TEAM_RESERVE_CAPACITY
			or not _is_valid_transaction_key(transaction_key)
	):
		return false
	var reserve_ids: Array[String] = []
	for reserve_id: StringName in reserve_hero_ids:
		var normalized := String(reserve_id).strip_edges().to_lower()
		if not normalized.is_empty() and not _is_persistable_hero_id(normalized):
			return false
		reserve_ids.append(normalized)
	while reserve_ids.size() < SOUL_TEAM_RESERVE_CAPACITY:
		reserve_ids.append("")
	var equipped_ids := {active_id: true}
	for reserve_id: String in reserve_ids:
		if reserve_id.is_empty():
			continue
		if equipped_ids.has(reserve_id):
			return false
		equipped_ids[reserve_id] = true

	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			var heroes: Dictionary = progression.get("unlocked_heroes", {})
			if not bool(heroes.get(active_id, false)) or not _candidate_owns_hero(candidate, active_id):
				return false
			for reserve_id: String in reserve_ids:
				if (
					not reserve_id.is_empty()
					and (not bool(heroes.get(reserve_id, false)) or not _candidate_owns_hero(candidate, reserve_id))
				):
					return false
			var previous_team: Dictionary = candidate.get("soul_team", {})
			var previous_selections: Dictionary = {}
			if previous_team.get("selected_soul_instances", {}) is Dictionary:
				previous_selections = (previous_team.get("selected_soul_instances", {}) as Dictionary).duplicate(true)
			candidate["soul_team"] = {
				"active_hero": active_id,
				"reserve_souls": reserve_ids.duplicate(),
				"capacity": SOUL_TEAM_RESERVE_CAPACITY,
				"selected_soul_instances": previous_selections,
			}
			return true,
		{"kind": "soul_team"}
	)


## Atomically selects one exact owned Hero Soul copy for its Identity. Selection
## is independent from team placement, so a bench copy can be prepared before a
## later Active/Reserve assignment. Save validation synchronizes `equipped` on
## every inventory item from this authoritative mapping.
func select_hero_soul_instance(instance_id: String, transaction_key: String) -> bool:
	var normalized_id := instance_id.strip_edges().to_lower()
	if not _is_valid_identifier(normalized_id) or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var soul := _candidate_soul_by_instance(candidate, normalized_id)
			if soul.is_empty():
				return false
			var hero_id := String(soul.get("hero_id", ""))
			if not _is_persistable_hero_id(hero_id):
				return false
			var team: Dictionary = candidate.get("soul_team", {}).duplicate(true)
			var selections: Dictionary = {}
			if team.get("selected_soul_instances", {}) is Dictionary:
				selections = (team.get("selected_soul_instances", {}) as Dictionary).duplicate(true)
			selections[hero_id] = normalized_id
			team["selected_soul_instances"] = selections
			candidate["soul_team"] = team
			return true,
		{"kind": "hero_soul_instance_selection", "instance_id": normalized_id}
	)


## Exact-copy variant used by the Roster's SET ACTIVE/RESERVE actions. Hero
## identities are derived from the selected items so UI code cannot pair an
## instance UUID with the wrong Hero. Team placement and all selections commit
## together or not at all.
func set_soul_team_instances(
		active_instance_id: String,
		reserve_instance_ids: Array[String],
		transaction_key: String
) -> bool:
	var active_id := active_instance_id.strip_edges().to_lower()
	if (
			not _is_valid_identifier(active_id)
			or reserve_instance_ids.size() > SOUL_TEAM_RESERVE_CAPACITY
			or not _is_valid_transaction_key(transaction_key)
	):
		return false
	var normalized_reserve_ids: Array[String] = []
	for raw_id: String in reserve_instance_ids:
		var normalized := raw_id.strip_edges().to_lower()
		if not normalized.is_empty() and not _is_valid_identifier(normalized):
			return false
		normalized_reserve_ids.append(normalized)
	while normalized_reserve_ids.size() < SOUL_TEAM_RESERVE_CAPACITY:
		normalized_reserve_ids.append("")
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var active_soul := _candidate_soul_by_instance(candidate, active_id)
			if active_soul.is_empty():
				return false
			var active_hero_id := String(active_soul.get("hero_id", ""))
			var progression: Dictionary = candidate.get("progression", {})
			var heroes: Dictionary = progression.get("unlocked_heroes", {})
			if not bool(heroes.get(active_hero_id, false)):
				return false
			var reserve_heroes: Array[String] = []
			var selected_by_hero := {active_hero_id: active_id}
			var used_heroes := {active_hero_id: true}
			var used_instances := {active_id: true}
			for reserve_instance_id: String in normalized_reserve_ids:
				if reserve_instance_id.is_empty():
					reserve_heroes.append("")
					continue
				if used_instances.has(reserve_instance_id):
					return false
				var reserve_soul := _candidate_soul_by_instance(candidate, reserve_instance_id)
				if reserve_soul.is_empty():
					return false
				var reserve_hero_id := String(reserve_soul.get("hero_id", ""))
				if used_heroes.has(reserve_hero_id) or not bool(heroes.get(reserve_hero_id, false)):
					return false
				used_instances[reserve_instance_id] = true
				used_heroes[reserve_hero_id] = true
				selected_by_hero[reserve_hero_id] = reserve_instance_id
				reserve_heroes.append(reserve_hero_id)
			var previous_team: Dictionary = candidate.get("soul_team", {})
			var selections: Dictionary = {}
			if previous_team.get("selected_soul_instances", {}) is Dictionary:
				selections = (previous_team.get("selected_soul_instances", {}) as Dictionary).duplicate(true)
			selections.merge(selected_by_hero, true)
			candidate["soul_team"] = {
				"active_hero": active_hero_id,
				"reserve_souls": reserve_heroes,
				"capacity": SOUL_TEAM_RESERVE_CAPACITY,
				"selected_soul_instances": selections,
			}
			return true,
		{
			"kind": "soul_team_exact_instances",
			"active_instance_id": active_id,
			"reserve_instance_ids": normalized_reserve_ids.duplicate(),
		}
	)


## Adds one validated, individually rolled Hero Weapon. Owning a personalized
## weapon never unlocks its Hero identity.
## prevents a chest, gacha roll, quest or shop delivery from paying twice.
func grant_hero_soul(soul: Dictionary, transaction_key: String, source_metadata: Dictionary = {}) -> bool:
	if not HERO_SOUL_RULES.validate_instance(soul).is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	var stored_soul := soul.duplicate(true)
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var souls: Array = (inventory.get("hero_souls", []) as Array).duplicate(true)
			if _candidate_inventory_slot_count(inventory) >= INVENTORY_SLOT_CAPACITY:
				return false
			var instance_id := String(stored_soul["instance_id"])
			for existing: Variant in souls:
				if existing is Dictionary and String((existing as Dictionary).get("instance_id", "")) == instance_id:
					return false
			souls.append(stored_soul.duplicate(true))
			inventory["hero_souls"] = souls
			candidate["inventory"] = inventory
			return true,
		{"kind": "hero_weapon_grant", "source": source_metadata.duplicate(true)}
	)


func grant_hero_weapon(weapon: Dictionary, transaction_key: String, source_metadata: Dictionary = {}) -> bool:
	return grant_hero_soul(weapon, transaction_key, source_metadata)


func get_inventory_capacity_snapshot() -> Dictionary:
	_ensure_loaded()
	var inventory: Dictionary = _data.get("inventory", {})
	var storage: Dictionary = _data.get("storage", {})
	var storage_used := (storage.get("hero_weapons", []) as Array).size() \
		+ (storage.get("auxiliary_equipment", []) as Array).size() \
		+ (storage.get("item_stacks", {}) as Dictionary).size()
	return {
		"bag_used": _candidate_inventory_slot_count(inventory),
		"bag_capacity": INVENTORY_SLOT_CAPACITY,
		"storage_used": storage_used,
		"storage_capacity": HOME_STORAGE_SLOT_CAPACITY,
		"pending_rewards": (_data.get("pending_rewards", []) as Array).size(),
	}


func equip_hero_item(
		hero_id: StringName,
		slot_id: StringName,
		instance_id: String,
		transaction_key: String,
) -> bool:
	var hero := String(hero_id).strip_edges().to_lower()
	var slot := String(slot_id).strip_edges().to_lower()
	var item_id := instance_id.strip_edges().to_lower()
	if slot not in ["hero_weapon", "armor", "boots", "jewelry"] \
			or not _is_persistable_hero_id(hero) or not _is_valid_transaction_key(transaction_key):
		return false
	if not item_id.is_empty():
		if slot == "hero_weapon" and not _is_valid_identifier(item_id):
			return false
		# Auxiliary UUID shape is validated by the owned item itself below. At
		# this boundary only reject unreasonably large lookup values.
		if slot != "hero_weapon" and item_id.length() > 64:
			return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			if not bool((progression.get("unlocked_heroes", {}) as Dictionary).get(hero, false)):
				return false
			var inventory: Dictionary = candidate.get("inventory", {})
			if not item_id.is_empty():
				if slot == "hero_weapon":
					var weapon := _candidate_soul_by_instance(candidate, item_id)
					if weapon.is_empty() or String(weapon.get("hero_id", "")) != hero:
						return false
				else:
					var legacy_slot: String = String(
						{"armor": "soul_vessel", "boots": "soul_boots", "jewelry": "soul_trace"}[slot]
					)
					var found := false
					for raw_item: Variant in (inventory.get("auxiliary_equipment", []) as Array):
						if raw_item is Dictionary \
								and String((raw_item as Dictionary).get("uuid", "")) == item_id \
								and String((raw_item as Dictionary).get("slot", "")) == legacy_slot:
							found = true
							break
					if not found:
						return false
			var loadouts: Dictionary = candidate.get("hero_loadouts", {}).duplicate(true)
			# One physical instance can belong to only one Hero at a time.
			if not item_id.is_empty():
				for raw_other_id: Variant in loadouts.keys():
					var other: Dictionary = (loadouts[raw_other_id] as Dictionary).duplicate(true)
					for other_slot: String in ["hero_weapon", "armor", "boots", "jewelry"]:
						if String(other.get(other_slot, "")) == item_id:
							other[other_slot] = ""
					loadouts[raw_other_id] = other
			var loadout: Dictionary = loadouts.get(hero, {
				"hero_weapon": "", "armor": "", "boots": "", "jewelry": "",
			}).duplicate(true)
			loadout[slot] = item_id
			loadouts[hero] = loadout
			candidate["hero_loadouts"] = loadouts
			if slot == "hero_weapon":
				var team: Dictionary = candidate.get("soul_team", {}).duplicate(true)
				var selections: Dictionary = team.get("selected_soul_instances", {}).duplicate(true)
				if item_id.is_empty():
					selections.erase(hero)
				else:
					selections[hero] = item_id
				team["selected_soul_instances"] = selections
				candidate["soul_team"] = team
			return true,
		{"kind": "hero_item_equip", "hero_id": hero, "slot": slot, "instance_id": item_id},
	)


func home_transfer_to_storage(kind: StringName, instance_id: String, transaction_key: String) -> bool:
	return _home_transfer_item(kind, instance_id, true, transaction_key)


func home_transfer_to_bag(kind: StringName, instance_id: String, transaction_key: String) -> bool:
	return _home_transfer_item(kind, instance_id, false, transaction_key)


func _home_transfer_item(
		kind: StringName,
		instance_id: String,
		to_storage: bool,
		transaction_key: String,
) -> bool:
	var item_kind := String(kind).strip_edges().to_lower()
	var item_id := instance_id.strip_edges().to_lower()
	if item_kind not in ["hero_weapon", "equipment", "item_stack"] \
			or not _is_valid_identifier(item_id) or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			if to_storage and _candidate_item_is_equipped(candidate, item_id):
				return false
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var storage: Dictionary = candidate.get("storage", {}).duplicate(true)
			var storage_used := (storage.get("hero_weapons", []) as Array).size() \
				+ (storage.get("auxiliary_equipment", []) as Array).size() \
				+ (storage.get("item_stacks", {}) as Dictionary).size()
			if to_storage and storage_used >= HOME_STORAGE_SLOT_CAPACITY:
				return false
			if not to_storage and _candidate_inventory_slot_count(inventory) >= INVENTORY_SLOT_CAPACITY:
				return false
			var source: Dictionary = inventory if to_storage else storage
			var destination: Dictionary = storage if to_storage else inventory
			var source_key := "item_stacks"
			var destination_key := "item_stacks"
			if item_kind == "hero_weapon":
				source_key = "hero_souls" if to_storage else "hero_weapons"
				destination_key = "hero_weapons" if to_storage else "hero_souls"
			elif item_kind == "equipment":
				source_key = "auxiliary_equipment"
				destination_key = "auxiliary_equipment"
			if item_kind == "item_stack":
				var source_stacks: Dictionary = source.get(source_key, {}).duplicate(true)
				if not source_stacks.has(item_id):
					return false
				var raw_stack: Variant = source_stacks[item_id]
				if item_id.begins_with("soh_i_") or (raw_stack is Dictionary and _inventory_stack_base_id(item_id, raw_stack).begins_with("soh_i_")):
					return false
				var destination_stacks: Dictionary = destination.get(destination_key, {}).duplicate(true)
				if destination_stacks.has(item_id):
					return false
				destination_stacks[item_id] = source_stacks[item_id]
				source_stacks.erase(item_id)
				source[source_key] = source_stacks
				destination[destination_key] = destination_stacks
			else:
				var source_items: Array = (source.get(source_key, []) as Array).duplicate(true)
				var destination_items: Array = (destination.get(destination_key, []) as Array).duplicate(true)
				var found_index := -1
				var id_field := "instance_id" if item_kind == "hero_weapon" else "uuid"
				for index: int in source_items.size():
					if source_items[index] is Dictionary \
							and String((source_items[index] as Dictionary).get(id_field, "")) == item_id:
						found_index = index
						break
				if found_index < 0:
					return false
				destination_items.append(source_items[found_index])
				source_items.remove_at(found_index)
				source[source_key] = source_items
				destination[destination_key] = destination_items
			if to_storage:
				candidate["inventory"] = source
				candidate["storage"] = destination
			else:
				candidate["storage"] = source
				candidate["inventory"] = destination
			return true,
		{"kind": "home_storage_transfer", "item_kind": item_kind, "instance_id": item_id, "to_storage": to_storage},
	)


func _candidate_item_is_equipped(candidate: Dictionary, instance_id: String) -> bool:
	var loadouts_value: Variant = candidate.get("hero_loadouts", {})
	if loadouts_value is Dictionary:
		for raw_loadout: Variant in (loadouts_value as Dictionary).values():
			if raw_loadout is Dictionary and instance_id in (raw_loadout as Dictionary).values():
				return true
	return false


func _candidate_inventory_slot_count(inventory: Dictionary) -> int:
	var souls := inventory.get("hero_souls", []) as Array
	var equipment := inventory.get("auxiliary_equipment", []) as Array
	var stacks_value: Variant = inventory.get("item_stacks", {})
	var stacks := stacks_value as Dictionary if stacks_value is Dictionary else {}
	return souls.size() + equipment.size() + stacks.size()


func _candidate_inventory_slot_count_for_stacks(inventory: Dictionary, stacks: Dictionary) -> int:
	var souls := inventory.get("hero_souls", []) as Array
	var equipment := inventory.get("auxiliary_equipment", []) as Array
	return souls.size() + equipment.size() + stacks.size()


## Stack records use their dictionary key as the identity of the first stack.
## Overflow stacks retain the common item identity in `item_id`, allowing 50 per
## visible cell while keeping legacy saves and existing path reads compatible.
func _inventory_stack_base_id(stack_key: String, record: Dictionary) -> String:
	return String(record.get("item_id", stack_key)).strip_edges().to_lower()


func _matching_inventory_stack_keys(stacks: Dictionary, item_id: String) -> Array[String]:
	var matches: Array[String] = []
	for raw_key: Variant in stacks.keys():
		var stack_key := String(raw_key).strip_edges().to_lower()
		var raw_record: Variant = stacks[raw_key]
		if raw_record is Dictionary and _inventory_stack_base_id(stack_key, raw_record as Dictionary) == item_id:
			matches.append(stack_key)
	matches.sort_custom(func(left: String, right: String) -> bool:
		if left == item_id:
			return true
		if right == item_id:
			return false
		return left.naturalnocasecmp_to(right) < 0
	)
	return matches


func _next_inventory_stack_key(stacks: Dictionary, item_id: String) -> String:
	if not stacks.has(item_id):
		return item_id
	var suffix := 2
	while stacks.has("%s_stack_%d" % [item_id, suffix]):
		suffix += 1
	return "%s_stack_%d" % [item_id, suffix]


func _with_inventory_stack_metadata(
		base_record: Dictionary,
		item_id: String,
		stack_key: String,
		kind_id: String,
		quantity: int,
		source_metadata: Dictionary,
) -> Dictionary:
	var record := base_record.duplicate(true)
	record["kind"] = kind_id
	record["quantity"] = quantity
	if stack_key == item_id:
		record.erase("item_id")
	else:
		record["item_id"] = item_id
	# Physical loot carries presentation provenance into the live bag. Plain
	# campaign rewards omit these fields and retain the compact legacy shape.
	var incoming_name := String(source_metadata.get("display_name", "")).strip_edges()
	var incoming_icon := String(source_metadata.get("icon_path", "")).strip_edges()
	if not incoming_name.is_empty():
		record["display_name"] = incoming_name.left(96)
	if incoming_icon.begins_with("res://") and ResourceLoader.exists(incoming_icon):
		record["icon_path"] = incoming_icon
	if source_metadata.has("rarity"):
		var incoming_rarity := LOOT_RARITY_RULES.normalize(source_metadata.get("rarity"))
		var previous_rarity := LOOT_RARITY_RULES.normalize(record.get("rarity", &"normal"))
		record["rarity"] = String(
			incoming_rarity
			if LOOT_RARITY_RULES.rarity_index(incoming_rarity) \
				>= LOOT_RARITY_RULES.rarity_index(previous_rarity)
			else previous_rarity
		)
	if source_metadata.has("item_level"):
		record["item_level"] = maxi(
			int(record.get("item_level", 1)),
			clampi(int(source_metadata.get("item_level", 1)), 1, 100),
		)
	return record


## Guaranteed 3-to-1 fusion: same Hero Identity and rarity become the next
## rarity. Gold and all three inputs are consumed atomically with the output.
func fuse_hero_souls(instance_ids: Array[String], seed: int, transaction_key: String) -> bool:
	if instance_ids.size() != HERO_SOUL_RULES.FUSION_INPUT_COUNT or not _is_valid_transaction_key(transaction_key):
		return false
	var unique_ids := {}
	for instance_id: String in instance_ids:
		var normalized := instance_id.strip_edges().to_lower()
		if normalized.is_empty() or unique_ids.has(normalized):
			return false
		unique_ids[normalized] = true
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			var features: Dictionary = progression.get("features", {})
			if not bool(features.get("hero_soul_fusion", false)):
				return false
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var souls: Array = (inventory.get("hero_souls", []) as Array).duplicate(true)
			var inputs: Array[Dictionary] = []
			for soul_value: Variant in souls:
				if not soul_value is Dictionary:
					continue
				var soul: Dictionary = soul_value
				if unique_ids.has(String(soul.get("instance_id", "")).to_lower()):
					inputs.append(soul.duplicate(true))
			if inputs.size() != HERO_SOUL_RULES.FUSION_INPUT_COUNT:
				return false
			var fused: Dictionary = HERO_SOUL_RULES.fuse(inputs, seed)
			if fused.is_empty():
				return false
			var currencies: Dictionary = candidate.get("currencies", {}).duplicate(true)
			var cost := int(fused.get("fusion_cost", 0))
			var account_gold := int(currencies.get("account", 0))
			if cost <= 0 or account_gold < cost:
				return false
			currencies["account"] = account_gold - cost
			var remaining: Array = []
			for soul_value: Variant in souls:
				if soul_value is Dictionary and unique_ids.has(String((soul_value as Dictionary).get("instance_id", "")).to_lower()):
					continue
				remaining.append(soul_value)
			fused.erase("fusion_cost")
			fused.erase("consumed_instance_ids")
			remaining.append(fused)
			inventory["hero_souls"] = remaining
			candidate["inventory"] = inventory
			candidate["currencies"] = currencies
			return true,
		{"kind": "hero_soul_fusion", "inputs": instance_ids.duplicate(), "seed": seed}
	)


## Sells one unprotected duplicate for account gold. The last owned Soul of the
## currently usable Hero Identity cannot be sold, preventing a broken profile.
func sell_hero_soul(instance_id: String, transaction_key: String) -> bool:
	var normalized_id := instance_id.strip_edges().to_lower()
	if normalized_id.is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			var features: Dictionary = progression.get("features", {})
			if not bool(features.get("hero_soul_sell", false)):
				return false
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var souls: Array = (inventory.get("hero_souls", []) as Array).duplicate(true)
			var selected: Dictionary = {}
			var remaining: Array = []
			for soul_value: Variant in souls:
				if soul_value is Dictionary and String((soul_value as Dictionary).get("instance_id", "")).to_lower() == normalized_id:
					selected = (soul_value as Dictionary).duplicate(true)
				else:
					remaining.append(soul_value)
			if selected.is_empty():
				return false
			if bool(selected.get("locked", false)) or bool(selected.get("favorite", false)) or bool(selected.get("equipped", false)):
				return false
			var hero_id := String(selected.get("hero_id", ""))
			var same_identity_remaining := 0
			for soul_value: Variant in remaining:
				if soul_value is Dictionary and String((soul_value as Dictionary).get("hero_id", "")) == hero_id:
					same_identity_remaining += 1
			if same_identity_remaining <= 0:
				return false
			var value := HERO_SOUL_RULES.sell_value(selected)
			if value <= 0:
				return false
			var currencies: Dictionary = candidate.get("currencies", {}).duplicate(true)
			currencies["account"] = int(currencies.get("account", 0)) + value
			inventory["hero_souls"] = remaining
			candidate["inventory"] = inventory
			candidate["currencies"] = currencies
			return true,
		{"kind": "hero_soul_sale", "instance_id": normalized_id}
	)


## Adds one validated account-level armor, boots, or jewelry instance. Drops,
## chests and deterministic first-clear rewards all share this transaction seam.
func grant_auxiliary_equipment(
	item: Dictionary,
	transaction_key: String,
	source_metadata: Dictionary = {}
) -> bool:
	if not AUXILIARY_EQUIPMENT_RULES.validate_item(item).is_empty() \
			or not _is_valid_transaction_key(transaction_key):
		return false
	var stored_item := item.duplicate(true)
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var items: Array = (inventory.get("auxiliary_equipment", []) as Array).duplicate(true)
			if _candidate_inventory_slot_count(inventory) >= INVENTORY_SLOT_CAPACITY:
				return false
			var uuid := String(stored_item.get("uuid", ""))
			for existing_value: Variant in items:
				if existing_value is Dictionary and String((existing_value as Dictionary).get("uuid", "")) == uuid:
					return false
			items.append(stored_item.duplicate(true))
			inventory["auxiliary_equipment"] = items
			candidate["inventory"] = inventory
			return true,
		{"kind": "auxiliary_equipment_grant", "source": source_metadata.duplicate(true)}
	)


## Consumes exactly one same-rarity Soul Upgrade Stone and advances one item by
## one rank. Both mutations share the same candidate snapshot, so validation or
## disk failure can never spend the material without applying the upgrade.
func upgrade_auxiliary_equipment(uuid: String, transaction_key: String) -> bool:
	var normalized_uuid := uuid.strip_edges().to_lower()
	if normalized_uuid.is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory_value: Variant = candidate.get("inventory", {})
			if not inventory_value is Dictionary:
				return false
			var inventory := (inventory_value as Dictionary).duplicate(true)
			var items_value: Variant = inventory.get("auxiliary_equipment", [])
			var stacks_value: Variant = inventory.get("item_stacks", {})
			if not items_value is Array or not stacks_value is Dictionary:
				return false
			var items := (items_value as Array).duplicate(true)
			var selected_index := -1
			var selected: Dictionary = {}
			for item_index: int in items.size():
				var item_value: Variant = items[item_index]
				if item_value is Dictionary \
						and String((item_value as Dictionary).get("uuid", "")).to_lower() == normalized_uuid:
					selected_index = item_index
					selected = (item_value as Dictionary).duplicate(true)
					break
			if selected_index < 0 or not AUXILIARY_EQUIPMENT_RULES.validate_item(selected).is_empty():
				return false
			var raw_rank: Variant = selected.get("upgrade_rank", null)
			if (not raw_rank is int and not raw_rank is float) \
					or not is_finite(float(raw_rank)) \
					or float(raw_rank) != float(int(raw_rank)):
				return false
			var upgrade_rank := int(raw_rank)
			if upgrade_rank < 0 or upgrade_rank >= MAX_AUXILIARY_UPGRADE_RANK:
				return false
			var rarity := String(selected.get("rarity", "")).strip_edges().to_lower()
			if not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_rarity(rarity):
				return false
			var stone_id := _auxiliary_upgrade_stone_id(rarity)
			var stacks := (stacks_value as Dictionary).duplicate(true)
			var stone_keys := _matching_inventory_stack_keys(stacks, stone_id)
			if stone_keys.is_empty():
				return false
			var stone_key := stone_keys[0]
			var stone_value: Variant = stacks.get(stone_key, {})
			if not stone_value is Dictionary:
				return false
			var stone := (stone_value as Dictionary).duplicate(true)
			if String(stone.get("kind", "")).strip_edges().to_lower() != "material":
				return false
			if String(stone.get("rarity", "")).strip_edges().to_lower() != rarity:
				return false
			var raw_quantity: Variant = stone.get("quantity", 0)
			if (not raw_quantity is int and not raw_quantity is float) \
					or not is_finite(float(raw_quantity)) \
					or float(raw_quantity) != float(int(raw_quantity)) \
					or int(raw_quantity) < 1:
				return false

			selected["upgrade_rank"] = upgrade_rank + 1
			items[selected_index] = selected
			var remaining := int(raw_quantity) - 1
			if remaining == 0:
				stacks.erase(stone_key)
			else:
				stone["quantity"] = remaining
				stacks[stone_key] = stone
			inventory["auxiliary_equipment"] = items
			inventory["item_stacks"] = stacks
			candidate["inventory"] = inventory
			return true,
		{
			"kind": "auxiliary_equipment_upgrade",
			"uuid": normalized_uuid,
			"stone_policy": "same_rarity",
		}
	)


func equip_auxiliary_equipment(uuid: String, transaction_key: String) -> bool:
	var normalized_uuid := uuid.strip_edges().to_lower()
	if normalized_uuid.is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {})
			var items_value: Variant = inventory.get("auxiliary_equipment", [])
			if not items_value is Array:
				return false
			var selected: Dictionary = {}
			for item_value: Variant in items_value:
				if item_value is Dictionary and String((item_value as Dictionary).get("uuid", "")).to_lower() == normalized_uuid:
					selected = item_value as Dictionary
					break
			if selected.is_empty() or not AUXILIARY_EQUIPMENT_RULES.validate_item(selected).is_empty():
				return false
			var slot_id := String(selected.get("slot", ""))
			var progression: Dictionary = candidate.get("progression", {})
			var player: Dictionary = progression.get("player", {})
			if not AUXILIARY_EQUIPMENT_RULES.is_slot_unlocked(slot_id, int(player.get("level", 1))):
				return false
			var loadout: Dictionary = candidate.get("auxiliary_loadout", {}).duplicate(true)
			loadout[slot_id] = normalized_uuid
			candidate["auxiliary_loadout"] = loadout
			return true,
		{"kind": "auxiliary_equipment_equip", "uuid": normalized_uuid}
	)


func unequip_auxiliary_slot(slot_id: StringName, transaction_key: String) -> bool:
	var normalized_slot := String(slot_id).strip_edges().to_lower()
	if not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_slot(normalized_slot) \
			or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var loadout: Dictionary = candidate.get("auxiliary_loadout", {}).duplicate(true)
			if String(loadout.get(normalized_slot, "")).is_empty():
				return false
			loadout[normalized_slot] = ""
			candidate["auxiliary_loadout"] = loadout
			return true,
		{"kind": "auxiliary_equipment_unequip", "slot": normalized_slot}
	)


func sell_auxiliary_equipment(uuid: String, transaction_key: String) -> bool:
	var normalized_uuid := uuid.strip_edges().to_lower()
	if normalized_uuid.is_empty() or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var loadout: Dictionary = candidate.get("auxiliary_loadout", {})
			if loadout.values().has(normalized_uuid) \
					or _candidate_item_is_equipped(candidate, normalized_uuid):
				return false
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var items: Array = (inventory.get("auxiliary_equipment", []) as Array).duplicate(true)
			var selected: Dictionary = {}
			var remaining: Array = []
			for item_value: Variant in items:
				if item_value is Dictionary and String((item_value as Dictionary).get("uuid", "")).to_lower() == normalized_uuid:
					selected = (item_value as Dictionary).duplicate(true)
				else:
					remaining.append(item_value)
			if selected.is_empty():
				return false
			var value := AUXILIARY_EQUIPMENT_RULES.sell_value(selected)
			if value <= 0:
				return false
			var currencies: Dictionary = candidate.get("currencies", {}).duplicate(true)
			currencies["account"] = int(currencies.get("account", 0)) + value
			inventory["auxiliary_equipment"] = remaining
			candidate["inventory"] = inventory
			candidate["currencies"] = currencies
			return true,
		{"kind": "auxiliary_equipment_sale", "uuid": normalized_uuid}
	)


func set_auxiliary_equipment_favorite(
	uuid: String,
	favorite: bool,
	transaction_key: String
) -> bool:
	return _set_auxiliary_equipment_protection(uuid, "favorite", favorite, transaction_key)


func set_auxiliary_equipment_locked(
	uuid: String,
	locked: bool,
	transaction_key: String
) -> bool:
	return _set_auxiliary_equipment_protection(uuid, "locked", locked, transaction_key)


func _set_auxiliary_equipment_protection(
	uuid: String,
	field_name: String,
	enabled: bool,
	transaction_key: String
) -> bool:
	var normalized_uuid := uuid.strip_edges().to_lower()
	if normalized_uuid.is_empty() \
			or field_name not in ["favorite", "locked"] \
			or not _is_valid_transaction_key(transaction_key):
		return false
	return transact_once(
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var items: Array = (inventory.get("auxiliary_equipment", []) as Array).duplicate(true)
			for index: int in items.size():
				if not items[index] is Dictionary:
					continue
				var item: Dictionary = (items[index] as Dictionary).duplicate(true)
				if String(item.get("uuid", "")).to_lower() != normalized_uuid:
					continue
				if bool(item.get(field_name, false)) == enabled:
					return false
				item[field_name] = enabled
				items[index] = item
				inventory["auxiliary_equipment"] = items
				candidate["inventory"] = inventory
				return true
			return false,
		{
			"kind": "auxiliary_equipment_protection",
			"uuid": normalized_uuid,
			"field": field_name,
			"enabled": enabled,
		}
	)


## Deprecated write compatibility. A pristine Sword-only legacy loadout maps to
## the v2 default team; Bow/Axe or Spirit assignments are intentionally rejected.
func set_loadout(
	hand_weapon: StringName,
	spirit_weapon_ids: Array[StringName],
	transaction_key: String
) -> bool:
	if String(hand_weapon).strip_edges().to_lower() != "sword":
		return false
	for spirit_id: StringName in spirit_weapon_ids:
		if not String(spirit_id).strip_edges().is_empty():
			return false
	var empty_reserves: Array[StringName] = []
	return set_soul_team(&"sword_hero", empty_reserves, transaction_key)


## Atomically persists a flat, whitelisted settings patch. Invalid or unknown
## keys reject the entire patch, so a UI can never partially apply a settings
## page. Numeric controls accept int/float Variants and are stored as floats.
func update_settings(patch: Dictionary) -> bool:
	_ensure_loaded()
	if patch.is_empty():
		return false
	var validated_patch: Dictionary = {}
	for raw_key: Variant in patch.keys():
		if not raw_key is String and not raw_key is StringName:
			return false
		var key := String(raw_key)
		var value: Variant = patch[raw_key]
		if SETTINGS_NUMERIC_RANGES.has(key):
			if not value is int and not value is float:
				return false
			var numeric_value := float(value)
			var limits: Array = SETTINGS_NUMERIC_RANGES[key]
			if not is_finite(numeric_value) or numeric_value < float(limits[0]) or numeric_value > float(limits[1]):
				return false
			validated_patch[key] = numeric_value
		elif SETTINGS_BOOLEAN_KEYS.has(key):
			if not value is bool:
				return false
			validated_patch[key] = value
		elif SETTINGS_STRING_OPTIONS.has(key):
			if not value is String and not value is StringName:
				return false
			var normalized_value := String(value).strip_edges().to_lower()
			var options: Array = SETTINGS_STRING_OPTIONS[key]
			if not options.has(normalized_value):
				return false
			validated_patch[key] = normalized_value
		else:
			return false

	var candidate := _data.duplicate(true)
	var settings: Dictionary = candidate.get("settings", {}).duplicate(true)
	var changed := false
	for key: String in validated_patch:
		if not settings.has(key) or settings[key] != validated_patch[key]:
			changed = true
		settings[key] = validated_patch[key]
	if not changed:
		return true
	candidate["settings"] = settings
	if not _commit_candidate(candidate):
		return false
	settings_changed.emit(get_value(["settings"], {}))
	return true


## Erases progression, inventory, loadout, tutorials and transaction receipts
## while retaining the player's validated preferences. This intentionally uses
## a distinct confirmation token from a complete profile reset.
func reset_progression_keep_settings(confirmation: String) -> bool:
	if confirmation not in [
		RESET_PROGRESSION_KEEP_SETTINGS_TOKEN,
		LEGACY_RESET_PROGRESSION_KEEP_SETTINGS_TOKEN,
	]:
		return false
	_ensure_loaded()
	var reset_snapshot := _default_data()
	reset_snapshot["settings"] = get_value(["settings"], {}).duplicate(true)
	reset_snapshot["revision"] = int(_data.get("revision", 0)) + 1
	var prepared := _prepare_document(reset_snapshot)
	if not bool(prepared.get("ok", false)):
		return false
	reset_snapshot = prepared.get("data", {})
	if not _commit_snapshot(reset_snapshot, false, _disk_commit_capability):
		return false
	if not _copy_text_file(_save_path, _backup_path):
		_remove_if_present(_backup_path)
	_data = reset_snapshot
	_is_loaded = true
	save_reset.emit()
	save_committed.emit(get_snapshot())
	settings_changed.emit(get_value(["settings"], {}))
	return true


## Debug/test reset. Callers must pass the explicit confirmation token.
func reset_to_defaults(confirmation: String) -> bool:
	if confirmation not in [RESET_ALL_TOKEN, LEGACY_RESET_ALL_TOKEN]:
		return false
	var defaults := _default_data()
	if not _commit_snapshot(defaults, false, _disk_commit_capability):
		return false
	if not _copy_text_file(_save_path, _backup_path):
		# A stale pre-reset backup is more dangerous than having no backup until
		# the next normal commit rotates the reset profile.
		_remove_if_present(_backup_path)
	_data = defaults
	_is_loaded = true
	save_reset.emit()
	save_committed.emit(get_snapshot())
	return true


func _commit_candidate(candidate: Dictionary, capability: RefCounted = null) -> bool:
	if not _economy_quarantine_reason.is_empty():
		return false
	var economy_authorized := capability != null and capability == _economy_capability
	if capability != null and not economy_authorized:
		return false
	if _commit_in_progress or _transaction_mutation_active:
		_push_failure("Rejected a re-entrant save commit.")
		return false
	var original_error: String = UNIQUE_OWNERSHIP_GUARD.inspect(_data)
	var candidate_error: String = UNIQUE_OWNERSHIP_GUARD.inspect(candidate)
	if not original_error.is_empty() or not candidate_error.is_empty():
		return false
	if not economy_authorized and UNIQUE_OWNERSHIP_GUARD.changed_by_generic(_data, candidate):
		return false
	var prepared := _prepare_document(candidate)
	if not bool(prepared.get("ok", false)):
		_push_failure(String(prepared.get("error", "Save validation failed.")))
		return false
	var snapshot: Dictionary = prepared.get("data", {})
	if not String(UNIQUE_OWNERSHIP_GUARD.inspect(snapshot)).is_empty():
		return false
	if not economy_authorized and UNIQUE_OWNERSHIP_GUARD.changed_by_generic(_data, snapshot):
		return false
	snapshot["revision"] = int(_data.get("revision", 0)) + 1
	if not _commit_snapshot(snapshot, true, _disk_commit_capability):
		return false
	_data = snapshot
	_is_loaded = true
	save_committed.emit(get_snapshot())
	return true


func _commit_snapshot(snapshot: Dictionary, rotate_primary_to_backup: bool, capability: RefCounted = null) -> bool:
	if capability != _disk_commit_capability:
		return false
	if not _economy_quarantine_reason.is_empty():
		return false
	_commit_in_progress = true
	var result := false
	var directory_error := DirAccess.make_dir_recursive_absolute(
		ProjectSettings.globalize_path(_save_path.get_base_dir())
	)
	if directory_error != OK and directory_error != ERR_ALREADY_EXISTS:
		_push_failure("Could not create the save directory (error %d)." % directory_error)
		_commit_in_progress = false
		return false

	var payload := JSON.stringify(snapshot, "\t") + "\n"
	if not _write_text(_temporary_path, payload):
		_push_failure("Could not write the temporary save file.")
		_commit_in_progress = false
		return false
	var verification := _read_and_prepare(_temporary_path)
	if not bool(verification.get("ok", false)):
		_remove_if_present(_temporary_path)
		_push_failure(
			"Temporary save verification failed: %s" %
			String(verification.get("error", "unknown validation error"))
		)
		_commit_in_progress = false
		return false

	if rotate_primary_to_backup and FileAccess.file_exists(_save_path):
		# External edits or a partial disk write must not replace a known-good
		# backup with corrupt bytes. A valid new primary can still be committed.
		var current_verification := _read_and_prepare(_save_path)
		if bool(current_verification.get("economy_quarantine", false)):
			_remove_if_present(_temporary_path)
			_commit_in_progress = false
			return _quarantine_economy_save(_save_path, String(current_verification.get("error", "invalid_ownership")))
		if bool(current_verification.get("ok", false)) and not _copy_text_file(_save_path, _backup_path):
			_remove_if_present(_temporary_path)
			_push_failure("Could not rotate the previous save into its backup.")
			_commit_in_progress = false
			return false

	_remove_if_present(_save_path)
	var rename_error := DirAccess.rename_absolute(
		ProjectSettings.globalize_path(_temporary_path),
		ProjectSettings.globalize_path(_save_path)
	)
	if rename_error == OK:
		result = true
	else:
		# Best-effort rollback keeps the last known-good generation playable.
		if FileAccess.file_exists(_backup_path) and not FileAccess.file_exists(_save_path):
			_copy_text_file(_backup_path, _save_path)
		_remove_if_present(_temporary_path)
		_push_failure("Atomic save replacement failed (error %d)." % rename_error)
	_commit_in_progress = false
	return result


func _read_and_prepare(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {"ok": false, "error": "missing"}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {"ok": false, "error": "unreadable"}
	var payload := file.get_as_text()
	file.close()
	var json := JSON.new()
	if json.parse(payload) != OK or not json.data is Dictionary:
		return {"ok": false, "error": "invalid_json"}
	var raw_document: Dictionary = json.data
	# Check before legacy sanitization or fallback. Otherwise a corrupt unique
	# record could be normalized away, then a backup/default silently written.
	var ownership_error: String = UNIQUE_OWNERSHIP_GUARD.inspect(raw_document)
	if not ownership_error.is_empty():
		return {"ok": false, "error": ownership_error, "economy_quarantine": true}
	var version_variant: Variant = raw_document.get("schema_version", raw_document.get("version", 0))
	var source_version := int(version_variant) if version_variant is int or version_variant is float else -1
	var prepared := _prepare_document(raw_document)
	if bool(prepared.get("ok", false)):
		prepared["source_version"] = source_version
		prepared["was_migrated"] = source_version < CURRENT_SCHEMA_VERSION
	return prepared


func _prepare_document(raw_document: Dictionary) -> Dictionary:
	var migrated := raw_document.duplicate(true)
	var version_variant: Variant = migrated.get("schema_version", migrated.get("version", 0))
	if not version_variant is int and not version_variant is float:
		return {"ok": false, "error": "Save schema version is not numeric."}
	var version := int(version_variant)
	if version < 0 or version > CURRENT_SCHEMA_VERSION:
		return {"ok": false, "error": "Unsupported save schema version %d." % version}

	while version < CURRENT_SCHEMA_VERSION:
		var migration: Callable = _migrations.get(version, Callable())
		if not migration.is_valid():
			return {"ok": false, "error": "Missing migration from schema %d." % version}
		var next_document: Variant = migration.call(migrated)
		if not next_document is Dictionary:
			return {"ok": false, "error": "Migration from schema %d failed." % version}
		migrated = next_document
		version += 1
		migrated["schema_version"] = version

	var auxiliary_equipment_migrated := _migrate_auxiliary_equipment_in_place(migrated)
	var hero_soul_rules_migrated := _migrate_hero_soul_rules_in_place(migrated)
	var skill_economy_migrated := _migrate_skill_economy_in_place(migrated)
	var stat_economy_migrated := _migrate_stat_economy_in_place(migrated)
	var had_persisted_soul_selection := (
		migrated.get("soul_team", {}) is Dictionary
		and (migrated.get("soul_team", {}) as Dictionary).get("selected_soul_instances", null) is Dictionary
	)
	var normalized := _merge_defaults(_default_data(), migrated)
	if not had_persisted_soul_selection and normalized.get("soul_team", {}) is Dictionary:
		# Do not let the default starter mapping masquerade as a legacy choice.
		# Reconciliation below will honor a valid old equipped flag, then choose
		# the deterministic best owned copy when no explicit selection existed.
		(normalized["soul_team"] as Dictionary)["selected_soul_instances"] = {}
	normalized["schema_version"] = CURRENT_SCHEMA_VERSION
	var validation_error := _sanitize_and_validate(normalized)
	if not validation_error.is_empty():
		return {"ok": false, "error": validation_error}
	var serialization_error := _validate_json_value(normalized, "save")
	if not serialization_error.is_empty():
		return {"ok": false, "error": serialization_error}
	return {
		"ok": true,
		"data": normalized,
		"hero_soul_rules_migrated": hero_soul_rules_migrated,
		"auxiliary_equipment_migrated": auxiliary_equipment_migrated,
		"skill_economy_migrated": skill_economy_migrated,
		"stat_economy_migrated": stat_economy_migrated,
		"hero_soul_selection_migrated": (
			_hero_soul_selection_signature(migrated)
			!= _hero_soul_selection_signature(normalized)
		),
	}


func _sanitize_and_validate(document: Dictionary) -> String:
	_archive_obsolete_weapon_sections(document, CURRENT_SCHEMA_VERSION)
	document["revision"] = maxi(0, int(document.get("revision", 0)))
	for section_name: String in [
		"progression", "tutorials", "soul_team", "currencies", "mastery",
		"inventory", "storage", "hero_loadouts", "auxiliary_loadout", "monster_parts", "mode_progress", "bestiary",
		"settings", "applied_transactions", "legacy_audit",
	]:
		if not document.get(section_name) is Dictionary:
			return "Save section '%s' must be a Dictionary." % section_name

	var progression: Dictionary = document["progression"]
	for section_name: String in ["campaign", "unlocked_heroes", "hero_shards", "heroes", "features", "player"]:
		if not progression.get(section_name) is Dictionary:
			return "Progression section '%s' must be a Dictionary." % section_name
	var campaign: Dictionary = progression["campaign"]
	campaign["chapter"] = maxi(1, int(campaign.get("chapter", 1)))
	campaign["level"] = maxi(1, int(campaign.get("level", 1)))
	campaign["average_enemy_level_cap"] = maxi(
		5,
		int(campaign.get(
			"average_enemy_level_cap",
			HERO_PROGRESSION_RULES.default_average_enemy_level(int(campaign["level"])),
		)),
	)
	var selected_difficulties: Dictionary = {}
	var selected_value: Variant = campaign.get("selected_difficulties", {})
	if not selected_value is Dictionary:
		return "Campaign selected_difficulties must be a Dictionary."
	for raw_level_id: Variant in (selected_value as Dictionary).keys():
		var selected_level_id := String(raw_level_id).strip_edges().to_lower()
		var selected_difficulty := StringName(
			String((selected_value as Dictionary)[raw_level_id]).strip_edges().to_lower()
		)
		if _is_valid_identifier(selected_level_id) and DIFFICULTY_RULES.is_valid_id(selected_difficulty):
			selected_difficulties[selected_level_id] = String(selected_difficulty)
	campaign["selected_difficulties"] = selected_difficulties
	var unlocked_heroes: Dictionary = progression["unlocked_heroes"]
	var sanitized_heroes: Dictionary = {}
	for raw_key: Variant in unlocked_heroes.keys():
		var hero_id := String(raw_key).strip_edges().to_lower()
		if _is_persistable_hero_id(hero_id):
			sanitized_heroes[hero_id] = bool(unlocked_heroes[raw_key])
	sanitized_heroes["sword_hero"] = true
	progression["unlocked_heroes"] = sanitized_heroes
	var features: Dictionary = progression["features"]
	var sanitized_features: Dictionary = {}
	for raw_key: Variant in features.keys():
		var feature_id := String(raw_key).strip_edges().to_lower()
		if _is_valid_identifier(feature_id) and feature_id != "second_spirit":
			sanitized_features[feature_id] = bool(features[raw_key])
	# Deprecated by the fixed two-Hero run model. Keep the key readable for old
	# saves, but never let it expand the canonical team again.
	sanitized_features["second_reserve_soul"] = false
	progression["features"] = sanitized_features
	var player_progression_error := _sanitize_player_progression(progression)
	if not player_progression_error.is_empty():
		return player_progression_error
	var hero_progression_error := _sanitize_hero_progression(progression, sanitized_heroes, campaign)
	if not hero_progression_error.is_empty():
		return hero_progression_error

	var tutorials: Dictionary = document["tutorials"]
	var sanitized_tutorials: Dictionary = {}
	for raw_key: Variant in tutorials.keys():
		var tutorial_id := String(raw_key).strip_edges().to_lower()
		if _is_valid_identifier(tutorial_id):
			sanitized_tutorials[tutorial_id] = bool(tutorials[raw_key])
	document["tutorials"] = sanitized_tutorials

	var soul_team: Dictionary = document["soul_team"]
	var active_id := String(soul_team.get("active_hero", "sword_hero")).strip_edges().to_lower()
	if not _is_persistable_hero_id(active_id) or not bool(sanitized_heroes.get(active_id, false)):
		active_id = "sword_hero"
	var sanitized_reserves: Array[String] = []
	var reserved_ids := {active_id: true}
	var raw_reserves: Variant = soul_team.get("reserve_souls", [])
	if raw_reserves is Array:
		for raw_id: Variant in (raw_reserves as Array).slice(0, SOUL_TEAM_RESERVE_CAPACITY):
			var reserve_id := String(raw_id).strip_edges().to_lower()
			if (
					not reserve_id.is_empty()
					and _is_persistable_hero_id(reserve_id)
					and bool(sanitized_heroes.get(reserve_id, false))
					and not reserved_ids.has(reserve_id)
			):
				sanitized_reserves.append(reserve_id)
				reserved_ids[reserve_id] = true
			else:
				sanitized_reserves.append("")
	while sanitized_reserves.size() < SOUL_TEAM_RESERVE_CAPACITY:
		sanitized_reserves.append("")
	var raw_selections: Dictionary = {}
	if soul_team.get("selected_soul_instances", {}) is Dictionary:
		raw_selections = (soul_team.get("selected_soul_instances", {}) as Dictionary).duplicate(true)
	document["soul_team"] = {
		"active_hero": active_id,
		"reserve_souls": sanitized_reserves,
		"capacity": SOUL_TEAM_RESERVE_CAPACITY,
		"selected_soul_instances": raw_selections,
	}
	var reward_storage_error := _sanitize_reward_storage(document)
	if not reward_storage_error.is_empty():
		return reward_storage_error
	var home_storage_error := _sanitize_home_storage(document)
	if not home_storage_error.is_empty():
		return home_storage_error
	var soul_selection_error := _sanitize_hero_soul_instance_selection(document)
	if not soul_selection_error.is_empty():
		return soul_selection_error
	_sanitize_legacy_audit(document["legacy_audit"])
	_sanitize_settings(document["settings"])
	return ""


func _sanitize_player_progression(progression: Dictionary) -> String:
	var player_value: Variant = progression.get("player", {})
	if not player_value is Dictionary:
		return "Progression player data must be a Dictionary."
	var player: Dictionary = (player_value as Dictionary).duplicate(true)
	var raw_level: Variant = player.get("level", 1)
	var raw_xp: Variant = player.get("xp", 0)
	if (not raw_level is int and not raw_level is float) \
			or (not raw_xp is int and not raw_xp is float):
		return "Player level and XP must be numeric."
	var player_level := int(raw_level)
	var xp := int(raw_xp)
	if player_level < 1 or player_level > PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP:
		return "Player level must stay between 1 and %d." % PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP
	if xp < 0:
		return "Player XP cannot be negative."
	var normalized_xp := PLAYER_PROGRESSION_RULES.resolve_experience_gain(player_level, xp, 0)
	player_level = int(normalized_xp.get("level", player_level))
	xp = int(normalized_xp.get("xp", xp))

	var stat_value: Variant = player.get("stat_allocation", {})
	if not stat_value is Dictionary:
		return "Player stat_allocation must be a Dictionary."
	var stat_allocation := {}
	for raw_stat_id: Variant in (stat_value as Dictionary).keys():
		if StringName(raw_stat_id) not in PLAYER_PROGRESSION_RULES.STAT_IDS:
			return "Player stat_allocation contains unknown stat '%s'." % raw_stat_id
	for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
		var raw_points: Variant = (stat_value as Dictionary).get(String(stat_id), 0)
		if (not raw_points is int and not raw_points is float) \
				or not is_finite(float(raw_points)) \
				or float(raw_points) != float(int(raw_points)):
			return "Player stat '%s' points must be a finite integer." % stat_id
		stat_allocation[String(stat_id)] = int(raw_points)
	var stat_errors: PackedStringArray = PLAYER_PROGRESSION_RULES.stat_allocation_errors(
		player_level,
		stat_allocation
	)
	if not stat_errors.is_empty():
		return "Invalid player stat allocation: %s" % stat_errors[0]
	var stat_economy_version_value: Variant = player.get("stat_economy_version", 0)
	var free_stat_credits_value: Variant = player.get("free_stat_reallocation_credits", 0)
	if (not stat_economy_version_value is int and not stat_economy_version_value is float) \
			or not is_finite(float(stat_economy_version_value)) \
			or float(stat_economy_version_value) != float(int(stat_economy_version_value)) \
			or int(stat_economy_version_value) != CURRENT_STAT_ECONOMY_VERSION:
		return "Player stat economy version must be %d." % CURRENT_STAT_ECONOMY_VERSION
	if (not free_stat_credits_value is int and not free_stat_credits_value is float) \
			or not is_finite(float(free_stat_credits_value)) \
			or float(free_stat_credits_value) != float(int(free_stat_credits_value)) \
			or int(free_stat_credits_value) < 0 \
			or int(free_stat_credits_value) > MAX_FREE_STAT_REALLOCATION_CREDITS:
		return "Player free Stat reallocation credits must stay between 0 and %d." % MAX_FREE_STAT_REALLOCATION_CREDITS

	var skills_value: Variant = player.get("skill_allocations", {})
	var skill_economy_version_value: Variant = player.get("skill_economy_version", 0)
	if (not skill_economy_version_value is int and not skill_economy_version_value is float) \
			or not is_finite(float(skill_economy_version_value)) \
			or float(skill_economy_version_value) != float(int(skill_economy_version_value)) \
			or int(skill_economy_version_value) != CURRENT_SKILL_ECONOMY_VERSION:
		return "Player skill economy version must be %d." % CURRENT_SKILL_ECONOMY_VERSION
	if not skills_value is Dictionary:
		return "Player skill_allocations must be a Dictionary."
	var skill_allocations := {}
	for raw_hero_id: Variant in (skills_value as Dictionary).keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		if not _is_persistable_hero_id(hero_id):
			return "Player skill allocation Hero Identity '%s' is invalid." % raw_hero_id
		var tracks_value: Variant = (skills_value as Dictionary)[raw_hero_id]
		if not tracks_value is Dictionary:
			return "Hero Identity '%s' skill allocation must be a Dictionary." % hero_id
		for raw_track_id: Variant in (tracks_value as Dictionary).keys():
			if StringName(raw_track_id) not in PLAYER_PROGRESSION_RULES.SKILL_TRACK_IDS:
				return "Hero Identity '%s' has unknown skill track '%s'." % [hero_id, raw_track_id]
		var normalized_tracks := {}
		for track_id: StringName in PLAYER_PROGRESSION_RULES.SKILL_TRACK_IDS:
			var raw_rank: Variant = (tracks_value as Dictionary).get(String(track_id), 0)
			if (not raw_rank is int and not raw_rank is float) \
					or not is_finite(float(raw_rank)) \
					or float(raw_rank) != float(int(raw_rank)):
				return "Hero Identity '%s' track '%s' rank must be a finite integer." % [hero_id, track_id]
			normalized_tracks[String(track_id)] = int(raw_rank)
		skill_allocations[hero_id] = normalized_tracks
	if not skill_allocations.has("sword_hero"):
		skill_allocations["sword_hero"] = PLAYER_PROGRESSION_RULES.empty_skill_tracks()
	var skill_errors: PackedStringArray = PLAYER_PROGRESSION_RULES.skill_allocation_errors(
		player_level,
		skill_allocations
	)
	if not skill_errors.is_empty():
		return "Invalid Hero skill allocation: %s" % skill_errors[0]

	player["level"] = player_level
	player["xp"] = xp
	player["stat_economy_version"] = CURRENT_STAT_ECONOMY_VERSION
	player["free_stat_reallocation_credits"] = int(free_stat_credits_value)
	player["stat_allocation"] = stat_allocation
	player["skill_allocations"] = skill_allocations
	player["skill_economy_version"] = CURRENT_SKILL_ECONOMY_VERSION
	progression["player"] = player
	return ""


func _sanitize_hero_progression(
		progression: Dictionary,
		unlocked_heroes: Dictionary,
		campaign: Dictionary,
) -> String:
	var shards_value: Variant = progression.get("hero_shards", {})
	if not shards_value is Dictionary:
		return "Progression hero_shards must be a Dictionary."
	var shards := {}
	for raw_hero_id: Variant in (shards_value as Dictionary).keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		if not _is_persistable_hero_id(hero_id):
			return "Hero shard identity '%s' is invalid." % raw_hero_id
		# Axe never participates in the shard economy; story is its only source.
		if hero_id == "axe_hero":
			continue
		var raw_amount: Variant = (shards_value as Dictionary)[raw_hero_id]
		if not raw_amount is int and not raw_amount is float:
			return "Hero shard amount for '%s' must be numeric." % hero_id
		shards[hero_id] = maxi(0, int(raw_amount))
	progression["hero_shards"] = shards

	var records_value: Variant = progression.get("heroes", {})
	if not records_value is Dictionary:
		return "Progression heroes must be a Dictionary."
	var records: Dictionary = (records_value as Dictionary).duplicate(true)
	var sanitized := {}
	var average_enemy_level := HERO_PROGRESSION_RULES.default_average_enemy_level(
		maxi(1, int(campaign.get("level", 1)))
	)
	for raw_hero_id: Variant in unlocked_heroes.keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		if not bool(unlocked_heroes[raw_hero_id]):
			continue
		var record: Dictionary = HERO_PROGRESSION_RULES.empty_record(StringName(hero_id))
		if records.get(hero_id, {}) is Dictionary:
			record.merge((records.get(hero_id, {}) as Dictionary), true)
		var level := clampi(int(record.get("level", 1)), 1, HERO_PROGRESSION_RULES.LEVEL_CAP)
		var xp := maxi(0, int(record.get("xp", 0)))
		var capped := HERO_PROGRESSION_RULES.resolve_experience_gain(
			level, xp, 0, average_enemy_level
		)
		level = int(capped.get("level", level))
		xp = int(capped.get("xp", 0))
		var stat_value: Variant = record.get("stat_allocation", {})
		if not stat_value is Dictionary:
			return "Hero '%s' stat_allocation must be a Dictionary." % hero_id
		var stat_allocation := {}
		for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
			stat_allocation[String(stat_id)] = int((stat_value as Dictionary).get(String(stat_id), 0))
		var stat_errors := PLAYER_PROGRESSION_RULES.stat_allocation_errors(level, stat_allocation)
		if not stat_errors.is_empty():
			# Old account allocations are not copied into a Hero automatically.
			stat_allocation = {"hp": 0, "damage": 0, "mana": 0}
		var skills_value: Variant = record.get("skill_allocations", {})
		var skills := PLAYER_PROGRESSION_RULES.empty_skill_tracks()
		if skills_value is Dictionary:
			for track_id: StringName in PLAYER_PROGRESSION_RULES.SKILL_TRACK_IDS:
				skills[String(track_id)] = maxi(0, int((skills_value as Dictionary).get(String(track_id), 0)))
		var one_hero_skills := {hero_id: skills}
		if not PLAYER_PROGRESSION_RULES.skill_allocation_errors(level, one_hero_skills).is_empty():
			skills = PLAYER_PROGRESSION_RULES.empty_skill_tracks()
		sanitized[hero_id] = {
			"level": level,
			"xp": xp,
			"stat_allocation": stat_allocation,
			"skill_allocations": skills,
			"base_stats": HERO_SKILL_KIT_RULES.base_stats(StringName(hero_id)),
		}
	progression["heroes"] = sanitized
	return ""


func _sanitize_reward_storage(document: Dictionary) -> String:
	var currencies: Dictionary = document["currencies"]
	var sanitized_currencies: Dictionary = {}
	for raw_currency_id: Variant in currencies.keys():
		var currency_id := String(raw_currency_id).strip_edges().to_lower()
		if not _is_valid_identifier(currency_id):
			return "Currency ID '%s' is invalid." % raw_currency_id
		var raw_amount: Variant = currencies[raw_currency_id]
		if not raw_amount is int and not raw_amount is float:
			return "Currency '%s' amount must be numeric." % currency_id
		var amount := int(raw_amount)
		if amount < 0:
			return "Currency '%s' amount cannot be negative." % currency_id
		sanitized_currencies[currency_id] = amount
	for required_currency_id: String in ["account", "hero_materials", "monster_fragments"]:
		if not sanitized_currencies.has(required_currency_id):
			sanitized_currencies[required_currency_id] = 0
	document["currencies"] = sanitized_currencies

	var inventory: Dictionary = document["inventory"]
	var stack_value: Variant = inventory.get("item_stacks", {})
	if not stack_value is Dictionary:
		return "Inventory item_stacks must be a Dictionary."
	var sanitized_stacks: Dictionary = {}
	for raw_item_id: Variant in (stack_value as Dictionary).keys():
		var stack_key := String(raw_item_id).strip_edges().to_lower()
		if not _is_valid_identifier(stack_key):
			return "Inventory item ID '%s' is invalid." % raw_item_id
		var raw_record: Variant = (stack_value as Dictionary)[raw_item_id]
		if not raw_record is Dictionary:
			return "Inventory item '%s' must use a Dictionary record." % stack_key
		var record: Dictionary = raw_record as Dictionary
		var item_id := _inventory_stack_base_id(stack_key, record)
		if not _is_valid_identifier(item_id):
			return "Inventory item '%s' has an invalid base item ID." % stack_key
		# Health Potions were removed from the game. Discard legacy stacks on
		# load so retired items cannot consume slots or be dropped back to combat.
		if item_id == "health_potion":
			continue
		var kind_id := String(record.get("kind", "")).strip_edges().to_lower()
		if kind_id not in INVENTORY_ITEM_KIND_IDS:
			return "Inventory item '%s' has unsupported kind '%s'." % [item_id, kind_id]
		var raw_quantity: Variant = record.get("quantity", 0)
		if not raw_quantity is int and not raw_quantity is float:
			return "Inventory item '%s' quantity must be numeric." % item_id
		var quantity := int(raw_quantity)
		if quantity < 1 or quantity > MAX_INVENTORY_STACK_QUANTITY:
			return "Inventory item '%s' quantity must be between 1 and %d." % [item_id, MAX_INVENTORY_STACK_QUANTITY]
		var sanitized_record := {"kind": kind_id, "quantity": quantity}
		if stack_key != item_id:
			sanitized_record["item_id"] = item_id
		var display_name := String(record.get("display_name", "")).strip_edges()
		if not display_name.is_empty():
			sanitized_record["display_name"] = display_name.left(96)
		var icon_path := String(record.get("icon_path", "")).strip_edges()
		if icon_path.begins_with("res://") and ResourceLoader.exists(icon_path):
			sanitized_record["icon_path"] = icon_path
		if record.has("rarity"):
			sanitized_record["rarity"] = String(LOOT_RARITY_RULES.normalize(record.get("rarity")))
		if record.has("item_level"):
			var raw_item_level: Variant = record.get("item_level", 1)
			if raw_item_level is int or raw_item_level is float:
				sanitized_record["item_level"] = clampi(int(raw_item_level), 1, 100)
		sanitized_stacks[stack_key] = sanitized_record
	inventory["item_stacks"] = sanitized_stacks

	var auxiliary_version_value: Variant = inventory.get("auxiliary_equipment_version", null)
	if (not auxiliary_version_value is int and not auxiliary_version_value is float) \
			or not is_finite(float(auxiliary_version_value)) \
			or float(auxiliary_version_value) != float(int(auxiliary_version_value)) \
			or int(auxiliary_version_value) != CURRENT_AUXILIARY_EQUIPMENT_VERSION:
		return "Unsupported auxiliary equipment version."
	inventory["auxiliary_equipment_version"] = CURRENT_AUXILIARY_EQUIPMENT_VERSION

	var rules_version_value: Variant = inventory.get("hero_soul_rules_version", null)
	if (not rules_version_value is int and not rules_version_value is float) \
			or not is_finite(float(rules_version_value)) \
			or float(rules_version_value) != float(int(rules_version_value)) \
			or int(rules_version_value) != CURRENT_HERO_SOUL_RULES_VERSION:
		return "Unsupported Hero Soul rules version."

	var souls_value: Variant = inventory.get("hero_souls", [])
	if not souls_value is Array:
		return "Inventory hero_souls must be an Array."
	var sanitized_souls: Array[Dictionary] = []
	var seen_instance_ids := {}
	var has_sword_soul := false
	for raw_soul: Variant in souls_value:
		if not raw_soul is Dictionary:
			return "Every Hero Soul inventory entry must be a Dictionary."
		var soul: Dictionary = (raw_soul as Dictionary).duplicate(true)
		var raw_rarity: Variant = soul.get("rarity", null)
		var raw_item_level: Variant = soul.get("item_level", null)
		if (not raw_rarity is int and not raw_rarity is float) \
				or not is_finite(float(raw_rarity)) \
				or float(raw_rarity) != float(int(raw_rarity)):
			return "Hero Soul rarity must be a finite integer."
		if (not raw_item_level is int and not raw_item_level is float) \
				or not is_finite(float(raw_item_level)) \
				or float(raw_item_level) != float(int(raw_item_level)):
			return "Hero Weapon item_level must be a finite integer."
		var instance_id := String(soul.get("instance_id", "")).strip_edges().to_lower()
		if not _is_valid_identifier(instance_id) or seen_instance_ids.has(instance_id):
			return "Hero Soul instance IDs must be unique stable identifiers."
		seen_instance_ids[instance_id] = true
		var hero_id := String(soul.get("hero_id", "")).strip_edges().to_lower()
		if not _is_persistable_hero_id(hero_id):
			return "Hero Soul hero_id '%s' cannot be persisted." % hero_id
		var affinity := String(soul.get("affinity", "warrior")).strip_edges().to_lower()
		if StringName(affinity) not in HERO_SOUL_RULES.VALID_AFFINITIES:
			return "Hero Soul affinity '%s' is invalid." % affinity
		var affixes_value: Variant = soul.get("affixes", [])
		if not affixes_value is Array:
			return "Hero Soul affixes must be an Array."
		var sanitized_affixes: Array[Dictionary] = []
		var rarity := int(raw_rarity)
		var affix_tier := HERO_SOUL_RULES.affix_tier_for_rarity(rarity)
		for raw_affix: Variant in affixes_value:
			if not raw_affix is Dictionary:
				return "Hero Soul affixes must use Dictionary records."
			var affix: Dictionary = raw_affix
			var affix_id := String(affix.get("affix_id", "")).strip_edges().to_lower()
			if not HERO_SOUL_RULES.AFFIX_CATALOG.has(affix_id):
				return "Unknown Hero Soul affix '%s'." % affix_id
			var definition: Dictionary = HERO_SOUL_RULES.AFFIX_CATALOG[affix_id]
			var rarity_roll_range := HERO_SOUL_RULES.rarity_roll_multiplier_range(rarity)
			var raw_value: Variant = affix.get("value", 0.0)
			if (not raw_value is int and not raw_value is float) or not is_finite(float(raw_value)):
				return "Hero Soul affix '%s' has an invalid value." % affix_id
			var sanitized_affix := {
				"affix_id": affix_id,
				"display_name": String(HERO_SOUL_RULES.affix_display_metadata(
					affix_id, float(raw_value), affix_tier
				).get("display_name", "")),
				"description": String(HERO_SOUL_RULES.affix_display_metadata(
					affix_id, float(raw_value), affix_tier
				).get("description", "")),
				"tier": affix_tier,
				"tier_display_name": HERO_SOUL_RULES.affix_tier_display_name_vi(affix_tier),
				"field": String(definition["field"]),
				"unit": String(definition["unit"]),
				"value": float(raw_value),
				"roll_min": snappedf(float(definition["min"]) * rarity_roll_range.x, 0.01),
				"roll_max": snappedf(float(definition["max"]) * rarity_roll_range.y, 0.01),
				"pool": String(definition.get("pool", HERO_SOUL_RULES.POOL_LEGACY)),
				"stacking_group": String(definition.get("stacking_group", "")),
				"tags": (definition.get("tags", []) as Array).duplicate(true),
			}
			if affix.has("roll_multiplier"):
				var raw_multiplier: Variant = affix["roll_multiplier"]
				if (not raw_multiplier is int and not raw_multiplier is float) \
						or not is_finite(float(raw_multiplier)) \
						or float(raw_multiplier) <= 0.0:
					return "Hero Soul affix '%s' has an invalid roll multiplier." % affix_id
				sanitized_affix["roll_multiplier"] = float(raw_multiplier)
			sanitized_affixes.append(sanitized_affix)
		var sanitized_soul := {
			"instance_id": instance_id,
			"hero_id": hero_id,
			"rarity": int(raw_rarity),
			"item_level": int(raw_item_level),
			"rarity_display_name": HERO_SOUL_RULES.rarity_display_name_vi(rarity),
			"affix_slot_capacity": HERO_SOUL_RULES.affix_slot_count(rarity),
			"affix_tier": affix_tier,
			"weapon_damage_percent": HERO_SOUL_RULES.weapon_damage_percent(
				rarity, int(raw_item_level)
			),
			"item_kind": "hero_weapon",
			"skill_kit_tier": HERO_SKILL_KIT_RULES.kit_tier_for_rarity(rarity),
			"skill_kit_id": String(HERO_SKILL_KIT_RULES.kit_id_for_rarity(rarity)),
			"skill_ranks": (
				(soul.get("skill_ranks", {}) as Dictionary).duplicate(true)
				if soul.get("skill_ranks", {}) is Dictionary
					and HERO_SKILL_KIT_RULES.validate_skill_ranks(
						rarity, soul.get("skill_ranks", {}) as Dictionary
					)
				else HERO_SKILL_KIT_RULES.roll_skill_ranks(rarity, instance_id.hash(), instance_id)
			),
			"affinity": affinity,
			"variant_id": String(soul.get("variant_id", "")).strip_edges().to_lower(),
			"affixes": sanitized_affixes,
			"monster_soul_id": String(soul.get("monster_soul_id", "")).strip_edges().to_lower(),
			"locked": bool(soul.get("locked", false)),
			"favorite": bool(soul.get("favorite", false)),
			"equipped": bool(soul.get("equipped", false)),
			"source_id": String(soul.get("source_id", "unknown")).strip_edges().to_lower(),
		}
		var soul_errors: PackedStringArray = HERO_SOUL_RULES.validate_instance(sanitized_soul)
		if not soul_errors.is_empty():
			return "Invalid Hero Soul: %s" % soul_errors[0]
		sanitized_souls.append(sanitized_soul)
		has_sword_soul = has_sword_soul or hero_id == "sword_hero"
	if not has_sword_soul:
		sanitized_souls.append(_starter_sword_soul())
	inventory["hero_souls"] = sanitized_souls
	inventory["hero_weapons"] = sanitized_souls.duplicate(true)
	inventory["hero_soul_rules_version"] = CURRENT_HERO_SOUL_RULES_VERSION

	var auxiliary_error := _sanitize_auxiliary_equipment_storage(document, inventory)
	if not auxiliary_error.is_empty():
		return auxiliary_error
	document["inventory"] = inventory
	return ""


func _sanitize_home_storage(document: Dictionary) -> String:
	var storage: Dictionary = document.get("storage", {}).duplicate(true)
	storage["capacity"] = HOME_STORAGE_SLOT_CAPACITY
	var weapons_value: Variant = storage.get("hero_weapons", [])
	var equipment_value: Variant = storage.get("auxiliary_equipment", [])
	var stacks_value: Variant = storage.get("item_stacks", {})
	if not weapons_value is Array or not equipment_value is Array or not stacks_value is Dictionary:
		return "Home storage requires Hero Weapon, equipment, and item-stack containers."
	var bag: Dictionary = document.get("inventory", {})
	var known_ids := {}
	for raw_bag_weapon: Variant in (bag.get("hero_souls", []) as Array):
		if raw_bag_weapon is Dictionary:
			known_ids[String((raw_bag_weapon as Dictionary).get("instance_id", ""))] = true
	var weapons: Array[Dictionary] = []
	for raw_weapon: Variant in weapons_value:
		if not raw_weapon is Dictionary:
			return "Every stored Hero Weapon must be a Dictionary."
		var weapon := (raw_weapon as Dictionary).duplicate(true)
		var instance_id := String(weapon.get("instance_id", "")).strip_edges().to_lower()
		if known_ids.has(instance_id):
			return "Hero Weapon instance IDs must be unique across bag and storage."
		var rarity := int(weapon.get("rarity", -1))
		if not weapon.get("skill_ranks", {}) is Dictionary \
				or not HERO_SKILL_KIT_RULES.validate_skill_ranks(
					rarity, weapon.get("skill_ranks", {}) as Dictionary
				):
			weapon["skill_ranks"] = HERO_SKILL_KIT_RULES.roll_skill_ranks(
				rarity, instance_id.hash(), instance_id
			)
		weapon["item_kind"] = "hero_weapon"
		weapon["skill_kit_tier"] = HERO_SKILL_KIT_RULES.kit_tier_for_rarity(rarity)
		weapon["skill_kit_id"] = String(HERO_SKILL_KIT_RULES.kit_id_for_rarity(rarity))
		var weapon_errors := HERO_SOUL_RULES.validate_instance(weapon)
		if not weapon_errors.is_empty():
			return "Invalid stored Hero Weapon: %s" % weapon_errors[0]
		known_ids[instance_id] = true
		weapons.append(weapon)
	var equipment: Array[Dictionary] = []
	for raw_item: Variant in equipment_value:
		if not raw_item is Dictionary:
			return "Every stored equipment item must be a Dictionary."
		var item := (raw_item as Dictionary).duplicate(true)
		var item_errors := AUXILIARY_EQUIPMENT_RULES.validate_item(item)
		if not item_errors.is_empty():
			return "Invalid stored equipment: %s" % item_errors[0]
		var uuid := String(item.get("uuid", "")).strip_edges().to_lower()
		if known_ids.has(uuid):
			return "Item instance IDs must be unique across bag and storage."
		known_ids[uuid] = true
		equipment.append(item)
	var stacks := {}
	for raw_key: Variant in (stacks_value as Dictionary).keys():
		var key := String(raw_key).strip_edges().to_lower()
		var raw_record: Variant = (stacks_value as Dictionary)[raw_key]
		if not _is_valid_identifier(key) or not raw_record is Dictionary:
			return "Stored item stack '%s' is invalid." % raw_key
		var record := (raw_record as Dictionary).duplicate(true)
		var quantity := int(record.get("quantity", 0))
		if quantity < 1 or quantity > MAX_INVENTORY_STACK_QUANTITY:
			return "Stored stack '%s' quantity is invalid." % key
		stacks[key] = record
	if weapons.size() + equipment.size() + stacks.size() > HOME_STORAGE_SLOT_CAPACITY:
		return "Home storage exceeds its %d-slot capacity." % HOME_STORAGE_SLOT_CAPACITY
	storage["hero_weapons"] = weapons
	storage["auxiliary_equipment"] = equipment
	storage["item_stacks"] = stacks
	document["storage"] = storage

	var pending_value: Variant = document.get("pending_rewards", [])
	if not pending_value is Array:
		return "pending_rewards must be an Array."
	var pending: Array[Dictionary] = []
	for raw_reward: Variant in pending_value:
		if raw_reward is Dictionary:
			pending.append((raw_reward as Dictionary).duplicate(true))
	document["pending_rewards"] = pending
	return _sanitize_hero_loadouts(document)


func _sanitize_hero_loadouts(document: Dictionary) -> String:
	var raw_loadouts: Dictionary = document.get("hero_loadouts", {})
	var progression: Dictionary = document.get("progression", {})
	var unlocked: Dictionary = progression.get("unlocked_heroes", {})
	var bag: Dictionary = document.get("inventory", {})
	var weapon_by_id := {}
	for raw_weapon: Variant in (bag.get("hero_souls", []) as Array):
		if raw_weapon is Dictionary:
			weapon_by_id[String((raw_weapon as Dictionary).get("instance_id", ""))] = raw_weapon
	var storage: Dictionary = document.get("storage", {})
	for raw_weapon: Variant in (storage.get("hero_weapons", []) as Array):
		if raw_weapon is Dictionary:
			weapon_by_id[String((raw_weapon as Dictionary).get("instance_id", ""))] = raw_weapon
	var equipment_by_id := {}
	for raw_item: Variant in (bag.get("auxiliary_equipment", []) as Array):
		if raw_item is Dictionary:
			equipment_by_id[String((raw_item as Dictionary).get("uuid", ""))] = raw_item
	var used_equipment := {}
	var loadouts := {}
	for raw_hero_id: Variant in unlocked.keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		if not bool(unlocked[raw_hero_id]):
			continue
		var raw: Dictionary = raw_loadouts.get(hero_id, {}).duplicate(true) \
			if raw_loadouts.get(hero_id, {}) is Dictionary else {}
		var hero_weapon := String(raw.get("hero_weapon", "")).strip_edges().to_lower()
		if not hero_weapon.is_empty():
			if not weapon_by_id.has(hero_weapon) \
					or String((weapon_by_id[hero_weapon] as Dictionary).get("hero_id", "")) != hero_id:
				hero_weapon = ""
		var record := {"hero_weapon": hero_weapon, "armor": "", "boots": "", "jewelry": ""}
		for slot_id: String in ["armor", "boots", "jewelry"]:
			var uuid := String(raw.get(slot_id, "")).strip_edges().to_lower()
			if uuid.is_empty() or used_equipment.has(uuid) or not equipment_by_id.has(uuid):
				continue
			var legacy_slot := String((equipment_by_id[uuid] as Dictionary).get("slot", ""))
			var expected_legacy: String = String({
				"armor": "soul_vessel", "boots": "soul_boots", "jewelry": "soul_trace",
			}[slot_id])
			if legacy_slot != expected_legacy:
				continue
			record[slot_id] = uuid
			used_equipment[uuid] = hero_id
		loadouts[hero_id] = record
	document["hero_loadouts"] = loadouts
	return ""


## Reconciles the durable Identity -> instance mapping after the inventory has
## been fully validated. Legacy profiles keep a valid previously-equipped copy;
## otherwise the highest rarity/level copy wins with instance ID as a stable
## tie-breaker. The mapping is authoritative and all item flags are rewritten.
func _sanitize_hero_soul_instance_selection(document: Dictionary) -> String:
	var team_value: Variant = document.get("soul_team", {})
	var inventory_value: Variant = document.get("inventory", {})
	if not team_value is Dictionary or not inventory_value is Dictionary:
		return "Hero Soul instance selection requires team and inventory dictionaries."
	var team := team_value as Dictionary
	var inventory := inventory_value as Dictionary
	var souls_value: Variant = inventory.get("hero_souls", [])
	if not souls_value is Array:
		return "Hero Soul instance selection requires a validated inventory array."
	var souls: Array = (souls_value as Array).duplicate(true)
	var storage: Dictionary = document.get("storage", {})
	var stored_souls: Array = (storage.get("hero_weapons", []) as Array).duplicate(true)
	var all_souls: Array = souls.duplicate(true)
	all_souls.append_array(stored_souls)
	var souls_by_id := {}
	var souls_by_hero := {}
	for raw_soul: Variant in all_souls:
		if not raw_soul is Dictionary:
			continue
		var soul := raw_soul as Dictionary
		var instance_id := String(soul.get("instance_id", "")).strip_edges().to_lower()
		var hero_id := String(soul.get("hero_id", "")).strip_edges().to_lower()
		souls_by_id[instance_id] = soul
		if not souls_by_hero.has(hero_id):
			souls_by_hero[hero_id] = []
		(souls_by_hero[hero_id] as Array).append(soul)

	var selections := {}
	var raw_selections: Variant = team.get("selected_soul_instances", {})
	if raw_selections is Dictionary:
		var selection_keys: Array = (raw_selections as Dictionary).keys()
		selection_keys.sort_custom(func(a: Variant, b: Variant) -> bool: return String(a) < String(b))
		for raw_hero_id: Variant in selection_keys:
			var hero_id := String(raw_hero_id).strip_edges().to_lower()
			var instance_id := String((raw_selections as Dictionary).get(raw_hero_id, "")).strip_edges().to_lower()
			if not _is_persistable_hero_id(hero_id) or not souls_by_id.has(instance_id):
				continue
			var selected_soul: Dictionary = souls_by_id[instance_id]
			if String(selected_soul.get("hero_id", "")) == hero_id:
				selections[hero_id] = instance_id

	var active_id := String(team.get("active_hero", "sword_hero"))
	var reserves: Array = (team.get("reserve_souls", [""]) as Array).duplicate()
	while reserves.size() < SOUL_TEAM_RESERVE_CAPACITY:
		reserves.append("")
	if not souls_by_hero.has(active_id):
		active_id = "sword_hero"
	for index: int in SOUL_TEAM_RESERVE_CAPACITY:
		var reserve_id := String(reserves[index])
		if reserve_id == active_id or (not reserve_id.is_empty() and not souls_by_hero.has(reserve_id)):
			reserves[index] = ""
	var team_hero_ids: Array[String] = [active_id]
	for raw_reserve: Variant in reserves:
		var reserve_id := String(raw_reserve)
		if not reserve_id.is_empty() and reserve_id not in team_hero_ids:
			team_hero_ids.append(reserve_id)
	for hero_id: String in team_hero_ids:
		if selections.has(hero_id):
			continue
		var candidates: Array = souls_by_hero.get(hero_id, [])
		var selected_id := _best_hero_soul_instance_id(candidates, true)
		if selected_id.is_empty():
			selected_id = _best_hero_soul_instance_id(candidates, false)
		if selected_id.is_empty():
			return "Soul Team Hero '%s' has no valid owned instance." % hero_id
		selections[hero_id] = selected_id

	var selected_ids := {}
	for selected_id: Variant in selections.values():
		selected_ids[String(selected_id)] = true
	for index: int in souls.size():
		if not souls[index] is Dictionary:
			continue
		var soul: Dictionary = (souls[index] as Dictionary).duplicate(true)
		soul["equipped"] = selected_ids.has(String(soul.get("instance_id", "")))
		souls[index] = soul
	for index: int in stored_souls.size():
		if not stored_souls[index] is Dictionary:
			continue
		var stored_soul: Dictionary = (stored_souls[index] as Dictionary).duplicate(true)
		stored_soul["equipped"] = selected_ids.has(String(stored_soul.get("instance_id", "")))
		stored_souls[index] = stored_soul

	team["active_hero"] = active_id
	team["reserve_souls"] = reserves
	team["capacity"] = SOUL_TEAM_RESERVE_CAPACITY
	team["selected_soul_instances"] = selections
	inventory["hero_souls"] = souls
	inventory["hero_weapons"] = souls.duplicate(true)
	storage["hero_weapons"] = stored_souls
	var loadouts: Dictionary = document.get("hero_loadouts", {}).duplicate(true) \
		if document.get("hero_loadouts", {}) is Dictionary else {}
	for raw_hero_id: Variant in selections.keys():
		var hero_id := String(raw_hero_id)
		var loadout: Dictionary = loadouts.get(hero_id, {
			"hero_weapon": "", "armor": "", "boots": "", "jewelry": "",
		}).duplicate(true)
		loadout["hero_weapon"] = String(selections[raw_hero_id])
		loadouts[hero_id] = loadout
	document["soul_team"] = team
	document["inventory"] = inventory
	document["storage"] = storage
	document["hero_loadouts"] = loadouts
	return ""


func _sanitize_auxiliary_equipment_storage(document: Dictionary, inventory: Dictionary) -> String:
	var items_value: Variant = inventory.get("auxiliary_equipment", [])
	if not items_value is Array:
		return "Inventory auxiliary_equipment must be an Array."

	var sanitized_items: Array[Dictionary] = []
	var items_by_uuid := {}
	for raw_item: Variant in items_value:
		if not raw_item is Dictionary:
			return "Every auxiliary equipment inventory entry must be a Dictionary."
		var item: Dictionary = (raw_item as Dictionary).duplicate(true)
		var raw_level: Variant = item.get("item_level", null)
		if (not raw_level is int and not raw_level is float) \
				or not is_finite(float(raw_level)) \
				or float(raw_level) != float(int(raw_level)):
			return "Auxiliary equipment item_level must be a finite integer."
		var raw_upgrade_rank: Variant = item.get("upgrade_rank", null)
		if (not raw_upgrade_rank is int and not raw_upgrade_rank is float) \
				or not is_finite(float(raw_upgrade_rank)) \
				or float(raw_upgrade_rank) != float(int(raw_upgrade_rank)) \
				or int(raw_upgrade_rank) < 0 \
				or int(raw_upgrade_rank) > MAX_AUXILIARY_UPGRADE_RANK:
			return "Auxiliary equipment upgrade_rank must be an integer from 0 to %d." \
				% MAX_AUXILIARY_UPGRADE_RANK

		var raw_primary: Variant = item.get("primary", null)
		if not raw_primary is Dictionary:
			return "Auxiliary equipment primary must be a Dictionary."
		var primary: Dictionary = raw_primary as Dictionary
		var raw_primary_value: Variant = primary.get("value", null)
		if (not raw_primary_value is int and not raw_primary_value is float) \
				or not is_finite(float(raw_primary_value)):
			return "Auxiliary equipment primary value must be finite and numeric."

		var raw_affixes: Variant = item.get("affixes", null)
		if not raw_affixes is Array:
			return "Auxiliary equipment affixes must be an Array."
		var sanitized_affixes: Array[Dictionary] = []
		for raw_affix: Variant in raw_affixes:
			if not raw_affix is Dictionary:
				return "Auxiliary equipment affixes must use Dictionary records."
			var affix: Dictionary = raw_affix as Dictionary
			var raw_affix_value: Variant = affix.get("value", null)
			if (not raw_affix_value is int and not raw_affix_value is float) \
					or not is_finite(float(raw_affix_value)):
				return "Auxiliary equipment affix values must be finite and numeric."
			sanitized_affixes.append({
				"affix_id": String(affix.get("affix_id", "")).strip_edges().to_lower(),
				"unit": String(affix.get("unit", "")).strip_edges().to_lower(),
				"value": float(raw_affix_value),
			})

		var uuid := String(item.get("uuid", "")).strip_edges().to_lower()
		var sanitized_item := {
			"uuid": uuid,
			"slot": String(item.get("slot", "")).strip_edges().to_lower(),
			"rarity": String(item.get("rarity", "")).strip_edges().to_lower(),
			"item_level": int(raw_level),
			"upgrade_rank": int(raw_upgrade_rank),
			"primary": {
				"stat_id": String(primary.get("stat_id", "")).strip_edges().to_lower(),
				"unit": String(primary.get("unit", "")).strip_edges().to_lower(),
				"value": float(raw_primary_value),
			},
			"affixes": sanitized_affixes,
			"favorite": item.get("favorite", null),
			"locked": item.get("locked", null),
		}
		var item_errors: PackedStringArray = AUXILIARY_EQUIPMENT_RULES.validate_item(sanitized_item)
		if not item_errors.is_empty():
			return "Invalid auxiliary equipment: %s" % item_errors[0]
		if items_by_uuid.has(uuid):
			return "Auxiliary equipment UUIDs must be unique."
		items_by_uuid[uuid] = sanitized_item
		sanitized_items.append(sanitized_item)
	inventory["auxiliary_equipment"] = sanitized_items

	var loadout_value: Variant = document.get("auxiliary_loadout", {})
	if not loadout_value is Dictionary:
		return "Save section 'auxiliary_loadout' must be a Dictionary."
	var normalized_loadout := {}
	for raw_slot_id: Variant in (loadout_value as Dictionary).keys():
		if not raw_slot_id is String and not raw_slot_id is StringName:
			return "Auxiliary loadout slot keys must be strings."
		var slot_id := String(raw_slot_id).strip_edges().to_lower()
		if not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_slot(slot_id):
			return "Auxiliary loadout contains unknown slot '%s'." % raw_slot_id
		if normalized_loadout.has(slot_id):
			var existing_uuid := String(normalized_loadout[slot_id]).strip_edges()
			var incoming_uuid := String((loadout_value as Dictionary)[raw_slot_id]).strip_edges()
			if not existing_uuid.is_empty() and not incoming_uuid.is_empty():
				return "Auxiliary loadout contains duplicate aliases for slot '%s'." % slot_id
			if existing_uuid.is_empty() and not incoming_uuid.is_empty():
				normalized_loadout[slot_id] = (loadout_value as Dictionary)[raw_slot_id]
			continue
		normalized_loadout[slot_id] = (loadout_value as Dictionary)[raw_slot_id]

	var player_level := int(
		((document.get("progression", {}) as Dictionary).get("player", {}) as Dictionary).get("level", 1)
	)
	var sanitized_loadout := _default_auxiliary_loadout()
	var equipped_uuids := {}
	for slot_id: String in AUXILIARY_EQUIPMENT_DEFINITIONS.SLOT_IDS:
		var raw_uuid: Variant = normalized_loadout.get(slot_id, "")
		if not raw_uuid is String and not raw_uuid is StringName:
			return "Auxiliary loadout slot '%s' must store an item UUID string." % slot_id
		var equipped_uuid := String(raw_uuid).strip_edges().to_lower()
		if equipped_uuid.is_empty():
			continue
		if not items_by_uuid.has(equipped_uuid):
			return "Auxiliary loadout references missing item '%s'." % equipped_uuid
		if equipped_uuids.has(equipped_uuid):
			return "One auxiliary equipment item cannot occupy multiple slots."
		var equipped_item: Dictionary = items_by_uuid[equipped_uuid]
		if String(equipped_item.get("slot", "")) != slot_id:
			return "Auxiliary loadout item '%s' does not match slot '%s'." % [equipped_uuid, slot_id]
		if not AUXILIARY_EQUIPMENT_RULES.is_slot_unlocked(slot_id, player_level):
			return "Auxiliary slot '%s' is locked until player level %d." % [
				slot_id,
				AUXILIARY_EQUIPMENT_DEFINITIONS.unlock_level(slot_id),
			]
		equipped_uuids[equipped_uuid] = true
		sanitized_loadout[slot_id] = equipped_uuid
	document["auxiliary_loadout"] = sanitized_loadout
	return ""


func _sanitize_settings(settings: Dictionary) -> void:
	var defaults: Dictionary = _default_data()["settings"]
	for raw_key: Variant in settings.keys():
		var key := String(raw_key)
		if not defaults.has(key):
			settings.erase(raw_key)
	for key: String in SETTINGS_NUMERIC_RANGES:
		var value: Variant = settings.get(key, defaults[key])
		var limits: Array = SETTINGS_NUMERIC_RANGES[key]
		if not value is int and not value is float or not is_finite(float(value)):
			settings[key] = defaults[key]
		else:
			settings[key] = clampf(float(value), float(limits[0]), float(limits[1]))
	for key: String in SETTINGS_BOOLEAN_KEYS:
		var value: Variant = settings.get(key, defaults[key])
		settings[key] = value if value is bool else defaults[key]
	for key: String in SETTINGS_STRING_OPTIONS:
		var value := String(settings.get(key, defaults[key])).strip_edges().to_lower()
		var options: Array = SETTINGS_STRING_OPTIONS[key]
		settings[key] = value if options.has(value) else defaults[key]


## Retires Soul Focus as equippable gear without deleting its earned value.
## Vessel and Trace keep their stable UUIDs, every surviving item enters the
## rank-based upgrade model at zero, and each Focus becomes one same-rarity
## stackable stone. The complete retired records stay in legacy_audit.
func _migrate_auxiliary_equipment_in_place(document: Dictionary) -> bool:
	var inventory_value: Variant = document.get("inventory", null)
	if not inventory_value is Dictionary:
		return false
	var inventory := (inventory_value as Dictionary).duplicate(true)
	var marker_present := inventory.has("auxiliary_equipment_version")
	var marker_value: Variant = inventory.get("auxiliary_equipment_version", 1)
	var marker_is_integer := (
		(marker_value is int or marker_value is float)
		and is_finite(float(marker_value))
		and float(marker_value) == float(int(marker_value))
	)
	if marker_present and not marker_is_integer:
		return false
	if marker_present and int(marker_value) >= CURRENT_AUXILIARY_EQUIPMENT_VERSION:
		return false
	# Version 2 already retired Soul Focus. Version 3 already scaled flat combat
	# values. Version 4 maps retired numeric mitigation to visible Barrier,
	# visible Dodge, or sheet Power without scaling those values a second time.
	if marker_present and int(marker_value) in [2, 3]:
		if not _canonicalize_auxiliary_equipment_v4(
			inventory,
			int(marker_value) == 2,
		):
			return false
		inventory["auxiliary_equipment_version"] = CURRENT_AUXILIARY_EQUIPMENT_VERSION
		document["inventory"] = inventory
		return true

	var items_value: Variant = inventory.get("auxiliary_equipment", [])
	var stacks_value: Variant = inventory.get("item_stacks", {})
	var loadout_value: Variant = document.get("auxiliary_loadout", {})
	if not items_value is Array or not stacks_value is Dictionary or not loadout_value is Dictionary:
		return false
	var normalized_loadout := _normalize_legacy_auxiliary_loadout(loadout_value as Dictionary)
	if not bool(normalized_loadout.get("valid", false)):
		return false
	var legacy_slots: Dictionary = normalized_loadout.get("slots", {})

	var surviving_items: Array[Dictionary] = []
	var archived_focus_items: Array[Dictionary] = []
	var stones_by_rarity := {}
	var seen_legacy_uuids := {}
	for raw_item: Variant in items_value:
		if not raw_item is Dictionary:
			return false
		var item := (raw_item as Dictionary).duplicate(true)
		var uuid := String(item.get("uuid", "")).strip_edges().to_lower()
		if not _is_valid_auxiliary_uuid(uuid) or seen_legacy_uuids.has(uuid):
			return false
		seen_legacy_uuids[uuid] = true
		var slot_id := String(item.get("slot", "")).strip_edges().to_lower()
		if slot_id == "soul_focus":
			if not _is_valid_legacy_focus_item(item):
				return false
			var rarity := String(item.get("rarity", "")).strip_edges().to_lower()
			archived_focus_items.append(item.duplicate(true))
			stones_by_rarity[rarity] = int(stones_by_rarity.get(rarity, 0)) + 1
			continue
		item["slot"] = slot_id
		item["upgrade_rank"] = 0
		surviving_items.append(item)
	var equipped_focus_uuid := String(legacy_slots.get("soul_focus", ""))
	if not equipped_focus_uuid.is_empty():
		var archived_equipped_focus := false
		for focus_item: Dictionary in archived_focus_items:
			if String(focus_item.get("uuid", "")).strip_edges().to_lower() == equipped_focus_uuid:
				archived_equipped_focus = true
				break
		if not archived_equipped_focus:
			return false

	var stacks := (stacks_value as Dictionary).duplicate(true)
	for rarity: String in stones_by_rarity:
		if not _merge_auxiliary_upgrade_stones(
				stacks,
				rarity,
				int(stones_by_rarity[rarity])
		):
			return false

	var player_level := 1
	var progression_value: Variant = document.get("progression", {})
	if progression_value is Dictionary:
		var player_value: Variant = (progression_value as Dictionary).get("player", {})
		if player_value is Dictionary:
			player_level = int((player_value as Dictionary).get("level", 1))
	var next_loadout := _default_auxiliary_loadout()
	next_loadout["soul_vessel"] = String(legacy_slots.get("soul_vessel", ""))
	if player_level >= 4:
		next_loadout["soul_boots"] = String(legacy_slots.get("soul_boots", ""))
	# Trace used to unlock at level four. It remains owned, but must not stay
	# equipped in the new level-seven slot before that lesson is reached.
	if player_level >= 7:
		next_loadout["soul_trace"] = String(legacy_slots.get("soul_trace", ""))

	var audit_value: Variant = document.get("legacy_audit", {})
	var audit := _merge_defaults(
		_default_legacy_audit(),
		audit_value as Dictionary if audit_value is Dictionary else {},
	)
	audit["soul_focus_equipment_pre_v2"] = {
		"items": archived_focus_items.duplicate(true),
		"loadout": (loadout_value as Dictionary).duplicate(true),
	}
	var notes: Array = audit.get("migration_notes", []).duplicate(true)
	const NOTE := "Soul Focus equipment was archived and converted one-for-one into same-rarity upgrade stones."
	if not notes.has(NOTE):
		notes.append(NOTE)
	audit["migration_notes"] = notes

	inventory["auxiliary_equipment"] = surviving_items
	inventory["item_stacks"] = stacks
	if not _canonicalize_auxiliary_equipment_v4(inventory, true):
		return false
	inventory["auxiliary_equipment_version"] = CURRENT_AUXILIARY_EQUIPMENT_VERSION
	document["inventory"] = inventory
	document["auxiliary_loadout"] = next_loadout
	document["legacy_audit"] = audit
	return true


func _canonicalize_auxiliary_equipment_v4(
		inventory: Dictionary,
		scale_legacy_flat_values: bool,
) -> bool:
	var items_value: Variant = inventory.get("auxiliary_equipment", [])
	if not items_value is Array:
		return false
	var migrated: Array[Dictionary] = []
	for raw_item: Variant in items_value:
		if not raw_item is Dictionary:
			return false
		var item := (raw_item as Dictionary).duplicate(true)
		var slot_id := String(item.get("slot", "")).strip_edges().to_lower()
		if not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_slot(slot_id):
			return false
		var primary_value: Variant = item.get("primary", {})
		if not primary_value is Dictionary:
			return false
		var primary := (primary_value as Dictionary).duplicate(true)
		var primary_id := String(primary.get("stat_id", ""))
		if scale_legacy_flat_values and primary_id in ["max_hp_flat", "damage_flat"]:
			primary["value"] = float(primary.get("value", 0.0)) * 10.0
		item["primary"] = primary
		var definitions := AUXILIARY_EQUIPMENT_DEFINITIONS.affix_definitions(slot_id)
		var affixes_value: Variant = item.get("affixes", [])
		if not affixes_value is Array:
			return false
		var next_affixes: Array[Dictionary] = []
		var seen := {}
		for raw_affix: Variant in affixes_value:
			if not raw_affix is Dictionary:
				return false
			var affix := (raw_affix as Dictionary).duplicate(true)
			var candidate := AUXILIARY_EQUIPMENT_DEFINITIONS.canonical_affix_id(
				String(affix.get("affix_id", ""))
			)
			if seen.has(candidate) or not definitions.has(candidate):
				var alternatives: Array = definitions.keys()
				alternatives.sort()
				candidate = ""
				for raw_alternative: Variant in alternatives:
					var alternative := String(raw_alternative)
					if not seen.has(alternative):
						candidate = alternative
						break
			if candidate.is_empty() or not definitions.has(candidate):
				return false
			var definition: Dictionary = definitions[candidate]
			affix["affix_id"] = candidate
			affix["unit"] = String(definition.get("unit", "percent"))
			next_affixes.append(affix)
			seen[candidate] = true
		item["affixes"] = next_affixes
		migrated.append(item)
	inventory["auxiliary_equipment"] = migrated
	return true


func _normalize_legacy_auxiliary_loadout(loadout: Dictionary) -> Dictionary:
	var slots := {}
	for raw_slot_id: Variant in loadout.keys():
		if not raw_slot_id is String and not raw_slot_id is StringName:
			return {"valid": false, "slots": {}}
		var slot_id := String(raw_slot_id).strip_edges().to_lower()
		if slot_id not in ["soul_vessel", "soul_boots", "soul_trace", "soul_focus"]:
			return {"valid": false, "slots": {}}
		var raw_uuid: Variant = loadout[raw_slot_id]
		if not raw_uuid is String and not raw_uuid is StringName:
			return {"valid": false, "slots": {}}
		var uuid := String(raw_uuid).strip_edges().to_lower()
		if slots.has(slot_id):
			var existing_uuid := String(slots[slot_id])
			if not existing_uuid.is_empty() and not uuid.is_empty():
				return {"valid": false, "slots": {}}
			if existing_uuid.is_empty() and not uuid.is_empty():
				slots[slot_id] = uuid
		else:
			slots[slot_id] = uuid
	return {"valid": true, "slots": slots}


func _is_valid_legacy_focus_item(item: Dictionary) -> bool:
	for field_name: String in [
		"uuid", "slot", "rarity", "item_level", "primary", "affixes", "favorite", "locked",
	]:
		if not item.has(field_name):
			return false
	var rarity := String(item.get("rarity", "")).strip_edges().to_lower()
	if not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_rarity(rarity):
		return false
	var raw_level: Variant = item.get("item_level", null)
	if (not raw_level is int and not raw_level is float) \
			or not is_finite(float(raw_level)) \
			or float(raw_level) != float(int(raw_level)) \
			or int(raw_level) < AUXILIARY_EQUIPMENT_DEFINITIONS.MIN_ITEM_LEVEL \
			or int(raw_level) > AUXILIARY_EQUIPMENT_DEFINITIONS.MAX_ITEM_LEVEL:
		return false
	var primary_value: Variant = item.get("primary", null)
	if not primary_value is Dictionary:
		return false
	var primary := primary_value as Dictionary
	if String(primary.get("stat_id", "")) != "max_mana_flat" \
			or String(primary.get("unit", "")) != "flat" \
			or not _is_positive_finite_number(primary.get("value", null)):
		return false
	var affixes_value: Variant = item.get("affixes", null)
	if not affixes_value is Array \
			or (affixes_value as Array).size() != AUXILIARY_EQUIPMENT_DEFINITIONS.affix_count(rarity):
		return false
	var legacy_units := {
		"mana_percent": "percent",
		"mana_regen": "flat_per_second",
		"cooldown_rate": "percent",
		"mana_efficiency": "percent",
		"skill_duration": "percent",
		"relay_ready_duration": "percent",
	}
	var seen_affixes := {}
	for raw_affix: Variant in affixes_value:
		if not raw_affix is Dictionary:
			return false
		var affix := raw_affix as Dictionary
		var affix_id := String(affix.get("affix_id", ""))
		if not legacy_units.has(affix_id) or seen_affixes.has(affix_id) \
				or String(affix.get("unit", "")) != String(legacy_units[affix_id]) \
				or not _is_positive_finite_number(affix.get("value", null)):
			return false
		seen_affixes[affix_id] = true
	return item.get("favorite", null) is bool and item.get("locked", null) is bool


func _is_valid_auxiliary_uuid(value: String) -> bool:
	var parts := value.split("-", false)
	if parts.size() != 5:
		return false
	var expected_lengths := [8, 4, 4, 4, 12]
	for index: int in parts.size():
		var part := String(parts[index])
		if part.length() != int(expected_lengths[index]):
			return false
		for char_index: int in part.length():
			var code := part.unicode_at(char_index)
			if not (code >= 48 and code <= 57) and not (code >= 97 and code <= 102):
				return false
	return true


func _is_positive_finite_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) > 0.0


func _merge_auxiliary_upgrade_stones(stacks: Dictionary, rarity: String, quantity: int) -> bool:
	if quantity < 1 or not AUXILIARY_EQUIPMENT_DEFINITIONS.is_valid_rarity(rarity):
		return false
	var stone_id := _auxiliary_upgrade_stone_id(rarity)
	var stack_rarity_index := AUXILIARY_EQUIPMENT_DEFINITIONS.rarity_index(rarity)
	var stack_icon_path := AUXILIARY_UPGRADE_STONE_ICON_ROOT % (321 + stack_rarity_index)
	var stack_metadata := {
		"display_name": "Soul Upgrade Stone",
		"icon_path": stack_icon_path,
		"rarity": rarity,
	}
	var remaining_quantity := quantity
	for stack_key: String in _matching_inventory_stack_keys(stacks, stone_id):
		var existing_value: Variant = stacks.get(stack_key, {})
		if not existing_value is Dictionary:
			return false
		var existing := (existing_value as Dictionary).duplicate(true)
		if String(existing.get("kind", "")).strip_edges().to_lower() != "material":
			return false
		if existing.has("rarity") and String(existing.get("rarity", "")).strip_edges().to_lower() != rarity:
			return false
		var stack_quantity := int(existing.get("quantity", 0))
		if stack_quantity < 0 or stack_quantity > MAX_INVENTORY_STACK_QUANTITY:
			return false
		var added_quantity := mini(remaining_quantity, MAX_INVENTORY_STACK_QUANTITY - stack_quantity)
		if added_quantity <= 0:
			continue
		stacks[stack_key] = _with_inventory_stack_metadata(
			existing, stone_id, stack_key, "material", stack_quantity + added_quantity, stack_metadata,
		)
		remaining_quantity -= added_quantity
		if remaining_quantity <= 0:
			return true
	while remaining_quantity > 0:
		var next_stack_key := _next_inventory_stack_key(stacks, stone_id)
		var next_quantity := mini(remaining_quantity, MAX_INVENTORY_STACK_QUANTITY)
		stacks[next_stack_key] = _with_inventory_stack_metadata(
			{}, stone_id, next_stack_key, "material", next_quantity, stack_metadata,
		)
		remaining_quantity -= next_quantity
	return true

	var current_quantity := 0
	if stacks.has(stone_id):
		var existing_value: Variant = stacks[stone_id]
		if not existing_value is Dictionary:
			return false
		var existing := existing_value as Dictionary
		if String(existing.get("kind", "")).strip_edges().to_lower() != "material":
			return false
		if existing.has("rarity") \
				and String(existing.get("rarity", "")).strip_edges().to_lower() != rarity:
			return false
		var raw_quantity: Variant = existing.get("quantity", 0)
		if (not raw_quantity is int and not raw_quantity is float) \
				or not is_finite(float(raw_quantity)) \
				or float(raw_quantity) != float(int(raw_quantity)):
			return false
		current_quantity = int(raw_quantity)
	if current_quantity < 0 or current_quantity > MAX_INVENTORY_STACK_QUANTITY - quantity:
		return false
	var rarity_index := AUXILIARY_EQUIPMENT_DEFINITIONS.rarity_index(rarity)
	var icon_path := AUXILIARY_UPGRADE_STONE_ICON_ROOT % (321 + rarity_index)
	stacks[stone_id] = {
		"kind": "material",
		"quantity": current_quantity + quantity,
		"display_name": "Soul Upgrade Stone • %s" % rarity.capitalize(),
		"icon_path": icon_path,
		"rarity": rarity,
	}
	return true


func _auxiliary_upgrade_stone_id(rarity: String) -> String:
	return "%s%s" % [AUXILIARY_UPGRADE_STONE_PREFIX, rarity]


## Skill ranks use a derived global budget, so changing that budget must never
## turn an otherwise healthy profile into an unloadable save. Version-one
## allocations which still fit the specialization budget are preserved. An
## over-budget allocation is archived verbatim and receives a free full respec;
## unspent points need no persisted refund because they are derived from level.
func _migrate_skill_economy_in_place(document: Dictionary) -> bool:
	var progression_value: Variant = document.get("progression", null)
	if not progression_value is Dictionary:
		return false
	var progression := progression_value as Dictionary
	var player_value: Variant = progression.get("player", null)
	if not player_value is Dictionary:
		return false
	var player := player_value as Dictionary
	var marker_present := player.has("skill_economy_version")
	var marker_value: Variant = player.get("skill_economy_version", 1)
	var marker_is_integer := (
		(marker_value is int or marker_value is float)
		and is_finite(float(marker_value))
		and float(marker_value) == float(int(marker_value))
	)
	if marker_present and not marker_is_integer:
		return false
	if marker_present and int(marker_value) >= CURRENT_SKILL_ECONOMY_VERSION:
		return false

	var player_level := clampi(int(player.get("level", 1)), 1, PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP)
	var allocations_value: Variant = player.get("skill_allocations", {})
	var spent := _legacy_skill_rank_sum(allocations_value)
	if spent > PLAYER_PROGRESSION_RULES.earned_skill_points(player_level):
		var audit_value: Variant = document.get("legacy_audit", {})
		var audit := _merge_defaults(
			_default_legacy_audit(),
			audit_value as Dictionary if audit_value is Dictionary else {},
		)
		audit["skill_allocations_pre_specialization"] = (
			(allocations_value as Dictionary).duplicate(true)
			if allocations_value is Dictionary else {}
		)
		var notes: Array = audit.get("migration_notes", []).duplicate(true)
		const NOTE := "Over-budget skill ranks were archived and freely reset for the specialization economy."
		if not notes.has(NOTE):
			notes.append(NOTE)
		audit["migration_notes"] = notes
		document["legacy_audit"] = audit

		var reset_allocations := {}
		if allocations_value is Dictionary:
			for raw_hero_id: Variant in (allocations_value as Dictionary).keys():
				var hero_id := String(raw_hero_id).strip_edges().to_lower()
				if _is_persistable_hero_id(hero_id):
					reset_allocations[hero_id] = PLAYER_PROGRESSION_RULES.empty_skill_tracks()
		if not reset_allocations.has("sword_hero"):
			reset_allocations["sword_hero"] = PLAYER_PROGRESSION_RULES.empty_skill_tracks()
		player["skill_allocations"] = reset_allocations

	player["skill_economy_version"] = CURRENT_SKILL_ECONOMY_VERSION
	progression["player"] = player
	document["progression"] = progression
	return true


## Level damage was moved into the allocatable Power curve. Existing builds
## remain active, but every pre-v2 profile receives one atomic reallocation so
## choices made under the previous rules are never permanently locked in.
func _migrate_stat_economy_in_place(document: Dictionary) -> bool:
	var progression_value: Variant = document.get("progression", null)
	if not progression_value is Dictionary:
		return false
	var progression := progression_value as Dictionary
	var player_value: Variant = progression.get("player", null)
	if not player_value is Dictionary:
		return false
	var player := player_value as Dictionary
	var marker_present := player.has("stat_economy_version")
	var marker_value: Variant = player.get("stat_economy_version", 1)
	var marker_is_integer := (
		(marker_value is int or marker_value is float)
		and is_finite(float(marker_value))
		and float(marker_value) == float(int(marker_value))
	)
	if marker_present and not marker_is_integer:
		return false
	if marker_present and int(marker_value) >= CURRENT_STAT_ECONOMY_VERSION:
		return false

	var allocation_value: Variant = player.get("stat_allocation", {})
	var audit_value: Variant = document.get("legacy_audit", {})
	var audit := _merge_defaults(
		_default_legacy_audit(),
		audit_value as Dictionary if audit_value is Dictionary else {},
	)
	audit["stat_allocation_pre_power"] = (
		(allocation_value as Dictionary).duplicate(true)
		if allocation_value is Dictionary else {}
	)
	var notes: Array = audit.get("migration_notes", []).duplicate(true)
	const NOTE := "The pre-Power Stat allocation was preserved and granted one atomic free reallocation."
	if not notes.has(NOTE):
		notes.append(NOTE)
	audit["migration_notes"] = notes
	document["legacy_audit"] = audit

	player["stat_economy_version"] = CURRENT_STAT_ECONOMY_VERSION
	player["free_stat_reallocation_credits"] = MAX_FREE_STAT_REALLOCATION_CREDITS
	progression["player"] = player
	document["progression"] = progression
	return true


func _legacy_skill_rank_sum(allocations_value: Variant) -> int:
	if not allocations_value is Dictionary:
		return -1
	var spent := 0
	for raw_hero_id: Variant in (allocations_value as Dictionary).keys():
		var tracks_value: Variant = (allocations_value as Dictionary)[raw_hero_id]
		if not tracks_value is Dictionary:
			return -1
		for raw_track_id: Variant in (tracks_value as Dictionary).keys():
			if StringName(raw_track_id) not in PLAYER_PROGRESSION_RULES.SKILL_TRACK_IDS:
				return -1
		for track_id: StringName in PLAYER_PROGRESSION_RULES.SKILL_TRACK_IDS:
			var rank_value: Variant = (tracks_value as Dictionary).get(String(track_id), 0)
			if (not rank_value is int and not rank_value is float) \
					or not is_finite(float(rank_value)) \
					or float(rank_value) != float(int(rank_value)) \
					or int(rank_value) < 0:
				return -1
			spent += int(rank_value)
	return spent


func _migrate_hero_soul_rules_in_place(document: Dictionary) -> bool:
	var inventory_value: Variant = document.get("inventory", null)
	if not inventory_value is Dictionary:
		return false
	var inventory: Dictionary = inventory_value as Dictionary
	var marker_present := inventory.has("hero_soul_rules_version")
	var marker_value: Variant = inventory.get("hero_soul_rules_version", 0)
	var marker_is_integer := (
		(marker_value is int or marker_value is float)
		and is_finite(float(marker_value))
		and float(marker_value) == float(int(marker_value))
	)
	if marker_present and not marker_is_integer:
		return false
	if marker_present and marker_is_integer and int(marker_value) >= CURRENT_HERO_SOUL_RULES_VERSION:
		return false

	var souls_value: Variant = inventory.get("hero_souls", [])
	var should_translate_legacy := marker_present \
		and marker_is_integer \
		and int(marker_value) <= LEGACY_HERO_SOUL_RULES_VERSION
	if not marker_present:
		should_translate_legacy = _hero_soul_inventory_has_legacy_shape(souls_value)

	if should_translate_legacy and souls_value is Array:
		var migrated_souls: Array = []
		for raw_soul: Variant in souls_value:
			if not raw_soul is Dictionary:
				migrated_souls.append(raw_soul)
				continue
			var soul: Dictionary = (raw_soul as Dictionary).duplicate(true)
			var rarity := int(soul.get("rarity", -1))
			if rarity == 5:
				rarity = HERO_SOUL_RULES.Rarity.ETERNAL
			soul["rarity"] = rarity
			var target_count := HERO_SOUL_RULES.affix_slot_count(rarity)
			var migrated_affixes: Array[Dictionary] = []
			var seen_ids := {}
			var group_counts := {}
			var affixes_value: Variant = soul.get("affixes", [])
			if affixes_value is Array:
				for raw_affix: Variant in affixes_value:
					if migrated_affixes.size() >= target_count:
						break
					if not raw_affix is Dictionary:
						continue
					var affix: Dictionary = (raw_affix as Dictionary).duplicate(true)
					var affix_id := String(affix.get("affix_id", "")).strip_edges().to_lower()
					if not HERO_SOUL_RULES.AFFIX_CATALOG.has(affix_id) or seen_ids.has(affix_id):
						continue
					var definition: Dictionary = HERO_SOUL_RULES.AFFIX_CATALOG[affix_id]
					var stacking_group := String(definition.get("stacking_group", ""))
					if int(group_counts.get(stacking_group, 0)) >= HERO_SOUL_RULES.MAX_AFFIXES_PER_STACKING_GROUP:
						continue
					affix["affix_id"] = affix_id
					affix["stacking_group"] = stacking_group
					migrated_affixes.append(affix)
					seen_ids[affix_id] = true
					group_counts[stacking_group] = int(group_counts.get(stacking_group, 0)) + 1
			soul["affixes"] = migrated_affixes
			migrated_souls.append(soul)
		inventory["hero_souls"] = migrated_souls

	var canonical_inventory := _canonicalize_hero_weapon_affixes_v3(
		inventory.get("hero_souls", [])
	)
	if not bool(canonical_inventory.get("valid", false)):
		return false
	inventory["hero_souls"] = canonical_inventory.get("weapons", [])
	var storage_value: Variant = document.get("storage", {})
	if storage_value is Dictionary:
		var storage := (storage_value as Dictionary).duplicate(true)
		var canonical_storage := _canonicalize_hero_weapon_affixes_v3(
			storage.get("hero_weapons", [])
		)
		if not bool(canonical_storage.get("valid", false)):
			return false
		storage["hero_weapons"] = canonical_storage.get("weapons", [])
		document["storage"] = storage

	# A missing marker with a current-looking inventory is not reinterpreted.
	# Stamping it still matters: future rarity additions must never guess again.
	inventory["hero_soul_rules_version"] = CURRENT_HERO_SOUL_RULES_VERSION
	return should_translate_legacy or not marker_present \
		or (marker_is_integer and int(marker_value) < CURRENT_HERO_SOUL_RULES_VERSION)


func _canonicalize_hero_weapon_affixes_v3(weapons_value: Variant) -> Dictionary:
	if not weapons_value is Array:
		return {"valid": false, "weapons": []}
	var migrated: Array[Dictionary] = []
	for raw_weapon: Variant in weapons_value:
		if not raw_weapon is Dictionary:
			return {"valid": false, "weapons": []}
		var weapon := (raw_weapon as Dictionary).duplicate(true)
		var affixes_value: Variant = weapon.get("affixes", [])
		if not affixes_value is Array:
			return {"valid": false, "weapons": []}
		var next_affixes: Array[Dictionary] = []
		var seen_ids := {}
		var group_counts := {}
		for raw_affix: Variant in affixes_value:
			if not raw_affix is Dictionary:
				return {"valid": false, "weapons": []}
			var affix := (raw_affix as Dictionary).duplicate(true)
			var preferred := HERO_SOUL_RULES.canonical_affix_id(
				String(affix.get("affix_id", ""))
			)
			var candidates := PackedStringArray([preferred])
			for fallback_id: String in HERO_SOUL_COMBAT_AFFIXES.LIVE_AFFIX_IDS:
				if not candidates.has(fallback_id):
					candidates.append(fallback_id)
			var chosen := ""
			for candidate: String in candidates:
				if seen_ids.has(candidate) \
						or not HERO_SOUL_RULES.AFFIX_CATALOG.has(candidate) \
						or not HERO_SOUL_COMBAT_AFFIXES.is_live_affix(candidate):
					continue
				var definition: Dictionary = HERO_SOUL_RULES.AFFIX_CATALOG[candidate]
				var group := String(definition.get("stacking_group", ""))
				if int(group_counts.get(group, 0)) >= HERO_SOUL_RULES.MAX_AFFIXES_PER_STACKING_GROUP:
					continue
				chosen = candidate
				break
			if chosen.is_empty():
				return {"valid": false, "weapons": []}
			var chosen_definition: Dictionary = HERO_SOUL_RULES.AFFIX_CATALOG[chosen]
			var chosen_group := String(chosen_definition.get("stacking_group", ""))
			affix["affix_id"] = chosen
			affix["field"] = String(chosen_definition.get("field", ""))
			affix["unit"] = String(chosen_definition.get("unit", "percent"))
			affix["pool"] = String(chosen_definition.get("pool", ""))
			affix["stacking_group"] = chosen_group
			affix["tags"] = (chosen_definition.get("tags", []) as Array).duplicate(true)
			next_affixes.append(affix)
			seen_ids[chosen] = true
			group_counts[chosen_group] = int(group_counts.get(chosen_group, 0)) + 1
		weapon["affixes"] = next_affixes
		migrated.append(weapon)
	return {"valid": true, "weapons": migrated}


func _hero_soul_inventory_has_legacy_shape(souls_value: Variant) -> bool:
	if not souls_value is Array:
		return false
	for raw_soul: Variant in souls_value:
		if not raw_soul is Dictionary:
			continue
		var soul: Dictionary = raw_soul as Dictionary
		var rarity := int(soul.get("rarity", -1))
		var affixes_value: Variant = soul.get("affixes", [])
		if not affixes_value is Array:
			continue
		if rarity >= HERO_SOUL_RULES.Rarity.NORMAL \
				and rarity <= 5 \
				and (affixes_value as Array).size() > HERO_SOUL_RULES.affix_slot_count(rarity):
			return true
		for raw_affix: Variant in affixes_value:
			if not raw_affix is Dictionary:
				continue
			var affix_id := String((raw_affix as Dictionary).get("affix_id", "")).strip_edges().to_lower()
			if HERO_SOUL_RULES.AFFIX_CATALOG.has(affix_id):
				var definition: Dictionary = HERO_SOUL_RULES.AFFIX_CATALOG[affix_id]
				if String(definition.get("pool", "")) == HERO_SOUL_RULES.POOL_LEGACY:
					return true
	return false


func _migrate_v0_to_v1(legacy: Dictionary) -> Dictionary:
	var migrated := _default_v1_data()
	var legacy_weapons: Variant = legacy.get("weapons", [])
	if legacy_weapons is Array:
		for weapon_id: Variant in legacy_weapons:
			var normalized := String(weapon_id).to_lower()
			if _is_valid_identifier(normalized):
				migrated["progression"]["unlocked_weapons"][normalized] = true
	var legacy_features: Variant = legacy.get("features", [])
	if legacy_features is Array:
		for feature_id: Variant in legacy_features:
			var normalized := String(feature_id).to_lower()
			if _is_valid_identifier(normalized):
				migrated["progression"]["features"][normalized] = true
	if legacy.get("campaign_level") is int or legacy.get("campaign_level") is float:
		migrated["progression"]["campaign"]["level"] = maxi(1, int(legacy["campaign_level"]))
	if legacy.get("tutorial_flags") is Dictionary:
		migrated["tutorials"].merge(legacy["tutorial_flags"], true)
	if legacy.get("equipped") is Dictionary:
		var equipped: Dictionary = legacy["equipped"]
		migrated["loadout"]["hand_weapon"] = String(equipped.get("hand", "sword"))
		if equipped.get("spirits") is Array:
			migrated["loadout"]["spirit_slots"] = equipped["spirits"].duplicate()
	for section_name: String in [
		"currencies", "mastery", "inventory", "monster_parts", "mode_progress",
		"bestiary", "settings", "applied_transactions",
	]:
		if legacy.get(section_name) is Dictionary:
			migrated[section_name] = _merge_defaults(migrated[section_name], legacy[section_name])
	if legacy.get("revision") is int or legacy.get("revision") is float:
		migrated["revision"] = maxi(0, int(legacy["revision"]))
	migrated["_migration_origin_schema"] = 0
	migrated["schema_version"] = 1
	return migrated


func _migrate_v1_to_v2(legacy: Dictionary) -> Dictionary:
	var migrated := legacy.duplicate(true)
	var origin_version := int(migrated.get("_migration_origin_schema", 1))
	migrated.erase("_migration_origin_schema")
	_archive_obsolete_weapon_sections(migrated, origin_version)
	var progression: Dictionary = migrated.get("progression", {}).duplicate(true)
	var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
	campaign["average_enemy_level_cap"] = HERO_PROGRESSION_RULES.default_average_enemy_level(
		maxi(1, int(campaign.get("level", 1)))
	)
	progression["campaign"] = campaign
	var heroes: Dictionary = progression.get("unlocked_heroes", {}).duplicate(true)
	heroes["sword_hero"] = true
	progression["unlocked_heroes"] = heroes
	migrated["progression"] = progression
	migrated["soul_team"] = {
		"active_hero": "sword_hero",
		"reserve_souls": [""],
		"capacity": SOUL_TEAM_RESERVE_CAPACITY,
		"selected_soul_instances": {
			"sword_hero": String(_starter_sword_soul().get("instance_id", "")),
		},
	}
	migrated["schema_version"] = 2
	return migrated


## Canonicalizes the pre-release Mage placeholder to Wizard without granting a
## new Hero.  A profile that owned Mage keeps exactly those identities, Souls
## and choices; only their durable ID changes.  If a development profile has
## both keys, the canonical Wizard selection wins rather than creating extra
## skill ranks or changing the player's explicit loadout.
func _migrate_v2_to_v3(legacy: Dictionary) -> Dictionary:
	const LEGACY_ID := "mage_hero"
	const CANONICAL_ID := "wizard_hero"
	var migrated := legacy.duplicate(true)

	var progression_value: Variant = migrated.get("progression", {})
	if progression_value is Dictionary:
		var progression := (progression_value as Dictionary).duplicate(true)
		var heroes_value: Variant = progression.get("unlocked_heroes", {})
		if heroes_value is Dictionary:
			var heroes := (heroes_value as Dictionary).duplicate(true)
			_migrate_boolean_key(heroes, LEGACY_ID, CANONICAL_ID)
			progression["unlocked_heroes"] = heroes
		var features_value: Variant = progression.get("features", {})
		if features_value is Dictionary:
			var features := (features_value as Dictionary).duplicate(true)
			_migrate_boolean_key(features, "mage_hero_unlocked", "wizard_hero_unlocked")
			progression["features"] = features
		var player_value: Variant = progression.get("player", {})
		if player_value is Dictionary:
			var player := (player_value as Dictionary).duplicate(true)
			var allocations_value: Variant = player.get("skill_allocations", {})
			if allocations_value is Dictionary:
				var allocations := (allocations_value as Dictionary).duplicate(true)
				if allocations.has(LEGACY_ID):
					if not allocations.has(CANONICAL_ID) or not allocations[CANONICAL_ID] is Dictionary:
						allocations[CANONICAL_ID] = allocations[LEGACY_ID]
					allocations.erase(LEGACY_ID)
				player["skill_allocations"] = allocations
			progression["player"] = player
		migrated["progression"] = progression

	var inventory_value: Variant = migrated.get("inventory", {})
	if inventory_value is Dictionary:
		var inventory := (inventory_value as Dictionary).duplicate(true)
		var souls_value: Variant = inventory.get("hero_souls", [])
		if souls_value is Array:
			var souls := (souls_value as Array).duplicate(true)
			for index: int in souls.size():
				if not souls[index] is Dictionary:
					continue
				var soul := (souls[index] as Dictionary).duplicate(true)
				if String(soul.get("hero_id", "")).strip_edges().to_lower() != LEGACY_ID:
					continue
				soul["hero_id"] = CANONICAL_ID
				if String(soul.get("affinity", "")).strip_edges().to_lower() == "mage":
					soul["affinity"] = "magician"
				souls[index] = soul
			inventory["hero_souls"] = souls
		migrated["inventory"] = inventory

	var team_value: Variant = migrated.get("soul_team", {})
	if team_value is Dictionary:
		var team := (team_value as Dictionary).duplicate(true)
		if String(team.get("active_hero", "")).strip_edges().to_lower() == LEGACY_ID:
			team["active_hero"] = CANONICAL_ID
		var reserves_value: Variant = team.get("reserve_souls", [])
		if reserves_value is Array:
			var reserves := (reserves_value as Array).duplicate(true)
			for index: int in reserves.size():
				if String(reserves[index]).strip_edges().to_lower() == LEGACY_ID:
					reserves[index] = CANONICAL_ID
			team["reserve_souls"] = reserves
		var selections_value: Variant = team.get("selected_soul_instances", {})
		if selections_value is Dictionary:
			var selections := (selections_value as Dictionary).duplicate(true)
			if selections.has(LEGACY_ID):
				if not selections.has(CANONICAL_ID) or String(selections[CANONICAL_ID]).strip_edges().is_empty():
					selections[CANONICAL_ID] = selections[LEGACY_ID]
				selections.erase(LEGACY_ID)
			team["selected_soul_instances"] = selections
		migrated["soul_team"] = team

	migrated["schema_version"] = 3
	return migrated


## Decouples Hero identity from its personalized Hero Weapon, introduces the
## Home chest and moves combat progression to one record per Hero.  Legacy
## names remain mirrored so pre-V1 UI can keep reading the profile safely.
func _migrate_v3_to_v4(legacy: Dictionary) -> Dictionary:
	var migrated := legacy.duplicate(true)
	var progression: Dictionary = migrated.get("progression", {}).duplicate(true)
	var unlocked: Dictionary = progression.get("unlocked_heroes", {}).duplicate(true)
	var hero_records: Dictionary = progression.get("heroes", {}).duplicate(true)
	for raw_hero_id: Variant in unlocked.keys():
		var hero_id := String(raw_hero_id).strip_edges().to_lower()
		if bool(unlocked[raw_hero_id]) and _is_persistable_hero_id(hero_id) and not hero_records.has(hero_id):
			hero_records[hero_id] = HERO_PROGRESSION_RULES.empty_record(StringName(hero_id))
	progression["heroes"] = hero_records
	progression["hero_shards"] = progression.get("hero_shards", {}).duplicate(true) \
		if progression.get("hero_shards", {}) is Dictionary else {}
	migrated["progression"] = progression

	var inventory: Dictionary = migrated.get("inventory", {}).duplicate(true)
	var legacy_weapons: Array = (inventory.get("hero_souls", []) as Array).duplicate(true)
	inventory["hero_weapons"] = legacy_weapons.duplicate(true)
	migrated["inventory"] = inventory
	migrated["storage"] = {
		"capacity": HOME_STORAGE_SLOT_CAPACITY,
		"hero_weapons": [],
		"auxiliary_equipment": [],
		"item_stacks": {},
	}
	migrated["pending_rewards"] = []
	var old_loadout: Dictionary = migrated.get("auxiliary_loadout", {}).duplicate(true)
	migrated["hero_loadouts"] = {
		"sword_hero": {
			"hero_weapon": String(
				((migrated.get("soul_team", {}) as Dictionary).get(
					"selected_soul_instances", {}
				) as Dictionary).get("sword_hero", "")
			),
			"armor": String(old_loadout.get("soul_vessel", "")),
			"boots": String(old_loadout.get("soul_boots", "")),
			"jewelry": String(old_loadout.get("soul_trace", "")),
		},
	}
	migrated["schema_version"] = 4
	return migrated


func _migrate_boolean_key(values: Dictionary, legacy_key: String, canonical_key: String) -> void:
	if not values.has(legacy_key):
		return
	values[canonical_key] = bool(values.get(canonical_key, false)) or bool(values[legacy_key])
	values.erase(legacy_key)


func _default_data() -> Dictionary:
	return {
		"schema_version": CURRENT_SCHEMA_VERSION,
		"revision": 0,
		"progression": {
			"campaign": _default_campaign(),
			"unlocked_heroes": {"sword_hero": true},
			"hero_shards": {},
			"heroes": {
				"sword_hero": HERO_PROGRESSION_RULES.empty_record(&"sword_hero"),
			},
			"player": {
				"level": 1,
				"xp": 0,
				"stat_economy_version": CURRENT_STAT_ECONOMY_VERSION,
				"free_stat_reallocation_credits": 0,
				"skill_economy_version": CURRENT_SKILL_ECONOMY_VERSION,
				"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
				"skill_allocations": {
					"sword_hero": PLAYER_PROGRESSION_RULES.empty_skill_tracks(),
				},
			},
			"features": {
				"soul_hero": false,
				"soul_relay": false,
				"hero_soul_inventory": false,
				"hero_soul_sell": false,
				"hero_soul_fusion": false,
				"second_reserve_soul": false,
				"monster_forge": false,
				"part_inventory": false,
				"hunt": false,
				"rarity_loot": false,
				"affix_inspection": false,
				"salvage": false,
				"crafting": false,
				"challenge": false,
				"depth": false,
				"bestiary": false,
			},
		},
		"tutorials": {
			"movement": false,
			"attack": false,
			"dash": false,
			"sword_combo": false,
			"passing_slash": false,
			"crescent_recoil": false,
			"pursuit_execution": false,
			"soul_echo": false,
			"soul_ready": false,
			"soul_interception": false,
			"soul_relay": false,
		},
		"soul_team": {
			"active_hero": "sword_hero",
			"reserve_souls": [""],
			"capacity": SOUL_TEAM_RESERVE_CAPACITY,
			"selected_soul_instances": {
				"sword_hero": String(_starter_sword_soul().get("instance_id", "")),
			},
		},
		"currencies": {"account": 0, "hero_materials": 0, "monster_fragments": 0},
		"mastery": {},
		"inventory": {
			"item_stacks": {},
			"hero_souls": [_starter_sword_soul()],
			"hero_weapons": [_starter_sword_soul()],
			"hero_soul_rules_version": CURRENT_HERO_SOUL_RULES_VERSION,
			"auxiliary_equipment_version": CURRENT_AUXILIARY_EQUIPMENT_VERSION,
			"auxiliary_equipment": [],
			"rarity_items": [],
			"favorites": [],
			"locked": [],
		},
		"storage": {
			"capacity": HOME_STORAGE_SLOT_CAPACITY,
			"hero_weapons": [],
			"auxiliary_equipment": [],
			"item_stacks": {},
		},
		"pending_rewards": [],
		"hero_loadouts": {
			"sword_hero": {
				"hero_weapon": String(_starter_sword_soul().get("instance_id", "")),
				"armor": "",
				"boots": "",
				"jewelry": "",
			},
		},
		"auxiliary_loadout": _default_auxiliary_loadout(),
		"monster_parts": {"owned": {}, "equipped": {}},
		"mode_progress": {"hunt": {}, "challenge": {}, "depth": {}},
		"bestiary": {"discovered": []},
		"settings": _default_settings(),
		"applied_transactions": {},
		"legacy_audit": _default_legacy_audit(),
	}


func _default_v1_data() -> Dictionary:
	return {
		"schema_version": 1,
		"revision": 0,
		"progression": {
			"campaign": _default_campaign(),
			"unlocked_weapons": {"sword": true, "bow": false, "axe": false},
			"features": {
				"second_spirit": false,
				"monster_forge": false,
				"part_inventory": false,
				"hunt": false,
				"rarity_loot": false,
				"affix_inspection": false,
				"salvage": false,
				"crafting": false,
				"challenge": false,
				"depth": false,
				"bestiary": false,
			},
		},
		"tutorials": {
			"movement": false,
			"attack": false,
			"dash": false,
			"dash_slash": false,
			"bow_reward": false,
			"bow_spirit": false,
			"weapon_swap": false,
		},
		"loadout": {"hand_weapon": "sword", "spirit_slots": ["", ""]},
		"currencies": {"account": 0, "weapon_materials": 0, "monster_fragments": 0},
		"mastery": {},
		"inventory": {"weapons": [], "item_stacks": {}, "rarity_items": [], "favorites": [], "locked": []},
		"monster_parts": {"owned": {}, "equipped": {}},
		"mode_progress": {"hunt": {}, "challenge": {}, "depth": {}},
		"bestiary": {"discovered": []},
		"settings": _default_settings(),
		"applied_transactions": {},
	}


func _default_campaign() -> Dictionary:
	return {
		"chapter": 1,
		"level": 1,
		"unlocked_levels": ["chapter_1_level_1"],
		"completed_levels": {},
		"optional_objectives": {},
		"selected_difficulties": {},
		"average_enemy_level_cap": 5,
	}


func _default_auxiliary_loadout() -> Dictionary:
	return {
		"soul_vessel": "",
		"soul_boots": "",
		"soul_trace": "",
	}


func _default_settings() -> Dictionary:
	return {
		"master_volume": 1.0,
		"music_volume": 0.8,
		"sfx_volume": 1.0,
		"screen_shake": 0.8,
		"vibration": true,
		"damage_numbers": true,
		"aim_assist": 0.5,
		"reduced_flashes": false,
		"reduced_motion": false,
		"fullscreen": false,
		"show_fps": false,
		"high_contrast": false,
		"left_handed": false,
		"ui_scale": 1.0,
		"joystick_opacity": 0.7,
		"joystick_size": 1.0,
		"button_scale": 1.0,
		"telegraph_palette": "standard",
	}


func _default_legacy_audit() -> Dictionary:
	return {
		"source_schema_version": -1,
		"weapon_ownership": {},
		"weapon_loadout": {},
		"weapon_inventory": [],
		"weapon_mastery": {},
		"weapon_tutorials": {},
		"weapon_features": {},
		"stat_allocation_pre_power": {},
		"skill_allocations_pre_specialization": {},
		"soul_focus_equipment_pre_v2": {"items": [], "loadout": {}},
		"migration_notes": [],
	}


func _archive_obsolete_weapon_sections(document: Dictionary, source_version: int) -> void:
	var existing_audit: Dictionary = {}
	if document.get("legacy_audit") is Dictionary:
		existing_audit = document["legacy_audit"]
	var audit := _merge_defaults(_default_legacy_audit(), existing_audit)
	var captured := false

	if document.get("progression") is Dictionary:
		var progression: Dictionary = document["progression"]
		if progression.get("unlocked_weapons") is Dictionary:
			var weapon_ownership: Dictionary = progression["unlocked_weapons"].duplicate(true)
			audit["weapon_ownership"] = weapon_ownership
			var unlocked_heroes: Dictionary = {}
			if progression.get("unlocked_heroes") is Dictionary:
				unlocked_heroes = progression["unlocked_heroes"].duplicate(true)
			if bool(weapon_ownership.get("sword", false)):
				unlocked_heroes["sword_hero"] = true
			progression["unlocked_heroes"] = unlocked_heroes
			progression.erase("unlocked_weapons")
			captured = true
		if progression.get("features") is Dictionary:
			var features: Dictionary = progression["features"]
			if features.has("second_spirit"):
				var archived_features: Dictionary = audit.get("weapon_features", {}).duplicate(true)
				archived_features["second_spirit"] = bool(features["second_spirit"])
				audit["weapon_features"] = archived_features
				features.erase("second_spirit")
				captured = true

	if document.get("loadout") is Dictionary:
		audit["weapon_loadout"] = document["loadout"].duplicate(true)
		document.erase("loadout")
		captured = true
	elif document.has("loadout"):
		document.erase("loadout")

	if document.get("tutorials") is Dictionary:
		var tutorials: Dictionary = document["tutorials"]
		var archived_tutorials: Dictionary = audit.get("weapon_tutorials", {}).duplicate(true)
		for tutorial_id: String in ["dash_slash", "bow_reward", "bow_spirit", "weapon_swap"]:
			if tutorials.has(tutorial_id):
				archived_tutorials[tutorial_id] = bool(tutorials[tutorial_id])
				tutorials.erase(tutorial_id)
				captured = true
		audit["weapon_tutorials"] = archived_tutorials

	if document.get("inventory") is Dictionary:
		var inventory: Dictionary = document["inventory"]
		if inventory.has("weapons"):
			if inventory["weapons"] is Array:
				audit["weapon_inventory"] = inventory["weapons"].duplicate(true)
			inventory.erase("weapons")
			captured = true

	var weapon_ids: Dictionary = {"sword": true, "bow": true, "axe": true}
	if audit.get("weapon_ownership") is Dictionary:
		for raw_id: Variant in (audit["weapon_ownership"] as Dictionary).keys():
			weapon_ids[String(raw_id).to_lower()] = true
	if document.get("mastery") is Dictionary:
		var mastery: Dictionary = document["mastery"]
		var archived_mastery: Dictionary = audit.get("weapon_mastery", {}).duplicate(true)
		for weapon_id: String in weapon_ids:
			if mastery.has(weapon_id):
				archived_mastery[weapon_id] = mastery[weapon_id]
				if weapon_id == "sword" and not mastery.has("sword_hero"):
					mastery["sword_hero"] = mastery[weapon_id]
				mastery.erase(weapon_id)
				captured = true
		audit["weapon_mastery"] = archived_mastery

	if document.get("currencies") is Dictionary:
		var currencies: Dictionary = document["currencies"]
		if currencies.has("weapon_materials"):
			if not currencies.has("hero_materials"):
				currencies["hero_materials"] = currencies["weapon_materials"]
			currencies.erase("weapon_materials")
			captured = true

	if captured:
		if int(audit.get("source_schema_version", -1)) < 0:
			audit["source_schema_version"] = source_version
		var notes: Array = audit.get("migration_notes", []).duplicate(true)
		const NOTE := "Obsolete weapon ownership/loadout was archived; only Sword ownership maps to sword_hero."
		if not notes.has(NOTE):
			notes.append(NOTE)
		audit["migration_notes"] = notes
	document["legacy_audit"] = audit


func _sanitize_legacy_audit(audit: Dictionary) -> void:
	audit["source_schema_version"] = maxi(-1, int(audit.get("source_schema_version", -1)))
	var ownership: Dictionary = {}
	if audit.get("weapon_ownership") is Dictionary:
		for raw_id: Variant in (audit["weapon_ownership"] as Dictionary).keys():
			var weapon_id := String(raw_id).strip_edges().to_lower()
			if _is_valid_identifier(weapon_id):
				ownership[weapon_id] = bool((audit["weapon_ownership"] as Dictionary)[raw_id])
	audit["weapon_ownership"] = ownership
	if not audit.get("weapon_loadout") is Dictionary:
		audit["weapon_loadout"] = {}
	if not audit.get("weapon_inventory") is Array:
		audit["weapon_inventory"] = []
	if not audit.get("weapon_mastery") is Dictionary:
		audit["weapon_mastery"] = {}
	if not audit.get("skill_allocations_pre_specialization") is Dictionary:
		audit["skill_allocations_pre_specialization"] = {}
	var focus_archive := {"items": [], "loadout": {}}
	var raw_focus_archive: Variant = audit.get("soul_focus_equipment_pre_v2", {})
	if raw_focus_archive is Dictionary:
		var raw_focus_items: Variant = (raw_focus_archive as Dictionary).get("items", [])
		if raw_focus_items is Array:
			var archived_items: Array[Dictionary] = []
			for raw_item: Variant in raw_focus_items:
				if raw_item is Dictionary:
					archived_items.append((raw_item as Dictionary).duplicate(true))
			focus_archive["items"] = archived_items
		var raw_focus_loadout: Variant = (raw_focus_archive as Dictionary).get("loadout", {})
		if raw_focus_loadout is Dictionary:
			focus_archive["loadout"] = (raw_focus_loadout as Dictionary).duplicate(true)
	audit["soul_focus_equipment_pre_v2"] = focus_archive
	var archived_stat_allocation := {}
	if audit.get("stat_allocation_pre_power") is Dictionary:
		var raw_archived := audit["stat_allocation_pre_power"] as Dictionary
		for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
			var raw_value: Variant = raw_archived.get(String(stat_id), 0)
			if (raw_value is int or raw_value is float) \
					and is_finite(float(raw_value)) \
					and float(raw_value) == float(int(raw_value)):
				archived_stat_allocation[String(stat_id)] = int(raw_value)
	audit["stat_allocation_pre_power"] = archived_stat_allocation
	for category: String in ["weapon_tutorials", "weapon_features"]:
		var sanitized_flags: Dictionary = {}
		if audit.get(category) is Dictionary:
			for raw_id: Variant in (audit[category] as Dictionary).keys():
				var flag_id := String(raw_id).strip_edges().to_lower()
				if _is_valid_identifier(flag_id):
					sanitized_flags[flag_id] = bool((audit[category] as Dictionary)[raw_id])
		audit[category] = sanitized_flags
	var sanitized_notes: Array[String] = []
	if audit.get("migration_notes") is Array:
		for raw_note: Variant in audit["migration_notes"]:
			var note := String(raw_note).strip_edges()
			if not note.is_empty() and not sanitized_notes.has(note):
				sanitized_notes.append(note)
	audit["migration_notes"] = sanitized_notes


func _merge_defaults(defaults: Dictionary, provided: Dictionary) -> Dictionary:
	var merged := provided.duplicate(true)
	for key: Variant in defaults.keys():
		if not merged.has(key):
			merged[key] = defaults[key].duplicate(true) if defaults[key] is Dictionary or defaults[key] is Array else defaults[key]
		elif defaults[key] is Dictionary:
			if merged[key] is Dictionary:
				merged[key] = _merge_defaults(defaults[key], merged[key])
			else:
				merged[key] = defaults[key].duplicate(true)
	return merged


func _validate_json_value(value: Variant, path: String) -> String:
	match typeof(value):
		TYPE_NIL, TYPE_BOOL, TYPE_INT, TYPE_STRING:
			return ""
		TYPE_FLOAT:
			return "" if is_finite(float(value)) else "%s contains a non-finite number." % path
		TYPE_ARRAY:
			var array_value: Array = value
			for index: int in array_value.size():
				var child_error := _validate_json_value(array_value[index], "%s[%d]" % [path, index])
				if not child_error.is_empty():
					return child_error
			return ""
		TYPE_DICTIONARY:
			var dictionary_value: Dictionary = value
			for raw_key: Variant in dictionary_value.keys():
				if not raw_key is String and not raw_key is StringName:
					return "%s contains a non-string Dictionary key." % path
				var key := String(raw_key)
				var child_error := _validate_json_value(dictionary_value[raw_key], "%s.%s" % [path, key])
				if not child_error.is_empty():
					return child_error
			return ""
		_:
			return "%s contains unsupported runtime data (Variant type %d)." % [path, typeof(value)]


func _accept_loaded_data(snapshot: Dictionary, recovery_source: String) -> void:
	_data = snapshot.duplicate(true)
	_is_loaded = true
	if not recovery_source.is_empty():
		save_recovered.emit(recovery_source)
	save_loaded.emit(get_snapshot())


func _import_legacy_default_save() -> bool:
	var source_path := _legacy_import_path
	var imported := _read_and_prepare(source_path)
	if bool(imported.get("economy_quarantine", false)):
		return _quarantine_economy_save(source_path, String(imported.get("error", "invalid_ownership")))
	if not bool(imported.get("ok", false)):
		# Never alter an unreadable legacy profile. Create an independent safe v2
		# profile and leave the old bytes available for manual recovery.
		_legacy_import_path = ""
		_push_failure("The legacy save could not be imported; it was left untouched.")
		return load_save()
	var snapshot: Dictionary = imported.get("data", {}).duplicate(true)
	if not _preserve_pre_migration_backup(source_path):
		_accept_loaded_data(snapshot, "")
		_push_failure("The legacy save was prepared in memory, but its migration backup could not be created.")
		return false
	if not _commit_snapshot(snapshot, false, _disk_commit_capability):
		_accept_loaded_data(snapshot, "")
		_push_failure("The legacy save was prepared in memory, but the v2 profile could not be committed.")
		return false
	_legacy_import_path = ""
	_accept_loaded_data(snapshot, "legacy_path")
	if bool(imported.get("was_migrated", false)):
		save_migrated.emit(int(imported.get("source_version", 0)), CURRENT_SCHEMA_VERSION, _migration_backup_path)
	return true


func _preserve_pre_migration_backup(source_path: String) -> bool:
	if not FileAccess.file_exists(source_path):
		return false
	if source_path != _backup_path:
		if not _copy_text_file(source_path, _backup_path) or not _files_have_same_text(source_path, _backup_path):
			return false
	if not FileAccess.file_exists(_migration_backup_path):
		if not _copy_text_file(source_path, _migration_backup_path):
			return false
		if not _files_have_same_text(source_path, _migration_backup_path):
			_remove_if_present(_migration_backup_path)
			return false
	return true


func _ensure_loaded() -> void:
	if not _is_loaded:
		load_save()


func _set_storage_paths(path: String) -> void:
	_save_path = path
	_backup_path = path + ".bak"
	_temporary_path = path + ".tmp"
	_migration_backup_path = path + ".pre_v3.bak"


func _write_text(path: String, payload: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(payload)
	file.flush()
	file.close()
	return true


func _copy_text_file(source: String, destination: String) -> bool:
	var source_file := FileAccess.open(source, FileAccess.READ)
	if source_file == null:
		return false
	var payload := source_file.get_as_text()
	source_file.close()
	return _write_text(destination, payload)


func _files_have_same_text(first_path: String, second_path: String) -> bool:
	var first := FileAccess.open(first_path, FileAccess.READ)
	var second := FileAccess.open(second_path, FileAccess.READ)
	if first == null or second == null:
		if first != null:
			first.close()
		if second != null:
			second.close()
		return false
	var matches := first.get_as_text() == second.get_as_text()
	first.close()
	second.close()
	return matches


func _remove_if_present(path: String) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))


func _emit_player_progression_events(
		player_level: int,
		current_xp: int,
		required_xp: int,
		gained_xp: int,
		levels_gained: int,
) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		return
	if events.has_signal(&"player_experience_changed"):
		events.emit_signal(
			&"player_experience_changed",
			maxi(0, current_xp),
			maxi(0, required_xp),
			maxi(0, gained_xp),
		)
	if levels_gained > 0 and events.has_signal(&"player_level_changed"):
		events.emit_signal(
			&"player_level_changed",
			clampi(player_level, 1, PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP),
			levels_gained,
		)


func _is_safe_user_path(path: String) -> bool:
	return path.begins_with("user://") and path.ends_with(".json") and path.find("..") < 0


func _is_valid_transaction_key(key: String) -> bool:
	var stripped := key.strip_edges()
	return not stripped.is_empty() and stripped.length() <= MAX_TRANSACTION_KEY_LENGTH


func _is_valid_identifier(identifier: String) -> bool:
	if identifier.is_empty() or identifier.length() > 64:
		return false
	const ALLOWED := "abcdefghijklmnopqrstuvwxyz0123456789_"
	for index: int in identifier.length():
		if ALLOWED.find(identifier[index]) < 0:
			return false
	return true


func _is_persistable_hero_id(identifier: String) -> bool:
	if not _is_valid_identifier(identifier):
		return false
	return identifier not in [
		"sword",
		"bow",
		"axe",
		"bow_hero",
		"relay_test_dummy",
		"debug_relay_dummy",
	]


func _candidate_owns_hero(candidate: Dictionary, hero_id: String) -> bool:
	var inventory_value: Variant = candidate.get("inventory", {})
	if not inventory_value is Dictionary:
		return false
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
	if not souls_value is Array:
		return false
	for soul_value: Variant in souls_value:
		if soul_value is Dictionary and String((soul_value as Dictionary).get("hero_id", "")) == hero_id:
			return true
	var storage_value: Variant = candidate.get("storage", {})
	if storage_value is Dictionary:
		var stored_value: Variant = (storage_value as Dictionary).get("hero_weapons", [])
		if stored_value is Array:
			for weapon_value: Variant in stored_value:
				if weapon_value is Dictionary \
						and String((weapon_value as Dictionary).get("hero_id", "")) == hero_id:
					return true
	return false


func _candidate_soul_by_instance(candidate: Dictionary, instance_id: String) -> Dictionary:
	var inventory_value: Variant = candidate.get("inventory", {})
	if not inventory_value is Dictionary:
		return {}
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
	if not souls_value is Array:
		return {}
	var normalized_id := instance_id.strip_edges().to_lower()
	for raw_soul: Variant in souls_value:
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("instance_id", "")).strip_edges().to_lower() == normalized_id:
			return (raw_soul as Dictionary).duplicate(true)
	var storage_value: Variant = candidate.get("storage", {})
	if storage_value is Dictionary:
		var stored_value: Variant = (storage_value as Dictionary).get("hero_weapons", [])
		if stored_value is Array:
			for raw_weapon: Variant in stored_value:
				if raw_weapon is Dictionary \
						and String((raw_weapon as Dictionary).get("instance_id", "")).strip_edges().to_lower() == normalized_id:
					return (raw_weapon as Dictionary).duplicate(true)
	return {}


func _best_hero_soul_instance_id(candidates: Array, equipped_only: bool) -> String:
	var best: Dictionary = {}
	for raw_soul: Variant in candidates:
		if not raw_soul is Dictionary:
			continue
		var soul := raw_soul as Dictionary
		if equipped_only and not bool(soul.get("equipped", false)):
			continue
		if best.is_empty() \
				or int(soul.get("rarity", 0)) > int(best.get("rarity", 0)) \
				or (
					int(soul.get("rarity", 0)) == int(best.get("rarity", 0))
					and int(soul.get("item_level", 1)) > int(best.get("item_level", 1))
				) \
				or (
					int(soul.get("rarity", 0)) == int(best.get("rarity", 0))
					and int(soul.get("item_level", 1)) == int(best.get("item_level", 1))
					and String(soul.get("instance_id", "")) < String(best.get("instance_id", ""))
				):
			best = soul
	return String(best.get("instance_id", ""))


func _hero_soul_selection_signature(document: Dictionary) -> String:
	var team_value: Variant = document.get("soul_team", {})
	var inventory_value: Variant = document.get("inventory", {})
	var signature := {
		"active_hero": "",
		"reserve_souls": [],
		"selected_soul_instances": {},
		"equipped_instance_ids": [],
	}
	if team_value is Dictionary:
		var team := team_value as Dictionary
		signature["active_hero"] = String(team.get("active_hero", ""))
		if team.get("reserve_souls", []) is Array:
			signature["reserve_souls"] = (team.get("reserve_souls", []) as Array).duplicate()
		var selections_value: Variant = team.get("selected_soul_instances", {})
		if selections_value is Dictionary:
			var keys: Array = (selections_value as Dictionary).keys()
			keys.sort_custom(func(a: Variant, b: Variant) -> bool: return String(a) < String(b))
			var canonical := {}
			for raw_key: Variant in keys:
				canonical[String(raw_key)] = String((selections_value as Dictionary)[raw_key])
			signature["selected_soul_instances"] = canonical
	if inventory_value is Dictionary:
		var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
		if souls_value is Array:
			var equipped_ids: Array[String] = []
			for raw_soul: Variant in souls_value:
				if raw_soul is Dictionary and bool((raw_soul as Dictionary).get("equipped", false)):
					equipped_ids.append(String((raw_soul as Dictionary).get("instance_id", "")))
			equipped_ids.sort()
			signature["equipped_instance_ids"] = equipped_ids
	return JSON.stringify(signature)


func _starter_sword_soul() -> Dictionary:
	var starter: Dictionary = HERO_SOUL_RULES.create_instance(
		&"sword_hero",
		HERO_SOUL_RULES.Rarity.COMMON,
		1,
		&"starter",
		43001,
		HERO_SOUL_RULES.AFFINITY_WARRIOR
	)
	starter["equipped"] = true
	starter["locked"] = true
	return starter


func _ensure_starter_hero_weapon_in_candidate(
		candidate: Dictionary,
		hero_id: String,
		source_id: String,
) -> Dictionary:
	if _candidate_owns_hero(candidate, hero_id):
		return {"location": "owned", "weapon": {}}
	var affinity := HERO_SOUL_RULES.AFFINITY_WARRIOR
	if hero_id == "archer_hero":
		affinity = HERO_SOUL_RULES.AFFINITY_RANGER
	elif hero_id == "wizard_hero":
		affinity = HERO_SOUL_RULES.AFFINITY_MAGICIAN
	var weapon := HERO_SOUL_RULES.create_instance(
		StringName(hero_id),
		HERO_SOUL_RULES.Rarity.NORMAL,
		1,
		StringName(source_id),
		abs(hero_id.hash()) + 77001,
		affinity,
	)
	weapon["locked"] = true
	var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
	if _candidate_inventory_slot_count(inventory) < INVENTORY_SLOT_CAPACITY:
		var bag_weapons: Array = (inventory.get("hero_souls", []) as Array).duplicate(true)
		bag_weapons.append(weapon.duplicate(true))
		inventory["hero_souls"] = bag_weapons
		inventory["hero_weapons"] = bag_weapons.duplicate(true)
		candidate["inventory"] = inventory
		return {"location": "bag", "weapon": weapon}
	var storage: Dictionary = candidate.get("storage", {}).duplicate(true)
	var stored_weapons: Array = (storage.get("hero_weapons", []) as Array).duplicate(true)
	var stored_equipment: Array = (storage.get("auxiliary_equipment", []) as Array)
	var stored_stacks: Dictionary = storage.get("item_stacks", {})
	if stored_weapons.size() + stored_equipment.size() + stored_stacks.size() < HOME_STORAGE_SLOT_CAPACITY:
		stored_weapons.append(weapon.duplicate(true))
		storage["hero_weapons"] = stored_weapons
		candidate["storage"] = storage
		return {"location": "storage", "weapon": weapon}
	var pending: Array = (candidate.get("pending_rewards", []) as Array).duplicate(true)
	pending.append({
		"kind": "hero_weapon",
		"reason": "starter_weapon_no_space",
		"hero_id": hero_id,
		"item": weapon.duplicate(true),
	})
	candidate["pending_rewards"] = pending
	return {"location": "pending_rewards", "weapon": weapon}


func _push_failure(message: String) -> void:
	push_error("SaveService: %s" % message)
	save_failed.emit(message)
