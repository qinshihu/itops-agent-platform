# ADR-010: 认证与授权方案 — JWT + 3 级 RBAC

**日期**: 2026-07-04
**状态**: Accepted
**架构层**: 业务架构层

> **更新 (2026-07-06)**：原文中关于 `commandFilter 角色分级` 的描述已失效（commandFilter 已删除，详见 [ADR-006](./006-command-filter.md)）。RBAC 仍适用于路由级访问控制，命令执行层不再做角色过滤。

---

## 背景

系统需要对用户进行认证（验证身份）和授权（控制权限）。不同角色的用户能执行的操作不同：

| 角色 | 典型用户 | 核心权限 |
|------|---------|---------|
| **viewer**（查看者） | 管理者、审计人员 | 查看仪表盘、告警、监控数据 |
| **operator**（运维者） | SRE、一线运维 | viewer + 管理设备/服务器、执行非危险 SSH 命令 |
| **admin**（管理员） | 运维主管、安全管理员 | operator + 执行危险命令、管理用户、系统设置 |

---

## 决策

### 认证：JWT（JSON Web Token）

- **签发**: 用户成功登录后，后端签发 JWT，包含 `{ sub: userId, username, role, iat, exp }`
- **验证**: `middleware/auth.ts` 解析 Authorization header，验证签名和过期时间
- **刷新**: Token 过期后，前端自动调用 `/api/auth/refresh` 获取新 Token
- **黑名单**: `tokenBlacklist.ts` 管理主动登出后的 Token 失效

### 授权：3 级 RBAC

**中间件**: `requireRole('admin')` / `requireRole('admin', 'operator')`

```typescript
// 示例：只有 admin 和 operator 能创建修复策略
router.post('/', requireRole('admin', 'operator'), (req, res) => { ... });
```

**commandFilter 角色分级**:

| 命令类型 | viewer | operator | admin |
|---------|:---:|:---:|:---:|
| 只读命令（ls, cat, ps） | ❌ | ✅ | ✅ |
| 服务管理（systemctl restart） | ❌ | ✅ | ✅ |
| 危险命令（rm, dd, kill） | ❌ | ❌ | ✅ |
| 系统关键指令（mkfs, reboot） | ❌ | ❌ | ❌ |

### 密码安全

- **加密**: bcryptjs（salt rounds = 10）
- **密码策略**: 最小 8 位，包含大小写字母、数字、特殊字符
- **强制改密**: 首次登录或密码过期后，`requirePasswordChange` 中间件拦截所有非改密请求
- **登录限流**: `loginThrottler.ts` 连续 5 次失败锁定账号 15 分钟

### 敏感数据保护

- SSH 密码、API Key 等敏感字段通过 `encryptionService.ts` 加密存储
- 加密密钥通过环境变量 `ENCRYPTION_KEY` 注入

---

## 替代方案评估

### Session + Cookie
- ~~不适合 API~~：非浏览器客户端（CLI、外部系统）难以处理 Cookie
- ~~不适合 WebSocket~~：WS 连接握手时需要额外处理 Session

### OAuth2 / OpenID Connect
- ~~过度复杂~~：当前不需要第三方登录，企业内部认证足够
- 如果未来需要 SSO，可以在 auth 中间件前添加 OAuth2 adapter

### API Key
- ~~不安全~~：静态 API Key 一旦泄露无法撤回
- 仅用于特殊场景（Webhook 签名），不作为主要认证方式

---

## 后果

### 正面
- 无状态：服务端不需要维护 Session，水平扩展友好
- 轻量：JWT 验证成本极低
- 安全分层：从路由级 RBAC 到命令级 commandFilter 形成多层防御
- 密码安全：bcryptjs + 强制改密 + 登录限流三重保护

### 负面
- JWT 无法主动失效（服务端无状态），只能通过黑名单补丁
- Token 过期需要前端处理刷新逻辑

### 缓解措施
- Token 过期时间设为 1 小时，减少泄露窗口
- Refresh Token 存储在 httpOnly cookie（如需要）
- Token 黑名单在服务重启后丢失（可接受，因为黑名单中 Token 很快过期）
