/**
 * Agent 工具分类注册入口（2026-07-21 拆分）
 *
 * 提供统一的 registerAllAgentTools() 给 ../agentToolRegistry.ts 调用
 * 拆分原则：每个工具分类一个文件（按 category），按需扩展
 */

import { registerSshTools } from './sshTools';
import { registerSystemTools } from './systemTools';
import { registerDockerTools } from './dockerTools';
import { registerK8sTools } from './k8sTools';
import { registerOtherTools } from './otherTools';

export function registerAllAgentTools(): void {
  registerSshTools();
  registerSystemTools();
  registerDockerTools();
  registerK8sTools();
  registerOtherTools();
}
