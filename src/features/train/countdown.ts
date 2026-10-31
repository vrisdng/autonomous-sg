function spanLabel(minutes: number): string {
  const total = Math.ceil(Math.abs(minutes));
  if (total < 60) return `${total} min`;
  const remainder = total % 60;
  return `${Math.floor(total / 60)}h${remainder ? ` ${remainder}m` : ''}`;
}

export function countdownLabel(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const body = spanLabel(minutes);
  return minutes < 0 ? `${body} late` : body;
}

export function secondsCountdown(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) return '—';
  const late = milliseconds < 0;
  const seconds = Math.max(0, Math.ceil(Math.abs(milliseconds) / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  return late ? `−${clock}` : clock;
}
