# 网络设备巡检功能 - 开发文档

> 版本：v3.0 | 日期：2026-05-28 | 状态：Phase 1 已完成 | 方案：混合巡检

---

## 1. 功能概述

在现有 ITOps Agent Platform 的服务器巡检基础上，新增**网络设备（路由器/交换机/防火墙）巡检能力**。采用**混合巡检方案**：标准巡检项使用预定义模板保证可靠性，自定义巡检项通过 RAG 知识库实现灵活性。

### 1.1 核心价值

| 维度 | 说明 |
|------|------|
| **核心巡检 100% 可靠** | CPU/内存/接口/版本等高频指标使用固定命令模板，不会出错 |
| **响应速度快** | 标准巡检无需 RAG 检索，直接执行命令，1-2 秒出结果 |
| **灵活性强** | 用户自定义需求通过 RAG + AI 实现，覆盖长尾场景 |
| **复用现有能力** | SSH 连接池、QAnything 知识库、Agent 执行框架均可复用 |
| **可扩展** | 巡检结果可联动告警、修复策略、定时任务等现有模块 |

### 1.2 混合巡检架构

```
巡检任务发起
      │
      ▼
─────────────────────────────────────┐
│         巡检任务解析                 │
│  识别：厂商、巡检类型（标准/自定义）  │
└────────────────────────────────────┘
             │
      ┌────────────┐
      ▼              ▼
──────────┐   ┌────────────┐
│ 标准巡检  │   │ 自定义巡检  │
│（模板驱动）│   │（RAG 驱动） │
│           │   │            │
│ CPU/内存  │   │ "帮我检查  │
│ 接口状态  │   │ BGP 邻居   │
│ 版本信息  │   │ 为什么断开"│
│ 路由表    │   │            │
│ 日志检查  │   │ "检查 ACL  │
│           │   │ 配置合规"  │
└────┬──────┘   └─────┬──────┘
     │                │
     ▼                ▼
─────────────────────────────────────┐
│         SSH 执行命令                 │
│  标准巡检：预定义命令直接执行         │
│  自定义巡检：RAG 检索 → AI 生成命令   │
────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│         结果解析与报告               │
│  标准巡检：正则解析 → 结构化评分      │
│  自定义巡检：AI 分析 → 建议           │
└─────────────────────────────────────┘
```

### 1.3 支持范围

| 协议 | 优先级 | 说明 |
|------|--------|------|
| SSH CLI | P0 | 复用现有 sshService，通过命令行采集 |
| SNMP v2c/v3 | P1 | 后续扩展，通过 OID 采集性能数据 |
| NETCONF | P2 | 远期规划，结构化配置管理 |

| 厂商 | 优先级 | 说明 |
|------|--------|------|
| 华为 (Huawei) | P0 | 国内主流，命令：display/system-view |
| H3C | P0 | 命令风格类似华为 |
| Cisco | P0 | 国际主流，命令：show |
| 锐捷 (Ruijie) | P1 | 命令类似 Cisco |
| 中兴 (ZTE) | P1 | 命令风格类似华为 |
| Juniper | P2 | NETCONF 支持较好 |

---

