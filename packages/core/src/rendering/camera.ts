/**
 * camera —— @main-ui/core 渲染基础设施的相机数学（纯函数，框架无关）。
 *
 * 相机模型（支持可选旋转）：
 *   screenPx = panPx + R(rotation) · (world * scale)
 *   其中 R(θ) = [[cosθ, -sinθ], [sinθ, cosθ]]；屏幕 Y 轴向下，θ 为正 = 世界顺时针旋转。
 *
 * `rotation` 为**可选字段**（缺省 0），既有 `{ scale, pan }` 相机完全兼容。
 * 由原 viewport-2d-kit 的 viewportMath 吸收而来（包名消灭，功能内化进 core）。
 */

export type Vec2 = { x: number; y: number };

/**
 * 2D 相机：把世界坐标（content/world space）通过视口展示为屏幕坐标（screen space）。
 *
 * ## 为什么一个「二维相机」会带 `polar`
 *
 * 因为它是**统一相机表示**，不是「只能表达二维的相机」。三维后端的轨道相机
 * 与它是同一台相机的两种释义：`scale/pan` 决定「看哪里、看多大」，
 * `rotation/polar` 决定「以什么姿态看」。
 *
 * 若不给 `polar`，`setCamera()` 每次都只能把极角重置回俯视档 ——
 * 于是「切成三维倾斜视角」这件事**在契约层无处表达**，模板层无论怎么努力
 * 都会被压回俯视。这正是「接了三维后端却永远看不到三维」的根因。
 */
export type Camera2D = {
  /** 世界单位 -> 屏幕像素 的缩放系数 */
  scale: number;
  /** 平移量（屏幕像素） */
  pan: Vec2;
  /** 旋转角（弧度，屏幕 Y 轴向下，正 = 顺时针）。缺省 0（可选字段，向后兼容）。 */
  rotation?: number;
  /**
   * 极角（弧度，从 +Y 轴量起；0 = 正俯视，π/2 = 水平视线）。缺省 = 俯视档。
   *
   * **仅三维后端消费**，二维后端忽略（与 `snapshot.dimensions` 同一处理策略：
   * 只增字段 + 旧实现不变）。缺省时等价于 `DEFAULT_TOP_POLAR`（接近正上方），
   * 因此既有的 `{ scale, pan, rotation }` 相机行为完全不变。
   */
  polar?: number;
};

