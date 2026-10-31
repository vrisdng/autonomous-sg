// Convert one complete Google itinerary; never splice unrelated transit services.
type Point = { latitude: number; longitude: number };
type Stop = { name?: string; location?: { latLng?: Point } };
type Step = { travelMode?: string; staticDuration?: string; navigationInstruction?: { instructions?: string }; transitDetails?: { stopDetails?: { departureStop?: Stop; arrivalStop?: Stop; departureTime?: string; arrivalTime?: string }; transitLine?: { name?: string; nameShort?: string; vehicle?: { type?: string } }; headsign?: string } };
export function parseGoogleTransit(data: any, requestedAt: string, checkedAt: string) {
  for (const route of data.routes ?? []) {
    const raw: Step[] = (route.legs ?? []).flatMap((leg: any) => leg.steps ?? []);
    const first = raw.findIndex(s => s.travelMode === 'TRANSIT');
    if (first < 0) continue;
    const seconds = (s: Step) => /^\d+(\.\d+)?s$/.test(s.staticDuration ?? '') ? Number(s.staticDuration!.slice(0, -1)) : NaN;
    const firstTime = Date.parse(raw[first]!.transitDetails?.stopDetails?.departureTime ?? '');
    const start = firstTime - raw.slice(0, first).reduce((sum, s) => sum + seconds(s) * 1000, 0);
    if (!Number.isFinite(start) || start < Date.parse(requestedAt) - 1000) continue;
    let cursor = start, valid = true;
    const steps = raw.map(s => {
      const t = s.transitDetails, stops = t?.stopDetails;
      const begin = s.travelMode === 'TRANSIT' ? Date.parse(stops?.departureTime ?? '') : cursor;
      const end = s.travelMode === 'TRANSIT' ? Date.parse(stops?.arrivalTime ?? '') : begin + seconds(s) * 1000;
      if (!Number.isFinite(begin) || !Number.isFinite(end) || begin < cursor || end < begin || !['WALK', 'TRANSIT'].includes(s.travelMode ?? '')) valid = false;
      cursor = end;
      const vehicle = t?.transitLine?.vehicle?.type;
      const mode = s.travelMode === 'WALK' ? 'WALK' : vehicle === 'BUS' || vehicle === 'INTERCITY_BUS' ? 'BUS' : vehicle === 'SUBWAY' || vehicle === 'METRO_RAIL' ? 'SUBWAY' : vehicle === 'TRAM' || vehicle === 'LIGHT_RAIL' ? 'TRAM' : 'RAIL';
      const line = t?.transitLine?.nameShort || t?.transitLine?.name;
      return { mode, from: stops?.departureStop?.name ?? 'Walk', to: stops?.arrivalStop?.name ?? 'Next stop',
        instruction: t ? `Take ${line || 'train'}${t.headsign ? ` towards ${t.headsign}` : ''}` : s.navigationInstruction?.instructions || 'Walk to the next stop',
        ...(mode === 'BUS' && line && /^[A-Za-z0-9]{1,8}$/.test(line) ? { serviceNo: line } : {}),
        ...(stops?.departureStop?.location?.latLng ? { boardingLocation: stops.departureStop.location.latLng } : {}),
        ...(stops?.arrivalStop?.location?.latLng ? { alightingLocation: stops.arrivalStop.location.latLng } : {}),
        startAt: Number.isFinite(begin) ? new Date(begin).toISOString() : '', endAt: Number.isFinite(end) ? new Date(end).toISOString() : '', durationSeconds: (end - begin) / 1000 };
    });
    if (valid && steps.length) return { startAt: new Date(start).toISOString(), endAt: new Date(cursor).toISOString(), durationSeconds: (cursor - start) / 1000, steps, source: 'google' as const, checkedAt };
  }
  return undefined;
}
