class_name HeroSoulManager
extends Node

## Authoritative state machine for readiness, support summon and Relay takeover.
## It deliberately knows nothing about WeaponManager.

signal team_changed(active_hero: HeroDefinition, reserve_soul: HeroDefinition)
signal combat_stats_changed(active_snapshot: Dictionary, reserve_snapshot: Dictionary)
signal readiness_changed(current: int, required: int, ready_seconds: float)
signal relay_state_changed(state_name: StringName, takeover_open: bool, seconds_left: float)
signal summon_started(incoming_hero: HeroDefinition, primary_attacker: Node, summon_position: Vector2)
signal summon_completed(incoming_hero: HeroDefinition, used_for_relay: bool)
signal relay_completed(incoming_hero: HeroDefinition, outgoing_hero: HeroDefinition, destination: Vector2)

enum RelayState {
	IDLE,
	READY,
	SUMMONING,
	SUPPORT_COOLDOWN,
}

const COMBAT_RESOLVER := preload("res://game/combat/combat_resolver.gd")
const AUXILIARY_COMBAT_STATS := preload("res://game/meta/equipment/auxiliary_equipment_combat_stats.gd")
const PLAYER_PROGRESSION_RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const HERO_PROGRESSION_RULES := preload("res://game/meta/progression/hero_progression_rules.gd")
const HERO_SKILL_COMBAT_RULES := preload("res://game/meta/progression/hero_skill_combat_rules.gd")
const HERO_SOUL_COMBAT_AFFIXES := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const HERO_SKILL_KIT_RULES := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const MAX_LIVE_COOLDOWN_REDUCTION_PERCENT := PLAYER_PROGRESSION_RULES.TOTAL_COOLDOWN_REDUCTION_CAP_PERCENT
const MAX_LIVE_BARRIER_CAPACITY_PERCENT := PLAYER_PROGRESSION_RULES.TOTAL_BARRIER_CAPACITY_CAP_PERCENT
const MAX_LIVE_DODGE_CHANCE_PERCENT := PLAYER_PROGRESSION_RULES.TOTAL_DODGE_CHANCE_CAP_PERCENT
const MAX_LIVE_HEALTH_REGEN_PERCENT_PER_SECOND := 5.0
const MAX_LIVE_MANA_COST_REDUCTION_PERCENT := 50.0
const MAX_LIVE_HEALING_RECEIVED_PERCENT := 50.0
const MAX_LIVE_MOVEMENT_SPEED_PERCENT := 25.0
const MAX_LIVE_DASH_SPEED_PERCENT := 35.0
const BASE_MANA_REGEN_PER_SECOND := 2.0

var active_hero: HeroDefinition
var reserve_soul: HeroDefinition
var state: RelayState = RelayState.IDLE
var readiness_count := 0
var ready_seconds_left := 0.0
var summon_elapsed := 0.0
var support_cooldown_left := 0.0
var takeover_open := false
var summon_position := Vector2.ZERO
var summon_context: StringName = &""
var soul_skill_armed := false

var _player: Node2D
var _seen_threat_ids: Dictionary = {}
var _primary_attacker: Node
var _primary_threat_distance := INF
var _clear_shot_progress_seconds := 0.0
var _summon_duration_override := 0.0
var _unused_support_cooldown_override := -1.0
var _takeover_for_full_summon := false
var _combat_save_snapshot: Dictionary = {}
var _combat_base_hp := PLAYER_PROGRESSION_RULES.BASE_HP
var _combat_base_mana := PLAYER_PROGRESSION_RULES.BASE_MANA
var _combat_snapshots_by_hero: Dictionary = {}


func _ready() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"melee_threat_emitted"):
		events.connect(&"melee_threat_emitted", _on_melee_threat_emitted)
	set_process(true)


func configure_team(
		controlled_player: Node2D,
		configured_active: HeroDefinition,
		configured_reserve: HeroDefinition
) -> bool:
	if controlled_player == null or configured_active == null:
		return false
	if not configured_active.validate().is_empty():
		return false
	if configured_reserve != null:
		if not configured_reserve.validate().is_empty():
			return false
		if configured_reserve.hero_id == configured_active.hero_id:
			return false
	_player = controlled_player
	active_hero = configured_active
	reserve_soul = configured_reserve
	_refresh_combat_snapshots()
	_reset_runtime_state()
	team_changed.emit(active_hero, reserve_soul)
	return true


func set_debug_team(configured_active: HeroDefinition, configured_reserve: HeroDefinition) -> bool:
	if not OS.has_feature("debug") or _player == null:
		return false
	return configure_team(_player, configured_active, configured_reserve)


## Reads an immutable SaveService snapshot and projects the one shared account
## loadout onto every Hero in the team. Runtime callers provide their already
## authored HP/Mana bases so an empty loadout is an exact identity operation.
func configure_combat_stats_from_save(
		save_snapshot: Dictionary,
		base_hp: float = PLAYER_PROGRESSION_RULES.BASE_HP,
		base_mana: float = PLAYER_PROGRESSION_RULES.BASE_MANA
) -> bool:
	if not is_finite(base_hp) or base_hp <= 0.0 or not is_finite(base_mana) or base_mana <= 0.0:
		return false
	_combat_save_snapshot = save_snapshot.duplicate(true)
	_combat_base_hp = base_hp
	_combat_base_mana = base_mana
	_refresh_combat_snapshots()
	return true


