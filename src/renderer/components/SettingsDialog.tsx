import React, { useState, useEffect } from 'react';
import { useApp } from '../providers/AppProvider';
import { X, Key, Palette, Shield, Save, Loader2, Eye, EyeOff, Sun, Moon, Monitor, Cpu, ChevronDown } from 'lucide-react';
import { AppSettings, AIProvider } from '@shared/types';

const PROVIDERS: { id: AIProvider; label: string; description: string }[] = [
  { id: 'anthropic', label: 'Anthropic Claude', description: 'claude-sonnet, claude-opus, claude-haiku' },
  { id: 'openai',    label: 'OpenAI',           description: 'GPT-4o, GPT-4o mini, o3-mini' },
  { id: 'gemini',    label: 'Google Gemini',    description: 'gemini-2.0-flash, gemini-1.5-pro' },
  { id: 'groq',      label: 'Groq',             description: 'Llama 3.3 · gratuito · ultra-rápido' },
  { id: 'ollama',    label: 'Ollama (Local)',    description: 'llama3, deepseek-coder, mistral…' },
];

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)' },
  { value: 'claude-opus-4-20250514',   label: 'Claude Opus 4 (Most capable)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fastest)' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o',       label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o mini (Fastest / cheapest)' },
  { value: 'o3-mini',      label: 'o3-mini (Reasoning)' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash (Recommended)' },
  { value: 'gemini-1.5-pro',    label: 'Gemini 1.5 Pro (Most capable)' },
  { value: 'gemini-1.5-flash',  label: 'Gemini 1.5 Flash (Fastest)' },
];

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Recommended)' },
  { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant (Ultra-fast)' },
  { value: 'llama3-70b-8192',         label: 'Llama 3 70B' },
  { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B' },
  { value: 'gemma2-9b-it',            label: 'Gemma 2 9B' },
];

type FormState = Pick<AppSettings,
  | 'aiProvider'
  | 'anthropicApiKey' | 'claudeModel'
  | 'openaiApiKey'    | 'openaiModel'
  | 'geminiApiKey'    | 'geminiModel'
  | 'ollamaBaseUrl'   | 'ollamaModel'
  | 'groqApiKey'      | 'groqModel'
  | 'theme' | 'maxRowsPreview'
>;

export function SettingsDialog() {
  const { state, dispatch, actions, theme } = useApp();
  const [form, setForm] = useState<FormState>({
    aiProvider: 'anthropic',
    anthropicApiKey: '',
    claudeModel: 'claude-sonnet-4-20250514',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    groqApiKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    theme: 'dark',
    maxRowsPreview: 500,
  });
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.settings) {
      const s = state.settings;
      setForm({
        aiProvider:      s.aiProvider      || 'anthropic',
        anthropicApiKey: s.anthropicApiKey || '',
        claudeModel:     s.claudeModel     || 'claude-sonnet-4-20250514',
        openaiApiKey:    s.openaiApiKey    || '',
        openaiModel:     s.openaiModel     || 'gpt-4o',
        geminiApiKey:    s.geminiApiKey    || '',
        geminiModel:     s.geminiModel     || 'gemini-2.0-flash',
        groqApiKey:      s.groqApiKey      || '',
        groqModel:       s.groqModel       || 'llama-3.3-70b-versatile',
        ollamaBaseUrl:   s.ollamaBaseUrl   || 'http://localhost:11434',
        ollamaModel:     s.ollamaModel     || 'llama3',
        theme:           s.theme           || 'dark',
        maxRowsPreview:  s.maxRowsPreview  || 500,
      });
    }
  }, [state.settings]);

  if (!state.settingsOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    await actions.saveSettings(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const close = () => dispatch({ type: 'SET_SETTINGS_OPEN', payload: false });

  const themeOptions = [
    { value: 'dark'   as const, label: 'Dark',   icon: Moon,    desc: 'Easy on the eyes' },
    { value: 'light'  as const, label: 'Light',  icon: Sun,     desc: 'Clean & bright' },
    { value: 'system' as const, label: 'System', icon: Monitor, desc: 'Follows OS setting' },
  ];

  const inputStyle = { color: 'var(--text-primary)', border: '1px solid var(--surface-4)', backgroundColor: 'var(--surface-2)' };

  const ApiKeyField = ({
    label, value, show, onToggle, onChange, placeholder,
  }: {
    label: string;
    value: string;
    show: boolean;
    onToggle: () => void;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="db-input pr-10 text-sm"
        />
        <button
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
          style={{ color: 'var(--text-muted)' }}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={close}
    >
      <div
        className="db-panel w-full max-w-lg mx-4 animate-in shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--surface-3)' }}>
          <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <button onClick={close} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Appearance */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette size={14} className="text-forge-400" />
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Appearance</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(opt => {
                const Icon = opt.icon;
                const isActive = form.theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setForm(p => ({ ...p, theme: opt.value }))}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200"
                    style={{
                      border: `1.5px solid ${isActive ? '#0c93e7' : 'var(--surface-4)'}`,
                      backgroundColor: isActive ? 'rgba(12, 147, 231, 0.08)' : 'var(--surface-2)',
                      color: isActive ? '#0c93e7' : 'var(--text-muted)',
                    }}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Provider */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-forge-400" />
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI Provider</label>
            </div>

            {/* Provider selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PROVIDERS.map(p => {
                const isActive = form.aiProvider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setForm(prev => ({ ...prev, aiProvider: p.id }))}
                    className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl transition-all duration-200 text-left"
                    style={{
                      border: `1.5px solid ${isActive ? '#0c93e7' : 'var(--surface-4)'}`,
                      backgroundColor: isActive ? 'rgba(12, 147, 231, 0.08)' : 'var(--surface-2)',
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: isActive ? '#0c93e7' : 'var(--text-primary)' }}>
                      {p.label}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{p.description}</span>
                  </button>
                );
              })}
            </div>

            {/* Provider-specific config */}
            <div className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-3)' }}>
              {form.aiProvider === 'anthropic' && (
                <>
                  <ApiKeyField
                    label="API Key"
                    value={form.anthropicApiKey}
                    show={showAnthropicKey}
                    onToggle={() => setShowAnthropicKey(v => !v)}
                    onChange={v => setForm(p => ({ ...p, anthropicApiKey: v }))}
                    placeholder="sk-ant-..."
                  />
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Model</label>
                    <div className="relative">
                      <select
                        value={form.claudeModel}
                        onChange={e => setForm(p => ({ ...p, claudeModel: e.target.value }))}
                        className="db-input text-sm appearance-none pr-8"
                      >
                        {ANTHROPIC_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Your key is stored locally and never sent anywhere except Anthropic's API.
                  </p>
                </>
              )}

              {form.aiProvider === 'openai' && (
                <>
                  <ApiKeyField
                    label="API Key"
                    value={form.openaiApiKey}
                    show={showOpenAIKey}
                    onToggle={() => setShowOpenAIKey(v => !v)}
                    onChange={v => setForm(p => ({ ...p, openaiApiKey: v }))}
                    placeholder="sk-..."
                  />
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Model</label>
                    <div className="relative">
                      <select
                        value={form.openaiModel}
                        onChange={e => setForm(p => ({ ...p, openaiModel: e.target.value }))}
                        className="db-input text-sm appearance-none pr-8"
                      >
                        {OPENAI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Your key is stored locally and never sent anywhere except OpenAI's API.
                  </p>
                </>
              )}

              {form.aiProvider === 'gemini' && (
                <>
                  <ApiKeyField
                    label="API Key"
                    value={form.geminiApiKey}
                    show={showGeminiKey}
                    onToggle={() => setShowGeminiKey(v => !v)}
                    onChange={v => setForm(p => ({ ...p, geminiApiKey: v }))}
                    placeholder="AIza..."
                  />
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Model</label>
                    <div className="relative">
                      <select
                        value={form.geminiModel}
                        onChange={e => setForm(p => ({ ...p, geminiModel: e.target.value }))}
                        className="db-input text-sm appearance-none pr-8"
                      >
                        {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Get your API key at Google AI Studio. Stored locally.
                  </p>
                </>
              )}

              {form.aiProvider === 'groq' && (
                <>
                  <ApiKeyField
                    label="API Key"
                    value={form.groqApiKey}
                    show={showGroqKey}
                    onToggle={() => setShowGroqKey(v => !v)}
                    onChange={v => setForm(p => ({ ...p, groqApiKey: v }))}
                    placeholder="gsk_..."
                  />
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Model</label>
                    <div className="relative">
                      <select
                        value={form.groqModel}
                        onChange={e => setForm(p => ({ ...p, groqModel: e.target.value }))}
                        className="db-input text-sm appearance-none pr-8"
                      >
                        {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Groq oferece uma camada gratuita generosa com inferência ultra-rápida. Obtenha sua chave em console.groq.com.
                  </p>
                </>
              )}

              {form.aiProvider === 'ollama' && (
                <>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Base URL</label>
                    <input
                      type="text"
                      value={form.ollamaBaseUrl}
                      onChange={e => setForm(p => ({ ...p, ollamaBaseUrl: e.target.value }))}
                      placeholder="http://localhost:11434"
                      className="db-input text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Model</label>
                    <input
                      type="text"
                      value={form.ollamaModel}
                      onChange={e => setForm(p => ({ ...p, ollamaModel: e.target.value }))}
                      placeholder="llama3, deepseek-coder, mistral…"
                      className="db-input text-sm"
                    />
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Runs 100% locally — no API key needed. Requires Ollama to be running.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Max rows */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Key size={14} className="text-forge-400" />
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Max Rows Preview</label>
            </div>
            <input
              type="number"
              value={form.maxRowsPreview}
              onChange={e => setForm(p => ({ ...p, maxRowsPreview: parseInt(e.target.value) || 100 }))}
              min={10} max={10000}
              className="db-input w-32"
            />
          </div>

          {/* Read-only notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
            <Shield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Read-Only Mode</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                DBeer only executes SELECT queries. INSERT, UPDATE, DELETE, CREATE, ALTER, DROP and any other
                data modification operations are permanently blocked — regardless of which AI provider is used.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--surface-3)' }}>
          <button onClick={close} className="db-btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="db-btn-primary">
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><Save size={14} /> Saved!</>
            ) : (
              <><Save size={14} /> Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
