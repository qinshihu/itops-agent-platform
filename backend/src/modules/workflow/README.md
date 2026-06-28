# 工作流模块 (`workflow/`)

## 职责
工作流编排引擎：工作流定义、任务调度、定时任务、审批流程。

## 内部结构
```
workflow/
├── routes/     # 3 路由
├── services/   # 11 服务
│   ├── workflowExecutor.ts   ← 工作流执行引擎（878 行）
│   ├── schedulerService.ts   ← 定时任务调度
│   └── ...
```

## 依赖关系
- 依赖 `ai/`（Agent 执行）、`alerts/`（告警触发）
- 被 `auto/`（自动修复编排）依赖

## 关键说明
- `workflowEngine.test.ts`（289 行）是项目最大最完整的测试文件
