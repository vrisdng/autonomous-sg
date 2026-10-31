// Pure schedule interpretation. No fabricated trips and no direction inferred from proximity.
export type Row = Record<string,string>;
export type LegQuery = {mode:string;from:string;to:string;boardingStopCode?:string;alightingStopCode?:string;serviceNo?:string};
export type ServiceLimit = {status:'available'|'unavailable';lastAt?:string;arrivalAt?:string;direction?:string;reason?:string;basis?:string};
export function csv(text:string):Row[]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){rows.push(row);row=[];}}else cell+=c;}
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}if(quoted)throw new Error('Unreadable timetable CSV');
 const headers=rows.shift()?.map(h=>h.replace(/^\uFEFF/,''))??[];
 return rows.filter(r=>r.length===headers.length).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]!])));
}
export function serviceDay(now:number){const local=new Date(now+8*3600000);if(local.getUTCHours()<4)local.setUTCDate(local.getUTCDate()-1);return local.toISOString().slice(0,10);}
export function scheduleTime(day:string,value:string,rollSmallHours=false){
 const m=value.match(/^(\d{1,2}):?(\d{2})(?::(\d{2}))?$/);if(!m)return NaN;
 let h=Number(m[1]);const minute=Number(m[2]),second=Number(m[3]??0);if(h>47||minute>59||second>59)return NaN;
 if(rollSmallHours&&h<4)h+=24;return Date.parse(day+'T00:00:00+08:00')+(h*3600+minute*60+second)*1000;
}
// Gazetted dates checked against MOM 16 Sep 2026. Beyond coverage fail closed.
const holidays=new Set(['2026-01-01','2026-02-17','2026-02-18','2026-03-21','2026-04-03','2026-05-01','2026-05-27','2026-05-31','2026-06-01','2026-08-09','2026-08-10','2026-11-08','2026-11-09','2026-12-25','2027-01-01','2027-02-06','2027-02-07','2027-02-08','2027-03-10','2027-03-26','2027-05-01','2027-05-17','2027-05-20','2027-08-09','2027-10-28','2027-12-25']);
export const holidayUncertain=(day:string)=>!/^202[67]-/.test(day)||holidays.has(day);
const unavailable=(reason:string):ServiceLimit=>({status:'unavailable',reason});
export function busLimit(rows:Row[],q:LegQuery,day:string):ServiceLimit{
 if(!q.boardingStopCode||!q.alightingStopCode||!q.serviceNo)return unavailable('Exact boarding/alighting stop and service needed.');
 if(holidayUncertain(day))return unavailable('Holiday service or calendar coverage needs operator confirmation.');
 const weekday=new Date(day+'T12:00:00Z').getUTCDay(),field=(weekday===0?'SUN':weekday===6?'SAT':'WD')+'_LastBus';
 const service=rows.filter(r=>r.ServiceNo===q.serviceNo),pairs: {a:Row;b:Row}[]=[];
 for(const a of service.filter(r=>r.BusStopCode===q.boardingStopCode))for(const b of service.filter(r=>r.BusStopCode===q.alightingStopCode&&r.Direction===a.Direction&&Number(r.StopSequence)>Number(a.StopSequence)))pairs.push({a,b});
 if(pairs.length!==1)return unavailable('Bus direction/stop visit is ambiguous or not found.');
 const {a,b}=pairs[0]!,at=scheduleTime(day,a[field]??'',true),arrival=scheduleTime(day,b[field]??'',true);
 if(!Number.isFinite(at)||!Number.isFinite(arrival)||arrival<at||arrival-at>4*3600000)return unavailable('No usable last-service times for this stop pair.');
 return {status:'available',lastAt:new Date(at).toISOString(),arrivalAt:new Date(arrival).toISOString(),direction:a.Direction,basis:'Published stop-level schedule; the two stop times are not a tracked vehicle trip.'};
}
const station=(s:string)=>s.toUpperCase().replace(/\([^)]*\)/g,'').replace(/\b(MRT|LRT|STATION)\b/g,'').replace(/[^A-Z0-9]/g,'');
export function trainLimit(files:Record<string,Row[]>,q:LegQuery,day:string):ServiceLimit{
 if(holidayUncertain(day))return unavailable('Holiday train calendar needs operator confirmation.');
 const date=day.replace(/-/g,''),weekday=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(day+'T12:00Z').getUTCDay()]!;
 const active=new Set((files['calendar.txt']??[]).filter(r=>r.start_date!<=date&&r.end_date!>=date&&r[weekday]==='1').map(r=>r.service_id));
 for(const e of files['calendar_dates.txt']??[])if(e.date===date){if(e.exception_type==='1')active.add(e.service_id);else if(e.exception_type==='2')active.delete(e.service_id);}
 const stops=files['stops.txt']??[],from=new Set(stops.filter(s=>station(s.stop_name!)===station(q.from)).map(s=>s.stop_id)),to=new Set(stops.filter(s=>station(s.stop_name!)===station(q.to)).map(s=>s.stop_id));
 if(!from.size||!to.size||station(q.from)===station(q.to))return unavailable('Train stations could not be matched exactly.');
 const trips=new Map((files['trips.txt']??[]).filter(t=>active.has(t.service_id)).map(t=>[t.trip_id,t]));
 const points=new Map<string,Row[]>();
 for(const s of files['stop_times.txt']??[])if(trips.has(s.trip_id)&&(from.has(s.stop_id)||to.has(s.stop_id))){const a=points.get(s.trip_id!)??[];a.push(s);points.set(s.trip_id!,a);}
 let best:ServiceLimit|undefined,bestAt=-Infinity;const lines=new Set<string>();
 for(const [trip,pointsInTrip] of points)for(const a of pointsInTrip.filter(s=>from.has(s.stop_id)&&s.pickup_type!=='1'))for(const b of pointsInTrip.filter(s=>to.has(s.stop_id)&&s.drop_off_type!=='1'&&Number(s.stop_sequence)>Number(a.stop_sequence))){
  const at=scheduleTime(day,a.departure_time!),arrival=scheduleTime(day,b.arrival_time!);
  if(Number.isFinite(at)&&Number.isFinite(arrival)&&arrival>=at&&arrival<Date.parse(day+'T00:00+08:00')+28*3600000){lines.add((trips.get(trip)?.route_id??'unknown').split('_')[0]!);if(at<=bestAt)continue;bestAt=at;best={status:'available',lastAt:new Date(at).toISOString(),arrivalAt:new Date(arrival).toISOString(),direction:trips.get(trip)?.trip_headsign,basis:'LTA dated GTFS trip reaching your alighting station; scheduled, not live.'};}
 }
 if(lines.size>1)return unavailable('More than one train line serves these stations; exact line confirmation needed.');
 return best??unavailable('No dated train trip found for these stations.');
}
