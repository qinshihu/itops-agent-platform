/**
 * =============================================================================
 * Docker 管理服务 - 网络操作
 * =============================================================================
 */

import type { DockerServiceClass, DockerNetwork, DockerNetworkOptions } from './dockerService';
import { logger } from '../../../../utils/logger';

type DS = InstanceType<typeof DockerServiceClass>;

export async function impl_listNetworks(service: DS): Promise<DockerNetwork[]> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const networks = await service.docker.listNetworks();
  return networks.map(net => ({
    id: net.Id,
    name: net.Name,
    driver: net.Driver,
    scope: net.Scope,
    internal: net.Internal,
    attachable: net.Attachable,
    ipam: net.IPAM,
    containers: net.Containers,
    options: net.Options,
    labels: net.Labels,
    created: net.Created,
  }));
}

export async function impl_createNetwork(service: DS, name: string, driver = 'bridge', options: DockerNetworkOptions = {}): Promise<DockerNetwork> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const network = await service.docker.createNetwork({
    Name: name,
    Driver: driver,
    ...options,
  });
  
  logger.info(`Network ${name} created`);
  return {
    id: network.id,
    name: name,
    driver: driver,
    scope: '',
    internal: false,
    attachable: false,
    ipam: undefined,
    containers: undefined,
    options: {},
    labels: {},
    created: '',
  };
}

export async function impl_removeNetwork(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const network = service.docker.getNetwork(id);
  await network.remove();
  logger.info(`Network ${id} removed`);
}

export async function impl_getNetwork(service: DS, id: string): Promise<DockerNetwork> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const network = service.docker.getNetwork(id);
  const info = await network.inspect();
  
  return {
    id: info.Id,
    name: info.Name,
    driver: info.Driver,
    scope: info.Scope,
    internal: info.Internal,
    attachable: info.Attachable,
    ipam: info.IPAM,
    containers: info.Containers,
    options: info.Options,
    labels: info.Labels,
    created: info.Created,
  };
}

export async function impl_connectContainerToNetwork(service: DS, networkId: string, containerId: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const network = service.docker.getNetwork(networkId);
  await network.connect({ Container: containerId });
  logger.info(`Container ${containerId} connected to network ${networkId}`);
}

export async function impl_disconnectContainerFromNetwork(service: DS, networkId: string, containerId: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const network = service.docker.getNetwork(networkId);
  await network.disconnect({ Container: containerId });
  logger.info(`Container ${containerId} disconnected from network ${networkId}`);
}