import type { VirtualMachine } from '../../../../../types/vmManagement';

export function mapVM(vm: any, platformId: string): VirtualMachine {
  const status = mapVMStatus(vm.status);
  const powerState = mapPowerState(vm.status);

  return {
    id: String(vm.vmid),
    name: vm.name || `vm-${vm.vmid}`,
    hypervisorType: 'proxmox',
    hypervisorId: platformId,
    status,
    powerState,
    guestOs: vm.ostype || undefined,
    memoryMB: vm.maxmem ? Math.round(vm.maxmem / (1024 * 1024)) : 0,
    numCPUs: vm.cpus || 0,
    disks: [],
    networkInterfaces: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function mapVMFromConfig(data: any, platformId: string): VirtualMachine {
  const status = mapVMStatus(data.status || data.lock ? 'locked' : 'running');
  const powerState = mapPowerState(data.status);

  const disks: any[] = [];
  const nics: any[] = [];

  for (const key of Object.keys(data)) {
    if (key.startsWith('scsi') || key.startsWith('virtio') || key.startsWith('sata')) {
      const match = data[key]?.match(/size=(\d+)G/i);
      disks.push({
        id: `${data.id}-${key}`,
        name: key,
        sizeGB: match ? parseInt(match[1]) : 0,
        type: 'thin' as const,
      });
    }
    if (key.startsWith('net')) {
      const macMatch = data[key]?.match(/([0-9A-Fa-f:]{17})/i);
      nics.push({
        id: `${data.id}-${key}`,
        name: key,
        macAddress: macMatch ? macMatch[1] : undefined,
        ipAddress: [],
        connected: true,
      });
    }
  }

  return {
    id: String(data.id),
    name: data.name || `vm-${data.id}`,
    hypervisorType: 'proxmox',
    hypervisorId: platformId,
    status,
    powerState,
    guestOs: data.ostype || undefined,
    memoryMB: data.memory || 0,
    numCPUs: data.cores || 0,
    disks,
    networkInterfaces: nics,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function mapVMStatus(status: string): 'running' | 'stopped' | 'paused' | 'suspended' | 'unknown' {
  switch (status) {
    case 'running':
      return 'running';
    case 'stopped':
      return 'stopped';
    case 'paused':
      return 'paused';
    case 'suspended':
      return 'suspended';
    default:
      return 'unknown';
  }
}

export function mapPowerState(status: string): 'poweredOn' | 'poweredOff' | 'suspended' | 'unknown' {
  switch (status) {
    case 'running':
      return 'poweredOn';
    case 'stopped':
      return 'poweredOff';
    case 'paused':
    case 'suspended':
      return 'suspended';
    default:
      return 'unknown';
  }
}

export function mapStorageType(type: string): 'vmfs' | 'nfs' | 'iscsi' | 'local' | 'other' {
  switch (type) {
    case 'lvm':
    case 'lvmthin':
    case 'dir':
      return 'local';
    case 'nfs':
      return 'nfs';
    case 'iscsi':
      return 'iscsi';
    default:
      return 'other';
  }
}
