import React from 'react';
import { useApp } from '../providers/AppProvider';
import { Wifi, WifiOff, Beer, AlertCircle } from 'lucide-react';

export function StatusBar() {
  const { state } = useApp();

  const activeConn = state.connections.find(c => c.id === state.activeConnectionId);
  const activeStatus = state.activeConnectionId
    ? state.connectionStatuses[state.activeConnectionId]
    : null;

  return (
    <div className="h-7 bg-surface-1 border-t border-surface-3 flex items-center justify-between px-4 text-[11px] text-txt-muted select-none shrink-0">
      <div className="flex items-center gap-3">
        {activeConn ? (
          <div className="flex items-center gap-1.5">
            {activeStatus?.connected ? (
              <Wifi size={11} className="text-emerald-500" />
            ) : (
              <WifiOff size={11} className="text-red-400" />
            )}
            <span className="text-txt-secondary">{activeConn.name}</span>
            {activeStatus?.serverVersion && (
              <span className="text-txt-faint">({activeStatus.serverVersion.substring(0, 40)})</span>
            )}
          </div>
        ) : (
          <span className="text-txt-faint">No active connection</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {state.error && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle size={11} />
            <span className="truncate max-w-xs">{state.error}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Beer size={11} className="text-forge-400" />
          <span>DBeer v1.0</span>
        </div>
      </div>
    </div>
  );
}
