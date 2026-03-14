import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../providers/AppProvider';
import {
  Table2, MessageSquare, Clock, Copy, Check, ChevronDown, ChevronUp,
  Database, Sparkles, AlertTriangle, Download, BarChart3
} from 'lucide-react';
import { ChartView } from './ChartView';

export function ResultsPanel() {
  const { state } = useApp();
  const [tab, setTab] = useState<'conversation' | 'data' | 'chart'>('conversation');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversationHistory]);

  useEffect(() => {
    if (state.currentResult) {
      // Auto-switch to chart tab if chart was generated, otherwise data
      setTab(state.currentResult.chart ? 'chart' : 'data');
    }
  }, [state.currentResult]);

  const isConnected = state.activeConnectionId &&
    state.connectionStatuses[state.activeConnectionId]?.connected;

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-in space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-3)' }}>
            <Database size={36} style={{ color: 'var(--text-faint)' }} />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold" style={{ color: 'var(--text-primary)' }}>No Active Connection</h2>
            <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
              Select a connection from the sidebar or add a new one to start querying your database with natural language.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-surface-3">
        <button
          onClick={() => setTab('conversation')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-all
            ${tab === 'conversation'
              ? 'text-forge-400 border-forge-500'
              : 'text-txt-muted border-transparent hover:text-txt-primary'
            }`}
        >
          <MessageSquare size={14} />
          Conversation
          {state.conversationHistory.length > 0 && (
            <span className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded-full">
              {state.conversationHistory.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('data')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-all
            ${tab === 'data'
              ? 'text-forge-400 border-forge-500'
              : 'text-txt-muted border-transparent hover:text-txt-primary'
            }`}
        >
          <Table2 size={14} />
          Results
          {state.currentResult && (
            <span className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded-full">
              {state.currentResult.rowCount} rows
            </span>
          )}
        </button>
        {state.currentResult?.chart && (
          <button
            onClick={() => setTab('chart')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-all
              ${tab === 'chart'
                ? 'text-forge-400 border-forge-500'
                : 'text-txt-muted border-transparent hover:text-txt-primary'
              }`}
          >
            <BarChart3 size={14} />
            Chart
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === 'conversation' ? (
        <ConversationView chatEndRef={chatEndRef} />
      ) : tab === 'chart' && state.currentResult?.chart ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ChartView config={state.currentResult.chart} data={state.currentResult.rows} />
        </div>
      ) : (
        <DataView />
      )}
    </div>
  );
}

// ─── Conversation View ──────────────────────────────────────────────────────

function ConversationView({ chatEndRef }: { chatEndRef: React.RefObject<HTMLDivElement> }) {
  const { state } = useApp();

  if (state.conversationHistory.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-in space-y-3 max-w-md">
          <Sparkles size={36} className="mx-auto text-forge-400/50" />
          <h3 className="text-base font-display font-semibold text-txt-primary">
            Ask in Natural Language
          </h3>
          <p className="text-sm text-txt-muted">
            Type your question below in plain language. DBeer will translate it to SQL,
            execute it, and show you the results.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              'Show me all tables',
              'Top 10 records by date',
              'Count rows per category',
              'Find duplicates',
            ].map(suggestion => (
              <button
                key={suggestion}
                className="px-3 py-1.5 text-xs text-txt-secondary bg-surface-2 border border-surface-4
                  rounded-full hover:text-forge-300 hover:border-forge-500/30 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {state.conversationHistory.map((msg, i) => (
        <div key={i} className={`animate-in flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
          {msg.role === 'assistant' && (
            <div className="w-7 h-7 rounded-lg bg-forge-600/20 flex items-center justify-center shrink-0 mt-1">
              <Sparkles size={14} className="text-forge-400" />
            </div>
          )}
          <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
            <div className={`rounded-xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-forge-600/20 text-txt-primary rounded-tr-sm'
                : 'bg-surface-2 text-txt-primary rounded-tl-sm'
            }`}>
              <p>{msg.content}</p>
            </div>
            {msg.sql && <SQLBlock sql={msg.sql} />}
            <div className="flex items-center gap-2 mt-1 px-1">
              <Clock size={10} className="text-txt-faint" />
              <span className="text-[10px] text-txt-faint">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      ))}
      <div ref={chatEndRef as any} />
    </div>
  );
}

// ─── SQL Block ──────────────────────────────────────────────────────────────

function SQLBlock({ sql }: { sql: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLong = sql.length > 200;

  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--code-bg)', border: '1px solid var(--surface-3)' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--surface-3)' }}>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Generated SQL</span>
        <div className="flex items-center gap-1">
          {isLong && (
            <button onClick={() => setExpanded(!expanded)} className="p-1 text-txt-muted hover:text-txt-primary">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <button onClick={handleCopy} className="p-1 text-txt-muted hover:text-txt-primary">
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      <pre className={`px-3 py-2 text-xs font-mono text-forge-300 overflow-x-auto
        ${!expanded && isLong ? 'max-h-24' : ''} transition-all duration-200`}>
        {sql}
      </pre>
    </div>
  );
}

// ─── Data View ──────────────────────────────────────────────────────────────

function DataView() {
  const { state } = useApp();
  const result = state.currentResult;

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center text-txt-muted text-sm">
        No results yet. Run a query to see data here.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-2/30 border-b border-surface-3 text-xs text-txt-muted">
        <div className="flex items-center gap-4">
          <span>{result.rowCount} row{result.rowCount !== 1 ? 's' : ''}</span>
          <span>{result.columns.length} column{result.columns.length !== 1 ? 's' : ''}</span>
          <span>{result.executionTimeMs}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(result)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-3 text-txt-secondary hover:text-txt-primary transition-colors"
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      {result.warning && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-amber-300 text-xs">
          <AlertTriangle size={14} />
          {result.warning}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="result-table">
          <thead>
            <tr>
              <th className="w-10 text-center">#</th>
              {result.columns.map(col => (
                <th key={col.name}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                <td className="text-center text-txt-faint">{i + 1}</td>
                {result.columns.map(col => (
                  <td key={col.name}>
                    <CellValue value={row[col.name]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--null-color)' }} className="italic">NULL</span>;
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: value ? 'var(--bool-true)' : 'var(--bool-false)' }}>{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span style={{ color: 'var(--number-color)' }}>{value.toLocaleString()}</span>;
  }
  if (value instanceof Date) {
    return <span>{value.toISOString()}</span>;
  }
  if (typeof value === 'object') {
    return <span style={{ color: 'var(--json-color)' }}>{JSON.stringify(value)}</span>;
  }
  const str = String(value);
  if (str.length > 100) {
    return <span title={str}>{str.substring(0, 100)}…</span>;
  }
  return <span>{str}</span>;
}

function exportCSV(result: any) {
  const headers = result.columns.map((c: any) => c.name).join(',');
  const rows = result.rows.map((row: any) =>
    result.columns.map((col: any) => {
      const val = row[col.name];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dbeer-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
