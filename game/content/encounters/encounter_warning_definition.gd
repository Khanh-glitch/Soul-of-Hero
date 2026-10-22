@tool
class_name EncounterWarningDefinition
extends Resource

## Presentation contract for a readable warning. Scope and target ID connect a
## cue to the encounter, a wave, a group, or an objective without node paths.

enum Scope {
	ENCOUNTER,
	WAVE,
	GROUP,
	OBJECTIVE,
}

@export var warning_id: StringName
@export var scope := Scope.ENCOUNTER
@export var target_id: StringName
@export var message_key: String
@export_range(0.0, 30.0, 0.05) var lead_seconds := 0.75
@export_range(0.05, 30.0, 0.05) var visible_seconds := 1.0
@export var telegraph_style_id: StringName = &"standard"
@export var audio_cue_id: StringName


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, warning_id, "Encounter warning ID")
	if message_key.strip_edges().is_empty():
		errors.append("Encounter warning message key is required.")
	if lead_seconds < 0.0 or visible_seconds <= 0.0:
		errors.append("Encounter warning timing must have a non-negative lead and positive visible duration.")
	ContentId.append_if_invalid(errors, telegraph_style_id, "Warning telegraph style ID")
	if not audio_cue_id.is_empty():
		ContentId.append_if_invalid(errors, audio_cue_id, "Warning audio cue ID")
	match scope:
		Scope.ENCOUNTER:
			if not target_id.is_empty():
				errors.append("Encounter-scoped warning must not set target_id.")
		Scope.WAVE, Scope.GROUP, Scope.OBJECTIVE:
			ContentId.append_if_invalid(errors, target_id, "Warning target ID")
		_:
			errors.append("Encounter warning scope is not supported.")
	return errors
