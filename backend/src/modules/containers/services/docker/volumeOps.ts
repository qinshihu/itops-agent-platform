/**
 * =============================================================================
 * Docker 管理服务 - 卷操作
 * =============================================================================
 */

import type { DockerServiceClass, DockerVolume } from './dockerService';
import { logger } from '../../../../utils/logger';

type DS = InstanceType<typeof DockerServiceClass>;

export async function impl_listVolumes(service: DS): Promise<DockerVolume[]> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const result = await service.docker.listVolumes();
  return (result.Volumes || []).map((vol) => ({
    name: vol.Name,
    driver: vol.Driver,
    mountpoint: vol.Mountpoint,
    labels: vol.Labels as Record<string, string> | null,
    options: vol.Options as Record<string, string> | null,
    scope: vol.Scope,
    created: (vol as unknown as Record<string, unknown>).CreatedAt as string || '',
  }));
}

export async function impl_createVolume(service: DS, name: string, driver = 'local', labels: Record<string, string> = {}): Promise<DockerVolume> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const volume = await service.docker.createVolume({
    Name: name,
    Driver: driver,
    Labels: labels,
  });
  
  logger.info(`Volume ${name} created`);
  return {
    name: volume.Name,
    driver: volume.Driver,
    mountpoint: volume.Mountpoint,
    labels: volume.Labels,
    options: {},
    scope: '',
    created: '',
  };
}

export async function impl_removeVolume(service: DS, name: string, force = false): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const volume = service.docker.getVolume(name);
  await volume.remove({ force });
  logger.info(`Volume ${name} removed`);
}

export async function impl_getVolume(service: DS, name: string): Promise<DockerVolume> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const volume = service.docker.getVolume(name);
  const info = await volume.inspect();
  
  return {
    name: info.Name,
    driver: info.Driver,
    mountpoint: info.Mountpoint,
    labels: info.Labels as Record<string, string> | null,
    options: info.Options as Record<string, string> | null,
    scope: info.Scope,
    created: (info as unknown as Record<string, unknown>).CreatedAt as string || '',
  };
}