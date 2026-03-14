import React from 'react';
import { AppProvider } from './providers/AppProvider';
import { Sidebar } from './components/Sidebar';
import { ResultsPanel } from './components/ResultsPanel';
import { QueryInput } from './components/QueryInput';
import { ConnectionDialog } from './components/ConnectionDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { HistoryPanel } from './components/HistoryPanel';
import { StatusBar } from './components/StatusBar';

export default function App() {
  return (
    <AppProvider>
      <div className="h-screen flex flex-col overflow-hidden noise-bg">
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="titlebar-drag h-12 shrink-0 flex items-center px-4" style={{ borderBottom: '1px solid var(--surface-3)' }}>
              <div className="titlebar-no-drag flex items-center gap-2 ml-auto text-xs" style={{ color: 'var(--text-faint)' }}>
                <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)' }}>⌘</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)' }}>Enter</kbd>
                <span>to send</span>
              </div>
            </div>
            <ResultsPanel />
            <QueryInput />
          </div>
        </div>
        <StatusBar />

        {/* Modals & Panels */}
        <ConnectionDialog />
        <SettingsDialog />
        <HistoryPanel />
      </div>
    </AppProvider>
  );
}
