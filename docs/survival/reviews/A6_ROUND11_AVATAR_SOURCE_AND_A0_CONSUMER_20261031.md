# A6 round 11 — the avatar source is Git, not Drive; real A0 state in the return UI

Date 2026-10-31. Branch `arena/05e0328d-soul-of-hero`, head `19c9c787`.
Supersedes the transport sections of the round-10 hand-off. The Drive download is
gone from this workflow entirely.

## 1. The failure was transport, and it is now fixed at the source

Both private staging jobs used to run:

```
curl -L --fail -o male.zip "https://drive.google.com/uc?export=download&id=…"
```

Anonymous Drive answers a runner with an HTML consent page, so the step stopped at
`male.zip: download is not a ZIP archive` — before Godot, before any sprite was read.
That result said nothing about the art, the sheet dimensions or the animation
pipeline, and it is not being read as if it did.

### 1.1 Where the archives actually are

The creator's 43 asset packs are on **`Khanh-glitch/APEX-CHAOS`**, one pack family per
branch, not in `Soul-of-Hero` and not on any `arena/*` branch. Every branch of that
repository was enumerated and its HEAD tree read; both avatar packs were found this
way:

| | male | female |
| --- | --- | --- |
| CraftPix id | 555940 | 419402 |
| repository | `Khanh-glitch/APEX-CHAOS` | same |
| branch | `Khanh-glitch-patch-6` | `Khanh-glitch-patch-2` |
| **immutable commit** | `bf11a0cecfda43beca510062bd5d9dc1a8573cc5` | `b75dfc0ffa98c25059d67f655be14e419e63430b` |
| path | `craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip` | `craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip` |
| **Git blob** | `ce3e032df5b67ef6c25ae4dcb0562bb3b7e545c0` | `854be998896252479a678aef6f4b7b09d809a6b4` |
| bytes | 6 439 805 | 6 419 098 |
| **SHA-256** | `b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795` | `f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad` |
| link | [blob](https://github.com/Khanh-glitch/APEX-CHAOS/blob/bf11a0cecfda43beca510062bd5d9dc1a8573cc5/craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip) | [blob](https://github.com/Khanh-glitch/APEX-CHAOS/blob/b75dfc0ffa98c25059d67f655be14e419e63430b/craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip) |

Both digests equal the ones in the work order, and both files start with `PK\x03\x04`.
The byte lengths match exactly, so these are the same two archives the Control Tower
had previously checked through the authenticated Drive connector.

### 1.2 What replaced the curl

`tools/fetch_a6_avatar_sources.sh` fetches each archive from its **pinned commit**
with a blobless, depth-1 fetch (the asset repository is large; only the two pinned
blobs come down) and asserts, in order: the fetched commit id, the Git blob id at
that path, the exact byte length, the ZIP magic, and the SHA-256. Any failure is a
hard stop with a named reason. `A6_ASSET_TOKEN` is honoured if the asset repository is
ever made private; without it the same commands work against the public repository.

Staging is unchanged: `tools/stage_a6_avatar_art.py`, no second importer, eight
selected sheets per gender, 64×64 cells, four direction rows, Tiled timing evidence
included. It now also records `source_git` (repository, commit, path, blob) and
`source_transport: git-pinned` in the private runtime manifest, so the provenance of
the staged bytes is auditable without consulting the workflow.

Mutation-checked before it ever ran in CI — a wrong digest, a wrong commit and a
wrong blob id each stop the script (`SHA-256 … pinned …`, `cannot fetch …`,
`is blob '…', pinned '…'`).

### 1.3 One bug on the way

The first hosted attempt still failed, this time inside the fetch step. The step piped
the script into `tee`, and `tee` opens its target *before* the script has created the
directory — so the step died on `No such file or directory` with no annotation, and
the only evidence was a skipped step 6. The directory is created first now and the
script writes its own log.

## 2. The sprites were actually looked at

Contact sheets built from the staged sheets, committed as images so they can be
opened rather than taken on trust:

* `a6_avatar_male_contact.png` — 8 actions × 4 directions, first frame of each cell;
* `a6_avatar_female_contact.png` — same layout;
* `a6_avatar_zoom_8x.png` — 8× magnification, male and female, idle and walk;
* `a6_avatar_animation_strip.png` — every frame of walk, walk-attack and death.

What the pixels show:

* both are the authentic **bald grade-0** base characters: male blue-eyed and
  flat-chested, female green-eyed with visible lashes and bodice. They are not the
  same file: 93.3 % of the front idle pixels differ, and all five compared sheets
  have distinct hashes;
* the four direction rows are populated and readable in all eight actions;
* walk cycles alternate the legs correctly over 6 frames; the sword only appears in
  the attack columns, with the slash arc drawn as part of the source sheet;
* death is a 7-frame collapse ending in a corpse;
* one honest observation: in **both** packs, death frame index 4 is a red
  blood-silhouette the same shape and pixel count as the corpse, then frames 5–6
  return to normal colouring. It is identical in the male and female sheets, so it is
  the source pack's design (a hit-flash-style frame), not a staging bug. It is
  recorded here rather than silently edited, because altering source art is not A6's
  to do.

## 3. Hosted result

Run [`41162133383`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41162133383),
head `19c9c787`, **all four jobs green** — the two that had been failing on Drive are
now green end to end:

| job | result |
| --- | --- |
| Public clone fails closed (no private art) | success |
| Private staged art drives both identities natively | **success** |
| Real renders at 720p / 1440p / 2160p | **success** |
| Survival return UI (season, guidance, digest, record) | success |

`Real renders` steps, in order: fetch from Git → stage → import → male 720p → male
second-process Continue → female 720p → female second-process Continue → 2560×1440 →
3840×2160 → assert every capture carries the resolution it claims → summarise →
upload. Artifacts: `a6-native-captures` 21 623 596 B, `a6-capture-logs`,
`a6-fail-closed-logs`, `a6-return-ui-logs`.

`Private staged art` steps: fetch → stage → import → male journey with death/respawn
and a separate-process reload → female journey, same → A0 menu journey whose identity
assertions gate the job → evidence summary.

Both archives are fetched from a **public** repository branch. Per the licence
boundary this is flagged rather than celebrated: CraftPix permits shipping the art
inside a game but not redistributing source packs, and a branch of a public repository
is still public. Recommended follow-up, owned by the creator: move those two packs (or
the whole asset branch family) to a private repository, or run them through a
restricted transfer, and set `A6_ASSET_TOKEN`. Nothing here uploads a ZIP as an
artifact, and the raw archives are deleted from runner temp after staging.

## 4. Real A0 state in the return UI, across a process boundary

New `tests/survival/ui/a6_a0_consumer_test.gd`, run twice by
`tools/run_a6_return_ui_gate.sh` in two separate engine launches sharing one save
file:

* **phase write** plays the player through A0's own API — grant 12 wood and 3 iron,
  place a wall with `SurvivalService.place_structure`, then `SaveService.save_now`.
  No A6 code runs in this phase;
* **phase read** is a fresh process. It mounts the return layer with **no injected
  projections** and asserts the card shows exactly A0's saved numbers (structure
  count, material total of the real `inventory_totals`), while every projection A0 has
  not published is refused with a named reason — season clock, durable run facts,
  return digest (no production rows invented) and history. It then proves the save
  file is byte-identical after the UI was shown.

