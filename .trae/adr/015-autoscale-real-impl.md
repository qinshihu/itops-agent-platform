# ADR-015: 自动伸缩与虚拟机迁移的真实化改造

**状态**: 已采纳 | **决策日期**: 2026-07-06 | **决策者**: 项目作者

## 背景

经由《容器与虚拟化功能综合分析报告》扫描后发现：

1. `autoScaleService` 的 `executeScaleUp` / `executeScaleDown` 仅为占位实现：
   - 只更新数据库 (`updateLastScaleTime` + `logHistory`)，**没有真正调用 Docker / VM / K8s API**
   - `targetType === 'vm'` 直接 `return`，永远不会缩扩容
   - `targetType === 'k8s_deployment'` 没有分支
   - `currentInstances` 硬编码为 1
2. `vmMigrationService.simulateMigration` 完全是"假迁移"：每 2s 随机 +5~+20% 进度
3. 上述情况让"自动伸缩"和"虚拟机迁移"在生产上**形同虚设**

## 决策

### 自动伸缩（autoScaleService）

**目标类型 × 真实 API**：

| targetType | 取副本数 | 扩缩容动作 |
|------------|---------|-----------|
| `container` | `dockerService.listContainers` 过滤名字前缀 `targetName-replica-` 中 `state='running'` | `dockerService.runContainer(image, name, { restartPolicy: 'unless-stopped' })` / `removeContainer(id, force=true)` |
| `vm` | `vmManagementService.listVMs(platformId)` | `vmManagementService.cloneVM({ platformId, vmId, name, powerOn: true })` / `powerOffVM + deleteVM` |
| `k8s_deployment` | `kubernetesService.getDeploymentReplicas(namespace, name, contextId)` | `kubernetesService.scaleDeployment(namespace, name, replicas, contextId)` |

**targetId 约定**：
- `container`: targetId = 模板容器 ID
- `vm`: targetId 形如 `${platformId}/${sourceVmId}`
- `k8s_deployment`: targetId 形如 `${contextId}/${namespace}/${deploymentName}`

**Cooldown 重构**：
- 内存 `Map<ruleId, { lastScaleUp: number, lastScaleDown: number }>`
- `isInCooldown(rule, 'up')` 单独检查 `scaleUpCooldown`
- `isInCooldown(rule, 'down')` 单独检查 `scaleDownCooldown`
- 修复了原 `Math.min(scaleUpCooldown, scaleDownCooldown)` 截断 bug

### 虚拟机迁移（vmMigrationService）

- 替换 `simulateMigration` 为 `runRealMigration`：
  - 实际调用 `vmManagementService.migrateVM(platformId, { vmId, targetHostId, priority: 'defaultPriority' })`
  - 同时启动乐观进度 interval（hypervisor API 通常不返回进度）
  - 成功 → 更新 SQLite host 字段；失败 → `markFailed` 写错误信息
- 增加 `AbortController` 支持取消（`cancelMigration` 中 `abort?.abort()`）
- `vmManagementService.migrateVM` 委派到具体 hypervisor 适配器

### dockerService.runContainer

为了支持 container 类型自动伸缩，扩 `dockerService` 增加 `runContainer(image, name, options)` 方法，调用 `docker.createContainer` + `start`。原 `containerOps.ts` 没有 `impl_runContainer`，已新增。

## 拒绝的方案

1. **引入 node-cron 库** — 提升 `vmSnapshotScheduler` 的精度。
   - 改用内置的 `parseCronToNextRun` 纯函数实现，避免引入新依赖
   - 通过 `setTimeout` 调度下次执行，到点触发后再次自调度，**比 setInterval 更准**

2. **保留 `Math.min(scaleUpCooldown, scaleDownCooldown)`** — 错误地让两个 cooldown 共享最小值。
   - 改为各自独立的 `lastScaleUp` / `lastScaleDown`

3. **保留 `currentInstances = 1` 硬编码** — 让所有规则都退化为"扩到 2"。
   - 改为分别从 Docker / VM API / K8s API 拉真实副本数

## 影响

- 自动伸缩从"日志型" → "真正的扩缩容"，可在生产触发
- VM 迁移从"假进度" → "真迁移"，审计 + 数据库同步生效
- `vmManagementService.migrateVM` 已暴露给前端 / API
- 修复了 cooldown bug，扩容/缩容不再相互影响

## 相关变更

- `backend/src/modules/auto/services/autoScaleService.ts` 重写
- `backend/src/modules/containers/services/vmMigrationService.ts` 重写
- `backend/src/modules/containers/services/vmManagement/index.ts` 新增 `migrateVM`
- `backend/src/modules/containers/services/docker/containerOps.ts` 新增 `impl_runContainer`
- `backend/src/modules/containers/services/docker/dockerService.ts` 暴露 `runContainer`
- `backend/src/modules/kubernetes/services/kubernetesService.ts` 新增 `getDeploymentReplicas`
