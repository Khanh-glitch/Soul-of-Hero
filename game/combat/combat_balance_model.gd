class_name CombatBalanceModel
extends RefCounted

## Pure balance laboratory built on the production CombatResolver.
##
## Content supplies action sequences and target/resource profiles as data. This
## model owns no Hero, item, monster, level, or chapter IDs, so every future
## content pack can use the same TTK, survivability, and skill-tempo contract.

const RESOLVER := preload("res://game/combat/combat_resolver.gd")
const MAX_SIMULATED_HITS := 10000
const MAX_RESOURCE_EVENTS := 10000


## Simulates a deterministic repeating action sequence until the target dies.
## Damage is always the resolver's rounded expected hit, matching deterministic
## runtime/preview behavior. Each entry accepts:
## {
##   "id": StringName,
##   "request": CombatResolver request,
##   "duration_seconds": positive number,
##   "hit_time_seconds": number in [0, duration], # defaults to duration
## }
static func sequence_ttk(
		target_hp: float,
		actions: Array,
		maximum_hits: int = MAX_SIMULATED_HITS,
) -> Dictionary:
	var safe_hp := _positive_finite(target_hp, 0.0)
	var normalized := _normalize_actions(actions)
	var hit_cap := clampi(maximum_hits, 1, MAX_SIMULATED_HITS)
	if safe_hp <= 0.0 or normalized.is_empty():
		return _invalid_sequence_snapshot(safe_hp, normalized)

	var cycle_damage := 0
	var cycle_seconds := 0.0
	for action: Dictionary in normalized:
		cycle_damage += int(action["expected_damage"])
		cycle_seconds += float(action["duration_seconds"])
	if cycle_damage <= 0 or cycle_seconds <= 0.0:
		return _invalid_sequence_snapshot(safe_hp, normalized)

	var remaining := safe_hp
	var elapsed := 0.0
	var hits := 0
	var cycles_started := 0
	var damage_dealt := 0
	var killing_action := &""
	var killing_action_index := -1
	var hit_ledger: Array[Dictionary] = []
	while remaining > 0.0 and hits < hit_cap:
		cycles_started += 1
		for action_index: int in normalized.size():
			var action: Dictionary = normalized[action_index]
			var damage := int(action["expected_damage"])
			var hit_at := elapsed + float(action["hit_time_seconds"])
			var applied := mini(damage, ceili(remaining))
			remaining = maxf(0.0, remaining - float(damage))
			damage_dealt += damage
			hits += 1
			hit_ledger.append({
				"hit": hits,
				"cycle": cycles_started,
				"action_index": action_index,
				"action_id": action["id"],
				"damage": damage,
				"applied_damage": applied,
				"time_seconds": hit_at,
				"remaining_hp": remaining,
			})
			if remaining <= 0.0:
				killing_action = action["id"]
				killing_action_index = action_index
				return {
					"valid": true,
					"killed": true,
					"target_hp": safe_hp,
					"hits_to_kill": hits,
					"cycles_started": cycles_started,
					"completed_cycles": (hits - 1) / normalized.size(),
					"ttk_seconds": hit_at,
					"killing_action_id": killing_action,
					"killing_action_index": killing_action_index,
					"damage_dealt": damage_dealt,
					"overkill_damage": maxf(0.0, float(damage_dealt) - safe_hp),
					"cycle_damage": cycle_damage,
					"cycle_seconds": cycle_seconds,
					"sustained_dps": float(cycle_damage) / cycle_seconds,
					"actions": normalized.duplicate(true),
					"hit_ledger": hit_ledger,
				}
			elapsed += float(action["duration_seconds"])
			if hits >= hit_cap:
				break

	return {
		"valid": true,
		"killed": false,
		"target_hp": safe_hp,
		"hits_to_kill": hits,
		"cycles_started": cycles_started,
		"completed_cycles": hits / normalized.size(),
		"ttk_seconds": elapsed,
		"killing_action_id": killing_action,
		"killing_action_index": killing_action_index,
		"damage_dealt": damage_dealt,
		"overkill_damage": 0.0,
		"cycle_damage": cycle_damage,
		"cycle_seconds": cycle_seconds,
		"sustained_dps": float(cycle_damage) / cycle_seconds,
		"actions": normalized.duplicate(true),
		"hit_ledger": hit_ledger,
	}


## Projects how many identical confirmed hits the defender can survive. Defense
## belongs in `incoming_request`, so this remains the same formula used by TTK.
static func survivability(
		max_hp: float,
		incoming_request: Dictionary,
		attack_interval_seconds: float,
) -> Dictionary:
	var safe_hp := _positive_finite(max_hp, 0.0)
	var interval := _positive_finite(attack_interval_seconds, 0.0)
	var preview := RESOLVER.preview(incoming_request)
	var damage := int(preview.get("expected_damage", 0))
	if safe_hp <= 0.0 or interval <= 0.0 or damage <= 0:
		return {
			"valid": false,
			"max_hp": safe_hp,
			"incoming_damage": damage,
			"hits_to_die": 0,
			"time_to_die_seconds": 0.0,
			"preview": preview,
		}
	var hits := ceili(safe_hp / float(damage))
	return {
		"valid": true,
		"max_hp": safe_hp,
		"incoming_damage": damage,
		"hits_to_die": hits,
		# First hit lands after one authored attack interval, matching sequence_ttk.
		"time_to_die_seconds": float(hits) * interval,
		"overkill_damage": maxf(0.0, float(hits * damage) - safe_hp),
		"preview": preview,
	}


