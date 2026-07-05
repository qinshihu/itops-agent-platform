/**
 * serverRepository — servers / server_groups / server_group_mapping / ssh_keys / service_topologies 表的统一数据访问层
 *
 * 子 repository：
 *   - serversRepo   (servers, server_command_history, compliance_checks, server_metrics, encryption_keys)
 *   - groupsRepo    (server_groups + server_group_mapping)
 *   - sshKeysRepo   (ssh_keys)
 *   - topologyRepo  (service_topologies)
 *
 * 取代 serverRoutes.ts / serverGroupRoutes.ts / sshKeyRoutes.ts 等散落的 db.prepare 调用。
 */

export { serversRepo } from './serverCrud';
export { groupsRepo } from './serverGroups';
export { sshKeysRepo } from './sshKeys';
export { topologyRepo } from './serverTopology';
export type {
  ServerRecord,
  ServerCreateInput,
  ServerUpdateInput,
  ServerGroupRecord,
  ServerGroupCreateInput,
  SshKeyRecord,
} from './types';

import { serversRepo } from './serverCrud';
import { groupsRepo } from './serverGroups';
import { sshKeysRepo } from './sshKeys';

// ── 聚合导出（兼容 serverRepository.* 调用风格）──

export const serverRepository = {
  servers: serversRepo,
  groups: groupsRepo,
  sshKeys: sshKeysRepo,
};