import { describe, expect, it } from 'vitest';
import {
  MAX_REPAIR_CARD_IDS,
  isRepairAction,
  isSafeOptionalText,
  isUuid,
  normalizeCardIds,
} from '../../supabase/functions/repair-ab/validation';

const UUID_A = '123e4567-e89b-42d3-a456-426614174000';
const UUID_B = '123e4567-e89b-42d3-a456-426614174001';

describe('repair-ab request validation', () => {
  it('accepts only known operations', () => {
    expect(isRepairAction('edit_card')).toBe(true);
    expect(isRepairAction('delete_everything')).toBe(false);
  });

  it('validates UUIDs', () => {
    expect(isUuid(UUID_A)).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('requires unique card ids and enforces the batch limit', () => {
    expect(normalizeCardIds([UUID_A, UUID_B])).toEqual([UUID_A, UUID_B]);
    expect(normalizeCardIds([UUID_A, UUID_A])).toBeNull();
    expect(normalizeCardIds(Array.from({ length: MAX_REPAIR_CARD_IDS + 1 }, (_, index) => `${UUID_A}-${index}`))).toBeNull();
  });

  it('limits editable text size', () => {
    expect(isSafeOptionalText(undefined)).toBe(true);
    expect(isSafeOptionalText('safe text')).toBe(true);
    expect(isSafeOptionalText('x'.repeat(10_001))).toBe(false);
    expect(isSafeOptionalText({ text: 'invalid' })).toBe(false);
  });
});
