import { Pool, PoolConfig } from 'pg';
import { BaseAdapter } from './adapter';
import { ConnectionConfig, SchemaInfo, ColumnInfo, TableInfo, ColumnDetail, DatabaseEngine } from '../../shared/types';

export class PostgreSQLAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'postgresql';
  private pool: Pool | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const poolConfig: PoolConfig = {
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
    };
    this.pool = new Pool(poolConfig);
    // Verify connectivity
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  protected getVersionQuery(): string {
    return 'SELECT version()';
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error('Not connected');

    const tablesQuery = `
      SELECT
        t.table_schema AS schema,
        t.table_name AS name,
        t.table_type
      FROM information_schema.tables t
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY t.table_schema, t.table_name
    `;

    const columnsQuery = `
      SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign_key,
        fk.foreign_table_name AS ref_table,
        fk.foreign_column_name AS ref_column
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_schema = pk.table_schema
        AND c.table_name = pk.table_name
        AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT
          kcu.table_schema, kcu.table_name, kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.table_schema = fk.table_schema
        AND c.table_name = fk.table_name
        AND c.column_name = fk.column_name
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `;

    const [tablesResult, columnsResult] = await Promise.all([
      this.pool.query(tablesQuery),
      this.pool.query(columnsQuery),
    ]);

    const columnsMap = new Map<string, ColumnDetail[]>();
    const fkMap = new Map<string, { column: string; referencedTable: string; referencedColumn: string }[]>();

    for (const row of columnsResult.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!columnsMap.has(key)) columnsMap.set(key, []);
      columnsMap.get(key)!.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default ?? undefined,
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
      });

      if (row.is_foreign_key && row.ref_table) {
        if (!fkMap.has(key)) fkMap.set(key, []);
        fkMap.get(key)!.push({
          column: row.column_name,
          referencedTable: row.ref_table,
          referencedColumn: row.ref_column,
        });
      }
    }

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (const row of tablesResult.rows) {
      const key = `${row.schema}.${row.name}`;
      const tableInfo: TableInfo = {
        schema: row.schema,
        name: row.name,
        columns: columnsMap.get(key) || [],
        primaryKey: columnsMap.get(key)?.filter(c => c.isPrimaryKey).map(c => c.name),
        foreignKeys: fkMap.get(key),
      };

      if (row.table_type === 'VIEW') {
        views.push(tableInfo);
      } else {
        tables.push(tableInfo);
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

    const columns: ColumnInfo[] = result.fields.map(f => ({
      name: f.name,
      type: String(f.dataTypeID),
    }));

    return {
      columns,
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      executionTimeMs,
    };
  }
}
