extends RefCounted
class_name A3EconomyService

## R13 A3 value-economy layer: physical source custody + reverse-use discovery
## + measured route projections, composed ON TOP OF the canonical A3 V5-V7
## EconomyService. It deliberately owns NO queue, NO clock and NO second
## knowledge store.
##
## Authority map (see docs/survival/economy/A0_ADOPTION_CONTRACT_V2.md):
##   * inventory / durable transactions  -> A0 SaveService.transact_once
##   * station queue, escrow, maturity   -> canonical EconomyService
##                                          (enqueue / advance / collect / cancel)
##   * recipe knowledge (3 mechanisms)   -> canonical EconomyService.research_recipe
##                                          (blueprint / specimen / targeted) stored in
##                                          survival.knowledge.recipes
##   * physical source identity          -> A1 pinned bindings
##                                          (data/survival/items/world_source_bindings.v3.json)
##                                          verified through an injected A0/A1 host receipt
##   * active-session clock              -> the A0 time receipt carried by the source
##                                          receipt and by EconomyService.advance()
##
## Removed in R13-A3-CLOSE (predecessor commit b751a29f kept them):
##   mastery.a3_station_jobs / mastery.a3_job_counter / mastery.a3_learned_recipes
##   set_time_source(Callable)  ->  no A3 clock exists any more.
## A ghost queue, a parallel learned-recipe map and a fake "now" cannot be
## reconciled with A0; they were the audit's duplicate-authority finding.

const BINDINGS_PATH := "res://data/survival/items/world_source_bindings.v3.json"
const A8_AUTHORIZATION_PATH := "res://docs/survival/economy/A8_QUARRY_AUTHORIZATION_V4.json"

## The only receipt a source host may return. A bare owner string such as "A1"
## is not authentication and is not accepted anywhere in this file.
const SOURCE_RECEIPT_CONTRACT := "soh.economy.source_receipt.v1"
const SOURCE_RECEIPT_FIELDS := [
	"contract", "source_id", "owner", "poi_id", "instance_id", "action_id",
	"binding_identity", "host_session_id", "host_sequence", "hero_cell",
	"discovered", "active_seconds", "a8_authorization_sha256",
]

## A3-owned SaveService mastery namespace. Display/durability only: it never
## authorises an item grant on its own.
const KEY_SOURCE_RECEIPTS := "a3_source_receipts"
const KEY_DISCOVERIES := "a3_discoveries"

## Claim receipts live in SaveService.applied_transactions so A0 can count them
## even after a process restart. The prefix is part of the public contract.
const CLAIM_TX_PREFIX := "soh.a3.source_claim."

## Canonical world-action receipts. If A0 has already settled a physical claim
## for the same POI action through canonical world_action, A3 must refuse to
## settle it a second time.
const CANONICAL_WORLD_TX_PREFIX := "soh.a3.world_action."

const TOOL_WEAR_PER_CLAIM := 20
const DEFAULT_MAX_CONDITION := 100

## A8 Quarry seam. Kept closed by the pinned authorization document, not by a
## string comparison and not by a flag in this file.
const A8_QUARRY_POI_ID := "poi_crown_south_quarry"

var save: Node = null
var economy = null
var source_host: Callable = Callable()
var bindings: Dictionary = {}
var bindings_sha256: String = ""
var a8_status: String = "UNREAD"
var a8_sha256: String = ""
var last_error: String = ""

func configure(save_node: Node, economy_service = null) -> bool:
	last_error = ""
	if save_node == null or not save_node.has_method(&"transact_once") \
			or not save_node.has_method(&"get_snapshot") \
			or not save_node.has_method(&"add_items_to_candidate"):
		last_error = "incompatible_save_service"
		return false
	save = save_node
	economy = economy_service
	if not _load_bindings():
		return false
	if not _load_a8_authorization():
		return false
	return true

## A0/A1 composition root only. The host is a pure read of the authoritative
## active-session state (discovery, stand cell, elapsed active seconds). A3
## re-calls it on every authentication so a caller-supplied dictionary can
## never mint a source.
func configure_source_host(host: Callable) -> bool:
	source_host = host if host.is_valid() else Callable()
	return true

func _load_bindings() -> bool:
	var file := FileAccess.open(BINDINGS_PATH, FileAccess.READ)
	if file == null:
		last_error = "missing_world_source_bindings"
		return false
	var text := file.get_as_text()
	file.close()
	bindings_sha256 = text.sha256_text()
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		last_error = "invalid_world_source_bindings"
		return false
	var document: Dictionary = parsed
	var raw: Variant = document.get("bindings", [])
	if not raw is Array:
		last_error = "invalid_world_source_bindings"
		return false
	var loaded: Dictionary = {}
	for entry: Variant in (raw as Array):
		if not entry is Dictionary:
			last_error = "invalid_world_source_bindings"
			return false
		var binding: Dictionary = entry
		var binding_id := String(binding.get("binding_id", ""))
		if binding_id.is_empty():
			last_error = "invalid_world_source_bindings"
			return false
		loaded[binding_id] = binding.duplicate(true)
	if loaded.is_empty():
		last_error = "empty_world_source_bindings"
		return false
	bindings = loaded
	return true

