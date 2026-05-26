import db from '../models/database';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeHeaders?: boolean;
}

const MAX_IMPORT_ROWS = 1000;
const MAX_FIELD_LENGTH = 500;

function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeCsvLine(line: string[]): string {
  return line.map(escapeCsvField).join(',');
}

function validateImportRow(row: Record<string, unknown>, lineNum: number): string | null {
  if (!row.name || typeof row.name !== 'string' || (row.name as string).trim().length === 0) {
    return `Line ${lineNum}: name is required`;
  }
  if ((row.name as string).length > MAX_FIELD_LENGTH) {
    return `Line ${lineNum}: name too long (max ${MAX_FIELD_LENGTH} characters)`;
  }
  if (!row.hostname || typeof row.hostname !== 'string' || (row.hostname as string).trim().length === 0) {
    return `Line ${lineNum}: hostname is required`;
  }
  if ((row.hostname as string).length > MAX_FIELD_LENGTH) {
    return `Line ${lineNum}: hostname too long (max ${MAX_FIELD_LENGTH} characters)`;
  }
  if (!row.username || typeof row.username !== 'string' || (row.username as string).trim().length === 0) {
    return `Line ${lineNum}: username is required`;
  }
  if ((row.username as string).length > MAX_FIELD_LENGTH) {
    return `Line ${lineNum}: username too long (max ${MAX_FIELD_LENGTH} characters)`;
  }
  
  if (row.port) {
    const port = parseInt(String(row.port), 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return `Line ${lineNum}: invalid port number (must be 1-65535)`;
    }
  }
  
  if (row.description && (row.description as string).length > 1000) {
    return `Line ${lineNum}: description too long (max 1000 characters)`;
  }
  
  return null;
}

export async function importServersFromCSV(csvContent: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    failed: 0,
    errors: []
  };

  try {
    if (!csvContent || csvContent.length > 10 * 1024 * 1024) {
      result.errors.push('CSV content too large (max 10MB)');
      return result;
    }

    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      result.errors.push('CSV file must contain at least a header row and one data row');
      return result;
    }
    
    if (lines.length > MAX_IMPORT_ROWS + 1) {
      result.errors.push(`Too many rows (max ${MAX_IMPORT_ROWS})`);
      return result;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const requiredColumns = ['name', 'hostname', 'username'];
    for (const col of requiredColumns) {
      if (!headers.includes(col)) {
        result.errors.push(`Missing required column: ${col}`);
        return result;
      }
    }

    const insertStmt = db.prepare(`
      INSERT INTO servers (id, name, hostname, port, username, password, private_key, use_ssh_key, description, tags, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((rows: any[]) => {
      for (const row of rows) {
        insertStmt.run(
          row.id,
          row.name,
          row.hostname,
          row.port || 22,
          row.username,
          row.password || null,
          row.private_key || null,
          row.use_ssh_key ? 1 : 0,
          row.description || null,
          row.tags || null,
          row.enabled !== undefined ? row.enabled : 1
        );
      }
    });

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          result.errors.push(`Line ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
          result.failed++;
          continue;
        }

        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        row.id = randomUUID();
        
        const validationError = validateImportRow(row, i + 1);
        if (validationError) {
          result.errors.push(validationError);
          result.failed++;
          continue;
        }

        const existing = db.prepare('SELECT id FROM servers WHERE hostname = ? AND name = ?').get(row.hostname, row.name);
        if (existing) {
          result.errors.push(`Line ${i + 1}: Server already exists (hostname: ${row.hostname}, name: ${row.name})`);
          result.failed++;
          continue;
        }

        rows.push(row);
      } catch (error) {
        result.errors.push(`Line ${i + 1}: Parse error - ${(error as Error).message}`);
        result.failed++;
      }
    }

    if (rows.length > 0) {
      transaction(rows);
      result.imported = rows.length;
    }

    result.success = result.imported > 0;
    logger.info(`Server import completed: ${result.imported} imported, ${result.failed} failed`);

  } catch (error) {
    result.errors.push(`Import failed: ${(error as Error).message}`);
    logger.error('Server import failed', error as Error);
  }

  return result;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current.trim());
  return result;
}

