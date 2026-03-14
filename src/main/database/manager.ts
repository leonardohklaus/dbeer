import { DatabaseAdapter } from './adapter';
import { ConnectionConfig, ConnectionStatus, SchemaInfo } from '../../shared/types';

export class ConnectionManager {
  private adapters = new Map<string, DatabaseAdapter>();
  private schemas = new Map<string, SchemaInfo>();

  // Adapters are loaded lazily so a broken native module (e.g. oracledb
  // without Oracle Client) doesn't crash the app before the window opens.
  createAdapter(config: ConnectionConfig): DatabaseAdapter {
    switch (config.engine) {
      case 'postgresql': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PostgreSQLAdapter } = require('./postgresql');
        return new PostgreSQLAdapter(config);
      }
      case 'mysql': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MySQLAdapter } = require('./mysql');
        return new MySQLAdapter(config);
      }
      case 'sqlserver': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SQLServerAdapter } = require('./sqlserver');
        return new SQLServerAdapter(config);
      }
      case 'oracle': {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { OracleAdapter } = require('./oracle');
          return new OracleAdapter(config);
        } catch {
          throw new Error(
            'Oracle driver failed to load. ' +
            'Make sure oracledb is installed and Oracle Instant Client is available on your system.'
          );
        }
      }
      case 'sqlite': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SQLiteAdapter } = require('./sqlite');
        return new SQLiteAdapter(config);
      }
      default:
        throw new Error(`Unsupported database engine: ${config.engine}`);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionStatus> {
    const adapter = this.createAdapter(config);
    try {
      const result = await adapter.testConnection();
      return {
        id: config.id,
        connected: result.success,
        error: result.error,
        serverVersion: result.version,
        latencyMs: result.latencyMs,
      };
    } finally {
      try { await adapter.disconnect(); } catch {}
    }
  }

  async connect(config: ConnectionConfig): Promise<ConnectionStatus> {
    // Disconnect if already connected
    if (this.adapters.has(config.id)) {
      await this.disconnect(config.id);
    }

    const adapter = this.createAdapter(config);
    try {
      const result = await adapter.testConnection();
      if (result.success) {
        // Reconnect for actual use (testConnection disconnects internally)
        await adapter.connect();
        this.adapters.set(config.id, adapter);

        // Pre-load schema
        try {
          const schema = await adapter.getSchema();
          this.schemas.set(config.id, schema);
        } catch {
          // Schema loading is non-fatal
        }
      }
      return {
        id: config.id,
        connected: result.success,
        error: result.error,
        serverVersion: result.version,
        latencyMs: result.latencyMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { id: config.id, connected: false, error: message };
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const adapter = this.adapters.get(connectionId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(connectionId);
      this.schemas.delete(connectionId);
    }
  }

  async disconnectAll(): Promise<void> {
    const ids = [...this.adapters.keys()];
    await Promise.allSettled(ids.map(id => this.disconnect(id)));
  }

  getAdapter(connectionId: string): DatabaseAdapter | undefined {
    return this.adapters.get(connectionId);
  }

  getSchema(connectionId: string): SchemaInfo | undefined {
    return this.schemas.get(connectionId);
  }

  async refreshSchema(connectionId: string): Promise<SchemaInfo> {
    const adapter = this.adapters.get(connectionId);
    if (!adapter) throw new Error(`Connection ${connectionId} not found`);
    const schema = await adapter.getSchema();
    this.schemas.set(connectionId, schema);
    return schema;
  }

  isConnected(connectionId: string): boolean {
    return this.adapters.has(connectionId);
  }
}
