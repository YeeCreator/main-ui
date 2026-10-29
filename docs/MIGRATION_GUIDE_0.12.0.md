# MIGRATION GUIDE 0.12.0

> 从 `main-ui@0.11.0` / `@main-ui/core@0.10.0` 升级到 `main-ui@0.12.0` / `@main-ui/core@0.11.0`。
> 本次交付**视口双输出面**（几何走 GPU、文字走浏览器）与**白板可编辑**。

## 一、总览

| 层 | 改动 | 兼容性 |
| --- | --- | --- |
| `@main-ui/core/rendering` | 新增 `content-layer`：`ContentLayerItem` / `projectContentLayer` / `cullContentLayer` / `prepareContentLayer` / `visibleWorldRect` | ✅ 只增 |
| `@main-ui/core/rendering` | 新增 `text-resolution`：`textResolutionFor` / `nextTextResolution` / 阶梯与阈值常量 | ✅ 只增 |
| `@main-ui/core` | 新增引用三语义：`RefRelation` / `refExpandsInline` / `checkEmbedChain` / `DEFAULT_MAX_EMBED_DEPTH` | ✅ 只增 |
| `@main-ui/core/primitives` | `createText` / `createTextLayer` / `renderTexts` 增可选 `options.resolution` | ✅ 只增（缺省不改行为） |
| `@main-ui/view-world` | 新增 `contentItems` prop 与 `content-layer` 插槽；新增 `cullContent` prop（默认 `true`） | ✅ 只增 |
| `@main-ui/view-world` | 文字按缩放档位重建纹理（内部行为） | ✅ 只增（画面更清晰） |
| `@main-ui/view-sandbox` | 元素可拖拽/缩放/旋转/连线/内联编辑；新增撤销重做 | ✅ 只增 |
| `@main-ui/view-sandbox` | 元素类型增 `text` / `formula` / `link` | ✅ 只增 |
| `@main-ui/view-sandbox` | 新增 `embed-view` 插槽（渲染真实子视图） | ✅ 只增 |
| `@main-ui/view-sandbox` | 新增事件 `element-edit-intent` / `open-ref-intent` | ✅ 只增 |

**没有破坏性变更。**

## 二、视口双输出面（`view-world`）

GPU 缩放是对**已光栅化**内容整体放大，不重绘。因此文字与公式放大即糊 ——
这是光栅化的固有性质，不是参数问题。修法是加一层浏览器绘制的内容面：

```vue
<WorldView :snapshot="snapshot" :content-items="items">
  <template #content-layer="{ items, camera, visibleWorldRect }">
    <div v-for="item in items" :key="item.id" :style="itemStyle(item)">
      <FormulaView v-if="item.kind === 'formula'" :latex="String(item.data?.latex)" />
    </div>
  </template>
</WorldView>
```

### 三条硬约束

| 约束 | 违反后的现象 |
| --- | --- |
| 内容层默认 `pointerEvents: 'none'` | 与交互覆盖层形成两套命中 → 点击穿透 / 双重触发 |
| 内容项**不要再施加相机变换** | 每项已算成屏幕坐标，再变换等于应用两遍 |
| 内容层恒在几何面之上 | 「几何遮挡内容」做不到；交错要按带拆分 |

### 必须让裁剪生效

`cullContent` 默认 `true`。关掉它等于为**所有**项建 DOM 节点，
节点数一多就卡死 —— 这是白板最常见的失败形态。

### 惰性提示

`contentItems` 是「要放什么、放哪儿」的描述；内容本身（LaTeX、HTML、媒体）放在
`data` 里透传，**不由 MUI 渲染**。这样公式排版归宿主（KaTeX / MathJax 皆可）。

## 三、文字纹理档位（`view-world` 内部）

文字按「离散档 + 滞回」重建：跨档才重画，档位内继续 GPU 放大。

| 概念 | 值 |
| --- | --- |
| 阶梯 | `1 / 2 / 4 / 8 / 16` |
| 升档阈值 | 目标 ≥ 当前 × 2 |
| 降档阈值 | 目标 × 1.6 ≤ 当前 |

两个阈值不相等，构成滞回带 —— 否则档位边界会反复重建纹理，表现为卡顿与闪烁。

**宿主无需配置**。若要自行控制，可用 `textResolutionFor` / `nextTextResolution` 纯函数。

## 四、引用三语义与嵌套上限

| 语义 | 展开内容 | 深度 |
| --- | --- | --- |
| `embed` | 是 | **上限 3**（`DEFAULT_MAX_EMBED_DEPTH`） |
| `link` | 否 | 无限 |
| `drill` | 否 | 无限 |

判据：**能不能在小尺寸里看**。单元格、小节点放不下活内容 ⇒ 只能 `link` / `drill`。

**存储是图、展开是树**：引用允许成环（双链必然成环），展开层负责检测：

```ts
checkEmbedChain(rootRefIds, resolveEmbeds)  // → ok / exceeded / cycle
```

`resolveEmbeds` 只返回 `embed` 边的下级（`link` / `drill` 不计入深度）。

## 五、白板编辑能力（`view-sandbox`）

以下能力此前**内核已有、视图层零调用**（数据能改、画面不动），现已接通：

| 能力 | 交互 |
| --- | --- |
| 移动 | 拖拽元素 |
| 缩放 | 选中后拖右下角柄 |
| 旋转 | 选中后拖顶部圆柄 |
| 连线 | 选中后拖右侧端口到目标元素 |
| 内联编辑 | 双击 `text` / `formula`（`Ctrl/Cmd+Enter` 提交，`Esc` 取消） |
| 撤销 / 重做 | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` |
| 删除 | `Delete` / `Backspace` |
| 多选 | `Shift` 点选 |

### 嵌入视图要接管渲染

`embed-view` 元素交给插槽渲染真实内容；不提供插槽时降级为占位：

```vue
<SandboxView :document="doc">
  <template #embed-view="{ viewType, payload, width, height }">
    <component :is="resolveView(viewType)" :payload="payload" :style="{ width: `${width}px`, height: `${height}px` }" />
  </template>
</SandboxView>
```

### 白板互链由宿主负责

`link` 元素只存不透明 `refId`（MUI 不懂文件系统）。点击时抛 `open-ref-intent`：

```ts
function onOpenRef({ refId, relation }) {
  if (relation === 'drill') openInPlace(refId)
  else dispatch({ type: 'editor/open', request: { documentId: refId } })
}
```

## 六、轻内容不要注册视图

为「一个公式」注册一整个 `viewType` 属过度设计。原生三档：

| 档 | 类型 | 是否需要注册 |
| --- | --- | --- |
| 原生轻内容 | `shape` / `text` / `formula` / `link` | **不需要** |
| 资源 | `image` | 资源由宿主 provider 注入 |
| 嵌入视图 | `embed-view` | 需要 |

判据：**它需不需要自己的生命周期与状态？**

## 七、升级检查清单

```
[ ] 若在 GPU 视口里画文字/公式：改用 contentItems + content-layer 插槽
[ ] 确认内容层未被宿主改回 pointerEvents: auto（会产生两套命中）
[ ] 确认未对内容项重复施加相机变换
[ ] 确认 cullContent 未被关闭
[ ] 若用了 embed-view：提供 embed-view 插槽（否则只有占位）
[ ] 若用了 link 元素：实现 open-ref-intent 的跳转处理
[ ] 若此前自行实现白板拖拽：删除，改用模板内置
[ ] 跑一遍 build + 单测，基线不降
```
