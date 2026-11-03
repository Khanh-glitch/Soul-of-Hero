# SURV-UX-010A continuation — local test evidence

Code and fixture screenshots tested at **`4971c8f4df6219a2ceedb5e83c1272d089c712ec`**, clean working tree after tests. This evidence document and raw logs are added in subsequent evidence-only commits, not retrospectively claimed as a tested code SHA. Godot `4.7.stable.official.5b4e0cb0f`; Linux/Xvfb, Mesa llvmpipe GL compatibility. Raw stdout/stderr: `tests/survival/ui/evidence/a6-4971-*.log`. Audio libraries unavailable; dummy audio and VSync warnings; not audio tests.

| Test | Command/setting | Result | What it proves |
|---|---|---|---|
| Journal headless | `godot --headless --path . --script res://tests/survival/ui/ui_test.gd` | 21 checks, 0 failures | Isolated scene, fake stack records, real catalog, GUI input/focus/scroll/rejection labels. |
| Planner headless | `godot --headless --path . --script res://tests/survival/ui/planner_test.gd` | 28 checks, 0 failures | Fixture DTO, read-only aggregate item projection with real catalog, modal states, one Tab movement, synthetic marker click, filtered secrets, displayed recipe/Core states, request payloads, pending duplicate suppression, rejection without local mutation. |
| Journal native | Xvfb/GL 1280×720, 2560×1440, 3840×2160 | 23/23/23 checks, zero failures | Above plus fixture screenshot writes; not gameplay. |
| Planner native | Xvfb/GL 1280×720, 2560×1440, 3840×2160 | 33/31/31 checks, zero failures | Above plus fixture screenshot writes; at 1280 storage and recovery are also captured. |

For each native run replace `TEST` with `ui_test` or `planner_test`, `WIDTHxHEIGHT` and `SUFFIX` with `1280x720`/`1280`, `2560x1440`/`1440`, `3840x2160`/`2160`:

```sh
xvfb-run -a -s '-screen 0 WIDTHxHEIGHTx24' env LIBGL_ALWAYS_SOFTWARE=1 \
  godot --path . --rendering-method gl_compatibility --resolution WIDTHxHEIGHT \
  --script res://tests/survival/ui/TEST.gd -- SUFFIX
```

Search filtering is tested through the LineEdit's `text_changed` signal; workshop, storage, Core selection/requests are partly direct test callbacks/signals. Map marker is a synthetic viewport mouse click, not OS hardware. Tests use fixture content and don't prove a production transfer, craft, Core equip, death, map discovery, transaction idempotency or full controller navigation. False/absent `revealed` entries are tested as not rendered in search/map; host must not send secret data to the UI in the first place. `Adapter.storage` uses an injected fake aggregated inventory and a real SurvivalService catalog; it does not test a live chest. No human or independent review. The user-facing schematic is not actual A1 geography.

Native screenshot review: visually inspected journal and desk at 1280×720 and examples at 2560×1440 and 3840×2160, including workshop, Core, schematic map, recovery and storage. No actual world environment, Gold VFX, browser, physical high-resolution monitor or noninteger upscale checked. `project.godot` is unchanged. Screen captures are in `tests/survival/ui/*_fixture_*.png`; they are screenshots of these fixtures, not production claims.
