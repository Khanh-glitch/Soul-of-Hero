# ARCANA Fusion20 — Technical Progress Matrix (not visual acceptance) (AVFX renderer stream)

Branch: `arena/c7b0c4e8-soul-of-hero` · Renderer root: `prototypes/arcana_fusion20/renderer/`
CI: `.github/workflows/arcana-fusion20-renderer.yml` (Godot 4.7, headless)
Key CI evidence: run `41197756655` (HEAD `dd465e96c`) — **SUCCESS**:
`ARCANA20_RENDER_RESULT PASS`, all 20 lifecycle gates + all spatial gates green.
Parity evidence artifact: `arcana20-parity-evidence` (diff heatmaps `*_heat.png`:
red = native-only, blue = reference-only, white = both-present value diff; plus
`*_got.png` native frames) uploaded by CI from `renderer/evidence_out/`.

Status vocabulary (Audit D, no auto-promotion): Source recovered →
SOURCE_PORTED → parity measured → NATIVE_VISUAL_VERIFIED → gameplay
integrated (PR #30) → OWNER_VISUAL_APPROVED (owner only).
**Every row below is VISUAL_NOT_VERIFIED. OWNER_VISUAL_APPROVED = 0.**
Headless CI PASS is never a Gold/visual claim. **Round-next correction:**
The old table's references to ground/air/distortion "passes" describe intended
roles, not independently routable real-SOH passes: players currently expose
composited sprites. #01 overlays whole source effects; #05/#09/#11/#16/#20
are authored A-buffer interpretations, not faithful multi-source ports. See
`FUSION_REDESIGN_AUDIT.md` for specific gaps. Historical CI results below
refer to the earlier commit, not any later changes.

| ID | Source authority | Implemented native engine | Source parity | Native visual | Contact/event fidelity | Environmental FX | OUT | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| 01 Cinder Crown | A `cinderCrown` + C `cinderCrown` (pyre.ts) | FusionPlayer: ported A engine (lead) + ported C crown, shared clock, C offset +0.69s | Not gated (fusion; no single-source ref) | VISUAL_NOT_VERIFIED | Both source contact cues forwarded (new behavior unverified in CI) | Whole sprites overlaid; no isolated geometry passes | Authored A outro | FUSION_CANDIDATE | CI lifecycle run 41197756655 |
| 02 Furnace Wyrm | B `furnaceWyrm` (pyre.ts, seed 202) | Ported B engine 384×216 HDR, 1:1 math/renderer/fx | **PASS** IoU ≥0.99, MAE ≤0.03 (t0.3/2.0/4.6) | VISUAL_NOT_VERIFIED | Source event ledger, lifecycle PASS | Ground cracks local-only, no pasted battlefield | Source outro | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 03 Meteor Loom | B `meteorLoom` (pyre.ts, seed 303) | Ported B engine | **PASS** spatial in CI | VISUAL_NOT_VERIFIED | 8 per-impact contacts verified | Impact cracks/debris on ground pass | Source outro | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 04 (redesign) | Creator brief 04 (diagonal guillotine) | Authored A-engine choreography | N/A — redesign, no source to match | VISUAL_NOT_VERIFIED | 2 contacts (cut, delayed rupture) | Slit/crack on ground pass | Authored fade | REDESIGN_CANDIDATE | CI lifecycle |
| 05 Abyssal Bloom | A + C (decisions 05) | Authored A-buffer interpretation; original A/C components not yet preserved | Not gated (fusion) | VISUAL_NOT_VERIFIED | Typed ledger, lifecycle PASS | Water column on air pass | Authored outro | FUSION_CANDIDATE | CI lifecycle |
| 06 (redesign) | Creator brief 06 (water calligraphy) | Authored A-engine, moving-tip strokes | N/A — redesign | VISUAL_NOT_VERIFIED | Discrete tip-end contacts; continuous tip sweep missing | Intended strokes; not independently routed | Authored outro | REDESIGN_CANDIDATE | CI lifecycle |
| 07 Mirrorfrost Basilica | C `mirrorfrostBasilica` (tide.ts, seed 48514) | Ported C engine (frame/kit/palette) | **PASS** spatial in CI | VISUAL_NOT_VERIFIED | Sequential fracture ledger | Facets/spires air pass | Source outro | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 08 Undertow Maw | B `undertowMaw` (tide.ts, seed 808) | Ported B engine, log-polar shaft | **PASS** spatial in CI | VISUAL_NOT_VERIFIED | Pull/stillness/surge ledger | Surge on ground+air passes | Source outro | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 09 Chain Verdict | A+B+C (decisions 09) | Authored A-buffer network, source A/B/C components not yet preserved | Not gated (fusion) | VISUAL_NOT_VERIFIED | **11 per-link contacts** verified | Branch field air pass | Authored outro | FUSION_CANDIDATE | CI lifecycle (ledger count asserted) |
| 10 Thunderloom | C `thunderloom` (tempest.ts, seed 72271) | Ported C engine | **PASS** spatial in CI | VISUAL_NOT_VERIFIED | Strike ledger; `Math.random` sparks → deterministic (documented delta) | Bolt field air pass | Source outro | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 11 Volt Carousel | A + C#09 (decisions 11) | Authored A-buffer carousel and bolts, not original A or C generator | Not gated (fusion) | VISUAL_NOT_VERIFIED | **7 connector contacts** verified | Rotating arcs air pass | Authored outro | FUSION_CANDIDATE | CI lifecycle (ledger count asserted) |
| 12 (redesign) | Creator brief 12 (sky glyph circuit) | Authored A-engine | N/A — redesign | VISUAL_NOT_VERIFIED | **4 ordered strike contacts** | Glyph/circuit air pass | Reverse stroke retraction authored; visual review pending | REDESIGN_CANDIDATE | CI lifecycle (ledger count asserted) |
| 13 (redesign) | Creator brief 13 (biomechanical roots) | Authored A-engine, grow_branches | N/A — redesign | VISUAL_NOT_VERIFIED | 4 fixed authored contact cues; targeting unverified | Roots ground+air | Geometry retracts; visual review pending | REDESIGN_CANDIDATE | historical CI lifecycle |
| 14 (redesign) | Creator brief 14 (fungal network) | Authored A-engine colony propagation | N/A — redesign | VISUAL_NOT_VERIFIED | Signal-pulse ledger | Hyphal network ground pass | Authored sporulation outro | REDESIGN_CANDIDATE | CI lifecycle |
| 15 Thorn Opera | C `thornOpera` (tempest.ts, seed 111866) | Ported C engine; verlet physics in **float64 scalars** (Godot Vector2 is float32 — chaotic solver diverged at IoU 0.26–0.64; fixed) | **PASS** spatial in CI (run 41197756655) | VISUAL_NOT_VERIFIED | Tendril-touch/bloom/lash ledger | Tendrils air, residue ground | Source fade 6.6–7.6s | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 16 Worldseed | A + C (decisions 16) | Authored A-buffer petals; original A motion and C palette not yet verified | Not gated (fusion) | VISUAL_NOT_VERIFIED | Typed ledger, lifecycle PASS | Roots ground, canopy air | Authored outro | FUSION_CANDIDATE | CI lifecycle |
| 17 Event Horizon | C `eventHorizon` (astral.ts, seed 127704) | Ported C engine | **PASS** spatial in CI | VISUAL_NOT_VERIFIED | Accretion/impact ledger; blitBase dark-fragment adaptation documented | Disk/distortion passes | Source outro | SOURCE_PORTED (parity measured) | CI spatial + heatmap artifact |
| 18 (redesign) | Creator brief 18 (temporal crystals) | Authored A-engine sequence | N/A — redesign | VISUAL_NOT_VERIFIED | Pre-echo/capture/release ledger | Crystals air pass | Ordered reverse release/resolution authored; visual review pending | REDESIGN_CANDIDATE | CI lifecycle |
| 19 Constellation Engine | D HTML (original authority; 9.8s lifecycle) | Ported D engine: CPU GLSL translation, 480×270, Bayer-posterize comp | **NOT GATED** — original D browser FX-only diagnostic references captured; RGB comparison does not yet normalize WebGL/native post and alpha differences. Historical CI checked lifecycle only | VISUAL_NOT_VERIFIED | Star-impact ledger at authored times | Additive star layer | **Authored** OUT 8.6–9.8s contraction/unwinding + residual decay (unapproved OUT study NOT used) | SOURCE_PORTED (parity NOT measured) | CI lifecycle; blocker stated, not hidden |
| 20 Reality Ripper | A + C (decisions 20) | Authored A-buffer rift; neither original C contour nor real-world A deformation ported | Not gated (fusion) | VISUAL_NOT_VERIFIED | Rift/shard ledger, lifecycle PASS | Rift distortion pass | Shard return + closure | FUSION_CANDIDATE | CI lifecycle |

## Known remaining gaps (exact blockers, nothing hidden)

1. **Visual verification (all 20):** no human has viewed native frames in-game.
   All rows remain VISUAL_NOT_VERIFIED; only the owner can promote.
   Next step: owner review of the `arcana20-parity-evidence` artifact
   (heatmaps + native frames) and an in-game composite pass on real SOH
   overworld/player/enemies (bright + dark scenes, moving camera, cancel/recast,
   simultaneous casts) — `SOURCE_BUFFER_PARITY` (this doc) must stay separate
   from `SOH_NATIVE_COMPOSITE_VERIFICATION` (not yet performed).
2. **#19 spatial parity:** original D HTML has now been captured with local
   Chromium/SwiftShader at 480×270; deterministic fresh-page 5.2 s hash matches.
   The FX-only diagnostic suppresses source floor/markers but retains WebGL
   bloom/post and opaque alpha. Native uses different post; matching isolated
   passes and alpha semantics remain necessary before a defensible parity gate.
   Full-scene screenshots are reference only and must never be used in SOH.
3. **Fusions (#01/#05/#09/#11/#16/#20) and redesigns (#04/#06/#12/#13/#14/#18):**
   no source reference exists by design (creator-voted fusion briefs /
   redesign briefs). Lifecycle + typed contact ledgers alone do not validate them. Compare
   selected original source components and obtain real-scene visual evidence;
   missing genuine source components and redesign OUT gaps are listed in the audit.
4. **In-game integration** is Control Tower's PR #30 (`soh_binding/**`,
   untouched by this stream). Renderer emits `cast_started`, `source_tick`,
   `visual_contact`, `body_event_cue`, `cast_finished`; combat damage is
   SOH's alone.

## Integration

- Handoff to Control Tower: issue #29 / PR #30. No `soh_binding/**` edits.
- No merge or production promotion without owner authorisation.
