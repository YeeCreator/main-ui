/**
 * camera-gestures —— 视口相机操作的**判定纯函数**（零 DOM、可单测）。
 *
 * ## 为什么要归到 core
 *
 * 判定逻辑若散在各模板里，就会出现「同一个鼠标在 view-canvas 与 view-world
 * 上判型不同」这类故障（本库已发生过一次）。故一律收在此处，模板只调用。
 *
 * ## 两套操作体系（使用者 2026-11-07 定）
 *
 * | 设备 | 操作 | 手势 |
 * | --- | --- | --- |
 * | 鼠标+键盘 | 旋转 | `Alt + 左键拖拽` |
 * | 鼠标+键盘 | 平移 | `Alt + 中键拖拽` |
 * | 鼠标+键盘 | 缩放 | `Alt + 右键拖拽` |
 * | 触控板 | 旋转 | 双指扭转 |
 * | 触控板 | 平移 | 双指拖动 |
 * | 触控板 | 缩放 | 双指捏合 |
 *
 * 为什么是「修饰键 + 三键」而不是「中键 + 三个修饰键」：
 * 三个鼠标键在物理上并排，左中右 ↔ 旋转/平移/缩放 是**连续的空间映射**，
 * 靠本体感觉即可操作，不必低头确认按对了哪个键；而修饰键是离散切换，
 * 每次都要目视确认。这是 Blender / Maya 一类 DCC 的通用范式。
 *
 * `Alt`（macOS 上是 `Option`）之所以合适：它在空格键两侧、拇指可直接够到，
 * 按住时三键语义被临时改写，松开即回到普通的选择/编辑语义。
 */

/** 视口相机操作意图。 */
export type CameraGestureIntent = 'rotate' | 'pan' | 'zoom' | 'none';

/** 判定所需的指针事件最小字段（便于单测构造伪事件）。 */
export interface AltMouseGestureEvent {
  /** 0=左键，1=中键，2=右键。 */
  button: number;
  /** macOS 上 `Option` 键在浏览器里就是 `altKey`。 */
  altKey: boolean;
}

/**
 * 判定「Alt + 鼠标键」对应的相机操作。
 *
 * 未按 Alt 时恒返回 `'none'` —— 此时三键保持各自的默认语义
 * （左键选择、右键上下文菜单等），不被视图操作劫持。
 *
 * @param event 指针事件的最小字段。
 * @returns 相机操作意图。
 * @example
 * altMouseGesture({ button: 0, altKey: true })  // → 'rotate'
 * altMouseGesture({ button: 1, altKey: true })  // → 'pan'
 * altMouseGesture({ button: 2, altKey: true })  // → 'zoom'
 * altMouseGesture({ button: 0, altKey: false }) // → 'none'
 */
export function altMouseGesture(event: AltMouseGestureEvent): CameraGestureIntent {
  if (!event.altKey) return 'none';
  switch (event.button) {
    case 0:
      return 'rotate';
    case 1:
      return 'pan';
    case 2:
      return 'zoom';
    default:
      return 'none';
  }
}

/**
 * 由拖拽位移算出绕视口中心的**旋转角增量**（弧度）。
 *
 * 水平位移映射为绕竖轴旋转：向右拖 = 顺时针转。垂直位移当前不参与旋转
 * —— 绕水平轴的俯仰由三维档自行决定（二维档无俯仰可言），故此处只给方位角。
 *
 * @param deltaX 本次移动的水平屏幕位移（CSS 像素）。
 * @param radiansPerPixel 每像素对应的弧度（缺省 0.01，约 100px 转 57°）。
 * @returns 旋转角增量（弧度，正值 = 顺时针）。
 * @example
 * rotateDeltaFromDrag(100)   // → 1.0 rad（约 57°）
 * rotateDeltaFromDrag(-50)   // → -0.5 rad
 */
export function rotateDeltaFromDrag(
  deltaX: number,
  radiansPerPixel = 0.01,
): number {
  if (!Number.isFinite(deltaX)) return 0;
  return deltaX * radiansPerPixel;
}

/**
 * 由拖拽位移算出**缩放倍率**（>1 放大，<1 缩小）。
 *
 * 用指数映射而非线性：线性会让小幅拖拽几乎无感、大幅拖拽突然爆炸；
 * 指数映射保证「同样距离的拖拽产生同样的比例变化」，手感一致。
 *
 * @param deltaY 本次移动的垂直屏幕位移（CSS 像素，向下为正）。
 * @param perPixel 每像素的指数系数（缺省 0.005）。
 * @returns 缩放倍率（恒为正）。
 * @example
 * zoomFactorFromDrag(-100)  // → 1.65（向上拖 = 放大）
 * zoomFactorFromDrag(100)   // → 0.61（向下拖 = 缩小）
 */
export function zoomFactorFromDrag(deltaY: number, perPixel = 0.005): number {
  if (!Number.isFinite(deltaY)) return 1;
  // 向上拖（deltaY < 0）应放大，故取负号
  return Math.exp(-deltaY * perPixel);
}

/**
 * 由双指角度变化算出**旋转角增量**（弧度）。
 *
 * 触控板的双指扭转在浏览器里拿得到（`TouchEvent` 有多点坐标），
 * 因此这一路与桌面「Alt + 左键」共用同一个 `applyRotate` 落点。
 *
 * 角度差做了 ±π 归一，避免 0°/360° 跨界时画面突然反向转一大圈。
 *
 * @param previousAngle 上一帧双指连线角度（弧度）。
 * @param currentAngle 当前双指连线角度（弧度）。
 * @returns 归一化后的角度增量（弧度）。
 * @example
 * pinchRotateDelta(Math.PI * 0.49, Math.PI * -0.49)  // → 约 +0.06（跨界已归一）
 */
export function pinchRotateDelta(previousAngle: number, currentAngle: number): number {
  let delta = currentAngle - previousAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}
