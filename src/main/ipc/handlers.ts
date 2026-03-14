import { ipcMain, IpcMainInvokeEvent, nativeTheme } from 'electron';
import Store from 'electron-store';
import { randomUUID } from 'crypto';
import { ConnectionManager } from '../database/manager';
import { NLService } from '../services/nl-service';
import { validateReadOnlySQL } from '../services/sql-guard';
import { DBA_CATALOG, DBA_CATEGORY_LABELS } from '../dba/catalog';
import {
  ConnectionConfig,
  ConnectionStatus,
  SchemaInfo,
  QueryResult,
  QueryRequest,
  AppSettings,
  NLToSQLRequest,
  HistoryEntry,
  DBAEntry,
} from '../../shared/types';

const store = new Store();
const connectionManager = new ConnectionManager();
const nlService = new NLService();

function getSettings(): AppSettings {
  return {
    aiProvider: (store.get('aiProvider') as AppSettings['aiProvider']) || 'anthropic',
    anthropicApiKey: (store.get('anthropicApiKey') as string) || '',
    claudeModel: (store.get('claudeModel') as string) || 'claude-sonnet-4-20250514',
    openaiApiKey: (store.get('openaiApiKey') as string) || '',
    openaiModel: (store.get('openaiModel') as string) || 'gpt-4o',
    geminiApiKey: (store.get('geminiApiKey') as string) || '',
    geminiModel: (store.get('geminiModel') as string) || 'gemini-2.0-flash',
    ollamaBaseUrl: (store.get('ollamaBaseUrl') as string) || 'http://localhost:11434',
    ollamaModel: (store.get('ollamaModel') as string) || 'llama3',
    groqApiKey: (store.get('groqApiKey') as string) || '',
    groqModel: (store.get('groqModel') as string) || 'llama-3.3-70b-versatile',
    theme: (store.get('theme') as AppSettings['theme']) || 'dark',
    maxRowsPreview: (store.get('maxRowsPreview') as number) || 500,
    confirmDestructive: (store.get('confirmDestructive') as boolean) ?? true,
    locale: (store.get('locale') as string) || 'en',
  };
}

function ensureNLService(): void {
  nlService.updateConfig(getSettings());
}

