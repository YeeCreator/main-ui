# MIGRATION GUIDE 0.9.0

> 从 `main-ui@0.8.0` / `@main-ui/core@0.7.0` 升级到 `main-ui@0.9.0` / `@main-ui/core@0.8.0`。
> 本次为**纯增量**版本：`view-form` 补齐数组字段与条件显隐的视图层消费，`core` 的 `FormField` 类型收拢 `visibleWhen`。
> **没有破坏性变更**，不需要改任何既有调用。

## 一、总览

| 层 | 改动 | 兼容性 |
| --- | --- | --- |
| `@main-ui/core` | `FormField` 联合类型统一携带可选 `visibleWhen`（原先只在 `FormFieldWithVisibility` 别名上） | ✅ 只增（`FormFieldWithVisibility` 保留为等价别名） |
| `@main-ui/core` | `FormGroup` 新增可选 `visibleWhen` | ✅ 只增 |
| `@main-ui/core` | `validateFormValues` / `validateArrayField` **跳过条件隐藏字段** | ⚠ 行为变更（更合理，见 §二） |
| `@main-ui/core` | `fieldFallback` 增 `'array'` 分支（返回 `[]`） | ✅ 只增 |
| `@main-ui/view-form` | `FormView` 渲染 `kind: 'array'`（动态增删行） | ✅ 只增（旧 schema 不出现该 kind 时无变化） |
| `@main-ui/view-form` | `FormView` 消费 `visibleWhen` | ✅ 只增（不带该字段时恒可见） |
| `@main-ui/view-form` | 新纯函数 `applyArrayIntent` / `createArrayItem` / `ArrayIntent` | ✅ 只增 |
| `@main-ui/view-world` | 后端无关化：新增 `dimension` / `backends` / `backendKey` props | ✅ 只增（缺省二维档，行为不变） |
| `@main-ui/view-world` | `ready` 事件载荷改为**后端无关最小句柄** | ⚠ 破坏性（唯一一处，见 §三） |
| `@main-ui/render-3d` | 新包（三维渲染后端，three.js） | ✅ 新增 |
| `@main-ui/view-canvas` / `view-formula` / `view-run-control` / `view-timeline` / `view-storyboard` | 版本对齐 | ✅ 无 API 变化 |
| `main-ui/vue` | 新增应用面（Surface）三导出、统一输入系统 | ✅ 只增 |

## 二、唯一的语义变更：条件隐藏字段不参与校验

**旧行为**：所有字段无论是否显示，一律参与校验。宿主的 schema 若有「仅在某些条件下才需要」的必填项，用户会在完全看不到该输入框的情况下被告知「必填」，且错误提示无对应可见控件 —— 表单陷入「报错却找不到出错位置」的死局。

**新行为**：`visibleWhen` 条件不满足的字段**不参与校验**；数组项内的子字段同理（判断基准是该行自身的值）。

**宿主需要做什么**：**不需要做任何事**。不使用 `visibleWhen` 的 schema 完全不受影响。若宿主此前用「把必填项动态从 schema 中移除」的方式绕开该问题，现在可改为声明 `visibleWhen`，语义等价但更简洁。

## 三、唯一的破坏性变更：`ready` 事件载荷

`view-world` 的 `ready` 事件原先直接交出 `PixiViewport`，现在交出**后端无关的最小句柄**：

| 旧 | 新 |
| --- | --- |
| `ready: (api: PixiViewport) => void` | `ready: (api: ViewportHandle) => void` |

`ViewportHandle` 只含三项：画布尺寸、根容器/场景对象、`requestRender`。理由：模板不再暴露具体渲染库类型（Pixi Application / three Scene 这类专属对象改由各自后端包在自己的公开面提供），否则「后端可换」这条不变量在类型层就破了。

**迁移方式（仅手动模式自绘的宿主受影响）**：

```ts
// 旧
function onReady(viewport: PixiViewport) {
  viewport.world.addChild(myContainer)
}

// 新：从容器自行装配，或改走快照驱动（推荐）
function onReady(handle: ViewportHandle) {
  const container = handle.root            // 根容器，直接挂自己的显示对象
  const requestRender = handle.requestRender // 手动模式下驱动重绘
}
```

若宿主原本依赖 `PixiViewport` 的相机方法，改用 `handle` 上的相机读写，或直接消费 `@main-ui/core/rendering` 的相机纯函数。

## 四、新增能力速览

### 4.1 `view-form` 数组字段

```ts
{
  kind: 'array', key: 'edges', label: 'Edges',
  minItems: 1, maxItems: 8,
  itemFields: [
    { kind: 'string', key: 'from', label: 'From', required: true },
    { kind: 'number', key: 'weight', label: 'Weight', min: 0, max: 100, defaultValue: 1 },
  ],
}
```

意图形状与其他字段一致：增删改都折叠成一次 `change({ key, value: 新数组, previous: 旧数组 })`，宿主无需写第二套消费逻辑。

### 4.2 `view-form` 条件显隐

```ts
{ kind: 'string', key: 'proxyUrl', label: 'Proxy URL',
  visibleWhen: { field: 'useProxy', equals: true } }
```

`equals` 支持数组（任一匹配即显示）与 `negate`（匹配时隐藏）。纯函数 `evaluateVisibility(field, values)` 可单独消费。

### 4.3 三维渲染档（可选）

只装二维的宿主**无需任何改动**，也**不会**看到维度开关（能力在运行时探测已安装后端）。需要三维档时：

```bash
pnpm add @main-ui/render-3d three troika-three-text
```

```ts
import { createThreeBackend, configureTextRendering } from '@main-ui/render-3d'

configureTextRendering({ defaultFontURL: '/fonts/label.ttf', unicodeFontsURL: null })
const backends = [createThreeBackend()]
```

```vue
<WorldView :snapshot="snapshot" :grid="grid" :backends="backends" :dimension="dimension" />
```

**务必先调 `configureTextRendering`**：三维档的文字走「Canvas 2D 栅格化 → 纹理贴片」。若不显式指定字体来源，默认实现会去 CDN 取回退字体数据；在无法访问该 CDN 的网络下，字体 Promise 会挂起，进而导致整帧渲染中断。

### 4.4 应用面（Surface）与统一输入系统

见 `MIGRATION_GUIDE_0.8.0.md`（同版本世代一并交付）。

## 五、包版本矩阵

| 包 | 0.8.0 | 0.9.0 | 说明 |
| --- | --- | --- | --- |
| `main-ui` | 0.8.0 | **0.9.0** | 纯增量 |
| `@main-ui/core` | 0.7.0 | **0.8.0** | `FormField` 收拢 `visibleWhen`；校验跳过隐藏字段 |
| `@main-ui/view-form` | 0.4.0 | **0.5.0** | 数组字段 + 条件显隐 |
| `@main-ui/preset-views` | 0.8.0 | **0.9.0** | 世代号对齐 |
| 其余模板包 | — | 不变 | 无 API 变化 |

## 六、升级检查清单

```
[ ] demo / 宿主启动后，既有表单渲染与此前一致（未使用 visibleWhen 的 schema 必须零变化）
[ ] 若有必填项在特定条件下才应生效，改为声明 visibleWhen（而非动态删 schema）
[ ] 若用过 ready 事件的 PixiViewport 参数，按 §三 迁移
[ ] 若启用三维档：先 configureTextRendering 指定本地字体，再注册后端
[ ] 若只装二维：确认没有误装 @main-ui/render-3d，且视图无维度开关、无报错
```
