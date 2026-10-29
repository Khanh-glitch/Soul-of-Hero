class_name KnightController
extends CharacterBody2D

signal health_changed(current: int, maximum: int)
signal stamina_changed(current: float, maximum: float)
signal mana_changed(current: float, maximum: float)

enum PlayerState {
	IDLE,
	MOVE,
	ATTACK,
	SKILL,
	DASH,
	HURT,
	SWAP,
	INTERACT,
	DEAD,
}

const GameplayInputGateScript := preload("res://game/survival/gameplay_input_gate.gd")
const KnightAnimations := preload("res://game/characters/knight/knight_animation_library.gd")
const AxeWarriorAnimations := preload("res://game/characters/knight/axe_warrior_animation_library.gd")
const ArcherAnimations := preload("res://game/characters/knight/archer_animation_library.gd")
const WizardAnimations := preload("res://game/characters/knight/wizard_animation_library.gd")
const WizardRuntimeScript := preload("res://game/heroes/wizard/wizard_runtime.gd")
const KnightCavalryGuardScript := preload("res://game/heroes/sword/knight_cavalry_guard.gd")
const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")
const KNightVengefulSoulScript := preload("res://game/heroes/sword/k_night_vengeful_soul.gd")
const WizardSoulMatrixScript := preload("res://game/heroes/wizard/wizard_soul_matrix.gd")
const SkillTargetingOverlayScript := preload("res://game/combat/skill_targeting_overlay.gd")
const AuthoredSkillZoneScript := preload("res://game/combat/authored_skill_zone.gd")
const HeroSkillKitRulesScript := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const TuningSchema := preload("res://game/characters/knight/gameplay_tuning_schema.gd")
const SWORD_DEFINITION: WeaponDefinition = preload("res://game/weapons/data/sword.tres")
const BOW_DEFINITION: WeaponDefinition = preload("res://game/weapons/data/bow.tres")
const AXE_DEFINITION: WeaponDefinition = preload("res://game/weapons/data/axe.tres")
const WIZARD_STAFF_DEFINITION: WeaponDefinition = preload("res://game/weapons/data/wizard_staff.tres")
const AXE_CHARGE_MATH := preload("res://game/weapons/axe_charge_math.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const FALLING_ARROW_SCENE: PackedScene = preload("res://game/weapons/effects/falling_arrow.tscn")
const PIERCING_ARROW_SCENE: PackedScene = preload("res://game/weapons/effects/piercing_arrow.tscn")
const FLYING_SWORD_SCENE: PackedScene = preload("res://game/weapons/effects/flying_sword.tscn")
const AXE_THROW_SCENE: PackedScene = preload("res://game/weapons/effects/axe_throw.tscn")
const AXE_FOLLOW_THROUGH_SCENE: PackedScene = preload("res://game/weapons/effects/axe_follow_through.tscn")
const SWORD_HERO: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE_HERO: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const ARCHER_HERO: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")
const WIZARD_HERO: HeroDefinition = preload("res://game/heroes/data/wizard_hero.tres")
const ARCHER_SOUL_MARK_TEXTURE: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_soul_mark_vfx.png")
const SOUL_INTERCEPTION_SCENE: PackedScene = preload("res://game/heroes/sword/soul_interception.tscn")
const RETURNING_BLADE_SCENE: PackedScene = preload("res://game/heroes/sword/returning_blade.tscn")
const AXE_REAPER_DROP_SCENE: PackedScene = preload("res://game/heroes/axe/axe_reaper_drop.tscn")
const AXE_LAST_ORBIT_SCENE: PackedScene = preload("res://game/heroes/axe/axe_last_orbit.tscn")
const KNIGHT_CAVALRY_CHARGE_SCENE: PackedScene = preload(
	"res://game/heroes/ultimate/knight_cavalry_charge.tscn"
)
const SWORD_CRESCENT_WAVE_SCENE: PackedScene = preload("res://game/heroes/sword/sword_crescent_wave.tscn")
const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const TUNING_PATH := "res://config/gameplay_tuning.json"
const SPRITE_REST_POSITION := Vector2(0.0, -31.0)
const AXE_SPRITE_REST_POSITION := Vector2(0.0, -21.0)
const ARCHER_SPRITE_REST_POSITION := Vector2(0.0, -24.0)
## Wizard Pack has ~48 px of transparent lower canvas.  Its former -45 pivot
## treated that padding as feet and visibly floated the character above the
## collision/shadow.  -22 aligns the drawn boots with the shared ground plane.
const WIZARD_SPRITE_REST_POSITION := Vector2(3.0, -22.0)
const DEFAULT_CHARACTER_FORM_SCALE := Vector2.ONE
const AXE_CHARACTER_FORM_SCALE := Vector2(0.75, 0.75)
const ARCHER_CHARACTER_FORM_SCALE := Vector2(1.0, 1.0)
const WIZARD_CHARACTER_FORM_SCALE := Vector2(0.48, 0.48)
const BODY_CENTER_OFFSET := Vector2(0.0, -8.0)
const ENEMY_COLLISION_BIT := 1 << 2
const CROWD_PRESSURE_POLL_SECONDS := 0.12
const ARCHER_DASH_RELAY_DURATION := 2.0
const ARCHER_DASH_SHOT_RELEASE_SECONDS := 0.14
const WORLD_INTERACTION_FALLBACK_RADIUS := 72.0
const POINTER_TARGET_FORGIVING_RADIUS := 64.0
const POINTER_SELECTION_RANGE := 12000.0
const POINTER_SELECTION_RADIUS := 30.0
const FULL_MAP_PROJECTILE_DISTANCE := 12000.0
const RESERVE_SOUL_HEALTH_REGEN_RATIO_PER_SECOND := 0.10
const DEFAULT_CHARACTER_FORM_ID := &"free_knight"
const AXE_CHARACTER_FORM_ID := &"axe_warrior_rpg"
const ARCHER_CHARACTER_FORM_ID := &"archer_hero_form"
const WIZARD_CHARACTER_FORM_ID := &"wizard_hero_form"

const ACTION_PROFILES := {
	"light_attack": {
		"animation": "attack",
		"duration": 0.34,
		"stamina": 0.0,
		"damage": [18],
		"windows": [[0.10, 0.25]],
	},
	"combo_attack": {
		"animation": "attack_combo",
		"duration": 0.72,
		"stamina": 8.0,
		"damage": [15, 23],
		"windows": [[0.12, 0.27], [0.43, 0.62]],
	},
	"heavy_attack": {
		"animation": "heavy_attack",
		"duration": 0.52,
		"stamina": 24.0,
		"damage": [34],
		"windows": [[0.20, 0.43]],
	},
	"crouch_attack": {
		"animation": "crouch_attack",
		"duration": 0.36,
		"stamina": 5.0,
		"damage": [22],
		"windows": [[0.11, 0.28]],
	},
	"dash": {
		"animation": "dash",
		"duration": 0.16,
		"stamina": 22.0,
		"damage": [],
		"windows": [],
	},
	"roll": {
		"animation": "roll",
		"duration": 0.48,
		"stamina": 18.0,
		"damage": [],
		"windows": [],
	},
	"slide": {
		"animation": "slide_full",
		"duration": 0.32,
		"stamina": 12.0,
		"damage": [],
		"windows": [],
	},
	"hop": {
		"animation": "jump",
		"duration": 0.40,
		"stamina": 10.0,
		"damage": [],
		"windows": [],
	},
	"sword_attack_1": {
		"animation": "attack",
		"stamina": 0.0,
	},
	"sword_attack_2": {
		"animation": "combo_attack",
		"stamina": 0.0,
	},
	"sword_attack_3": {
		"animation": "heavy_attack",
		"stamina": 0.0,
	},
	"sword_attack_4": {
		"animation": "attack",
		"stamina": 0.0,
	},
	"sword_attack_5": {
		"animation": "attack",
		"stamina": 0.0,
	},
	"dash_slash": {
		"animation": "attack",
		"stamina": 0.0,
	},
	"bow_attack": {
		"animation": "attack",
		"stamina": 0.0,
	},
	"bow_volley": {
		"animation": "heavy_attack",
		"stamina": 0.0,
	},
	"wizard_attack": {
		"animation": "wizard_attack",
		"duration": 0.44,
		"stamina": 0.0,
		"damage": [],
		"windows": [],
	},
	"wizard_passage": {
		"animation": "wizard_passage",
		"duration": 0.26,
		"stamina": 0.0,
		"damage": [],
		"windows": [],
	},
	"axe_charge": {
		# The first frame of Attack2NoMovement is a very low, 28 px crouch.
		# Entering it directly from the 44-48 px Run silhouette reads as an
		# accidental scale pop. Hold the authored upright Attack anticipation
		# instead, then restart the same strip when the cleave is released.
		"animation": "attack",
		"duration": 0.1,
		"stamina": 0.0,
		"damage": [],
		"windows": [],
	},
	"axe_cleave": {
		"animation": "heavy_attack",
		"stamina": 0.0,
	},
	"axe_throw": {
		"animation": "attack",
		"stamina": 0.0,
	},
	"weapon_swap": {
		"animation": "turn",
		"duration": 0.25,
		"stamina": 0.0,
		"damage": [],
		"windows": [],
	},
}

@onready var sprite: AnimatedSprite2D = $Sprite
@onready var attack_hitbox: Area2D = $AttackHitbox
@onready var weapon_manager: WeaponManager = $WeaponManager
@onready var hero_soul_manager: HeroSoulManager = $HeroSoulManager
@onready var hand_weapon_visual: WeaponVisual2D = $HandWeaponVisual
@onready var spirit_weapon_visual: WeaponVisual2D = $SpiritWeaponVisual
@onready var vision_light: PointLight2D = $VisionLight
@onready var ground_shadow: Polygon2D = $GroundShadow

var move_speed := 96.0
var crouch_speed := 44.0
var acceleration := 900.0
var friction := 1100.0
var dash_speed := 265.0
var dash_duration := 0.18
var dash_cooldown := 2.0
var roll_speed := 155.0
var roll_duration := 0.48
var slide_speed := 142.0
var slide_duration := 0.32
var hop_speed := 118.0
var hop_duration := 0.40
var hop_height := 8.0
var max_health := 100
var max_mana := 100.0
var max_stamina := 100.0
var stamina_regen := 26.0
var light_damage := 18
var heavy_damage := 34
var crouch_damage := 22
var combo_reset_time := 0.55
var hit_invulnerability := 0.75

var health := 100
var mana := 100.0
var stamina := 100.0
var facing_direction := Vector2.RIGHT
var action_direction := Vector2.RIGHT
var move_input := Vector2.ZERO
var current_action := ""
var action_elapsed := 0.0
var dash_cooldown_remaining := 0.0
var invulnerability_remaining := 0.0
var combo_memory_remaining := 0.0
var turn_remaining := 0.0
var queued_combo := false
var dead := false
var player_state := PlayerState.IDLE
var _last_horizontal_facing := 1
var _last_hit_window := -1
var _hit_targets: Dictionary = {}
var _last_stamina_sent := -1.0
var _last_mana_sent := -1.0
var _queued_weapon_attack := false
var _attack_instance_serial := 0
var _dash_slash_hit_count := 0
var _dash_slash_iframes_started := false
var _dash_slash_collision_ignored := false
var _requested_action_direction := Vector2.ZERO
var _normal_collision_mask := 0
var _loadout_save_serial := 0
var _skill_cast_serial := 0
var _active_skill_instance_id := 0
var _pending_volley_casts: Dictionary = {}
var _archer_attack_contexts: Dictionary = {}
var _archer_pending_shot: Dictionary = {}
var _archer_focus := 0
var _archer_focus_timeout_left := 0.0
var _archer_close_decay_left := 0.0
var _archer_active_combo_step := 1
var _archer_split_step_direction := Vector2.ZERO
var _archer_mark_target: Node2D
var _archer_mark_seconds_left := 0.0
var _archer_mark_visual: Sprite2D
var _archer_pending_mark_target: Node2D
var _axe_charge_snapshot: Dictionary = {}
var _axe_charge_vfx_stage := 0
var _axe_throw_effect: AxeThrowEffect
var _axe_throw_skill_instance_id := 0
var _axe_throw_origin := Vector2.ZERO
var _remote_axe_release_remaining := -1.0
var wizard_runtime: WizardRuntime
var _wizard_return_dash := false
var _weapon_registry: Dictionary = {
	&"sword": SWORD_DEFINITION,
	&"bow": BOW_DEFINITION,
	&"axe": AXE_DEFINITION,
	&"wizard_staff": WIZARD_STAFF_DEFINITION,
}
var _character_form_frames: Dictionary = {}
var _active_character_form_id: StringName = &""
var _active_sprite_rest_position := SPRITE_REST_POSITION
var _sword_combo_next_step := 1
var _sword_combo_window_remaining := 0.0
var _sword_combo_buffered := false
var _sword_pursuit_target: Node2D
var _sword_wave_pending := false
var _sword_wave_attack_instance_id := 0
var _current_sword_pursuit_has_target := false
var _current_sword_pursuit_dash_distance := 60.0
var _current_sword_execution_hit_seconds := 0.32
var _current_sword_attack_instance_id := 0
var _sword_echo_queued_attack_instance_id := 0
var soul_echo_cooldown_remaining := 0.0
var _soul_echo_end_cooldown := 0.0
var _soul_echo: Node
var _soul_echo_active := false
## Per-enemy receipts are never merged by archetype. Entries are pruned against
## K-Night's ten-second revenge window when queried.
var _k_night_damage_ledger: Dictionary = {}
var _ultimate_cooldowns := {
	&"sword_hero": 0.0,
	&"archer_hero": 0.0,
	&"wizard_hero": 0.0,
}
var _archer_infinite_arrows_remaining := 0.0
var _carried_torch: Node2D
var _soul_support_visual: Node2D
var _combat_base_max_health := 100.0
var _combat_base_max_mana := 100.0
var _crowd_pressure_poll_left := 0.0
var _health_regen_fraction := 0.0
var _hero_health_current: Dictionary = {}
var _hero_health_maximum: Dictionary = {}
var _hero_barrier_current: Dictionary = {}
var _hero_barrier_maximum: Dictionary = {}
var barrier := 0
var max_barrier := 0
var _pending_relay_barrier_hero_id: StringName = &""
var _visible_defense_rng := RandomNumberGenerator.new()
var _health_active_hero_id: StringName = &""
var _last_health_pool_signature := ""
var _runtime_team_signature := ""
var _lmb_press_seen_since_physics := false
var _pending_gameplay_lmb := false
var _pending_lmb_aim_world := Vector2.ZERO
var _pending_lmb_aim_valid := false
var _lmb_is_gameplay_press := false
var _lmb_consumed_until_release := false
var _frame_saw_lmb_press := false
var _frame_gameplay_lmb_press := false
var _frame_lmb_aim_world := Vector2.ZERO
var _frame_lmb_aim_valid := false
var _rmb_press_seen_since_physics := false
var _pending_gameplay_rmb := false
var _pending_rmb_aim_world := Vector2.ZERO
var _pending_rmb_aim_valid := false
var _frame_saw_rmb_press := false
var _frame_gameplay_rmb_press := false
var _frame_rmb_aim_world := Vector2.ZERO
var _frame_rmb_aim_valid := false
var _queued_attack_pointer_world := Vector2.ZERO
var _queued_attack_pointer_valid := false
var _aim_assist_strength := 0.5
## RMB is an explicit priority override. Without one, every attack resolves a
## fresh target from all visible enemies using the active Hero's own rule.
var _locked_attack_target: Node2D
var _locked_attack_target_remaining := 0.0
var _locked_target_visual: Node2D
var _target_indicator_target: Node2D
var _skill_targeting_overlay: SkillTargetingOverlay
var _armed_hero_skill_slot: StringName = &""
var _armed_hero_skill_profile: Dictionary = {}
var _armed_skill_charge_started := false
var _armed_skill_charge_elapsed := 0.0
var _armed_skill_charge_release_pending := false
var _kit_skill_cooldowns: Dictionary = {}
var _armed_skill_target: Node2D
var _kit_buff_id: StringName = &""
var _kit_buff_seconds_left := 0.0
var _kit_buff_attacks_left := 0
var _kit_buff_afterimage_left := 0.0
var _kit_buff_end_cooldown := 0.0
var _kit_buff_owner_hero_id: StringName = &""
var _kit_buff_damage_multiplier := 1.0
var _kit_buff_move_speed := 1.0
var _kit_release_animation_left := 0.0
var _gameplay_input_gate: SurvivalGameplayInputGate


func _ready() -> void:
	_gameplay_input_gate = GameplayInputGateScript.new() as SurvivalGameplayInputGate
	_gameplay_input_gate.name = "GameplayInputGate"
	add_child(_gameplay_input_gate)
	_visible_defense_rng.randomize()
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	_normal_collision_mask = collision_mask
	_skill_targeting_overlay = SkillTargetingOverlayScript.new() as SkillTargetingOverlay
	add_child(_skill_targeting_overlay)
	_character_form_frames[DEFAULT_CHARACTER_FORM_ID] = KnightAnimations.build()
	_character_form_frames[AXE_CHARACTER_FORM_ID] = AxeWarriorAnimations.build()
	_character_form_frames[ARCHER_CHARACTER_FORM_ID] = ArcherAnimations.build_player()
	_character_form_frames[WIZARD_CHARACTER_FORM_ID] = WizardAnimations.build()
	_active_character_form_id = DEFAULT_CHARACTER_FORM_ID
	sprite.sprite_frames = _character_form_frames[DEFAULT_CHARACTER_FORM_ID] as SpriteFrames
	_apply_character_form_presentation(DEFAULT_CHARACTER_FORM_ID)
	_load_tuning()
	_combat_base_max_health = float(max_health)
	_combat_base_max_mana = max_mana
	health = max_health
	mana = max_mana
	stamina = max_stamina
	_hide_legacy_weapon_visuals()
	_configure_vision_light()
	_update_attack_transform()
	_setup_weapon_system()
	_setup_hero_system()
	wizard_runtime = WizardRuntimeScript.new() as WizardRuntime
	add_child(wizard_runtime)
	wizard_runtime.configure(self, hero_soul_manager)
	wizard_runtime.on_team_changed(hero_soul_manager.active_hero, hero_soul_manager.reserve_soul)
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null:
		if save_service.has_signal(&"save_committed"):
			var save_callback := Callable(self, "_on_runtime_save_committed")
			if not save_service.is_connected(&"save_committed", save_callback):
				save_service.connect(&"save_committed", save_callback)
		if save_service.has_method(&"get_snapshot"):
			refresh_runtime_meta_from_save(save_service.call(&"get_snapshot"))
	_play_animation("idle", true)
	GameEvents.player_registered.emit(self)
	_emit_health()
	_emit_mana(true)
	_emit_stamina(true)


func _input(event: InputEvent) -> void:
	if not event is InputEventMouseButton:
		return
	var mouse_event := event as InputEventMouseButton
	if mouse_event.button_index not in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
		return
	if mouse_event.button_index == MOUSE_BUTTON_LEFT:
		if mouse_event.pressed:
			# `_input` runs before Control dispatch. Start pessimistically blocked;
			# `_unhandled_input` promotes only a click that no UI consumed.
			_lmb_press_seen_since_physics = true
			_pending_gameplay_lmb = false
			_pending_lmb_aim_valid = false
			_lmb_is_gameplay_press = false
			_lmb_consumed_until_release = false
		else:
			if _armed_skill_charge_started:
				_armed_skill_charge_release_pending = true
			_lmb_is_gameplay_press = false
			_lmb_consumed_until_release = false
		return
	if mouse_event.pressed:
		_rmb_press_seen_since_physics = true
		_pending_gameplay_rmb = false
		_pending_rmb_aim_valid = false


func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton:
		return
	var mouse_event := event as InputEventMouseButton
	if mouse_event.button_index not in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT] or not mouse_event.pressed:
		return
	if _gameplay_input_gate != null and (not _gameplay_input_gate.permits(&"attack") or _gameplay_input_gate.modal_visible()):
		return
	# PASS-mode book pages and scroll regions may forward an event even while
	# visibly owning the pointer. They still suppress gameplay just like Buttons.
	if _pointer_is_over_input_ui():
		return
	var pointer_world := get_canvas_transform().affine_inverse() * mouse_event.position
	if mouse_event.button_index == MOUSE_BUTTON_LEFT:
		_pending_gameplay_lmb = true
		_pending_lmb_aim_world = pointer_world
		_pending_lmb_aim_valid = true
		_lmb_is_gameplay_press = true
	else:
		_pending_gameplay_rmb = true
		_pending_rmb_aim_world = pointer_world
		_pending_rmb_aim_valid = true
	get_viewport().set_input_as_handled()


func _physics_process(delta: float) -> void:
	if _gameplay_input_gate != null:
		_gameplay_input_gate.sync()
		if _gameplay_input_gate.modal_visible():
			_pending_gameplay_lmb = false
			_pending_gameplay_rmb = false
			_lmb_is_gameplay_press = false
	_resolve_frame_pointer_clicks()
	_tick_timers(delta)
	_update_live_crowd_pressure(delta)
	move_input = _gameplay_input_gate.movement() if _gameplay_input_gate != null else Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if _kit_buff_id == &"knight_shadow_double":
		move_input *= _kit_buff_move_speed
	if _armed_skill_charge_started:
		if bool(_armed_hero_skill_profile.get("stationary", false)):
			move_input = Vector2.ZERO
		else:
			move_input *= float(_armed_hero_skill_profile.get("charge_move_speed", 1.0))
	# Combat actions snapshot `action_direction` on start. Locomotion remains
	# independent (Archer and Axe can deliberately backpedal), but the body,
	# weapon visual and hitbox must keep facing that attack direction for the
	# whole action. ATTACK/SKILL is the shared contract, so future Hero actions
	# inherit this behavior without another weapon-specific exception.
	if _action_locks_visual_facing():
		_update_facing(action_direction)
	elif move_input.length_squared() > 0.01:
		_update_facing(move_input.normalized())

	if _gameplay_action_just_pressed("debug_hit"):
		take_damage(15, global_position + facing_direction * 20.0)

	if dead:
		player_state = PlayerState.DEAD
		velocity = velocity.move_toward(Vector2.ZERO, friction * 0.5 * delta)
		move_and_slide()
		return

	# Relay input must stay live during every action. The manager is authoritative
	# about readiness/takeover frames, and a successful Relay already cancels the
	# outgoing animation safely (including an Archer shot or an active Dash).
	if _gameplay_action_just_pressed(&"soul_relay_1"):
		if hero_soul_manager.request_soul_relay():
			# Do not let the remainder of the outgoing Hero's physics tick move or
			# restart the freshly relayed body after it lands on the Soul visual.
			return
	if hero_soul_manager.is_soul_skill_armed() and _frame_gameplay_lmb_press:
		_frame_gameplay_lmb_press = false
		_lmb_consumed_until_release = true
		if hero_soul_manager.confirm_soul_skill(_frame_skill_pointer_aim()):
			return
	if _tick_armed_hero_skill(delta):
		return

	if _gameplay_action_just_pressed(&"ultimate"):
		_arm_hero_skill(&"active_2")

	# A proximity interaction owns this world click before any attack state or
	# combo buffer sees it. Empty-world clicks remain normal attacks.
	_consume_frame_world_interaction()
	_consume_frame_target_selection()

	# Soul Echo is an immediate layer over the combo and does not replace or
	# interrupt the current normal attack.
	if _gameplay_skill_just_pressed():
		_arm_hero_skill(&"active_1")

	if current_action == "hit":
		_handle_hit_state(delta)
	elif not current_action.is_empty():
		_handle_action(delta)
	else:
		_handle_locomotion(delta)

	move_and_slide()
	_apply_attack_hits()
	_update_animation()
	_regenerate_stamina(delta)


func _tick_timers(delta: float) -> void:
	_regenerate_health(delta)
	_regenerate_reserve_soul_health(delta)
	_regenerate_mana(delta)
	if _locked_attack_target != null and (
			not is_instance_valid(_locked_attack_target)
			or not CombatDamage.is_alive(_locked_attack_target)
	):
		_clear_locked_attack_target()
	if _target_indicator_target != null and (
			not is_instance_valid(_target_indicator_target)
			or not CombatDamage.is_alive(_target_indicator_target)
	):
		_clear_target_indicator()
	_tick_archer_state(delta)
	dash_cooldown_remaining = maxf(0.0, dash_cooldown_remaining - delta)
	soul_echo_cooldown_remaining = maxf(0.0, soul_echo_cooldown_remaining - delta)
	for cooldown_key: Variant in _kit_skill_cooldowns.keys():
		_kit_skill_cooldowns[cooldown_key] = maxf(
			0.0, float(_kit_skill_cooldowns[cooldown_key]) - delta
		)
	_kit_release_animation_left = maxf(0.0, _kit_release_animation_left - delta)
	if _kit_buff_seconds_left > 0.0:
		_kit_buff_seconds_left = maxf(0.0, _kit_buff_seconds_left - delta)
		_kit_buff_afterimage_left -= delta
		if _kit_buff_id == &"knight_shadow_double" and move_input.length_squared() > 0.01 \
				and _kit_buff_afterimage_left <= 0.0:
			_kit_buff_afterimage_left = 0.12
			VfxCatalog.spawn(
				_effects_root(), &"echo_ribbon", global_position - facing_direction * 8.0,
				facing_direction.angle(), 0.8, Color(0.04, 0.04, 0.06, 0.62), 4,
			)
		if _kit_buff_seconds_left <= 0.0 or _kit_buff_attacks_left == 0:
			_finish_kit_buff()
	for hero_id: StringName in _ultimate_cooldowns.keys():
		_ultimate_cooldowns[hero_id] = maxf(
			0.0,
			float(_ultimate_cooldowns.get(hero_id, 0.0)) - delta
		)
	var prior_infinite_arrows := _archer_infinite_arrows_remaining
	_archer_infinite_arrows_remaining = maxf(
		0.0,
		_archer_infinite_arrows_remaining - delta
	)
	if prior_infinite_arrows > 0.0 and _archer_infinite_arrows_remaining <= 0.0:
		sprite.speed_scale = 1.0
		GameEvents.toast_requested.emit("VÔ HẠN TÊN  •  KẾT THÚC")
	invulnerability_remaining = maxf(0.0, invulnerability_remaining - delta)
	combo_memory_remaining = maxf(0.0, combo_memory_remaining - delta)
	if _sword_combo_window_remaining > 0.0 \
			and not _sword_wave_pending \
			and current_action != "dash" \
			and _sword_combo_index(current_action) < 0:
		_sword_combo_window_remaining = maxf(0.0, _sword_combo_window_remaining - delta)
		if _sword_combo_window_remaining <= 0.0:
			_reset_sword_combo(&"timeout")
	turn_remaining = maxf(0.0, turn_remaining - delta)
	if _remote_axe_release_remaining >= 0.0:
		_remote_axe_release_remaining -= delta
		if _remote_axe_release_remaining <= 0.0:
			_remote_axe_release_remaining = -1.0
			if current_action == "axe_charge":
				_release_axe_charge()


func _tick_archer_state(delta: float) -> void:
	if _archer_mark_seconds_left > 0.0:
		_archer_mark_seconds_left = maxf(0.0, _archer_mark_seconds_left - delta)
		if is_instance_valid(_archer_mark_visual):
			_archer_mark_visual.rotation += delta * 0.72
			var pulse := 0.22 + sin(_archer_mark_seconds_left * 7.0) * 0.018
			_archer_mark_visual.scale = Vector2.ONE * pulse
		if _archer_mark_seconds_left <= 0.0 or not CombatDamage.is_alive(_archer_mark_target):
			_clear_archer_mark(&"expired")
	if _archer_focus <= 0:
		return
	_archer_focus_timeout_left = maxf(0.0, _archer_focus_timeout_left - delta)
	if _archer_focus_timeout_left <= 0.0:
		_set_archer_focus(0, &"timeout")
		return
	var pressured := false
	var radius := ARCHER_HERO.archer_close_pressure_radius
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if global_position.distance_squared_to(enemy.global_position) <= radius * radius \
				and _has_attack_line_of_sight(enemy):
			pressured = true
			break
	if not pressured:
		_archer_close_decay_left = ARCHER_HERO.archer_close_focus_decay_seconds
		return
	_archer_close_decay_left = maxf(0.0, _archer_close_decay_left - delta)
	if _archer_close_decay_left <= 0.0:
		_set_archer_focus(_archer_focus - 1, &"close_pressure")
		_archer_close_decay_left = ARCHER_HERO.archer_close_focus_decay_seconds


func _set_archer_focus(value: int, reason: StringName) -> void:
	var next_focus := clampi(value, 0, ARCHER_HERO.archer_focus_max)
	if next_focus == _archer_focus:
		if next_focus > 0:
			_archer_focus_timeout_left = ARCHER_HERO.archer_focus_timeout_seconds
		return
	_archer_focus = next_focus
	_archer_focus_timeout_left = ARCHER_HERO.archer_focus_timeout_seconds if _archer_focus > 0 else 0.0
	_archer_close_decay_left = ARCHER_HERO.archer_close_focus_decay_seconds
	if GameEvents.has_signal(&"archer_focus_changed"):
		GameEvents.emit_signal(&"archer_focus_changed", _archer_focus, ARCHER_HERO.archer_focus_max, reason)
	RealtimeBridge.publish_event("archer_focus", {
		"current": _archer_focus,
		"maximum": ARCHER_HERO.archer_focus_max,
		"reason": String(reason),
	})


func _clear_archer_mark(reason: StringName) -> void:
	if is_instance_valid(_archer_mark_visual):
		_archer_mark_visual.queue_free()
	_archer_mark_visual = null
	_archer_mark_target = null
	_archer_mark_seconds_left = 0.0
	RealtimeBridge.publish_event("archer_soul_mark", {"active": false, "reason": String(reason)})


func _commit_archer_mark() -> void:
	var target := _archer_pending_mark_target
	_archer_pending_mark_target = null
	if not is_instance_valid(target):
		return
	if not CombatDamage.is_alive(target):
		GameEvents.toast_requested.emit("SOUL MARK  •  Mục tiêu đã biến mất")
		return
	_archer_mark_target = target
	_archer_mark_seconds_left = ARCHER_HERO.archer_mark_duration_seconds
	_attach_archer_mark_visual(target)
	GameEvents.toast_requested.emit("SOUL MARK  •  Đòn bắn trúng kế tiếp giải phóng Soul Line")


