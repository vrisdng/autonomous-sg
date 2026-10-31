export type LiveRouteStep = {
  mode: string;
  instruction: string;
  line?: string;
  departureStop?: string;
  arrivalStop?: string;
  departureTime?: string;
  arrivalTime?: string;
};

export type LiveJourney = {
  participantId: string;
  durationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  transfers: number;
  walkToTransitMinutes: number;
  steps: LiveRouteStep[];
  sourceTimestamp: string;
};

export function parseLiveJourneys(value: unknown): LiveJourney[] {
  if (!value || typeof value !== 'object') return [];
  const payload = value as { journeys?: unknown; sourceTimestamp?: unknown };
  if (!Array.isArray(payload.journeys) || typeof payload.sourceTimestamp !== 'string') return [];
  const sourceTimestamp = payload.sourceTimestamp;
  return payload.journeys.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const journey = raw as Record<string, unknown>;
    if (typeof journey.participantId !== 'string' || typeof journey.durationMinutes !== 'number' || typeof journey.departureTime !== 'string' || typeof journey.arrivalTime !== 'string') return [];
    const steps = Array.isArray(journey.steps) ? journey.steps.flatMap((rawStep) => {
      if (!rawStep || typeof rawStep !== 'object') return [];
      const step = rawStep as Record<string, unknown>;
      if (typeof step.mode !== 'string' || typeof step.instruction !== 'string') return [];
      return [{
        mode: step.mode,
        instruction: step.instruction,
        ...(typeof step.line === 'string' ? { line: step.line } : {}),
        ...(typeof step.departureStop === 'string' ? { departureStop: step.departureStop } : {}),
        ...(typeof step.arrivalStop === 'string' ? { arrivalStop: step.arrivalStop } : {}),
        ...(typeof step.departureTime === 'string' ? { departureTime: step.departureTime } : {}),
        ...(typeof step.arrivalTime === 'string' ? { arrivalTime: step.arrivalTime } : {}),
      }];
    }) : [];
    return [{
      participantId: journey.participantId,
      durationMinutes: Math.max(1, Math.round(journey.durationMinutes)),
      departureTime: journey.departureTime,
      arrivalTime: journey.arrivalTime,
      transfers: typeof journey.transfers === 'number' ? Math.max(0, Math.round(journey.transfers)) : 0,
      walkToTransitMinutes: typeof journey.walkToTransitMinutes === 'number' ? Math.max(0, Math.round(journey.walkToTransitMinutes)) : 0,
      steps,
      sourceTimestamp,
    }];
  });
}

export function liveLeaveBy(journey: LiveJourney, safetyMinutes: number) {
  return new Date(new Date(journey.departureTime).getTime() - (safetyMinutes + journey.walkToTransitMinutes) * 60_000);
}

export function formatLiveClock(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' });
}
