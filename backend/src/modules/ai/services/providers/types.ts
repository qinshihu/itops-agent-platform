/**
 * Provider 类型定义
 */

// ── 语义化类型别名 ──

/** Provider 初始化配置 */
export type ProviderInitConfig = Record<string, unknown>;
/** 方法示例输入 */
export type MethodExampleInputs = Record<string, unknown>;
/** 方法示例输出 */
export type MethodExampleOutputs = Record<string, unknown>;
/** Provider 设置项 */
export type ProviderSettings = Record<string, unknown>;
/** 执行结果元数据 */
export type ProviderMetadata = Record<string, unknown>;

// Provider 接口
export interface Provider {
  name: string;
  description: string;
  version: string;
  methods: ProviderMethod[];
  initialize?(config: ProviderInitConfig): Promise<void>;
}

// Provider 方法定义
export interface ProviderMethod {
  name: string;
  description: string;
  inputs: MethodParameter[];
  outputs: MethodParameter[];
  examples: MethodExample[];
}

// 方法参数
export interface MethodParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
  required?: boolean;
  default?: unknown;
}

// 方法示例
export interface MethodExample {
  title: string;
  description?: string;
  inputs: MethodExampleInputs;
  outputs?: MethodExampleOutputs;
}

// Provider 配置
export interface ProviderConfig {
  enabled: boolean;
  config: ProviderSettings;
}

// Provider 执行结果
export interface ProviderResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: ProviderMetadata;
}
