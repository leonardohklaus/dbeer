import { SchemaInfo, QueryResult, ColumnInfo, DatabaseEngine } from '../../shared/types';

export interface DatabaseAdapter {
  readonly engine: DatabaseEngine;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ success: boolean; version?: string; latencyMs: number; error?: string }>;

  getSchema(): Promise<SchemaInfo>;
  executeQuery(sql: string): Promise<{
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  }>;
}

export abstract class BaseAdapter implements DatabaseAdapter {
  abstract readonly engine: DatabaseEngine;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getSchema(): Promise<SchemaInfo>;
  abstract executeQuery(sql: string): Promise<{
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  }>;

  async testConnection(): Promise<{ success: boolean; version?: string; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      await this.connect();
      const latencyMs = Math.round(performance.now() - start);
      // Get version with a simple query
      let version: string | undefined;
      try {
        const result = await this.executeQuery(this.getVersionQuery());
        const firstRow = result.rows[0];
        if (firstRow) {
          version = String(Object.values(firstRow)[0]);
        }
      } catch {
        // version is optional
      }
      return { success: true, version, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      return { success: false, latencyMs, error: message };
    }
  }

  protected abstract getVersionQuery(): string;

  protected measureExecution<T>(fn: () => Promise<T>): Promise<{ result: T; executionTimeMs: number }> {
    return new Promise(async (resolve, reject) => {
      const start = performance.now();
      try {
        const result = await fn();
        const executionTimeMs = Math.round(performance.now() - start);
        resolve({ result, executionTimeMs });
      } catch (err) {
        reject(err);
      }
    });
  }
}
