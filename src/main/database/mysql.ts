import mysql, { Pool, PoolOptions, FieldPacket } from 'mysql2/promise';
import { BaseAdapter } from './adapter';
import { ConnectionConfig, SchemaInfo, ColumnInfo, TableInfo, ColumnDetail, DatabaseEngine } from '../../shared/types';

export class MySQLAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'mysql';
  private pool: Pool | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const poolConfig: PoolOptions = {
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      connectionLimit: 5,
      connectTimeout: 10000,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
    };
    this.pool = mysql.createPool(poolConfig);
    const conn = await this.pool.getConnection();
    conn.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  protected getVersionQuery(): string {
    return 'SELECT VERSION() AS version';
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error('Not connected');

    const db = this.config.database;

    const tablesQuery = `
      SELECT TABLE_NAME AS name, TABLE_TYPE AS table_type
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;

    const columnsQuery = `
      SELECT
        c.TABLE_NAME AS table_name,
        c.COLUMN_NAME AS column_name,
        c.DATA_TYPE AS data_type,
        c.IS_NULLABLE AS is_nullable,
        c.COLUMN_DEFAULT AS column_default,
        c.COLUMN_KEY AS column_key
      FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = ?
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `;

    const fkQuery = `
      SELECT
        kcu.TABLE_NAME AS table_name,
        kcu.COLUMN_NAME AS column_name,
        kcu.REFERENCED_TABLE_NAME AS ref_table,
        kcu.REFERENCED_COLUMN_NAME AS ref_column
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `;

    const [[tablesRows], [columnsRows], [fkRows]] = await Promise.all([
      this.pool.query(tablesQuery, [db]),
      this.pool.query(columnsQuery, [db]),
      this.pool.query(fkQuery, [db]),
    ]) as any;

    const fkSet = new Set<string>();
    const fkMap = new Map<string, { column: string; referencedTable: string; referencedColumn: string }[]>();
    for (const fk of fkRows) {
      fkSet.add(`${fk.table_name}.${fk.column_name}`);
      if (!fkMap.has(fk.table_name)) fkMap.set(fk.table_name, []);
      fkMap.get(fk.table_name)!.push({
        column: fk.column_name,
        referencedTable: fk.ref_table,
        referencedColumn: fk.ref_column,
      });
    }

    const columnsMap = new Map<string, ColumnDetail[]>();
    for (const col of columnsRows) {
      if (!columnsMap.has(col.table_name)) columnsMap.set(col.table_name, []);
      columnsMap.get(col.table_name)!.push({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default ?? undefined,
        isPrimaryKey: col.column_key === 'PRI',
        isForeignKey: fkSet.has(`${col.table_name}.${col.column_name}`),
      });
    }

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (const row of tablesRows) {
      const info: TableInfo = {
        schema: db,
        name: row.name,
        columns: columnsMap.get(row.name) || [],
        primaryKey: columnsMap.get(row.name)?.filter(c => c.isPrimaryKey).map(c => c.name),
        foreignKeys: fkMap.get(row.name),
      };
      if (row.table_type === 'VIEW') {
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
    if (!this.pool) throw new Error('Not connected');

    const { result, executionTimeMs } = await this.measureExecution(async () => {
      return this.pool!.query(sql);
    });

    const [rows, fields] = result as [any[], FieldPacket[]];

    const columns: ColumnInfo[] = (fields || []).map((f: FieldPacket) => ({
      name: f.name,
      type: String(f.type),
    }));

    return {
      columns,
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      executionTimeMs,
    };
  }
}
