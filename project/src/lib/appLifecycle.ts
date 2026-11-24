// Helpers that keep the app fresh without the user having to reload by hand.

const RESUME_EVENT = 'lc:resume';
const MIN_HIDDEN_MS = 15_000;

let hiddenAt: number | null = null;
let started = false;

function startResumeWatcher() {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > MIN_HIDDEN_MS) {
      hiddenAt = null;
      window.dispatchEvent(new Event(RESUME_EVENT));
    }
  });
  // Back online after a network drop: live updates may have been missed.
  window.addEventListener('online', () => window.dispatchEvent(new Event(RESUME_EVENT)));
}

/** Calls `cb` when the user comes back to the app after a while or the network returns. */
export function onAppResume(cb: () => void): () => void {
  startResumeWatcher();
  window.addEventListener(RESUME_EVENT, cb);
  return () => window.removeEventListener(RESUME_EVENT, cb);
}

/** True when the user is in the middle of typing, so a reload would lose their input. */
export function isUserBusy(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (el.isContentEditable) return true;
  if (tag === 'TEXTAREA') return (el as HTMLTextAreaElement).value.trim() !== '';
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    if (['button', 'submit', 'checkbox', 'radio', 'range', 'reset'].includes(input.type)) return false;
    // An empty field (e.g. an auto-focused login box) has nothing to lose.
    return input.value.trim() !== '';
  }
  return false;
}

/** Reload the page, bypassing the cached index.html on GitHub Pages. */
export function hardReload(version?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('v', version || Date.now().toString(36));
  window.location.replace(url.toString());
}

/** Remove the ?v= cache-busting parameter from the address bar after a reload. */
export function cleanVersionParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('v')) return;
  url.searchParams.delete('v');
  window.history.replaceState(window.history.state, '', url.toString());
}
