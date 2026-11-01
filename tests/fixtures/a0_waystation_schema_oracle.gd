extends RefCounted
## Test-only partial V3 diagnostic. It does not alter production data and
## does NOT establish validity for every other save section or native consumer.
## The original strict whole-document assertions must remain in place.
## JSON int/float transitions are allowed only when lossless and V3's persisted
## owner schema explicitly permits them. Native item quantities and revision
## still require int after SaveService preparation. Never use for host receipts.
const Diff = preload("res://tests/fixtures/a0_save_diff.gd")
const WorldSources = preload("res://game/survival/economy/world_source_adapter.gd")
const LIMIT := 9007199254740992

static func _safe_numbers(value: Variant) -> bool:
	if value is int:
		return value >= -LIMIT and value <= LIMIT
	if value is float:
		return is_finite(value) and absf(value) <= float(LIMIT)
	if value is Array:
		for child: Variant in value:
			if not _safe_numbers(child): return false
	if value is Dictionary:
		for key: Variant in value:
			if not _safe_numbers(key) or not _safe_numbers(value[key]): return false
	return true

static func valid(snapshot: Variant, bindings: Dictionary, raw_json := false) -> bool:
	if not snapshot is Dictionary or not _safe_numbers(snapshot): return false
	var doc: Dictionary = snapshot
	if not doc.get("inventory") is Dictionary or not doc.get("applied_transactions") is Dictionary:
		return false
	var revision: Variant = doc.get("revision")
	if raw_json:
		if not (revision is float or revision is int) or float(revision) < 0 or floor(float(revision)) != float(revision): return false
	elif not revision is int or revision < 0:
		return false
	var world: Variant = doc.get("world_slice")
	if not world is Dictionary or not WorldSources.state_error(world, bindings).is_empty(): return false
	var poi: Variant = world.get("pois", {}).get("poi_crown_waystation", {})
	if not poi is Dictionary or not poi.get("reward_receipts") is Dictionary: return false
	for key: Variant in poi.reward_receipts:
		if not key is String or not poi.reward_receipts[key] is String: return false
	var stacks: Variant = doc.inventory.get("item_stacks")
	if not stacks is Dictionary: return false
	for key: Variant in stacks:
		if not key is String or not stacks[key] is Dictionary: return false
		var record: Dictionary = stacks[key]
		var qty: Variant = record.get("quantity")
		if raw_json:
			if not (qty is int or qty is float) or float(qty) < 1 or floor(float(qty)) != float(qty): return false
		elif not qty is int or qty < 1:
			return false
		if not record.get("kind") is String: return false
	for key: Variant in doc.applied_transactions:
		if not key is String or not doc.applied_transactions[key] is Dictionary: return false
		if not doc.applied_transactions[key].get("metadata") is Dictionary: return false
	return true

static func equivalent(before: Variant, after: Variant, bindings: Dictionary, after_raw := false) -> bool:
	if not valid(before, bindings) or not valid(after, bindings, after_raw): return false
	for difference: String in Diff.collect(before, after):
		if not difference.begins_with("TYPE "): return false
	return true
