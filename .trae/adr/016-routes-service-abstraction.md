# ADR-016: 路由层 → Service 层抽象（Routes Service Abstraction）

**状态**: Accepted | **日期**: 2026-07-07 | **决策者**: 项目作者 + AI 协作（Trae）

> **背景**：本 ADR 记录 ITops Agent 平台"路由层禁止直接访问 Repository，必须经过 Service 层"的强制规则的确立过程。
>
> **关联**：[rules/architecture.md §3.2 路由层规则](../rules/architecture.md) · [.dependency-cruiser.json `routes-禁止直访-Repository` 规则](../../../.dependency-cruiser.json) · [P1-5 迁移报告 batch1~4](../../docs/P1-5_migration_batch*.md)

---

## 一、问题与背景

项目在 v2/v3 早期阶段，业务模块的路由层（`modules/<m>/routes/`）常常**直接 import 并调用 Repository**（如 `serverRepository.listAll()`、`settingsRepository.upsertMany()`）。这种写法带来 4 个问题：

### 1.1 业务逻辑散落

routes 文件中混入大量业务判断（参数校验、跨表查询、状态机校验），与"参数校验 → 调服务 → 返回"的路由本职混淆。

**典型反例**（P1-5 迁移前）：

```typescript
// modules/servers/routes/serverRoutes.ts (迁移前)
import { serverRepository } from '../../../repositories';

router.get('/', async (req, res) => {
  const filters = { ... };                      // 业务：拼装过滤条件
  const servers = serverRepository.list(filters); // 业务：直接访问 Repository
  const total = serverRepository.count(filters);  // 业务：跨方法拼接
  res.json({ success: true, data: { servers, total } });
});
```

### 1.2 CI 难以强制

项目使用 `.dependency-cruiser.json` 校验依赖关系，但 `routes-禁止直访-Repository` 规则**早期 severity 为 warn**，新增违规不会阻塞 PR 合并。

### 1.3 测试复杂度高

因为 routes 直接访问 Repository，单元测试要么 mock Repository（增加大量 boilerplate），要么 mock SQLite（需 `vi.hoisted` + `vi.mock`），代价高。

### 1.4 业务编排无统一入口

跨模块的业务编排（如"创建服务器 + 写审计日志 + 触发 SSH 健康检查"）散落在 routes 里，无法集中复用。

---

## 二、决策

### 2.1 强制 Service 层抽象

**所有 `modules/<m>/routes/` 文件必须通过 `<m>/services/<entity>CrudService.ts` 访问 Repository**。

约定：
- routes 文件职责收敛到 3 件事：**参数校验**（Zod）→ **调用 Service** → **返回结果**
- Service 文件职责：**业务编排 + Repository 访问 + 跨模块调用 + 审计/通知/缓存副作用**
- CRUD service 文件名约定：`<entity>CrudService.ts`（如 `agentCrudService.ts`、`settingsCrudService.ts`）
- 大型业务可拆为多个 service：`<entity>BusinessService.ts`（业务编排） + `<entity>CrudService.ts`（数据访问）

### 2.2 CI 强制升级为 error

将 `.dependency-cruiser.json` 中 `routes-禁止直访-Repository` 规则 severity 从 **warn 升级为 error**：

```json
{
  "name": "routes-禁止直访-Repository",
  "severity": "error",   // 2026-07-07 从 warn 升级
  "from": { "path": "^src/modules/[^/]+/routes/" },
  "to":   { "path": "^src/repositories/" }
}
```

新增任何 `modules/<m>/routes/` 直接 import `repositories/` 的代码，CI 会**直接阻塞 PR 合并**。

**唯一豁免**：`modules/database/routes/`（数据源连接管理本身，需要直接执行 SQL/连接字符串解析）。

### 2.3 渐进式迁移策略

P1-5 迁移分 4 批完成，每批完成一组模块：

| 批次 | 模块数 | routes 数 | 直访抽取数 |
|------|:---:|:---:|:---:|
| 第一批 | 2（alerts + workflow） | 6 | ~40 |
| 第二批 | 4（servers + monitor + auto + config-management） | 9 | ~50 |
| 第三批 | 6（infra + change + network + containers + auth + ai） | 18 | 152 |
| 第四批 | 1（notification，已豁免移除） | 2 | 8 |
| **合计** | **13 个新增迁移 + 1 个豁免移除** | **35** | **~250** |

