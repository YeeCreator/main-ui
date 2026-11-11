/**
 * render-3d 冒烟诊断页的引导脚本。
 *
 * ## 目的
 *
 * 把「后端装配 → 喂快照 → 上屏」这条链路逐环节暴露成可读数字，
 * 用来回答单测回答不了的问题：
 *
 * - 场景里到底有几个对象？（几何没生成 vs 生成了不可见）
 * - 这一帧画了几次？（渲染循环没跑 vs 跑了没画）
 * - 相机在哪、视锥多大？（几何在视野外 vs 分辨率不对）
 * - viewport 实际值是多少？（CSS 像素 vs 物理像素的经典错误）
 *
 * ## 与单测的分工
 *
 * | 层 | 工具 | 证明什么 |
 * | --- | --- | --- |
 * | 纯函数 | vitest（`tests/*.test.ts`） | 算得对 |
 * | 上屏 | Playwright（`tests/e2e/*.spec.ts`） | **画得出来** |
 *
 * 两者不可互替：本页曾经「算得全对、画不出来」过了整整一轮。
 */

import {
  ThreeViewportBackend,
  buildScenePlan,
  createThreeBackend,
} from '../../../src/index';
import type { EntitySnapshot } from '@main-ui/core/primitives';

/** 一张最小的正方形世界：512×512，圆盘 + 三个点。 */
function makeSnapshot(): EntitySnapshot {
  const SEGMENTS = 96;
  const R = 200;
  const cx = 256;
  const cy = 256;
  const disc: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    disc.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  return {
    bounds: { x: 0, y: 0, width: 512, height: 512 },
    batches: {
      board: {
        kind: 'board',
        count: 1,
        geometry: 'polygon',
        columns: { points: [disc], fill: [0xe8c98a], fillAlpha: [1], strokeWidth: [0] },
      },
      dots: {
        kind: 'dots',
        count: 3,
        geometry: 'point',
        columns: {
          x: [200, 300, 256],
          y: [200, 200, 320],
          width: [24, 24, 24],
          height: [24, 24, 24],
          color: [0x1c1c1e, 0x1c1c1e, 0xd9534f],
        },
      },
      /**
       * 文字探针：复刻实机参数。
       *
       * 实机（棋类宿主）用 `fontSize: 9` + 单字符数字，肉眼看是四瓣白花；
       * 这里按同一组参数摆两个：大字对照组 + 与圆点重叠的小字（正是实机场景）。
       */
      labels: {
        kind: 'labels',
        count: 3,
        geometry: 'text',
        columns: {
          x: [160, 200, 300],
          y: [420, 200, 200],
          text: ['大 64', '1', '4'],
          color: [0x1c1c1e, 0xffffff, 0xffffff],
          fontSize: [64, 9, 9],
        },
      },
      /**
       * 离屏纹理面片探针（`?quad=1`）。
       *
       * 用一块**程序生成的棋盘格画布**当图像源 —— 真实的二维栅格内容形态。
       * 若这条渲染不出来，说明「电视机」链路（画布 → 纹理 → 面片）有问题。
       */
      raster: {
        kind: 'raster',
        count: 1,
        geometry: 'texture-quad',
        columns: {
          x: [256],
          y: [256],
          width: [320],
          height: [320],
          texture: ['diag-grid'],
          billboard: [false],
        },
      },
    },
    dimensions: 2,
  };
}

/**
 * 生成一块棋盘格画布（模拟「二维栅格内容」）。
 *
 * 用代码画而不是加载图片：诊断页必须**零外部依赖**，否则
 * 「图加载失败」与「纹理链路坏了」两种故障分不开。
 */
function makeRasterCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2f6f4f' : '#c9d8b6';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
  }
  return canvas;
}

