/**
 * PixiViewport —— viewport-2d-kit 的 pixi 渲染内核（方案 B）。
 *
 * 定位：V2D 保留 core 纯函数（相机数学/坐标换算/约束/交互）作为"视口外壳"，
 * 本类作为"渲染内核"管理 PIXI.Application 与 world 容器，统一应用相机矩阵。
 *
 * 相机模型（与 core 一致）：
 *   screenPx = panPx + world * scale
 * 对应 pixi world 容器：
 *   world.scale.set(scale)
 *   world.position.set(pan.x, pan.y)
 *
 * 业务侧（如 battle-games）拿到 world 容器后，往里加世界坐标的 Graphics/Sprite，
 * 相机由本类唯一管理，杜绝"两套变换并存"。
 */
import { Application, Container } from 'pixi.js';
import type { Camera2D, Vec2, ViewBox } from '../core/index';
import { clamp, fitCameraToViewBox, panBy, screenToWorld, worldToScreen, zoomAtScreenPoint } from '../core/index';

export interface PixiViewportOptions {
  viewBox: ViewBox;
  minScale?: number;
  maxScale?: number;
  paddingPx?: number;
  /** pixi 背景色（0xRRGGBB） */
  background?: number;
  /** 是否开启 MSAA 抗锯齿（默认 false：点阵风格无需 MSAA，且大 canvas 上 MSAA 开销大） */
  antialias?: boolean;
  /** 内部分辨率倍数（默认 devicePixelRatio，保持清晰；调低可提速但文字模糊） */
  resolution?: number;
  /** 是否自动适配设备像素比（autoDensity） */
  autoDensity?: boolean;
  /** 是否保留绘制缓冲（默认 false；仅调试 readPixels 时开 true，否则显著拖慢 WebGL） */
  preserveDrawingBuffer?: boolean;
  /** 禁用平移（只读视口） */
  disablePan?: boolean;
}

export class PixiViewport {
  readonly app: Application;
  /** 世界坐标容器：相机已应用，业务往这里加内容 */
  readonly world: Container;

  private container: HTMLElement;
  private viewBox: ViewBox;
  private minScale: number;
  private maxScale: number;
  private paddingPx: number;
  private background: number;
  private antialias: boolean;
  private resolution: number;
  private autoDensity: boolean;
  private preserveDrawingBuffer: boolean;
  private disablePan: boolean;

  private camera: Camera2D;
  private size = { width: 0, height: 0 };

  private resizeObserver: ResizeObserver | null = null;
  private onCameraChangeCb: ((camera: Camera2D) => void) | null = null;
  private onInteractingChangeCb: ((interacting: boolean) => void) | null = null;

  // 交互状态
  private interacting = false;
  private pointerState = { pointerId: -1, lastX: 0, lastY: 0, active: false };

  private bound = {
    pointerdown: (e: PointerEvent) => this.handlePointerDown(e),
    pointermove: (e: PointerEvent) => this.handlePointerMove(e),
    pointerup: (e: PointerEvent) => this.finishPointer(e),
    pointercancel: (e: PointerEvent) => this.finishPointer(e),
    wheel: (e: WheelEvent) => this.handleWheel(e),
  };

  constructor(container: HTMLElement, opts: PixiViewportOptions) {
    this.container = container;
    this.viewBox = opts.viewBox;
    this.minScale = opts.minScale ?? 0.2;
    this.maxScale = opts.maxScale ?? 8;
    this.paddingPx = opts.paddingPx ?? 40;
    this.background = opts.background ?? 0xf5f2e9;
    this.antialias = opts.antialias ?? false;
    this.resolution = opts.resolution ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this.autoDensity = opts.autoDensity ?? true;
    this.preserveDrawingBuffer = opts.preserveDrawingBuffer ?? false;
    this.disablePan = opts.disablePan ?? false;

    this.camera = { scale: 1, pan: { x: 0, y: 0 } };
    this.app = new Application();
    this.world = new Container();
  }

  /** 异步初始化：等待 PIXI.Application 就绪并挂载。 */
  async init(): Promise<void> {
    await this.app.init({
      backgroundColor: this.background,
      antialias: this.antialias,
      resolution: this.resolution,
      autoDensity: this.autoDensity,
      preserveDrawingBuffer: this.preserveDrawingBuffer,
    });

    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.display = 'block';
    // 先挂载 canvas，容器才会被撑开到真实尺寸（空 div 在 flex 下高度会塌陷）。
    this.container.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);

    this.bindEvents();
    this.observeResize();

