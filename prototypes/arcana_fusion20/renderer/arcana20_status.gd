## Honest per-skill renderer status. States are strictly separated:
## source recovered (original_source/, SHA-verified) -> SOURCE_PORTED
## (real TS ported) -> parity measured (spatial PNG metrics in CI) ->
## NATIVE_VISUAL_VERIFIED (in-game, human-inspected) -> gameplay
## integrated (PR #30) -> OWNER_VISUAL_APPROVED (owner only). No state
## is granted by an earlier PASS. Synthetic candidates are labelled
## SYNTHETIC_CANDIDATE and are NOT Gold.
extends RefCounted
class_name Arcana20Status

const ENTRIES := {
    1: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "Synthetic candidate; corrected A/C sources recovered in-repo (original_source/), fusion port pending"},
    2: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: B engine (math/renderer/fx) + furnaceWyrm setup/render/post from pyre.ts seed 202 on native 384x216 HDR buffer; floor/actors excluded by design; Gold frame comparison pending"},
    3: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: meteorLoom (pyre.ts seed 303) — 8 authored meteors, per-impact events, sigil; spatial PNG parity in CI pending first run"},
    4: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: diagonal slit > blade > one cut > delayed cracks. NOT Gold, NOT approved"},
    5: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A+C bloom fusion driver; fusion port pending; sources recovered in-repo"},
    6: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: coherent water glyph with moving tip contact. NOT Gold, NOT approved"},
    7: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C basilica driver; C port pending; source recovered in-repo"},
    8: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: undertowMaw (tide.ts seed 808) log-polar shaft + surge; pull/stillness/surge event ledger"},
    9: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+B+C", "visual": "VISUAL_NOT_VERIFIED", "note": "True chained-node fusion driver (not three overlays); fusion port pending; sources recovered in-repo"},
    10: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C thunderloom driver; port pending; source recovered in-repo"},
    11: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C09", "visual": "VISUAL_NOT_VERIFIED", "note": "Rotating carousel arcs driver; fusion port pending; sources recovered in-repo"},
    12: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: sky glyph then causal sky-to-ground strikes. NOT Gold, NOT approved"},
    13: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: directed readable root growth. NOT Gold, NOT approved"},
    14: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: causal fungal network, not random particles. NOT Gold, NOT approved"},
    15: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C thorn opera driver; port pending; source recovered in-repo"},
    16: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A+C worldseed growth driver; fusion port pending; sources recovered in-repo"},
    17: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "C event-horizon driver (regression family C); port pending; source recovered in-repo"},
    18: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Brief: authored time fractures, no incoherent bouncing. NOT Gold, NOT approved"},
    19: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "D", "visual": "VISUAL_NOT_VERIFIED", "note": "Creator D override honoured; D timeline duration/climax NOT in catalog (duration=-1) — candidate timing used, flagged"},
    20: {"state": "NATIVE_RUNTIME_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A+C ripper slashes driver; fusion port pending; sources recovered in-repo"},
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