func _attach_archer_mark_visual(target: Node2D) -> void:
	if is_instance_valid(_archer_mark_visual):
		_archer_mark_visual.queue_free()
	_archer_mark_visual = Sprite2D.new()
	_archer_mark_visual.name = "ArcherSoulMarkVisual"
	_archer_mark_visual.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_archer_mark_visual.texture = ARCHER_SOUL_MARK_TEXTURE
	_archer_mark_visual.position = Vector2(0.0, -34.0)
	_archer_mark_visual.scale = Vector2.ONE * 0.22
	_archer_mark_visual.modulate = Color(0.72, 0.94, 1.0, 0.94)
	_archer_mark_visual.z_index = 12
	target.add_child(_archer_mark_visual)
	RealtimeBridge.publish_event("archer_soul_mark", {
		"active": true,
		"target_instance_id": target.get_instance_id(),
		"seconds": ARCHER_HERO.archer_mark_duration_seconds,
	})


func _reset_archer_state(reason: StringName) -> void:
	_set_archer_focus(0, reason)
	_archer_pending_mark_target = null
	_clear_archer_mark(reason)
	_archer_pending_shot.clear()
	_archer_attack_contexts.clear()


func _handle_locomotion(delta: float) -> void:
	var crouching := _gameplay_action_pressed("crouch")
	if _try_context_actions(crouching):
		return

	var authored_speed := crouch_speed if crouching else move_speed
	var target_speed := hero_soul_manager.active_move_speed(authored_speed)
	var target_velocity := move_input * target_speed
	var rate := acceleration if move_input.length_squared() > 0.01 else friction
	velocity = velocity.move_toward(target_velocity, rate * delta)
	player_state = PlayerState.MOVE if move_input.length_squared() > 0.01 else PlayerState.IDLE


func _try_context_actions(crouching: bool) -> bool:
	if _gameplay_action_just_pressed(&"interact"):
		return _try_interact()
	if _gameplay_attack_just_pressed():
		var hand_weapon := weapon_manager.get_hand_weapon()
		if hand_weapon != null and hand_weapon.weapon_id != &"sword":
			return _start_hand_attack(true, _frame_attack_pointer_aim())
		return _start_sword_hero_attack(_frame_attack_pointer_aim())
	if _gameplay_action_just_pressed("light_attack"):
		if crouching:
			return _start_action("crouch_attack")
		if combo_memory_remaining > 0.0:
			return _start_action("combo_attack")
		return _start_action("light_attack")
	if _gameplay_action_just_pressed("heavy_attack"):
		return _start_action("heavy_attack")
	if _gameplay_action_just_pressed("jump"):
		return _start_action("hop")
	if _gameplay_action_just_pressed("dash") and dash_cooldown_remaining <= 0.0:
		return _start_action("dash")
	if _gameplay_action_just_pressed("roll"):
		return _start_action("roll")
	if _gameplay_action_just_pressed("slide") and (move_input.length_squared() > 0.01 or velocity.length() > 20.0):
		return _start_action("slide")
	return false


func _try_interact(pointer_world := Vector2.ZERO, has_pointer := false) -> bool:
	# Placing the carried torch owns the whole input press. This prevents the
	# same press from immediately picking it back up or activating a door below
	# the player after it has been reparented into the world.
	if is_carrying_torch():
		return place_carried_torch()

	var candidates: Array[Dictionary] = []
	for candidate: Node in get_tree().get_nodes_in_group(&"player_interactable"):
		if not candidate is Node2D or not candidate.has_method(&"interact"):
			continue
		var candidate_2d := candidate as Node2D
		var distance_squared := global_position.distance_squared_to(candidate_2d.global_position)
		# All world interactions are local, including available nodes. Otherwise a
		# click in empty space can harvest a distant resource or enter a far gate.
		# Nearby locked chests and resolved seals still get a chance to explain why.
		if distance_squared > WORLD_INTERACTION_FALLBACK_RADIUS * WORLD_INTERACTION_FALLBACK_RADIUS:
			continue
		candidates.append({"node": candidate_2d, "distance_squared": distance_squared})
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a.distance_squared) < float(b.distance_squared)
	)
	# A placed survival door can be visually targeted even when adjacent
	# furniture has a nearer node origin. Keep keyboard interaction and every
	# non-door candidate on the existing nearest-first path. Its own interact()
	# still enforces the normal local reach and doorway safety rules.
	if has_pointer:
		for record: Dictionary in candidates:
			var candidate := record.node as Node2D
			if candidate is SurvivalStructure and (candidate as SurvivalStructure).piece_id == SurvivalStructure.PIECE_DOOR \
					and float(record.distance_squared) <= SurvivalStructure.REACH * SurvivalStructure.REACH \
					and Rect2(candidate.global_position, Vector2(SurvivalStructure.TILE, SurvivalStructure.TILE)).has_point(pointer_world):
				if bool(candidate.call(&"interact", self)):
					return true
	for record: Dictionary in candidates:
		var interactable := record.node as Node2D
		if is_instance_valid(interactable) and bool(interactable.call(&"interact", self)):
			return true
	return false


func _resolve_frame_pointer_clicks() -> void:
	_frame_saw_lmb_press = _lmb_press_seen_since_physics
	_frame_gameplay_lmb_press = _pending_gameplay_lmb
	_frame_lmb_aim_world = _pending_lmb_aim_world
	_frame_lmb_aim_valid = _pending_gameplay_lmb and _pending_lmb_aim_valid
	_lmb_press_seen_since_physics = false
	_pending_gameplay_lmb = false
	_pending_lmb_aim_valid = false
	_frame_saw_rmb_press = _rmb_press_seen_since_physics
	_frame_gameplay_rmb_press = _pending_gameplay_rmb
	_frame_rmb_aim_world = _pending_rmb_aim_world
	_frame_rmb_aim_valid = _pending_gameplay_rmb and _pending_rmb_aim_valid
	_rmb_press_seen_since_physics = false
	_pending_gameplay_rmb = false
	_pending_rmb_aim_valid = false


func _consume_frame_world_interaction() -> bool:
	if not _frame_gameplay_lmb_press or not _try_interact(_frame_lmb_aim_world, _frame_lmb_aim_valid):
		return false
	_lmb_consumed_until_release = true
	_frame_gameplay_lmb_press = false
	_frame_lmb_aim_valid = false
	return true


func _consume_frame_target_selection() -> bool:
	if not _frame_gameplay_rmb_press or not _frame_rmb_aim_valid:
		return false
	var candidates := TargetingService.acquire_near_point(
		self,
		global_position,
		_frame_rmb_aim_world,
		POINTER_SELECTION_RANGE,
		POINTER_SELECTION_RADIUS,
		1
	)
	if candidates.is_empty():
		_clear_locked_attack_target()
		GameEvents.toast_requested.emit("MỤC TIÊU  •  Đã bỏ chọn")
	else:
		_set_locked_attack_target(candidates[0])
		GameEvents.toast_requested.emit("MỤC TIÊU  •  Đã khóa")
	_frame_gameplay_rmb_press = false
	_frame_rmb_aim_valid = false
	return true


func _has_locked_attack_target() -> bool:
	return is_instance_valid(_locked_attack_target) and CombatDamage.is_alive(_locked_attack_target)


func _set_locked_attack_target(target: Node2D) -> void:
	if not is_instance_valid(target) or not CombatDamage.is_alive(target):
		_clear_locked_attack_target()
		return
	if _locked_attack_target == target and is_instance_valid(_locked_target_visual):
		return
	_clear_locked_attack_target()
	_locked_attack_target = target
	_locked_attack_target_remaining = INF
	_set_target_indicator(target)


func _clear_locked_attack_target() -> void:
	var prior_target := _locked_attack_target
	_locked_attack_target = null
	_locked_attack_target_remaining = 0.0
	if _target_indicator_target == prior_target:
		_clear_target_indicator()


func _set_target_indicator(target: Node2D) -> void:
	if not is_instance_valid(target) or not CombatDamage.is_alive(target):
		_clear_target_indicator()
		return
	if _target_indicator_target == target and is_instance_valid(_locked_target_visual):
		return
	_clear_target_indicator()
	_target_indicator_target = target
	_locked_target_visual = Node2D.new()
	_locked_target_visual.name = "TargetCornerSquare"
	_locked_target_visual.position = Vector2(0.0, 3.0)
	_locked_target_visual.show_behind_parent = true
	_locked_target_visual.z_index = -1
	var corner_paths: Array[PackedVector2Array] = [
		PackedVector2Array([Vector2(-7.0, -14.0), Vector2(-14.0, -14.0), Vector2(-14.0, -7.0)]),
		PackedVector2Array([Vector2(7.0, -14.0), Vector2(14.0, -14.0), Vector2(14.0, -7.0)]),
		PackedVector2Array([Vector2(-14.0, 7.0), Vector2(-14.0, 14.0), Vector2(-7.0, 14.0)]),
		PackedVector2Array([Vector2(14.0, 7.0), Vector2(14.0, 14.0), Vector2(7.0, 14.0)]),
	]
	for points: PackedVector2Array in corner_paths:
		var corner := Line2D.new()
		corner.width = 2.0
		corner.default_color = Color(0.95, 0.18, 0.12, 0.96)
		corner.antialiased = false
		corner.points = points
		_locked_target_visual.add_child(corner)
	target.add_child(_locked_target_visual)


func _clear_target_indicator() -> void:
	if is_instance_valid(_locked_target_visual):
		_locked_target_visual.free()
	_locked_target_visual = null
	_target_indicator_target = null


## Shared with the overworld build/retreat path. These wrappers gate gameplay
## reads only; they do not consume events intended for the visible UI.
func gameplay_input_allowed(action: StringName) -> bool:
	return _gameplay_input_gate == null or _gameplay_input_gate.permits(action)

func _gameplay_action_pressed(action: StringName) -> bool:
	return gameplay_input_allowed(action) and Input.is_action_pressed(action)

func _gameplay_action_just_pressed(action: StringName) -> bool:
	return gameplay_input_allowed(action) and Input.is_action_just_pressed(action)

func _gameplay_action_just_released(action: StringName) -> bool:
	return gameplay_input_allowed(action) and Input.is_action_just_released(action)

func _gameplay_attack_just_pressed() -> bool:
	if not gameplay_input_allowed(&"attack"):
		return false
	if _frame_gameplay_lmb_press and not _lmb_consumed_until_release:
		return true
	# `attack` also contains LMB. If this frame's physical LMB was accepted by a
	# Control, do not let Input's global action state bypass GUI consumption.
	if _frame_saw_lmb_press:
		return false
	return _gameplay_action_just_pressed(&"attack")


func _gameplay_attack_pressed() -> bool:
	if not gameplay_input_allowed(&"attack"):
		return false
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		return _lmb_is_gameplay_press and not _lmb_consumed_until_release
	return _gameplay_action_pressed(&"attack")


func _gameplay_skill_just_pressed() -> bool:
	return _gameplay_action_just_pressed(&"skill")


func _active_hero_ranked_skill_profile(slot: StringName) -> Dictionary:
	var hero := hero_soul_manager.active_hero
	if hero == null:
		return {}
	var kit := hero_soul_manager.get_active_skill_kit_snapshot()
	var profile_value: Variant = kit.get(String(slot), {})
	if not profile_value is Dictionary or (profile_value as Dictionary).is_empty():
		return {}
	var profile := (profile_value as Dictionary).duplicate(true)
	# Advanced/Legendary profiles retain the existing authored behavior, so add
	# its current rank-3 resource/timing values before applying item rank.
	if bool(profile.get("legacy_rank_3", false)):
		if slot == &"active_1":
			profile["mana"] = hero.resolved_active_skill_mana_cost()
			profile["cooldown"] = hero.resolved_active_skill_cooldown_seconds()
		else:
			profile["mana"] = hero.ultimate_mana_cost
			profile["cooldown"] = hero.ultimate_cooldown_seconds
			if hero.ultimate_duration_seconds > 0.0:
				profile["duration"] = hero.ultimate_duration_seconds
	var ranks_value: Variant = kit.get("skill_ranks", {})
	var ranks := ranks_value as Dictionary if ranks_value is Dictionary else {}
	var weapon_rank := clampi(int(ranks.get(String(slot), 1)), 1, 5)
	var result := HeroSkillKitRulesScript.rank_adjusted_profile(profile, weapon_rank)
	result["effective_damage_multiplier"] = float(kit.get("kit_power_multiplier", 1.0)) \
		* float(result.get("rank_damage_multiplier", 1.0))
	return result


func get_active_hero_skill_profile(slot: StringName) -> Dictionary:
	return _active_hero_ranked_skill_profile(slot)


func get_active_hero_skill_cooldown_remaining(slot: StringName) -> float:
	var hero := hero_soul_manager.active_hero
	if hero == null:
		return 0.0
	var cooldown_key := "%s:%s" % [hero.hero_id, slot]
	var remaining := maxf(
		0.0,
		float(_kit_skill_cooldowns.get(cooldown_key, 0.0)),
	)
	if hero.hero_id == &"sword_hero" and slot == &"active_1":
		remaining = maxf(remaining, soul_echo_cooldown_remaining)
	return remaining


func _arm_hero_skill(slot: StringName) -> bool:
	if dead or is_carrying_torch() or hero_soul_manager.active_hero == null \
			or not current_action.is_empty() or weapon_manager.is_swap_in_progress():
		return false
	var profile := _active_hero_ranked_skill_profile(slot)
	if profile.is_empty():
		return false
	var hero := hero_soul_manager.active_hero
	if profile.has("cooldown"):
		profile["cooldown"] = hero_soul_manager.active_skill_cooldown(
			float(profile["cooldown"])
		)
	var cooldown_key := "%s:%s" % [hero.hero_id, slot]
	if slot == &"active_1" and _kit_buff_seconds_left > 0.0 \
			and _kit_buff_owner_hero_id == hero.hero_id:
		GameEvents.toast_requested.emit("KỸ NĂNG  •  HIỆU ỨNG ĐANG HOẠT ĐỘNG")
		return false
	if float(_kit_skill_cooldowns.get(cooldown_key, 0.0)) > 0.0:
		GameEvents.toast_requested.emit(
			"KỸ NĂNG  •  HỒI %.1f GIÂY" % float(_kit_skill_cooldowns[cooldown_key])
		)
		return false
	_cancel_armed_hero_skill(false)
	_armed_hero_skill_slot = slot
	_armed_hero_skill_profile = profile
	_armed_skill_target = _locked_attack_target if _has_locked_attack_target() else _target_indicator_target
	var snapped := _armed_skill_target.global_position \
		if is_instance_valid(_armed_skill_target) else get_global_mouse_position()
	if snapped.distance_squared_to(global_position) < 4.0:
		snapped = global_position + facing_direction * 120.0
	profile["range"] = float(profile.get("range", 220.0))
	profile["radius"] = float(profile.get("radius", 64.0))
	profile["cone_degrees"] = float(profile.get("cone_degrees", 76.0))
	profile["width"] = float(profile.get("width", 28.0))
	_armed_hero_skill_profile = profile
	_skill_targeting_overlay.arm_skill(profile, self, snapped)
	if hero.hero_id == &"sword_hero" and StringName(profile.get("id", &"")) in [
		&"k_night_warrior_soul",
		&"k_night_void_phantom",
		&"k_night_soul_cleave",
		&"k_night_underworld_legion",
	]:
		# K-Night is intentionally immediate and low-friction: E/R executes
		# toward the current pointer/lock without a second confirmation click.
		return _confirm_armed_hero_skill(1.0)
	return true


func _tick_armed_hero_skill(delta: float) -> bool:
	if _armed_hero_skill_slot.is_empty():
		return false
	if _armed_skill_charge_started:
		_armed_skill_charge_elapsed += maxf(0.0, delta)
		var maximum := maxf(0.05, float(_armed_hero_skill_profile.get("charge", 0.0)))
		if bool(_armed_hero_skill_profile.get("invulnerable_while_charging", false)):
			invulnerability_remaining = maxf(invulnerability_remaining, delta * 2.5)
		if _armed_skill_charge_release_pending:
			_armed_skill_charge_release_pending = false
			var ratio := clampf(_armed_skill_charge_elapsed / maximum, 0.0, 1.0)
			return _confirm_armed_hero_skill(ratio)
		if _armed_skill_charge_elapsed > maximum:
			if bool(_armed_hero_skill_profile.get("auto_release", false)):
				return _confirm_armed_hero_skill(1.0)
			if bool(_armed_hero_skill_profile.get("overcharge_cancels", false)):
				_cancel_armed_hero_skill(true)
				GameEvents.toast_requested.emit("TỤ LỰC QUÁ LỂ  â€¢  MẤT CHIÊU")
				return true
		return false
	if _frame_gameplay_lmb_press:
		_frame_gameplay_lmb_press = false
		_lmb_consumed_until_release = true
		if float(_armed_hero_skill_profile.get("charge", 0.0)) > 0.0:
			_armed_skill_charge_started = true
			_armed_skill_charge_elapsed = 0.0
			_armed_skill_charge_release_pending = false
			_spawn_kit_cast_vfx(
				hero_soul_manager.active_hero.hero_id, global_position,
				_armed_hero_skill_slot, _armed_hero_skill_profile,
			)
			return false
		return _confirm_armed_hero_skill(1.0)
	return false


func _confirm_armed_hero_skill(charge_ratio: float) -> bool:
	var result := _skill_targeting_overlay.confirm()
	var slot := _armed_hero_skill_slot
	var profile := _armed_hero_skill_profile.duplicate(true)
	var target := _armed_skill_target
	_armed_hero_skill_slot = &""
	_armed_hero_skill_profile.clear()
	_armed_skill_target = null
	_armed_skill_charge_started = false
	_armed_skill_charge_elapsed = 0.0
	_armed_skill_charge_release_pending = false
	var aim: Variant = result.get("aim_world", _frame_skill_pointer_aim())
	if String(profile.get("aim", "")) == "single_target" and is_instance_valid(target):
		aim = target.global_position
	var activated := false
	var skill_id := StringName(profile.get("id", &""))
	if skill_id in [&"k_night_warrior_soul", &"k_night_void_phantom"]:
		activated = _try_activate_soul_echo(profile)
	elif bool(profile.get("legacy_rank_3", false)):
		if slot == &"active_1":
			activated = _try_activate_soul_echo(profile) \
				if hero_soul_manager.active_hero.hero_id == &"sword_hero" \
				else _start_hand_skill(aim, profile)
		else:
			activated = _try_activate_ultimate(aim, profile)
	else:
		activated = _execute_authored_kit_skill(slot, profile, aim, target, charge_ratio)
	return activated


func _cancel_armed_hero_skill(apply_lost_cooldown: bool) -> void:
	if apply_lost_cooldown and not _armed_hero_skill_slot.is_empty() \
			and hero_soul_manager.active_hero != null:
		var key := "%s:%s" % [hero_soul_manager.active_hero.hero_id, _armed_hero_skill_slot]
		_kit_skill_cooldowns[key] = float(_armed_hero_skill_profile.get("cooldown", 0.0))
	_armed_hero_skill_slot = &""
	_armed_hero_skill_profile.clear()
	_armed_skill_target = null
	_armed_skill_charge_started = false
	_armed_skill_charge_elapsed = 0.0
	_armed_skill_charge_release_pending = false
	if is_instance_valid(_skill_targeting_overlay):
		_skill_targeting_overlay.cancel()


func _execute_authored_kit_skill(
		slot: StringName,
		profile: Dictionary,
		aim: Variant,
		locked_target: Node2D,
		charge_ratio: float,
) -> bool:
	var hero := hero_soul_manager.active_hero
	if hero == null:
		return false
	var skill_id := StringName(profile.get("id", &""))
	var mana_cost := hero_soul_manager.active_skill_mana_cost(
		maxf(0.0, float(profile.get("mana", 0.0)))
	)
	if not _can_spend_mana(mana_cost):
		_show_insufficient_mana(mana_cost)
		return false
	if skill_id in [&"knight_shadow_double", &"archer_wind_arrow"]:
		if not _spend_mana(mana_cost):
			return false
		_kit_buff_id = skill_id
		_kit_buff_seconds_left = float(profile.get("duration", 4.0))
		_kit_buff_attacks_left = int(profile.get("charges", 999))
		_kit_buff_afterimage_left = 0.0
		_kit_buff_end_cooldown = float(profile.get("cooldown", 0.0))
		_kit_buff_owner_hero_id = hero.hero_id
		_kit_buff_damage_multiplier = float(profile.get("effective_damage_multiplier", 1.0))
		_kit_buff_move_speed = float(profile.get("move_speed", 1.0))
		_spawn_kit_cast_vfx(hero.hero_id, global_position, slot, profile)
		return true
	var aim_world := aim as Vector2 if aim is Vector2 else global_position + facing_direction * 120.0
	if String(profile.get("aim", "")) == "single_target" \
			and not is_instance_valid(locked_target):
		GameEvents.toast_requested.emit("KỸ NĂNG  â€¢  CHƯA CHỌN MỤC TIÊU")
		return false
	var min_ratio := float(profile.get("damage_ratio_min", profile.get("damage_ratio", 1.0)))
	var max_ratio := float(profile.get("damage_ratio_max", profile.get("damage_ratio", min_ratio)))
	var damage_ratio := lerpf(min_ratio, max_ratio, clampf(charge_ratio, 0.0, 1.0))
	if skill_id == &"knight_fan_charge":
		# Use the strongest authored Knight strip for the release. Only the
		# targeting preview itself is allowed to be procedural.
		_kit_release_animation_left = 0.58
		_play_animation(&"sword_combo_4", true)
	if skill_id == &"axe_execution" and is_instance_valid(locked_target):
		var missing := 1.0 - CombatDamage.health_ratio(locked_target)
		damage_ratio = minf(
			float(profile.get("damage_ratio_max", 4.0)),
			damage_ratio + missing * float(profile.get("missing_hp_bonus_max", 1.8)),
		)
	var authored_damage := float(hero.base_power) * damage_ratio
	var action_track := &"active_skill" if slot == &"active_1" else &"ultimate"
	var damage := hero_soul_manager.scale_hero_action_damage(
		hero.hero_id, action_track, authored_damage
	)
	if skill_id == &"k_night_underworld_legion":
		return _release_k_night_underworld_legion(
			profile, aim_world, damage, mana_cost, slot
		)
	if skill_id == &"archer_heart_piercer":
		return _release_archer_heart_piercer(
			profile, aim_world, charge_ratio, damage, mana_cost, slot
		)
	if skill_id in [&"axe_whirl", &"wizard_shade_prison", &"wizard_black_sun"]:
		return _spawn_authored_timed_skill_zone(
			skill_id, profile, aim_world, locked_target, damage, mana_cost, slot
		)
	var targets := _kit_skill_targets(profile, aim_world, locked_target)
	if targets.is_empty() and String(profile.get("aim", "")) == "single_target":
		return false
	if not _spend_mana(mana_cost):
		return false
	var hits := 0
	var confirmed_damage := 0
	for target: Node2D in targets:
		if CombatDamage.apply_confirmed(
			target, damage, global_position, StringName(hero.hero_id),
			{
				"hero_id": hero.hero_id,
				"source_kind": action_track,
				"skill_id": skill_id,
				"cue_id": &"heavy_impact",
			},
		):
			hits += 1
			confirmed_damage += damage
			var stun := float(profile.get("stun", 0.0)) * maxf(0.1, charge_ratio)
			if stun > 0.0:
				CombatDamage.apply_stun(target, stun, {"skill_id": skill_id})
	if skill_id == &"k_night_soul_cleave" and confirmed_damage > 0:
		var heal := mini(
			roundi(float(confirmed_damage) * float(profile.get("heal_ratio", 0.0))),
			roundi(float(max_health) * float(profile.get("heal_cap_max_hp_ratio", 0.08))),
		)
		if heal > 0:
			health = mini(max_health, health + heal)
			if not _health_active_hero_id.is_empty():
				_hero_health_current[String(_health_active_hero_id)] = float(health)
			_emit_health()
			VfxCatalog.spawn(
				_effects_root(), &"world_sparkle", global_position + BODY_CENTER_OFFSET,
				0.0, 0.72, Color(0.72, 0.08, 0.12, 0.82), 10,
			)
	_spawn_kit_cast_vfx(hero.hero_id, aim_world, slot, profile)
	var cooldown_key := "%s:%s" % [hero.hero_id, slot]
	_kit_skill_cooldowns[cooldown_key] = float(profile.get("cooldown", 0.0))
	RealtimeBridge.publish_event("hero_kit_skill_resolved", {
		"hero_id": String(hero.hero_id), "skill_id": String(skill_id), "hit_count": hits,
		"charge_ratio": charge_ratio, "damage": damage,
	})
	return true


func _release_k_night_underworld_legion(
		profile: Dictionary,
		aim_world: Vector2,
		total_damage: int,
		mana_cost: float,
		slot: StringName,
) -> bool:
	var direction := global_position.direction_to(aim_world)
	if direction.is_zero_approx():
		direction = facing_direction
	var charge := KNIGHT_CAVALRY_CHARGE_SCENE.instantiate()
	if charge == null or not charge.has_method(&"setup") or not _spend_mana(mana_cost):
		if charge != null:
			charge.queue_free()
		return false
	_effects_root().add_child(charge)
	if charge.has_signal(&"target_hit"):
		charge.connect(&"target_hit", _on_knight_cavalry_target_hit)
	var tick_count := maxi(1, int(profile.get(
		"damage_ticks", KNightRules.LEGION_DAMAGE_TICKS
	)))
	var rider_count := clampi(int(profile.get("rider_count", 5)), 1, 15)
	if not bool(charge.call(
		&"setup", self, global_position, direction, total_damage, rider_count, tick_count
	)):
		charge.queue_free()
		return false
	_spawn_kit_cast_vfx(&"sword_hero", global_position, slot, profile)
	_kit_skill_cooldowns["sword_hero:%s" % slot] = float(profile.get("cooldown", 8.0))
	RealtimeBridge.publish_event("hero_kit_skill_resolved", {
		"hero_id": "sword_hero",
		"skill_id": "k_night_underworld_legion",
		"total_damage": total_damage,
		"damage_ticks": tick_count,
		"rider_count": rider_count,
	})
	return true


func _release_archer_heart_piercer(
		profile: Dictionary,
		aim_world: Vector2,
		charge_ratio: float,
		damage: int,
		mana_cost: float,
		slot: StringName,
) -> bool:
	var direction := global_position.direction_to(aim_world)
	if direction.is_zero_approx():
		direction = facing_direction
	var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	if arrow == null or not _spend_mana(mana_cost):
		if arrow != null:
			arrow.queue_free()
		return false
	_effects_root().add_child(arrow)
	_attack_instance_serial += 1
	var cast_id := _attack_instance_serial
	arrow.target_hit.connect(
		_on_weapon_effect_target_hit.bind(&"bow", &"active_skill", cast_id)
	)
	var full_charge := charge_ratio >= 0.999
	var normal_stagger := float(profile.get("full_charge_stun", 0.0)) * 100.0 \
		if full_charge else 0.0
	var boss_stagger := float(profile.get("boss_stun", 0.0)) * 100.0 \
		if full_charge else 0.0
	arrow.setup(
		self,
		global_position + BODY_CENTER_OFFSET + direction * 12.0,
		direction,
		damage,
		&"bow",
		640.0,
		maxf(float(profile.get("range", 420.0)), FULL_MAP_PROJECTILE_DISTANCE),
		Color(0.72, 1.0, 0.92, 1.0),
		32,
		normal_stagger,
		10.0,
		{},
		1,
		float(profile.get("penetration_decay", 0.15)),
		float(profile.get("penetration_floor", 0.55)),
		boss_stagger,
	)
	_spawn_kit_cast_vfx(&"archer_hero", global_position, slot, profile)
	_kit_skill_cooldowns["archer_hero:%s" % slot] = float(profile.get("cooldown", 0.0))
	RealtimeBridge.publish_event("hero_kit_skill_resolved", {
		"hero_id": "archer_hero",
		"skill_id": "archer_heart_piercer",
		"charge_ratio": charge_ratio,
		"damage": damage,
		"projectile": true,
	})
	return true


func _spawn_authored_timed_skill_zone(
		skill_id: StringName,
		profile: Dictionary,
		aim_world: Vector2,
		locked_target: Node2D,
		damage: int,
		mana_cost: float,
		slot: StringName,
) -> bool:
	if skill_id == &"wizard_shade_prison" and (
		not is_instance_valid(locked_target) or not CombatDamage.is_alive(locked_target)
	):
		GameEvents.toast_requested.emit("KỸ NĂNG  •  CHƯA CHỌN MỤC TIÊU")
		return false
	var zone := AuthoredSkillZoneScript.new() as AuthoredSkillZone
	if zone == null or not _spend_mana(mana_cost):
		if zone != null:
			zone.queue_free()
		return false
	_effects_root().add_child(zone)
	var hero_id := hero_soul_manager.active_hero.hero_id
	var origin := aim_world
	var duration := float(profile.get("duration", 0.8 if skill_id == &"axe_whirl" else 2.0))
	var interval := float(profile.get("pulse_interval", 0.2 if skill_id == &"axe_whirl" else 0.4))
	var radius := float(profile.get("radius", 64.0))
	var effect_id: StringName = &"dark_burst"
	var follow_owner := false
	var target: Node2D = null
	var stagger := 0.0
	var boss_stagger := 0.0
	var pull_strength := 0.0
	match skill_id:
		&"axe_whirl":
			origin = global_position
			radius = maxf(radius, 82.0)
			effect_id = &"axe_spin"
			follow_owner = true
			stagger = 18.0
			boss_stagger = 7.0
			pull_strength = 34.0
		&"wizard_shade_prison":
			origin = locked_target.global_position
			radius = 34.0
			effect_id = &"dark_rift"
			target = locked_target
			stagger = 34.0
			boss_stagger = 12.0
		&"wizard_black_sun":
			radius = maxf(radius, 92.0)
			effect_id = &"dark_burst"
	if not zone.setup(
		self, origin, hero_id, skill_id, duration, interval, damage, radius,
		effect_id, follow_owner, target, stagger, boss_stagger, pull_strength,
	):
		return false
	_spawn_kit_cast_vfx(hero_id, origin, slot, profile)
	_kit_skill_cooldowns["%s:%s" % [hero_id, slot]] = float(profile.get("cooldown", 0.0))
	RealtimeBridge.publish_event("hero_kit_skill_resolved", {
		"hero_id": String(hero_id),
		"skill_id": String(skill_id),
		"damage": damage,
		"duration": duration,
		"timed_zone": true,
	})
	return true