## Reads the pinned A8 verdict. Any future approval must be a new document SHA;
## a matching SHA is recorded in the authentication receipt so product audit can
## prove which A8 verdict authorised a Quarry claim.
func _load_a8_authorization() -> bool:
	var file := FileAccess.open(A8_AUTHORIZATION_PATH, FileAccess.READ)
	if file == null:
		a8_status = "MISSING_FAIL_CLOSED"
		a8_sha256 = ""
		return true
	var text := file.get_as_text()
	file.close()
	a8_sha256 = text.sha256_text()
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		a8_status = "INVALID_FAIL_CLOSED"
		return true
	a8_status = String((parsed as Dictionary).get("status", "INVALID_FAIL_CLOSED"))
	return true

func bindings_document_sha256() -> String:
	return bindings_sha256

func a8_authorization() -> Dictionary:
	return {"status": a8_status, "sha256": a8_sha256, "approved": a8_status.begins_with("APPROVED")}

func source_ids() -> Array[String]:
	var ids: Array[String] = []
	var raw_keys: Array = bindings.keys()
	raw_keys.sort()
	for raw: Variant in raw_keys:
		ids.append(String(raw))
	return ids

func binding_for(source_id: String) -> Dictionary:
	var raw: Variant = bindings.get(source_id, {})
	if raw is Dictionary:
		return (raw as Dictionary).duplicate(true)
	return {}

func _binding_identity(binding: Dictionary) -> String:
	return String(binding.get("identity", ""))

## A receipt is only valid when it is field-for-field what the injected A0/A1
## host returns right now. There is no path that derives authentication from a
## caller-chosen owner string.
func _host_receipt(source_id: String) -> Dictionary:
	if not source_host.is_valid():
		return {}
	var value: Variant = source_host.call(source_id)
	if not value is Dictionary:
		return {}
	var receipt: Dictionary = value
	if String(receipt.get("contract", "")) != SOURCE_RECEIPT_CONTRACT:
		return {}
	if String(receipt.get("source_id", "")) != source_id:
		return {}
	return _normalize_source_receipt(receipt)

## JSON has no integer type, so an A1 host that reads its own pinned document
## hands back `406.0` where the binding says `406`. Normalising at the boundary
## keeps number equality honest instead of loosening it, and it is applied to
## both the caller receipt and the live host answer before they are compared.
func _normalize_cell(raw: Variant) -> Array:
	if not raw is Array or (raw as Array).size() != 2:
		return []
	var cell: Array = raw
	var parts: Array = []
	for part: Variant in cell:
		if part is int:
			parts.append(int(part))
		elif part is float and float(part) == float(int(part)):
			parts.append(int(part))
		else:
			return []
	return parts

func _normalize_source_receipt(raw: Dictionary) -> Dictionary:
	var receipt: Dictionary = raw.duplicate(true)
	var cell: Array = _normalize_cell(receipt.get("hero_cell", null))
	if not cell.is_empty():
		receipt["hero_cell"] = cell
	for field: Variant in ["host_sequence", "active_seconds"]:
		var value: Variant = receipt.get(String(field), null)
		if value is float and float(value) == float(int(value)):
			receipt[String(field)] = int(value)
	return receipt

func _receipt_shape_error(receipt: Dictionary) -> String:
	## Missing fields are reported first: an empty dictionary or an owner string
	## must fail as "not a receipt", never as a shape mismatch an attacker could
	## "fix" by adding noise fields.
	for field: Variant in SOURCE_RECEIPT_FIELDS:
		if not receipt.has(String(field)):
			return "SOURCE_RECEIPT_MISSING_FIELD"
	if receipt.size() != SOURCE_RECEIPT_FIELDS.size():
		return "SOURCE_RECEIPT_UNKNOWN_FIELDS"
	for field: Variant in ["contract", "source_id", "owner", "poi_id", "instance_id", "action_id", "binding_identity"]:
		if not receipt[field] is String:
			return "SOURCE_RECEIPT_NOT_STRING"
	if not receipt["host_session_id"] is String:
		return "SOURCE_RECEIPT_NOT_STRING"
	if not receipt["a8_authorization_sha256"] is String:
		return "SOURCE_RECEIPT_NOT_STRING"
	if not receipt["discovered"] is bool:
		return "SOURCE_RECEIPT_NOT_BOOL"
	for field: Variant in ["host_sequence", "active_seconds"]:
		if not receipt[field] is int:
			return "SOURCE_RECEIPT_NOT_INT"
		if int(receipt[field]) < 0:
			return "SOURCE_RECEIPT_NOT_INT"
	var cell: Variant = receipt["hero_cell"]
	if not cell is Array or (cell as Array).size() != 2:
		return "SOURCE_RECEIPT_BAD_CELL"
	for part: Variant in (cell as Array):
		if not part is int:
			return "SOURCE_RECEIPT_BAD_CELL"
	return ""