export function exportServers(format: 'csv' | 'json' = 'csv'): { content: string; filename: string; mimeType: string } {
  const servers = db.prepare(`
    SELECT id, name, hostname, port, username, description, tags, enabled, 
           os, cpu_cores, memory_gb, disk_gb, ip_address, created_at
    FROM servers 
    ORDER BY created_at DESC
  `).all() as any[];

  if (format === 'json') {
    return {
      content: JSON.stringify(servers, null, 2),
      filename: `servers-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      mimeType: 'application/json'
    };
  }

  const headers = ['id', 'name', 'hostname', 'port', 'username', 'description', 'tags', 'enabled', 'os', 'cpu_cores', 'memory_gb', 'disk_gb', 'ip_address', 'created_at'];
  
  let csv = escapeCsvLine(headers) + '\n';
  
  for (const server of servers) {
    const row = headers.map(h => String(server[h] ?? ''));
    csv += escapeCsvLine(row) + '\n';
  }

  return {
    content: csv,
    filename: `servers-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
    mimeType: 'text/csv'
  };
}

export function exportAlerts(format: 'csv' | 'json' = 'csv'): { content: string; filename: string; mimeType: string } {
  const alerts = db.prepare(`
    SELECT id, source, severity, title, content, status, created_at, updated_at
    FROM alerts 
    ORDER BY created_at DESC
    LIMIT 10000
  `).all() as any[];

  if (format === 'json') {
    return {
      content: JSON.stringify(alerts, null, 2),
      filename: `alerts-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      mimeType: 'application/json'
    };
  }

  const headers = ['id', 'source', 'severity', 'title', 'content', 'status', 'created_at', 'updated_at'];
  
  let csv = escapeCsvLine(headers) + '\n';
  
  for (const alert of alerts) {
    const row = headers.map(h => String(alert[h] ?? ''));
    csv += escapeCsvLine(row) + '\n';
  }

  return {
    content: csv,
    filename: `alerts-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
    mimeType: 'text/csv'
  };
}

export function exportAuditLogs(format: 'csv' | 'json' = 'csv'): { content: string; filename: string; mimeType: string } {
  const logs = db.prepare(`
    SELECT al.id, u.username, al.action, al.resource_type, al.resource_id, 
           al.details, al.ip_address, al.created_at
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT 10000
  `).all() as any[];

  if (format === 'json') {
    return {
      content: JSON.stringify(logs, null, 2),
      filename: `audit-logs-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      mimeType: 'application/json'
    };
  }

  const headers = ['id', 'username', 'action', 'resource_type', 'resource_id', 'details', 'ip_address', 'created_at'];
  
  let csv = escapeCsvLine(headers) + '\n';
  
  for (const log of logs) {
    const row = headers.map(h => String(log[h] ?? ''));
    csv += escapeCsvLine(row) + '\n';
  }

  return {
    content: csv,
    filename: `audit-logs-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
    mimeType: 'text/csv'
  };
}

export function exportReports(format: 'csv' | 'json' = 'csv'): { content: string; filename: string; mimeType: string } {
  const reports = db.prepare(`
    SELECT id, name, type, format, content, is_preset, created_at, updated_at
    FROM reports 
    ORDER BY created_at DESC
    LIMIT 5000
  `).all() as any[];

  if (format === 'json') {
    return {
      content: JSON.stringify(reports, null, 2),
      filename: `reports-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      mimeType: 'application/json'
    };
  }

  const headers = ['id', 'name', 'type', 'format', 'content', 'is_preset', 'created_at', 'updated_at'];
  
  let csv = escapeCsvLine(headers) + '\n';
  
  for (const report of reports) {
    const row = headers.map(h => String(report[h] ?? ''));
    csv += escapeCsvLine(row) + '\n';
  }

  return {
    content: csv,
    filename: `reports-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
    mimeType: 'text/csv'
  };
}
