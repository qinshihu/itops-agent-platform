import { Router } from 'express';
import vncRoutes from './routes/vncRoutes';
import networkDeviceRoutes from './routes/networkDeviceRoutes';
import networkAdvancedRoutes from './routes/networkAdvancedRoutes';
import snmpRoutes from './routes/snmpRoutes';
import topologyRoutes from './routes/topologyRoutes';
import networkSubnetRoutes from './routes/networkSubnetRoutes';
import networkDiscoveryRoutes from './routes/networkDiscoveryRoutes';

const router = Router();

router.use('/vnc', vncRoutes);
router.use('/network-devices', networkDeviceRoutes);
router.use('/network-advanced', networkAdvancedRoutes);
router.use('/snmp', snmpRoutes);
router.use('/topology', topologyRoutes);
router.use('/network-subnets', networkSubnetRoutes);

export default router;
export const networkDiscoveryRouter = networkDiscoveryRoutes;
