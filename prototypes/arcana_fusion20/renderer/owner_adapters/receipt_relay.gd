## Isolated AVFX-side receipt relay, NOT mounted in the playable wrapper.
## The owner must supply the decoder and validate authenticity, identity,
## ordering, replay, hit/miss/block semantics, and target lifecycle. This
## relay neither issues a hit nor decides whether a contact happened. The
## normalized shape here is a provisional test seam, NOT the owner's contract.
extends RefCounted
class_name Arcana20ReceiptRelay

# Always reports a decoded receipt, even when its target disappeared; a miss
# never acquires a target from a visual anchor or an invented contact position.
signal receipt_observed(snapshot: Dictionary)
# Only an owner-decoded hit/block with a still-live actual node is eligible for
# an on-body visual. No damage/status/HP/cooldown writes are performed here.
signal body_visual_requested(snapshot: Dictionary, actor: Node2D)
signal invalid_receipt(reason: StringName)

func forward(raw_owner_receipt: Variant, owner_decoder: Callable) -> bool:
    if not owner_decoder.is_valid():
        invalid_receipt.emit(&"no_owner_decoder")
        return false
    var decoded: Variant = owner_decoder.call(raw_owner_receipt)
    if not decoded is Dictionary:
        invalid_receipt.emit(&"decode_failed")
        return false
    var input: Dictionary = decoded
    if not input.has("receipt_id") or not input.has("cast_id") or not input.has("outcome"):
        invalid_receipt.emit(&"missing_identity_or_outcome")
        return false
    if not (input.receipt_id is String or input.receipt_id is StringName) or String(input.receipt_id).is_empty():
        invalid_receipt.emit(&"bad_receipt_id")
        return false
    if not (input.cast_id is String or input.cast_id is StringName) or String(input.cast_id).is_empty():
        invalid_receipt.emit(&"bad_cast_id")
        return false
    if not (input.outcome is String or input.outcome is StringName):
        invalid_receipt.emit(&"bad_outcome")
        return false
    var outcome := StringName(input.outcome)
    if outcome not in [&"hit", &"miss", &"block"]:
        invalid_receipt.emit(&"bad_outcome")
        return false
    if input.has("position") and (not input.position is Vector2 or not input.position.is_finite()):
        invalid_receipt.emit(&"bad_position")
        return false
    if input.has("target_ref") and input.target_ref != null and not input.target_ref is WeakRef:
        invalid_receipt.emit(&"bad_target_ref")
        return false
    # Deep-copy nested value collections so subsequent caller mutation cannot
    # alter a delivered snapshot. A WeakRef is intentionally non-owning.
    var snapshot := input.duplicate(true)
    receipt_observed.emit(snapshot.duplicate(true))
    if outcome == &"miss":
        return true
    var ref: WeakRef = snapshot.get("target_ref")
    var actor := ref.get_ref() as Node2D if ref != null else null
    if is_instance_valid(actor) and actor.is_inside_tree() and not actor.is_queued_for_deletion():
        body_visual_requested.emit(snapshot.duplicate(true), actor)
    return true
