import { Server, Box, Globe, HardDrive } from 'lucide-react';

interface OverviewCardsProps {
  nodes: number;
  pods: number;
  services: number;
  deployments: number;
}

export default function OverviewCards({ nodes, pods, services, deployments }: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
          <Server size={20} className="text-blue-400" />
        </div>
        <div>
          <p className="text-text-tertiary text-xs">节点数</p>
          <p className="text-xl font-bold text-text-primary">{nodes}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
          <Box size={20} className="text-green-400" />
        </div>
        <div>
          <p className="text-text-tertiary text-xs">Pods 总数</p>
          <p className="text-xl font-bold text-text-primary">{pods}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
          <Globe size={20} className="text-purple-400" />
        </div>
        <div>
          <p className="text-text-tertiary text-xs">Services</p>
          <p className="text-xl font-bold text-text-primary">{services}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
          <HardDrive size={20} className="text-orange-400" />
        </div>
        <div>
          <p className="text-text-tertiary text-xs">Deployments</p>
          <p className="text-xl font-bold text-text-primary">{deployments}</p>
        </div>
      </div>
    </div>
  );
}