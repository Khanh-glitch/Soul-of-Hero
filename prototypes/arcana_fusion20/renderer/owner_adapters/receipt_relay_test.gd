## Synthetic unit fixtures only. No gameplay hit or owner contract is asserted.
extends SceneTree

var observations: Array = []
var bodies: Array = []
var errors: Array = []
var failures := 0

func _check(condition: bool, message: String) -> void:
    if not condition:
        failures += 1
        push_error("RECEIPT_FIXTURE_FAIL " + message)

func _initialize() -> void:
    call_deferred(&"_run")

func _run() -> void:
    var relay := Arcana20ReceiptRelay.new()
    relay.receipt_observed.connect(func(snapshot: Dictionary) -> void: observations.append(snapshot))
    relay.body_visual_requested.connect(func(snapshot: Dictionary, actor: Node2D) -> void: bodies.append([snapshot, actor]))
    relay.invalid_receipt.connect(func(reason: StringName) -> void: errors.append(reason))
    var actor := Node2D.new()
    root.add_child(actor)
    var decode := func(value: Variant) -> Variant: return value # fixture only; not authority
    var hit := {"receipt_id": "fixture-1", "cast_id": "fixture-cast", "outcome": &"hit", "target_ref": weakref(actor), "position": Vector2(12, 8), "nested": {"values": [1, 2]}}
    _check(not relay.forward(hit, Callable()), "no decoder must fail closed")
    _check(relay.forward(hit, decode), "owner-decoded fixture hit")
    hit["nested"]["values"][0] = 99
    _check(int(observations[0]["nested"]["values"][0]) == 1 and int(bodies[0][0]["nested"]["values"][0]) == 1, "snapshot isolates caller mutation")
    _check(bodies.size() == 1 and bodies[0][1] == actor, "body cue uses actual target node")
    var miss := {"receipt_id": "fixture-2", "cast_id": "fixture-cast", "outcome": &"miss", "target_ref": weakref(actor)}
    _check(relay.forward(miss, decode), "miss forwarded")
    _check(observations.size() == 2 and bodies.size() == 1, "miss cannot create a body hit")
    var block := {"receipt_id": "fixture-3", "cast_id": "fixture-cast", "outcome": &"block", "target_ref": weakref(actor)}
    _check(relay.forward(block, decode), "block forwarded")
    _check(bodies.size() == 2, "block has distinct body visual outcome")
    var stale_ref: WeakRef = weakref(actor)
    actor.queue_free()
    await process_frame
    var late := {"receipt_id": "fixture-4", "cast_id": "fixture-cast", "outcome": &"hit", "target_ref": stale_ref}
    _check(relay.forward(late, decode), "late receipt remains observable")
    _check(observations.size() == 4 and bodies.size() == 2, "orphan receipt must not create a body visual")
    _check(not relay.forward({"receipt_id": "x", "cast_id": "x", "outcome": &"hit", "position": Vector2(INF, 0)}, decode), "nonfinite position rejected")
    _check(not relay.forward({"receipt_id": "x", "cast_id": "x", "outcome": &"invented"}, decode), "unknown outcome rejected")
    _check(errors.size() == 3, "all invalid receipts diagnosed")
    if failures == 0:
        print("RECEIPT_FIXTURE_PASS synthetic fixtures only; no owner integration or combat assertion")
    quit(1 if failures else 0)
