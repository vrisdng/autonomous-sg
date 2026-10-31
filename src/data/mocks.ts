import { Place } from '../types';

export const mrtStations = [
  'Ang Mo Kio', 'Bedok', 'Bishan', 'Boon Lay', 'Bugis', 'Buona Vista',
  'Caldecott', 'Changi Airport', 'Chinatown', 'Choa Chu Kang', 'City Hall',
  'Clementi', 'Dhoby Ghaut', 'Eunos', 'HarbourFront', 'Hougang', 'Joo Koon',
  'Jurong East', 'Kallang', 'Khatib', 'Lavender', 'Little India', 'MacPherson',
  'Marina Bay', 'Newton', 'Orchard', 'Outram Park', 'Paya Lebar', 'Punggol',
  'Queenstown', 'Raffles Place', 'Redhill', 'Serangoon', 'Somerset', 'Tampines',
  'Tanah Merah', 'Tiong Bahru', 'Toa Payoh', 'Woodlands', 'Yishun',
] as const;

export const stationPoints: Record<string, { x: number; y: number }> = {
  'Ang Mo Kio': { x: 58, y: 70 }, Bedok: { x: 78, y: 43 }, Bishan: { x: 55, y: 61 }, 'Boon Lay': { x: 15, y: 47 }, Bugis: { x: 58, y: 39 }, 'Buona Vista': { x: 38, y: 43 },
  Caldecott: { x: 51, y: 56 }, 'Changi Airport': { x: 96, y: 40 }, Chinatown: { x: 52, y: 33 }, 'Choa Chu Kang': { x: 25, y: 72 }, 'City Hall': { x: 56, y: 36 }, Clementi: { x: 30, y: 45 },
  'Dhoby Ghaut': { x: 53, y: 43 }, Eunos: { x: 70, y: 44 }, HarbourFront: { x: 46, y: 24 }, Hougang: { x: 69, y: 65 }, 'Joo Koon': { x: 6, y: 47 }, 'Jurong East': { x: 23, y: 48 },
  Kallang: { x: 63, y: 42 }, Khatib: { x: 53, y: 86 }, Lavender: { x: 61, y: 43 }, 'Little India': { x: 55, y: 48 }, MacPherson: { x: 68, y: 52 }, 'Marina Bay': { x: 55, y: 27 },
  Newton: { x: 51, y: 51 }, Orchard: { x: 48, y: 45 }, 'Outram Park': { x: 49, y: 32 }, 'Paya Lebar': { x: 70, y: 49 }, Punggol: { x: 75, y: 84 }, Queenstown: { x: 41, y: 41 },
  'Raffles Place': { x: 54, y: 31 }, Redhill: { x: 44, y: 38 }, Serangoon: { x: 64, y: 62 }, Somerset: { x: 51, y: 44 }, Tampines: { x: 85, y: 50 }, 'Tanah Merah': { x: 83, y: 43 },
  'Tiong Bahru': { x: 46, y: 35 }, 'Toa Payoh': { x: 55, y: 57 }, Woodlands: { x: 43, y: 94 }, Yishun: { x: 52, y: 82 },
};

export const supperSpots: Place[] = [
  {
    id: 'swee-choon',
    name: 'Swee Choon',
    area: 'Jalan Besar',
    nearestStation: 'Jalan Besar MRT',
    detail: 'A fair midpoint for west + east friends',
    openUntil: '4:00 am',
    tags: ['Dim sum', 'Group-friendly'],
    point: { x: 59, y: 45 },
    source: 'prototype',
  },
  {
    id: 'rk-eating-house',
    name: 'RK Eating House',
    area: 'Serangoon Gardens',
    nearestStation: 'Serangoon MRT + bus',
    detail: 'Best when the north-east gang is joining',
    openUntil: '24 hours',
    tags: ['Prata', '24/7'],
    point: { x: 65, y: 66 },
    source: 'prototype',
  },
  {
    id: '897-supper-club',
    name: '89.7 Supper Club',
    area: 'Changi Village',
    nearestStation: 'Pasir Ris MRT + bus',
    detail: 'Worth the trip when nobody needs the train',
    openUntil: '24 hours',
    tags: ['Halal', 'Big menu'],
    point: { x: 97, y: 60 },
    source: 'prototype',
  },
];
