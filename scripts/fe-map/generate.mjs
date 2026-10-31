// User-flow map of a night out. Plain language, not a code dump.
// Run: node scripts/fe-map/generate.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const everyone = { fill: '#d3f9d8', stroke: '#2b8a3e' };
const host = { fill: '#ffe8cc', stroke: '#d9480f' };

const steps = [
  {
    id: 'open',
    role: 'everyone',
    title: 'Open the app',
    bullets: [
      'A line for tonight, and the time',
      'Your supper plan, if you have one',
      'Shortcuts to meet, the bill, a ride, last call',
      'Tap Bao to ask something',
    ],
  },
  {
    id: 'join',
    role: 'everyone',
    title: 'Create or join',
    bullets: [
      'Start a party with your name',
      'Or paste a code and tap your name',
      'Copy the link for the group chat',
      'Continue once you are in',
    ],
  },
  {
    id: 'home',
    role: 'everyone',
    title: 'Party home',
    bullets: [
      'See who is coming',
      'Add your name and home',
      'Train, shared ride, or either',
      'Set when you meet and when you leave',
    ],
  },
  {
    id: 'pick',
    role: 'everyone',
    title: 'Pick a place',
    bullets: [
      'Swipe left to pass',
      'Swipe right if you want it',
      'Flick up for Anything lah',
      'Live top 3 sits on the deck',
      'Host shares the list first',
    ],
  },
  {
    id: 'last',
    role: 'everyone',
    title: 'Last call',
    bullets: [
      'When you should leave',
      'The next bus or train',
      'The route home',
      'Share the journey with the group',
    ],
  },
  {
    id: 'ride',
    role: 'everyone',
    title: 'Share a ride',
    bullets: [
      'Who is going your way',
      'Find ride partners',
      'Type the fare and see each share',
      'Open the trip in Maps',
    ],
  },
  {
    id: 'split',
    role: 'everyone',
    title: 'Split the bill',
    bullets: [
      'The dishes and what you pay',
      'Tap your name on what you ate',
      'Tap I’ve paid when you have',
      'Shares wait until the total is confirmed',
    ],
  },
];

const sides = [
  {
    id: 'party',
    under: 'open',
    role: 'everyone',
    title: 'Party sheet',
    bullets: ['Parties on this phone', 'Create, join, or continue', 'Copy the invite', 'Change the name remembered here'],
  },
  {
    id: 'where',
    under: 'home',
    role: 'everyone',
    title: 'Where you are',
    bullets: ['Search an address', 'Tap a result to set home', 'Or pick the area for food'],
  },
  {
    id: 'top3',
    under: 'pick',
    role: 'everyone',
    title: 'Top 3',
    bullets: ['The group’s top three', 'Change a swipe', 'Hearts, passes, still waiting'],
  },
  {
    id: 'confirm-place',
    under: 'pick',
    role: 'host',
    title: 'Confirm the meetup',
    bullets: ['Host locks the place', 'Everyone sees the tick', 'Then last call, a ride, or the bill'],
  },
  {
    id: 'scan',
    under: 'split',
    role: 'everyone',
    title: 'Scan the receipt',
    bullets: ['Snap the receipt', 'Check each dish and discount', 'Add them to the bill'],
  },
  {
    id: 'confirm-total',
    under: 'split',
    role: 'host',
    title: 'Confirm the total',
    bullets: ['The amount on the card', 'Fix a gap with rounding', 'Confirm before claims open'],
  },
];

const arrows = [
  ['open', 'join', 'tap Create or join'],
  ['join', 'home', 'tap Continue'],
  ['home', 'pick', 'tap Start swiping'],
  ['pick', 'last', 'tap Check Last Call'],
  ['last', 'ride', 'tap Share a ride'],
  ['ride', 'split', 'tap Split the bill'],
  ['open', 'party', 'tap Party · Invite'],
  ['home', 'where', 'tap Home address'],
  ['pick', 'top3', 'tap Top 3'],
  ['pick', 'confirm-place', 'tap Confirm meetup'],
  ['split', 'scan', 'tap Scan receipt'],
  ['split', 'confirm-total', 'tap Confirm total'],
];

const hood = [
  ['Home', '#home · plan on phone'],
  ['Party sheet', 'Create, join, invite'],
  ['Meet', '#meet · swipe deck'],
  ['Search & outing', 'Area, people, time'],
  ['Top 3', 'The ranking'],
  ['Last call', '#train · stays open'],
  ['Share ride', '#ride · cars and fares'],
  ['Split', '#split · the bill'],
  ['Scanner', 'Photo to dishes'],
  ['App shell', 'Tabs plus invite'],
];

const elements = [];
let seed = 41000;

