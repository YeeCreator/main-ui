import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SUPER_SAMPLE,
  orientAxisBillboard,
  orientFullBillboard,
  rasterizeText,
  syncTextBillboard,
  type CanvasFactory,
} from '../src/text-sprite';

/**
 * T3 用例：公告牌贴片文字。
 *
 * 三条要守住的：
 * 1. 像素换算**可推**：世界单位 × 超采样 × DPR = 像素，不允许隐式常数；
 * 2. 空串 / 超长串 / 多行 / 极小字号都安全，不产出 0 尺寸；
 * 3. `axis` 档的朝向数学正确（只绕 Y 轴、转向相机、不受俯仰影响）。
 *
 * 测试环境是 node（无 DOM），故注入一个最小 canvas 假件：它只承担
 * `measureText`（用于定宽）与属性读写，**换算逻辑本身仍是产品代码**。
 */

/** 最小 canvas 假件：每个字符假定宽 = 字号 × 0.6（近似等宽，便于断言）。 */
function makeFakeCanvasFactory(): CanvasFactory {
  return () => {
    const ctx: Record<string, unknown> = {
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
      measureText(text: string): { width: number } {
        const m = /^(\d+(?:\.\d+)?)px/.exec(String(ctx.font));
        const px = m ? Number(m[1]) : 10;
        return { width: text.length * px * 0.6 };
      },
      fillText(): void {
        /* 假件：不真的绘制 */
      },
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: (kind: string) => (kind === '2d' ? ctx : null),
    };
    return canvas as unknown as HTMLCanvasElement;
  };
}

const fake = makeFakeCanvasFactory();

