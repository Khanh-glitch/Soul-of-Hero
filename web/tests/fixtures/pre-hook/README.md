# Actual pre-partition save compatibility fixtures

Source: `3682329719b9cdd1eadaeed791f0ea8c29733714`, immediately before inherited `7d00481`.
Exported 2026-11-17 in an isolated `git archive` of that commit, **not** by forging the old digest in current source. No branch switch.

`3682329.json.gz` contains four original checksummed snapshot envelopes (three inspection windows: 2500/600, 2496/608, 2598/600) and six independently computed world/source fingerprints (same windows, placement rules 3 and 4). The last origin clips the changed coordinates at the compiler's window edge. All snapshots were created under actual legacy `startRun`, validated and serialized there. One snapshot explicitly places the QA player on a legacy walkable, non-prop cell subsequently closed by the partition; this is a compatibility fixture, not a claimed walking journey.

Exporter source is preserved as `export-hook.test.ts.txt`. To reproduce, archive `web/src`, `web/geography`, `web/scripts`, `web/ref`, `web/package.json`, `web/tsconfig*.json`, `web/vite.config.ts`, and the approved G1B runtime contract JSON from the exact commit into an ignored directory; provide its dependencies, place the exporter under that archive's `web/tests/export-hook.test.ts`, adjust only its output path, and run project Vitest. It emits gzip JSON; the `commit` metadata in the checked-in bundle is the full source SHA. Source code and snapshots are otherwise unchanged. The `.txt` extension prevents accidentally exporting current-source fixtures in the ordinary suite.

Compressed fixture SHA-256: `f5af8103f279c796bf38de64eb00850a24c70542b11aead41e11f68f08ae92df`.

Regression: `tests/solo-hook-save-compat.test.ts`. On uncorrected inherited geometry, actual old snapshot `mapDigest=192faffd` was refused; current full-window geometry is `0a68b6c3`, with identical source digest `aae8303f`. The exact compatibility bridge normalizes only this known six-cell transform, never arbitrary map mismatches. Future geometry edits require their own compatibility evidence, not extending a permissive allowlist.
