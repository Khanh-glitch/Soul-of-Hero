class_name WeaponManager
extends Node

signal hand_attack_started(weapon: WeaponDefinition, context: Dictionary)
signal hand_attack_instance_created(weapon: WeaponDefinition, context: Dictionary)
signal hand_attack_hit(weapon: WeaponDefinition, context: Dictionary)
signal hand_skill_started(weapon: WeaponDefinition, context: Dictionary)
signal hand_skill_resolved(weapon: WeaponDefinition, context: Dictionary)
signal hand_combo_reset(weapon: WeaponDefinition)
signal dash_started(direction: Vector2, context: Dictionary)
signal dash_completed(direction: Vector2, context: Dictionary)
signal enemy_damaged(target: Node, amount: float, context: Dictionary)
signal enemy_killed(target: Node, context: Dictionary)
signal player_damaged(amount: float, context: Dictionary)
signal weapon_swap_requested(spirit_slot: int, hand_weapon: WeaponDefinition, requested_weapon: WeaponDefinition, queued: bool)
signal weapon_swap_transition_started(spirit_slot: int, hand_weapon: WeaponDefinition, requested_weapon: WeaponDefinition)
signal weapon_swapped(spirit_slot: int, previous_hand: WeaponDefinition, new_hand: WeaponDefinition)
signal spirit_trigger_progressed(weapon: WeaponDefinition, spirit_slot: int, current: float, required: float)
signal spirit_action_started(weapon: WeaponDefinition, spirit_slot: int, action: SpiritActionDefinition, context: Dictionary)
signal spirit_action_cancel_requested(weapon: WeaponDefinition, reason: StringName)
signal cooldowns_changed()
signal loadout_changed()

const MAX_SPIRIT_SLOTS := 2
const DEFAULT_SWAP_TRANSITION_SECONDS := 0.25
const DEFAULT_SWAP_COOLDOWN_SECONDS := 1.5

@export var starting_hand: WeaponDefinition
@export var starting_spirit_slots: Array[WeaponDefinition] = []
@export var second_spirit_slot_enabled: bool = false
@export_range(0.01, 2.0, 0.01) var swap_transition_seconds: float = DEFAULT_SWAP_TRANSITION_SECONDS
@export_range(0.0, 10.0, 0.05) var swap_cooldown_seconds: float = DEFAULT_SWAP_COOLDOWN_SECONDS

var _hand_weapon: WeaponDefinition
var _spirit_slots: Array[WeaponDefinition] = [null, null]
var _swap_cooldown_remaining := 0.0
var _swap_in_progress := false
var _swap_elapsed := 0.0
var _swap_slot := -1
var _queued_swap_slot := -1
var _action_interruptible := true
var _event_serial := 0
var _target_provider: Callable

# Runtime state is keyed by stable weapon_id, never by a transient node reference.
var _hand_skill_cooldowns: Dictionary = {}
var _spirit_action_cooldowns: Dictionary = {}
var _spirit_trigger_progress: Dictionary = {}
var _spirit_trigger_receipts: Dictionary = {}
var _hand_combo_steps: Dictionary = {}
var _hand_combo_remaining: Dictionary = {}
var _spirit_action_phase: Dictionary = {}


func _ready() -> void:
	if _hand_weapon == null and starting_hand != null:
		configure_loadout(starting_hand, starting_spirit_slots, second_spirit_slot_enabled)


func _process(delta: float) -> void:
	advance_time(delta)


func advance_time(delta: float) -> void:
	if delta <= 0.0:
		return
	_swap_cooldown_remaining = maxf(0.0, _swap_cooldown_remaining - delta)
	_tick_dictionary(_hand_skill_cooldowns, delta)
	_tick_dictionary(_spirit_action_cooldowns, delta)
	_tick_dictionary(_hand_combo_remaining, delta)
	if _swap_in_progress:
		_swap_elapsed += delta
		if _swap_elapsed + 0.00001 >= swap_transition_seconds:
			_complete_swap()
	elif _queued_swap_slot >= 0 and _action_interruptible and _swap_cooldown_remaining <= 0.0:
		_begin_swap(_take_queued_swap())
	cooldowns_changed.emit()