interface Diag {
  mounted: boolean;
  canvasSize: { width: number; height: number } | null;
  canvasCssSize: { width: number; height: number } | null;
  dpr: number;
  viewport: { x: number; y: number; width: number; height: number } | null;
  sceneChildCount: number;
  sceneObjectCount: number;
  drawCalls: number;
  triangles: number;
  cameraPosition: { x: number; y: number; z: number } | null;
  cameraTarget: { x: number; y: number; z: number } | null;
  viewHeight: number;
  polar: number;
  snapshotBatchCount: number;
  planInstanceCount: number;
  /** 纯函数 buildScenePlan 单独跑的结果（与后端内部行为分界）。 */
  standalonePlanInstanceCount: number;
  standalonePlanUniqueCount: number;
  standalonePlanTextCount: number;
  standalonePlanInstancedGroups: number;
  /** 实际走的渲染后端（`webgpu(default)` / `webgl-forced`）。 */
  backend: string;
  /** 独立几何明细（多边形/折线）：点数、抬升 z、填色。 */
  uniqueDetail: string[];
  /** 实例化组明细（原型键 ×实例数）。 */
  instancedDetail: string[];
  /** 世界中心 (256,256) 经 worldToScreen 的结果。 */
  projectionCenter: string;
  /** 世界四角经 worldToScreen 的结果。 */
  projectionCorners: string;
  /** 文字贴片探测：几何尺寸 / 纹理尺寸 / 不透明像素数 / 位置。 */
  textProbe: string[];
  /** 是否进入了飞行模式（`?fly=1`）。 */
  flyEntered: boolean;
  flyCamera: string;
  flyPersp: string;
  errors: string[];
  /** 单项探测失败（不影响其它读数）。 */
  probeErrors: string[];
}

const diag: Diag = {
  mounted: false,
  canvasSize: null,
  canvasCssSize: null,
  dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  viewport: null,
  sceneChildCount: 0,
  sceneObjectCount: 0,
  drawCalls: 0,
  triangles: 0,
  cameraPosition: null,
  cameraTarget: null,
  viewHeight: 0,
  polar: 0,
  snapshotBatchCount: 0,
  planInstanceCount: 0,
  standalonePlanInstanceCount: 0,
  standalonePlanUniqueCount: 0,
  standalonePlanTextCount: 0,
  standalonePlanInstancedGroups: 0,
  backend: 'n/a',
  uniqueDetail: [],
  instancedDetail: [],
  projectionCenter: '—',
  projectionCorners: '—',
  textProbe: [],
  flyEntered: false,
  flyCamera: '—',
  flyPersp: '—',
  errors: [],
  probeErrors: [],
};

(window as unknown as { __DIAG__: Diag }).__DIAG__ = diag;

function render(): void {
  const panel = document.getElementById('panel');
  if (!panel) return;
  const row = (k: string, v: string, cls = ''): string =>
    `<div class="row"><span class="k">${k}</span><span class="${cls}">${v}</span></div>`;

  const objectsOk = diag.sceneObjectCount > 0;
  const drawsOk = diag.drawCalls > 0;
  /**
   * viewport 无法直接读（WebGPU 的 `getViewport` 在首帧前会抛错）。
   * 改用「世界中心是否投影到画面中心」当等价判据：
   * viewport 偏了，投影中心必然跟着偏。
   */
  const centerOk = /^\(480, 22[23]\)/.test(diag.projectionCenter);

  panel.innerHTML = [
    '<h3>render-3d 冒烟诊断</h3>',
    row('后端装配 (mount)', diag.mounted ? '✅ 成功' : '❌ 失败', diag.mounted ? 'ok' : 'bad'),
    row('canvas 绘图缓冲', diag.canvasSize ? `${diag.canvasSize.width} × ${diag.canvasSize.height}` : '—'),
    row('canvas CSS 尺寸', diag.canvasCssSize ? `${diag.canvasCssSize.width} × ${diag.canvasCssSize.height}` : '—'),
    row('devicePixelRatio', String(diag.dpr)),
    row('投影居中（viewport 等价判据）', centerOk ? '✅ 世界中心落在画面中心' : '❌ 偏移', centerOk ? 'ok' : 'bad'),
    row('场景根节点子数', String(diag.sceneChildCount)),
    row('场景对象总数', `${diag.sceneObjectCount} ${objectsOk ? '✅' : '❌ 没有几何'}`, objectsOk ? 'ok' : 'bad'),
    row('本帧 drawCalls', `${diag.drawCalls} ${drawsOk ? '✅' : '❌ 没画'}`, drawsOk ? 'ok' : 'bad'),
    row('本帧三角面', String(diag.triangles)),
    row(
      '相机位置',
      diag.cameraPosition
        ? `(${diag.cameraPosition.x.toFixed(1)}, ${diag.cameraPosition.y.toFixed(1)}, ${diag.cameraPosition.z.toFixed(1)})`
        : '—',
    ),
    row(
      '相机注视点',
      diag.cameraTarget
        ? `(${diag.cameraTarget.x.toFixed(1)}, ${diag.cameraTarget.y.toFixed(1)}, ${diag.cameraTarget.z.toFixed(1)})`
        : '—',
    ),
    row('视锥高度 viewHeight', diag.viewHeight.toFixed(1)),
    row('极角 polar', `${diag.polar.toFixed(3)} rad（${((diag.polar * 180) / Math.PI).toFixed(1)}°）`),
    row('快照批次数', String(diag.snapshotBatchCount)),
    row('渲染后端', diag.backend),
    row('飞行模式', diag.flyEntered ? '✅ 已进入' : '未启用'),
    row('自由相机', diag.flyCamera),
    row('透视相机参数', diag.flyPersp),
    row(
      '分界：单独 buildScenePlan',
      `实例 ${diag.standalonePlanInstanceCount} · 唯一几何 ${diag.standalonePlanUniqueCount} · 文字 ${diag.standalonePlanTextCount} · 实例化组 ${diag.standalonePlanInstancedGroups}`,
      diag.standalonePlanInstanceCount > 0 ? 'ok' : 'bad',
    ),
    row('后端内部规划实例数', String(diag.planInstanceCount), diag.planInstanceCount > 0 ? 'ok' : 'bad'),
    row('独立几何明细', diag.uniqueDetail.join(' ； ') || '（空）'),
    row('实例化组明细', diag.instancedDetail.join(' ； ') || '（空）'),
    row('投影：世界中心 → 屏幕', diag.projectionCenter),
    row('投影：世界四角 → 屏幕', diag.projectionCorners),
    row('文字贴片探测', diag.textProbe.join(' ； ') || '—'),
    diag.errors.length
      ? row('错误', diag.errors.join(' / '), 'bad')
      : row('错误', '无', 'ok'),
    diag.probeErrors.length
      ? row('单项探测失败', diag.probeErrors.join(' / '), 'warn')
      : row('单项探测失败', '无', 'ok'),
  ].join('');
}

