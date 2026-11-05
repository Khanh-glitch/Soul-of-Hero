# M1–M4 gameplay integration handoff

All values below are SOH adaptation/tuning unless specifically sourced. The web New Run is the scope; fixture tests are not a human playthrough.

## M1: optional electrical workbench

At a level-2 workbench install a module for 3 Mechanical Parts, 3 Fasteners, 4 Spares and 2 Iron Ingots. Link a player-owned Field Generator within three tiles and with an unobstructed physical line; enable the module. A generator defaults to defense priority; its panel offers production priority. An active queued job competes for capacity with enabled linked turrets. Selected jobs run at the provisional 2× speed; otherwise work is manual at 1×. Capacity two needs the existing paid generator reinforcement. Each allocated load uses fuel; an enabled generator idles at one load. The simulation splits at job and fuel boundaries; linked generator removal clears links. The paid installation, links and priority persist. No requirement for power is added to existing recipes.

## M2: claim repair reserve

Interact with your Claim Totem, select a physically owned, intact Wood or Iron-bound Chest built on that claim and enable the reserve. Put actual repair materials in that chest. After an existing nonlethal physical hit/contact on the claim's structures, the reserve spends the manual repair cost (ceil one quarter of each construction ingredient, minimum one) and restores ceil one quarter of max HP. Each hit can consume a full repair cost even for a small amount of damage; opt out if that is undesirable. It cannot resurrect a destroyed structure, repair item-deployed structures excluded by manual repair, use inventory, or invent attacks or weather decay. Loss/removal of the chest disables the link; loss of the claim makes the reserve inert. Offline evidenced trace impacts can trigger and report real consumption. Reserve tests use labeled state fixtures; an actual browser playthrough is still needed.

## M3: existing physical progression

The research table now exposes directed targets, blueprint outcome, station/level, recipe time, craft ingredients, research time and Spares cost. It still uses existing random/directed/specimen modes, physical queue reservations, cancellation and physical blueprint pickup/use. A Damaged Drive can be reserved at the workbench with one Scrap for one Mechanical Parts, or individually reserved at the Foundry Recycler for two Spares; it cannot be in both places. Spares compete for research, the existing finite trader offers and machinery. Mechanical Parts have existing equipment, workbench, generator, cart and module sinks. Tests cover custody and destructive exclusivity but are not a natural journey.

## M4: leaving and returning

The menu estimates depletion and survival from current HP/hunger/thirst under **neutral** exposure, warning that the estimate excludes other hazards and expiry. The return report includes actual hunger and thirst changes, physical production, evidenced impacts and reserve costs. A sheltered character cannot die from hunger alone; thirst, radiation and actual nearby fire can still kill. Cold shelter is still the pre-existing simplified offline model: sheltered areas suppress the zone-cold calculation, rather than simulating online warmth and temporary cold exposure. Creature combat without reconstructible trace evidence remains unresolved, not invented.

**Provenance:** the official LI 2020-08-26 update states that offline 100 hunger points last 24 hours: https://hero.yingxiong.com/info/2020/0826/10634.html . That article describes its own mode; applying the numerical baseline to SOH is an adaptation, not a claim of identical rules. LI's 2020-04-29 update introduces thirst but does not give a drain rate: https://hero.yingxiong.com/info/2020/0429/9792.html . SOH therefore provisionally uses thirst at 1.5× the hunger rate (100 in 16 hours), preserving the prior online rate ratio, **not** a historical LI rate. Existing offline damage/environment factor remains. Real saved timestamps determine elapsed time; no supplies are created.

A source already burning within the online 18-pixel radius causes stationary offline-body fire exposure. This is a provisional continuous approximation of the existing 6 damage per roughly 900 ms with armor; it respects committed burnout, spread and rain boundaries but does not reconstruct hit knockback, invulnerability frames or full physical combat. It is not exact online fire parity. Time is never fabricated and rain does not damage houses. Values are centralized in `web/src/game/balance.v1.json`.

## Still required for acceptance

- A complete natural real-input New Run journey through gathering, shelter, research, generator/turret allocation, reserve, save/reopen and observed consequences. No QA grants, state injection or teleportation should be substituted for that proof. `web/e2e/m1-m4-new-run-smoke.mjs` covers only a fresh start, movement, preparation menu and save/reopen; the 640×360 screenshot shows that partial route.
- Further M1 tests for cancellation and full-output boundaries, plus real browser testing of the power and reserve menus. Blocked-link and two-load fuel cases have fixture regression coverage. Existing tests are regression evidence, not proof of the full journey.
- Creator validation of provisional SOH coefficients and the costly per-hit maintenance policy; no verified LI thirst coefficient is available from the consulted sources.
