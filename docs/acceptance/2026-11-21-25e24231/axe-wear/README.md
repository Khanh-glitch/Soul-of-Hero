# Stone tool wear on the New-Game oil route, before and after the pickaxe retirement

Measured on 2026-11-24 for the Creator's question "does one tool line cost more axes?".

| File | Code | What it is |
|---|---|---|
| `route-oil-98ee24ac.json` | `98ee24ac` (axe + pickaxe) | `SOH_WRITE_ARENA1=1` output of `tests/arena1-round2-newgame-routes.test.ts -t "ROUTE OIL"` |
| `route-oil-384b35ad.json` | the source of `384b35ad` (axe only) | same command |
| `patch-bot-98ee24ac.py` | | the bookkeeping patch applied to `tests/helpers/newgame-bot.ts` of `98ee24ac` for this run only (it is part of the helper from `384b35ad` on) |

The numbers are in `route_oil.end`: `toolWear` (durability points spent per tool, keyed by the material of the source
being worked, `fight`, or `other`), `toolsCrafted`, `toolsBroken`, `toolRepairs`. The ledger only reads the pack before
and after each tick; it changes nothing the bot does.

Limits: one seed (7), one route, an engine bot that knows the source map. The two bots are not identical: from
`c829a57f` the bot carries one spare Stone Axe, leaves a broken one on the ground and drops unused by-products when the
pack is full. Read the comparison as one observation, not as a balance measurement.
