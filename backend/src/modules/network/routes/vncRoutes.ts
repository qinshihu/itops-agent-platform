import { Router } from 'express';
import { serverRepository } from '../../../repositories';
import { decrypt, encrypt } from '../../auth/services/encryptionService';
import { logger } from '../../../utils/logger';

const router = Router();

// 获取服务器 VNC 配置
router.get('/config/:serverId', (req, res) => {
  try {
    const server = serverRepository.servers.getVncConfig(req.params.serverId);

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // 解密密码
    let decryptedPassword: string | null = null;
    if (server.vnc_password) {
      try {
        decryptedPassword = decrypt(server.vnc_password);
      } catch (_err) {
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
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to get VNC config' });
  }
});

// 更新服务器 VNC 配置
router.put('/config/:serverId', (req, res) => {
  try {
    const { vnc_port, vnc_password } = req.body as { vnc_port?: number; vnc_password?: string };

    // 检查服务器是否存在
    if (!serverRepository.servers.existsById(req.params.serverId)) {
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
      serverRepository.servers.updateVncConfig(req.params.serverId, {
        vnc_port,
        vnc_password: encryptedPassword,
      });
    } else if (vnc_port !== undefined) {
      serverRepository.servers.updateVncConfig(req.params.serverId, { vnc_port });
    } else if (encryptedPassword !== undefined) {
      serverRepository.servers.updateVncConfig(req.params.serverId, { vnc_password: encryptedPassword });
    }

    logger.info(`VNC config updated for server ${req.params.serverId}`);
    res.json({ success: true, message: 'VNC config updated successfully' });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to update VNC config' });
  }
});

export default router;
