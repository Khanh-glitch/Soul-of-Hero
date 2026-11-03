# Web Gameplay integration candidate

**READY_FOR_CREATOR_REVIEW** — a runnable development candidate for human review, not production approval, full economy acceptance, a 14-day playtest, or a security/anti-cheat claim. The creator accepted the K3/K4 implementation checkpoint only.

## Source and review

- Integration branch: `arena/d4bfcfff-soul-of-hero`. The review PR is the existing draft [#44](https://github.com/Khanh-glitch/Soul-of-Hero/pull/44), reused rather than creating a separate PR. Its base is draft [#38](https://github.com/Khanh-glitch/Soul-of-Hero/pull/38), which remains open. Both are preserved; neither was merged or closed.
- #38's exact commit `acaa002746061d9e2abe828ccc8a10bba9fc891d` is an ancestor of #44's accepted implementation checkpoint `06c87a45c868d834d0aa554b1806a88eb54e1a88`. Thus the candidate builds on the actual #38 tree, not a separate mockup or cherry-picked approximation. See the PR for the exact latest candidate HEAD.
- The integration follow-up changes dev dependencies, adds a focused smoke script and evidence, and this handoff; it does not rewrite gameplay. Sole Bible: `web/ref/bible.md`.

## Launch

Requirements: Node.js `^20.19.0 || >=22.12.0` (tested with Node `v22.22.3`, npm 10), npm and a modern desktop browser. From the repository root:

```sh
cd web
npm ci
npx tsc --noEmit
npm test
npm run build
python3 -m http.server 4173 --bind 0.0.0.0 --directory dist
```

Open `http://localhost:4173/` on the same machine. The build is a self-contained `dist/index.html`; use HTTP rather than relying on browser-specific `file://` storage behavior. Save data is local to that browser **and origin**. A preview URL, localhost, and a different port do not share saves automatically; keep backups before upgrading, and do not assume rollback to #38 will read candidate saves. Runs are local/unverified; the 336-hour run clock includes time away. Keyboard/mouse: WASD, aim/mouse button, E interact, I inventory, C crafting, Esc menu.

## Focused checks and evidence (agent-run)

- Clean `npm ci`, TypeScript, **121/121 tests in nine files**, and production build passed after upgrading Vite to 7.3.7, Playwright to 1.55.1, Vitest to 4.1.12 and the locked esbuild to 0.28.2. `npm audit` reported **zero vulnerabilities** at the check time; audits change as advisories are published. No independent CI checks were reported on #44.
- Actual production browser, isolated fresh profile: New Run at Pinewatch, real WASD movement, inventory selection and consumption of one berry, inventory and crafting panels, Save & quit, browser reload and Continue. Run identity, position, inventory/equipment, entities, source deltas and knowledge were compared to the saved snapshot. No page errors were observed in this short path.
- Direct forward compatibility: archived **#38 source at the exact SHA above**, built it with the candidate's installed toolchain, served the resulting production build, created/moved/consumed/saved a real #38 run in a fresh browser context, then replaced the served index with the candidate at the **same origin**. Continue preserved that run's identity, position, inventory stack identities/quantities, equipment, entities, source state and knowledge; candidate save/reload/Continue also worked. The legacy layout remained legacy. This was one simple early-run save: no player-built station, cart, depleted source, queued job, rollback, or large save corpus was exercised in that browser check. B1/B2 tests provide additional focused coverage, not a general migration guarantee.
- `web/e2e/production-smoke.mjs` passed against the production build using an **injected fixture** and real UI input for field repair, paid furnace lining and queuing the empty canteen. This is not natural resource traversal. Earlier natural salt/campfire and bench/knife-repair examples and their screenshots predate this candidate.
- Current **natural-run** screenshots (actual viewport dimensions): `web/evidence/integration-candidate/natural-inventory-640x360.png`, `natural-crafting-640x360.png`, `natural-inventory-1280x720.png`, `natural-crafting-1280x720.png`. The fixture examples are separately labelled in `web/evidence/production-smoke/`.

The 640×360 screenshots show small pixel text and panels covering parts of the HUD/world; crafting covers the left HUD and overlaps the lower hotbar. At 1280×720 the fixed 640×360 stage is integer-scaled, improving apparent size but retaining those overlaps. Narrower screens, touch controls, assistive technologies and human readability have not been validated. Screenshots are observations, not a creator visual sign-off.

## Retained scope and known gaps

Physical, paid equipment/structure repair and research, broken-but-repairable gear, workbench progression, mechanical-parts alternatives, Salvager Pick/Axe, shell glass, Root Broth, Palm v2, freight cart/cargo, garden choice, portable repair, furnace lining, fuel, empty/refillable canteen and inventory/crafting are in the integrated tree. Source/catalog and cost details, exact limitations and two costed chains are in `PRODUCTION_NETWORK_CONTINUATION.md`; all added numbers remain TUNABLE. Run-owned assets/knowledge reset; secured cash, legitimate achievements and history are profile-local. Shelter only prevents hunger death, not thirst or other hazards.

Before production acceptance: human gameplay/balance/readability review, broader real #38 saves (including built stations, queued work, cargo and depleted resources), independent CI, separate-process home/offline checks and a natural long production route remain open. Offline cold has coarse clothing semantics; pulling a cart does not apply the player's carried-load penalty; older builds are not guaranteed to load new metadata. Procedural art is project-authored, not a final art/accessibility review. Full 14-day enjoyment, general exploit absence, verified clocks and trusted leaderboards are not established. The older production-network document's HOLD concerns full content/economy acceptance, not this narrower creator-review readiness.
