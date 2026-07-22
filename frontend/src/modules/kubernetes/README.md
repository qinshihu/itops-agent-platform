# Kubernetes 模块（前端）

## 职责
Kubernetes 集群管理：集群导入、Pod/Node/Service 列表、Deployment 管理、扩缩容。

## 内部结构
```
kubernetes/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   ├── Kubernetes.tsx                    # K8s 管理入口 (308 行)
│   ├── k8s/
│   │   ├── PodList.tsx                   # Pod 列表
│   │   ├── NodeList.tsx                  # Node 列表
│   │   └── ServiceList.tsx               # Service 列表
│   └── kubernetes/
│       ├── useKubernetes.ts              # K8s 数据 hook
│       ├── types.ts                      # 子模块类型
│       ├── DeploymentTable.tsx           # Deployment 表格
│       ├── OverviewCards.tsx             # 概览卡片
│       ├── ImportClusterModal.tsx        # 导入集群弹窗
│       ├── ScaleModal.tsx                # 扩缩容弹窗
│       ├── DeleteConfirmModal.tsx        # 删除确认弹窗
│       └── K8sUnavailable.tsx            # 不可用状态
└── index.ts
```

## 对应后端
`backend/src/modules/kubernetes/`

## 刷新记录
- **2026-07-22**：核对 1458 行 Kubernetes.tsx 主页面 + 5 子模块