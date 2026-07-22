import { Router } from 'express';
import containerRoutes from './routes/containerRoutes';
import dockerRoutes from './routes/dockerRoutes';
import dockerMonitorRoutes from './routes/dockerMonitorRoutes';
import dockerVolumeRoutes from './routes/dockerVolumeRoutes';
import imageRoutes from './routes/imageRoutes';
import virtualMachineRoutes from './routes/virtualMachineRoutes';
import vmManagementRoutes from './routes/vmManagementRoutes';
import volumeRoutes from './routes/volumeRoutes';
import registryRoutes from './routes/registryRoutes';
import vmMigrationRoutes from './routes/vmMigrationRoutes';
import snapshotPolicyRoutes from './routes/snapshotPolicyRoutes';

const router = Router();

router.use('/containers', containerRoutes);
router.use('/docker', dockerRoutes);
router.use('/docker-monitor', dockerMonitorRoutes);
router.use('/docker-volumes', dockerVolumeRoutes);
router.use('/images', imageRoutes);
router.use('/virtual-machines', virtualMachineRoutes);
router.use('/vm-management', vmManagementRoutes);
router.use('/volumes', volumeRoutes);
router.use('/registries', registryRoutes);
router.use('/vm-migrations', vmMigrationRoutes);
router.use('/snapshot-policies', snapshotPolicyRoutes);

export default router;
