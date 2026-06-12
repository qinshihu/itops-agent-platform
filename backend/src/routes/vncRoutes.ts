import { Router } from 'express';
import db from '../models/database';
import { decrypt, encrypt } from '../services/encryptionService';
import { logger } from '../utils/logger';

const router = Router();

// 获取服务器 VNC 配置
router.get('/config/:serverId', (req, res) => {
  try {
    const server = db.prepare('SELECT hostname, vnc_port, vnc_password FROM servers WHERE id = ?').get(req.params.serverId) as any;

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // 解密密码
    let decryptedPassword: string | null = null;
    if (server.vnc_password) {
      try {
        decryptedPassword = decrypt(server.vnc_password);
      } catch (err) {
        logger.warn('Failed to decrypt VNC password');
      }
    }

    res.json({
      success: true,
      data: {
        hostname: server.hostname,
        vnc_port: server.vnc_port,
        vnc_password: decryptedPassword
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get VNC config' });
  }
});

// 更新服务器 VNC 配置
router.put('/config/:serverId', (req, res) => {
  try {
    const { vnc_port, vnc_password } = req.body as { vnc_port?: number; vnc_password?: string };

    // 检查服务器是否存在
    const existingServer = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.serverId);
    if (!existingServer) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // 加密密码
    let encryptedPassword: string | null = null;
    if (vnc_password !== undefined) {
      if (vnc_password) {
        encryptedPassword = encrypt(vnc_password);
      }
    }

    // 更新配置
    if (vnc_port !== undefined && encryptedPassword !== undefined) {
      db.prepare('UPDATE servers SET vnc_port = ?, vnc_password = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(vnc_port, encryptedPassword, req.params.serverId);
    } else if (vnc_port !== undefined) {
      db.prepare('UPDATE servers SET vnc_port = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(vnc_port, req.params.serverId);
    } else if (encryptedPassword !== undefined) {
      db.prepare('UPDATE servers SET vnc_password = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(encryptedPassword, req.params.serverId);
    }

    logger.info(`VNC config updated for server ${req.params.serverId}`);
    res.json({ success: true, message: 'VNC config updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update VNC config' });
  }
});

export default router;
