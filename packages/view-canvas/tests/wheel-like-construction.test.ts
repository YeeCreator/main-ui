import { describe, expect, test } from 'vitest';
import { classifyWheel, type WheelLike } from '@main-ui/core/input';

/**
 * 从 DOM `WheelEvent` 构造 `WheelLike` 的正确姿势（**回归锁**）。
 *
 * ## 这条用例守的是一个真实事故（2026-10-27，当天引入当天发现）
 *
 * 为给 `classifyWheel` 传 `intervalMs`，曾写成：
 *
 * ```ts
 * classifyWheel({ ...event, intervalMs })     // ❌
 * ```
 *
 * 但 **DOM 事件的属性在原型上、不可枚举**，展开只能拿到 `{ isTrusted: true }`
 * （浏览器实测：`Object.keys({...new WheelEvent('wheel')})` === `['isTrusted']`）。
 * 于是 `deltaY` / `ctrlKey` / `deltaX` 全部变成 `undefined`：
 *
 * - `ctrlKey` undefined → 不是捏合
 * - `deltaMode` undefined !== 0 → **真**，于是直接返回 `zoom`
 *
 * 结果：**任何滚轮事件都被判成缩放**，触控板双指平移彻底失效。
 *
 * 隐蔽性在于：`classifyWheel` 的单测拿到的永远是合法对象，
 * 只有「从真实事件构造」这一步出错 —— 故必须在这里锁住。
 *
 * ## 为什么用原型对象而不 new WheelEvent
 *
 * 本包 vitest 的 `environment` 是 `node`，没有 `WheelEvent`。
 * 但事故的**机制**（属性在原型上 → 展开丢失）与环境无关，用
 * `Object.create(proto)` 可精确复现，且不需要 DOM。
 */

/** 判定字段类型（与 `WheelLike` 的必填部分一致）。 */
type WheelFields = {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
};

/** 模拟 DOM 事件：判定字段挂在原型上，实例自身只有 `isTrusted`。 */
const makeEventLike = (init: Partial<WheelFields>): WheelFields & { isTrusted: boolean } => {
  const proto: WheelFields = {
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    deltaMode: init.deltaMode ?? 0,
  };
  return Object.assign(Object.create(proto), { isTrusted: true }) as WheelFields & {
    isTrusted: boolean;
  };
};

/** 正确的构造方式：逐字段显式取值。 */
const toWheelLike = (event: WheelFields, intervalMs?: number): WheelLike => ({
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  deltaX: event.deltaX,
  deltaY: event.deltaY,
  deltaMode: event.deltaMode,
  ...(intervalMs === undefined ? {} : { intervalMs }),
});

describe('WheelEvent → WheelLike 构造', () => {
  test('展开事件丢光判定字段：只剩 isTrusted（这就是那个 bug 的机制）', () => {
    const event = makeEventLike({ deltaX: 3, deltaY: -55, deltaMode: 0 });
    const spread = { ...event } as Record<string, unknown>;

    expect(spread.isTrusted).toBe(true);
    expect(spread.deltaY).toBeUndefined();
    expect(spread.deltaX).toBeUndefined();
    expect(spread.ctrlKey).toBeUndefined();
    expect(spread.deltaMode).toBeUndefined();
  });

  test('展开后的对象被判成 zoom —— 于是「任何滚轮都缩放」', () => {
    const spread = { ...makeEventLike({ deltaX: 12, deltaY: -3, deltaMode: 0 }) } as unknown as WheelLike;
    // 原始事件本该判 pan（有横向分量）；展开后 deltaMode undefined !== 0 → zoom
    expect(classifyWheel(spread)).toBe('zoom');
  });

  test('逐字段取值：触控板平移（横向分量）判 pan', () => {
    expect(classifyWheel(toWheelLike(makeEventLike({ deltaX: 12, deltaY: -3 })))).toBe('pan');
  });

  test('逐字段取值：鼠标滚轮大整数判 zoom', () => {
    expect(classifyWheel(toWheelLike(makeEventLike({ deltaY: -100 })))).toBe('zoom');
  });

  test('逐字段取值：ctrlKey 捏合判 pinch', () => {
    expect(classifyWheel(toWheelLike(makeEventLike({ deltaY: 4, ctrlKey: true })))).toBe('pinch');
  });

  test('带 intervalMs：快扫的大整数 delta 由 zoom 变 pan', () => {
    const fast = makeEventLike({ deltaY: -55 });
    expect(classifyWheel(toWheelLike(fast))).toBe('zoom');
    expect(classifyWheel(toWheelLike(fast, 8))).toBe('pan');
  });
});
