class_name A6ItemIcons
extends RefCounted

## Item id -> authored icon, read from the import receipt rather than a second list.
##
## The receipt (`assets/a6_ui/PROVENANCE.json`) is written by
## tools/import_a6_ui_art.py and carries, per icon, the source pack, the immutable
## commit, the member name inside the ZIP and the digest of the file on disk. Loading
## it at runtime means the UI can never bind a picture that the importer did not
## produce, and a missing icon is a *reported* missing icon instead of a wrong one.
##
## `texture_for()` returns null when there is no honest picture for an id. Callers
## must then show the item's name and no icon - a plausible-looking wrong sprite is
## worse than an empty slot, because it teaches the player the wrong material.
##
## This class owns no game state. It reads files and hands back textures.

const RECEIPT_PATH := "res://assets/a6_ui/PROVENANCE.json"

static var _by_id: Dictionary = {}
static var _loaded := false


static func _load() -> void:
	if _loaded:
		return
	_loaded = true
	if not FileAccess.file_exists(RECEIPT_PATH):
		# The receipt is committed with the art, so a missing one means the import
		# step never ran. Report it once; every lookup then returns null.
		push_warning("A6ItemIcons: %s is missing - rebuild with tools/import_a6_ui_art.py" % RECEIPT_PATH)
		return
	var handle := FileAccess.open(RECEIPT_PATH, FileAccess.READ)
	if handle == null:
		return
	var parsed: Variant = JSON.parse_string(handle.get_as_text())
	handle.close()
	if not parsed is Dictionary:
		return
	var assets: Variant = (parsed as Dictionary).get("assets", [])
	if not assets is Array:
		return
	for entry_value: Variant in assets:
		if not entry_value is Dictionary:
			continue
		var entry: Dictionary = entry_value
		if String(entry.get("kind", "")) != "icon":
			continue
		var id := String(entry.get("id", ""))
		var path := String(entry.get("output", ""))
		if id.is_empty() or path.is_empty() or not ResourceLoader.exists(path):
			continue
		_by_id[id] = path


## Whether an authored icon exists for this item id.
static func has_icon(item_id: String) -> bool:
	_load()
	return _by_id.has(item_id)


## The icon, or null when the packs have nothing honest for this id.
static func texture_for(item_id: String) -> Texture2D:
	_load()
	var path: Variant = _by_id.get(item_id, null)
	if path == null:
		return null
	return load(String(path)) as Texture2D


## Every id with an icon. Used by the tests and by the review sheet so "which items
## have real art" is answerable without reading the importer.
static func known_ids() -> Array[String]:
	_load()
	var ids: Array[String] = []
	for key: Variant in _by_id.keys():
		ids.append(String(key))
	ids.sort()
	return ids


## The provenance of one icon, for the evidence sheet. Empty when unknown.
static func provenance(item_id: String) -> Dictionary:
	_load()
	if not FileAccess.file_exists(RECEIPT_PATH):
		return {}
	var handle := FileAccess.open(RECEIPT_PATH, FileAccess.READ)
	if handle == null or not _by_id.has(item_id):
		return {}
	var parsed: Variant = JSON.parse_string(handle.get_as_text())
	handle.close()
	if not parsed is Dictionary:
		return {}
	var assets: Variant = (parsed as Dictionary).get("assets", [])
	if not assets is Array:
		return {}
	for entry_value: Variant in assets:
		if entry_value is Dictionary and String((entry_value as Dictionary).get("id", "")) == item_id:
			return entry_value as Dictionary
	return {}


## Clears the cache. Only tests need this, when they run after a re-import.
static func reset_cache() -> void:
	_by_id.clear()
	_loaded = false
