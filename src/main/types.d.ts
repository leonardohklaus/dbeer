declare module 'oracledb' {
  interface ConnectionAttributes {
    user?: string;
    password?: string;
    connectString?: string;
  }

  interface ExecuteResult {
    rows?: any[];
    metaData?: Array<{ name: string; dbType?: number }>;
    rowsAffected?: number;
  }

  interface Connection {
    execute(sql: string, binds?: any[], options?: any): Promise<ExecuteResult>;
    close(): Promise<void>;
  }

  interface OracleDB {
    getConnection(attrs: ConnectionAttributes): Promise<Connection>;
    initOracleClient: any;
    outFormat: number;
    autoCommit: boolean;
    OUT_FORMAT_OBJECT: number;
  }

  const oracledb: OracleDB;
  export default oracledb;
  export { Connection, ConnectionAttributes };
}

declare module 'electron-store' {
  interface StoreOptions {
    name?: string;
    defaults?: Record<string, unknown>;
  }

  class Store {
    constructor(options?: StoreOptions);
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    set(obj: Record<string, unknown>): void;
    delete(key: string): void;
    clear(): void;
    has(key: string): boolean;
  }

  export default Store;
}
