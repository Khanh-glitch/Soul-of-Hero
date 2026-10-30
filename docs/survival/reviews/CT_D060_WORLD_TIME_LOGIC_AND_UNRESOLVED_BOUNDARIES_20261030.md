# SOH D060 — Continuous world time and causal offline simulation
Status: user-approved time-continuity principle; detailed system rates and hazards remain under design review. Recorded 2026-10-30.

## Exact user correction
“câu hỏi của bạn đơn giản là hãy nhớ thời gian trong game vẫn trôi kể cả off hay onl, còn lại thuận theo logic.”

This supersedes the assistant's false choice between an advancing world only when playing and a continuously advancing world. There is one world timeline, including time spent with the application closed. The user did NOT lock 2 fictional years per 14 real days, a 40-minute virtual day, an offline enemy raid, or any specific production yield. Avoid re-asking calendar continuity.

## Already approved boundaries
D055: each run lasts 14 real calendar days including app-closed time.
D056: next run resets all gameplay; only global achievements and past-run records survive.
D057: starter-guide missions reset, but do not force returning players into a fixed order.
D058: new run begins at a broad random valid safe spot, not a fixed start.
D059: offline hunger consumes authentic provisions; at valid shelter, offline hunger alone may lower HP to 1 but not kill; outside shelter, starvation risk remains genuine.
D060: the world clock progresses in both online and offline intervals.

## Three categories of time-dependent consequences
A. **Pure world continuity**: day/night, in-world calendar, regional seasonal climate, weather conditions and environmental state must be derived from the same elapsed timeline. No arbitrary pause at logout.
B. **Prepared/physical processes**: planted crops, queued smelting, already-funded research, cooking, water collection, and provision consumption may advance with time. Every outcome must depend on actual water, soil, temperature, supplies, fuel, queues, storage capacity, and the end-of-run boundary. A completed task waits for player action where appropriate; do not invent an automatic next queue.
C. **Agency and hazards**: travel, mining, chest looting, boss kills, Skill Core finds, quests requiring player action, and combat do not become automatic merely because time passes. Monster navigation, home damage, storms and natural disasters while the app is closed require separate consequence rules and fair warnings. The online-away-from-home monster-tracking requirement must not be confused with application-closed simulation.

## Engineering proposal — coherent but not a new user lock
A0 derives world date and weather from a persisted run timestamp and a chosen time-scale parameter. On returning, calculate effects over the elapsed interval and commit them atomically once, instead of running the full engine during app closure. A3 validates rates, materials and output; A1 handles soil, climate and terrain; A6 displays truthful results and forecasts; A7 independently tests interrupted loads and conservation. All returned scenery must match the authoritative save state.
An ordinary A3 source cooldown currently defined in ACTIVE seconds is a separate source rule, not proof that the world clock pauses. Its use for natural/ecological sources needs re-evaluation under D060; do not silently redefine old economics.

## Time math and season design
At 3 fictional days per 2 real hours, 1 fictional day is 40 real minutes. Continuous 14 real days then comprise 504 fictional days. If one fictional year has 365 days, this is about 1.38 years; two such years require about 27.6 real minutes per fictional day. These previous numbers were examples, not votes. Recommend benchmarking at least a 40–60-minute visual day and meaningful seasonal intervals, adjusting fiction calendar and agriculture together. Do not force exactly two years or fake climate changes only at login.

## Clear minimum fidelity
At an 18-hour return: visual crops may be ready, a forge batch may be complete, research may be done, and local weather may have changed — **if the player had correctly provided everything beforehand**. Each report must explain quantity and stopping reason. No magical unattended mining, auto-harvest infinite loop, Core generation or repeatable claim duplication. If a season expired during absence, settle events only until the deadline and then record the run.
## Unresolved decisions by type
1. **CT-selectable after tests:** virtual day/year lengths, phase length, weather-front movement, region temperature curves, craft timers, spoilage tolerances, nonblocking display of return results, state-reconciliation strategy.
2. **Needs a user-feeling decision only if material:** whether hostile creatures and disasters may damage assets while the entire app is closed, especially if recovery is impossible; how severe long offline absences can be without turning real life into login duty.
3. **Await source/balance evidence:** which plants grow across seasons; water/ore/fuel conservation; how an unloaded world presents a flood or frozen bridge; whether A3 natural restock moves from active-only to world-elapsed; how to avoid seasonal bottlenecks and softlocks.

## Cross-system acceptance
Test 2h, 18h, 48h and expiry-adjacent returns in different biomes. Compare active time vs equivalent offline time at the same world timestamp: weather and ready products must agree given identical inputs. Prevent duplicate output and consumption after reopening twice. A valid shelter preserves D059 1HP rule; world climate never immediately invalidates D058 safe spawn. A1 terrain and AVFX must keep Gold visible at night, in fog and during storms. Native production acceptance and human playtest remain NOT TESTED for this new decision.
No agent dispatch, no PR merge, no approval of specific simulation rates by writing this note.
