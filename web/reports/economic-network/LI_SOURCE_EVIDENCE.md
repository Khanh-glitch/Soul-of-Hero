# Last Island & Soul of Hero — Economic Source Evidence Ledger (M1)

**Repository Baseline:** `Khanh-glitch/Soul-of-Hero` @ `52f27959f732aa8b47d6a897c9a5aa7d708cf926`  
**Audit Date:** 2026-11-11  

This ledger strictly separates **SOH live code verification** from **Last Island (LI) archive research** and **live-verified official/community LI sources**. Unretrievable or CAPTCHA-blocked targets are explicitly flagged; missing LI numbers are never invented.

---

## 1. Provenance Classification Vocabulary

| Tag | Meaning |
|---|---|
| `LIVE_VERIFIED_SOH` | Directly observed in `web/src/game/**` or `web/src/veyra05/**` at commit `52f27959`. |
| `LI_REPO_ARCHIVE_VERIFIED` | Directly read from `web/ref/atlas/extracted/**`, `web/ref/bible.md`, or `web/ref/OPERATIONS.md`. |
| `LI_OFFICIAL_LIVE_VERIFIED` | Fetched directly via HTTP during this audit from official publisher `hero.yingxiong.com`. |
| `LI_COMMUNITY_LIVE_VERIFIED` | Fetched directly via HTTP during this audit from `bbs.4399.cn`, `news.4399.com`, or `taptap.cn`. |
| `CAPTCHA_BLOCKED_AT_CHECK` | Live target returned an anti-bot slider challenge (`9game.cn`); marked blocked, contents NOT assumed. |
| `ORIGINAL_UNKNOWN` | Historical LI numeric parameter absent from both repo archive and accessible live documentation. |

---

## 2. Live SOH Authoritative Ground Truth (`LIVE_VERIFIED_SOH`)

- `web/src/game/catalog.ts` & `web/src/game/balance.v1.json` — Canonical definitions for `ITEMS`, `SOURCES`, `RECIPES`, `STRUCTS`, `CREATURES`, `ELDERS`, `PRIMORDIAL_ELDERS`, `VENDOR_SPARES`, `VENDOR_SECURED`, `CORE_STUDY`, `GARDEN_CROPS`, `ALWAYS_KNOWN_RECIPES`, `ACHIEVEMENTS`, and `BAL` constants.
- `web/src/game/engine.ts` & `web/src/game/sim.ts` — Authoritative command dispatcher (`harvestHit`, `killCreature`, `craft`, `research`, `recycleItem`, `build`, `buy`, `deposit`, `stepStations`, `stepBasePower`, `stepTerritory`, `stepLootRespawn`, `settle`) and live/offline simulation loops.
- `web/src/game/recycler.ts`, `industrial-proof.ts`, `loot-ecology.ts`, `loot-source-spec.ts`, `wreck-economy.ts`, `airdrop.ts`, `creator-loot.ts`, `husbandry.ts`, `motorbike.ts`, `journey.ts`, `world.ts`, `world-economy.ts`.
- `web/src/veyra05/{scenes,window,continuity,floors,ecosystem,reader,frame}.ts` & `web/src/veyra05/arch/{sites,plan,f01,f03,c01,c02,c03_recovery,c04,rest48}.ts` — 81-POI U=0.5 streaming world, multi-storey floor layers (`-1..2`), `ARCHETYPE_LOOT`, `RCASH_BY_POI`, `VENDOR_POIS`, `EVAC_POIS`, `ORDINARY_CREATURE_HABITATS`, `VEYRA_SIDE_BOSS_SITES`, `VEYRA_PRIMORDIAL_SITES`.

---

## 3. Repository LI Archive & Design Authority (`LI_REPO_ARCHIVE_VERIFIED`)

