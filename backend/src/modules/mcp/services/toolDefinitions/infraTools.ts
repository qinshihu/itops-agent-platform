import { z } from 'zod';
import { type RegisteredTool } from '../types';
import { textResult, jsonResult, READONLY } from './shared';
// eslint-disable-next-line no-restricted-imports
import db from '../../../../models/database';

interface CountResult { count: number }

export const infraTools: RegisteredTool[] = [
  {
    name: 'dc.rack.list',
    title: '查询机柜列表',
    description: '查询数据中心机柜列表，包含位置、容量、功耗、温度等信息。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      roomId: z.string().optional().describe('机房 ID'),
      status: z.enum(['active', 'maintenance', 'offline']).optional().describe('机柜状态'),
      limit: z.number().min(1).max(100).default(50).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM dc_racks WHERE 1=1';
        const params: unknown[] = [];
        if (args.roomId) { query += ' AND room_id = ?'; params.push(args.roomId); }
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        query += ` LIMIT ${args.limit || 50}`;
        const racks = db.prepare(query).all(...params);
        return jsonResult(racks, `找到 ${racks.length} 个机柜`);
      } catch (err) {
        return textResult(`查询机柜失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'dc.device.list',
    title: '查询数据中心设备',
    description: '查询数据中心设备清单（服务器、交换机、PDU 等），含机架位置和功耗。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      rackId: z.string().optional().describe('机柜 ID'),
      deviceType: z.string().optional().describe('设备类型'),
      limit: z.number().min(1).max(200).default(100).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM dc_devices WHERE 1=1';
        const params: unknown[] = [];
        if (args.rackId) { query += ' AND rack_id = ?'; params.push(args.rackId); }
        if (args.deviceType) { query += ' AND device_type = ?'; params.push(args.deviceType); }
        query += ` LIMIT ${args.limit || 100}`;
        const devices = db.prepare(query).all(...params);
        return jsonResult(devices, `找到 ${(devices as unknown[])?.length || 0} 台设备`);
      } catch (err) {
        return textResult(`查询数据中心设备失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'workflow.list',
    title: '查询工作流列表',
    description: '查询所有工作流定义，包含步骤、触发器、状态。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      status: z.enum(['active', 'inactive', 'draft']).optional().describe('工作流状态'),
      limit: z.number().min(1).max(50).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT id, name, description, status, trigger_type, created_at, updated_at FROM workflows WHERE 1=1';
        const params: unknown[] = [];
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        query += ` LIMIT ${args.limit || 20}`;
        const workflows = db.prepare(query).all(...params);
        return jsonResult(workflows, `找到 ${workflows.length} 个工作流`);
      } catch (err) {
        return textResult(`查询工作流失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'workflow.task.list',
    title: '查询任务列表',
    description: '查询任务中心的任务列表，包含执行状态、主机、耗时。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      status: z.enum(['pending', 'running', 'success', 'failed']).optional().describe('任务状态'),
      hostId: z.string().optional().describe('主机 ID'),
      limit: z.number().min(1).max(100).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params: unknown[] = [];
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        if (args.hostId) { query += ' AND host_id = ?'; params.push(args.hostId); }
        query += ' ORDER BY created_at DESC';
        query += ` LIMIT ${args.limit || 20}`;
        const tasks = db.prepare(query).all(...params);
        return jsonResult(tasks, `找到 ${tasks.length} 个任务`);
      } catch (err) {
        return textResult(`查询任务失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'database.list',
    title: '查询数据库列表',
    description: '查询管理的数据库实例列表，包含类型、版本、连接信息。',
    domain: 'database_operation',
    annotations: READONLY,
    inputSchema: z.object({
      dbType: z.string().optional().describe('数据库类型（mysql/postgresql/redis等）'),
      limit: z.number().min(1).max(50).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT id, name, db_type, host, port, status, version FROM databases WHERE 1=1';
        const params: unknown[] = [];
        if (args.dbType) { query += ' AND db_type = ?'; params.push(args.dbType); }
        query += ` LIMIT ${args.limit || 20}`;
        const databases = db.prepare(query).all(...params);
        return jsonResult(databases, `找到 ${(databases as unknown[])?.length || 0} 个数据库`);
      } catch (err) {
        return textResult(`查询数据库失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'infra.script.list',
    title: '查询脚本列表',
    description: '查询运维脚本库，包含脚本名称、类型、执行环境。',
    domain: 'document_generation',
    annotations: READONLY,
    inputSchema: z.object({
      scriptType: z.string().optional().describe('脚本类型（shell/python/ansible等）'),
      search: z.string().optional().describe('按名称搜索'),
      limit: z.number().min(1).max(50).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT id, name, description, script_type, language, enabled FROM scripts WHERE 1=1';
        const params: unknown[] = [];
        if (args.scriptType) { query += ' AND script_type = ?'; params.push(args.scriptType); }
        if (args.search) { query += ' AND name LIKE ?'; params.push(`%${args.search}%`); }
        query += ` LIMIT ${args.limit || 20}`;
        const scripts = db.prepare(query).all(...params);
        return jsonResult(scripts, `找到 ${(scripts as unknown[])?.length || 0} 个脚本`);
      } catch (err) {
        return textResult(`查询脚本失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'infra.backup.list',
    title: '查询备份记录',
    description: '查询配置和数据备份记录，包含备份类型、时间、大小。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      backupType: z.string().optional().describe('备份类型'),
      limit: z.number().min(1).max(50).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM backups WHERE 1=1';
        const params: unknown[] = [];
        if (args.backupType) { query += ' AND backup_type = ?'; params.push(args.backupType); }
        query += ' ORDER BY created_at DESC';
        query += ` LIMIT ${args.limit || 20}`;
        const backups = db.prepare(query).all(...params);
        return jsonResult(backups, `找到 ${backups.length} 条备份记录`);
      } catch (err) {
        return textResult(`查询备份失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'auth.user.list',
    title: '查询用户列表',
    description: '查询系统用户列表（只读），包含用户名、角色、状态。',
    domain: 'compliance_check',
    annotations: READONLY,
    inputSchema: z.object({
      role: z.string().optional().describe('角色过滤'),
      status: z.enum(['active', 'disabled']).optional().describe('用户状态'),
      limit: z.number().min(1).max(50).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT id, username, display_name, role, email, status, created_at FROM users WHERE 1=1';
        const params: unknown[] = [];
        if (args.role) { query += ' AND role = ?'; params.push(args.role); }
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        query += ` LIMIT ${args.limit || 20}`;
        const users = db.prepare(query).all(...params);
        return jsonResult(users, `找到 ${users.length} 个用户`);
      } catch (err) {
        return textResult(`查询用户失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'database.info',
    title: '数据库信息统计',
    description: '获取数据库统计信息（服务器数/告警数/用户数）',
    domain: 'database',
    inputSchema: z.object({}),
    annotations: READONLY,
    handler: async (_args, _ctx) => {
      try {
        const serverCount = (db.prepare('SELECT COUNT(*) as count FROM servers').get() as CountResult).count;
        const alertCount = (db.prepare('SELECT COUNT(*) as count FROM alerts').get() as CountResult).count;
        const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as CountResult).count;
        return jsonResult(
          { serverCount, alertCount, userCount },
          `数据库信息统计:\n- 服务器数量: ${serverCount}\n- 告警数量: ${alertCount}\n- 用户数量: ${userCount}`
        );
      } catch (err) {
        return textResult(`获取数据库统计失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];
