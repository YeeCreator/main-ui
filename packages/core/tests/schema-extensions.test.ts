import { describe, expect, test } from 'vitest';
import {
  evaluateVisibility,
  validateArrayField,
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
