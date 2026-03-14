import React from 'react';
import { useApp } from '../providers/AppProvider';
import { DatabaseEngine } from '@shared/types';
import {
  Database,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Beer,
  Table2,
  Trash2,
  Plug,
  PlugZap,
  History,
} from 'lucide-react';

const ENGINE_ICONS: Record<DatabaseEngine, { label: string; color: string }> = {
  postgresql: { label: 'PG', color: '#336791' },
  mysql: { label: 'My', color: '#00758F' },
  sqlserver: { label: 'MS', color: '#CC2927' },
  oracle: { label: 'Or', color: '#F80000' },
  sqlite: { label: 'SL', color: '#003B57' },
};

export function Sidebar() {
  const { state, dispatch, actions } = useApp();

  const activeSchema = state.activeConnectionId ? state.schemas[state.activeConnectionId] : null;
  const activeStatus = state.activeConnectionId ? state.connectionStatuses[state.activeConnectionId] : null;

  if (!state.sidebarOpen) {
    return (
      <div className="w-12 bg-surface-1 border-r border-surface-3 flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="p-2 text-txt-muted hover:text-txt-primary transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        {state.connections.map(conn => {
          const info = ENGINE_ICONS[conn.engine];
          const isActive = state.activeConnectionId === conn.id;
          const isConnected = state.connectionStatuses[conn.id]?.connected;
          return (
            <button
              key={conn.id}
              onClick={() => isConnected
                ? dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: conn.id })
                : actions.connectTo(conn)
              }
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold
                transition-all duration-200 relative
                ${isActive ? 'ring-2 ring-forge-500 text-txt-primary' : 'text-txt-secondary hover:text-txt-primary'}
              `}
              style={{ backgroundColor: isActive ? info.color : `${info.color}33` }}
              title={conn.name}
            >
              {info.label}
              {isConnected && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface-1" />
              )}
            </button>
          );
        })}
        <button
          onClick={() => dispatch({ type: 'SET_CONNECTION_DIALOG', payload: true })}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-surface-3 transition-all"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-surface-1 border-r border-surface-3 flex flex-col h-full">
      {/* Header */}
      <div className="titlebar-drag h-12 flex items-center justify-between px-4 border-b border-surface-3 shrink-0">
        <div className="titlebar-no-drag flex items-center gap-2">
          <Beer size={18} className="text-forge-400" />
          <span className="font-display font-bold text-sm text-gradient">DBeer</span>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="titlebar-no-drag p-1.5 text-txt-muted hover:text-txt-primary rounded-md hover:bg-surface-3 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Connections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-muted">Connections</span>
          <button
            onClick={() => dispatch({ type: 'SET_CONNECTION_DIALOG', payload: true })}
            className="p-1 text-txt-muted hover:text-forge-400 rounded transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {state.connections.length === 0 && (
          <div className="text-center py-8 text-txt-faint text-sm">
            <Database size={32} className="mx-auto mb-3 opacity-30" />
            <p>No connections yet</p>
            <button
              onClick={() => dispatch({ type: 'SET_CONNECTION_DIALOG', payload: true })}
              className="mt-2 text-forge-400 hover:text-forge-300 text-xs"
            >
              Add your first connection
            </button>
          </div>
        )}

        {state.connections.map(conn => {
          const info = ENGINE_ICONS[conn.engine];
          const isActive = state.activeConnectionId === conn.id;
          const status = state.connectionStatuses[conn.id];
          const isConnected = status?.connected;

          return (
            <div
              key={conn.id}
              className={`sidebar-item group ${isActive ? 'active' : ''}`}
              onClick={() => isConnected
                ? dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: conn.id })
                : actions.connectTo(conn)
              }
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-txt-primary shrink-0"
                style={{ backgroundColor: conn.color || info.color }}
              >
                {info.label}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{conn.name}</div>
                <div className="text-[11px] text-txt-muted truncate">
                  {conn.host || conn.filePath || conn.database}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isConnected ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); actions.disconnectFrom(conn.id); }}
                    className="p-1 text-txt-muted hover:text-amber-400 rounded"
                    title="Disconnect"
                  >
                    <PlugZap size={12} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); actions.connectTo(conn); }}
                    className="p-1 text-txt-muted hover:text-emerald-400 rounded"
                    title="Connect"
                  >
                    <Plug size={12} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.api.deleteConnection(conn.id);
                    dispatch({ type: 'REMOVE_CONNECTION', payload: conn.id });
                  }}
                  className="p-1 text-txt-muted hover:text-red-400 rounded"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {isConnected && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Schema explorer */}
      {activeSchema && (
        <div className="border-t border-surface-3 max-h-64 overflow-y-auto p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-muted mb-2 block">
            Tables ({activeSchema.tables.length})
          </span>
          <div className="space-y-0.5">
            {activeSchema.tables.map(table => (
              <details key={`${table.schema}.${table.name}`} className="group">
                <summary className="flex items-center gap-2 px-2 py-1 text-xs text-txt-secondary hover:text-txt-primary cursor-pointer rounded hover:bg-surface-3">
                  <Table2 size={12} className="text-txt-muted shrink-0" />
                  <span className="truncate">{table.name}</span>
                  <span className="text-[10px] text-txt-faint ml-auto">{table.columns.length} cols</span>
                </summary>
                <div className="ml-6 pl-2 border-l border-surface-4 mt-0.5 space-y-0.5">
                  {table.columns.map(col => (
                    <div key={col.name} className="flex items-center gap-1.5 text-[11px] text-txt-muted py-0.5">
                      {col.isPrimaryKey && <span className="text-amber-400" title="Primary Key">🔑</span>}
                      {col.isForeignKey && <span className="text-forge-400" title="Foreign Key">🔗</span>}
                      <span className="text-txt-secondary">{col.name}</span>
                      <span className="text-txt-faint ml-auto">{col.type}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-surface-3 shrink-0 space-y-0.5">
        <button
          onClick={() => dispatch({ type: 'SET_HISTORY_PANEL', payload: true })}
          className="sidebar-item w-full"
        >
          <History size={16} />
          <span>History</span>
          {state.queryHistory.length > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-faint)' }}>
              {state.queryHistory.length}
            </span>
          )}
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_SETTINGS_OPEN', payload: true })}
          className="sidebar-item w-full"
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
