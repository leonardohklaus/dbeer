// ─── Database Engine Types ───────────────────────────────────────────────────

export type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'sqlite';

export interface ConnectionConfig {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filePath?: string; // SQLite
  ssl?: boolean;
  color?: string;
  serviceName?: string; // Oracle
  connectString?: string; // Oracle TNS
}

export interface ConnectionStatus {
  id: string;
  connected: boolean;
  error?: string;
  serverVersion?: string;
  latencyMs?: number;
}

// ─── Query Types ─────────────────────────────────────────────────────────────

export interface QueryRequest {
  connectionId: string;
  naturalLanguage: string;
}

export interface QueryResult {
  id: string;
  connectionId: string;
  naturalLanguage: string;
  generatedSQL: string;
  explanation: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  timestamp: number;
  warning?: string;
  chart?: ChartConfig;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface SchemaInfo {
  tables: TableInfo[];
  views?: TableInfo[];
}

export interface TableInfo {
  schema: string;
  name: string;
  columns: ColumnDetail[];
  rowCount?: number;
  primaryKey?: string[];
  foreignKeys?: ForeignKeyInfo[];
}

export interface ColumnDetail {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface ForeignKeyInfo {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

// ─── NL Processing ───────────────────────────────────────────────────────────

export interface NLToSQLRequest {
  naturalLanguage: string;
  schema: SchemaInfo;
  engine: DatabaseEngine;
  conversationHistory?: ConversationMessage[];
}

export interface NLToSQLResponse {
  sql: string;
  explanation: string;
  isDestructive: boolean;
  suggestedFollowUps?: string[];
  chart?: ChartConfig;
}

// ─── Chart Types ─────────────────────────────────────────────────────────────

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'horizontal_bar';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xAxis: string;        // column name for X axis / labels
  yAxis: string[];       // column name(s) for Y axis / values
  colors?: string[];     // optional custom colors
  stacked?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: number;
}

// ─── Persistent History ──────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  connectionId: string;
  connectionName: string;
  engine: DatabaseEngine;
  naturalLanguage: string;
  generatedSQL: string;
  explanation: string;
  rowCount: number;
  executionTimeMs: number;
  timestamp: number;
  favorite: boolean;
}

// ─── App Settings ────────────────────────────────────────────────────────────

export interface AppSettings {
  anthropicApiKey: string;
  claudeModel: string;
  theme: 'dark' | 'light' | 'system';
  maxRowsPreview: number;
  confirmDestructive: boolean;
  locale: string;
}

// ─── IPC Channel Definitions ─────────────────────────────────────────────────

export interface IPCChannels {
  // Connection management
  'db:test-connection': (config: ConnectionConfig) => Promise<ConnectionStatus>;
  'db:connect': (config: ConnectionConfig) => Promise<ConnectionStatus>;
  'db:disconnect': (connectionId: string) => Promise<void>;
  'db:get-schema': (connectionId: string) => Promise<SchemaInfo>;

  // Query execution
  'query:execute-raw': (connectionId: string, sql: string) => Promise<QueryResult>;
  'query:execute-nl': (request: QueryRequest) => Promise<QueryResult>;

  // NL processing
  'nl:translate': (request: NLToSQLRequest) => Promise<NLToSQLResponse>;

  // Settings
  'settings:get': () => Promise<AppSettings>;
  'settings:set': (settings: Partial<AppSettings>) => Promise<void>;

  // Connections store
  'connections:list': () => Promise<ConnectionConfig[]>;
  'connections:save': (config: ConnectionConfig) => Promise<void>;
  'connections:delete': (id: string) => Promise<void>;

  // Query history (persistent)
  'history:list': () => Promise<HistoryEntry[]>;
  'history:add': (entry: HistoryEntry) => Promise<void>;
  'history:delete': (id: string) => Promise<void>;
  'history:clear': () => Promise<void>;
  'history:toggle-favorite': (id: string) => Promise<void>;
}
