import { describe, expect, test } from 'vitest';
import {
  evaluateVisibility,
  validateArrayField,
  validateFormValues,
  type FormArrayField,
  type FormFieldWithVisibility,
  type FormValues,
} from '../src/index';

describe('evaluateVisibility', () => {
  test('no visibleWhen → always visible', () => {
    const field: FormFieldWithVisibility = { kind: 'string', key: 'a', label: 'A' };
    expect(evaluateVisibility(field, {})).toBe(true);
  });

  test('simple equals match', () => {
    const field: FormFieldWithVisibility = {
      kind: 'string', key: 'b', label: 'B',
      visibleWhen: { field: 'a', equals: 'yes' },
    };
    expect(evaluateVisibility(field, { a: 'yes' })).toBe(true);
    expect(evaluateVisibility(field, { a: 'no' })).toBe(false);
  });

  test('array equals (any match)', () => {
    const field: FormFieldWithVisibility = {
      kind: 'string', key: 'c', label: 'C',
      visibleWhen: { field: 'mode', equals: ['advanced', 'expert'] },
    };
    expect(evaluateVisibility(field, { mode: 'advanced' })).toBe(true);
    expect(evaluateVisibility(field, { mode: 'expert' })).toBe(true);
    expect(evaluateVisibility(field, { mode: 'basic' })).toBe(false);
  });

  test('negate inverts logic', () => {
    const field: FormFieldWithVisibility = {
      kind: 'string', key: 'd', label: 'D',
      visibleWhen: { field: 'hidden', equals: true, negate: true },
    };
    expect(evaluateVisibility(field, { hidden: false })).toBe(true);
    expect(evaluateVisibility(field, { hidden: true })).toBe(false);
  });

  test('missing dependency value → not matching', () => {
    const field: FormFieldWithVisibility = {
      kind: 'string', key: 'e', label: 'E',
      visibleWhen: { field: 'missing', equals: 'x' },
    };
    expect(evaluateVisibility(field, {})).toBe(false);
  });
});

describe('validateArrayField', () => {
  const arrayField: FormArrayField = {
    kind: 'array',
    key: 'tags',
    label: 'Tags',
    itemFields: [
      { kind: 'string', key: 'name', label: 'Name', required: true, minLength: 1 },
      { kind: 'number', key: 'weight', label: 'Weight', min: 0 },
    ],
    minItems: 1,
    maxItems: 3,
  };

  test('valid array passes', () => {
    const errors = validateArrayField(arrayField, [{ name: 'foo', weight: 1 }]);
    expect(errors).toHaveLength(0);
  });

  test('minItems violation', () => {
    const errors = validateArrayField(arrayField, []);
    expect(errors.some((e) => e.code === 'min')).toBe(true);
  });

  test('maxItems violation', () => {
    const items = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }];
    const errors = validateArrayField(arrayField, items);
    expect(errors.some((e) => e.code === 'max')).toBe(true);
  });

  test('sub-field validation per item', () => {
    const errors = validateArrayField(arrayField, [{ name: '', weight: -1 }]);
    expect(errors).toHaveLength(2); // required name + min weight
    expect(errors[0].key).toBe('tags[0].name');
    expect(errors[1].key).toBe('tags[0].weight');
  });

  test('non-array value treated as empty', () => {
    const errors = validateArrayField(arrayField, 'not-array');
    expect(errors.some((e) => e.code === 'min')).toBe(true);
  });
});

describe('validateFormValues · 条件隐藏字段不参与校验', () => {
  // 隐藏的必填项不应阻断提交，否则用户会「报错却找不到出错位置」
  const schema = {
    fields: [
      { kind: 'string' as const, key: 'mode', label: 'Mode', defaultValue: 'simple' },
      {
        kind: 'string' as const, key: 'advanced', label: 'Advanced', required: true,
        visibleWhen: { field: 'mode', equals: 'advanced' },
      },
    ],
  };

  test('hidden required field does not block submission', () => {
    const result = validateFormValues(schema, { mode: 'simple' });
    expect(result.valid).toBe(true);
    expect(result.errors.advanced).toBeUndefined();
  });

  test('visible required field blocks submission', () => {
    const result = validateFormValues(schema, { mode: 'advanced' });
    expect(result.valid).toBe(false);
    expect(result.errors.advanced.code).toBe('required');
  });
});

describe('validateArrayField · 项内条件隐藏子字段不参与校验', () => {
  const arrayField: FormArrayField = {
    kind: 'array',
    key: 'rows',
    label: 'Rows',
    itemFields: [
      { kind: 'string', key: 'kind', label: 'Kind', defaultValue: 'plain' },
      {
        kind: 'string', key: 'extra', label: 'Extra', required: true,
        visibleWhen: { field: 'kind', equals: 'fancy' },
      },
    ],
  };

  test('hidden sub field skipped', () => {
    const errors = validateArrayField(arrayField, [{ kind: 'plain' }]);
    expect(errors).toHaveLength(0);
  });

  test('visible sub field still validated', () => {
    const errors = validateArrayField(arrayField, [{ kind: 'fancy' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('rows[0].extra');
  });
});
