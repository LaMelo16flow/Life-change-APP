import { useEffect, useRef } from 'react';
import { hardReload, isUserBusy, onAppResume } from '../lib/appLifecycle';

const CHECK_EVERY_MS = 60_000;
const RELOAD_KEY = 'lc_reload_attempt';

/**
 * Detects when a new version of LC Store has been deployed and reloads the
 * page by itself. If the user is typing, it waits silently until they leave
 * the field (or the tab) so nothing they entered is lost. No banner is shown.
 */
export function AppUpdater() {
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
      if (!isUserBusy()) hardReload(version);
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

    // The home-screen app (standalone) is often resumed from memory instead of
    // being reloaded: check right away at launch and whenever it is shown again.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const first = setTimeout(check, standalone ? 0 : 3_000);
    const onPageShow = () => check();
    const interval = setInterval(check, CHECK_EVERY_MS);
    const offResume = onAppResume(check);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', onPageShow);
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
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  return null;
}
