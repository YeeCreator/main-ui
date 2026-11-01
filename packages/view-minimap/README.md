# @main-ui/view-minimap

main-ui 官方视图模板：**缩略导航**（小地图 / 导航图 / 鹰眼 / 缩略图）。

- `Minimap` —— 把世界范围等比缩进小方块，画出全部条目与**当前视口矩形**，点击跳转；
- 纯 SVG，**零渲染引擎**（不引 pixi / three / vue-flow）。

## 为什么不分成「游戏小地图」与「画布导航」两套

两者的每一步都相同：算世界范围、世界↔缩略图映射、画视口矩形、点击跳转。
只有**简化画法**不同。而「点」在几何上就是零宽高的矩形，故共用一套坐标数学，
画法按 `kind` 分派：

| `kind` | 画法 | 典型来源 |
| --- | --- | --- |
| `point` | 圆点，半径固定为**像素值**（缩放缩略图尺寸时点不变大） | 游戏单位 |
| `rect` | 矩形 | 画布单元、节点框 |
| `path` | 折线 | 路线、连线、仿真轨迹 |

拆成两套的代价是**两个「世界↔小图换算」实现**，随后各自演进、慢慢走偏 ——
这是本库反复出现的失败形态（同一件事两处实现）。

## 契约

- **不重绘场景**：只画简化图元。不复用 GPU 后端、不复制 DOM 节点、不重算内容层投影。
  把文字与节点缩小重画一遍会带来双份显存与双份 DOM，是白板类应用最常见的性能事故形态。
- **相机归宿主所有**：`navigate` 事件只抛目标值 `{ pan, world }`，组件不改任何状态。
  相机可能同时被主视口、多个缩略图、URL 恢复、撤销栈共同持有，由组件直接写会制造第二个真相源。
- **等比适配**：取两方向比例的**较小**值，宁可留白也不拉伸（否则圆点变椭圆）。
- **零网络、零业务**：条目与视口都由宿主注入；颜色一律消费 `--mui-*` 变量。
- **样式需宿主显式引入**（与主包同一先例，由宿主控制时机与顺序）。

## 用法

```ts
import { Minimap } from '@main-ui/view-minimap'
import '@main-ui/view-minimap/styles.css'
```

```vue
<!-- 画布类：已有视口矩形 -->
<Minimap :items="items" :viewport="viewport" @navigate="onNavigate" />

<!-- 视口类：只有相机 —— 组件内部用 visibleWorldRectOfCamera 反算 -->
<Minimap
  :items="items"
  :camera="camera"
  :viewport-size="size"
  @navigate="onNavigate"
/>

<!-- 需要自定义画法 -->
<Minimap :items="items" :viewport="viewport" :render-content="renderContent">
  <template #overlay="{ transform }">
    <ScaleBar :transform="transform" />
  </template>
</Minimap>
```

```ts
// 相机归宿主：组件算好目标 pan 就交出去
function onNavigate({ pan }: { pan: Vec2 }) {
  worldRef.value?.setCamera({ ...current.value, pan })
}
```

## 只取数学、不取组件

已有自研缩略图（例如游戏侧已有一份 Canvas 2D 实现）时，可以只消费 `@main-ui/core/rendering`
的纯函数，保留自己的画法：

| 导出 | 说明 |
| --- | --- |
| `contentWorldBounds(rects)` | 多项合并为外接矩形；空输入返回 `null` |
| `minimapTransform(world, size, padding?)` | 世界↔缩略图映射（含四个方向换算） |
| `minimapViewportRect(transform, viewport)` | 视口框绘制矩形（含最小可见尺寸，中心不变） |
| `panToMinimapPoint(transform, click, viewportSize, scale)` | 点击跳转的目标 `pan` |
| `visibleWorldRectOfCamera(camera, size)` | 由相机反算可见世界矩形 |

**`pan` 的符号方向极易写反**（它的语义是「世界原点在屏幕上的偏移」，
不是「视口中心的世界坐标」）。故一律用 `panToMinimapPoint` 计算，不要自己推公式。
