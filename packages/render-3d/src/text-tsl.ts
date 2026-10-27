/**
 * render-3d/text-tsl —— 三维档文字材质（自建 TSL 实现）· **未启用**
 *
 * ## 当前状态：实验性，**默认不接入**
 *
 * 本文件是「用 TSL 重写文字材质」这一路线的完整实现与实测记录。
 * **它没有修好三维档的文字渲染**，因此 `text-factory.ts` 已回退到 troika 原材质
 * + 明确的「三维档文字不可用」声明。保留本文件的价值是：它把这条路线能走多远、
 * 卡在哪一层，用可复现的方式钉死了，后人不必从头再走一遍。
 *
 * ## 已实测确认的四个坑（都是真坑，不是猜测）
 *
 * 1. **必须设 `isTroikaTextMaterial = true`**
 *    `Text.js:483` 的 `onBeforeRender` 里写着
 *    `if (material.isTroikaTextMaterial) this._prepareForRender(material)`。
 *    缺这个标记 → SDF 图集、字形包围盒、裁剪矩形等 uniform 永不写入，
 *    全是初值（`clipRect` 为 0/0/0/0）→ 顶点被 clamp 压平 → 文字塌成一个点。
 *
 * 2. **`MeshBasicNodeMaterial` 没有 `material.uniforms`**
 *    troika 的 `_prepareForRender` 直接写 `material.uniforms.uTroikaXxx.value`，
 *    故须在材质上自挂一个同形状兼容对象。
 *
 * 3. **`WebGPURenderer` 下 `Object3D.onBeforeRender` 不保证被调用**
 *    实测 `_prepareForRender` 调用次数恒为 0，即便把 `frustumCulled` 设为 false、
 *    `layers` 与相机匹配、`visible` 为 true、对象确实在场景内（draw call 会随
 *    可见性变化，证明它在渲染列表里）。**绕法**：在 `text.sync()` 回调里手动调一次
 *    `text.onBeforeRender(...)`，uniform 立刻全部正确
 *    （`sdfGlyphSize=64`、`sdfTextureSize=2048×128`、`clipRect=-2400.5..2431.5`）。
 *
 * 4. **`positionNode` 对 `InstancedBufferGeometry` 不生效（本次的硬阻塞）**
 *    即便把顶点位置写成与任何属性无关的常量（`uv()*60+120`），渲染结果仍是一个点；
 *    换纯色 `colorNode` 且不设任何自定义 node 时是一个 1×1 的点（符合预期 ——
 *    troika 的模板几何是 `PlaneGeometry(1,1,1)`，靠实例属性展开）。
 *    结论：**自定义 `positionNode` 未参与该几何的顶点构建**，
 *    实例展开必须走 three 支持的其它途径（`setupPosition` 钩子、
 *    或改成非实例化的展开几何）。
 *
 * ## 再往下走的三条候选路线（都需要重新评估，不要再逐点试）
 *
 * | 路线 | 做法 | 主要风险 |
 * | --- | --- | --- |
 * | A1 | 用 `material.setupPosition(builder)` 覆写，而不是赋 `positionNode` | 属 three 内部 API，版本升级易碎 |
 * | A2 | 抛弃 troika 的实例几何，向 troika 只取字形图集与 `glyphBounds` 数组，自己建**非实例化**几何 | 字形多时顶点数线性增长（N 字 ≈ 4N 顶点，1 万字 4 万顶点仍可接受） |
 * | A3 | 文字不进三维场景，改二维叠加层 | 失去深度遮挡与透视变形，但不是「不可用」 |
 *
 * ## 结论对下游的含义
 *
 * **三维档文字目前不可用**（不是"更差"，是"不显示"）。
 * 保真对照的 `text-clarity` 一项在三维档判为未通过，这是设计 §十九 7 的已知缺口，
 * 不是回归。含文字的条目在三维档放行前必须先解决本条。
 */

