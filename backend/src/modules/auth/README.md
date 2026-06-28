# 认证模块 (`auth/`)

## 职责
用户认证、授权、密码策略、会话管理、登录节流。

## 内部结构
```
auth/
├── routes/     # login, users, password-reset...
├── services/   # 8 个服务
│   ├── authService.ts        ← JWT 发放/验证
│   ├── loginThrottler.ts     ← 登录频率限制
│   └── ...
```

## 依赖关系
- 被全项目所有模块依赖（JWT 鉴权中间件）
- 不依赖其他业务模块

## 关键说明
- JWT token 认证，支持角色基础权限（RBAC）
- 登录节流和 token 黑名单已实现
