import React, { useState, useMemo } from 'react';
import { useApp } from '../providers/AppProvider';
import { HistoryEntry, DatabaseEngine } from '@shared/types';
import {
  X, Search, Star, Trash2, Clock, Copy, Check, Play,
  Filter, AlertTriangle
} from 'lucide-react';

const ENGINE_LABELS: Record<DatabaseEngine, string> = {
  postgresql: 'PG', mysql: 'My', sqlserver: 'MS', oracle: 'Or', sqlite: 'SL',
};

export function HistoryPanel() {
  const { state, dispatch, actions } = useApp();
  const [search, setSearch] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!state.historyPanelOpen) return null;

  const filtered = useMemo(() => {
    let items = state.queryHistory;
    if (filterFavorites) items = items.filter(h => h.favorite);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(h =>
        h.naturalLanguage.toLowerCase().includes(q) ||
        h.generatedSQL.toLowerCase().includes(q) ||
        h.connectionName.toLowerCase().includes(q)
      );
    }
    return items;
  }, [state.queryHistory, search, filterFavorites]);

  const handleCopySQL = async (entry: HistoryEntry) => {
    await navigator.clipboard.writeText(entry.generatedSQL);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReplay = async (entry: HistoryEntry) => {
    if (!state.activeConnectionId) return;
    dispatch({ type: 'SET_HISTORY_PANEL', payload: false });
    await actions.executeRaw(entry.generatedSQL);
  };

  const close = () => dispatch({ type: 'SET_HISTORY_PANEL', payload: false });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'var(--modal-backdrop)' }} onClick={close}>
      <div
        className="w-full max-w-lg h-full flex flex-col animate-in"
        style={{ backgroundColor: 'var(--surface-1)', borderLeft: '1px solid var(--surface-3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-3)' }}>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-forge-400" />
            <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Query History</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)' }}>
              {state.queryHistory.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {state.queryHistory.length > 0 && (
              <button
                onClick={() => { if (confirm('Clear all history?')) actions.clearAllHistory(); }}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--text-faint)' }}
                title="Clear all"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={close} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search & filters */}
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--surface-3)' }}>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search queries..."
              className="db-input pl-9 py-2 text-xs"
            />
          </div>
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`p-2 rounded-lg transition-all ${filterFavorites ? 'bg-amber-500/15 text-amber-400' : ''}`}
            style={!filterFavorites ? { color: 'var(--text-faint)' } : undefined}
            title="Show favorites only"
          >
            <Star size={14} fill={filterFavorites ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-faint)' }}>
              <Clock size={40} style={{ opacity: 0.3 }} />
              <p className="text-sm">
                {search ? 'No matching queries found' : filterFavorites ? 'No favorite queries yet' : 'No query history yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--surface-3)' }}>
              {filtered.map(entry => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  copied={copiedId === entry.id}
                  onCopy={() => handleCopySQL(entry)}
                  onReplay={() => handleReplay(entry)}
                  onToggleFavorite={() => actions.toggleFavorite(entry.id)}
                  onDelete={() => actions.deleteHistoryEntry(entry.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ entry, copied, onCopy, onReplay, onToggleFavorite, onDelete }: {
  entry: HistoryEntry;
  copied: boolean;
  onCopy: () => void;
  onReplay: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const timeAgo = getTimeAgo(entry.timestamp);

  return (
    <div className="px-5 py-3 group hover:bg-[var(--surface-2)] transition-colors">
      <div className="flex items-start gap-3">
        {/* Engine badge */}
        <span
          className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0"
          style={{ backgroundColor: getEngineColor(entry.engine) }}
        >
          {ENGINE_LABELS[entry.engine]}
        </span>

        <div className="flex-1 min-w-0">
          {/* NL query */}
          {entry.naturalLanguage ? (
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {entry.naturalLanguage}
            </p>
          ) : (
            <p className="text-sm font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
              {entry.generatedSQL.substring(0, 80)}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
            <span>{entry.connectionName}</span>
            <span>{entry.rowCount} row{entry.rowCount !== 1 ? 's' : ''}</span>
            <span>{entry.executionTimeMs}ms</span>
            <span>{timeAgo}</span>
          </div>

          {/* Expanded SQL */}
          {expanded && (
            <pre className="mt-2 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto whitespace-pre-wrap"
              style={{ backgroundColor: 'var(--code-bg)', color: 'var(--code-text)' }}>
              {entry.generatedSQL}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onToggleFavorite} className="p-1 rounded transition-colors"
            style={{ color: entry.favorite ? '#f59e0b' : 'var(--text-faint)' }} title="Favorite">
            <Star size={13} fill={entry.favorite ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-faint)' }} title="Show SQL">
            <Filter size={13} />
          </button>
          <button onClick={onCopy} className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-faint)' }} title="Copy SQL">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          <button onClick={onReplay} className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-faint)' }} title="Re-run">
            <Play size={13} />
          </button>
          <button onClick={onDelete} className="p-1 rounded transition-colors text-red-400/60 hover:text-red-400" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function getEngineColor(engine: DatabaseEngine): string {
  const colors: Record<DatabaseEngine, string> = {
    postgresql: '#336791', mysql: '#00758F', sqlserver: '#CC2927', oracle: '#F80000', sqlite: '#003B57',
  };
  return colors[engine] || '#666';
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
