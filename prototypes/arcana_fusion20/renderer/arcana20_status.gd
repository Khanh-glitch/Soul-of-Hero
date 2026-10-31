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
    1: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "A and C complete crown players on a shared clock; C offset +0.69s. Source components are not isolated; duplicated geometry and OUT still need visual review."},
    2: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: B engine (math/renderer/fx) + furnaceWyrm setup/render/post from pyre.ts seed 202 on native 384x216 HDR buffer; floor/actors excluded by design; spatial PNG parity PASS in CI (IoU>=0.99)"},
    3: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: meteorLoom (pyre.ts seed 303) — 8 authored meteors, per-impact events, sigil; spatial PNG parity PASS in CI; 8-contact ledger verified"},
    4: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Diagonal guillotine: slit telegraph -> blade materialises -> one fast cut -> delayed crack rupture (decisions 04)"},
    5: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored A-buffer interpretation, not original A bloom or C water-column source. Both selected components remain to be preserved."},
    6: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Three written strokes and wave fronts; visual legibility unverified. Discrete tip-end contacts, no continuous moving-tip sweep."},
    7: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: mirrorfrostBasilica (tide.ts seed 48514) facets/spires/sequential fracture; parity in CI"},
    8: {"state": "SOURCE_PORTED_CANDIDATE", "source": "B", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: undertowMaw (tide.ts seed 808) log-polar shaft + surge; pull/stillness/surge event ledger"},
    9: {"state": "FUSION_CANDIDATE", "source": "A+B+C", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored A-buffer network inspired by A/B/C; original selected source components not yet preserved; fixed rather than live actor anchors."},
    10: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: thunderloom (tempest.ts seed 72271); Math.random spark substituted deterministically (documented)"},
    11: {"state": "FUSION_CANDIDATE", "source": "A+C#09", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored A-buffer carousel and bolt paths; original A machine and C-09 bolt generator not preserved. Connector cues use authored moving positions."},
    12: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Glyph strokes, circuit and strikes with reverse-order OUT; readability and impact remain unverified."},
    13: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored branching roots, timed cues and geometric retraction; apparent tension, targeting and motion need visual review."},
    14: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Causal fungal network: seed->colonies->hyphal links->signal pulses->synchronised sporulation (decisions 14)"},
    15: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: thornOpera (tempest.ts seed 111866) verlet tendrils/bloom/lashes; physics stored as float64 scalars (Godot Vector2 is float32; chaotic solver diverged) — spatial PNG parity PASS in CI (run 41197756655)"},
    16: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored A-buffer petal model; original A motion and C palette are not yet verified/preserved."},
    17: {"state": "SOURCE_PORTED_CANDIDATE", "source": "C", "visual": "VISUAL_NOT_VERIFIED", "note": "TRUE port: C frame/kit + eventHorizon (astral.ts seed 127704); spatial PNG parity PASS in CI; blitBase dark-fragment adaptation documented"},
    18: {"state": "REDESIGN_CANDIDATE", "source": "NEW", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored pre-echo, capture and synchronized impact; reverse release and resolution now ordered, motion needs visual review."},
    19: {"state": "SOURCE_PORTED_CANDIDATE", "source": "D", "visual": "VISUAL_NOT_VERIFIED", "note": "D CPU implementation, 480x270, dur 9.8s, authored OUT; original D browser diagnostic captured. Isolated WebGL/native compositor differences prevent a fair parity gate; no visual approval."},
    20: {"state": "FUSION_CANDIDATE", "source": "A+C", "visual": "VISUAL_NOT_VERIFIED", "note": "Authored A-buffer interpretation; original C contour and real-world A environmental deformation not yet ported."},
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
