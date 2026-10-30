extends CanvasLayer

const UI_THEME: Theme = preload("res://game/ui/theme/living_arsenal_theme.tres")
const PROGRESSION_FOCUS_HUD_SCENE: PackedScene = preload("res://game/ui/progression_focus_hud.tscn")
const FIELD_CODEX_SCENE: PackedScene = preload("res://game/ui/field_codex.tscn")
const COMPLETION_CHOICE_SCENE: PackedScene = preload("res://game/ui/completion_choice.tscn")
const OBJECTIVE_OPEN := "CỔNG ĐÃ MỞ  •  Tới lối thoát"
const OBJECTIVE_DONE := "HOÀN THÀNH  •  Đã thoát khỏi tàn tích"
const MOBILE_CONTROL_RECTS := {
	"LightAttackButton": Rect2(520.0, 276.0, 52.0, 44.0),
	"HeavyAttackButton": Rect2(578.0, 276.0, 52.0, 44.0),
	"JumpButton": Rect2(578.0, 226.0, 52.0, 44.0),
	"InteractButton": Rect2(520.0, 226.0, 52.0, 44.0),
	"DashButton": Rect2(549.0, 326.0, 52.0, 30.0),
	"UltimateButton": Rect2(462.0, 276.0, 52.0, 44.0),
}

@onready var hud_root: Control = %HUDRoot
@onready var health_bar: ProgressBar = %HealthBar
@onready var health_value: Label = %HealthValue
@onready var stamina_bar: ProgressBar = %StaminaBar
@onready var stamina_value: Label = %StaminaValue
@onready var mana_bar: ProgressBar = %ManaBar
@onready var mana_value: Label = %ManaValue
@onready var ultimate_status: Label = %UltimateStatus
@onready var objective_label: Label = %ObjectiveLabel
@onready var score_label: Label = %ScoreLabel
@onready var sigil_label: Label = %SigilLabel
@onready var sync_label: Label = %SyncLabel
@onready var sync_detail_label: Label = %SyncDetailLabel
@onready var top_right_panel: PanelContainer = %TopRightPanel
@onready var toast_panel: MarginContainer = %ToastPanel
@onready var toast_prompt: TextureRect = %Prompt
@onready var toast_label: Label = %ToastLabel
@onready var weapon_panel: MarginContainer = %WeaponPanel
@onready var hand_weapon_label: Label = %HandLabel
@onready var hand_weapon_status: Label = %HandStatus
@onready var spirit_weapon_label: Label = %SpiritLabel
@onready var spirit_weapon_status: Label = %SpiritStatus
@onready var action_deck: HBoxContainer = %ActionDeck
@onready var attack_slot: PanelContainer = %AttackSlot
@onready var attack_slot_status: Label = %AttackSlotStatus
@onready var skill_slot: PanelContainer = %SkillSlot
@onready var skill_slot_status: Label = %SkillSlotStatus
@onready var relay_slot: PanelContainer = %RelaySlot
@onready var relay_slot_status: Label = %RelaySlotStatus
@onready var virtual_controls: Control = %VirtualControls
@onready var spirit_button: Button = %JumpButton
@onready var keyboard_hint: Label = %KeyboardHint
@onready var attack_button: Button = %LightAttackButton
@onready var skill_button: Button = %HeavyAttackButton
@onready var dash_button: Button = %DashButton
@onready var interact_button: Button = %InteractButton
@onready var ultimate_button: Button = %UltimateButton
@onready var virtual_joystick: Control = %VirtualJoystick
@onready var dpad: Control = %DPad
@onready var pause_button: Button = %PauseButton
@onready var pause_overlay: Control = %PauseOverlay
@onready var death_overlay: Control = %DeathOverlay
@onready var win_overlay: Control = %WinOverlay
@onready var pause_resume_button: Button = %ResumeButton
@onready var pause_restart_button: Button = %PauseRestartButton
@onready var pause_hub_button: Button = %PauseHubButton
@onready var death_respawn_button: Button = %RespawnButton
@onready var death_restart_button: Button = %DeathRestartButton
@onready var death_loadout_button: Button = %DeathLoadoutButton
@onready var win_continue_button: Button = %ContinueButton
@onready var win_restart_button: Button = %WinRestartButton

var _toast_tween: Tween
var _sync_poll_left := 0.0
var _last_sync_connected := false
var _last_sync_detail := ""
var _virtual_controls_enabled := false
var _hero_poll_left := 0.0
var _player: Node
var _hero_manager: HeroSoulManager
var _current_sigils := 0
var _required_sigils := 1
var _encounter_enemy_defeated := 0
var _encounter_enemy_total := 0
var _encounter_cleared := true
var _progression_focus_hud: ProgressionFocusHud
var _field_codex: FieldCodex
var _completion_choice: CompletionChoice


func _ready() -> void:
	# Paused overlays still receive GUI input. Register their effective
	# visibility so presses remain suppressed until release after resume.
	pause_overlay.add_to_group(&"gameplay_modal")
	death_overlay.add_to_group(&"gameplay_modal")
	win_overlay.add_to_group(&"gameplay_modal")
	_virtual_controls_enabled = _should_enable_virtual_controls()
	keyboard_hint.visible = not _virtual_controls_enabled
	# Combo/weapon state remains available to mobile action buttons and combat
	# feedback, but no longer occupies a permanent strip below gameplay.
	weapon_panel.hide()
	_set_virtual_controls_visible(true)
	_configure_touch_labels()
	_configure_desktop_hud()
	_apply_saved_mobile_layout()
	_apply_pixel_theme()
	_install_continuous_progression_ui()
	_connect_game_events()
	_connect_buttons()
	_sync_session_state()
	sigil_label.hide()
	_poll_live_sync(true)
	toast_panel.hide()
	pause_overlay.hide()
	death_overlay.hide()
	death_respawn_button.hide()
	win_overlay.hide()
	_sync_product_flow_buttons()


