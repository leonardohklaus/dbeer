import mssql, { ConnectionPool, IResult, config as MSSQLConfig } from 'mssql';
import { BaseAdapter } from './adapter';
import { ConnectionConfig, SchemaInfo, ColumnInfo, TableInfo, ColumnDetail, DatabaseEngine } from '../../shared/types';

export class SQLServerAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'sqlserver';
  private pool: ConnectionPool | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const mssqlConfig: MSSQLConfig = {
      server: this.config.host || 'localhost',
      port: this.config.port || 1433,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      options: {
        encrypt: this.config.ssl ?? false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 30000,
      },
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
    this.pool = await new ConnectionPool(mssqlConfig).connect();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  protected getVersionQuery(): string {
    return 'SELECT @@VERSION AS version';
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error('Not connected');

    const tablesQuery = `
      SELECT
        s.name AS [schema],
        t.name AS [name],
        t.type_desc AS table_type
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      UNION ALL
      SELECT
        s.name AS [schema],
        v.name AS [name],
        'VIEW' AS table_type
      FROM sys.views v
      JOIN sys.schemas s ON v.schema_id = s.schema_id
      ORDER BY [schema], [name]
    `;

    const columnsQuery = `
      SELECT
        s.name AS table_schema,
        t.name AS table_name,
        c.name AS column_name,
        tp.name AS data_type,
        c.is_nullable,
        dc.definition AS column_default,
        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key,
        CASE WHEN fk.parent_column_id IS NOT NULL THEN 1 ELSE 0 END AS is_foreign_key,
        ref_t.name AS ref_table,
        ref_c.name AS ref_column
      FROM sys.columns c
      JOIN sys.tables t ON c.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.types tp ON c.user_type_id = tp.user_type_id
      LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
      LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM sys.index_columns ic
        JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
      LEFT JOIN sys.foreign_key_columns fk ON c.object_id = fk.parent_object_id AND c.column_id = fk.parent_column_id
      LEFT JOIN sys.tables ref_t ON fk.referenced_object_id = ref_t.object_id
      LEFT JOIN sys.columns ref_c ON fk.referenced_object_id = ref_c.object_id AND fk.referenced_column_id = ref_c.column_id
      ORDER BY s.name, t.name, c.column_id
    `;

    const [tablesResult, columnsResult] = await Promise.all([
      this.pool.request().query(tablesQuery),
      this.pool.request().query(columnsQuery),
    ]);

    const columnsMap = new Map<string, ColumnDetail[]>();
    const fkMap = new Map<string, { column: string; referencedTable: string; referencedColumn: string }[]>();

    for (const row of columnsResult.recordset) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!columnsMap.has(key)) columnsMap.set(key, []);
      columnsMap.get(key)!.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 1,
        defaultValue: row.column_default ?? undefined,
        isPrimaryKey: row.is_primary_key === 1,
        isForeignKey: row.is_foreign_key === 1,
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

    for (const row of tablesResult.recordset) {
      const key = `${row.schema}.${row.name}`;
      const info: TableInfo = {
        schema: row.schema,
        name: row.name,
        columns: columnsMap.get(key) || [],
        primaryKey: columnsMap.get(key)?.filter(c => c.isPrimaryKey).map(c => c.name),
        foreignKeys: fkMap.get(key),
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
      return this.pool!.request().query(sql) as Promise<IResult<Record<string, unknown>>>;
    });

    const columns: ColumnInfo[] = Object.keys(result.recordset[0] || {}).map(name => ({
      name,
      type: 'unknown',
    }));

    return {
      columns,
      rows: result.recordset,
      rowCount: result.recordset.length,
      executionTimeMs,
    };
  }
}
