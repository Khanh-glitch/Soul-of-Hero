extends SceneTree
## Definition validation only. Not a physical source host or gameplay proof.
const Guard := preload("res://game/survival/economy/source_binding_guard.gd")
const Custody := preload("res://game/survival/economy/a3_economy_service.gd")
var failures := 0

func _initialize() -> void:
	_check(Guard.validate_file(Custody.BINDINGS_PATH) == "", "current pinned A3 document accepted")
	_check(Guard.validate_file("res://tests/survival/no_such_bindings.json") == "source_bindings_missing", "missing document")
	_check(Guard.validate_document(null) == "source_bindings_invalid_document", "invalid JSON result")
	var data := {"schema": Guard.SCHEMA, "bindings": [{"binding_id": "source.a"}, {"binding_id": "source.b"}]}
	_check(Guard.validate_document(data) == "", "two distinct definitions")
	var duplicate := data.duplicate(true)
	duplicate.bindings[1].binding_id = "source.a"
	_check(Guard.validate_document(duplicate) == "source_binding_duplicate_id:source.a", "duplicate cannot overwrite first binding")
	var wrong_version := data.duplicate(true)
	wrong_version.schema = "soh.economy.world_source_bindings.v4"
	_check(Guard.validate_document(wrong_version) == "source_bindings_schema_mismatch", "unknown schema fails closed")
	_check(Guard.validate_document({"schema": Guard.SCHEMA, "bindings": []}) == "source_bindings_empty_or_invalid", "empty catalog")
	_check(Guard.validate_document({"schema": Guard.SCHEMA, "bindings": [null]}) == "source_binding_invalid_entry", "non-dictionary entry")
	_check(Guard.validate_document({"schema": Guard.SCHEMA, "bindings": [{"binding_id": " "}]}) == "source_binding_invalid_id", "blank id")
	_check(Guard.validate_document({"schema": Guard.SCHEMA, "bindings": [{"binding_id": " x"}]}) == "source_binding_invalid_id", "ambiguous whitespace")
	if failures == 0:
		print("SOURCE BINDING GUARD PASSED")
		quit(0)
	else:
		print("SOURCE BINDING GUARD FAILED: %d" % failures)
		quit(1)

func _check(ok: bool, label: String) -> void:
	if not ok:
		failures += 1
		print("  FAIL  ", label)
	else:
		print("  ok    ", label)
