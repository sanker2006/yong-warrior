# 部署与版本治理

## 当前入口

- 学员端主入口：`/v3.2.html`
- 后台主入口：`/admin.html`
- 根路径 `/` 跳转到 `/v3.2.html`
- 历史版本：`/v2.html`、`/v3.html`、`/v3.1.html`

## 本地启动

```bash
cd app2
npm run start
```

打开：

- `http://127.0.0.1:4317/v3.2.html`
- `http://127.0.0.1:4317/admin.html`

验收 API 行为必须使用 HTTP 地址，不使用 `file://`。

## 数据存储

- 运行时数据库：`data/app.db`
- SQLite journal 文件可能出现在同目录。
- 旧 JSON 文件仅保留为迁移和备份参考。
- 运行时写入 SQLite。

演示或试用前备份：

```powershell
Copy-Item data\app.db data\app-demo-backup.db
```

需要恢复时：

```powershell
Copy-Item data\app-demo-backup.db data\app.db
```

恢复前先停止 Node 服务。

## 质量门禁

运行：

```bash
npm run check
npm run test:api
npm run test:perf
```

门禁必须确认：

- 根路径指向 V3.2。
- V3.2 不渲染课程图片。
- V3.2 暴露答题页公共函数。
- V3.2 支持题库三入口。
- Profile 展示真实能力画像和自动晋级状态。
- 后台只读。
- 自动晋级记录写入 `level_history`。
- 课程内容 deepDives 已补齐。
- 题库覆盖课程映射。

## 版本策略

- 新的学员端体验默认进入 V3.2。
- V2/V3/V3.1 不删除，但仅作为历史参考。
- 课程图片资产暂不接入 V3.2。
- BMAD 文档统一放在 `docs/bmad/`，本 Sprint 起使用中文。

## 当前限制

- 单机 SQLite 部署。
- 暂不做云端多租户。
- 暂不做复杂权限矩阵。
- 后台只有只读查看能力。
- `node:sqlite` warning 属于当前运行时预期。