func _kit_skill_targets(
		profile: Dictionary,
		aim_world: Vector2,
		locked_target: Node2D,
) -> Array[Node2D]:
	var result: Array[Node2D] = []
	var aim_kind := String(profile.get("aim", "area"))
	if aim_kind == "single_target":
		if is_instance_valid(locked_target) and CombatDamage.is_alive(locked_target):
			result.append(locked_target)
		return result
	var range_value := float(profile.get("range", 220.0))
	var radius := float(profile.get("radius", 72.0))
	var direction := global_position.direction_to(aim_world)
	if direction.is_zero_approx():
		direction = facing_direction
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		var include := false
		if aim_kind in ["self", "buff"]:
			include = global_position.distance_to(enemy.global_position) <= radius
		elif aim_kind.contains("line"):
			var endpoint := global_position + direction * range_value
			include = enemy.global_position.distance_to(
				Geometry2D.get_closest_point_to_segment(enemy.global_position, global_position, endpoint)
			) <= float(profile.get("width", 28.0)) * 0.5
		elif aim_kind.contains("cone"):
			var delta := enemy.global_position - global_position
			include = delta.length() <= range_value and absf(direction.angle_to(delta.normalized())) \
				<= deg_to_rad(float(profile.get("cone_degrees", 76.0)) * 0.5)
		else:
			include = aim_world.distance_to(enemy.global_position) <= radius
		if include and _has_attack_line_of_sight(enemy):
			result.append(enemy)
	return result


func _spawn_kit_cast_vfx(
		hero_id: StringName,
		position: Vector2,
		slot: StringName = &"",
		profile: Dictionary = {},
) -> void:
	var effect_id := &"echo_impact"
	match hero_id:
		&"archer_hero":
			effect_id = &"archer_pierce" if slot == &"active_2" else &"archer_quick"
		&"axe_hero":
			effect_id = &"axe_spin" if String(profile.get("id", "")).contains("spin") else &"axe_cleave"
		&"wizard_hero":
			effect_id = &"dark_burst" if slot == &"active_2" else &"dark_rift"
	VfxCatalog.spawn(_effects_root(), effect_id, position, action_direction.angle(), 1.0, Color.TRANSPARENT, 8)


func _frame_attack_pointer_aim() -> Variant:
	return _locked_attack_target.global_position if _has_locked_attack_target() else null


func _frame_skill_pointer_aim() -> Variant:
	return _locked_attack_target.global_position if _has_locked_attack_target() else null


func _buffer_current_attack_press() -> void:
	var already_buffered := _queued_weapon_attack
	_queued_weapon_attack = true
	if _has_locked_attack_target():
		_queued_attack_pointer_world = _locked_attack_target.global_position
		_queued_attack_pointer_valid = true
	elif not already_buffered:
		# A keyboard/controller press must replace, rather than inherit, a stale
		# pointer snapshot from an older click.
		_queued_attack_pointer_valid = false


func _pointer_direction(pointer_aim: Variant, fallback: Vector2) -> Vector2:
	if _has_locked_attack_target():
		var locked_direction := global_position.direction_to(_locked_attack_target.global_position)
		if not locked_direction.is_zero_approx():
			return locked_direction
	if pointer_aim is Vector2:
		var direction := global_position.direction_to(pointer_aim as Vector2)
		if not direction.is_zero_approx():
			return direction
	var normalized_fallback := fallback.normalized()
	return normalized_fallback if not normalized_fallback.is_zero_approx() else Vector2.RIGHT


func _pointer_snap_radius(rules: WeaponTargetRules = null) -> float:
	var maximum_radius := POINTER_TARGET_FORGIVING_RADIUS
	if rules != null and rules.forgiving_radius > 0.0:
		maximum_radius = rules.forgiving_radius
	# Even with assistance at zero, a literal click on the target's collider must
	# remain selectable. The slider only controls the extra forgiving halo.
	return lerpf(4.0, maximum_radius, clampf(_aim_assist_strength, 0.0, 1.0))


func _acquire_pointer_target(
		rules: WeaponTargetRules,
		pointer_aim: Variant,
		require_line_of_sight := false,
) -> Node2D:
	if rules == null or not pointer_aim is Vector2:
		return null
	var radius := _pointer_snap_radius(rules)
	if radius <= 0.0:
		return null
	var candidates := TargetingService.acquire_near_point(
		self,
		global_position,
		pointer_aim as Vector2,
		maxf(rules.range, POINTER_SELECTION_RANGE),
		radius,
		TargetingService.MAX_QUERY_RESULTS
	)
	for candidate: Node2D in candidates:
		if not require_line_of_sight or _has_attack_line_of_sight(candidate):
			return candidate
	return null


func _resolve_attack_target(
		rules: WeaponTargetRules,
		pointer_aim: Variant,
		_fallback_direction: Vector2,
		require_line_of_sight := false,
) -> Node2D:
	if rules == null:
		return null
	# An explicit RMB target always wins. Range affects whether an attack can
	# physically connect, not which enemy the player deliberately aimed at.
	if _has_locked_attack_target():
		_set_target_indicator(_locked_attack_target)
		return _locked_attack_target
	var direct := _acquire_pointer_target(rules, pointer_aim, require_line_of_sight)
	if direct != null:
		_set_locked_attack_target(direct)
		return direct
	return _select_auto_attack_target(require_line_of_sight)


func _select_auto_attack_target(require_line_of_sight := false) -> Node2D:
	var candidates: Array[Node2D] = []
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if not enemy.has_method(&"take_damage") or not _is_target_on_screen(enemy):
			continue
		if require_line_of_sight and not _has_attack_line_of_sight(enemy):
			continue
		candidates.append(enemy)
	if candidates.is_empty():
		_clear_target_indicator()
		return null
	var active := hero_soul_manager.active_hero
	var hero_id := active.hero_id if active != null else &"sword_hero"
	candidates.sort_custom(func(a: Node2D, b: Node2D) -> bool:
		var a_distance := global_position.distance_squared_to(a.global_position)
		var b_distance := global_position.distance_squared_to(b.global_position)
		match hero_id:
			&"archer_hero":
				var a_health := _read_numeric_property(a, &"health")
				var b_health := _read_numeric_property(b, &"health")
				if a_health < 0.0:
					a_health = INF
				if b_health < 0.0:
					b_health = INF
				if not is_equal_approx(a_health, b_health):
					return a_health < b_health
			&"wizard_hero":
				var a_ratio := CombatDamage.health_ratio(a)
				var b_ratio := CombatDamage.health_ratio(b)
				if not is_equal_approx(a_ratio, b_ratio):
					return a_ratio < b_ratio
		return a_distance < b_distance
	)
	var selected := candidates[0]
	_set_target_indicator(selected)
	return selected


func _is_target_on_screen(target: Node2D) -> bool:
	if not is_instance_valid(target) or get_viewport() == null:
		return false
	var screen_position := target.get_global_transform_with_canvas().origin
	return get_viewport().get_visible_rect().grow(24.0).has_point(screen_position)


func _pointer_is_over_input_ui() -> bool:
	var hovered := get_viewport().gui_get_hovered_control()
	return hovered != null and hovered.is_visible_in_tree() \
		and hovered.mouse_filter != Control.MOUSE_FILTER_IGNORE


func _start_action(action_name: String) -> bool:
	if dead or not current_action.is_empty() or not ACTION_PROFILES.has(action_name):
		return false
	if action_name == "dash" and dash_cooldown_remaining > 0.0:
		return false

	var profile: Dictionary = ACTION_PROFILES[action_name]
	var authored_cost := float(profile.get("stamina", 0.0))
	var uses_dash_mana := action_name == "dash"
	# Dash now spends half of its former stamina cost as mana (22 -> 11).
	var cost := authored_cost * 0.5 if uses_dash_mana else authored_cost
	if uses_dash_mana:
		if mana < cost:
			GameEvents.toast_requested.emit("Không đủ mana để lướt")
			return false
	elif stamina < cost:
		GameEvents.toast_requested.emit("Không đủ thể lực")
		return false

	current_action = action_name
	action_elapsed = 0.0
	if not _requested_action_direction.is_zero_approx():
		action_direction = _requested_action_direction.normalized()
		_requested_action_direction = Vector2.ZERO
	else:
		action_direction = move_input.normalized() if move_input.length_squared() > 0.01 else facing_direction
	if action_direction.length_squared() < 0.5:
		action_direction = Vector2.RIGHT
	_update_facing(action_direction)
	_last_hit_window = -1
	_hit_targets.clear()
	queued_combo = false
	if uses_dash_mana:
		_set_mana(mana - cost)
	else:
		_set_stamina(stamina - cost)
	weapon_manager.notify_action_uninterruptible()

	match action_name:
		"dash":
			var dash_origin := global_position
			_wizard_return_dash = wizard_runtime != null and wizard_runtime.should_override_next_dash()
			if _wizard_return_dash:
				var returned := wizard_runtime.begin_soul_return(dash_origin)
				var return_direction := dash_origin.direction_to(returned)
				if not return_direction.is_zero_approx():
					action_direction = return_direction
			dash_cooldown_remaining = hero_soul_manager.active_dash_cooldown(dash_cooldown)
			invulnerability_remaining = hero_soul_manager.active_dash_invulnerability(dash_duration)
			velocity = Vector2.ZERO if _wizard_return_dash else action_direction * hero_soul_manager.active_dash_speed(dash_speed)
			player_state = PlayerState.DASH
			weapon_manager.notify_dash_started(action_direction, {"origin": dash_origin, "wizard_soul_return": _wizard_return_dash})
		"dash_slash":
			var sword_skill := SWORD_DEFINITION.hand_skill
			var movement_time := maxf(sword_skill.movement_duration, 0.01)
			velocity = action_direction * (sword_skill.movement_distance / movement_time)
			_dash_slash_iframes_started = false
			if sword_skill.invulnerability_start_seconds <= 0.0:
				_dash_slash_iframes_started = true
				invulnerability_remaining = maxf(invulnerability_remaining, sword_skill.invulnerability_duration_seconds)
			collision_mask = _normal_collision_mask & ~ENEMY_COLLISION_BIT
			_dash_slash_collision_ignored = true
			_dash_slash_hit_count = 0
			player_state = PlayerState.SKILL
		"roll":
			invulnerability_remaining = roll_duration * 0.78
			velocity = action_direction * roll_speed
			player_state = PlayerState.DASH
		"slide":
			invulnerability_remaining = slide_duration * 0.55
			velocity = action_direction * slide_speed
			player_state = PlayerState.DASH
		"hop":
			invulnerability_remaining = hop_duration * 0.72
			velocity = action_direction * hop_speed
			player_state = PlayerState.DASH
		"sword_attack_1", "sword_attack_2", "sword_attack_3", "sword_attack_4", "sword_attack_5", "bow_attack", "axe_cleave":
			velocity = velocity.move_toward(Vector2.ZERO, 55.0)
			player_state = PlayerState.ATTACK
		"axe_charge":
			velocity = velocity.move_toward(Vector2.ZERO, 55.0)
			player_state = PlayerState.ATTACK
		"bow_volley", "axe_throw":
			velocity = velocity.move_toward(Vector2.ZERO, 55.0)
			player_state = PlayerState.SKILL
		"weapon_swap":
			velocity = Vector2.ZERO
			player_state = PlayerState.SWAP
		_:
			velocity = velocity.move_toward(Vector2.ZERO, 55.0)
			player_state = PlayerState.ATTACK

	_play_action_animation(action_name, _get_action_animation(action_name, profile))
	if action_name == "sword_attack_2" or _is_sword_pursuit_action(action_name):
		collision_mask = _normal_collision_mask & ~ENEMY_COLLISION_BIT
		_dash_slash_collision_ignored = true
	if action_name == "axe_charge" and _active_character_form_id == AXE_CHARACTER_FORM_ID:
		# Charging is a held anticipation, not a looping attack. Keeping frame 0
		# planted also prevents animation completion from settling on a smaller
		# recovery pose during long charges.
		sprite.set_frame_and_progress(0, 0.0)
		sprite.pause()
	RealtimeBridge.publish_event("player_action", {
		"action": action_name,
		"direction": [action_direction.x, action_direction.y],
	})
	return true


func _handle_action(delta: float) -> void:
	var action_speed := _archer_attack_speed_multiplier() if current_action == "bow_attack" else 1.0
	action_elapsed += delta * action_speed
	if current_action == "bow_attack" and not _archer_pending_shot.is_empty():
		var release_index := clampi(
			_archer_active_combo_step - 1,
			0,
			BOW_DEFINITION.normal_attack.hit_window_starts.size() - 1
		)
		if action_elapsed >= BOW_DEFINITION.normal_attack.hit_window_starts[release_index]:
			_release_archer_shot()
	if current_action == "axe_charge":
		velocity = velocity.move_toward(
			move_input
				* hero_soul_manager.active_move_speed(move_speed)
				* AXE_DEFINITION.normal_attack.movement_speed_multiplier,
			acceleration * delta
		)
		_axe_charge_snapshot = AXE_CHARGE_MATH.evaluate(AXE_DEFINITION.normal_attack, action_elapsed)
		_update_axe_charge_vfx()
		if _gameplay_action_just_released("attack"):
			_release_axe_charge()
		return
	if current_action == "light_attack" and _gameplay_action_just_pressed("light_attack") and action_elapsed >= 0.10:
		queued_combo = true
	if current_action in ["sword_attack_1", "sword_attack_2", "sword_attack_3", "sword_attack_4", "sword_attack_5", "bow_attack"] \
			and _gameplay_attack_just_pressed():
		_buffer_current_attack_press()
		if current_action != "bow_attack":
			_sword_combo_buffered = true
	if (
		current_action in ["sword_attack_1", "sword_attack_2", "sword_attack_3", "sword_attack_4", "sword_attack_5"]
		and SWORD_DEFINITION.normal_attack.hold_continues_combo
		and _gameplay_attack_pressed()
		and action_elapsed >= _get_action_duration(current_action) - SWORD_HERO.attack_buffer_seconds
	):
		_buffer_current_attack_press()
		_sword_combo_buffered = true

	match current_action:
		"dash":
			velocity = Vector2.ZERO if _wizard_return_dash else action_direction * hero_soul_manager.active_dash_speed(dash_speed)
		"dash_slash":
			var sword_skill := SWORD_DEFINITION.hand_skill
			if action_elapsed <= sword_skill.movement_duration:
				velocity = action_direction * (sword_skill.movement_distance / maxf(sword_skill.movement_duration, 0.01))
			else:
				velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
				_restore_dash_slash_collision()
			if not _dash_slash_iframes_started and action_elapsed >= sword_skill.invulnerability_start_seconds:
				_dash_slash_iframes_started = true
				invulnerability_remaining = maxf(invulnerability_remaining, sword_skill.invulnerability_duration_seconds)
		"roll":
			velocity = action_direction * roll_speed
		"slide":
			velocity = velocity.move_toward(action_direction * slide_speed * 0.52, friction * 0.20 * delta)
		"hop":
			velocity = velocity.move_toward(action_direction * hop_speed * 0.72, friction * 0.12 * delta)
			_update_hop_visual()
		"sword_attack_2":
			# Passing Slash crosses the body while walls continue to resolve via
			# CharacterBody2D. Enemy collision alone is temporarily ignored.
			if action_elapsed <= 0.24:
				velocity = action_direction * 176.0
			else:
				velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		"sword_attack_3", "sword_attack_4":
			if _is_sword_wave_action(current_action):
				# The Hero recoils opposite the wave direction. This is movement only;
				# it grants no invulnerability.
				if action_elapsed >= 0.12 and action_elapsed <= 0.40:
					velocity = -action_direction * (SWORD_HERO.combo_3_recoil_distance / 0.28)
				else:
					velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
			elif _is_sword_pursuit_action(current_action):
				var dash_start := SWORD_HERO.combo_4_dash_start_seconds
				var dash_time := maxf(SWORD_HERO.combo_4_dash_duration_seconds, 0.01)
				if action_elapsed >= dash_start and action_elapsed <= dash_start + dash_time:
					velocity = action_direction * (_current_sword_pursuit_dash_distance / dash_time)
				else:
					velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
			else:
				velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		"sword_attack_5":
			var dash_start := SWORD_HERO.combo_4_dash_start_seconds
			var dash_duration := maxf(SWORD_HERO.combo_4_dash_duration_seconds, 0.01)
			if action_elapsed >= dash_start and action_elapsed <= dash_start + dash_duration:
				velocity = action_direction * (_current_sword_pursuit_dash_distance / dash_duration)
			else:
				velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		"bow_attack":
			if _archer_active_combo_step == 2 and action_elapsed <= ARCHER_HERO.archer_split_step_duration:
				velocity = _archer_split_step_direction * (
					ARCHER_HERO.archer_split_step_distance / maxf(0.01, ARCHER_HERO.archer_split_step_duration)
				)
			else:
				var step_index := clampi(_archer_active_combo_step - 1, 0, ARCHER_HERO.archer_move_speed_multipliers.size() - 1)
				var move_multiplier := ARCHER_HERO.archer_move_speed_multipliers[step_index]
				if _archer_active_combo_step == 3 and action_elapsed >= 0.40:
					move_multiplier = 0.65
				velocity = velocity.move_toward(
					move_input * hero_soul_manager.active_move_speed(move_speed) * move_multiplier,
					acceleration * delta
				)
		"bow_volley":
			velocity = velocity.move_toward(
				move_input
					* hero_soul_manager.active_move_speed(move_speed)
					* BOW_DEFINITION.hand_skill.movement_speed_multiplier,
				acceleration * delta
			)
		"wizard_attack":
			velocity = velocity.move_toward(
				move_input * hero_soul_manager.active_move_speed(move_speed) * 0.70,
				acceleration * delta
			)
		"wizard_passage":
			# Dark Passage resolves its teleport instantly; it must not masquerade
			# as a frame hitch by freezing input for the rest of the cast animation.
			velocity = velocity.move_toward(
				move_input * hero_soul_manager.active_move_speed(move_speed) * 0.85,
				acceleration * delta
			)
		"axe_throw":
			velocity = velocity.move_toward(
				move_input
					* hero_soul_manager.active_move_speed(move_speed)
					* AXE_DEFINITION.hand_skill.movement_speed_multiplier,
				acceleration * delta
			)
			if _gameplay_skill_just_pressed():
				_request_axe_recall()
			if _gameplay_action_just_pressed("dash") and dash_cooldown_remaining <= 0.0:
				current_action = ""
				action_elapsed = 0.0
				weapon_manager.notify_action_interruptible()
				_start_action("dash")
				return
		_:
			velocity = velocity.move_toward(Vector2.ZERO, friction * 0.48 * delta)

	var profile: Dictionary = ACTION_PROFILES[current_action]
	var duration := _get_action_duration(current_action)
	match current_action:
		"dash": duration = dash_duration
		"roll": duration = roll_duration
		"slide": duration = slide_duration
		"hop": duration = hop_duration
	if action_elapsed >= duration:
		_finish_action()


func _update_hop_visual() -> void:
	var progress := clampf(action_elapsed / maxf(hop_duration, 0.01), 0.0, 1.0)
	sprite.position = _active_sprite_rest_position + Vector2.UP * sin(progress * PI) * hop_height
	if progress > 0.68:
		_play_animation("fall")
	elif progress > 0.42:
		_play_animation("jump_to_fall")


func _finish_action() -> void:
	var finished_action := current_action
	var finished_sword_step := _sword_combo_index(finished_action) + 1
	var was_hero_combo := finished_sword_step > 0 and _current_sword_attack_instance_id > 0
	var continue_hero_combo := _sword_combo_buffered
	var queued_pointer_aim: Variant = (
		_queued_attack_pointer_world if _queued_attack_pointer_valid else null
	)
	var continue_weapon_combo := _queued_weapon_attack \
		and finished_action in ["sword_attack_1", "sword_attack_2", "sword_attack_3", "bow_attack"] \
		and not was_hero_combo
	current_action = ""
	action_elapsed = 0.0
	sprite.position = _active_sprite_rest_position
	_last_hit_window = -1
	_hit_targets.clear()
	if finished_action == "bow_attack":
		_archer_pending_shot.clear()
	if finished_action == "bow_volley":
		_commit_archer_mark()
	if finished_action == "dash_slash":
		_restore_dash_slash_collision()
		weapon_manager.notify_hand_skill_resolved({
			"source_weapon_id": &"sword",
			"endpoint": global_position,
			"hit_count": _dash_slash_hit_count,
			"has_meaningful_endpoint": true,
			"skill_instance_id": _active_skill_instance_id,
		})
		_active_skill_instance_id = 0
	if finished_action == "dash":
		weapon_manager.notify_dash_completed(action_direction, {"endpoint": global_position})
		if _wizard_return_dash and wizard_runtime != null:
			wizard_runtime.finish_return_dash()
		_wizard_return_dash = false
	if finished_action == "sword_attack_2" or _is_sword_pursuit_action(finished_action):
		_restore_dash_slash_collision()
	if finished_action == "light_attack":
		if queued_combo and stamina >= 8.0:
			queued_combo = false
			_start_action("combo_attack")
			return
		combo_memory_remaining = combo_reset_time
	queued_combo = false
	_queued_weapon_attack = false
	_sword_combo_buffered = false
	_queued_attack_pointer_valid = false
	player_state = PlayerState.MOVE if move_input.length_squared() > 0.01 else PlayerState.IDLE
	weapon_manager.notify_action_interruptible()
	if was_hero_combo:
		_current_sword_attack_instance_id = 0
		_finish_sword_hero_combo_step(finished_sword_step, continue_hero_combo, queued_pointer_aim)
		_restore_locomotion_facing_if_idle()
		return
	if continue_weapon_combo and current_action.is_empty() and not weapon_manager.is_swap_in_progress():
		_start_hand_attack(true, queued_pointer_aim)
	_restore_locomotion_facing_if_idle()


## Movement and attack aim are deliberately separate vectors. While a combat
## action is alive, only its immutable action snapshot may drive presentation.
func _action_locks_visual_facing() -> bool:
	return not current_action.is_empty() and player_state in [PlayerState.ATTACK, PlayerState.SKILL]


## The first idle frame should already reflect held movement input; no one-frame
## backwards pose is allowed after recovery. A chained action keeps ownership.
func _restore_locomotion_facing_if_idle() -> void:
	if not current_action.is_empty() or move_input.length_squared() <= 0.01:
		return
	_update_facing(move_input.normalized())


func _get_action_duration(action_name: String) -> float:
	var combo_index := _sword_authored_combo_index(action_name)
	if combo_index >= 0 and combo_index < SWORD_HERO.combo_action_durations.size():
		return SWORD_HERO.combo_action_durations[combo_index]
	match action_name:
		"dash_slash":
			return SWORD_DEFINITION.hand_skill.action_duration
		"bow_attack":
			return BOW_DEFINITION.normal_attack.action_durations[
				clampi(_archer_active_combo_step - 1, 0, BOW_DEFINITION.normal_attack.action_durations.size() - 1)
			]
		"bow_volley":
			return BOW_DEFINITION.hand_skill.action_duration
		"axe_cleave":
			return AXE_DEFINITION.normal_attack.action_durations[0]
		"axe_throw":
			return AXE_DEFINITION.hand_skill.action_duration
	var profile: Dictionary = ACTION_PROFILES.get(action_name, {})
	return float(profile.get("duration", 0.1))


func _get_action_animation(action_name: String, profile: Dictionary) -> StringName:
	var animation := StringName(profile.get("animation", &"idle"))
	var combo_index := _sword_authored_combo_index(action_name)
	if combo_index >= 0 and combo_index < SWORD_HERO.combo_animation_names.size():
		animation = SWORD_HERO.combo_animation_names[combo_index]
	elif action_name == "dash_slash":
		animation = SWORD_DEFINITION.hand_skill.animation_name
	elif action_name == "bow_attack" and not BOW_DEFINITION.normal_attack.animation_names.is_empty():
		animation = StringName(BOW_DEFINITION.normal_attack.animation_names[
			clampi(_archer_active_combo_step - 1, 0, BOW_DEFINITION.normal_attack.animation_names.size() - 1)
		])
	elif action_name == "bow_volley":
		animation = BOW_DEFINITION.hand_skill.animation_name
	elif action_name == "axe_cleave" and not AXE_DEFINITION.normal_attack.animation_names.is_empty():
		animation = StringName(AXE_DEFINITION.normal_attack.animation_names[0])
	elif action_name == "axe_throw":
		animation = AXE_DEFINITION.hand_skill.animation_name
	if not sprite.sprite_frames.has_animation(animation):
		var fallback := StringName(profile.get("animation", &"idle"))
		if sprite.sprite_frames.has_animation(fallback):
			return fallback
		push_error("KnightController: action '%s' has no valid authored animation" % action_name)
		return &"idle"
	return animation


func _get_action_hit_windows(action_name: String, profile: Dictionary) -> Array:
	var combo_index := _sword_authored_combo_index(action_name)
	if combo_index >= 0:
		var hero_window := SWORD_HERO.combo_hit_windows[combo_index]
		return [[hero_window.x, hero_window.y]]
	if action_name == "dash_slash":
		return [[
			SWORD_DEFINITION.hand_skill.hit_window_start_seconds,
			SWORD_DEFINITION.hand_skill.hit_window_end_seconds,
		]]
	if action_name == "axe_cleave":
		return [[
			AXE_DEFINITION.normal_attack.hit_window_starts[0],
			AXE_DEFINITION.normal_attack.hit_window_ends[0],
		]]
	return profile.get("windows", []) as Array


func _get_action_damage(action_name: String, profile: Dictionary, active_window: int) -> int:
	var authored_damage := float(light_damage)
	var logical_combo_index := _sword_combo_index(action_name)
	var combo_index := _sword_authored_combo_index(action_name)
	if combo_index >= 0:
		authored_damage = SWORD_HERO.combo_damage(
			combo_index + 1,
			combo_index == 3 and not _current_sword_pursuit_has_target
		)
	elif action_name == "dash_slash":
		authored_damage = SWORD_DEFINITION.hand_skill.damage
	elif action_name == "axe_cleave":
		authored_damage = float(_axe_charge_snapshot.get(
			"damage",
			roundi(AXE_DEFINITION.normal_attack.combo_damage[0])
		))
	else:
		var damages: Array = profile.get("damage", [light_damage])
		authored_damage = float(damages[active_window]) if active_window >= 0 and active_window < damages.size() else float(light_damage)
	if logical_combo_index >= 0 or action_name == "axe_cleave":
		return _scale_active_action_damage(&"normal_attack", authored_damage)
	return _scale_active_combat_damage(authored_damage)


func _sword_combo_index(action_name: String) -> int:
	match action_name:
		"sword_attack_1": return 0
		"sword_attack_2": return 1
		"sword_attack_3": return 2
		"sword_attack_4": return 3
		"sword_attack_5": return 4
	return -1


func _sword_authored_combo_index(action_name: String) -> int:
	var logical := _sword_combo_index(action_name)
	if logical < 0:
		return -1
	return clampi(logical, 0, SWORD_HERO.combo_step_count() - 1)


func _sword_combo_total_steps() -> int:
	return SWORD_HERO.combo_step_count()


func _sword_wave_step() -> int:
	return 3


func _sword_pursuit_step() -> int:
	return 4


func _is_sword_wave_action(action_name: String) -> bool:
	return _sword_combo_index(action_name) + 1 == _sword_wave_step()


func _is_sword_pursuit_action(action_name: String) -> bool:
	return _sword_combo_index(action_name) + 1 == _sword_pursuit_step()


func _is_sword_inserted_cavalry_action(action_name: String) -> bool:
	return false


func _is_legendary_plus_active_kit() -> bool:
	if hero_soul_manager == null or hero_soul_manager.active_hero == null:
		return false
	return int(hero_soul_manager.get_active_skill_kit_snapshot().get("kit_tier", 0)) >= 2


func _restore_dash_slash_collision() -> void:
	if not _dash_slash_collision_ignored:
		return
	_dash_slash_collision_ignored = false
	collision_mask = _normal_collision_mask


func _handle_hit_state(delta: float) -> void:
	action_elapsed += delta
	velocity = velocity.move_toward(Vector2.ZERO, friction * 0.32 * delta)
	if action_elapsed >= 0.28:
		current_action = ""
		action_elapsed = 0.0
		player_state = PlayerState.IDLE
		weapon_manager.notify_action_interruptible()


