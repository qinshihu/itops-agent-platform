import { Router, Request, Response } from 'express';
import { networkDeviceService } from '../services/networkDeviceService';
import { networkInspectionService } from '../services/networkInspectionService';
import { networkCommandGenerator } from '../services/networkCommandGenerator';
import { snmpPollingService } from '../services/snmpPollingService';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';

const router = Router();

// Get all network devices
router.get('/', (_req: Request, res: Response) => {
  try {
    const devices = networkDeviceService.getAllDevices();
    res.json({ success: true, data: devices });
  } catch (error) {
    logger.error('Failed to get network devices:', error);
    res.status(500).json({ success: false, error: 'Failed to get network devices' });
  }
});

// Get single device
router.get('/:id', (req: Request, res: Response) => {
  try {
    const device = networkDeviceService.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, data: device });
  } catch (error) {
    logger.error('Failed to get device:', error);
    res.status(500).json({ success: false, error: 'Failed to get device' });
  }
});

// Create device
router.post('/', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { name, ip_address, vendor, model, os_version, ssh_port, ssh_key_id, username, password, enable_password, location, role, snmp_enabled, snmp_credential_id, snmp_port } = req.body;

    if (!name || !ip_address || !vendor) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, ip_address, vendor' 
      });
    }

    const device = networkDeviceService.createDevice({
      name,
      ip_address,
      vendor,
      model,
      os_version,
      ssh_port,
      ssh_key_id,
      username,
      password,
      enable_password,
      location,
      role,
      snmp_enabled,
      snmp_credential_id,
      snmp_port
    });

    res.status(201).json({ success: true, data: device });
  } catch (error) {
    logger.error('Failed to create device:', error);
    const message = error instanceof Error ? error.message : 'Failed to create device';
    if (message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'IP address already exists' });
    }
    res.status(500).json({ success: false, error: message || 'Failed to create device' });
  }
});

// Update device
router.put('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const device = networkDeviceService.updateDevice(req.params.id, req.body);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, data: device });
  } catch (error) {
    logger.error('Failed to update device:', error);
    res.status(500).json({ success: false, error: 'Failed to update device' });
  }
});

// Delete device
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const deleted = networkDeviceService.deleteDevice(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    logger.error('Failed to delete device:', error);
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
});

// Test temporary connection (for add device form) - MUST be before /:id routes
router.post('/test-connection', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { ip_address, ssh_port, username, password } = req.body;
    
    if (!ip_address || !username || !password) {
      return res.status(400).json({ success: false, error: 'ip_address, username, and password are required' });
    }

    const result = await networkDeviceService.testTemporaryConnection({
      ip_address,
      ssh_port: ssh_port || 22,
      username,
      password
    });
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('Failed to test connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

// Test device connection
router.post('/:id/test-connection', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await networkDeviceService.testConnection(req.params.id);
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('Failed to test connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

// Execute standard inspection
router.post('/:id/inspect', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { inspectionType = 'standard', customTypes, customDescription } = req.body;
    const result = await networkInspectionService.inspectDevice(
      req.params.id,
      inspectionType,
      customTypes,
      customDescription
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to execute inspection:', error);
    const message = error instanceof Error ? error.message : 'Failed to execute inspection';
    if (message.includes('not found')) {
      return res.status(404).json({ success: false, error: message });
    }
    res.status(500).json({ success: false, error: 'Failed to execute inspection' });
  }
});

// Batch inspection
router.post('/batch-inspect', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { deviceIds, inspectionType = 'standard', customTypes, customDescription } = req.body;
    
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ success: false, error: 'deviceIds is required and must be an array' });
    }

    const results = await networkInspectionService.batchInspect(deviceIds, inspectionType, customTypes, customDescription);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to execute batch inspection:', error);
    res.status(500).json({ success: false, error: 'Failed to execute batch inspection' });
  }
});

// SNMP 巡检单台设备
router.post('/:id/inspect-snmp', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await snmpPollingService.inspectDevice(req.params.id);
    if (!result) {
      return res.status(400).json({ success: false, error: '设备未启用 SNMP 或不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('SNMP inspection failed:', error);
    res.status(500).json({ success: false, error: error.message || 'SNMP 巡检失败' });
  }
});

// Get inspection history for device
router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const history = networkDeviceService.getInspectionHistory(req.params.id, limit);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get inspection history:', error);
    res.status(500).json({ success: false, error: 'Failed to get inspection history' });
  }
});

// Get inspection detail
router.get('/history/:inspectionId', (req: Request, res: Response) => {
  try {
    const inspection = networkDeviceService.getInspectionDetail(req.params.inspectionId);
    if (!inspection) {
      return res.status(404).json({ success: false, error: 'Inspection not found' });
    }
    res.json({ success: true, data: inspection });
  } catch (error) {
    logger.error('Failed to get inspection detail:', error);
    res.status(500).json({ success: false, error: 'Failed to get inspection detail' });
  }
});

// Generate custom commands using RAG + AI
router.post('/:id/generate-commands', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const device = networkDeviceService.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const { description, types } = req.body;
    if (!description) {
      return res.status(400).json({ success: false, error: 'description is required' });
    }

    const commands = await networkCommandGenerator.generateCommands(
      device.vendor,
      description,
      types
    );

    res.json({ success: true, data: commands });
  } catch (error) {
    logger.error('Failed to generate commands:', error);
    res.status(500).json({ success: false, error: 'Failed to generate commands' });
  }
});

// Analyze command output using AI
router.post('/analyze-output', async (req: Request, res: Response) => {
  try {
    const { vendor, command, output } = req.body;
    
    if (!vendor || !command || !output) {
      return res.status(400).json({ success: false, error: 'vendor, command, and output are required' });
    }

    const analysis = await networkCommandGenerator.analyzeResult(vendor, command, output);
    res.json({ success: true, data: { analysis } });
  } catch (error) {
    logger.error('Failed to analyze output:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze output' });
  }
});

export default router;
