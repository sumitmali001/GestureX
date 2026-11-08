import React from 'react';
import { AlertTriangle, AlertCircle, X, RefreshCw } from 'lucide-react';

export default function ErrorBanner({ error, onDismiss, onRetry }) {
  if (!error) return null;

  const isWarning = error.severity === 'warning';
  const title = error.title || (isWarning ? 'Attention' : 'System Error');
  const message = error.message || error.error || (typeof error === 'string' ? error : 'An unexpected error occurred.');
  const recovery = error.recovery || error.recovery_instructions;

  return (
    <div className={`mb-4 rounded-lg border p-4 shadow-sm transition-all ${
      isWarning 
        ? 'bg-amber-50 border-amber-200 text-amber-900' 
        : 'bg-red-50 border-red-200 text-red-900'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-1 rounded-md ${isWarning ? 'text-amber-600 bg-amber-100' : 'text-red-600 bg-red-100'}`}>
          {isWarning ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm tracking-wide">{title}</h4>
            {onDismiss && (
              <button 
                onClick={onDismiss}
                className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <p className="text-sm mt-1 leading-relaxed font-mono whitespace-pre-line text-slate-800">
            {message}
          </p>

          {recovery && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-xs text-slate-600 flex items-start gap-1.5 font-sans">
              <span className="font-semibold text-slate-700">Recovery:</span>
              <span>{recovery}</span>
            </div>
          )}

          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