func _process(delta: float) -> void:
	_sync_poll_left -= delta
	if _sync_poll_left <= 0.0:
		_sync_poll_left = 1.0
		_poll_live_sync(false)
	_hero_poll_left -= delta
	if _hero_poll_left <= 0.0:
		_hero_poll_left = 0.08
		_sync_hero_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"field_codex") and not event.is_echo():
		_toggle_field_codex()
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed(&"pause") and not event.is_echo():
		if is_instance_valid(_completion_choice) and _completion_choice.visible:
			get_viewport().set_input_as_handled()
			return
		if is_instance_valid(_field_codex) and _field_codex.is_open():
			_field_codex.hide_codex()
			get_viewport().set_input_as_handled()
			return
		if not death_overlay.visible and not win_overlay.visible:
			_set_paused(not get_tree().paused)
		get_viewport().set_input_as_handled()


func _install_continuous_progression_ui() -> void:
	_progression_focus_hud = PROGRESSION_FOCUS_HUD_SCENE.instantiate() as ProgressionFocusHud
	_field_codex = FIELD_CODEX_SCENE.instantiate() as FieldCodex
	_completion_choice = COMPLETION_CHOICE_SCENE.instantiate() as CompletionChoice
	if _progression_focus_hud != null:
		hud_root.add_child(_progression_focus_hud)
		hud_root.move_child(_progression_focus_hud, pause_overlay.get_index())
		_progression_focus_hud.codex_requested.connect(_toggle_field_codex)
	if _field_codex != null:
		hud_root.add_child(_field_codex)
		hud_root.move_child(_field_codex, pause_overlay.get_index())
		_field_codex.closed.connect(_on_field_codex_closed)
	if _completion_choice != null:
		_completion_choice.add_to_group(&"gameplay_modal")
		hud_root.add_child(_completion_choice)
		hud_root.move_child(_completion_choice, pause_overlay.get_index())
	# The permanent XP strip owns the bottom edge. The remaining raw weapon
	# state sits just above it; the old four-card desktop action deck is hidden.
	weapon_panel.offset_top = -48.0
	weapon_panel.offset_bottom = -28.0
	toast_panel.offset_top = 85.0
	toast_panel.offset_bottom = 114.0
	keyboard_hint.text = "RMB: ưu tiên mục tiêu  •  LMB/J: đánh tự chọn  •  E: kỹ năng  •  F: lướt  •  R: tuyệt kỹ  •  I/Tab: tủ đồ"


func _toggle_field_codex() -> void:
	if not is_instance_valid(_field_codex) or death_overlay.visible or win_overlay.visible or pause_overlay.visible \
		or (is_instance_valid(_completion_choice) and _completion_choice.visible):
		return
	_field_codex.toggle()
	# Codex commits equipment/upgrades during combat. Only touch controls hide so
	# panel clicks cannot leak into movement; the world clock keeps advancing.
	_set_virtual_controls_visible(not _field_codex.is_open())


func _on_field_codex_closed() -> void:
	if not get_tree().paused and not death_overlay.visible and not win_overlay.visible:
		_set_virtual_controls_visible(true)


func _connect_game_events() -> void:
	GameEvents.player_registered.connect(_on_player_registered)
	GameEvents.player_health_changed.connect(_on_health_changed)
	GameEvents.hero_health_pools_changed.connect(_on_hero_health_pools_changed)
	GameEvents.player_mana_changed.connect(_on_mana_changed)
	GameEvents.score_changed.connect(_on_score_changed)
	GameEvents.sigil_collected.connect(_on_sigil_collected)
	GameEvents.encounter_objective_changed.connect(_on_encounter_objective_changed)
	GameEvents.objective_completed.connect(_on_objective_completed)
	GameEvents.player_died.connect(_on_player_died)
	GameEvents.player_respawned.connect(_on_player_respawned)
	GameEvents.toast_requested.connect(_show_toast)
	GameEvents.live_sync_status_changed.connect(_on_live_sync_status_changed)


func _connect_buttons() -> void:
	pause_button.pressed.connect(_on_pause_pressed)
	pause_resume_button.pressed.connect(_on_resume_pressed)
	pause_restart_button.pressed.connect(_restart_run)
	pause_hub_button.pressed.connect(_on_exit_to_hub_pressed.bind(&""))
	death_restart_button.pressed.connect(_restart_run)
	death_loadout_button.pressed.connect(_on_exit_to_hub_pressed.bind(&"hero_roster"))
	win_continue_button.pressed.connect(_on_continue_pressed)
	win_restart_button.pressed.connect(_restart_run)


func _sync_session_state() -> void:
	_on_score_changed(GameSession.score)
	_on_sigil_collected(GameSession.sigils, GameSession.required_sigils)
	_on_encounter_objective_changed(
		GameSession.encounter_enemy_defeated,
		GameSession.encounter_enemy_total,
		GameSession.encounter_objective_cleared,
	)
	if GameSession.objective_finished:
		objective_label.text = OBJECTIVE_DONE


