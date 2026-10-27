/**
 * rendering/pixiBackend —— 二维渲染后端（PixiJS WebGL）对 `ViewportBackend` 的实现。
 *
 * 这是"参照实现"：三维后端要满足的每条语义，这里都有一份可对照的二维行为。
 * `view-world` 经本实现完成自动渲染与命中反算，行为与接口化之前逐条一致。
 *
 * 依赖边界：本文件在 `@main-ui/core` 内部，pixi 是 core 的 optional peer（既有先例），
 * 三方类型**不出现在** `backend.ts` 与 core 的公开签名里。
 */
import { Container } from 'pixi.js';
import type {
  EntitySnapshot,
  GridSpec,
  PolygonItem,
  PolylineItem,
  SpriteItem,
  TextItem,
} from '../primitives/types';
import type { TextureResolver } from '../primitives/sprite';
import { hitTestGrid } from '../primitives/hitTest';
import { createGrid } from '../primitives/grid';
import { createPolygonLayer } from '../primitives/polygon';
import { createPolylineLayer } from '../primitives/polyline';
import { createSpriteLayer } from '../primitives/sprite';
import { createTextLayer } from '../primitives/text';
import { batchToPolygonItems, batchToPolylineItems, batchToSpriteItems, batchToTextItems } from '../primitives/snapshot';
import type { Camera2D, Vec2, ViewBox } from './camera';
import type {
  BackendCapabilities,
  BackendCellHit,
  ViewportApplySnapshotOptions,
  ViewportBackend,
  ViewportBackendMountOptions,
  ViewportHandle,
} from './backend';
import { PixiViewport } from './pixiViewport';

export interface PixiBackendOptions {
  /** 纹理键解析器（可选）。 */
  textureResolver?: TextureResolver;
  /** 是否开启 MSAA（缺省 false，与 PixiViewport 既有缺省一致）。 */
  antialias?: boolean;
  /** 内部分辨率倍数（缺省对齐 `devicePixelRatio`，二维档保真预设第 4 条）。 */
  resolution?: number;
}

/**
 * 二维渲染后端。
 *
 * 二维档保真预设中属于本后端的四条：正交投影（Pixi 默认）、无光照（无光照概念）、
 * 线条不走贴图（Graphics 描边）、像素比对齐（`autoDensity` + `resolution`）。
 * 另两条（网格命中优先、悬停反馈）由 `pickCell` 与上层交互规定。
 */
export class PixiViewportBackend implements ViewportBackend {
  readonly name = 'pixi-2d';
  readonly capabilities: BackendCapabilities = {
    dimensions: [2],
    wideLines: true,
    extrude: false,
    msdfText: false,
    instancing: false,
    name: 'pixi-2d',
  };

  private viewport: PixiViewport | null = null;
  private sceneLayer: Container | null = null;
  private textureResolver: TextureResolver | undefined;
  private antialias: boolean;
  private resolutionOverride: number | undefined;
  private grid: GridSpec | null = null;
  private mounted = false;

  constructor(options: PixiBackendOptions = {}) {
    this.textureResolver = options.textureResolver;
    this.antialias = options.antialias ?? false;
    this.resolutionOverride = options.resolution;
  }

  /** 二维后端的 pixi 专属出口（仅供二维专用宿主，模板不暴露）。 */
  getPixiViewport(): PixiViewport | null {
    return this.viewport;
  }

  async mount(container: HTMLElement, options: ViewportBackendMountOptions): Promise<void> {
    if (this.mounted) return;
    const viewport = new PixiViewport(container, {
      viewBox: options.viewBox,
      minScale: options.minScale,
      maxScale: options.maxScale,
      paddingPx: options.paddingPx,
      background: options.background,
      antialias: this.antialias,
      resolution: this.resolutionOverride ?? options.devicePixelRatio ?? defaultDpr(),
      disablePan: true,
    });
    await viewport.init();
    this.viewport = viewport;

    const scene = new Container();
    scene.label = 'scene';
    viewport.world.addChild(scene);
    this.sceneLayer = scene;
    this.mounted = true;
  }

  unmount(): void {
    this.mounted = false;
    this.sceneLayer = null;
    this.viewport?.destroy();
    this.viewport = null;
  }

