/**
 * 数据库维护 Repository
 *
 * 封装 models/database 中的维护函数，提供统一的 Repository 层访问入口。
 * 业务代码应通过此 Repository 访问维护功能，而非直接 import models/database。
 */

import { performMaintenance } from '../models/database';

export const maintenanceRepository = {
  /** 执行数据库维护操作：vacuum / analyze / integrity_check */
  performMaintenance,
};
