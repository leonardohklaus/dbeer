import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import {
  ConnectionConfig,
  ConnectionStatus,
  SchemaInfo,
  QueryResult,
  AppSettings,
  ConversationMessage,
  HistoryEntry,
} from '@shared/types';
import { useTheme, ThemeMode, ResolvedTheme } from '../hooks/useTheme';

// ─── State ───────────────────────────────────────────────────────────────────

interface AppState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  connectionStatuses: Record<string, ConnectionStatus>;
  schemas: Record<string, SchemaInfo>;

  queryHistory: HistoryEntry[];
  currentResult: QueryResult | null;
  conversationHistory: ConversationMessage[];

  settings: AppSettings | null;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  connectionDialogOpen: boolean;
  historyPanelOpen: boolean;
  dbaPanelOpen: boolean;
  loading: {
    connecting: boolean;
    querying: boolean;
    translating: boolean;
  };
  error: string | null;
}

const initialState: AppState = {
  connections: [],
  activeConnectionId: null,
  connectionStatuses: {},
  schemas: {},
  queryHistory: [],
  currentResult: null,
  conversationHistory: [],
  settings: null,
  sidebarOpen: true,
  settingsOpen: false,
  connectionDialogOpen: false,
  historyPanelOpen: false,
  dbaPanelOpen: false,
  loading: { connecting: false, querying: false, translating: false },
  error: null,
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CONNECTIONS'; payload: ConnectionConfig[] }
  | { type: 'ADD_CONNECTION'; payload: ConnectionConfig }
  | { type: 'REMOVE_CONNECTION'; payload: string }
  | { type: 'SET_ACTIVE_CONNECTION'; payload: string | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_SCHEMA'; payload: { id: string; schema: SchemaInfo } }
  | { type: 'SET_CURRENT_RESULT'; payload: QueryResult | null }
  | { type: 'SET_QUERY_HISTORY'; payload: HistoryEntry[] }
  | { type: 'ADD_QUERY_HISTORY'; payload: HistoryEntry }
  | { type: 'REMOVE_QUERY_HISTORY'; payload: string }
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'CLEAR_QUERY_HISTORY' }
  | { type: 'ADD_CONVERSATION'; payload: ConversationMessage }
  | { type: 'CLEAR_CONVERSATION' }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SETTINGS_OPEN'; payload: boolean }
  | { type: 'SET_CONNECTION_DIALOG'; payload: boolean }
  | { type: 'SET_HISTORY_PANEL'; payload: boolean }
  | { type: 'SET_DBA_PANEL'; payload: boolean }
  | { type: 'SET_LOADING'; payload: Partial<AppState['loading']> }
  | { type: 'SET_ERROR'; payload: string | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.payload };
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.payload] };
    case 'REMOVE_CONNECTION': {
      const s = { ...state.connectionStatuses }; delete s[action.payload];
      const sc = { ...state.schemas }; delete sc[action.payload];
      return { ...state, connections: state.connections.filter(c => c.id !== action.payload), connectionStatuses: s, schemas: sc, activeConnectionId: state.activeConnectionId === action.payload ? null : state.activeConnectionId };
    }
    case 'SET_ACTIVE_CONNECTION':
      return { ...state, activeConnectionId: action.payload, conversationHistory: [], currentResult: null };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatuses: { ...state.connectionStatuses, [action.payload.id]: action.payload } };
    case 'SET_SCHEMA':
      return { ...state, schemas: { ...state.schemas, [action.payload.id]: action.payload.schema } };
    case 'SET_CURRENT_RESULT':
      return { ...state, currentResult: action.payload };
    case 'SET_QUERY_HISTORY':
      return { ...state, queryHistory: action.payload };
    case 'ADD_QUERY_HISTORY':
      return { ...state, queryHistory: [action.payload, ...state.queryHistory] };
    case 'REMOVE_QUERY_HISTORY':
      return { ...state, queryHistory: state.queryHistory.filter(h => h.id !== action.payload) };
    case 'TOGGLE_FAVORITE':
      return { ...state, queryHistory: state.queryHistory.map(h => h.id === action.payload ? { ...h, favorite: !h.favorite } : h) };
    case 'CLEAR_QUERY_HISTORY':
      return { ...state, queryHistory: [] };
    case 'ADD_CONVERSATION':
      return { ...state, conversationHistory: [...state.conversationHistory, action.payload] };
    case 'CLEAR_CONVERSATION':
      return { ...state, conversationHistory: [], currentResult: null };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SETTINGS_OPEN':
      return { ...state, settingsOpen: action.payload };
    case 'SET_CONNECTION_DIALOG':
      return { ...state, connectionDialogOpen: action.payload };
    case 'SET_HISTORY_PANEL':
      return { ...state, historyPanelOpen: action.payload };
    case 'SET_DBA_PANEL':
      return { ...state, dbaPanelOpen: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, ...action.payload } };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  theme: { mode: ThemeMode; resolved: ResolvedTheme; setTheme: (m: ThemeMode) => void };
  actions: {
    loadConnections: () => Promise<void>;
    connectTo: (config: ConnectionConfig) => Promise<boolean>;
    disconnectFrom: (id: string) => Promise<void>;
    executeNL: (query: string, isDBA?: boolean) => Promise<QueryResult | undefined>;
    executeRaw: (sql: string) => Promise<QueryResult | undefined>;
    setCurrentResult: (result: QueryResult) => void;
    loadSettings: () => Promise<void>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
    loadHistory: () => Promise<void>;
    deleteHistoryEntry: (id: string) => Promise<void>;
    clearAllHistory: () => Promise<void>;
    toggleFavorite: (id: string) => Promise<void>;
  };
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { theme: themeMode, resolved, setTheme } = useTheme();

  const loadConnections = useCallback(async () => {
    try { dispatch({ type: 'SET_CONNECTIONS', payload: await window.api.listConnections() }); } catch {}
  }, []);

  const loadSettings = useCallback(async () => {
    try { dispatch({ type: 'SET_SETTINGS', payload: await window.api.getSettings() }); } catch {}
  }, []);

  const saveSettings = useCallback(async (settings: Partial<AppSettings>) => {
    try {
      await window.api.setSettings(settings);
      dispatch({ type: 'SET_SETTINGS', payload: await window.api.getSettings() });
      if (settings.theme) setTheme(settings.theme);
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to save settings' });
    }
  }, [setTheme]);

  const connectTo = useCallback(async (config: ConnectionConfig): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: { connecting: true } });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const status = await window.api.connect(config);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });
      if (status.connected) {
        dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: config.id });
        try { dispatch({ type: 'SET_SCHEMA', payload: { id: config.id, schema: await window.api.getSchema(config.id) } }); } catch {}
        return true;
      }
      dispatch({ type: 'SET_ERROR', payload: status.error || 'Connection failed' });
      return false;
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Connection failed' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { connecting: false } });
    }
  }, []);

  const disconnectFrom = useCallback(async (id: string) => {
    try {
      await window.api.disconnect(id);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: { id, connected: false } });
      if (state.activeConnectionId === id) dispatch({ type: 'SET_ACTIVE_CONNECTION', payload: null });
    } catch {}
  }, [state.activeConnectionId]);

  // ─── History ──────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try { dispatch({ type: 'SET_QUERY_HISTORY', payload: await window.api.listHistory() }); } catch {}
  }, []);

  const persistHistoryEntry = useCallback(async (result: QueryResult) => {
    const conn = state.connections.find(c => c.id === result.connectionId);
    const entry: HistoryEntry = {
      id: result.id, connectionId: result.connectionId,
      connectionName: conn?.name || 'Unknown', engine: conn?.engine || 'postgresql',
      naturalLanguage: result.naturalLanguage, generatedSQL: result.generatedSQL,
      explanation: result.explanation, rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs, timestamp: result.timestamp, favorite: false,
    };
    dispatch({ type: 'ADD_QUERY_HISTORY', payload: entry });
    try { await window.api.addHistory(entry); } catch {}
  }, [state.connections]);

  const deleteHistoryEntry = useCallback(async (id: string) => {
    dispatch({ type: 'REMOVE_QUERY_HISTORY', payload: id });
    try { await window.api.deleteHistory(id); } catch {}
  }, []);

  const clearAllHistory = useCallback(async () => {
    dispatch({ type: 'CLEAR_QUERY_HISTORY' });
    try { await window.api.clearHistory(); } catch {}
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: id });
    try { await window.api.toggleFavorite(id); } catch {}
  }, []);

  // ─── Query Execution ──────────────────────────────────────────────────

  const setCurrentResult = useCallback((result: QueryResult) => {
    dispatch({ type: 'SET_CURRENT_RESULT', payload: result });
    persistHistoryEntry(result);
  }, [persistHistoryEntry]);

  const executeNL = useCallback(async (query: string, isDBA = false): Promise<QueryResult | undefined> => {
    if (!state.activeConnectionId) return;
    dispatch({ type: 'SET_LOADING', payload: { querying: true } });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'ADD_CONVERSATION', payload: { role: 'user', content: query, timestamp: Date.now() } });
    try {
      const result = await window.api.executeNL({ connectionId: state.activeConnectionId, naturalLanguage: query, isDBA });
      dispatch({ type: 'SET_CURRENT_RESULT', payload: result });
      await persistHistoryEntry(result);
      dispatch({ type: 'ADD_CONVERSATION', payload: { role: 'assistant', content: result.explanation, sql: result.generatedSQL, timestamp: Date.now() } });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Query failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      dispatch({ type: 'ADD_CONVERSATION', payload: { role: 'assistant', content: `Error: ${message}`, timestamp: Date.now() } });
      return undefined;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { querying: false } });
    }
  }, [state.activeConnectionId, persistHistoryEntry]);

  const executeRaw = useCallback(async (sql: string): Promise<QueryResult | undefined> => {
    if (!state.activeConnectionId) return;
    dispatch({ type: 'SET_LOADING', payload: { querying: true } });
    try {
      const result = await window.api.executeRaw(state.activeConnectionId, sql);
      dispatch({ type: 'SET_CURRENT_RESULT', payload: result });
      await persistHistoryEntry(result);
      return result;
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Query failed' });
      return undefined;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { querying: false } });
    }
  }, [state.activeConnectionId, persistHistoryEntry]);

  useEffect(() => { loadConnections(); loadSettings(); loadHistory(); }, [loadConnections, loadSettings, loadHistory]);

  const actions = { loadConnections, connectTo, disconnectFrom, executeNL, executeRaw, setCurrentResult, loadSettings, saveSettings, loadHistory, deleteHistoryEntry, clearAllHistory, toggleFavorite };
  const themeCtx = { mode: themeMode, resolved, setTheme };

  return (
    <AppContext.Provider value={{ state, dispatch, actions, theme: themeCtx }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