## Pure projection entry for Hub/UI/tests. Keeping the complete request and
## resolver breakdown in this snapshot prevents presentation code from copying
## any damage formula or instantiating this state-machine Node.
static func project_hero_combat(
		save_snapshot: Dictionary,
		hero: HeroDefinition,
		base_hp: float = PLAYER_PROGRESSION_RULES.BASE_HP,
		base_mana: float = PLAYER_PROGRESSION_RULES.BASE_MANA
) -> Dictionary:
	if hero == null or hero.base_damage <= 0 \
			or not is_finite(base_hp) or base_hp <= 0.0 \
			or not is_finite(base_mana) or base_mana <= 0.0:
		return {}
	var snapshot := AUXILIARY_COMBAT_STATS.derive_hero_snapshot(save_snapshot, hero, {
		"hp": float(hero.base_max_hp),
		"damage": float(hero.base_power),
		"mana": float(hero.base_max_mana),
	})
	snapshot["hero_skills"] = HERO_SKILL_COMBAT_RULES.snapshot_from_save(
		save_snapshot,
		hero.hero_id
	)
	var soul_projection := HERO_SOUL_COMBAT_AFFIXES.derive(save_snapshot, hero.hero_id)
	var selected_weapon := HERO_SOUL_COMBAT_AFFIXES.selected_instance(save_snapshot, hero.hero_id)
	var selected_rarity := int(soul_projection.get("rarity", 0))
	var weapon_ranks: Dictionary = selected_weapon.get("skill_ranks", {}) \
		if selected_weapon.get("skill_ranks", {}) is Dictionary else {}
	snapshot["skill_kit"] = HERO_SKILL_KIT_RULES.kit_snapshot(
		hero.hero_id, selected_rarity, weapon_ranks
	)
	var auxiliary_runtime_effects := _derive_auxiliary_runtime_effects(snapshot)
	var defense_profile := _derive_defense_profile(soul_projection, auxiliary_runtime_effects)
	snapshot["hero_soul_affixes"] = soul_projection
	snapshot["auxiliary_runtime_effects"] = auxiliary_runtime_effects
	snapshot["defense_profile"] = defense_profile

	var character_request := _build_damage_request_from_snapshot(
		hero,
		snapshot,
		&"",
		float(hero.base_damage),
		{},
		false,
		false
	)
	var character_preview := COMBAT_RESOLVER.preview(character_request)
	var weapon_request := _build_damage_request_from_snapshot(
		hero,
		snapshot,
		&"",
		float(hero.base_damage),
		{},
		true,
		false
	)
	var weapon_preview := COMBAT_RESOLVER.preview(weapon_request)
	var character_damage := float(character_preview.get("expected_raw_damage", 0.0))
	var weapon_damage := float(weapon_preview.get("expected_raw_damage", 0.0))

	# HP and Mana retain their established projection. Damage alone is now
	# composed by CombatResolver from semantic buckets.
	snapshot["hp"] = float(snapshot.get("hp", base_hp)) \
		* float(soul_projection.get("max_hp_multiplier", 1.0))
	snapshot["character_damage"] = character_damage
	snapshot["weapon_damage_percent"] = float(
		soul_projection.get("weapon_damage_percent", 100.0)
	)
	snapshot["damage"] = weapon_damage
	snapshot["mana"] = float(snapshot.get("mana", base_mana)) \
		* float(soul_projection.get("max_mana_multiplier", 1.0))
	snapshot["damage_multiplier"] = weapon_damage / float(hero.base_power)
	snapshot["move_speed_multiplier"] = float(hero.base_move_speed_multiplier) \
		* float(soul_projection.get("move_speed_multiplier", 1.0))
	snapshot["formula_version"] = COMBAT_RESOLVER.FORMULA_VERSION
	snapshot["character_damage_request"] = character_request.duplicate(true)
	snapshot["character_damage_breakdown"] = (
		character_preview.get("breakdown", []) as Array
	).duplicate(true)
	snapshot["damage_request"] = weapon_request.duplicate(true)
	snapshot["damage_preview"] = weapon_preview.duplicate(true)
	snapshot["damage_breakdown"] = (
		weapon_preview.get("breakdown", []) as Array
	).duplicate(true)
	snapshot["core_stats"] = {
		"hp": float(snapshot["hp"]),
		"mana": float(snapshot["mana"]),
		"damage": character_damage,
	}
	# UI, Hub and balance tools consume the same named live effects as runtime.
	# Keeping this profile in the projection avoids every presentation surface
	# rebuilding conditional defense, regen or resource formulas independently.
	snapshot["secondary_stats"] = _derive_secondary_stat_profile(
		snapshot,
		defense_profile,
		auxiliary_runtime_effects,
	)
	snapshot["core_stat_ids"] = PLAYER_PROGRESSION_RULES.CORE_STAT_IDS.duplicate()
	snapshot["selected_hero_soul_instance_id"] = String(soul_projection.get("instance_id", ""))
	snapshot["applied_live_hero_soul_affixes"] = (
		soul_projection.get("applied_live_affixes", []) as Array
	).duplicate(true)
	snapshot["unsupported_hero_soul_affixes"] = (
		soul_projection.get("unsupported_affixes", []) as Array
	).duplicate(true)
	return snapshot


## Pure action projection for Hub, balance laboratories, content validation and
## headless tests. Callers author only the action's raw damage and semantic
## context; the same buckets and resolver used by live HeroSoulManager instances
## produce the request, preview and breakdown. Future actions/items/chapters add
## named data to `options` instead of copying or branching the damage formula.
static func project_hero_action_damage(
		save_snapshot: Dictionary,
		hero: HeroDefinition,
		action_track: StringName,
		authored_damage: float,
		options: Dictionary = {},
		base_hp: float = PLAYER_PROGRESSION_RULES.BASE_HP,
		base_mana: float = PLAYER_PROGRESSION_RULES.BASE_MANA,
) -> Dictionary:
	if hero == null or not is_finite(authored_damage) or authored_damage <= 0.0:
		return {}
	var combat_snapshot := project_hero_combat(save_snapshot, hero, base_hp, base_mana)
	if combat_snapshot.is_empty():
		return {}
	var request := _build_damage_request_from_snapshot(
		hero,
		combat_snapshot,
		action_track,
		authored_damage,
		options,
		true,
		true,
	)
	var preview := COMBAT_RESOLVER.preview(request)
	return {
		"formula_version": COMBAT_RESOLVER.FORMULA_VERSION,
		"hero_id": String(hero.hero_id),
		"action_track": String(action_track),
		"authored_damage": authored_damage,
		"request": request.duplicate(true),
		"preview": preview.duplicate(true),
		"expected_damage": int(preview.get("expected_damage", 0)),
		"minimum_damage": int(preview.get("minimum_damage", 0)),
		"maximum_damage": int(preview.get("maximum_damage", 0)),
		"breakdown": (preview.get("breakdown", []) as Array).duplicate(true),
	}


func get_active_combat_snapshot() -> Dictionary:
	if active_hero == null:
		return {}
	return get_combat_snapshot(active_hero.hero_id)


func get_active_skill_kit_snapshot() -> Dictionary:
	if active_hero == null:
		return {}
	return get_skill_kit_snapshot(active_hero.hero_id)


func get_skill_kit_snapshot(hero_id: StringName) -> Dictionary:
	var definition := _hero_definition_for_id(hero_id)
	if definition == null:
		return {}
	var projection := _hero_soul_projection_for(hero_id)
	var rarity := int(projection.get("rarity", 0))
	var selected := HERO_SOUL_COMBAT_AFFIXES.selected_instance(
		_combat_save_snapshot, hero_id
	)
	var ranks: Dictionary = selected.get("skill_ranks", {}) \
		if selected.get("skill_ranks", {}) is Dictionary else {}
	var snapshot := HERO_SKILL_KIT_RULES.kit_snapshot(hero_id, rarity, ranks)
	snapshot["rarity"] = rarity
	return snapshot


func get_reserve_combat_snapshot() -> Dictionary:
	if reserve_soul == null:
		return {}
	return get_combat_snapshot(reserve_soul.hero_id)


func get_combat_snapshot(hero_id: StringName) -> Dictionary:
	var key := String(hero_id)
	if not _combat_snapshots_by_hero.has(key):
		var definition := _hero_definition_for_id(hero_id)
		if definition == null:
			return {}
		_combat_snapshots_by_hero[key] = _derive_combat_snapshot(definition)
	return (_combat_snapshots_by_hero[key] as Dictionary).duplicate(true)


func scale_hero_damage(hero_id: StringName, authored_damage: float) -> int:
	return int(preview_hero_action_damage(
		hero_id,
		&"",
		authored_damage
	).get("expected_damage", 0))


func scale_active_damage(authored_damage: float) -> int:
	if active_hero == null:
		return maxi(0, roundi(authored_damage))
	return scale_hero_damage(active_hero.hero_id, authored_damage)


## Builds the canonical, self-contained semantic request for one Hero action.
## Target-side variance, critical, damage-taken, and defense inputs are supplied
## through options; no caller needs to know the underlying projection formula.
func build_hero_action_damage_request(
		hero_id: StringName,
		action_track: StringName,
		authored_damage: float,
		options: Dictionary = {}
) -> Dictionary:
	if not is_finite(authored_damage) or authored_damage <= 0.0:
		return {}
	var hero := _hero_definition_for_id(hero_id)
	if hero == null or hero.base_damage <= 0:
		return {}
	var snapshot := get_combat_snapshot(hero_id)
	if snapshot.is_empty():
		return {}
	return _build_damage_request_from_snapshot(
		hero,
		snapshot,
		action_track,
		authored_damage,
		options,
		true,
		true
	)


