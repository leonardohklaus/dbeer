import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface UseThemeReturn {
  theme: ThemeMode;
  resolved: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [resolved, setResolved] = useState<ResolvedTheme>('dark');

  const resolveTheme = useCallback(async (mode: ThemeMode): Promise<ResolvedTheme> => {
    if (mode === 'system') {
      try {
        return await window.api.getSystemTheme();
      } catch {
        return 'dark';
      }
    }
    return mode;
  }, []);

  const applyTheme = useCallback((resolvedTheme: ResolvedTheme) => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    setResolved(resolvedTheme);
  }, []);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    const r = await resolveTheme(mode);
    applyTheme(r);
    try {
      await window.api.setNativeTheme(mode);
    } catch {}
  }, [resolveTheme, applyTheme]);

  // Load initial theme from settings
  useEffect(() => {
    (async () => {
      try {
        const settings = await window.api.getSettings();
        const mode = settings.theme || 'dark';
        setThemeState(mode);
        const r = await resolveTheme(mode);
        applyTheme(r);
      } catch {
        applyTheme('dark');
      }
    })();
  }, [resolveTheme, applyTheme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  return { theme, resolved, setTheme };
}