function measure(text, fontSize) {
  const lines = String(text).split('\n');
  const width = Math.max(8, ...lines.map((line) => Math.ceil(line.length * fontSize * 0.62)));
  const height = Math.ceil(lines.length * fontSize * 1.35);
  return { width, height };
}

function base(extra) {
  const element = {
    id: extra.id,
    type: extra.type,
    x: extra.x,
    y: extra.y,
    width: extra.width,
    height: extra.height,
    angle: 0,
    strokeColor: extra.strokeColor ?? '#1e1e1e',
    backgroundColor: extra.backgroundColor ?? 'transparent',
    fillStyle: 'solid',
    strokeWidth: extra.strokeWidth ?? 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: extra.groupIds ?? [],
    frameId: null,
    roundness: extra.roundness ?? null,
    seed: seed++,
    version: 1,
    versionNonce: seed * 13 + 7,
    isDeleted: false,
    boundElements: extra.boundElements ?? null,
    updated: 1,
    link: null,
    locked: false,
    index: `a${elements.length.toString(36).padStart(3, '0')}`,
  };
  Object.assign(element, extra.rest ?? {});
  elements.push(element);
  return element;
}

function addText(id, text, x, y, fontSize, extra = {}) {
  const box = measure(text, fontSize);
  return base({
    id,
    type: 'text',
    x,
    y,
    width: extra.width ?? box.width,
    height: extra.height ?? box.height,
    strokeColor: extra.strokeColor ?? '#1a1a1a',
    strokeWidth: 1,
    groupIds: extra.groupIds ?? [],
    rest: {
      text,
      fontSize,
      fontFamily: 2,
      textAlign: extra.textAlign ?? 'left',
      verticalAlign: extra.verticalAlign ?? 'top',
      containerId: extra.containerId ?? null,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    },
  });
}

function addRect(id, x, y, width, height, fill, stroke, extra = {}) {
  return base({
    id,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    backgroundColor: fill,
    strokeColor: stroke,
    strokeWidth: extra.strokeWidth ?? 2,
    roundness: { type: 3 },
    boundElements: [],
    groupIds: extra.groupIds ?? [],
  });
}

const boxes = new Map();

