# Canonical A6 avatar sources — license evidence and private staging

**Review date:** 2026-10-30

**Decision:** **GAME USE SUPPORTED; PUBLIC RAW SOURCE REDISTRIBUTION NOT APPROVED.** This records the official page content fetched and checked on the review date; it is not legal advice, and it does not approve a public source-art mirror, a production mount, or a particular platform export configuration.

## Primary-source evidence checked

- CraftPix File Licenses: <https://craftpix.net/file-licenses/> — section **2 FREEBIE PRODUCTS**.
  - §§2.1.1–2.1.3 permit the resources in personal and commercial projects, adaptation/modification, inclusion in game projects, and selling/distributing games with the assets.
  - The page says attribution or a link back is not required (credit is appreciated).
  - §2.2.1 prohibits reselling source art (PNG/JPG/EPS/Illustrator, etc.) or slightly modified art, and prohibits redistribution in a manner that makes source/modified art usable to another end user through an app. It explicitly distinguishes art used as part of gameplay from an app that lets users save/export the artwork.
  - §3.1.1 prohibits use of licensed assets or derivatives for training, fine-tuning, developing, testing, validating, or improving AI/ML and similar systems.
- Canonical male product listing: <https://craftpix.net/freebies/free-base-4-direction-male-character-pixel-art/> — marked **Free Download**; says download grants royalty-free use in unlimited projects and links to the license. It describes the four-direction male set and unarmed idle/walk/run plus sword/hurt/death repertoire; the page notes a PNG version without shadow was added 2025-11-08.
- Canonical female product listing: <https://craftpix.net/freebies/free-base-4-direction-female-character-pixel-art/> — marked **Free Download**; says download grants royalty-free use in unlimited projects and links to the license. It describes four-direction female art, unarmed movement/hurt/death plus sword attack repertoire; the page notes a PNG version without shadow was added 2025-11-08.

The actual source archives were retrieved through the user-provided private Drive handoff. SHA-256 values and file IDs are pinned in `game/survival/ui/avatar_art_manifest.json`. The review is explicitly limited to these two Freebie base products and the cited terms; it does not authorize redistribution of a raw ZIP, PNG sheet, slightly modified sheet, or user-exportable sprite file.

## Runtime frame inspection and import decision

Archive bytes are verified against the exact SHA-256 locks before staging. The selected actual sheets have 64×64 cells and four rows. Direction rows: 0 front, 1 side-left, 2 side-right, 3 back. Counts from the actual PNG dimensions are idle 12 columns (the back row contains four opaque frames), walk 6, run 8, hurt 5, and death 7. Source Tiled metadata encodes 150 ms animation steps; death's final pose holds for 300 ms. The source-based pipeline preserves that hold by repeating the final death frame once. PNGs are 350/316 member archives with zero previous CRC errors. The private staging script checks each archive SHA-256 lock, reads the selected sheet members (verifying those ZIP member CRCs), validates 64×64 frame grids/alpha row occupancy/idle feet baseline, and checks Tiled animation durations. It does not rescan every archive member; the reported 350/316 PNG member counts and zero CRC failures come from the earlier full archive integrity scan.

Unarmed idle/walk/run/hurt/death are the grade-0 movement and survival clips. Sword attack, walk-attack, and run-attack are retained as source-provided combat clips; they are not claimed to be dedicated Skill-Core casting, gun firing, mining, or crafting animations. D046 allows existing directional clips to be reused for action signaling; A0 still owns actual attack/cast selection, Hero physics and Gold VFX. The A6 bridge is read-only and fails closed when owner state, source, or direction is absent.

## Safe private staging plan

1. Keep the original Drive ZIPs outside Git and out of the published repository.
2. Run `python3 tools/stage_a6_avatar_art.py --male-zip <private path> --female-zip <private path>` from the repo root. The script verifies both archive SHA-256 values and CRCs, extracts only the selected PNG sheets into ignored `private_art/a6_avatar/`, and writes an ignored local runtime overlay JSON.
3. Godot imports those staged sheets as game resources for a private A0-composed native preview/build. The files stay local and are not tracked, attached to PR artifacts, or exposed by a download/export UI. A distributable game may embed gameplay assets under the Freebie game-use terms, but the ship pipeline must not package them as a separate source-art product or expose a user-facing sprite export path.
4. A clean clone without those private files has no runtime avatar sheets and returns `SOURCE_BLOCKED`; CI must never invent or substitute an avatar to conceal missing staging. Current pinned CI does not receive Drive assets, so it cannot certify the actual sprite render.

### Source locks and runtime boundaries

- Male bald/unarmored grade 0: CraftPix 555940, Drive file `1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb`, archive SHA-256 `b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795`.
- Female bald/unarmored grade 0: CraftPix 419402, Drive file `1o5hRVbPZjZxcPGwP5coPDHZARbAej75o`, archive SHA-256 `f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad`.
- Private source folder supplied by user: `1pRNobw2FrKWQmelMdGpGnh3PUHPijjA0`.
- Grades 1/2 are not inferred from the base packs; they remain unavailable until a coherent, source-backed, four-direction, identity-preserving match is inspected and aligned. No Knight or CraftPix 180537 Swordsman substitution.

## Remaining native and product gates

The current local checkout has no Godot 4.7 executable. The corrected GitHub V3/V4 checks on A6 SHA `08ccb8348f2e7a75e09af47a1741c158fc46e794` are still queued at the start of this review. Neither CI workflow stages the private art, so even a green run can only validate the no-art source gate and synthetic pipeline case—not native appearance. A pinned A0 composition preview using the ignored local art is required for actual sprites, 720p/2K/4K captures, visual inspection against original A0 world/HUD/Gold, and source-mount acceptance. No such native appearance run or screenshot is claimed yet.
