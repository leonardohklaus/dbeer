import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../providers/AppProvider';
import { Send, Loader2, Sparkles, RotateCcw, ShieldCheck } from 'lucide-react';

export function QueryInput() {
  const { state, dispatch, actions } = useApp();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isConnected = state.activeConnectionId &&
    state.connectionStatuses[state.activeConnectionId]?.connected;

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || !isConnected) return;
    await actions.executeNL(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const placeholder = isConnected
    ? 'Ask anything... "Show me the top 10 customers by revenue" or "How many orders this month?"'
    : 'Connect to a database to start querying...';

  return (
    <div style={{ borderTop: '1px solid var(--surface-3)', backgroundColor: 'var(--surface-1)' }} className="backdrop-blur-sm p-4">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-forge-600/20 text-forge-300">
            <Sparkles size={12} />
            Natural Language
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck size={10} />
            Read-only
          </div>
        </div>

        {state.conversationHistory.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_CONVERSATION' })}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw size={12} />
            Clear chat
          </button>
        )}
      </div>

      {/* Input area */}
      <div className={`relative glow-input rounded-xl transition-all duration-200
        ${!isConnected ? 'opacity-50' : ''}`}
        style={{ border: '1px solid var(--surface-4)', backgroundColor: 'var(--surface-2)' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!isConnected || state.loading.querying}
          rows={1}
          className="w-full bg-transparent px-4 py-3 pr-14 text-sm placeholder-txt-faint outline-none resize-none font-sans"
          style={{ color: 'var(--text-primary)' }}
        />

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || !isConnected || state.loading.querying}
          className="absolute right-2 bottom-2 p-2 rounded-lg transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed
            bg-forge-600 text-white hover:bg-forge-500 active:scale-95
            shadow-lg shadow-forge-600/20"
        >
          {state.loading.querying ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      {/* Warning display */}
      {state.currentResult?.warning && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          {state.currentResult.warning}
        </div>
      )}
    </div>
  );
}
