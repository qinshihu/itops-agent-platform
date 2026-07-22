/**
 * AlertProviders 类型定义（2026-07-21 拆分）
 *
 * 把原 AlertProviders.tsx L1-32 的 interface 抽出
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */

export interface AlertProvider {
  id: string;
  name: string;
  type: string;
  configSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: unknown;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

export interface AlertProviderConfig {
  id: string;
  provider_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  key: string;
  label: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
}

export interface TestResult {
  ok: boolean;
  message: string;
}
