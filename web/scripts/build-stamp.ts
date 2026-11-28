// The stamp shown on the title screen (src/ui/build-info.ts): when this build was made and, when it was made from
// exactly one commit, which one. Used by both Vite configurations through `define`.
import { execSync } from "child_process";

export function buildStampDefine(root: string): Record<string, string> {
  const at = new Date().toISOString();
  // A hosted build is always made from one commit and says which.
  let commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  if (!commit) {
    try {
      const run = (cmd: string) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      // A build from a tree with uncommitted changes is not "that commit": it carries the date only.
      if (run("git status --porcelain -- .") === "") commit = run("git rev-parse --short=7 HEAD");
    } catch { /* no git here: date only */ }
  }
  return { __SOH_BUILD__: JSON.stringify({ at, commit }) };
}
