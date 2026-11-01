extends RefCounted
## C08 WIP evidence index, not yet mounted in gameplay or persisted.
## Callers own the clock, run identity, surface and movement sampling. This is
## deliberately not a second SaveService or an authority on weather/lifetime.

const BUCKET_SIZE := 64.0
const MAX_TRACES := 2048
const MAX_LOCAL_QUERY_RADIUS := 128.0

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


## Feed actual adjacent physics samples only. The caller must set eligible false
## for death, interior transitions, missing surfaces, or any untrusted motion.
## A gap, clock rollback or implausible movement breaks the causal chain.
## Lifetime/spacing are explicit inputs, not invented terrain/weather rules.
func sample(position: Vector2, stamp: float, surface: String, eligible: bool,
		spacing: float, lifetime: float, max_step: float) -> int:
	if _run_id.is_empty() or not eligible or surface.is_empty() or spacing <= 0.0 or lifetime <= 0.0 or max_step <= 0.0:
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


## Return nearby candidates only; caller must additionally check physics LOS.
func nearby(position: Vector2, radius: float, stamp: float) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if radius < 0.0 or radius > MAX_LOCAL_QUERY_RADIUS:
		return result
	var low := _bucket(position - Vector2.ONE * radius)
	var high := _bucket(position + Vector2.ONE * radius)
	for y in range(low.y, high.y + 1):
		for x in range(low.x, high.x + 1):
			for id in _buckets.get(Vector2i(x, y), []):
				if _is_live(id, stamp) and position.distance_to(_records[id].position) <= radius:
					result.append(_records[id].duplicate())
	return result


## A valid successor must be the actual causal next link, never a nearest trace.
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


func _is_live(id: int, stamp: float) -> bool:
	return id != 0 and _records.has(id) and stamp >= float(_records[id].created) and stamp < float(_records[id].expires)


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