export function registerIPCHandlers(): void {
  // ─── Connection Management ──────────────────────────────────────────────

  ipcMain.handle('db:test-connection', async (_event: IpcMainInvokeEvent, config: ConnectionConfig): Promise<ConnectionStatus> => {
    return connectionManager.testConnection(config);
  });

  ipcMain.handle('db:connect', async (_event: IpcMainInvokeEvent, config: ConnectionConfig): Promise<ConnectionStatus> => {
    return connectionManager.connect(config);
  });

  ipcMain.handle('db:disconnect', async (_event: IpcMainInvokeEvent, connectionId: string): Promise<void> => {
    await connectionManager.disconnect(connectionId);
  });

  ipcMain.handle('db:get-schema', async (_event: IpcMainInvokeEvent, connectionId: string): Promise<SchemaInfo> => {
    return connectionManager.refreshSchema(connectionId);
  });

  // ─── Query Execution ───────────────────────────────────────────────────

  ipcMain.handle('query:execute-raw', async (_event: IpcMainInvokeEvent, connectionId: string, sql: string): Promise<QueryResult> => {
    // ─── READ-ONLY GUARD ─────────────────────────────────────────────────
    const validation = validateReadOnlySQL(sql);
    if (!validation.allowed) {
      throw new Error(validation.reason || 'Query blocked by read-only policy.');
    }

    const adapter = connectionManager.getAdapter(connectionId);
    if (!adapter) throw new Error(`Not connected to ${connectionId}`);

    const result = await adapter.executeQuery(sql);
    return {
      id: randomUUID(),
      connectionId,
      naturalLanguage: '',
      generatedSQL: sql,
      explanation: 'Raw SQL execution (read-only)',
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs,
      timestamp: Date.now(),
    };
  });

  ipcMain.handle('query:execute-nl', async (_event: IpcMainInvokeEvent, request: QueryRequest): Promise<QueryResult> => {
    ensureNLService();

    const adapter = connectionManager.getAdapter(request.connectionId);
    if (!adapter) throw new Error(`Not connected to ${request.connectionId}`);

    const schema = connectionManager.getSchema(request.connectionId);
    if (!schema) throw new Error('Schema not loaded. Please reconnect.');

    // Step 1: Translate NL → SQL
    const nlResult = await nlService.translate({
      naturalLanguage: request.naturalLanguage,
      schema,
      engine: adapter.engine,
      isDBA: request.isDBA,
    });

    // Step 2: READ-ONLY GUARD — validate generated SQL before execution
    if (!nlResult.sql || nlResult.sql.trim() === '') {
      // Claude refused to generate SQL (e.g., user asked for a write operation)
      return {
        id: randomUUID(),
        connectionId: request.connectionId,
        naturalLanguage: request.naturalLanguage,
        generatedSQL: '',
        explanation: nlResult.explanation || 'This request was refused because DBeer is a read-only client.',
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        timestamp: Date.now(),
        warning: '🔒 Read-only: this operation is not allowed in DBeer.',
      };
    }

    const validation = validateReadOnlySQL(nlResult.sql);
    if (!validation.allowed) {
      return {
        id: randomUUID(),
        connectionId: request.connectionId,
        naturalLanguage: request.naturalLanguage,
        generatedSQL: nlResult.sql,
        explanation: validation.reason || 'Query blocked by read-only policy.',
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        timestamp: Date.now(),
        warning: `🔒 Blocked: the generated SQL contained a ${validation.blockedKeyword || 'forbidden'} operation. DBeer is read-only.`,
      };
    }

    // Step 3: Execute the validated read-only SQL
    const execResult = await adapter.executeQuery(nlResult.sql);

    return {
      id: randomUUID(),
      connectionId: request.connectionId,
      naturalLanguage: request.naturalLanguage,
      generatedSQL: nlResult.sql,
      explanation: nlResult.explanation,
      columns: execResult.columns,
      rows: execResult.rows,
      rowCount: execResult.rowCount,
      executionTimeMs: execResult.executionTimeMs,
      timestamp: Date.now(),
      chart: nlResult.chart,
    };
  });

  // ─── NL Translation Only ───────────────────────────────────────────────

  ipcMain.handle('nl:translate', async (_event: IpcMainInvokeEvent, request: NLToSQLRequest) => {
    ensureNLService();
    return nlService.translate(request);
  });

  // ─── DBA ───────────────────────────────────────────────────────────────

  // Returns catalog entries that are supported by the active connection's engine.
  ipcMain.handle('dba:catalog', async (_event: IpcMainInvokeEvent, connectionId: string): Promise<DBAEntry[]> => {
    const adapter = connectionManager.getAdapter(connectionId);
    if (!adapter) throw new Error('Not connected');
    const engine = adapter.engine;
    return DBA_CATALOG
      .filter(e => e.engines.includes(engine))
      .map(e => ({
        id: e.id,
        label: e.label,
        description: e.description,
        category: e.category as DBAEntry['category'],
        sql: e.sql[engine] || '',
        note: e.note,
      }));
  });

  // Returns the human-readable category labels map.
  ipcMain.handle('dba:categories', async (): Promise<Record<string, string>> => {
    return DBA_CATEGORY_LABELS;
  });

  // Executes a DBA catalog entry directly (trusted SQL — bypasses NL step).
  ipcMain.handle('dba:execute', async (
    _event: IpcMainInvokeEvent,
    connectionId: string,
    entryId: string,
  ): Promise<QueryResult> => {
    const adapter = connectionManager.getAdapter(connectionId);
    if (!adapter) throw new Error(`Not connected to ${connectionId}`);

    const entry = DBA_CATALOG.find(e => e.id === entryId);
    if (!entry) throw new Error(`DBA query "${entryId}" not found in catalog`);

    const sql = entry.sql[adapter.engine];
    if (!sql) throw new Error(`DBA query "${entryId}" is not supported for ${adapter.engine}`);

    try {
      const execResult = await adapter.executeQuery(sql);
      return {
        id: randomUUID(),
        connectionId,
        naturalLanguage: entry.label,
        generatedSQL: sql,
        explanation: entry.description,
        columns: execResult.columns,
        rows: execResult.rows,
        rowCount: execResult.rowCount,
        executionTimeMs: execResult.executionTimeMs,
        timestamp: Date.now(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Convert well-known missing-object errors into a helpful warning result
      // instead of crashing the renderer with a raw IPC exception.
      const isExtensionMissing =
        /relation .* does not exist/i.test(msg) ||
        /table .* doesn't exist/i.test(msg) ||
        /unknown table/i.test(msg) ||
        /invalid object name/i.test(msg);

      if (isExtensionMissing) {
        const hint = entry.note
          ? `\n\nHint: ${entry.note}`
          : '\n\nThis query may require a database extension or elevated privileges.';
        return {
          id: randomUUID(),
          connectionId,
          naturalLanguage: entry.label,
          generatedSQL: sql,
          explanation: `Could not run "${entry.label}": ${msg}${hint}`,
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: 0,
          timestamp: Date.now(),
          warning: `⚠ ${msg}${hint}`,
        };
      }

      throw err; // re-throw unexpected errors
    }
  });

  // ─── Settings ──────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    return getSettings();
  });

  ipcMain.handle('settings:set', async (_event: IpcMainInvokeEvent, settings: Partial<AppSettings>): Promise<void> => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key, value);
    }
    ensureNLService();
  });

  // ─── Saved Connections ─────────────────────────────────────────────────

  ipcMain.handle('connections:list', async (): Promise<ConnectionConfig[]> => {
    return (store.get('connections') as ConnectionConfig[]) || [];
  });

  ipcMain.handle('connections:save', async (_event: IpcMainInvokeEvent, config: ConnectionConfig): Promise<void> => {
    const connections = (store.get('connections') as ConnectionConfig[]) || [];
    const idx = connections.findIndex(c => c.id === config.id);
    if (idx >= 0) {
      connections[idx] = config;
    } else {
      connections.push(config);
    }
    store.set('connections', connections);
  });

  ipcMain.handle('connections:delete', async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
    const connections = (store.get('connections') as ConnectionConfig[]) || [];
    store.set('connections', connections.filter(c => c.id !== id));
    // Also disconnect if active
    if (connectionManager.isConnected(id)) {
      await connectionManager.disconnect(id);
    }
  });

  // ─── Query History (Persistent) ──────────────────────────────────────

  ipcMain.handle('history:list', async (): Promise<HistoryEntry[]> => {
    return (store.get('queryHistory') as HistoryEntry[]) || [];
  });

  ipcMain.handle('history:add', async (_event: IpcMainInvokeEvent, entry: HistoryEntry): Promise<void> => {
    const history = (store.get('queryHistory') as HistoryEntry[]) || [];
    history.unshift(entry);
    // Keep max 200 entries
    store.set('queryHistory', history.slice(0, 200));
  });

  ipcMain.handle('history:delete', async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
    const history = (store.get('queryHistory') as HistoryEntry[]) || [];
    store.set('queryHistory', history.filter(h => h.id !== id));
  });

  ipcMain.handle('history:clear', async (): Promise<void> => {
    store.set('queryHistory', []);
  });

  ipcMain.handle('history:toggle-favorite', async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
    const history = (store.get('queryHistory') as HistoryEntry[]) || [];
    const idx = history.findIndex(h => h.id === id);
    if (idx >= 0) {
      history[idx].favorite = !history[idx].favorite;
      store.set('queryHistory', history);
    }
  });

  // ─── Theme ─────────────────────────────────────────────────────────────

  ipcMain.handle('theme:set-native', async (_event: IpcMainInvokeEvent, theme: 'dark' | 'light' | 'system'): Promise<void> => {
    nativeTheme.themeSource = theme;
  });

  ipcMain.handle('theme:get-system', async (): Promise<'dark' | 'light'> => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });
}

export function cleanup(): Promise<void> {
  return connectionManager.disconnectAll();
}
