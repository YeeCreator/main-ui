import { describe, expect, it } from 'vitest';
import { buildInspectorDefaults, clampNumber, coerceFieldValue, fieldFallback, resolveFieldValue } from '../src/inspector';
import type { InspectorField, InspectorSchema } from '../src/types';

const stringField: InspectorField = { kind: 'string', key: 'name', label: 'Name', defaultValue: 'untitled' };
const numberField: InspectorField = { kind: 'number', key: 'width', label: 'Width', min: 0, max: 100, defaultValue: 50 };
const booleanField: InspectorField = { kind: 'boolean', key: 'visible', label: 'Visible', defaultValue: true };
const selectField: InspectorField = {
  kind: 'select', key: 'mode', label: 'Mode',
  options: [{ value: 'edit', label: 'Edit' }, { value: 'view', label: 'View' }],
  defaultValue: 'edit',
};

describe('clampNumber', () => {
  it('越界值收敛到边界', () => {
    expect(clampNumber(150, 0, 100)).toBe(100);
    expect(clampNumber(-5, 0, 100)).toBe(0);
    expect(clampNumber(42, 0, 100)).toBe(42);
  });

  it('单边约束生效', () => {
    expect(clampNumber(-100, 0)).toBe(0);
    expect(clampNumber(100, undefined, 10)).toBe(10);
  });
});

describe('fieldFallback / resolveFieldValue / buildInspectorDefaults', () => {
  it('按 kind 推导缺省值', () => {
    expect(fieldFallback({ kind: 'string', key: 'a', label: 'A' })).toBe('');
    expect(fieldFallback({ kind: 'number', key: 'a', label: 'A' })).toBe(0);
    expect(fieldFallback({ kind: 'boolean', key: 'a', label: 'A' })).toBe(false);
    expect(fieldFallback(selectField)).toBe('edit');
    expect(fieldFallback({ kind: 'select', key: 'a', label: 'A', options: [] })).toBe('');
  });

  it('values 优先于 defaultValue', () => {
    expect(resolveFieldValue(numberField, { width: 80 })).toBe(80);
    expect(resolveFieldValue(numberField, {})).toBe(50);
    expect(resolveFieldValue({ kind: 'number', key: 'x', label: 'X' }, {})).toBe(0);
  });

  it('全量缺省值表按 schema 生成', () => {
    const schema: InspectorSchema = [stringField, numberField, booleanField, selectField];
    expect(buildInspectorDefaults(schema)).toEqual({ name: 'untitled', width: 50, visible: true, mode: 'edit' });
  });
});

describe('coerceFieldValue', () => {
  it('string 原样保留非字符串转 String', () => {
    expect(coerceFieldValue(stringField, 'hello', '')).toBe('hello');
    expect(coerceFieldValue(stringField, 123, '')).toBe('123');
  });

  it('number 解析并钳制，非法回退当前值', () => {
    expect(coerceFieldValue(numberField, '80', 50)).toBe(80);
    expect(coerceFieldValue(numberField, '999', 50)).toBe(100);
    expect(coerceFieldValue(numberField, '-3', 50)).toBe(0);
    expect(coerceFieldValue(numberField, 'abc', 50)).toBe(50);
    expect(coerceFieldValue(numberField, NaN, 50)).toBe(50);
  });

  it('boolean 布尔化', () => {
    expect(coerceFieldValue(booleanField, true, false)).toBe(true);
    expect(coerceFieldValue(booleanField, 0, true)).toBe(false);
  });

  it('select 只接受 options 内的值', () => {
    expect(coerceFieldValue(selectField, 'view', 'edit')).toBe('view');
    expect(coerceFieldValue(selectField, 'hack', 'edit')).toBe('edit');
  });
});
