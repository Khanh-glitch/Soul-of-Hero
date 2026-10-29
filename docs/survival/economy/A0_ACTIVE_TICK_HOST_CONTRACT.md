# A0 authoritative active-tick host contract — SURV-030A E-02

Status: **A3 CONTRACT + NATIVE FIXTURE TESTS; PRODUCTION A0 HOST NOT INTEGRATED**.

A3 no longer accepts `advance(station_id, ticks, event_id)`. The production-facing API is:

```gdscript
advance(station_id: String, request: Dictionary, event_id: String) -> Dictionary
```

`request` is not a time grant. It is a claim that must exactly match the injected A0 host snapshot at commit time. A3 obtains the authoritative snapshot through `configure_time_host(host)`, where `host.call(station_id)` is a pure read of A0-owned active-session state. UI code must never be able to supply or mutate the host.

## Versioned receipt: `soh.economy.active_tick.v1`

Required fields, exactly these and no extras:

| field | type | meaning |
|---|---|---|
| `contract` | String | `soh.economy.active_tick.v1` |
| `station_id` | String | stable placed-station id, or `hand` |
| `session_id` | String | opaque active-session id, max 96 chars |
| `session_index` | int | monotonic session counter owned by A0 composition root |
| `sequence` | int | monotonic receipt sequence within the session |
| `active_ticks` | int | cumulative active-session ticks for this station baseline, not wall-clock and not offline time |
| `station_revision` | String | stable placed-station revision; changes on replacement/identity reset |

A3 rejects: missing host, old integer tick API, extra `ticks` field, unknown fields, mismatch against host, non-integer counters, regressed sequence, stale session index, same session index with different session id, clock regression, zero elapsed time for a new event id, and deltas above `MAX_TICK_QUANTUM = 600`.

## Baseline and pause semantics

- When a job is enqueued, A3 captures the current host baseline if available. This prevents retroactive credit for time before the job existed.
- If no baseline exists, the first accepted receipt establishes one and applies **zero** ticks.
- A new `session_index` resets station baselines. Reload therefore cannot grant offline catch-up.
- If the station resolver reports removed/disabled/broken, A3 pauses queued/running jobs and advances the baseline to the current receipt without applying production. Disabled time is consumed, not banked.
- If `station_revision` changes, A3 pauses old jobs and rebaselines. Old jobs do not inherit time from a different physical station identity.
- If the station is operational but a job's required kind/tier no longer matches, that job pauses.
- Accepted active deltas are applied to jobs in stable job-id order. Remaining delta after a job completes flows to the next job; idle time after all jobs complete is not banked.
- Time baselines are bounded: current session, current station plus unresolved-job stations, capped at 256 entries. Pruning a baseline is safe because the next receipt re-establishes it with zero retroactive credit.

## A0 production obligations

A0 must provide the host from authoritative fixed-step/active-session state, not from UI buttons or save-editable counters. A0 must also provide the station resolver with `ok`, `station_id`, `kind`, `tier`, `queue_capacity`, `operational`, `condition`, and `station_revision`. Power/condition/breakage/roof/bed/pause policy remains A0-owned. A3 does not invent realtime, server verification, or offline progress.

## Native fixture evidence

The native suite uses an explicit fixture host to prove: duplicate tick event idempotence; new event id with no elapsed clock rejection; forged `active_ticks` rejection; missing host fail-closed; oversized quantum rejection; stale sequence/session conflict; reload baseline zero credit; power-off/removed station pause; revision-change pause/resume; mixed-kind refusal; queue capacity and fairness; cancel/collect escrow recovery after station removal.

This is **NATIVE_FIXTURE_PASS**, not production world tick integration.
