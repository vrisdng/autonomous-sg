export type DeadlineStatus = {
  label: string;
  state: 'safe' | 'urgent' | 'due' | 'missed';
};

function formatRemaining(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} hr ${minutes} min left`;
  if (hours) return `${hours} hr left`;
  return `${minutes} min left`;
}

function fromDifference(milliseconds: number): DeadlineStatus {
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 0) return { label: 'Last train window likely passed', state: 'missed' };
  if (minutes === 0) return { label: 'Leave now — don’t say bojio', state: 'due' };
  return { label: formatRemaining(minutes), state: minutes <= 30 ? 'urgent' : 'safe' };
}

export function liveDeadlineStatus(now: Date, deadline: Date) {
  return fromDifference(deadline.getTime() - now.getTime());
}

export function prototypeDeadlineStatus(now: Date, deadlineMinutes: number): DeadlineStatus {
  const parts = new Intl.DateTimeFormat('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Singapore',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const nowMinutes = hour * 60 + minute;
  const normalizedDeadline = ((deadlineMinutes % 1440) + 1440) % 1440;

  // Before 4am still belongs to the previous supper night, so a 11pm deadline has passed.
  if (nowMinutes < 4 * 60 || nowMinutes > normalizedDeadline) {
    return { label: 'Last train window likely passed', state: 'missed' };
  }
  return fromDifference((normalizedDeadline - nowMinutes) * 60_000);
}
