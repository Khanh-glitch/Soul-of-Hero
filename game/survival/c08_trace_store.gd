extends RefCounted
## C08 evidence index: bounded, run-local footprints with a causal next-link.
##
## This is NOT a second SaveService, a clock, a weather model or a rule authority.
## The caller owns every input that has meaning:
##
##   * `stamp`      — seconds on the run clock (K8), never a local timer;
##   * `run_id`     — the authoritative run identity, so a record can never be
##                    read by a different run;
##   * `surface`    — the authored K2 surface identity, never an invented biome;
##   * `spacing`    — travelled distance between two successive records;
##   * `lifetime`   — how long the physical mark survives, again owner-supplied;
##   * `eligible`   — whether the motion is trusted at all (alive, exterior,
##                    real surface). An ineligible sample breaks the chain.
##
## The store adds the one thing the prototype got wrong: a successor is the
## record's own causal next link (`previous` back-reference checked both ways),
## never "the newest trace that happens to be near". A broken chain therefore
## stays broken instead of bridging two unrelated journeys.
##
## WIP review (LW1 takeover) — concrete defects fixed here, all covered by
## `tests/c08_trace_store_unit_test.gd`:
##   1. `sample()` accepted non-finite numbers; `Vector2(NAN, NAN)` corrupted the
##      spatial bucket key (floori(NAN)) and poisoned every later query.
##   2. `nearby()` returned bucket insertion order, so a follower could pick an
##      arbitrary link; it now returns newest-first with a hard result cap.
##   3. `_is_live()` did not re-check the record's `run_id`, so a record that
##      survived an eviction race could be read by a new run.
##   4. Dead records were only dropped by eviction; `prune()` now reclaims them,
##      and `live_count()` answers from the live set only.
##   5. Records were unreachable by id, so a follower could not prove which link
##      it had actually reached; `trace()` and `is_live()` expose that.

const BUCKET_SIZE := 64.0
const MAX_TRACES := 2048
const MAX_LOCAL_QUERY_RADIUS := 128.0
## A monster answers from a bounded local query, so the query result is capped.
const MAX_QUERY_RESULTS := 32

var _records: Dictionary = {}
var _buckets: Dictionary = {}
var _order: Array[int] = []
var _next_id := 1
var _last_id := 0
var _run_id := ""
var _previous_position := Vector2.ZERO
var _sampled := false
var _last_stamp := -1.0
var _distance_since_trace := 0.0


func reset(run_id: String) -> void:
	_records.clear()
	_buckets.clear()
	_order.clear()
	_next_id = 1
	_last_id = 0
	_run_id = run_id
	_sampled = false
	_last_stamp = -1.0
	_distance_since_trace = 0.0
	_previous_position = Vector2.ZERO


func run_id() -> String:
	return _run_id


## Feed actual adjacent physics samples only.
##
## Returns the id of the record just written, or 0 when the sample produced no
## new evidence (too short a step, first sample, or a refused sample). A gap, a
## clock rollback, a run change or an implausible step breaks the causal chain
## so that the next record starts a new one.
func sample(position: Vector2, stamp: float, surface: String, eligible: bool,
		spacing: float, lifetime: float, max_step: float) -> int:
	if _run_id.is_empty() or not eligible or surface.is_empty() \
			or not _is_usable(position) or not is_finite(stamp) \
			or not is_finite(spacing) or spacing <= 0.0 \
			or not is_finite(lifetime) or lifetime <= 0.0 \
			or not is_finite(max_step) or max_step <= 0.0:
		_break_chain()
		return 0
	if not _sampled:
		_previous_position = position
		_last_stamp = stamp
		_sampled = true
		return 0
	var step := position.distance_to(_previous_position)
	if stamp < _last_stamp or step > max_step:
		_break_chain()
		_previous_position = position
		_last_stamp = stamp
		_sampled = true
		return 0
	_previous_position = position
	_last_stamp = stamp
	_distance_since_trace += step
	if _distance_since_trace < spacing:
		return 0
	_distance_since_trace = 0.0
	var id := _next_id
	_next_id += 1
	# The previous record is the causal parent only while it is still evidence.
	# An expired parent means the player's trail went cold and a new chain starts
	# here — never a link that quietly skips the gap.
	var prev := _last_id if _is_live(_last_id, stamp) else 0
	var record := {"id": id, "run_id": _run_id, "position": position,
		"surface": surface, "created": stamp, "expires": stamp + lifetime,
		"previous": prev, "next": 0}
	_records[id] = record
	if prev != 0:
		_records[prev]["next"] = id
	_last_id = id
	_order.append(id)
	var key := _bucket(position)
	if not _buckets.has(key):
		_buckets[key] = []
	_buckets[key].append(id)
	while _order.size() > MAX_TRACES:
		_remove(_order.pop_front())
	return id


