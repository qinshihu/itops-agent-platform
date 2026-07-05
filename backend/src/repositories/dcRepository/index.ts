/**
 * dcRepository — 数据中心 (DC) 模块数据访问层
 *
 * 按实体拆分子 repository：
 *   - roomsRepo    (dc_rooms)
 *   - racksRepo    (dc_racks)
 *   - slotsRepo    (dc_rack_slots)
 *   - devicesRepo  (device_types / device_manufacturers / dc_device_lifecycle / device_type_slot_definitions)
 *   - pdusRepo     (dc_pdus)
 *   - cablesRepo   (dc_cables)
 *   - powerRepo    (dc_power_panels / dc_power_feeds)
 *
 * 取代 routes/dc/*.ts 中散落的 db.prepare 调用。
 */

export type {
  DcRackRecord, DcDeviceRecord, DcPduRecord, DcCableRecord,
  DcRackCreateInput, DcDeviceCreateInput,
} from './types';

export type {
  DcRoomCreateInput, DcRoomUpdateInput,
} from './roomsRepo';

export type { RackListFilters } from './racksRepo';

export type {
  SlotRecord, SlotCreateInput, SlotImportInput, SlotUpdateInput,
} from './slotsRepo';

export type {
  DeviceTypeCreateInput, DeviceTypeUpdateInput,
  ManufacturerCreateInput, ManufacturerUpdateInput,
  LifecycleCreateInput, LifecycleListFilters, UnallocatedQueryFilters,
} from './devicesRepo';

export type {
  PduCreateInput, PduUpdateInput, PduImportInput,
} from './pdusRepo';

export type {
  CableCreateInput, CableUpdateInput, CableListFilters,
} from './cablesRepo';

export type {
  PowerPanelCreateInput, PowerPanelUpdateInput,
  PowerFeedCreateInput, PowerFeedUpdateInput, FeedListFilters,
} from './powerRepo';

export { roomsRepo } from './roomsRepo';
export { racksRepo } from './racksRepo';
export { slotsRepo } from './slotsRepo';
export { devicesRepo } from './devicesRepo';
export { pdusRepo } from './pdusRepo';
export { cablesRepo } from './cablesRepo';
export { powerRepo } from './powerRepo';

import { roomsRepo } from './roomsRepo';
import { racksRepo } from './racksRepo';
import { slotsRepo } from './slotsRepo';
import { devicesRepo } from './devicesRepo';
import { pdusRepo } from './pdusRepo';
import { cablesRepo } from './cablesRepo';
import { powerRepo } from './powerRepo';

// ── 聚合导出（兼容 dcRepository.* 调用风格）──

export const dcRepository = {
  rooms: roomsRepo,
  racks: racksRepo,
  slots: slotsRepo,
  devices: devicesRepo,
  pdus: pdusRepo,
  cables: cablesRepo,
  power: powerRepo,
};
