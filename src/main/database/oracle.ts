import oracledb, { Connection, ConnectionAttributes } from 'oracledb';
import { BaseAdapter } from './adapter';
import { ConnectionConfig, SchemaInfo, ColumnInfo, TableInfo, ColumnDetail, DatabaseEngine } from '../../shared/types';

export class OracleAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'oracle';
  private connection: Connection | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    // Use thin mode (no Oracle client needed)
    oracledb.initOracleClient = undefined as any;
  }

  async connect(): Promise<void> {
    const connAttrs: ConnectionAttributes = {
      user: this.config.username,
      password: this.config.password,
      connectString: this.config.connectString ||
        `${this.config.host || 'localhost'}:${this.config.port || 1521}/${this.config.serviceName || this.config.database}`,
    };

    this.connection = await oracledb.getConnection(connAttrs);
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.autoCommit = true;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  protected getVersionQuery(): string {
    return 'SELECT banner AS version FROM v$version WHERE ROWNUM = 1';
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.connection) throw new Error('Not connected');

    const tablesQuery = `
      SELECT owner AS schema_name, table_name AS name, 'TABLE' AS object_type
      FROM all_tables
      WHERE owner = USER
      UNION ALL
      SELECT owner AS schema_name, view_name AS name, 'VIEW' AS object_type
      FROM all_views
      WHERE owner = USER
      ORDER BY schema_name, name
    `;

    const columnsQuery = `
      SELECT
        atc.owner AS table_schema,
        atc.table_name,
        atc.column_name,
        atc.data_type,
        atc.nullable,
        atc.data_default,
        CASE WHEN acc.column_name IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
      FROM all_tab_columns atc
      LEFT JOIN (
        SELECT acc2.owner, acc2.table_name, acc2.column_name
        FROM all_cons_columns acc2
        JOIN all_constraints ac ON acc2.constraint_name = ac.constraint_name AND acc2.owner = ac.owner
        WHERE ac.constraint_type = 'P'
      ) acc ON atc.owner = acc.owner AND atc.table_name = acc.table_name AND atc.column_name = acc.column_name
      WHERE atc.owner = USER
      ORDER BY atc.table_name, atc.column_id
    `;

    const fkQuery = `
      SELECT
        a.table_name,
        acc.column_name,
        c_pk.table_name AS ref_table,
        acc_pk.column_name AS ref_column
      FROM all_constraints a
      JOIN all_cons_columns acc ON a.constraint_name = acc.constraint_name AND a.owner = acc.owner
      JOIN all_constraints c_pk ON a.r_constraint_name = c_pk.constraint_name AND a.r_owner = c_pk.owner
      JOIN all_cons_columns acc_pk ON c_pk.constraint_name = acc_pk.constraint_name AND c_pk.owner = acc_pk.owner
      WHERE a.constraint_type = 'R' AND a.owner = USER
    `;

    const [tablesResult, columnsResult, fkResult] = await Promise.all([
      this.connection.execute(tablesQuery),
      this.connection.execute(columnsQuery),
      this.connection.execute(fkQuery),
    ]);

    const fkSet = new Set<string>();
    const fkMap = new Map<string, { column: string; referencedTable: string; referencedColumn: string }[]>();
    for (const row of (fkResult.rows || []) as any[]) {
      fkSet.add(`${row.TABLE_NAME}.${row.COLUMN_NAME}`);
      if (!fkMap.has(row.TABLE_NAME)) fkMap.set(row.TABLE_NAME, []);
      fkMap.get(row.TABLE_NAME)!.push({
        column: row.COLUMN_NAME,
        referencedTable: row.REF_TABLE,
        referencedColumn: row.REF_COLUMN,
      });
    }

    const columnsMap = new Map<string, ColumnDetail[]>();
    for (const row of (columnsResult.rows || []) as any[]) {
      if (!columnsMap.has(row.TABLE_NAME)) columnsMap.set(row.TABLE_NAME, []);
      columnsMap.get(row.TABLE_NAME)!.push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.NULLABLE === 'Y',
        defaultValue: row.DATA_DEFAULT ?? undefined,
        isPrimaryKey: row.IS_PRIMARY_KEY === 1,
        isForeignKey: fkSet.has(`${row.TABLE_NAME}.${row.COLUMN_NAME}`),
      });
    }

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (const row of (tablesResult.rows || []) as any[]) {
      const info: TableInfo = {
        schema: row.SCHEMA_NAME,
        name: row.NAME,
        columns: columnsMap.get(row.NAME) || [],
        primaryKey: columnsMap.get(row.NAME)?.filter(c => c.isPrimaryKey).map(c => c.name),
        foreignKeys: fkMap.get(row.NAME),
      };
      if (row.OBJECT_TYPE === 'VIEW') {
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
    if (!this.connection) throw new Error('Not connected');

    const { result, executionTimeMs } = await this.measureExecution(async () => {
      return this.connection!.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    });

    const columns: ColumnInfo[] = (result.metaData || []).map((m: any) => ({
      name: m.name,
      type: String(m.dbType),
    }));

    const rows = (result.rows || []) as Record<string, unknown>[];

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
    };
  }
}
