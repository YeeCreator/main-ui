# HOST_UPGRADE_CHECKLIST_TEMPLATE

本文档提供宿主项目升级 `main-ui` 或 `viewport-2d-kit` 时的最小检查清单模板。

## 模板

```md
# doc-<宿主项目升级检查清单>-日期-UID

> 当前 main-ui 基线版本：`0.0.2`；本地版本包：`main-ui-0.0.2.tgz`。填写新升级记录时请替换为实际目标版本。

## 1. 基本信息

- 宿主项目：
- 关联底层包：`main-ui` / `viewport-2d-kit`
- 升级范围：
- 升级版本或提交范围：

## 1.1 前置规范检查

- [ ] 已阅读 `main-ui/docs/DEVELOPER_GUIDE.md`
- [ ] 已阅读 `main-ui/docs/HOST_INTEGRATION_GUIDE.md`
- [ ] 已阅读 `main-ui/docs/HOST_PROFILE_VALIDATION.md`
- [ ] 若涉及 2D 视口，已阅读 `viewport-2d-kit/docs/DEVELOPER_GUIDE.md`
- [ ] 若涉及 `main-ui` + `viewport-2d-kit` 组合，已阅读 `viewport-2d-kit/docs/MAIN_UI_INTEGRATION_GUIDE.md`

## 2. 依赖检查

- [ ] 本地依赖或版本号已更新
- [ ] 依赖安装完成
- [ ] 若为本地包，`dist/` 已更新

## 3. 接入层检查

- [ ] workspace descriptor 仍能注册
- [ ] editor descriptor 仍能注册
- [ ] rendererKey 与实际 renderer / adapter 一致
- [ ] mount adapter 生命周期正常

## 4. 构建检查

- [ ] typecheck 通过
- [ ] build 通过
- [ ] dev 启动通过

## 5. 运行检查

- [ ] workspace 可切换
- [ ] 默认 editor 可打开
- [ ] tab 可打开、关闭、移动
- [ ] overlay 可打开与关闭
- [ ] 关键画布或视口交互正常

## 6. 持久化与回写检查

- [ ] persistence key 未误改或已完成迁移说明
- [ ] payload 仍为轻量引用
- [ ] 相关文档已同步

## 7. 升级结论

- 结果：通过 / 部分通过 / 未通过
- 未通过项：
- 建议下一步：
```

## 最小要求

一份有效升级检查清单至少必须覆盖：

1. 依赖是否真的升级成功。
2. 接入前必读规范是否已确认。
3. 接入层是否仍然能注册。
4. 构建与运行是否通过。
5. 文档是否同步回写。
