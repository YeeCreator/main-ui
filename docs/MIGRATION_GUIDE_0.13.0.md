# MIGRATION GUIDE 0.13.0

> 从 `main-ui@0.12.0` / `@main-ui/core@0.11.0` 升级到 `main-ui@0.13.0` / `@main-ui/core@0.12.0`。
> 本次交付**缩略导航（小地图）**、**`view-canvas` 旧名移除**，并修三处会静默失效的缺陷。

## 一、总览

| 层 | 改动 | 兼容性 |
| --- | --- | --- |
| `@main-ui/core/rendering` | 新增 `minimap`：`contentWorldBounds` / `minimapTransform` / `panToMinimapPoint` / `minimapViewportRect` / `visibleWorldRectOfCamera` / `MINIMAP_VIEWPORT_MIN_SIZE` | ✅ 只增 |
| 新包 | `@main-ui/view-minimap` 0.1.0：`Minimap` 组件 | ✅ 只增 |
| `@main-ui/view-canvas` | **移除**插槽字段 `cameraTransform` 与函数 `cameraTransformOf` | ⚠️ **破坏性** |
| `@main-ui/core/rendering` | `cullContentLayer` 对缺 `size` 的项改为**保守保留** | ⚠️ 行为变更（只多不少） |
| `@main-ui/view-formula` | 包内引入 KaTeX 样式表；`sideEffects` 改为 `["*.css"]` | ✅ 修复（无需改代码） |
| `@main-ui/core/rendering` | `pixiViewport.destroy()` 幂等；首帧前卸载不再崩溃 | ✅ 修复（无需改代码） |

**唯一需要动手的是 `view-canvas` 的旧名移除。**

## 二、`view-canvas` 旧名移除

`cameraTransform` 的歧义不在名字，而在「同一字段装两套语法」：

```vue
<!-- 错误用法：把 SVG 属性串放进 style.transform -->
<div :style="{ transform: cameraTransform }">
```

无单位串（SVG 语法允许）放进 `style.transform` 时，浏览器**静默丢弃整条声明**
—— 不报错、不警告，画面就是不动。这类故障排查成本极高。

0.11.0 起已拆为两个名字并标 deprecated，本次删除旧名：

| 旧 | 新 | 用途 |
| --- | --- | --- |
| `cameraTransform`（插槽字段） | `svgTransform` | 放进 `transform` **属性**（`<g :transform="svgTransform">`） |
|  | `cssTransform` | 放进 `style.transform`（`{ transform: cssTransform, transformOrigin: '0 0' }`） |
| `cameraTransformOf(camera)` | `cameraToSvgTransform(camera)` / `cameraToCssStyle(camera)` | 直接由相机算 |

两者都是品牌类型（`SvgTransform` / `CssTransform`），**跨介质赋值在 `tsc` 阶段报错**。

```vue
<!-- 正确 -->
<ViewportCanvas>
  <template #default="{ svgTransform, cssTransform }">
    <svg><g :transform="svgTransform">…</g></svg>
    <div :style="{ transform: cssTransform, transformOrigin: '0 0' }">…</div>
  </template>
</ViewportCanvas>
```

## 三、缩略导航（小地图）

### 3.1 为什么是同一个组件

「游戏小地图（把实体画成一个质点）」与「画布导航（把每个单元缩成一个框）」
除**简化画法**外每一步都相同：算世界范围 → 世界↔缩略图映射 → 画视口矩形 → 点击跳转。

而「点」在几何上就是**零宽高的矩形**。因此两者共用同一套坐标数学，画法按
`kind` 分派即可 —— 不建两套实现（那会得到两个「世界↔小图换算」，
是同一件事两处实现的典型失败形态）。

**名称上的差异（小地图 / 导航图 / 鹰眼 / 缩略图）只是宿主的 UI 标签**，不影响组件契约。

### 3.2 不重绘场景

