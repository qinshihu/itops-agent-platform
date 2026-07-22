# Kubernetes 模块 (`kubernetes/`)

> **DDD 限界上下文**：K8s 集群管理
> **聚合根**：`K8sContext`、`Pod`、`Node`
> **最后刷新**：2026-07-22

## 职责
Kubernetes 集群管理：通过 kubeconfig 接入 K8s Context，统一查询命名空间 / Pod / Deployment / Service / Node，支持 Pod 删除与 Deployment 扩缩容。

## 路由端点（受保护）

> `kubernetes/routes.ts` 自身仅挂载 `router.use('/kubernetes', kubernetesRoutes)`，所有路径来自 `kubernetesRoutes.ts`。

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/kubernetes/*` | `kubernetesRoutes.ts` | K8s 集群 / Pod / Deployment / Service / Node 全套 API |

## 内部结构
```
kubernetes/
├── routes/                       # 1 路由文件
│   └── kubernetesRoutes.ts       # Contexts / Namespaces / Pods / Deployments / Services / Nodes
├── services/                     # 1 业务服务（1 测试文件）
│   ├── kubernetesService.ts      # K8s API 封装（listContexts/addContext/testContext/deleteContext/listNamespaces/listPods/listDeployments/listServices/listNodes/getPod/getPodLogs/deletePod/scaleDeployment/isAvailable）
│   └── kubernetesService.test.ts
├── routes.ts                     # 路由聚合入口
├── index.ts                      # 模块导出
└── README.md
```

## 路由端点（受保护）

| 路径 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/kubernetes/contexts` | GET | 受保护 | 列出所有已连接集群 |
| `/kubernetes/contexts` | POST | admin/operator | 导入 kubeconfig（添加集群） |
| `/kubernetes/contexts/test` | POST | admin/operator | 测试 kubeconfig 连接 |
| `/kubernetes/contexts/:id` | DELETE | admin/operator | 删除集群 |
| `/kubernetes/namespaces` | GET | 受保护 | 列出命名空间（?context=） |
| `/kubernetes/pods` | GET | 受保护 | 列出 Pods（?namespace=&context=） |
| `/kubernetes/pods/:namespace/:name` | GET | 受保护 | Pod 详情 |
| `/kubernetes/pods/:namespace/:name/logs` | GET | 受保护 | Pod 日志（?tail=100&context=） |
| `/kubernetes/pods/:namespace/:name` | DELETE | admin/operator | 删除 Pod |
| `/kubernetes/deployments` | GET | 受保护 | 列出 Deployments |
| `/kubernetes/deployments/:namespace/:name/scale` | PUT | admin/operator | 扩缩容（body: {replicas}） |
| `/kubernetes/services` | GET | 受保护 | 列出 Services |
| `/kubernetes/nodes` | GET | 受保护 | 列出 Nodes |

## 依赖
- `@kubernetes/client-node` — K8s 官方 Node 客户端
- `repositories/k8sContextRepository` — 持久化存储 Context 与 kubeconfig
- `middleware/auth` — JWT + `requireRole('admin','operator')`
- `utils/errorHelpers` — 统一错误信息提取

## 被依赖
- 前端 `frontend/src/modules/kubernetes/`（1458 行的大页面，含 ClusterSelector / NamespaceSelector / PodList / DeploymentTable / ServiceList / NodeList / OverviewCards / ScaleModal / ImportClusterModal / HeaderBar / SearchBox / TabButton / useKubernetes / types 等）

## 关键说明
- **可用性检查**：所有资源查询端点均先 `kubernetesService.isAvailable()` 校验，未导入 kubeconfig 时返回 503
- **多集群支持**：`?context=` 参数支持切换集群，所有资源 API 都接受该参数
- **审计**：删除 Pod / 扩缩容 Deployment 是写操作，需 `admin/operator` 角色
- 与 `containers/` 模块的区别：K8s 是声明式编排平台，`containers/` 是命令式容器管理（Docker），二者职责清晰划分
- 与 `auto/autoScaleService` 联动：AutoScale 的 `k8s_deployment` 目标类型即调用本模块的 `scaleDeployment`