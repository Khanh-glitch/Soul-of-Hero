# GOLD93 original source ZIPs — same-branch handoff

By the owner's explicit instruction, the two exact original GOLD source archives are now stored in this Soul-of-Hero Arena working branch. SHA-256 and ZIP CRC of both archives were verified before upload.
**Current confidentiality warning:** This repository was PUBLIC at the moment of this commit. Any person may copy these archives, and later changing visibility to private cannot revoke copies already obtained.

## Archives
- `prototypes/skill_readiness/original_sources/ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip` — 72 skills, 185751 bytes, SHA-256 `8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d`
- `prototypes/skill_readiness/original_sources/venomwright-combat-vfx-design (4).zip` — 21 skills, 489345 bytes, SHA-256 `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`

## Rehydrate after sandbox reset (no GOLD93_ARCHIVE_KEY needed)
Run from the repository root:
```bash
set -euo pipefail
SOURCES="prototypes/skill_readiness/original_sources"
mkdir -p /tmp/gold93-original-sources/arcana /tmp/gold93-original-sources/venomwright
echo '8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d  prototypes/skill_readiness/original_sources/ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip' | sha256sum -c -
echo 'ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716  prototypes/skill_readiness/original_sources/venomwright-combat-vfx-design (4).zip' | sha256sum -c -
unzip -oq "$SOURCES/ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip" -d /tmp/gold93-original-sources/arcana
unzip -oq "$SOURCES/venomwright-combat-vfx-design (4).zip" -d /tmp/gold93-original-sources/venomwright
```

Never commit extracted build artifacts or generated caches; keep working trees clean. GOLD source comparisons, especially visual parity, still require actual original renderer execution and owner visual review.

If repo visibility is later changed to private, confirm Arena's credential can still clone this repository before relying on access.
