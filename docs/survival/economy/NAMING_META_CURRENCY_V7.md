# V7 currency naming — working title, not save schema

The creator’s spoken phrase **“tiền suy ngụ”** is an unverified speech transcription. It is not a canonical product name, item ID, localization key, or SaveService receipt field.

## Proposed Vietnamese fantasy terms
| Term | Meaning | Fit |
|---|---|---|
| **Tàn Ấn** (recommended WORKING_TITLE) | Remnant/residual seal | Late-Ragnarok residue; physical seal-like token; survives as a preserved mark. |
| Dư Ấn | Surviving/remaining seal | Emphasizes what remains after catastrophe. |
| Hồi Ấn | Return/echo seal | Emphasizes cross-season return. |
| Di Tích Ấn | Relic/ruin seal | Emphasizes archaeological provenance. |

## Separation of concerns
- Technical item ID: `ragnarok_unbanked`
- Physical contract ID: `currency.ragnarok_unbanked`
- Profile field: `profile.secured_ragnarok_currency`
- Display registry: `data/survival/items/meta_display_names.v1.json`
- SaveService receipts: `proposal_id`, `run_id`, `source_instance_id`, `endpoint_id`, `amount`, `policy_sha256` — never display names.

Changing the displayed name later requires editing the display registry only. It must not require a save migration or rewriting economic contracts. This currency is distinct from run-local **Spares** (`knowledge_spares`) and from the six unique elder achievement stones.