## Verify the receipt against the pinned A1 binding, the live host, the A8
## verdict and the A0 clock. Returns {ok, reason, binding, receipt}.
func verify_source_receipt(raw_receipt: Dictionary) -> Dictionary:
	last_error = ""
	var receipt := _normalize_source_receipt(raw_receipt)
	var shape := _receipt_shape_error(receipt)
	if not shape.is_empty():
		last_error = shape
		return {"ok": false, "reason": shape}
	var source_id := String(receipt.get("source_id", ""))
	var binding := binding_for(source_id)
	if binding.is_empty():
		last_error = "UNKNOWN_SOURCE_BINDING"
		return {"ok": false, "reason": "UNKNOWN_SOURCE_BINDING"}
	var identity := _binding_identity(binding)
	if identity.is_empty():
		last_error = "BINDING_IDENTITY_MISSING"
		return {"ok": false, "reason": "BINDING_IDENTITY_MISSING"}
	if String(receipt.get("binding_identity", "")) != identity:
		last_error = "BINDING_IDENTITY_MISMATCH"
		return {"ok": false, "reason": "BINDING_IDENTITY_MISMATCH"}
	for pair: Variant in [["poi_id", "poi_id"], ["instance_id", "instance_id"], ["action_id", "action_id"]]:
		var field := String((pair as Array)[0])
		if String(receipt.get(field, "")) != String(binding.get(field, "")):
			last_error = "BINDING_FIELD_MISMATCH:" + field
			return {"ok": false, "reason": "BINDING_FIELD_MISMATCH:" + field}
	## Consistency check, not authentication: the owner must be exactly the A1
	## source class pinned for this binding. A bare domain string such as "A1"
	## is refused, and this check can never be the reason a grant exists — the
	## live host equality below is.
	var expected_owner := String(binding.get("a1_source_class_id", ""))
	if expected_owner.is_empty():
		last_error = "BINDING_OWNER_MISSING"
		return {"ok": false, "reason": "BINDING_OWNER_MISSING"}
	if String(receipt.get("owner", "")) != expected_owner:
		last_error = "OWNER_DOMAIN_REJECTED"
		return {"ok": false, "reason": "OWNER_DOMAIN_REJECTED"}
	## Physical reach: the hero must stand on a cell A1 authored for this binding.
	var cell: Array = receipt.get("hero_cell", [])
	if not _cell_allowed(binding, cell):
		last_error = "OUT_OF_RANGE"
		return {"ok": false, "reason": "OUT_OF_RANGE"}
	if not bool(receipt.get("discovered", false)):
		last_error = "NOT_DISCOVERED"
		return {"ok": false, "reason": "NOT_DISCOVERED"}
	if String(receipt.get("poi_id", "")) == A8_QUARRY_POI_ID:
		last_error = "A8_QUARRY_NOT_AUTHORIZED"
		return {"ok": false, "reason": "A8_QUARRY_NOT_AUTHORIZED"}
	## Live host equality: the receipt must be the host's current answer, not a
	## caller-constructed dictionary.
	var host := _host_receipt(source_id)
	if host.is_empty():
		last_error = "SOURCE_HOST_UNAVAILABLE"
		return {"ok": false, "reason": "SOURCE_HOST_UNAVAILABLE"}
	for field: Variant in SOURCE_RECEIPT_FIELDS:
		var key := String(field)
		if receipt.get(key) != host.get(key):
			last_error = "SOURCE_RECEIPT_MISMATCH:" + key
			return {"ok": false, "reason": "SOURCE_RECEIPT_MISMATCH:" + key}
	return {"ok": true, "reason": "", "binding": binding, "receipt": receipt.duplicate(true)}

func _cell_allowed(binding: Dictionary, cell: Array) -> bool:
	var allowed: Variant = binding.get("stand_cells", [])
	if not allowed is Array or (allowed as Array).is_empty():
		return false
	for entry: Variant in (allowed as Array):
		if not entry is Array or (entry as Array).size() != 2:
			continue
		var pair: Array = entry
		if int(pair[0]) == int(cell[0]) and int(pair[1]) == int(cell[1]):
			return true
	return false

