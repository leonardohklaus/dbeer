import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Connection management
  testConnection: (config: any) => ipcRenderer.invoke('db:test-connection', config),
  connect: (config: any) => ipcRenderer.invoke('db:connect', config),
  disconnect: (connectionId: string) => ipcRenderer.invoke('db:disconnect', connectionId),
  getSchema: (connectionId: string) => ipcRenderer.invoke('db:get-schema', connectionId),

  // Query execution
  executeRaw: (connectionId: string, sql: string) => ipcRenderer.invoke('query:execute-raw', connectionId, sql),
  executeNL: (request: any) => ipcRenderer.invoke('query:execute-nl', request),

  // NL translation
  translate: (request: any) => ipcRenderer.invoke('nl:translate', request),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: any) => ipcRenderer.invoke('settings:set', settings),

  // Connections store
  listConnections: () => ipcRenderer.invoke('connections:list'),
  saveConnection: (config: any) => ipcRenderer.invoke('connections:save', config),
  deleteConnection: (id: string) => ipcRenderer.invoke('connections:delete', id),

  // Query history (persistent)
  listHistory: () => ipcRenderer.invoke('history:list'),
  addHistory: (entry: any) => ipcRenderer.invoke('history:add', entry),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  toggleFavorite: (id: string) => ipcRenderer.invoke('history:toggle-favorite', id),

  // DBA advisor
  dbaGetCatalog: (connectionId: string) => ipcRenderer.invoke('dba:catalog', connectionId),
  dbaGetCategories: () => ipcRenderer.invoke('dba:categories'),
  dbaExecute: (connectionId: string, entryId: string) => ipcRenderer.invoke('dba:execute', connectionId, entryId),

  // Theme
  setNativeTheme: (theme: string) => ipcRenderer.invoke('theme:set-native', theme),
  getSystemTheme: () => ipcRenderer.invoke('theme:get-system'),
});