组件**只画简化图元**：不复用 GPU 后端、不复制 DOM 节点、不重算内容层投影。

把整个场景缩小再画一遍看起来很直观，实际代价是：再开一个 WebGL context
（显存翻倍）、把所有 DOM 内容节点复制一份（白板场景直接卡死）、内容层再算一次投影。
成熟产品（例如图形编辑器的缩略图）画的也是简化矩形，不是真重绘。

### 3.3 两个来源二选一

```ts
// 已知视口矩形（画布类通常已有）
<Minimap :items="items" :viewport="viewport" @navigate="onNavigate" />

// 只有相机（视口类通常如此）—— 组件内部用 visibleWorldRectOfCamera 反算
<Minimap :items="items" :camera="camera" :viewport-size="size" @navigate="onNavigate" />
```

`viewport` 优先于 `camera`。两者都不给则不画视口框。

### 3.4 相机归宿主所有

`navigate` 事件载荷是 `{ pan, world }` —— 组件**算好目标值就交出去**，
不改任何状态。原因：相机可能同时被主视口、多个缩略图、URL 恢复、撤销栈共同持有，
由组件直接写会制造第二个真相源。

```ts
function onNavigate({ pan }: { pan: Vec2 }) {
  worldRef.value?.setCamera({ ...current.value, pan });
}
```

**`pan` 的符号方向极易写反**（`pan` 是世界原点在屏幕上的偏移，不是「视口中心的世界坐标」）。
故一律用 core 的 `panToMinimapPoint` 计算，不要自己推公式。

### 3.5 样式需宿主显式引入

```ts
import '@main-ui/view-minimap/styles.css';
```

与 `main-ui` 主包同一先例：CSS 作为**独立子路径导出**，由宿主控制引入时机与顺序。

## 四、`cullContentLayer` 行为变更

**旧行为**：缺 `size` 的项按零尺寸点判定 → 锚点出视口即整条裁掉。
**新行为**：缺 `size` 的项**一律保留**（尺寸未知无法判断真实范围，保守保留是唯一正确选择）。

这会「多渲染」一些项。影响面：

| 你的情况 | 影响 |
| --- | --- |
| 内容项都给了 `size` | 无变化 |
| 部分项没给 `size`，且数量很大（千级以上） | **建议补 `size`**，否则失去裁剪收益 |

`size` 是**世界单位**下的估算尺寸，不必精确，够判断「是否落在可见范围内」即可。
文字与公式的 `size` 用字号乘以大致行数宽高即可。

## 五、三处缺陷的辨识信号

| 缺陷 | 现象 | 为何难发现 |
| --- | --- | --- |
| `cullContentLayer` 误裁 | 缩放后部分文字/公式莫名消失，平移回来又出现 | 只在「锚点刚出界」的窄区间触发，且与相机位置耦合 |
| `view-formula` 缺 CSS | 分数不变分式、上下标不抬降、根号无横线 | 不报错；看起来像「公式功能没做完」而非「样式没加载」 |
| PixiJS 销毁后回调 | 切标签页/关面板时偶发 `Cannot read properties of null` | 只在「组件生命周期短于首帧」时触发，本地复现不稳定 |

前两处都在同一份 demo 里被当场暴露 —— 这正是**可运行 demo 先于下游接入**的价值。

## 六、升级清单

```
[ ] `view-canvas`：把 `cameraTransform` 换成 `svgTransform`（属性位）/ `cssTransform`（样式位）
[ ] `view-canvas`：把 `cameraTransformOf(camera)` 换成 `cameraToSvgTransform` / `cameraToCssStyle`
[ ] 需要小地图/导航图的宿主：装 `@main-ui/view-minimap`，显式引入 `styles.css`
[ ] 内容层项数量大的宿主：给 `contentItems` 补 `size`（世界单位）
[ ] 跑一遍 `pnpm typecheck` —— 品牌类型会让跨介质赋值直接报错，这是最可靠的检查手段
```
