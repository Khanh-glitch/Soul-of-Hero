// The build this page was made from, for the title screen ("which version am I playing?").
// `__SOH_BUILD__` is filled in by vite.config.ts at build time; without it (tests, other tools) the stamp is empty.
declare const __SOH_BUILD__: { at: string; commit: string } | undefined;

export interface BuildInfo {
  /** When the build was made, ISO 8601 in UTC, e.g. "2026-11-26T19:49:05.000Z". Empty when unknown. */
  at: string;
  /** Short commit id, only when the build was made from exactly that commit. Empty otherwise. */
  commit: string;
}

export const BUILD: BuildInfo = typeof __SOH_BUILD__ === 'object' && __SOH_BUILD__ !== null
  ? { at: String(__SOH_BUILD__.at || ''), commit: String(__SOH_BUILD__.commit || '') }
  : { at: '', commit: '' };

/** "2026-11-26 19:49 UTC" (plus " · d78a36d" when the commit is known), or '' when the build carries no stamp. */
export function buildStamp(b: BuildInfo = BUILD): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(b.at);
  if (!m) return '';
  return `${m[1]} ${m[2]} UTC${b.commit ? ` · ${b.commit}` : ''}`;
}
