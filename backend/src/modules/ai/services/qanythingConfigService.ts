/**
 * QAnything 配置 路由层抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * QAnything 配置存储于 settings 表（key='qanything_config'），本 service
 * 集中封装 get/upsert，routes 不知道 settingsRepository 的存在。
 */
import { settingsRepository } from '../../../repositories';

const CONFIG_KEY = 'qanything_config';

export const qanythingConfigService = {
  getConfig() {
    return settingsRepository.getValue(CONFIG_KEY);
  },

  saveConfig(config: unknown) {
    settingsRepository.upsert(CONFIG_KEY, JSON.stringify(config));
  },
};
