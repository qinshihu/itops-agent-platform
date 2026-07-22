/**
 * linkRemediationWorkflows 子模块 barrel export（2026-07-21 拆分）
 */
export {
  linkExistingPolicies,
  insertExtraPolicies,
  type PolicyRecord,
  type WorkflowBindingResult,
} from './bindingOps';
export {
  buildSpecialPolicies,
  type ExtraPolicy,
  type WorkflowIds,
} from './specialPolicies';
export { buildZabbixPolicies } from './zabbixPolicies';
export { buildPrometheusPolicies } from './prometheusPolicies';
export { buildCatchAllPolicies } from './catchAllPolicies';
