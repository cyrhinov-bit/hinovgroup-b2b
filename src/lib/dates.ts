// Clé de jour locale (YYYY-MM-DD) à partir d'une ISO UTC, évitant le décalage de fuseau UTC.
export function toLocalDayKey(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-CA');
}

// Jour local courant (YYYY-MM-DD).
export function todayLocalKey(): string {
  return toLocalDayKey(new Date());
}