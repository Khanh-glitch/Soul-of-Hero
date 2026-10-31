class_name A8RunPhaseProjectionFixture
extends RefCounted

## TEST FIXTURE ONLY. It is not A0 and never advances or persists a run clock.

const PHASE_DATA_PATH := "res://data/survival/world_content/site_phase_transformations.v1.json"


static func project(
	site_definition: Dictionary,
	phase_id: String = "ordinary",
	elapsed_real_hours: float = 0.0,
	projection_revision: int = 1,
	run_id: String = "fixture-run-1",
	run_epoch: int = 1,
	include_site_effect: bool = true
) -> Dictionary:
	var source: Dictionary = site_definition.get("source", {})
	var poi_id := str(source.get("poi_id", ""))
	var world_id := str(source.get("world_id", ""))
	var effects: Array[String] = []
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(PHASE_DATA_PATH))
	if parsed is Dictionary:
		for phase_value: Variant in parsed.get("phase_schedule", []):
			if phase_value is Dictionary and str(phase_value.get("phase_id", "")) == phase_id:
				var global_effect_value: Variant = phase_value.get("phase_effect_id", "")
				var global_effect := (
					str(global_effect_value) if typeof(global_effect_value) == TYPE_STRING else ""
				)
				if not global_effect.is_empty():
					effects.append(global_effect)
		for site_value: Variant in parsed.get("physical_site_profiles", []):
			if not site_value is Dictionary or str(site_value.get("poi_id", "")) != poi_id:
				continue
			var profile: Dictionary = site_value.get("phase_profiles", {}).get(phase_id, {})
			var site_effect_value: Variant = profile.get("effect_id", "")
			var site_effect := (
				str(site_effect_value) if typeof(site_effect_value) == TYPE_STRING else ""
			)
			if include_site_effect and not site_effect.is_empty():
				effects.append(site_effect)
			break
	return {
		"contract_id": "soh.a0.run_phase_projection.v1",
		"projection_authority": "A0.RunLifecycle",
		"world_id": world_id,
		"poi_id": poi_id,
		"site_instance_id": "%s@%s" % [poi_id, run_id],
		"run_id": run_id,
		"run_epoch": run_epoch,
		"projection_revision": projection_revision,
		"elapsed_real_hours": elapsed_real_hours,
		"phase_id": phase_id,
		"active_effect_ids": effects,
		"environment": {"weather": "unknown", "tide": "unknown"}
	}
