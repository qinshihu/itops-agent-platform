// Barrel re-exports for the sshService module.
// Re-exports everything that was originally exported from sshService.ts so that
// all existing imports (e.g. from '../services/sshService') continue to work unchanged.

export type { CommandResult } from './sshTypes';

export { sshPool } from './sshConnectionPool';

export {
  executeCommand,
  testConnection,
  executeCommandWithRetry,
  testConnectionWithRetry
} from './sshCommandExecutor';

export {
  complianceChecks,
  runComplianceCheck
} from './sshComplianceService';

export {
  getCommandHistory,
  getComplianceHistory
} from './sshHistoryRepository';