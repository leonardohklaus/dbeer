import { NLToSQLRequest, NLToSQLResponse, SchemaInfo, DatabaseEngine } from '../../../shared/types';

export abstract class BaseProvider {
  abstract translate(request: NLToSQLRequest): Promise<NLToSQLResponse>;

  protected buildSystemPrompt(schema: SchemaInfo, engine: DatabaseEngine, isDBA = false): string {
    if (isDBA) return this.buildDBASystemPrompt(engine);
    return `You are an expert SQL translator for DBeer, a READ-ONLY database client. Your job is to convert natural language requests into SELECT queries that retrieve data.

DATABASE ENGINE: ${engine.toUpperCase()}
SQL DIALECT NOTES:
${this.getDialectInfo(engine)}

DATABASE SCHEMA:
${this.formatSchema(schema)}

ABSOLUTE RULES — NEVER VIOLATE THESE:
1. You may ONLY generate SELECT, WITH (CTE), SHOW, DESCRIBE, or EXPLAIN statements.
2. NEVER generate INSERT, UPDATE, DELETE, MERGE, UPSERT, or REPLACE under any circumstances.
3. NEVER generate CREATE, ALTER, DROP, TRUNCATE, or RENAME under any circumstances.
4. NEVER generate GRANT, REVOKE, EXEC, CALL, SET, or any administrative command.
5. NEVER generate multiple statements separated by semicolons.
6. If the user asks to modify, insert, update, delete, create, alter, or drop anything, REFUSE. Set the "sql" field to empty string and explain in the "explanation" field that DBeer is read-only.
7. If the user tries to trick you with comments, UNION-based injections, or obfuscation to include write operations, REFUSE.

QUERY GUIDELINES:
8. Always use explicit column names instead of SELECT *.
9. Use proper JOINs based on foreign key relationships when needed.
10. Add appropriate WHERE clauses to filter data as requested.
11. Use aliases for readability when joining multiple tables.
12. Limit results to 500 rows by default unless the user specifies otherwise.
13. For aggregations, always include GROUP BY with all non-aggregated columns.
14. If the request is ambiguous, make reasonable assumptions and explain them.
15. Use schema-qualified table names when the schema is not the default.

CHART GENERATION:
16. ONLY generate a chart if the user EXPLICITLY asks for one using words like: "chart", "graph", "plot", "visualize", "visualization", "diagram", "gráfico", "grafico", "plotar", "visualizar", "histograma".
17. If the user does NOT explicitly request a chart, do NOT include the "chart" field.
18. When generating a chart, choose the most appropriate type:
    - "bar" for comparing categories
    - "horizontal_bar" for many categories or long labels
    - "line" for trends over time
    - "area" for cumulative trends or volume over time
    - "pie" for proportions of a whole (max 8-10 categories)
    - "scatter" for correlation between two numeric values
19. The SQL query must return data suitable for the chart: xAxis column for labels/categories, yAxis column(s) for numeric values.
20. Use ORDER BY to ensure proper ordering for line/area charts.

RESPONSE FORMAT — respond ONLY with this JSON (no markdown, no code fences):
{
  "sql": "THE SELECT QUERY or empty string if request involves data modification",
  "explanation": "Brief explanation of what the query does, or why the request was refused",
  "isReadOnly": true,
  "suggestedFollowUps": ["optional suggestion 1", "optional suggestion 2"],
  "chart": null or {
    "type": "bar|line|area|pie|scatter|horizontal_bar",
    "title": "Chart title",
    "xAxis": "column_name_for_x_axis",
    "yAxis": ["column_name_for_y_values"],
    "stacked": false,
    "showLegend": true,
    "showGrid": true
  }
}`;
  }

