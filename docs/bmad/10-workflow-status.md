# BMAD 工作流状态

## 路由判断

- 包类型：棕地恢复包
- 项目类型：Web 应用
- 项目级别：Level 3
- 当前阶段：Sprint 6 收口
- 当前主版本：`public/v3.2.html`
- 当前重建版本：`public/v5.html`、`public/admin-v5.html`

## 当前状态

- 学员端主入口已切换到 V3.2。
- 后台入口仍为 `public/admin.html`。
- 根路径 `/` 跳转到 `/v3.2.html`。
- SQLite 是运行时主存储，数据文件为 `data/app.db`。
- 课程内容来自 `public/course-content-v2.js`，当前为 6 阶段、30 周、61 节课。
- 题库来自 `public/question-bank-v2.js`，当前覆盖课程题与情景题。
- Profile 使用真实课程完成记录和答题记录生成八个能力域。
- Sprint 6 引入自动晋级：课程完成 + 阶段课程题正确率大于 90% 后自动升级。
- 后台保持只读，展示用户、课程进度、题目情况、能力画像和晋级状态。
- V5 学员端和管理端已经接入同一套课程、题库和活动 API；V5 题库复用 V3.2 的 `QUESTION_BANK_V2` 数据契约。
- V5 H5 与 V5 管理端使用独立 token key，后端禁止管理员账号进入 H5 报名/取消报名链路。

## 当前主线

`注册登录 -> 学课程 -> 做课程题 -> 自动晋级 -> Profile 能力画像 -> 后台查看用户状态`

## Sprint 6 完成标准

- V3.2 答题页退出、标记、答题卡、跳题不报运行时错误。
- 题组提交只写入一次题目记录，不重复写入。
- 题库列表能显示最新已答、正确、错误状态。
- 知识域筛选作为一级入口可见，不依赖周次筛选。
- 满足阶段课程和课程题正确率条件后自动更新用户等级。
- `level_history` 记录每次晋级。
- Today、Profile、后台详情都能解释晋级状态和下一步动作。
- `npm run check`、`npm run test:api`、`npm run test:perf` 通过。

## 暂不进入 Sprint 6

- 教官端运营工作流。
- 场地装备管理。
- 后台写操作。
- 人工审核晋级。
- 成就体系。
- 课程图片重新接入。

## 2026-04-29 V5 修复记录

- 修复 V5 题库页无题目：`QUESTION_BANK_V2` 是数组导出，V5 已兼容数组结构并恢复题库列表、筛选、点题练习和整组练习。
- 修复 V5 题库答题提交：统一使用 `answer`、`lessonMapping`、`skillClassification`、`tags`，避免沿用旧字段导致能力画像不准确。
- 修复 V5 活动状态切换后的报名态：活动详情打开时重新拉取服务端详情，确保“即将开始 -> 进行中”后已报名用户仍显示取消报名。
- 修复管理端和 H5 登录态串号：H5 使用 `training-h5-token`，管理端使用 `training-admin-token`，并清理旧 `training-token`。
- 增加服务端保护：`instructor` 角色不能调用 H5 报名或取消报名接口，避免 admin 被写入活动参与者。
- 验证通过：`node scripts/check-v5-entrypoints.js`、`npm run check`、`npm run test:api`。
