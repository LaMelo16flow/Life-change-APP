export function roundPVToMultiple(pv: number): number {
  return Math.floor(pv / 30) * 30;
}
