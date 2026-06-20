import { describe, expect, it } from 'vitest';
import { naturalSort } from './sorting';

describe('naturalSort with explicit order_index', () => {
  it('uses saved positions before titles', () => {
    const result = naturalSort(
      [
        { id: 'a', title: 'A', order_index: 2 },
        { id: 'z', title: 'Z', order_index: 1 },
      ],
      (item) => item.title,
    );

    expect(result.map((item) => item.id)).toEqual(['z', 'a']);
  });

  it('falls back to natural title order for legacy items without a positive position', () => {
    const result = naturalSort(
      [
        { title: 'Lista 10', order_index: 0 },
        { title: 'Lista 2', order_index: null },
      ],
      (item) => item.title,
    );

    expect(result.map((item) => item.title)).toEqual(['Lista 2', 'Lista 10']);
  });
});
