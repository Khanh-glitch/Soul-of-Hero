extends SceneTree

const TEST_SAVE_PATH := "user://tests/soul_of_hero_save_smoke.json"
const MIGRATION_BACKUP_PATH := TEST_SAVE_PATH + ".pre_v2.bak"
const REPORT_PATH := "res://.artifacts/save_unlock_report.json"
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save_service := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	var unlock_service := root.get_node_or_null("UnlockService") as LivingArsenalUnlockService
	_expect(save_service != null, "SaveService autoload exists")
	_expect(unlock_service != null, "UnlockService autoload exists")
	if save_service == null or unlock_service == null:
		_finish()
		return

	_remove_generations(TEST_SAVE_PATH)
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "isolated schema-v2 save path loads")
	_expect(unlock_service.configure_save_service(save_service), "UnlockService accepts injected SaveService")
	_expect(save_service.is_loaded(), "safe default save is loaded")
	_expect(save_service.get_value(["schema_version"], 0) == 2, "new profile starts on schema v2")
	_expect(unlock_service.is_hero_unlocked(&"sword_hero"), "Sword Hero is unlocked by default")
	_expect(not unlock_service.is_hero_unlocked(&"bow"), "legacy Bow is not a Hero")
	_expect(not unlock_service.is_hero_unlocked(&"axe"), "legacy Axe is not a Hero")
	_expect(not unlock_service.is_hero_unlocked(&"relay_test_dummy"), "debug Relay dummy is never persisted")
	_expect(unlock_service.is_weapon_unlocked(&"sword"), "deprecated Sword query maps read-only to Sword Hero")
	_expect(not unlock_service.is_weapon_unlocked(&"bow"), "deprecated Bow query cannot reactivate archived content")
	_expect(not unlock_service.is_weapon_unlocked(&"axe"), "deprecated Axe query cannot reactivate archived content")
	_expect(not unlock_service.is_feature_unlocked(&"second_reserve_soul"), "second reserve Soul is locked by default")
	_expect(not unlock_service.is_feature_unlocked(&"second_spirit"), "old second-Spirit gate is disabled")
	_expect(not unlock_service.is_feature_unlocked(&"soul_hero"), "Soul Hero core stays locked before the Level 5 recruitment")
	_expect(not unlock_service.is_feature_unlocked(&"soul_relay"), "Soul Relay stays locked before the Level 5 recruitment")
	_expect(save_service.get_value(["progression", "campaign", "level"], 0) == 1, "campaign starts at level 1")
	_expect(save_service.get_value(["soul_team", "active_hero"], "") == "sword_hero", "Sword Hero is the default active Hero")
	var default_reserves: Array = save_service.get_value(["soul_team", "reserve_souls"], [])
	_expect(default_reserves.size() == 2, "save reserves two future Soul positions architecturally")
	_expect(default_reserves == ["", ""], "both reserve positions start empty")
	_expect(save_service.get_value(["soul_team", "capacity"], 0) == 2, "Soul Team reserve capacity is explicit")
	var default_snapshot := save_service.get_snapshot()
	_expect(not default_snapshot.has("loadout"), "schema v2 has no obsolete weapon loadout")
	_expect(not (default_snapshot["progression"] as Dictionary).has("unlocked_weapons"), "schema v2 has no weapon ownership authority")
	_expect(bool(save_service.get_value(["tutorials", "soul_echo"], false)) == false, "approved Soul Echo tutorial flag exists")
	_expect(is_equal_approx(float(save_service.get_value(["settings", "music_volume"], -1.0)), 0.8), "audio settings have a safe default")
	_expect(is_equal_approx(float(save_service.get_value(["settings", "ui_scale"], -1.0)), 1.0), "display scale has a safe default")
	_expect(is_equal_approx(float(save_service.get_value(["settings", "joystick_opacity"], -1.0)), 0.7), "mobile controls have a safe default")
	_expect(save_service.get_value(["settings", "telegraph_palette"], "") == "standard", "accessibility palette has a safe default")

	var initial_revision := int(save_service.get_value(["revision"], -1))
	_expect(save_service.update_settings({
		"music_volume": 0.35,
		"fullscreen": true,
		"high_contrast": true,
		"ui_scale": 1.25,
		"joystick_opacity": 0.55,
		"joystick_size": 1.2,
		"button_scale": 1.15,
		"left_handed": true,
		"telegraph_palette": "colorblind",
	}), "valid settings patch commits atomically")
	_expect(save_service.get_value(["settings", "music_volume"], 0.0) == 0.35, "audio setting persists in memory")
	_expect(save_service.get_value(["settings", "fullscreen"], false), "display setting persists in memory")
	_expect(save_service.get_value(["settings", "left_handed"], false), "mobile layout setting persists in memory")
	_expect(save_service.get_value(["settings", "telegraph_palette"], "") == "colorblind", "accessibility setting persists in memory")
	_expect(int(save_service.get_value(["revision"], -1)) == initial_revision + 1, "one settings page update creates one revision")
	var settings_before_rejection: Dictionary = save_service.get_value(["settings"], {})
	_expect(not save_service.update_settings({"music_volume": 0.6, "unknown_setting": true}), "unknown settings key rejects the entire patch")
	_expect(save_service.get_value(["settings"], {}) == settings_before_rejection, "rejected settings patch applies no partial value")
	_expect(not save_service.update_settings({"ui_scale": 3.0}), "out-of-range settings value is rejected")
	_expect(not save_service.update_settings({"fullscreen": 1}), "wrong settings value type is rejected")
	_expect(not save_service.update_settings({"telegraph_palette": "infrared"}), "unsupported settings enum is rejected")
	_expect(save_service.update_settings({"music_volume": 0.35}), "no-op valid settings patch succeeds without a write")
	_expect(int(save_service.get_value(["revision"], -1)) == initial_revision + 1, "no-op settings patch does not create a revision")

	_expect(not unlock_service.unlock_campaign_hero(&"test_guardian", 5, "level5:test_guardian"), "future Hero reward is rejected before its campaign level")
	_expect(save_service.transact_once(
		"test:reach_level5",
		func(candidate: Dictionary) -> bool:
			candidate["progression"]["campaign"]["level"] = 5
			return true
	), "campaign progression reaches Level 5 through a durable transaction")
	_expect(not unlock_service.unlock_campaign_hero(&"test_guardian", 5, "level5:test_guardian"), "campaign level alone cannot authorize a Hero without an owned Soul")
	_expect(not unlock_service.is_hero_unlocked(&"test_guardian"), "level progression creates no Hero identity entitlement")

	var hero_signal_count := [0]
	unlock_service.hero_unlocked.connect(func(_hero_id: StringName) -> void: hero_signal_count[0] += 1)
	_expect(not unlock_service.unlock_hero(&"test_duelist", "test:hero_reward"), "identity-only Hero reward is rejected before Soul ownership")
	_expect(not unlock_service.is_hero_unlocked(&"test_duelist"), "rejected identity-only reward persists no Hero")
	_expect(hero_signal_count[0] == 0, "rejected identity-only reward emits no unlock signal")
	_expect(not save_service.is_transaction_applied("test:hero_reward"), "rejected identity-only reward writes no receipt")
	_expect(not unlock_service.unlock_hero(&"bow", "invalid:bow_hero"), "legacy Bow cannot be unlocked as a Hero")
	_expect(not unlock_service.unlock_campaign_hero(&"axe_hero", 5, "level5:axe_hero"), "Level 5 cannot recruit Axe without its future physical Hero Soul")
	_expect(not unlock_service.is_hero_unlocked(&"axe_hero"), "postponed Axe remains unowned under the canonical Hero ID")
	_expect(not unlock_service.unlock_hero(&"relay_test_dummy", "invalid:dummy"), "developer Relay dummy cannot enter progression")
	_expect(not unlock_service.unlock_weapon(&"bow", "invalid:legacy_bow"), "deprecated weapon reward writes are rejected")

	var one_reserve: Array[StringName] = [&"test_guardian"]
	_expect(not save_service.set_soul_team(&"sword_hero", one_reserve, "team:identity_without_soul"), "an unlocked identity is unusable until its Hero Soul is owned")
	var guardian_soul: Dictionary = SOUL_RULES.create_instance(&"test_guardian", SOUL_RULES.Rarity.RARE, 5, &"campaign", 51001)
	var duelist_soul: Dictionary = SOUL_RULES.create_instance(&"test_duelist", SOUL_RULES.Rarity.MAGIC, 5, &"quest", 51002)
	_expect(save_service.grant_hero_soul(guardian_soul, "soul:test_guardian"), "Guardian Hero Soul enters individual inventory")
	_expect(save_service.grant_hero_soul(duelist_soul, "soul:test_duelist"), "Duelist Hero Soul enters individual inventory")
	_expect(unlock_service.is_hero_unlocked(&"test_guardian") and unlock_service.is_hero_unlocked(&"test_duelist"), "Soul grants atomically establish their Hero identities")
	_expect(save_service.set_soul_team(&"sword_hero", one_reserve, "team:first_reserve"), "first unlocked reserve Hero can be saved")
	_expect(save_service.get_value(["soul_team", "reserve_souls"], [])[0] == "test_guardian", "first reserve Soul ID persists")
	var duplicate_active: Array[StringName] = [&"sword_hero"]
	_expect(not save_service.set_soul_team(&"sword_hero", duplicate_active, "team:duplicate"), "one Hero cannot occupy active and reserve roles")
	var two_reserves: Array[StringName] = [&"test_guardian", &"test_duelist"]
	_expect(not save_service.set_soul_team(&"sword_hero", two_reserves, "team:locked_second"), "locked second reserve cannot be populated")
	_expect(unlock_service.unlock_feature(&"second_reserve_soul", "feature:second_reserve"), "future second-reserve feature can be unlocked durably")
	_expect(save_service.set_soul_team(&"sword_hero", two_reserves, "team:two_reserves"), "unlocked second reserve can be saved without schema changes")
	_expect(save_service.get_value(["soul_team", "reserve_souls"], []) == ["test_guardian", "test_duelist"], "both reserve IDs persist in stable order")

	var reward_mutator := func(candidate: Dictionary) -> bool:
		var currencies: Dictionary = candidate.get("currencies", {}).duplicate(true)
		currencies["account"] = int(currencies.get("account", 0)) + 50
		candidate["currencies"] = currencies
		return true
	_expect(save_service.transact_once("results:test:clear:profile0", reward_mutator, {"level": 1}), "result reward commits once")
	_expect(not save_service.transact_once("results:test:clear:profile0", reward_mutator), "result reward cannot be paid twice")
	_expect(save_service.get_value(["currencies", "account"], 0) == 50, "duplicate reward does not duplicate currency")
	_expect(save_service.save_now(), "manual save rotates a known-good backup")

	var recovered_sources: Array[String] = []
	save_service.save_recovered.connect(func(source: String) -> void: recovered_sources.append(source))
	var corrupt_file := FileAccess.open(TEST_SAVE_PATH, FileAccess.WRITE)
	_expect(corrupt_file != null, "test can corrupt only its isolated primary")
	if corrupt_file != null:
		corrupt_file.store_string("{ definitely not valid json")
		corrupt_file.close()
	_expect(save_service.reload_save(), "corrupt primary recovers from backup")
	_expect(recovered_sources.has("backup"), "backup recovery emits its source")
	_expect(unlock_service.is_hero_unlocked(&"test_duelist"), "backup recovery preserves Hero unlock")
	_expect(save_service.get_value(["currencies", "account"], 0) == 50, "backup recovery preserves committed reward")

	_test_v1_migration(save_service, unlock_service)
	_test_v0_migration(save_service, unlock_service)

	_expect(save_service.update_settings({"music_volume": 0.2, "reduced_flashes": true, "joystick_size": 1.3}), "settings can be customized before progression reset")
	_expect(not save_service.reset_progression_keep_settings(save_service.RESET_ALL_TOKEN), "progression reset rejects the full-reset token")
	_expect(save_service.reset_progression_keep_settings(save_service.RESET_PROGRESSION_KEEP_SETTINGS_TOKEN), "confirmed progression reset commits")
	_expect(unlock_service.is_hero_unlocked(&"sword_hero"), "progression reset retains default Sword Hero")
	_expect(not unlock_service.is_hero_unlocked(&"test_duelist"), "progression reset removes non-default Hero unlocks")
	_expect(not unlock_service.is_feature_unlocked(&"second_reserve_soul"), "progression reset relocks future second reserve")
	_expect(save_service.get_value(["soul_team", "active_hero"], "") == "sword_hero", "progression reset restores default active Hero")
	_expect(save_service.get_value(["soul_team", "reserve_souls"], []) == ["", ""], "progression reset clears reserve Souls")
	_expect(save_service.get_value(["progression", "campaign", "level"], 0) == 1, "progression reset restores campaign position")
	_expect(save_service.get_value(["settings", "music_volume"], 0.0) == 0.2, "progression reset retains audio settings")
	_expect(save_service.get_value(["settings", "reduced_flashes"], false), "progression reset retains accessibility settings")
	_expect(save_service.get_value(["settings", "joystick_size"], 0.0) == 1.3, "progression reset retains mobile settings")
	_expect(save_service.reload_save(), "progression reset is durable")
	_expect(save_service.get_value(["settings", "music_volume"], 0.0) == 0.2, "retained settings survive reload")

	_remove_generations(TEST_SAVE_PATH)
	_finish()


func _test_v1_migration(save_service: LivingArsenalSaveService, unlock_service: LivingArsenalUnlockService) -> void:
	_remove_generations(TEST_SAVE_PATH)
	var v1_document := {
		"schema_version": 1,
		"revision": 12,
		"progression": {
			"campaign": {"chapter": 2, "level": 7, "unlocked_levels": ["chapter_1_level_1", "legacy_bonus"], "completed_levels": {"legacy_bonus": true}, "optional_objectives": {}},
			"unlocked_weapons": {"sword": true, "bow": true, "axe": true},
			"features": {"second_spirit": true, "hunt": true},
		},
		"tutorials": {"movement": true, "bow_reward": true, "weapon_swap": true},
		"loadout": {"hand_weapon": "axe", "spirit_slots": ["sword", "bow"]},
		"currencies": {"account": 77, "weapon_materials": 23, "monster_fragments": 4},
		"mastery": {"sword": 5, "bow": 9, "account_rank": 2},
		"inventory": {"weapons": ["bow", "axe"], "rarity_items": ["kept_item"], "favorites": [], "locked": []},
		"monster_parts": {"owned": {"bone": 3}, "equipped": {}},
		"mode_progress": {"hunt": {"wins": 2}, "challenge": {}, "depth": {}},
		"bestiary": {"discovered": ["skeleton"]},
		"settings": {"music_volume": 0.42, "damage_numbers": true},
		"applied_transactions": {"reward:keep": {"applied_at_unix": 1, "metadata": {"kind": "currency"}}},
	}
	_expect(_write_json(TEST_SAVE_PATH, v1_document), "schema-v1 migration fixture writes")
	var migration_events: Array[Array] = []
	var migration_callback := func(from_version: int, to_version: int, backup_path: String) -> void:
		migration_events.append([from_version, to_version, backup_path])
	save_service.save_migrated.connect(migration_callback)
	_expect(save_service.reload_save(), "schema v1 migrates to v2")
	if save_service.save_migrated.is_connected(migration_callback):
		save_service.save_migrated.disconnect(migration_callback)
	_expect(migration_events.size() == 1 and migration_events[0][0] == 1 and migration_events[0][1] == 2, "migration emits exact source and destination versions")
	_expect(migration_events.size() == 1 and migration_events[0][2] == MIGRATION_BACKUP_PATH, "migration reports the permanent backup path")
	_expect(FileAccess.file_exists(TEST_SAVE_PATH + ".bak"), "migration keeps an immediate rollback generation")
	_expect(FileAccess.file_exists(MIGRATION_BACKUP_PATH), "migration keeps a dedicated pre-v2 backup")
	_expect(_read_json_version(TEST_SAVE_PATH + ".bak") == 1, "rollback generation contains original schema v1 bytes")
	_expect(_read_json_version(MIGRATION_BACKUP_PATH) == 1, "dedicated migration backup contains original schema v1 bytes")
	_expect(_read_json_version(TEST_SAVE_PATH) == 2, "migrated primary is committed as schema v2")

	var snapshot := save_service.get_snapshot()
	var progression: Dictionary = snapshot["progression"]
	_expect(not snapshot.has("loadout"), "obsolete weapon loadout is removed from live save")
	_expect(not progression.has("unlocked_weapons"), "obsolete weapon ownership is removed from live progression")
	_expect(not (snapshot["inventory"] as Dictionary).has("weapons"), "weapon inventory is removed from live inventory")
	_expect(not (snapshot["currencies"] as Dictionary).has("weapon_materials"), "weapon currency key is removed from live currencies")
	_expect(snapshot["currencies"]["hero_materials"] == 23, "weapon materials value is preserved under neutral Hero ownership")
	_expect(snapshot["mastery"]["sword_hero"] == 5, "Sword mastery maps to Sword Hero")
	_expect(not (snapshot["mastery"] as Dictionary).has("bow") and not (snapshot["mastery"] as Dictionary).has("axe"), "Bow/Axe mastery is absent from runtime data")
	_expect(unlock_service.is_hero_unlocked(&"sword_hero"), "old Sword ownership maps to Sword Hero")
	_expect(not unlock_service.is_weapon_unlocked(&"bow") and not unlock_service.is_weapon_unlocked(&"axe"), "old Bow/Axe ownership never becomes runtime availability")
	_expect(unlock_service.was_legacy_weapon_owned(&"bow") and unlock_service.was_legacy_weapon_owned(&"axe"), "support audit can read archived Bow/Axe ownership")
	var audit: Dictionary = snapshot["legacy_audit"]
	_expect(audit["source_schema_version"] == 1, "legacy audit records schema-v1 origin")
	_expect(audit["weapon_loadout"]["hand_weapon"] == "axe", "legacy audit preserves invalidated Hand selection")
	_expect(audit["weapon_inventory"] == ["bow", "axe"], "legacy audit preserves old weapon inventory")
	_expect(audit["weapon_tutorials"]["bow_reward"] and audit["weapon_features"]["second_spirit"], "legacy tutorial/feature state is audit-only")
	_expect(not (snapshot["tutorials"] as Dictionary).has("bow_reward") and not (progression["features"] as Dictionary).has("second_spirit"), "legacy flags are absent from live systems")
	_expect(not unlock_service.is_feature_unlocked(&"second_reserve_soul"), "old second-Spirit unlock does not grant future second reserve")
	_expect(snapshot["soul_team"]["active_hero"] == "sword_hero" and snapshot["soul_team"]["reserve_souls"] == ["", ""], "obsolete loadout safely resets to Sword with empty reserves")
	_expect(progression["campaign"]["chapter"] == 2 and progression["campaign"]["level"] == 7, "campaign progression survives migration")
	_expect(progression["features"]["hunt"], "unrelated feature progression survives migration")
	_expect(snapshot["currencies"]["account"] == 77 and snapshot["currencies"]["monster_fragments"] == 4, "unrelated currencies survive migration")
	_expect(snapshot["settings"]["music_volume"] == 0.42 and snapshot["settings"]["damage_numbers"], "settings survive migration")
	_expect(snapshot["inventory"]["rarity_items"] == ["kept_item"], "unrelated inventory survives migration")
	_expect(snapshot["monster_parts"]["owned"]["bone"] == 3 and snapshot["mode_progress"]["hunt"]["wins"] == 2, "unrelated mode data survives migration")
	_expect(snapshot["bestiary"]["discovered"] == ["skeleton"], "bestiary survives migration")
	_expect(save_service.is_transaction_applied("reward:keep"), "duplicate-reward receipt survives migration")
	var account_before := int(snapshot["currencies"]["account"])
	_expect(not save_service.transact_once("reward:keep", func(_candidate: Dictionary) -> bool: return true), "migrated duplicate reward remains blocked")
	_expect(save_service.get_value(["currencies", "account"], 0) == account_before, "blocked migrated reward changes no currency")
	_expect(save_service.save_now(), "post-migration save commits normally")
	_expect(_read_json_version(MIGRATION_BACKUP_PATH) == 1, "normal commits never overwrite permanent pre-v2 backup")
	var permanent_recovery_sources: Array[String] = []
	var recovery_callback := func(source: String) -> void: permanent_recovery_sources.append(source)
	save_service.save_recovered.connect(recovery_callback)
	_expect(_write_raw(TEST_SAVE_PATH, "{ corrupt primary") and _write_raw(TEST_SAVE_PATH + ".bak", "{ corrupt rollback"), "test can corrupt both rotating generations in isolation")
	_expect(save_service.reload_save(), "permanent pre-v2 backup recovers when both rotating generations are corrupt")
	if save_service.save_recovered.is_connected(recovery_callback):
		save_service.save_recovered.disconnect(recovery_callback)
	_expect(permanent_recovery_sources.has("migration_backup"), "permanent migration recovery identifies its source")
	_expect(save_service.get_value(["progression", "campaign", "level"], 0) == 7, "permanent migration recovery restores preserved progression")


