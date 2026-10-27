import { describe, expect, it } from 'vitest';
import {
  buildInspectorDefaults,
  coerceFieldValue,
  fieldFallback,
  flattenInspectorSchema,
  groupInspectorSchema,
  resolveFieldValue,
} from '../src/inspector';
import type { InspectorField, InspectorSchema } from '../src/types';

const stringField: InspectorField = { kind: 'string', key: 'name', label: 'Name', defaultValue: 'untitled' };
const readonlyField: InspectorField = { kind: 'readonly', key: 'id', label: 'ID', display: 'code' };

describe('readonly 字段（D-3）', () => {
  it('无 schema 缺省值', () => {
    expect(fieldFallback(readonlyField)).toBeUndefined();
  });

  it('resolveFieldValue 只吃宿主注入值，无注入时为 undefined', () => {
    expect(resolveFieldValue(readonlyField, {})).toBeUndefined();
    expect(resolveFieldValue(readonlyField, { id: 'ent-42' })).toBe('ent-42');
  });

  it('buildInspectorDefaults 跳过 readonly（不写 undefined 键）', () => {
    const defaults = buildInspectorDefaults([stringField, readonlyField]);
    expect(Object.keys(defaults)).toEqual(['name']);
  });

  it('coerceFieldValue 恒返回旧值（宿主不可能收到只读字段的变更）', () => {
    expect(coerceFieldValue(readonlyField, 'hacked', 'original')).toBe('original');
  });
});

describe('schema 分组（支持数组与分组两种形态）', () => {
  const grouped: InspectorSchema = {
    groups: [
      { id: 'basic', title: 'Basic', fields: [stringField] },
      { id: 'meta', title: 'Meta', fields: [readonlyField] },
    ],
  };

  it('flattenInspectorSchema 摊平分组', () => {
    expect(flattenInspectorSchema(grouped).map((f) => f.key)).toEqual(['name', 'id']);
  });

  it('数组形态直接返回', () => {
    expect(flattenInspectorSchema([stringField])).toEqual([stringField]);
  });

  it('groupInspectorSchema 保留分组标题与顺序', () => {
    const groups = groupInspectorSchema(grouped);
    expect(groups.map((g) => g.title)).toEqual(['Basic', 'Meta']);
  });

  it('数组形态包成一个无标题组', () => {
    const groups = groupInspectorSchema([stringField]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('');
    expect(groups[0].fields).toEqual([stringField]);
  });

  it('空 schema 返回空分组列表', () => {
    expect(groupInspectorSchema([])).toEqual([]);
    expect(groupInspectorSchema({ fields: [] })).toEqual([]);
  });

  it('分组形态优先于 fields', () => {
    const both: InspectorSchema = { fields: [readonlyField], groups: [{ id: 'g', title: 'G', fields: [stringField] }] };
    expect(flattenInspectorSchema(both).map((f) => f.key)).toEqual(['name']);
  });
});
