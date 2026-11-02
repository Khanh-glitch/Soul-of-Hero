extends RefCounted
## Read-only guard for A3's existing source-binding document. It creates no
## definitions, receipts or authority. In particular it cannot authenticate a
## source: only the A1/A0 live host and A3 custody may do that.
##
## A3's pinned loader currently indexes by binding_id with last-write-wins.
## Reject duplicates before that loader can silently replace a definition.

const SCHEMA := "soh.economy.world_source_bindings.v3"

static func validate_file(path: String) -> String:
	if not FileAccess.file_exists(path):
		return "source_bindings_missing"
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return validate_document(parsed)


static func validate_document(document: Variant) -> String:
	if not document is Dictionary:
		return "source_bindings_invalid_document"
	var data: Dictionary = document
	if data.get("schema") != SCHEMA:
		return "source_bindings_schema_mismatch"
	var entries: Variant = data.get("bindings")
	if not entries is Array or (entries as Array).is_empty():
		return "source_bindings_empty_or_invalid"
	var seen: Dictionary = {}
	for raw: Variant in entries:
		if not raw is Dictionary:
			return "source_binding_invalid_entry"
		var id: Variant = (raw as Dictionary).get("binding_id")
		if not id is String or (id as String).strip_edges().is_empty() or (id as String) != (id as String).strip_edges():
			return "source_binding_invalid_id"
		if seen.has(id):
			return "source_binding_duplicate_id:" + String(id)
		seen[id] = true
	return ""