func _apply_attack_hits() -> void:
	if not ACTION_PROFILES.has(current_action):
		return
	var profile: Dictionary = ACTION_PROFILES[current_action]
	var windows: Array = _get_action_hit_windows(current_action, profile)
	var active_window := -1
	for index: int in range(windows.size()):
		var window: Array = windows[index]
		if action_elapsed >= float(window[0]) and action_elapsed <= float(window[1]):
			active_window = index
			break
	if active_window < 0:
		_last_hit_window = -1
		return
	if active_window != _last_hit_window:
		_last_hit_window = active_window
		_hit_targets.clear()

	var damage := _get_action_damage(current_action, profile, active_window)
	match current_action:
		"light_attack": damage = _scale_active_combat_damage(light_damage)
		"heavy_attack": damage = _scale_active_combat_damage(heavy_damage)
		"crouch_attack": damage = _scale_active_combat_damage(crouch_damage)
	if _sword_combo_index(current_action) >= 0 \
			and active_window == 0 \
			and _current_sword_attack_instance_id > 0:
		_queue_sword_echo_for_attack_window(damage)
	if current_action == "axe_cleave":
		_apply_axe_cleave_hits(damage)
		return
	if _is_sword_wave_action(current_action) or _is_sword_inserted_cavalry_action(current_action):
		# Crescent Recoil damage and pursuit ownership come from its authored
		# travelling wave (or the inserted rider), not a duplicate melee box.
		return

	for body: Node2D in attack_hitbox.get_overlapping_bodies():
		if body == self or _hit_targets.has(body.get_instance_id()):
			continue
		if not _has_attack_line_of_sight(body):
			continue
		if body.has_method("take_damage"):
			_hit_targets[body.get_instance_id()] = true
			if current_action in ["sword_attack_1", "sword_attack_2", "sword_attack_3", "sword_attack_4", "sword_attack_5", "dash_slash"]:
				var health_before := _read_numeric_property(body, &"health")
				var combo_step := _sword_combo_index(current_action) + 1
				var finisher_step := _sword_pursuit_step()
				if combo_step == finisher_step and body != _sword_pursuit_target:
					continue
				var finisher_fallback := combo_step == finisher_step and not _current_sword_pursuit_has_target
				var hit_stop_values := [0.035, 0.040, 0.045, 0.055, 0.055 if finisher_fallback else 0.075]
				var impact_values := [0.78, 0.92, 1.10, 1.45, 1.45 if finisher_fallback else 1.90]
				# K-Night's real afterimages resolve later from a damage snapshot;
				# they are never represented as an immediate duplicate sub-hit.
				var shadow_double := false
				var confirmed_strikes := 0
				for strike_index: int in range(2 if shadow_double else 1):
					var resolved_damage := damage
					if combo_step == finisher_step:
						resolved_damage = KNightRules.execution_damage(
							damage,
							_read_numeric_property(body, &"health"),
							_read_numeric_property(body, &"max_health"),
						)
					var hit_context := {
						"attack_instance_id": _current_sword_attack_instance_id,
						"hero_id": &"sword_hero",
						"attack_id": StringName(current_action),
						"combo_step": combo_step,
						"combo_count": combo_step,
						"sub_hit_index": strike_index + 1,
						"sub_hit_count": 2 if shadow_double else 1,
						"cue_id": &"combo_finisher" if combo_step == finisher_step else &"sword_hit",
						"hit_stop_seconds": hit_stop_values[clampi(combo_step - 1, 0, 4)],
						"impact_strength": impact_values[clampi(combo_step - 1, 0, 4)],
						"direction": action_direction,
						"is_critical": combo_step == finisher_step and not finisher_fallback,
					}
					if not CombatDamage.apply_confirmed(
						body, resolved_damage, global_position, &"sword_hero", hit_context
					):
						continue
					confirmed_strikes += 1
					GameSession.add_score(resolved_damage)
					weapon_manager.notify_enemy_damaged(
						body, resolved_damage, {"source": current_action}
					)
					if current_action == "dash_slash":
						_dash_slash_hit_count += 1
					else:
						weapon_manager.notify_hand_attack_hit({
							"target": body,
							"damage": resolved_damage,
						})
					if shadow_double and strike_index == 1:
						VfxCatalog.spawn(
							_effects_root(), &"echo_ribbon", body.global_position,
							action_direction.angle(), 0.9,
							Color(0.02, 0.02, 0.04, 0.72), 7,
						)
				if confirmed_strikes == 0:
					continue
				if combo_step == 2:
					CombatDamage.apply_slow(
						body,
						KNightRules.COMBO_TWO_SLOW_RATIO,
						KNightRules.COMBO_TWO_SLOW_SECONDS,
						{"hero_id": &"sword_hero", "combo_step": 2},
					)
				if _is_sword_wave_action(current_action) and not is_instance_valid(_sword_pursuit_target):
					_sword_pursuit_target = body
				var health_after := _read_numeric_property(body, &"health")
				if health_before > 0.0 and health_after >= 0.0 and health_after <= 0.0:
					weapon_manager.notify_enemy_killed(body, {"source": current_action})
			else:
				body.take_damage(damage, global_position)
				GameSession.add_score(damage)
			RealtimeBridge.publish_event("enemy_hit", {
				"damage": damage * (2 if current_action.begins_with("sword_attack_") \
					and _kit_buff_id == &"knight_shadow_double" \
					and _kit_buff_seconds_left > 0.0 else 1),
				"target": body.name,
				"hero": "sword_hero" if current_action.begins_with("sword_") or current_action == "dash_slash" else "legacy",
			})


func _apply_axe_cleave_hits(damage: int) -> void:
	var arc_degrees := float(_axe_charge_snapshot.get(
		"arc_degrees",
		AXE_DEFINITION.normal_attack.quick_release_arc_degrees
	))
	var stagger := float(_axe_charge_snapshot.get(
		"stagger",
		AXE_DEFINITION.normal_attack.combo_stagger[0]
	))
	var candidates := TargetingService.acquire_up_to(
		self,
		global_position,
		action_direction,
		AXE_DEFINITION.normal_attack.target_rules.range,
		arc_degrees,
		AXE_DEFINITION.normal_attack.target_rules.maximum_targets
	)
	for body: Node2D in candidates:
		var target_id := body.get_instance_id()
		if _hit_targets.has(target_id) or not _has_attack_line_of_sight(body):
			continue
		_hit_targets[target_id] = true
		var health_before := _read_numeric_property(body, &"health")
		if not CombatDamage.apply_confirmed(body, damage, global_position, &"axe", {
			"hero_id": &"axe_hero",
			"source_kind": &"normal_attack",
			"attack_id": &"axe_cleave",
		}):
			continue
		CombatDamage.apply_stagger(body, stagger, {
			"source_weapon_id": &"axe",
			"attack_id": &"heavy_cleave",
			"charge_ratio": float(_axe_charge_snapshot.get("charge_ratio", 0.0)),
		})
		GameSession.add_score(damage)
		var context := {
			"source_weapon_id": &"axe",
			"source": &"axe_cleave",
			"target": body,
			"damage": damage,
			"stagger": stagger,
			"arc_degrees": arc_degrees,
			"charge_ratio": float(_axe_charge_snapshot.get("charge_ratio", 0.0)),
		}
		weapon_manager.notify_enemy_damaged(body, damage, context)
		weapon_manager.notify_hand_attack_hit(context)
		var health_after := _read_numeric_property(body, &"health")
		if health_before > 0.0 and health_after >= 0.0 and health_after <= 0.0:
			weapon_manager.notify_enemy_killed(body, context)
		RealtimeBridge.publish_event("enemy_hit", {
			"damage": damage,
			"target": body.name,
			"weapon": "axe",
			"charge_ratio": context["charge_ratio"],
		})


func _has_attack_line_of_sight(target: Node2D) -> bool:
	var query := PhysicsRayQueryParameters2D.create(
		global_position + BODY_CENTER_OFFSET,
		target.global_position + Vector2(0.0, -7.0),
		1,
		[get_rid()]
	)
	return get_world_2d().direct_space_state.intersect_ray(query).is_empty()


func _update_facing(direction: Vector2) -> void:
	if direction.length_squared() < 0.01:
		return
	var normalized := direction.normalized()
	facing_direction = normalized
	if absf(normalized.x) > 0.20:
		var next_horizontal := 1 if normalized.x > 0.0 else -1
		if next_horizontal != _last_horizontal_facing and velocity.length() > 16.0:
			turn_remaining = 0.13
		_last_horizontal_facing = next_horizontal
		sprite.flip_h = next_horizontal < 0
		if is_instance_valid(hand_weapon_visual):
			hand_weapon_visual.scale.x = next_horizontal
	_update_attack_transform()


func _update_attack_transform() -> void:
	var direction := facing_direction.normalized()
	attack_hitbox.position = BODY_CENTER_OFFSET + direction * 17.0
	attack_hitbox.rotation = direction.angle()
	_hide_legacy_weapon_visuals()


func _update_animation() -> void:
	if dead or not current_action.is_empty():
		return
	if _armed_skill_charge_started \
			and StringName(_armed_hero_skill_profile.get("id", &"")) == &"knight_fan_charge":
		if sprite.animation != &"heavy_attack":
			sprite.stop()
			sprite.animation = &"heavy_attack"
			sprite.set_frame_and_progress(2, 0.0)
		return
	if _kit_release_animation_left > 0.0:
		return
	if turn_remaining > 0.0 and velocity.length() > 8.0:
		_play_animation("turn")
		return
	if _gameplay_action_pressed("crouch"):
		_play_animation("crouch_walk" if velocity.length() > 5.0 else "crouch")
	elif velocity.length() > 7.0:
		_play_animation("run")
	else:
		_play_animation("idle")


func _play_animation(animation_name: StringName, restart := false) -> void:
	if not sprite.sprite_frames.has_animation(animation_name):
		push_warning("KnightController: missing authored animation '%s'" % animation_name)
		return
	if restart:
		sprite.stop()
		sprite.animation = animation_name
		sprite.set_frame_and_progress(0, 0.0)
		sprite.play(animation_name)
	elif sprite.animation != animation_name or not sprite.is_playing():
		sprite.play(animation_name)


func _play_action_animation(action_name: String, animation_name: StringName) -> void:
	if (
		_active_character_form_id != ARCHER_CHARACTER_FORM_ID
		or action_name not in ["bow_attack", "bow_volley"]
		or not sprite.sprite_frames.has_animation(animation_name)
	):
		_play_animation(animation_name, true)
		return
	var frame_count := sprite.sprite_frames.get_frame_count(animation_name)
	var authored_fps := sprite.sprite_frames.get_animation_speed(animation_name)
	var clip_seconds := float(frame_count) / maxf(authored_fps, 0.01)
	var playback_scale := clip_seconds / maxf(_get_action_duration(action_name), 0.01)
	if action_name == "bow_attack":
		playback_scale *= _archer_attack_speed_multiplier()
	sprite.stop()
	sprite.animation = animation_name
	sprite.set_frame_and_progress(0, 0.0)
	sprite.play(animation_name, playback_scale)


func _regenerate_stamina(delta: float) -> void:
	if current_action in ["dash", "roll", "slide", "hop"]:
		return
	_set_stamina(minf(max_stamina, stamina + stamina_regen * delta))


func _regenerate_health(delta: float) -> void:
	if dead or delta <= 0.0 or health >= max_health:
		if health >= max_health:
			_health_regen_fraction = 0.0
		return
	var per_second := hero_soul_manager.active_health_regen_per_second(float(max_health))
	if per_second <= 0.0:
		_health_regen_fraction = 0.0
		return
	_health_regen_fraction += per_second * delta
	var whole_health := floori(_health_regen_fraction)
	if whole_health <= 0:
		return
	_health_regen_fraction -= float(whole_health)
	health = mini(max_health, health + whole_health)
	_emit_health()


func can_receive_healing() -> bool:
	return not dead and health > 0 and health < max_health


func restore_health_percent(max_health_ratio: float) -> int:
	if not can_receive_healing() or max_health_ratio <= 0.0:
		return 0
	var authored_amount := float(max_health) * clampf(max_health_ratio, 0.0, 1.0)
	var requested := maxi(1, roundi(hero_soul_manager.active_healing_amount(authored_amount)))
	var previous := health
	health = mini(max_health, health + requested)
	var restored := health - previous
	if restored > 0:
		_emit_health()
	return restored


func _regenerate_mana(delta: float) -> void:
	if dead or delta <= 0.0 or mana >= max_mana:
		return
	_set_mana(minf(max_mana, mana + hero_soul_manager.active_mana_regen_per_second() * delta))


func _set_stamina(value: float) -> void:
	stamina = clampf(value, 0.0, max_stamina)
	_emit_stamina()


func _set_mana(value: float) -> void:
	mana = clampf(value, 0.0, max_mana)
	_emit_mana()


func _emit_health() -> void:
	if not _health_active_hero_id.is_empty():
		var active_key := String(_health_active_hero_id)
		_hero_health_current[active_key] = float(health)
		_hero_health_maximum[active_key] = float(max_health)
	health_changed.emit(health, max_health)
	GameEvents.player_health_changed.emit(health, max_health)
	_emit_hero_health_pools()


func _regenerate_reserve_soul_health(delta: float) -> void:
	if dead or delta <= 0.0 or hero_soul_manager == null or hero_soul_manager.reserve_soul == null:
		return
	var reserve_key := String(hero_soul_manager.reserve_soul.hero_id)
	var reserve_max := float(_hero_health_maximum.get(reserve_key, max_health))
	var reserve_current := float(_hero_health_current.get(reserve_key, reserve_max))
	# Zero HP is defeated, not a regeneration seed; this keeps the removal of
	# resurrection strict while still rewarding a living reserve Soul.
	if reserve_current <= 0.0 or reserve_current >= reserve_max:
		return
	_hero_health_current[reserve_key] = minf(
		reserve_max,
		reserve_current + reserve_max * RESERVE_SOUL_HEALTH_REGEN_RATIO_PER_SECOND * delta
	)
	_emit_hero_health_pools()


func _emit_hero_health_pools(force := false) -> void:
	var snapshot := get_hero_health_snapshot()
	var signature := "%s:%d/%d+%d/%d|%s:%d/%d" % [
		String(snapshot.get("active_hero_id", "")),
		int(snapshot.get("active_current", 0)),
		int(snapshot.get("active_maximum", 0)),
		int(snapshot.get("active_barrier", 0)),
		int(snapshot.get("active_barrier_maximum", 0)),
		String(snapshot.get("reserve_hero_id", "")),
		int(snapshot.get("reserve_current", 0)),
		int(snapshot.get("reserve_maximum", 0)),
	]
	if not force and signature == _last_health_pool_signature:
		return
	_last_health_pool_signature = signature
	GameEvents.hero_health_pools_changed.emit(snapshot)


func get_hero_health_snapshot() -> Dictionary:
	var active := hero_soul_manager.active_hero if hero_soul_manager != null else null
	var reserve := hero_soul_manager.reserve_soul if hero_soul_manager != null else null
	var active_id := active.hero_id if active != null else _health_active_hero_id
	var reserve_id := reserve.hero_id if reserve != null else &""
	var active_key := String(active_id)
	var reserve_key := String(reserve_id)
	var active_maximum := float(_hero_health_maximum.get(active_key, max_health))
	var reserve_maximum := float(_hero_health_maximum.get(reserve_key, 0.0))
	return {
		"active_hero_id": String(active_id),
		"active_name": active.display_name if active != null else "Hero",
		"active_current": roundi(float(_hero_health_current.get(active_key, health))),
		"active_maximum": roundi(active_maximum),
		"active_barrier": roundi(float(_hero_barrier_current.get(active_key, barrier))),
		"active_barrier_maximum": roundi(float(_hero_barrier_maximum.get(active_key, max_barrier))),
		"reserve_hero_id": String(reserve_id),
		"reserve_name": reserve.display_name if reserve != null else "",
		"reserve_current": roundi(float(_hero_health_current.get(reserve_key, reserve_maximum))),
		"reserve_maximum": roundi(reserve_maximum),
		"reserve_regen_percent_per_second": 10.0,
	}


func _emit_stamina(force := false) -> void:
	if not force and absf(stamina - _last_stamina_sent) < 0.35:
		return
	_last_stamina_sent = stamina
	stamina_changed.emit(stamina, max_stamina)
	GameEvents.player_stamina_changed.emit(stamina, max_stamina)


func _emit_mana(force := false) -> void:
	if not force and absf(mana - _last_mana_sent) < 0.05:
		return
	_last_mana_sent = mana
	mana_changed.emit(mana, max_mana)
	GameEvents.player_mana_changed.emit(mana, max_mana)


## Canonical incoming-hit handshake. Enemy damage helpers merge this Dictionary
## into their CombatResolver request only when `take_resolved_damage` is also
## available, preventing target defense from being applied on both sides.
func get_incoming_damage_context() -> Dictionary:
	return hero_soul_manager.build_active_incoming_damage_options(
		_is_attack_or_skill_action_active(),
		_is_actively_moving_for_footwork()
	)


## Legacy entry point for hazards/older callers that have not resolved target
## context. It retains the historical local mitigation behavior exactly.
func take_damage(amount: int, source_position := Vector2.ZERO) -> bool:
	if amount <= 0 or dead or invulnerability_remaining > 0.0:
		return false
	if _try_visible_dodge():
		return false
	return _apply_incoming_damage(amount, source_position, null)


## Canonical enemy hits arrive after CombatResolver has already consumed the
## context returned above. Never mitigate again here: this is the one-round path.
func take_resolved_damage(
		amount: int,
		source_position := Vector2.ZERO,
		resolution_context: Dictionary = {},
) -> bool:
	if amount <= 0 or dead or invulnerability_remaining > 0.0:
		return false
	if _try_visible_dodge():
		return false
	var source_enemy: Node
	var request_value: Variant = resolution_context.get("request", {})
	if request_value is Dictionary:
		var source_id := int((request_value as Dictionary).get(
			"source_enemy_instance_id", 0
		))
		if source_id > 0:
			source_enemy = instance_from_id(source_id) as Node
	return _apply_incoming_damage(amount, source_position, source_enemy)


func _apply_incoming_damage(
		amount: int,
		source_position: Vector2,
		source_enemy: Node = null,
) -> bool:
	if amount <= 0:
		return false
	var absorbed := mini(barrier, amount)
	if absorbed > 0:
		barrier -= absorbed
		if not _health_active_hero_id.is_empty():
			_hero_barrier_current[String(_health_active_hero_id)] = float(barrier)
		GameEvents.toast_requested.emit("GIÁP ẢO  •  -%d" % absorbed)
		_flash_visible_defense(Color(0.45, 0.88, 1.0, 1.0))
		amount -= absorbed
		_emit_hero_health_pools(true)
	if amount <= 0:
		invulnerability_remaining = hit_invulnerability
		RealtimeBridge.publish_event("player_barrier_hit", {
			"absorbed": absorbed, "barrier": barrier, "health": health,
		})
		return true
	if hero_soul_manager.active_hero != null \
			and hero_soul_manager.active_hero.hero_id == &"sword_hero":
		var damage_source := source_enemy if is_instance_valid(source_enemy) \
			else _nearest_enemy_to_damage_origin(source_position)
		if damage_source != null:
			record_k_night_damage_from(damage_source, amount)
	health = maxi(0, health - amount)
	invulnerability_remaining = hit_invulnerability
	_emit_health()
	RealtimeBridge.publish_event("player_damaged", {"amount": amount, "health": health})
	if health <= 0:
		if _try_relay_to_living_reserve():
			return true
		_die()
		return true
	_reset_sword_combo(&"forced")
	_reset_archer_state(&"damaged")
	_cancel_axe_charge()
	current_action = "hit"
	player_state = PlayerState.HURT
	_restore_dash_slash_collision()
	weapon_manager.notify_action_uninterruptible()
	weapon_manager.notify_player_damaged(amount, {"source_position": source_position})
	action_elapsed = 0.0
	sprite.position = _active_sprite_rest_position
	var knockback_direction := -facing_direction
	if source_position != Vector2.ZERO:
		knockback_direction = (global_position - source_position).normalized()
		if knockback_direction.length_squared() < 0.1:
			knockback_direction = -facing_direction
	velocity = knockback_direction * 112.0
	_play_animation("hit", true)
	return true


func record_k_night_damage_from(source: Node, amount: int) -> bool:
	if not is_instance_valid(source) or amount <= 0:
		return false
	var target_id := source.get_instance_id()
	var entry: Dictionary = _k_night_damage_ledger.get(target_id, {
		"target": weakref(source),
		"events": [],
	})
	var events: Array = entry.get("events", [])
	events.append({
		"time": Time.get_ticks_msec() / 1000.0,
		"damage": amount,
	})
	entry["events"] = events
	_k_night_damage_ledger[target_id] = entry
	_prune_k_night_damage_ledger()
	return true


func get_k_night_damage_from_target(target: Node) -> float:
	if not is_instance_valid(target):
		return 0.0
	_prune_k_night_damage_ledger()
	var entry: Dictionary = _k_night_damage_ledger.get(target.get_instance_id(), {})
	var total := 0.0
	for event: Variant in entry.get("events", []):
		if event is Dictionary:
			total += maxf(0.0, float((event as Dictionary).get("damage", 0.0)))
	return total


func get_current_combat_target() -> Node2D:
	if _has_locked_attack_target():
		return _locked_attack_target
	if is_instance_valid(_sword_pursuit_target) and CombatDamage.is_alive(_sword_pursuit_target):
		return _sword_pursuit_target
	if is_instance_valid(_target_indicator_target) and CombatDamage.is_alive(_target_indicator_target):
		return _target_indicator_target
	return null


func is_hero_alive(hero_id: StringName) -> bool:
	var key := String(hero_id)
	if hero_soul_manager.active_hero != null \
			and hero_soul_manager.active_hero.hero_id == hero_id:
		return not dead and health > 0
	return float(_hero_health_current.get(key, 0.0)) > 0.0


func _prune_k_night_damage_ledger() -> void:
	var cutoff := Time.get_ticks_msec() / 1000.0 \
		- KNightRules.REVENGE_DAMAGE_WINDOW_SECONDS
	for target_id: Variant in _k_night_damage_ledger.keys():
		var entry: Dictionary = _k_night_damage_ledger[target_id]
		var target_ref := entry.get("target") as WeakRef
		if target_ref == null or not is_instance_valid(target_ref.get_ref()):
			_k_night_damage_ledger.erase(target_id)
			continue
		var fresh: Array = []
		for event: Variant in entry.get("events", []):
			if event is Dictionary and float((event as Dictionary).get("time", -INF)) >= cutoff:
				fresh.append(event)
		if fresh.is_empty():
			_k_night_damage_ledger.erase(target_id)
		else:
			entry["events"] = fresh
			_k_night_damage_ledger[target_id] = entry


func _nearest_enemy_to_damage_origin(source_position: Vector2) -> Node2D:
	if source_position == Vector2.ZERO:
		return null
	var best: Node2D
	var best_distance := 48.0 * 48.0
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var distance := source_position.distance_squared_to(
			(candidate as Node2D).global_position
		)
		if distance <= best_distance:
			best_distance = distance
			best = candidate as Node2D
	return best


func _try_visible_dodge() -> bool:
	var snapshot := hero_soul_manager.get_active_combat_snapshot() \
		if hero_soul_manager != null else {}
	var secondary_value: Variant = snapshot.get("secondary_stats", {})
	var secondary := secondary_value as Dictionary if secondary_value is Dictionary else {}
	var chance := clampf(float(secondary.get("dodge_chance_percent", 0.0)), 0.0, 20.0)
	if chance <= 0.0 or _visible_defense_rng.randf() * 100.0 >= chance:
		return false
	invulnerability_remaining = maxf(invulnerability_remaining, 0.16)
	GameEvents.toast_requested.emit("NÉ  •  0 DAMAGE")
	_flash_visible_defense(Color(0.7, 0.95, 1.0, 0.72))
	RealtimeBridge.publish_event("player_dodged", {"chance_percent": chance})
	return true


func _flash_visible_defense(color: Color) -> void:
	if not is_instance_valid(sprite):
		return
	sprite.self_modulate = color
	var tween := create_tween()
	tween.tween_property(sprite, "self_modulate", Color.WHITE, 0.18)


func _is_attack_or_skill_action_active() -> bool:
	return (
		current_action.contains("attack")
		or current_action in [
			"dash_slash",
			"bow_volley",
			"axe_cleave",
			"axe_throw",
		]
		or _active_skill_instance_id > 0
		or _is_soul_echo_active()
	)


## Footwork is a live movement condition, not passive Armor. A tiny velocity
## threshold rejects numerical drift, while the state gate excludes knockback
## during HURT/DEAD. ATTACK and SKILL remain eligible so deliberate backpedaling,
## lunges and dashes can combine Footwork with attack-time Guard.
func _is_actively_moving_for_footwork() -> bool:
	return (
		not dead
		and player_state in [PlayerState.MOVE, PlayerState.ATTACK, PlayerState.SKILL]
		and velocity.length_squared() > 1.0
	)


func kill() -> void:
	if dead:
		return
	health = 0
	_emit_health()
	if _try_relay_to_living_reserve():
		return
	_die()


func _try_relay_to_living_reserve() -> bool:
	if hero_soul_manager == null or hero_soul_manager.reserve_soul == null:
		return false
	var reserve_key := String(hero_soul_manager.reserve_soul.hero_id)
	if float(_hero_health_current.get(reserve_key, 0.0)) <= 0.0:
		return false
	if not hero_soul_manager.force_relay_after_hero_defeat():
		return false
	dead = false
	invulnerability_remaining = maxf(invulnerability_remaining, 1.0)
	current_action = ""
	player_state = PlayerState.IDLE
	weapon_manager.notify_action_interruptible()
	GameEvents.toast_requested.emit("HERO  •  Tự động chuyển sang đồng đội còn sống")
	_emit_health()
	return true


func _die() -> void:
	_reset_sword_combo(&"death")
	_reset_archer_state(&"death")
	_cancel_axe_charge()
	_clear_axe_throw_runtime()
	dead = true
	process_mode = Node.PROCESS_MODE_ALWAYS
	player_state = PlayerState.DEAD
	current_action = "death"
	action_elapsed = 0.0
	velocity = Vector2.ZERO
	_restore_dash_slash_collision()
	weapon_manager.notify_action_uninterruptible()
	sprite.position = _active_sprite_rest_position
	_play_animation("death", true)
	GameEvents.player_died.emit()
	RealtimeBridge.publish_event("player_died", get_realtime_state())
func respawn(position_override: Variant = null) -> void:
	_cancel_axe_charge()
	_clear_axe_throw_runtime()
	dead = false
	player_state = PlayerState.IDLE
	current_action = ""
	action_elapsed = 0.0
	# A new life cannot inherit buffered combo state: otherwise the next light
	# input can replay the previous combo action and ignore live tuning values.
	combo_memory_remaining = 0.0
	queued_combo = false
	_reset_sword_combo(&"death")
	health = max_health
	for hero_key: Variant in _hero_health_maximum.keys():
		_hero_health_current[hero_key] = float(_hero_health_maximum[hero_key])
	for hero_key: Variant in _hero_barrier_maximum.keys():
		_hero_barrier_current[hero_key] = float(_hero_barrier_maximum[hero_key])
	barrier = max_barrier
	mana = max_mana
	stamina = max_stamina
	# Overworld owns its validated destination. Dungeon callers pass no override
	# and retain the existing run-local checkpoint and progression semantics.
	global_position = position_override if position_override is Vector2 else GameSession.checkpoint
	velocity = Vector2.ZERO
	invulnerability_remaining = 1.0
	soul_echo_cooldown_remaining = 0.0
	for hero_id: StringName in _ultimate_cooldowns.keys():
		_ultimate_cooldowns[hero_id] = 0.0
	_archer_infinite_arrows_remaining = 0.0
	sprite.position = _active_sprite_rest_position
	_emit_health()
	_emit_mana(true)
	_emit_stamina(true)
	_play_animation("idle", true)
	weapon_manager.notify_action_interruptible()
	weapon_manager.reset_all_cooldowns()
	process_mode = Node.PROCESS_MODE_INHERIT
	GameEvents.player_respawned.emit()
	RealtimeBridge.publish_event("player_respawned", get_realtime_state())


func _setup_hero_system() -> void:
	if not hero_soul_manager.configure_team(self, SWORD_HERO, null):
		push_error("KnightController: could not configure the production Sword Hero team")
		return
	hero_soul_manager.team_changed.connect(_on_hero_team_changed)
	hero_soul_manager.combat_stats_changed.connect(_on_hero_combat_stats_changed)
	hero_soul_manager.relay_state_changed.connect(_on_soul_relay_state_changed)
	_on_hero_combat_stats_changed(
		hero_soul_manager.get_active_combat_snapshot(),
		hero_soul_manager.get_reserve_combat_snapshot()
	)
	refresh_auxiliary_equipment_from_save(SaveService.get_snapshot())


func _start_sword_hero_attack(pointer_aim: Variant = null) -> bool:
	if is_carrying_torch():
		GameEvents.toast_requested.emit("Dang cam duoc nen khong the tan cong")
		return false
	if dead or not current_action.is_empty():
		return false
	if hero_soul_manager.active_hero == null or hero_soul_manager.active_hero.hero_id != &"sword_hero":
		return false
	var hand := weapon_manager.get_hand_weapon()
	var normal_cost := 0.0
	if hand != null and hand.normal_attack != null:
		normal_cost = hand.normal_attack.mana_cost
	if not _can_spend_mana(normal_cost):
		_show_insufficient_mana(normal_cost)
		return false
	if _sword_combo_window_remaining <= 0.0:
		_sword_combo_next_step = 1
	var step := clampi(_sword_combo_next_step, 1, _sword_combo_total_steps())
	var target: Node2D
	var aim_direction := _pointer_direction(pointer_aim, facing_direction)
	if hand != null and hand.normal_attack != null:
		target = _resolve_attack_target(hand.normal_attack.target_rules, pointer_aim, aim_direction)
	if pointer_aim is Vector2:
		_requested_action_direction = aim_direction
	if target == null and not pointer_aim is Vector2:
		var selected := TargetingService.acquire_up_to(
			self,
			global_position,
			aim_direction,
			SWORD_HERO.soul_echo_targeting_range,
			145.0,
			1,
			false
		)
		if not selected.is_empty():
			target = selected[0] as Node2D
	if step == _sword_wave_step():
		_sword_pursuit_target = null
	if step == _sword_pursuit_step():
		# Pursuit belongs only to the unit actually marked by Hit 3. Losing that
		# unit immediately resets the chain and this press becomes a fresh Hit 1.
		if is_instance_valid(_sword_pursuit_target) and CombatDamage.is_alive(_sword_pursuit_target):
			target = _sword_pursuit_target
		elif _sword_wave_pending:
			# A long-range wave can land after Hit 3's recovery. Keep this press
			# buffered until that exact wave confirms its one pursuit target.
			_sword_combo_buffered = true
			_queued_weapon_attack = true
			_queued_attack_pointer_valid = pointer_aim is Vector2
			if _queued_attack_pointer_valid:
				_queued_attack_pointer_world = pointer_aim as Vector2
			_sword_combo_window_remaining = SWORD_HERO.combo_continuation_seconds
			return true
		else:
			_reset_sword_combo(&"pursuit_target_lost")
			return _start_sword_hero_attack(pointer_aim)
		_current_sword_pursuit_has_target = true
		_current_sword_pursuit_dash_distance = 0.0
		_current_sword_execution_hit_seconds = (
			SWORD_HERO.combo_4_dash_start_seconds
			+ SWORD_HERO.combo_4_dash_duration_seconds * 0.55
		)
		if target != null:
			var target_distance := global_position.distance_to(target.global_position)
			var pursuit_maximum := maxf(
				SWORD_HERO.combo_4_max_dash_distance,
				_full_screen_projectile_distance(SWORD_HERO.combo_4_max_dash_distance),
			)
			_current_sword_pursuit_dash_distance = clampf(
				target_distance + SWORD_HERO.combo_4_pass_distance,
				SWORD_HERO.combo_4_pass_distance,
				pursuit_maximum
			)
			_current_sword_execution_hit_seconds = (
				SWORD_HERO.combo_4_dash_start_seconds
				+ SWORD_HERO.combo_4_dash_duration_seconds
				* clampf(target_distance / _current_sword_pursuit_dash_distance, 0.0, 1.0)
			)
	else:
		_current_sword_pursuit_has_target = false
	if target != null:
		var target_direction := global_position.direction_to(target.global_position)
		if not target_direction.is_zero_approx():
			_requested_action_direction = target_direction

	var action_name := "sword_attack_%d" % step
	_attack_instance_serial += 1
	_current_sword_attack_instance_id = _attack_instance_serial
	if not _start_action(action_name):
		_current_sword_attack_instance_id = 0
		return false
	_spend_mana(normal_cost)
	_sword_combo_window_remaining = 0.0
	_emit_sword_combo_state(step, true)
	_emit_combat_cue(StringName("sword_swing_%d" % step), {
		"attack_instance_id": _current_sword_attack_instance_id,
		"hero_id": &"sword_hero",
		"combo_step": step,
	})
	if _is_sword_inserted_cavalry_action(action_name):
		_spawn_sword_combo_cavalry()
	if step == _sword_wave_step():
		_spawn_sword_crescent_wave()
	return true


