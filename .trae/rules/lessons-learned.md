# 错误复盘与规则沉淀规则

> 本文档定义"错误发生→规则沉淀"的闭环流程，确保每次错误都能转化为可复用的规则或记忆，避免同类问题再次发生。

---

## 一、核心原则

### 1.1 三大原则

1. **错误即资产**：每个错误都是改进规则的机会，不应只修复不沉淀
2. **及时沉淀**：错误发生后**当场**形成规则或记忆，不要"以后再说"
3. **分级处理**：不是所有错误都需要新建规则文件，按严重程度分级处理

### 1.2 触发时机

以下情况必须触发错误复盘流程：

- ❌ 代码修改导致文件损坏/数据丢失
- ❌ 同一类错误重复发生 2 次以上
- ❌ AI 违反了项目架构规则（如 routes 直接访问 repository）
- ❌ 工具使用方式错误导致不可逆后果
- ❌ 用户明确指出"这个错误不该犯"
- ⚠️ 任何导致需要回滚/恢复的操作

---

## 二、错误分级与处理方式

### 2.1 三级分类

| 级别        | 特征                               | 处理方式         | 存储位置                                                                             |
| ----------- | ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| **L1 轻微** | 单次发生、影响小、易避免           | 追加记忆条目     | [`AGENTS.md` §10.4 经验教训](../../AGENTS.md#104-经验教训)（2026-07-21 v2.1 整合后） |
| **L2 中等** | 可能重复、有通用教训               | 更新现有规则文件 | `.trae/rules/<相关规则>.md`                                                          |
| **L3 重大** | 不可逆后果、新类型错误、跨项目通用 | 新建规则文件     | `.trae/rules/<新规则>.md`                                                            |

### 2.2 分级判断流程

```
错误发生
   ↓
是否造成不可逆后果？
   ├─ 是 → L3 重大（新建规则文件）
   └─ 否 → 是否同类错误第 2 次？
            ├─ 是 → L2 中等（更新现有规则）
            └─ 否 → 是否有跨项目通用教训？
                     ├─ 是 → L2 中等
                     └─ 否 → L1 轻微（追加记忆条目）
```

### 2.3 案例对照

| 错误案例                                     | 级别 | 理由                         | 处理结果                                             |
| -------------------------------------------- | ---- | ---------------------------- | ---------------------------------------------------- |
| PowerShell 破坏中文编码，11 文件损坏不可恢复 | L3   | 不可逆 + 新类型 + 跨项目通用 | 新建 `powershell.md`                                 |
| AI 在 routes 直接访问 repository             | L2   | 违反架构规则，可能重复       | 更新 `architecture.md` §4.2 禁止操作                 |
| 某次 import 路径写错                         | L1   | 单次、易避免                 | 追加 [AGENTS.md §10.4](../../AGENTS.md#104-经验教训) |
| AI 忘记用 Edit 工具而用 cat 读文件           | L2   | 可能重复、有通用教训         | 更新 `top-rules.md` 或相关规则                       |

---

## 三、L1 处理流程：追加记忆条目

### 3.1 触发条件

- 单次发生的轻微错误
- 项目特定的注意事项
- 不需要形成完整规则文件的小教训

### 3.2 操作步骤

1. **定位记忆文件**（2026-07-21 v2.1 后统一）：
   - **项目特定 / 跨项目通用**：统一追加到 [`AGENTS.md` §10.4 经验教训](../../AGENTS.md#104-经验教训)
   - 旧的 `project_memory.md` / `user_profile.md` 不再写入新内容（保留作为备份）

2. **追加条目**（使用以下模板）：

```markdown
## YYYY-MM-DD 错误复盘：<错误标题>

**场景**：<简述错误发生场景>
**错误**：<做错了什么>
**正确做法**：<应该怎么做>
**教训**：<一句话总结>
```

3. **通知用户**：告知已记录到哪个记忆文件

### 3.3 示例

```markdown
## 2026-07-20 错误复盘：import 路径深度计算错误

**场景**：拆分单文件到子目录时，相对路径少写一层 ../
**错误**：'../../../types' 应为 '../../../../types'
**正确做法**：拆分到子目录时，所有 ../ 都要 +1 层
**教训**：tsc 报错"Cannot find module"时，按错误提示反向追踪深度
```

### 3.4 工具返回空时必用第二种工具核实（2026-07-21）

> 触发：AI 用 Glob 工具查 `scripts/**` 返回空，误判 `scripts/check-architecture.js` 不存在，写进报告 L197 / 附录 A。**实际上文件存在**（10KB，218 行）。

**强制规则**：

1. **工具返回空时禁止直接下结论**：
   - Glob 工具对 `scripts/**` / `node_modules/**` 等深层嵌套路径**偶发返回空**（工具 bug）
   - LS / Read 工具对单文件 OK，对目录列表可能漏子目录
   - PowerShell `Get-ChildItem` / RunCommand `ls` 才是**最可靠的最终验证**

2. **二次核实步骤**（遇到"文件不存在"结论时）：

   ```powershell
   # 第 1 种：用 PowerShell 列目录
   Get-ChildItem -Path <dir> -Recurse -Force | Select-Object FullName

   # 第 2 种：用 Read 读已知路径
   Read -file_path "<absolute_path>"

   # 第 3 种：用 Grep 搜文件内容
   Grep -pattern "<unique_string>" -path <dir>
   ```

3. **报告/ADR 措辞**：

   - ❌ "文件不存在"（没二次核实前禁止说）
   - ✅ "Glob 工具未找到，建议用 PowerShell ls 二次验证"（事实 + 建议）
   - ✅ "经验上不常见，需要核实"（保守措辞）

4. **本类错误 L 分级**：L2（**事实性错误，影响后续决策**），详见 [ADR-020 §六 v2.4](../../.trae/adr/020-agent-tool-risk-audit.md)。

### 3.5 长跑进程被 terminal 复用误杀（2026-07-22 实测）

> 触发：在已跑 `npm run dev` 的 terminal 里执行下一个 curl / ls 命令，前端 Vite dev server 突然死亡（SIGTERM）。用户访问 `localhost:3000` 报"网络错误"。

**事件经过**：

```
05:30  Terminal A: cd frontend && npm run dev    → Vite ready, port 3000
05:35  Terminal A: curl http://localhost:3001/health    ← 在同一 terminal 跑新命令
05:36  Vite 被 SIGTERM，前端断网
05:38  用户报告："localhost:3000/login 网络错误"
05:39  AI 排查发现 Vite 进程已死，重启后恢复
```

**根本原因**：

- AI 协作工具（Trae CN）的 terminal **复用机制**：当已有 terminal 在跑长跑进程，AI 仍可能在同一 terminal 启动下一个命令
- 长跑进程（npm run dev / docker compose up / npm run build:watch）**不是幂等的**，被中断后不会自动恢复
- 用户感知是"前端连接错误"，但根因是 dev server 已死

**强制规则**（已同步至 [top-rules.md §4.2.1](../../.trae/rules/top-rules.md#421-长跑进程必须独立-terminal强制规则2026-07-22-实测)）：

1. **长跑进程必须放独立 terminal**：
   - Terminal A：专用 `npm run dev:backend`
   - Terminal B：专用 `npm run dev:frontend`
   - Terminal C/D/E：一次性命令（curl / git / ls / cat / 文档查询）

2. **AI 操作前自检**：
   - 在跑 `npm run dev` 的 terminal 里**禁止**执行任何其他命令
   - 跑新命令前必须 `target_terminal: "new"` 或选空闲 terminal

3. **判定方法**：
   - 看 terminal 顶部是否有"npm run dev"在 running
   - 有 → 换 terminal；无 → 当前可用

**本类错误 L 分级**：L2（**流程性错误，影响开发体验但可恢复**），不阻塞 CI 不破坏数据。

### 3.6 Express 路由通配冲突：audit 模块截胡所有其他模块（2026-07-22 实测）

> 触发：用户问"7 步流程能否跑通"，AI 端到端实测发现 `/api/v1/servers`、`/api/v1/workflows`、`/api/v1/auto/*` 等 18 个核心 API 全部 404。前端页面"看起来正常"（react-query 失败只让列表为空），实际**整个项目除 ai/alert 模块外都不可用**。

**事件经过**：

```
06:00 用户问"7 步流程能不能跑通"
06:05 AI 端到端实测 38 个 API 路径
06:06 发现：仅 ai/alert 模块 4 个 OK，其他 34 个 404
06:08 排查发现：audit 模块挂在 /api/v1 + 内部 router.get('/:id') 通配
06:10 audit 的 :id 路由截留所有其他模块的单段路径
06:15 修复：auditRoutes2 注册到 /api/v1/audit，detail 改 /logs/:id
06:18 重启后端，38 个核心 API 全部 200
```

**根本原因**（双重 bug）：

1. **路由挂载冲突**：`modules/audit/routes.ts` 用 `router.use('/')` 而非 `router.use('/audit')`，再被 `_registry.ts` 挂到 `/api/v1`，导致 audit 的 `router.get('/:id')` 通配路由**截留**所有后续模块的单段路径
2. **Express 路由匹配按注册顺序**：audit（第 60 行）先注册，auto/servers/workflow 等后注册，但 audit 内部 `/:id` 永远先匹配

**强制规则**：

1. **任何模块的子路由必须以模块名为前缀**，禁止 `router.use('/')`：

   ```ts
   // ❌ 错误：路由通配会被 audit 之类其他模块截留
   router.use('/', routes);

   // ✅ 正确：模块自己定义子路径前缀
   router.use('/servers', serverRoutes);
   router.use('/audit', auditRoutes); // audit 也要有自己的子前缀
   ```

2. **避免使用 `router.get('/:id')` 通配路由**：除非这个模块完全独立不挂在根上：

   ```ts
   // ❌ 危险：通配路由会截留其他路径
   router.get('/:id', handler);

   // ✅ 安全：明确前缀 + 参数
   router.get('/logs/:id', handler);
   ```

3. **注册路径必须显式指定模块前缀**（`_registry.ts`）：

   ```ts
   // ❌ 错：audit 挂在根，:id 通配拦截其他模块
   { path: '/api/v1', router: auditRoutes },

   // ✅ 对：audit 自己的前缀
   { path: '/api/v1/audit', router: auditRoutes },
   ```

4. **实测必跑（任何架构改动后）**：至少 1 个核心 API 必须用真实 token 端到端测通，**不能只看启动日志说"路由注册成功"**——注册成功不代表优先级正确。

**诊断方法**（下次遇到"前端页面 OK 但数据为空"）：

```powershell
# 1. 用真 token 跑核心 API
$login = Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/auth/login" `
    -ContentType "application/json" -Body '{"username":"admin","password":"admin"}'
$token = $login.data.token
$headers = @{Authorization = "Bearer $token"}

# 2. 测试每个模块的列表接口
foreach ($p in @('agents','servers','workflows','remediation-policies','approvals','reports')) {
    $r = Invoke-WebRequest -Method GET -Uri "http://localhost:3001/api/v1/$p" `
        -Headers $headers -UseBasicParsing
    Write-Host "$p -> $($r.StatusCode)"
}

# 3. 如果 4xx，看 Error body 而非只信状态码
$reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
$body = $reader.ReadToEnd()  # "Audit log not found" 暴露了 audit 模块在截留！
```

**本类错误 L 分级**：**L2 → 升级到 L3 的边缘**（影响所有非 ai 模块的可用性，但属于一次性发现）。沉淀在 lessons-learned，**未来同类错误（路由通配）应升级为 ADR-035**。

**修复记录**：

- `backend/src/modules/_registry.ts` L60：`{ path: '/api/v1', router: auditRoutes2 }` → `{ path: '/api/v1/audit', router: auditRoutes2 }`
- `backend/src/modules/audit/routes/auditRoutes.ts` L19：`router.get('/:id', ...)` → `router.get('/logs/:id', ...)`

### 3.7 大文件拆分的 20 次实战沉淀 + 4 步风险防御（2026-07-21）

> 触发：v2.10 ~ v2.30 期间执行 **20 次大文件拆分**（backend 4 + frontend 11，含 1 次用户/AI 完成 + AI 清理），累计产生 **~110 个子模块**。**frontend overrides max-lines 清单 13 → 0 彻底清空**。

详见 [ADR-031 v2.x 大文件拆分完整方法论](../../.trae/adr/031-v2-large-file-splitting-methodology.md)。下述为本节**最关键**的 6 个强制规则：

#### 3.7.1 拆分前必跑 4 步风险防御（强制）

```powershell
# Step 1: 检查 uncommitted diff
git status --short <target_file>
# Step 2: 显示 insertions / deletions
git diff HEAD --stat <target_file>
# Step 3: 对比 git HEAD 行数 vs workspace
node -e "const o=require('fs').readFileSync('<target_file>','utf8').split(/\r?\n/).length;console.log('workspace:',o)"
node -e "const {execSync}=require('child_process');console.log('HEAD:',execSync('git show HEAD:<target_file>',{encoding:'utf8'}).split(/\r?\n/).length)"
# Step 4: find consumers (routes / mocks / Docker)
Grep -pattern "<file_basename>" -path frontend -output_mode "files_with_matches"
```

- 若 diff > 50 行或 HEAD ≠ workspace（**包括 `D` 状态**）：**用 AskUserQuestion 询问**（不要默认按 git HEAD 处理）
- 若文件 NOT IN GIT（**`??` untracked 新文件**）：可能是用户/AI 全新文件，**继续但 tsc 必跑**

#### 3.7.2 tsc 全文验证（**新增规则 14 - baseline bug 修复**）

```
拆分前后必须跑：npx tsc --noEmit 2>&1 | grep <file_path>
```

**严格规则**：

- 拆分前跑一次：发现 baseline error（如 v2.30 AddDeviceModal L105 `data` typo）
- 拆分后跑一次：确认 0 个新错误
- 若 baseline error 存在且**判断为简单 typo**（如 `(res) => data` 应为 `(r) => r.data`）：**L1 修复 + 在子文件头注释 + ADR-031 §三 记录**
- 若 baseline error 涉及**不熟业务逻辑**：**上报用户**不擅改

#### 3.7.3 TS2724 / TS2459 / TS2322 兼容速查表

- `T | null` ≠ `T | undefined` → 用 `T | null | undefined`
- `ReadonlyArray<T>` 不能传入 mutable `Array<T>` prop
- interface ≠ `Record<string, unknown>` → 必须 `.map((p) => ({ ...p }))` 转
- type export 必须显式 `export type { ... }`（runtime 自动，type 不会）
- mutationFn 返回类型必须匹配 interface 声明（v2.27 Tasks 教训）：`useMutation<void, ...>` 时 mutationFn 必须 `async () => { await api.put() }` 返回 void

#### 3.7.4 JSX 嵌套错误防御

```javascript
const o = require('fs').readFileSync(file, 'utf8');
console.log('open:', (o.match(/<div\b/g) || []).length);
console.log('close:', (o.match(/<\/div>/g) || []).length);
```

- close > open → 移除冗余 `</div>`
- open > close → 查找缺失 nesting

#### 3.6.5 default export vs named export 区分

- **page entry**：必须 `export default function Xxx()`（React 路由 lazy import）
- **sub widget**：必须 `export function Xxx()`（named，便于 barrel）
- TS2724 `no exported member named Xxx`：**一定是 import 路径错了**

#### 3.7.6 hook callback 注入模式（**新增规则 15 - callback parameter**）

拆 hook 时如果**业务需要回调给调用方**（如 onSuccess 关闭 modal），**正确做法**：

```ts
// ✅ 正确：hook 接受 callback 参数
export function useXxx(args, onSuccessCallback?: () => void) {
  return {
    handleSubmit: async () => {
      await api.put(...);
      onSuccessCallback?.();  // 仅 success 时调
    }
  };
}

// ❌ 错误 1：hook 内部 placeholder
const onSuccessCallbackRef = () => { /* placeholder */ };
// ❌ 错误 2：main wrap 后无论成败都调
const handleSubmit = async (e) => { await data.handleSubmit(e); onSuccess(); };
```

**本类错误 L 分级**：

- baseline `data` typo bug → **L1**（简单 typo 必修，参考 3.5.2）
- 其他大部分拆分错误 → **L2**（**流程性错误，但有防御规则**）

**完整方法论 + 15 个错误 + 12 个模式**详见 [ADR-031 §一~五](../../.trae/adr/031-v2-large-file-splitting-methodology.md) + [ADR-031 §三 错误表](../../.trae/adr/031-v2-large-file-splitting-methodology.md#三拆分失败的-14-个真实错误与修复) + [ADR-018 旧 4 条原则](../../.trae/adr/018-enhanced-node-executor-splitting.md)。

---

## 四、L2 处理流程：更新现有规则文件

### 4.1 触发条件

- 同类错误第 2 次发生
- 违反现有规则但规则描述不够明确
- 有通用教训但不需要单独成文

### 4.2 操作步骤

1. **定位相关规则文件**：根据错误类型查找
   - 架构问题 → `architecture.md`
   - 前端问题 → `frontend.md`
   - 测试问题 → `testing.md`
   - 文件操作问题 → `powershell.md`
   - 其他 → `1.md`

2. **更新规则内容**：
   - 在"禁止事项"或"约束"章节补充
   - 添加具体案例
   - 更新"AI 禁止的操作"清单

3. **通知用户**：告知更新了哪个文件的哪个章节

### 4.3 示例

在 `architecture.md` §4.2 AI 禁止的操作 中追加：

```markdown
- **禁止**在拆分文件到子目录时按习惯少写 1 层 ../（详见 ADR-018 经验）
```

---

## 五、L3 处理流程：新建规则文件

### 5.1 触发条件

- 造成不可逆后果（如文件损坏、数据丢失）
- 新类型的错误，现有规则未覆盖
- 跨项目通用的教训（如工具使用、环境配置）
- 用户明确要求"写个规则文件"

### 5.2 操作步骤

1. **命名规则文件**：
   - 工具相关：`<工具名>.md`（如 `powershell.md`）
   - 场景相关：`<场景名>.md`（如 `file-operations.md`）
   - 问题相关：`<问题名>.md`（如 `encoding-safety.md`）

2. **使用标准模板**（见 §5.3）

3. **更新索引**：
   - 更新 `.trae/README.md` 目录结构
   - 更新 AI 必读顺序
   - 更新选读表

4. **通知用户**：告知新建了规则文件，请审阅

### 5.3 新规则文件标准模板

```markdown
# <规则标题>

> 本文档定义 <规则范围>。所有 AI 辅助开发工具在 <适用场景> 时必须遵守本规则。
>
> **最后更新**：YYYY-MM-DD — 由 <触发事件> 触发建立。

---

## 一、问题背景

### 1.1 事件回顾（YYYY-MM-DD）

<简述错误发生的时间、场景、后果>

### 1.2 根本原因

<分析错误的根本原因，不要只停留在表面>

### 1.3 损坏机制 / 错误机制

<详细说明错误是如何发生的，最好用流程图或时序图>

---

## 二、强制规则

### 2.1 正确做法优先级

| 优先级 | 做法       | 适用场景 | 安全性 |
| ------ | ---------- | -------- | ------ |
| 1      | <最佳做法> | <场景>   | ✅     |
| 2      | <次佳做法> | <场景>   | ⚠️     |
| 3      | <禁止做法> | -        | ❌     |

### 2.2 禁止操作

<列出明确禁止的操作，用 ❌ 标记>

### 2.3 安全操作模式

<提供可复制的代码模板，用 ✅ 标记>

---

## 三、验证规则

### 3.1 操作前验证

<操作前应该检查什么>

### 3.2 操作后验证

<操作后应该验证什么，如何验证>

### 3.3 备份规则

<哪些情况需要先备份>

---

## 四、AI 开发辅助规则

### 4.1 AI 在 <场景> 前必须确认

1. <确认项 1>
2. <确认项 2>

### 4.2 AI 禁止的操作

- ❌ <禁止项 1>
- ❌ <禁止项 2>

### 4.3 AI 推荐的工作流

1. <步骤 1>
2. <步骤 2>

---

## 五、参考资源

- <相关文档链接>
- <关联规则>

---

## 六、事件复盘记录

### YYYY-MM-DD <事件标题>

- **触发场景**：<场景>
- **错误范围**：<影响>
- **无法恢复原因**：<如有>
- **教训**：
  1. <教训 1>
  2. <教训 2>
```

---

## 六、与记忆系统集成

### 6.1 记忆系统结构（2026-07-21 v2.1 整合后）

```
项目仓库内（共享 + git 跟踪）：
└── AGENTS.md §10 项目记忆
    ├── §10.1 用户偏好与开发环境
    ├── §10.2 路径与目录约定
    ├── §10.3 工程约定（本项目）
    ├── §10.4 经验教训         ← L1 错误追加到这里
    └── §10.5 全局规则文件索引（指向 ~/.trae-cn/user_rules/）

本机 ~/.trae-cn/memory/（已停用，仅备份）：
├── user_profile.md          ← 2026-07-21 v2.1 前跨项目通用；现已合并到 AGENTS.md
└── projects/
    └── -c-Users-123-Desktop-daima-AIops/
        └── project_memory.md ← 2026-07-21 v2.1 前项目级；现已合并到 AGENTS.md
```

### 6.2 规则文件 vs 项目记忆

| 维度 | 规则文件 (`.trae/rules/`) | 项目记忆（`AGENTS.md §10`） |
| ---- | ------------------------- | --------------------------- |
| 性质 | 强制规则，AI 必须遵守     | 参考记忆，辅助决策          |
| 共享 | 随项目 git 仓库共享       | 随项目 git 仓库共享         |
| 粒度 | 完整文档，有模板          | 简短条目，1-5 行            |
| 触发 | L2/L3 错误                | L1 错误                     |
| 版本 | 有版本记录                | 按日期追加                  |

### 6.3 协同工作流

```
错误发生
   ↓
L1 → AGENTS.md §10.4 经验教训 (追加条目)
     ↓
     如果同类错误再发生 → 升级为 L2
     ↓
L2 → .trae/rules/<相关文件>.md (更新规则)
     ↓
     如果是新类型/不可逆 → 升级为 L3
     ↓
L3 → .trae/rules/<新文件>.md (新建规则)
     ↓
     同时在 AGENTS.md §10.4 记录索引
```

---

## 七、AI 自动触发规则

### 7.1 AI 在以下情况必须主动触发复盘

1. **检测到不可逆操作**：如文件损坏、数据丢失
2. **用户指出错误**：用户说"这个错了"、"不该这样"
3. **同类错误第 2 次**：AI 发现自己重复犯同一错误
4. **违反现有规则**：AI 发现自己违反了 .trae/rules/ 下的规则

### 7.2 AI 触发流程

```
AI 检测到错误
   ↓
AI 主动报告："检测到错误，建议沉淀为规则"
   ↓
AI 分类：L1 / L2 / L3
   ↓
AI 提议：
  - L1: "将在 [AGENTS.md §10.4](../../AGENTS.md#104-经验教训) 追加条目"
  - L2: "将更新 <文件名> 的 <章节>"
  - L3: "将新建规则文件 <文件名>"
   ↓
用户确认（或 AI 直接执行后通知）
   ↓
AI 执行沉淀操作
   ↓
AI 验证规则已写入
   ↓
AI 报告完成
```

### 7.3 用户触发短语

用户可使用以下短语触发复盘流程：

| 短语             | 含义                |
| ---------------- | ------------------- |
| "记录这个错误"   | 触发 L1 流程        |
| "形成规则"       | 触发 L2/L3 流程     |
| "写个规则文件"   | 触发 L3 流程        |
| "这个错误不该犯" | 触发复盘 + 自动分级 |
| "记住这个教训"   | 触发 L1 流程        |

---

## 八、案例库

### 已沉淀的错误案例

| 日期       | 错误                                                            | 级别    | 沉淀位置                                                                                                      | 触发原因                                                                                                                                                         |
| ---------- | --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-20 | PowerShell 破坏中文编码                                         | L3      | [powershell.md](./powershell.md)                                                                              | 11 文件损坏不可恢复                                                                                                                                              |
| 2026-07-20 | PowerShell Out-File 把字符串数组用空格连接，文件变成一行        | L2      | [powershell.md §1.4 / §5.2 / §七](./powershell.md)                                                            | 违反 1.md §三 + powershell.md §5.2，但已用 Write 工具恢复                                                                                                        |
| 2026-07-20 | FNM_DIR 配置导致路径嵌套（fnm 1.39.0 设计行为，非错误）         | L2      | [docs/Node_v20.19.5_安装方案.md §十二](../../docs/Node_v20.19.5_安装方案.md)                                  | FNM_DIR 应指向 fnm root，fnm 会自动在其下创建 node-versions 子目录；FNM_DIR 设为 `xxx\node-versions` 会导致 `node-versions\node-versions\` 嵌套                  |
| 2026-07-21 | AI 用 Glob 工具查 `scripts/**` 返回空，误判脚本不存在，写进报告 | L2      | [ADR-020 §六 v2.4](../../.trae/adr/020-agent-tool-risk-audit.md)                                              | Glob 工具对 `scripts/**` 嵌套模式偶发返回空，AI 没二次核实，导致报告 L197 / 附录 A 错误事实；本类错误须用 PowerShell `Get-ChildItem` 或 RunCommand `ls` 二次验证 |
| 2026-07-22 | 长跑进程被 terminal 复用误杀（Vite 被 SIGTERM）                 | L2      | [top-rules.md §4.2.1](./top-rules.md#421-长跑进程必须独立-terminal强制规则2026-07-22-实测)                    | 在跑 `npm run dev` 的 terminal 里跑下一个命令，导致 Vite dev server 被 SIGTERM 死亡；前端报"网络错误"根因是 dev server 死了                                      |
| 2026-07-22 | Express 路由通配冲突：audit 模块截胡所有其他模块                | L3 边缘 | [lessons-learned §3.6](./lessons-learned.md#36-express-路由通配冲突audit-模块截胡所有其他模块2026-07-22-实测) | audit 挂 `/api/v1` + `router.get('/:id')` 通配，截留 servers/workflows/auto 等所有单段路径；34 个核心 API 404，修复后全部 200。**路由通配应升级为 ADR-035**      |

### 案例维护规则

- 每次沉淀新规则后，在本表追加一行
- 案例库用于快速查找历史教训
- 定期回顾案例库，合并相似案例

---

## 九、参考资源

- [1.md §一 强制报告规则](./top-rules.md) — 任何不一致都要报告
- [architecture.md §四 AI 开发辅助规则](./architecture.md) — AI 禁止操作清单
- [powershell.md](./powershell.md) — 第一个 L3 案例范本
- 记忆系统路径：`c:\Users\123\.trae-cn\memory\`
