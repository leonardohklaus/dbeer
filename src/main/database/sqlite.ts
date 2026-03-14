import Database from 'better-sqlite3';
import { BaseAdapter } from './adapter';
import { ConnectionConfig, SchemaInfo, ColumnInfo, TableInfo, ColumnDetail, DatabaseEngine } from '../../shared/types';

export class SQLiteAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'sqlite';
  private db: Database.Database | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const filePath = this.config.filePath || this.config.database;
    this.db = new Database(filePath, { readonly: false, fileMustExist: false });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  protected getVersionQuery(): string {
    return 'SELECT sqlite_version() AS version';
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.db) throw new Error('Not connected');

    const tablesStmt = this.db.prepare(`
      SELECT name, type FROM sqlite_master
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    const tablesList = tablesStmt.all() as { name: string; type: string }[];

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (const t of tablesList) {
      const colsStmt = this.db.prepare(`PRAGMA table_info('${t.name}')`);
      const cols = colsStmt.all() as {
        cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
      }[];

      const fkStmt = this.db.prepare(`PRAGMA foreign_key_list('${t.name}')`);
      const fks = fkStmt.all() as {
        id: number; seq: number; table: string; from: string; to: string;
      }[];

      const fkSet = new Set(fks.map(fk => fk.from));

      const columns: ColumnDetail[] = cols.map(c => ({
        name: c.name,
        type: c.type || 'TEXT',
        nullable: c.notnull === 0,
        defaultValue: c.dflt_value ?? undefined,
        isPrimaryKey: c.pk > 0,
        isForeignKey: fkSet.has(c.name),
      }));

      const info: TableInfo = {
        schema: 'main',
        name: t.name,
        columns,
        primaryKey: cols.filter(c => c.pk > 0).map(c => c.name),
        foreignKeys: fks.map(fk => ({
          column: fk.from,
          referencedTable: fk.table,
          referencedColumn: fk.to,
        })),
      };

      if (t.type === 'view') {
        views.push(info);
      } else {
        tables.push(info);
      }
    }

    return { tables, views };
  }

  async executeQuery(sql: string): Promise<{
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  }> {
    if (!this.db) throw new Error('Not connected');

    const start = performance.now();
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT') ||
                     sql.trim().toUpperCase().startsWith('PRAGMA') ||
                     sql.trim().toUpperCase().startsWith('WITH');

    if (isSelect) {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all() as Record<string, unknown>[];
      const executionTimeMs = Math.round(performance.now() - start);
      const columns: ColumnInfo[] = rows.length > 0
        ? Object.keys(rows[0]).map(name => ({ name, type: 'unknown' }))
        : [];

      return { columns, rows, rowCount: rows.length, executionTimeMs };
    } else {
      const result = this.db.exec(sql);
      const executionTimeMs = Math.round(performance.now() - start);
      return { columns: [], rows: [], rowCount: 0, executionTimeMs };
    }
  }
}