func configure_loadout(
		hand_weapon: WeaponDefinition,
		spirits: Array[WeaponDefinition],
		enable_second_slot := false,
		preserve_cooldowns := false,
) -> bool:
	if hand_weapon == null or not hand_weapon.is_valid_definition() or spirits.size() > MAX_SPIRIT_SLOTS:
		return false
	var prior_hand_cooldowns := _hand_skill_cooldowns.duplicate(true) if preserve_cooldowns else {}
	var prior_spirit_cooldowns := _spirit_action_cooldowns.duplicate(true) if preserve_cooldowns else {}
	var prior_swap_cooldown := _swap_cooldown_remaining if preserve_cooldowns else 0.0
	var seen_ids: Dictionary = {hand_weapon.weapon_id: true}
	for weapon: WeaponDefinition in spirits:
		if weapon == null:
			continue
		if not weapon.is_valid_definition() or seen_ids.has(weapon.weapon_id):
			return false
		seen_ids[weapon.weapon_id] = true
	_hand_weapon = hand_weapon
	_spirit_slots = [null, null]
	for index: int in range(spirits.size()):
		_spirit_slots[index] = spirits[index]
	second_spirit_slot_enabled = enable_second_slot
	_cancel_pending_swap()
	_swap_cooldown_remaining = prior_swap_cooldown
	_hand_skill_cooldowns.clear()
	_spirit_action_cooldowns.clear()
	_spirit_trigger_progress.clear()
	_spirit_trigger_receipts.clear()
	_hand_combo_steps.clear()
	_hand_combo_remaining.clear()
	_spirit_action_phase.clear()
	_initialize_weapon_state(_hand_weapon)
	for weapon: WeaponDefinition in _spirit_slots:
		_initialize_weapon_state(weapon)
	if preserve_cooldowns:
		for weapon_id: Variant in _hand_skill_cooldowns:
			_hand_skill_cooldowns[weapon_id] = float(prior_hand_cooldowns.get(weapon_id, 0.0))
			_spirit_action_cooldowns[weapon_id] = float(prior_spirit_cooldowns.get(weapon_id, 0.0))
	loadout_changed.emit()
	return true


func equip_spirit_slot(slot_index: int, weapon: WeaponDefinition) -> bool:
	if slot_index < 0 or slot_index >= MAX_SPIRIT_SLOTS:
		return false
	if weapon != null:
		if not weapon.is_valid_definition() or (_hand_weapon != null and weapon.weapon_id == _hand_weapon.weapon_id):
			return false
		for index: int in range(MAX_SPIRIT_SLOTS):
			var equipped := _spirit_slots[index]
			if index != slot_index and equipped != null and equipped.weapon_id == weapon.weapon_id:
				return false
	_spirit_slots[slot_index] = weapon
	_initialize_weapon_state(weapon)
	loadout_changed.emit()
	return true


func set_second_spirit_slot_enabled(enabled: bool) -> void:
	if second_spirit_slot_enabled == enabled:
		return
	second_spirit_slot_enabled = enabled
	if not enabled and (_queued_swap_slot == 1 or _swap_slot == 1):
		_cancel_pending_swap()
	loadout_changed.emit()


func get_hand_weapon() -> WeaponDefinition:
	return _hand_weapon


func get_spirit_weapon(slot_index: int) -> WeaponDefinition:
	if slot_index < 0 or slot_index >= MAX_SPIRIT_SLOTS:
		return null
	return _spirit_slots[slot_index]


func get_spirit_slots() -> Array[WeaponDefinition]:
	var result: Array[WeaponDefinition] = []
	result.assign(_spirit_slots)
	return result


func get_active_spirit_slot_count() -> int:
	return MAX_SPIRIT_SLOTS if second_spirit_slot_enabled else 1


func request_swap(spirit_slot: int) -> bool:
	if not _can_request_swap(spirit_slot):
		return false
	var requested_weapon := _spirit_slots[spirit_slot]
	var queued := not _action_interruptible
	weapon_swap_requested.emit(spirit_slot, _hand_weapon, requested_weapon, queued)
	if queued:
		_queued_swap_slot = spirit_slot
	else:
		_begin_swap(spirit_slot)
	return true


func notify_action_uninterruptible() -> void:
	_action_interruptible = false


func notify_action_interruptible() -> void:
	_action_interruptible = true
	if _queued_swap_slot >= 0 and not _swap_in_progress and _swap_cooldown_remaining <= 0.0:
		_begin_swap(_take_queued_swap())


