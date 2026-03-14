import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronRight, Loader2, AlertCircle, Send, Shield, Zap, HardDrive, BarChart2, Link2, Lock, Wrench } from 'lucide-react';
import { useApp } from '../providers/AppProvider';
import { DBAEntry, DBACategory, QueryResult } from '@shared/types';

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<DBACategory, { label: string; icon: React.ReactNode; color: string }> = {
  performance: { label: 'Performance',      icon: <Zap       size={14} />, color: 'text-yellow-400' },
  storage:     { label: 'Storage',          icon: <HardDrive size={14} />, color: 'text-blue-400'   },
  indexes:     { label: 'Indexes',          icon: <BarChart2 size={14} />, color: 'text-purple-400' },
  connections: { label: 'Connections',      icon: <Link2     size={14} />, color: 'text-green-400'  },
  locks:       { label: 'Locks & Waits',    icon: <Lock      size={14} />, color: 'text-red-400'    },
  maintenance: { label: 'Maintenance',      icon: <Wrench    size={14} />, color: 'text-orange-400' },
};

const CATEGORY_ORDER: DBACategory[] = ['performance', 'storage', 'indexes', 'connections', 'locks', 'maintenance'];

// ─── Component ────────────────────────────────────────────────────────────────

interface DBAPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DBAPanel({ open, onClose }: DBAPanelProps) {
  const { state, actions } = useApp();

  const [catalog, setCatalog] = useState<DBAEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<DBACategory>('performance');
  const [running, setRunning] = useState<string | null>(null); // entryId being executed
  const [nlInput, setNlInput] = useState('');
  const [nlRunning, setNlRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectionId = state.activeConnectionId;
  const isConnected = connectionId && state.connectionStatuses[connectionId]?.connected;

  // Load catalog whenever the panel opens or connection changes
  useEffect(() => {
    if (!open || !connectionId || !isConnected) { setCatalog([]); return; }
    window.api.dbaGetCatalog(connectionId)
      .then(entries => {
        setCatalog(entries);
        // Switch to first category that has entries
        const first = CATEGORY_ORDER.find(c => entries.some(e => e.category === c));
        if (first) setActiveCategory(first);
      })
      .catch(() => setCatalog([]));
  }, [open, connectionId, isConnected]);

  const runEntry = useCallback(async (entry: DBAEntry) => {
    if (!connectionId || running) return;
    setRunning(entry.id);
    setError(null);
    try {
      const result: QueryResult = await window.api.dbaExecute(connectionId, entry.id);
      actions.setCurrentResult(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setRunning(null);
    }
  }, [connectionId, running, actions, onClose]);

  const runNL = useCallback(async () => {
    const q = nlInput.trim();
    if (!q || !connectionId || nlRunning) return;
    setNlRunning(true);
    setError(null);
    try {
      await actions.executeNL(q, /* isDBA */ true);
      setNlInput('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setNlRunning(false);
    }
  }, [nlInput, connectionId, nlRunning, actions, onClose]);

  const categoriesPresent = CATEGORY_ORDER.filter(c => catalog.some(e => e.category === c));
  const visibleEntries = catalog.filter(e => e.category === activeCategory);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 420,
          backgroundColor: 'var(--surface-1)',
          borderLeft: '1px solid var(--surface-3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--surface-3)' }}
        >
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-forge-400" />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              DBA Advisor
            </span>
            {isConnected && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)' }}
              >
                {state.connections.find(c => c.id === connectionId)?.engine?.toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {!isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Shield size={32} style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Connect to a database to see available DBA queries.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Category tabs */}
            <div
              className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0"
              style={{ borderBottom: '1px solid var(--surface-3)' }}
            >
              {categoriesPresent.map(cat => {
                const meta = CATEGORY_META[cat];
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                      active ? 'bg-forge-600/20 text-forge-300' : 'hover:bg-white/5'
                    }`}
                    style={active ? {} : { color: 'var(--text-muted)' }}
                  >
                    <span className={active ? 'text-forge-400' : meta.color}>{meta.icon}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Query list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {visibleEntries.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-faint)' }}>
                  No queries available for this category and engine.
                </p>
              )}
              {visibleEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => runEntry(entry)}
                  disabled={!!running || nlRunning}
                  className="w-full text-left px-3 py-3 rounded-lg transition-all group
                    hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ border: '1px solid var(--surface-3)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {entry.label}
                        </span>
                        {running === entry.id && (
                          <Loader2 size={11} className="animate-spin text-forge-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {entry.description}
                      </p>
                      {entry.note && (
                        <p className="text-[10px] mt-1 italic" style={{ color: 'var(--text-faint)' }}>
                          ⚠ {entry.note}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      size={14}
                      className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-forge-400"
                    />
                  </div>
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div
                className="mx-3 mb-2 flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
              >
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Natural language DBA input */}
            <div
              className="p-3 shrink-0"
              style={{ borderTop: '1px solid var(--surface-3)' }}
            >
              <p className="text-[10px] mb-2 font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                Or ask a custom DBA question
              </p>
              <div className="relative">
                <textarea
                  value={nlInput}
                  onChange={e => setNlInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runNL(); }
                  }}
                  placeholder='e.g. "Which tables have the most dead tuples?"'
                  rows={2}
                  disabled={nlRunning || !!running}
                  className="w-full text-xs bg-transparent pr-10 px-3 py-2 rounded-lg resize-none outline-none placeholder-txt-faint"
                  style={{
                    border: '1px solid var(--surface-4)',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={runNL}
                  disabled={!nlInput.trim() || nlRunning || !!running}
                  className="absolute right-2 bottom-2 p-1.5 rounded-md transition-all
                    disabled:opacity-30 bg-forge-600 hover:bg-forge-500 text-white"
                >
                  {nlRunning ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
