/**
 * 测试结果横幅 widget（2026-07-21 拆分）
 *
 * 从原 AddDeviceModal.tsx L533-541 抽出
 * 显示成功/失败的 feedback banner
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { TestResult } from './types';

export function TestResultBanner({ testResult }: { testResult: TestResult | null }) {
  if (!testResult) return null;

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-md text-sm ${
        testResult.success
          ? 'bg-green-500/10 border border-green-500/20 text-green-300'
          : 'bg-red-500/10 border border-red-500/20 text-red-300'
      }`}
    >
      {testResult.success ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <span>{testResult.message}</span>
    </div>
  );
}
