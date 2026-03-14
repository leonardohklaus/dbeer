import { NLToSQLRequest, NLToSQLResponse, SchemaInfo, DatabaseEngine } from '../../../shared/types';

export abstract class BaseProvider {
  abstract translate(request: NLToSQLRequest): Promise<NLToSQLResponse>;

  protected buildSystemPrompt(schema: SchemaInfo, engine: DatabaseEngine): string {
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
