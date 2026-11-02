# Pinned A3 integration fixture — not a production economy integration

`adapter/economy_service.gd` and the five catalog JSON files are unmodified files
from `Khanh-glitch/Soul-of-Hero` PR #19 commit
`86dc21954fd0a1a4aa9f98b6ec7d1e6782cc800e`. Its adapter SHA-256 is
`b1ee9792b4460e956ec6c59437269078e4f6767f76d35145e680dcc03ba3806c`.
They are isolated here; A3's branch and production catalog paths are untouched.

`adapter/a0_authorized_economy.gd` is an A0-owned integration shim. It refuses
foreign mutators passed to A3's public `_transact`, then delegates to the actual
pinned implementation. It is not the production world station/time host.
The native CI mounts the fixture catalogs at A3's existing `res://data/survival`
paths in its ephemeral checkout via symlinks; never overwrite production catalogs.
Run the same mounting step locally only if those paths are absent.

The pinned A3 service exposes privileged grant and internal APIs. Keep the
adapter/port in the trusted composition root, not UI; GDScript reflection is
not a security sandbox against malicious in-process game scripts. No fabricated
A4 skill attestation is installed by the A0 integration tests.