func _on_player_registered(player: Node) -> void:
	# AppRoot keeps the outgoing route queued for deletion while the next Main
	# initializes. Ignore that stale signal after this HUD has left the tree;
	# child HUD refresh methods require active-SceneTree service lookups.
	if not is_inside_tree():
		return
	_player = player
	if is_instance_valid(_progression_focus_hud):
		_progression_focus_hud.set_player(player)
	if is_instance_valid(_field_codex):
		_field_codex.set_player(player)
	_hero_manager = null
	if player.has_method(&"get_hero_soul_manager"):
		_hero_manager = player.call(&"get_hero_soul_manager") as HeroSoulManager
	var maximum_health := int(round(_numeric_property(player, [&"max_health", &"health_max"], 100.0)))
	var current_health := int(round(_numeric_property(player, [&"health", &"current_health"], float(maximum_health))))
	var maximum_mana := _numeric_property(player, [&"max_mana", &"mana_max"], 100.0)
	var current_mana := _numeric_property(player, [&"mana", &"current_mana"], maximum_mana)
	_on_health_changed(current_health, maximum_health)
	if player.has_method(&"get_hero_health_snapshot"):
		_on_hero_health_pools_changed(player.call(&"get_hero_health_snapshot"))
	_on_mana_changed(current_mana, maximum_mana)
	_sync_hero_hud()


func _sync_hero_hud() -> void:
	if is_instance_valid(_player) and _player.has_method(&"get_hero_health_snapshot"):
		_on_hero_health_pools_changed(_player.call(&"get_hero_health_snapshot"))
	if not is_instance_valid(_hero_manager) or not is_instance_valid(_player):
		_set_wizard_context_panel(false)
		hand_weapon_label.text = "KIẾM SĨ  •  ĐANG KẾT NỐI"
		hand_weapon_status.text = "Đang đồng bộ nhân vật chủ lực"
		spirit_weapon_label.text = "CẶP HERO  •  DỰ BỊ TRỐNG"
		attack_slot_status.text = "ĐÁNH\n—"
		skill_slot_status.text = "KỸ NĂNG\n—"
		relay_slot_status.text = "CHUYỂN HỒN\n—"
		skill_button.disabled = true
		spirit_button.disabled = true
		if _virtual_controls_enabled:
			attack_button.text = "ĐÁNH\n—"
			skill_button.text = "KỸ NĂNG\n—"
			ultimate_button.text = "R\n—"
		ultimate_button.disabled = true
		ultimate_status.text = "R  •  TUYỆT KỸ  •  —"
		return
	var snapshot := _hero_manager.get_state_snapshot()
	var active_name := "KIẾM SĨ"
	var active_hero := _hero_manager.active_hero
	var wizard_active := active_hero != null and active_hero.hero_id == &"wizard_hero"
	if active_hero != null:
		active_name = _hero_name_copy(String(active_hero.hero_id), active_hero.display_name)
	_sync_active_hero_actions(active_hero, active_name)
	_sync_ultimate(active_hero)
	attack_slot.modulate = Color.WHITE
	skill_slot.modulate = Color(0.58, 0.58, 0.62, 0.9) if skill_button.disabled else Color(0.78, 0.94, 1.0, 1.0)
	var reserve_name := "TRỐNG"
	var wizard_reserve := false
	if _hero_manager.reserve_soul != null:
		reserve_name = _hero_name_copy(String(_hero_manager.reserve_soul.hero_id), _hero_manager.reserve_soul.display_name)
		wizard_reserve = _hero_manager.reserve_soul.hero_id == &"wizard_hero"
	_set_wizard_context_panel(wizard_active or wizard_reserve)
	var state_name := String(snapshot.get("state", "idle")).to_upper()
	var readiness := "%d/%d" % [int(snapshot.get("readiness", 0)), int(snapshot.get("readiness_required", 0))]
	if reserve_name == "TRỐNG":
		spirit_weapon_label.text = "CẶP HERO  •  DỰ BỊ TRỐNG"
		spirit_weapon_status.text = "Một nhân vật mở khóa về sau có thể dùng ô này"
		relay_slot_status.text = "CHUYỂN HỒN\nTRỐNG"
		relay_slot.modulate = Color(0.48, 0.48, 0.52, 0.85)
		spirit_button.disabled = true
	else:
		var takeover_open := bool(snapshot.get("takeover_open", false))
		var soul_armed := bool(snapshot.get("soul_skill_armed", false))
		var reserve_is_k_night := String(snapshot.get("reserve_soul", "")) == "sword_hero"
		var relay_hint := (
			(
				"Q TRIỆU HỒN"
				if reserve_is_k_night
				else ("LMB XÁC NHẬN SOUL" if soul_armed else "Q GÀI SOUL")
			)
			if state_name == "READY"
			else ("Q CHUYỂN HỒN" if takeover_open else _relay_state_copy(state_name))
		)
		spirit_weapon_label.text = "HERO DỰ BỊ  •  %s  •  %s  •  %s" % [reserve_name, readiness, relay_hint]
		spirit_weapon_status.text = _wizard_reserve_status(snapshot, relay_hint) if wizard_reserve else "CHUYỂN HỒN  •  %s" % relay_hint
		relay_slot_status.text = "CHUYỂN HỒN\n%s" % ("SẴN SÀNG" if state_name == "READY" or takeover_open else readiness)
		relay_slot.modulate = Color(0.78, 0.94, 1.0, 1.0) if state_name == "READY" or takeover_open else Color(0.58, 0.58, 0.62, 0.9)
		spirit_button.disabled = state_name != "READY" and not takeover_open


