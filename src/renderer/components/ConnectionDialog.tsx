import React, { useState } from 'react';
import { useApp } from '../providers/AppProvider';
import { ConnectionConfig, DatabaseEngine } from '@shared/types';
import {
  X, Loader2, CheckCircle2, AlertCircle, Database,
  FolderOpen
} from 'lucide-react';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const ENGINES: { value: DatabaseEngine; label: string; color: string; defaultPort: number }[] = [
  { value: 'postgresql', label: 'PostgreSQL', color: '#336791', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL / MariaDB', color: '#00758F', defaultPort: 3306 },
  { value: 'sqlserver', label: 'SQL Server', color: '#CC2927', defaultPort: 1433 },
  { value: 'oracle', label: 'Oracle', color: '#F80000', defaultPort: 1521 },
  { value: 'sqlite', label: 'SQLite', color: '#003B57', defaultPort: 0 },
];

export function ConnectionDialog() {
  const { state, dispatch, actions } = useApp();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const [form, setForm] = useState<Partial<ConnectionConfig>>({
    engine: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    name: '',
    ssl: false,
  });

  if (!state.connectionDialogOpen) return null;

  const currentEngine = ENGINES.find(e => e.value === form.engine)!;
  const isSQLite = form.engine === 'sqlite';
  const isOracle = form.engine === 'oracle';

  const handleEngineChange = (engine: DatabaseEngine) => {
    const eng = ENGINES.find(e => e.value === engine)!;
    setForm(prev => ({
      ...prev,
      engine,
      port: eng.defaultPort,
    }));
    setTestStatus('idle');
  };

  const handleTest = async () => {
    setTestStatus('testing');
    setTestError('');
    const config: ConnectionConfig = {
      id: 'test-' + Date.now(),
      name: form.name || 'Test',
      engine: form.engine!,
      host: form.host,
      port: form.port,
      database: form.database || '',
      username: form.username,
      password: form.password,
      filePath: form.filePath,
      ssl: form.ssl,
      serviceName: form.serviceName,
      connectString: form.connectString,
    };
    try {
      const status = await window.api.testConnection(config);
      if (status.connected) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(status.error || 'Connection failed');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const handleSave = async () => {
    const config: ConnectionConfig = {
      id: generateId(),
      name: form.name || `${currentEngine.label} - ${form.database || form.filePath || 'New'}`,
      engine: form.engine!,
      host: form.host,
      port: form.port,
      database: form.database || '',
      username: form.username,
      password: form.password,
      filePath: form.filePath,
      ssl: form.ssl,
      color: currentEngine.color,
      serviceName: form.serviceName,
      connectString: form.connectString,
    };

    await window.api.saveConnection(config);
    dispatch({ type: 'ADD_CONNECTION', payload: config });
    dispatch({ type: 'SET_CONNECTION_DIALOG', payload: false });

    // Auto-connect
    actions.connectTo(config);
  };

  const close = () => dispatch({ type: 'SET_CONNECTION_DIALOG', payload: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
      <div
        className="db-panel w-full max-w-lg mx-4 animate-in shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <div className="flex items-center gap-3">
            <Database size={20} className="text-forge-400" />
            <h2 className="font-display font-semibold text-txt-primary">New Connection</h2>
          </div>
          <button onClick={close} className="p-1 text-txt-muted hover:text-txt-primary rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Engine selector */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-2">Database Engine</label>
            <div className="grid grid-cols-5 gap-2">
              {ENGINES.map(eng => (
                <button
                  key={eng.value}
                  onClick={() => handleEngineChange(eng.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all
                    ${form.engine === eng.value
                      ? 'border-forge-500/50 bg-forge-600/10 text-txt-primary'
                      : 'border-surface-4 text-txt-muted hover:text-txt-primary hover:border-surface-5'
                    }`}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-txt-primary"
                    style={{ backgroundColor: eng.color }}
                  >
                    {eng.label.substring(0, 2)}
                  </div>
                  <span className="truncate">{eng.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Connection name */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Connection Name</label>
            <input
              type="text"
              value={form.name || ''}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="My Database"
              className="db-input"
            />
          </div>

          {isSQLite ? (
            /* SQLite: file path */
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Database File Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.filePath || ''}
                  onChange={e => setForm(p => ({ ...p, filePath: e.target.value, database: e.target.value }))}
                  placeholder="/path/to/database.db"
                  className="db-input flex-1"
                />
                <button className="db-btn-ghost shrink-0">
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Host</label>
                  <input
                    type="text"
                    value={form.host || ''}
                    onChange={e => setForm(p => ({ ...p, host: e.target.value }))}
                    placeholder="localhost"
                    className="db-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Port</label>
                  <input
                    type="number"
                    value={form.port || ''}
                    onChange={e => setForm(p => ({ ...p, port: parseInt(e.target.value) || 0 }))}
                    className="db-input"
                  />
                </div>
              </div>

              {/* Database */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">
                  {isOracle ? 'Service Name / SID' : 'Database'}
                </label>
                <input
                  type="text"
                  value={isOracle ? (form.serviceName || '') : (form.database || '')}
                  onChange={e => setForm(p => isOracle
                    ? { ...p, serviceName: e.target.value, database: e.target.value }
                    : { ...p, database: e.target.value }
                  )}
                  placeholder={isOracle ? 'ORCL' : 'my_database'}
                  className="db-input"
                />
              </div>

              {isOracle && (
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Connect String (TNS, optional)</label>
                  <input
                    type="text"
                    value={form.connectString || ''}
                    onChange={e => setForm(p => ({ ...p, connectString: e.target.value }))}
                    placeholder="(DESCRIPTION=(ADDRESS=...))"
                    className="db-input"
                  />
                </div>
              )}

              {/* Credentials */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Username</label>
                  <input
                    type="text"
                    value={form.username || ''}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="admin"
                    className="db-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Password</label>
                  <input
                    type="password"
                    value={form.password || ''}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="db-input"
                  />
                </div>
              </div>

              {/* SSL */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ssl || false}
                  onChange={e => setForm(p => ({ ...p, ssl: e.target.checked }))}
                  className="rounded border-surface-4 bg-surface-2 text-forge-500 focus:ring-forge-500/30"
                />
                <span className="text-sm text-txt-secondary">Use SSL/TLS</span>
              </label>
            </>
          )}

          {/* Test result */}
          {testStatus === 'success' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              <CheckCircle2 size={16} />
              Connection successful!
            </div>
          )}
          {testStatus === 'error' && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{testError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-3">
          <button onClick={handleTest} disabled={testStatus === 'testing'} className="db-btn-ghost">
            {testStatus === 'testing' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={close} className="db-btn-ghost">Cancel</button>
            <button onClick={handleSave} className="db-btn-primary">
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