import { Color, Matrix3, Texture, Vector2, Vector4 } from 'three';
import {
  Discard,
  Fn,
  attribute,
  clamp,
  dFdx,
  dFdy,
  float,
  floor,
  length,
  max,
  mix,
  mod,
  smoothstep,
  texture,
  uniform,
  uniformTexture,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

/** troika 写入的 uniform 名（与 `Text.js` 的 `_prepareForRender` 逐字对应）。 */
const UNIFORM_KEYS = [
  'uTroikaSDFTexture',
  'uTroikaSDFTextureSize',
  'uTroikaSDFGlyphSize',
  'uTroikaSDFExponent',
  'uTroikaTotalBounds',
  'uTroikaClipRect',
  'uTroikaEdgeOffset',
  'uTroikaFillOpacity',
  'uTroikaPositionOffset',
  'uTroikaCurveRadius',
  'uTroikaBlurRadius',
  'uTroikaStrokeWidth',
  'uTroikaStrokeColor',
  'uTroikaStrokeOpacity',
  'uTroikaOrient',
  'uTroikaUseGlyphColors',
  'uTroikaSDFDebug',
] as const;

type UniformKey = (typeof UNIFORM_KEYS)[number];

/** 与 troika `_prepareForRender` 兼容的 uniform 收集器形状。 */
export interface TroikaCompatibleUniforms {
  [key: string]: { value: unknown };
}

/** TSL 文字材质（对外类型：既是 NodeMaterial，也带 troika 需要的两个兼容成员）。 */
export type TslTextMaterial = MeshBasicNodeMaterial & {
  uniforms: TroikaCompatibleUniforms;
  isDerivedFrom(base: unknown): boolean;
  /** 在 `onBeforeRender` 之外同步一次 uniform（troika 在渲染前写，此处只做兜底）。 */
  syncUniforms(): void;
};

/**
 * 创建与 troika 兼容的 TSL 文字材质。
 *
 * @param baseMaterial troika 传入的基准材质（其 `color`/`map` 等未使用 —— 文字颜色来自
 *   字形属性或 `color`；本实现遵循 troika 的"派生材质不改基准"约定）。
 * @returns 可直接交给 troika `Text` 的材质。
 * @example
 * ```ts
 * const text = new Text();
 * text.createDerivedMaterial = (base) => createTslTextMaterial(base);
 * text.text = '三维文字';
 * text.sync();
 * ```
 */
export function createTslTextMaterial(baseMaterial?: unknown): TslTextMaterial {
  const material = new MeshBasicNodeMaterial() as TslTextMaterial;

  // ---- 1. TSL uniform 节点（值变化由 troika 写入，见下方 uniforms 代理） ----
  // 注：纹理不能用 `uniform(null)` —— 从 `null` 推不出节点类型，采样会拿到空值。
  // `uniformTexture` 专为「先声明、后赋值」的纹理通道而设（troika 在渲染前才把
  // SDF 图集写进来）。其余 uniform 都从初值直接推断，无需断言。
  const uSDFTexture = uniformTexture(undefined);
  const uSDFTextureSize = uniform(new Vector2(1, 1));
  const uSDFGlyphSize = uniform(0);
  const uSDFExponent = uniform(0);
  const uTotalBounds = uniform(new Vector4(0, 0, 0, 0));
  const uClipRect = uniform(new Vector4(0, 0, 0, 0));
  const uEdgeOffset = uniform(0);
  const uFillOpacity = uniform(1);
  const uPositionOffset = uniform(new Vector2());
  const uCurveRadius = uniform(0);
  const uBlurRadius = uniform(0);
  const uStrokeWidth = uniform(0);
  const uStrokeColor = uniform(new Color());
  const uStrokeOpacity = uniform(1);
  const uOrient = uniform(new Matrix3());
  const uUseGlyphColors = uniform(true);
  const uSDFDebug = uniform(false);
  // 文字颜色：troika 在 `_prepareForRender` 末尾把 `text.color` 写到材质的 `.color`
  // 上，故这里读 `baseMaterial.color`；没有则用黑色。
  const baseColor = (baseMaterial as { color?: { r: number; g: number; b: number } } | undefined)?.color;
  const fillColor = vec3(baseColor?.r ?? 0, baseColor?.g ?? 0, baseColor?.b ?? 0);

  // ---- 2. 字形实例属性（由 troika 的 GlyphsGeometry 提供） ----
  const aGlyphBounds = attribute('aTroikaGlyphBounds', 'vec4');
  const aGlyphIndex = attribute('aTroikaGlyphIndex', 'float');
  // 注：troika 只在传了 `glyphColors` 时才建 `aTroikaGlyphColor`；多数场景没有这个
  // 属性。声明它会让 three 报 "Vertex attribute not found" 并可能影响着色器链接，
  // 故不声明；文字颜色改用材质的 `color`（见下方 uFillColor）。

  // ---- 3. 顶点：把单位四边形展开到各字形的平面包围盒，并算 uv 与图集格子 ----
  const vGlyphUV = varying(vec2(0, 0), 'vTroikaGlyphUV');
  const vTextureUVBounds = varying(vec4(0, 0, 1, 1), 'vTroikaTextureUVBounds');
  const vTextureChannel = varying(float(0), 'vTroikaTextureChannel');
  const vGlyphDimensions = varying(vec2(1, 1), 'vTroikaGlyphDimensions');

  /**
   * 计算一个顶点的平面位置（XY 平面），并把所需的 varying 一并赋值。
   *
   * 必须在 `positionNode` 内部**直接调用**（不要在更外层先包一层 `Fn` 再调）：
   * TSL 的 `varying.assign()` 只有在被编进顶点着色器的表达式树里才会执行；
   * 若嵌套进另一个 `Fn` 而那个 `Fn` 的返回值没被使用，varying 就会静默不赋值
   * —— 表现为片元阶段拿到的全是初值，整段文字塌成一个点。
   */
  const computeVertex = (): { x: unknown; y: unknown; z: unknown } => {
    const quadUv = uv();

    // 加边距后的包围盒，再与裁剪矩形求交
    const outlineBounds = vec4(
      aGlyphBounds.x.sub(uEdgeOffset).sub(uBlurRadius),
      aGlyphBounds.y.sub(uEdgeOffset).sub(uBlurRadius),
      aGlyphBounds.z.add(uEdgeOffset).add(uBlurRadius),
      aGlyphBounds.w.add(uEdgeOffset).add(uBlurRadius),
    );
    const clippedBounds = vec4(
      clamp(outlineBounds.x, uClipRect.x, uClipRect.z),
      clamp(outlineBounds.y, uClipRect.y, uClipRect.w),
      clamp(outlineBounds.z, uClipRect.x, uClipRect.z),
      clamp(outlineBounds.w, uClipRect.y, uClipRect.w),
    );

    // 裁剪后的相对坐标（0..1 表示该字形可见部分）
    const clippedXY = vec2(
      mix(clippedBounds.x, clippedBounds.z, quadUv.x).sub(aGlyphBounds.x),
      mix(clippedBounds.y, clippedBounds.w, quadUv.y).sub(aGlyphBounds.y),
    ).div(vec2(aGlyphBounds.z.sub(aGlyphBounds.x), aGlyphBounds.w.sub(aGlyphBounds.y)));

    // 平面位置：包围盒内插
    const glyphPos = vec2(
      mix(aGlyphBounds.x, aGlyphBounds.z, clippedXY.x),
      mix(aGlyphBounds.y, aGlyphBounds.w, clippedXY.y),
    );

    // 曲面文字（curveRadius ≠ 0 时弯成圆柱面）
    const angle = glyphPos.x.div(max(uCurveRadius, float(1e-6)));
    const curvedX = mix(glyphPos.x, angle.sin().mul(uCurveRadius), uCurveRadius.abs().min(1));
    const curvedZ = mix(float(0), uCurveRadius.sub(angle.cos().mul(uCurveRadius)), uCurveRadius.abs().min(1));

    const vGlyph = vGlyphUV;
    const vBounds = vTextureUVBounds;
    const vChannel = vTextureChannel;
    const vDims = vGlyphDimensions;

    vGlyph.assign(clippedXY);
    vDims.assign(vec2(aGlyphBounds.z.sub(aGlyphBounds.x), aGlyphBounds.w.sub(aGlyphBounds.y)));

    // 图集格子起址（每格 4 个通道共用一张灰度图）
    const txCols = uSDFTextureSize.x.div(max(uSDFGlyphSize, float(1)));
    const txUvPerSquare = uSDFGlyphSize.div(max(uSDFTextureSize.x, float(1)));
    const txUvPerSquareY = uSDFGlyphSize.div(max(uSDFTextureSize.y, float(1)));
    const cellIndex = floor(aGlyphIndex.div(4));
    const txStartU = mod(cellIndex, txCols).mul(txUvPerSquare);
    const txStartV = floor(cellIndex.div(txCols)).mul(txUvPerSquareY);
    vBounds.assign(vec4(txStartU, txStartV, txStartU.add(txUvPerSquare), txStartV.add(txUvPerSquareY)));
    vChannel.assign(mod(aGlyphIndex, 4));

    return { x: curvedX, y: glyphPos.y, z: curvedZ };
  };

  // 把平面文字摆到水平地面（与场景内其它图元一致：y 是高度）。
  // 注：`positionNode` 必须返回 **vec3** —— three 的 `NodeMaterial.setupPosition`
  // 是 `positionLocal.assign(subBuild(positionNode, 'POSITION', 'vec3'))`，
  // 返回 vec4 会得到错误的位置语义（表现为图形塔缩成一个点）。
  // ⚠️ 这里**不做**地面旋转。
  //
  // troika 的 `Text` 是 `Mesh`，几何本来就在 XY 平面（面向 +Z），文字方向由
  // `Object3D.rotation` 决定 —— 本包的 `scene-builder` 已对文字对象设了
  // `rotation.x = -π/2`（地面朝向）。若在 `positionNode` 里再转一次，就是
  // **双重旋转**：XY 平面的字形被压成一条线（实测：flat 纯色模式也只画出一个点）。
  //
  // 正确分工：`positionNode` 只负责「把单位四边形铺到各字形的包围盒」，
  // 朝向一律交给 `Object3D.rotation`。
  material.positionNode = Fn(() => {
  const p = computeVertex();
    return vec3(p.x as never, p.y as never, p.z as never);
  })();

  // ---- 4. 片元：SDF 采样 → 有符号距离 → 抗锯齿 alpha ----
  material.fragmentNode = Fn(() => {
    const glyphUV = vGlyphUV;
    const texBounds = vTextureUVBounds;
    const channel = vTextureChannel;

    // 图集 UV（在字形格子内按 glyphUV 采样）
    const atlasUV = vec2(
      mix(texBounds.x, texBounds.z, glyphUV.x),
      mix(texBounds.y, texBounds.w, glyphUV.y),
    );

    const sdfSample = texture(uSDFTexture, atlasUV);
    const ch = floor(channel.add(0.5));
    // 4 通道打包：rgba 各自存一格的灰度
    const alphaPacked = mix(
      mix(sdfSample.r, sdfSample.g, ch.min(1)),
      mix(sdfSample.b, sdfSample.a, ch.min(1)),
      max(ch.sub(1), 0),
    );

    // 指数编码还原为有符号距离（与 webgl-sdf-generator 的编码互逆）
    const maxDim = max(vGlyphDimensions.x, vGlyphDimensions.y);
    const absDist = float(1)
      .sub(alphaPacked.greaterThan(0.5).select(float(1).sub(alphaPacked), alphaPacked).mul(2).pow(float(1).div(max(uSDFExponent, float(1e-6)))))
      .mul(maxDim);
    const signedDist = absDist.mul(alphaPacked.greaterThan(0.5).select(float(-1), float(1)));

    // 抗锯齿宽度：屏幕空间导数（WebGPU 原生支持，无需扩展）
    const aaDist = length(vec2(dFdx(glyphUV.x.mul(vGlyphDimensions.x)), dFdy(glyphUV.y.mul(vGlyphDimensions.y)))).mul(0.5);

    const edgeOffset = uEdgeOffset;
    const edgeAlpha = smoothstep(
      edgeOffset.add(aaDist).add(uBlurRadius),
      edgeOffset.sub(aaDist).sub(uBlurRadius),
      signedDist,
    );

    Discard(edgeAlpha.lessThanEqual(0));

    // 颜色取材质上的常量（troika 会把 `text.color` 写到材质的 color 上）
    return vec4(fillColor, edgeAlpha.mul(uFillOpacity));
  })();

  material.transparent = true;
  material.depthWrite = false;
  material.side = 2; // DoubleSide：俯视与侧视都能看到

  // ---- 5. troika 兼容层 ----
  const nodes: Record<UniformKey, { value: unknown }> = {
    uTroikaSDFTexture: uSDFTexture as unknown as { value: unknown },
    uTroikaSDFTextureSize: uSDFTextureSize as unknown as { value: unknown },
    uTroikaSDFGlyphSize: uSDFGlyphSize as unknown as { value: unknown },
    uTroikaSDFExponent: uSDFExponent as unknown as { value: unknown },
    uTroikaTotalBounds: uTotalBounds as unknown as { value: unknown },
    uTroikaClipRect: uClipRect as unknown as { value: unknown },
    uTroikaEdgeOffset: uEdgeOffset as unknown as { value: unknown },
    uTroikaFillOpacity: uFillOpacity as unknown as { value: unknown },
    uTroikaPositionOffset: uPositionOffset as unknown as { value: unknown },
    uTroikaCurveRadius: uCurveRadius as unknown as { value: unknown },
    uTroikaBlurRadius: uBlurRadius as unknown as { value: unknown },
    uTroikaStrokeWidth: uStrokeWidth as unknown as { value: unknown },
    uTroikaStrokeColor: uStrokeColor as unknown as { value: unknown },
    uTroikaStrokeOpacity: uStrokeOpacity as unknown as { value: unknown },
    uTroikaOrient: uOrient as unknown as { value: unknown },
    uTroikaUseGlyphColors: uUseGlyphColors as unknown as { value: unknown },
    uTroikaSDFDebug: uSDFDebug as unknown as { value: unknown },
  };

  // troika 写的是 `material.uniforms.X.value = ...`，值对象需支持 `.set(...)`／
  // `.fromArray(...)`（Vector2 / Vector4 / Color / Matrix3 原生支持）。
  material.uniforms = nodes as unknown as TroikaCompatibleUniforms;

  // troika 的 `onBeforeRender` 用这个标记决定要不要调 `_prepareForRender`：
  // `if (material.isTroikaTextMaterial) this._prepareForRender(material)`。
  // 缺了它 uniform 永远不会被写入（实测：全为初值 → 顶点被 clamp 压成 0 → 整段文字消失）。
  (material as unknown as { isTroikaTextMaterial: boolean }).isTroikaTextMaterial = true;

  // 诊断计数：确认 troika 的 _prepareForRender 有没有真的跑到本材质上
  const prepCount = { n: 0 };
  const origUniforms = material.uniforms;
  Object.defineProperty(material, 'uniforms', {
    get() {
      prepCount.n += 1;
      return origUniforms;
    },
    configurable: true,
  });
  (material as unknown as { __prepCount?: () => number }).__prepCount = () => prepCount.n;

  const base = baseMaterial as { uuid?: string } | undefined;
  material.isDerivedFrom = (candidate: unknown): boolean => {
    if (!base) return true;
    const other = candidate as { uuid?: string } | undefined;
    return !other || other.uuid === base.uuid;
  };

  material.syncUniforms = (): void => {
    // TSL uniform node 的 value 已是活引用，此处仅留显式入口便于调试。
  };

  // 诊断：读出材质当前 uniform 的实际值（排查"troika 有没有写进来"）
  (material as unknown as { __readUniforms?: () => unknown }).__readUniforms = () => ({
    clipRect: (uClipRect.value as Vector4).toArray?.() ?? String(uClipRect.value),
    totalBounds: (uTotalBounds.value as Vector4).toArray?.() ?? String(uTotalBounds.value),
    sdfGlyphSize: uSDFGlyphSize.value,
    sdfExponent: uSDFExponent.value,
    sdfTextureSize: (uSDFTextureSize.value as Vector2).toArray?.() ?? String(uSDFTextureSize.value),
    hasTexture: !!uSDFTexture.value,
    edgeOffset: uEdgeOffset.value,
    fillOpacity: uFillOpacity.value,
    useGlyphColors: uUseGlyphColors.value,
  });

  return material;
}

/**
 * 把 troika 的 `Text` 实例切到 TSL 材质（一行接入）。
 *
 * @param text troika `Text` 实例（任意带 `createDerivedMaterial` 的对象）。
 * @returns 同一个实例，便于链式调用。
 * @example
 * ```ts
 * const text = useTslTextMaterial(new Text());
 * ```
 */
export function useTslTextMaterial<T extends { createDerivedMaterial(base: unknown): unknown }>(
  text: T,
): T {
  text.createDerivedMaterial = (base: unknown) => createTslTextMaterial(base);
  return text;
}

