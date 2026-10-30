extends RefCounted
## Test-only, bounded field-level diagnostics. Does not decide the test result.
## JSON numbers and native integers are reported separately even when equal in
## numeric value; actual missing keys and value changes are never suppressed.
const MAX_LINES := 16

static func report(label: String, before: Variant, after: Variant) -> void:
	var differences := collect(before, after)
	var value_count := 0
	var type_count := 0
	for item: String in differences:
		if item.begins_with("TYPE "):
			type_count += 1
		else:
			value_count += 1
	print("A0_SAVE_DIFF %s values=%d types=%d" % [label, value_count, type_count])
	# Report value differences first so a large number of integer/float pairs
	# cannot obscure a changed item, receipt, structure, or missing key.
	var emitted := 0
	for kind: String in ["VALUE ", "TYPE "]:
		for item: String in differences:
			if item.begins_with(kind) and emitted < MAX_LINES:
				print("A0_SAVE_DIFF %s %s" % [label, item])
				emitted += 1

static func report_all(label: String, before: Variant, after: Variant) -> void:
	## Unbounded forensic log for the small fixture save; report() stays bounded.
	var differences := collect(before, after)
	var value_count := 0
	var type_count := 0
	for item: String in differences:
		if item.begins_with("TYPE "): type_count += 1
		else: value_count += 1
	print("A0_SAVE_DIFF %s values=%d types=%d" % [label, value_count, type_count])
	for item: String in differences:
		print("A0_SAVE_DIFF %s %s" % [label, item])

static func collect(before: Variant, after: Variant) -> Array[String]:
	var differences: Array[String] = []
	_walk("$", before, after, differences)
	return differences

static func _walk(path: String, before: Variant, after: Variant, out: Array[String]) -> void:
	if before is Dictionary and after is Dictionary:
		var left := before as Dictionary
		var right := after as Dictionary
		for key: Variant in left:
			var child := path + "." + str(key)
			if not right.has(key):
				out.append("VALUE %s missing_after before=%s" % [child, var_to_str(left[key])])
			else:
				_walk(child, left[key], right[key], out)
		for key: Variant in right:
			if not left.has(key):
				out.append("VALUE %s.%s missing_before after=%s" % [path, str(key), var_to_str(right[key])])
		return
	if before is Array and after is Array:
		var left := before as Array
		var right := after as Array
		if left.size() != right.size():
			out.append("VALUE %s size %d -> %d" % [path, left.size(), right.size()])
		for index in range(mini(left.size(), right.size())):
			_walk("%s[%d]" % [path, index], left[index], right[index], out)
		return
	if typeof(before) != typeof(after):
		if (before is int and after is float) or (before is float and after is int):
			# Equality is exact, not an approximate comparison. Godot JSON loses
			# integer precision past 2^53, so label those as values, not type-only.
			var integer: int = before if before is int else after
			var number: float = after if after is float else before
			if integer >= -9007199254740992 and integer <= 9007199254740992 and is_finite(number) and number == float(integer):
				out.append("TYPE %s %s:%s -> %s:%s" % [path, type_string(typeof(before)), var_to_str(before), type_string(typeof(after)), var_to_str(after)])
				return
		out.append("VALUE %s %s:%s -> %s:%s" % [path, type_string(typeof(before)), var_to_str(before), type_string(typeof(after)), var_to_str(after)])
	elif before != after:
		out.append("VALUE %s %s -> %s" % [path, var_to_str(before), var_to_str(after)])

static func read_json(path: String) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var result: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return result
