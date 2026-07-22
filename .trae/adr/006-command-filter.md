# ADR-006: SSH 命令安全过滤 — 已废弃（Deprecated）

**状态**: **Deprecated** | **日期**: 2026-07-06 | **决策者**: 项目作者

> **本 ADR 为"反向 ADR"**：用于记录被废弃的旧决策，确保所有引用方能找到历史背景。
> 历史文件 `middleware/commandFilter.ts` 已与代码同步删除（无遗留代码）。
> 详见 [rules/top-rules.md §六 SSH 功能设计原则](../rules/top-rules.md) 与 [`rules/architecture.md` §1.1](../rules/architecture.md)。

---

## 一、原决策（2025-Q1，2025-Q4 修订）

### 1.1 背景

项目早期，用户和 AI 在执行 SSH 命令时存在两类风险：
1. **危险命令**（如 `rm -rf /`、`dd`、`mkfs`、`reboot`、`shutdown`）—— 误操作可导致系统不可用
2. **凭据泄露**（如 `cat /etc/shadow`、`sudo cat /etc/passwd`）—— 安全合规风险
3. **权限提升**（如 `sudo su -`、`chmod 777 /etc`）—— 越权风险

### 1.2 原决策：6 层过滤 + 3 级角色

实现 `middleware/commandFilter.ts`，对所有 SSH 执行命令做 6 层过滤：

```
Layer 1: 子 shell 检测（$(), ``, ${}, &&, ||, ;）
Layer 2: 编码绕过检测（base64、hex、unicode）
Layer 3: 远程脚本检测（curl | bash、wget | sh）
Layer 4: 危险命令黑名单（rm/dd/mkfs/shutdown/reboot 等）
Layer 5: 凭据访问检测（/etc/passwd、/etc/shadow、~/.ssh/id_*）
Layer 6: 权限提升检测（sudo、su、chmod 777、chown）
```

按 viewer/operator/admin 三级角色控制：

| 命令类型 | viewer | operator | admin |
|---------|:---:|:---:|:---:|
| 只读命令（ls, cat, ps） | ❌ | ✅ | ✅ |
| 服务管理（systemctl restart） | ❌ | ✅ | ✅ |
| 危险命令（rm, dd, kill） | ❌ | ❌ | ✅ |
| 系统关键指令（mkfs, reboot） | ❌ | ❌ | ❌ |

详见历史设计文档（已不再引用）。

---

## 二、废弃决策（2026-07-06）

### 2.1 触发原因

2026-07-06 项目评审发现：

1. **AI 误判**：6 层过滤实际经常**误判合法命令**（如 `grep -E "rm|dd"` 这种正则测试会被 Layer 4 黑名单拦截），让运维工作难以开展
2. **绕过路径多**：编码绕过检测永远跑不过用户——只要有一层漏掉，整个过滤体系失效（纵深防御但纵深被突破）
3. **纯前端过滤属于吃力不讨好**：实际企业环境靠 **Linux `sudoers`** 与 **SSH `authorized_keys` `command=`** 控制账号权限更彻底
4. **功能优先级**：项目处于探索开发阶段，**先保证功能能用、好用、易用**，过滤问题留给运维侧解决

### 2.2 新决策（替代方案）

按 [`rules/top-rules.md` §六](../rules/top-rules.md) SSH 功能设计原则：

- **SSH 执行层面不做任何命令过滤限制**（应用层）
- 允许用户和 AI 输入任何命令
- 不做：命令过滤、可识别 AI 调用、强制 AI 路径不可执行系统级命令
- 不做的原因：服务器端通过账号权限控制就能解决（**Linux `sudoers`** / **SSH `authorized_keys` `command=`**）
- 原则：先保证这个功能**能用、好用、易用**，纯前端过滤属于吃力不讨好

### 2.3 已删除代码

- `middleware/commandFilter.ts` 已删除（2026-07-06）
- 引用方：~~[ADR-001 §一 决策](001-typescript-express.md)~~、~~[ADR-010 §决策](010-authentication-authorization.md)~~ 等历史引用已通过"更新"段落标注失效
- 无遗留代码或配置项

---

## 三、影响与回退方案

### 3.1 影响

| 影响维度 | 说明 |
|---------|------|
| 应用层 | SSH 执行完全开放，无过滤 |
| 服务器层 | 实际生产环境必须通过 `sudoers` / `authorized_keys` 控制账号权限 |
| 文档层 | [rules/architecture.md §1.1](../rules/architecture.md) 的"业务架构层"表格用删除线标注 |
| ADR 链 | 所有引用 ADR-006 的地方改为引用本 ADR "已废弃"段落，避免内容丢失 |

### 3.2 回退方案

如果未来项目需要重新启用应用层命令过滤（例如面向 SaaS 多租户场景）：

1. 在 `core/` 下新建 `commandFilter.ts`（放回技术架构层而非业务架构层）
2. 与本 ADR 平级新增 `ADR-020` 描述新设计
3. 与 [ADR-001 §决策](001-typescript-express.md)、[ADR-010 §决策](010-authentication-authorization.md) 的"更新"段落配合修订

---

## 四、为什么保留这个 ADR（不直接删除文件）

按"自指原则"与文档治理规则：

1. **保留历史决策轨迹**：未来贡献者可能想了解"项目为什么不做命令过滤"
2. **复活所有引用**：`.trae/rules/architecture.md` §1.1、`.trae/documents/TECH_ARCHITECTURE.md` §2.1+§5.2、`.trae/adr/001-typescript-express.md` 第 5 行、`.trae/adr/010-authentication-authorization.md` 第 7 行均引用此文件
3. **可读性高于删除**：README 废弃表中已有 ADR-006 行，但详细背景只在文件中

---

## 五、相关 ADR

- [ADR-001 §更新](001-typescript-express.md)：原文中关于 `commandFilter` 的描述已失效
- [ADR-010 §更新](010-authentication-authorization.md)：RBAC 仍适用于路由级访问控制，命令执行层不再做角色过滤
- [rules/top-rules.md §六](../rules/top-rules.md)：SSH 功能设计原则
- [rules/architecture.md §1.1](../rules/architecture.md)：业务架构层表格删除线标注

---

*本 ADR 由 `.trae/` 评审报告（2026-07-09）发现 4 处死链后补充建档，确保所有引用方能找到历史背景。*