# Isolated receipt relay — provisional, unmounted

This is a test seam for the future CT-owned combat receipt integration, **not
an agreed owner contract** and not used by the exported wrapper. A caller
supplies the owner decoder; the relay cannot authenticate that decoder or a
receipt, make combat decisions, apply damage, deduplicate replays, or decide
whether a target is alive in the combat sense. Only the owner can do those
things. Do not mount this until CT supplies and approves its immutable receipt,
identity, lifecycle, ordering and replay contracts and a real owner decoder.

The current synthetic decoder returns a provisional dictionary with nonempty
`receipt_id`, `cast_id`, outcome `hit`, `miss` or `block`, optional finite
`Vector2` position and optional `WeakRef` to an actual `Node2D`. The relay
makes independent deep copies for listeners. Every valid decoded receipt is
observable, including a hit whose target has since disappeared; a miss never
requests an on-body cue, and a hit/block requests one only if its weak target
is still in the tree and not queued for deletion. It never invents a target or
position and does not mutate an actor. It intentionally makes no claim about
what a blocked or late receipt should do in the eventual owner contract.

`receipt_relay_test.gd` uses synthetic fixture dictionaries and a disposable
node solely to test validation, copy isolation and orphan handling. Passing
that test is **not** proof of real combat, actual owner receipts, in-game body
reactions, source fidelity or creator approval. Multiple calls are forwarded;
replay prevention and cast-lifetime management remain owner obligations.
