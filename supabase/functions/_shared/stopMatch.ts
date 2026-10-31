export function matchStop(point: {latitude:number;longitude:number}|undefined, rows: any[]): string|undefined {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
  const nearby = rows.map(r => ({ code: String(r.BusStopCode), metres: Math.hypot((Number(r.Latitude)-point.latitude)*111320,(Number(r.Longitude)-point.longitude)*111280) })).filter(r => /^\d{5}$/.test(r.code)&&Number.isFinite(r.metres)).sort((a,b)=>a.metres-b.metres);
  // Reject close competing stops (opposite road / interchange platforms), not just the closest.
  if (nearby[0] && nearby[0].metres <= 60 && (!nearby[1] || nearby[1].metres-nearby[0].metres > 20)) return nearby[0].code;
}
