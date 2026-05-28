import clsx from 'clsx';
import { Play, AlertTriangle, FileText, Check } from 'lucide-react';

interface Step {
  title: string;
  description?: string;
}

interface Recommendation {
  id?: string;
  title: string;
  steps: Step[];
  risk: 'low' | 'medium' | 'high';
  auto_executable?: boolean;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onExecute?: (id?: string) => void;
  onCreateTicket?: (id?: string) => void;
  className?: string;
}

const riskConfig = {
  low: {
    label: '低风险',
    color: 'bg-green-100 text-green-700',
    icon: Check,
  },
  medium: {
    label: '中风险',
    color: 'bg-yellow-100 text-yellow-700',
    icon: AlertTriangle,
  },
  high: {
    label: '高风险',
    color: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
  },
};

export default function RecommendationCard({
  recommendation,
  onExecute,
  onCreateTicket,
  className,
}: RecommendationCardProps) {
  const config = riskConfig[recommendation.risk];
  const Icon = config.icon;

  return (
    <div className={clsx('bg-surface rounded-xl border border-border p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <h4 className="text-base font-semibold text-text-primary">
            {recommendation.title}
          </h4>
          <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1', config.color)}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {recommendation.steps.map((step, idx) => (
          <div key={idx} className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center">
              <span className="text-xs font-medium text-text-secondary">{idx + 1}</span>
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">{step.title}</div>
              {step.description && (
                <div className="text-xs text-text-secondary mt-0.5">{step.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        {recommendation.risk === 'low' && recommendation.auto_executable ? (
          <button
            onClick={() => onExecute?.(recommendation.id)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            执行修复
          </button>
        ) : (
          <button
            onClick={() => onCreateTicket?.(recommendation.id)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            生成工单
          </button>
        )}
      </div>
    </div>
  );
}
