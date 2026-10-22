extends Node

signal player_registered(player: Node)
signal player_health_changed(current: int, maximum: int)
signal hero_health_pools_changed(snapshot: Dictionary)
signal player_stamina_changed(current: float, maximum: float)
signal player_mana_changed(current: float, maximum: float)
signal score_changed(score: int)
signal sigil_collected(current: int, required: int)
signal encounter_objective_changed(defeated: int, total: int, cleared: bool)
signal checkpoint_changed(position: Vector2)
signal objective_completed()
signal player_died()
signal player_respawned()
signal toast_requested(message: String)
signal live_sync_status_changed(connected: bool, detail: String)
signal map_changed(source: String)

# Realtime progression presentation. The progression service remains the sole
# authority and emits these only after an accepted gain/level transition.
signal player_experience_changed(current: int, required: int, gained: int)
signal player_level_changed(level: int, levels_gained: int)
signal hero_experience_changed(
	hero_id: StringName,
	current: int,
	required: int,
	gained: int,
)
signal hero_level_changed(hero_id: StringName, level: int, levels_gained: int)
signal run_completion_ready(result: Dictionary, options: Dictionary)

# Focus presentation for physical ground loot. Passing null clears the plate;
# rarity accepts the canonical normal..eternal IDs used by all item families.
signal loot_focus_changed(
	loot: Node,
	display_name: String,
	rarity: StringName,
	can_pickup: bool
)
# `loot_spawned` is presentation-only. Inventory authority changes exclusively
# on `loot_picked_up`, emitted only after the auto-pickup SaveService commit.
signal loot_spawned(loot: Node, payload: Dictionary)
signal loot_picked_up(payload: Dictionary)
# Fires after a physical pickup resolves even when its durable transaction was
# already present (for example a same-run retry). Objective observers consume
# this; reward/UI systems can keep using loot_picked_up for newly stored items.
signal loot_pickup_resolved(payload: Dictionary, newly_granted: bool)

# Canonical, hero-agnostic combat presentation contract. Gameplay owns damage
# and combo rules; presentation systems subscribe here so hit-stop, numbers,
# audio, and camera feedback never become combat authorities.
signal combat_hit_confirmed(
	target: Node,
	actual_amount: int,
	world_position: Vector2,
	context: Dictionary
)
signal combat_cue_requested(
	cue_id: StringName,
	world_position: Vector2,
	context: Dictionary
)
signal hero_combo_state_changed(
	hero_id: StringName,
	combo_step: int,
	hit_count: int,
	reset_seconds: float,
	active: bool
)

# Hero/Soul gameplay contract. Threat IDs are stable per enemy attack instance;
# HeroSoulManager deduplicates them and never requires the player to take damage.
signal melee_threat_emitted(
	threat_id: StringName,
	attacker: Node,
	intended_target: Node,
	origin: Vector2,
	danger_radius: float
)
signal soul_readiness_changed(current: int, required: int, ready_seconds: float)
signal soul_relay_state_changed(state_name: StringName, takeover_open: bool, seconds_left: float)
signal archer_focus_changed(current: int, maximum: int, reason: StringName)
signal wizard_state_changed(state: Dictionary)
signal soul_relay_completed(incoming_hero_id: StringName, outgoing_hero_id: StringName, destination: Vector2)

# Confirmed Living Arsenal combat contract. Systems such as Weapon Spirits,
# mastery, tutorials and VFX subscribe to these events instead of polling the
# player every frame or inferring intent from raw button presses.
signal hand_attack_started(weapon_id: StringName, combo_index: int)
signal hand_attack_instance_created(weapon_id: StringName, instance_id: int)
signal hand_attack_hit(weapon_id: StringName, target: Node, damage: int)
signal hand_skill_started(weapon_id: StringName)
signal hand_skill_resolved(weapon_id: StringName, endpoint: Vector2, hit_count: int)
signal dash_started(direction: Vector2)
signal dash_completed(direction: Vector2)
signal enemy_damaged(enemy: Node, amount: int, weapon_id: StringName)
signal enemy_killed(enemy: Node, weapon_id: StringName)
signal weapon_swap_requested(spirit_slot: int)
signal weapon_swapped(hand_weapon_id: StringName, spirit_weapon_ids: Array[StringName])
signal spirit_trigger_progressed(weapon_id: StringName, current: int, required: int)
signal spirit_action_started(weapon_id: StringName)
signal weapon_unlocked(weapon_id: StringName)
