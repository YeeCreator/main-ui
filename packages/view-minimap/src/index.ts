/**
 * @main-ui/view-minimap —— 缩略导航视图模板。
 *
 * 提供：`Minimap` 组件（世界按比例缩进小方框 + 视口矩形 + 点击跳转）。
 * 坐标数学来自 `@main-ui/core/rendering` 的 `minimap` 纯函数 ——
 * 游戏小地图与画布缩略图**共用同一套实现**，差别只在简化画法（`kind`）。
 *
 * **样式需宿主显式引入**：
 *
 * ```ts
 * import '@main-ui/view-minimap/styles.css';
 * ```
 *
 * 不从包内自动引入：构建会把 CSS 抽成独立文件，包内 import 并不保证
 * 宿主能正确解析相对路径；显式引入与 `main-ui/styles.css` 的做法一致。
 */
export * from './types';
export * from './Minimap';
