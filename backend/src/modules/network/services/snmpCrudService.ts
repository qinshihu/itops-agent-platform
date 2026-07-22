/**
 * SNMP 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. SNMP 凭证 CRUD（含自动加密 community/auth_key/priv_key）
 *   2. SNMP Trap 事件查询/插入
 *   3. Network device 基本信息查询（供 SNMP 复用）
 */
import { randomUUID } from 'crypto';
import { snmpRepository, networkDeviceRepository } from '../../../repositories';
import { encrypt } from '../../auth/services/encryptionService';

export const snmpCrudService = {
  // ── 凭证 CRUD ──

  listCredentials(deviceId?: string) {
    snmpRepository.credentials.ensureHostColumn();
    return snmpRepository.credentials.list(deviceId);
  },

  getCredentialByIdWithHost(id: string) {
    return snmpRepository.credentials.getByIdWithHost(id);
  },

  createCredential(input: {
    device_id?: string;
    name?: string;
    community?: string;
    snmp_version?: string;
    snmp_port?: number;
    snmp_user?: string;
    snmp_auth_protocol?: string;
    snmp_auth_key?: string;
    snmp_priv_protocol?: string;
    snmp_priv_key?: string;
    host?: string;
  }): { id: string } {
    snmpRepository.credentials.ensureHostColumn();
    const id = randomUUID();
    snmpRepository.credentials.create({
      id,
      device_id: input.device_id || null,
      name: input.name || 'default',
      community: input.community ? encrypt(input.community) : null,
      snmp_version: input.snmp_version || 'v2c',
      snmp_port: input.snmp_port || 161,
      snmp_user: input.snmp_user || null,
      snmp_auth_protocol: input.snmp_auth_protocol || null,
      snmp_auth_key: input.snmp_auth_key ? encrypt(input.snmp_auth_key) : null,
      snmp_priv_protocol: input.snmp_priv_protocol || null,
      snmp_priv_key: input.snmp_priv_key ? encrypt(input.snmp_priv_key) : null,
      host: input.host || null,
    });
    return { id };
  },

  updateCredential(id: string, input: {
    name?: string;
    community?: string;
    snmp_version?: string;
    snmp_port?: number;
    snmp_user?: string;
    snmp_auth_protocol?: string;
    snmp_auth_key?: string;
    snmp_priv_protocol?: string;
    snmp_priv_key?: string;
    host?: string;
  }) {
    snmpRepository.credentials.update(id, {
      name: input.name || null,
      community: input.community ? encrypt(input.community) : null,
      snmp_version: input.snmp_version || null,
      snmp_port: input.snmp_port || null,
      snmp_user: input.snmp_user || null,
      snmp_auth_protocol: input.snmp_auth_protocol || null,
      snmp_auth_key: input.snmp_auth_key ? encrypt(input.snmp_auth_key) : null,
      snmp_priv_protocol: input.snmp_priv_protocol || null,
      snmp_priv_key: input.snmp_priv_key ? encrypt(input.snmp_priv_key) : null,
      host: input.host || null,
    });
  },

  deleteCredential(id: string) {
    snmpRepository.credentials.delete(id);
  },

  // ── Trap 事件 ──

  insertTestTrap(): { id: string } {
    const id = randomUUID();
    const now = new Date().toISOString();
    const varbinds = JSON.stringify([
      { oid: '1.3.6.1.2.1.1.5.0', value: 'iKuai', type: 4 },
      { oid: '1.3.6.1.2.1.1.3.0', value: (Math.floor(Date.now() / 10) % 1000000).toString(), type: 67 },
      { oid: '1.3.6.1.4.1.9.9.43.1.1.1.0', value: 'linkDown', type: 4 },
      { oid: '1.3.6.1.6.3.1.1.4.1.0', value: '1.3.6.1.6.3.1.1.5.3', type: 6 },
    ]);
    snmpRepository.trapEvents.insert({
      id,
      source_ip: '192.168.60.1',
      trap_type: 'coldStart',
      enterprise_oid: '1.3.6.1.4.1',
      agent_address: '192.168.60.1',
      generic_type: 0,
      specific_type: 0,
      varbinds_json: varbinds,
      created_at: now,
    });
    return { id };
  },

  // ── Network device helper ──

  getNetworkDeviceBasic(deviceId: string) {
    return networkDeviceRepository.getByIdBasic(deviceId);
  },
};
