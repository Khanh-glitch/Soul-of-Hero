# Soul of Hero — Web Playtest deployment

**Branch:** `feat/web-playtest-deploy` (dedicated infrastructure only)  
**Target:** Godot 4.7-stable / WebGL 2 / single-threaded Web export / GitHub Pages.

## What a published build means

- The GitHub Actions workflow exports a **selected existing Git branch without merging** it into another branch.
- For its first feature-branch push, the selection defaults to `feat/hero-systems-completion`.
- The workflow installs the official Godot 4.7 Linux editor, restores or installs matching official Web templates, imports the project, exports the Web preset, and checks the published `.html`, `.js`, `.wasm`, `.pck` and the presence of the Chapter 2 Level 11 JSON in its game pack.
- The workflow uploads the complete Web build and logs as a downloadable artifact **before** attempting a Pages deployment.
- Only after successful GitHub Pages deployment can the URL `https://khanh-glitch.github.io/Soul-of-Hero/` be considered a real playtest link. Do not claim this is live based on the workflow configuration alone.

## First-run setup

A public GitHub repository is eligible for GitHub Pages, but Pages must have its publishing source set to **GitHub Actions**:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. The workflow uses `actions/configure-pages@v5` with `enablement: true`. If its credentials are not permitted to enable Pages automatically, complete the UI setting above and rerun the workflow.
4. Verify the **Deploy** job is successful, then load the published URL in Chrome or Edge.
5. Open Developer Tools (F12) and check for fatal errors; playtest Home Map → Level 1 → Sword combat → Return to Hub → save/reload.

## Which version is playing?

The deployed build contains `BUILD_INFO.txt`, showing the exact source branch and commit SHA. Opening it at `https://khanh-glitch.github.io/Soul-of-Hero/BUILD_INFO.txt` identifies the version being played.

**Never** infer the version from whichever branch is currently called “latest”. A player should include the SHA when reporting a bug.

## Updating the deployed game

During the isolated feature-branch preparation phase, a push that changes its Web preset or workflow starts a new default export. This **does not** automatically react to independent commits on the Hero Systems or Arena branches. Do not claim it does.

After PR #2 is reviewed and the workflow is merged to `main`, use **Actions → Soul of Hero — Web Playtest → Run workflow** and select a `source_ref` (Hero Systems, Arena Chapter 2, or main). The workflow reads the selected branch's game files but copies the Web export preset from `feat/web-playtest-deploy` to keep infrastructure independent.

A future follow-up can enable automatic scheduled changes/branch-trigger notifications. Automatic publishing on every Agent commit needs an additional trigger/merge policy; it is deliberately **not enabled in this initial version**.

## Important caveats

- A successful Godot export is not proof of complete browser gameplay. WebGL support, input focus, audio, IndexedDB save persistence, resources, and performance need actual browser testing.
- The first CI install may download the official 4.7 export templates archive (~1.3 GB); the workflow extracts/cache only the single-thread Web templates for subsequent exports.
- Export includes raw `*.json` files to preserve authored runtime levels. Never suppress a missing-level validation check to make Pages green.
- Single-thread Web export is used to avoid SharedArrayBuffer / COOP / COEP cross-origin isolation requirements. Performance on mobile may differ materially from desktop.
- Browser saves are origin-dependent. An unpublished branch and the final Pages URL do not share the same saved progress. Private-mode storage may be ephemeral.
- Do not add unreviewed save migration, combat or map changes to this infrastructure branch. Those stay with their respective Agents.
