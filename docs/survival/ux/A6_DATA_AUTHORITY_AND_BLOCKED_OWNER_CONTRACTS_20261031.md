# A6 data authority — what A6 draws, what it refuses to invent, and what it needs

Round 12, 2026-10-31. Authority: `CURRENT_PRODUCT_CONTRACT.md` and `DECISIONS.md`
D051–D074 at `origin/feature/survival-rpg-foundation-20261029` @ `3c6a9ae5`.
Owner pins cited by the A6 work order: `save_service.gd` `84ac9c1a…`,
`economy_service.gd` `35214ed8…`.

A6 is a **read-only** surface (D074). Every number it shows is handed to it by A0, A1 or
A3 as a projection. This file is the exact boundary: the contract each owner publishes,
what A6 does today while the contract is missing, and the test that keeps A6 honest.
It is a request list, not a claim that any of it exists.

## 1. The rule this file exists to enforce

> If the owner has not projected it, A6 draws nothing. A plausible number that
> disagrees with the save is worse than a blank row.

Two consequences that are easy to get wrong:

* **Absent is not zero.** A missing wallet projection is "nothing to show", not
  `0 Ragnarok`. A missing clock is not "0 days left". `sanitize_*` returns
  `available = false` with a `reason`, and the UI omits the row.
* **A6 never derives an owner value.** The one allowed arithmetic is on values the
  owner already gave: seconds remaining between two owner timestamps, and the D065
  window boundary (`ends_at_unix − 72 h`). No summing chests, no converting junk,
  no assuming a deposit happened.

## 2. Contract status per value

`available` means the projection exists **and** is validated by A6. `blocked` means no
owner publishes it; A6 shows nothing and this row is the request.

| player value | contract | owner | A6 today | status |
| --- | --- | --- | --- | --- |
| run window, days left, end reason | `soh.a6.season_clock.v1` | A0 | validated; row hidden when absent | **available** |
| D065 last-72 h Ragnarok window | derived from the clock above | A0 (timestamps only) | `ragnarok_window()`, pure arithmetic | **available** |
| settled offline production | `soh.a6.return_digest.v1` | A3 what, A0 when | validated; empty sections dropped | **available** |
| per-run durable actions | `soh.a6.run_facts.v1` | A0 | validated; `unknown` when unbound | **available** |
| digest acknowledgement | `soh.a6.digest_ack.v1` | A0 | validated; run-bound | **available** |
| achievements, run history | `soh.a6.run_history.v1` | A0 profile | validated | **available** |
| perceived site cues (D061) | `soh.a6.site_cues.v2` | A1/A8 world | validated; expired dropped | **available** |
| **secured Ragnarok currency** | `soh.a6.account_wallet.v1` | A0 `profile.secured_ragnarok_currency`, priced by A3 | contract + validator landed; **no UI row yet** | **contract ready, owner silent** |
| hour of day / in-world time | — | A0 (D060 continuity) | nothing drawn | **blocked** |
| equipped tool | — | A0 equipment, A3 item data | nothing drawn | **blocked** |
| equipment durability | — | A0, A3 | nothing drawn | **blocked** |
| Core charges (D072) | — | A3 core state, A0 persistence | nothing drawn | **blocked** |
| death bag / recovery (D073) | — | A0 | nothing drawn | **blocked** |
| appearance grade 1/2 | `soh.ui.avatar_appearance.v1` | A0 | grade kept at 0, gate named | **source-blocked (D051)** |

## 3. The seven exact requests

Each is shaped to be implementable without a further conversation: a schema string, a
field list with types, and the rule A6 applies when a field is wrong.

### 3.1 `soh.a6.account_wallet.v1` — secured Ragnarok currency

D056/D064 persist exactly `profile.achievements`, `profile.run_history` and
`profile.secured_ragnarok_currency`. D066 says the cash is a physical item until a
**physical secure deposit**, so a balance is only meaningful together with whether the
deposit already happened.

```json
{
  "contract": "soh.a6.account_wallet.v1",
  "provenance": "A0_OWNER_PROJECTION",
  "amount": 0,
  "currency_label": "Ragnarok",
  "secured": false,
  "revision": "wallet:r<n>"
}
```

* `amount` — integer, never negative. A string is refused rather than parsed; A6 will not
  guess whether `"420"` is currency or a token.
