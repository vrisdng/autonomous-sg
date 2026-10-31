import { Place } from '../types';

// Addresses checked on the operator pages below; building coordinates resolved
// with authenticated OneMap Search on 2026-09-15. Hours are not live status.
const checked = '2026-09-15T00:00:00+08:00';
const swee = 'https://www.sweechoon.com/pages/outlet-details';
const azhar = 'https://www.al-azhar.com/';
const prata = 'https://www.mrprata.com.sg/branch/';
function venue(id: string, name: string, address: string, area: string, latitude: number, longitude: number, sourceUrl: string, detail: string): Place {
  return { id, name, address, area, latitude, longitude, sourceUrl, detail,
    nearestStation: '', point: { x: longitude, y: latitude }, tags: [],
    source: 'verified', sourceTimestamp: checked, openUntil: 'Check opening hours with the venue' };
}
// Google place IDs for card photos, matched by name and address. Nearby search only
// finds some branches, so the others borrow their chain's photos and say so on the card.
const chainPhotos: Record<string, { placeId: string; venueId: string }> = {
  swee: { placeId: 'ChIJv1DkBMgZ2jERft-n2ibNvh0', venueId: 'swee-jalan-besar' },
  azhar: { placeId: 'ChIJFykj1mEQ2jER50T02kGd1OY', venueId: 'azhar-bt' },
  prata: { placeId: 'ChIJoeKclo8a2jER_iLZQ6bBc5c', venueId: 'prata-clementi' },
  casuarina: { placeId: 'ChIJ8zToos4W2jERxon2YtEMhAM', venueId: 'casuarina' },
};
export function venuePhotoSource(id: string) {
  const chain = chainPhotos[id.split('-')[0]!];
  return chain ? { placeId: chain.placeId, sameBranch: chain.venueId === id, branch: verifiedVenues.find((venue) => venue.id === chain.venueId)!.name } : undefined;
}
export const verifiedVenues: Place[] = [
  venue('swee-jalan-besar', 'Swee Choon · Jalan Besar', '183–193 Jalan Besar, Singapore 208882', 'Jalan Besar', 1.308215131922868, 103.8569068435072, swee, 'Dim sum. Operator lists late-night service; check today’s last order on its website.'),
  venue('swee-amk', 'Swee Choon · AMK Hub', '53 Ang Mo Kio Avenue 3, #01-42, Singapore 569933', 'Ang Mo Kio', 1.369389226903445, 103.8484779659393, swee, 'Express dim sum with limited seating. Published hours differ between pages; confirm before travelling.'),
  venue('swee-t2', 'Swee Choon · Changi T2', '60 Airport Boulevard, #01-07, Terminal 2 Arrival Hall, Singapore 819643', 'Changi', 1.354969382268279, 103.9890664895108, swee, 'Public arrival hall. Operator lists 24-hour service; confirm before travelling.'),
  venue('azhar-bt', 'Al-Azhar · Bukit Timah', '11 Cheong Chin Nam Road, Singapore 599736', 'Bukit Timah', 1.342892844868913, 103.7751698775952, azhar, 'Indian and regional dishes. Check this branch’s hours with the operator.'),
  venue('azhar-tampines', 'Al-Azhar · Tampines', '201D Tampines Street 21, #01-1155, Singapore 524201', 'Tampines', 1.352262314253157, 103.9535864913577, azhar, 'Operator-listed branch; postal code corrected against OneMap. Confirm branch opening hours.'),
  venue('azhar-geylang', 'Al-Azhar · Geylang', '970 Geylang Road, Singapore 423492', 'Geylang', 1.315748548256438, 103.8974245910972, azhar, 'Operator-listed Geylang branch. Confirm opening hours before leaving.'),
  venue('prata-evans', 'Mr Prata · Evans Road', '26 Evans Road, Singapore 259367', 'Evans Road', 1.318744543033743, 103.8202331862043, prata, 'Operator-listed outlet. Current opening hours are not confirmed.'),
  venue('prata-bedok', 'Mr Prata · Bedok Reservoir', '742 Bedok Reservoir Road, #01-3105, Singapore 470742', 'Bedok Reservoir', 1.338085250430452, 103.9220907280398, prata, 'Operator-listed outlet. Current opening hours are not confirmed.'),
  venue('prata-clementi', 'Mr Prata · Clementi', '320 Clementi Avenue 4, #01-37, Singapore 120320', 'Clementi', 1.316901343761009, 103.7653107152272, prata, 'Operator-listed outlet. Current opening hours are not confirmed.'),
  venue('prata-marine', 'Mr Prata · Marine Parade', '82 Marine Parade Central, #01-616, Singapore 440082', 'Marine Parade', 1.302481100332464, 103.9067913370773, prata, 'Operator-listed outlet. Current opening hours are not confirmed.'),
  venue('prata-tampines', 'Mr Prata · Tampines', '476 Tampines Street 44, #01-189, Singapore 520476', 'Tampines', 1.360922839302659, 103.9533593645813, prata, 'Operator-listed outlet. Current opening hours are not confirmed.'),
  venue('casuarina', 'Casuarina Curry', '136–138 Casuarina Road, Singapore 579524', 'Upper Thomson', 1.377118872184474, 103.8280743241467, 'https://www.casuarinacurry.com/contactus', 'Prata and curry. Address checked with the operator; confirm current opening hours.'),
];
