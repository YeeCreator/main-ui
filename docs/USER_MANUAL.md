# USER_MANUAL

## 当前版本

当前文档对应 `main-ui 0.1.0`。本版本以本地版本包 `main-ui-0.1.0.tgz` 形式提供；下游可按升级通知显式安装。当前不是 npm registry 发布版本。

安装包内文档入口为 `node_modules/main-ui/docs/README.md`；用户手册、API 手册和迁移指南均随包提供。

本地包安装示例：

```bash
pnpm add ../main-ui/main-ui-0.1.0.tgz
```

## 启动 Demo

```bash
pnpm install
pnpm run demo:dev
```

访问：`http://127.0.0.1:4173/`

## 主界面区域

1. 左侧 activity bar：切换 workspace / host profile。
2. 顶部 title bar：显示当前 workspace，提供 split、reset、theme 操作。
3. 中央 workbench：递归 split layout 与 leaf tab group。
4. 底部 status bar：显示 workspace、group、tab、theme 状态。
5. overlay layer：显示设置等临时编辑器。

## 基本操作

1. 点击 activity bar 切换 Demo、Inspector、Autodo、Matheshop、Yeegames。
2. 点击 tab 切换编辑器。
3. 点击 tab 右侧 `×` 关闭 tab。
4. 点击 leaf header 的 `＋` 下拉，在当前区域打开当前 workspace 允许的 editor。
5. 点击 leaf header 的 `↺` 重新打开最近关闭的 tab。
6. 点击 `◧` / `◨` / `▤` / `▥` 向左、向右、向上、向下拆分当前区域。
7. 点击 `□` / `↙` 最大化当前区域或还原。
8. 空区域保持空白，不会自动补一个推荐 editor。
9. 需要在空区域打开 editor 时，使用该区域顶部的 `＋` 下拉；`⚙` 可从 activity bar 底部或 status bar 左侧打开 overlay。
10. overlay 可关闭，也可提升为 tab。
11. 点击 `↻` 恢复当前 workspace 默认布局。
12. 点击 `☼` / `☾` / `◐` 切换浅色、深色或系统主题。

## Demo Workspace

`Demo` workspace 用于验证最小功能：

1. `Welcome`：基础 editor surface。
2. `Notes`：普通 tab。
3. `Settings`：可作为 overlay 打开，也可提升为 tab。
4. `Adapter`：外部 mount adapter 示例。

验证 `Adapter`：

1. 在空区域 launcher 或 workspace 默认 tab 中打开 `Adapter`。
2. 点击 adapter 内容区域。
3. 文本从 `Waiting for pointer event` 变为 `Pointer event received by external adapter`。

这说明非 Vue 内容可以被 `main-ui` 管理生命周期和 tab 状态。

## Host Profile

- Autodo：模拟资料侧栏、表格、基于 `viewport-2d-kit` 的图谱三栏。
- Matheshop：模拟工具栏、基于 `viewport-2d-kit` 的公式画布、Inspector 三栏。
- Yeegames：模拟游戏资源、游戏广场、棋盘视口和参数化 game-session 多实例。

这些 profile 只用于验证 `main-ui` 抽象，不包含真实业务逻辑。

### Autodo Profile

操作路径：

1. 点击 activity bar 的 `Autodo`。
2. 确认左侧资料/导航，中间表格，右侧图谱视口三栏都存在。
3. 尝试 reset，确认布局恢复到三栏默认状态。

用途：验证资料管理型宿主能用 split tree 表达。

### Matheshop Profile

操作路径：

1. 点击 `Matheshop`。
2. 在 Formula canvas 中拖拽平移。
3. 使用 Ctrl/⌘+滚轮缩放。
4. 点击 `Fit`，确认视口恢复到默认边界。
5. 切换 tab 或 reset 后重复操作，确认画布仍能接收 viewport 交互。

用途：验证强指针编辑器不会被 workbench 外层事件模型干扰。

### Yeegames Profile

操作路径：

1. 点击 `Yeegames`。
2. 确认 Board viewport 显示棋盘视口底座。
3. 在游戏广场中点击 `Open chess`。
4. 再点击 `Open go`。
5. 确认出现多个 `game-session` tab，且标题和 payload 对应不同 session。

用途：验证同一种 editor kind 可以根据 payload 打开多个实例。

## 常见恢复操作

1. 当前 workspace 乱了：点击 `↻`。
2. 主题不合适：点击 `☼`、`☾` 或 `◐`。
3. 设置 overlay 挡住内容：点击 overlay 的关闭按钮。
4. 空白 leaf 没有 tab：使用该 leaf 顶部的 `＋` 下拉打开一个 editor。