func _spawn_sword_combo_cavalry() -> void:
	var charge := KNIGHT_CAVALRY_CHARGE_SCENE.instantiate()
	if charge == null or not charge.has_method(&"setup"):
		if charge != null:
			charge.queue_free()
		return
	_effects_root().add_child(charge)
	if charge.has_signal(&"target_hit"):
		charge.connect(&"target_hit", _on_sword_combo_cavalry_target_hit)
	var damage := _scale_active_action_damage(
		&"normal_attack", SWORD_HERO.combo_damage(3) * 0.80
	)
	charge.call(&"setup", self, global_position, action_direction, damage, 1)


func _on_sword_combo_cavalry_target_hit(target: Node, damage: int) -> void:
	GameSession.add_score(damage)
	if target is Node2D and CombatDamage.is_alive(target):
		_sword_pursuit_target = target as Node2D
		_queued_attack_pointer_world = (target as Node2D).global_position
		_queued_attack_pointer_valid = true
		_sword_combo_buffered = true
		_queued_weapon_attack = true
	weapon_manager.notify_enemy_damaged(target, damage, {
		"hero_id": &"sword_hero",
		"source_kind": &"normal_attack",
		"source_weapon_id": &"knight_single_cavalry",
	})


func _spawn_sword_crescent_wave() -> void:
	var scene := SWORD_HERO.sword_wave_scene if SWORD_HERO.sword_wave_scene != null else SWORD_CRESCENT_WAVE_SCENE
	var wave := scene.instantiate() as SwordCrescentWave
	if wave == null:
		push_error("Sword Hero: configured Crescent Wave scene is invalid")
		return
	_effects_root().add_child(wave)
	_sword_wave_pending = true
	_sword_wave_attack_instance_id = _current_sword_attack_instance_id
	wave.target_hit.connect(
		_on_sword_crescent_wave_target_hit.bind(_sword_wave_attack_instance_id)
	)
	wave.completed.connect(
		_on_sword_crescent_wave_completed.bind(_sword_wave_attack_instance_id)
	)
	wave.setup(
		self,
		global_position + BODY_CENTER_OFFSET + action_direction * 16.0,
		action_direction,
		_scale_active_action_damage(&"normal_attack", SWORD_HERO.combo_damage(3)),
		_current_sword_attack_instance_id,
		SWORD_HERO.sword_wave_speed,
		_full_screen_projectile_distance(SWORD_HERO.sword_wave_distance),
		SWORD_HERO.sword_wave_width
	)


func _full_screen_projectile_distance(authored_minimum: float) -> float:
	if get_viewport() == null:
		return maxf(authored_minimum, 2048.0)
	var visible_world_size := get_viewport_rect().size
	var camera := get_viewport().get_camera_2d()
	if camera != null:
		visible_world_size /= Vector2(maxf(0.01, camera.zoom.x), maxf(0.01, camera.zoom.y))
	return maxf(authored_minimum, visible_world_size.length() + 128.0)


func _on_sword_crescent_wave_target_hit(
		target: Node2D,
		damage: int,
		attack_instance_id: int,
) -> void:
	if attack_instance_id != _sword_wave_attack_instance_id:
		return
	_sword_wave_pending = false
	if is_instance_valid(target) and CombatDamage.is_alive(target):
		_sword_pursuit_target = target
		_sword_combo_next_step = _sword_pursuit_step()
		_sword_combo_window_remaining = SWORD_HERO.combo_continuation_seconds
		_set_target_indicator(target)
		_emit_sword_combo_state(_sword_pursuit_step(), true)
		if current_action.is_empty() and _sword_combo_buffered:
			_sword_combo_buffered = false
			_queued_weapon_attack = false
			_queued_attack_pointer_valid = false
			_start_sword_hero_attack(target.global_position)
	GameSession.add_score(damage)


func _on_sword_crescent_wave_completed(
		hit_count: int,
		attack_instance_id: int,
) -> void:
	if attack_instance_id != _sword_wave_attack_instance_id or hit_count > 0:
		return
	_sword_wave_pending = false
	if not _is_sword_wave_action(current_action):
		var continue_with_fresh_hit := _sword_combo_buffered
		var queued_pointer_aim: Variant = (
			_queued_attack_pointer_world if _queued_attack_pointer_valid else null
		)
		_reset_sword_combo(&"wave_missed")
		if continue_with_fresh_hit and current_action.is_empty():
			_start_sword_hero_attack(queued_pointer_aim)


func _finish_sword_hero_combo_step(
		step: int,
		continue_combo: bool,
		queued_pointer_aim: Variant = null,
) -> void:
	if step == _sword_wave_step() \
			and not _sword_wave_pending \
			and (
				not is_instance_valid(_sword_pursuit_target)
				or not CombatDamage.is_alive(_sword_pursuit_target)
			):
		_reset_sword_combo(&"wave_missed")
		if continue_combo and current_action.is_empty():
			_start_sword_hero_attack(queued_pointer_aim)
		return
	if step >= _sword_combo_total_steps():
		_sword_combo_next_step = 1
		_sword_combo_window_remaining = 0.0
		_sword_pursuit_target = null
		_current_sword_pursuit_dash_distance = SWORD_HERO.combo_4_fallback_dash_distance
		_emit_sword_combo_state(_sword_combo_total_steps(), false)
		if continue_combo and current_action.is_empty():
			_start_sword_hero_attack(queued_pointer_aim)
		return
	_sword_combo_next_step = step + 1
	_sword_combo_window_remaining = SWORD_HERO.combo_continuation_seconds
	_emit_sword_combo_state(_sword_combo_next_step, true)
	if continue_combo and current_action.is_empty():
		_start_sword_hero_attack(queued_pointer_aim)


func _reset_sword_combo(reason: StringName) -> void:
	_sword_combo_next_step = 1
	_sword_combo_window_remaining = 0.0
	_sword_combo_buffered = false
	_queued_weapon_attack = false
	_queued_attack_pointer_valid = false
	_sword_pursuit_target = null
	_sword_wave_pending = false
	_sword_wave_attack_instance_id = 0
	_current_sword_pursuit_has_target = false
	_current_sword_pursuit_dash_distance = SWORD_HERO.combo_4_fallback_dash_distance
	_emit_sword_combo_state(1, false)
	if reason in [&"relay", &"death"]:
		_cancel_soul_echo(reason)


func _try_activate_soul_echo(rank_profile: Dictionary = {}) -> bool:
	if is_carrying_torch():
		GameEvents.toast_requested.emit("Dang cam duoc nen khong the dung ky nang")
		return false
	if dead or not SWORD_HERO.active_skill_enabled:
		return false
	if hero_soul_manager.active_hero == null or hero_soul_manager.active_hero.hero_id != &"sword_hero":
		return false
	if _is_soul_echo_active():
		GameEvents.toast_requested.emit("DƯ ẢNH ĐANG HOẠT ĐỘNG")
		return false
	if soul_echo_cooldown_remaining > 0.0 or SWORD_HERO.soul_echo_scene == null:
		return false
	var mana_cost := hero_soul_manager.active_skill_mana_cost(
		SWORD_HERO.resolved_active_skill_mana_cost()
	)
	if rank_profile.has("mana"):
		mana_cost = hero_soul_manager.active_skill_mana_cost(float(rank_profile["mana"]))
	if not _can_spend_mana(mana_cost):
		_show_insufficient_mana(mana_cost)
		return false
	var effect := SWORD_HERO.soul_echo_scene.instantiate()
	if effect == null or not effect.has_method(&"setup"):
		if effect != null:
			effect.queue_free()
		return false
	_effects_root().add_child(effect)
	if not bool(effect.call(&"setup", self, SWORD_HERO, _sword_combo_next_step)):
		effect.queue_free()
		return false
	if effect.has_method(&"configure_rank_profile"):
		effect.call(&"configure_rank_profile", rank_profile)
	if not _spend_mana(mana_cost):
		effect.queue_free()
		return false
	_soul_echo = effect
	_soul_echo_active = true
	_soul_echo_end_cooldown = float(rank_profile.get(
		"cooldown",
		hero_soul_manager.active_skill_cooldown(SWORD_HERO.active_skill_cooldown_seconds),
	))
	_sword_combo_window_remaining = SWORD_HERO.combo_continuation_seconds
	if effect.has_signal(&"completed"):
		effect.connect(&"completed", _on_soul_echo_completed)
	if effect.has_signal(&"combo_timer_refresh_requested"):
		effect.connect(&"combo_timer_refresh_requested", _on_soul_echo_combo_timer_refresh_requested)
	if effect.has_signal(&"echo_hit_confirmed"):
		effect.connect(&"echo_hit_confirmed", _on_soul_echo_hit_confirmed)
	GameEvents.toast_requested.emit(
		"%s  •  %.0f GIÂY" % [
			String(rank_profile.get("name", "LINH HỒN CHIẾN BINH")).to_upper(),
			float(rank_profile.get("duration", 5.0)),
		]
	)
	return true


func _queue_sword_echo_attack(
		step: int,
		target: Node2D,
		resolved_original_damage := 0,
) -> void:
	if not _is_soul_echo_active() or not _soul_echo.has_method(&"queue_combo_attack"):
		return
	var echo_context := {
		"attack_instance_id": _current_sword_attack_instance_id,
		"origin": global_position,
		"direction": action_direction,
		"target": target,
		"pursuit_target": _sword_pursuit_target,
		"fallback": step == 4 and not _current_sword_pursuit_has_target,
	}
	_soul_echo.call(
		&"queue_combo_attack",
		step,
		resolved_original_damage if resolved_original_damage > 0 else _scale_active_action_damage(
			&"normal_attack", SWORD_HERO.combo_damage(step)
		),
		echo_context
	)


func _queue_sword_echo_for_attack_window(base_damage: int) -> void:
	if not _is_soul_echo_active() \
			or _sword_echo_queued_attack_instance_id == _current_sword_attack_instance_id:
		return
	var step := _sword_combo_index(current_action) + 1
	if step < 1 or step > _sword_combo_total_steps():
		return
	var target: Node2D
	if step == _sword_pursuit_step() \
			and is_instance_valid(_sword_pursuit_target) \
			and CombatDamage.is_alive(_sword_pursuit_target):
		target = _sword_pursuit_target
	elif _has_locked_attack_target():
		target = _locked_attack_target
	elif is_instance_valid(_target_indicator_target) \
			and CombatDamage.is_alive(_target_indicator_target):
		target = _target_indicator_target
	var resolved_damage := maxi(1, base_damage)
	if step == _sword_pursuit_step() and is_instance_valid(target):
		resolved_damage = KNightRules.execution_damage(
			resolved_damage,
			_read_numeric_property(target, &"health"),
			_read_numeric_property(target, &"max_health"),
		)
	_sword_echo_queued_attack_instance_id = _current_sword_attack_instance_id
	_queue_sword_echo_attack(step, target, resolved_damage)


func _is_soul_echo_active() -> bool:
	return _soul_echo_active and is_instance_valid(_soul_echo)



func _on_soul_echo_completed(_reason: StringName = &"completed") -> void:
	var was_active := _soul_echo_active
	_soul_echo_active = false
	_soul_echo = null
	if was_active:
		soul_echo_cooldown_remaining = maxf(0.01, _soul_echo_end_cooldown)


func _on_soul_echo_combo_timer_refresh_requested(seconds: float) -> void:
	_sword_combo_window_remaining = maxf(0.0, seconds)


func _on_soul_echo_hit_confirmed(
		target: Node,
		damage: int,
		context: Dictionary,
) -> void:
	GameSession.add_score(damage)
	weapon_manager.notify_enemy_damaged(target, damage, context)
	weapon_manager.notify_hand_attack_hit({
		"target": target,
		"damage": damage,
		"source": &"k_night_afterimage",
		"is_echo": true,
	})


func _cancel_soul_echo(reason: StringName, start_cooldown := true) -> void:
	if not _is_soul_echo_active():
		_soul_echo_active = false
		_soul_echo = null
		return
	if _soul_echo.has_signal(&"completed") \
			and _soul_echo.is_connected(&"completed", _on_soul_echo_completed):
		_soul_echo.disconnect(&"completed", _on_soul_echo_completed)
	if _soul_echo.has_method(&"cancel"):
		_soul_echo.call(&"cancel", reason)
	else:
		_soul_echo.queue_free()
	_soul_echo_active = false
	_soul_echo = null
	if start_cooldown:
		soul_echo_cooldown_remaining = maxf(
			0.01,
			_soul_echo_end_cooldown if _soul_echo_end_cooldown > 0.0 \
			else hero_soul_manager.active_skill_cooldown(SWORD_HERO.active_skill_cooldown_seconds),
		)


func _emit_sword_combo_state(step: int, active: bool) -> void:
	if GameEvents.has_signal(&"hero_combo_state_changed"):
		GameEvents.emit_signal(
			&"hero_combo_state_changed",
			&"sword_hero",
			step,
			step if active else 0,
			_sword_combo_window_remaining,
			active
		)


func _emit_combat_cue(cue_id: StringName, context: Dictionary = {}) -> void:
	if GameEvents.has_signal(&"combat_cue_requested"):
		GameEvents.emit_signal(&"combat_cue_requested", cue_id, global_position, context)


func get_hero_soul_manager() -> HeroSoulManager:
	return hero_soul_manager


## Crowd Pressure is continuously derived from the real nearby enemy set. It
## is intentionally polled at a low fixed cadence instead of relying on debug
## callers; losing the crowd immediately withdraws Axe readiness on the next
## poll. An enemy counts as an active threat only while its live target points
## at this controlled Hero.
func _update_live_crowd_pressure(delta: float) -> void:
	_crowd_pressure_poll_left -= delta
	if _crowd_pressure_poll_left > 0.0:
		return
	_crowd_pressure_poll_left = CROWD_PRESSURE_POLL_SECONDS
	var reserve := hero_soul_manager.reserve_soul
	if reserve == null:
		return
	if reserve.ready_condition_behavior_id == &"clear_shot":
		var primary_clear_shot: Node2D
		var nearest_clear_shot_distance := INF
		if not dead:
			for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
				if not candidate is Node2D or not CombatDamage.is_alive(candidate):
					continue
				var enemy := candidate as Node2D
				var distance := global_position.distance_to(enemy.global_position)
				if distance < reserve.clear_shot_min_distance or distance > reserve.clear_shot_max_distance:
					continue
				if not (_object_property_is(candidate, &"_target", self) or _object_property_is(candidate, &"target", self)):
					continue
				if not _has_attack_line_of_sight(enemy):
					continue
				if distance < nearest_clear_shot_distance:
					nearest_clear_shot_distance = distance
					primary_clear_shot = enemy
		hero_soul_manager.update_clear_shot(
			CROWD_PRESSURE_POLL_SECONDS,
			primary_clear_shot != null,
			primary_clear_shot
		)
		return
	if reserve.ready_condition_behavior_id != &"crowd_pressure":
		return
	var radius := hero_soul_manager.get_effective_ready_radius()
	var hostile_count := 0
	var has_active_threat := false
	var primary_attacker: Node2D
	var nearest_distance_squared := INF
	if not dead:
		for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
			if not candidate is Node2D or not CombatDamage.is_alive(candidate):
				continue
			var enemy := candidate as Node2D
			var distance_squared := global_position.distance_squared_to(enemy.global_position)
			if distance_squared > radius * radius:
				continue
			hostile_count += 1
			if _object_property_is(candidate, &"_target", self) or _object_property_is(candidate, &"target", self):
				has_active_threat = true
				if distance_squared < nearest_distance_squared:
					nearest_distance_squared = distance_squared
					primary_attacker = enemy
	hero_soul_manager.update_crowd_pressure(hostile_count, has_active_threat, primary_attacker)


func _object_property_is(object: Object, property_name: StringName, expected: Variant) -> bool:
	for property: Dictionary in object.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return object.get(property_name) == expected
	return false


## Applies the initial AppFlow team snapshot to the live Hero state machine.
## Explicit wardrobe Equip commits may reconfigure this team during the same run.
## SaveService has already sanitized ownership/team membership before AppFlow
## creates this payload; gameplay resolves only production Hero definitions and
## fails closed to Sword if a stale/unknown identity reaches the scene.
func configure_soul_team_from_run(team_snapshot: Dictionary) -> bool:
	var active_id := StringName(String(team_snapshot.get("active_hero", "sword_hero")).strip_edges().to_lower())
	var active := _hero_definition_for_identity(active_id)
	if active == null:
		active = SWORD_HERO
	var reserve: HeroDefinition
	var raw_reserves: Variant = team_snapshot.get("reserve_souls", [])
	if raw_reserves is Array:
		for raw_reserve_id: Variant in raw_reserves:
			var reserve_id := StringName(String(raw_reserve_id).strip_edges().to_lower())
			if reserve_id.is_empty() or reserve_id == active.hero_id:
				continue
			reserve = _hero_definition_for_identity(reserve_id)
			if reserve != null:
				break
	if not hero_soul_manager.configure_team(self, active, reserve):
		return false
	# configure_team emits team_changed, which synchronizes the combat weapon
	# when the signal is connected. Calling this explicitly also makes the method
	# robust in focused tests that configure the team before signal wiring.
	_synchronize_active_hero_weapon(active, reserve, not _runtime_team_signature.is_empty())
	_runtime_team_signature = _soul_team_identity_signature(team_snapshot)
	refresh_auxiliary_equipment_from_save(SaveService.get_snapshot())
	return true


## Refreshes the read-only runtime projection after loading a level or after an
## explicit equipment change. Save ownership remains entirely in SaveService.
func refresh_auxiliary_equipment_from_save(save_snapshot: Dictionary) -> bool:
	return hero_soul_manager.configure_combat_stats_from_save(
		save_snapshot,
		_combat_base_max_health,
		_combat_base_max_mana
	)


## The run's two Hero identities are immutable. Save commits may refresh their
## equipment/progression, but roster edits made at Home apply only next run.
func refresh_runtime_meta_from_save(save_snapshot: Dictionary) -> bool:
	if save_snapshot.is_empty():
		return false
	var settings_value: Variant = save_snapshot.get("settings", {})
	if settings_value is Dictionary:
		_aim_assist_strength = clampf(
			float((settings_value as Dictionary).get("aim_assist", 0.5)),
			0.0,
			1.0
		)
	return refresh_auxiliary_equipment_from_save(save_snapshot)


func _on_runtime_save_committed(save_snapshot: Dictionary) -> void:
	refresh_runtime_meta_from_save(save_snapshot)


func _soul_team_identity_signature(team_snapshot: Dictionary) -> String:
	var active_id := String(team_snapshot.get("active_hero", "sword_hero")).strip_edges().to_lower()
	var reserves: Array[String] = []
	var raw_reserves: Variant = team_snapshot.get("reserve_souls", [])
	if raw_reserves is Array:
		for raw_reserve: Variant in raw_reserves:
			reserves.append(String(raw_reserve).strip_edges().to_lower())
	return "%s|%s" % [active_id, ",".join(reserves)]


func get_combat_stat_snapshot() -> Dictionary:
	return hero_soul_manager.get_active_combat_snapshot()


func scale_hero_damage(hero_id: StringName, authored_damage: float) -> int:
	return hero_soul_manager.scale_hero_damage(hero_id, authored_damage)


func scale_hero_action_damage(
		hero_id: StringName,
		action_track: StringName,
		authored_damage: float
) -> int:
	return hero_soul_manager.scale_hero_action_damage(hero_id, action_track, authored_damage)


func _scale_active_combat_damage(authored_damage: float) -> int:
	return hero_soul_manager.scale_active_damage(authored_damage)


func _scale_active_action_damage(action_track: StringName, authored_damage: float) -> int:
	var adjusted := authored_damage
	if action_track == &"normal_attack" and _kit_buff_seconds_left > 0.0:
		if _kit_buff_id == &"knight_shadow_double":
			# Song Anh resolves as two independently confirmed 0.8x hits in
			# _apply_attack_hits, so its two damage numbers remain visible.
			adjusted *= 0.80 * _kit_buff_damage_multiplier
	return hero_soul_manager.scale_active_action_damage(action_track, adjusted)


func _finish_kit_buff() -> void:
	if not _kit_buff_owner_hero_id.is_empty():
		_kit_skill_cooldowns["%s:active_1" % _kit_buff_owner_hero_id] = (
			_kit_buff_end_cooldown
		)
	_kit_buff_id = &""
	_kit_buff_owner_hero_id = &""
	_kit_buff_seconds_left = 0.0
	_kit_buff_attacks_left = 0
	_kit_buff_afterimage_left = 0.0
	_kit_buff_end_cooldown = 0.0
	_kit_buff_damage_multiplier = 1.0
	_kit_buff_move_speed = 1.0


func enable_debug_sword_relay_team() -> bool:
	if not OS.has_feature("debug"):
		return false
	_cancel_soul_echo(&"relay")
	var dummy := load("res://game/heroes/data/relay_test_dummy.tres") as HeroDefinition
	if dummy == null or not dummy.debug_only:
		return false
	var configured := hero_soul_manager.set_debug_team(dummy, SWORD_HERO)
	if configured:
		sprite.modulate = Color(0.62, 0.66, 0.72, 0.92)
	return configured


func disable_debug_sword_relay_team() -> bool:
	var configured := hero_soul_manager.configure_team(self, SWORD_HERO, null)
	if configured:
		sprite.modulate = Color.WHITE
	return configured


func _on_hero_team_changed(active: HeroDefinition, reserve: HeroDefinition) -> void:
	if _kit_buff_seconds_left > 0.0 and (
		active == null or active.hero_id != _kit_buff_owner_hero_id
	):
		_finish_kit_buff()
	if active != null and active.hero_id != &"sword_hero":
		_reset_sword_combo(&"relay")
	if active == null or active.hero_id != &"archer_hero":
		_reset_archer_state(&"team_changed")
	_synchronize_active_hero_weapon(active, reserve, not _runtime_team_signature.is_empty())
	_ensure_hero_health_pool(active, hero_soul_manager.get_active_combat_snapshot())
	_ensure_hero_health_pool(reserve, hero_soul_manager.get_reserve_combat_snapshot())
	_activate_hero_health_pool(active)
	_grant_pending_relay_barrier(active)
	if wizard_runtime != null:
		wizard_runtime.on_team_changed(active, reserve)


func _synchronize_active_hero_weapon(
		active: HeroDefinition,
		reserve: HeroDefinition,
		preserve_cooldowns := false,
) -> void:
	var active_weapon := _weapon_for_hero(active)
	if active_weapon == null:
		return
	var reserve_weapon := _weapon_for_hero(reserve)
	var spirit_slots: Array[WeaponDefinition] = []
	spirit_slots.append(reserve_weapon)
	spirit_slots.append(null)
	if not weapon_manager.configure_loadout(active_weapon, spirit_slots, false, preserve_cooldowns):
		push_error("KnightController: could not synchronize the active Hero weapon loadout")
		return
	sprite.modulate = Color.WHITE
	_refresh_weapon_visuals()


func _cancel_action_for_live_equip() -> void:
	if current_action.is_empty():
		return
	_archer_pending_shot.clear()
	_archer_pending_mark_target = null
	_cancel_axe_charge()
	if current_action == "axe_throw":
		_clear_axe_throw_runtime()
	_restore_dash_slash_collision()
	current_action = ""
	action_elapsed = 0.0
	velocity = Vector2.ZERO
	player_state = PlayerState.IDLE
	sprite.position = _active_sprite_rest_position
	weapon_manager.notify_action_interruptible()
	_play_animation(&"idle", true)


func _weapon_for_hero(hero: HeroDefinition) -> WeaponDefinition:
	if hero == null:
		return null
	if hero.primary_weapon != null:
		return hero.primary_weapon
	match hero.hero_id:
		&"sword_hero":
			return SWORD_DEFINITION
		&"axe_hero":
			return AXE_DEFINITION
		&"archer_hero":
			return BOW_DEFINITION
		&"wizard_hero":
			return WIZARD_STAFF_DEFINITION
	return null


func _hero_definition_for_identity(hero_id: StringName) -> HeroDefinition:
	match hero_id:
		&"sword_hero":
			return SWORD_HERO
		&"axe_hero":
			return AXE_HERO
		&"archer_hero":
			return ARCHER_HERO
		&"wizard_hero":
			return WIZARD_HERO
	return null


func _on_hero_combat_stats_changed(active_snapshot: Dictionary, reserve_snapshot: Dictionary) -> void:
	if active_snapshot.is_empty():
		return
	var active := hero_soul_manager.active_hero
	var reserve := hero_soul_manager.reserve_soul
	# Only write the visible HP back when it still belongs to this active id.
	# During Relay, the manager swaps identities immediately before this signal.
	if active != null and _health_active_hero_id == active.hero_id:
		_hero_health_current[String(active.hero_id)] = float(health)
		_hero_health_maximum[String(active.hero_id)] = float(max_health)
		_hero_barrier_current[String(active.hero_id)] = float(barrier)
		_hero_barrier_maximum[String(active.hero_id)] = float(max_barrier)
	var mana_ratio := clampf(mana / maxf(1.0, max_mana), 0.0, 1.0)
	_ensure_hero_health_pool(active, active_snapshot)
	_ensure_hero_health_pool(reserve, reserve_snapshot)
	_activate_hero_health_pool(active)
	max_mana = maxf(1.0, float(active_snapshot.get("mana", _combat_base_max_mana)))
	mana = clampf(mana_ratio * max_mana, 0.0, max_mana)
	_emit_health()
	_emit_mana(true)


func _ensure_hero_health_pool(hero: HeroDefinition, combat_snapshot: Dictionary) -> void:
	if hero == null:
		return
	var key := String(hero.hero_id)
	var next_maximum := maxf(1.0, float(combat_snapshot.get("hp", _combat_base_max_health)))
	var secondary_value: Variant = combat_snapshot.get("secondary_stats", {})
	var secondary := secondary_value as Dictionary if secondary_value is Dictionary else {}
	var base_barrier_percent := maxf(0.0, float(secondary.get("barrier_capacity_percent", 0.0)))
	var relay_barrier_percent := maxf(0.0, float(secondary.get("relay_barrier_percent", 0.0)))
	var next_barrier_maximum := next_maximum * (base_barrier_percent + relay_barrier_percent) / 100.0
	var base_barrier := next_maximum * base_barrier_percent / 100.0
	if not _hero_health_maximum.has(key):
		_hero_health_maximum[key] = next_maximum
		_hero_health_current[key] = next_maximum
		_hero_barrier_maximum[key] = next_barrier_maximum
		_hero_barrier_current[key] = base_barrier
		return
	var previous_maximum := maxf(1.0, float(_hero_health_maximum[key]))
	var previous_current := float(_hero_health_current.get(key, previous_maximum))
	var ratio := clampf(previous_current / previous_maximum, 0.0, 1.0)
	_hero_health_maximum[key] = next_maximum
	_hero_health_current[key] = ratio * next_maximum
	var old_barrier_maximum := maxf(0.0, float(_hero_barrier_maximum.get(key, 0.0)))
	var old_barrier_current := maxf(0.0, float(_hero_barrier_current.get(key, 0.0)))
	_hero_barrier_maximum[key] = next_barrier_maximum
	_hero_barrier_current[key] = clampf(
		old_barrier_current + maxf(0.0, next_barrier_maximum - old_barrier_maximum),
		0.0,
		next_barrier_maximum,
	)


func _activate_hero_health_pool(hero: HeroDefinition) -> void:
	if hero == null:
		return
	var key := String(hero.hero_id)
	var pool_maximum := maxf(1.0, float(_hero_health_maximum.get(key, _combat_base_max_health)))
	var pool_current := clampf(float(_hero_health_current.get(key, pool_maximum)), 0.0, pool_maximum)
	_health_active_hero_id = hero.hero_id
	max_health = maxi(1, roundi(pool_maximum))
	health = clampi(roundi(pool_current), 0, max_health)
	_hero_health_current[key] = float(health)
	_hero_health_maximum[key] = float(max_health)
	max_barrier = maxi(0, roundi(float(_hero_barrier_maximum.get(key, 0.0))))
	barrier = clampi(roundi(float(_hero_barrier_current.get(key, 0.0))), 0, max_barrier)
	_hero_barrier_current[key] = float(barrier)
	_hero_barrier_maximum[key] = float(max_barrier)
	_emit_hero_health_pools(true)


