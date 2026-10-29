class_name VenomPilotEvents
extends RefCounted

## Ordered, field-level comparison of authored event logs for the pilot.
##
## Same rules as `gold93_venom_differential_test.gd` (`_compare_events`,
## `_canon`, `_round_event`, `_norm`), copied rather than imported because the
## differential is a test script, not a library. Two logs match only when they
## have the same length AND every event matches at the same index on every
## field (count, order and value). Nothing here is tolerant: the only rounding
## is the precision the oracle recorded the value at.


## Order-insensitive canonical rendering of a value (dictionary keys sorted),
## so the same content with a different insertion order still compares equal.
static func canon(v) -> String:
	if v is Dictionary:
		var d: Dictionary = v
		var keys: Array = d.keys()
		keys.sort()
		var parts: Array = []
		for k in keys:
			parts.append("%s=%s" % [str(k), canon(d[k])])
		return "{" + ",".join(parts) + "}"
	if v is Array:
		var a: Array = v
		var parts2: Array = []
		for e in a:
			parts2.append(canon(e))
		return "[" + ",".join(parts2) + "]"
	if typeof(v) == TYPE_FLOAT:
		return "%.6f" % [float(v)]
	if v == null:
		return "null"
	return str(v)


## Compares two authored event logs element by element.
## Returns [matched: bool, detail: String].
static func compare(exp: Array, got: Array) -> Array:
	if exp.size() != got.size():
		return [false, "count: original=%d native=%d  (original_tail=%s native_tail=%s)"
				% [exp.size(), got.size(),
					canon(exp[exp.size() - 1]) if exp.size() else "-",
					canon(got[got.size() - 1]) if got.size() else "-"]]
	for i in range(exp.size()):
		var a: String = canon(round_event(exp[i]))
		var b: String = canon(round_event(got[i]))
		if a != b:
			return [false, "event %d:\n      original=%s\n      native  =%s" % [i, a, b]]
	return [true, ""]


## JSON carries every number as a float, so an integral id read from the oracle
## arrives as 13.0 while the native log holds the int 13. Both are snapped to the
## recorded precision and integral values are normalised to ints.
static func round_event(e: Dictionary) -> Dictionary:
	var o: Dictionary = {}
	for k in e.keys():
		o[k] = norm(e[k])
	return o


static func norm(v):
	if typeof(v) == TYPE_FLOAT:
		var f: float = snappedf(float(v), 1e-6)
		if absf(f - roundf(f)) < 1e-9:
			return int(roundf(f))
		return f
	if v is Array:
		var a: Array = []
		for x in v:
			a.append(norm(x))
		return a
	if v is Dictionary:
		var d: Dictionary = {}
		for k in v.keys():
			d[k] = norm(v[k])
		return d
	return v