func is_action_interruptible() -> bool:
	return _action_interruptible


func is_swap_in_progress() -> bool:
	return _swap_in_progress


func get_swap_transition_progress() -> float:
	if not _swap_in_progress:
		return 0.0
	return clampf(_swap_elapsed / maxf(swap_transition_seconds, 0.001), 0.0, 1.0)


func get_swap_cooldown_remaining() -> float:
	return _swap_cooldown_remaining


func notify_hand_attack_started(context: Dictionary = {}) -> int:
	if _hand_weapon == null or _hand_weapon.normal_attack == null:
		return 0
	var weapon_id := _hand_weapon.weapon_id
	var next_combo := 1
	if float(_hand_combo_remaining.get(weapon_id, 0.0)) > 0.0:
		next_combo = (int(_hand_combo_steps.get(weapon_id, 0)) % _hand_weapon.normal_attack.combo_count) + 1
	_hand_combo_steps[weapon_id] = next_combo
	_hand_combo_remaining[weapon_id] = _hand_weapon.normal_attack.combo_reset_seconds
	var event_context := _with_event_context(context)
	event_context["combo_index"] = next_combo
	hand_attack_started.emit(_hand_weapon, event_context)
	return next_combo


func notify_hand_attack_instance_created(context: Dictionary = {}) -> void:
	if _hand_weapon == null:
		return
	var event_context := _with_event_context(context)
	hand_attack_instance_created.emit(_hand_weapon, event_context)
	_dispatch_spirit_trigger(SpiritTriggerDefinition.EVENT_HAND_ATTACK_INSTANCE_CREATED, event_context)


func notify_hand_attack_hit(context: Dictionary = {}) -> void:
	var source_weapon := _event_weapon(context)
	if source_weapon == null:
		return
	hand_attack_hit.emit(source_weapon, _with_event_context(context))


func can_use_hand_skill() -> bool:
	return _hand_weapon != null and get_hand_skill_cooldown_remaining(_hand_weapon.weapon_id) <= 0.0


func request_hand_skill(context: Dictionary = {}) -> bool:
	if not can_use_hand_skill() or _hand_weapon.hand_skill == null:
		return false
	# Hero progression may shorten the authored cooldown, but the WeaponManager
	# remains the sole runtime cooldown clock. Callers may only supply a safe
	# multiplier; the immutable WeaponSkillProfile is never mutated.
	var cooldown_multiplier := clampf(float(context.get("cooldown_multiplier", 1.0)), 0.05, 1.0)
	_hand_skill_cooldowns[_hand_weapon.weapon_id] = (
		_hand_weapon.hand_skill.cooldown_seconds * cooldown_multiplier
	)
	hand_skill_started.emit(_hand_weapon, _with_event_context(context))
	cooldowns_changed.emit()
	return true


func notify_hand_skill_resolved(context: Dictionary = {}) -> void:
	var source_weapon := _event_weapon(context)
	if source_weapon == null:
		return
	var event_context := _with_event_context(context)
	hand_skill_resolved.emit(source_weapon, event_context)
	_dispatch_spirit_trigger(SpiritTriggerDefinition.EVENT_HAND_SKILL_RESOLVED, event_context)


func notify_dash_started(direction: Vector2, context: Dictionary = {}) -> void:
	var event_context := _with_event_context(context)
	event_context["dash_vector"] = direction.normalized()
	dash_started.emit(direction.normalized(), event_context)
	_dispatch_spirit_trigger(SpiritTriggerDefinition.EVENT_DASH_STARTED, event_context)


func notify_dash_completed(direction: Vector2, context: Dictionary = {}) -> void:
	var event_context := _with_event_context(context)
	event_context["dash_vector"] = direction.normalized()
	dash_completed.emit(direction.normalized(), event_context)
	_dispatch_spirit_trigger(SpiritTriggerDefinition.EVENT_DASH_COMPLETED, event_context)


func notify_enemy_damaged(target: Node, amount: float, context: Dictionary = {}) -> void:
	var event_context := _with_event_context(context)
	enemy_damaged.emit(target, amount, event_context)
	_dispatch_spirit_trigger(&"enemy_damaged", event_context)


func notify_enemy_killed(target: Node, context: Dictionary = {}) -> void:
	var event_context := _with_event_context(context)
	enemy_killed.emit(target, event_context)
	_dispatch_spirit_trigger(&"enemy_killed", event_context)


