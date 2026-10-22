@tool
class_name ContentId
extends RefCounted

## Shared identifier policy for authored content resources.
##
## IDs are stable save/reference keys, not display text. They use lower_snake_case,
## begin with an ASCII letter, and never contain paths, spaces, or punctuation.


static func is_valid(value: StringName) -> bool:
	var text := String(value)
	if text.is_empty():
		return false
	var previous_was_underscore := false
	for index: int in text.length():
		var code := text.unicode_at(index)
		var is_lower_letter := code >= 97 and code <= 122
		var is_digit := code >= 48 and code <= 57
		if index == 0:
			if not is_lower_letter:
				return false
		elif not is_lower_letter and not is_digit and code != 95:
			return false
		if code == 95:
			if previous_was_underscore:
				return false
			previous_was_underscore = true
		else:
			previous_was_underscore = false
	return not previous_was_underscore


static func validation_error(value: StringName, field_name: String) -> String:
	if String(value).is_empty():
		return "%s is required." % field_name
	return "%s '%s' must use lower_snake_case, begin with a letter, and avoid repeated or trailing underscores." % [field_name, value]


## Durable transaction keys use the existing SaveService namespace convention:
## one or more strict content-ID segments separated by colons.
static func is_valid_transaction_key(value: StringName) -> bool:
	var segments := String(value).split(":", true)
	if segments.is_empty():
		return false
	for segment: String in segments:
		if not is_valid(StringName(segment)):
			return false
	return true


static func append_if_invalid_transaction_key(
		errors: PackedStringArray,
		value: StringName,
		field_name: String
) -> void:
	if is_valid_transaction_key(value):
		return
	if String(value).is_empty():
		errors.append("%s is required." % field_name)
	else:
		errors.append("%s '%s' must use colon-separated lower_snake_case segments." % [field_name, value])


static func append_if_invalid(errors: PackedStringArray, value: StringName, field_name: String) -> void:
	if not is_valid(value):
		errors.append(validation_error(value, field_name))


static func append_duplicate_or_invalid_ids(
		errors: PackedStringArray,
		values: PackedStringArray,
		field_name: String
) -> void:
	var seen := {}
	for raw_value: String in values:
		var value := StringName(raw_value)
		append_if_invalid(errors, value, field_name)
		if seen.has(value):
			errors.append("%s contains duplicate ID '%s'." % [field_name, value])
		else:
			seen[value] = true