func _test_v0_migration(save_service: LivingArsenalSaveService, unlock_service: LivingArsenalUnlockService) -> void:
	_remove_generations(TEST_SAVE_PATH)
	var v0_document := {
		"version": 0,
		"weapons": ["sword", "bow"],
		"features": ["second_spirit"],
		"campaign_level": 4,
		"tutorial_flags": {"movement": true},
		"equipped": {"hand": "bow", "spirits": ["sword"]},
		"currencies": {"account": 19, "weapon_materials": 6},
		"settings": {"music_volume": 0.61},
	}
	_expect(_write_json(TEST_SAVE_PATH, v0_document), "schema-v0 migration fixture writes")
	_expect(save_service.reload_save(), "schema v0 migrates through v1 to v2")
	_expect(save_service.get_value(["schema_version"], 0) == save_service.CURRENT_SCHEMA_VERSION, "v0 migration stamps current version")
	_expect(unlock_service.is_hero_unlocked(&"sword_hero"), "v0 Sword ownership maps to Sword Hero")
	_expect(unlock_service.was_legacy_weapon_owned(&"bow"), "v0 Bow ownership remains audit-readable")
	_expect(not unlock_service.is_weapon_unlocked(&"bow"), "v0 Bow ownership is not runtime-usable")
	_expect(save_service.get_value(["progression", "campaign", "level"], 0) == 4, "v0 campaign level survives migration")
	_expect(save_service.get_value(["currencies", "account"], 0) == 19, "v0 unrelated currency survives migration")
	_expect(save_service.get_value(["currencies", "hero_materials"], 0) == 6, "v0 weapon materials map without value loss")
	_expect(save_service.get_value(["settings", "music_volume"], 0.0) == 0.61, "v0 settings survive migration")
	_expect(save_service.get_value(["legacy_audit", "source_schema_version"], -1) == 0, "legacy audit records original v0 origin")
	_expect(_read_json_version(MIGRATION_BACKUP_PATH, "version") == 0, "v0 pre-migration bytes are permanently backed up")


func _write_json(path: String, value: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value, "\t") + "\n")
	file.close()
	return true


func _write_raw(path: String, payload: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(payload)
	file.close()
	return true


func _read_json_version(path: String, key := "schema_version") -> int:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return -999
	var json := JSON.new()
	var payload := file.get_as_text()
	file.close()
	if json.parse(payload) != OK or not json.data is Dictionary:
		return -998
	return int((json.data as Dictionary).get(key, -997))


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)
		push_error("SAVE/UNLOCK FAIL: %s" % label)


func _finish() -> void:
	var report := {
		"checks": _checks,
		"failures": _failures,
		"passed": _checks - _failures.size(),
	}
	var report_file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report_file != null:
		report_file.store_string(JSON.stringify(report, "\t") + "\n")
		report_file.close()
	print("SAVE_UNLOCK_SMOKE %d/%d" % [_checks - _failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)


func _remove_generations(path: String) -> void:
	for candidate: String in [path, path + ".bak", path + ".tmp", path + ".pre_v2.bak"]:
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
