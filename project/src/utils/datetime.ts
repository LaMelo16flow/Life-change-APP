// <input type="datetime-local"> works in the browser's LOCAL time.
// toISOString().slice(0, 16) gives UTC, which shifted promotions by the
// timezone offset (4 hours in Moncton).
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
