import { Effect } from '../engine/fx';
import { PYRE } from './pyre';
import { TIDE } from './tide';
import { TEMPEST } from './tempest';
import { VERDANT } from './verdant';
import { ASTRAL } from './astral';

export const EFFECTS: Effect[] = [...PYRE, ...TIDE, ...TEMPEST, ...VERDANT, ...ASTRAL];
