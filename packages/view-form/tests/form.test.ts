import { describe, expect, test } from 'vitest';
import type { FormArrayField, FormSchema } from '@main-ui/core';
import {
  applyArrayIntent,
  buildFormDefaults,
  clampNumber,
  coerceFieldValue,
  createArrayItem,
  fieldFallback,
  resolveFieldValue,
} from '../src/index';

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

describe('array field helpers', () => {
  const arrayField: FormArrayField = {
    kind: 'array',
    key: 'rows',
    label: 'Rows',
    minItems: 1,
    maxItems: 3,
    itemFields: [
      { kind: 'string', key: 'label', label: 'Label', defaultValue: 'x' },
      { kind: 'number', key: 'weight', label: 'Weight', min: 0, max: 10 },
    ],
  };

  test('fieldFallback returns empty array for array kind', () => {
    expect(fieldFallback(arrayField)).toEqual([]);
  });

  test('createArrayItem composes defaults per sub field', () => {
    expect(createArrayItem(arrayField)).toEqual({ label: 'x', weight: 0 });
  });

  test('append respects maxItems', () => {
    const two: unknown = [{ label: 'a', weight: 1 }, { label: 'b', weight: 2 }];
    const next = applyArrayIntent(arrayField, two, { type: 'append' });
    expect(next).toHaveLength(3);
    expect(applyArrayIntent(arrayField, next, { type: 'append' })).toBe(next); // 越界返回原引用
  });

  test('remove respects minItems and invalid index', () => {
    const one: unknown = [{ label: 'a', weight: 1 }];
    expect(applyArrayIntent(arrayField, one, { type: 'remove', index: 0 })).toBe(one); // minItems 挡住
    const two: unknown = [{ label: 'a', weight: 1 }, { label: 'b', weight: 2 }];
    expect(applyArrayIntent(arrayField, two, { type: 'remove', index: 9 })).toBe(two); // 越界
    expect(applyArrayIntent(arrayField, two, { type: 'remove', index: 0 })).toEqual([{ label: 'b', weight: 2 }]);
  });

  test('patch replaces only the target item without mutating input', () => {
    const two: unknown = [{ label: 'a', weight: 1 }, { label: 'b', weight: 2 }];
    const next = applyArrayIntent(arrayField, two, { type: 'patch', index: 1, item: { label: 'c', weight: 9 } });
    expect(next).toEqual([{ label: 'a', weight: 1 }, { label: 'c', weight: 9 }]);
    expect((two as Array<{ label: string }>)[1].label).toBe('b'); // 入参未被修改
  });

  test('non-array current value is treated as empty', () => {
    expect(applyArrayIntent(arrayField, null, { type: 'append' })).toHaveLength(1);
  });
});
