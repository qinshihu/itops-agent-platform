/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v041DcRoomEnergy: Migration = {
  id: '20250101000041',
  version: 41,
  name: 'dc_room_energy',
  description: 'Add PUE and total_power_kw columns to dc_rooms for energy efficiency monitoring',

  up: async (db: any) => {
    logger.info('🔄 Adding PUE/power columns to dc_rooms...');

    try {
      db.exec(`ALTER TABLE dc_rooms ADD COLUMN pue REAL DEFAULT 1.45`);
    } catch { /* column may already exist */ }
    try {
      db.exec(`ALTER TABLE dc_rooms ADD COLUMN total_power_kw REAL DEFAULT 0`);
    } catch { /* column may already exist */ }

    logger.info('✅ DC room energy columns added successfully');
  },

  down: async (_db: any) => {
    // SQLite doesn't support DROP COLUMN in older versions
  },
};

export default v041DcRoomEnergy;