func preview_hero_action_damage(
		hero_id: StringName,
		action_track: StringName,
		authored_damage: float,
		options: Dictionary = {}
) -> Dictionary:
	return COMBAT_RESOLVER.preview(build_hero_action_damage_request(
		hero_id,
		action_track,
		authored_damage,
		options
	))


func resolve_hero_action_hit(
		hero_id: StringName,
		action_track: StringName,
		authored_damage: float,
		rolls: Dictionary,
		options: Dictionary = {}
) -> Dictionary:
	return COMBAT_RESOLVER.resolve_hit(build_hero_action_damage_request(
		hero_id,
		action_track,
		authored_damage,
		options
	), rolls)


## Scales one of the four damage-bearing Hero tracks after shared core stats.
## The explicit track prevents a Normal Attack rank from accidentally buffing
## Summon/Departure damage (or vice versa).
func scale_hero_action_damage(
		hero_id: StringName,
		action_track: StringName,
		authored_damage: float
) -> int:
	return int(preview_hero_action_damage(
		hero_id,
		action_track,
		authored_damage
	).get("expected_damage", 0))


func scale_active_action_damage(action_track: StringName, authored_damage: float) -> int:
	if active_hero == null:
		return maxi(0, roundi(authored_damage))
	return scale_hero_action_damage(active_hero.hero_id, action_track, authored_damage)


func active_skill_cooldown(authored_seconds: float) -> float:
	var soul_totals: Dictionary = _active_hero_soul_projection().get("percent_totals", {})
	var soul_recovery := float(soul_totals.get("cooldown", 0.0))
	var auxiliary_recovery := float(
		_active_auxiliary_runtime_effects().get("cooldown_recovery_percent", 0.0)
	)
	var rank_multiplier := clampf(
		float(_active_skill_snapshot().get("active_skill_cooldown_multiplier", 1.0)),
		0.0,
		1.0
	)
	var rank_recovery := (1.0 - rank_multiplier) * 100.0
	var combined_recovery := minf(
		MAX_LIVE_COOLDOWN_REDUCTION_PERCENT,
		maxf(0.0, rank_recovery + soul_recovery + auxiliary_recovery)
	)
	return maxf(
		0.01,
		authored_seconds * (1.0 - combined_recovery / 100.0)
	)


## Resolves the authored Hero cost through account-wide Mana milestones and
## jewelry efficiency. The result stays fractional so the HUD and the
## resource clock use exactly the same number instead of rounding differently.
func active_skill_mana_cost(authored_cost: float) -> float:
	if not is_finite(authored_cost) or authored_cost <= 0.0:
		return 0.0
	var auxiliary_reduction := clampf(
		float(_active_auxiliary_runtime_effects().get("active_skill_mana_cost_reduction_percent", 0.0)),
		0.0,
		MAX_LIVE_MANA_COST_REDUCTION_PERCENT
	)
	var soul_totals: Dictionary = _active_hero_soul_projection().get("percent_totals", {})
	var reduction := minf(
		MAX_LIVE_MANA_COST_REDUCTION_PERCENT,
		auxiliary_reduction + float(soul_totals.get("mana_efficiency", 0.0)),
	)
	return maxf(0.0, authored_cost * (1.0 - reduction / 100.0))


## Every Hero has a deliberately modest base recovery. Mana investment and
## rolled jewelry can then make repeated Active-Skill use materially more
## sustainable without making the resource irrelevant at level one.
func active_mana_regen_per_second() -> float:
	return maxf(
		0.0,
		BASE_MANA_REGEN_PER_SECOND
		+ float(_active_auxiliary_runtime_effects().get("mana_regen_flat_per_second", 0.0))
	)


## Direct incoming damage is deliberately transparent: absent an explicit
## visible immunity/shield mechanic, the displayed number is the HP removed.
func mitigate_active_incoming_damage(
		authored_damage: int,
		attack_or_skill_active: bool,
		movement_active := false,
) -> int:
	if authored_damage <= 0:
		return 0
	return authored_damage


## Canonical target-side context for CombatResolver. Keeping the legacy helper
## above preserves non-canonical callers, while enemy hits that support the
## resolved-target handshake can multiply this factor before the single final
## round and then call Knight.take_resolved_damage without mitigating twice.
func build_active_incoming_damage_options(
		attack_or_skill_active: bool,
		movement_active := false,
) -> Dictionary:
	return {}


func active_health_regen_per_second(active_max_health: float) -> float:
	if not is_finite(active_max_health) or active_max_health <= 0.0:
		return 0.0
	var percent := clampf(
		float(_active_auxiliary_runtime_effects().get("health_regen_percent_per_second", 0.0)),
		0.0,
		MAX_LIVE_HEALTH_REGEN_PERCENT_PER_SECOND
	)
	return active_healing_amount(active_max_health * percent / 100.0)


func active_healing_amount(authored_amount: float) -> float:
	if not is_finite(authored_amount) or authored_amount <= 0.0:
		return 0.0
	var received_percent := clampf(
		float(_active_auxiliary_runtime_effects().get("healing_received_percent", 0.0))
			+ float(_active_hero_soul_projection().get("healing_received_percent", 0.0)),
		0.0,
		MAX_LIVE_HEALING_RECEIVED_PERCENT
	)
	return authored_amount * (1.0 + received_percent / 100.0)


func active_move_speed(authored_speed: float) -> float:
	if not is_finite(authored_speed) or authored_speed <= 0.0:
		return 0.0
	var auxiliary_percent := clampf(
		float(_active_auxiliary_runtime_effects().get("movement_speed_percent", 0.0)),
		0.0,
		MAX_LIVE_MOVEMENT_SPEED_PERCENT
	)
	var soul_totals: Dictionary = _active_hero_soul_projection().get("percent_totals", {})
	var speed_percent := minf(
		MAX_LIVE_MOVEMENT_SPEED_PERCENT,
		auxiliary_percent + float(soul_totals.get("movement", 0.0)),
	)
	var identity_multiplier := float(
		get_active_combat_snapshot().get("move_speed_multiplier", 1.0)
	) / maxf(0.01, float(_active_hero_soul_projection().get("move_speed_multiplier", 1.0)))
	return authored_speed * identity_multiplier * (1.0 + speed_percent / 100.0)


func active_dash_cooldown(authored_seconds: float) -> float:
	var recovery_percent := clampf(
		float(_active_auxiliary_runtime_effects().get("dash_cooldown_recovery_percent", 0.0)),
		0.0,
		MAX_LIVE_COOLDOWN_REDUCTION_PERCENT
	)
	return maxf(
		0.01,
		authored_seconds
			* float(_active_skill_snapshot().get("dash_cooldown_multiplier", 1.0))
			* (1.0 - recovery_percent / 100.0)
	)


func active_dash_speed(authored_speed: float) -> float:
	var speed_percent := clampf(
		float(_active_auxiliary_runtime_effects().get("dash_speed_percent", 0.0)),
		0.0,
		MAX_LIVE_DASH_SPEED_PERCENT
	)
	return maxf(
		0.0,
		authored_speed
			* float(_active_skill_snapshot().get("dash_distance_multiplier", 1.0))
			* (1.0 + speed_percent / 100.0)
	)


