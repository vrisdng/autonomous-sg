export type LiveDriveRoute = { groupId: string; durationMinutes: number; distanceKm: number; sourceTimestamp: string };

export function parseLiveDriveRoutes(value: unknown): LiveDriveRoute[] {
  if (!value || typeof value !== 'object') return [];
  const payload = value as { routes?: unknown; sourceTimestamp?: unknown };
  if (!Array.isArray(payload.routes) || typeof payload.sourceTimestamp !== 'string') return [];
  const sourceTimestamp = payload.sourceTimestamp;
  return payload.routes.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const route = raw as Record<string, unknown>;
    if (typeof route.groupId !== 'string' || typeof route.durationMinutes !== 'number' || typeof route.distanceMeters !== 'number') return [];
    return [{ groupId: route.groupId, durationMinutes: Math.max(1, Math.round(route.durationMinutes)), distanceKm: Math.round(route.distanceMeters / 100) / 10, sourceTimestamp }];
  });
}
