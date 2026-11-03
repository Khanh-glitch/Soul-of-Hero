# Local map/POI evidence

These are independent production-preview runs made before the commit containing
this evidence. The source and lockfile are the same as in that commit; the
run logs therefore correctly say `local-uncommitted`, not a CI SHA. Chromium
153 was supplied locally with its bundled Linux libraries; the app was built
with `npm ci` and `npm run build`. The two loot-panel PNGs in each directory
were opened and visually inspected at both 640×360 and 1280×720. The reloaded
screenshots document the subsequent same-profile page reload and Continue.

The diagnostics record test-side BFS and ordinary keyboard/mouse inputs. They
are not a blind-discovery test or proof of persistence across browser process
exit. Creature spawns vary by run seed; the preceding development attempts
included an actual Delta death and a Lighthouse route-budget failure. See CI
artifacts for the exact committed-SHA rerun and any later failures.