This is the first A6 evidence that survives an OS restart rather than a single engine
instance. It also found a real mistake in my own first draft: I asserted the
unavailable digest had `visible == false`, but the contract returns no `visible` key
at all — the correct claim is `available == false`, an empty production list and a
non-empty reason. The test asserts that now.

## 5. Evidence separation

1. **Source correctness — PASS.** 205-check return UI native gate plus the new
   two-process consumer test, on the hosted runner.
2. **Real native avatar runs — PASS.** Male and female journeys with death/respawn and
   a separate-process reload, driven by the authentic staged sheets, green in CI at
   720p/1440p/2160p capture.
3. **Avatar visual acceptance — PARTIAL, stated precisely.** The **source sprites**
   were inspected here at 1×, 5× and 8× and are correct (section 2). The **rendered
   PNGs** from `a6-native-captures` could not be opened from this environment: the
   artifact download redirects to a blob host that is unreachable here. So the
   in-engine appearance is verified by the run's own assertions, not by my eyes.
4. **A0 production mounting — PARTIAL.** The avatar capture runs through the real
   `app_root` consumer scene, and the identity assertions of the A0 menu journey gate
   that job. The return UI is proven against the real `SaveService`/`SurvivalService`
   across two processes, but A0 still publishes no season clock, durable run facts or
   return digest, so the return card is honestly empty in the real game.
5. **D055–D061 owner projections — DEPENDENT, unchanged.** See the return UI contract
   §8. Grade-1/2 gender-matched armour remains source-blocked and was not faked: only
   grade 0 was staged.

## 6. What is still open

1. Open the hosted `a6-native-captures` PNGs by eye (blocked here, one `gh run
   download` away from a network that can reach the artifact blob host).
2. Grade-1/2 armour sources (separate approval gate; cannot block grade 0).
3. A0 to publish the D055/D057/digest/history projections so the return card has
   something real to show; the honest empty state is what ships until then.
4. Creator decision on moving the licensed packs out of a public repository.
