import { describe, expect, test } from 'vitest';
import type { FormSchema } from '@main-ui/core';
import { buildFormDefaults, clampNumber, coerceFieldValue, fieldFallback, resolveFieldValue } from '../src/index';

const schema: FormSchema = {
  groups: [
    {
      id: 'basic',
      title: 'Basic',
      fields: [
        { kind: 'string', key: 'name', label: 'Name', defaultValue: 'Unit' },
        { kind: 'number', key: 'hp', label: 'HP', min: 1, max: 100, defaultValue: 10 },
        { kind: 'boolean', key: 'visible', label: 'Visible' },
        { kind: 'select', key: 'tier', label: 'Tier', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
        { kind: 'textarea', key: 'notes', label: 'Notes' },
      ],
    },
  ],
};

const fields = schema.groups![0].fields;

describe('form helpers', () => {
  test('defaults cover groups with fallbacks', () => {
    expect(buildFormDefaults(schema)).toEqual({ name: 'Unit', hp: 10, visible: false, tier: 'a', notes: '' });
    expect(fieldFallback({ kind: 'textarea', key: 'x', label: 'X' })).toBe('');
  });

  test('resolveFieldValue prefers injected values', () => {
    expect(resolveFieldValue(fields[0], { name: 'Injected' })).toBe('Injected');
    expect(resolveFieldValue(fields[2], {})).toBe(false); // fallback
  });

  test('coerce clamps numbers and guards select options', () => {
    expect(coerceFieldValue(fields[1], '999', 10)).toBe(100); // 钳制 max
    expect(coerceFieldValue(fields[1], 'xx', 10)).toBe(10); // 非法回退
    expect(coerceFieldValue(fields[3], 'zzz', 'a')).toBe('a'); // 未知选项回退
    expect(coerceFieldValue(fields[4], 123, '')).toBe('123'); // textarea String 化
    expect(clampNumber(-5, 0, 10)).toBe(0);
  });
});