describe('rasterizeText：像素换算可推', () => {
  test('高度 = 行高 × 行数 + 上下 padding（每步都能手算）', () => {
    // pxPerUnit = superSample(2) × dpr(1) = 2；fontPx = 20×2 = 40
    // 行高 = round(40 × 1.25) = 50；padding = round(40 × 0.15) = 6
    const r = rasterizeText({
      text: 'A',
      fontSize: 20,
      color: '#000',
      superSample: 2,
      devicePixelRatio: 1,
      createCanvas: fake,
    });
    expect(r.height).toBe(50 + 6 * 2);
    expect(r.width).toBeGreaterThan(0);
  });

  test('DPR 翻倍 → 像素尺寸翻倍（清晰度预算随屏幕走）', () => {
    const a = rasterizeText({ text: 'AB', fontSize: 20, color: '#000', superSample: 2, devicePixelRatio: 1, createCanvas: fake });
    const b = rasterizeText({ text: 'AB', fontSize: 20, color: '#000', superSample: 2, devicePixelRatio: 2, createCanvas: fake });
    expect(b.height).toBe(a.height * 2);
    expect(b.width).toBe(a.width * 2);
  });

  test('超采样翻倍 → 像素尺寸翻倍（与 DPR 同一量纲）', () => {
    const a = rasterizeText({ text: 'AB', fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    const b = rasterizeText({ text: 'AB', fontSize: 20, color: '#000', superSample: 2, devicePixelRatio: 1, createCanvas: fake });
    expect(b.height).toBe(a.height * 2);
  });

  test('缺省超采样为 2（有明确常量，不靠魔法数）', () => {
    expect(DEFAULT_SUPER_SAMPLE).toBe(2);
  });
});

describe('rasterizeText：边界安全', () => {
  test('空串产出 ≥1 像素画布（不出现 0 尺寸纹理）', () => {
    const r = rasterizeText({ text: '', fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  test('多行高度按行数线性增长', () => {
    const one = rasterizeText({ text: 'A', fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    const three = rasterizeText({ text: 'A\nB\nC', fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    // 高度差 = 2 行 × 行高 25（padding 相同、抵消）
    expect(three.height - one.height).toBe(2 * 25);
  });

  test('超长单行不崩，宽度随内容增长', () => {
    const short = rasterizeText({ text: 'A', fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    const long = rasterizeText({ text: 'A'.repeat(200), fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    expect(long.width).toBeGreaterThan(short.width);
  });

  test('极小字号也至少 1 像素（避免除零/零尺寸）', () => {
    const r = rasterizeText({ text: 'A', fontSize: 0.1, color: '#000', superSample: 1, devicePixelRatio: 1, createCanvas: fake });
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  test('无 DOM 且未注入工厂 → 抛明确错误（不静默造空纹理）', () => {
    expect(() =>
      rasterizeText({ text: 'A', fontSize: 20, color: '#000', superSample: 1, devicePixelRatio: 1 }),
    ).toThrow(/需要 DOM/);
  });
});

describe('axis 档朝向数学', () => {
  /** 最小 Object3D 假件：只记录 rotation。 */
  function makeObject() {
    const rec = { x: 0, y: 0, z: 0 };
    return {
      position: { x: 0, y: 0, z: 0 },
      rotation: {
        set: (x: number, y: number, z: number) => {
          rec.x = x;
          rec.y = y;
          rec.z = z;
        },
      },
      read: () => ({ ...rec }),
    };
  }

  test('相机在 +Z → 不旋转（平面法线本就朝 +Z）', () => {
    const o = makeObject();
    orientAxisBillboard(o as never, { x: 0, y: 10, z: 100 });
    expect(o.read().y).toBeCloseTo(0, 6);
  });

  test('相机在 +X → 绕 Y 转 90°', () => {
    const o = makeObject();
    orientAxisBillboard(o as never, { x: 100, y: 0, z: 0 });
    expect(o.read().y).toBeCloseTo(Math.PI / 2, 6);
  });

  test('相机高度不影响 Y 轴角（只绕 Y 转，不看俯仰）', () => {
    const a = makeObject();
    const b = makeObject();
    orientAxisBillboard(a as never, { x: 50, y: 999, z: 50 });
    orientAxisBillboard(b as never, { x: 50, y: 0, z: 50 });
    expect(a.read().y).toBeCloseTo(b.read().y, 10);
  });

  test('x 与 z 都不为零时取 atan2(dx, dz)', () => {
    const o = makeObject();
    orientAxisBillboard(o as never, { x: 1, y: 0, z: 1 });
    expect(o.read().y).toBeCloseTo(Math.PI / 4, 6);
  });
});

describe('full 档朝向：局部 +Y 必须与相机 up 同向', () => {
  /**
   * 最小 Object3D 假件：只保留位置与四元数，并把基向量算出来供断言。
   *
   * `orientFullBillboard` 通过 `quaternion.setFromRotationMatrix` 写入，故假件需要
   * 实现它并把矩阵的列存下来（列 = 局部轴在世界中的方向）。
   */
  function makeObject(pos = { x: 0, y: 0, z: 0 }) {
    const cols = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    return {
      position: { ...pos },
      quaternion: {
        setFromRotationMatrix(m: { elements: number[] }) {
          const e = m.elements;
          cols.x = [e[0], e[1], e[2]];
          cols.y = [e[4], e[5], e[6]];
          cols.z = [e[8], e[9], e[10]];
        },
      },
      cols: () => cols,
    };
  }

  test('俯视相机（up = (0,0,-1)）下，局部 +Y 与 up 点积 > 0.9（字不倒）', () => {
    const o = makeObject();
    // 相机在正上方稍偏，与后端 ORTHO_PRESET 的 polar=0.12 同量级
    orientFullBillboard(o as never, { x: 0, y: 794, z: 300 }, { x: 0, y: 0, z: -1 });
    const [, yx, yy, yz] = [0, ...o.cols().y];
    const dot = yx * 0 + yy * 0 + yz * -1;
    expect(dot).toBeGreaterThan(0.9);
  });

  test('俯视相机下，局部 +Z 指向相机（点积 > 0.9）', () => {
    const o = makeObject({ x: 0, y: 0, z: 0 });
    orientFullBillboard(o as never, { x: 0, y: 794, z: 300 }, { x: 0, y: 0, z: -1 });
    const [zx, zy, zz] = o.cols().z;
    const len = Math.hypot(0, 794, 300);
    const dot = (zx * 0 + zy * 794 + zz * 300) / len;
    expect(dot).toBeGreaterThan(0.9);
  });

  test('相机 up 为世界 +Y（侧视）时，局部 +Y 仍与 up 同向', () => {
    const o = makeObject();
    orientFullBillboard(o as never, { x: 100, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const [, yx, yy, yz] = [0, ...o.cols().y];
    expect(yx * 0 + yy * 1 + yz * 0).toBeGreaterThan(0.9);
  });

  test('相机与贴片重合时不产生 NaN（退化输入安全）', () => {
    const o = makeObject({ x: 10, y: 10, z: 10 });
    orientFullBillboard(o as never, { x: 10, y: 10, z: 10 }, { x: 0, y: 0, z: -1 });
    const c = o.cols();
    expect([...c.x, ...c.y, ...c.z].every((v) => Number.isFinite(v))).toBe(true);
  });

  test("syncTextBillboard 对 'none' 档不做任何事", () => {
    const o = makeObject();
    (o as unknown as { __textBillboard?: string }).__textBillboard = 'none';
    const before = JSON.stringify(o.cols());
    syncTextBillboard(o as never, { x: 100, y: 100, z: 100 }, { x: 0, y: 0, z: -1 });
    expect(JSON.stringify(o.cols())).toBe(before);
  });
});
