export interface ParsedVirshVM {
  id: string;
  name: string;
  state: string;
}

export interface ParsedVMStats {
  cpuPercent: number;
  memKB: number;
  diskAllocKB: number;
  diskUsedKB: number;
  netRxBytes: number;
  netTxBytes: number;
}

export function parseVirshList(output: string): ParsedVirshVM[] {
  const lines = output.split('\n');
  const results: ParsedVirshVM[] = [];

  let headerFound = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Id') || trimmed.startsWith('---')) {
      headerFound = true;
      continue;
    }
    if (!headerFound) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 3) {
      const id = parts[0];
      const state = parts.slice(2).join('_').toLowerCase().replace(/\s+/g, '_');
      results.push({
        id: id === '-' ? parts[1] : id,
        name: id === '-' ? parts[1] : parts[1],
        state,
      });
    }
  }
  return results;
}

export function parseStats(output: string): ParsedVMStats {
  const result: ParsedVMStats = {
    cpuPercent: 0, memKB: 0, diskAllocKB: 0, diskUsedKB: 0, netRxBytes: 0, netTxBytes: 0,
  };

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);

    switch (key) {
      case 'cpu.time':
        break;
      case 'balloon.current':
        result.memKB = parseInt(value) || 0;
        break;
      case 'balloon.maximum':
        break;
      case 'block.0.allocation':
        result.diskAllocKB = parseInt(value) || 0;
        break;
      case 'block.0.capacity':
        break;
      case 'net.0.rx.bytes':
        result.netRxBytes = parseInt(value) || 0;
        break;
      case 'net.0.tx.bytes':
        result.netTxBytes = parseInt(value) || 0;
        break;
    }
  }

  return result;
}

export function mapVirshStatus(state: string): 'running' | 'stopped' | 'paused' | 'suspended' | 'unknown' {
  switch (state.toLowerCase().replace(/\s+/g, '_')) {
    case 'running':
      return 'running';
    case 'shut_off':
    case 'shutoff':
      return 'stopped';
    case 'paused':
      return 'paused';
    case 'suspended':
    case 'pmsuspended':
      return 'suspended';
    default:
      return 'unknown';
  }
}

export function mapVirshPowerState(state: string): 'poweredOn' | 'poweredOff' | 'suspended' | 'unknown' {
  switch (state.toLowerCase().replace(/\s+/g, '_')) {
    case 'running':
      return 'poweredOn';
    case 'shut_off':
    case 'shutoff':
      return 'poweredOff';
    case 'suspended':
    case 'pmsuspended':
      return 'suspended';
    case 'paused':
      return 'poweredOn';
    default:
      return 'unknown';
  }
}
