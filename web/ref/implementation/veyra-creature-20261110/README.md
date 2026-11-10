# SOH — Veyra Final + Living Ecology | Git handoff (2026-11-10)

**Status: READY FOR GAMEPLAY AGENT EXECUTION — NOT CODE ACCEPTED.** This is an implementation packet, not a second Gameplay Bible. It is part of a preload-only branch descending from the clean R12 PR #47 HEAD `09e16cda752680c96c5f54f737c99bf950f4cbe6`. No production game runtime is changed by this packet.

## One entry point / no attachment
Start with [ONE_SHOT_AGENT_PROMPT.md](ONE_SHOT_AGENT_PROMPT.md). It contains the actual standalone task and acceptance gates. The Agent does **not** receive any chat attachment and must not ask Creator to reattach source packs. Source binaries are in **Google Drive**:

| Verified source | Drive link | SHA-256 |
|---|---|---|
| **Complete verified source preload V2** (35,907,353 bytes, 13 original sources + 60 verified PNG recovery copies) | [Full Execution Preload V2](https://drive.google.com/file/d/1m8YuSXO3U9ALxzQLg8iya1r_EEEUhKNu/view) | `c2d7ba77a19238d9df627e63cd61e99eca173f91642e92410fc3bea15d4f68b5` |
| **Map final** | [Veyra World Art Upgrade (4)](https://drive.google.com/file/d/1BHZJ1MvbiaXX1KaFGDq3pdxMNmhxivY1/view) | `d9d69d18e5db4f2d8075c76af9f4e712042cc078cee7938aeb329c118c2dcda4` |
| **Six Primordials** | [Boss Lab (9)](https://drive.google.com/file/d/1kbVEMIgRONwKNavNsv6BOl62upQQA-rF/view) | `74940d11c42fa883101b43a252cb4071955a8995f70a9f2ecd0bdba2f5d6dfe2` |

These are successfully uploaded to **My Drive**. The original user-provided shared folder was not writable from the connector. Access may depend on the authenticated Drive account; source URL existence is not proof that another agent session is authorized. Check access and hash before claiming READY_TO_BUILD.

## Files preloaded in this Git branch
- [ONE_SHOT_AGENT_PROMPT.md](ONE_SHOT_AGENT_PROMPT.md) — **the operative copy-and-run standalone instruction; authoritative over outdated instructions embedded in the preload ZIP**
- [CREATURE_HABITAT_AND_BOSS_DESIGN.md](CREATURE_HABITAT_AND_BOSS_DESIGN.md) — nine creature roles/regions, four side bosses, five wildlife, six Elder sites, coordinates by authored Veyra AU reference
- [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) — exact original source bytes, SHA-256 and Google Drive URL for each pack; AUTHORING coordinate anchors are not fixed spawn cells
- [PRELOAD_QA_AND_SPRITE_RECOVERY.md](PRELOAD_QA_AND_SPRITE_RECOVERY.md) — independent archive QA, bad ZIP entries and recoverable sprite alternatives
- [VERIFIED_SPRITES_MANIFEST.json](VERIFIED_SPRITES_MANIFEST.json) — verified original PNG sheet paths and hashes

## Authority and scope
Read `web/ref/README.md`, `web/ref/bible.md`, `web/ref/OPERATIONS.md` from the actual execution branch. Those documents outrank this implementation packet for established Creator law.

The current Creator authorized integrated implementation: retain **100% of the final Veyra visual/FX/tileset art presentation** while composing real game runtime, 3 Vampire + 3 Orc + 3 Slime, four real optional side bosses (Rock, Samurai, Water Warrior, Maid), six named Elders × two forms × four skills/form, five wild species, and functional at-least-two-species husbandry. Creative balancing and technical details are delegated but cannot violate immutable laws, world identity, save/UID, footprint-only house discovery, 336h/72h or non-Elder paths.

**Explicitly excluded:** Mafia, a speculative scythe boss, and the future Gold UI/UX/HUD redesign. Do not block gameplay on missing Gold HUD assets.

## Operational safeguards
1. Start a **new dedicated feature branch from this preload branch**, not `main` or a historical agent branch, preserve draft PR #47 unmerged.
2. Download full V2 bundle from Drive; verify SHA and original source manifest, treat ZIP sources as intake not direct overwrite of production TS game.
3. Fix Orc/Slime invalid zip members using the verified original PNG alternatives when needed. Do not claim all ZIP members healthy.
4. Adopt exact full Veyra map and original effect layers; preserve source and geography IDs while adapting code interfaces and save migrations.
5. Prove SOURCE, FIXTURE, NATURAL_INPUT, COMPOSED_WEB, COMPOSED_GODOT, HUMAN, LONG separately. A running standalone demo is not production acceptance.
6. Push commits and a draft PR, with actual 640×360 1× captured runtime, test commands/exit codes and explicit gaps. Do not self-merge or write a second canon.

This Git packet is documentation/preload, **not evidence of code integration or visual acceptance**.
