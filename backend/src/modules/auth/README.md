# 认证模块 (`auth/`)

> **DDD 限界上下文**：认证与授权（JWT + RBAC）
> **聚合根**：`User`、`Token`、`Role`
> **最后刷新**：2026-07-22

## 职责
用户认证、授权、密码策略、会话管理、登录节流、Token 黑名单、密码加密。

## 路由端点

`auth/` 模块 routes.ts 同时导出 3 个 router：

| Router | 挂载点 | 来源 | 说明 |
|--------|--------|------|------|
| `authOnlyRouter` | `/api/v1/auth/*`（公开） | `authRoutes.ts` | 登录、刷新 token、登出、修改密码（部分需鉴权） |
| `userRouter` | `/api/v1/users/*`（受保护） | `userRoutes.ts` | 用户 CRUD（仅 admin） |
| `default` | 同时挂载 `/auth/*` 和 `/users/*` | 上面两者 | 受保护链（用于受保护聚合挂载） |

> `authOnlyRouter` 在 `_registry.ts` 中挂载为公开路由（`publicRoutes`），其余均为受保护。

## 内部结构
```
auth/
├── routes/                          # 2 路由文件
│   ├── authRoutes.ts                 ← /auth/login, /auth/refresh, /auth/logout, /auth/change-password
│   └── userRoutes.ts                 ← /users CRUD（admin）
├── services/                         # 5 业务服务（含 4 个测试文件）
│   ├── userCrudService.ts            ← 用户 CRUD（routes 抽象层）
│   ├── credentialService.ts          ← 凭据校验（密码哈希比对）
│   ├── encryptionService.ts          ← 敏感字段加密（AES）
│   ├── loginThrottler.ts             ← 登录频率限制 + 账户锁定
│   └── tokenBlacklist.ts             ← JWT 黑名单（强制下线）
├── routes.ts                         # 路由聚合入口（导出 3 个 router）
├── index.ts
└── README.md
```

## 依赖关系
- **被全项目所有模块依赖**（JWT 鉴权中间件 `middleware/auth`）
- 依赖 `audit/`（登录/CRUD 审计日志写入）
- 不依赖其他业务模块

## 关键说明
- **JWT token 认证**：支持角色基础权限（RBAC：`admin` / `operator` / `viewer`）
- **登录节流**：`loginThrottler` 限制失败次数（默认 5 次 / 15 分钟）+ 账户自动锁定
- **Token 黑名单**：`tokenBlacklist` 实现强制下线（登出后 token 立即失效）
- **密码策略**：`utils/passwordPolicy.ts` 统一校验强度（routes 调用 `validatePassword()`）
- **测试覆盖**：4 个测试文件（credentialService / encryptionService / loginThrottler / tokenBlacklist），是项目测试覆盖最完整的模块之一