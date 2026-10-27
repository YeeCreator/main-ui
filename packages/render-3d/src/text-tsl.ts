/**
 * render-3d/text-tsl —— 三维档文字材质（自建 TSL 实现）· **实验件，默认不接入**
 *
 * ## 一句话状态
 *
 * 顶点/朝向/varying/图集绑定**全部打通并逐层验证过**；
 * 只剩最后一层未通：**片元里 SDF 采样值恒为 0**，故文字仍不显示。
 * `text-factory.ts` 因此继续走 troika 原材质，并如实声明「三维档文字不可用」。
 *
 * ## 已逐层验证通过的（每层都有独立判定手段，不是推测）
 *
 * | 层 | 判定方式 | 结果 |
 * | --- | --- | --- |
 * | 对象进入渲染列表 | 切 `visible` 看 draw call 变化 | ✅ 会变（20 → 29 → 42） |
 * | `positionNode` 生效 | 顶点写成常量方块 + 同步跳过 `Discard` | ✅ 出现两个红块 |
 * | `varying` 传到片元 | 输出 `glyphUV` 当颜色 | ✅ 红绿渐变 |
 * | 图集绑定 | 读材质 uniform 的纹理对象 | ✅ `HTMLCanvasElement 2048×128` |
 * | 图集坐标 | 输出 `atlasUV` | ✅ 数值合理 |
 * | **SDF 采样值** | 输出 `alphaPacked` 灰度 | ❌ **恒为 0（全黑）** |
 *
 * ## 四个必须知道的接口差异（解掉这四个才有上面那些判定）
 *
 * 1. **必须设 `isTroikaTextMaterial = true`**
 *    `Text.js:483` 的 `onBeforeRender` 里是
 *    `if (material.isTroikaTextMaterial) this._prepareForRender(material)`；
 *    缺标记 → 图集/包围盒/裁剪矩形等 uniform 永不写入。
 *
 * 2. **`WebGPURenderer` 不会自动调 `Object3D.onBeforeRender`**
 *    实测调用次数恒为 0。绕法：在 `text.sync()` 回调里手动调一次。
 *    调过之后 uniform 立刻全部正确（`sdfGlyphSize=64`、图集 `2048×128`、
 *    `clipRect=-2400.5..2431.5`）。
 *
 * 3. **`MeshBasicNodeMaterial` 没有 `material.uniforms`**
 *    troika 直接写 `material.uniforms.uTroikaXxx.value`，故须自挂同形状对象。
 *
 * 4. **纹理必须用 `uniformTexture`，且初值要是真 `Texture` 实例**
 *    - `uniform(undefined/null)` → 编译期推不出 sampler，绑定落空；
 *    - `texture(tex)` → 构造时就把纹理引用固化进 `TextureNode`，
 *      troika 之后改写 `.value` 换图集**不生效**（实测采样恒 0）；
 *    - 正解：`uniformTexture(placeholderDataTexture)` 再让 troika 覆盖 `.value`。
 *
 * ## 最后一层没通的排查方向（下次从这里接，别再从头走）
 *
 * 图集已确认绑定正确、`atlasUV` 已确认落在合理区间，但采样结果为 0。可能原因：
 *
 * 1. **`atlasUV` 的行列算错**：troika 的图集是「横向排格子、每格 4 个通道」，
 *    我的 `txCols`/`txUvPerSquare` 推算可能与实际布局差一列/一行。
 *    验证办法：把 `atlasUV` 直接当颜色输出，看格子边界是否与字形位置对齐。
 * 2. **Canvas 纹理在 WebGPU 下的采样限制**：troika 用 `Texture(canvas)`，
 *    某些 WebGPU 后端对 Canvas 源的格式/采样状态有额外要求。
 *    验证办法：把同一 Canvas 转成 `DataTexture` 再采样对比。
 * 3. **`texture()` 对 `uniformTexture` 节点的采样重载**：
 *    `texture(uSDFTexture, uv)` 是否被正确编译成「动态纹理 + 动态 uv」。
 *    验证办法：改用 `.sample(uv)` 或手写 `textureLoad` 对比。
 *
 * ## 若要在三维档保留文字，三条更稳的路线
 *
 * | 路线 | 做法 | 主要风险 |
 * | --- | --- | --- |
 * | B | 换 WebGPU 原生文字库 | 失去 MSDF 任意缩放锐利度，CJK 需预烘 |
 * | C | 文字走二维叠加层 | 失去深度遮挡与透视变形 |
 * | A2 | 只取 troika 的图集与 `glyphBounds`，自建**非实例化**几何 | 顶点数随字数线性增长（1 万字 ≈ 4 万顶点，可接受），但绕开整个实例化路径 |
 *
 * 已实测：**三维档文字当前不显示**；保真对照 `text-clarity` 判为未通过。
 */

import { Color, DataTexture, Matrix3, RGBAFormat, Texture, Vector2, Vector4 } from 'three';
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
  // 初值必须是**真的 Texture 实例**：传 undefined/null 时 three 在编译期推断不出
  // sampler 类型，绑定会落成空纹理 —— 表现为采样恒为 0（实测：alpha 全黑、
  // atlas 全黑，但 uv/varying/位置全部正常）。troika 随后会把 `_value` 覆盖成
  // 它自己的 SDF 图集 DataTexture。
  const placeholderTexture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  placeholderTexture.needsUpdate = true;
  // 必须用 `uniformTexture`（可变 uniform），**不能**用 `texture(tex)`：
  // 后者在构造时就把纹理引用固定进 TextureNode，troika 之后改写 `.value`
  // 换上面集，节点仍指向占位纹理 → 采样恒为 0（实测 alpha/atlas 模式全黑）。
  const uSDFTexture = uniformTexture(placeholderTexture);
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

  // 验证开关（临时；判定完即删）

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


  const base = baseMaterial as { uuid?: string } | undefined;
  material.isDerivedFrom = (candidate: unknown): boolean => {
    if (!base) return true;
    const other = candidate as { uuid?: string } | undefined;
    return !other || other.uuid === base.uuid;
  };

  material.syncUniforms = (): void => {
    // TSL uniform node 的 value 已是活引用，此处仅留显式入口便于调试。
  };


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

