/**
 * MCP Gateway — barrel export
 * 子模块分别负责 SSE 传输、工具调用、审批流程
 */
export { registerRouteRegistrationRoutes } from './routeRegistration';
export { registerToolInvocationRoutes } from './toolInvocation';
export { registerApprovalFlowRoutes } from './approvalFlow';