import { describe, it, expect } from 'vitest';
import { LI_ITEM_SOURCE, liSourceItem, liHistoricalFormula } from '../src/game/last-island-item-source';

describe('LI copy-first source integrity (NOT gameplay acceptance)', () => {
  it('preserves all 139 union ids without inventing additional item identities', () => {
    expect(LI_ITEM_SOURCE).toHaveLength(139);
    expect(new Set(LI_ITEM_SOURCE.map(x => x.li_id)).size).toBe(139);
  });
  it('keeps Parts separate from Electronic Parts and Mechanical Gear', () => {
    expect(liSourceItem('parts')).not.toBeNull();
    expect(liSourceItem('electronic_parts')).not.toBeNull();
    expect(liSourceItem('mechanical_gear')).not.toBeNull();
    expect(liSourceItem('mechanical_parts')).toBeNull();
    expect(liSourceItem('parts')?.soh_exception?.runtime_alias).toBe('spares');
  });
  it('retains original LI component costs as source-reported figures', () => {
    expect(liHistoricalFormula('mechanical_gear')?.ingredients).toMatchObject({ iron_ingot: 50, parts: 65 });
    expect(liHistoricalFormula('electric_door')?.ingredients).toMatchObject({ iron_ingot: 50, electronic_parts: 5, mechanical_gear: 1, iron_plate: 10 });
  });
  it('does not make historical variants or unsupported citations into confirmed facts', () => {
    expect(liSourceItem('ammo_556_base')?.copy_policy).toBe('HISTORICAL_FORMULA_VARIANT');
    const unsupported = LI_ITEM_SOURCE.filter(x => x.source_support === 'UNSUPPORTED_CITATION');
    expect(unsupported.length).toBe(15);
    for (const item of unsupported) expect(liHistoricalFormula(item.li_id)).toBeNull();
  });
  it('keeps special event items edition-scoped', () => {
    expect(liSourceItem('birthday_cake_2022')?.event_only).toBe(true);
    expect(liSourceItem('reunion_mooncake_lottery_pack')?.event_only).toBe(true);
  });
});
