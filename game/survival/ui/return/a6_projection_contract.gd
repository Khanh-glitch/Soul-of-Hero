class_name A6ProjectionContract
extends RefCounted

## A6's read-only contracts for the survival return / guidance / history UI.
##
## Every value this UI shows is derived from one of these dictionaries. A6 never
## owns a run clock, a production queue, provisions or a trail store: A0/A1/A3 do,
## and they publish a projection. When a projection is missing or malformed this
## module returns `available = false` and the UI renders nothing instead of
## inventing a countdown, a reward or a safety verdict.
##
## Contracts (all player-invisible; the player never sees these strings):
##   * `soh.a6.season_clock.v1`   — the D055 14-real-day run window.
##   * `soh.a6.return_digest.v1`  — what genuinely changed while the app was closed.
##   * `soh.a6.run_history.v1`    — D056 account records: completed runs + achievements.
##   * `soh.a6.site_cues.v1`      — D061 detectable traces / nearby threats.
##
## The exact shapes and the mount instructions for A0 are in
## `docs/survival/ux/A6_SURVIVAL_RETURN_UI_CONTRACT_20261030.md`.

const SEASON_CLOCK_CONTRACT := "soh.a6.season_clock.v1"
const RETURN_DIGEST_CONTRACT := "soh.a6.return_digest.v1"
const RUN_HISTORY_CONTRACT := "soh.a6.run_history.v1"
const SITE_CUES_CONTRACT := "soh.a6.site_cues.v1"

## D055 is user-locked at 14 real calendar days including all offline time.
const RUN_DAYS := 14
const RUN_SECONDS := RUN_DAYS * 24 * 60 * 60

## Production kinds A6 knows how to label. Anything else is ignored rather than
## printed raw, so a future A3 station cannot leak a source id into release UI.
const PRODUCTION_KINDS := ["forge", "research", "crop", "food", "water"]
const STOP_REASONS := [
	"fuel_empty",
	"input_empty",
	"output_full",
	"no_water",
	"queue_empty",
	"capacity_full",
	"season_ended",
	"unknown",
]

## Substrings that must never reach release UI (D052). Player-facing text from an
## owner is rejected when it contains any of them, so an owner bug cannot turn the
## HUD into a debug console.
const TECHNICAL_MARKERS := [
	"res://",
	"user://",
	"soh.",
	"schema",
	"contract",
	"_v1",
	"BLOCKED",
	"NATIVE",
	"FIXTURE",
	"TEST ONLY",
	"TODO",
	"null",
	"<null>",
]


static func is_player_facing_text(value: Variant, max_length := 120) -> bool:
	if not value is String:
		return false
	var text := (value as String).strip_edges()
	if text.is_empty() or text.length() > max_length:
		return false
	var lowered := text.to_lower()
	for marker: String in TECHNICAL_MARKERS:
		if lowered.contains(marker.to_lower()):
			return false
	return true


# --- season clock -----------------------------------------------------------


static func make_unavailable_clock(reason: String) -> Dictionary:
	return {"available": false, "reason": reason}


