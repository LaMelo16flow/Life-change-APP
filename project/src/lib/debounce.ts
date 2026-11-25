/** Runs `fn` once after a burst of calls (e.g. many live-update events at once). */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 300) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  d.cancel = () => clearTimeout(t);
  return d;
}
