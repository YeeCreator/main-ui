# @main-ui/view-console

main-ui 官方视图模板：控制台 / 日志流（自研虚拟滚动追加列表）。等级着色、自动滚动/锁滚、清空意图与本地过滤。

## 边界（强制规范）

- **零业务逻辑、零网络**：日志条目经 Props 注入（含 `loading` / `error` 三态；条目上限与取数/订阅由宿主维护），清空以意图经 Emits 抛出，由宿主裁决；视图不发起任何请求。
- **实现契约四成员**：`viewType: 'view-console'` + `getViewState` / `restoreViewState` / `onDestroy`（幂等），经 `main-ui/vue` 的 `useViewLifecycle` 挂载。滚动位置、跟随开关、过滤状态进视图状态契约。
- **零硬编码色值**：等级着色消费 `--mui-color-warning` / `--mui-color-danger` / `--mui-color-success` 等语义变量。
- 过滤（等级白名单 + 文本匹配）为视图本地呈现行为，不产生意图；未知等级归一到 `info` 呈现。

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `entries` | `ConsoleEntry[]` | 日志条目（`id` / `level` / `message` / `timestamp?`，追加式） |
| `loading` / `error` | 三态 | 取数状态由宿主注入 |
| `clearEnabled` | `boolean` | 是否呈现清空按钮（默认 `true`） |
| `rowHeight` | `number` | 行高（虚拟滚动定高假设，默认 20） |
| `editorInstanceId` | `string \| null` | 传入则挂载视图生命周期 |

## Emits（意图）

| 事件 | 载荷 | 语义 |
| --- | --- | --- |
| `clear-intent` | 无 | 请求宿主清空日志数据源（是否执行由宿主裁决） |

## 行为说明

- **自动跟随（Follow）**：追加新条目时自动滚动到底部；用户上滑即自动锁滚（Locked），滚回底部或点击开关恢复跟随。
- **虚拟滚动**：只渲染可见切片 + 缓冲行，支撑长日志流。

## 快速接入

```ts
import { registerConsoleViewEditor } from '@main-ui/view-console';

registerConsoleViewEditor(runtime, { allowedWorkspaceIds: ['demo'] }, undefined, () => ({
  onClearIntent: () => adapter.clearLogs(),
}));
```