    // 立即读取挂载后的真实尺寸；布局尚未稳定时用 rAF 再兜底一次。
    this.syncSize();
    this.fitToBounds();
    requestAnimationFrame(() => {
      this.syncSize();
      this.fitToBounds();
    });
  }

  /** 读取容器真实尺寸并同步到 renderer（尺寸变化时才 resize）。 */
  private syncSize(): void {
    const w = Math.max(1, Math.round(this.container.clientWidth));
    const h = Math.max(1, Math.round(this.container.clientHeight));
    if (w === this.size.width && h === this.size.height) return;
    this.size = { width: w, height: h };
    this.resize(w, h);
  }

  /** 相机变化回调（外部用于同步状态）。 */
  onCameraChange(cb: (camera: Camera2D) => void): void {
    this.onCameraChangeCb = cb;
  }

  /** 交互状态回调（拖拽中 true / 空闲 false，外部用于同步 UI 状态）。 */
  onInteractingChange(cb: (interacting: boolean) => void): void {
    this.onInteractingChangeCb = cb;
  }

  /** 当前是否处于拖拽交互中。 */
  isInteracting(): boolean {
    return this.interacting;
  }

  /** 更新世界范围 viewBox 并自动重新 fit（相机归位到新范围）。 */
  setViewBox(viewBox: ViewBox): void {
    this.viewBox = { ...viewBox };
    this.fitToBounds();
  }

  /** 读取当前世界范围 viewBox。 */
  getViewBox(): ViewBox {
    return { ...this.viewBox };
  }

  /** 读取容器渲染尺寸（CSS 像素）。 */
  getSize(): { width: number; height: number } {
    return { ...this.size };
  }

  getCamera(): Camera2D {
    return { scale: this.camera.scale, pan: { x: this.camera.pan.x, y: this.camera.pan.y } };
  }

  setCamera(camera: Camera2D): void {
    this.camera = {
      scale: clamp(camera.scale, this.minScale, this.maxScale),
      pan: { x: camera.pan.x, y: camera.pan.y },
    };
    this.applyCamera();
    this.onCameraChangeCb?.(this.getCamera());
  }

  private applyCamera(): void {
    this.world.scale.set(this.camera.scale);
    this.world.position.set(this.camera.pan.x, this.camera.pan.y);
  }

  /** 适配世界范围 viewBox 到容器（默认使用当前 viewBox）。 */
  fitToBounds(viewBox?: ViewBox): void {
    if (this.size.width <= 0 || this.size.height <= 0) return;
    const target = viewBox ?? this.viewBox;
    this.setCamera(
      fitCameraToViewBox({
        containerPx: { width: this.size.width, height: this.size.height },
        viewBox: target,
        paddingPx: this.paddingPx,
      }),
    );
  }

  panBy(deltaScreen: Vec2): void {
    this.setCamera(panBy(this.camera, deltaScreen));
  }

  zoomAtScreenPoint(factor: number, anchorScreen: Vec2): void {
    this.setCamera(zoomAtScreenPoint(this.camera, { factor, anchorScreen }));
  }

  screenToWorld(point: Vec2): Vec2 {
    return screenToWorld(this.camera, point);
  }

  worldToScreen(point: Vec2): Vec2 {
    return worldToScreen(this.camera, point);
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
  }

  destroy(): void {
    this.unbindEvents();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.onCameraChangeCb = null;
    this.onInteractingChangeCb = null;
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }

  private setInteracting(value: boolean): void {
    if (this.interacting === value) return;
    this.interacting = value;
    this.onInteractingChangeCb?.(value);
  }

  private bindEvents(): void {
    const el = this.app.canvas;
    el.addEventListener('pointerdown', this.bound.pointerdown);
    el.addEventListener('pointermove', this.bound.pointermove);
    el.addEventListener('pointerup', this.bound.pointerup);
    el.addEventListener('pointercancel', this.bound.pointercancel);
    el.addEventListener('wheel', this.bound.wheel, { passive: false });
  }

  private unbindEvents(): void {
    const el = this.app.canvas;
    el.removeEventListener('pointerdown', this.bound.pointerdown);
    el.removeEventListener('pointermove', this.bound.pointermove);
    el.removeEventListener('pointerup', this.bound.pointerup);
    el.removeEventListener('pointercancel', this.bound.pointercancel);
    el.removeEventListener('wheel', this.bound.wheel);
  }

  private observeResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.syncSize();
    });
    this.resizeObserver.observe(this.container);
  }

  private toLocalPoint(event: PointerEvent | WheelEvent): Vec2 {
    const rect = this.app.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.disablePan) return;
    this.pointerState.pointerId = event.pointerId;
    this.pointerState.lastX = event.clientX;
    this.pointerState.lastY = event.clientY;
    this.pointerState.active = true;
    this.setInteracting(true);
    this.app.canvas.setPointerCapture(event.pointerId);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.pointerState.active || this.pointerState.pointerId !== event.pointerId || this.disablePan) return;
    const deltaX = event.clientX - this.pointerState.lastX;
    const deltaY = event.clientY - this.pointerState.lastY;
    this.pointerState.lastX = event.clientX;
    this.pointerState.lastY = event.clientY;
    this.panBy({ x: deltaX, y: deltaY });
  }

  private finishPointer(event: PointerEvent): void {
    if (this.pointerState.pointerId !== event.pointerId) return;
    this.pointerState.pointerId = -1;
    this.pointerState.active = false;
    this.setInteracting(false);
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const anchor = this.toLocalPoint(event);
    const factor = Math.exp(-event.deltaY * 0.0016);
    this.zoomAtScreenPoint(factor, anchor);
  }
}
