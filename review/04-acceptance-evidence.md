# app2 验收证据清单

## 1. 非破坏性检查

本次只执行读文件、语法检查和数据统计，未修改现有应用代码。

| 检查 | 命令 | 结果 |
|---|---|---|
| 服务端语法 | `node --check .\\server.js` | 通过，无输出 |
| 队员端语法 | `node --check .\\public\\app.js` | 通过，无输出 |
| 数据统计 | Node VM 读取 `public/training-data.js` | 通过，可解析 |
| API/权限扫描 | `rg -n "req\\.method|/api/|role !==|sessions|password|admin"` | 找到核心接口与权限点 |

## 2. 数据统计快照

| 指标 | 当前值 |
|---|---:|
| 阶段数 | 6 |
| 周数 | 30 |
| 子课数 | 90 |
| 题目总数 | 45 |
| 情景判断题 | 20 |
| 课程考核题 | 25 |
| 成就数 | 5 |
| 标签数 | 45 |
| 重复题目 ID | 0 |
| 缺失 `missionBriefing` 的周 | 30 |
| 缺失 `rangeTraining` 的周 | 30 |
| 缺失 `deepDives` 的周 | 30 |
| 缺失 `milestoneChecklist` 的周 | 30 |

题目难度分布：

| 难度 | 数量 |
|---|---:|
| 1 | 20 |
| 2 | 14 |
| 3 | 8 |
| 4 | 3 |

## 3. 规格验收对照

| 验收项 | 规格要求 | 当前结果 | 状态 |
|---|---|---:|---|
| 课程周数 | 30 周 | 30 | 通过 |
| 子课数量 | 每周至少 3 节 | 90 | 通过 |
| `lessonManuals` | 每课完整内容 | 当前为生成式摘要字段 | 部分通过 |
| `deepDives` | 每周至少 1 篇 | 0 | 不通过 |
| `missionBriefing` | 每周都有 | 0 | 不通过 |
| `milestoneChecklist` | 每周都有 | 0 | 不通过 |
| `rangeTraining` | 指定 17 周都有 | 0 | 不通过 |
| 情景题 | >= 60 | 20 | 不通过 |
| 课程题 | >= 120 | 25 | 不通过 |
| SOP 速查 | 独立速查表 | 未发现 | 不通过 |
| 术语词典 | 定义和示例 | 未发现 | 不通过 |
| JSON 可解析 | 可正常解析 | 可解析 | 通过 |
| 题目 ID | 唯一 | 无重复 | 通过 |

## 4. 功能路径观察

| 路径 | 观察 |
|---|---|
| 注册/登录 | 前端提供手机号、密码、代号；后端校验手机号和密码长度。 |
| 课程完成 | 队员端可标记周训练完成，写入 `progress.lessons`。 |
| 答题提交 | 队员端提交一组题，后端写入 quiz 和 question attempts，并计算标签统计。 |
| 成就计算 | 后端按标签正确数解锁 5 个成就。 |
| 管理员总览 | instructor 可访问 `/api/admin/users` 查看队员进度和标签概览。 |
| AAR | 后端有接口，但队员端主 UI 未提供完整入口。 |
| Assessment | 后端有接口，但权限和前端入口不足。 |

## 5. 关键代码证据

| 证据 | 位置 |
|---|---|
| 会话只存在内存 Map | `server.js` 中 `const sessions = new Map()` |
| 默认管理员密码 | `server.js` 中默认用户 `password: "123456"`，启动日志打印默认账号 |
| 管理员用户列表权限 | `/api/admin/users` 中检查 `user.role !== "instructor"` |
| JSON 直接读写 | `readJson`、`writeJson` 使用 `fs.readFileSync`、`fs.writeFileSync` |
| 队员端主导航 | `public/app.js` 中 `home/learn/questions/record` |
| 管理端总览 | `public/admin.js` 中 `renderAdmin()` |

## 6. 复验建议

完成 P0 修复后，至少补充以下自动化检查：

- `npm run check:syntax`：检查服务端和前端 JS 语法。
- `npm run check:data`：校验课程、题库、标签、成就、ID 唯一性和必填字段。
- `npm run test:api`：覆盖登录、注册、进度、题库、AAR、评估、管理员权限。
- `npm run test:ui`：覆盖队员端主路径和管理端主路径。
- `npm run test:security`：覆盖默认账号禁用、Token 过期、普通用户越权访问。