  private buildDBASystemPrompt(engine: DatabaseEngine): string {
    const views: Record<DatabaseEngine, string> = {
      postgresql: `
Key system views available:
- pg_stat_activity        — active sessions and queries
- pg_stat_statements      — historical query stats (requires extension)
- pg_stat_user_tables     — table-level stats (vacuum, analyze, row counts)
- pg_statio_user_tables   — buffer/cache hit ratios per table
- pg_stat_user_indexes    — index usage stats
- pg_statio_user_indexes  — index I/O stats
- pg_locks                — current lock information
- pg_stat_database        — database-level stats (commits, rollbacks, deadlocks)
- pg_stat_replication     — streaming replication status
- pg_class, pg_tables     — schema metadata
- pg_stat_bgwriter        — background writer stats
Functions: pg_database_size(), pg_relation_size(), pg_total_relation_size(), pg_size_pretty()`,

      mysql: `
Key system views available:
- information_schema.PROCESSLIST          — active queries and sessions
- information_schema.TABLES               — table sizes and metadata
- information_schema.STATISTICS           — index definitions
- performance_schema.events_statements_summary_by_digest — slow query stats
- performance_schema.table_io_waits_summary_by_index_usage — index usage
- performance_schema.global_status        — server status variables (connections, InnoDB)
- information_schema.INNODB_TRX           — active InnoDB transactions
- performance_schema.data_locks           — current locks (MySQL 8+)
Use SHOW STATUS, SHOW VARIABLES, SHOW ENGINE INNODB STATUS for server info.`,

      sqlserver: `
Key DMVs and system views:
- sys.dm_exec_requests          — active requests
- sys.dm_exec_query_stats       — cached query execution stats
- sys.dm_exec_sql_text()        — retrieves SQL text (CROSS APPLY)
- sys.dm_exec_sessions          — current sessions
- sys.dm_os_wait_stats          — wait type statistics
- sys.dm_tran_locks             — current lock information
- sys.dm_db_index_usage_stats   — index seek/scan counts
- sys.dm_db_missing_index_*     — missing index recommendations
- sys.dm_db_index_physical_stats() — fragmentation analysis
- sys.indexes, sys.tables, sys.schemas — schema metadata
- sys.database_files, sys.master_files — file sizes`,

      oracle: `
Key dynamic views:
- v$session           — active sessions
- v$sql               — cached SQL statements with stats
- v$session_wait      — current wait events
- v$lock              — lock information
- v$sysstat           — system statistics
- v$event_name        — wait event names
- dba_segments        — space usage by segment/table
- dba_tables          — table metadata
- dba_indexes         — index metadata
- dba_tablespace_usage_metrics — tablespace utilization
- dba_objects         — all database objects
Use FETCH FIRST n ROWS ONLY for pagination.`,

      sqlite: `
Available PRAGMAs for admin queries:
- PRAGMA integrity_check       — corruption check
- PRAGMA page_count            — number of pages
- PRAGMA page_size             — bytes per page
- PRAGMA freelist_count        — unused pages
- PRAGMA table_info(name)      — columns of a table
- PRAGMA index_list(name)      — indexes on a table
- PRAGMA foreign_key_list(name)— foreign keys
- PRAGMA journal_mode          — WAL/DELETE/etc.
- PRAGMA wal_checkpoint        — WAL info
Also query sqlite_master / sqlite_schema for schema info.
SQLite has minimal server-side monitoring — most DBA info is schema-level.`,
    };

    return `You are a database administrator assistant for DBeer. Your job is to write SQL queries that inspect the health, performance, and storage of the ${engine.toUpperCase()} database.

DATABASE ENGINE: ${engine.toUpperCase()}
${views[engine]}

RULES:
1. Only generate SELECT, WITH (CTE), SHOW, DESCRIBE, EXPLAIN, or PRAGMA statements.
2. NEVER generate any data modification or DDL (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE, EXEC, CALL).
3. If the user asks for an action that modifies data or schema, refuse and explain.
4. Use system views/DMVs/PRAGMAs listed above when appropriate.
5. Limit result sets — use LIMIT / TOP / FETCH FIRST to avoid returning millions of rows.
6. Prefer human-readable sizes (pg_size_pretty, /1024/1024 MB conversions).
7. Include useful derived columns (ratios, percentages, formatted sizes).

RESPONSE FORMAT — respond ONLY with this JSON (no markdown, no code fences):
{
  "sql": "THE ADMIN QUERY",
  "explanation": "What this query shows and how to interpret the results",
  "isReadOnly": true,
  "suggestedFollowUps": ["optional follow-up suggestion 1", "optional follow-up 2"]
}`;
  }

