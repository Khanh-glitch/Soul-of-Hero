class_name NativePoiVectors
extends RefCounted

## Godot 4.7 has no Vector2.from_array constructor. Parse source-backed JSON
## pairs explicitly and reject malformed, non-numeric, or non-finite components.


static func from_pair(value: Variant, fallback: Vector2 = Vector2.ZERO) -> Vector2:
	if not value is Array or value.size() != 2:
		return fallback
	if not _is_number(value[0]) or not _is_number(value[1]):
		return fallback
	var x := float(value[0])
	var y := float(value[1])
	if not is_finite(x) or not is_finite(y):
		return fallback
	return Vector2(x, y)


static func from_int_pair(value: Variant, fallback: Vector2i = Vector2i.ZERO) -> Vector2i:
	if not value is Array or value.size() != 2:
		return fallback
	if not _is_number(value[0]) or not _is_number(value[1]):
		return fallback
	var x := float(value[0])
	var y := float(value[1])
	if not is_finite(x) or not is_finite(y) or floorf(x) != x or floorf(y) != y:
		return fallback
	return Vector2i(int(x), int(y))


static func _is_number(value: Variant) -> bool:
	return typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT
