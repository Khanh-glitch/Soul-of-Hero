class_name A6ProjectionContract
extends RefCounted

## A6's read-only contracts for the survival return / guidance / history UI.
##
## Every value this UI shows is derived from one of these dictionaries. A6 never
## owns a run clock, a durable action ledger, a production queue, provisions, an
## acknowledgement list or a trail store: A0/A1/A3 do, and they publish a
## projection. When a projection is missing or malformed this module returns
## `available = false`, and the UI renders nothing instead of inventing a
## countdown, a completed quest, a reward or a safety verdict.
##
## Contracts (all player-invisible; the player never sees these strings):
##   * `soh.a6.season_clock.v1`   — the D055 14-real-day run window.
##   * `soh.a6.run_facts.v1`      — durable per-run action facts + validated shelter.
##   * `soh.a6.return_digest.v1`  — what genuinely changed while the app was closed.
##   * `soh.a6.digest_ack.v1`     — owner memory of digests already shown.
##   * `soh.a6.run_history.v1`    — D056 account records: completed runs + achievements.
##   * `soh.a6.site_cues.v2`      — D061 perceived, unexpired cues.
##   * `soh.a6.account_wallet.v1` — D056/D064 `profile.secured_ragnarok_currency`.
##
## The wallet is deliberately the smallest contract here: A6 is handed a balance and
## a deposit flag and prints them. It does not add, convert, total or remember one,
## because D066 makes Ragnarok cash a physical item whose value changes only on a
## physical deposit, and A6 is a read-only surface (D074).
##
## The exact shapes and the mount instructions for A0 are in
## `docs/survival/ux/A6_SURVIVAL_RETURN_UI_CONTRACT_20261030.md`.

const SEASON_CLOCK_CONTRACT := "soh.a6.season_clock.v1"
const RUN_FACTS_CONTRACT := "soh.a6.run_facts.v1"
const RETURN_DIGEST_CONTRACT := "soh.a6.return_digest.v1"
const DIGEST_ACK_CONTRACT := "soh.a6.digest_ack.v1"
const RUN_HISTORY_CONTRACT := "soh.a6.run_history.v1"
const SITE_CUES_CONTRACT := "soh.a6.site_cues.v2"
const ACCOUNT_WALLET_CONTRACT := "soh.a6.account_wallet.v1"

## Provenances that may reach a player. Anything else - a fixture, a stub, a
## hand-typed number - is refused rather than displayed.
const OWNER_PROVENANCES := ["A0_OWNER_PROJECTION", "A3_OWNER_PROJECTION"]

## D055 is user-locked at 14 real calendar days including all offline time.
const RUN_DAYS := 14
const RUN_SECONDS := RUN_DAYS * 24 * 60 * 60

## D065: the last 72 hours of the 14-day run are RAGNAROK. This is a window
## derived from the owner's own two timestamps, not a second clock: A6 subtracts
## and nothing else.
const RAGNAROK_SECONDS := 72 * 60 * 60

## D062/D068 run endings A6 is allowed to label.
const ENDED_REASONS := ["", "deadline", "abandoned", "evacuation"]

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

## Actions A0 may report as durably performed inside the current run. A6 uses the
## key only as a lookup, never as a display string.
const GUIDANCE_ACTIONS := ["gather_materials", "valid_shelter", "place_bed", "place_storage", "learn_recipe"]

## Perception channels the D061 owner may report. Each one is something a player
## could actually have seen, heard or found; there is no "sensor" channel.
const CUE_CHANNELS := ["sound", "sight", "trace"]
const CUE_DIRECTIONS := ["", "left", "right", "ahead", "behind", "ahead_left", "ahead_right", "behind_left", "behind_right"]

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
	"_v2",
	"BLOCKED",
	"NATIVE",
	"FIXTURE",
	"TEST ONLY",
	"TODO",
	"null",
	"<null>",
]

const STATE_DONE := "done"
const STATE_OPEN := "open"
const STATE_UNKNOWN := "unknown"


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