func notify_player_damaged(amount: float, context: Dictionary = {}) -> void:
	var event_context := _with_event_context(context)
	player_damaged.emit(amount, event_context)
	_dispatch_spirit_trigger(&"player_damaged", event_context)


func reset_hand_combo() -> void:
	_reset_combo_for(_hand_weapon)


func get_hand_combo_step(weapon_id: StringName = &"") -> int:
	var resolved_id := weapon_id
	if resolved_id.is_empty() and _hand_weapon != null:
		resolved_id = _hand_weapon.weapon_id
	return int(_hand_combo_steps.get(resolved_id, 0))


func get_hand_skill_cooldown_remaining(weapon_id: StringName) -> float:
	return float(_hand_skill_cooldowns.get(weapon_id, 0.0))


func get_spirit_action_cooldown_remaining(weapon_id: StringName) -> float:
	return float(_spirit_action_cooldowns.get(weapon_id, 0.0))


func get_spirit_trigger_progress(weapon_id: StringName) -> float:
	return float(_spirit_trigger_progress.get(weapon_id, 0.0))


func reset_all_cooldowns() -> void:
	_swap_cooldown_remaining = 0.0
	for weapon_id: Variant in _hand_skill_cooldowns:
		_hand_skill_cooldowns[weapon_id] = 0.0
	for weapon_id: Variant in _spirit_action_cooldowns:
		_spirit_action_cooldowns[weapon_id] = 0.0
	cooldowns_changed.emit()


func set_spirit_trigger_progress(weapon_id: StringName, value: float) -> bool:
	var weapon := _find_equipped_weapon(weapon_id)
	if weapon == null or weapon.spirit_trigger == null:
		return false
	var maximum := float(weapon.spirit_trigger.required_count)
	_spirit_trigger_progress[weapon_id] = clampf(value, 0.0, maximum)
	var slot := _find_spirit_slot(weapon_id)
	spirit_trigger_progressed.emit(weapon, slot, float(_spirit_trigger_progress[weapon_id]), maximum)
	return true


func notify_spirit_effect_created(weapon_id: StringName) -> void:
	if _spirit_action_phase.get(weapon_id, &"") == &"precast":
		_spirit_action_phase[weapon_id] = &"active"


func notify_spirit_action_completed(weapon_id: StringName) -> void:
	_spirit_action_phase.erase(weapon_id)


func set_target_provider(provider: Callable) -> void:
	_target_provider = provider


func acquire_targets(rules: WeaponTargetRules, context: Dictionary = {}) -> Array[Node]:
	var targets: Array[Node] = []
	if rules == null or not _target_provider.is_valid():
		return targets
	var raw_targets: Variant = _target_provider.call(rules, context)
	if raw_targets is Array:
		for raw_target: Variant in raw_targets:
			if raw_target is Node and is_instance_valid(raw_target):
				targets.append(raw_target)
	return targets


func to_save_data() -> Dictionary:
	var spirit_ids: Array[String] = []
	for weapon: WeaponDefinition in _spirit_slots:
		spirit_ids.append(String(weapon.weapon_id) if weapon != null else "")
	return {
		"hand_weapon_id": String(_hand_weapon.weapon_id) if _hand_weapon != null else "",
		"spirit_weapon_ids": spirit_ids,
		"second_spirit_slot_enabled": second_spirit_slot_enabled,
	}


func restore_loadout_from_save(data: Dictionary, weapon_registry: Dictionary) -> bool:
	var hand_weapon := _registry_weapon(weapon_registry, StringName(data.get("hand_weapon_id", "")))
	if hand_weapon == null:
		return false
	var spirits: Array[WeaponDefinition] = []
	var raw_spirits: Variant = data.get("spirit_weapon_ids", [])
	if not raw_spirits is Array:
		return false
	for raw_id: Variant in raw_spirits:
		var weapon_id := StringName(str(raw_id))
		spirits.append(null if weapon_id.is_empty() else _registry_weapon(weapon_registry, weapon_id))
		if not weapon_id.is_empty() and spirits[-1] == null:
			return false
	return configure_loadout(hand_weapon, spirits, bool(data.get("second_spirit_slot_enabled", false)))