func _sync_active_hero_actions(active_hero: HeroDefinition, active_name: String) -> void:
	if active_hero == null:
		hand_weapon_label.text = "NHÂN VẬT  •  CHƯA SẴN SÀNG"
		hand_weapon_status.text = "Không có nhân vật chủ lực"
		attack_slot_status.text = "ĐÁNH\n—"
		skill_slot_status.text = "KỸ NĂNG\n—"
		skill_button.disabled = true
		if _virtual_controls_enabled:
			attack_button.text = "ĐÁNH\n—"
			skill_button.text = "KỸ NĂNG\n—"
		return

	match active_hero.hero_id:
		&"axe_hero":
			_sync_axe_actions(active_name)
		&"archer_hero":
			_sync_archer_actions(active_name)
		&"wizard_hero":
			_sync_wizard_actions(active_name)
		&"sword_hero":
			_sync_sword_actions(active_hero, active_name)
		_:
			hand_weapon_label.text = active_name
			hand_weapon_status.text = active_hero.resolved_active_skill_name().to_upper()
			attack_slot_status.text = "ĐÁNH\nSẴN"
			skill_slot_status.text = "KỸ NĂNG\nSẴN"
			skill_button.disabled = not active_hero.active_skill_enabled
			if _virtual_controls_enabled:
				attack_button.text = "ĐÁNH\nSẴN"
				skill_button.text = "KỸ NĂNG\nSẴN"


func _sync_sword_actions(active_hero: HeroDefinition, active_name: String) -> void:
	var profile := _active_hero_skill_profile(&"active_1")
	var skill_name := String(
		profile.get("name", active_hero.resolved_active_skill_name())
	).to_upper()
	var echo_cooldown := _active_hero_skill_cooldown(&"active_1")
	var echo_text := _cooldown_text(echo_cooldown)
	var mana_copy := _active_skill_mana_copy(false)
	var echo_active := false
	var combo_count := maxi(1, active_hero.combo_step_count())
	var combo_step := 1
	if _player.has_method(&"get_realtime_state"):
		var runtime_state: Dictionary = _player.call(&"get_realtime_state")
		var hero_state: Dictionary = runtime_state.get("hero", {})
		combo_step = clampi(int(hero_state.get("combo_next_step", 1)), 1, combo_count)
		echo_active = bool(hero_state.get("soul_echo_active", false))
	hand_weapon_label.text = "%s • NHỊP %d/%d" % [active_name, combo_step, combo_count]
	hand_weapon_status.text = (
		"%s  •  ĐANG HIỆU LỰC" % skill_name
		if echo_active
		else "%s  •  %s  •  %s" % [skill_name, echo_text, mana_copy]
	)
	var active_cost := 0.0
	if _player.has_method(&"get_active_skill_mana_cost"):
		active_cost = float(_player.call(&"get_active_skill_mana_cost"))
	var current_mana := _numeric_property(_player, [&"mana", &"current_mana"], 0.0)
	skill_button.disabled = (
		echo_active
		or echo_cooldown > 0.01
		or current_mana + 0.001 < active_cost
		or not active_hero.active_skill_enabled
	)
	attack_slot_status.text = "ĐÁNH\n%d/%d" % [combo_step, combo_count]
	var skill_copy := "ĐANG CHẠY" if echo_active else (mana_copy if echo_cooldown <= 0.01 else echo_text)
	skill_slot_status.text = "%s\n%s" % [skill_name, skill_copy]
	if _virtual_controls_enabled:
		attack_button.text = "ĐÁNH\n%d/%d" % [combo_step, combo_count]
		skill_button.text = "E\n%s" % skill_name


func _sync_ultimate(active_hero: HeroDefinition) -> void:
	var profile := _active_hero_skill_profile(&"active_2")
	if active_hero == null or (
			profile.is_empty() and active_hero.ultimate_behavior_id == &""
	):
		ultimate_status.text = "R  •  TUYỆT KỸ  •  —"
		ultimate_button.text = "R\n—"
		ultimate_button.disabled = true
		return
	var cooldown := _active_hero_skill_cooldown(&"active_2")
	if _player.has_method(&"get_ultimate_cooldown_remaining"):
		cooldown = maxf(
			cooldown,
			float(_player.call(&"get_ultimate_cooldown_remaining")),
		)
	var cost := maxf(0.0, active_hero.ultimate_mana_cost)
	if _player.has_method(&"get_ultimate_mana_cost"):
		cost = float(_player.call(&"get_ultimate_mana_cost"))
	var current_mana := _numeric_property(_player, [&"mana", &"current_mana"], 0.0)
	var skill_name := String(
		profile.get("name", active_hero.ultimate_name)
	).to_upper()
	var state_copy := _cooldown_text(cooldown)
	if active_hero.hero_id == &"archer_hero" and _player.has_method(&"is_archer_infinite_arrows_active") \
			and bool(_player.call(&"is_archer_infinite_arrows_active")):
		state_copy = "ĐANG BẬT"
	elif active_hero.hero_id == &"wizard_hero" and bool(_wizard_runtime_state().get("raise_defeated_active", false)):
		state_copy = "ĐANG TRIỆU HỒI"
	ultimate_status.text = "R  •  %s  •  %s  •  %d MP" % [
		skill_name,
		state_copy,
		ceili(cost),
	]
	ultimate_button.text = "R\n%s" % ("%.1fs" % cooldown if cooldown > 0.01 else skill_name)
	ultimate_button.disabled = cooldown > 0.01 or current_mana + 0.001 < cost


