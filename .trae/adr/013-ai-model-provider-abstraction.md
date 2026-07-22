# ADR-013: AI 模型 Provider 抽象 — providerAdapters + CircuitBreaker

**日期**: 2026-07-04
**状态**: Accepted
**架构层**: 业务架构层

> **修订说明**（2026-07-20）：原文描述的 `ProviderRegistry` 类与 `modules/ai/services/providers/` 路径**与实际代码不符**：
>
> - `modules/ai/services/providers/` 实际是**业务数据 Provider**（wecom/dingtalk/slack/elasticsearch/prometheus/kubernetes 等通知与监控数据源），**不是 LLM Provider**。
> - 真正的 LLM Provider 适配代码位于 `modules/ai/services/llm/llmService/providerAdapters.ts`（519 行），通过 `buildProviderConfig` / `callModelWithConfig` / `getProviderForModel` 等函数实现，**不是 class 形式**。
> - 业务数据 Provider 的注册中心 `ProviderRegistry` 类位于同目录，但它服务于通知/监控等业务数据调用，与 LLM 调用是两套独立体系。
>
> 本 ADR 修订后只描述 LLM Provider 部分，业务数据 Provider 体系另见 `modules/ai/services/providers/README.md`（如有）。

---

## 背景

AI Agent 需要通过 LLM 进行推理和决策。不同的 LLM Provider 有不同的 API 格式、定价和能力：

| Provider      | 模型                        | API 格式          | 用途                 |
| ------------- | --------------------------- | ----------------- | -------------------- |
| 豆包 (Doubao) | doubao-4o                   | OpenAI-compatible | 默认，低延迟高性价比 |
| OpenAI        | GPT-4o / GPT-4-turbo        | OpenAI 原生       | 备用，强推理能力     |
| 未来可扩展    | Anthropic Claude / 本地模型 | —                 | —                    |

需要设计一套 Provider 抽象层，支持：

1. 动态切换 Provider
2. 故障自动降级（熔断）
3. 统一的 function calling 接口

---

## 决策

### providerAdapters 函数式适配（实际实现）

实际代码采用**函数式适配**而非 class 注册中心。核心实现在 [`modules/ai/services/llm/llmService/providerAdapters.ts`](../../backend/src/modules/ai/services/llm/llmService/providerAdapters.ts)（519 行）：

```typescript
// 实际 API（函数式，非 class）
buildProviderConfig(model: string): ProviderConfig | null
callModelWithConfig(config: ProviderConfig, messages: Message[]): Promise<LLMResponse>
getProviderForModel(model: string): 'doubao' | 'openai' | 'localai' | null
recordAgentExecution(agentId: string, ...): void
updateAgentStats(agentId: string, ...): void
checkLLMAvailability(): boolean

// 三个内置适配器（OpenAI-compatible 协议）
doubaoAdapter    // 豆包（默认）
openaiAdapter    // OpenAI（备用）
localaiAdapter   // LocalAI（本地部署）
```

**模型池调度**：`buildProviderConfig` 按模型名推断 Provider，配合 `ai_models` 表的 `is_default`/`enabled` 字段实现主备切换。

### CircuitBreaker 熔断器

```
状态转换:
  CLOSED ──(连续失败 >= 5次)──> OPEN
  OPEN ──(60秒后)──> HALF_OPEN
  HALF_OPEN ──(成功)──> CLOSED
  HALF_OPEN ──(失败)──> OPEN
```

实际实现在 [`modules/ai/services/llm/llmService/circuitBreaker.ts`](../../backend/src/modules/ai/services/llm/llmService/circuitBreaker.ts)（约 200 行），提供：

- `callWithRetry(fn, breaker)` — 自动重试 + 熔断
- `startCircuitBreakerCleanup` / `stopCircuitBreakerCleanup` — 30 分钟清理过期状态
- `getCircuitBreakerStats()` — 监控统计

### Provider 配置

```typescript
// models/providers 表
interface ProviderConfig {
  id: string;
  name: string; // 'doubao' | 'openai'
  displayName: string; // '豆包' | 'OpenAI'
  apiKey: string; // 加密存储
  baseUrl: string; // API 端点
  models: string[]; // 支持的模型列表
  isDefault: boolean; // 是否默认 Provider
  enabled: boolean;
}
```

### 工作流

```
Agent 请求 LLM 推理
  → buildProviderConfig(model) 推断 Provider + 构造配置
  → callModelWithConfig(config, messages)
    → CircuitBreaker 检查该 Provider 的熔断器状态
      → 如果 CLOSED → 调用对应 adapter（doubao/openai/localai）
        → 成功 → 返回结果 + recordAgentExecution 记录
        → 失败 → failures++ → 如果 >= 5 → 熔断器 OPEN
      → 如果 OPEN → 抛异常
        → 上层捕获 → 可降级到备用 Provider（openai）
```

---

## 替代方案评估

### LangChain

- ~~过度抽象~~：LangChain 的 Chain/Agent/Tool 抽象层与我们的 MCP 工具系统概念重叠
- ~~版本不稳定~~：LangChain 频繁 breaking changes
- ~~性能开销~~：额外的序列化/反序列化和提示词模板解析

### 硬编码单一 Provider

- ~~不满足可靠性需求~~：单点故障，Provider 宕机则全平台不可用
- ~~不满足灵活性需求~~：用户可能需要根据任务选择不同模型

### 直接使用 OpenAI SDK

- ~~锁定厂商~~：不利于未来切换或添加 Provider
- 但 `providerAdapters.ts` 利用了豆包和 OpenAI 的 API 兼容性（OpenAI-compatible format）

---

## 后果

### 正面

- Provider 解耦：新增 LLM Provider 只需在 `providerAdapters.ts` 添加新 adapter 函数
- 高可用：自动熔断 + 降级，Provider 故障不影响整体服务
- 灵活性：每个 Agent 可指定不同的模型/Provider
- 可观测：`recordAgentExecution` / `updateAgentStats` 写入 `agent_execution_repository`，调用成功率、延迟、熔断次数全部可监控

### 负面

- 熔断器增加延迟（检查状态、计数）
- 降级到备用 Provider 可能导致推理质量下降
- 函数式实现不如 class 注册中心易扩展（新增 Provider 需修改 providerAdapters.ts，而非独立注册）

### 缓解措施

- 熔断器检查是内存操作，延迟 < 0.1ms，可忽略
- 降级日志记录，管理员可监控降级频率
- `checkLLMAvailability()` 在无可用 Provider 时返回 false，调用方优雅降级
- 未来若需更动态的 Provider 注册，可在 `providerAdapters.ts` 之上封装 registry 层