func active_dash_invulnerability(authored_seconds: float) -> float:
	return maxf(
		0.0,
		authored_seconds * float(_active_skill_snapshot().get("dash_invulnerability_multiplier", 1.0))
	)


func get_effective_ready_requirement() -> int:
	if reserve_soul == null:
		return 0
	# Wizard does not use the generic readiness meter. Its Reserve runtime owns
	# Soul icons and the Dash anchor directly, so showing a phantom 0/1 threat
	# requirement would imply that Q can be armed through the normal path.
	if reserve_soul.ready_condition_behavior_id == &"wizard_soul_icons":
		return 0
	if reserve_soul.ready_condition_behavior_id == &"clear_shot":
		return 10
	var authored := (
		reserve_soul.crowd_hostiles_required
		if reserve_soul.ready_condition_behavior_id == &"crowd_pressure"
		else reserve_soul.melee_threats_required
	)
	return HERO_SKILL_COMBAT_RULES.effective_ready_requirement(
		authored,
		_skill_snapshot_for(reserve_soul.hero_id)
	)


func get_effective_ready_window_seconds() -> float:
	if reserve_soul == null:
		return 0.0
	return HERO_SKILL_COMBAT_RULES.effective_ready_window(
		reserve_soul.ready_lifetime_seconds,
		_skill_snapshot_for(reserve_soul.hero_id)
	)


func get_effective_ready_radius() -> float:
	if reserve_soul == null:
		return 0.0
	if reserve_soul.ready_condition_behavior_id == &"wizard_soul_icons":
		return 0.0
	if reserve_soul.ready_condition_behavior_id == &"clear_shot":
		return HERO_SKILL_COMBAT_RULES.effective_ready_radius(
			reserve_soul.clear_shot_max_distance,
			_skill_snapshot_for(reserve_soul.hero_id)
		)
	var authored := (
		reserve_soul.crowd_pressure_radius
		if reserve_soul.ready_condition_behavior_id == &"crowd_pressure"
		else reserve_soul.melee_threat_radius
	)
	return HERO_SKILL_COMBAT_RULES.effective_ready_radius(
		authored,
		_skill_snapshot_for(reserve_soul.hero_id)
	)


func request_soul_relay() -> bool:
	match state:
		RelayState.READY:
			if not soul_skill_armed:
				# K-Night's Soul action is explicitly a one-press Q skill. Other
				# Heroes retain the existing arm-and-confirm targeting flow.
				if reserve_soul != null and reserve_soul.hero_id == &"sword_hero":
					return _begin_support_summon(&"manual_q", false)
				soul_skill_armed = true
				_emit_state()
				return true
		RelayState.SUMMONING:
			if takeover_open:
				return _complete_relay()
	return false


func is_soul_skill_armed() -> bool:
	return state == RelayState.READY and soul_skill_armed


## Soul confirmation does not require a world position.  Aiming helpers return
## null when no target is locked, which is a valid state for the reserve Soul
## action (Q arms, LMB confirms).  Keep this boundary Variant-typed so the
## input layer never has to invent a fake Vector2 just to satisfy inference.
func confirm_soul_skill(_aim_world: Variant = null) -> bool:
	if state != RelayState.READY or not soul_skill_armed:
		return false
	soul_skill_armed = false
	return _begin_support_summon(&"manual_q_confirm", false)


## A confirmed Dash with Archer equipped as the Reserve Soul is also a readable
## support opportunity. The Bow Spirit owns the shot/visual, while this manager
## owns the two-second takeover window so Q cannot desynchronize Hero identity,
## stats and the active weapon. Expiry has no extra support cooldown because the
## originating Dash/Bow action already owns its normal cooldown.
func begin_archer_dash_relay_opportunity(
		origin: Vector2,
		duration_seconds: float = 2.0,
) -> bool:
	if _player == null or active_hero == null or reserve_soul == null:
		return false
	if reserve_soul.hero_id != &"archer_hero":
		return false
	if state not in [RelayState.IDLE, RelayState.READY]:
		return false
	if not is_finite(duration_seconds) or duration_seconds <= 0.0:
		return false

	state = RelayState.READY
	readiness_count = get_effective_ready_requirement()
	ready_seconds_left = duration_seconds
	soul_skill_armed = false
	_emit_state()
	return true


## Wizard's Reserve loop owns its own kill → anchor → return precondition, but
## this manager remains the authority for the two-second Q takeover window and
## for swapping Hero identity/stat snapshots. The summon appears at the Dash
## origin after the controlled Hero returns to the Soul Anchor.
func begin_wizard_soul_return_opportunity(
		origin: Vector2,
		duration_seconds: float = 2.0,
		icon_count: int = 0,
) -> bool:
	if _player == null or active_hero == null or reserve_soul == null:
		return false
	if reserve_soul.hero_id != &"wizard_hero":
		return false
	if state not in [RelayState.IDLE, RelayState.READY]:
		return false
	if not is_finite(duration_seconds) or duration_seconds <= 0.0 or icon_count <= 0:
		return false

	state = RelayState.READY
	readiness_count = get_effective_ready_requirement()
	ready_seconds_left = duration_seconds
	soul_skill_armed = false
	# Wizard deliberately uses its authored 0.10–1.90s Q window.  Unlike the
	# Archer Dash opportunity, the first and last tenth of the apparition are
	# only presentation so a relay cannot resolve before the Wizard is visible.
	_emit_state()
	return true


func register_melee_threat(
		threat_id: StringName,
		attacker: Node,
		target: Node,
		origin: Vector2,
		danger_radius: float
) -> bool:
	if reserve_soul == null or state not in [RelayState.IDLE, RelayState.READY]:
		return false
	if reserve_soul.ready_condition_behavior_id != &"melee_threats":
		return false
	if target != _player or threat_id.is_empty() or _seen_threat_ids.has(threat_id):
		return false
	var distance := _player.global_position.distance_to(origin)
	var allowed_radius := minf(get_effective_ready_radius(), maxf(0.0, danger_radius))
	if distance > allowed_radius:
		return false
	_seen_threat_ids[threat_id] = true
	if is_instance_valid(attacker) and distance < _primary_threat_distance:
		_primary_attacker = attacker
		_primary_threat_distance = distance
	var required := get_effective_ready_requirement()
	readiness_count = mini(required, readiness_count + 1)
	if readiness_count >= required:
		state = RelayState.READY
		ready_seconds_left = get_effective_ready_window_seconds()
	_emit_state()
	return true


## Crowd Pressure is a live snapshot, not an accumulated attack receipt. Calling
## this again when the opportunity ends immediately withdraws Axe readiness.
func update_crowd_pressure(hostile_count: int, has_active_threat: bool, primary_attacker: Node = null) -> bool:
	if reserve_soul == null or reserve_soul.ready_condition_behavior_id != &"crowd_pressure":
		return false
	if state not in [RelayState.IDLE, RelayState.READY]:
		return false
	var required := get_effective_ready_requirement()
	var qualifies := hostile_count >= required
	if reserve_soul.crowd_requires_active_threat:
		qualifies = qualifies and has_active_threat
	readiness_count = mini(maxi(0, hostile_count), required)
	_primary_attacker = primary_attacker if qualifies and is_instance_valid(primary_attacker) else null
	if qualifies:
		state = RelayState.READY
		ready_seconds_left = get_effective_ready_window_seconds()
	else:
		state = RelayState.IDLE
		ready_seconds_left = 0.0
	_emit_state()
	return qualifies


