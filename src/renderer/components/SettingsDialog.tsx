import React, { useState, useEffect } from 'react';
import { useApp } from '../providers/AppProvider';
import { X, Key, Palette, Shield, Save, Loader2, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
import { AppSettings } from '@shared/types';

export function SettingsDialog() {
  const { state, dispatch, actions, theme } = useApp();
  const [form, setForm] = useState({
    anthropicApiKey: '',
    claudeModel: 'claude-sonnet-4-20250514',
    theme: 'dark' as AppSettings['theme'],
    maxRowsPreview: 500,
  });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.settings) {
      setForm({
        anthropicApiKey: state.settings.anthropicApiKey,
        claudeModel: state.settings.claudeModel,
        theme: state.settings.theme,
        maxRowsPreview: state.settings.maxRowsPreview,
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
    { value: 'dark' as const, label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { value: 'light' as const, label: 'Light', icon: Sun, desc: 'Clean & bright' },
    { value: 'system' as const, label: 'System', icon: Monitor, desc: 'Follows OS setting' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }} onClick={close}>
      <div className="db-panel w-full max-w-md mx-4 animate-in shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--surface-3)' }}>
          <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <button onClick={close} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Theme */}
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

          {/* API Key */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Key size={14} className="text-forge-400" />
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Anthropic API Key</label>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.anthropicApiKey}
                onChange={e => setForm(p => ({ ...p, anthropicApiKey: e.target.value }))}
                placeholder="sk-ant-..."
                className="db-input pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Your key is stored locally and never sent anywhere except Anthropic's API.
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>Claude Model</label>
            <select
              value={form.claudeModel}
              onChange={e => setForm(p => ({ ...p, claudeModel: e.target.value }))}
              className="db-input"
            >
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
              <option value="claude-opus-4-20250514">Claude Opus 4 (Most capable)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
            </select>
          </div>

          {/* Max rows */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>Max Rows Preview</label>
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
                DBeer only executes SELECT queries. INSERT, UPDATE, DELETE, CREATE, ALTER, DROP and any other data modification operations are permanently blocked.
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