function wrapTo(text, fontSize, maxWidth) {
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (measure(next, fontSize).width <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function placeCard(id, title, bullets, role, x, y, width) {
  const tone = role === 'host' ? host : everyone;
  const titleSize = width > 280 ? 24 : 20;
  const bodySize = 18;
  const pad = 22;
  const inner = width - pad * 2;
  const titleText = wrapTo(title, titleSize, inner);
  const body = bullets.map((line) => {
    const words = line.split(' ');
    const lines = [];
    let current = '•';
    for (const word of words) {
      const next = `${current} ${word}`;
      if (measure(next, bodySize).width <= inner) current = next;
      else {
        lines.push(current);
        current = `  ${word}`;
      }
    }
    lines.push(current);
    return lines.join('\n');
  }).join('\n');
  const titleBox = measure(titleText, titleSize);
  const bodyBox = measure(body, bodySize);
  if (titleBox.width > inner || bodyBox.width > inner) {
    throw new Error(`${id} text is wider than its box (${Math.max(titleBox.width, bodyBox.width)} > ${inner})`);
  }
  const height = pad + titleBox.height + 12 + bodyBox.height + pad;
  const group = [`group-${id}`];
  const rect = addRect(`box-${id}`, x, y, width, height, tone.fill, tone.stroke, { groupIds: group });
  addText(`title-${id}`, titleText, x + pad, y + pad, titleSize, { groupIds: group });
  addText(`body-${id}`, body, x + pad, y + pad + titleBox.height + 12, bodySize, { groupIds: group });
  boxes.set(id, { id: rect.id, x, y, w: width, h: height, rect });
  return height;
}

const MAIN_W = 340;
const MAIN_GAP = 210;
const MAIN_Y = 168;
let x = 48;
const mainHeights = [];
for (const step of steps) {
  mainHeights.push(placeCard(step.id, step.title, step.bullets, step.role, x, MAIN_Y, MAIN_W));
  x += MAIN_W + MAIN_GAP;
}
const mainH = Math.max(...mainHeights);
for (const step of steps) {
  const box = boxes.get(step.id);
  const rect = box.rect;
  const grow = mainH - box.h;
  if (grow > 0) {
    rect.height += grow;
    box.h = rect.height;
  }
}

const SIDE_W = 250;
const sideGap = 36;
for (const parentId of [...new Set(sides.map((side) => side.under))]) {
  const parent = boxes.get(parentId);
  const kids = sides.filter((side) => side.under === parentId);
  const total = kids.length * SIDE_W + (kids.length - 1) * sideGap;
  let sx = parent.x + (parent.w - total) / 2;
  const sy = parent.y + parent.h + 108;
  for (const side of kids) {
    placeCard(side.id, side.title, side.bullets, side.role, sx, sy, SIDE_W);
    sx += SIDE_W + sideGap;
  }
}

addText('heading', 'A night out', 48, 28, 28, { strokeColor: '#1a1a1a' });
const legendLines = 'Green — anyone in the party\nOrange — host only\nArrows — the tap that moves you';
const legendBox = measure(legendLines, 18);
const legend = addRect('legend', 280, 24, legendBox.width + 36, legendBox.height + 28, '#ffffff', '#868e96', { strokeWidth: 1 });
addText('legend-label', legendLines, legend.x + 18, legend.y + 14, 18);

function arrowBetween(id, from, to, label) {
  const a = boxes.get(from);
  const b = boxes.get(to);
  const down = b.y >= a.y + a.h - 4;
  const start = down
    ? { x: b.x + b.w / 2, y: a.y + a.h + 4 }
    : { x: a.x + a.w + 4, y: a.y + a.h / 2 };
  const end = down
    ? { x: b.x + b.w / 2, y: b.y - 4 }
    : { x: b.x - 4, y: b.y + b.h / 2 };
  const raw = [[0, 0], [end.x - start.x, end.y - start.y]];
  const minX = Math.min(...raw.map((point) => point[0]));
  const minY = Math.min(...raw.map((point) => point[1]));
  const points = raw.map((point) => [point[0] - minX, point[1] - minY]);
  const arrow = base({
    id,
    type: 'arrow',
    x: start.x + minX,
    y: start.y + minY,
    width: Math.max(...points.map((point) => point[0])),
    height: Math.max(...points.map((point) => point[1])),
    strokeColor: '#1c3d5a',
    strokeWidth: 2,
    roundness: null,
    boundElements: [],
    rest: {
      points,
      lastCommittedPoint: null,
      startBinding: { elementId: a.id, focus: 0, gap: 4, fixedPoint: null },
      endBinding: { elementId: b.id, focus: 0, gap: 4, fixedPoint: null },
      startArrowhead: null,
      endArrowhead: 'arrow',
      elbowed: false,
    },
  });
  a.rect.boundElements.push({ id, type: 'arrow' });
  b.rect.boundElements.push({ id, type: 'arrow' });
  const labelSize = 16;
  const wrapped = !down && measure(label, labelSize).width > MAIN_GAP - 28
    ? `tap\n${label.replace(/^tap /, '')}`
    : label;
  const labelBox = measure(wrapped, labelSize);
  const mid = points[Math.floor(points.length / 2)];
  const lx = down
    ? start.x + 12
    : start.x + minX + mid[0] - labelBox.width / 2;
  const ly = down
    ? (start.y + end.y) / 2 - labelBox.height / 2
    : start.y + minY + mid[1] - labelBox.height - 8;
  const labelEl = addText(`${id}-label`, wrapped, lx, ly, labelSize, {
    containerId: arrow.id,
    strokeColor: '#1c3d5a',
    textAlign: 'center',
  });
  arrow.boundElements.push({ id: labelEl.id, type: 'text' });
}

arrows.forEach(([from, to, label], index) => arrowBetween(`edge-${index}-${from}-${to}`, from, to, label));

const flowBottom = Math.max(...[...boxes.values()].map((box) => box.y + box.h));
const hoodY = flowBottom + 300;
const hoodTitle = addText('hood-title', 'Under the hood', 48, hoodY, 22, { strokeColor: '#495057' });
const hoodW = 248;
const hoodH = 96;
const hoodGap = 18;
const hoodBoxes = [];
hood.forEach((entry, index) => {
  const hx = 48 + index * (hoodW + hoodGap);
  const hy = hoodY + 48;
  const rect = addRect(`hood-${index}`, hx, hy, hoodW, hoodH, '#ffffff', '#adb5bd', { strokeWidth: 1 });
  const text = `${entry[0]}\n${entry[1]}`;
  const measured = measure(text, 15);
  if (measured.width > hoodW - 32) throw new Error(`Hood box ${entry[0]} is too wide`);
  addText(`hood-${index}-label`, text, hx + 16, hy + 22, 15, { strokeColor: '#343a40' });
  hoodBoxes.push(rect);
});
const hoodFrame = addRect(
  'hood-frame',
  32,
  hoodY - 16,
  hood.length * (hoodW + hoodGap) + 16,
  16 + 48 + hoodH + 24,
  '#f8f9fa',
  '#ced4da',
  { strokeWidth: 1 },
);
void hoodTitle;
void hoodFrame;

const backIds = new Set(['hood-frame', 'heading', 'legend', 'legend-label']);
const back = [];
const front = [];
for (const element of elements) {
  if (backIds.has(element.id) || element.id === 'hood-frame') back.push(element);
  else front.push(element);
}
elements.length = 0;
elements.push(...back, ...front);
elements.forEach((element, index) => {
  element.index = `a${index.toString(36).padStart(3, '0')}`;
});

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validate(document) {
  if (document.type !== 'excalidraw' || document.version !== 2) throw new Error('Bad Excalidraw header');
  const ids = new Set();
  for (const element of document.elements) {
    if (!element.id || ids.has(element.id)) throw new Error(`Bad id ${element.id}`);
    ids.add(element.id);
    if (element.seed == null || element.versionNonce == null) throw new Error(`${element.id} missing seed`);
  }
  const byId = new Map(document.elements.map((element) => [element.id, element]));
  for (const element of document.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (binding && !ids.has(binding.elementId)) throw new Error(`${element.id} binds to missing ${binding.elementId}`);
    }
    if (element.containerId && !ids.has(element.containerId)) throw new Error(`${element.id} missing container`);
    for (const bound of element.boundElements ?? []) {
      if (!ids.has(bound.id)) throw new Error(`${element.id} missing bound ${bound.id}`);
      const target = byId.get(bound.id);
      const pointsBack = target.containerId === element.id
        || target.startBinding?.elementId === element.id
        || target.endBinding?.elementId === element.id;
      if (!pointsBack) throw new Error(`${bound.id} does not point back to ${element.id}`);
    }
  }
  const cards = [...boxes.values()].map((box) => byId.get(box.id));
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      if (overlaps(cards[i], cards[j])) throw new Error(`${cards[i].id} overlaps ${cards[j].id}`);
    }
  }
  for (const element of document.elements) {
    if (element.type !== 'text' || element.id.endsWith('-label') && element.containerId) continue;
    if (!element.id.startsWith('title-') && !element.id.startsWith('body-')) continue;
    const cardId = element.id.replace(/^(title|body)-/, '');
    const card = byId.get(`box-${cardId}`);
    const inside = element.x >= card.x + 8
      && element.y >= card.y + 8
      && element.x + element.width <= card.x + card.width - 8
      && element.y + element.height <= card.y + card.height - 8;
    if (!inside) throw new Error(`${element.id} does not fit in ${card.id}`);
  }
}

