@tool
class_name GameplayTuningSchema
extends RefCounted

const RULES := {
	"player": {
		"move_speed": [1.0, 600.0, false],
		"crouch_speed": [1.0, 600.0, false],
		"acceleration": [1.0, 5000.0, false],
		"friction": [1.0, 5000.0, false],
		"dash_speed": [1.0, 1200.0, false],
		"dash_duration": [0.05, 5.0, false],
		"dash_cooldown": [0.0, 10.0, false],
		"roll_speed": [1.0, 1200.0, false],
		"roll_duration": [0.05, 5.0, false],
		"slide_speed": [1.0, 1200.0, false],
		"slide_duration": [0.05, 5.0, false],
		"hop_speed": [1.0, 1200.0, false],
		"hop_duration": [0.05, 5.0, false],
		"hop_height": [0.0, 128.0, false],
		"max_health": [1.0, 9999.0, true],
		"max_stamina": [1.0, 2000.0, false],
		"stamina_regen": [0.0, 2000.0, false],
	},
	"combat": {
		"light_damage": [0.0, 9999.0, true],
		"heavy_damage": [0.0, 9999.0, true],
		"crouch_damage": [0.0, 9999.0, true],
		"combo_reset_time": [0.05, 10.0, false],
		"hit_invulnerability": [0.0, 10.0, false],
	},
}


static func validate_document(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Gameplay tuning must be a JSON object.")
	var document: Dictionary = value
	for section_name: String in RULES:
		if not document.get(section_name) is Dictionary:
			return _failure("%s must be an object." % section_name)
		var result := validate_patch(section_name, document[section_name], true)
		if not bool(result.get("ok", false)):
			return result
	for raw_section: Variant in document:
		if not RULES.has(str(raw_section)):
			return _failure("Unknown tuning section: %s." % raw_section)
	return {"ok": true}


static func validate_patch(section_name: String, value: Variant, require_all := false) -> Dictionary:
	if not RULES.has(section_name):
		return _failure("section must be player or combat.")
	if not value is Dictionary:
		return _failure("values must be an object.")
	var values: Dictionary = value
	var rules: Dictionary = RULES[section_name]
	if values.is_empty():
		return _failure("values cannot be empty.")
	if require_all:
		for field_name: String in rules:
			if not values.has(field_name):
				return _failure("%s.%s is required." % [section_name, field_name])
	for raw_field: Variant in values:
		var field_name := str(raw_field)
		if not rules.has(field_name):
			return _failure("Unknown tuning field: %s.%s." % [section_name, field_name])
		var number_value: Variant = values[raw_field]
		if not (number_value is int or number_value is float) or not is_finite(float(number_value)):
			return _failure("%s.%s must be a finite number." % [section_name, field_name])
		var rule: Array = rules[field_name]
		var numeric := float(number_value)
		if bool(rule[2]) and numeric != floor(numeric):
			return _failure("%s.%s must be an integer." % [section_name, field_name])
		if numeric < float(rule[0]) or numeric > float(rule[1]):
			return _failure("%s.%s must be between %s and %s." % [section_name, field_name, rule[0], rule[1]])
	return {"ok": true}


static func _failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}