func get_runtime_state() -> Dictionary:
	return {
		"loadout": to_save_data(),
		"swap_cooldown_remaining": _swap_cooldown_remaining,
		"swap_in_progress": _swap_in_progress,
		"queued_swap_slot": _queued_swap_slot,
		"hand_skill_cooldowns": _hand_skill_cooldowns.duplicate(true),
		"spirit_action_cooldowns": _spirit_action_cooldowns.duplicate(true),
		"spirit_trigger_progress": _spirit_trigger_progress.duplicate(true),
	}


func _can_request_swap(spirit_slot: int) -> bool:
	if spirit_slot < 0 or spirit_slot >= get_active_spirit_slot_count():
		return false
	return (
		_hand_weapon != null
		and _spirit_slots[spirit_slot] != null
		and not _swap_in_progress
		and _queued_swap_slot < 0
		and _swap_cooldown_remaining <= 0.0
	)


func _begin_swap(spirit_slot: int) -> void:
	if spirit_slot < 0:
		return
	_swap_in_progress = true
	_swap_elapsed = 0.0
	_swap_slot = spirit_slot
	_swap_cooldown_remaining = swap_cooldown_seconds
	weapon_swap_transition_started.emit(spirit_slot, _hand_weapon, _spirit_slots[spirit_slot])
	cooldowns_changed.emit()


func _complete_swap() -> void:
	var slot := _swap_slot
	var previous_hand := _hand_weapon
	var new_hand := _spirit_slots[slot]
	_cancel_precast_if_needed(new_hand)
	_spirit_slots[slot] = previous_hand
	_hand_weapon = new_hand
	_reset_combo_for(previous_hand)
	_swap_in_progress = false
	_swap_elapsed = 0.0
	_swap_slot = -1
	weapon_swapped.emit(slot, previous_hand, new_hand)
	loadout_changed.emit()


func _cancel_precast_if_needed(weapon: WeaponDefinition) -> void:
	if weapon == null or weapon.spirit_action == null:
		return
	if _spirit_action_phase.get(weapon.weapon_id, &"") != &"precast":
		return
	if weapon.spirit_action.precast_can_be_cancelled_on_swap:
		_spirit_action_phase.erase(weapon.weapon_id)
		spirit_action_cancel_requested.emit(weapon, &"role_swap_before_effect_created")


func _dispatch_spirit_trigger(event_name: StringName, context: Dictionary) -> void:
	var event_locks: Dictionary = {}
	for slot: int in range(get_active_spirit_slot_count()):
		var weapon := _spirit_slots[slot]
		if weapon == null or weapon.spirit_trigger == null or weapon.spirit_action == null:
			continue
		var trigger := weapon.spirit_trigger
		if not trigger.accepts(event_name, context):
			continue
		# Consume stable skill/event receipts even while the Spirit action is on
		# cooldown. A confirmed skill cannot become a delayed "ghost" trigger if
		# the same resolution is delivered again after cooldown expiry.
		if _is_duplicate_trigger_receipt(weapon, trigger, event_name, context):
			continue
		if get_spirit_action_cooldown_remaining(weapon.weapon_id) > 0.0:
			continue
		if trigger.deduplicate_per_confirmed_event and event_locks.has(weapon.weapon_id):
			continue
		event_locks[weapon.weapon_id] = true
		var required := float(trigger.required_count)
		var progress := minf(required, get_spirit_trigger_progress(weapon.weapon_id) + trigger.progress_per_event)
		_spirit_trigger_progress[weapon.weapon_id] = progress
		spirit_trigger_progressed.emit(weapon, slot, progress, required)
		if progress + 0.00001 < required:
			continue
		_start_spirit_action(weapon, slot, context)
		if trigger.reset_progress_after_action:
			_spirit_trigger_progress[weapon.weapon_id] = 0.0
			spirit_trigger_progressed.emit(weapon, slot, 0.0, required)


