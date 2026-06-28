import clsx from 'clsx';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface ImpactChainProps {
  chain: string[];
  rootCauseIndex: number;
  className?: string;
}

export default function ImpactChain({ chain, rootCauseIndex, className }: ImpactChainProps) {
  if (!chain || chain.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-text-secondary">
        暂无影响链数据
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto py-4', className)}>
      <div className="flex items-center gap-2 min-w-fit">
        {chain.map((item, index) => (
          <div key={index} className="flex items-center">
            <div
              className={clsx(
                'flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all',
                index === rootCauseIndex
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-border bg-surface text-text-primary'
              )}
            >
              {index === rootCauseIndex && (
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <div>
                <div className={clsx(
                  'text-sm font-medium',
                  index === rootCauseIndex && 'text-red-700'
                )}>
                  {item}
                </div>
                {index === rootCauseIndex && (
                  <div className="text-xs text-red-500">根因</div>
                )}
              </div>
            </div>

            {index < chain.length - 1 && (
              <div className="mx-2 flex-shrink-0">
                <ArrowRight className="w-5 h-5 text-text-secondary" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