/** 数一遍场景里的可绘制对象。 */
function countObjects(root: unknown): number {
  const node = root as { children?: unknown[]; isMesh?: boolean; isLine?: boolean; isPoints?: boolean; isSprite?: boolean };
  if (!node) return 0;
  let n = node.isMesh || node.isLine || node.isPoints || node.isSprite ? 1 : 0;
  for (const c of node.children ?? []) n += countObjects(c);
  return n;
}

async function main(): Promise<void> {
  const stage = document.getElementById('stage');
  if (!stage) return;

  // 固定尺寸，便于断言：960×445 正是实机事故时的容器尺寸
  stage.style.width = '960px';
  stage.style.height = '445px';

  /**
   * 渲染路径开关：`?backend=webgl` 强制走 WebGL 后端。
   *
   * 用途：把「几何/相机算错」与「WebGPU 在该环境画不出来」两类原因分开。
   * 同一份场景在 WebGL 下能出图、在 WebGPU 下不能，就是环境问题而非算法问题。
   */
  const forceWebGL = new URLSearchParams(location.search).get('backend') === 'webgl';
  diag.backend = forceWebGL ? 'webgl-forced' : 'webgpu(default)';

  try {
    const rasterCanvas = makeRasterCanvas();
    const showQuad = new URLSearchParams(location.search).get('quad') === '1';
    const backend = createThreeBackend({
      forceWebGL,
      /**
       * 纹理解析器：把 `diag-grid` 解析成那块棋盘格画布。
       *
       * `?quad=1` 时才提供解析器 —— 让它成为一个**可开关的变量**，
       * 于是能对比「有解析器 / 无解析器」两种情形（后者应当不画面片）。
       */
      textureResolver: showQuad ? (key: string) => (key === 'diag-grid' ? rasterCanvas : null) : null,
    }) as ThreeViewportBackend;
    await backend.mount(stage, {
      viewBox: { x: 0, y: 0, width: 512, height: 512 },
      devicePixelRatio: diag.dpr,
    });
    diag.mounted = true;

    const snapshot = makeSnapshot();
    diag.snapshotBatchCount = Object.keys(snapshot.batches).length;

    /**
     * 先单独跑一次 `buildScenePlan`（纯函数、不经后端）。
     *
     * 这是关键的**分界诊断**：
     * - 它产出 > 0 而场景仍空 ⇒ 问题在「规划 → 对象」这一段（scene-builder / three）
     * - 它本身就产出 0 ⇒ 问题在「快照 → 规划」这一段（批次未被识别）
     *
     * 没有这条分界，就只能对着「场景 0 对象」猜。
     */
    const standalonePlan = buildScenePlan({ snapshot });
    diag.standalonePlanInstanceCount = standalonePlan.instanceCount;
    diag.standalonePlanUniqueCount = standalonePlan.unique.length;
    diag.standalonePlanTextCount = standalonePlan.texts.length;
    diag.standalonePlanInstancedGroups = standalonePlan.instanced.size;

    backend.applySnapshot({ snapshot });

    /**
     * **飞行模式探针**（`?fly=1`）。
     *
     * 用来分界「飞行模式的相机会不会渲染」：
     * - `进入飞行` 之后仍能出图 ⇒ 装配正常
     * - 出图变空 ⇒ 在自由相机装配路径上（位置 / 姿态 / near-far / 投影）
     */
    const wantFly = new URLSearchParams(location.search).get('fly') === '1';
    if (wantFly) {
      try {
        backend.enterFly();
        diag.flyEntered = true;
      } catch (error) {
        diag.errors.push(`enterFly: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    /**
     * 取诊断读数。
     *
     * **每一项独立 try/catch**：任何一项探测失败都不得中断后续读数。
     *
     * 教训（2026-11-07，本文件第一版踩到）：`renderer.getViewport()` 在
     * WebGPU 下会抛 `Cannot read properties of undefined (reading 'copy')`。
     * 当时它排在读场景之前，一抛错后面全不执行，于是「场景对象 0 / 规划实例 0」
     * 这些**初始值**被误读成「真的没有几何」—— 诊断工具自己出错，
     * 伪装成了被测对象的故障，白查了一轮。
     */
    const probe = (fn: () => void): void => {
      try {
        fn();
      } catch (error) {
        diag.probeErrors.push(error instanceof Error ? error.message : String(error));
      }
    };

    const canvas = stage.querySelector('canvas');
    probe(() => {
      if (!canvas) return;
      diag.canvasSize = { width: canvas.width, height: canvas.height };
      const r = canvas.getBoundingClientRect();
      diag.canvasCssSize = { width: Math.round(r.width), height: Math.round(r.height) };
    });

    const anyBackend = backend as unknown as {
      renderer?: {
        getViewport?: () => { x: number; y: number; width: number; height: number };
        info?: { render?: { calls?: number; triangles?: number } };
      };
      scene?: unknown;
      currentPlan?: { position?: { x: number; y: number; z: number }; target?: { x: number; y: number; z: number } };
      getOrbit?: () => { viewHeight: number; polar: number };
      getScenePlan?: () => { instanceCount: number } | null;
    };

    const renderer = anyBackend.renderer;
    /**
     * 不在这里调 `renderer.getViewport()`。
     *
     * WebGPU 后端的 `CanvasTarget.getViewport` 在首帧提交前会抛
     * `Cannot read properties of undefined (reading 'copy')`。
     * 这个异常**不影响渲染本身**，但它会把后面的读数一起打断 ——
     * 第一版诊断页正是因此把所有读数留在初始值 0，被误读成
     * 「场景里没有几何」，白查了一轮。
     *
     * viewport 的正确性改用两条更可靠的证据交叉确认：
     * `canvas.width/height`（绘图缓冲）与「世界四角投影」是否吻合。
     */
    probe(() => {
      diag.drawCalls = renderer?.info?.render?.calls ?? 0;
      diag.triangles = renderer?.info?.render?.triangles ?? 0;
    });
    probe(() => {
      diag.sceneObjectCount = countObjects(anyBackend.scene);
      const scene = anyBackend.scene as { children?: unknown[] } | undefined;
      diag.sceneChildCount = scene?.children?.length ?? 0;
    });
    probe(() => {
      const plan = anyBackend.currentPlan;
      if (plan?.position) diag.cameraPosition = { ...plan.position };
      if (plan?.target) diag.cameraTarget = { ...plan.target };
    });
    probe(() => {
      const orbit = anyBackend.getOrbit?.();
      if (orbit) {
        diag.viewHeight = orbit.viewHeight;
        diag.polar = orbit.polar;
      }
    });
    probe(() => {
      const free = (backend as unknown as { freeState?: { position: {x:number;y:number;z:number}; yaw: number; pitch: number; speed?: number } }).freeState;
      if (!free) { diag.flyCamera = '（无自由相机）'; return; }
      const p = free.position;
      diag.flyCamera = `pos=(${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}) yaw=${free.yaw.toFixed(2)} pitch=${free.pitch.toFixed(2)} speed=${(free.speed ?? 0).toFixed(0)}`;
    });
    probe(() => {
      const cam = (backend as unknown as { perspCamera?: { near: number; far: number; fov: number; aspect: number; position: {x:number;y:number;z:number} } }).perspCamera;
      if (!cam) { diag.flyPersp = '（无）'; return; }
      diag.flyPersp = `near=${cam.near.toFixed(2)} far=${cam.far.toFixed(0)} fov=${cam.fov} aspect=${cam.aspect.toFixed(2)} pos=(${cam.position.x.toFixed(0)},${cam.position.y.toFixed(0)},${cam.position.z.toFixed(0)})`;
    });

    probe(() => {
      diag.planInstanceCount = anyBackend.getScenePlan?.()?.instanceCount ?? 0;
      const plan = anyBackend.getScenePlan?.() as unknown as
        | {
            unique?: Array<{ kind: string; points?: Array<{ x: number; y: number }>; z?: number; fill?: string }>;
            instanced?: Map<string, { instances?: unknown[] }>;
          }
        | null
        | undefined;
      diag.uniqueDetail = (plan?.unique ?? []).map(
        (u) =>
          `${u.kind}:n=${u.points?.length ?? 0},z=${u.z ?? '?'},fill=${u.fill ?? '-'},x0=${u.points?.[0]?.x?.toFixed(0) ?? '?'}`,
      );
      diag.instancedDetail = [...(plan?.instanced?.entries() ?? [])].map(
        ([k, g]) => `${k} ×${g.instances?.length ?? 0}`,
      );
    });

    /**
     * 投影探测：让后端自己回答「世界坐标落在屏幕哪里」。
     *
     * 这是分界「算得对但画得偏」与「投影本身就错」的唯一直接手段：
     * 若 `worldToScreen(世界中心)` 已经偏离画面中心，则错在相机数学；
     * 若它正确而截图仍偏移，则错在渲染装配（viewport / 相机对象不同步）。
     */
    probe(() => {
      const p = backend.worldToScreen({ x: 256, y: 256 });
      diag.projectionCenter = `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})  期望 (480, 222)`;
    });
    probe(() => {
      const pts: Array<[number, number]> = [
        [0, 0],
        [512, 0],
        [512, 512],
        [0, 512],
      ];
      diag.projectionCorners = pts
        .map(([x, y]) => {
          const p = backend.worldToScreen({ x, y });
          return `(${x},${y})→(${p.x.toFixed(0)},${p.y.toFixed(0)})`;
        })
        .join('  ');
    });

    /**
     * 文字贴片探测：纹理里到底有没有像素、贴片在世界里有多大。
     *
     * 「文字不可见」有两条完全不同的成因，读数能把它们分开：
     * - `alpha>0` 计数为 0 ⇒ 栅格化/纹理上传失败（canvas 空 或 DataTexture 空）
     * - 计数正常但世界尺寸极小 ⇒ `pxPerUnit` 换算错，贴片被缩成一个点
     */
    probe(() => {
      const lines: string[] = [];
      const walk = (node: unknown): void => {
        const n = node as {
          isMesh?: boolean;
          children?: unknown[];
          geometry?: { parameters?: { width?: number; height?: number } };
          material?: { map?: { image?: { data?: Uint8Array; width?: number; height?: number } } };
          position?: { x: number; y: number; z: number };
        };
        if (n?.isMesh && n.material?.map?.image?.data) {
          const img = n.material.map.image;
          const data = img.data as Uint8Array;
          let opaque = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
          lines.push(
            `几何 ${n.geometry?.parameters?.width?.toFixed(1) ?? '?'}×${n.geometry?.parameters?.height?.toFixed(1) ?? '?'}` +
              ` 纹理 ${img.width ?? '?'}×${img.height ?? '?'} 不透明像素 ${opaque}` +
              ` 位置 (${n.position?.x.toFixed(0) ?? '?'},${n.position?.y.toFixed(1) ?? '?'},${n.position?.z.toFixed(0) ?? '?'})` +
              ` billboard=${(n as unknown as { __textBillboard?: string }).__textBillboard ?? '无'}` +
              ` quat=(${(n as unknown as { quaternion?: { x: number; y: number; z: number; w: number } }).quaternion
                ? [
                    (n as unknown as { quaternion: { x: number; y: number; z: number; w: number } }).quaternion.x,
                    (n as unknown as { quaternion: { x: number; y: number; z: number; w: number } }).quaternion.y,
                    (n as unknown as { quaternion: { x: number; y: number; z: number; w: number } }).quaternion.z,
                    (n as unknown as { quaternion: { x: number; y: number; z: number; w: number } }).quaternion.w,
                  ]
                    .map((v) => v.toFixed(2))
                    .join(',')
                : '?'})`,
          );
        }
        for (const c of n?.children ?? []) walk(c);
      };
      walk(anyBackend.scene);
      diag.textProbe = lines.length ? lines : ['（未找到带 map 的 Mesh）'];
    });

  } catch (error) {
    diag.errors.push(error instanceof Error ? error.message : String(error));
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    diag.errors.push(stack.split('\n').slice(0, 4).join(' | '));
  }

  render();
}

void main();
