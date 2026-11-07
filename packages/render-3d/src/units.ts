/**
 * render-3d/units —— 纯值单位与常量（无 three 依赖，可在 Node 中单测）。
 *
 * 把「可单测的数学与常量」与「需要 GPU/WebGL 的装配」分开：
 * 本文件与 `camera-plan.ts`、`primitive-plan.ts` 都不 import three，
 * 因此 `vitest` 的 node 环境可直接覆盖它们。
 */

/** 二维档预设：正交俯视相机参数（设计 §十九 8）。 */
export interface OrthoPreset {
  /** 正交相机可见高度（世界单位）。 */
  viewHeight: number;
  /**
   * 极角（从 +Y 轴量起；**0 = 正俯视**，π/2 = 水平视线）。
   *
   * 二维档取接近 0 的小角度（与 core 的 `DEFAULT_TOP_POLAR` 同源）。
   * ⚠️ 曾误取 π/2 附近，导致画面被压成一条线（2026-10-27 实测修正）。
   */
  polar: number;
  /** 是否启用光照（二维档必须 false）。 */
  lighting: boolean;
  /** 线条是否走贴图（二维档必须 false）。 */
  texturedLines: boolean;
}

/** 二维档预设的默认值（六条中的相机与材质三条的数值部分）。 */
export const ORTHO_PRESET: OrthoPreset = {
  viewHeight: 600,
  polar: 0.12,
  lighting: false,
  texturedLines: false,
};

/** 默认背景色（与 view-world 的 `--mui-color-panel` 兜底一致）。 */
export const DEFAULT_BACKGROUND = 0xf5f2e9;

/**
 * 共面闪面规避量（世界单位）：线与平面同时存在时把线抬高该值。
 *
 * 设计 §十九 7「线永远不独立成几何贴在平面上——要么进着色器，要么抬高极小量，
 * 要么开多边形偏移」。3D 后端采用「抬高极小量」，原因：着色器路线（SDF）只用于
 * 规则图案（网格 / 地线 / 装饰），不规则线仍需要真几何；多边形偏移在 WebGPU
 * 后端的支持面不一致。
 */
export const COPLANAR_EPSILON = 0.02;

/** 图元在三维中的层偏移（避免同 z 图元互相闪面）。 */
export const LAYER_Z = {
  polygon: 0,
  polyline: COPLANAR_EPSILON,
  sprite: COPLANAR_EPSILON * 2,
  text: COPLANAR_EPSILON * 3,
} as const;

/**
 * 图元的绘制顺序（显式分层）。
 *
 * ## 为什么光靠 `LAYER_Z` 的微小抬升不够
 *
 * 二维画面是「按调用顺序叠画」，天然有确定的前后关系。三维靠**深度缓冲**判定
 * 前后，而平面图元之间只差 `COPLANAR_EPSILON = 0.02` 世界单位。
 *
 * 二维俯视时这点差距足够（深度值差异远大于精度）；但相机一倾斜，
 * 深度缓冲的有效精度沿视线方向被压缩，0.02 的差距可能落到同一个深度量化格 ——
 * 于是**同一层内部出现随机的深浅交错**，视觉上就是「毛刺 / 麻点」。
 * 2026-11-08 使用者报告的「切到真 3D 时图层突然重叠产生毛刺感」即此。
 *
 * ## 解法：分层渲染，层内不写深度
 *
 * 三层同时做，缺一不可：
 *
 * 1. **`renderOrder`**：给每层一个递增序数，让绘制顺序**完全由层决定**，
 *    不依赖深度缓冲的浮点精度。
 * 2. **`depthWrite = false`**：同层内的图元（如一批实例化实体）不互相写深度，
 *    避免它们之间的微小 z 差异产生斑驳。层的先后已由 `renderOrder` 保证。
 * 3. **保留 `depthTest = true`**：这样真正有前后的实体（若将来有 3D 立体几何）
 *    之间仍能正确遮挡。
 *
 * 副作用：同层内的实体不再互相遮挡。对本库的图元（面、线、点、文字）
 * 这正是想要的效果 —— 它们本来就该按「层」整体压在前一层之上。
 */
export const LAYER_ORDER = {
  /** 网格填充面（最底）。 */
  gridFill: 0,
  /** 网格线。 */
  gridLine: 1,
  /** 多边形（盘面）。 */
  polygon: 2,
  /** 折线。 */
  polyline: 3,
  /** 精灵（实例化点状实体）。 */
  sprite: 4,
  /** 文字（最上）。 */
  text: 5,
} as const;

/** 数值色（0xRRGGBB）→ CSS 十六进制串（three 的 `Color` 接受该形式）。 */
export function colorToCss(color: number | undefined, fallback = 0x888888): string {
  const value = typeof color === 'number' && Number.isFinite(color) ? color : fallback;
  return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** 数值色 → `{r,g,b}` 归一化分量（供 TSL uniform 使用）。 */
export function colorToRgb(color: number | undefined, fallback = 0x888888): { r: number; g: number; b: number } {
  const value = typeof color === 'number' && Number.isFinite(color) ? color : fallback;
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}