* `currency_label` — player-facing, ≤ 40 chars, and rejected if it contains a source
  token (`soh.`, schema names, `_v1`). D052: no raw ids in release UI.
* `secured` — A0's answer to "did the deposit physically happen". A6 never infers it
  from the amount, and never shows a banked total for an unsecured pile.
* `provenance` — must be `A0_OWNER_PROJECTION` or `A3_OWNER_PROJECTION`. A fixture or a
  locally computed balance is refused, which is what makes this testable without
  pretending.

Implemented in `A6ProjectionContract.sanitize_account_wallet`. **Requested of A0:** emit
this on the return path and after every deposit. **A6 still owes:** the row itself on
the season record card.

### 3.2 In-world time and season (`D060`)

Needs `{ "contract": "soh.a6.world_time.v1", "day_index": int ≥ 1, "hour": 0–23,
"phase": "dawn|day|dusk|night", "season_day": int 1–14, "provenance": "A0_OWNER_PROJECTION",
"revision": str }`. A6 renders a clock chip and a day/night tint only from this. It will
not compute an hour from wall time, because D060's rate is an A0 engineering choice and
a second implementation would drift.

### 3.3 Equipment (`D052`, D051)

Needs `{ "contract": "soh.a6.equipment.v1", "tool": {"id", "label", "grade"},
"armor_grade": 0–2, "revision" }`. A6 already receives `armor_grade` through
`soh.ui.avatar_appearance.v1`; what is missing is the **tool** slot the HUD would draw.
Until then the HUD shows no tool, which is honest: the player is not told they hold
nothing, they simply are not shown a slot.

### 3.4 Durability

Needs `{ "contract": "soh.a6.durability.v1", "entries": [{"slot", "remaining", "maximum"}],
"revision" }` with `0 ≤ remaining ≤ maximum`. A6 draws a bar only when both numbers are
present; a bare percentage is refused because it cannot be checked against a maximum.
There is **no durability anywhere in this repository today** — the return UI could only
fake it, so it shows nothing.

### 3.5 Core charges (`D072`)

Needs `{ "contract": "soh.a6.core_charges.v1", "cores": [{"id", "label", "charges",
"maximum", "commit_state"}], "revision" }` where `commit_state` is
`"ready" | "committed" | "recharging"`. D072 debits on the committed cast effect and not
before, so A6 must display the owner's commit state rather than infer a charge from an
animation.

### 3.6 Bag recovery (`D073`)

Needs `{ "contract": "soh.a6.death_bag.v1", "available": bool, "distance_hint": str,
"contents_summary": str, "expires_at_unix": int|null, "revision" }`. D073 allows exactly
one bag per death event and forbids a surprise short timer; if `expires_at_unix` is
absent A6 shows no countdown at all rather than a default.

### 3.7 Offline outputs

Already covered by `soh.a6.return_digest.v1`; the only open item is that the values in
the published frames are fixture-projected. When A0/A3 emit the real digest the same
validator runs unchanged — no consumer edit is expected.

## 4. The tests that hold this line

| test | what it proves |
| --- | --- |
| `tests/survival/ui/a6_data_authority_consumer_test.gd` | wallet accepted only from an owner provenance and printed unchanged; negative, textual, unlabelled and token-labelled balances refused; evacuation kept as its own run ending; D065 boundary exact on both sides; no A6 file declares a wallet/clock/durability/Core/bag copy; no wallet writer exists in A6 |
| `tests/survival/ui/a6_survival_return_native_test.gd` | the existing return-surface contract (clock span, run binding, digest sections) |
| `tests/survival/ui/player_avatar_consumer_contract_test.gd` | grade 1/2 either legal grade-0 fallback with a named gate or explicit `SOURCE_BLOCKED`, never a silent READY, unchanged across a reload |

Both new headless tests run in `a6-survival-ui-render.yml` before any window is opened,
so a fabricated value fails the job before a frame is rendered.

## 5. What A6 will not do while these are blocked

* It will not add a manager, a ledger, a timer or a wallet of its own — not even a
  "temporary" one behind a flag.
* It will not read `SaveService` outside `a6_owner_projection_source.gd`; the scan in
  the test above fails the build if a second module reaches for the save.
* It will not show a zero, a star, a dash-as-value or a placeholder icon where an owner
  value is missing. The row is absent.
