import { Wifi, Upload } from 'lucide-react';

interface K8sUnavailableProps {
  onImport: () => void;
}

export default function K8sUnavailable({ onImport }: K8sUnavailableProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-20 h-20 rounded-2xl bg-status-warning/10 flex items-center justify-center">
        <Wifi size={36} className="text-yellow-400" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">K8s 集群不可用</h2>
        <p className="text-text-secondary">请导入 kubeconfig 配置以连接 K8s 集群</p>
      </div>
      <button
        onClick={onImport}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-primary/25"
      >
        <Upload size={16} /> 导入集群
      </button>
    </div>
  );
}