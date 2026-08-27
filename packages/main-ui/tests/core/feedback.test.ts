import { describe, expect, test } from 'vitest';
import type { FeedbackItem } from '../../src/core';

describe('feedback contracts', () => {
  test('exposes accessible feedback kinds', () => {
    const items: FeedbackItem[] = [{ id: 'n1', kind: 'notification', title: 'Saved' }, { id: 'c1', kind: 'confirm', title: 'Delete?' }, { id: 'p1', kind: 'progress', title: 'Import', progress: 50 }];
    expect(items.map((item) => item.kind)).toEqual(['notification', 'confirm', 'progress']);
  });
});
