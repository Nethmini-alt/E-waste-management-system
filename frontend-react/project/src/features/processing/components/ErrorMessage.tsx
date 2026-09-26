import React from 'react';
import { RefreshCw } from 'lucide-react';
import Notice from './Notice';

interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, title, onRetry, className = '' }) => (
  <Notice tone="error" title={title} className={className}>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:no-underline"
        >
          <RefreshCw size={12} /> Try again
        </button>
      )}
    </div>
  </Notice>
);

export default ErrorMessage;
