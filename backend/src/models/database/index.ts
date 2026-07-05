export { setIOInstance, getIOInstance } from './core';
export { getDbInstance, db, initializeDatabase } from './core';
export { default } from './core';
export { performMaintenance, performVacuum, performAnalyze, performIntegrityCheck, performCheckpoint, performFullMaintenance, startDatabaseMaintenance, stopDatabaseMaintenance } from './maintenance';
export { getTableIndexes, getQuerySuggestions, getDatabaseHealthStatus } from './health';