/**
 * input/camera-gestures —— 通用相机手势的**判定纯函数**（框架无关、零 DOM 依赖）。
 *
 * ## 为什么判定在这里、绑定不在这里
 *
 * 「通用相机手势」是**两层**：
 *
 * | 层 | 内容 | 归属 |
 * | --- | --- | --- |
 * | 判定层（本文件） | 「这次按下算不算平移」「Shift+滚轮的横移量是多少」 | **core** |
 * | 绑定层 | 事件监听、`preventDefault`、指针捕获、与模板自身监听的优先级 | **视图模板内** |
 *
 * 绑定层不能上提到 core：模板已在容器上消费 pointer/wheel，外部再插一层捕获必须
 * 与模板耦合「谁先拿到事件」。把它做成 core 的 `installGestures(host, …)`，
 * 等于把**监听顺序**变成隐式契约 —— 而本库要消灭的正是隐式契约。
 *
 * 判定层可以上提：纯函数、可单测、不绑定任何监听时序，非模板宿主（自建视口）
 * 也能直接复用，不必再抄一份。
 *
 * ## 三条手势的语义
 *
 * | 手势 | 判据 | 说明 |
 * | --- | --- | --- |
 * | 中键平移 | `pointerdown` 且 `button === 1` | 任何画布宿主都需要的通用能力 |
 * | 空格+左键平移 | 空格按住 且 `button === 0` | 左键被业务占用时的平移出口 |
 * | Shift+滚轮横移 | `wheel` 且 `shiftKey` | 只有纵向滚轮的鼠标做横向平移 |
 */

/** 滚轮横移的屏幕位移系数（Shift+滚轮 → 水平平移量）。 */
export const SHIFT_WHEEL_PAN_SPEED = 1;

/**
 * 判定「空格 + 左键」是否构成平移手势。
 *
 * @param spaceHeld 空格当前是否按住。
 * @param event 至少含 `button` 的指针事件。
 * @returns 是否应视为平移。
 * @example
 * isSpacePanGesture(true, { button: 0 })  // true
 * isSpacePanGesture(false, { button: 0 }) // false（空格未按住 → 左键归业务）
 * isSpacePanGesture(true, { button: 2 })  // false（非左键）
 */
export function isSpacePanGesture(spaceHeld: boolean, event: { button: number }): boolean {
  return spaceHeld && event.button === 0;
}

/**
 * 判定是否中键按下（`MouseEvent.button === 1`）。
 *
 * @param event 至少含 `button` 的指针事件。
 * @returns 是否中键。
 * @example
 * isMiddleButton({ button: 1 }) // true
 */
export function isMiddleButton(event: { button: number }): boolean {
  return event.button === 1;
}

/**
 * 判定是否「Shift + 滚轮」（横移手势）。
 *
 * @param event 至少含 `shiftKey` 的滚轮事件。
 * @returns 是否应视为横向平移。
 * @example
 * isShiftWheel({ shiftKey: true }) // true
 */
export function isShiftWheel(event: { shiftKey: boolean }): boolean {
  return event.shiftKey;
}

/**
 * 把 Shift+滚轮的量换算为**屏幕**位移（仅 x 分量）。
 *
 * **注意单位与口径**：相机 `pan` 是屏幕像素，故此处不再除以 `scale`
 * —— 否则视口移动量会被放大 `1/scale` 倍。
 *
 * **平台差异（调用方须注意）**：macOS 与其他平台在 Shift+滚轮时对
 * `deltaX` / `deltaY` 的填充方式不一致。本函数只负责「给定一个量 → 屏幕位移」，
 * 输入量由调用方决定取 `deltaX` 还是 `deltaY`；**该取哪一个必须真机核对**，
 * 不能凭文档假定。
 *
 * @param delta 滚轮纵向或横向增量（由调用方按平台选）。
 * @param speed 灵敏度，缺省 {@link SHIFT_WHEEL_PAN_SPEED}。
 * @returns 屏幕坐标下的位移（仅 x）。
 * @example
 * shiftWheelPanDelta(12)   // { x: 12, y: 0 }
 * shiftWheelPanDelta(12, 2) // { x: 24, y: 0 }
 */
export function shiftWheelPanDelta(delta: number, speed = SHIFT_WHEEL_PAN_SPEED): { x: number; y: number } {
  return { x: delta * speed, y: 0 };
}

/**
 * 判定焦点是否在文本输入控件内。
 *
 * 用途：空格键在输入框里是**打字**，不是平移修饰键。绑定层必须据此跳过，
 * 否则用户无法在画布旁的面板里输入空格。
 *
 * 零 DOM 依赖：只做 `tagName` / `isContentEditable` 的形状判断，
 * 便于 Node 环境单测。
 *
 * @param target 事件目标（可能不是元素）。
 * @returns 是否应视为「正在打字」。
 * @example
 * isTypingTarget({ tagName: 'INPUT' })    // true
 * isTypingTarget({ tagName: 'DIV' })      // false
 * isTypingTarget({ isContentEditable: true }) // true
 * isTypingTarget(null)                    // false
 */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

/**
 * 空格键状态跟踪器。
 *
 * **为什么需要状态**：空格是「按住期间生效」的修饰键，而 `pointerdown` 本身
 * 不带「空格是否按住」的信息。模板需要一个与自身生命周期同寿命的轻量状态，
 * 而不是把它塞进 props 或全局变量。
 *
 * 使用方负责在 `keydown` / `keyup` / `blur` 时喂入，并在卸载时 `reset()`。
 *
 * @returns 状态对象。
 * @example
 * const space = createSpaceKeyState()
 * space.hold()      // 空格按下
 * space.held        // true
 * space.release()   // 空格抬起
 * space.held        // false
 */
export function createSpaceKeyState(): { held: boolean; hold: () => void; release: () => void; reset: () => void } {
  let held = false;
  return {
    get held() { return held; },
    hold() { held = true; },
    release() { held = false; },
    reset() { held = false; },
  };
}
