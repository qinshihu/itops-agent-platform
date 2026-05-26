import { Router, Request, Response } from 'express';
import {
  importServersFromCSV,
  exportServers,
  exportAlerts,
  exportAuditLogs,
  exportReports
} from '../services/importExportService';
import { requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.post('/servers/import', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { csvContent } = req.body;
    
    if (!csvContent || typeof csvContent !== 'string') {
      res.status(400).json({
        success: false,
        message: 'csvContent is required and must be a string'
      });
      return;
    }

    const result = await importServersFromCSV(csvContent);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully imported ${result.imported} server(s)`,
        data: {
          imported: result.imported,
          failed: result.failed,
          errors: result.errors
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Import completed with errors',
        data: {
          imported: result.imported,
          failed: result.failed,
          errors: result.errors
        }
      });
    }
  } catch (error) {
    logger.error('Failed to import servers', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/servers/export', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'json') || 'csv';
    const result = exportServers(format);
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    logger.error('Failed to export servers', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/alerts/export', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'json') || 'csv';
    const result = exportAlerts(format);
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    logger.error('Failed to export alerts', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/audit-logs/export', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'json') || 'csv';
    const result = exportAuditLogs(format);
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    logger.error('Failed to export audit logs', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/reports/export', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'json') || 'csv';
    const result = exportReports(format);
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    logger.error('Failed to export reports', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/template/servers', (req: Request, res: Response) => {
  const csv = 'name,hostname,port,username,password,use_ssh_key,private_key,description,tags,enabled\n"测试服务器","192.168.1.100",22,"root","password",0,"","这是一个测试服务器","production,test",1';
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="servers-import-template.csv"');
  res.send(csv);
});

export default router;