## Persist a verified source receipt through A0. The durable record stores the
## binding identity and the binding-document SHA, so a later change to A1's
## pinned data invalidates it instead of silently widening custody.
func authenticate_source(receipt: Dictionary) -> Dictionary:
	if save == null:
		return {"ok": false, "reason": "NOT_CONFIGURED"}
	var verified := verify_source_receipt(receipt)
	if not bool(verified.get("ok", false)):
		return {"ok": false, "reason": String(verified.get("reason", "SOURCE_REJECTED"))}
	var source_id := String(receipt.get("source_id", ""))
	var binding: Dictionary = verified["binding"]
	var identity := _binding_identity(binding)
	var tx_key := "soh.a3.source_auth.%s.%s" % [
		source_id, String(receipt.get("host_session_id", "")).md5_text(),
	]
	var mutator := func(candidate: Dictionary) -> bool:
		var mastery: Dictionary = _mastery_from(candidate)
		var records: Dictionary = mastery.get(KEY_SOURCE_RECEIPTS, {})
		if not records is Dictionary:
			records = {}
		records[source_id] = {
			"source_id": source_id,
			"binding_identity": identity,
			"bindings_sha256": bindings_sha256,
			"a1_transaction_key_template": String(binding.get("transaction_key_template", "")),
			"host_session_id": String(receipt.get("host_session_id", "")),
			"host_sequence": int(receipt.get("host_sequence", 0)),
			"active_seconds": int(receipt.get("active_seconds", 0)),
			"hero_cell": (receipt.get("hero_cell", []) as Array).duplicate(),
			"verified_at_unix": int(Time.get_unix_time_from_system()),
		}
		mastery[KEY_SOURCE_RECEIPTS] = records
		candidate["mastery"] = mastery
		return true
	if bool(save.call(&"is_transaction_applied", tx_key)):
		return {
			"ok": true,
			"reason": "",
			"source_id": source_id,
			"binding_identity": identity,
			"transaction_key": tx_key,
			"duplicate": true,
		}
	var applied := bool(save.call(&"transact_once", tx_key, mutator,
		{"kind": "a3_authenticate_source", "source": source_id, "binding_identity": identity}))
	if not applied:
		last_error = "AUTH_TRANSACTION_REJECTED"
		return {"ok": false, "reason": "AUTH_TRANSACTION_REJECTED"}
	return {
		"ok": true,
		"reason": "",
		"source_id": source_id,
		"binding_identity": identity,
		"transaction_key": tx_key,
	}

## Durable custody lookup. Fails closed when the binding document SHA moved
## (A1 re-pinned data) or when nothing was ever authenticated.
func is_source_authenticated(source_id: String) -> bool:
	if save == null:
		return false
	var binding := binding_for(source_id)
	if binding.is_empty():
		return false
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var mastery: Dictionary = _mastery_from(snapshot)
	var raw_records: Variant = mastery.get(KEY_SOURCE_RECEIPTS, {})
	if not raw_records is Dictionary:
		return false
	var records: Dictionary = raw_records
	var raw_record: Variant = records.get(source_id, {})
	if not raw_record is Dictionary:
		return false
	var record: Dictionary = raw_record
	if String(record.get("bindings_sha256", "")) != bindings_sha256:
		return false
	return String(record.get("binding_identity", "")) == _binding_identity(binding)

func source_auth_record(source_id: String) -> Dictionary:
	if save == null:
		return {}
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var mastery: Dictionary = _mastery_from(snapshot)
	var raw_records: Variant = mastery.get(KEY_SOURCE_RECEIPTS, {})
	if not raw_records is Dictionary:
		return {}
	var raw: Variant = (raw_records as Dictionary).get(source_id, {})
	if not raw is Dictionary:
		return {}
	return (raw as Dictionary).duplicate(true)

func claims_used(source_id: String) -> int:
	if save == null:
		return 0
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var transactions: Dictionary = _transactions_from(snapshot)
	var prefix := CLAIM_TX_PREFIX + source_id + "."
	var count := 0
	for raw_key: Variant in transactions.keys():
		if String(raw_key).begins_with(prefix):
			count += 1
	return count

func claims_remaining(source_id: String) -> int:
	var binding := binding_for(source_id)
	if binding.is_empty():
		return 0
	var max_claims := int(binding.get("max_claims", 0))
	if max_claims <= 0:
		return -1  ## renewable
	return maxi(0, max_claims - claims_used(source_id))

