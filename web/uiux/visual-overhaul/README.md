# Soul of Hero — UI/UX Visual Overhaul · Wave 4

Isolated source-driven visual candidate, NOT authoritative Gameplay runtime.

Original creator ZIP SHA-256: `9a1f0b3ddfe456ac67c7a5ce595dac94c7015305f51f5a6b7690f2a143a32237`.

54 PixelFX PNGs recovered byte-for-byte from embedded PNGs in the supplied standalone HTML. See `docs/PIXELFX_RECOVERY_SHA1.txt`.

## Run

```bash
npm ci
npm run verify:assets
npm run typecheck
npm test
npm run build
npm run dev
```

Do not copy `src/game`, geography, persistence, or balance into `web/src`. Extract and review UI-only changes with Gameplay R12 contracts.

The Creator ZIP's historical `docs/bible.md` was excluded; the only current gameplay canon is at `web/ref/bible.md`.
