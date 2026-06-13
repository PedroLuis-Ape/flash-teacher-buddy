import { describe, it, expect } from 'vitest';
import {
  resolveCardStatusIdentity,
  buildCanonicalToPlayableMap,
  mapCanonicalIdsToPlayable,
} from './cardStatusIdentity';

describe('resolveCardStatusIdentity', () => {
  it('normal card: canonical === playable === visible === self id', () => {
    const card = { id: 'A', parent_card_id: null };
    const r = resolveCardStatusIdentity({ displayedCard: card, engineCard: card, layers: null });
    expect(r.canonicalGroupId).toBe('A');
    expect(r.playableEntryId).toBe('A');
    expect(r.visibleLayerId).toBe('A');
    expect(r.legacyIds).toEqual(['A']);
  });

  it('layered card on layer 1 (first): canonical=parent, playable=L1, visible=L1', () => {
    const layers = [
      { id: 'L1', parent_card_id: 'P' },
      { id: 'L2', parent_card_id: 'P' },
      { id: 'L3', parent_card_id: 'P' },
    ];
    const engineCard = { ...layers[0], __parentCardId: 'P' };
    const r = resolveCardStatusIdentity({
      displayedCard: layers[0],
      engineCard,
      layers,
    });
    expect(r.canonicalGroupId).toBe('P');
    expect(r.playableEntryId).toBe('L1');
    expect(r.visibleLayerId).toBe('L1');
    expect(r.legacyIds).toEqual(['P', 'L1', 'L2', 'L3']);
  });

  it('layered card on layer 2: visible flips, canonical/playable stay the same', () => {
    const layers = [
      { id: 'L1', parent_card_id: 'P' },
      { id: 'L2', parent_card_id: 'P' },
      { id: 'L3', parent_card_id: 'P' },
    ];
    const engineCard = { ...layers[0], __parentCardId: 'P' };
    const r = resolveCardStatusIdentity({
      displayedCard: layers[1],
      engineCard,
      layers,
    });
    expect(r.canonicalGroupId).toBe('P');
    expect(r.playableEntryId).toBe('L1');
    expect(r.visibleLayerId).toBe('L2');
    expect(r.legacyIds).toContain('L2');
    expect(r.legacyIds).toContain('P');
  });

  it('layered card on layer 3: special target is L3 only', () => {
    const layers = [
      { id: 'L1', parent_card_id: 'P' },
      { id: 'L2', parent_card_id: 'P' },
      { id: 'L3', parent_card_id: 'P' },
    ];
    const r = resolveCardStatusIdentity({
      displayedCard: layers[2],
      engineCard: { ...layers[0], __parentCardId: 'P' },
      layers,
    });
    expect(r.visibleLayerId).toBe('L3');
    expect(r.canonicalGroupId).toBe('P');
  });

  it('safe defaults when nothing is passed', () => {
    const r = resolveCardStatusIdentity({});
    expect(r.canonicalGroupId).toBeNull();
    expect(r.playableEntryId).toBeNull();
    expect(r.visibleLayerId).toBeNull();
    expect(r.legacyIds).toEqual([]);
  });
});

describe('buildCanonicalToPlayableMap', () => {
  it('maps parent_card_id → entry id for layered entries', () => {
    const deck = [
      { id: 'L1', parent_card_id: 'P' },
      { id: 'N1', parent_card_id: null },
    ];
    const m = buildCanonicalToPlayableMap(deck);
    expect(m.get('P')).toBe('L1');
    expect(m.get('N1')).toBe('N1');
    expect(m.size).toBe(2);
  });
});

describe('mapCanonicalIdsToPlayable', () => {
  it('translates canonical red-list ids into playable ids and drops missing', () => {
    const m = new Map([['P', 'L1'], ['N1', 'N1']]);
    expect(mapCanonicalIdsToPlayable(['P', 'N1', 'ghost'], m)).toEqual(['L1', 'N1']);
  });

  it('deduplicates', () => {
    const m = new Map([['P', 'L1'], ['P2', 'L1']]);
    expect(mapCanonicalIdsToPlayable(['P', 'P2'], m)).toEqual(['L1']);
  });
});