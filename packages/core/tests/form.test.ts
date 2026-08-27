import { describe, expect, test } from 'vitest';
import {
  createDefaultFormValues,
  flattenFormSchema,
  validateFormField,
  validateFormValues,
  type FormSchema,
} from '../src/index';

const schema: FormSchema = {
  groups: [
    {
      id: 'basic',
      title: 'Basic',
      fields: [
        { kind: 'string', key: 'name', label: 'Name', required: true, minLength: 2, maxLength: 8 },
        { kind: 'number', key: 'hp', label: 'HP', min: 1, max: 999, defaultValue: 10, required: true },
        { kind: 'boolean', key: 'visible', label: 'Visible', defaultValue: true },
        { kind: 'select', key: 'tier', label: 'Tier', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], required: true },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      fields: [
        { kind: 'string', key: 'code', label: 'Code', pattern: '^[A-Z]{3}$', patternMessage: 'Code must be 3 uppercase letters' },
        { kind: 'textarea', key: 'notes', label: 'Notes', maxLength: 12 },
      ],
    },
  ],
};

describe('schema helpers', () => {
  test('flattenFormSchema keeps group order', () => {
    expect(flattenFormSchema(schema).map((field) => field.key)).toEqual(['name', 'hp', 'visible', 'tier', 'code', 'notes']);
    // 平铺 schema 原样返回；分组优先于平铺
    expect(flattenFormSchema({ fields: [{ kind: 'boolean', key: 'x', label: 'X' }] })).toHaveLength(1);
    expect(flattenFormSchema({ fields: [], groups: schema.groups })).toHaveLength(6);
  });

  test('createDefaultFormValues collects defaults only', () => {
    expect(createDefaultFormValues(schema)).toEqual({ hp: 10, visible: true });
  });
});

describe('field validation', () => {
  test('required rejects empty variants', () => {
    const field = schema.groups![0].fields[0];
    expect(validateFormField(field, undefined)?.code).toBe('required');
    expect(validateFormField(field, '   ')?.code).toBe('required');
    expect(validateFormField(field, 'ok')).toBeNull();
  });

  test('number enforces range and numeric parsing', () => {
    const field = schema.groups![0].fields[1];
    expect(validateFormField(field, 0)?.code).toBe('min');
    expect(validateFormField(field, 1000)?.code).toBe('max');
    expect(validateFormField(field, 'abc')?.code).toBe('notANumber');
    expect(validateFormField(field, '12')).toBeNull(); // 字符串数字可解析
  });

  test('string pattern and length constraints', () => {
    const code = schema.groups![1].fields[0];
    expect(validateFormField(code, 'abc')?.message).toBe('Code must be 3 uppercase letters');
    expect(validateFormField(code, 'ABC')).toBeNull();
    const name = schema.groups![0].fields[0];
    expect(validateFormField(name, 'a')?.code).toBe('minLength');
    expect(validateFormField(name, 'abcdefghi')?.code).toBe('maxLength');
  });

  test('select rejects unknown option, boolean never errors', () => {
    expect(validateFormField(schema.groups![0].fields[3], 'zzz')?.code).toBe('pattern');
    expect(validateFormField(schema.groups![0].fields[2], 'whatever')).toBeNull();
  });
});

describe('form validation', () => {
  test('valid values pass, invalid ones are keyed by field', () => {
    const valid = validateFormValues(schema, { name: 'Unit', hp: 10, tier: 'a', code: 'ABC' });
    expect(valid.valid).toBe(true);
    const invalid = validateFormValues(schema, { name: '', hp: 0, tier: 'zzz' });
    expect(invalid.valid).toBe(false);
    expect(Object.keys(invalid.errors).sort()).toEqual(['hp', 'name', 'tier']);
  });
});