func last_claim_active_seconds(source_id: String) -> int:
	if save == null:
		return -1
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var transactions: Dictionary = _transactions_from(snapshot)
	var prefix := CLAIM_TX_PREFIX + source_id + "."
	var best := -1
	for raw_key: Variant in transactions.keys():
		if not String(raw_key).begins_with(prefix):
			continue
		var entry: Variant = transactions[raw_key]
		if not entry is Dictionary:
			continue
		var meta_raw: Variant = (entry as Dictionary).get("metadata", {})
		if not meta_raw is Dictionary:
			continue
		var meta: Dictionary = meta_raw
		best = maxi(best, int(meta.get("active_seconds", -1)))
	return best

## True when canonical world_action already settled this POI action. A3 must not
## create a second claim path for the same physical source.
func canonical_world_claim_exists(poi_id: String, action_id: String) -> bool:
	if save == null:
		return false
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var transactions: Dictionary = _transactions_from(snapshot)
	for raw_key: Variant in transactions.keys():
		if not String(raw_key).begins_with(CANONICAL_WORLD_TX_PREFIX):
			continue
		var entry: Variant = transactions[raw_key]
		if not entry is Dictionary:
			continue
		var meta_raw: Variant = (entry as Dictionary).get("metadata", {})
		if not meta_raw is Dictionary:
			continue
		var meta: Dictionary = meta_raw
		if String(meta.get("poi_id", "")) == poi_id and String(meta.get("action_id", "")) == action_id:
			return true
	return false

## Cooldown readiness derived from A0's active-session clock in the receipt.
func cooldown_remaining(source_id: String, active_seconds: int) -> int:
	var binding := binding_for(source_id)
	if binding.is_empty():
		return -1
	var cooldown := int(binding.get("cooldown_active_seconds", 0))
	if cooldown <= 0:
		return 0
	var last := last_claim_active_seconds(source_id)
	if last < 0:
		return 0
	return maxi(0, (last + cooldown) - active_seconds)

## Atomic physical claim: tool wear + A1 rewards in ONE SaveService transaction.
## Fails closed on: unknown binding, unverified receipt, exhausted one-time
## source, active-session cooldown, broken/absent tool, double settlement with
## canonical world_action, and a full bag.
func harvest(source_id: String, tool_instance_id: String, receipt: Dictionary) -> Dictionary:
	if save == null:
		return {"ok": false, "reason": "NOT_CONFIGURED"}
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	var verified := verify_source_receipt(receipt)
	if not bool(verified.get("ok", false)):
		return {"ok": false, "reason": String(verified.get("reason", "SOURCE_REJECTED"))}
	if String(receipt.get("source_id", "")) != source_id:
		return {"ok": false, "reason": "SOURCE_ID_MISMATCH"}
	if not is_source_authenticated(source_id):
		return {"ok": false, "reason": "SOURCE_NOT_AUTHENTICATED"}
	var binding: Dictionary = verified["binding"]
	var poi_id := String(binding.get("poi_id", ""))
	var action_id := String(binding.get("action_id", ""))
	if canonical_world_claim_exists(poi_id, action_id):
		return {"ok": false, "reason": "SOURCE_SETTLED_BY_CANONICAL_WORLD_ACTION"}

	var max_claims := int(binding.get("max_claims", 0))
	var used := claims_used(source_id)
	if max_claims > 0 and used >= max_claims:
		return {"ok": false, "reason": "SOURCE_EXHAUSTED"}
	var active_seconds := int(receipt.get("active_seconds", 0))
	var remaining_cooldown := cooldown_remaining(source_id, active_seconds)
	if remaining_cooldown > 0:
		return {"ok": false, "reason": "SOURCE_COOLDOWN", "remaining_active_seconds": remaining_cooldown}

	var tool := instance_record(tool_instance_id)
	if tool.is_empty():
		return {"ok": false, "reason": "TOOL_NOT_OWNED"}
	if int(tool.get("condition", 0)) <= 0:
		return {"ok": false, "reason": "TOOL_BROKEN"}

	var claim_index := used + 1
	var transaction_key := "%s%s.%d" % [CLAIM_TX_PREFIX, source_id, claim_index]
	var rewards := _binding_rewards(binding)
	if rewards.is_empty():
		return {"ok": false, "reason": "BINDING_HAS_NO_REWARDS"}

	var mutator := func(candidate: Dictionary) -> bool:
		var state: Dictionary = _economy_state_from(candidate)
		var instances: Dictionary = state.get("instances", {})
		if not instances is Dictionary:
			return false
		var records: Dictionary = instances
		var raw_tool: Variant = records.get(tool_instance_id, {})
		if not raw_tool is Dictionary:
			return false
		var tool_record: Dictionary = (raw_tool as Dictionary).duplicate(true)
		var current := int(tool_record.get("condition", 0))
		if current <= 0:
			return false
		tool_record["condition"] = maxi(0, current - TOOL_WEAR_PER_CLAIM)
		tool_record["revision"] = int(tool_record.get("revision", 0)) + 1
		records[tool_instance_id] = tool_record
		state["instances"] = records
		candidate["survival_economy"] = state
		for raw_reward: Variant in rewards:
			if not raw_reward is Dictionary:
				return false
			var reward: Dictionary = raw_reward
			var item_id := String(reward.get("item_id", ""))
			var quantity := int(reward.get("quantity", 0))
			if item_id.is_empty() or quantity <= 0:
				return false
			if not bool(save.call(&"add_items_to_candidate", candidate, item_id,
					_stack_kind(item_id), quantity,
					{"source": "a3_source", "source_id": source_id, "binding_identity": _binding_identity(binding)})):
				return false
		return true

	var applied := bool(save.call(&"transact_once", transaction_key, mutator, {
		"kind": "a3_source_claim",
		"source_id": source_id,
		"poi_id": poi_id,
		"action_id": action_id,
		"binding_identity": _binding_identity(binding),
		"bindings_sha256": bindings_sha256,
		"a1_transaction_key_template": String(binding.get("transaction_key_template", "")),
		"a1_transaction_key": String(binding.get("transaction_key_template", "")).replace("{claim_index}", str(claim_index)),
		"active_seconds": active_seconds,
		"host_session_id": String(receipt.get("host_session_id", "")),
	}))
	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	var remaining_tool := instance_record(tool_instance_id)
	var output := {
		"ok": true,
		"reason": "",
		"source_id": source_id,
		"binding_identity": _binding_identity(binding),
		"rewards": rewards,
		"tool_condition_remaining": int(remaining_tool.get("condition", 0)),
		"claims_used": claim_index,
		"claims_remaining": -1 if max_claims <= 0 else maxi(0, max_claims - claim_index),
		"cooldown_active_seconds": int(binding.get("cooldown_active_seconds", 0)),
		"transaction_key": transaction_key,
	}
	return output

