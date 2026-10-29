/**
 * core/rendering/camera —— 变换串的**介质隔离**。
 *
 * 守护目标：同一个「相机 → 变换串」，两个目标介质的语法不可互换。
 * 这是本库最贵的一次教训：SVG 语法（无单位）放进 CSS 位会被浏览器
 * **静默丢弃整条声明** —— 相机在变、画面不动，排查方向全被引向事件层。
 */
import { describe, expect, test } from 'vitest';
import {
  cameraToCssStyle,
  cameraToCssTransform,
  cameraToSvgTransform,
  type Camera2D,
} from '../src/rendering';

const camera: Camera2D = { scale: 0.2004, pan: { x: 80, y: 370.68 } };

describe('cameraToSvgTransform · SVG 介质', () => {
  test('无单位，translate 参数用空格分隔', () => {
    expect(cameraToSvgTransform(camera)).toBe('translate(80 370.68) scale(0.2004)');
  });

  test('旋转用角度、无 deg 后缀', () => {
    const out = cameraToSvgTransform({ scale: 1, pan: { x: 0, y: 0 }, rotation: Math.PI / 2 });
    expect(out).toContain('rotate(90)');
    expect(out).not.toContain('deg');
  });

  test('无旋转时省略 rotate()', () => {
    expect(cameraToSvgTransform(camera)).not.toContain('rotate');
  });
});

describe('cameraToCssTransform · CSS 介质', () => {
  test('平移带 px，参数用逗号分隔', () => {
    expect(cameraToCssTransform(camera)).toBe('translate(80px, 370.68px) scale(0.2004)');
  });

  test('旋转带 deg 后缀', () => {
    const out = cameraToCssTransform({ scale: 1, pan: { x: 0, y: 0 }, rotation: Math.PI / 2 });
    expect(out).toContain('rotate(90deg)');
  });

  test('CSS 串必须能让浏览器接受（含 px 与合法分隔符）', () => {
    const out = cameraToCssTransform(camera);
    // 无单位串在 CSS 位是非法值 —— 这是本次要消灭的失败形态
    expect(out).toMatch(/translate\([-\d.]+px,\s*[-\d.]+px\)/);
  });
});

describe('两种介质的关系', () => {
  test('语法不可互换：去掉单位与逗号后才是同一变换', () => {
    const css = cameraToCssTransform(camera);
    const svg = cameraToSvgTransform(camera);
    expect(css).not.toBe(svg);
    // 归一化后等价 ⇒ 证明两者是"同一变换、两种语法"，而非两次不同计算
    expect(css.replace(/,\s*/g, ' ').replace(/px/g, '')).toBe(svg);
  });

  test('无旋转时两者都不含 rotate', () => {
    expect(cameraToSvgTransform(camera)).not.toContain('rotate');
    expect(cameraToCssTransform(camera)).not.toContain('rotate');
  });
});

describe('cameraToCssStyle · 推荐入口', () => {
  test('返回对象且自带 transformOrigin', () => {
    const style = cameraToCssStyle(camera);
    expect(style.transform).toBe(cameraToCssTransform(camera));
    expect(style.transformOrigin).toBe('0 0');
  });

  test('transformOrigin 必不可少：缺它旋转中心错，缩放会漂移', () => {
    expect(cameraToCssStyle(camera).transformOrigin).toBeDefined();
  });
});
