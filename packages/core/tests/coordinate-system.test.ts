/**
 * 坐标系四大类与换算。
 *
 * 全部断言都用**可自验的判据**，不依赖「记住某张表」：
 * - 手性用 `X × Y · Z > 0` 判；
 * - 换算用「来回一趟要回到原值」判；
 * - 四类到 three 的映射用具体数值钉死。
 */

import { describe, expect, test } from 'vitest';
import {
  KNOWN_SYSTEMS,
  cross3,
  fromThreeAxis,
  groundAxes,
  isRightHanded,
  toThreeAxis,
  type CoordinateSystem,
} from '../src/rendering/coordinate-system';

/** 构造基向量。 */
const v = (x: number, y: number, z: number) => ({ x, y, z });

describe('坐标系：右手系判据', () => {
  test('右手 Y up（three.js）：X × Y = Z，判为右手', () => {
    expect(isRightHanded(v(1, 0, 0), v(0, 1, 0), v(0, 0, 1))).toBe(true);
  });

  test('左手 Y up（Unity）：Z 反向，判为左手', () => {
    expect(isRightHanded(v(1, 0, 0), v(0, 1, 0), v(0, 0, -1))).toBe(false);
  });

  test('右手 Z up（Blender）：X × Y = Z，判为右手', () => {
    // Blender 里 up 是 Z，但三个基向量的叉积关系不变
    expect(isRightHanded(v(1, 0, 0), v(0, 1, 0), v(0, 0, 1))).toBe(true);
  });

  test('左手 Z up（UE）：Z 反向，判为左手', () => {
    expect(isRightHanded(v(1, 0, 0), v(0, -1, 0), v(0, 0, 1))).toBe(false);
  });

  test('叉积本身守约定：X × Y 在右手系恒等于 +Z', () => {
    expect(cross3(v(1, 0, 0), v(0, 1, 0))).toEqual(v(0, 0, 1));
  });
});

describe('坐标系：四类到 three.js 的换算', () => {
  const sample = v(1, 2, 3);

  test('右手 Y up → 恒等', () => {
    expect(toThreeAxis(sample, KNOWN_SYSTEMS.threeLike)).toEqual(v(1, 2, 3));
  });

  test('右手 Z up（Blender）→ (x, z, −y)', () => {
    expect(toThreeAxis(sample, KNOWN_SYSTEMS.blender)).toEqual(v(1, 3, -2));
  });

  test('左手 Y up（Unity）→ (x, y, −z)', () => {
    expect(toThreeAxis(sample, KNOWN_SYSTEMS.unity)).toEqual(v(1, 2, -3));
  });

  test('左手 Z up（UE）→ 先翻手性再转向上轴 ⇒ (x, −z, −y)', () => {
    expect(toThreeAxis(sample, KNOWN_SYSTEMS.unreal)).toEqual(v(1, -3, -2));
  });

  test('四类都要能来回往返（逆变换回到原值）', () => {
    const systems: CoordinateSystem[] = [
      KNOWN_SYSTEMS.threeLike,
      KNOWN_SYSTEMS.blender,
      KNOWN_SYSTEMS.unity,
      KNOWN_SYSTEMS.unreal,
    ];
    for (const sys of systems) {
      const once = toThreeAxis(sample, sys);
      const back = fromThreeAxis(once, sys);
      expect(back.x).toBeCloseTo(sample.x, 10);
      expect(back.y).toBeCloseTo(sample.y, 10);
      expect(back.z).toBeCloseTo(sample.z, 10);
    }
  });

  test('两步法顺序不可交换：先翻手性再转上轴 ≠ 先转上轴再翻手性', () => {
    // 这条守住「文档里的两步法顺序」本身，防止后人改成另一种顺序
    const sys = KNOWN_SYSTEMS.unreal;
    const correct = toThreeAxis(sample, sys);
    // 错误顺序：先转上轴 (x,z,−y)，再翻 Z 的负号 ⇒ (x, z, y)
    const wrong = v(1, 3, 2);
    expect(correct).not.toEqual(wrong);
  });
});

describe('坐标系：地面轴', () => {
  test('Y up 的地面是 XZ', () => {
    expect(groundAxes(KNOWN_SYSTEMS.threeLike)).toEqual(['x', 'z']);
  });

  test('Z up 的地面是 XY', () => {
    expect(groundAxes(KNOWN_SYSTEMS.blender)).toEqual(['x', 'y']);
  });
});

describe('坐标系：四类的业界归属（守文档一致性）', () => {
  test('three / Blender / Unity / UE 各归其位', () => {
    expect(KNOWN_SYSTEMS.threeLike).toEqual({ handedness: 'right', up: 'y' });
    expect(KNOWN_SYSTEMS.blender).toEqual({ handedness: 'right', up: 'z' });
    expect(KNOWN_SYSTEMS.unity).toEqual({ handedness: 'left', up: 'y' });
    expect(KNOWN_SYSTEMS.unreal).toEqual({ handedness: 'left', up: 'z' });
  });
});
