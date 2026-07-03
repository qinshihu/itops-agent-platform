import React from 'react';

interface ErrorDisplayProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, title = '出错了', onRetry, className = '' }) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className={`p-4 border border-red-200 bg-red-50 rounded-lg ${className}`}>
      <h3 className="text-red-800 font-medium mb-1">{title}</h3>
      <p className="text-red-600 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm text-red-700 underline hover:text-red-900">
          重试
        </button>
      )}
    </div>
  );
};
