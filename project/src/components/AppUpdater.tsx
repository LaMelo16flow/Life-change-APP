import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { hardReload, isUserBusy, onAppResume } from '../lib/appLifecycle';

const CHECK_EVERY_MS = 60_000;
const RELOAD_KEY = 'lc_reload_attempt';

/**
 * Detects when a new version of LC Shop has been deployed and reloads the
 * page by itself. If the user is typing, it waits and shows a small banner
 * instead so nothing they entered is lost.
 */
export function AppUpdater() {
  const { t } = useLanguage();
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;

    const applyOrWait = (version: string) => {
      // Guard against a reload loop if the server still serves the old page
      // for a moment after a deploy: try each new version at most once per 2 min.
      try {
        const last = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || 'null') as { v: string; at: number } | null;
        if (last && last.v === version && Date.now() - last.at < 120_000) return;
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ v: version, at: Date.now() }));
      } catch {
        /* storage unavailable */
      }
      pendingRef.current = version;
      if (!isUserBusy()) {
        hardReload(version);
      } else {
        setPending(version);
      }
    };

    const check = async () => {
      if (cancelled || pendingRef.current) return;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (data.version && data.version !== __APP_VERSION__) applyOrWait(data.version);
      } catch {
        /* offline: try again later */
      }
    };

    // A lazy-loaded file from the old version no longer exists: reload to the new one.
    const onPreloadError = (e: Event) => {
      e.preventDefault();
      hardReload();
    };

    // When the user stops typing, apply a waiting update.
    const onFocusOut = () => {
      setTimeout(() => {
        if (pendingRef.current && !isUserBusy()) hardReload(pendingRef.current);
      }, 300);
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current) hardReload(pendingRef.current);
    };

    const first = setTimeout(check, 3_000);
    const interval = setInterval(check, CHECK_EVERY_MS);
    const offResume = onAppResume(check);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('focus', check);
    window.addEventListener('vite:preloadError', onPreloadError);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      offResume();
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('focus', check);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full bg-black text-white shadow-lg pl-4 pr-2 py-2 text-sm w-max max-w-[calc(100vw-2rem)]">
      <span className="whitespace-nowrap">{t('update.available')}</span>
      <button
        onClick={() => hardReload(pending)}
        className="flex shrink-0 items-center gap-1 rounded-full bg-white text-black px-3 py-1 font-medium hover:bg-gray-200"
      >
        <RefreshCw className="w-4 h-4" />
        {t('update.reload')}
      </button>
    </div>
  );
}
