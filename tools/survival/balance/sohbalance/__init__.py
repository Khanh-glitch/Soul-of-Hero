"""SOH A7 independent balance / loot-discovery analysis package.

Scope discipline (see docs/survival/balance/README.md):
  * read-only consumer of pinned A1/A3 snapshots,
  * never edits another owner's data,
  * every number is either derived from those files or an explicitly labelled
    hypothesis from data/survival/balance/hypotheses.v1.json.
"""

__all__ = [
    "provenance",
    "model",
    "findings",
    "geo",
    "loot",
    "access",
    "routes",
    "sensitivity",
    "adversarial",
    "report",
]