| Artifact Path | Contents Verified | Notes |
|---|---|---|
| `web/ref/bible.md` | SOH `K1`–`K8` & `C01`–`C24`, `336h` run / `72h` Ragnarok, cash-only escrow, Elder optionality | Locked SOH Canon |
| `web/ref/OPERATIONS.md` | Ownership boundaries (`Map` vs `Gameplay` vs `Visual` vs `Systems`) | Governance |
| `web/ref/atlas/SOURCE_MANIFEST.json` | Atlas manifest (`51` recipes, `82` loot_edges, `19` poi_access_edges, `17` systems, `12` unresolved) | Restored in baseline |
| `web/ref/atlas/extracted/ATLAS_v2.json` | Structured LI systems `S01..S17`, recipes, loot/POI edges, unresolved `U01..U12` | Core LI reference |
| `web/ref/atlas/extracted/LI_MASTER_RESEARCH_REPORT_v5.md` | Consolidated LI systems report (`S01..S17`, trade, metallurgy, POI ladder, raid/defense) | Matches `ATLAS_v2.json` |
| `web/ref/atlas/extracted/v10/data/CORE_ACTIONS_21.json` | 21-action Creator Core contract (`F01..F03`, `N01..N02`, `W01`, `S01`) | SOH Core Canon |
| `web/ref/atlas/extracted/v11/17_EXPLICIT_CROSS_SYSTEM_NETWORK.csv` | `104` explicit cross-system edges (`XEDGE-001..104`) across `SYS01..SYS18` | Mapped 1:1 in crosswalk |
| `web/ref/atlas/extracted/v11/13_CROSS_SYSTEM_GATES_32_FROM_v10.csv` | `32` architectural gates (`A00..A31`) | Mapped 1:1 in crosswalk |
| `web/ref/atlas/extracted/v11/10_CONVERSATION_36_DECISIONS_FROM_v10.csv` | `36` creator & provenance decisions (`H01..H36`) | Mapped 1:1 in crosswalk |
| `web/ref/atlas/extracted/v11/07_SOURCE_AND_RECOVERY_LEDGER.csv` | Prior custody notes explaining historical `v5/v6` ZIP gap (resolved here by restored `extracted/`) | Provenance audit |

---

## 4. Live-Verified Official & Community LI Sources

### 4.1 Official Publisher Announcements (`LI_OFFICIAL_LIVE_VERIFIED` — `hero.yingxiong.com`)

| URL | Title / Scope | Verified Economic / Systems Takeaways |
|---|---|---|
| `https://hero.yingxiong.com/m/news/dongtai/2025/0911/14825.html` | Base / Action-Base transfer & progression announcement (2025-09) | Confirms cross-server/action-base vault & blueprint progression models in modern LI modes |
| `https://hero.yingxiong.com/m/news/dongtai/2019/0823/6977.html` | Early 2019 patch notes (green/blue/purple cards, base mechanics) | Confirms Green/Blue/Purple card room & early mode wipe structure |
| `https://hero.yingxiong.com/m/news/dongtai/2022/0810/11237.html` | 2022 survival / trading / base maintenance update | Confirms Trade Hub / vending currency segregation & territory maintenance loops |
| `https://hero.yingxiong.com/m/news/dongtai/2023/1219/13285.html` | Late-2023 mechanics & electrical / base systems update | Confirms electrical circuit branches, generator consumers, and turret interactions |
| `https://hero.yingxiong.com/m/news/dongtai/2023/1106/13052.html` | Late-2023 major patch (vehicles, oil/energy, workbenches) | Confirms multi-tier bench gating, vehicle maintenance, and oil/fuel refinement loops |
| `https://hero.yingxiong.com/m/news/dongtai/2019/0827/7028.html` | 2019-08 POI & loot spawn adjustment | Confirms named-POI card/supply room escalation and airdrop competition |
| `https://hero.yingxiong.com/m/news/dongtai/2019/1010/7249.html` | 2019-10 vehicle / survival / item patch | Confirms motorcycle & chassis fuel/loot balance adjustments |
| `https://hero.yingxiong.com/m/news/dongtai/2021/1222/10634.html` | 2021-12 workshop / recycler / energy update | Confirms dedicated recycler component output and energy-tier workstation gates |
| `https://hero.yingxiong.com/m/news/dongtai/2024/0201/13400.html` | 2024-02 update | Confirms seasonal/mode event loot and facility tuning |

