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
    1: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "ONE choreography: ported A CinderCrown (lead) + ported C cinderCrown outer flame geometry on shared clock, C offset +0.69s aligning both bursts to one impact beat; C back layer / A front layer"},
    2: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: B engine (math/renderer/fx) + furnaceWyrm setup/render/post from pyre.ts seed 202 on native 384x216 HDR buffer; floor/actors excluded by design; spatial PNG parity PASS in CI (IoU>=0.99)"},
    3: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: meteorLoom (pyre.ts seed 303) — 8 authored meteors, per-impact events, sigil; spatial PNG parity PASS in CI; 8-contact ledger verified"},
    4: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Diagonal guillotine: slit telegraph -> blade materialises -> one fast cut -> delayed crack rupture (decisions 04)"},
    5: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "ONE choreography on ported A engine: A membrane opening/peak lead + C water column/rain/gravity replacing A tails (decisions 05)"},
    6: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Legible 3-stroke water glyph written by moving tip (tip contacts), then curved wave fronts (decisions 06)"},
    7: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: mirrorfrostBasilica (tide.ts seed 48514) facets/spires/sequential fracture; parity in CI"},
    8: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: undertowMaw (tide.ts seed 808) log-polar shaft + surge; pull/stillness/surge event ledger"},
    9: {"state": "FUSION_CANDIDATE", "source": "A+B+C", "visual": "VISUAL_NOT_VERIFIED", "note": "ONE network: A chain conduction order + B two-colour bolts + C-density branches, per-link impacts (decisions 09)"},
    10: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: thunderloom (tempest.ts seed 72271); Math.random spark substituted deterministically (documented)"},
    11: {"state": "FUSION_CANDIDATE", "source": "A+C#09", "visual": "VISUAL_NOT_VERIFIED", "note": "A rotating carousel machine; connectors use C-09-style bolt generator re-mapped to moving connectors (decisions 11)"},
    12: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Readable sky glyph written stroke-by-stroke, circuit pulses, ordered strikes, climactic strike, reverse disassembly (decisions 12)"},
    13: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Biomechanical roots: exploratory growth (grow_branches), thickening/tension, targeted thorn snap (decisions 13)"},
    14: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Causal fungal network: seed->colonies->hyphal links->signal pulses->synchronised sporulation (decisions 14)"},
    15: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: thornOpera (tempest.ts seed 111866) verlet tendrils/bloom/lashes; physics stored as float64 scalars (Godot Vector2 is float32; chaotic solver diverged) — spatial PNG parity PASS in CI (run 41197756655)"},
    16: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "ONE choreography on ported A engine: A worldseed germination lead + C root/leaf growth systems sharing anchors and clock (decisions 16)"},
    17: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: C frame/kit + eventHorizon (astral.ts seed 127704); spatial PNG parity PASS in CI; blitBase dark-fragment adaptation documented"},
    18: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Temporal sequence: pre-echo -> captured event crystals -> reverse release -> single synchronised impact (decisions 18)"},
    19: {"state": "SOURCE_PORTED_CANDIDATE", "source": "D", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port of D HTML constellation engine (CPU GLSL translation, 480x270, dur 9.8s, authored OUT 8.6-9.8 contraction/residual decay; unapproved OUT study NOT used). No reference PNGs: headless WebGL capture unavailable in sandbox — spatial parity NOT MEASURED, lifecycle only"},
    20: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "C-style jagged rift + A external impact ring/shard ejection and return (decisions 20)"},
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