func _grant_pending_relay_barrier(active: HeroDefinition) -> void:
	if active == null or _pending_relay_barrier_hero_id != active.hero_id:
		return
	_pending_relay_barrier_hero_id = &""
	var snapshot := hero_soul_manager.get_active_combat_snapshot()
	var secondary_value: Variant = snapshot.get("secondary_stats", {})
	var secondary := secondary_value as Dictionary if secondary_value is Dictionary else {}
	var percent := maxf(0.0, float(secondary.get("relay_barrier_percent", 0.0)))
	var granted := mini(max_barrier - barrier, roundi(float(max_health) * percent / 100.0))
	if granted <= 0:
		return
	barrier += granted
	_hero_barrier_current[String(active.hero_id)] = float(barrier)
	GameEvents.toast_requested.emit("GIÁP ẢO CHUYỂN HỒN  •  +%d" % granted)
	_flash_visible_defense(Color(0.42, 0.8, 1.0, 1.0))
	_emit_hero_health_pools(true)


func _on_soul_relay_state_changed(_state_name: StringName, _takeover_open: bool, _seconds_left: float) -> void:
	RealtimeBridge.publish_event("soul_relay_state", hero_soul_manager.get_state_snapshot())


func begin_soul_summon(incoming: HeroDefinition, primary_attacker: Node) -> Vector2:
	if incoming == null:
		return global_position
	if is_instance_valid(_soul_support_visual):
		_soul_support_visual.queue_free()
	var direction := -facing_direction
	if primary_attacker is Node2D and is_instance_valid(primary_attacker):
		direction = global_position.direction_to((primary_attacker as Node2D).global_position)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var desired := global_position + direction.normalized() * 38.0
	var query := PhysicsRayQueryParameters2D.create(global_position, desired, 1)
	query.exclude = [get_rid()]
	var wall_hit := get_world_2d().direct_space_state.intersect_ray(query)
	var support_position := desired if wall_hit.is_empty() else (wall_hit.position as Vector2) - direction.normalized() * 6.0
	var legendary_plus := _is_legendary_plus_hero_kit(incoming.hero_id)
	var incoming_kit := hero_soul_manager.get_skill_kit_snapshot(incoming.hero_id)
	var incoming_rarity := int(incoming_kit.get("rarity", 0))
	if incoming.hero_id == &"sword_hero" and legendary_plus:
		var guard := KnightCavalryGuardScript.new() as KnightCavalryGuard
		add_child(guard)
		if guard.setup(
			self,
			KNightRules.REVENGE_DURATION,
			incoming.base_power,
			KNightRules.soul_rank_for_rarity(incoming_rarity),
		):
			_soul_support_visual = guard
			support_position = global_position
	elif incoming.hero_id == &"sword_hero":
		var effect := SOUL_INTERCEPTION_SCENE.instantiate() as SoulInterceptionEffect
		if effect != null:
			_effects_root().add_child(effect)
			effect.global_position = support_position
			effect.setup(self, incoming, primary_attacker, incoming_rarity)
			_soul_support_visual = effect
	elif incoming.hero_id == &"axe_hero":
		var axe_effect := AXE_REAPER_DROP_SCENE.instantiate() as AxeReaperDropEffect
		if axe_effect != null:
			_effects_root().add_child(axe_effect)
			axe_effect.global_position = support_position
			if axe_effect.setup(self, incoming, primary_attacker):
				_soul_support_visual = axe_effect
		if legendary_plus:
			_spawn_legendary_axe_soul_sides(incoming, primary_attacker, support_position, direction)
	elif incoming.hero_id == &"archer_hero":
		var archer_avatar := _spawn_archer_soul_avatar(
			support_position,
			&"archer_summon",
			incoming.summon_duration_seconds,
			direction
		)
		if archer_avatar != null:
			_soul_support_visual = archer_avatar
		var entry_release := minf(0.14, incoming.summon_duration_seconds * 0.18)
		get_tree().create_timer(entry_release, false).timeout.connect(
			_spawn_archer_entry_arrow.bind(incoming, support_position, direction),
			CONNECT_ONE_SHOT
		)
		if legendary_plus:
			_begin_archer_legendary_crossfire(incoming)
	elif incoming.hero_id == &"wizard_hero" and wizard_runtime != null:
		var icon_count := maxi(1, int(wizard_runtime.call(&"get_pending_support_icon_count"))) \
			if wizard_runtime.has_method(&"get_pending_support_icon_count") else 1
		if legendary_plus:
			icon_count = 5
		var wizard_duration := 5.0 if legendary_plus else incoming.summon_duration_seconds
		support_position = wizard_runtime.begin_soul_summon(global_position, icon_count, wizard_duration)
		if legendary_plus:
			var matrix := WizardSoulMatrixScript.new() as WizardSoulMatrix
			add_child(matrix)
			if matrix.setup(self, wizard_duration, incoming.base_power * 0.55):
				_soul_support_visual = matrix
	return support_position


func _is_legendary_plus_hero_kit(hero_id: StringName) -> bool:
	if hero_soul_manager == null:
		return false
	return int(hero_soul_manager.get_skill_kit_snapshot(hero_id).get("kit_tier", 0)) >= 2


func _spawn_legendary_axe_soul_sides(
		hero: HeroDefinition,
		primary_attacker: Node,
		center: Vector2,
		direction: Vector2,
) -> void:
	var side := direction.orthogonal().normalized()
	for sign_value: float in [-1.0, 1.0]:
		var extra := AXE_REAPER_DROP_SCENE.instantiate() as AxeReaperDropEffect
		if extra == null:
			continue
		_effects_root().add_child(extra)
		extra.global_position = center + side * 46.0 * sign_value
		extra.setup(self, hero, primary_attacker)
	get_tree().create_timer(0.42, false).timeout.connect(
		_resolve_legendary_axe_soul_pull.bind(center), CONNECT_ONE_SHOT
	)


func _resolve_legendary_axe_soul_pull(center: Vector2) -> void:
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if center.distance_to(enemy.global_position) > 110.0:
			continue
		var pull := enemy.global_position.direction_to(center) * minf(28.0, enemy.global_position.distance_to(center))
		if enemy is CharacterBody2D:
			(enemy as CharacterBody2D).move_and_collide(pull)
		else:
			enemy.global_position += pull
		CombatDamage.apply_stagger(enemy, 95.0, {"skill_id": &"axe_triangular_slam"})


func _begin_archer_legendary_crossfire(hero: HeroDefinition) -> void:
	var duration := 4.0
	for index: int in 4:
		var theta := TAU * float(index) / 4.0
		_spawn_archer_soul_avatar(
			global_position + Vector2(cos(theta) * 44.0, sin(theta) * 28.0),
			&"archer_summon", duration, Vector2(cos(theta), sin(theta)), true,
		)
	var wave_count := floori(duration / 0.6) + 1
	for wave_index: int in wave_count:
		get_tree().create_timer(float(wave_index) * 0.6, false).timeout.connect(
			_spawn_archer_legendary_crossfire_wave.bind(hero), CONNECT_ONE_SHOT
		)


func _spawn_archer_legendary_crossfire_wave(hero: HeroDefinition) -> void:
	if dead:
		return
	var target := _highest_hp_visible_enemy(global_position)
	if target == null:
		return
	for index: int in 4:
		var theta := TAU * float(index) / 4.0
		var origin := global_position + Vector2(cos(theta) * 42.0, sin(theta) * 28.0) + BODY_CENTER_OFFSET
		var direction := origin.direction_to(target.global_position)
		var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
		if arrow == null:
			continue
		_effects_root().add_child(arrow)
		arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(&"bow", &"summon", -1))
		arrow.setup(
			self, origin, direction,
			scale_hero_action_damage(&"archer_hero", &"summon_skill", hero.base_power * 0.40),
			&"bow", 660.0, FULL_MAP_PROJECTILE_DISTANCE, Color(0.56, 0.92, 1.0, 1.0), 1, 8.0, 8.0,
		)


func _highest_hp_visible_enemy(origin: Vector2) -> Node2D:
	var best: Node2D
	var best_health := -INF
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if not _is_target_on_screen(enemy) or not _has_attack_line_of_sight(enemy):
			continue
		var health_value := _read_numeric_property(enemy, &"health")
		if health_value > best_health:
			best_health = health_value
			best = enemy
	return best


func begin_wizard_soul_return_summon(
		origin: Vector2,
		icon_count: int,
		duration_seconds: float,
) -> Vector2:
	if wizard_runtime == null:
		return origin
	return wizard_runtime.begin_soul_summon(origin, icon_count, duration_seconds)


func _spawn_archer_entry_arrow(
		hero: HeroDefinition,
		support_position: Vector2,
		direction: Vector2,
) -> void:
	if hero == null or dead:
		return
	var entry_arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	if entry_arrow == null:
		return
	_effects_root().add_child(entry_arrow)
	entry_arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(&"bow", &"summon", -1))
	entry_arrow.setup(
		self,
		support_position + BODY_CENTER_OFFSET,
		direction,
		scale_hero_action_damage(&"archer_hero", &"summon_skill", hero.archer_summon_damage),
		&"bow",
		hero.archer_summon_projectile_speed,
		maxf(hero.archer_summon_range, FULL_MAP_PROJECTILE_DISTANCE),
		Color(0.52, 0.92, 1.0, 1.0),
		hero.archer_summon_target_cap,
		hero.archer_summon_stagger,
		hero.archer_summon_width
	)


func finish_soul_support(_incoming: HeroDefinition) -> void:
	if wizard_runtime != null:
		wizard_runtime.finish_soul_support()
	if is_instance_valid(_soul_support_visual):
		if _soul_support_visual.has_method(&"finish_now"):
			_soul_support_visual.call(&"finish_now")
		else:
			_soul_support_visual.queue_free()
	_soul_support_visual = null


func resolve_soul_relay_destination(fallback: Vector2) -> Vector2:
	if hero_soul_manager.summon_context == &"wizard_soul_return" and wizard_runtime != null:
		return wizard_runtime.resolve_soul_takeover_destination(fallback)
	if is_instance_valid(_soul_support_visual) \
			and _soul_support_visual.has_method(&"get_takeover_position"):
		var resolved: Variant = _soul_support_visual.call(&"get_takeover_position")
		if resolved is Vector2:
			return resolved as Vector2
	return fallback


func complete_soul_relay(
		incoming: HeroDefinition,
		outgoing: HeroDefinition,
		destination: Vector2
) -> bool:
	if incoming == null or outgoing == null:
		return false
	_pending_relay_barrier_hero_id = incoming.hero_id
	var outgoing_legendary_plus := _is_legendary_plus_hero_kit(outgoing.hero_id)
	# Preserve the outgoing Hero's own pool before HeroSoulManager swaps ids.
	_hero_health_current[String(outgoing.hero_id)] = float(health)
	_hero_health_maximum[String(outgoing.hero_id)] = float(max_health)
	_hero_barrier_current[String(outgoing.hero_id)] = float(barrier)
	_hero_barrier_maximum[String(outgoing.hero_id)] = float(max_barrier)
	var departure_origin := global_position
	var outgoing_missing_health := maxi(0, max_health - health)
	if outgoing.hero_id == &"sword_hero":
		_reset_sword_combo(&"relay")
	elif outgoing.hero_id == &"archer_hero":
		_reset_archer_state(&"relay")
	elif outgoing.hero_id == &"wizard_hero" and wizard_runtime != null:
		wizard_runtime.begin_departure(departure_origin, outgoing)
		if outgoing_legendary_plus:
			get_tree().create_timer(0.12, false).timeout.connect(
				_resolve_wizard_legendary_departure.bind(outgoing, departure_origin), CONNECT_ONE_SHOT
			)
	# A keyboard/touch takeover can now land during an active Dash or attack.
	# End the outgoing body's action before moving control to the Soul avatar so
	# the incoming Hero does not continue the old body's velocity/timeline.
	_cancel_action_for_live_equip()
	global_position = destination
	velocity = Vector2.ZERO
	finish_soul_support(incoming)
	if outgoing.hero_id == &"sword_hero":
		if outgoing_legendary_plus:
			var vengeful := KNightVengefulSoulScript.new() as KNightVengefulSoul
			_effects_root().add_child(vengeful)
			if not vengeful.setup(self, outgoing, departure_origin):
				vengeful.queue_free()
		else:
			var returning := RETURNING_BLADE_SCENE.instantiate() as ReturningBladeEffect
			if returning != null:
				_effects_root().add_child(returning)
				returning.setup(
					self,
					outgoing,
					departure_origin,
					destination,
					outgoing_missing_health,
				)
	elif outgoing.hero_id == &"axe_hero":
		var axe_count := 5 if outgoing_legendary_plus else 1
		var axe_target := _highest_hp_visible_enemy(departure_origin)
		var axe_destination := axe_target.global_position if axe_target != null else destination
		for index: int in axe_count:
			var last_orbit := AXE_LAST_ORBIT_SCENE.instantiate() as AxeLastOrbitEffect
			if last_orbit == null:
				continue
			_effects_root().add_child(last_orbit)
			var theta := TAU * float(index) / float(axe_count)
			var offset := Vector2(cos(theta) * 20.0, sin(theta) * 14.0) if axe_count > 1 else Vector2.ZERO
			last_orbit.setup(self, outgoing, departure_origin + offset, axe_destination - offset)
	elif outgoing.hero_id == &"archer_hero":
		_spawn_archer_soul_avatar(
			departure_origin,
			&"archer_departure",
			outgoing.departure_duration_seconds,
			facing_direction
		)
		get_tree().create_timer(0.13, false).timeout.connect(
			_spawn_archer_departure_volley.bind(outgoing, departure_origin),
			CONNECT_ONE_SHOT
		)
		if outgoing_legendary_plus:
			get_tree().create_timer(0.31, false).timeout.connect(
				_spawn_archer_departure_volley.bind(outgoing, departure_origin), CONNECT_ONE_SHOT
			)
			get_tree().create_timer(0.48, false).timeout.connect(
				_spawn_archer_departure_finishers.bind(outgoing, departure_origin), CONNECT_ONE_SHOT
			)
	sprite.modulate = Color(0.62, 0.66, 0.72, 0.92) if incoming.hero_id == &"axe_hero" else Color.WHITE
	return true


func _begin_knight_legendary_departure(hero: HeroDefinition, origin: Vector2) -> void:
	for step: int in 5:
		get_tree().create_timer(float(step) * 0.10, false).timeout.connect(
			_resolve_knight_legendary_departure_hit.bind(hero, origin, step + 1), CONNECT_ONE_SHOT
		)


func _resolve_knight_legendary_departure_hit(
		hero: HeroDefinition,
		origin: Vector2,
		step: int,
) -> void:
	var target := _highest_hp_visible_enemy(origin)
	if target == null:
		return
	var direction := origin.direction_to(target.global_position)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var phantom := AnimatedSprite2D.new()
	phantom.name = "KnightDeparturePhantom"
	phantom.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	phantom.sprite_frames = KnightAnimations.build()
	var animation := StringName("sword_combo_%d" % clampi(step, 1, 4))
	phantom.animation = animation if phantom.sprite_frames.has_animation(animation) else &"attack"
	phantom.flip_h = direction.x < 0.0
	phantom.modulate = Color(0.06, 0.01, 0.02, 0.78)
	phantom.global_position = target.global_position - direction * 24.0 + SPRITE_REST_POSITION
	phantom.z_index = 13
	_effects_root().add_child(phantom)
	phantom.play(phantom.animation, 3.0)
	phantom.animation_finished.connect(phantom.queue_free, CONNECT_ONE_SHOT)
	var damage := scale_hero_action_damage(
		&"sword_hero", &"departure_skill", hero.base_power * (0.55 if step < 5 else 1.05)
	)
	if CombatDamage.apply_confirmed(target, damage, origin, &"sword_hero", {
		"hero_id": &"sword_hero", "source_kind": &"departure_skill",
		"skill_id": &"knight_phantom_combo", "combo_step": step,
		"cue_id": &"combo_finisher" if step == 5 else &"sword_hit",
	}):
		GameSession.add_score(damage)
		if step == 5:
			CombatDamage.apply_stagger(target, 100.0, {"skill_id": &"knight_phantom_combo"})
			VfxCatalog.spawn(_effects_root(), &"big_hit", target.global_position, 0.0, 0.34, Color.TRANSPARENT, 14)


func _spawn_archer_departure_finishers(hero: HeroDefinition, origin: Vector2) -> void:
	var target := _highest_hp_visible_enemy(origin)
	if target == null:
		return
	for index: int in 3:
		var side := target.global_position.direction_to(origin).orthogonal()
		var shot_origin := origin + side * (float(index) - 1.0) * 20.0 + BODY_CENTER_OFFSET
		var direction := shot_origin.direction_to(target.global_position)
		var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
		if arrow == null:
			continue
		_effects_root().add_child(arrow)
		arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(&"bow", &"departure", -1))
		arrow.setup(
			self, shot_origin, direction,
			scale_hero_action_damage(&"archer_hero", &"departure_skill", hero.base_power * 0.75),
			&"bow", 720.0, FULL_MAP_PROJECTILE_DISTANCE, Color(0.72, 0.90, 1.0, 1.0), 1, 18.0, 12.0,
		)


func _resolve_wizard_legendary_departure(hero: HeroDefinition, origin: Vector2) -> void:
	var target := _highest_hp_visible_enemy(origin)
	var center := target.global_position if target != null else origin
	VfxCatalog.spawn(_effects_root(), &"dark_burst", center, 0.0, 1.45, Color.TRANSPARENT, 13)
	VfxCatalog.spawn(_effects_root(), &"big_hit", center, 0.0, 0.38, Color(0.58, 0.22, 0.92, 0.9), 14)
	var damage := scale_hero_action_damage(&"wizard_hero", &"departure_skill", hero.base_power * 2.4)
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if center.distance_to(enemy.global_position) > 118.0:
			continue
		CombatDamage.apply_confirmed(enemy, damage, center, &"wizard_hero", {
			"hero_id": &"wizard_hero", "source_kind": &"departure_skill",
			"skill_id": &"wizard_grand_grave_collapse", "cue_id": &"heavy_impact",
		})


func _spawn_archer_departure_volley(hero: HeroDefinition, origin: Vector2) -> void:
	var base_direction := facing_direction.normalized()
	if base_direction.is_zero_approx():
		base_direction = Vector2.RIGHT
	var shared_hits: Dictionary = {}
	var count := maxi(1, hero.archer_departure_projectile_count)
	var spread := deg_to_rad(hero.archer_departure_spread_degrees)
	for index: int in count:
		var ratio := 0.0 if count == 1 else float(index) / float(count - 1)
		var angle := lerpf(-spread, spread, ratio)
		var direction := base_direction.rotated(angle)
		var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
		if arrow == null:
			continue
		_effects_root().add_child(arrow)
		arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(&"bow", &"departure", -1))
		arrow.setup(
			self,
			origin + BODY_CENTER_OFFSET + direction * 8.0,
			direction,
			scale_hero_action_damage(&"archer_hero", &"departure_skill", hero.archer_departure_damage),
			&"bow",
			hero.archer_departure_projectile_speed,
			maxf(hero.archer_departure_range, FULL_MAP_PROJECTILE_DISTANCE),
			Color(0.68, 0.88, 1.0, 1.0),
			8,
			hero.archer_departure_stagger,
			-1.0,
			shared_hits,
			hero.archer_departure_per_target_cap
		)


func _spawn_archer_soul_avatar(
		world_position: Vector2,
		animation: StringName,
		duration: float,
		direction: Vector2,
		play_then_hold_idle := false,
) -> AnimatedSprite2D:
	var avatar := AnimatedSprite2D.new()
	avatar.name = "ArcherSoulAvatar"
	avatar.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	avatar.sprite_frames = _character_form_frames.get(ARCHER_CHARACTER_FORM_ID) as SpriteFrames
	if avatar.sprite_frames == null:
		avatar.sprite_frames = ArcherAnimations.build_player()
	if not avatar.sprite_frames.has_animation(animation):
		avatar.queue_free()
		return null
	avatar.flip_h = direction.x < 0.0
	avatar.modulate = Color(0.62, 0.92, 1.0, 0.82)
	avatar.z_index = 8
	_effects_root().add_child(avatar)
	avatar.global_position = world_position + ARCHER_SPRITE_REST_POSITION
	var lifetime := maxf(0.12, duration)
	var frame_count := avatar.sprite_frames.get_frame_count(animation)
	var authored_fps := avatar.sprite_frames.get_animation_speed(animation)
	var clip_seconds := float(frame_count) / maxf(authored_fps, 0.01)
	if play_then_hold_idle:
		avatar.play(animation)
		avatar.animation_finished.connect(
			_hold_archer_soul_avatar_idle.bind(avatar),
			CONNECT_ONE_SHOT
		)
	else:
		avatar.play(animation, clip_seconds / lifetime)
	var tween := avatar.create_tween()
	tween.tween_interval(lifetime * 0.72)
	tween.tween_property(avatar, "modulate:a", 0.0, lifetime * 0.28)
	tween.tween_callback(avatar.queue_free)
	return avatar


func _hold_archer_soul_avatar_idle(avatar: AnimatedSprite2D) -> void:
	if not is_instance_valid(avatar) or avatar.sprite_frames == null:
		return
	if avatar.sprite_frames.has_animation(&"idle"):
		avatar.play(&"idle")


func _setup_weapon_system() -> void:
	weapon_manager.set_target_provider(_provide_weapon_targets)
	weapon_manager.hand_attack_started.connect(_on_hand_attack_started)
	weapon_manager.hand_attack_instance_created.connect(_on_hand_attack_instance_created)
	weapon_manager.hand_attack_hit.connect(_on_hand_attack_hit)
	weapon_manager.hand_skill_started.connect(_on_hand_skill_started)
	weapon_manager.hand_skill_resolved.connect(_on_hand_skill_resolved)
	weapon_manager.dash_started.connect(_on_dash_started)
	weapon_manager.dash_completed.connect(_on_dash_completed)
	weapon_manager.weapon_swap_requested.connect(_on_weapon_swap_requested)
	weapon_manager.weapon_swap_transition_started.connect(_on_weapon_swap_transition_started)
	weapon_manager.weapon_swapped.connect(_on_weapon_swapped)
	weapon_manager.loadout_changed.connect(_on_weapon_loadout_changed)
	weapon_manager.spirit_trigger_progressed.connect(_on_spirit_trigger_progressed)
	weapon_manager.spirit_action_started.connect(_on_spirit_action_started)

	var snapshot: Dictionary = SaveService.get_snapshot()
	var loadout: Dictionary = snapshot.get("loadout", {})
	var hand_id := StringName(String(loadout.get("hand_weapon", "sword")).to_lower())
	if not _weapon_registry.has(hand_id) or not UnlockService.is_weapon_unlocked(hand_id):
		hand_id = &"sword"
	var hand_weapon := _weapon_registry.get(hand_id, SWORD_DEFINITION) as WeaponDefinition
	var spirits: Array[WeaponDefinition] = []
	var raw_spirits: Variant = loadout.get("spirit_slots", [])
	if raw_spirits is Array:
		for raw_id: Variant in (raw_spirits as Array).slice(0, WeaponManager.MAX_SPIRIT_SLOTS):
			var spirit_id := StringName(String(raw_id).to_lower())
			var spirit: WeaponDefinition = null
			if (
				not spirit_id.is_empty()
				and spirit_id != hand_id
				and _weapon_registry.has(spirit_id)
				and UnlockService.is_weapon_unlocked(spirit_id)
			):
				spirit = _weapon_registry[spirit_id] as WeaponDefinition
			spirits.append(spirit)
	while spirits.size() < WeaponManager.MAX_SPIRIT_SLOTS:
		spirits.append(null)

	# A profile made before the reward integration may already own Bow but have
	# an empty loadout. Repair it once so the earned weapon is visible in-world.
	if UnlockService.is_weapon_unlocked(&"bow") and hand_id != &"bow" and not _array_has_weapon(spirits, &"bow"):
		spirits[0] = BOW_DEFINITION
	weapon_manager.configure_loadout(
		hand_weapon,
		spirits,
		UnlockService.is_feature_unlocked(&"second_spirit")
	)
	_refresh_weapon_visuals()


func _array_has_weapon(weapons: Array[WeaponDefinition], weapon_id: StringName) -> bool:
	for weapon: WeaponDefinition in weapons:
		if weapon != null and weapon.weapon_id == weapon_id:
			return true
	return false


func _provide_weapon_targets(rules: WeaponTargetRules, context: Dictionary) -> Array[Node]:
	var result: Array[Node] = []
	if rules == null or rules.maximum_targets <= 0:
		return result
	var origin := context.get("origin", global_position) as Vector2
	var aim := context.get("facing", facing_direction) as Vector2
	if context.get("action_direction") is Vector2:
		aim = context["action_direction"] as Vector2
	var pointer_value: Variant = context.get("pointer_position")
	if pointer_value is Vector2:
		var pointer_targets := TargetingService.acquire_near_point(
			self,
			origin,
			pointer_value as Vector2,
			rules.range,
			_pointer_snap_radius(rules),
			rules.maximum_targets
		)
		for pointer_target: Node2D in pointer_targets:
			result.append(pointer_target)
			if result.size() >= rules.maximum_targets:
				return result
	var selected := TargetingService.acquire_up_to(
		self,
		origin,
		aim,
		rules.range,
		rules.facing_cone_degrees,
		rules.maximum_targets,
		rules.low_health_preference
	)
	for target: Node2D in selected:
		if not result.has(target):
			result.append(target)
		if result.size() >= rules.maximum_targets:
			break
	return result


func _acquire_visible_archer_target(rules: WeaponTargetRules, context: Dictionary) -> Node2D:
	if rules == null:
		return null
	var pointer_value: Variant = context.get("pointer_position")
	var aim := context.get("facing", facing_direction) as Vector2
	if context.get("action_direction") is Vector2:
		aim = context["action_direction"] as Vector2
	return _resolve_attack_target(rules, pointer_value, aim, true)


func _start_hand_attack(allow_charge_input := true, pointer_aim: Variant = null) -> bool:
	if is_carrying_torch():
		GameEvents.toast_requested.emit("Đang cầm đuốc nên không thể tấn công")
		return false
	if dead or not current_action.is_empty() or weapon_manager.is_swap_in_progress():
		return false
	var weapon := weapon_manager.get_hand_weapon()
	if weapon == null or weapon.normal_attack == null:
		return false
	var manual_direction := _pointer_direction(pointer_aim, facing_direction)
	var mana_cost := maxf(0.0, weapon.normal_attack.mana_cost)
	if weapon.weapon_id == &"bow" and _archer_infinite_arrows_remaining > 0.0:
		mana_cost = 0.0
	if not _can_spend_mana(mana_cost):
		_show_insufficient_mana(mana_cost)
		return false
	if weapon.weapon_id == &"wizard_staff":
		var wizard_target := _resolve_attack_target(
			weapon.normal_attack.target_rules, pointer_aim, manual_direction, true,
		)
		if wizard_target != null:
			manual_direction = global_position.direction_to(wizard_target.global_position)
		_requested_action_direction = manual_direction
		var wizard_context := {
			"origin": global_position,
			"facing": facing_direction,
			"pointer_position": pointer_aim if pointer_aim is Vector2 else global_position + manual_direction * 120.0,
			"manual_aim": pointer_aim is Vector2,
			"action_direction": manual_direction,
		}
		var wizard_combo := weapon_manager.notify_hand_attack_started(wizard_context)
		if not _start_action("wizard_attack"):
			return false
		_attack_instance_serial += 1
		wizard_context["instance_id"] = _attack_instance_serial
		wizard_context["combo_index"] = wizard_combo
		weapon_manager.notify_hand_attack_instance_created(wizard_context)
		if wizard_runtime == null or not wizard_runtime.start_wandering_shade(action_direction):
			_finish_action()
			return false
		_spend_mana(mana_cost)
		return true
	if weapon.weapon_id == &"bow" and pointer_aim is Vector2:
		manual_direction = (global_position + BODY_CENTER_OFFSET).direction_to(pointer_aim as Vector2)
		if manual_direction.is_zero_approx():
			manual_direction = facing_direction
	if weapon.weapon_id == &"axe":
		if is_axe_away():
			GameEvents.toast_requested.emit("RÌU ĐANG BAY  •  Bấm Kỹ năng để thu hồi")
			return false
		var axe_target := _resolve_attack_target(
			weapon.normal_attack.target_rules, pointer_aim, manual_direction,
		)
		_requested_action_direction = (
			global_position.direction_to(axe_target.global_position)
			if axe_target != null
			else manual_direction
		)
		if allow_charge_input:
			var charge_started := _begin_axe_charge()
			if charge_started:
				_spend_mana(mana_cost)
			return charge_started
		var cleave_started := _start_axe_cleave(0.0)
		if cleave_started:
			_spend_mana(mana_cost)
		return cleave_started
	var context := {"origin": global_position, "facing": facing_direction}
	if pointer_aim is Vector2:
		context["pointer_position"] = pointer_aim
		context["manual_aim"] = true
		context["action_direction"] = manual_direction
	var locked_target: Node2D = null
	if weapon.weapon_id == &"bow":
		locked_target = _resolve_attack_target(
			weapon.normal_attack.target_rules, pointer_aim, manual_direction, true,
		)
		_requested_action_direction = manual_direction
		if locked_target != null:
			_requested_action_direction = (
				global_position + BODY_CENTER_OFFSET
			).direction_to(locked_target.global_position)
	elif weapon.weapon_id == &"sword":
		if pointer_aim is Vector2:
			_requested_action_direction = manual_direction
		var melee_targets := weapon_manager.acquire_targets(weapon.normal_attack.target_rules, context)
		if not melee_targets.is_empty():
			var assisted_melee := melee_targets[0] as Node2D
			if assisted_melee != null:
				_requested_action_direction = (assisted_melee.global_position - global_position).normalized()

	var combo_index := weapon_manager.notify_hand_attack_started(context)
	var action_name := "bow_attack"
	if weapon.weapon_id == &"bow":
		_archer_active_combo_step = clampi(combo_index, 1, 3)
		if _archer_active_combo_step == 2:
			_archer_split_step_direction = (
				move_input.normalized()
				if not move_input.is_zero_approx()
				else -_requested_action_direction.normalized()
			)
	if weapon.weapon_id == &"sword":
		action_name = "sword_attack_%d" % clampi(combo_index, 1, 3)
	if not _start_action(action_name):
		return false
	_spend_mana(mana_cost)

	_attack_instance_serial += 1
	var instance_context := {
		"instance_id": _attack_instance_serial,
		"combo_index": combo_index,
		"origin": global_position,
		"facing": facing_direction,
	}
	if weapon.weapon_id == &"bow":
		_archer_pending_shot = {
			"cast_id": _attack_instance_serial,
			"step": _archer_active_combo_step,
			"direction": action_direction,
			"instance_context": instance_context,
		}
	else:
		weapon_manager.notify_hand_attack_instance_created(instance_context)
	return true