func _active_hero_skill_profile(slot: StringName) -> Dictionary:
	if not is_instance_valid(_player) \
			or not _player.has_method(&"get_active_hero_skill_profile"):
		return {}
	var value: Variant = _player.call(&"get_active_hero_skill_profile", slot)
	return (value as Dictionary).duplicate(true) if value is Dictionary else {}


func _active_hero_skill_cooldown(slot: StringName) -> float:
	if not is_instance_valid(_player) \
			or not _player.has_method(&"get_active_hero_skill_cooldown_remaining"):
		return 0.0
	return maxf(
		0.0,
		float(_player.call(&"get_active_hero_skill_cooldown_remaining", slot)),
	)


func _sync_axe_actions(active_name: String) -> void:
	var charge_ratio := 0.0
	if _player.has_method(&"get_axe_charge_ratio"):
		charge_ratio = clampf(float(_player.call(&"get_axe_charge_ratio")), 0.0, 1.0)
	var charge_percent := clampi(roundi(charge_ratio * 100.0), 0, 100)
	var axe_away := _player.has_method(&"is_axe_away") and bool(_player.call(&"is_axe_away"))
	var skill_cooldown := _hand_skill_cooldown(&"axe")
	var skill_action := "THU HỒI" if axe_away else "NÉM"
	var skill_state := "SẴN SÀNG" if axe_away else _cooldown_text(skill_cooldown)
	var mana_copy := _active_skill_mana_copy(axe_away)

	hand_weapon_label.text = "%s • TỤ LỰC %d%%" % [active_name, charge_percent]
	hand_weapon_status.text = "%s • %s • %s" % ["THU HỒI" if axe_away else "NÉM / THU HỒI", skill_state, mana_copy]
	attack_slot_status.text = "TỤ LỰC\n%d%%" % charge_percent
	skill_slot_status.text = "%s\n%s" % [skill_action, mana_copy if axe_away or skill_cooldown <= 0.01 else skill_state]
	# Recall is a second press of the same skill and intentionally remains
	# available while the throw cooldown is running.
	skill_button.disabled = not axe_away and skill_cooldown > 0.01
	if _virtual_controls_enabled:
		attack_button.text = "TỤ LỰC\n%d%%" % charge_percent
		skill_button.text = "%s\n%s" % [skill_action, mana_copy if axe_away or skill_cooldown <= 0.01 else skill_state]


func _sync_archer_actions(active_name: String) -> void:
	var focus := 0
	var focus_max := 2
	var mark_active := false
	var combo_step := 1
	if _player.has_method(&"get_realtime_state"):
		var runtime_state: Dictionary = _player.call(&"get_realtime_state")
		var hero_state: Dictionary = runtime_state.get("hero", {})
		focus = int(hero_state.get("archer_focus", 0))
		focus_max = int(hero_state.get("archer_focus_maximum", 2))
		mark_active = bool(hero_state.get("archer_mark_active", false))
		combo_step = int(hero_state.get("archer_combo_step", 1))
	var skill_cooldown := _hand_skill_cooldown(&"bow")
	var skill_state := "ĐÃ ĐÁNH DẤU" if mark_active else _cooldown_text(skill_cooldown)
	var mana_copy := _active_skill_mana_copy(false)
	hand_weapon_label.text = "%s • TẬP TRUNG %d/%d" % [active_name, focus, focus_max]
	hand_weapon_status.text = "BẮN %d/3 • DẤU ẤN %s" % [combo_step, skill_state]
	attack_slot_status.text = "BẮN %d\nTẬP TRUNG %d/%d" % [combo_step, focus, focus_max]
	skill_slot_status.text = "DẤU ẤN\n%s" % (mana_copy if skill_cooldown <= 0.01 else skill_state)
	skill_button.disabled = skill_cooldown > 0.01
	if _virtual_controls_enabled:
		attack_button.text = "BẮN %d\nT%d/%d" % [combo_step, focus, focus_max]
		skill_button.text = "DẤU ẤN\n%s" % (mana_copy if skill_cooldown <= 0.01 else skill_state)


func _sync_wizard_actions(active_name: String) -> void:
	var wizard := _wizard_runtime_state()
	var shade_count := int(wizard.get("shade_count", 0))
	var point_count := int(wizard.get("dark_point_count", 0))
	var stacks_left := int(wizard.get("rmb_stacks_left", 0))
	var internal_left := float(wizard.get("rmb_internal_left", 0.0))
	var window_left := float(wizard.get("rmb_window_left", 0.0))
	var cooldown := _hand_skill_cooldown(&"wizard_staff")
	var passage_copy := _cooldown_text(cooldown)
	if stacks_left > 0:
		passage_copy = "%d/3 • %.1fs" % [stacks_left, window_left] if internal_left <= 0.01 else "KHÓA %.1fs" % internal_left
	var mana_copy := _active_skill_mana_copy(false)
	hand_weapon_label.text = "%s • BÓNG MA %d/4" % [active_name, shade_count]
	hand_weapon_status.text = "DARK POINT %d • %s" % [point_count, passage_copy]
	attack_slot_status.text = "BÓNG MA\n%d/4" % shade_count
	skill_slot_status.text = "PASSAGE\n%s" % (mana_copy if stacks_left <= 0 and cooldown <= 0.01 else passage_copy)
	skill_button.disabled = (stacks_left <= 0 and (point_count <= 0 or cooldown > 0.01)) or (stacks_left > 0 and internal_left > 0.01)
	if _virtual_controls_enabled:
		attack_button.text = "BÓNG MA\n%d/4" % shade_count
		skill_button.text = "PASSAGE\n%s" % (mana_copy if stacks_left <= 0 and cooldown <= 0.01 else passage_copy)


