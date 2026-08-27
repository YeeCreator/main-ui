# USER_MANUAL

## 当前版本

当前文档对应 `main-ui 0.4.0`。本版本以本地版本包 `main-ui-0.4.0.tgz` 形式提供；下游按升级通知显式安装。当前不是 npm registry 发布版本。

安装包内文档入口为 `node_modules/main-ui/docs/README.md`；用户手册、API 手册、模板库指南和迁移指南均随包提供。

本地包安装示例：

```bash
pnpm add ../main-ui/main-ui-0.4.0.tgz
```

## 启动 Demo

```bash
pnpm install
pnpm run demo:dev
```

访问：`http://127.0.0.1:4183/`

## 主界面区域

1. 左侧 activity bar：切换 workspace / host profile。
2. 顶部 title bar：显示当前 workspace，提供 split、reset、theme 操作。
3. 中央 workbench：递归 split layout 与 leaf tab group。
4. 底部 status bar：显示 workspace、group、tab、theme 状态，含设置入口与主题/布局快捷操作。
5. overlay layer：显示设置等临时编辑器（可关闭、可提升为 tab）。
6. 浮动窗口层（v0.3 起）：拖出主布局的独立浮动窗口（可拖动、可缩放）。

## 基本操作

1. 点击 activity bar 切换 Demo、Inspector、Autodo、Matheshop、Yeegames。
2. 点击 tab 切换编辑器；点击 `×` 关闭；拖拽 tab 可排序或跨组移动。
3. 点击 leaf header 的 `＋` 下拉，在当前区域打开当前 workspace 允许的 editor。
4. 点击 leaf header 的 `↺` 重新打开最近关闭的 tab。
5. 点击 `◧` / `◨` / `▤` / `▥` 向左、向右、向上、向下拆分当前区域。
6. 点击 `□` / `↙` 最大化当前区域或还原。
7. 空区域保持空白，不会自动补推荐 editor；需要在空区域打开 editor 时用该区域顶部的 `＋` 下拉。
8. `⚙` 可从 activity bar 底部或 status bar 左侧打开设置 overlay；overlay 可关闭，也可提升为 tab。
9. 点击 `↻` 恢复当前 workspace 默认布局。
10. 点击 `☼` / `☾` / `◐` 切换浅色、深色或系统主题。
11. `Ctrl/Cmd+Shift+P` 打开命令面板；`Ctrl/Cmd+P` 打开 Quick Open（宿主注册 command/menu 后可用）。

## 停靠引导拖拽（v0.4）

1. 按住一个 tab 拖动到另一个叶子组上方。
2. 目标组会呈现**五向落点指示器**：中心（组内堆叠）与四条边缘（上/下/左/右分割）。
3. 拖动过程中显示 Ghost 预览（跟随指针的非透明页签影子）。
4. 在目标落点释放：边缘落点自动生成新的分屏，中心落点并入该组。
5. 按 `Esc` 或拖出释放取消拖拽，布局不发生任何变化（零残留）。
6. 停靠引导同样作用于浮动窗口内部的组。

## 浮动窗口（v0.3）

1. 对允许浮动的 editor，拖拽其 tab 出主布局区域，或经页签入口「拖出」，生成浮动窗口。
2. 浮动窗口是完整的独立布局子树：内部可以继续分屏、开多个 tab。
3. 拖动标题栏移动，拖动边缘缩放；位置与尺寸随布局快照持久化。
4. 经「拖回」入口把浮动窗口合并回主布局；关闭浮动窗口时其中的 tab 回到主树。
5. 恢复会话时，越出当前视口的浮动窗口坐标会自动归位（至少保留标题栏可见）。
6. 浮动窗口内的视图状态（相机、展开节点、滚动等）与主树一致地参与保存/恢复。

## Tab 溢出收纳（v0.2）

tab 数量超出组宽度时：

1. tab 栏出现左右滚动按钮；
2. 提供溢出下拉菜单，列出被收纳的隐藏 tab，点击即切换；
3. 激活一个不可见的 tab 时自动滚动到可见位置。

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