## Archer readiness is earned by maintaining one readable firing lane rather
## than accumulating enemy attacks. Once earned it keeps the normal ready
## lifetime; breaking range or line of sight only resets unfinished progress.
func update_clear_shot(
		delta: float,
		qualifies: bool,
		primary_attacker: Node = null,
) -> bool:
	if reserve_soul == null or reserve_soul.ready_condition_behavior_id != &"clear_shot":
		return false
	if state not in [RelayState.IDLE, RelayState.READY]:
		return false
	var required := get_effective_ready_requirement()
	if state == RelayState.READY:
		readiness_count = required
		return true
	if not qualifies:
		_clear_shot_progress_seconds = 0.0
		readiness_count = 0
		_primary_attacker = null
		_primary_threat_distance = INF
		_emit_state()
		return false
	if not is_instance_valid(primary_attacker):
		_clear_shot_progress_seconds = 0.0
		readiness_count = 0
		_primary_attacker = null
		_primary_threat_distance = INF
		_emit_state()
		return false
	# Clear Shot belongs to one continuous firing lane against one hostile. A
	# different enemy cannot inherit partial hold progress from the previous one.
	if _primary_attacker != null and _primary_attacker != primary_attacker:
		_clear_shot_progress_seconds = 0.0
		readiness_count = 0
	_clear_shot_progress_seconds = minf(
		reserve_soul.clear_shot_hold_seconds,
		_clear_shot_progress_seconds + maxf(0.0, delta)
	)
	readiness_count = clampi(
		roundi((_clear_shot_progress_seconds / maxf(0.01, reserve_soul.clear_shot_hold_seconds)) * float(required)),
		0,
		required
	)
	if is_instance_valid(primary_attacker):
		_primary_attacker = primary_attacker
		if primary_attacker is Node2D and is_instance_valid(_player):
			_primary_threat_distance = _player.global_position.distance_to((primary_attacker as Node2D).global_position)
	if _clear_shot_progress_seconds + 0.001 >= reserve_soul.clear_shot_hold_seconds:
		readiness_count = required
		state = RelayState.READY
		ready_seconds_left = get_effective_ready_window_seconds()
	_emit_state()
	return state == RelayState.READY


func get_state_snapshot() -> Dictionary:
	var active_projection := _active_hero_soul_projection()
	var reserve_projection := (
		_hero_soul_projection_for(reserve_soul.hero_id)
		if reserve_soul != null
		else {}
	)
	return {
		"active_hero": String(active_hero.hero_id) if active_hero != null else "",
		"reserve_soul": String(reserve_soul.hero_id) if reserve_soul != null else "",
		"active_soul_instance_id": String(active_projection.get("instance_id", "")),
		"reserve_soul_instance_id": String(reserve_projection.get("instance_id", "")),
		"active_soul_live_affixes": (
			active_projection.get("applied_live_affixes", []) as Array
		).duplicate(true),
		"active_soul_unsupported_affixes": (
			active_projection.get("unsupported_affixes", []) as Array
		).duplicate(true),
		"state": get_state_name(),
		"readiness": readiness_count,
		"readiness_required": get_effective_ready_requirement(),
		"ready_seconds": ready_seconds_left,
		"summon_elapsed": summon_elapsed,
		"summon_duration": _current_summon_duration(),
		"summon_context": String(summon_context),
		"takeover_open": takeover_open,
		"soul_skill_armed": soul_skill_armed,
		"support_cooldown": support_cooldown_left,
	}


func get_state_name() -> StringName:
	return StringName(RelayState.keys()[state].to_lower())


func _process(delta: float) -> void:
	match state:
		RelayState.READY:
			ready_seconds_left = maxf(0.0, ready_seconds_left - delta)
			if ready_seconds_left <= 0.0:
				# Readiness expiry never creates a support cooldown.
				_clear_readiness()
				state = RelayState.IDLE
			_emit_state()
		RelayState.SUMMONING:
			summon_elapsed += delta
			var was_open := takeover_open
			takeover_open = _is_takeover_time(summon_elapsed)
			if summon_elapsed >= _current_summon_duration():
				_finish_support_without_relay()
			elif was_open != takeover_open:
				_emit_state()
		RelayState.SUPPORT_COOLDOWN:
			support_cooldown_left = maxf(0.0, support_cooldown_left - delta)
			if support_cooldown_left <= 0.0:
				state = RelayState.IDLE
			_emit_state()


func _begin_support_summon(
		context: StringName = &"relay_input",
		full_takeover_window := false,
) -> bool:
	if reserve_soul == null or _player == null:
		return false
	# A zero-HP reserve is dead, not a usable Soul form.
	if _player.has_method(&"is_hero_alive") \
			and not bool(_player.call(&"is_hero_alive", reserve_soul.hero_id)):
		return false
	var primary_attacker: Node = (
		_primary_attacker if is_instance_valid(_primary_attacker) else null
	)
	_primary_attacker = primary_attacker
	_reset_summon_overrides()
	var reserve_kit := get_skill_kit_snapshot(reserve_soul.hero_id)
	if reserve_soul.hero_id == &"sword_hero":
		if int(reserve_kit.get("kit_tier", 0)) \
				>= HERO_SKILL_KIT_RULES.KitTier.LEGENDARY_PLUS:
			# Revenge Legion starts its fixed cooldown after the five-second
			# effect, exactly as authored.
			_unused_support_cooldown_override = 30.0
		else:
			# Guardian's 20-second cooldown is activation-anchored. The manager
			# enters SUPPORT_COOLDOWN after its five-second presentation.
			_unused_support_cooldown_override = maxf(
				0.0,
				20.0 - reserve_soul.summon_duration_seconds,
			)
	if int(reserve_kit.get("kit_tier", 0)) >= HERO_SKILL_KIT_RULES.KitTier.LEGENDARY_PLUS:
		var durations := {
			&"sword_hero": 5.0,
			&"archer_hero": 4.0,
			&"axe_hero": 2.0,
			&"wizard_hero": 5.0,
		}
		_summon_duration_override = float(durations.get(reserve_soul.hero_id, reserve_soul.summon_duration_seconds))
	state = RelayState.SUMMONING
	summon_elapsed = 0.0
	_takeover_for_full_summon = full_takeover_window
	takeover_open = full_takeover_window
	summon_context = context
	summon_position = _player.global_position + Vector2(-24.0, -4.0)
	if _player.has_method(&"begin_soul_summon"):
		var result: Variant = _player.call(
			&"begin_soul_summon",
			reserve_soul,
			primary_attacker
		)
		if result is Vector2:
			summon_position = result
	summon_started.emit(reserve_soul, primary_attacker, summon_position)
	_emit_state()
	return true


## A Hero reaching zero HP transfers control to the living reserve immediately.
## This is intentionally independent of threat/readiness windows: the two HP
## pools, not a checkpoint resurrection, now determine whether the run ends.
func force_relay_after_hero_defeat() -> bool:
	if reserve_soul == null or active_hero == null or _player == null:
		return false
	state = RelayState.SUMMONING
	summon_elapsed = 0.0
	summon_position = _player.global_position
	summon_context = &"hero_defeat"
	takeover_open = true
	return _complete_relay()


func _complete_relay() -> bool:
	if reserve_soul == null or active_hero == null or _player == null:
		return false
	var incoming := reserve_soul
	var outgoing := active_hero
	if _player.has_method(&"resolve_soul_relay_destination"):
		var resolved_destination: Variant = _player.call(
			&"resolve_soul_relay_destination",
			summon_position
		)
		if resolved_destination is Vector2:
			summon_position = resolved_destination as Vector2
	if _player.has_method(&"complete_soul_relay"):
		if not bool(_player.call(&"complete_soul_relay", incoming, outgoing, summon_position)):
			return false
	active_hero = incoming
	reserve_soul = outgoing
	_refresh_combat_snapshots()
	state = RelayState.IDLE
	takeover_open = false
	support_cooldown_left = 0.0
	_reset_summon_overrides()
	summon_completed.emit(incoming, true)
	relay_completed.emit(incoming, outgoing, summon_position)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"soul_relay_completed"):
		events.emit_signal(
			&"soul_relay_completed",
			incoming.hero_id,
			outgoing.hero_id,
			summon_position
		)
	_clear_readiness()
	team_changed.emit(active_hero, reserve_soul)
	_emit_state()
	return true


func _finish_support_without_relay() -> void:
	var incoming := reserve_soul
	if _player != null and _player.has_method(&"finish_soul_support"):
		_player.call(&"finish_soul_support", incoming)
	summon_completed.emit(incoming, false)
	var cooldown := incoming.unused_support_cooldown_seconds
	if _unused_support_cooldown_override >= 0.0:
		cooldown = _unused_support_cooldown_override
	state = RelayState.SUPPORT_COOLDOWN if cooldown > 0.0 else RelayState.IDLE
	support_cooldown_left = maxf(0.0, cooldown)
	takeover_open = false
	_reset_summon_overrides()
	_clear_readiness()
	_emit_state()


func _refresh_combat_snapshots() -> void:
	_combat_snapshots_by_hero.clear()
	if active_hero != null:
		_combat_snapshots_by_hero[String(active_hero.hero_id)] = _derive_combat_snapshot(active_hero)
	if reserve_soul != null:
		_combat_snapshots_by_hero[String(reserve_soul.hero_id)] = _derive_combat_snapshot(reserve_soul)
	combat_stats_changed.emit(get_active_combat_snapshot(), get_reserve_combat_snapshot())


func _derive_combat_snapshot(hero: HeroDefinition) -> Dictionary:
	return project_hero_combat(
		_combat_save_snapshot,
		hero,
		_combat_base_hp,
		_combat_base_mana
	)


static func _build_damage_request_from_snapshot(
		hero: HeroDefinition,
		snapshot: Dictionary,
		action_track: StringName,
		authored_damage: float,
		options: Dictionary,
		include_weapon: bool,
		include_action_modifiers: bool
) -> Dictionary:
	var progression_value: Variant = snapshot.get("progression", {})
	var progression := progression_value as Dictionary if progression_value is Dictionary else {}
	var modifiers_value: Variant = snapshot.get("modifiers", {})
	var modifiers := modifiers_value as Dictionary if modifiers_value is Dictionary else {}
	var damage_modifiers_value: Variant = modifiers.get("damage", {})
	var damage_modifiers := (
		damage_modifiers_value as Dictionary
		if damage_modifiers_value is Dictionary
		else {}
	)
	var soul_value: Variant = snapshot.get("hero_soul_affixes", {})
	var soul_projection := soul_value as Dictionary if soul_value is Dictionary else {}
	var soul_totals_value: Variant = soul_projection.get("percent_totals", {})
	var soul_totals := soul_totals_value as Dictionary if soul_totals_value is Dictionary else {}
	var flat_modifiers := {
		"auxiliary_damage_flat": float(damage_modifiers.get("flat", 0.0)),
	}
	var option_flat_value: Variant = options.get("flat_modifiers", {})
	if option_flat_value is Dictionary:
		for raw_name: Variant in (option_flat_value as Dictionary).keys():
			flat_modifiers["context/%s" % String(raw_name)] = (
				option_flat_value as Dictionary
			)[raw_name]
	var additive_percent_modifiers := {
		"allocated_power_percent": float(
			progression.get("core_damage_bonus_percent", 0.0)
		),
		"auxiliary_damage_percent": float(damage_modifiers.get("percent", 0.0)),
		"selected_soul_core_damage_percent": float(soul_totals.get("core_damage", 0.0)),
	}
	var option_additive_value: Variant = options.get("additive_percent_modifiers", {})
	if option_additive_value is Dictionary:
		for raw_name: Variant in (option_additive_value as Dictionary).keys():
			additive_percent_modifiers["context/%s" % String(raw_name)] = (
				option_additive_value as Dictionary
			)[raw_name]
	var unique_multipliers := {}
	if include_weapon:
		unique_multipliers["weapon_damage_percent"] = float(
			soul_projection.get("weapon_damage_multiplier", 1.0)
		)
	if include_action_modifiers:
		var skill_value: Variant = snapshot.get("hero_skills", {})
		var skill_snapshot := skill_value as Dictionary if skill_value is Dictionary else {}
		var runtime_value: Variant = snapshot.get("auxiliary_runtime_effects", {})
		var runtime_effects := runtime_value as Dictionary if runtime_value is Dictionary else {}
		var active_skill_progression_multiplier := 1.0
		if action_track == PLAYER_PROGRESSION_RULES.SKILL_TRACK_ACTIVE_SKILL:
			active_skill_progression_multiplier += float(
				runtime_effects.get("active_skill_damage_percent", 0.0)
			) / 100.0
		unique_multipliers["skill_track_multiplier"] = (
			HERO_SKILL_COMBAT_RULES.action_damage_multiplier(skill_snapshot, action_track)
		)
		unique_multipliers["hero_soul_action_multiplier"] = (
			HERO_SOUL_COMBAT_AFFIXES.action_damage_multiplier(soul_projection, action_track)
		)
		unique_multipliers["active_skill_progression_multiplier"] = (
			active_skill_progression_multiplier
		)
		var kit_value: Variant = snapshot.get("skill_kit", {})
		var kit := kit_value as Dictionary if kit_value is Dictionary else {}
		var rank_key := "active_2" if String(action_track) == "ultimate" else "active_1"
		if String(action_track) in ["active_skill", "ultimate"]:
			var ranks_value: Variant = kit.get("skill_ranks", {})
			var ranks := ranks_value as Dictionary if ranks_value is Dictionary else {}
			var rarity := int((snapshot.get("hero_soul_affixes", {}) as Dictionary).get("rarity", 0))
			unique_multipliers["hero_weapon_skill_kit"] = (
				HERO_SKILL_KIT_RULES.effective_skill_multiplier(
					rarity, int(ranks.get(rank_key, 1))
				)
			)
		var option_unique_value: Variant = options.get("unique_multipliers", {})
		if option_unique_value is Dictionary:
			var option_unique := option_unique_value as Dictionary
			for raw_name: Variant in option_unique.keys():
				unique_multipliers["context/%s" % String(raw_name)] = option_unique[raw_name]

	var damage_taken_value: Variant = options.get("damage_taken_multipliers", {})
	var damage_taken := (
		(damage_taken_value as Dictionary).duplicate(true)
		if damage_taken_value is Dictionary
		else {}
	)
	var defense_value: Variant = options.get("defense", {})
	var defense := (
		(defense_value as Dictionary).duplicate(true)
		if defense_value is Dictionary
		else {}
	)
	return {
		"formula_version": COMBAT_RESOLVER.FORMULA_VERSION,
		"hero_id": String(hero.hero_id),
		"action_track": String(action_track),
		"authored_damage": authored_damage,
		"base": float(hero.base_damage) * PLAYER_PROGRESSION_RULES.COMBAT_NUMBER_SCALE,
		"flat_modifiers": flat_modifiers,
		"additive_percent_modifiers": additive_percent_modifiers,
		"action_multiplier": authored_damage / float(hero.base_damage),
		"unique_multipliers": unique_multipliers,
		"variance_percent": options.get("variance_percent", 0.0),
		"critical_chance_percent": options.get("critical_chance_percent", 0.0),
		"critical_multiplier": options.get("critical_multiplier", 1.0),
		"damage_taken_multipliers": damage_taken,
		"defense": defense,
	}


