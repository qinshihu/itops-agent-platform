/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { decrypt, encrypt } from '../../auth/services/encryptionService';
import { logger } from '../../../utils/logger';
import { serverCrudService } from '../../servers/services/serverCrudService';

const router = Router();

// 获取服务器 VNC 配置
router.get('/config/:serverId', (req, res) => {
  try {
    const server = serverCrudService.getVncConfig(req.params.serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    let decryptedPassword: string | null = null;
    if ((server as any).vnc_password) {
      try {
        decryptedPassword = decrypt((server as any).vnc_password);
      } catch {
        logger.warn('Failed to decrypt VNC password');
      }
    }

    res.json({
      success: true,
      data: {
        hostname: (server as any).hostname,
        vnc_port: (server as any).vnc_port,
        vnc_password: decryptedPassword,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get VNC config' });
  }
});

// 更新服务器 VNC 配置
router.put('/config/:serverId', (req, res) => {
  try {
    const { vnc_port, vnc_password } = req.body as { vnc_port?: number; vnc_password?: string };

    let encryptedPassword: string | null | undefined = undefined;
    if (vnc_password !== undefined) {
      encryptedPassword = vnc_password ? encrypt(vnc_password) : null;
    }

    const result = serverCrudService.updateVncConfig(req.params.serverId, {
      vnc_port,
      vnc_password: encryptedPassword,
    });
    if (!result.success) {
      if (result.error === 'not_found') {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    logger.info(`VNC config updated for server ${req.params.serverId}`);
    res.json({ success: true, message: 'VNC config updated successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update VNC config' });
  }
});

export default router;