func _binding_rewards(binding: Dictionary) -> Array:
	var raw: Variant = binding.get("rewards", [])
	if not raw is Array:
		return []
	var rewards: Array = []
	for entry: Variant in (raw as Array):
		if not entry is Dictionary:
			continue
		var reward: Dictionary = entry
		rewards.append({
			"item_id": String(reward.get("item_id", "")),
			"quantity": int(reward.get("quantity", 0)),
			"a1_source_id": String(reward.get("source_id", "")),
		})
	return rewards

func instance_record(instance_id: String) -> Dictionary:
	if save == null:
		return {}
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var state := _economy_state_from(snapshot)
	var raw_instances: Variant = state.get("instances", {})
	if not raw_instances is Dictionary:
		return {}
	var raw: Variant = (raw_instances as Dictionary).get(instance_id, {})
	if not raw is Dictionary:
		return {}
	return (raw as Dictionary).duplicate(true)

func _stack_kind(item_id: String) -> String:
	if economy != null:
		var definition: Dictionary = economy.item(item_id)
		var kind := String(definition.get("kind", "material"))
		if kind in ["material", "consumable", "blueprint", "key_item"]:
			return kind
	return "material"

## --- Canonical knowledge (three mechanisms, one store) ---

## Blueprint-directed research: a physical plan item teaches its recipe.
func research_blueprint(recipe_id: String, station_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.research_recipe(recipe_id, station_id, "blueprint", event_id, "")

## Destructive specimen research: the physical instance is consumed.
func research_specimen(recipe_id: String, specimen_instance_id: String, station_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.research_recipe(recipe_id, station_id, "specimen", event_id, specimen_instance_id)

## Targeted research: paid in physical knowledge materials.
func research_targeted(recipe_id: String, station_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.research_recipe(recipe_id, station_id, "targeted", event_id, "")

func is_recipe_known(recipe_id: String) -> bool:
	if economy == null:
		return false
	return bool(economy.known(recipe_id))

## Technology research is canonical too: A3 exposes it so the destructive
## specimen path can be gated by the real prerequisite chain.
func research_technology(technology_id: String, station_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.research_technology(technology_id, station_id, event_id)

func knows_technology(technology_id: String) -> bool:
	if economy == null:
		return false
	return bool(economy.knows_technology(technology_id))

## --- Canonical paid production (one queue, one clock) ---

func prepare_at_station(recipe_id: String, station_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.enqueue(recipe_id, station_id, event_id)

## Maturity is A0's active-session receipt, never a caller-supplied "now".
func advance_station(station_id: String, time_receipt: Dictionary, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.advance(station_id, time_receipt, event_id)

func claim_production(job_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.collect(job_id, event_id)

func cancel_production(job_id: String, event_id: String) -> Dictionary:
	if economy == null:
		return {"ok": false, "reason": "CANONICAL_ECONOMY_REQUIRED"}
	return economy.cancel(job_id, event_id)

func job(job_id: String) -> Dictionary:
	if economy == null:
		return {}
	var jobs: Dictionary = economy.jobs()
	var raw: Variant = jobs.get(job_id, {})
	if not raw is Dictionary:
		return {}
	return (raw as Dictionary).duplicate(true)

func jobs() -> Dictionary:
	if economy == null:
		return {}
	return economy.jobs()

## --- Reverse-use discovery (A3-owned display knowledge, not authority) ---

func register_discovery(material_id: String, use_description: String, recipe_id: String, event_id: String) -> Dictionary:
	if save == null:
		return {"ok": false, "reason": "NOT_CONFIGURED"}
	if material_id.is_empty() or use_description.is_empty():
		return {"ok": false, "reason": "INVALID_DISCOVERY"}
	var tx_key := "soh.a3.discovery.%s" % [event_id.sha256_text()]
	var mutator := func(candidate: Dictionary) -> bool:
		var mastery: Dictionary = _mastery_from(candidate)
		var discoveries: Dictionary = mastery.get(KEY_DISCOVERIES, {})
		if not discoveries is Dictionary:
			discoveries = {}
		discoveries[material_id] = {
			"use_description": use_description,
			"recipe_id": recipe_id,
			"discovered_at_unix": int(Time.get_unix_time_from_system()),
		}
		mastery[KEY_DISCOVERIES] = discoveries
		candidate["mastery"] = mastery
		return true
	var applied := bool(save.call(&"transact_once", tx_key, mutator, {"kind": "a3_discovery", "material": material_id}))
	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}
	return {"ok": true, "reason": "", "material_id": material_id, "recipe_id": recipe_id}

func lookup_use(material_id: String) -> Dictionary:
	var raw: Variant = _discoveries().get(material_id, {})
	if not raw is Dictionary:
		return {}
	return (raw as Dictionary).duplicate(true)

func is_discovered(material_id: String) -> bool:
	return _discoveries().has(material_id)

func _discoveries() -> Dictionary:
	if save == null:
		return {}
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var mastery := _mastery_from(snapshot)
	var raw: Variant = mastery.get(KEY_DISCOVERIES, {})
	if not raw is Dictionary:
		return {}
	return (raw as Dictionary).duplicate(true)

## --- Measured route comparison (read-only) ---

## Two genuinely competitive routes over the same finite A1 supply:
##  MATERIAL_ROUTE  bulk roadside salvage -> ordinary fragments -> Core Blank
##  KNOWLEDGE_ROUTE sparse notes/spares    -> researched recipe  -> consumables
## Costs are read from the canonical catalog so they cannot drift from the
## queue that actually charges them.
func route_comparison() -> Dictionary:
	var routes: Dictionary = {}
	routes["MATERIAL_ROUTE"] = _route_projection(
		["process_roadside_materials", "sort_core_fragments"],
		["a1_waystation_roadside_cache_v3", "a1_roadside_salvage_02_v5"],
		"ordinary_stack_material",
		"tool_upgrade_and_core_blank_chain")
	routes["KNOWLEDGE_ROUTE"] = _route_projection(
		["field_meal", "minor_salve"],
		["a1_roadside_notes_01_v4", "a1_roadside_timber_03_v5"],
		"recipe_knowledge",
		"survival_consumables_and_research_depth")
	return {
		"routes": routes,
		"sources": _source_route_supply(),
		"skill_core_distinction": skill_core_distinction(),
	}

func _route_projection(recipe_ids: Array, source_ids: Array, payoff_class: String, next_opportunity: String) -> Dictionary:
	var steps: Array = []
	var total_duration := 0
	var total_fuel: Dictionary = {}
	var total_inputs: Dictionary = {}
	var knowledge_required := 0
	for raw_id: Variant in recipe_ids:
		var recipe_id := String(raw_id)
		var recipe := {}
		if economy != null:
			recipe = economy.recipe(recipe_id)
		if recipe.is_empty():
			continue
		var duration := int(recipe.get("duration_ticks", 0))
		total_duration += duration
		var fuel_raw: Variant = recipe.get("fuel", {})
		if fuel_raw is Dictionary:
			for key: Variant in (fuel_raw as Dictionary).keys():
				total_fuel[String(key)] = int(total_fuel.get(String(key), 0)) + int((fuel_raw as Dictionary)[key])
		var inputs_raw: Variant = recipe.get("inputs", {})
		if inputs_raw is Dictionary:
			for key: Variant in (inputs_raw as Dictionary).keys():
				total_inputs[String(key)] = int(total_inputs.get(String(key), 0)) + int((inputs_raw as Dictionary)[key])
		if String(recipe.get("knowledge", "")) == "recipe":
			knowledge_required += 1
		steps.append({
			"recipe_id": recipe_id,
			"station": String(recipe.get("station", "")),
			"min_tier": int(recipe.get("min_tier", 0)),
			"duration_ticks": duration,
			"inputs": (inputs_raw as Dictionary).duplicate(true) if inputs_raw is Dictionary else {},
			"fuel": (fuel_raw as Dictionary).duplicate(true) if fuel_raw is Dictionary else {},
			"knowledge_required": String(recipe.get("knowledge", "")),
		})
	var supply: Array = []
	for raw_source: Variant in source_ids:
		var source_id := String(raw_source)
		var binding := binding_for(source_id)
		if binding.is_empty():
			continue
		supply.append({
			"source_id": source_id,
			"max_claims": int(binding.get("max_claims", 0)),
			"cooldown_active_seconds": int(binding.get("cooldown_active_seconds", 0)),
			"claims_remaining": claims_remaining(source_id),
			"rewards": _binding_rewards(binding),
		})
	return {
		"steps": steps,
		"total_duration_ticks": total_duration,
		"total_inputs": total_inputs,
		"total_fuel": total_fuel,
		"recipes_requiring_research": knowledge_required,
		"finite_supply": supply,
		"payoff_class": payoff_class,
		"next_player_opportunity": next_opportunity,
	}

func _source_route_supply() -> Dictionary:
	var result: Dictionary = {}
	for source_id: String in source_ids():
		var binding := binding_for(source_id)
		result[source_id] = {
			"binding_identity": _binding_identity(binding),
			"poi_id": String(binding.get("poi_id", "")),
			"instance_id": String(binding.get("instance_id", "")),
			"action_id": String(binding.get("action_id", "")),
			"max_claims": int(binding.get("max_claims", 0)),
			"cooldown_active_seconds": int(binding.get("cooldown_active_seconds", 0)),
			"claims_used": claims_used(source_id),
			"claims_remaining": claims_remaining(source_id),
			"requires_capabilities": binding.get("requires_capabilities", []),
			"authenticated": is_source_authenticated(source_id),
			"rewards": _binding_rewards(binding),
		}
	return result

## Ordinary stackable material vs scarce physical finite-use Skill Core.
func skill_core_distinction() -> Dictionary:
	var ordinary: Dictionary = {}
	var cores: Array = []
	if economy != null:
		var definition: Dictionary = economy.item("quarry_core_fragment")
		if not definition.is_empty():
			ordinary = {
				"item_id": "quarry_core_fragment",
				"storage": String(definition.get("storage", "")),
				"kind": String(definition.get("kind", "")),
				"stack_limit": int(definition.get("stack_limit", 0)),
				"has_instance_identity": false,
				"has_finite_uses": false,
				"can_cast": false,
			}
		for raw: Variant in (economy.owned_instances() as Array):
			if not raw is Dictionary:
				continue
			var record: Dictionary = raw
			var item_definition: Dictionary = economy.item(String(record.get("item_id", "")))
			if String(item_definition.get("kind", "")) != "skill_core":
				continue
			cores.append({
				"instance_id": String(record.get("instance_id", "")),
				"item_id": String(record.get("item_id", "")),
				"uses": int(record.get("uses", 0)),
				"max_uses": int(record.get("max_uses", 0)),
				"condition": int(record.get("condition", 0)),
			})
	return {
		"ordinary_material": ordinary,
		"physical_skill_cores": cores,
		"rule": "Only an instance-backed skill_core with finite uses is a Skill Core; quarry_core_fragment is an ordinary stack material.",
	}

## Read-only projection for A6. No mutation.
func get_projections() -> Dictionary:
	return {
		"bindings_sha256": bindings_sha256,
		"a8_authorization": a8_authorization(),
		"sources": _source_route_supply(),
		"discoveries": _discoveries(),
		"route_comparison": route_comparison(),
		"queue_authority": "canonical_economy_service",
		"knowledge_authority": "canonical_economy_service",
		"clock_authority": "a0_active_session_receipt",
	}

## --- Internal helpers ---

func _mastery_from(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get("mastery", {})
	if raw is Dictionary:
		return (raw as Dictionary).duplicate(true)
	return {}

func _transactions_from(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get("applied_transactions", {})
	if raw is Dictionary:
		return raw as Dictionary
	return {}

func _economy_state_from(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get("survival_economy", {})
	if raw is Dictionary:
		return (raw as Dictionary).duplicate(true)
	return {}

func get_save() -> Node:
	return save

func get_economy():
	return economy