## D065 window arithmetic over the validated clock. `available = false` when the
## clock itself is unavailable, so a missing projection never becomes "Ragnarok".
static func ragnarok_window(clock: Dictionary, now_unix: int) -> Dictionary:
	if not bool(clock.get("available", false)):
		return {"available": false, "active": false, "enters_at_unix": 0, "seconds_left": 0}
	var ends := int(clock.get("ends_at_unix", 0))
	var enters := ends - RAGNAROK_SECONDS
	return {
		"available": true,
		"active": now_unix >= enters and now_unix < ends,
		"enters_at_unix": enters,
		"seconds_left": maxi(0, ends - now_unix),
	}


## Validates the D055 run window. The span is required to be exactly 336 hours:
## a shorter or longer window would show the player a false deadline, so it is
## rejected rather than clamped. This is a *span* check, independent of how much
## of the window is left — showing "13 ngày" near the end is legitimate.
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
	# D062/D068: a run ends by deadline, by voluntary abandon, or by a successful
	# physical evacuation. Evacuation is not abandon and must keep its own label.
	if ended_reason not in ENDED_REASONS:
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


# --- durable run facts (D057 guidance) --------------------------------------


static func make_unavailable_run_facts(reason: String) -> Dictionary:
	return {
		"available": false,
		"reason": reason,
		"run_id": "",
		"run_number": 0,
		"performed": {},
		"holds_materials": -1,
		"shelter": STATE_UNKNOWN,
	}


