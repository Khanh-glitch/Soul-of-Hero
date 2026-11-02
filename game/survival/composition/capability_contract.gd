class_name GameplayCapabilityContract
extends RefCounted
## Thin typed read-only composition contract over canonical A3 item definitions.
##
## This is NOT a second item catalog, registry, executor or save authority. It
## only answers: "does this canonical item definition declare a typed capability
## that may act on this resource kind?" The canonical EconomyService and the A0
## survival harvest path both consult this one resolver, so a new tool variant is
## data-only while the closed set of handlers stays in code.
##
## Schema: soh.item.capabilities.v1
##   item_def.capabilities = {
##     "schema": "soh.item.capabilities.v1",
##     "entries": [
##       {"id": "harvest.stone", "handler": "natural_hit",
##        "targets": ["stone_outcrop", "iron_vein"]}
##     ]
##   }
##
## Unknown schema, unknown handler, duplicate id, empty/malformed targets or a
## non-string target fail closed. JSON never supplies scripts, Callables, costs,
## coordinates or authority claims. Legacy items without a capabilities block
## keep their historical behavior through the canonical planner's migration
## fallback; new content must declare capabilities explicitly.

const SCHEMA := "soh.item.capabilities.v1"
const KNOWN_HANDLERS := ["natural_hit"]
const MAX_ENTRIES := 16
const MAX_TARGETS := 32
const MAX_ID_LENGTH := 96


## Returns "" when the definition is valid (including absent capabilities), or a
## stable fail-closed reason. Called by EconomyService.load_catalog so a bad
## catalog cannot enter the queue/planner at all.
static func validate_item(item_def: Dictionary) -> String:
	if not item_def.has("capabilities"):
		return ""
	var raw: Variant = item_def.get("capabilities")
	if not raw is Dictionary:
		return "capabilities_not_object"
	var block: Dictionary = raw
	for key: Variant in block.keys():
		if not String(key) in ["schema", "entries"]:
			return "capabilities_field_unknown"
	if String(block.get("schema", "")) != SCHEMA:
		return "capabilities_schema_mismatch"
	var entries_raw: Variant = block.get("entries", null)
	if not entries_raw is Array:
		return "capabilities_entries_not_array"
	var entries: Array = entries_raw
	if entries.is_empty() or entries.size() > MAX_ENTRIES:
		return "capabilities_entries_count"
	var seen := {}
	for raw_entry: Variant in entries:
		if not raw_entry is Dictionary:
			return "capability_entry_not_object"
		var entry: Dictionary = raw_entry
		for key: Variant in entry.keys():
			if not String(key) in ["id", "handler", "targets"]:
				return "capability_entry_field_unknown"
		var id := String(entry.get("id", ""))
		if id.is_empty() or id.length() > MAX_ID_LENGTH:
			return "capability_id_invalid"
		if seen.has(id):
			return "capability_id_duplicate"
		seen[id] = true
		var handler := String(entry.get("handler", ""))
		if not handler in KNOWN_HANDLERS:
			return "capability_handler_unknown"
		var targets_raw: Variant = entry.get("targets", null)
		if not targets_raw is Array:
			return "capability_targets_not_array"
		var targets: Array = targets_raw
		if targets.is_empty() or targets.size() > MAX_TARGETS:
			return "capability_targets_count"
		var seen_targets := {}
		for raw_target: Variant in targets:
			if not raw_target is String:
				return "capability_target_not_string"
			var target := String(raw_target)
			if target.is_empty() or target.length() > MAX_ID_LENGTH:
				return "capability_target_invalid"
			if seen_targets.has(target):
				return "capability_target_duplicate"
			seen_targets[target] = true
	return ""


## Read-only projection of harvest targets for the closed natural_hit handler.
## Invalid or absent declarations return an empty array (fail closed).
static func harvest_targets(item_def: Dictionary) -> Array[String]:
	var out: Array[String] = []
	if validate_item(item_def) != "" or not item_def.has("capabilities"):
		return out
	var block: Dictionary = item_def["capabilities"]
	for raw_entry: Variant in (block.get("entries", []) as Array):
		var entry: Dictionary = raw_entry
		if String(entry.get("handler", "")) != "natural_hit":
			continue
		for raw_target: Variant in (entry.get("targets", []) as Array):
			var target := String(raw_target)
			if not target in out:
				out.append(target)
	return out


## True when the definition declares the exact capability id with natural_hit.
static func has_capability(item_def: Dictionary, capability_id: String) -> bool:
	if capability_id.is_empty() or validate_item(item_def) != "" or not item_def.has("capabilities"):
		return false
	var block: Dictionary = item_def["capabilities"]
	for raw_entry: Variant in (block.get("entries", []) as Array):
		var entry: Dictionary = raw_entry
		if String(entry.get("id", "")) == capability_id and String(entry.get("handler", "")) == "natural_hit":
			return true
	return false