func _skill_snapshot_for(hero_id: StringName) -> Dictionary:
	var snapshot := get_combat_snapshot(hero_id)
	var skills_value: Variant = snapshot.get("hero_skills", {})
	return skills_value as Dictionary if skills_value is Dictionary else {}


func _active_skill_snapshot() -> Dictionary:
	if active_hero == null:
		return {}
	return _skill_snapshot_for(active_hero.hero_id)


func _hero_soul_projection_for(hero_id: StringName) -> Dictionary:
	var snapshot := get_combat_snapshot(hero_id)
	var projection_value: Variant = snapshot.get("hero_soul_affixes", {})
	return projection_value as Dictionary if projection_value is Dictionary else {}


func _active_hero_soul_projection() -> Dictionary:
	if active_hero == null:
		return {}
	return _hero_soul_projection_for(active_hero.hero_id)


func _active_auxiliary_runtime_effects() -> Dictionary:
	var snapshot := get_active_combat_snapshot()
	var effects_value: Variant = snapshot.get("auxiliary_runtime_effects", {})
	return effects_value as Dictionary if effects_value is Dictionary else {}


func _runtime_effects_for(hero_id: StringName) -> Dictionary:
	var snapshot := get_combat_snapshot(hero_id)
	var effects_value: Variant = snapshot.get("auxiliary_runtime_effects", {})
	return effects_value as Dictionary if effects_value is Dictionary else {}


static func _derive_defense_profile(
		_soul_projection: Dictionary,
		_auxiliary_effects: Dictionary,
) -> Dictionary:
	# Keep the compatibility-shaped snapshot for old UI/debug callers, but every
	# retired hidden-defense channel is authoritatively zero.
	return {
		"idle_damage_reduction_percent": 0.0,
		"attacking_damage_reduction_percent": 0.0,
		"moving_damage_reduction_percent": 0.0,
		"moving_attacking_damage_reduction_percent": 0.0,
		"guard_while_attacking_percent": 0.0,
		"footwork_damage_reduction_percent": 0.0,
		"cap_percent": 0.0,
	}


static func _derive_secondary_stat_profile(
		combat_snapshot: Dictionary,
		defense_profile: Dictionary,
		auxiliary_effects: Dictionary,
) -> Dictionary:
	var soul_value: Variant = combat_snapshot.get("hero_soul_affixes", {})
	var soul := soul_value as Dictionary if soul_value is Dictionary else {}
	var healing_received := clampf(
		float(auxiliary_effects.get("healing_received_percent", 0.0))
			+ float(soul.get("healing_received_percent", 0.0)),
		0.0,
		MAX_LIVE_HEALING_RECEIVED_PERCENT,
	)
	var health_regen_percent := clampf(
		float(auxiliary_effects.get("health_regen_percent_per_second", 0.0)),
		0.0,
		MAX_LIVE_HEALTH_REGEN_PERCENT_PER_SECOND,
	)
	var projected_hp := maxf(0.0, float(combat_snapshot.get("hp", 0.0)))
	var barrier_capacity := clampf(
		float(soul.get("barrier_capacity_percent", 0.0))
			+ float(auxiliary_effects.get("barrier_capacity_percent", 0.0)),
		0.0,
		MAX_LIVE_BARRIER_CAPACITY_PERCENT,
	)
	var dodge_chance := clampf(
		float(soul.get("dodge_chance_percent", 0.0))
			+ float(auxiliary_effects.get("dodge_chance_percent", 0.0)),
		0.0,
		MAX_LIVE_DODGE_CHANCE_PERCENT,
	)
	var health_regen_per_second := (
		projected_hp * health_regen_percent / 100.0
		* (1.0 + healing_received / 100.0)
	)
	return {
		"dodge_chance_percent": dodge_chance,
		"barrier_capacity_percent": barrier_capacity,
		"relay_barrier_percent": float(soul.get("relay_barrier_percent", 0.0)),
		"damage_reduction_percent": float(
			defense_profile.get("idle_damage_reduction_percent", 0.0)
		),
		"guard_while_attacking_percent": float(
			defense_profile.get("guard_while_attacking_percent", 0.0)
		),
		"footwork_damage_reduction_percent": float(
			defense_profile.get("footwork_damage_reduction_percent", 0.0)
		),
		"health_regen_per_second": maxf(0.0, health_regen_per_second),
		"health_regen_percent_per_second": health_regen_percent,
		"healing_received_percent": healing_received,
		"movement_speed_percent": float(
			auxiliary_effects.get("movement_speed_percent", 0.0)
		),
		"dash_cooldown_recovery_percent": float(
			auxiliary_effects.get("dash_cooldown_recovery_percent", 0.0)
		),
		"dash_speed_percent": float(
			auxiliary_effects.get("dash_speed_percent", 0.0)
		),
		"cooldown_recovery_percent": float(
			auxiliary_effects.get("cooldown_recovery_percent", 0.0)
		),
		"mana_regen_per_second": maxf(
			0.0,
			BASE_MANA_REGEN_PER_SECOND
				+ float(auxiliary_effects.get("mana_regen_flat_per_second", 0.0)),
		),
		"mana_cost_reduction_percent": float(
			auxiliary_effects.get("active_skill_mana_cost_reduction_percent", 0.0)
		),
		"active_skill_damage_percent": float(
			auxiliary_effects.get("active_skill_damage_percent", 0.0)
		),
	}


