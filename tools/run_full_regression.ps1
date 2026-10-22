param(
    [switch]$SkipMcp
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

# Every child process inherits this isolated profile unless its focused runner
# deliberately selects an even narrower test save. This is the last safety net:
# a newly added runtime test can never write progression into the player's real
# user://soul_of_hero_save.json merely because its author forgot a wrapper.
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
$regressionSavePath = "user://tests/full_regression_$([guid]::NewGuid().ToString('N')).json"
$env:SOUL_OF_HERO_SAVE_PATH = $regressionSavePath
$env:LIVING_ARSENAL_SAVE_PATH = $regressionSavePath

$suiteScripts = @(
    "run_tests.ps1",
    "run_content_contract_tests.ps1",
    "validate_chapter_1_assets.ps1",
    "run_level_roster_tests.ps1",
	"run_campaign_progression_tests.ps1",
	"run_player_progression_tests.ps1",
	"run_core_stats_weapon_rarity_tests.ps1",
	"run_player_progression_save_tests.ps1",
	"run_progression_difficulty_tests.ps1",
	"run_encounter_pack_trap_tests.ps1",
	"run_combat_resolver_tests.ps1",
	"run_enemy_outgoing_damage_tests.ps1",
	"run_combat_balance_model_tests.ps1",
	"run_chapter_1_balance_matrix_tests.ps1",
	"run_hero_skill_combat_tests.ps1",
	"run_level_one_tutorial_learning_tests.ps1",
	"run_mana_meta_core_tests.ps1",
	"run_hero_soul_instance_live_tests.ps1",
	"run_campaign_reward_tests.ps1",
	"run_campaign_entitlement_hardening_tests.ps1",
	"run_visible_progression_reward_runtime_test.ps1",
	"run_fresh_player_loop_acceptance_test.ps1",
	"run_level_5_archer_pickup_tests.ps1",
	"run_archer_soul_codex_tests.ps1",
	"run_archer_hero_combat_tests.ps1",
	"run_hero_ultimate_runtime_tests.ps1",
	"run_hero_health_pool_runtime_tests.ps1",
	"run_freed_reference_crash_regression_tests.ps1",
	"run_already_playable_qa.ps1",
    "run_auxiliary_equipment_tests.ps1",
	"run_auxiliary_equipment_save_tests.ps1",
	"run_auxiliary_equipment_upgrade_migration_tests.ps1",
	"run_auxiliary_equipment_combat_tests.ps1",
	"run_realtime_loot_tests.ps1",
	"run_chest_visual_tests.ps1",
	"run_health_potion_loot_tests.ps1",
	"run_inventory_drop_contract_tests.ps1",
	"run_gameplay_click_auto_pickup_tests.ps1",
	"run_monster_soul_tests.ps1",
	"run_save_compatibility_regression_tests.ps1",
	"run_meta_progression_ui_tests.ps1",
	"run_hero_roster_responsive_tests.ps1",
	"run_hero_aware_hud_runtime_test.ps1",
	"run_continuous_hud_ui_tests.ps1",
	"run_startup_profile_choice_test.ps1",
	"run_ui_asset_backed_contract_tests.ps1",
	"run_vietnamese_gameplay_copy_contract_tests.ps1",
    "run_save_unlock_tests.ps1",
    "run_enemy_tests.ps1",
    "run_vfx_tests.ps1",
    "run_ui_shell_tests.ps1",
	"run_campaign_entry_runtime_smoke.ps1",
    "run_ui_designer_tests.ps1",
    "run_map_authoring_tests.ps1",
	"run_chapter_1_map_design_tests.ps1",
	"run_chapter_1_level_5_miniboss_tests.ps1",
	"run_chapter_1_level_6_tests.ps1",
	"run_chapter_1_level_6_promotion_route_test.ps1",
	"run_chapter_1_level_7_tests.ps1",
	"run_chapter_1_level_7_promotion_route_test.ps1",
	"run_chapter_1_level_8_tests.ps1",
	"run_chapter_1_level_9_tests.ps1",
	"run_chapter_1_level_10_tests.ps1",
    "run_active_level_routing_tests.ps1",
    "run_axe_tests.ps1",
	"run_axe_soul_team_runtime_test.ps1",
    "run_soul_tests.ps1",
    "run_combat_feedback_tests.ps1"
)

try {
	foreach ($scriptName in $suiteScripts) {
		$scriptPath = Join-Path $PSScriptRoot $scriptName
		Write-Output "[RUN] $scriptName"
		& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath
		if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
	}

	Write-Output "[RUN] input_map_test.gd"
	& $godot --headless --path $root --script "res://tests/input_map_test.gd"
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

	if (-not $SkipMcp) {
		Write-Output "[RUN] run_mcp_tests.ps1"
		& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run_mcp_tests.ps1")
		if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
	}

	if ($SkipMcp) {
		$mcpState = "MCP skipped"
	} else {
		$mcpState = "MCP lifecycle/bidirectional/reconnect passed"
	}
	Write-Output "SOUL OF HERO REGRESSION PASSED: all configured non-MCP suites; $mcpState."
}
finally {
	if ($null -eq $previousPrimarySavePath) {
		Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue
	} else {
		$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	}
	if ($null -eq $previousLegacySavePath) {
		Remove-Item Env:LIVING_ARSENAL_SAVE_PATH -ErrorAction SilentlyContinue
	} else {
		$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
	}
}