## 2. 整体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      ITOps Agent Platform                    │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ 前端页面  │    │ 巡检引擎     │    │ QAnything 知识库  │   │
│  │ 网络设备  │───▶│ 混合巡检     │◀──▶│ (仅自定义巡检调用) │   │
│  │ 管理     │    │              │    │                  │   │
│  └────┬─────┘    ──────┬───────┘    ─────────────────┘   │
│       │                 │                                     │
│       │  巡检请求        │  标准巡检：模板命令                 │
│       ▼                 │  自定义巡检：RAG 检索 → AI 生成      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SSH 连接池 (复用 sshService.ts)           │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │
│  │  │ 华为设备 │  │ H3C设备 │  │ Cisco   │  │ 防火墙  │  │   │
│  │  │ 192.168 │  │ 192.168 │  │ 192.168 │  │ 192.168 │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    SQLite 数据库                       │   │
│  │  network_devices  │  inspection_history  │  metrics   │   │
│  └──────────────────────────────────────────────────────┘   │
─────────────────────────────────────────────────────────────┘
```

### 2.2 巡检类型对比

| 维度 | 标准巡检 | 自定义巡检 |
|------|---------|-----------|
| 触发方式 | 用户点击"一键巡检" | 用户输入自然语言描述 |
| 命令来源 | 预定义模板（代码中） | RAG 检索 + AI 生成 |
| 响应速度 | 快（1-2 秒） | 中（3-5 秒，含 RAG 检索） |
| 可靠性 | 高（命令固定） | 中（AI 可能生成不准确） |
| 结果格式 | 结构化（数值/状态） | 文本（AI 分析） |
| 适用场景 | CPU/内存/接口/版本等 | BGP/ACL/安全策略等 |
| RAG 调用 | 否 | 是 |

---

## 3. 数据库设计

### 3.1 network_devices 表

```sql
CREATE TABLE IF NOT EXISTS network_devices (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,                     -- 设备名称（如：核心交换机-01）
  hostname TEXT NOT NULL,                 -- IP 或域名
  port INTEGER DEFAULT 22,                -- SSH 端口
  username TEXT NOT NULL,                 -- 登录用户名
  password TEXT,                          -- 密码（加密存储）
  private_key TEXT,                       -- SSH 私钥（加密存储）
  use_ssh_key INTEGER DEFAULT 0,          -- 1=密钥登录 0=密码登录
  
  -- 设备分类
  device_type TEXT NOT NULL,              -- router / switch / firewall / ap / other
  vendor TEXT NOT NULL,                   -- huawei / h3c / cisco / ruijie / zte / juniper / other
  
  -- 设备识别（自动采集）
  model TEXT,                             -- 设备型号（如：S5735-L48T4X-A）
  serial_number TEXT,                     -- 序列号
  os_version TEXT,                        -- 系统版本（如：VRP 5.170）
  uptime_seconds INTEGER,                 -- 运行时间（秒）
  
  -- 性能指标（最近一次巡检结果）
  cpu_usage REAL,                         -- CPU 利用率 %
  memory_usage REAL,                      -- 内存利用率 %
  
  -- 接口信息（JSON 格式）
  interfaces TEXT,                        -- [{name, status, speed, description, ...}]
  
  -- 巡检状态
  last_inspected_at DATETIME,             -- 最后巡检时间
  inspection_status TEXT,                 -- healthy / warning / critical / unknown
  
  -- 分组与标签
  group_id TEXT,                          -- 所属分组（关联 server_groups 或新建 network_groups）
  tags TEXT,                              -- JSON 数组 ["core", "production"]
  description TEXT,                       -- 设备描述
  
  enabled INTEGER DEFAULT 1,              -- 是否启用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_network_devices_enabled ON network_devices(enabled);
CREATE INDEX IF NOT EXISTS idx_network_devices_vendor ON network_devices(vendor);
CREATE INDEX IF NOT EXISTS idx_network_devices_group ON network_devices(group_id);
```

### 3.2 network_inspection_history 表

```sql
CREATE TABLE IF NOT EXISTS network_inspection_history (
  id TEXT PRIMARY KEY,                    -- UUID
  device_id TEXT NOT NULL,                -- 关联设备
  
  inspection_type TEXT NOT NULL,          -- standard（标准巡检）/ custom（自定义巡检）/ full（全面巡检）
  status TEXT NOT NULL,                   -- success / failed / partial
  summary TEXT,                           -- 巡检摘要（AI 生成的简要结论）
  details TEXT,                           -- 详细结果 JSON
  
  -- 巡检明细
  items TEXT,                             -- 巡检项列表 JSON [{type, status, value, threshold, details}]
  
  -- 执行信息
  commands_executed INTEGER DEFAULT 0,    -- 执行的命令数量
  execution_time_ms INTEGER,              -- 总耗时（毫秒）
  executed_by TEXT,                       -- 执行人/触发方式（manual / scheduled / agent）
  
  -- 自定义巡检专用
  user_query TEXT,                        -- 用户原始查询（仅自定义巡检）
  rag_used INTEGER DEFAULT 0,             -- 是否使用了 RAG（1=是 0=否）
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (device_id) REFERENCES network_devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inspection_history_device ON network_inspection_history(device_id);
CREATE INDEX IF NOT EXISTS idx_inspection_history_created ON network_inspection_history(created_at);
CREATE INDEX IF NOT EXISTS idx_inspection_history_type ON network_inspection_history(inspection_type);
```

### 3.3 巡检项结果结构

```typescript
interface InspectionItem {
  type: string;           // 'cpu' | 'memory' | 'interface' | 'version' | 'routes' | 'custom'
  name: string;           // 巡检项名称（如 "CPU 利用率"）
  status: 'ok' | 'warning' | 'critical' | 'unknown';
  value: string | number; // CPU: 45, 内存: "85%", 接口: "UP"
  threshold?: number;     // 阈值（如 CPU 80%）
  details?: string;       // 原始输出或 AI 分析
  suggestion?: string;    // 建议（仅自定义巡检）
}
```

---

## 4. 后端设计

### 4.1 目录结构

```
backend/src/
├── services/
│   ├── networkDeviceService.ts       # 网络设备 CRUD
│   ├── networkInspectionService.ts   # 巡检执行引擎（核心）
│   ├── vendorAdapter.ts              # 厂商命令模板 + 解析器
│   ├── networkCommandGenerator.ts    # 自定义巡检：RAG + AI 生成命令
│   └── networkResultParser.ts        # 巡检结果解析器
├── routes/
│   └── networkDeviceRoutes.ts        # API 路由
├── models/
│   └── migrations.ts                 # 新增网络表迁移
└── middleware/
    └── validation.ts                 # 新增网络设备的校验规则
```

### 4.2 核心服务

#### 4.2.1 vendorAdapter.ts - 厂商命令模板

```typescript
// backend/src/services/vendorAdapter.ts

import { logger } from '../utils/logger';

// 巡检项定义
export type InspectionItemType = 
  | 'cpu' | 'memory' | 'interface' | 'version' 
  | 'routes' | 'log' | 'custom';

// 单个巡检项模板
interface InspectionTemplate {
  command: string;                    // 执行的命令
  parser: string;                     // 解析器函数名
  threshold?: { warning: number; critical: number }; // 阈值
}

// 厂商适配接口
interface VendorAdapter {
  vendor: string;
  templates: Record<InspectionItemType, InspectionTemplate>;
  paginationCommand: string;          // 关闭分页的命令
  getCommand(type: InspectionItemType): string;
}

// 华为 VRP 适配器
export class HuaweiAdapter implements VendorAdapter {
  vendor = 'huawei';
  
  templates = {
    cpu: { 
      command: 'display cpu-usage', 
      parser: 'parseHuaweiCpu',
      threshold: { warning: 70, critical: 90 }
    },
    memory: { 
      command: 'display memory-usage', 
      parser: 'parseHuaweiMemory',
      threshold: { warning: 80, critical: 95 }
    },
    interface: { 
      command: 'display interface brief', 
      parser: 'parseInterfaceBrief' 
    },
    version: { 
      command: 'display version', 
      parser: 'parseVersion' 
    },
    routes: { 
      command: 'display ip routing-table', 
      parser: 'parseRoutes' 
    },
    log: { 
      command: 'display logbuffer', 
      parser: 'parseLogBuffer' 
    },
    custom: { 
      command: '', 
      parser: 'parseCustom' 
    }
  };
  
  paginationCommand = 'screen-length 0 temporary';
  
  getCommand(type: InspectionItemType): string {
    return this.templates[type]?.command || '';
  }
}

// Cisco IOS 适配器
export class CiscoAdapter implements VendorAdapter {
  vendor = 'cisco';
  
  templates = {
    cpu: { 
      command: 'show processes cpu | include CPU utilization', 
      parser: 'parseCiscoCpu',
      threshold: { warning: 70, critical: 90 }
    },
    memory: { 
      command: 'show memory statistics', 
      parser: 'parseCiscoMemory',
      threshold: { warning: 80, critical: 95 }
    },
    interface: { 
      command: 'show interfaces status', 
      parser: 'parseInterfaceBrief' 
    },
    version: { 
      command: 'show version', 
      parser: 'parseVersion' 
    },
    routes: { 
      command: 'show ip route summary', 
      parser: 'parseRoutes' 
    },
    log: { 
      command: 'show logging | include %', 
      parser: 'parseLogBuffer' 
    },
    custom: { 
      command: '', 
      parser: 'parseCustom' 
    }
  };
  
  paginationCommand = 'terminal length 0';
  
  getCommand(type: InspectionItemType): string {
    return this.templates[type]?.command || '';
  }
}

// H3C Comware 适配器（命令类似华为）
export class H3cAdapter implements VendorAdapter {
  vendor = 'h3c';
  
  templates = {
    cpu: { 
      command: 'display cpu-usage', 
      parser: 'parseHuaweiCpu',
      threshold: { warning: 70, critical: 90 }
    },
    memory: { 
      command: 'display memory', 
      parser: 'parseH3cMemory',
      threshold: { warning: 80, critical: 95 }
    },
    interface: { 
      command: 'display interface brief', 
      parser: 'parseInterfaceBrief' 
    },
    version: { 
      command: 'display version', 
      parser: 'parseVersion' 
    },
    routes: { 
      command: 'display ip routing-table', 
      parser: 'parseRoutes' 
    },
    log: { 
      command: 'display logbuffer', 
      parser: 'parseLogBuffer' 
    },
    custom: { 
      command: '', 
      parser: 'parseCustom' 
    }
  };
  
  paginationCommand = 'screen-length disable';
  
  getCommand(type: InspectionItemType): string {
    return this.templates[type]?.command || '';
  }
}

// 锐捷适配器（命令类似 Cisco）
export class RuijieAdapter implements VendorAdapter {
  vendor = 'ruijie';
  // 命令与 Cisco 类似，可复用 Cisco 模板
  
  templates = {
    cpu: { 
      command: 'show processes cpu | include CPU utilization', 
      parser: 'parseCiscoCpu',
      threshold: { warning: 70, critical: 90 }
    },
    memory: { 
      command: 'show memory statistics', 
      parser: 'parseCiscoMemory',
      threshold: { warning: 80, critical: 95 }
    },
    interface: { 
      command: 'show interfaces status', 
      parser: 'parseInterfaceBrief' 
    },
    version: { 
      command: 'show version', 
      parser: 'parseVersion' 
    },
    routes: { 
      command: 'show ip route summary', 
      parser: 'parseRoutes' 
    },
    log: { 
      command: 'show logging', 
      parser: 'parseLogBuffer' 
    },
    custom: { 
      command: '', 
      parser: 'parseCustom' 
    }
  };
  
  paginationCommand = 'terminal length 0';
  
  getCommand(type: InspectionItemType): string {
    return this.templates[type]?.command || '';
  }
}

// 中兴适配器（命令类似华为）
export class ZteAdapter implements VendorAdapter {
  vendor = 'zte';
  // 命令与华为类似，可复用华为模板
  
  templates = {
    cpu: { 
      command: 'show cpu', 
      parser: 'parseHuaweiCpu',
      threshold: { warning: 70, critical: 90 }
    },
    memory: { 
      command: 'show memory', 
      parser: 'parseH3cMemory',
      threshold: { warning: 80, critical: 95 }
    },
    interface: { 
      command: 'show interface brief', 
      parser: 'parseInterfaceBrief' 
    },
    version: { 
      command: 'show version', 
      parser: 'parseVersion' 
    },
    routes: { 
      command: 'show ip route', 
      parser: 'parseRoutes' 
    },
    log: { 
      command: 'show log', 
      parser: 'parseLogBuffer' 
    },
    custom: { 
      command: '', 
      parser: 'parseCustom' 
    }
  };
  
  paginationCommand = 'terminal length 0';
  
  getCommand(type: InspectionItemType): string {
    return this.templates[type]?.command || '';
  }
}

// 适配器工厂
export function getVendorAdapter(vendor: string): VendorAdapter {
  const adapters: Record<string, VendorAdapter> = {
    huawei: new HuaweiAdapter(),
    cisco: new CiscoAdapter(),
    h3c: new H3cAdapter(),
    ruijie: new RuijieAdapter(),
    zte: new ZteAdapter(),
  };
  
  return adapters[vendor.toLowerCase()] || new HuaweiAdapter(); // 默认华为
}

// 获取所有支持的厂商
export function getSupportedVendors(): string[] {
  return ['huawei', 'cisco', 'h3c', 'ruijie', 'zte'];
}
```

#### 4.2.2 networkResultParser.ts - 结果解析器

```typescript
// backend/src/services/networkResultParser.ts

import { logger } from '../utils/logger';

export interface ParsedResult {
  value: string | number;
  status: 'ok' | 'warning' | 'critical' | 'unknown';
  details?: string;
}

// 华为 CPU 解析
export function parseHuaweiCpu(output: string): ParsedResult {
  // 示例输出：CPU usage: 45% in last 5 minutes
  const match = output.match(/CPU usage[:\s]+(\d+)%/i);
  if (!match) {
    return { value: 0, status: 'unknown', details: '无法解析 CPU 数据' };
  }
  
  const cpuUsage = parseInt(match[1], 10);
  
  return {
    value: cpuUsage,
    status: cpuUsage >= 90 ? 'critical' : cpuUsage >= 70 ? 'warning' : 'ok',
    details: `CPU 利用率: ${cpuUsage}%`
  };
}

// Cisco CPU 解析
export function parseCiscoCpu(output: string): ParsedResult {
  // 示例输出：CPU utilization for five seconds: 45%/0%; one minute: 42%; five minutes: 40%
  const match = output.match(/five seconds[:\s]+(\d+)%/i);
  if (!match) {
    return { value: 0, status: 'unknown', details: '无法解析 CPU 数据' };
  }
  
  const cpuUsage = parseInt(match[1], 10);
  
  return {
    value: cpuUsage,
    status: cpuUsage >= 90 ? 'critical' : cpuUsage >= 70 ? 'warning' : 'ok',
    details: `CPU 利用率: ${cpuUsage}%`
  };
}

// 华为内存解析
export function parseHuaweiMemory(output: string): ParsedResult {
  // 示例输出：Memory Utilization: 52%
  const match = output.match(/Memory Utilization[:\s]+(\d+)%/i);
  if (!match) {
    return { value: 0, status: 'unknown', details: '无法解析内存数据' };
  }
  
  const memUsage = parseInt(match[1], 10);
  
  return {
    value: memUsage,
    status: memUsage >= 95 ? 'critical' : memUsage >= 80 ? 'warning' : 'ok',
    details: `内存利用率: ${memUsage}%`
  };
}

// Cisco 内存解析
export function parseCiscoMemory(output: string): ParsedResult {
  // 示例输出：Processor Pool Total: 1048576, Used: 524288, Free: 524288
  const totalMatch = output.match(/Total[:\s]+(\d+)/i);
  const usedMatch = output.match(/Used[:\s]+(\d+)/i);
  
  if (!totalMatch || !usedMatch) {
    return { value: 0, status: 'unknown', details: '无法解析内存数据' };
  }
  
  const total = parseInt(totalMatch[1], 10);
  const used = parseInt(usedMatch[1], 10);
  const usage = Math.round((used / total) * 100);
  
  return {
    value: usage,
    status: usage >= 95 ? 'critical' : usage >= 80 ? 'warning' : 'ok',
    details: `内存利用率: ${usage}% (${used}/${total} KB)`
  };
}

// H3C 内存解析
export function parseH3cMemory(output: string): ParsedResult {
  // 示例输出：Memory: Total 1048576KB, Used 524288KB, Free 524288KB
  const totalMatch = output.match(/Total[:\s]+(\d+)/i);
  const usedMatch = output.match(/Used[:\s]+(\d+)/i);
  
  if (!totalMatch || !usedMatch) {
    return parseHuaweiMemory(output); // 回退到华为格式
  }
  
  const total = parseInt(totalMatch[1], 10);
  const used = parseInt(usedMatch[1], 10);
  const usage = Math.round((used / total) * 100);
  
  return {
    value: usage,
    status: usage >= 95 ? 'critical' : usage >= 80 ? 'warning' : 'ok',
    details: `内存利用率: ${usage}%`
  };
}

// 接口状态解析（通用）
export function parseInterfaceBrief(output: string): ParsedResult {
  // 解析接口列表
  const lines = output.split('\n').filter(line => line.trim());
  const interfaces: Array<{ name: string; status: string; protocol: string }> = [];
  
  for (const line of lines) {
    // 华为/H3C: Interface              PHY Protocol Description
    // Cisco:   Gi0/1                    connected    a-full    a-100    1000BASE-T
    const match = line.match(/^(\S+)\s+(up|down|connected|administratively down)\s+(up|down)/i);
    if (match) {
      interfaces.push({
        name: match[1],
        status: match[2].toLowerCase(),
        protocol: match[3].toLowerCase()
      });
    }
  }
  
  const total = interfaces.length;
  const upCount = interfaces.filter(i => i.status.includes('up') || i.status === 'connected').length;
  const downCount = total - upCount;
  
  return {
    value: `${upCount}/${total}`,
    status: downCount > 5 ? 'critical' : downCount > 0 ? 'warning' : 'ok',
    details: JSON.stringify({ total, up: upCount, down: downCount, interfaces })
  };
}

// 版本信息解析（通用）
export function parseVersion(output: string): ParsedResult {
  // 提取版本号和运行时间
  const versionMatch = output.match(/VRP[\s\(]+(\S+)/i) || output.match(/Version[\s:]+(\S+)/i);
  const uptimeMatch = output.match(/uptime is (\d+)/i);
  
  return {
    value: versionMatch?.[1] || 'unknown',
    status: 'ok',
    details: JSON.stringify({
      version: versionMatch?.[1] || 'unknown',
      uptime: uptimeMatch?.[1] || 'unknown'
    })
  };
}

// 路由表解析（通用）
export function parseRoutes(output: string): ParsedResult {
  // 统计路由数量
  const totalMatch = output.match(/Total[:\s]+(\d+)/i) || output.match(/(\d+)\s+routes/i);
  
  return {
    value: totalMatch?.[1] || '0',
    status: 'ok',
    details: `路由表条目: ${totalMatch?.[1] || '0'} 条`
  };
}

// 日志解析（通用）
export function parseLogBuffer(output: string): ParsedResult {
  // 统计错误日志数量
  const errorLines = output.split('\n').filter(line => 
    line.includes('%SYS-3') || line.includes('%LINK-3') || line.includes('%LINEPROTO-5')
  );
  
  return {
    value: errorLines.length,
    status: errorLines.length > 10 ? 'critical' : errorLines.length > 0 ? 'warning' : 'ok',
    details: `最近错误日志: ${errorLines.length} 条`
  };
}

// 自定义巡检解析（由 AI 处理）
export function parseCustom(output: string, aiAnalysis?: string): ParsedResult {
  return {
    value: output.substring(0, 500),
    status: 'unknown',
    details: aiAnalysis || output
  };
}

// 解析器工厂
export function getParser(parserName: string): (output: string, aiAnalysis?: string) => ParsedResult {
  const parsers: Record<string, (output: string, aiAnalysis?: string) => ParsedResult> = {
    parseHuaweiCpu,
    parseCiscoCpu,
    parseHuaweiMemory,
    parseCiscoMemory,
    parseH3cMemory,
    parseInterfaceBrief,
    parseVersion,
    parseRoutes,
    parseLogBuffer,
    parseCustom
  };
  
  return parsers[parserName] || parseCustom;
}
```

#### 4.2.3 networkInspectionService.ts - 巡检引擎

```typescript
// backend/src/services/networkInspectionService.ts

import db from '../models/database';
import { sshPool } from './sshService';
import { getVendorAdapter, InspectionItemType, getSupportedVendors } from './vendorAdapter';
import { getParser, ParsedResult } from './networkResultParser';
import { networkCommandGenerator } from './networkCommandGenerator';
import { logger } from '../utils/logger';
import { Client } from 'ssh2';
import { v4 as uuidv4 } from 'uuid';

interface InspectionOptions {
  type: 'standard' | 'custom' | 'full';
  items?: InspectionItemType[];       // 标准巡检：指定巡检项
  userQuery?: string;                 // 自定义巡检：用户自然语言描述
}

interface InspectionItemResult {
  type: string;
  name: string;
  status: 'ok' | 'warning' | 'critical' | 'unknown';
  value: string | number;
  threshold?: number;
  details?: string;
  suggestion?: string;
  command?: string;                   // 执行的命令（便于调试）
}

interface InspectionResult {
  success: boolean;
  error?: string;
  deviceId: string;
  inspectionType: string;
  items: InspectionItemResult[];
  overall: 'healthy' | 'warning' | 'critical';
  executionTimeMs: number;
  commandsExecuted: number;
  summary: string;
}

class NetworkInspectionService {
  // 标准巡检项名称映射
  private readonly itemNames: Record<InspectionItemType, string> = {
    cpu: 'CPU 利用率',
    memory: '内存利用率',
    interface: '接口状态',
    version: '版本信息',
    routes: '路由表',
    log: '系统日志',
    custom: '自定义检查'
  };

  /**
   * 执行标准巡检（模板驱动）
   */
  private async executeStandardInspection(
    device: any,
    adapter: any,
    items: InspectionItemType[]
  ): Promise<InspectionItemResult[]> {
    const results: InspectionItemResult[] = [];
    
    for (const item of items) {
      try {
        const command = adapter.getCommand(item);
        if (!command) {
          logger.warn(`No command template for ${item} on ${device.vendor}`);
          continue;
        }
        
        logger.info(`Executing: ${command}`);
        const output = await this.executeCommand(device, command);
        
        const parser = getParser(adapter.templates[item].parser);
        const parsed = parser(output);
        
        results.push({
          type: item,
          name: this.itemNames[item],
          status: parsed.status,
          value: parsed.value,
          threshold: adapter.templates[item].threshold?.critical,
          details: parsed.details,
          command
        });
      } catch (error: any) {
        logger.error(`Failed to inspect ${item}:`, error);
        results.push({
          type: item,
          name: this.itemNames[item],
          status: 'unknown',
          value: 0,
          details: `巡检失败: ${error.message}`,
          command: adapter.getCommand(item)
        });
      }
    }
    
    return results;
  }

  /**
   * 执行自定义巡检（RAG 驱动）
   */
  private async executeCustomInspection(
    device: any,
    userQuery: string
  ): Promise<InspectionItemResult[]> {
    try {
      // 1. 通过 RAG + AI 生成巡检命令
      const commands = await networkCommandGenerator.generateCommands(
        device,
        userQuery
      );
      
      const results: InspectionItemResult[] = [];
      
      for (const cmd of commands) {
        try {
          logger.info(`Executing custom command: ${cmd.command}`);
          const output = await this.executeCommand(device, cmd.command);
          
          // 2. AI 分析结果
          const analysis = await networkCommandGenerator.analyzeResult(
            device,
            userQuery,
            cmd.command,
            output
          );
          
          results.push({
            type: 'custom',
            name: cmd.name || '自定义检查',
            status: analysis.status || 'unknown',
            value: output.substring(0, 200),
            details: analysis.details || output,
            suggestion: analysis.suggestion,
            command: cmd.command
          });
        } catch (error: any) {
          logger.error(`Failed custom inspection:`, error);
          results.push({
            type: 'custom',
            name: cmd.name || '自定义检查',
            status: 'unknown',
            value: 0,
            details: `巡检失败: ${error.message}`,
            command: cmd.command
          });
        }
      }
      
      return results;
    } catch (error: any) {
      logger.error('Custom inspection failed:', error);
      return [{
        type: 'custom',
        name: '自定义检查',
        status: 'unknown',
        value: 0,
        details: `RAG 巡检失败: ${error.message}`
      }];
    }
  }

  /**
   * 执行 SSH 命令
   */
  private async executeCommand(device: any, command: string): Promise<string> {
    let conn: Client | null = null;
    
    try {
      conn = await sshPool.acquire(device.id);
      const adapter = getVendorAdapter(device.vendor);
      
      // 先发送关闭分页命令
      await this.sendCommand(conn, adapter.paginationCommand);
      
      // 执行实际命令
      const output = await this.sendCommand(conn, command);
      
      sshPool.release(conn, true);
      return output;
    } catch (error) {
      if (conn) {
        sshPool.release(conn, false);
      }
      throw error;
    }
  }

  /**
   * 发送命令并获取输出
   */
  private sendCommand(conn: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      conn.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        
        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString('utf-8');
        });
        
        stream.on('close', (code: number) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });
        
        stream.on('error', reject);
      });
    });
  }

  /**
   * 执行巡检（入口方法）
   */
  async inspectDevice(
    deviceId: string,
    options: InspectionOptions
  ): Promise<InspectionResult> {
    const startTime = Date.now();
    
    // 1. 获取设备信息
    const device = db.prepare(
      'SELECT * FROM network_devices WHERE id = ? AND enabled = 1'
    ).get(deviceId) as any;
    
    if (!device) {
      return {
        success: false,
        error: '设备不存在或未启用',
        deviceId,
        inspectionType: options.type,
        items: [],
        overall: 'critical',
        executionTimeMs: 0,
        commandsExecuted: 0,
        summary: '设备不存在'
      };
    }
    
    const adapter = getVendorAdapter(device.vendor);
    let items: InspectionItemResult[] = [];
    
    // 2. 根据巡检类型执行
    if (options.type === 'standard') {
      // 标准巡检：使用模板
      const defaultItems: InspectionItemType[] = ['cpu', 'memory', 'interface', 'version'];
      const inspectItems = options.items || defaultItems;
      items = await this.executeStandardInspection(device, adapter, inspectItems);
    } else if (options.type === 'custom') {
      // 自定义巡检：使用 RAG
      if (!options.userQuery) {
        return {
          success: false,
          error: '自定义巡检需要提供查询描述',
          deviceId,
          inspectionType: options.type,
          items: [],
          overall: 'critical',
          executionTimeMs: 0,
          commandsExecuted: 0,
          summary: '缺少查询描述'
        };
      }
      items = await this.executeCustomInspection(device, options.userQuery);
    } else if (options.type === 'full') {
      // 全面巡检：标准 + 常用项
      const fullItems: InspectionItemType[] = ['cpu', 'memory', 'interface', 'version', 'routes', 'log'];
      items = await this.executeStandardInspection(device, adapter, fullItems);
    }
    
    // 3. 计算总体状态
    const overall = this.calculateOverall(items);
    
    // 4. 生成摘要
    const summary = this.generateSummary(items, overall);
    
    // 5. 更新设备状态
    const criticalItems = items.filter(i => i.status === 'critical');
    const warningItems = items.filter(i => i.status === 'warning');
    
    db.prepare(`
      UPDATE network_devices 
      SET last_inspected_at = CURRENT_TIMESTAMP,
          inspection_status = ?,
          cpu_usage = ?,
          memory_usage = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      overall,
      items.find(i => i.type === 'cpu')?.value || null,
      items.find(i => i.type === 'memory')?.value || null,
      deviceId
    );
    
    // 6. 保存巡检历史
    const historyId = uuidv4();
    db.prepare(`
      INSERT INTO network_inspection_history 
      (id, device_id, inspection_type, status, summary, items, commands_executed, execution_time_ms, executed_by, user_query, rag_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      historyId,
      deviceId,
      options.type,
      items.some(i => i.status === 'unknown') ? 'partial' : 'success',
      summary,
      JSON.stringify(items),
      items.length,
      Date.now() - startTime,
      'manual',
      options.userQuery || null,
      options.type === 'custom' ? 1 : 0
    );
    
    return {
      success: true,
      deviceId,
      inspectionType: options.type,
      items,
      overall,
      executionTimeMs: Date.now() - startTime,
      commandsExecuted: items.length,
      summary
    };
  }

  /**
   * 批量巡检
   */
  async batchInspect(
    deviceIds: string[],
    options: InspectionOptions
  ): Promise<Array<{ deviceId: string; result: InspectionResult }>> {
    const results: Array<{ deviceId: string; result: InspectionResult }> = [];
    
    for (const deviceId of deviceIds) {
      try {
        const result = await this.inspectDevice(deviceId, options);
        results.push({ deviceId, result });
      } catch (error: any) {
        results.push({
          deviceId,
          result: {
            success: false,
            error: error.message,
            deviceId,
            inspectionType: options.type,
            items: [],
            overall: 'critical',
            executionTimeMs: 0,
            commandsExecuted: 0,
            summary: `巡检失败: ${error.message}`
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 获取巡检历史
   */
  getInspectionHistory(deviceId: string, limit: number = 10): any[] {
    return db.prepare(`
      SELECT * FROM network_inspection_history 
      WHERE device_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(deviceId, limit) as any[];
  }

  /**
   * 获取巡检详情
   */
  getInspectionDetail(historyId: string): any {
    return db.prepare(
      'SELECT * FROM network_inspection_history WHERE id = ?'
    ).get(historyId) as any;
  }

  /**
   * 计算总体状态
   */
  private calculateOverall(items: InspectionItemResult[]): 'healthy' | 'warning' | 'critical' {
    if (items.length === 0) return 'healthy';
    
    const hasCritical = items.some(i => i.status === 'critical');
    const hasWarning = items.some(i => i.status === 'warning');
    
    if (hasCritical) return 'critical';
    if (hasWarning) return 'warning';
    return 'healthy';
  }

  /**
   * 生成巡检摘要
   */
  private generateSummary(items: InspectionItemResult[], overall: string): string {
    const criticalCount = items.filter(i => i.status === 'critical').length;
    const warningCount = items.filter(i => i.status === 'warning').length;
    const okCount = items.filter(i => i.status === 'ok').length;
    
    if (overall === 'healthy') {
      return `巡检完成：${items.length} 项检查全部正常`;
    } else if (overall === 'warning') {
      return `巡检完成：${okCount} 项正常，${warningCount} 项警告，${criticalCount} 项严重`;
    } else {
      return `巡检完成：${okCount} 项正常，${warningCount} 项警告，${criticalCount} 项严重 - 需要立即处理`;
    }
  }
}

export const networkInspectionService = new NetworkInspectionService();
export default networkInspectionService;
```

#### 4.2.4 networkCommandGenerator.ts - 自定义巡检（RAG）

```typescript
// backend/src/services/networkCommandGenerator.ts

import { qanythingService } from './qanythingService';
import { llmService } from './llmService';
import { logger } from '../utils/logger';

interface GeneratedCommand {
  name: string;           // 命令名称/用途
  command: string;        // 实际执行的命令
}

interface AnalysisResult {
  status: 'ok' | 'warning' | 'critical' | 'unknown';
  details: string;        // 分析详情
  suggestion?: string;    // 处理建议
}

class NetworkCommandGenerator {
  /**
   * 通过 RAG + AI 生成巡检命令
   */
  async generateCommands(
    device: { vendor: string; model?: string; os_version?: string },
    userQuery: string
  ): Promise<GeneratedCommand[]> {
    try {
      // 1. 构建 RAG 查询
      const ragQuery = this.buildRagQuery(device, userQuery);
      
      // 2. 调用 RAG 检索
      let knowledgeContext = '';
      try {
        if (qanythingService.isEnabled()) {
          logger.info(`🔍 RAG query for custom inspection: ${ragQuery}`);
          knowledgeContext = await qanythingService.queryKnowledge(ragQuery, 5);
        }
      } catch (error) {
        logger.warn('RAG query failed, falling back to AI only:', error);
      }
      
      // 3. 调用 AI 生成命令
      const prompt = this.buildCommandPrompt(device, userQuery, knowledgeContext);
      const aiResponse = await llmService.callAPI(prompt, '网络巡检命令生成', 0.3);
      
      // 4. 解析 AI 响应
      const commands = this.parseAiResponse(aiResponse);
      
      if (commands.length === 0) {
        throw new Error('AI 未能生成有效的巡检命令');
      }
      
      logger.info(`Generated ${commands.length} commands for custom inspection`);
      return commands;
      
    } catch (error) {
      logger.error('Failed to generate commands:', error);
      throw error;
    }
  }

  /**
   * 构建 RAG 查询
   */
  private buildRagQuery(
    device: { vendor: string; model?: string },
    userQuery: string
  ): string {
    const vendor = device.vendor || '';
    const model = device.model || '';
    
    return `${vendor} ${model} ${userQuery} 命令 巡检 检查`;
  }

  /**
   * 构建命令生成 Prompt
   */
  private buildCommandPrompt(
    device: { vendor: string; model?: string },
    userQuery: string,
    knowledgeContext: string
  ): string {
    let prompt = `你是一个网络设备巡检专家。请根据以下信息生成巡检命令：

设备信息：
- 厂商：${device.vendor}
- 型号：${device.model || '未知'}

用户请求：${userQuery}

请生成 1-3 条巡检命令来检查用户请求的问题。

要求：
1. 只生成只读命令（display/show 类），禁止写操作
2. 每条命令必须能直接在该厂商设备上执行
3. 返回 JSON 格式：[{"name": "用途", "command": "命令"}]

不要解释，只返回 JSON。`;

    if (knowledgeContext) {
      prompt += `\n\n相关参考资料：\n${knowledgeContext}`;
    }

    return prompt;
  }

  /**
   * 解析 AI 响应
   */
  private parseAiResponse(response: string): GeneratedCommand[] {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // 如果解析失败，返回空数组
      logger.warn('Failed to parse AI response as JSON');
      return [];
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      return [];
    }
  }

  /**
   * 分析巡检结果
   */
  async analyzeResult(
    device: { vendor: string },
    userQuery: string,
    command: string,
    output: string
  ): Promise<AnalysisResult> {
    try {
      const prompt = `你是一个网络设备巡检专家。请分析以下巡检结果：

设备厂商：${device.vendor}
巡检请求：${userQuery}
执行命令：${command}

命令输出：
\`\`\`
${output.substring(0, 2000)}
\`\`\`

请分析：
1. 结果是否正常
2. 发现的问题（如果有）
3. 处理建议（如果有问题）

返回 JSON 格式：{"status": "ok|warning|critical|unknown", "details": "分析详情", "suggestion": "建议"}`;

      const aiResponse = await llmService.callAPI(prompt, '网络巡检结果分析', 0.3);
      
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        status: 'unknown',
        details: output.substring(0, 500),
        suggestion: '无法自动分析，请人工检查'
      };
    } catch (error) {
      logger.error('Failed to analyze result:', error);
      return {
        status: 'unknown',
        details: output.substring(0, 500),
        suggestion: `分析失败: ${error}`
      };
    }
  }
}

export const networkCommandGenerator = new NetworkCommandGenerator();
export default networkCommandGenerator;
```

### 4.3 SSH 连接适配

复用现有 `sshService.ts` 和 `sshPool`，不同厂商只需在命令执行前发送对应的关闭分页命令。

| 厂商 | 关闭分页命令 |
|------|-------------|
| 华为 | `screen-length 0 temporary` |
| H3C | `screen-length disable` |
| Cisco | `terminal length 0` |
| 锐捷 | `terminal length 0` |
| 中兴 | `terminal length 0` |

---

## 5. API 接口设计

### 5.1 设备管理

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | `/api/network-devices` | 获取设备列表 | query: vendor, device_type, group_id |
| GET | `/api/network-devices/:id` | 获取设备详情 | — |
| POST | `/api/network-devices` | 创建设备 | `{name, hostname, vendor, device_type, ...}` |
| PUT | `/api/network-devices/:id` | 更新设备 | `{name, description, tags, ...}` |
| DELETE | `/api/network-devices/:id` | 删除设备 | — |
| POST | `/api/network-devices/import` | 批量导入 | `{devices: [...], group_id}` |

### 5.2 巡检接口

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/api/network-devices/:id/inspect` | 单设备巡检 | `{type: 'standard'\|'custom'\|'full', items?: [], userQuery?: ''}` |
| POST | `/api/network-devices/batch-inspect` | 批量巡检 | `{device_ids: [...], type, items?, userQuery?}` |
| GET | `/api/network-devices/:id/inspection-history` | 巡检历史 | query: limit, offset |
| GET | `/api/network-devices/:id/inspection-history/:historyId` | 巡检详情 | — |

### 5.3 信息采集

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/network-devices/:id/collect-info` | 采集设备信息 |
| POST | `/api/network-devices/:id/test-connection` | 测试 SSH 连接 |
| GET | `/api/network-devices/vendors` | 获取支持的厂商列表 |

---

## 6. 前端设计

### 6.1 目录结构

```
frontend/src/
├── pages/
│   ├── NetworkDevices.tsx      # 网络设备管理主页面
│   └── NetworkDeviceDetail.tsx # 设备详情页（可选）
├── components/
│   ├── NetworkDeviceCard.tsx   # 设备卡片组件
│   ├── InspectionResult.tsx    # 巡检结果展示组件
│   ├── NetworkImportModal.tsx  # 批量导入弹窗
│   ├── InspectionHistory.tsx   # 巡检历史组件
│   └── CustomInspectionModal.tsx # 自定义巡检弹窗
├── hooks/
│   └── useNetworkDevices.ts    # 网络设备相关 hooks
└── lib/
    └── api.ts                  # 新增网络 API 调用
```

### 6.2 页面结构

```
┌────────────────────────────────────────────────────────
│  网络设备管理                                            │
│  管理和巡检您的网络设备（路由器/交换机/防火墙）             │
────────────────────────────────────────────────────────┤
│  [工具栏]                                                │
│  [新建设备] [批量导入] [标准巡检] [自定义巡检] [刷新]      │
├────────────────────────────────────────────────────────┤
│  [筛选] 厂商: [全部▼]  类型: [全部▼]  分组: [全部▼]        │
────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 核心交换机-01│  │ 汇聚路由器   │  │ 防火墙-01   │      │
│  │ 华为 S5735  │  │ Cisco 2960  │  │ 华为 USG6000│      │
│  │ 192.168.1.1 │  │ 192.168.1.2 │  │ 192.168.1.3 │      │
│  │             │  │             │  │             │      │
│  │ CPU: 45% ✅ │  │ CPU: 23% ✅ │  │ CPU: 67% ✅ │      │
│  │ MEM: 52% ✅ │  │ MEM: 38% ✅ │  │ MEM: 71% ✅ │      │
│  │             │  │             │  │             │      │
│  │ [一键巡检]   │  │ [一键巡检]   │  │ [一键巡检]   │      │
│  │ [执行命令]   │  │ [执行命令]   │  │ [执行命令]   │      │
│  │ [巡检历史]   │  │ [巡检历史]   │  │ [巡检历史]   │      │
│  └─────────────┘  └─────────────┘  └─────────────      │
────────────────────────────────────────────────────────
```

### 6.3 标准巡检结果弹窗

```
┌────────────────────────────────────────────────────────┐
│  巡检报告 - 核心交换机-01 (192.168.1.1)         [×]      │
├────────────────────────────────────────────────────────┤
│  巡检类型: 标准巡检        耗时: 2.3s                   │
│  巡检时间: 2026-05-26 14:30                             │
│                                                          │
│  ┌─ 总体评价 ─────────────────────────────────────┐    │
│  │  ✅ 设备运行正常，CPU/内存使用率正常               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 详细指标 ─────────────────────────────────────┐    │
│  │  ✅ CPU 利用率:    45%        (阈值: 90%)        │    │
│  │  ✅ 内存利用率:    52%        (阈值: 95%)        │    │
│  │  ✅ 接口状态:      48/52 UP                     │    │
│  │  ✅ 版本信息:      VRP 5.170                    │    │
│  ────────────────────────────────────────────────┘    │
│                                                          │
│  [关闭] [导出报告] [查看历史]                             │
└────────────────────────────────────────────────────────┘
```

### 6.4 自定义巡检弹窗

```
┌────────────────────────────────────────────────────────┐
│  自定义巡检 - 核心交换机-01 (192.168.1.1)       [×]      │
────────────────────────────────────────────────────────┤
│  请输入巡检需求：                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 检查 BGP 邻居状态，为什么有一个邻居 Down 了         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  巡检说明：                                               │
│  系统将自动从知识库检索相关命令，并分析巡检结果。           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  [取消]              [开始巡检]                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ── 巡检中 ──                                          │
│  🔍 正在检索知识库...                                   │
│  🤖 正在生成巡检命令...                                 │
│  📡 正在执行命令: display bgp peer...                   │
│  📊 正在分析结果...                                     │
│                                                          │
│  ── 巡检完成 ──                                        │
│  ⚠️  BGP 邻居 10.0.0.1 状态为 Down                      │
│  可能原因：对端设备重启或链路中断                         │
│  建议：检查物理链路和对端设备状态                         │
│                                                          │
│  [关闭] [再次巡检] [查看历史]                             │
└────────────────────────────────────────────────────────┘
```

### 6.5 路由配置

```tsx
// frontend/src/App.tsx
<Route path="/network-devices" element={<NetworkDevices />} />

// 侧边栏
{ icon: Router, label: '网络设备', path: '/network-devices' }
```

---

## 7. Agent 设计

### 7.1 网络巡检专家 Agent

```json
{
  "name": "网络巡检专家",
  "avatar": "",
  "role": "网络设备巡检与健康诊断专家",
  "system_prompt": "你是专业的网络设备巡检专家。\n\n标准巡检：使用预定义命令模板快速检查 CPU/内存/接口/版本等指标。\n自定义巡检：根据用户描述，从知识库检索相关命令，执行巡检并分析结果。\n\n支持厂商：华为、H3C、Cisco、锐捷、中兴",
  "model": "doubao-4o",
  "category": "网络巡检",
  "enabled": 1
}
```

### 7.2 RAG 调用策略

| 场景 | 是否调用 RAG | 说明 |
|------|-------------|------|
| 标准巡检 | 否 | 直接使用模板命令 |
| 自定义巡检 | 是 | RAG 检索 + AI 生成命令 |
| 全面巡检 | 否 | 使用扩展模板集 |

---

## 8. 安全设计

### 8.1 凭证安全

| 措施 | 说明 |
|------|------|
| 密码加密 | 复用现有 `cryptoService.ts` 的 AES-256-GCM 加密 |
| SSH 密钥 | 支持私钥文件上传，加密存储 |
| 权限控制 | 复用现有 RBAC，只有授权用户可操作网络设备 |
| 审计日志 | 所有巡检操作记录到 `audit_logs` |

### 8.2 命令安全

| 措施 | 说明 |
|------|------|
| 只读命令 | 标准巡检仅包含 `display/show` 类只读命令 |
| 人工确认 | 自定义巡检执行前显示生成的命令，用户确认 |
| 命令限制 | 自定义巡检 AI 生成时 Prompt 约束只生成只读命令 |

---

## 9. 开发计划

### Phase 1：核心基础 ✅ 已完成

| 任务 | 文件 | 说明 | 状态 |
|------|------|------|------|
| 数据库迁移 | `migrations.ts` | 创建 network_devices 和 inspection_history 表 | ✅ 已完成 |
| 厂商模板 | `vendorAdapter.ts` | 华为/Cisco/H3C/锐捷/中兴命令模板 | ✅ 已完成 |
| 结果解析 | `networkResultParser.ts` | 各厂商输出解析逻辑 | ✅ 已完成 |
| 巡检引擎 | `networkInspectionService.ts` | 标准/自定义/全面巡检逻辑 | ✅ 已完成 |
| RAG 命令生成 | `networkCommandGenerator.ts` | 自定义巡检 RAG + AI | ✅ 已完成 |
| 设备服务 | `networkDeviceService.ts` | CRUD + 连接测试 | ✅ 已完成 |
| API 路由 | `networkDeviceRoutes.ts` | 设备管理 + 巡检接口 | ✅ 已完成 |
| 路由注册 | `app.ts` | 注册 /api/network-devices 路由 | ✅ 已完成 |
| TypeScript 编译 | `npm run build` | 验证无编译错误 | ✅ 已完成 |

### Phase 2：巡检核心 ✅ 已完成

| 任务 | 文件 | 说明 | 状态 |
|------|------|------|------|
| 巡检 Agent | `initAgents.ts` | 注册网络巡检专家 Agent | ✅ 已完成 |
| 单元测试 | `vendorAdapter.test.ts` | 厂商模板测试（16/16通过） | ✅ 已完成 |
| 单元测试 | `networkResultParser.test.ts` | 解析器测试（23/23通过） | ✅ 已完成 |

### Phase 3：前端页面（2-3 天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 设备列表页 | `NetworkDevices.tsx` | 卡片列表 + 筛选 |
| 设备卡片 | `NetworkDeviceCard.tsx` | 设备信息展示 |
| 标准巡检结果 | `InspectionResult.tsx` | 结构化结果弹窗 |
| 自定义巡检 | `CustomInspectionModal.tsx` | 自然语言输入弹窗 |
| 路由 + 菜单 | `App.tsx` + `Sidebar.tsx` | 新增菜单入口 |

### Phase 4：增强功能（1-2 天）

| 任务 | 说明 |
|------|------|
| 批量巡检 | 多选设备批量执行 |
| 巡检历史 | 历史记录查看与对比 |
| 报表导出 | 巡检报告导出为 PDF/HTML |
| 定时巡检 | 结合现有定时任务模块 |

---

## 10. 测试计划

### 10.1 单元测试

| 模块 | 测试内容 |
|------|---------|
| vendorAdapter | 各厂商命令模板是否正确 |
| networkResultParser | 各厂商输出解析是否准确 |
| networkInspectionService | 标准巡检流程 |
| networkCommandGenerator | RAG 检索 + AI 生成 |

### 10.2 集成测试

| 场景 | 说明 |
|------|------|
| 华为交换机标准巡检 | CPU/内存/接口/版本 |
| Cisco 路由器标准巡检 | CPU/内存/接口/版本 |
| H3C 交换机全面巡检 | 全部巡检项 |
| 自定义巡检 - BGP | RAG 检索 BGP 命令 |
| 批量巡检 | 多设备并发执行 |

### 10.3 用户验收

| 验收项 | 标准 |
|--------|------|
| 设备添加 | 成功添加华为/Cisco/H3C 设备 |
| 标准巡检 | 一键巡检 2 秒内出结果 |
| 自定义巡检 | 输入"检查 BGP"能正确生成命令 |
| 报告准确性 | 标准巡检数据与实际一致 |

---

## 11. 附录

### 11.1 常用巡检命令参考

**华为 VRP**：
```
display version              -- 版本信息
display cpu-usage            -- CPU 使用率
display memory-usage         -- 内存使用率
display interface brief      -- 接口状态摘要
display ip routing-table     -- 路由表
display logbuffer            -- 日志缓冲区
display bgp peer             -- BGP 邻居
display acl all              -- ACL 列表
```

**Cisco IOS**：
```
show version                 -- 版本信息
show processes cpu           -- CPU 使用率
show memory statistics       -- 内存统计
show interfaces status       -- 接口状态
show ip route summary        -- 路由表摘要
show logging                 -- 日志
show ip bgp summary          -- BGP 邻居
show access-lists            -- ACL 列表
```

**H3C Comware**：
```
display version              -- 版本信息
display cpu-usage            -- CPU 使用率
display memory               -- 内存使用率
display interface brief      -- 接口状态
display ip routing-table     -- 路由表
display logbuffer            -- 日志缓冲区
display bgp peer             -- BGP 邻居
display acl all              -- ACL 列表
```

### 11.2 相关文档

- [数据库设计文档](./docs/book/第8章-数据库设计与操作.md)
- [SSH 服务文档](./docs/SERVER_MANAGEMENT.md)
- [Agent 管理文档](./docs/AGENT_MANAGEMENT.md)
- [QAnything 集成文档](./QANYTHING_INTEGRATION.md)
- [知识库 RAG 文档](./docs/KNOWLEDGE_BASE.md)

---

**文档版本**：v3.1 (Phase 1-2 完成)  
**最后更新**：2026-05-28  
**完成状态**：
- ✅ Phase 1: 数据库迁移、5个后端服务、API路由、路由注册、TypeScript编译
- ✅ Phase 2: Agent注册、单元测试（39个测试全部通过）
- ⏳ Phase 3: 前端网络设备管理页面（待开发）
