import type { Request, Response } from 'express';
import { Router } from 'express';
import { dcRepository } from '../../repositories';
import { getErrorMessage } from '../../utils/errorHelpers';

const exportRouter = Router();
const importRouter = Router();

// ====== 导出 ======

// GET /export — 导出完整数据中心数据
exportRouter.get('/', (_req: Request, res: Response) => {
  try {
    const rooms = dcRepository.rooms.listAll();
    const racks = dcRepository.racks.listAll();
    const slots = dcRepository.slots.listAll();
    const lifecycles = dcRepository.devices.listLifecycle();
    const pdus = dcRepository.pdus.list();
    const data = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      summary: { rooms: rooms.length, racks: racks.length, slots: slots.length, pdus: pdus.length, lifecycles: lifecycles.length },
      rooms, racks, slots, lifecycles, pdus,
    };
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// ====== 导入 ======

// POST /import — 导入数据中心数据
importRouter.post('/', (req: Request, res: Response) => {
  try {
    const { rooms = [], racks = [], slots = [], _lifecycles = [], pdus = [] } = req.body.data || req.body;

    // 清空旧数据（按外键顺序）—— roomsRepo.deleteAll 等价于原 5 条 DELETE
    dcRepository.rooms.deleteAll();

    // 导入
    for (const r of rooms) dcRepository.rooms.createForImport(r);
    for (const r of racks) dcRepository.racks.createForImport(r);
    for (const s of slots) dcRepository.slots.createForImport(s);
    for (const p of pdus) dcRepository.pdus.createForImport(p);

    res.json({ success: true, message: `导入完成: ${rooms.length}机房, ${racks.length}机柜, ${slots.length}U位, ${pdus.length}PDU` });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export { exportRouter, importRouter };