  protected parseResponse(text: string): NLToSQLResponse {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as NLToSQLResponse;
    return {
      sql: parsed.sql || '',
      explanation: parsed.explanation || '',
      isDestructive: false,
      suggestedFollowUps: parsed.suggestedFollowUps,
      chart: parsed.chart || undefined,
    };
  }

  private getDialectInfo(engine: DatabaseEngine): string {
    const dialects: Record<DatabaseEngine, string> = {
      postgresql: `- Use ILIKE for case-insensitive matching\n- Use LIMIT/OFFSET for pagination\n- String concatenation with ||\n- Use :: for type casting\n- Date functions: NOW(), CURRENT_DATE, EXTRACT(), DATE_TRUNC()\n- Supports CTEs, window functions, LATERAL joins`,
      mysql: `- Use LIKE (case-insensitive by default)\n- Use LIMIT for pagination\n- String concatenation with CONCAT()\n- Use CAST() for type casting\n- Date functions: NOW(), CURDATE(), DATE_FORMAT(), DATEDIFF()\n- Supports CTEs (MySQL 8+)`,
      sqlserver: `- Use TOP or OFFSET/FETCH NEXT for pagination\n- String concatenation with + or CONCAT()\n- Use CAST() or CONVERT() for type casting\n- Date functions: GETDATE(), DATEADD(), DATEDIFF(), FORMAT()\n- Use square brackets [] for reserved word identifiers\n- Supports CTEs, window functions, CROSS/OUTER APPLY`,
      oracle: `- Use FETCH FIRST n ROWS ONLY (12c+) or ROWNUM for pagination\n- String concatenation with ||\n- Use TO_CHAR(), TO_NUMBER(), TO_DATE() for type casting\n- Date functions: SYSDATE, SYSTIMESTAMP, ADD_MONTHS()\n- Supports CTEs, window functions, CONNECT BY for hierarchical queries`,
      sqlite: `- Use LIMIT/OFFSET for pagination\n- String concatenation with ||\n- Limited type casting with CAST()\n- Date functions: DATE(), TIME(), DATETIME(), STRFTIME()\n- Supports CTEs and window functions (3.25+)\n- Dynamic typing`,
    };
    return dialects[engine];
  }

  private formatSchema(schema: SchemaInfo): string {
    const lines: string[] = [];
    for (const table of schema.tables) {
      const cols = table.columns.map(c => {
        const flags: string[] = [];
        if (c.isPrimaryKey) flags.push('PK');
        if (c.isForeignKey) flags.push('FK');
        if (!c.nullable) flags.push('NOT NULL');
        return `    ${c.name} ${c.type}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
      });
      const fkLines = (table.foreignKeys || []).map(fk =>
        `    FK: ${fk.column} → ${fk.referencedTable}(${fk.referencedColumn})`
      );
      const prefix = table.schema && !['public', 'main', 'dbo'].includes(table.schema)
        ? `${table.schema}.` : '';
      lines.push(`TABLE ${prefix}${table.name}:`, ...cols);
      if (fkLines.length) { lines.push('  FOREIGN KEYS:', ...fkLines); }
      lines.push('');
    }
    if (schema.views?.length) {
      for (const view of schema.views) {
        lines.push(`VIEW ${view.name}:`, ...view.columns.map(c => `    ${c.name} ${c.type}`), '');
      }
    }
    return lines.join('\n');
  }
}