  applySnapshot(options: ViewportApplySnapshotOptions): void {
    this.grid = options.grid ?? null;
    this.clearScene();
    const scene = this.sceneLayer;
    if (!scene) return;

    if (this.grid) {
      scene.addChild(createGrid(this.grid));
    }
    const snapshot: EntitySnapshot | null | undefined = options.snapshot;
    if (!snapshot) return;

    // 层序与接口化之前一致：多边形（底）→ 折线 → 精灵 → 文字（顶）。
    const polygons: PolygonItem[] = [];
    const polylines: PolylineItem[] = [];
    const sprites: SpriteItem[] = [];
    const texts: TextItem[] = [];
    for (const batch of Object.values(snapshot.batches)) {
      switch (batch.geometry) {
        case 'text': texts.push(...batchToTextItems(batch)); break;
        case 'sprite':
        case 'point': sprites.push(...batchToSpriteItems(batch)); break;
        case 'polygon': polygons.push(...batchToPolygonItems(batch)); break;
        case 'polyline': polylines.push(...batchToPolylineItems(batch)); break;
        default: break;
      }
    }
    if (polygons.length) scene.addChild(createPolygonLayer(polygons));
    if (polylines.length) scene.addChild(createPolylineLayer(polylines));
    if (sprites.length) scene.addChild(createSpriteLayer(sprites, this.textureResolver));
    if (texts.length) scene.addChild(createTextLayer(texts));

    // 二维后端忽略 `z` / `extrude` / `dimensions`：图元解析层只搬运字段，
    // 五个图元渲染器不读它们，故带 z 与不带 z 的画面逐像素一致。
  }

  getCamera(): Camera2D {
    return this.viewport?.getCamera() ?? { scale: 1, pan: { x: 0, y: 0 } };
  }

  setCamera(camera: Camera2D): void {
    this.viewport?.setCamera(camera);
  }

  onCameraChange(listener: (camera: Camera2D) => void): () => void {
    if (!this.viewport) return () => undefined;
    this.viewport.onCameraChange(listener);
    return () => this.viewport?.onCameraChange(() => undefined);
  }

  screenToWorld(point: Vec2): Vec2 {
    return this.viewport?.screenToWorld(point) ?? point;
  }

  worldToScreen(point: Vec2): Vec2 {
    return this.viewport?.worldToScreen(point) ?? point;
  }

  /** 网格命中保留 `col` / `row` 语义（不以射线打几何替代）。 */
  pickCell(screen: Vec2): BackendCellHit | null {
    if (!this.viewport || !this.grid) return null;
    const world = this.viewport.screenToWorld(screen);
    const hit = hitTestGrid(world.x, world.y, this.grid);
    return hit ? { col: hit.col, row: hit.row } : null;
  }

  resize(width: number, height: number): void {
    this.viewport?.resize(width, height);
  }

  requestRender(): void {
    // Pixi 默认每帧自动渲染；此调用只用于对齐契约语义（手动模式下的显式重绘请求）。
    this.viewport?.app.render();
  }

  getHandle(): ViewportHandle {
    return {
      getSize: () => this.viewport?.getSize() ?? { width: 0, height: 0 },
      // 世界坐标内容根（相机已应用的 world 容器）：手动模式往这里 addChild，
      // 与接口化之前 `api.world` 的语义逐条一致。
      getRootObject: () => this.viewport?.world ?? null,
      requestRender: () => this.requestRender(),
    };
  }

  fitToBounds(viewBox?: ViewBox): void {
    this.viewport?.fitToBounds(viewBox);
  }

  setViewBox(viewBox: ViewBox): void {
    this.viewport?.setViewBox(viewBox);
  }

  getViewBox(): ViewBox {
    return this.viewport?.getViewBox() ?? { x: 0, y: 0, width: 800, height: 600 };
  }

  /** 读取当前网格规格（诊断用）。 */
  getGrid(): GridSpec | null {
    return this.grid;
  }

  private clearScene(): void {
    const scene = this.sceneLayer;
    if (!scene) return;
    const removed = scene.removeChildren();
    for (const child of removed) child.destroy({ children: true });
  }
}

/** 读取设备像素比（无 window 时退化为 1）。 */
export function defaultDpr(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}