## Validates the D055 run window. The span is required to be exactly 336 hours:
## a shorter or longer window would show the player a false deadline, so it is
## rejected rather than clamped.
static func sanitize_season_clock(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_clock("season_clock_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != SEASON_CLOCK_CONTRACT:
		return make_unavailable_clock("season_clock_contract_mismatch")
	var started := _as_unix_seconds(source.get("started_at_unix", null))
	var ends := _as_unix_seconds(source.get("ends_at_unix", null))
	if started <= 0 or ends <= 0:
		return make_unavailable_clock("season_clock_timestamps_invalid")
	if ends - started != RUN_SECONDS:
		return make_unavailable_clock("season_clock_span_mismatch")
	var run_number := _as_positive_int(source.get("run_number", 1), 1)
	var run_id := String(source.get("run_id", "")).strip_edges()
	if not _is_short_token(run_id):
		return make_unavailable_clock("season_clock_run_id_invalid")
	var ended := bool(source.get("ended", false))
	var ended_reason := String(source.get("ended_reason", "")).strip_edges().to_lower()
	if ended_reason not in ["", "deadline", "abandoned"]:
		ended_reason = ""
	return {
		"available": true,
		"reason": "",
		"run_id": run_id,
		"run_number": run_number,
		"started_at_unix": started,
		"ends_at_unix": ends,
		"ended": ended,
		"ended_reason": ended_reason,
	}


## Seconds of the run still available at `now_unix`, clamped to the window.
static func remaining_seconds(clock: Dictionary, now_unix: int) -> int:
	if not bool(clock.get("available", false)):
		return 0
	if bool(clock.get("ended", false)):
		return 0
	var ends := int(clock.get("ends_at_unix", 0))
	var started := int(clock.get("started_at_unix", 0))
	if now_unix >= ends:
		return 0
	if now_unix <= started:
		return RUN_SECONDS
	return ends - now_unix


## True once the run window is over, either because the owner said so or because
## the calendar deadline has passed.
static func is_run_over(clock: Dictionary, now_unix: int) -> bool:
	if not bool(clock.get("available", false)):
		return false
	if bool(clock.get("ended", false)):
		return true
	return now_unix >= int(clock.get("ends_at_unix", 0))


# --- return digest ----------------------------------------------------------


static func make_unavailable_digest(reason: String) -> Dictionary:
	return {
		"available": false,
		"reason": reason,
		"digest_id": "",
		"away_seconds": 0,
		"production": [],
		"provisions": {},
		"world_changes": [],
	}


## Validates what the owners settled for this return. Only sections that really
## carry data survive; everything else is dropped so the UI cannot show an empty
## "8 ingots" card or a placeholder row.
static func sanitize_return_digest(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_digest("return_digest_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != RETURN_DIGEST_CONTRACT:
		return make_unavailable_digest("return_digest_contract_mismatch")
	var digest_id := String(source.get("digest_id", "")).strip_edges()
	if not _is_short_token(digest_id):
		return make_unavailable_digest("return_digest_id_invalid")
	var away := _as_non_negative_int(source.get("away_seconds", 0), 0)
	var production: Array[Dictionary] = []
	var raw_production: Variant = source.get("production", [])
	if raw_production is Array:
		for entry_value: Variant in raw_production:
			var entry := _sanitize_production_entry(entry_value)
			if not entry.is_empty():
				production.append(entry)
			if production.size() >= 4:
				break
	var provisions := _sanitize_provisions(source.get("provisions", {}))
	var world_changes: Array[String] = []
	var raw_world: Variant = source.get("world_changes", [])
	if raw_world is Array:
		for change_value: Variant in raw_world:
			if is_player_facing_text(change_value, 90):
				world_changes.append(String(change_value).strip_edges())
			if world_changes.size() >= 3:
				break
	if production.is_empty() and provisions.is_empty() and world_changes.is_empty():
		return make_unavailable_digest("return_digest_without_settled_changes")
	return {
		"available": true,
		"reason": "",
		"digest_id": digest_id,
		"away_seconds": away,
		"production": production,
		"provisions": provisions,
		"world_changes": world_changes,
	}


static func _sanitize_production_entry(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return {}
	var entry: Dictionary = raw
	var kind := String(entry.get("kind", "")).strip_edges().to_lower()
	if kind not in PRODUCTION_KINDS:
		return {}
	var completed := _as_positive_int(entry.get("completed_units", 0), 0)
	if completed <= 0:
		return {}
	if not is_player_facing_text(entry.get("unit_label", ""), 40):
		return {}
	var stop_reason := String(entry.get("stop_reason", "")).strip_edges().to_lower()
	if stop_reason not in STOP_REASONS:
		stop_reason = "unknown"
	return {
		"kind": kind,
		"completed_units": completed,
		"unit_label": String(entry.get("unit_label", "")).strip_edges(),
		"stop_reason": stop_reason,
	}


static func _sanitize_provisions(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return {}
	var source: Dictionary = raw
	var consumed := _as_non_negative_int(source.get("consumed", 0), 0)
	var shelter_kind := String(source.get("shelter", "")).strip_edges().to_lower()
	if shelter_kind not in ["home", "wilderness", "unknown"]:
		shelter_kind = "unknown"
	var hp_floor := bool(source.get("hp_floor", false))
	# D059 only guarantees the 1 HP floor inside a valid owned shelter. Outside
	# one the honest message is different, so the two are never merged.
	if consumed <= 0 and not hp_floor:
		return {}
	return {
		"consumed": consumed,
		"shelter": shelter_kind,
		"hp_floor": hp_floor and shelter_kind == "home",
	}


# --- run history / achievements --------------------------------------------


static func make_unavailable_history(reason: String) -> Dictionary:
	return {"available": false, "reason": reason, "runs": [], "achievements": []}


## D056: completed-run records and account achievements survive a season reset;
## nothing else does. A6 rejects any field that promises gameplay power, because
## a stored bonus would contradict "achievements must not grant advantages".
static func sanitize_run_history(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_history("run_history_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != RUN_HISTORY_CONTRACT:
		return make_unavailable_history("run_history_contract_mismatch")
	var runs: Array[Dictionary] = []
	var raw_runs: Variant = source.get("runs", [])
	if raw_runs is Array:
		for run_value: Variant in raw_runs:
			var record := _sanitize_run_record(run_value)
			if record.is_empty():
				continue
			runs.append(record)
			if runs.size() >= 20:
				break
	# Newest first, so the player sees the freshest season without scrolling.
	runs.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("ended_at_unix", 0)) > int(b.get("ended_at_unix", 0)))
	var achievements: Array[Dictionary] = []
	var raw_achievements: Variant = source.get("achievements", [])
	if raw_achievements is Array:
		for achievement_value: Variant in raw_achievements:
			var achievement := _sanitize_achievement(achievement_value)
			if achievement.is_empty():
				continue
			achievements.append(achievement)
			if achievements.size() >= 24:
				break
	return {"available": true, "reason": "", "runs": runs, "achievements": achievements}


static func _sanitize_run_record(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return {}
	var record: Dictionary = raw
	var started := _as_unix_seconds(record.get("started_at_unix", null))
	var ended := _as_unix_seconds(record.get("ended_at_unix", null))
	if started <= 0 or ended <= 0 or ended < started:
		return {}
	var end_reason := String(record.get("end_reason", "")).strip_edges().to_lower()
	if end_reason not in ["deadline", "abandoned"]:
		return {}
	var milestones: Array[String] = []
	var raw_milestones: Variant = record.get("milestones", [])
	if raw_milestones is Array:
		for milestone_value: Variant in raw_milestones:
			if is_player_facing_text(milestone_value, 70):
				milestones.append(String(milestone_value).strip_edges())
			if milestones.size() >= 3:
				break
	return {
		"started_at_unix": started,
		"ended_at_unix": ended,
		"end_reason": end_reason,
		"milestones": milestones,
	}


static func _sanitize_achievement(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return {}
	var record: Dictionary = raw
	if not is_player_facing_text(record.get("title", ""), 60):
		return {}
	var detail := String(record.get("detail", "")).strip_edges()
	if not detail.is_empty() and not is_player_facing_text(detail, 100):
		detail = ""
	var earned := _as_unix_seconds(record.get("earned_at_unix", null))
	return {
		"title": String(record.get("title", "")).strip_edges(),
		"detail": detail,
		"earned_at_unix": earned,
	}


# --- D061 site cues ---------------------------------------------------------


static func make_unavailable_cues(reason: String) -> Dictionary:
	return {"available": false, "reason": reason, "trail": {}, "threats": []}


## D061 projections describe what the player can actually perceive. There is
## deliberately no "safe" flag: an empty projection means "no signs reported",
## never "you are protected", so the UI cannot print an omniscient verdict.
static func sanitize_site_cues(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_cues("site_cues_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != SITE_CUES_CONTRACT:
		return make_unavailable_cues("site_cues_contract_mismatch")
	var observed := _as_unix_seconds(source.get("observed_at_unix", null))
	if observed <= 0:
		return make_unavailable_cues("site_cues_timestamp_invalid")
	var trail: Dictionary = {}
	var raw_trail: Variant = source.get("trail", {})
	if raw_trail is Dictionary and bool((raw_trail as Dictionary).get("present", false)):
		var age := _as_non_negative_int((raw_trail as Dictionary).get("age_seconds", 0), 0)
		trail = {"present": true, "age_seconds": age}
	var threats: Array[Dictionary] = []
	var raw_threats: Variant = source.get("threats", [])
	if raw_threats is Array:
		for threat_value: Variant in raw_threats:
			if not threat_value is Dictionary:
				continue
			var threat: Dictionary = threat_value
			var distance := float(threat.get("distance_m", -1.0))
			if distance < 0.0 or distance > 400.0:
				continue
			var label := String(threat.get("label", "")).strip_edges()
			if not is_player_facing_text(label, 40):
				label = ""
			threats.append({"distance_m": distance, "label": label})
			if threats.size() >= 3:
				break
	threats.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a.get("distance_m", 0.0)) < float(b.get("distance_m", 0.0)))
	return {"available": true, "reason": "", "trail": trail, "threats": threats, "observed_at_unix": observed}


# --- shared helpers ---------------------------------------------------------


static func _as_unix_seconds(value: Variant) -> int:
	if not (value is int or value is float):
		return -1
	var number := int(value)
	# Anything outside 2001..2100 is a clock bug, not a season.
	if number < 978307200 or number > 4102444800:
		return -1
	return number


static func _as_non_negative_int(value: Variant, fallback: int) -> int:
	if not (value is int or value is float):
		return fallback
	var number := int(value)
	if number < 0 or number > 100000000:
		return fallback
	return number


static func _as_positive_int(value: Variant, fallback: int) -> int:
	var number := _as_non_negative_int(value, 0)
	return number if number > 0 else fallback


static func _is_short_token(value: String) -> bool:
	if value.is_empty() or value.length() > 96:
		return false
	return true
