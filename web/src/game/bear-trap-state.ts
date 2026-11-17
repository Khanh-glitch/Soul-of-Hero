import { BAL, type BearTrapState } from './core';

/** One reachable-state grammar for placed traps and their packed UID. */
export function bearTrapStateValid(state: unknown, uses: unknown): boolean {
  if (typeof uses !== 'number' || !Number.isInteger(uses)) return false;
  if (state === 'unarmed') return uses === BAL.bearTrapV1.uses;
  if (state === 'armed') return uses >= 1 && uses <= BAL.bearTrapV1.uses;
  if (state === 'spent') return uses >= 1 && uses < BAL.bearTrapV1.uses;
  if (state === 'worn') return uses === 0;
  return false;
}
export function validBearTrap(value: unknown): value is BearTrapState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const b = value as BearTrapState;
  return b.version === 'trap-v1' && bearTrapStateValid(b.state, b.uses) &&
    (b.snapAt === undefined || (Number.isSafeInteger(b.snapAt) && b.snapAt >= 0));
}
