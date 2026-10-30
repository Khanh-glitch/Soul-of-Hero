# GOLD93 private original source access (handoff, 2026-10-30)

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