func _release_archer_shot() -> void:
	if _archer_pending_shot.is_empty():
		return
	var shot := _archer_pending_shot.duplicate(true)
	_archer_pending_shot.clear()
	var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	if arrow == null:
		return
	_effects_root().add_child(arrow)
	var step := clampi(int(shot.get("step", 1)), 1, 3)
	var step_index := step - 1
	var cast_id := int(shot.get("cast_id", 0))
	var direction := shot.get("direction", action_direction) as Vector2
	var focus_snapshot := _archer_focus
	var authored_damage := ARCHER_HERO.combo_damage(step)
	var target_cap := 1
	var stagger := ARCHER_HERO.archer_stagger_values[step_index]
	if step == 3:
		authored_damage += ARCHER_HERO.archer_piercer_focus_damage_bonus[focus_snapshot]
		target_cap = ARCHER_HERO.archer_piercer_focus_target_caps[focus_snapshot]
		stagger += float(focus_snapshot * 3)
		_set_archer_focus(0, &"armor_piercer_release")
	_archer_attack_contexts[cast_id] = {
		"step": step,
		"origin": global_position,
		"direction": direction,
		"focus_snapshot": focus_snapshot,
	}
	arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(&"bow", &"hand_attack", cast_id))
	arrow.completed.connect(_on_archer_arrow_completed.bind(cast_id), CONNECT_ONE_SHOT)
	var primary_damage := hero_soul_manager.scale_active_action_damage(
		&"normal_attack", authored_damage
	)
	arrow.setup(
		self,
		global_position + BODY_CENTER_OFFSET + direction * 10.0,
		direction,
		primary_damage,
		&"bow",
		ARCHER_HERO.archer_projectile_speeds[step_index],
		maxf(ARCHER_HERO.archer_projectile_ranges[step_index], FULL_MAP_PROJECTILE_DISTANCE),
		Color(0.96, 0.80, 0.34, 1.0),
		target_cap,
		stagger,
		ARCHER_HERO.archer_projectile_widths[step_index]
	)
	if _kit_buff_id == &"archer_wind_arrow" and _kit_buff_seconds_left > 0.0 \
			and _kit_buff_attacks_left > 0:
		_spawn_archer_wind_side_arrows(
			direction, authored_damage, step_index, target_cap, stagger, cast_id
		)
		_kit_buff_attacks_left -= 1
	var instance_context := shot.get("instance_context", {}) as Dictionary
	instance_context["projectile_direction"] = direction
	instance_context["focus_snapshot"] = focus_snapshot
	weapon_manager.notify_hand_attack_instance_created(instance_context)


func _spawn_archer_wind_side_arrows(
		direction: Vector2,
		authored_damage: float,
		step_index: int,
		target_cap: int,
		stagger: float,
		cast_id: int,
) -> void:
	var side_damage := hero_soul_manager.scale_active_action_damage(
		&"normal_attack", authored_damage * 0.35 * _kit_buff_damage_multiplier
	)
	var normalized := direction.normalized()
	var perpendicular := normalized.orthogonal()
	for side: float in [-1.0, 1.0]:
		var side_arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
		if side_arrow == null:
			continue
		_effects_root().add_child(side_arrow)
		var side_direction := normalized.rotated(deg_to_rad(5.0 * side))
		side_arrow.target_hit.connect(
			_on_weapon_effect_target_hit.bind(&"bow", &"wind_arrow", cast_id)
		)
		side_arrow.setup(
			self,
			global_position + BODY_CENTER_OFFSET + normalized * 10.0 + perpendicular * 6.0 * side,
			side_direction,
			side_damage,
			&"bow",
			ARCHER_HERO.archer_projectile_speeds[step_index],
			maxf(ARCHER_HERO.archer_projectile_ranges[step_index], FULL_MAP_PROJECTILE_DISTANCE),
			Color(0.57, 0.96, 0.86, 0.92),
			target_cap,
			stagger * 0.35,
			maxf(2.0, ARCHER_HERO.archer_projectile_widths[step_index] * 0.72),
		)


func _begin_axe_charge() -> bool:
	_axe_charge_snapshot = AXE_CHARGE_MATH.evaluate(AXE_DEFINITION.normal_attack, 0.0)
	_axe_charge_vfx_stage = 0
	_remote_axe_release_remaining = -1.0
	var started := _start_action("axe_charge")
	if started:
		_axe_charge_vfx_stage = 1
		VfxCatalog.spawn(get_parent(), &"axe_charge", global_position + Vector2(0.0, -10.0), 0.0, 0.58, Color(1.0, 0.62, 0.20, 0.48), 6)
	return started


func _release_axe_charge() -> bool:
	if current_action != "axe_charge":
		return false
	var held_seconds := action_elapsed
	current_action = ""
	action_elapsed = 0.0
	_remote_axe_release_remaining = -1.0
	return _start_axe_cleave(held_seconds)


func _start_axe_cleave(held_seconds: float) -> bool:
	if dead or weapon_manager.is_swap_in_progress() or is_axe_away():
		return false
	var weapon := weapon_manager.get_hand_weapon()
	if weapon == null or weapon.weapon_id != &"axe":
		return false
	_axe_charge_snapshot = AXE_CHARGE_MATH.evaluate(weapon.normal_attack, held_seconds)
	var context := {
		"origin": global_position,
		"facing": facing_direction,
		"source_weapon_id": &"axe",
		"charge_ratio": float(_axe_charge_snapshot.get("charge_ratio", 0.0)),
		"damage": _scale_active_action_damage(
			&"normal_attack",
			float(_axe_charge_snapshot.get("damage", 0.0))
		),
		"stagger": float(_axe_charge_snapshot.get("stagger", 0.0)),
		"arc_degrees": float(_axe_charge_snapshot.get("arc_degrees", 0.0)),
	}
	var assisted_targets := weapon_manager.acquire_targets(weapon.normal_attack.target_rules, context)
	if not assisted_targets.is_empty():
		var assisted := assisted_targets[0] as Node2D
		if assisted != null:
			_requested_action_direction = (assisted.global_position - global_position).normalized()
	if not _start_action("axe_cleave"):
		return false
	var charge_ratio := float(_axe_charge_snapshot.get("charge_ratio", 0.0))
	VfxCatalog.spawn(
		get_parent(),
		&"axe_cleave",
		global_position + action_direction * 22.0 + Vector2(0.0, -8.0),
		action_direction.angle(),
		0.85 + charge_ratio * 0.72,
		Color(1.0, 0.64 + charge_ratio * 0.18, 0.20, 0.78),
		9
	)
	var combo_index := weapon_manager.notify_hand_attack_started(context)
	_attack_instance_serial += 1
	context["instance_id"] = _attack_instance_serial
	context["combo_index"] = combo_index
	context["facing"] = action_direction
	weapon_manager.notify_hand_attack_instance_created(context)
	RealtimeBridge.publish_event("axe_cleave_created", context)
	return true


func _cancel_axe_charge() -> void:
	_remote_axe_release_remaining = -1.0
	_axe_charge_snapshot.clear()
	_axe_charge_vfx_stage = 0


func _update_axe_charge_vfx() -> void:
	var ratio := float(_axe_charge_snapshot.get("charge_ratio", 0.0))
	if ratio >= 1.0 and _axe_charge_vfx_stage < 3:
		_axe_charge_vfx_stage = 3
		VfxCatalog.spawn(get_parent(), &"axe_charge", global_position + Vector2(0.0, -10.0), 0.0, 1.05, Color(1.0, 0.72, 0.20, 0.86), 8)
	elif ratio >= 0.5 and _axe_charge_vfx_stage < 2:
		_axe_charge_vfx_stage = 2
		VfxCatalog.spawn(get_parent(), &"axe_charge", global_position + Vector2(0.0, -10.0), 0.0, 0.78, Color(1.0, 0.62, 0.18, 0.62), 7)


func get_axe_charge_ratio() -> float:
	if current_action != "axe_charge":
		return 0.0
	return float(_axe_charge_snapshot.get("charge_ratio", 0.0))


func is_axe_away() -> bool:
	return is_instance_valid(_axe_throw_effect) and _axe_throw_effect.is_away()


func _start_hand_skill(pointer_aim: Variant = null, rank_profile: Dictionary = {}) -> bool:
	if is_carrying_torch():
		GameEvents.toast_requested.emit("Đang cầm đuốc nên không thể dùng kỹ năng")
		return false
	var weapon := weapon_manager.get_hand_weapon()
	if weapon != null and weapon.weapon_id == &"axe" and is_axe_away():
		return _request_axe_recall()
	if dead or not current_action.is_empty() or weapon_manager.is_swap_in_progress():
		return false
	if weapon == null or weapon.hand_skill == null:
		return false
	if weapon.weapon_id == &"wizard_staff":
		return _start_wizard_dark_passage(pointer_aim, rank_profile)
	var mana_cost := 0.0
	if weapon.weapon_id in [&"bow", &"axe"]:
		mana_cost = hero_soul_manager.active_skill_mana_cost(
			hero_soul_manager.active_hero.resolved_active_skill_mana_cost()
		)
		if rank_profile.has("mana"):
			mana_cost = hero_soul_manager.active_skill_mana_cost(float(rank_profile["mana"]))
		if not _can_spend_mana(mana_cost):
			_show_insufficient_mana(mana_cost)
			return false
	_skill_cast_serial += 1
	var skill_instance_id := _skill_cast_serial
	var manual_direction := _pointer_direction(pointer_aim, facing_direction)
	var context := {
		"origin": global_position,
		"facing": facing_direction,
		"skill_instance_id": skill_instance_id,
		"cooldown_multiplier": (
			float(rank_profile["cooldown"]) / maxf(0.01, weapon.hand_skill.cooldown_seconds)
			if rank_profile.has("cooldown")
			else hero_soul_manager.active_skill_cooldown(1.0)
		),
	}
	if pointer_aim is Vector2:
		context["pointer_position"] = pointer_aim
		context["manual_aim"] = true
		context["action_direction"] = manual_direction
	var archer_mark_candidate: Node2D
	if weapon.weapon_id == &"bow":
		archer_mark_candidate = _acquire_visible_archer_target(weapon.hand_skill.target_rules, context)
		if archer_mark_candidate == null:
			GameEvents.toast_requested.emit("SOUL MARK  •  Cần một mục tiêu hợp lệ")
			return false
	if not weapon_manager.request_hand_skill(context):
		GameEvents.toast_requested.emit("Kỹ năng đang hồi")
		return false

	if weapon.weapon_id == &"sword":
		_active_skill_instance_id = skill_instance_id
		var assisted_targets := weapon_manager.acquire_targets(weapon.hand_skill.target_rules, context)
		_requested_action_direction = manual_direction
		if not assisted_targets.is_empty():
			var assisted := assisted_targets[0] as Node2D
			if assisted != null and global_position.distance_to(assisted.global_position) <= weapon.hand_skill.movement_distance * 1.2:
				_requested_action_direction = (assisted.global_position - global_position).normalized()
		return _start_action("dash_slash")

	if weapon.weapon_id == &"bow":
		_requested_action_direction = global_position.direction_to(archer_mark_candidate.global_position)
		if not _start_action("bow_volley"):
			return false
		if not _spend_mana(mana_cost):
			_finish_action()
			return false
		# Lock the candidate now, but make the mark real only when the 0.22-second
		# cast finishes. Taking damage or relaying during the cast cancels it.
		_archer_pending_mark_target = archer_mark_candidate
		return true

	if weapon.weapon_id == &"axe":
		var assisted_targets := weapon_manager.acquire_targets(weapon.hand_skill.target_rules, context)
		_requested_action_direction = manual_direction
		if not assisted_targets.is_empty():
			var assisted := assisted_targets[0] as Node2D
			if assisted != null:
				_requested_action_direction = (assisted.global_position - global_position).normalized()
		if not _start_action("axe_throw"):
			return false
		if not _spawn_axe_throw(weapon, skill_instance_id):
			_finish_action()
			return false
		if not _spend_mana(mana_cost):
			_clear_axe_throw_runtime()
			_finish_action()
			return false
		return true
	return false


func _start_wizard_dark_passage(pointer_aim: Variant = null, rank_profile: Dictionary = {}) -> bool:
	if wizard_runtime == null:
		return false
	var weapon := weapon_manager.get_hand_weapon()
	if weapon == null or weapon.weapon_id != &"wizard_staff" or weapon.hand_skill == null:
		return false
	var pointer := pointer_aim as Vector2 if pointer_aim is Vector2 else global_position + facing_direction * 120.0
	if not wizard_runtime.can_start_dark_passage(pointer):
		GameEvents.toast_requested.emit("DARK PASSAGE  •  Cần Dark Point hợp lệ")
		return false
	var continuation := wizard_runtime.has_dark_passage_chain()
	var context := {
		"origin": global_position,
		"facing": facing_direction,
		"pointer_position": pointer,
		"manual_aim": pointer_aim is Vector2,
		"cooldown_multiplier": (
			float(rank_profile["cooldown"]) / maxf(0.01, weapon.hand_skill.cooldown_seconds)
			if rank_profile.has("cooldown")
			else hero_soul_manager.active_skill_cooldown(1.0)
		),
	}
	if not continuation:
		var mana_cost := hero_soul_manager.active_skill_mana_cost(
			hero_soul_manager.active_hero.resolved_active_skill_mana_cost()
		)
		if rank_profile.has("mana"):
			mana_cost = hero_soul_manager.active_skill_mana_cost(float(rank_profile["mana"]))
		if not _can_spend_mana(mana_cost):
			_show_insufficient_mana(mana_cost)
			return false
		if not weapon_manager.request_hand_skill(context):
			GameEvents.toast_requested.emit("Kỹ năng đang hồi")
			return false
		if not _spend_mana(mana_cost):
			return false
	if not _start_action("wizard_passage"):
		return false
	var result := wizard_runtime.start_dark_passage(pointer)
	if result.is_empty():
		_finish_action()
		return false
	weapon_manager.notify_hand_skill_resolved({
		"source_weapon_id": &"wizard_staff",
		"endpoint": result.get("destination", global_position),
		"hit_count": 0,
		"has_meaningful_endpoint": true,
	})
	return true


func _spawn_bow_volley(weapon: WeaponDefinition, skill_instance_id: int) -> void:
	var skill := weapon.hand_skill
	var cast_id := skill_instance_id
	_pending_volley_casts[cast_id] = {
		"weapon_id": weapon.weapon_id,
		"remaining": 0,
		"hit_count": 0,
		"endpoint": global_position + facing_direction.normalized() * skill.target_rules.range,
	}
	var targets := weapon_manager.acquire_targets(
		skill.target_rules,
		{"origin": global_position, "facing": facing_direction}
	)
	var directions: Array[Vector2] = []
	for target: Node in targets:
		if target is Node2D:
			var target_direction := ((target as Node2D).global_position - global_position).normalized()
			if not target_direction.is_zero_approx():
				directions.append(target_direction)
	var base_direction := facing_direction.normalized()
	if base_direction.is_zero_approx():
		base_direction = Vector2.RIGHT
	var spread := deg_to_rad(skill.fallback_spread_degrees)
	var fallback_angles := [-spread, spread, 0.0]
	var fallback_index := 0
	while directions.size() < skill.projectile_count:
		directions.append(base_direction.rotated(float(fallback_angles[fallback_index % fallback_angles.size()])))
		fallback_index += 1
	for index: int in range(mini(directions.size(), skill.projectile_count)):
		var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
		if arrow == null:
			continue
		_effects_root().add_child(arrow)
		arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(weapon.weapon_id, &"hand_skill", cast_id))
		arrow.completed.connect(_on_volley_arrow_completed.bind(cast_id), CONNECT_ONE_SHOT)
		var cast_state: Dictionary = _pending_volley_casts[cast_id]
		cast_state["remaining"] = int(cast_state.get("remaining", 0)) + 1
		_pending_volley_casts[cast_id] = cast_state
		arrow.setup(
			self,
			global_position + BODY_CENTER_OFFSET + directions[index] * 10.0,
			directions[index],
			_scale_active_combat_damage(skill.damage),
			weapon.weapon_id,
			460.0,
			skill.target_rules.range,
			Color(0.95, 0.72, 0.24, 1.0)
		)
	if int((_pending_volley_casts[cast_id] as Dictionary).get("remaining", 0)) == 0:
		_finish_volley_cast(cast_id)


func _spawn_axe_throw(weapon: WeaponDefinition, skill_instance_id: int) -> bool:
	var skill := weapon.hand_skill
	var effect := AXE_THROW_SCENE.instantiate() as AxeThrowEffect
	if effect == null:
		return false
	_effects_root().add_child(effect)
	effect.target_hit.connect(_on_axe_throw_target_hit.bind(weapon.weapon_id))
	effect.completed.connect(_on_axe_throw_completed.bind(skill_instance_id), CONNECT_ONE_SHOT)
	var start_position := global_position + BODY_CENTER_OFFSET + action_direction * 12.0
	if not effect.setup(
			self,
			start_position,
			action_direction,
		_scale_active_action_damage(&"active_skill", skill.damage),
		skill.stagger,
		skill.cross_hit_stagger_bonus,
		weapon.weapon_id,
		skill.outbound_speed,
		skill.return_speed,
		skill.target_rules.range,
		skill.automatic_recall_seconds,
		skill.path_width,
		skill.return_snap_distance,
		skill.stop_outbound_on_world
	):
		return false
	_axe_throw_effect = effect
	_axe_throw_skill_instance_id = skill_instance_id
	_axe_throw_origin = start_position
	if hand_weapon_visual.weapon_id == &"axe":
		hand_weapon_visual.hide()
	RealtimeBridge.publish_event("axe_throw_created", {
		"skill_instance_id": skill_instance_id,
		"direction": [action_direction.x, action_direction.y],
	})
	return true


func _request_axe_recall() -> bool:
	if not is_axe_away():
		return false
	var accepted := _axe_throw_effect.request_recall(true)
	if accepted:
		GameEvents.toast_requested.emit("THU HỒI")
		RealtimeBridge.publish_event("axe_recall_requested", {
			"skill_instance_id": _axe_throw_skill_instance_id,
			"player_position": [global_position.x, global_position.y],
		})
	return accepted


func _clear_axe_throw_runtime() -> void:
	if is_instance_valid(_axe_throw_effect):
		_axe_throw_effect.queue_free()
	_axe_throw_effect = null
	_axe_throw_skill_instance_id = 0
	_remote_axe_release_remaining = -1.0
	_refresh_weapon_visuals()


func get_active_skill_mana_cost() -> float:
	var active := hero_soul_manager.active_hero
	if active == null or not active.active_skill_enabled:
		return 0.0
	var ranked := _active_hero_ranked_skill_profile(&"active_1")
	if ranked.has("mana"):
		return hero_soul_manager.active_skill_mana_cost(float(ranked["mana"]))
	return hero_soul_manager.active_skill_mana_cost(active.resolved_active_skill_mana_cost())


func get_ultimate_mana_cost() -> float:
	var active := hero_soul_manager.active_hero
	if active == null:
		return 0.0
	var ranked := _active_hero_ranked_skill_profile(&"active_2")
	return hero_soul_manager.active_skill_mana_cost(
		maxf(0.0, float(ranked.get("mana", active.ultimate_mana_cost)))
	)


func get_ultimate_cooldown_remaining() -> float:
	var active := hero_soul_manager.active_hero
	if active == null:
		return 0.0
	return maxf(
		maxf(0.0, float(_ultimate_cooldowns.get(active.hero_id, 0.0))),
		get_active_hero_skill_cooldown_remaining(&"active_2"),
	)


func is_archer_infinite_arrows_active() -> bool:
	return _archer_infinite_arrows_remaining > 0.0


func _archer_attack_speed_multiplier() -> float:
	return ARCHER_HERO.ultimate_power_multiplier if is_archer_infinite_arrows_active() else 1.0


func _try_activate_ultimate(pointer_aim: Variant = null, rank_profile: Dictionary = {}) -> bool:
	if dead or is_carrying_torch() or hero_soul_manager.active_hero == null:
		return false
	var hero := hero_soul_manager.active_hero
	if float(_ultimate_cooldowns.get(hero.hero_id, 0.0)) > 0.0:
		GameEvents.toast_requested.emit(
			"%s  •  HỒI %.1f GIÂY" % [
				hero.ultimate_name.to_upper(),
				float(_ultimate_cooldowns.get(hero.hero_id, 0.0)),
			]
		)
		return false
	var mana_cost := maxf(0.0, hero.ultimate_mana_cost)
	if rank_profile.has("mana"):
		mana_cost = hero_soul_manager.active_skill_mana_cost(float(rank_profile["mana"]))
	if not _can_spend_mana(mana_cost):
		_show_insufficient_mana(mana_cost)
		return false
	var activated := false
	match hero.ultimate_behavior_id:
		&"knight_cavalry_charge":
			activated = _activate_knight_cavalry(pointer_aim, rank_profile)
		&"archer_infinite_arrows":
			_archer_infinite_arrows_remaining = float(rank_profile.get(
				"duration", hero.ultimate_duration_seconds
			))
			activated = _archer_infinite_arrows_remaining > 0.0
			if activated:
				GameEvents.toast_requested.emit("VÔ HẠN TÊN  •  TỐC ĐỘ BẮN x3  •  3 GIÂY")
		&"wizard_raise_defeated":
			activated = wizard_runtime != null \
				and wizard_runtime.activate_raise_defeated()
	if not activated or not _spend_mana(mana_cost):
		return false
	var resolved_cooldown := maxf(
		0.01,
		float(rank_profile["cooldown"])
		if rank_profile.has("cooldown")
		else hero.ultimate_cooldown_seconds,
	)
	_ultimate_cooldowns[hero.hero_id] = resolved_cooldown
	RealtimeBridge.publish_event("ultimate_activated", {
		"hero_id": String(hero.hero_id),
		"behavior_id": String(hero.ultimate_behavior_id),
		"mana_cost": mana_cost,
		"cooldown": resolved_cooldown,
	})
	return true


func _activate_knight_cavalry(
		pointer_aim: Variant = null,
		rank_profile: Dictionary = {},
) -> bool:
	var direction := _pointer_direction(pointer_aim, facing_direction)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var charge := KNIGHT_CAVALRY_CHARGE_SCENE.instantiate()
	if charge == null or not charge.has_method(&"setup"):
		if charge != null:
			charge.queue_free()
		return false
	_effects_root().add_child(charge)
	if charge.has_signal(&"target_hit"):
		charge.connect(&"target_hit", _on_knight_cavalry_target_hit)
	var total_ratio := float(rank_profile.get(
		"damage_ratio", SWORD_HERO.ultimate_power_multiplier
	))
	var total_damage := _scale_active_action_damage(
		&"ultimate",
		float(SWORD_HERO.base_damage) * total_ratio,
	)
	var tick_count := maxi(1, int(rank_profile.get(
		"damage_ticks", KNightRules.LEGION_DAMAGE_TICKS
	)))
	var rider_count := clampi(int(rank_profile.get("rider_count", 5)), 1, 15)
	return bool(charge.call(
		&"setup", self, global_position, direction, total_damage, rider_count, tick_count
	))


func _on_knight_cavalry_target_hit(target: Node, damage: int) -> void:
	GameSession.add_score(damage)
	weapon_manager.notify_enemy_damaged(target, damage, {
		"hero_id": &"sword_hero",
		"source_kind": &"ultimate",
		"source_weapon_id": &"knight_cavalry",
	})
	if not CombatDamage.is_alive(target):
		weapon_manager.notify_enemy_killed(target, {
			"hero_id": &"sword_hero",
			"source_kind": &"ultimate",
		})


func get_mana_regen_per_second() -> float:
	return hero_soul_manager.active_mana_regen_per_second()


func can_pay_active_skill_mana() -> bool:
	# Axe Recall is the second half of the already-paid cast and must never be
	# stranded by an empty resource bar.
	if hero_soul_manager.active_hero != null \
			and hero_soul_manager.active_hero.hero_id == &"axe_hero" \
			and is_axe_away():
		return true
	return _can_spend_mana(get_active_skill_mana_cost())


func _can_spend_mana(cost: float) -> bool:
	return cost <= 0.0 or mana + 0.001 >= cost


func _spend_mana(cost: float) -> bool:
	if not _can_spend_mana(cost):
		return false
	_set_mana(mana - maxf(0.0, cost))
	return true


func _show_insufficient_mana(cost: float) -> void:
	GameEvents.toast_requested.emit(
		"KHÔNG ĐỦ MANA  •  CẦN %d  •  HIỆN CÓ %d" % [ceili(cost), floori(mana)]
	)


func _on_spirit_action_started(
		weapon: WeaponDefinition,
		_spirit_slot: int,
		action: SpiritActionDefinition,
		context: Dictionary
) -> void:
	GameEvents.spirit_action_started.emit(weapon.weapon_id)
	if action.action_id == &"flying_sword":
		var target: Node2D = null
		var raw_targets: Variant = context.get("targets", [])
		if raw_targets is Array and not (raw_targets as Array).is_empty():
			target = (raw_targets as Array)[0] as Node2D
		if target == null:
			weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
			return
		var flying_sword := FLYING_SWORD_SCENE.instantiate() as FlyingSwordEffect
		if flying_sword == null:
			weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
			return
		_effects_root().add_child(flying_sword)
		flying_sword.slash_confirmed.connect(_on_weapon_effect_target_hit.bind(weapon.weapon_id, &"spirit", -1))
		flying_sword.completed.connect(_on_flying_sword_completed.bind(weapon.weapon_id), CONNECT_ONE_SHOT)
		var spirit_start := spirit_weapon_visual.global_position if spirit_weapon_visual.visible else global_position + BODY_CENTER_OFFSET
		flying_sword.setup(
			self,
			target,
			spirit_start,
			_scale_active_combat_damage(action.damage),
			weapon.weapon_id
		)
		weapon_manager.notify_spirit_effect_created(weapon.weapon_id)
		return

	if action.action_id == &"reverse_piercing_shot":
		var direction := context.get("action_direction", -facing_direction) as Vector2
		if direction.is_zero_approx():
			direction = -facing_direction
		var dash_origin := context.get("origin", global_position) as Vector2
		# Snapshot damage before the delayed release. A very fast Q takeover may
		# change the active Hero before frame 0.14, but it must not retroactively
		# change the already-confirmed Bow Spirit action's stats or affixes.
		var shot_damage := _scale_active_combat_damage(action.damage)
		var relay_opened := hero_soul_manager.begin_archer_dash_relay_opportunity(
			dash_origin,
			ARCHER_DASH_RELAY_DURATION
		)
		if relay_opened:
			if is_instance_valid(_soul_support_visual):
				_soul_support_visual.queue_free()
			_soul_support_visual = _spawn_archer_soul_avatar(
				dash_origin,
				&"archer_summon",
				ARCHER_DASH_RELAY_DURATION,
				direction,
				true
			)
			weapon_manager.notify_spirit_effect_created(weapon.weapon_id)
			get_tree().create_timer(ARCHER_DASH_SHOT_RELEASE_SECONDS, false).timeout.connect(
				_spawn_reverse_piercing_shot.bind(
					weapon,
					action,
					dash_origin,
					direction,
					shot_damage,
					false
				),
				CONNECT_ONE_SHOT
			)
		else:
			# Keep legacy profiles functional when Bow exists without an equipped
			# Archer Reserve, or when another support summon already owns Relay.
			_spawn_reverse_piercing_shot(
				weapon,
				action,
				dash_origin,
				direction,
				shot_damage
			)
		return

	if action.action_id == &"follow_through":
		var primary_target := context.get("primary_target") as Node2D
		var meaningful := bool(context.get("has_meaningful_endpoint", false))
		var has_resolved_endpoint := meaningful and context.has("endpoint")
		if primary_target != null and not CombatDamage.is_alive(primary_target):
			primary_target = null
		if primary_target == null and not has_resolved_endpoint:
			var raw_targets: Variant = context.get("targets", [])
			if raw_targets is Array and not (raw_targets as Array).is_empty():
				primary_target = (raw_targets as Array)[0] as Node2D
		var endpoint := context.get("endpoint", global_position) as Vector2
		if is_instance_valid(primary_target):
			endpoint = primary_target.global_position
			meaningful = true
		if not meaningful:
			weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
			return
		var follow_through := AXE_FOLLOW_THROUGH_SCENE.instantiate() as AxeFollowThroughEffect
		if follow_through == null:
			weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
			return
		_effects_root().add_child(follow_through)
		follow_through.target_hit.connect(_on_follow_through_target_hit.bind(weapon.weapon_id))
		follow_through.completed.connect(_on_follow_through_completed.bind(weapon.weapon_id), CONNECT_ONE_SHOT)
		var spirit_start := spirit_weapon_visual.global_position if spirit_weapon_visual.visible else global_position + BODY_CENTER_OFFSET
		if not follow_through.setup(
			self,
			spirit_start,
			endpoint,
			primary_target,
			_scale_active_combat_damage(action.damage),
			action.stagger,
			weapon.weapon_id,
			action.outbound_speed,
			action.return_speed,
			action.maximum_lifetime,
			action.path_width,
			action.return_snap_distance
		):
			weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
			return
		weapon_manager.notify_spirit_effect_created(weapon.weapon_id)


func _spawn_reverse_piercing_shot(
		weapon: WeaponDefinition,
		action: SpiritActionDefinition,
		origin: Vector2,
		direction: Vector2,
		shot_damage: int,
		notify_effect_created := true,
) -> void:
	if weapon == null or action == null or dead:
		if weapon != null:
			weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
		return
	var shot_direction := direction.normalized()
	if shot_direction.is_zero_approx():
		shot_direction = -facing_direction
	if shot_direction.is_zero_approx():
		shot_direction = Vector2.LEFT
	var spirit_arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	if spirit_arrow == null:
		weapon_manager.notify_spirit_action_completed(weapon.weapon_id)
		return
	_effects_root().add_child(spirit_arrow)
	spirit_arrow.target_hit.connect(
		_on_weapon_effect_target_hit.bind(weapon.weapon_id, &"spirit", -1)
	)
	spirit_arrow.completed.connect(
		_on_spirit_arrow_completed.bind(weapon.weapon_id),
		CONNECT_ONE_SHOT
	)
	spirit_arrow.setup(
		self,
		origin + BODY_CENTER_OFFSET + shot_direction * 10.0,
		shot_direction,
		shot_damage,
		weapon.weapon_id,
		520.0,
		maxf(action.target_rules.range, FULL_MAP_PROJECTILE_DISTANCE),
		Color(0.40, 0.95, 1.0, 1.0)
	)
	if notify_effect_created:
		weapon_manager.notify_spirit_effect_created(weapon.weapon_id)