## Validates the owner's durable per-run ledger.
##
## Three states are preserved deliberately:
##   * action present and `true`   → the player did it this run, permanently;
##   * action present and `false`  → the owner knows it is still open;
##   * action absent               → **unknown**, not "not done".
## The same applies to `shelter.validated`: absent means nobody has judged the
## home, which is different from "the home is not valid".
static func sanitize_run_facts(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_run_facts("run_facts_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != RUN_FACTS_CONTRACT:
		return make_unavailable_run_facts("run_facts_contract_mismatch")
	var result := make_unavailable_run_facts("")
	result["available"] = true
	result["run_id"] = String(source.get("run_id", "")).strip_edges() if _is_short_token(String(source.get("run_id", "")).strip_edges()) else ""
	result["run_number"] = _as_positive_int(source.get("run_number", 0), 0)
	var performed: Dictionary = {}
	var raw_performed: Variant = source.get("performed", {})
	if raw_performed is Dictionary:
		for action: String in GUIDANCE_ACTIONS:
			var value: Variant = (raw_performed as Dictionary).get(action, null)
			if value is bool:
				performed[action] = value
	result["performed"] = performed
	var holds: Variant = source.get("holds", {})
	if holds is Dictionary:
		var materials: Variant = (holds as Dictionary).get("materials", null)
		if materials is int or materials is float:
			result["holds_materials"] = _as_non_negative_int(materials, -1)
	var shelter: Variant = source.get("shelter", {})
	if shelter is Dictionary and (shelter as Dictionary).get("validated", null) is bool:
		result["shelter"] = "validated" if bool((shelter as Dictionary)["validated"]) else "invalid"
	return result


## Tri-state lookup used by the guidance model: done / open / unknown.
static func action_state(facts: Dictionary, action: String) -> String:
	var performed: Variant = facts.get("performed", {})
	if not performed is Dictionary:
		return STATE_UNKNOWN
	var value: Variant = (performed as Dictionary).get(action, null)
	if not value is bool:
		return STATE_UNKNOWN
	return STATE_DONE if bool(value) else STATE_OPEN


## Correlates the durable ledger with the run the owner clock says is active.
##
## D056 resets all gameplay progression per run, so a valid season-01 ledger must
## never tick season-02 chores. The rule is fail-closed:
##   * with a clock, a ledger must carry the same run id (and the same run number
##     when it also declares one); data with no binding is unverified and ignored;
##   * without a clock the ledger is the only run identity source and must carry at
##     least a run id or a run number.
## An unbound ledger is displayed as unknown steps, never as imported checkmarks.
static func bind_run_facts(facts: Dictionary, clock: Dictionary) -> Dictionary:
	if not bool(facts.get("available", false)):
		return {"bound": false, "reason": "run_facts_unavailable"}
	var facts_run_id := String(facts.get("run_id", ""))
	var facts_run_number := int(facts.get("run_number", 0))
	if bool(clock.get("available", false)):
		var clock_run_id := String(clock.get("run_id", ""))
		var clock_run_number := maxi(1, int(clock.get("run_number", 1)))
		if not facts_run_id.is_empty():
			if facts_run_id != clock_run_id:
				return {"bound": false, "reason": "run_facts_run_id_mismatch"}
			if facts_run_number > 0 and facts_run_number != clock_run_number:
				return {"bound": false, "reason": "run_facts_run_number_mismatch"}
			return {"bound": true, "reason": ""}
		if facts_run_number > 0:
			if facts_run_number != clock_run_number:
				return {"bound": false, "reason": "run_facts_run_number_mismatch"}
			return {"bound": true, "reason": ""}
		return {"bound": false, "reason": "run_facts_unverified"}
	if not facts_run_id.is_empty() or facts_run_number > 0:
		return {"bound": true, "reason": ""}
	return {"bound": false, "reason": "run_facts_unverified"}


# --- digest acknowledgement (cross-process) ---------------------------------


static func make_unavailable_digest_ack(reason: String) -> Dictionary:
	return {"available": false, "reason": reason, "entries": [], "global_ids": []}


## Owner memory of which return digests were already shown.
##
## A6 only reads it: the player's "Continue" is reported through the layer's
## `digest_dismissed` signal, and A0 decides whether to persist it. That keeps
## acknowledgement out of A6's hands without a second save.
##
## Two forms are accepted, and the owner must pick one deliberately:
##   * `{"run_id": "run-02", "digest_id": "settle-a"}` — run-scoped, the safe form
##     for a reused digest id;
##   * `"globally-unique-id"` — only when the owner guarantees the id is unique
##     across every season.
## A bare id is never treated as implicit per-run scope.
static func sanitize_digest_ack(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_digest_ack("digest_ack_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != DIGEST_ACK_CONTRACT:
		return make_unavailable_digest_ack("digest_ack_contract_mismatch")
	var entries: Array[Dictionary] = []
	var global_ids: Array[String] = []
	var raw_list: Variant = source.get("acknowledged", [])
	if raw_list is Array:
		for entry_value: Variant in raw_list:
			if entry_value is Dictionary:
				var run_id := String((entry_value as Dictionary).get("run_id", "")).strip_edges()
				var digest_id := String((entry_value as Dictionary).get("digest_id", "")).strip_edges()
				if not _is_short_token(run_id) or not _is_short_token(digest_id):
					continue
				entries.append({"run_id": run_id, "digest_id": digest_id})
			elif entry_value is String:
				var global_id := String(entry_value).strip_edges()
				if _is_short_token(global_id) and not global_ids.has(global_id):
					global_ids.append(global_id)
			if entries.size() + global_ids.size() >= 64:
				break
	return {"available": true, "reason": "", "entries": entries, "global_ids": global_ids}


## Stable per-season identity. Two runs may legitimately reuse a digest id, so the
## pair — not the id alone — is what the layer remembers and what A0 acknowledges.
## The separator is a control character so no opaque id can spell a pair by hand.
static func digest_identity(run_id: String, digest_id: String) -> String:
	return "%s\u001f%s" % [run_id, digest_id]


static func is_acknowledged(ack: Dictionary, run_id: String, digest_id: String) -> bool:
	if not bool(ack.get("available", false)):
		return false
	var global_ids: Variant = ack.get("global_ids", [])
	# A bare string is a *globally unique id*, nothing else: it must never be read as
	# a run-scoped pair, or an owner typo would silently acknowledge the wrong season.
	if global_ids is Array:
		if (global_ids as Array).has(digest_id):
			return true
	for entry_value: Variant in ack.get("entries", []):
		if not entry_value is Dictionary:
			continue
		var entry: Dictionary = entry_value
		if String(entry.get("run_id", "")) == run_id and String(entry.get("digest_id", "")) == digest_id:
			return true
	return false


# --- secured account wallet (D056/D064/D066) --------------------------------


static func make_unavailable_wallet(reason: String) -> Dictionary:
	return {
		"available": false,
		"reason": reason,
		"amount": 0,
		"secured": false,
		"provenance": "",
		"revision": "",
	}


## Validates `profile.secured_ragnarok_currency` as projected by its owner. The
## balance is reported, never derived: no sum of chests, no conversion of junk,
## no assumed zero. `secured` says the deposit already happened (D066).
static func sanitize_account_wallet(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_wallet("wallet_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != ACCOUNT_WALLET_CONTRACT:
		return make_unavailable_wallet("wallet_contract_mismatch")
	var provenance := String(source.get("provenance", "")).strip_edges()
	if provenance not in OWNER_PROVENANCES:
		return make_unavailable_wallet("wallet_not_owner_projected")
	var amount_value: Variant = source.get("amount", null)
	if not amount_value is int and not amount_value is float:
		return make_unavailable_wallet("wallet_amount_not_a_number")
	if float(amount_value) < 0.0:
		return make_unavailable_wallet("wallet_amount_negative")
	var amount := int(amount_value)
	# A balance with no currency name cannot be labelled, and a name that reads like
	# a source token is a defect, not a translation (D052).
	var label := String(source.get("currency_label", "")).strip_edges()
	if label.is_empty() or not is_player_facing_text(label, 40):
		return make_unavailable_wallet("wallet_label_unusable")
	return {
		"available": true,
		"reason": "",
		"amount": amount,
		"secured": bool(source.get("secured", false)),
		"currency_label": label,
		"provenance": provenance,
		"revision": String(source.get("revision", "")).strip_edges(),
	}


# --- return digest ----------------------------------------------------------


static func make_unavailable_digest(reason: String) -> Dictionary:
	return {
		"available": false,
		"reason": reason,
		"digest_id": "",
		"run_id": "",
		"identity": "",
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
	# A digest without a run binding cannot be attributed to a season, so a reused
	# id from an older run could be suppressed (or replayed) by mistake. Fail closed.
	var run_id := String(source.get("run_id", "")).strip_edges()
	if not _is_short_token(run_id):
		return make_unavailable_digest("return_digest_run_unbound")
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
		"run_id": run_id,
		"digest_id": digest_id,
		"identity": digest_identity(run_id, digest_id),
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
	# D059 guarantees the 1 HP floor only inside a *physically validated* owned
	# shelter. A boolean flag from a settlement is not proof on its own, so the
	# owner must also assert that its shelter topology validated the room.
	var validated := bool(source.get("shelter_validated", false))
	var hp_floor := bool(source.get("hp_floor", false)) and shelter_kind == "home" and validated
	if consumed <= 0 and not hp_floor:
		return {}
	return {
		"consumed": consumed,
		"shelter": shelter_kind,
		"shelter_validated": validated and shelter_kind == "home",
		"hp_floor": hp_floor,
	}


# --- run history / achievements --------------------------------------------


static func make_unavailable_history(reason: String) -> Dictionary:
	return {"available": false, "reason": reason, "runs": [], "achievements": []}


## D056: completed-run records and account achievements survive a season reset;
## nothing else does. A6 rejects any field that promises gameplay power, because
## a stored bonus would contradict "achievements must not grant advantages".
##
## Order matters: every valid record is collected and sorted by its completion
## date *before* the newest 20 are kept. Truncating first would drop a newer run
## that happened to arrive later in an unsorted owner list.
static func sanitize_run_history(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_history("run_history_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != RUN_HISTORY_CONTRACT:
		return make_unavailable_history("run_history_contract_mismatch")
	var collected: Array[Dictionary] = []
	var raw_runs: Variant = source.get("runs", [])
	if raw_runs is Array:
		for run_value: Variant in raw_runs:
			var record := _sanitize_run_record(run_value)
			if record.is_empty():
				continue
			collected.append(record)
	collected.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("ended_at_unix", 0)) > int(b.get("ended_at_unix", 0)))
	var runs: Array[Dictionary] = []
	for record: Dictionary in collected:
		if runs.size() >= 20:
			break
		runs.append(record)
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


# --- D061 perceived site cues ----------------------------------------------


static func make_unavailable_cues(reason: String) -> Dictionary:
	return {"available": false, "reason": reason, "observed_at_unix": 0, "cues": []}


## Validates the world owner's *perceived* signs.
##
## D061 lets the player check remaining tracks and nearby monsters before logging
## off. It does not grant an omniscient radar, so this schema has no coordinates,
## no distance in metres and no "safe" flag. Each cue carries the perception
## channel that produced it (sight, hearing, physical trace), how old the evidence
## already was when the owner looked, and the freshness window the owner is willing
## to stand behind. A6 drops anything older than that window, so stale evidence can
## never keep looking current.
static func sanitize_site_cues(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return make_unavailable_cues("site_cues_missing")
	var source: Dictionary = raw
	if String(source.get("contract", "")) != SITE_CUES_CONTRACT:
		return make_unavailable_cues("site_cues_contract_mismatch")
	var observed := _as_unix_seconds(source.get("observed_at_unix", null))
	if observed <= 0:
		return make_unavailable_cues("site_cues_timestamp_invalid")
	var cues: Array[Dictionary] = []
	var raw_cues: Variant = source.get("cues", [])
	if raw_cues is Array:
		for cue_value: Variant in raw_cues:
			var cue := _sanitize_cue(cue_value)
			if not cue.is_empty():
				cues.append(cue)
	cues.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("age_seconds", 0)) < int(b.get("age_seconds", 0)))
	var kept: Array[Dictionary] = []
	for cue: Dictionary in cues:
		if kept.size() >= 3:
			break
		kept.append(cue)
	return {"available": true, "reason": "", "observed_at_unix": observed, "cues": kept}


static func _sanitize_cue(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return {}
	var cue: Dictionary = raw
	var channel := String(cue.get("channel", "")).strip_edges().to_lower()
	if channel not in CUE_CHANNELS:
		return {}
	var direction := String(cue.get("direction", "")).strip_edges().to_lower()
	if direction not in CUE_DIRECTIONS:
		direction = ""
	var label := String(cue.get("label", "")).strip_edges()
	if not label.is_empty() and not is_player_facing_text(label, 40):
		label = ""
	var age := _as_non_negative_int(cue.get("age_seconds", -1), -1)
	var ttl := _as_positive_int(cue.get("ttl_seconds", 0), 0)
	if age < 0 or ttl <= 0:
		return {}
	return {
		"channel": channel,
		"direction": direction,
		"label": label,
		"age_seconds": age,
		"ttl_seconds": ttl,
	}


## Age of a cue right now, or -1 when the owner's freshness window has passed.
## Only ages forward: A6 never makes an observation look younger than it was.
static func cue_age_at(cue: Dictionary, observed_at: int, now_unix: int) -> int:
	var age := int(cue.get("age_seconds", -1))
	if age < 0 or observed_at <= 0:
		return -1
	# A sign observed after "now" is impossible chronology, not a fresh sign. The
	# previous clamp to zero made a future timestamp look brand new, so it fails
	# closed until the clocks agree.
	if now_unix < observed_at:
		return -1
	var current := age + (now_unix - observed_at)
	if current > int(cue.get("ttl_seconds", 0)):
		return -1
	return current


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
