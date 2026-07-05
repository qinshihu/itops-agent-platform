import { toolRegistry } from '../toolRegistry';
import { logger } from '../../../../utils/logger';
import type { RegisteredTool } from '../types';
import { monitorTools } from './monitorTools';
import { serverTools } from './serverTools';
import { networkTools } from './networkTools';
import { containerTools } from './containerTools';
import { aiTools } from './aiTools';
import { infraTools } from './infraTools';

export const PLATFORM_TOOLS: RegisteredTool[] = [
  ...monitorTools,
  ...serverTools,
  ...networkTools,
  ...containerTools,
  ...aiTools,
  ...infraTools,
];

export function registerAllPlatformTools(): void {
  toolRegistry.registerAll(PLATFORM_TOOLS);
  logger.info(
    `Registered ${PLATFORM_TOOLS.length} MCP platform tools across 13 domains`
  );
}