func _effects_root() -> Node:
	var current_scene := get_tree().current_scene
	return current_scene if current_scene != null else get_parent()


func _on_falling_arrow_impact(_position: Vector2, hit_count: int) -> void:
	RealtimeBridge.publish_event("falling_arrow_impact", {"hit_count": hit_count})


func _on_weapon_effect_target_hit(
		target: Node,
		damage: int,
		weapon_id: StringName,
		source_kind: StringName,
		cast_id: int
) -> void:
	GameSession.add_score(damage)
	if weapon_id == &"bow" and source_kind == &"hand_attack":
		_on_archer_normal_target_hit(target, cast_id)
	var context := {
		"source_weapon_id": weapon_id,
		"source_kind": source_kind,
		"cast_id": cast_id,
		"target": target,
		"damage": damage,
	}
	weapon_manager.notify_enemy_damaged(target, damage, context)
	if source_kind == &"hand_attack":
		weapon_manager.notify_hand_attack_hit(context)
	if not CombatDamage.is_alive(target):
		weapon_manager.notify_enemy_killed(target, context)


func _on_archer_normal_target_hit(target: Node, cast_id: int) -> void:
	var attack_context: Dictionary = _archer_attack_contexts.get(cast_id, {})
	if attack_context.is_empty():
		return
	var step := int(attack_context.get("step", 0))
	if step in [1, 2] and target is Node2D:
		var origin := attack_context.get("origin", global_position) as Vector2
		var distance := origin.distance_to((target as Node2D).global_position)
		if (
			distance >= ARCHER_HERO.archer_focus_min_distance
			and distance <= ARCHER_HERO.archer_focus_max_distance
			and _has_attack_line_of_sight(target as Node2D)
		):
			_set_archer_focus(_archer_focus + 1, &"confirmed_spacing_hit")
	if target == _archer_mark_target:
		var direction := attack_context.get("direction", facing_direction) as Vector2
		_clear_archer_mark(&"consumed")
		_spawn_archer_soul_line(direction, cast_id)


func _spawn_archer_soul_line(direction: Vector2, cast_id: int) -> void:
	var arrow := PIERCING_ARROW_SCENE.instantiate() as PiercingArrowEffect
	if arrow == null:
		return
	_effects_root().add_child(arrow)
	arrow.target_hit.connect(_on_weapon_effect_target_hit.bind(&"bow", &"hand_skill", cast_id))
	arrow.completed.connect(_on_archer_soul_line_completed.bind(cast_id), CONNECT_ONE_SHOT)
	arrow.setup(
		self,
		global_position + BODY_CENTER_OFFSET + direction.normalized() * 10.0,
		direction,
		_scale_active_action_damage(&"active_skill", ARCHER_HERO.archer_soul_line_damage),
		&"bow",
		ARCHER_HERO.archer_soul_line_speed,
		maxf(ARCHER_HERO.archer_soul_line_range, FULL_MAP_PROJECTILE_DISTANCE),
		Color(0.48, 0.90, 1.0, 1.0),
		ARCHER_HERO.archer_soul_line_target_cap,
		ARCHER_HERO.archer_soul_line_stagger,
		ARCHER_HERO.archer_soul_line_width
	)
	GameEvents.toast_requested.emit("SOUL LINE")


func _on_archer_arrow_completed(
		_reason: StringName,
		_hit_count: int,
		_position: Vector2,
		cast_id: int,
) -> void:
	_archer_attack_contexts.erase(cast_id)


func _on_archer_soul_line_completed(
		_reason: StringName,
		hit_count: int,
		position: Vector2,
		cast_id: int,
) -> void:
	weapon_manager.notify_hand_skill_resolved({
		"source_weapon_id": &"bow",
		"skill_instance_id": cast_id,
		"endpoint": position,
		"hit_count": hit_count,
		"has_meaningful_endpoint": true,
	})


func _on_axe_throw_target_hit(
		target: Node,
		damage: int,
		phase: StringName,
		cross_cut: bool,
		stagger: float,
		weapon_id: StringName
) -> void:
	GameSession.add_score(damage)
	var context := {
		"source_weapon_id": weapon_id,
		"source_kind": &"hand_skill",
		"skill_instance_id": _axe_throw_skill_instance_id,
		"target": target,
		"damage": damage,
		"phase": phase,
		"cross_cut": cross_cut,
		"stagger": stagger,
	}
	weapon_manager.notify_enemy_damaged(target, damage, context)
	if cross_cut:
		GameEvents.toast_requested.emit("CHÉM GIAO NHAU")
		RealtimeBridge.publish_event("axe_cross_cut", {
			"target": target.name,
			"extra_stagger": AXE_DEFINITION.hand_skill.cross_hit_stagger_bonus,
			"skill_instance_id": _axe_throw_skill_instance_id,
		})
	if not CombatDamage.is_alive(target):
		weapon_manager.notify_enemy_killed(target, context)


func _on_axe_throw_completed(
		hit_count: int,
		principal_endpoint: Vector2,
		primary_target: Node,
		manual_recall: bool,
		skill_instance_id: int
) -> void:
	var meaningful := hit_count > 0 or principal_endpoint.distance_to(_axe_throw_origin) > 8.0
	_axe_throw_effect = null
	_axe_throw_skill_instance_id = 0
	_refresh_weapon_visuals()
	weapon_manager.notify_hand_skill_resolved({
		"source_weapon_id": &"axe",
		"endpoint": principal_endpoint,
		"primary_target": primary_target,
		"hit_count": hit_count,
		"has_meaningful_endpoint": meaningful,
		"skill_instance_id": skill_instance_id,
		"manual_recall": manual_recall,
	})
	RealtimeBridge.publish_event("axe_throw_resolved", {
		"hit_count": hit_count,
		"endpoint": [principal_endpoint.x, principal_endpoint.y],
		"manual_recall": manual_recall,
		"skill_instance_id": skill_instance_id,
	})


func _on_follow_through_target_hit(
		target: Node,
		damage: int,
		phase: StringName,
		stagger: float,
		weapon_id: StringName
) -> void:
	GameSession.add_score(damage)
	var context := {
		"source_weapon_id": weapon_id,
		"source_kind": &"spirit",
		"target": target,
		"damage": damage,
		"phase": phase,
		"stagger": stagger,
	}
	weapon_manager.notify_enemy_damaged(target, damage, context)
	if not CombatDamage.is_alive(target):
		weapon_manager.notify_enemy_killed(target, context)


func _on_follow_through_completed(_hit_count: int, weapon_id: StringName) -> void:
	weapon_manager.notify_spirit_action_completed(weapon_id)


func _on_volley_arrow_completed(
		_reason: StringName,
		hit_count: int,
		position: Vector2,
		cast_id: int
) -> void:
	if not _pending_volley_casts.has(cast_id):
		return
	var state: Dictionary = _pending_volley_casts[cast_id]
	state["remaining"] = maxi(0, int(state.get("remaining", 1)) - 1)
	state["hit_count"] = int(state.get("hit_count", 0)) + hit_count
	state["endpoint"] = position
	_pending_volley_casts[cast_id] = state
	if int(state["remaining"]) == 0:
		_finish_volley_cast(cast_id)


func _finish_volley_cast(cast_id: int) -> void:
	if not _pending_volley_casts.has(cast_id):
		return
	var state: Dictionary = _pending_volley_casts[cast_id]
	_pending_volley_casts.erase(cast_id)
	weapon_manager.notify_hand_skill_resolved({
		"source_weapon_id": StringName(state.get("weapon_id", &"bow")),
		"endpoint": state.get("endpoint", global_position),
		"hit_count": int(state.get("hit_count", 0)),
		"cast_id": cast_id,
		"has_meaningful_endpoint": true,
		"skill_instance_id": cast_id,
	})


func _on_flying_sword_completed(_hit_count: int, weapon_id: StringName) -> void:
	weapon_manager.notify_spirit_action_completed(weapon_id)


func _on_spirit_arrow_completed(
		_reason: StringName,
		_hit_count: int,
		_position: Vector2,
		weapon_id: StringName
) -> void:
	weapon_manager.notify_spirit_action_completed(weapon_id)


func _on_hand_attack_started(weapon: WeaponDefinition, context: Dictionary) -> void:
	GameEvents.hand_attack_started.emit(weapon.weapon_id, int(context.get("combo_index", 1)))


func _on_hand_attack_instance_created(weapon: WeaponDefinition, context: Dictionary) -> void:
	GameEvents.hand_attack_instance_created.emit(weapon.weapon_id, int(context.get("instance_id", 0)))


func _on_hand_attack_hit(weapon: WeaponDefinition, context: Dictionary) -> void:
	var target := context.get("target") as Node
	if target != null:
		GameEvents.hand_attack_hit.emit(weapon.weapon_id, target, int(context.get("damage", 0)))


func _on_hand_skill_started(weapon: WeaponDefinition, _context: Dictionary) -> void:
	GameEvents.hand_skill_started.emit(weapon.weapon_id)


func _on_hand_skill_resolved(weapon: WeaponDefinition, context: Dictionary) -> void:
	var endpoint := context.get("endpoint", global_position) as Vector2
	GameEvents.hand_skill_resolved.emit(weapon.weapon_id, endpoint, int(context.get("hit_count", 0)))


func _on_dash_started(direction: Vector2, context: Dictionary) -> void:
	GameEvents.dash_started.emit(direction)
	if wizard_runtime != null:
		var origin := context.get("origin", global_position) as Vector2
		wizard_runtime.on_dash_started(origin, direction)


func _on_dash_completed(direction: Vector2, _context: Dictionary) -> void:
	GameEvents.dash_completed.emit(direction)


func _on_weapon_swap_requested(
		spirit_slot: int,
		_hand_weapon: WeaponDefinition,
		_requested_weapon: WeaponDefinition,
		_queued: bool
) -> void:
	GameEvents.weapon_swap_requested.emit(spirit_slot)


func _on_weapon_swap_transition_started(
		_spirit_slot: int,
		_hand_weapon: WeaponDefinition,
		_requested_weapon: WeaponDefinition
) -> void:
	if current_action.is_empty():
		_start_action("weapon_swap")


func _on_weapon_swapped(
		_spirit_slot: int,
		_previous_hand: WeaponDefinition,
		_new_hand: WeaponDefinition
) -> void:
	if current_action == "weapon_swap":
		current_action = ""
		action_elapsed = 0.0
	player_state = PlayerState.IDLE
	weapon_manager.notify_action_interruptible()
	_refresh_weapon_visuals()
	_save_weapon_loadout()
	var hand := weapon_manager.get_hand_weapon()
	var spirit_ids := _spirit_weapon_ids()
	GameEvents.weapon_swapped.emit(hand.weapon_id if hand != null else &"", spirit_ids)
	var event_state := weapon_manager.get_runtime_state()
	event_state["character_form_id"] = String(_active_character_form_id)
	event_state["character_animation_library"] = String(hand.hand_animation_library) if hand != null else ""
	RealtimeBridge.publish_event("weapon_swapped", event_state)


func _on_weapon_loadout_changed() -> void:
	_refresh_weapon_visuals()


func _on_spirit_trigger_progressed(
		weapon: WeaponDefinition,
		_spirit_slot: int,
		current: float,
		required: float
) -> void:
	GameEvents.spirit_trigger_progressed.emit(weapon.weapon_id, roundi(current), roundi(required))


func _refresh_weapon_visuals() -> void:
	var hand := weapon_manager.get_hand_weapon()
	_apply_hand_character_form(hand)
	var spirit := weapon_manager.get_spirit_weapon(0)
	if spirit == null and weapon_manager.second_spirit_slot_enabled:
		spirit = weapon_manager.get_spirit_weapon(1)
	_hide_legacy_weapon_visuals()
	# Sword and Axe are authored into their complete character animation sheets.
	# Only a genuinely external Hand weapon (currently the legacy Bow) may use
	# WeaponVisual2D; Spirit weapons stay hidden so no weapons float around Hero.
	if hand != null and not is_hand_weapon_baked_into_character() and is_instance_valid(hand_weapon_visual):
		hand_weapon_visual.set_weapon(hand.weapon_id)
		hand_weapon_visual.visible = true
		hand_weapon_visual.process_mode = Node.PROCESS_MODE_INHERIT
	_update_attack_transform()


func is_carrying_torch() -> bool:
	return is_instance_valid(_carried_torch)


func pickup_torch(torch: Node2D) -> bool:
	if torch == null or is_carrying_torch():
		return false
	_carried_torch = torch
	if _carried_torch.get_parent() != self:
		_carried_torch.reparent(self, true)
	_carried_torch.position = Vector2(10.0, -30.0)
	if _carried_torch.has_method(&"set_held_by_player"):
		_carried_torch.call(&"set_held_by_player", true)
	else:
		_carried_torch.set("held_by_player", true)
	GameEvents.toast_requested.emit("Đã nhặt đuốc — nhấn E để cắm xuống")
	RealtimeBridge.publish_event("torch_picked_up", {"player": get_instance_id()})
	return true


func place_carried_torch() -> bool:
	if not is_carrying_torch():
		return false
	var torch := _carried_torch
	_carried_torch = null
	var parent := get_parent() as Node
	if parent != null:
		torch.reparent(parent, true)
	torch.global_position = global_position + facing_direction.normalized() * 18.0 + Vector2(0.0, -8.0)
	if torch.has_method(&"set_held_by_player"):
		torch.call(&"set_held_by_player", false)
	else:
		torch.set("held_by_player", false)
	GameEvents.toast_requested.emit("Đã cắm đuốc xuống")
	RealtimeBridge.publish_event("torch_placed", {"position": [torch.global_position.x, torch.global_position.y]})
	return true


func _hide_legacy_weapon_visuals() -> void:
	if is_instance_valid(hand_weapon_visual):
		hand_weapon_visual.set_weapon(&"")
		hand_weapon_visual.visible = false
		hand_weapon_visual.process_mode = Node.PROCESS_MODE_DISABLED
	if is_instance_valid(spirit_weapon_visual):
		spirit_weapon_visual.set_weapon(&"")
		spirit_weapon_visual.visible = false
		spirit_weapon_visual.process_mode = Node.PROCESS_MODE_DISABLED


func _configure_vision_light() -> void:
	if not is_instance_valid(vision_light):
		return
	vision_light.texture = SpriteFramesFactory.make_radial_texture(160)
	vision_light.color = Color(0.72, 0.78, 1.0, 1.0)
	vision_light.energy = 1.15
	vision_light.texture_scale = 2.85


func _apply_hand_character_form(hand: WeaponDefinition) -> void:
	var next_form_id := DEFAULT_CHARACTER_FORM_ID
	if hand != null and hand.hand_animation_library == AXE_CHARACTER_FORM_ID:
		next_form_id = AXE_CHARACTER_FORM_ID
	elif hand != null and hand.hand_animation_library == ARCHER_CHARACTER_FORM_ID:
		next_form_id = ARCHER_CHARACTER_FORM_ID
	elif hand != null and hand.hand_animation_library == WIZARD_CHARACTER_FORM_ID:
		next_form_id = WIZARD_CHARACTER_FORM_ID
	if next_form_id == _active_character_form_id:
		return
	var next_frames := _character_form_frames.get(next_form_id) as SpriteFrames
	if next_frames == null:
		next_form_id = DEFAULT_CHARACTER_FORM_ID
		next_frames = _character_form_frames.get(DEFAULT_CHARACTER_FORM_ID) as SpriteFrames
	if next_frames == null:
		return
	var previous_animation := sprite.animation
	_active_character_form_id = next_form_id
	sprite.sprite_frames = next_frames
	_apply_character_form_presentation(next_form_id)
	var resume_animation := previous_animation
	if not sprite.sprite_frames.has_animation(resume_animation):
		resume_animation = &"idle"
	_play_animation(resume_animation, true)


func _apply_character_form_presentation(form_id: StringName) -> void:
	ground_shadow.scale = Vector2.ONE
	if form_id == AXE_CHARACTER_FORM_ID:
		_active_sprite_rest_position = AXE_SPRITE_REST_POSITION
		sprite.scale = AXE_CHARACTER_FORM_SCALE
	elif form_id == ARCHER_CHARACTER_FORM_ID:
		_active_sprite_rest_position = ARCHER_SPRITE_REST_POSITION
		sprite.scale = ARCHER_CHARACTER_FORM_SCALE
	elif form_id == WIZARD_CHARACTER_FORM_ID:
		_active_sprite_rest_position = WIZARD_SPRITE_REST_POSITION
		sprite.scale = WIZARD_CHARACTER_FORM_SCALE
		# Wizard's tall transparent sprite frame needs a wider, slightly flatter
		# contact shadow; it now reads as a grounded body rather than a floating
		# generic oval.
		ground_shadow.scale = Vector2(1.34, 0.84)
	else:
		_active_sprite_rest_position = SPRITE_REST_POSITION
		sprite.scale = DEFAULT_CHARACTER_FORM_SCALE
	sprite.position = _active_sprite_rest_position


func get_active_character_form_id() -> StringName:
	return _active_character_form_id


func is_hand_weapon_baked_into_character() -> bool:
	var hand := weapon_manager.get_hand_weapon()
	return hand != null and hand.weapon_id in [&"sword", &"bow", &"axe", &"wizard_staff"]


func _spirit_weapon_ids() -> Array[StringName]:
	var ids: Array[StringName] = []
	for weapon: WeaponDefinition in weapon_manager.get_spirit_slots():
		ids.append(weapon.weapon_id if weapon != null else &"")
	return ids


func _save_weapon_loadout() -> void:
	# Visual capture is diagnostic-only and must never mutate the player's
	# persistent profile when launched manually from the editor/CLI.
	if OS.get_cmdline_user_args().has("--axe-form-capture"):
		return
	var hand := weapon_manager.get_hand_weapon()
	if hand == null:
		return
	_loadout_save_serial += 1
	var revision := int(SaveService.get_snapshot().get("revision", 0))
	SaveService.set_loadout(
		hand.weapon_id,
		_spirit_weapon_ids(),
		"loadout:%d:%d" % [revision, _loadout_save_serial]
	)


func grant_bow_reward() -> bool:
	var was_unlocked := UnlockService.is_weapon_unlocked(&"bow")
	if not was_unlocked:
		UnlockService.unlock_weapon(&"bow", "level1:bow_reward")
	if not UnlockService.is_weapon_unlocked(&"bow"):
		return false
	if not was_unlocked:
		GameEvents.weapon_unlocked.emit(&"bow")

	var hand := weapon_manager.get_hand_weapon()
	var bow_is_equipped := hand != null and hand.weapon_id == &"bow"
	for spirit: WeaponDefinition in weapon_manager.get_spirit_slots():
		bow_is_equipped = bow_is_equipped or (spirit != null and spirit.weapon_id == &"bow")
	if not bow_is_equipped:
		weapon_manager.equip_spirit_slot(0, BOW_DEFINITION)
	SaveService.set_tutorial_completed(&"bow_reward", "tutorial:level1:bow_reward")
	_refresh_weapon_visuals()
	_save_weapon_loadout()
	GameEvents.toast_requested.emit("Đã nhận Cung — Q/E để đổi Hand và Spirit")
	return true


func grant_axe_reward() -> bool:
	var was_unlocked := UnlockService.is_weapon_unlocked(&"axe")
	if not was_unlocked:
		UnlockService.unlock_campaign_weapon(
			AXE_DEFINITION.weapon_id,
			AXE_DEFINITION.unlock_campaign_level,
			"level5:axe_reward"
		)
	if not UnlockService.is_weapon_unlocked(&"axe"):
		return false
	if not was_unlocked:
		GameEvents.weapon_unlocked.emit(&"axe")
	var hand := weapon_manager.get_hand_weapon()
	var axe_is_equipped := hand != null and hand.weapon_id == &"axe"
	for spirit: WeaponDefinition in weapon_manager.get_spirit_slots():
		axe_is_equipped = axe_is_equipped or (spirit != null and spirit.weapon_id == &"axe")
	if not axe_is_equipped:
		for slot: int in range(weapon_manager.get_active_spirit_slot_count()):
			if weapon_manager.get_spirit_weapon(slot) == null:
				weapon_manager.equip_spirit_slot(slot, AXE_DEFINITION)
				break
	_refresh_weapon_visuals()
	_save_weapon_loadout()
	GameEvents.toast_requested.emit("ĐÃ MỞ RÌU  •  Bổ Nặng + Ném & Thu Hồi")
	return true


func get_weapon_manager() -> WeaponManager:
	return weapon_manager


func _read_numeric_property(target: Object, property_name: StringName) -> float:
	for property: Dictionary in target.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			var value: Variant = target.get(property_name)
			if value is int or value is float:
				return float(value)
			break
	return -1.0


func request_action(action_name: String, pointer_aim: Variant = null) -> bool:
	if action_name == "dash" and current_action == "axe_throw" and is_axe_away() and dash_cooldown_remaining <= 0.0:
		current_action = ""
		action_elapsed = 0.0
		weapon_manager.notify_action_interruptible()
		return _start_action("dash")
	match action_name:
		"attack":
			if current_action in ["sword_attack_1", "sword_attack_2", "sword_attack_3", "sword_attack_4", "sword_attack_5", "bow_attack"]:
				_queued_weapon_attack = true
				_queued_attack_pointer_valid = pointer_aim is Vector2
				if _queued_attack_pointer_valid:
					_queued_attack_pointer_world = pointer_aim as Vector2
				if current_action != "bow_attack":
					_sword_combo_buffered = true
				return true
			var attack_weapon := weapon_manager.get_hand_weapon()
			if attack_weapon != null and attack_weapon.weapon_id != &"sword":
				return _start_hand_attack(false, pointer_aim)
			return _start_sword_hero_attack(pointer_aim)
		"skill":
			var active_profile := _active_hero_ranked_skill_profile(&"active_1")
			if active_profile.has("cooldown"):
				active_profile["cooldown"] = hero_soul_manager.active_skill_cooldown(
					float(active_profile["cooldown"])
				)
			var skill_weapon := weapon_manager.get_hand_weapon()
			if skill_weapon != null and skill_weapon.weapon_id != &"sword":
				return _start_hand_skill(pointer_aim, active_profile)
			return _try_activate_soul_echo(active_profile)
		"ultimate":
			var ultimate_profile := _active_hero_ranked_skill_profile(&"active_2")
			if hero_soul_manager.active_hero != null \
					and hero_soul_manager.active_hero.hero_id == &"sword_hero" \
					and StringName(ultimate_profile.get("id", &"")) in [
						&"k_night_soul_cleave",
						&"k_night_underworld_legion",
					]:
				return _arm_hero_skill(&"active_2")
			# Compatibility/test API exercises the authored legacy Ultimate
			# directly. Live keyboard input always goes through arm + LMB and the
			# selected Hero Weapon kit/rank profile.
			return _try_activate_ultimate(
				pointer_aim,
				ultimate_profile,
			)
		"soul_relay_1", "spirit_swap_1":
			return hero_soul_manager.request_soul_relay()
		"soul_relay_2", "spirit_swap_2":
			return false
		"jump", "hop":
			return _start_action("hop")
		"light_attack", "heavy_attack", "dash", "roll", "slide":
			if action_name == "light_attack" and combo_memory_remaining > 0.0:
				return _start_action("combo_attack")
			return _start_action(action_name)
		"crouch_attack":
			return _start_action("crouch_attack")
		"hit":
			take_damage(10)
			return true
		"respawn":
			# Checkpoint resurrection is no longer a gameplay action. Restarting a
			# run is owned by AppFlow/the defeat overlay.
			return false
	return false


func trigger_remote_action(action_name: String, pressed: bool, _strength := 1.0, duration := 0.0) -> void:
	var canonical := String(InputBootstrap.canonical_action(StringName(action_name)))
	if canonical == "attack":
		if not pressed:
			return
		# MCP/realtime presses must obey the same one-press input buffer as
		# keyboard, mouse and gamepad. Starting the attack directly used to
		# reject presses received during a running combo animation, which made
		# steps 2-4 appear to turn into movement for remote controllers.
		request_action("attack")
		return
	if not pressed:
		return
	if action_name in ["hit", "respawn", "crouch_attack"]:
		request_action(action_name)
		return
	if canonical in ["attack", "skill", "ultimate", "dash", "soul_relay_1", "soul_relay_2"]:
		request_action(canonical)


func apply_tuning(payload: Dictionary) -> bool:
	var validation: Dictionary = TuningSchema.validate_document(payload)
	if not bool(validation.get("ok", false)):
		push_warning("Rejected gameplay tuning: %s" % validation.get("error", "invalid document"))
		return false
	var player: Dictionary = payload.get("player", payload)
	move_speed = float(player.get("move_speed", move_speed))
	crouch_speed = float(player.get("crouch_speed", crouch_speed))
	acceleration = float(player.get("acceleration", acceleration))
	friction = float(player.get("friction", friction))
	dash_speed = float(player.get("dash_speed", dash_speed))
	dash_duration = float(player.get("dash_duration", dash_duration))
	dash_cooldown = float(player.get("dash_cooldown", dash_cooldown))
	roll_speed = float(player.get("roll_speed", roll_speed))
	roll_duration = float(player.get("roll_duration", roll_duration))
	slide_speed = float(player.get("slide_speed", slide_speed))
	slide_duration = float(player.get("slide_duration", slide_duration))
	hop_speed = float(player.get("hop_speed", hop_speed))
	hop_duration = float(player.get("hop_duration", hop_duration))
	hop_height = float(player.get("hop_height", hop_height))
	max_health = int(player.get("max_health", max_health))
	max_stamina = float(player.get("max_stamina", max_stamina))
	stamina_regen = float(player.get("stamina_regen", stamina_regen))
	health = mini(health, max_health)
	stamina = minf(stamina, max_stamina)

	var combat: Dictionary = payload.get("combat", {})
	light_damage = int(combat.get("light_damage", light_damage))
	heavy_damage = int(combat.get("heavy_damage", heavy_damage))
	crouch_damage = int(combat.get("crouch_damage", crouch_damage))
	combo_reset_time = float(combat.get("combo_reset_time", combo_reset_time))
	hit_invulnerability = float(combat.get("hit_invulnerability", hit_invulnerability))
	_emit_health()
	_emit_stamina(true)
	return true


func reload_tuning() -> void:
	_load_tuning()


func _load_tuning() -> void:
	if not FileAccess.file_exists(TUNING_PATH):
		return
	var file := FileAccess.open(TUNING_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed is Dictionary:
		apply_tuning(parsed)


func get_realtime_state() -> Dictionary:
	return {
		"position": [global_position.x, global_position.y],
		"velocity": [velocity.x, velocity.y],
		"health": health,
		"max_health": max_health,
		"barrier": barrier,
		"max_barrier": max_barrier,
		"mana": snappedf(mana, 0.01),
		"max_mana": snappedf(max_mana, 0.01),
		"stamina": snappedf(stamina, 0.1),
		"max_stamina": max_stamina,
		"facing": [facing_direction.x, facing_direction.y],
		"action": current_action if not current_action.is_empty() else String(sprite.animation),
		"player_state": _player_state_name(),
		"crouching": _gameplay_action_pressed("crouch"),
		"tuning": {
			"move_speed": move_speed,
			"hop_speed": hop_speed,
			"dash_speed": dash_speed,
		},
		"movement_mode": "top_down",
		"hero": {
			"id": String(hero_soul_manager.active_hero.hero_id) if hero_soul_manager.active_hero != null else "",
			"combat_stats": get_combat_stat_snapshot(),
			"mana": {
				"current": snappedf(mana, 0.01),
				"maximum": snappedf(max_mana, 0.01),
				"regen_per_second": snappedf(get_mana_regen_per_second(), 0.01),
				"active_skill_cost": snappedf(get_active_skill_mana_cost(), 0.01),
				"can_cast": can_pay_active_skill_mana(),
			},
			"combo_next_step": _sword_combo_next_step,
			"combo_reset_seconds": snappedf(_sword_combo_window_remaining, 0.01),
			"soul_echo_active": _is_soul_echo_active(),
			"soul_echo_cooldown": snappedf(soul_echo_cooldown_remaining, 0.01),
			"ultimate_name": hero_soul_manager.active_hero.ultimate_name if hero_soul_manager.active_hero != null else "",
			"ultimate_mana_cost": snappedf(get_ultimate_mana_cost(), 0.01),
			"ultimate_cooldown": snappedf(get_ultimate_cooldown_remaining(), 0.01),
			"archer_infinite_arrows_seconds": snappedf(_archer_infinite_arrows_remaining, 0.01),
			"archer_focus": _archer_focus,
			"archer_focus_maximum": ARCHER_HERO.archer_focus_max,
			"archer_focus_timeout": snappedf(_archer_focus_timeout_left, 0.01),
			"archer_combo_step": _archer_active_combo_step,
			"archer_mark_active": is_instance_valid(_archer_mark_target) and _archer_mark_seconds_left > 0.0,
			"archer_mark_seconds": snappedf(_archer_mark_seconds_left, 0.01),
			"wizard": wizard_runtime.get_state_snapshot() if wizard_runtime != null else {},
		},
		"soul_relay": hero_soul_manager.get_state_snapshot(),
		"character_form": {
			"id": String(_active_character_form_id),
			"animation_library": String(weapon_manager.get_hand_weapon().hand_animation_library) if weapon_manager.get_hand_weapon() != null else "",
			"animation": String(sprite.animation),
			"frame": sprite.frame,
			"hero_visual_baked": is_hand_weapon_baked_into_character(),
			"baked_hand_weapon": is_hand_weapon_baked_into_character(),
		},
		"dead": dead,
	}


func get_runtime_state() -> Dictionary:
	return get_realtime_state()


func _player_state_name() -> String:
	return PlayerState.keys()[player_state].to_lower()