const document = {
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements,
  appState: { viewBackgroundColor: '#fffdf8', gridSize: null },
  files: {},
};
validate(document);

const flowRows = steps.map((step) => `| ${step.title} | ${step.role === 'host' ? 'Host' : 'Everyone'} | ${step.bullets.join('; ')} |`).join('\n');
const sideRows = sides.map((side) => {
  const parent = steps.find((step) => step.id === side.under);
  const edge = arrows.find((arrow) => arrow[0] === side.under && arrow[1] === side.id);
  return `| ${side.title} | ${parent.title} | ${edge?.[2] ?? ''} | ${side.role === 'host' ? 'Host' : 'Everyone'} | ${side.bullets.join('; ')} |`;
}).join('\n');
const edgeRows = arrows.map(([from, to, label]) => {
  const name = (id) => steps.find((step) => step.id === id)?.title ?? sides.find((side) => side.id === id)?.title;
  return `| ${name(from)} | ${label} | ${name(to)} |`;
}).join('\n');

const markdown = `# A night out

How someone moves through Bojio. Open \`docs/fe-map.excalidraw\` in [Excalidraw](https://excalidraw.com). Regenerate with \`node scripts/fe-map/generate.mjs\`.

Green is anyone in the party. Orange is the host only. The drawing reads left to right. Smaller boxes are side trips under the step that opens them. A second frame, Under the hood, sits far below and is one small box per screen.

${steps.length + sides.length} screens. ${arrows.length} arrows.

| Step | Who | What you see and can do |
| --- | --- | --- |
${flowRows}

| Side trip | Opens from | Tap | Who | What you see and can do |
| --- | --- | --- | --- | --- |
${sideRows}

| From | Arrow | To |
| --- | --- | --- |
${edgeRows}
`;

const root = resolve(import.meta.dirname, '../..');
const excalidrawPath = resolve(root, 'docs/fe-map.excalidraw');
const markdownPath = resolve(root, 'docs/fe-map.md');
await mkdir(dirname(excalidrawPath), { recursive: true });
await writeFile(excalidrawPath, `${JSON.stringify(document, null, 2)}\n`);
await writeFile(markdownPath, markdown);
validate(JSON.parse(await readFile(excalidrawPath, 'utf8')));
console.log(`screens ${steps.length + sides.length}`);
console.log(`arrows ${arrows.length}`);
console.log(`elements ${document.elements.length}`);
console.log(`wrote ${excalidrawPath}`);
