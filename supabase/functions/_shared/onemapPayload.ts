type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').slice(0, 500) : '';

export function parseTransit(value: unknown, requestedAt: string, checkedAt: string) {
  const root = record(value);
  const plan = record(root.plan);
  const candidates = Array.isArray(plan.itineraries) ? plan.itineraries : [];
  // OneMap accepts HH:mm:ss, not milliseconds. Compare against the exact
  // precision sent to the provider, otherwise valid same-second starts fail.
  const requested = Math.floor(Date.parse(requestedAt) / 1000) * 1000;
  if (!Number.isFinite(requested)) return null;
  const routes = candidates.flatMap((entry) => {
    const itinerary = record(entry);
    if (!finite(itinerary.startTime) || !finite(itinerary.endTime) || !finite(itinerary.duration)) return [];
    const start = itinerary.startTime as number;
    const end = itinerary.endTime as number;
    if (!Number.isFinite(new Date(start).getTime()) || !Number.isFinite(new Date(end).getTime()) || start < requested || end <= start || (itinerary.duration as number) <= 0) return [];
    const legs = Array.isArray(itinerary.legs) ? itinerary.legs.map(record) : [];
    if (!legs.length || legs.some((leg) => !finite(leg.duration) || !finite(leg.startTime) || !finite(leg.endTime) || !text(leg.mode))) return [];
    if (legs.some((leg,index) => (leg.duration as number) < 0 || (leg.startTime as number) < start || (leg.endTime as number) > end || (leg.endTime as number) < (leg.startTime as number) || (index > 0 && (leg.startTime as number) < (legs[index-1]!.endTime as number)))) return [];
    // The provider can return long walking-only trips when no transit is available.
    if (!legs.some((leg) => leg.transitLeg === true || ['BUS', 'RAIL', 'SUBWAY', 'TRAM'].includes(text(leg.mode)))) return [];
    return [{
      startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(),
      durationSeconds: itinerary.duration as number, source: 'onemap' as const, checkedAt,
      steps: legs.map((leg) => {
        const from = text(record(leg.from).name);
        const to = text(record(leg.to).name);
        const mode = text(leg.mode);
        const route = text(leg.routeLongName) || text(leg.route);
        const headsign = text(leg.headsign);
        const rawStop = text(record(leg.from).stopCode) || text(record(leg.from).stopId);
        const stopMatch = rawStop.match(/(?:^|:)(\d{5})$/);
        const alightMatch = (text(record(leg.to).stopCode)||text(record(leg.to).stopId)).match(/(?:^|:)(\d{5})$/);
        const service = text(leg.routeShortName) || text(leg.route);
        return { mode, from, to, durationSeconds: leg.duration as number,
          ...(mode==='BUS' && stopMatch && /^[A-Za-z0-9]{1,8}$/.test(service) ? {boardingStopCode:stopMatch[1],serviceNo:service} : {}),
          ...(mode==='BUS' && alightMatch ? {alightingStopCode:alightMatch[1]} : {}),
          startAt: new Date(leg.startTime as number).toISOString(), endAt: new Date(leg.endTime as number).toISOString(),
          instruction: mode === 'WALK' ? `Walk from ${from} to ${to}` : `${route || mode}${headsign ? ` towards ${headsign}` : ''}`,
        };
      }),
    }];
  });
  return routes.sort((a, b) => Date.parse(a.endAt) - Date.parse(b.endAt))[0] ?? null;
}

export function searchPayload(value: unknown) {
  const root = record(value);
  return (Array.isArray(root.results) ? root.results : []).flatMap((entry) => {
    const row = record(entry);
    const latitude = Number(row.LATITUDE);
    const longitude = Number(row.LONGITUDE);
    const label = text(row.ADDRESS) || text(row.SEARCHVAL);
    return label && latitude >= 1.1 && latitude <= 1.6 && longitude >= 103.5 && longitude <= 104.2 ? [{ label, latitude, longitude }] : [];
  }).slice(0, 8);
}

export function singaporeRouteParams(timestamp: string) {
  const value = new Date(Date.parse(timestamp) + 8 * 3600_000).toISOString();
  return { date: `${value.slice(5, 7)}-${value.slice(8, 10)}-${value.slice(0, 4)}`, time: value.slice(11, 19) };
}