## Local candidates only, newest first, capped. The caller must still check
## physical line of sight and whether the mark is reachable for its own body.
func nearby(position: Vector2, radius: float, stamp: float) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not _is_usable(position) or not is_finite(radius) or not is_finite(stamp):
		return result
	if radius < 0.0 or radius > MAX_LOCAL_QUERY_RADIUS:
		return result
	var low := _bucket(position - Vector2.ONE * radius)
	var high := _bucket(position + Vector2.ONE * radius)
	var found: Array[int] = []
	for y in range(low.y, high.y + 1):
		for x in range(low.x, high.x + 1):
			var bucket: Variant = _buckets.get(Vector2i(x, y), null)
			if not bucket is Array:
				continue
			for raw_id: Variant in bucket:
				var id := int(raw_id)
				if _is_live(id, stamp) and position.distance_to(_records[id].position) <= radius:
					found.append(id)
	# Newest first: the most recent physical evidence is the strongest lead. The
	# ordering is explicit so a follower can never pick a stale link by accident.
	found.sort_custom(func(a: int, b: int) -> bool: return a > b)
	for id: int in found:
		if result.size() >= MAX_QUERY_RESULTS:
			break
		result.append((_records[id] as Dictionary).duplicate())
	return result


## A valid successor is the record's actual causal next link: it must be live, in
## this run, and point back at `id`. Anything else is no evidence at all.
func successor(id: int, stamp: float) -> Dictionary:
	if not _is_live(id, stamp):
		return {}
	var next_id := int(_records[id].next)
	if not _is_live(next_id, stamp):
		return {}
	var next: Dictionary = _records[next_id]
	if int(next.previous) != id or String(next.run_id) != _run_id:
		return {}
	return next.duplicate()


func trace(id: int, stamp: float) -> Dictionary:
	if not _is_live(id, stamp):
		return {}
	return (_records[id] as Dictionary).duplicate()


func is_live(id: int, stamp: float) -> bool:
	return _is_live(id, stamp)


func live_count(stamp: float) -> int:
	var count := 0
	for id: int in _records.keys():
		if _is_live(id, stamp):
			count += 1
	return count


func total_count() -> int:
	return _records.size()


func last_id() -> int:
	return _last_id


## Live records, newest first, capped. Presentation and evidence only.
func records(stamp: float, limit: int = 64) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if limit <= 0 or not is_finite(stamp):
		return out
	var ids: Array[int] = []
	for id: int in _records.keys():
		if _is_live(id, stamp):
			ids.append(id)
	ids.sort_custom(func(a: int, b: int) -> bool: return a > b)
	for id: int in ids:
		if out.size() >= limit:
			break
		out.append((_records[id] as Dictionary).duplicate())
	return out


## Reclaim expired records. Purely memory housekeeping: expiry is decided by the
## caller's clock at read time, so forgetting a dead record changes no answer.
func prune(stamp: float) -> int:
	if not is_finite(stamp):
		return 0
	var dropped := 0
	var keep: Array[int] = []
	for id: int in _order:
		if _is_live(id, stamp):
			keep.append(id)
		else:
			_remove(id)
			dropped += 1
	_order = keep
	return dropped


func _is_live(id: int, stamp: float) -> bool:
	if id == 0 or not _records.has(id) or not is_finite(stamp):
		return false
	var record: Dictionary = _records[id]
	if String(record.run_id) != _run_id:
		return false
	return stamp >= float(record.created) and stamp < float(record.expires)


func _is_usable(position: Vector2) -> bool:
	return is_finite(position.x) and is_finite(position.y)


func _bucket(position: Vector2) -> Vector2i:
	return Vector2i(floori(position.x / BUCKET_SIZE), floori(position.y / BUCKET_SIZE))


func _break_chain() -> void:
	_last_id = 0
	_sampled = false
	_distance_since_trace = 0.0


func _remove(id: int) -> void:
	if not _records.has(id):
		return
	var record: Dictionary = _records[id]
	var key := _bucket(record.position)
	if _buckets.has(key):
		_buckets[key].erase(id)
		if _buckets[key].is_empty():
			_buckets.erase(key)
	_records.erase(id)