## 官方视图模板演示（v0.3 一期 + v0.4 二期）

demo 通过「模拟后端适配层」（`demo/src/adapter/`）接入全部七个官方模板，演示「取数 → 转契约 → props 注入 → 意图裁决回写」标准链路。在各 host profile workspace 中可从 `＋` 下拉打开：

| 模板编辑器 | 演示要点 |
| --- | --- |
| Project Tree（`view-tree`） | 过滤、展开折叠、选中高亮；虚拟滚动 |
| Scene Inspector（`view-inspector`） | schema 驱动属性表单，变更经意图抛出 |
| Scene Graph（`view-2d`） | PixiJS 画布：拖拽平移、Ctrl/⌘+滚轮缩放、相机进视图状态 |
| Order Table（`view-table`） | 排序、行选中、双击行内编辑（意图抛出） |
| Host Settings（`view-form`） | 提交 → 宿主校验裁决 → 模拟落库 → 回填；预设存取 |
| Pipeline Graph（`view-node`） | 节点拖拽、拉线连线（意图抛出）、视口/选中进视图状态 |
| Log Stream（`view-console`） | 日志追加、等级/文本过滤、自动跟随/锁滚、贴底恢复、清空意图 |

模板级验证建议：

1. 打开任一模板编辑器 → 切换其他 tab 再切回 → 确认视图状态（滚动/展开/相机）保留。
2. 把模板编辑器拖出为浮动窗口再拖回 → 状态仍保留。
3. `view-form`：修改字段 → Submit → 观察宿主裁决后的回填与错误提示。
4. `view-console`：日志持续追加时观察自动跟随；手动上滚后锁滚，贴底后恢复跟随。

## Host Profile

- Autodo：模拟资料侧栏、表格、基于 `viewport-2d-kit` 的图谱三栏。
- Matheshop：模拟工具栏、基于 `viewport-2d-kit` 的公式画布、Inspector 三栏。
- Yeegames：模拟游戏资源、游戏广场、棋盘视口和参数化 game-session 多实例。

这些 profile 只用于验证 `main-ui` 抽象，不包含真实业务逻辑。

### Autodo Profile

1. 点击 activity bar 的 `Autodo`。
2. 确认左侧资料/导航、中间表格、右侧图谱视口三栏都存在。
3. 尝试 reset（`↻`），确认布局恢复到三栏默认状态。

用途：验证资料管理型宿主能用 split tree 表达。

### Matheshop Profile

1. 点击 `Matheshop`。
2. 在 Formula canvas 中拖拽平移。
3. 使用 Ctrl/⌘+滚轮缩放。
4. 点击 `Fit`，确认视口恢复到默认边界。
5. 切换 tab 或 reset 后重复操作，确认画布仍能接收 viewport 交互。

用途：验证强指针编辑器不会被 workbench 外层事件模型干扰。

### Yeegames Profile

1. 点击 `Yeegames`。
2. 确认 Board viewport 显示棋盘视口底座。
3. 在游戏广场中点击 `Open chess`，再点击 `Open go`。
4. 确认出现多个 `game-session` tab，且标题和 payload 对应不同 session。

用途：验证同一种 editor kind 可以根据 payload 打开多个实例。

## 主题与密度

1. 主题：`☼`（light）/ `☾`（dark）/ `◐`（system，跟随操作系统）。
2. 密度：宿主在根元素设置 `data-mui-density="compact"` 可切换紧凑模式（行高、控件高度、间距同步收紧）；默认不设置即标准密度。

## 常见恢复操作

1. 当前 workspace 乱了：点击 `↻`。
2. 主题不合适：点击 `☼`、`☾` 或 `◐`。
3. 设置 overlay 挡住内容：点击 overlay 的关闭按钮。
4. 空白 leaf 没有 tab：使用该 leaf 顶部的 `＋` 下拉打开一个 editor。
5. 某个视图显示「视图不可用（类型缺失）」占位：该视图类型的注册缺失（如未安装对应模板包）；补注册后占位自动恢复，原标题与内容引用不丢失。
6. 浮动窗口跑到屏幕外：恢复时自动归位，无需手动处理。