### 4.2 Community Guides (`LI_COMMUNITY_LIVE_VERIFIED`)

| URL | Verified Scope |
|---|---|
| `https://bbs.4399.cn/thread-tid-40162443` | LI Territory Cabinet upkeep, structural grades, raid costs, and early progression loop |
| `https://news.4399.com/zhytgz/xinde/m/895633.html` | LI POI card progression (Green -> Blue -> Purple), generator timing, and radiation zone prep |
| `https://www.taptap.cn/moment/304314693734893241` | LI Parts/Spares research economy, random vs workbench studying, and recycler value hierarchy |

### 4.3 Blocked Targets (`CAPTCHA_BLOCKED_AT_CHECK`)

The following `9game.cn` URLs from historical citation lists triggered Alibaba anti-bot slider verification (`CAPTCHA_BLOCKED_AT_CHECK`) and were **not** parsed or extrapolated:
- `https://www.9game.cn/daihaoyingxiong/3279007.html`
- `https://www.9game.cn/news/3676549.html`
- `https://www.9game.cn/news/3336352.html`
- `https://www.9game.cn/news/3448709.html`

---

## 5. Historical LI Parameters Remaining `ORIGINAL_UNKNOWN`

The following `ATLAS_v2.json` unresolved gaps (`U01..U12`) remain `ORIGINAL_UNKNOWN` for exact historical LI numeric tables and are explicitly implemented in SOH using `SOH_PROVISIONAL` / `SOH_NEW_TUNED` parameters (tracked in `balance.v1.json`):
- `U01`: Exact LI per-item Recycler yield curves -> SOH uses `recyclerV1`..`V4` + `COMPONENT_RULES` (`industrial-proof.ts` bounded below craft cost).
- `U02`: Exact LI per-container drop probabilities/stack sizes -> SOH uses `LOOT_CLASSES` (`loot-ecology.ts`) on Shipping, and `sites.ts` + `ARCHETYPE_LOOT` on Veyra.
- `U03`: Exact LI per-swing tool harvest & rare refined ore rate -> SOH uses `SOURCES` + `qualityBonus` (`rich_iron_ore`).
- `U04`: Exact LI furnace smelt duration/fuel ratio -> SOH uses `RECIPES` (`10-20s`) + `BAL.fuel` (`wood 20s`, `charcoal 55s`, `coal 80s`).
- `U05`: Exact LI crate respawn intervals across modes -> SOH uses `BAL.lootRespawn` (`12h/18h/24h`) on Shipping (`lootEcology`) ONLY; absent on Veyra.
- `U06`: Exact LI ammo craft batches & durability-scaled repair formulas -> SOH uses `arrow` (`6`/`8`), full item repair cost in `ITEMS.*.repair`.
- `U07`: Exact LI energy ore extraction & consumer wattage -> SOH uses `energy_basic`/`energy_refined` + `essence_*` + `basePower` slot allocation (`wire-v1`).
- `U08`: Exact LI Territory Cabinet upkeep cost formula -> SOH uses `BAL.territory.upkeepFractionPerDay = 0.25`.
- `U09`: FAMAS conflicting stats -> Not applicable (`H06`/`D01`: Core replaces firearms in SOH).
- `U10`: Gunpowder/sulfur ammo full recipe -> Not applicable (firearms replaced by Cores; sulfur feeds `core_fire`/`core_meteor`/`core_dragon`/`fuel_can`).
- `U11`: Exact LI vehicle fuel/wear/spawn tables -> SOH uses `BAL.motorbike` (`v3`) + `oilRefineryV1` lubricant.
- `U12`: Exact LI hazard/creature stat cards -> SOH uses `CREATURES`, `ELDERS`, `PRIMORDIAL_ELDERS`, and `seasonClimateV1`.