func _wizard_runtime_state() -> Dictionary:
	if not is_instance_valid(_player) or not _player.has_method(&"get_realtime_state"):
		return {}
	var runtime_state: Dictionary = _player.call(&"get_realtime_state")
	var hero_state: Dictionary = runtime_state.get("hero", {})
	return hero_state.get("wizard", {}) as Dictionary


func _wizard_reserve_status(relay_snapshot: Dictionary, relay_hint: String) -> String:
	var wizard := _wizard_runtime_state()
	var icons := int(wizard.get("soul_icons", 0))
	var maximum := int(wizard.get("soul_icon_max", 5))
	var anchor_seconds := float(wizard.get("soul_anchor_seconds", 0.0))
	if bool(wizard.get("soul_anchor_active", false)):
		return "HẮC %d/%d • NEO %.1fs • LƯỚT QUAY LẠI" % [icons, maximum, anchor_seconds]
	if String(relay_snapshot.get("state", "")).to_upper() == "SUMMONING":
		return "SOUL REVERSAL • %s" % relay_hint
	return "HẮC %d/%d • LƯỚT TẠO NEO" % [icons, maximum]


func _set_wizard_context_panel(visible: bool) -> void:
	# Sword, Archer and Axe keep the intentionally minimal HUD. Wizard alone
	# exposes this compact strip because its Dark Point / anchor loop cannot be
	# understood from a one-shot toast.
	weapon_panel.visible = visible
	hand_weapon_status.visible = visible
	spirit_weapon_label.visible = visible
	spirit_weapon_status.visible = visible
	action_deck.visible = visible


func _active_skill_mana_copy(free_action: bool) -> String:
	if free_action:
		return "MIỄN PHÍ"
	var cost := 0.0
	if _player.has_method(&"get_active_skill_mana_cost"):
		cost = float(_player.call(&"get_active_skill_mana_cost"))
	var current := _numeric_property(_player, [&"mana", &"current_mana"], 0.0)
	if current + 0.001 < cost:
		return "THIẾU MANA %d/%d" % [floori(current), ceili(cost)]
	return "%d MANA" % ceili(cost)


func _hand_skill_cooldown(weapon_id: StringName) -> float:
	if not _player.has_method(&"get_weapon_manager"):
		return 0.0
	var manager := _player.call(&"get_weapon_manager") as WeaponManager
	if not is_instance_valid(manager):
		return 0.0
	return maxf(0.0, manager.get_hand_skill_cooldown_remaining(weapon_id))


func _cooldown_text(seconds: float) -> String:
	return "SẴN SÀNG" if seconds <= 0.01 else "%.1fs" % seconds


func _hero_name_copy(hero_id: String, fallback: String) -> String:
	match hero_id:
		"sword_hero":
			return "K-NIGHT"
		"archer_hero":
			return "CUNG THỦ"
		"axe_hero":
			return "CHIẾN BINH RÌU"
		"wizard_hero":
			return "PHÁP SƯ"
	return fallback.to_upper()


func _relay_state_copy(state_name: String) -> String:
	match state_name.to_upper():
		"READY":
			return "SẴN SÀNG"
		"SUMMONING":
			return "ĐANG TRIỆU HỒI"
		"SUPPORT_COOLDOWN":
			return "ĐANG HỒI"
	return "ĐANG TÍCH LŨY"


func _numeric_property(object: Object, candidates: Array[StringName], fallback: float) -> float:
	var property_names: Dictionary = {}
	for property: Dictionary in object.get_property_list():
		property_names[StringName(property.get("name", ""))] = true
	for candidate: StringName in candidates:
		if property_names.has(candidate):
			var value: Variant = object.get(candidate)
			if value is int or value is float:
				return float(value)
	return fallback


func _on_health_changed(current: int, maximum: int) -> void:
	var safe_maximum := maxi(1, maximum)
	health_bar.max_value = safe_maximum
	health_bar.value = clampi(current, 0, safe_maximum)
	health_value.text = "%d/%d" % [clampi(current, 0, safe_maximum), safe_maximum]


func _on_hero_health_pools_changed(snapshot: Dictionary) -> void:
	var active_maximum := maxi(1, int(snapshot.get("active_maximum", 1)))
	var active_current := clampi(int(snapshot.get("active_current", 0)), 0, active_maximum)
	_on_health_changed(active_current, active_maximum)
	var active_barrier := maxi(0, int(snapshot.get("active_barrier", 0)))
	if active_barrier > 0:
		health_value.text += "  ◈%d" % active_barrier
		health_value.tooltip_text = "HP thật + Giáp ảo nhìn thấy; sát thương trừ Giáp ảo trước."
	else:
		health_value.tooltip_text = "HP thật; không có giảm damage ẩn."
	var reserve_maximum := maxi(1, int(snapshot.get("reserve_maximum", 1)))
	var reserve_current := clampi(int(snapshot.get("reserve_current", 0)), 0, reserve_maximum)
	var has_reserve := not String(snapshot.get("reserve_hero_id", "")).is_empty()
	stamina_bar.max_value = reserve_maximum
	stamina_bar.value = reserve_current if has_reserve else 0
	stamina_value.text = (
		"%d/%d +10%%/s" % [reserve_current, reserve_maximum]
		if has_reserve
		else "—"
	)


