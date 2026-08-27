# Migration Guide: 0.5.0 → 0.6.0

## 概览

v0.6.0 是旗舰复合模板版本：新增 `@main-ui/view-sandbox`（自由沙盘画布）和 `@main-ui/view-host-engine`（外部引擎桥接）。

**向下兼容**：核心包名 `main-ui` 与导出面不变；既有模板无 API 变更。

## 包版本矩阵

| 包 | 0.5.0 | 0.6.0 | 说明 |
|---|---|---|---|
| `@main-ui/view-sandbox` | — | **0.6.0** | 旗舰复合模板 |
| `@main-ui/view-host-engine` | — | **0.6.0** | 外部引擎桥接模板 |
| `@main-ui/preset-views` | 0.5.0 | **0.6.0** | 新增 `sandbox` + `hostEngine` |

## 新增模板

### `@main-ui/view-sandbox`（旗舰复合模板）

```ts
import { registerSandboxViewEditor, createSandboxKernel } from '@main-ui/view-sandbox';

// 内核：L2 无头纯 TS（可 Node 单测）
const kernel = createSandboxKernel(doc, camera, { maxNestingDepth: 8 });
kernel.addElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 60, rotation: 0 });
kernel.addConnection({ id: 'c1', source: { elementId: 'a' }, target: { elementId: 'b' } });

// 注册
registerSandboxViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
```

关键特性：
- **异构元素**：shape / image / embed-view 三种类型
- **嵌入保护**：embed-view 元素一律经 EmbeddedViewHost 托管，嵌套深度默认 8 层
- **变更事件**：内核操作后通知渲染层（数据流范式）
- **序列化**：toJSON / fromJSON 完整往返

### `@main-ui/view-host-engine`（外部引擎桥接）

```ts
import { HostEngineView, type ExternalEngineApi } from '@main-ui/view-host-engine';

// 宿主提供引擎 API 实现
const engine: ExternalEngineApi = {
  mount: (container) => myEngine.attach(container),
  onResize: (w, h) => myEngine.resize(w, h),
  destroy: () => myEngine.dispose(),
};
```

## 验证

```bash
pnpm typecheck   # 14 包全绿
pnpm test        # 185 项全绿
pnpm build       # 全量构建成功
```
