/** Build-time switches. Vite replaces `import.meta.env.*` with literals, so in the player build
 *  these are constant `false` and everything behind them is unreachable.
 *
 *  QA_BUILD (`VITE_SOH_QA=1`): the engineering build. Only it exposes the Full-Gear QA Sandbox,
 *  the Creator Inspector, the F9 lab and the Classic Island (R12) baseline world. The build that
 *  players receive has none of these on any screen (Creator decision 2026-11-21). */
export const QA_BUILD: boolean = import.meta.env.VITE_SOH_QA === '1';
