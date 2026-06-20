import { describe, expect, it } from 'vitest';
import {
  assignmentPositionLabel,
  moveAssignmentToPosition,
  sortAssignmentsByOrder,
} from './assignmentOrder';

describe('assignment ordering', () => {
  it('uses positive saved positions before legacy zero values', () => {
    const sorted = sortAssignmentsByOrder([
      { id: 'legacy-new', order_index: 0, created_at: '2026-01-03T00:00:00Z' },
      { id: 'second', order_index: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 'first', order_index: 1, created_at: '2026-01-01T00:00:00Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['first', 'second', 'legacy-new']);
  });

  it('moves an assignment to an exact selected position', () => {
    const moved = moveAssignmentToPosition(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      'd',
      1,
    );

    expect(moved.map((item) => item.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('formats visual positions with three digits', () => {
    expect(assignmentPositionLabel(0)).toBe('001');
    expect(assignmentPositionLabel(8)).toBe('009');
    expect(assignmentPositionLabel(11)).toBe('012');
  });
});
