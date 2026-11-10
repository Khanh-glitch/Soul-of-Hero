import type { SpellDef } from './types';
import { PYRE } from './pyre';
import { TIDE } from './tide';
import { TEMPEST } from './tempest';
import { VERDANT } from './verdant';
import { ASTRAL } from './astral';

/** All twenty abilities, in school order. */
export const SPELLS: SpellDef[] = [...PYRE, ...TIDE, ...TEMPEST, ...VERDANT, ...ASTRAL];