**P1-5 完成度（2026-07-07）**：16/16 业务模块通过 service 层抽象，仅 `database` 保留豁免。

---

## 三、Service 三种典型模式

P1-5 迁移过程中沉淀出 3 种典型 service 模式：

### 3.1 CRUD 模式（最常见）

适用于纯数据访问的端点（如"列表 / 详情 / 创建 / 更新 / 删除"）。

```typescript
// modules/<m>/services/<entity>CrudService.ts
export function listEntities(filters) { return repo.list(filters); }
export function getEntityById(id)     { return repo.getById(id); }
export function createEntity(input)   { return repo.create(input); }
```

**代表**：`agentCrudService`、`settingsCrudService`、`userCrudService`、`notificationCrudService`。

### 3.2 settings 抽象模式

适用于"业务模块不直接操作 settings 表，通过专属 configService 暴露业务语义方法"。

```typescript
// modules/<m>/services/<m>ConfigService.ts
export function getXxxConfig()   { /* 读 settings + 合并默认值 */ }
export function updateXxxConfig(payload) { /* 写 settings */ }
```

**代表**：`qanythingConfigService`、`notificationConfigService`。

### 3.3 业务编排模式

适用于"测试通知渠道"等场景——routes 中的 switch/case 业务逻辑提到 service，route 只负责参数校验和错误码映射。

```typescript
// modules/<m>/services/<action>Service.ts
export async function testChannel(channel: string, body: object) {
  switch (channel) {
    case 'email':    return testEmail(body);
    case 'wechat':   return testWechat(body);
    case 'dingtalk': return testDingtalk(body);
    default:         return { success: false, error: '未知渠道', unknown: true };
  }
}
```

**代表**：`notificationChannelTestService`、`storageVolumeCrudService.syncVolumesFromDocker`。

---

## 四、影响与收益

### 4.1 架构合规

- ✅ `npm run depcruise` 报告：**0 errors / ~1700 warnings**（warn 全部为合理的 logger/env 引入）
- ✅ 新增违规会被 CI 直接拦截，无需人工 review

### 4.2 测试可行性

- CRUD service 是纯函数/纯方法的封装，可独立单元测试（无需 mock SQLite）
- 例如：`settingsCrudService.upsertOrDelete(value)` 可直接传 value 断言返回值，无需起数据库

### 4.3 业务可维护性

- 业务逻辑（"创建服务器 + 写审计日志 + 触发健康检查"）集中在 service 层
- 路由文件平均行数从 ~150 减少到 ~80
- 新增业务编排只需修改 service，路由层无感

---

## 五、替代方案与拒绝原因

| 备选方案 | 拒绝原因 |
|---------|---------|
| 沿用 warn 级别，由人工 review 拦截 | 实际执行中 warn 长期被忽略，违规越积越多 |
| 引入 ORM（TypeORM/Prisma）自动处理 | 项目已基于 better-sqlite3 + 自研 Repository 模式稳定运行，迁移成本与风险远大于收益 |
| 在 routes 中加 ESLint 规则拦截 | ESLint 难以表达"禁止 import repositories from routes/"这种跨目录规则，depcruise 更专业 |

---

## 六、参考资源

- 规则定义：[`.dependency-cruiser.json`](../../../.dependency-cruiser.json)
- 规则详细说明：[`rules/architecture.md` §3.2](../rules/architecture.md)
- 新贡献者指南：[`documents/ARCHITECTURE_COMPLIANCE_GUIDE.md`](../documents/ARCHITECTURE_COMPLIANCE_GUIDE.md) "错误 6：routes 直访 Repository"
- 迁移全过程报告：
  - [P1-5_migration_alerts_workflow.md](../../docs/P1-5_migration_alerts_workflow.md)（第一批）
  - [P1-5_migration_batch2.md](../../docs/P1-5_migration_batch2.md)（第二批）
  - [P1-5_migration_batch3.md](../../docs/P1-5_migration_batch3.md)（第三批）
  - [P1-5_migration_batch4.md](../../docs/P1-5_migration_batch4.md)（第四批，notification 豁免移除）