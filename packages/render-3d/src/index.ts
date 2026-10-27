/**
 * @main-ui/render-3d —— 三维渲染后端（three.js + WebGPURenderer + TSL）。
 *
 * **命名 lane 判据**（设计 §十九 2）：`render-*` = 渲染后端，**无 editorKind、
 * 不可注册为编辑器、只实现 `ViewportBackend`**，由视图模板解析、不由宿主挂载。
 *
 * 本包对外三样东西：
 * 1. `createThreeBackend()` —— 后端工厂（宿主注册到 `BackendRegistry`）。
 * 2. `ThreeViewportBackend` —— 后端类（需要三维专属操作时用）。
 * 3. 纯函数诊断工具（`buildScenePlan` / `findInstancingViolations` / `planCamera`）
 *    —— 供保真对照与基准测试断言，不依赖 GPU。
 *
 * 二维档在本包内是**写死的预设**（正交 · 无光照 · 线条禁贴图 · DPR 对齐 ·
 * 网格命中优先 · 悬停反馈规定），不是兼容层。
 */
export {
  ThreeViewportBackend,
  createThreeBackend,
  type ThreeBackendOptions,
} from './threeBackend';

export {
  ORTHO_PRESET,
  COPLANAR_EPSILON,
  LAYER_Z,
  DEFAULT_BACKGROUND,
  colorToCss,
  colorToRgb,
  type OrthoPreset,
} from './units';

export {
  buildScenePlan,
  findInstancingViolations,
  type ScenePlan,
  type InstancePlan,
  type UniqueGeometryPlan,
  type TextPlan,
  type GridPlan,
} from './primitive-plan';

export {
  planCamera,
  planCamera2D,
  planToCamera2D,
  screenToWorldOrtho,
  worldToScreenOrtho,
  type CameraPlan,
  type OrthoCameraPlan,
  type PerspectiveCameraPlan,
} from './camera-plan';

export { createRenderer, detectWebGPU, type RendererFactoryOptions } from './renderer-factory';
export { wideLinesAvailable } from './wide-lines';
export {
  configureTextRendering,
  getTextRenderingConfig,
  isTextRenderingConfigured,
  type TextRenderingConfig,
} from './text-config';
export { isGeometryFinite } from './text-factory';
export { planToSceneObjects, type BuiltScene, type BuildSceneOptions } from './scene-builder';
export {
  FIDELITY_CRITERIA,
  buildFidelityReport,
  formatFidelityReport,
  judgeMeasurement,
  type FidelityCriterionKey,
  type FidelityMeasurement,
  type FidelityReport,
  type FidelityVerdict,
} from './fidelity';

/** 后端注册键（`view-world` 按此键解析三维后端）。 */
export const THREE_BACKEND_KEY = 'three-3d';

export {
  benchScenePlan,
  createFrameSampler,
  makeBenchSnapshot,
  readRendererStats,
  type FrameSampler,
  type FrameStats,
  type RendererStats,
  type ScenePlanBenchResult,
} from './benchmark';

export {
  detectTier,
  isPureRender,
  runExternalContractSmoke,
  validateExternalRegistry,
  type ContractSmokeResult,
  type ExternalEngineBridge,
  type ExternalEngineEntry,
  type ExternalGranularity,
  type ExternalTier,
  type PureRenderBridge,
} from './external';

export {
  DEFAULT_FONT_FAMILY,
  DEFAULT_SUPER_SAMPLE,
  createSpriteText,
  orientAxisBillboard,
  orientFullBillboard,
  syncTextBillboard,
  rasterizeText,
  type CanvasFactory,
  type RasterizedText,
  type SpriteTextObject,
  type SpriteTextOptions,
} from './text-sprite';