export type ViewBox = { x: number; y: number; width: number; height: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 读取相机旋转（缺省 0，保证旧相机对象可用）。 */
export function cameraRotation(camera: Camera2D): number {
  const r = camera.rotation;
  return typeof r === 'number' && Number.isFinite(r) ? r : 0;
}

/** 按角度旋转向量（屏幕 Y 轴向下，正 = 顺时针）。 */
export function rotateVec(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/**
 * 把世界范围 viewBox 适配到容器尺寸（居中 + 等比缩放，含 padding）。
 */
export function fitCameraToViewBox(opts: {
  containerPx: { width: number; height: number };
  viewBox: ViewBox;
  paddingPx?: number;
}): Camera2D {
  const { containerPx, viewBox, paddingPx = 0 } = opts;

  const w = Math.max(1, containerPx.width - paddingPx * 2);
  const h = Math.max(1, containerPx.height - paddingPx * 2);

  const scale = Math.min(w / viewBox.width, h / viewBox.height);

  const worldCenterX = viewBox.x + viewBox.width / 2;
  const worldCenterY = viewBox.y + viewBox.height / 2;
  const screenCenterX = containerPx.width / 2;
  const screenCenterY = containerPx.height / 2;

  const panX = screenCenterX - worldCenterX * scale;
  const panY = screenCenterY - worldCenterY * scale;

  return { scale, pan: { x: panX, y: panY }, rotation: 0 };
}

export function screenToWorld(camera: Camera2D, ptScreen: Vec2): Vec2 {
  const rotation = cameraRotation(camera);
  const dx = ptScreen.x - camera.pan.x;
  const dy = ptScreen.y - camera.pan.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  // R(-θ) = [[cos, sin], [-sin, cos]]
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;
  return { x: rx / camera.scale, y: ry / camera.scale };
}

export function worldToScreen(camera: Camera2D, ptWorld: Vec2): Vec2 {
  const rotation = cameraRotation(camera);
  const sx = ptWorld.x * camera.scale;
  const sy = ptWorld.y * camera.scale;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: camera.pan.x + sx * cos - sy * sin,
    y: camera.pan.y + sx * sin + sy * cos,
  };
}

export function panBy(camera: Camera2D, deltaScreen: Vec2): Camera2D {
  return {
    ...camera,
    pan: {
      x: camera.pan.x + deltaScreen.x,
      y: camera.pan.y + deltaScreen.y,
    },
  };
}

/**
 * 以某个屏幕像素锚点为中心缩放，保持锚点处的世界坐标不动（旋转不变）。
 */
export function zoomAtScreenPoint(camera: Camera2D, opts: { factor: number; anchorScreen: Vec2 }): Camera2D {
  const { factor, anchorScreen } = opts;
  const rotation = cameraRotation(camera);

  const worldBefore = screenToWorld(camera, anchorScreen);
  const nextScale = camera.scale * factor;

  // pan' = anchor - R(θ)·(worldBefore * nextScale)
  const rotated = rotateVec({ x: worldBefore.x * nextScale, y: worldBefore.y * nextScale }, rotation);

  return {
    scale: nextScale,
    pan: { x: anchorScreen.x - rotated.x, y: anchorScreen.y - rotated.y },
    rotation,
  };
}

/**
 * 以某个屏幕像素锚点为中心旋转（缩放不变），保持锚点处的世界坐标不动。
 * deltaAngle 为弧度增量（正 = 顺时针）。
 */
export function rotateAtScreenPoint(camera: Camera2D, opts: { deltaAngle: number; anchorScreen: Vec2 }): Camera2D {
  const { deltaAngle, anchorScreen } = opts;
  const rotation = cameraRotation(camera) + deltaAngle;

  const worldAnchor = screenToWorld(camera, anchorScreen);
  const rotated = rotateVec({ x: worldAnchor.x * camera.scale, y: worldAnchor.y * camera.scale }, rotation);

  return {
    scale: camera.scale,
    pan: { x: anchorScreen.x - rotated.x, y: anchorScreen.y - rotated.y },
    rotation,
  };
}

/**
 * **SVG 介质**的相机变换串（无单位）。
 *
 * 品牌类型：只能用于 SVG 的 `transform` **属性**。与 {@link CssTransform} 不可互换
 * —— 两者底层都是 `string`，但目标介质不同，混用在 CSS 位会被浏览器**静默丢弃**。
 */
export type SvgTransform = string & { readonly __media: 'svg' };

/**
 * **CSS 介质**的相机变换串（平移带 `px`、旋转带 `deg`）。
 *
 * 品牌类型：只能用于元素的 `style.transform`。
 */
export type CssTransform = string & { readonly __media: 'css' };

/**
 * 现成的 CSS 样式对象（`transform` + `transformOrigin`）。
 *
 * **推荐宿主直接用这个**：`:style="cssStyle"`。它是**对象**而非裸串，
 * 因此把 {@link SvgTransform}（字符串）塞进 `style.transform` 时，类型层面拦不住 ——
 * 但把裸串直接当 `:style` 用会因缺 `transformOrigin` 而在视觉上露馅（旋转中心错）。
 * 唯一可靠的双保险是"永不从插槽给出裸 CSS 串" + CI 闸门（见任务书 D2）。
 */
export type CameraCssStyle = {
  readonly transform: CssTransform;
  readonly transformOrigin: '0 0';
};

/**
 * 构造 **SVG** 语法的相机变换串（无单位），用于 SVG 的 `transform` 属性。
 *
 * 变换顺序对齐相机模型 `screenPx = panPx + R(rotation) · (world * scale)`。
 * `rotation` 为 0 时省略 `rotate()`。
 *
 * @param camera 相机状态（`pan` 为屏幕像素）。
 * @returns 带 `SvgTransform` 品牌的串。
 * @example
 * cameraToSvgTransform({ scale: 0.2, pan: { x: 80, y: 370.68 } })
 * // '<g :transform="…">：translate(80 370.68) scale(0.2)'
 */
export function cameraToSvgTransform(camera: Camera2D): SvgTransform {
  const rotation = cameraRotation(camera);
  const parts = [`translate(${camera.pan.x} ${camera.pan.y})`];
  if (rotation !== 0) parts.push(`rotate(${(rotation * 180) / Math.PI})`);
  parts.push(`scale(${camera.scale})`);
  return parts.join(' ') as SvgTransform;
}

/**
 * 构造 **CSS** 合法的相机变换串（带单位），用于元素的 `style.transform`。
 *
 * @param camera 相机状态。
 * @returns 带 `CssTransform` 品牌的串。
 * @example
 * cameraToCssTransform({ scale: 0.5, pan: { x: 80, y: 370.68 } })
 * // 'translate(80px, 370.68px) scale(0.5)'
 */
export function cameraToCssTransform(camera: Camera2D): CssTransform {
  const rotation = cameraRotation(camera);
  const parts = [`translate(${camera.pan.x}px, ${camera.pan.y}px)`];
  if (rotation !== 0) parts.push(`rotate(${(rotation * 180) / Math.PI}deg)`);
  parts.push(`scale(${camera.scale})`);
  return parts.join(' ') as CssTransform;
}

/**
 * 构造可直接绑定到 `:style` 的相机样式对象（含 `transformOrigin`）。
 *
 * **这是宿主施加 CSS 相机变换的推荐入口**：返回对象，配合 `:style` 使用；
 * 不需要宿主自己记住"要带 px""要设 transformOrigin"。
 *
 * @param camera 相机状态。
 * @returns 现成样式对象。
 * @example
 * <div :style="cameraToCssStyle(camera)">…</div>
 */
export function cameraToCssStyle(camera: Camera2D): CameraCssStyle {
  return { transform: cameraToCssTransform(camera), transformOrigin: '0 0' };
}

export type SerializedCamera2D = { scale: number; pan: { x: number; y: number }; rotation?: number };

export function serializeCamera(camera: Camera2D): SerializedCamera2D {
  const rotation = cameraRotation(camera);
  const out: SerializedCamera2D = { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } };
  if (rotation !== 0) out.rotation = rotation;
  return out;
}

export function deserializeCamera(data: Partial<SerializedCamera2D> | null | undefined): Camera2D | null {
  if (!data) return null;
  const scale = typeof data.scale === 'number' && Number.isFinite(data.scale) ? data.scale : null;
  const pan = data.pan;
  if (scale === null || !pan || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return null;
  const camera: Camera2D = { scale, pan: { x: pan.x, y: pan.y } };
  if (typeof data.rotation === 'number' && Number.isFinite(data.rotation)) camera.rotation = data.rotation;
  return camera;
}
