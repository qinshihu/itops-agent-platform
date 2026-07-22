# 认证模块（前端）

## 职责
用户认证与授权：登录、密码管理、用户管理。

## 内部结构
```
auth/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   ├── Login.tsx                         # 登录页
│   ├── ForcePasswordChange.tsx           # 强制改密
│   └── Users.tsx                         # 用户管理
└── index.ts
```

## 对应后端
`backend/src/modules/auth/`

## 刷新记录
- **2026-07-22**：核对 Login + ForcePasswordChange + Users 三页面