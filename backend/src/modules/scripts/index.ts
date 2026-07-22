/**
 * 脚本与终端模块（scripts）
 *
 * 职责：
 *   - 脚本（scripts）CRUD：通过 REST API 管理运维脚本模板
 *   - Web 终端（terminalService）：SSH 交互式 Web Terminal 会话
 *   - 终端 AI 分析（terminalAiService）：调用 LLM 分析终端输出
 *   - 多平台命令模板（commandDispatcher）：Linux / Windows / FreeBSD / macOS / Solaris / AIX
 * 阶段：P1-6 infra 按子域拆分阶段 2（2026-07-07）
 * 原位置：modules/infra/
 */

export { default as routes } from './routes';