func _on_mana_changed(current: float, maximum: float) -> void:
	var safe_maximum := maxf(1.0, maximum)
	mana_bar.max_value = safe_maximum
	mana_bar.value = clampf(current, 0.0, safe_maximum)
	mana_value.text = "%d/%d" % [roundi(clampf(current, 0.0, safe_maximum)), roundi(safe_maximum)]


func _on_score_changed(score: int) -> void:
	score_label.text = "ĐIỂM  %06d" % maxi(0, score)


func _on_sigil_collected(current: int, required: int) -> void:
	var safe_required := maxi(1, required)
	_current_sigils = clampi(current, 0, safe_required)
	_required_sigils = safe_required
	sigil_label.text = "ẤN KÝ  %d/%d" % [clampi(current, 0, safe_required), safe_required]
	_refresh_objective_label()


func _on_encounter_objective_changed(defeated: int, total: int, cleared: bool) -> void:
	_encounter_enemy_total = maxi(0, total)
	_encounter_enemy_defeated = clampi(defeated, 0, _encounter_enemy_total)
	_encounter_cleared = cleared if _encounter_enemy_total > 0 else true
	_refresh_objective_label()


func _refresh_objective_label() -> void:
	if GameSession.objective_finished:
		objective_label.text = OBJECTIVE_DONE
		return
	objective_label.text = "MỤC TIÊU  •  Đi tới lối thoát"


func _on_objective_completed() -> void:
	_release_virtual_actions()
	if is_instance_valid(_field_codex):
		_field_codex.hide_codex()
	objective_label.text = OBJECTIVE_DONE
	pause_overlay.hide()
	death_overlay.hide()
	_set_virtual_controls_visible(false)
	get_tree().paused = true
	var app_flow := _get_active_app_flow()
	if app_flow != null and GameEvents.has_signal(&"run_completion_ready"):
		# Progression/rewards are committed before the chooser appears. AppFlow no
		# longer routes through a result summary; the emitted continuation context
		# drives Next, level farming, difficulty and Home directly.
		app_flow.call(&"complete_active_run", {
			"score": GameSession.score,
			"sigils": GameSession.sigils,
			"required_sigils": GameSession.required_sigils,
		})
		return
	# Compatibility fallback for a standalone gameplay scene without AppFlow.
	win_overlay.show()


func _on_player_died() -> void:
	_release_virtual_actions()
	if is_instance_valid(_field_codex):
		_field_codex.hide_codex()
	if is_instance_valid(_completion_choice):
		_completion_choice.hide()
	death_overlay.show()
	pause_overlay.hide()
	win_overlay.hide()
	_set_virtual_controls_visible(false)
	# Knight switches to PROCESS_MODE_ALWAYS for its death animation/timer. The
	# paused world freezes enemies, hazards, and projectiles immediately.
	get_tree().paused = true


func _on_player_respawned() -> void:
	death_overlay.hide()
	get_tree().paused = false
	_set_virtual_controls_visible(true)
	_show_toast("Đã hồi sinh tại điểm lưu")


func _on_pause_pressed() -> void:
	if not death_overlay.visible and not win_overlay.visible:
		_set_paused(true)


func _on_resume_pressed() -> void:
	_set_paused(false)


func _set_paused(paused: bool) -> void:
	if paused:
		_release_virtual_actions()
		if is_instance_valid(_field_codex):
			_field_codex.hide_codex()
	get_tree().paused = paused
	pause_overlay.visible = paused
	_set_virtual_controls_visible(not paused)


func _on_continue_pressed() -> void:
	win_overlay.hide()
	get_tree().paused = false
	var app_flow := _get_active_app_flow()
	if app_flow != null:
		app_flow.call(&"complete_active_run", {
			"score": GameSession.score,
			"sigils": GameSession.sigils,
			"required_sigils": GameSession.required_sigils,
		})
		return
	_set_virtual_controls_visible(true)
	_show_toast("Tự do khám phá")


func _should_enable_virtual_controls() -> bool:
	return OS.has_feature("mobile") or OS.get_environment("GODOT_FORCE_TOUCH_CONTROLS") == "1"


func _set_virtual_controls_visible(requested_visible: bool) -> void:
	virtual_controls.visible = requested_visible and _virtual_controls_enabled


func _configure_desktop_hud() -> void:
	sync_detail_label.hide()
	top_right_panel.hide()
	action_deck.hide()
	if _virtual_controls_enabled:
		return
	# Score, sigil duplication and transport diagnostics belong in Codex/pause,
	# not on the permanent combat canvas.


func _configure_touch_labels() -> void:
	if not _virtual_controls_enabled:
		return
	pause_button.icon = null
	interact_button.show()
	interact_button.text = "DÙNG"
	attack_button.text = "ĐÁNH"
	skill_button.text = "KỸ NĂNG E"
	spirit_button.text = "CHUYỂN HỒN"
	dash_button.text = "LƯỚT"
	ultimate_button.text = "R\nTUYỆT KỸ"
	pause_button.text = "Ⅱ"


