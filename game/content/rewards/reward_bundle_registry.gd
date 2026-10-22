@tool
class_name RewardBundleRegistry
extends Resource

## Lookup and validation authority for authored reward bundles.

@export var registry_id: StringName = &"campaign_reward_bundles"
@export var bundles: Array[RewardBundleDefinition] = []

var _bundle_by_id: Dictionary = {}
var _index_ready := false


func rebuild_index() -> void:
	_bundle_by_id.clear()
	for bundle: RewardBundleDefinition in bundles:
		if bundle != null and not _bundle_by_id.has(bundle.bundle_id):
			_bundle_by_id[bundle.bundle_id] = bundle
	_index_ready = true


func find_bundle(bundle_id: StringName) -> RewardBundleDefinition:
	_ensure_index()
	return _bundle_by_id.get(bundle_id) as RewardBundleDefinition


func get_validation_errors() -> PackedStringArray:
	rebuild_index()
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, registry_id, "Reward registry ID")
	var bundle_ids := {}
	var hero_soul_instance_ids := {}
	var auxiliary_equipment_uuids := {}
	for index: int in bundles.size():
		var bundle := bundles[index]
		if bundle == null:
			errors.append("bundles[%d] cannot be null." % index)
			continue
		for child_error: String in bundle.get_validation_errors():
			errors.append("bundles[%d]: %s" % [index, child_error])
		if bundle_ids.has(bundle.bundle_id):
			errors.append("Duplicate reward bundle ID '%s'." % bundle.bundle_id)
		else:
			bundle_ids[bundle.bundle_id] = true
		for grant: Resource in bundle.hero_soul_grants:
			if grant == null or not grant.has_method(&"create_soul_instance"):
				continue
			var soul: Dictionary = grant.call(&"create_soul_instance")
			var instance_id := String(soul.get("instance_id", ""))
			if hero_soul_instance_ids.has(instance_id):
				errors.append("Hero Soul instance ID '%s' is duplicated across reward bundles." % instance_id)
			else:
				hero_soul_instance_ids[instance_id] = String(bundle.bundle_id)
		for grant: Resource in bundle.auxiliary_equipment_grants:
			if grant == null or not grant.has_method(&"create_item_instance"):
				continue
			var item: Dictionary = grant.call(&"create_item_instance")
			var uuid := String(item.get("uuid", ""))
			if auxiliary_equipment_uuids.has(uuid):
				errors.append("Auxiliary-equipment UUID '%s' is duplicated across reward bundles." % uuid)
			else:
				auxiliary_equipment_uuids[uuid] = String(bundle.bundle_id)
	return errors


func _ensure_index() -> void:
	if not _index_ready:
		rebuild_index()
