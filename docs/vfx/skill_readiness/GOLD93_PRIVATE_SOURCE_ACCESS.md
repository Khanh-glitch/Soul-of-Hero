# GOLD93 source access — CURRENT: files are in this Arena branch

**Status 2026-10-30: UNBLOCKED for any agent that can fetch this Soul-of-Hero branch.** The owner explicitly authorized uploading the exact original GOLD93 archives into the VFX working branch, even though the repository was public at upload time.

**Authoritative same-repository location:** `prototypes/skill_readiness/original_sources/README.md`.

Archives (original bytes, SHA-256 verified):
- `prototypes/skill_readiness/original_sources/ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip`
- `prototypes/skill_readiness/original_sources/venomwright-combat-vfx-design (4).zip`

**Arena:** Fetch latest `arena/c7b0c4e8-soul-of-hero`, follow the README in `original_sources/`, verify SHA-256, and extract into `/tmp/gold93-original-sources`. You no longer need to clone the separate private vault or request `GOLD93_ARCHIVE_KEY` for this branch.

Visibility caveat: Git history containing these ZIPs was committed while the repository was PUBLIC. Later making the repository private does not revoke copies previously downloaded.

## Historical access attempt (superseded)

Previously the archives lived only in a private asset vault, which Arena could not read (403). That is NO LONGER the active blocker while these archives are available in this branch.

The project owner has already supplied both exact original source ZIPs, and they are now saved in a separate PRIVATE GitHub asset vault. The plaintext sources were NOT committed into Soul-of-Hero.

Private source repository: Khanh-glitch/APEX-CHAOS-ASSET-VAULT
Private branch: handoff/gold93-original-sources-20261030
Immutable verified commit: 725d12677a1b59777e1def767d12508e836a8332
Manifest: gold93/source_manifest.json
Original ZIPs:
- gold93/sources/ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip (185751 bytes; SHA-256 8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d)
- gold93/sources/venomwright-combat-vfx-design (4).zip (489345 bytes; SHA-256 ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716)

## Action for Arena / a newly reset sandbox

1. Use the GitHub identity already authorized for the private asset vault. Clone the private repository into a path OUTSIDE the public Soul-of-Hero tree:
   git clone --single-branch --branch handoff/gold93-original-sources-20261030 https://github.com/Khanh-glitch/APEX-CHAOS-ASSET-VAULT.git /tmp/gold93-private-vault
2. Verify the checkout HEAD is exactly 725d12677a1b59777e1def767d12508e836a8332 and verify the two files with sha256sum against the manifest.
3. Extract to /tmp/gold93-original-sources (or any other path outside the public game checkout); inspect/run original TypeScript/PixiJS and compare with Godot. Do not copy originals into public Soul-of-Hero.
4. No GOLD93_ARCHIVE_KEY is needed for these exact original ZIPs; the older public encrypted escrow is separate.
5. If GitHub returns 403/404, that is a private-repository PERMISSION issue for Arena's GitHub identity, not a missing-key issue. Report the exact permission blocker. Do not repeatedly ask the owner for archive keys or source ZIP reuploads.
6. Keep SOURCE_PARITY_VERIFIED, HOST_CASTABLE_VERIFIED, GOLD_VISUAL_COMPARISON_READY, OWNER_VISUAL_APPROVED and PRODUCTION_INTEGRATED independent. Never promote visual status from hashes alone.

IMPORTANT: Do not change the private vault visibility, print credentials, upload originals as public CI artifacts, or merge source into the public game tree.

## Sandbox access attempt log (2026-10-30, round directive)

- `git clone --single-branch --branch handoff/gold93-original-sources-20261030 https://github.com/Khanh-glitch/APEX-CHAOS-ASSET-VAULT.git` → `remote: Write access to repository not granted.` / `HTTP 403`.
- `gh api repos/Khanh-glitch/APEX-CHAOS-ASSET-VAULT` → `403 Resource not accessible by integration`. The `gh` identity is `Khanh-glitch` (GH_TOKEN), but it has no read permission on this private repository.
- Result: permission blocker for the Arena GitHub identity. Not a missing key. Needed: read access for that identity (or reconnect GitHub in Arena). No ZIP, hash or plaintext was fetched, stored or committed.