func _apply_saved_mobile_layout() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"get_value"):
		return
	var settings_path: Array[String] = ["settings"]
	var settings: Variant = save_service.call(&"get_value", settings_path, {})
	if not settings is Dictionary:
		return
	var preferences := settings as Dictionary
	var left_handed := bool(preferences.get("left_handed", false))
	var joystick_scale := clampf(float(preferences.get("joystick_size", 1.0)), 0.75, 1.5)
	var button_scale := clampf(float(preferences.get("button_scale", 1.0)), 0.75, 1.5)
	var joystick := virtual_joystick
	var joystick_base := Rect2(8.0, 222.0, 130.0, 130.0)
	var joystick_x := 502.0 if left_handed else joystick_base.position.x
	var joystick_extra := joystick_base.size * (joystick_scale - 1.0) * 0.5
	joystick.position = Vector2(
		joystick_x - joystick_extra.x if left_handed else joystick_x + joystick_extra.x,
		joystick_base.position.y - joystick_extra.y
	)
	joystick.size = joystick_base.size
	joystick.pivot_offset = joystick_base.size * 0.5
	joystick.scale = Vector2.ONE * joystick_scale
	joystick.modulate.a = clampf(float(preferences.get("joystick_opacity", 0.7)), 0.25, 1.0)

	dpad.position.x = 506.0 if left_handed else 10.0
	for button_name: String in MOBILE_CONTROL_RECTS:
		var button := virtual_controls.get_node_or_null(button_name) as Button
		if button == null:
			continue
		var authored_rect: Rect2 = MOBILE_CONTROL_RECTS[button_name]
		var mirrored_x := 640.0 - authored_rect.end.x
		var extra := authored_rect.size * (button_scale - 1.0) * 0.5
		button.position = Vector2(
			mirrored_x + extra.x if left_handed else authored_rect.position.x - extra.x,
			authored_rect.position.y - extra.y
		)
		button.size = authored_rect.size
		button.pivot_offset = authored_rect.size * 0.5
		button.scale = Vector2.ONE * button_scale


func _restart_run() -> void:
	_release_virtual_actions()
	if is_instance_valid(_completion_choice):
		_completion_choice.hide()
	get_tree().paused = false
	GameSession.reset_run()
	var app_flow := _get_active_app_flow()
	if app_flow != null:
		app_flow.call(&"retry_active_run")
		return
	get_tree().reload_current_scene()


func _on_exit_to_hub_pressed(tab_id: StringName) -> void:
	var app_flow := _get_active_app_flow()
	if app_flow == null:
		return
	_release_virtual_actions()
	get_tree().paused = false
	app_flow.call(&"abort_to_hub", tab_id)


func _sync_product_flow_buttons() -> void:
	var available := _get_active_app_flow() != null
	pause_hub_button.visible = available
	death_loadout_button.visible = available
	if available:
		var active_run: Dictionary = AppFlow.get_active_run()
		win_continue_button.text = (
			"HOÀN THÀNH MÀN"
			if StringName(active_run.get("mode_id", &"training")) == &"campaign"
			else "KẾT THÚC LUYỆN TẬP"
		)


func _get_active_app_flow() -> Node:
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow == null or not app_flow.has_method(&"has_active_run"):
		return null
	return app_flow if bool(app_flow.call(&"has_active_run")) else null


func _release_virtual_actions() -> void:
	for button: Node in get_tree().get_nodes_in_group(&"virtual_action_buttons"):
		if button.has_method(&"release_action"):
			button.call(&"release_action")


func _show_toast(message: String) -> void:
	if message.strip_edges().is_empty():
		return
	if is_instance_valid(_toast_tween):
		_toast_tween.kill()
	var toast_text := message.strip_edges()
	if toast_text.begins_with("Nhấn E để "):
		toast_text = "Nhấn chuột trái để %s" % toast_text.trim_prefix("Nhấn E để ")
	var is_interaction := toast_text.begins_with("Nhấn chuột trái để ")
	toast_prompt.visible = is_interaction and not _virtual_controls_enabled
	if is_interaction:
		toast_text = toast_text.trim_prefix("Nhấn chuột trái để ")
		if not toast_text.is_empty():
			toast_text = toast_text.left(1).to_upper() + toast_text.substr(1)
		if _virtual_controls_enabled:
			toast_text = "DÙNG  •  %s" % toast_text
	toast_label.text = toast_text
	toast_panel.modulate = Color(1.0, 1.0, 1.0, 0.0)
	toast_panel.show()
	_toast_tween = create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	_toast_tween.tween_property(toast_panel, "modulate:a", 1.0, 0.12)
	_toast_tween.tween_interval(2.4)
	_toast_tween.tween_property(toast_panel, "modulate:a", 0.0, 0.2)
	_toast_tween.tween_callback(toast_panel.hide)


func _poll_live_sync(force: bool) -> void:
	if not is_instance_valid(RealtimeBridge) or not RealtimeBridge.has_method(&"get_status"):
		return
	var status: Dictionary = RealtimeBridge.get_status()
	var connected := bool(status.get("connected", false))
	var detail := str(status.get("detail", "Đang khởi động"))
	if force or connected != _last_sync_connected or detail != _last_sync_detail:
		_on_live_sync_status_changed(connected, detail)


func _on_live_sync_status_changed(connected: bool, detail: String) -> void:
	_last_sync_connected = connected
	_last_sync_detail = detail
	sync_label.text = "ĐỒNG BỘ  ●  TRỰC TUYẾN" if connected else "ĐỒNG BỘ  ○  CỤC BỘ"
	sync_label.add_theme_color_override(&"font_color", Color("77e48a") if connected else Color("f0b35a"))
	var concise_detail := detail.strip_edges()
	if concise_detail.length() > 25:
		concise_detail = concise_detail.left(24) + "…"
	sync_detail_label.text = concise_detail
	sync_detail_label.tooltip_text = detail
	sync_label.tooltip_text = detail


func _apply_pixel_theme() -> void:
	hud_root.theme = UI_THEME
	objective_label.add_theme_color_override(&"font_color", Color("ffe49b"))
	sigil_label.add_theme_color_override(&"font_color", Color("cf9fff"))
