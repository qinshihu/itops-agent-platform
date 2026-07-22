/**
 * 工具链接模块（tool-links）
 *
 * 职责：工具箱 CRUD（list/create/update/delete）+ 图标上传/静态服务
 * 阶段：P1-6 infra 按子域拆分阶段 6（2026-07-07）
 * 原位置：modules/infra/{routes/toolLinkRoutes.ts, services/toolLinkCrudService.ts}
 */

export { default as routes } from './routes';
export { toolLinkCrudService } from './services/toolLinkCrudService';