## Event simulation for Mana/cooldown tempo over an authored observation window.
## The actor starts at full Mana, casts as soon as both resources permit, and
## regenerates continuously. This measures sustainable use without inventing a
## separate closed-form approximation that diverges at cast breakpoints.
static func resource_tempo(
		max_resource: float,
		regen_per_second: float,
		cost_per_cast: float,
		cooldown_seconds: float,
		window_seconds: float = 60.0,
) -> Dictionary:
	var maximum := _positive_finite(max_resource, 0.0)
	var regen := _non_negative_finite(regen_per_second, 0.0)
	var cost := _positive_finite(cost_per_cast, 0.0)
	var cooldown := _positive_finite(cooldown_seconds, 0.0)
	var window := _positive_finite(window_seconds, 0.0)
	if maximum <= 0.0 or cost <= 0.0 or cooldown <= 0.0 or window <= 0.0:
		return {
			"valid": false,
			"casts": 0,
			"casts_per_minute": 0.0,
			"ending_resource": maximum,
			"cast_times": PackedFloat64Array(),
		}
	var resource := maximum
	var now := 0.0
	var ready_at := 0.0
	var casts := 0
	var cast_times := PackedFloat64Array()
	while now <= window + 0.000001 and casts < MAX_RESOURCE_EVENTS:
		if ready_at > window:
			resource = minf(maximum, resource + regen * maxf(0.0, window - now))
			now = window
			break
		resource = minf(maximum, resource + regen * maxf(0.0, ready_at - now))
		now = ready_at
		if resource + 0.000001 < cost:
			if regen <= 0.0:
				resource = minf(maximum, resource + regen * maxf(0.0, window - now))
				now = window
				break
			var wait_for_resource := (cost - resource) / regen
			if now + wait_for_resource > window:
				resource = minf(maximum, resource + regen * maxf(0.0, window - now))
				now = window
				break
			resource = minf(maximum, resource + regen * wait_for_resource)
			now += wait_for_resource
		if now > window + 0.000001:
			break
		resource = maxf(0.0, resource - cost)
		casts += 1
		cast_times.append(now)
		ready_at = now + cooldown
	if now < window:
		resource = minf(maximum, resource + regen * (window - now))
	return {
		"valid": true,
		"max_resource": maximum,
		"regen_per_second": regen,
		"cost_per_cast": cost,
		"cooldown_seconds": cooldown,
		"window_seconds": window,
		"casts": casts,
		"casts_per_minute": float(casts) * 60.0 / window,
		"ending_resource": resource,
		"cast_times": cast_times,
		"resource_limited": regen * cooldown + 0.000001 < cost,
	}


## Small shared gate primitive for data-driven balance matrices.
static func band_result(value: float, minimum: float, maximum: float) -> Dictionary:
	var safe_value := _finite(value, 0.0)
	var low := _finite(minimum, 0.0)
	var high := _finite(maximum, low)
	if high < low:
		var swap := low
		low = high
		high = swap
	return {
		"value": safe_value,
		"minimum": low,
		"maximum": high,
		"passed": safe_value >= low and safe_value <= high,
		"distance_below": maxf(0.0, low - safe_value),
		"distance_above": maxf(0.0, safe_value - high),
	}


static func _normalize_actions(actions: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for index: int in actions.size():
		var raw: Variant = actions[index]
		if not raw is Dictionary:
			continue
		var entry := raw as Dictionary
		var request_value: Variant = entry.get("request", {})
		if not request_value is Dictionary:
			continue
		var duration := _positive_finite(entry.get("duration_seconds", 0.0), 0.0)
		if duration <= 0.0:
			continue
		var hit_time := clampf(
			_non_negative_finite(entry.get("hit_time_seconds", duration), duration),
			0.0,
			duration,
		)
		var request := (request_value as Dictionary).duplicate(true)
		var preview := RESOLVER.preview(request)
		result.append({
			"id": StringName(entry.get("id", "action_%d" % (index + 1))),
			"request": request,
			"duration_seconds": duration,
			"hit_time_seconds": hit_time,
			"expected_damage": int(preview.get("expected_damage", 0)),
			"minimum_damage": int(preview.get("minimum_damage", 0)),
			"maximum_damage": int(preview.get("maximum_damage", 0)),
			"preview": preview,
		})
	return result


static func _invalid_sequence_snapshot(target_hp: float, actions: Array) -> Dictionary:
	return {
		"valid": false,
		"killed": false,
		"target_hp": target_hp,
		"hits_to_kill": 0,
		"cycles_started": 0,
		"completed_cycles": 0,
		"ttk_seconds": 0.0,
		"killing_action_id": &"",
		"killing_action_index": -1,
		"damage_dealt": 0,
		"overkill_damage": 0.0,
		"cycle_damage": 0,
		"cycle_seconds": 0.0,
		"sustained_dps": 0.0,
		"actions": actions.duplicate(true),
		"hit_ledger": [],
	}


static func _positive_finite(value: Variant, fallback: float) -> float:
	var numeric := _variant_float(value, fallback)
	return numeric if numeric > 0.0 else fallback


static func _non_negative_finite(value: Variant, fallback: float) -> float:
	return maxf(0.0, _variant_float(value, fallback))


static func _variant_float(value: Variant, fallback: float) -> float:
	if not (value is int or value is float):
		return fallback
	return _finite(float(value), fallback)


static func _finite(value: float, fallback: float) -> float:
	return value if not is_nan(value) and not is_inf(value) else fallback
