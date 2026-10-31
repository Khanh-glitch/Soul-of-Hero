## Honest per-skill renderer status. NOT_IMPLEMENTED is gone only where a
## real native driver runs the catalog timeline. Gold parity is claimed
## NOWHERE: the original A/B/C/D source packages (ARCANA_FUSION_20SKILLS_
## HANDOFF.zip) are not in this repository, so Gold-vs-native image
## verification is VISUAL_NOT_VERIFIED until those packages are available
## and compared frame-by-frame. OWNER_VISUAL_APPROVED is owner-only.
extends RefCounted
class_name Arcana20Status

const ENTRIES := {
    1: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored A+C crown choreography on catalog timeline; Gold A/C packages absent from repo"},
    2: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "PR#28 source-ported B geometry (seed 202) hosted unchanged; parity PARTIAL per its own header (no full post/exact crack tree)"},
    3: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "B-family meteor/loom driver; original B:03 source not in repo"},
    4: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: diagonal slit > blade > one cut > delayed cracks. NOT Gold, NOT approved"},
    5: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A+C bloom fusion driver; sources absent from repo"},
    6: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: coherent water glyph with moving tip contact. NOT Gold, NOT approved"},
    7: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C basilica driver; original C:07 source not in repo"},
    8: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "B maw/vortex driver; original B:08 source not in repo"},
    9: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+B+C", "visual": "VISUAL_NOT_VERIFIED", "note": "True chained-node fusion driver (not three overlays); sources absent from repo"},
    10: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C thunderloom driver; source absent from repo"},
    11: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C09", "visual": "VISUAL_NOT_VERIFIED", "note": "Rotating carousel arcs driver; sources absent from repo"},
    12: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: sky glyph then causal sky-to-ground strikes. NOT Gold, NOT approved"},
    13: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: directed readable root growth. NOT Gold, NOT approved"},
    14: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: causal fungal network, not random particles. NOT Gold, NOT approved"},
    15: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C thorn opera driver; source absent from repo"},
    16: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A+C worldseed growth driver; sources absent from repo"},
    17: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C event-horizon driver (regression family C); source absent from repo"},
    18: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: authored time fractures, no incoherent bouncing. NOT Gold, NOT approved"},
    19: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "D", "visual": "VISUAL_NOT_VERIFIED", "note": "Creator D override honoured; D timeline duration/climax NOT in catalog (duration=-1) — candidate timing used, flagged"},
    20: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A+C ripper slashes driver; sources absent from repo"},
}

static func entry(id: int) -> Dictionary:
    return (ENTRIES.get(id, {}) as Dictionary).duplicate(true)

static func summary() -> Dictionary:
    var by_state := {}
    for id in ENTRIES.keys():
        var st: String = ENTRIES[id].state
        by_state[st] = int(by_state.get(st, 0)) + 1
    return {"skills": ENTRIES.size(), "by_state": by_state,
        "gold_visual_verified": 0, "owner_visual_approved": 0}
