// Phone wireframes of a night out, matched to the local web build.
// Run: node scripts/fe-map/wireframes.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const paper = '#F3EBE3';
const card = '#FAF4ED';
const blush = '#F7D6DC';
const peach = '#FF9D84';
const tan = '#D4B79A';
const ink = '#2B211C';
const muted = '#5C463C';
const line = '#E4D6C8';
const anyone = '#2b8a3e';
const hostStroke = '#d9480f';

const PHONE_W = 390;
const PAD = 14;
const INNER = PHONE_W - PAD * 2;
const COL_GAP = 110;

const elements = [];
let seed = 81000;
const buttons = new Map();
const phones = new Map();

function measure(text, fontSize) {
  const lines = String(text).split('\n');
  const width = Math.max(8, ...lines.map((line) => Math.ceil(line.length * fontSize * 0.58)));
  const height = Math.ceil(lines.length * fontSize * 1.3);
  return { width, height };
}

function wrapTo(text, fontSize, maxWidth) {
  const lines = [];
  let current = '';
  for (const word of String(text).split(' ')) {
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

function base(extra) {
  const element = {
    id: extra.id,
    type: extra.type,
    x: extra.x,
    y: extra.y,
    width: extra.width,
    height: extra.height,
    angle: 0,
    strokeColor: extra.strokeColor ?? ink,
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
    versionNonce: seed * 11 + 5,
    isDeleted: false,
    boundElements: extra.boundElements ?? null,
    updated: 1,
    link: null,
    locked: extra.locked ?? false,
    index: `a${elements.length.toString(36).padStart(4, '0')}`,
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
    strokeColor: extra.strokeColor ?? ink,
    strokeWidth: 1,
    groupIds: extra.groupIds ?? [],
    locked: extra.locked,
    rest: {
      text,
      fontSize,
      fontFamily: 2,
      textAlign: extra.textAlign ?? 'left',
      verticalAlign: 'top',
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
    strokeWidth: extra.strokeWidth ?? 1,
    roundness: { type: 3 },
    boundElements: [],
    groupIds: extra.groupIds ?? [],
    locked: extra.locked,
  });
}

function cardBlock(screenId, blockId, x, y, w, fill, lines, fontSize = 15) {
  const group = [`g-${screenId}-${blockId}`];
  const wrapped = lines.map((line) => wrapTo(line, fontSize, w - 28)).join('\n');
  const box = measure(wrapped, fontSize);
  if (box.width > w - 20) throw new Error(`${screenId}/${blockId} text is too wide`);
  const h = box.height + 24;
  const rect = addRect(`b-${screenId}-${blockId}`, x, y, w, h, fill, line, { groupIds: group });
  addText(`t-${screenId}-${blockId}`, wrapped, x + 14, y + 12, fontSize, { groupIds: group, strokeColor: ink });
  return { id: rect.id, x, y, w, h, rect };
}

function buttonBlock(screenId, blockId, x, y, w, label, fill = peach, textColor = ink) {
  const group = [`g-${screenId}-${blockId}`];
  const text = wrapTo(label, 16, w - 24);
  const box = measure(text, 16);
  const h = Math.max(48, box.height + 20);
  const rect = addRect(`b-${screenId}-${blockId}`, x, y, w, h, fill, fill === peach ? '#e88972' : fill === ink ? ink : '#CDB89F', { groupIds: group, strokeWidth: 1 });
  addText(`t-${screenId}-${blockId}`, text, x + (w - box.width) / 2, y + (h - box.height) / 2, 16, {
    groupIds: group,
    textAlign: 'center',
    strokeColor: textColor,
  });
  const hit = { id: rect.id, x, y, w, h, rect };
  buttons.set(`${screenId}:${blockId}`, hit);
  return hit;
}

function headerBlock(screenId, x, y, w) {
  const group = [`g-${screenId}-header`];
  const h = 52;
  const rect = addRect(`b-${screenId}-header`, x, y, w, h, paper, paper, { groupIds: group, strokeWidth: 1 });
  addText(`t-${screenId}-logo`, 'Bojio?', x + 4, y + 12, 22, { groupIds: group });
  const pillW = 168;
  const pill = addRect(`b-${screenId}-invite`, x + w - pillW, y + 6, pillW, 40, tan, '#CDB89F', { groupIds: group });
  addText(`t-${screenId}-invite`, 'Party · Invite', x + w - pillW + 22, y + 16, 15, { groupIds: group });
  buttons.set(`${screenId}:invite`, { id: pill.id, x: pill.x, y: pill.y, w: pillW, h: 40, rect: pill });
  return { id: rect.id, x, y, w, h, rect };
}

function tabsBlock(screenId, x, y, w, active) {
  const group = [`g-${screenId}-tabs`];
  const labels = ['Home', 'Meet', 'Split', 'Share ride', 'Last call'];
  const h = 58;
  const rect = addRect(`b-${screenId}-tabs`, x, y, w, h, card, line, { groupIds: group });
  const tabW = w / labels.length;
  labels.forEach((label, index) => {
    const tx = x + index * tabW;
    const on = label === active;
    addText(`t-${screenId}-tab-${index}`, label, tx + 4, y + 20, 11, {
      groupIds: group,
      strokeColor: on ? ink : muted,
      width: tabW - 12,
    });
    if (on) addRect(`b-${screenId}-tab-on`, tx + tabW / 2 - 14, y + 6, 28, 6, peach, peach, { groupIds: group, strokeWidth: 1 });
    buttons.set(`${screenId}:tab:${label}`, { id: `b-${screenId}-tabs`, x: tx, y, w: tabW, h, rect });
  });
  return { id: rect.id, x, y, w, h, rect };
}

function baoCard(screenId, x, y, w) {
  const group = [`g-${screenId}-bao`];
  const h = 132;
  const rect = addRect(`b-${screenId}-bao`, x, y, w, h, blush, '#e7bcc6', { groupIds: group });
  const copy = wrapTo('Bao jio!\nYour supper kaki is here. Tap Bao to ask anything.', 15, w - 150);
  addText(`t-${screenId}-bao`, copy, x + 14, y + 28, 15, { groupIds: group });
  const bao = addRect(`b-${screenId}-bao-mark`, x + w - 118, y + 22, 96, 88, card, ink, { groupIds: group, strokeWidth: 2 });
  addText(`t-${screenId}-bao-mark`, 'Bao', bao.x + 28, bao.y + 32, 16, { groupIds: group });
  return { id: rect.id, x, y, w, h, rect };
}

function placePhone(id, caption, role, x, y, build) {
  const contentX = x + PAD;
  let cursor = y + 46;
  const parts = [];
  const api = {
    header() {
      const block = headerBlock(id, contentX, cursor, INNER);
      parts.push(block);
      cursor += block.h + 10;
    },
    card(blockId, lines, fill = card, fontSize = 15) {
      const block = cardBlock(id, blockId, contentX, cursor, INNER, fill, lines, fontSize);
      parts.push(block);
      cursor += block.h + 10;
      return block;
    },
    button(blockId, label, fill = peach, textColor = ink) {
      const block = buttonBlock(id, blockId, contentX, cursor, INNER, label, fill, textColor);
      parts.push(block);
      cursor += block.h + 10;
      return block;
    },
    bao() {
      const block = baoCard(id, contentX, cursor, INNER);
      parts.push(block);
      cursor += block.h + 10;
    },
    tabs(active) {
      const block = tabsBlock(id, contentX, cursor, INNER, active);
      parts.push(block);
      cursor += block.h + 8;
    },
    gap(n = 8) { cursor += n; },
  };
  build(api);
  const height = cursor - y + 12;
  const stroke = role === 'host' ? hostStroke : anyone;
  const frame = addRect(`phone-${id}`, x, y, PHONE_W, height, paper, stroke, { strokeWidth: 3 });
  const tag = role === 'host' ? 'host only' : 'anyone';
  addText(`cap-${id}`, caption, x, y - 52, 18, { strokeColor: ink });
  addText(`tag-${id}`, tag, x, y - 28, 14, { strokeColor: stroke });
  phones.set(id, { id: frame.id, x, y, w: PHONE_W, h: height, rect: frame, role });
  return phones.get(id);
}

const mainY = 520;
let colX = 48;
const columns = [];

function column(mainId, caption, role, build, side = []) {
  const phone = placePhone(mainId, caption, role, colX, mainY, build);
  const kids = [];
  let sideY = phone.y + phone.h + 150;
  for (const child of side) {
    const kid = placePhone(child.id, child.caption, child.role, colX, sideY, child.build);
    kids.push(kid);
    sideY = kid.y + kid.h + 150;
  }
  columns.push({ x: colX, phone, kids });
  colX += PHONE_W + COL_GAP;
}

column('home', 'Open the app', 'everyone', (ui) => {
  ui.header();
  ui.card('greet', ['WEDNESDAY 8:48 PM · SGT', 'Still outside?', 'Home can wait. The stall cannot.']);
  ui.bao();
  ui.card('plan', ['YOUR SUPPER PLAN', 'Still choosing where to makan', 'WN', '1 kakis · RR2QRK', 'Shared          Parties']);
  ui.button('finish', 'Finish choosing a place →');
  ui.card('shortcuts', ['Meet & makan', 'Split the bill', 'Share a ride', 'Last Call'], tan, 15);
  ui.tabs('Home');
}, [
  {
    id: 'party',
    caption: 'Party sheet',
    role: 'everyone',
    build(ui) {
      ui.card('hero', ['BOJIO? JIO LAH.', 'You eating or just watching?', 'One link. The whole table.'], tan, 16);
      ui.card('title', ['Choose your party']);
      ui.button('create', 'Create a new party →');
      ui.button('join', 'Join with code', tan);
      ui.card('last', ['LAST OPENED · Hosting', 'Pick up where you left off.', 'RR2QRK', 'WN'], tan);
      ui.button('continue', 'Continue this party →');
      ui.card('friends', ['Invite friends'], card, 15);
      ui.card('list', ['YOUR PARTIES', 'RR2QRK · Hosting', 'WN']);
    },
  },
]);

column('create', 'Create or join', 'everyone', (ui) => {
  ui.card('title', ['Create a new party']);
  ui.card('note', ['A fresh outing with an empty bill. Your previous parties stay in your list.']);
  ui.card('name', ['Your name']);
  ui.card('hint', ['Anyone with the invite can choose an existing guest name. Only this browser keeps host controls.']);
  ui.button('go', 'Create party & invite →');
  ui.button('back', 'Back', tan);
});

column('party-home', 'Party home', 'everyone', (ui) => {
  ui.header();
  ui.card('kicker', ['ONE STEP', 'Your name and home', 'Add both. Supper cards show up here after they’re saved.']);
  ui.card('name-label', ['YOUR NAME']);
  ui.card('name', ['What should your friends call you?']);
  ui.card('home', ['YOUR HOME', 'Where are we sending you home?']);
  ui.button('address', 'Home address');
  ui.tabs('Meet');
}, [
  {
    id: 'where',
    caption: 'Where you are',
    role: 'everyone',
    build(ui) {
      ui.card('label', ['Home address']);
      ui.card('field', ['Address, postal code, or MRT station']);
      ui.button('search', 'Search location', tan);
      ui.card('note', ['Type an address, then tap a result. Typing alone does not set your home.', 'Search by OneMap.']);
      ui.card('sample', ['Tiong Bahru']);
    },
  },
]);

column('pick', 'Pick a place', 'everyone', (ui) => {
  ui.header();
  ui.card('title', ['PICK LAH', 'Where we makan?', 'Left is no. Right is yes.']);
  ui.card('home', ['YOUR HOME', 'Tiong Bahru', 'Change']);
  ui.card('deck', ['1 / 2 rated', 'Hong Lim Noodles', '★ 4.4 · 120 ratings', 'No photo — plate placeholder']);
  ui.card('actions', ['Pass', 'Neutral', 'Like'], card, 16);
  ui.button('top3', 'Top 3', tan);
  ui.tabs('Meet');
}, [
  {
    id: 'top3',
    caption: 'Top 3',
    role: 'everyone',
    build(ui) {
      ui.card('title', ['Top 3']);
      ui.card('review', ['Review or change my swipes']);
      ui.card('fav', ['Group favourites', 'Tiong Bahru Bakery', '♥ 1', '1 like · 0 pass · 1 hasn’t swiped'], tan);
      ui.button('confirm', 'Confirm meetup here');
      ui.card('other', ['Other places your group rated', 'Keep swiping to add more.']);
    },
  },
  {
    id: 'confirm-place',
    caption: 'Confirm the meetup',
    role: 'host',
    build(ui) {
      ui.card('title', ['Group favourites']);
      ui.card('place', ['Tiong Bahru Bakery', '♥ 1', 'Host locks the place. Everyone sees the tick.'], tan);
      ui.button('confirm', 'Confirm meetup here');
      ui.card('done', ['Confirmed meetup']);
    },
  },
]);

column('last', 'Last call', 'everyone', (ui) => {
  ui.header();
  ui.card('title', ['STILL HERE?', 'Zao already?', 'Last train does not do five more minutes.']);
  ui.card('from', ['FROM', 'Choose starting point', '1 in this group · 2 in the party']);
  ui.button('here', 'Use my current location', tan);
  ui.card('or', ['Or type a location', 'Address, postal code']);
  ui.card('person', ['WN', 'Tiong Bahru', 'Choose starting point']);
  ui.button('ride', 'Share a ride instead', tan);
  ui.tabs('Last call');
});

column('ride', 'Share a ride', 'everyone', (ui) => {
  ui.header();
  ui.card('title', ['GOT SPACE?', 'Share the Grab.', 'Already together. Set pickup here — drop-offs are still home.']);
  ui.card('pickup', ['YOUR PICKUP', 'Where is the car starting?']);
  ui.button('here', 'Use my current location', tan);
  ui.card('field', ['Address, postal code, or MRT station']);
  ui.button('search', 'Search location', tan);
  ui.card('home', ['YOUR HOME', 'Tiong Bahru', 'Change']);
  ui.button('find', 'Find ride partners');
  ui.tabs('Share ride');
});

column('split', 'Split the bill', 'everyone', (ui) => {
  ui.header();
  ui.card('title', ['Split without paiseh', 'Scan → pick what you ate → mark paid.', 'Saved on this device']);
  ui.card('total', ['CONFIRM TOTAL PAID', 'MASTERCARD S$8.70', '8.70', 'Subtotal S$8.70', 'Discounts S$0.00', 'Service S$0.00', 'GST S$0.00', 'Rounding S$0.00']);
  ui.button('confirm', 'Confirm total paid');
  ui.button('scan', 'Scan receipt');
  ui.card('clear', ['Clear receipt']);
  ui.card('dish', ['Kaya toast', '6.50', 'WN', 'Rachel']);
  ui.card('dish2', ['Kopi', '2.20']);
  ui.tabs('Split');
}, [
  {
    id: 'scan',
    caption: 'Scan the receipt',
    role: 'everyone',
    build(ui) {
      ui.card('title', ['Scan receipt']);
      ui.card('lead', ['Snap, check, split. Simple lah.']);
      ui.button('camera', 'Take photo', ink, '#FAF4ED');
      ui.button('gallery', 'Choose receipt photo', card);
      ui.card('note', ['Hide personal details first.']);
      ui.card('back', ['Paste or type instead']);
    },
  },
  {
    id: 'confirm-total',
    caption: 'Confirm the total',
    role: 'host',
    build(ui) {
      ui.card('title', ['CONFIRM TOTAL PAID', 'MASTERCARD S$8.70']);
      ui.card('amount', ['8.70']);
      ui.card('rows', ['Subtotal S$8.70', 'Discounts S$0.00', 'Service S$0.00', 'GST S$0.00', 'Rounding S$0.00']);
      ui.button('confirm', 'Confirm total paid');
      ui.card('later', ['Change the total']);
    },
  },
]);

addText('legend', 'Green frame — anyone\nOrange frame — host only\nArrow — the tap on that button', 48, 28, 18);

const flowArrows = [
  ['home:finish', 'pick', 'tap Finish choosing a place'],
  ['home:invite', 'party', 'tap Party · Invite'],
  ['party:create', 'create', 'tap Create a new party'],
  ['party:continue', 'party-home', 'tap Continue this party'],
  ['party-home:address', 'where', 'tap Home address'],
  ['pick:top3', 'top3', 'tap Top 3'],
  ['top3:confirm', 'confirm-place', 'tap Confirm meetup here'],
  ['pick:tab:Last call', 'last', 'tap Last call'],
  ['last:ride', 'ride', 'tap Share a ride instead'],
  ['ride:tab:Split', 'split', 'tap Split'],
  ['split:scan', 'scan', 'tap Scan receipt'],
  ['split:confirm', 'confirm-total', 'tap Confirm total paid'],
];

let lane = 0;
function arrow(id, fromKey, toId, label) {
  const from = buttons.get(fromKey);
  const to = phones.get(toId);
  if (!from || !to) throw new Error(`Missing arrow ends ${fromKey} → ${toId}`);
  const childBelow = to.x < from.x + from.w && to.x + to.w > from.x && to.y > from.y;
  const source = [...phones.values()].find((phone) => from.x >= phone.x - 2 && from.x <= phone.x + phone.w && from.y >= phone.y && from.y <= phone.y + phone.h);
  const sourceRight = (source?.x ?? from.x) + (source?.w ?? from.w);
  const railX = sourceRight + 28;
  const nearRight = from.x + from.w > sourceRight - 24;
  const start = nearRight
    ? { x: sourceRight, y: from.y + from.h / 2 }
    : { x: from.x + from.w / 2, y: from.y + from.h };
  const exit = nearRight
    ? [[0, 0], [railX - start.x, 0]]
    : [[0, 0], [0, 14], [railX - start.x, 14]];
  let raw;
  let labelAt;
  if (childBelow) {
    const rail = railX;
    const above = to.y - 78;
    raw = [
      ...exit,
      [rail - start.x, above - start.y],
      [to.x + to.w - 36 - start.x, above - start.y],
      [to.x + to.w - 36 - start.x, to.y - start.y - 6],
    ];
    labelAt = { x: to.x, y: to.y - 118 };
  } else {
    const laneY = 130 + lane * 48;
    lane += 1;
    const rail = railX;
    const drop = to.x + to.w - 28;
    raw = [
      ...exit,
      [rail - start.x, laneY - start.y],
      [drop - start.x, laneY - start.y],
      [drop - start.x, to.y - start.y - 6],
    ];
    const labelBox = measure(label, 14);
    labelAt = { x: (rail + drop) / 2 - labelBox.width / 2, y: laneY - labelBox.height - 6 };
  }
  const minX = Math.min(...raw.map((p) => p[0]));
  const minY = Math.min(...raw.map((p) => p[1]));
  const points = raw.map((p) => [p[0] - minX, p[1] - minY]);
  const arrowEl = base({
    id,
    type: 'arrow',
    x: start.x + minX,
    y: start.y + minY,
    width: Math.max(1, ...points.map((p) => p[0])),
    height: Math.max(1, ...points.map((p) => p[1])),
    strokeColor: '#1c3d5a',
    strokeWidth: 2,
    boundElements: [],
    rest: {
      points,
      lastCommittedPoint: null,
      startBinding: { elementId: from.id, focus: 0, gap: 4, fixedPoint: null },
      endBinding: { elementId: to.rect.id, focus: 0, gap: 6, fixedPoint: null },
      startArrowhead: null,
      endArrowhead: 'arrow',
      elbowed: false,
    },
  });
  from.rect.boundElements.push({ id, type: 'arrow' });
  to.rect.boundElements.push({ id, type: 'arrow' });
  const labelEl = addText(`${id}-label`, label, labelAt.x, labelAt.y, 14, {
    containerId: arrowEl.id,
    strokeColor: '#1c3d5a',
  });
  arrowEl.boundElements.push({ id: labelEl.id, type: 'text' });
}

flowArrows.forEach(([from, to, label], index) => arrow(`edge-${index}`, from, to, label));

const frames = elements.filter((element) => element.id.startsWith('phone-'));
const rest = elements.filter((element) => !element.id.startsWith('phone-'));
elements.length = 0;
elements.push(...frames, ...rest);
elements.forEach((element, index) => { element.index = `a${index.toString(36).padStart(4, '0')}`; });

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validate(document) {
  if (document.type !== 'excalidraw' || document.version !== 2 || !Array.isArray(document.elements) || !document.appState) {
    throw new Error('Excalidraw file is missing type, version, elements, or appState');
  }
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
    }
  }
  const phoneEls = document.elements.filter((element) => element.id.startsWith('phone-'));
  for (let i = 0; i < phoneEls.length; i += 1) {
    for (let j = i + 1; j < phoneEls.length; j += 1) {
      if (overlaps(phoneEls[i], phoneEls[j])) throw new Error(`${phoneEls[i].id} overlaps ${phoneEls[j].id}`);
    }
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

const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'docs/fe-wireframes.excalidraw');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(document, null, 2)}\n`);
validate(JSON.parse(await readFile(out, 'utf8')));
console.log(`screens ${phones.size}`);
console.log(`arrows ${flowArrows.length}`);
console.log(`wrote ${out}`);