func _is_duplicate_trigger_receipt(
		weapon: WeaponDefinition,
		trigger: SpiritTriggerDefinition,
		event_name: StringName,
		context: Dictionary
) -> bool:
	if trigger.deduplication_context_key.is_empty():
		return false
	if not context.has(trigger.deduplication_context_key):
		return true
	var source_id := String(context.get("source_weapon_id", context.get("hand_weapon_id", &"")))
	var receipt := "%s|%s|%s" % [event_name, source_id, str(context[trigger.deduplication_context_key])]
	var weapon_receipts: Dictionary = _spirit_trigger_receipts.get(weapon.weapon_id, {})
	if weapon_receipts.has(receipt):
		return true
	weapon_receipts[receipt] = true
	# Trigger receipts are transient. Bound them so long sessions cannot grow a
	# dictionary forever while still covering delayed duplicate resolutions.
	while weapon_receipts.size() > 64:
		weapon_receipts.erase(weapon_receipts.keys()[0])
	_spirit_trigger_receipts[weapon.weapon_id] = weapon_receipts
	return false


func _start_spirit_action(weapon: WeaponDefinition, slot: int, confirmed_context: Dictionary) -> void:
	var action := weapon.spirit_action
	_spirit_action_cooldowns[weapon.weapon_id] = action.cooldown_seconds
	_spirit_action_phase[weapon.weapon_id] = &"precast"
	var action_context := action.build_action_context(confirmed_context)
	action_context["spirit_slot"] = slot
	action_context["trigger_event"] = weapon.spirit_trigger.confirmed_event
	if not action_context.has("targets"):
		action_context["targets"] = acquire_targets(action.target_rules, action_context)
	spirit_action_started.emit(weapon, slot, action, action_context)
	cooldowns_changed.emit()


func _with_event_context(context: Dictionary) -> Dictionary:
	_event_serial += 1
	var result: Dictionary = context.duplicate(true)
	result["confirmed_event_id"] = _event_serial
	if _hand_weapon != null:
		result["hand_weapon_id"] = _hand_weapon.weapon_id
	return result


func _reset_combo_for(weapon: WeaponDefinition) -> void:
	if weapon == null:
		return
	_hand_combo_steps[weapon.weapon_id] = 0
	_hand_combo_remaining[weapon.weapon_id] = 0.0
	hand_combo_reset.emit(weapon)


func _initialize_weapon_state(weapon: WeaponDefinition) -> void:
	if weapon == null:
		return
	_hand_skill_cooldowns[weapon.weapon_id] = float(_hand_skill_cooldowns.get(weapon.weapon_id, 0.0))
	_spirit_action_cooldowns[weapon.weapon_id] = float(_spirit_action_cooldowns.get(weapon.weapon_id, 0.0))
	_spirit_trigger_progress[weapon.weapon_id] = float(_spirit_trigger_progress.get(weapon.weapon_id, 0.0))
	_hand_combo_steps[weapon.weapon_id] = int(_hand_combo_steps.get(weapon.weapon_id, 0))
	_hand_combo_remaining[weapon.weapon_id] = float(_hand_combo_remaining.get(weapon.weapon_id, 0.0))


func _find_equipped_weapon(weapon_id: StringName) -> WeaponDefinition:
	if _hand_weapon != null and _hand_weapon.weapon_id == weapon_id:
		return _hand_weapon
	for weapon: WeaponDefinition in _spirit_slots:
		if weapon != null and weapon.weapon_id == weapon_id:
			return weapon
	return null


func _event_weapon(context: Dictionary) -> WeaponDefinition:
	var source_id := StringName(context.get("source_weapon_id", &""))
	if not source_id.is_empty():
		var source_weapon := _find_equipped_weapon(source_id)
		if source_weapon != null:
			return source_weapon
	return _hand_weapon


func _find_spirit_slot(weapon_id: StringName) -> int:
	for index: int in range(MAX_SPIRIT_SLOTS):
		var weapon := _spirit_slots[index]
		if weapon != null and weapon.weapon_id == weapon_id:
			return index
	return -1


func _take_queued_swap() -> int:
	var slot := _queued_swap_slot
	_queued_swap_slot = -1
	return slot


func _cancel_pending_swap() -> void:
	_swap_in_progress = false
	_swap_elapsed = 0.0
	_swap_slot = -1
	_queued_swap_slot = -1


func _tick_dictionary(values: Dictionary, delta: float) -> void:
	for key: Variant in values:
		values[key] = maxf(0.0, float(values[key]) - delta)


func _registry_weapon(registry: Dictionary, weapon_id: StringName) -> WeaponDefinition:
	var raw_weapon: Variant = registry.get(weapon_id, registry.get(String(weapon_id)))
	return raw_weapon as WeaponDefinition
