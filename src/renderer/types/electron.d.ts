import {
  ConnectionConfig,
  ConnectionStatus,
  SchemaInfo,
  QueryResult,
  QueryRequest,
  AppSettings,
  NLToSQLRequest,
  NLToSQLResponse,
  HistoryEntry,
} from '@shared/types';

export interface ElectronAPI {
  testConnection(config: ConnectionConfig): Promise<ConnectionStatus>;
  connect(config: ConnectionConfig): Promise<ConnectionStatus>;
  disconnect(connectionId: string): Promise<void>;
  getSchema(connectionId: string): Promise<SchemaInfo>;

  executeRaw(connectionId: string, sql: string): Promise<QueryResult>;
  executeNL(request: QueryRequest): Promise<QueryResult>;

  translate(request: NLToSQLRequest): Promise<NLToSQLResponse>;

  getSettings(): Promise<AppSettings>;
  setSettings(settings: Partial<AppSettings>): Promise<void>;

  listConnections(): Promise<ConnectionConfig[]>;
  saveConnection(config: ConnectionConfig): Promise<void>;
  deleteConnection(id: string): Promise<void>;

  // Persistent history
  listHistory(): Promise<HistoryEntry[]>;
  addHistory(entry: HistoryEntry): Promise<void>;
  deleteHistory(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  toggleFavorite(id: string): Promise<void>;

  // Theme
  setNativeTheme(theme: 'dark' | 'light' | 'system'): Promise<void>;
  getSystemTheme(): Promise<'dark' | 'light'>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
