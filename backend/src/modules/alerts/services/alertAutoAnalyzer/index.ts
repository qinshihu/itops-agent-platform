/**
 * =============================================================================
 * ITOps Agent Platform - 告警自动分析器
 * =============================================================================
 *
 * 工作流：
 *   告警涌入 → 提取 IP → 查找设备 → SSH/SNMP → AI 分析 → 写入结果
 *
 * 注意：独立轮询已移除，统一由 AlertProcessor 调用 analyzeAlert()
 *
 * 支持设备类型：
 *   - network_devices（交换机/路由器/防火墙）—— SSH 或 SNMP 巡检
 *   - servers（Linux 服务器）—— SSH 诊断
 *
 * 诊断方式：
 *   - SSH 路径：有 SSH 凭证 → SSH 登录执行命令 → AI 分析输出
 *   - SNMP 路径：无 SSH 凭证但有 SNMP 监控 → 取最近 SNMP 巡检结果 → AI 分析
 *
 * 依赖服务：
 *   - sshService: SSH 连接执行命令
 *   - llmService: AI 分析输出
 *   - alertDeviceResolver: 告警→设备联动
 * =============================================================================
 */

import { logger } from '../../../../utils/logger';
import { analyzeAlert } from './analysisEngine';
import { getAnalysisHistory, getByAlertId } from './resultWriter';

// barrel re-export
export { type AutoAnalysisResult } from './resultWriter';
export { type DeviceInfo } from './deviceResolver';

// ====================== 主类 ======================

class AlertAutoAnalyzer {
  private processingIds = new Set<string>();

  /** 分析单个告警的完整流程（由 AlertProcessor 调用） */
  async analyzeAlert(alertId: string) {
    return analyzeAlert(alertId, this.processingIds);
  }

  /** 获取分析记录列表 */
  getAnalysisHistory(limit = 50) {
    return getAnalysisHistory(limit);
  }

  /** 根据告警 ID 获取分析记录 */
  getByAlertId(alertId: string) {
    return getByAlertId(alertId);
  }

  /** 启动服务（无操作 — 轮询已移除，由 AlertProcessor 统一调用） */
  start(): void {
    logger.info('🤖 告警自动分析服务已就绪（由 AlertProcessor 统一调用，无独立轮询）');
  }

  /** 停止服务 */
  stop(): void {
    logger.info('⏹ 告警自动分析服务已停止');
  }
}

// ====================== 导出 ======================

export const alertAutoAnalyzer = new AlertAutoAnalyzer();
