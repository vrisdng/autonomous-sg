import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';

const home = (label, latitude, longitude) => ({ label, latitude, longitude });
const ada = { id: 'ada', name: 'Ada', origin: 'Tampines MRT', transportMode: 'either', location: home('Tampines MRT', 1.353, 103.945) };
const ben = { id: 'ben', name: 'Ben', origin: 'Bedok MRT', transportMode: 'ride', location: home('Bedok MRT', 1.324, 103.93) };
const plan = { code: 'QYBVJF', participants: [ada, ben], remote: { role: 'host', participantId: 'ada', published: false } };
const school = home('School gate', 1.3521, 103.9445);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((saved) => {
    localStorage.setItem('bojio.plan-draft.v1', JSON.stringify(saved.plan));
    window.__links = [];
    window.open = (url) => { window.__links.push(String(url)); return null; };
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => window.__copied.push(text) }, configurable: true });
  }, { plan });
  await page.route('**/functions/v1/**', (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === 'search') {
      const query = String(body.query || '').trim() || school.label;
      return route.fulfill({ json: { locations: [{ ...school, label: query }] } });
    }
    if (body?.action === 'drive') return route.fulfill({ json: { legs: body.trips.map((trip) => ({ id: trip.id, seconds: 300 })) } });
    return route.fulfill({ json: { results: [], locations: [] } });
  });
  await page.goto(process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8082/');
  await page.getByRole('button', { name: 'Share ride', exact: true }).click();
  await expect(page.getByText('No Meet pin needed')).toBeVisible();
  await expect(page.getByLabel('Pickup or current location')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Meet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find ride partners', exact: true })).toBeDisabled();
  await page.getByLabel('Pickup or current location').fill('School gate');
  await page.getByRole('button', { name: 'Search location', exact: true }).click();
  await page.getByRole('button', { name: 'School gate', exact: true }).click();
  await expect(page.getByText('YOUR PICKUP')).toBeVisible();
  await page.getByRole('button', { name: 'Find ride partners', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Grab ↗', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Gojek ↗', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Grab ↗', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to Grab ↗', exact: true }).click();
  const links = await page.evaluate(() => window.__links);
  const grab = links.find((url) => url.startsWith('grab://open?'));
  assert.ok(grab, 'Grab handoff missing');
  const params = new URL(grab).searchParams;
  assert.equal(params.get('pickUpLatitude'), '1.3521');
  assert.equal(params.get('pickUpAddress'), 'School gate');
  assert.equal(params.get('dropOffAddress'), 'Bedok MRT');
  await page.reload();
  await expect(page.getByText('School gate').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find ride partners', exact: true })).toBeEnabled();
  await page.evaluate(() => localStorage.removeItem('bojio.ride-pickup.v1:QYBVJF'));
  await page.getByRole('button', { name: 'Last call', exact: true }).click();
  await expect(page.getByText('Choose starting point', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Change location', exact: true }).click();
  await page.getByLabel('Leaving from').fill('Tampines Mall');
  await page.getByRole('button', { name: 'Search location', exact: true }).click();
  await page.getByRole('button', { name: 'Tampines Mall', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Last call', exact: true }).click();
  await expect(page.getByText('Tampines Mall').first()).toBeVisible();
  await expect(page.getByText('Choose starting point', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Share ride', exact: true }).click();
  await expect(page.getByText('Tampines Mall').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find ride partners', exact: true })).toBeEnabled();

  const meetup = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const venue = { id: 'test', source: 'onemap', name: 'Supper spot', address: 'Supper spot address', latitude: 1.3, longitude: 103.8, area: 'Singapore', nearestStation: '', detail: '', openUntil: '', tags: [], point: { x: 103.8, y: 1.3 } };
  await meetup.addInitScript((saved) => {
    localStorage.setItem('bojio.plan-draft.v1', JSON.stringify({ ...saved.plan, chosenVenueId: saved.venue.id, chosenVenue: saved.venue }));
    localStorage.setItem('bojio.ride-pickup.v1:QYBVJF', JSON.stringify(saved.school));
    window.__links = [];
    window.open = (url) => { window.__links.push(String(url)); return null; };
  }, { plan, venue, school });
  await meetup.route('**/functions/v1/**', (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === 'drive') return route.fulfill({ json: { legs: body.trips.map((trip) => ({ id: trip.id, seconds: 300 })) } });
    return route.fulfill({ json: { results: [], locations: [] } });
  });
  await meetup.goto(process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8082/');
  await meetup.getByRole('button', { name: 'Share ride', exact: true }).click();
  await expect(meetup.getByText('Pickup · Supper spot')).toBeVisible();
  await expect(meetup.getByLabel('Pickup or current location')).toHaveCount(0);
  await meetup.getByRole('button', { name: 'Find ride partners', exact: true }).click();
  await meetup.getByRole('button', { name: 'Open Grab ↗', exact: true }).click();
  await meetup.getByRole('button', { name: 'Continue to Grab ↗', exact: true }).click();
  const meetupLinks = await meetup.evaluate(() => window.__links);
  const meetupGrab = meetupLinks.find((url) => url.startsWith('grab://open?'));
  assert.ok(meetupGrab);
  const meetupParams = new URL(meetupGrab).searchParams;
  assert.equal(meetupParams.get('pickUpLatitude'), '1.3');
  assert.equal(meetupParams.get('pickUpAddress'), 'Supper spot address');
  console.log('PASS share ride with pickup+home and no Meet venue; meetup pin still wins.');
} finally { await browser.close(); }