static func _derive_auxiliary_runtime_effects(snapshot: Dictionary) -> Dictionary:
	var health_regen := 0.0
	var cooldown_recovery := 0.0
	var mana_regen_flat := 0.0
	var mana_cost_reduction := 0.0
	var healing_received := 0.0
	var movement_speed := 0.0
	var dash_cooldown_recovery := 0.0
	var dash_speed := 0.0
	var active_skill_damage := 0.0
	var barrier_capacity := 0.0
	var dodge_chance := 0.0
	var applied: Array[Dictionary] = []
	var unsupported: Array[Dictionary] = []
	for raw_hook: Variant in snapshot.get("effect_hooks", []):
		if not raw_hook is Dictionary:
			continue
		var hook := raw_hook as Dictionary
		var effect_id := String(hook.get("effect_id", hook.get("stat_id", ""))).strip_edges().to_lower()
		var unit := String(hook.get("unit", "")).strip_edges().to_lower()
		var is_progression_milestone := String(hook.get("source_kind", "")) == "player_stat_milestone"
		if is_progression_milestone:
			var milestone_value := 0.0
			match effect_id:
				"active_skill_damage_5_percent":
					milestone_value = 5.0
					active_skill_damage += milestone_value
				"mana_regen_1_5_per_second", "mana_regen_1_5_per_second_2":
					milestone_value = 1.5
					mana_regen_flat += milestone_value
				"active_skill_mana_cost_reduction_5_percent":
					milestone_value = 5.0
					mana_cost_reduction += milestone_value
				"active_skill_cooldown_recovery_5_percent":
					milestone_value = 5.0
					cooldown_recovery += milestone_value
				_:
					unsupported.append({
						"effect_id": effect_id,
						"threshold": int(hook.get("threshold", 0)),
						"description": String(hook.get("description", "")),
						"status": "not_yet_live",
						"source_kind": "player_stat_milestone",
					})
					continue
			applied.append({
				"effect_id": effect_id,
				"value": milestone_value,
				"unit": "flat_per_second" if effect_id.begins_with("mana_regen_") else "percent",
				"status": "live",
				"source_kind": "player_stat_milestone",
			})
			continue
		var raw_value: Variant = hook.get("value", 0.0)
		var value := float(raw_value) if raw_value is int or raw_value is float else 0.0
		if not is_finite(value) or value <= 0.0 or hook.has("reason"):
			unsupported.append({"effect_id": effect_id, "value": 0.0, "status": "not_yet_live"})
			continue
		var live := true
		match effect_id:
			"barrier_capacity_percent":
				if unit == "percent": barrier_capacity += value
				else: live = false
			"dodge_chance_percent":
				if unit == "percent": dodge_chance += value
				else: live = false
			"health_regen":
				if unit == "percent_per_second": health_regen += value
				else: live = false
			"cooldown_rate":
				if unit == "percent": cooldown_recovery += value
				else: live = false
			"damage_reduction":
				live = false
			"mana_regen":
				if unit == "flat_per_second": mana_regen_flat += value
				else: live = false
			"mana_efficiency":
				if unit == "percent": mana_cost_reduction += value
				else: live = false
			"healing_received":
				if unit == "percent": healing_received += value
				else: live = false
			"guard_while_attacking":
				live = false
			"movement_speed", "movement_speed_percent":
				if unit == "percent": movement_speed += value
				else: live = false
			"dash_cooldown_rate":
				if unit == "percent": dash_cooldown_recovery += value
				else: live = false
			"dash_speed_percent":
				if unit == "percent": dash_speed += value
				else: live = false
			"footwork_damage_reduction":
				live = false
			_:
				live = false
		if live:
			applied.append({
				"effect_id": effect_id,
				"value": value,
				"unit": unit,
				"status": "live",
				"source_uuid": String(hook.get("source_uuid", "")),
			})
		else:
			unsupported.append({
				"effect_id": effect_id,
				"value": value,
				"unit": unit,
				"status": "not_yet_live",
			})
	return {
		"barrier_capacity_percent": minf(
			MAX_LIVE_BARRIER_CAPACITY_PERCENT, maxf(0.0, barrier_capacity)
		),
		"dodge_chance_percent": minf(
			MAX_LIVE_DODGE_CHANCE_PERCENT, maxf(0.0, dodge_chance)
		),
		"health_regen_percent_per_second": minf(MAX_LIVE_HEALTH_REGEN_PERCENT_PER_SECOND, health_regen),
		"cooldown_recovery_percent": minf(MAX_LIVE_COOLDOWN_REDUCTION_PERCENT, cooldown_recovery),
		"damage_reduction_percent": 0.0,
		"mana_regen_flat_per_second": maxf(0.0, mana_regen_flat),
		"active_skill_mana_cost_reduction_percent": minf(
			MAX_LIVE_MANA_COST_REDUCTION_PERCENT,
			maxf(0.0, mana_cost_reduction)
		),
		"healing_received_percent": minf(
			MAX_LIVE_HEALING_RECEIVED_PERCENT,
			maxf(0.0, healing_received)
		),
		"movement_speed_percent": minf(
			MAX_LIVE_MOVEMENT_SPEED_PERCENT,
			maxf(0.0, movement_speed)
		),
		"dash_cooldown_recovery_percent": minf(
			MAX_LIVE_COOLDOWN_REDUCTION_PERCENT,
			maxf(0.0, dash_cooldown_recovery)
		),
		"dash_speed_percent": minf(MAX_LIVE_DASH_SPEED_PERCENT, maxf(0.0, dash_speed)),
		"footwork_damage_reduction_percent": 0.0,
		"guard_while_attacking_percent": 0.0,
		"player_defense_percent": 0.0,
		"active_skill_damage_percent": maxf(0.0, active_skill_damage),
		"applied_live_effects": applied,
		"unsupported_effects": unsupported,
	}


func _hero_definition_for_id(hero_id: StringName) -> HeroDefinition:
	if active_hero != null and active_hero.hero_id == hero_id:
		return active_hero
	if reserve_soul != null and reserve_soul.hero_id == hero_id:
		return reserve_soul
	return null


func _is_takeover_time(value: float) -> bool:
	if reserve_soul == null:
		return false
	if _takeover_for_full_summon:
		return value >= 0.0 and value <= _current_summon_duration()
	for window: Vector2 in reserve_soul.takeover_windows:
		if value >= window.x and value <= window.y:
			return true
	return false


func _current_summon_duration() -> float:
	if state != RelayState.SUMMONING:
		return 0.0
	if _summon_duration_override > 0.0:
		return _summon_duration_override
	if reserve_soul != null:
		return reserve_soul.summon_duration_seconds
	return 0.0


func _reset_summon_overrides() -> void:
	summon_context = &""
	_summon_duration_override = 0.0
	_unused_support_cooldown_override = -1.0
	_takeover_for_full_summon = false


func _clear_readiness() -> void:
	readiness_count = 0
	ready_seconds_left = 0.0
	_clear_shot_progress_seconds = 0.0
	_seen_threat_ids.clear()
	_primary_attacker = null
	_primary_threat_distance = INF
	soul_skill_armed = false


func _reset_runtime_state() -> void:
	state = RelayState.IDLE
	summon_elapsed = 0.0
	support_cooldown_left = 0.0
	takeover_open = false
	_reset_summon_overrides()
	_clear_readiness()
	_emit_state()


func _emit_state() -> void:
	var required := get_effective_ready_requirement()
	readiness_changed.emit(readiness_count, required, ready_seconds_left)
	var seconds_left := 0.0
	match state:
		RelayState.READY: seconds_left = ready_seconds_left
		RelayState.SUMMONING:
			seconds_left = maxf(0.0, _current_summon_duration() - summon_elapsed)
		RelayState.SUPPORT_COOLDOWN: seconds_left = support_cooldown_left
	relay_state_changed.emit(get_state_name(), takeover_open, seconds_left)
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		if events.has_signal(&"soul_readiness_changed"):
			events.emit_signal(&"soul_readiness_changed", readiness_count, required, ready_seconds_left)
		if events.has_signal(&"soul_relay_state_changed"):
			events.emit_signal(&"soul_relay_state_changed", get_state_name(), takeover_open, seconds_left)


func _on_melee_threat_emitted(
		threat_id: StringName,
		attacker: Node,
		target: Node,
		origin: Vector2,
		danger_radius: float
) -> void:
	register_melee_threat(threat_id, attacker, target, origin, danger_radius)
