import * as E from './engine.js';
import * as L from './library.js';
const { TIER, WEEKS, fmtW, normKey } = E;

/* =================================================================
   ДАННЫЕ
   ================================================================= */
const APP_VERSION = '2026-10-04 · 14';
const LS_KEY = 'gymlog.v3', LS_OLD = 'gymlog.v2', CLOUD_KEY = 'gymlog.cloud.v1';
let uidN = 1;
const uid = () => 'id' + Date.now().toString(36) + (uidN++).toString(36);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PASTELS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)', 'var(--p6)'];
const pastel = i => PASTELS[((i % 6) + 6) % 6];
const WEEK_CC = { 0: 'var(--p3)', 1: 'var(--p1)', 2: 'var(--p2)', 3: 'var(--p5)', 4: 'var(--p6)' };
const weekDot = wk => wk === 0 || wk === 4 ? 'b' : wk === 1 ? 'g' : wk === 2 ? 'y' : 'r';

function mkEx(name, sets, repMin, repMax, step, rest, seed, flags = '', mrv) {
  return {
    id: uid(), key: normKey(name), name, sets, mrv: mrv || (flags.includes('h') ? sets + 1 : sets + 2),
    repMin, repMax, step, rest, seedE1RM: null,
    bw: flags.includes('w'), heavy: flags.includes('h'), bar: flags.includes('b'),
    group: L.guessGroup(name),
    equip: flags.includes('w') ? 'bw' : flags.includes('b') ? 'barbell' : flags.includes('d') ? 'dumbbell' : flags.includes('p') ? 'plate' : flags.includes('m') ? 'stack' : undefined
  };
}
// Замены для упражнений с осевой нагрузкой: [название, подходы, повт. от, до, шаг, отдых, 1ПМ, флаги]
const SAFE = {
  legPress: ['Жим платформы ногами', 3, 8, 12, 5, 150, 202, 'p'],
  legExt: ['Разгибания ног в тренажёре', 3, 10, 15, 2.5, 75, null, 'm'],
  legCurl: ['Сгибания ног', 3, 10, 12, 2.5, 75, 50, 'm'],
  hipThrust: ['Ягодичный мост со штангой', 3, 8, 12, 2.5, 150, null, 'b'],
  chestRow: ['Тяга с упором в грудь', 3, 8, 12, 2.5, 120, null, 'm'],
  dbRow: ['Тяга гантели с упором в скамью', 3, 8, 12, 2, 90, null, 'd'],
  pullover: ['Пуловер на блоке', 3, 10, 15, 2.5, 75, null, 'm'],
  inclinePress: ['Жим гантелей на наклонной 45°', 3, 8, 12, 2, 120, null, 'd'],
  rearDelt: ['Разведения на заднюю дельту', 3, 12, 15, 2.5, 75, null, 'm'],
  calfSeated: ['Подъёмы на носки сидя', 3, 12, 15, 5, 60, null, 'p']
};
const S_ = k => mkEx(...SAFE[k]);
// упражнение из библиотеки: [название, группа, снаряд, от, до, шаг, 1ПМ, флаги]
function fromLib(e) {
  const ex = mkEx(e[0], 3, e[3], e[4], e[5], 90, e[6] || null, e[2] + (e[7] || ''));
  ex.group = e[1];
  return ex;
}
// дни фулбоди по числу упражнений; id дней переиспользуем, чтобы не сбить отметки недели
function buildFullbody(count, oldDays) {
  return L.fullbodyPlan(count).map((list, i) => ({
    id: (oldDays && oldDays[i] && oldDays[i].id) || uid(), name: 'Фулбоди ' + (i + 1), exercises: list.map(fromLib)
  }));
}
// что на что менять (первый вариант, которого ещё нет в этом дне)
const AXIAL_SUBS = [
  [/фронтальн/, ['hipThrust', 'legExt', 'legPress']],
  [/присед|выпад|гакк|хакк/, ['legPress', 'legExt', 'hipThrust']],
  [/становая/, ['dbRow', 'chestRow', 'pullover']],
  [/румынская|наклоны со штангой|good ?morning|гуд ?морнинг/, ['hipThrust', 'legCurl']],
  [/тяга штанги в наклоне/, ['chestRow', 'dbRow']],
  [/жим .*(стоя|сидя)|армейский/, ['inclinePress', 'rearDelt']],
  [/носки/, ['calfSeated']],
  [/шраги/, ['rearDelt']]
];
const TEMPLATES = {
  fullbody: (count = 7) => buildFullbody(count),
  split: () => [
    { id: uid(), name: 'Грудь + трицепс + плечи', exercises: [
      mkEx('Жим штанги лёжа', 3, 5, 8, 2.5, 180, 94, 'hb'),
      mkEx('Жим гантелей лёжа 30°', 3, 8, 12, 2, 150, 72, 'd'),
      S_('inclinePress'),
      mkEx('Махи гантелями в стороны', 3, 12, 15, 1, 75, 11, 'd'),
      mkEx('Разгибания рук на блоке', 3, 10, 12, 2.5, 75, 38, 'm'),
      mkEx('Французский жим', 3, 10, 12, 2, 75, 25, 'd')] },
    { id: uid(), name: 'Спина + бицепс', exercises: [
      mkEx('Тяга вертикального блока', 3, 8, 10, 2.5, 120, 68, 'm'),
      S_('chestRow'),
      mkEx('Тяга горизонтального блока', 3, 8, 12, 2.5, 120, 60, 'm'),
      S_('dbRow'),
      mkEx('Подъём штанги на бицепс', 3, 8, 12, 2.5, 75, 28, 'b'),
      mkEx('Молот на бицепс', 3, 10, 12, 2, 75, 20, 'd')] },
    { id: uid(), name: 'Ноги + плечи', exercises: [
      S_('legPress'), S_('hipThrust'), S_('legExt'), S_('legCurl'), S_('rearDelt'), S_('calfSeated')] }
  ]
};
// Однократно убирает осевую нагрузку из всех наборов программ. Возвращает список замен.
function stripAxial(P) {
  const log = [];
  Object.values(P.custom).forEach(ds => (ds || []).forEach(d => {
    const out = [];
    d.exercises.forEach(ex => {
      if (!E.isAxial(ex.name)) { out.push(ex); return; }
      const rule = AXIAL_SUBS.find(([re]) => re.test(normKey(ex.name)));
      const pick = rule && rule[1].find(k => !d.exercises.concat(out).some(e => e.key === normKey(SAFE[k][0])));
      if (pick) { const n = S_(pick); out.push(n); log.push(ex.name + ' → ' + n.name); }
      else log.push(ex.name + ' → убрано');
    });
    d.exercises = out;
  }));
  return [...new Set(log)];
}
const HEAVY_NAMES = new Set(['Приседания со штангой', 'Жим штанги лёжа', 'Становая тяга', 'Жим штанги стоя', 'Фронтальные приседания', 'Румынская тяга', 'Тяга штанги в наклоне']);
const BAR_RE = /штанг|становая|румынская тяга|фронтальные/i;

function defaultNutrition() { return { profile: null, log: {}, favs: [], weights: {} }; }
function defaultState() {
  const fb = TEMPLATES.fullbody();
  return {
    v: 3, ui: { tab: 'home' }, settings: { bar: 20, noAxial: true },
    program: { active: 'fullbody', fbCount: 7, custom: { fullbody: fb, split: TEMPLATES.split() }, days: fb },
    cycle: { meso: 1, week: 1, done: [], weekStartedAt: Date.now() },
    history: [], deleted: [], active: null, nutrition: defaultNutrition(), meta: { updatedAt: 0 }
  };
}

function migrateState(st) {
  if (!st || typeof st !== 'object' || !st.program) return defaultState();
  st.ui = Object.assign({ tab: 'home' }, st.ui || {});
  const tabMap = { workout: 'home', calendar: 'progress', results: 'profile', history: 'profile' };
  if (!['home', 'program', 'food', 'progress', 'profile'].includes(st.ui.tab)) st.ui.tab = tabMap[st.ui.tab] || 'home';
  st.settings = Object.assign({ bar: 20 }, st.settings || {});
  st.history = Array.isArray(st.history) ? st.history : [];
  st.deleted = Array.isArray(st.deleted) ? st.deleted : [];
  st.meta = st.meta || { updatedAt: 0 };
  st.nutrition = Object.assign(defaultNutrition(), st.nutrition || {});
  if (st.active === undefined) st.active = null;

  const P = st.program;
  P.custom = P.custom || {};
  if (!P.custom.fullbody) P.custom.fullbody = TEMPLATES.fullbody();
  if (!P.custom.split) P.custom.split = TEMPLATES.split();
  const isV2 = !st.v || st.v < 3;
  if (!P.active || !P.custom[P.active]) {
    // v2 хранил активную программу как копию одного из наборов в program.days
    const first = P.days && P.days[0] && P.days[0].id;
    let act = null;
    ['fullbody', 'split'].forEach(k => { if (first && P.custom[k][0] && P.custom[k][0].id === first) act = k; });
    if (!act) { if (P.days && P.days.length) { P.custom.mine = P.days; act = 'mine'; } else act = 'fullbody'; }
    else if (P.days && P.days.length) P.custom[act] = P.days;
    P.active = act;
  }
  P.days = P.custom[P.active];
  Object.values(P.custom).forEach(ds => (ds || []).forEach(d => {
    d.exercises = d.exercises || [];
    d.exercises.forEach(ex => {
      if (!ex.key) ex.key = normKey(ex.name);
      if (ex.heavy === undefined) ex.heavy = HEAVY_NAMES.has(ex.name);
      if (ex.bar === undefined) ex.bar = !ex.bw && BAR_RE.test(ex.name);
      if (ex.bw && ex.bar) ex.bar = false;
      if (!ex.equip) ex.equip = inferEquip(ex);
      if (!ex.group) ex.group = L.guessGroup(ex.name);
      if (!ex.mrv) ex.mrv = ex.sets + 2;
    });
  }));
  st.history.forEach(w => (w.entries || []).forEach(en => { if (!en.key) en.key = normKey(en.name); }));

  if (isV2) {
    const n = st.history.length, meso = Math.floor(n / 12) + 1;
    st.history.forEach((w, i) => {
      if (w.meso == null) { w.meso = Math.floor(i / 12) + 1; w.week = (Math.floor(i / 3) % 4) + 1; w.deload = w.week === 4; }
    });
    // v2 наращивал MEV, мутируя ex.sets активной программы; теперь бонус считается из номера мезоцикла
    if (meso > 1) P.days.forEach(d => d.exercises.forEach(ex => {
      if (!ex.heavy) ex.sets = Math.max(Math.min(ex.sets, 3), ex.sets - (meso - 1));
    }));
    st.cycle = { meso, week: (Math.floor(n / 3) % 4) + 1, done: st.history.slice(n - (n % 3)).map(w => w.dayId).filter(Boolean), weekStartedAt: Date.now() };
    if (st.active && st.active.entries) {
      st.active.meso = st.cycle.meso; st.active.week = st.active.week || st.cycle.week; st.active.open = 0;
      st.active.entries.forEach(en => {
        en.key = en.key || normKey(en.name);
        if (!en.plan) {
          const t = en.tier || 'g', n2 = en.planSets || 3;
          en.plan = { sets: n2, tiers: Array(n2).fill(t), tier: t, w: en.draft ? en.draft.w : 0, prevW: null, reps: en.repMin, note: '' };
        }
        en.draft = Object.assign({ w: 0, r: en.repMin }, en.draft || {});
      });
    } else st.active = null;
    st.v = 3;
  }
  if (!P.fbCount) {
    P.fbCount = 7;
    const old = P.custom.fullbody;
    P.custom.fullbody = buildFullbody(7, old);
    // если по фулбоди уже тренировались — сохраняем прежний состав отдельным набором
    if (P.active === 'fullbody' && st.history.length) P.custom.prev = old;
    if (P.active === 'fullbody') P.days = P.custom.fullbody;
  }
  if (!st.settings.seedsCleared) {
    // стартовые 1ПМ из шаблонов старой версии — не данные пользователя
    st.settings.seedsCleared = true;
    const TPL_SEEDS = new Set([202, 94, 68, 11, 38, 110, 50, 60, 28, 72, 86, 20, 45, 25]);
    Object.values(P.custom).forEach(ds => (ds || []).forEach(d => d.exercises.forEach(ex => { if (TPL_SEEDS.has(ex.seedE1RM)) ex.seedE1RM = null; })));
    if (st.active) st.active.entries.forEach(en => { if (en.plan && en.plan.reason === 'seed' && !en.sets.length) en.plan = { ...en.plan, w: null, reason: 'calib', mode: 'calib', sets: 1, tiers: ['y'], tier: 'y' }; });
  }
  if (!st.settings.noAxial) {
    st.settings.noAxial = true;
    const log = stripAxial(P);
    if (log.length) st.ui.axialLog = log;
  }
  st.cycle = Object.assign({ meso: 1, week: 1, done: [], weekStartedAt: Date.now() }, st.cycle || {});
  // все дни уже отмечены, но неделя не закрыта (бывает после миграции со старого счёта «по 3 тренировки»)
  const ids = P.days.map(d => d.id);
  if (ids.length && ids.every(id => st.cycle.done.includes(id))) st.cycle.done = [];
  return st;
}

let S;
(function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { }
  if (!raw) { try { raw = JSON.parse(localStorage.getItem(LS_OLD)); } catch (e) { } }
  S = migrateState(raw);
})();
const days = () => S.program.custom[S.program.active] || [];

let saveTimer = null, prCache = null;
function writeLocal() {
  clearTimeout(saveTimer);
  try { S.program.days = days(); localStorage.setItem(LS_KEY, JSON.stringify(S)); }
  catch (e) { toast('Не удалось сохранить: ' + e.message); }
}
// saveLocal — черновики и UI: только на устройство. save — данные: метка времени + облако
function saveLocal() { clearTimeout(saveTimer); saveTimer = setTimeout(writeLocal, 250); }
function save() { S.meta.updatedAt = Date.now(); prCache = null; writeLocal(); cloudSyncDebounced(); }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') writeLocal();
  else if (Date.now() - (lastSyncAt || 0) > 30000) cloudSync();
});
window.addEventListener('pagehide', writeLocal);

const PR = () => prCache || (prCache = E.computePRs(S.history));
const cyc = () => S.cycle;
const rec = ex => E.recommend(ex, S.cycle, S.history);

/* =================================================================
   ОБЛАКО (Supabase): pull → merge → push. Историю объединяем по id,
   удаления — через надгробия, поэтому два устройства не затирают друг друга.
   ================================================================= */
const SUPABASE_URL = 'https://hhuilxyuhnymiyihyiww.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xLH52RNmg9AMNVKi3xeEFw_qryYKb9p';
let cloud = null;
try { cloud = JSON.parse(localStorage.getItem(CLOUD_KEY)); } catch (e) { }
let syncTimer = null, syncing = false, lastSyncOk = null, lastSyncAt = null;
const cloudOn = () => !!(cloud && cloud.code);
const hdrs = () => ({ apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' });
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function cloudSyncDebounced() { if (!cloudOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(cloudSync, 1200); }
async function cloudPull() {
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/gymlog_sync?code=eq.' + encodeURIComponent(cloud.code) + '&select=data,updated_at', { headers: hdrs() });
    if (!res.ok) return { error: true };
    const rows = await res.json();
    return rows.length ? { data: rows[0].data } : { empty: true };
  } catch (e) { return { error: true }; }
}
async function cloudPush() {
  S.program.days = days();
  const res = await fetch(SUPABASE_URL + '/rest/v1/gymlog_sync?on_conflict=code', {
    method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates' }, hdrs()),
    body: JSON.stringify([{ code: cloud.code, data: S, updated_at: new Date(S.meta.updatedAt || Date.now()).toISOString() }])
  });
  return res.ok;
}
function mergeStates(local, remote) {
  const ru = (remote.meta && remote.meta.updatedAt) || 0, lu = local.meta.updatedAt || 0;
  const newer = ru > lu ? remote : local, older = newer === local ? remote : local;
  const del = new Set([...(local.deleted || []), ...(remote.deleted || [])]);
  const byId = new Map();
  [newer, older].forEach(st => (st.history || []).forEach(w => { if (w && w.id && !del.has(w.id) && !byId.has(w.id)) byId.set(w.id, w); }));
  const out = JSON.parse(JSON.stringify(newer));
  out.history = [...byId.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
  out.deleted = [...del].slice(-1000);
  // питание: дни объединяем по id записей, вес — по дате (свежее состояние приоритетнее)
  const nl = local.nutrition || defaultNutrition(), nr = remote.nutrition || defaultNutrition();
  const nn = newer === local ? nl : nr, no = newer === local ? nr : nl;
  const log = {};
  new Set([...Object.keys(nl.log || {}), ...Object.keys(nr.log || {})]).forEach(k => {
    const m = new Map();
    [...((nn.log || {})[k] || []), ...((no.log || {})[k] || [])].forEach(i => { if (!del.has(i.id) && !m.has(i.id)) m.set(i.id, i); });
    if (m.size) log[k] = [...m.values()].sort((a, b) => (a.t || 0) - (b.t || 0));
  });
  out.nutrition = Object.assign(defaultNutrition(), JSON.parse(JSON.stringify(nn)), { log, weights: Object.assign({}, no.weights, nn.weights) });
  out.active = local.active; out.ui = local.ui;
  out.meta = { updatedAt: Math.max(lu, ru) };
  return out;
}
async function cloudSync() {
  if (!cloudOn() || syncing) return;
  syncing = true;
  try {
    const r = await cloudPull();
    if (r.error) { lastSyncOk = false; return; }
    if (r.data) {
      const remote = migrateState(r.data);
      const ids = new Set(S.history.map(w => w.id)), dels = new Set(S.deleted);
      const remoteHasNew = (remote.meta.updatedAt || 0) > (S.meta.updatedAt || 0)
        || remote.history.some(w => !ids.has(w.id)) || remote.deleted.some(d => !dels.has(d));
      if (remoteHasNew) {
        S = migrateState(mergeStates(S, remote)); prCache = null; writeLocal();
        if (!isTyping()) render();
      }
    }
    lastSyncOk = await cloudPush();
  } catch (e) { lastSyncOk = false; console.error(e); }
  finally { syncing = false; lastSyncAt = Date.now(); renderSyncStatus(); }
}
const isTyping = () => document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
function syncStatusText() {
  if (!cloudOn()) return '';
  if (lastSyncAt == null) return 'Подключаюсь…';
  const t = new Date(lastSyncAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return lastSyncOk ? '✓ синхронизировано в ' + t : '⚠ ошибка синхронизации (' + t + ') — проверь интернет';
}
function renderSyncStatus() { const el = $('syncStatus'); if (el) el.textContent = syncStatusText(); }

/* =================================================================
   ИКОНКИ И ИЛЛЮСТРАЦИИ
   ================================================================= */
const ICON = {
  plus: '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cal: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="2.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke-linecap="round"/></svg>',
  flame: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 1.5c.5 2.6-3 4-3 7.3A3 3 0 0 0 8 14.5a3.9 3.9 0 0 0 3.9-3.9c0-2.3-1.4-3.2-1.8-5-.8 1.2-1.2 1.8-2 2 .5-2.1.4-4.2-.1-6.1z"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.3 1.5"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 15l.7-3.3L12 3.4a1.6 1.6 0 0 1 2.3 0l.3.3a1.6 1.6 0 0 1 0 2.3l-8.3 8.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
};
/* ---------- снаряды и их визуализация ---------- */
const EQUIP = {
  barbell: 'Штанга', plate: 'Тренажёр с блинами', stack: 'Блок / стек', dumbbell: 'Гантели', bw: 'Свой вес'
};
// по названию — для упражнений из старых версий и новых, добавленных вручную
function inferEquip(ex) {
  if (ex.bw) return 'bw';
  if (ex.bar) return 'barbell';
  const k = normKey(ex.name);
  if (/гантел|молот|французский/.test(k)) return 'dumbbell';
  if (/платформ|жим ногами|носки сидя|хаммер|рычаж/.test(k)) return 'plate';
  if (/штанг/.test(k)) return 'barbell';
  return 'stack';
}
const equipOf = ex => ex.equip || inferEquip(ex);
function setEquip(ex, eq) { ex.equip = eq; ex.bar = eq === 'barbell'; ex.bw = eq === 'bw'; }

// блины IWF: [кг, цвет, высота, толщина]
const PLATES = [[25, '#E4252B', 64, 11], [20, '#2F6FD6', 64, 10], [15, '#F2B705', 56, 9], [10, '#2E9F55', 48, 8], [5, '#F4F4F4', 36, 7], [2.5, '#2A2A2A', 28, 6], [1.25, '#BDBDBD', 22, 5]];
function platesFor(total, bar) {
  let side = (total - bar) / 2;
  const list = [];
  if (side > 0) PLATES.forEach(p => { while (side >= p[0] - 1e-6) { list.push(p); side -= p[0]; } });
  return { list, rest: Math.max(0, Math.round(side * 200) / 100) };
}
// гриф (sled=false) или каретка тренажёра (sled=true) с блинами по сторонам
function loadedSVG(total, sled, W = 220) {
  const bar = sled ? 0 : (S.settings.bar || 20), H = 72, cy = H / 2, { list } = platesFor(total, bar);
  const half = sled ? 30 : 32, iL = W / 2 - half, iR = W / 2 + half;
  let g = sled
    ? `<rect x="${iL - 8}" y="${cy - 3}" width="${iR - iL + 16}" height="6" rx="3" fill="#A9A9A9"/><rect x="${W / 2 - 26}" y="${cy - 20}" width="52" height="40" rx="8" style="fill:var(--dim)"/><rect x="${W / 2 - 18}" y="${cy - 12}" width="36" height="24" rx="5" style="fill:var(--card)"/>`
    : `<rect x="3" y="${cy - 3}" width="${W - 6}" height="6" rx="3" fill="#A9A9A9"/>`;
  if (sled) g += `<rect x="12" y="${cy - 3}" width="${iL - 12}" height="6" rx="3" fill="#A9A9A9"/><rect x="${iR}" y="${cy - 3}" width="${W - 12 - iR}" height="6" rx="3" fill="#A9A9A9"/>`;
  g += `<rect x="${iL - 5}" y="${cy - 8}" width="5" height="16" rx="1.5" fill="#7B7B7B"/><rect x="${iR}" y="${cy - 8}" width="5" height="16" rx="1.5" fill="#7B7B7B"/>`;
  let xl = iL - 5, xr = iR + 5;
  list.forEach(([, col, h, wd]) => {
    if (xl - wd < 4) return;
    xl -= wd + 1;
    const st = col === '#F4F4F4' ? ' stroke="#C8C8C8" stroke-width="1"' : '';
    g += `<rect x="${xl}" y="${cy - h / 2}" width="${wd}" height="${h}" rx="2.5" fill="${col}"${st}/>`;
    g += `<rect x="${xr + 1}" y="${cy - h / 2}" width="${wd}" height="${h}" rx="2.5" fill="${col}"${st}/>`;
    xr += wd + 1;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}</svg>`;
}
function platesCaption(total, sled) {
  const bar = sled ? 0 : (S.settings.bar || 20);
  if (!sled && total < bar) return 'меньше грифа (' + fmtW(bar) + ' кг)';
  const { list, rest } = platesFor(total, bar);
  if (!list.length) return sled ? 'без блинов' : 'пустой гриф ' + fmtW(bar) + ' кг';
  return (sled ? 'на каждую сторону: ' : 'на сторону: ') + list.map(p => fmtW(p[0])).join(' + ') + (rest ? ' (≈, не хватает ' + fmtW(rest * 2) + ' кг)' : '');
}
// стек тренажёра: плиты сверху вниз, штифт под последней поднимаемой
function stackInfo(w) {
  const pk = S.settings.stack || 5, n = Math.floor(w / pk + 1e-6), rem = Math.round((w - n * pk) * 100) / 100;
  return { pk, n, rem };
}
function stackSVG(w) {
  const { n, rem } = stackInfo(w), rows = Math.min(20, Math.max(10, n + 2)), rh = 6, gap = 2, W = 150, pw = 84, x0 = (W - pw) / 2;
  const H = rows * (rh + gap) + 6;
  let g = `<rect x="${W / 2 - 1.5}" y="0" width="3" height="${H}" rx="1.5" style="fill:var(--dim)"/>`;
  for (let i = 0; i < rows; i++) {
    const y = 3 + i * (rh + gap), on = i < n;
    g += `<rect x="${x0}" y="${y}" width="${pw}" height="${rh}" rx="2" style="fill:${on ? 'var(--ink)' : 'var(--line)'}"/>`;
  }
  if (n > 0 && n <= rows) {
    const y = 3 + (n - 1) * (rh + gap) + rh / 2;
    g += `<rect x="${x0 + pw}" y="${y - 1.5}" width="20" height="3" rx="1.5" fill="#E5484D"/><circle cx="${x0 + pw + 22}" cy="${y}" r="4" fill="#E5484D"/>`;
  }
  if (rem) g += `<rect x="${x0 - 22}" y="3" width="16" height="${rh}" rx="2" fill="#E5484D"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}</svg>`;
}
// гантель: размер «блинов» растёт с весом
function dumbbellSVG(w) {
  const k = Math.min(1, (w || 0) / 40), hh = 36 + k * 22, hw = 14 + k * 8, W = 130, H = 64, cy = H / 2;
  const L = 40, R = W - 40;
  let g = `<rect x="${L}" y="${cy - 3}" width="${R - L}" height="6" rx="3" fill="#A9A9A9"/>`;
  [[L - hw, 1], [R, 1]].forEach(([x]) => {
    g += `<rect x="${x}" y="${cy - hh / 2}" width="${hw}" height="${hh}" rx="4" style="fill:var(--ink)"/>`;
  });
  g += `<rect x="${L - hw - 6}" y="${cy - hh / 2 + 5}" width="6" height="${hh - 10}" rx="2.5" style="fill:var(--ink2)"/><rect x="${R + hw}" y="${cy - hh / 2 + 5}" width="6" height="${hh - 10}" rx="2.5" style="fill:var(--ink2)"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}</svg>`;
}
const BW_SVG = '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" fill="none" style="stroke:var(--ink)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="12" r="6"/><path d="M32 20v20M18 26l14 4 14-4M24 58l8-18 8 18"/></svg>';
// иллюстрация + подпись для любого снаряда
function equipArt(ex, w, reps) {
  const eq = equipOf(ex);
  if (eq === 'bw') return { svg: BW_SVG, cap: 'свой вес' + (reps ? ' · ' + reps + ' ' + repWord(ex) : '') };
  if (!w) return { svg: '', cap: '' };
  if (eq === 'barbell') return { svg: loadedSVG(w, false), cap: platesCaption(w, false) };
  if (eq === 'plate') return { svg: loadedSVG(w, true), cap: platesCaption(w, true) };
  if (eq === 'dumbbell') return { svg: dumbbellSVG(w), cap: fmtW(w) + ' кг в каждой руке' };
  const { pk, n, rem } = stackInfo(w);
  return { svg: stackSVG(w), cap: `штифт на ${n}-й плите (по ${fmtW(pk)} кг)${rem ? ' + доп. блин ' + fmtW(rem) + ' кг' : ''}` };
}

/* =================================================================
   УТИЛИТЫ
   ================================================================= */
const localKey = d => { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtDate = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const mmss = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
const restOf = tier => E.restFor(tier, S.settings.rest);
const fmtRest = s => s >= 60 ? Math.floor(s / 60) + (s % 60 ? ':' + String(s % 60).padStart(2, '0') : '') + ' мин' : s + ' с';
const tonnage = en => en.sets.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0);
const repWord = ex => /\(сек\)/.test(ex.name) ? 'сек' : 'повт.';
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const weekName = wk => wk === 0 ? 'Подбор 1ПМ' : wk === 4 ? 'Разгрузка' : 'Неделя ' + wk;
const setsLine = en => en.sets.map(s => `${en.bw ? '' : fmtW(s.w) + '×'}${s.r} <span class="dot ${s.tier || 'g'}"></span>`).join('&nbsp; ');
function findEx(key) { for (const d of days()) for (const ex of d.exercises) if (ex.key === key) return ex; return null; }
function nextDayIndex() { const ds = days(); const i = ds.findIndex(d => !S.cycle.done.includes(d.id)); return i < 0 ? 0 : i; }
const CARDIO_TYPES = ['Дорожка', 'Велотренажёр', 'Эллипс', 'Гребля', 'Степпер'];
const cardioCfg = () => Object.assign({ on: true, type: 'Велотренажёр', min: 10 }, S.settings.cardio || {});
// лёгкая аэробная зона перед силовой: 60–70% от макс. пульса (220 − возраст)
function hrZone() {
  const age = S.nutrition && S.nutrition.profile && S.nutrition.profile.age;
  if (!age) return 'пульс ~60–70% от максимума, можно говорить';
  const mx = 220 - age;
  return `пульс ${Math.round(mx * 0.6)}–${Math.round(mx * 0.7)}, можно говорить`;
}
function cardioHTML() {
  const c = S.active.cardio;
  if (!c) return '';
  if (c.done) return `<div class="coupon collapsed cardioRow"><div class="exHead" data-act="cardioReopen"><div class="exName">Кардио</div><span class="cnt full">✓ ${c.min} мин</span></div></div>`;
  if (!c.open) return `<div class="coupon collapsed cardioRow"><div class="row"><button class="grow" style="text-align:left" data-act="cardioOpen"><span class="exName" style="display:block">Кардио · ${c.min} мин</span><span class="exMeta" style="display:block">${esc(c.type)} · лёгкий темп</span></button>
    <button class="pill sm" data-act="cardioTimer">Таймер</button><button class="pill sm dark" data-act="cardioDone">✓</button></div></div>`;
  return `<div class="coupon"><div class="exHead"><div class="exName" data-act="cardioOpen">Кардио · ${c.min} мин</div><button class="cnt" data-act="cardioSkip">пропустить</button></div>
    <div class="exMeta">лёгкий темп · ${hrZone()}</div>
    <div class="warmBox"><div class="eqPick">${CARDIO_TYPES.map(t => `<button class="chip${t === c.type ? ' on' : ''}" data-act="cardioType" data-a="${t}">${t}</button>`).join('')}</div></div>
    <div class="stpLbl" style="margin-top:14px">Минут</div>
    <div class="stepper"><button data-act="cardioMin" data-a="-1">−</button><input value="${c.min}" readonly><button data-act="cardioMin" data-a="1">+</button></div>
    <div class="two" style="margin-top:10px"><button class="btn ghost" data-act="cardioTimer">Таймер ${c.min} мин</button><button class="btn" data-act="cardioDone">Готово</button></div></div>`;
}
// «цель: легко» / «цель: средне, последний — отказ» — вместо ряда цветных точек
function goalText(tiers) {
  if (!tiers || !tiers.length) return '';
  const first = tiers[0], last = tiers[tiers.length - 1];
  return '· цель: ' + TIER[first].title.toLowerCase() + (last !== first ? ', последний — ' + TIER[last].title.toLowerCase() : '');
}
const setBudget = () => S.settings.setBudget ?? 28;
function estMin(d) { return Math.round(Math.min(setBudget() || 99, d.exercises.reduce((a, ex) => a + E.phase(ex, S.cycle).sets, 0)) * (restOf('y') + 40) / 60) + (cardioCfg().on ? cardioCfg().min : 0); }
function weekStreak() {
  if (!S.history.length) return 0;
  const wk = iso => { const d = new Date(iso); const dow = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow); return localKey(d); };
  const weeks = new Set(S.history.map(w => wk(w.date)));
  const cur = new Date(wk(new Date()) + 'T00:00:00');
  if (!weeks.has(localKey(cur))) cur.setDate(cur.getDate() - 7);
  let n = 0;
  while (weeks.has(localKey(cur))) { n++; cur.setDate(cur.getDate() - 7); }
  return n;
}
function weekComplete() { const ids = days().map(d => d.id); return ids.length > 0 && ids.every(id => S.cycle.done.includes(id)); }
function advanceWeek() {
  const from = { meso: S.cycle.meso, week: S.cycle.week };
  let { meso, week } = S.cycle;
  week++; if (week > 4) { week = 1; meso++; }
  S.cycle = { meso, week, done: [], weekStartedAt: Date.now() };
  return { from, to: { meso, week } };
}

/* =================================================================
   РЕНДЕР
   ================================================================= */
const segHTML = (items, cur, act) => '<div class="seg">' + items.map(([k, l]) =>
  `<button class="${k === cur ? 'on' : ''}" data-act="${act}" data-a="${k}"><span class="br">❬</span>${l}<span class="br">❭</span></button>`).join('') + '</div>';

function render() {
  const t = S.ui.tab;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.a === t));
  $('navDot').style.display = S.active && t !== 'home' ? '' : 'none';
  let v;
  if (t === 'program') v = vProgram();
  else if (t === 'food') v = vFood();
  else if (t === 'progress') v = vProgress();
  else if (t === 'profile') v = vProfile();
  else v = { seg: '', body: S.active ? vActive() : vHome() };
  $('segbar').innerHTML = v.seg || '';
  $('app').innerHTML = v.body;
  renderHeader();
  renderDock();
  if (t === 'progress' && (S.ui.progTab || 'charts') === 'charts') drawChart();
  if (t === 'food' && S.ui.foodTab === 'weight') drawWeightChart();
}
function renderHeader() {
  const c = S.cycle;
  $('hdTitle').innerHTML = `Мезоцикл ${c.meso} · ${c.week === 0 ? 'Подбор 1ПМ' : c.week === 4 ? 'Разгрузка' : 'Неделя ' + c.week + ' · ' + WEEKS[c.week].name} ${ICON.chev}`;
  if (S.active) $('hdSub').innerHTML = `${ICON.clock}<span id="elapsed">Тренировка идёт · ${elapsed()}</span>`;
  else {
    const n = days().length, d = S.cycle.done.filter(id => days().some(x => x.id === id)).length, st = weekStreak();
    $('hdSub').innerHTML = `${ICON.cal}<span>${d} из ${n} ${plural(n, 'тренировки', 'тренировок', 'тренировок')}</span><span class="sep">|</span>${ICON.flame}<span>${st} нед. подряд</span>`;
  }
}
function elapsed() {
  if (!S.active) return '';
  const s = Math.floor((Date.now() - S.active.startedAt) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
}
setInterval(() => { const el = $('elapsed'); if (el && S.active) el.textContent = 'Тренировка идёт · ' + elapsed(); }, 1000);

/* ---------- ГЛАВНАЯ ---------- */
function weeksHTML() {
  const c = S.cycle;
  const calib = c.week === 0 ? `<div class="wk cur" style="margin-bottom:8px"><div class="wkTitle">Подбор 1ПМ</div>
    <div class="wkSub"><span class="dot b"></span>разведка силы · без отказа</div>
    <div class="wkFoot">${days().map(d => `<span class="dd${c.done.includes(d.id) ? ' on' : ''}"></span>`).join('')}</div></div>` : '';
  return calib + '<div class="grid2">' + [1, 2, 3, 4].map(wk => {
    const st = wk < c.week ? 'past' : wk === c.week ? 'cur' : '';
    const foot = wk === c.week ? days().map(d => `<span class="dd${c.done.includes(d.id) ? ' on' : ''}"></span>`).join('')
      : wk < c.week ? '✓ пройдена' : '';
    const sub = wk === 4 ? '−10% веса' : wk === 1 ? 'легко' : wk === 2 ? 'средне' : 'средне + отказ';
    return `<div class="wk ${st}" style="--cc:${WEEK_CC[wk]}"><div class="wkTitle">${weekName(wk)}</div>
      <div class="wkSub"><span class="dot ${weekDot(wk)}"></span>${wk === 4 ? '50% объёма' : WEEKS[wk].name} · ${sub}</div>
      <div class="perf"><i></i><i></i></div><div class="wkFoot">${foot}</div></div>`;
  }).join('') + '</div>';
}
function vHome() {
  const ds = days();
  if (!ds.length) return `<div class="empty">В активной программе нет дней.<br><br><button class="btn" data-act="tab" data-a="program">Открыть программу</button></div>`;
  const ni = nextDayIndex();
  let h = '<h1 class="big">Тренировки</h1><div class="pad"><div class="list">';
  ds.forEach((d, i) => {
    const done = S.cycle.done.includes(d.id);
    h += `<button class="dayRow${i === ni ? ' next' : ''}${done ? ' done' : ''}" data-act="startDay" data-a="${d.id}">
      <span class="dayMark">${done ? '✓' : i + 1}</span>
      <span class="grow"><span class="liT">${esc(d.name)}</span><span class="liS">${d.exercises.length} упр. · ~${estMin(d)} мин${done ? ' · сделано на этой неделе' : ''}</span></span>
      <span class="dayGo">${i === ni ? 'Начать' : '›'}</span></button>`;
  });
  h += '</div></div>';

  const lastW = S.history.length ? S.history[S.history.length - 1] : null;
  const gap = lastW ? Math.floor((Date.now() - new Date(lastW.date)) / 864e5) : null;
  if (S.cycle.week !== 0 && !S.active && (gap == null || gap >= 28)) h += `<div class="pad" style="margin-top:12px"><div class="coupon">
    <div class="cTitle">${gap == null ? 'Сначала — подбор 1ПМ' : 'Перерыв ' + gap + ' дн. — начни с подбора 1ПМ'}</div>
    <p class="cText">Неделя разведки: по каждому упражнению поднимаешь вес до «средне», приложение считает текущую силу. Дальше рабочие веса строятся от неё.</p>
    <button class="btn" style="margin-top:12px" data-act="cycleAction" data-a="calib">Начать подбор 1ПМ</button></div></div>`;
  const f = E.fatigueSignal(S.history, S.cycle);
  if (f) h += `<div class="pad"><div class="coupon" style="--cc:var(--p5)"><div class="cTitle">Похоже на перегруз</div>
    <p class="cText">Две тренировки подряд с провалами (${f.downs} упр.)${f.fails ? ' и ' + f.fails + ' незапланированных отказов' : ''}. Разгрузка сейчас поможет восстановиться.</p>
    <div class="perf"><i></i><i></i></div><button class="pill" data-act="cycleAction" data-a="deload">Уйти на разгрузку ${ICON.plus}</button></div></div>`;

  h += `<h1 class="big">Мезоцикл ${S.cycle.meso}</h1><div class="pad">${weeksHTML()}
    <p class="muted" style="font-size:13px;margin:10px 2px 0">${WEEKS[S.cycle.week].name}: ${WEEKS[S.cycle.week].desc}. Неделя закрывается, когда пройдены все дни программы.</p></div>`;

  const nd = ds[nextDayIndex()];
  if (nd && nd.exercises.length) {
    h += `<h1 class="big">План: ${esc(nd.name)}</h1><div class="hs">`;
    nd.exercises.forEach(ex => {
      const r = rec(ex);
      const tag = r.reason === 'up' ? `<span class="tagRed">+${fmtW(ex.step)} кг</span>` : r.reason === 'down' ? `<span class="tagGrey">−${fmtW(ex.step)} кг</span>`
        : r.reason === 'hold' ? '<span class="tagGrey">+1 повт.</span>' : r.reason === 'deload' ? '<span class="tagGrey">разгрузка</span>'
        : r.reason === 'reset' ? '<span class="tagGrey">новый цикл</span>' : '<span class="tagGrey">новое</span>';
      const price = ex.bw ? `×${r.reps} ${repWord(ex)}` : r.w != null ? `${r.prevW != null && r.prevW !== r.w ? '<s>' + fmtW(r.prevW) + '</s> ' : ''}${fmtW(r.w)} кг` : 'подбери';
      h += `<div class="prod" data-act="startDay" data-a="${nd.id}"><span class="prodTag">${tag}</span>
        <div class="prodName">${esc(ex.name)}</div>
        <div class="pill">${price}</div>
        <div class="prodMeta">${r.sets} × ${ex.repMin}–${ex.repMax} ${goalText(r.tiers)}</div></div>`;
    });
    h += '</div>';
  }
  return h;
}
/* ---------- АКТИВНАЯ ТРЕНИРОВКА ---------- */
// планы на день: в неделю подбора — разведка, иначе рекомендация с лимитом подходов
function planDay(day) {
  const calib = S.cycle.week === 0;
  const recs = day.exercises.map(ex => {
    const r = rec(ex);
    if (!calib && !(r.reason === 'calib' && !ex.bw)) return { ex, r };
    const reps = E.midReps(ex), est = r.e1rm;
    const start = ex.bw ? 0 : est ? E.roundStep(E.weightFor(est, reps, 'y') * 0.7, ex.step) : null;
    return { ex, r: { ...r, mode: 'calib', sets: 1, tiers: ['y'], tier: 'y', reps, w: start, prevW: null, deload: false,
      note: ex.bw ? 'Один подход: максимум повторов с запасом 1–2' : start ? 'Начни с ~70% от прошлой оценки и поднимай, пока не станет «средне»' : 'Начни с лёгкого веса и поднимай, пока не станет «средне»' } };
  });
  if (calib) return recs;
  const fit = E.fitBudget(recs.map(({ ex, r }) => ({ sets: r.sets, tiers: r.tiers, heavy: ex.heavy })), setBudget());
  return recs.map((x, i) => x.r.mode === 'calib' ? x : ({ ex: x.ex, r: { ...x.r, sets: fit[i].sets, tiers: fit[i].tiers } }));
}
function startWorkout(dayId) {
  if (S.active) { setTab('home'); return; }
  const day = days().find(d => d.id === dayId);
  if (!day) return;
  if (!day.exercises.length) { toast('В этом дне нет упражнений'); return; }
  S.active = {
    dayId, dayName: day.name, startedAt: Date.now(), meso: S.cycle.meso, week: S.cycle.week, open: 0,
    entries: planDay(day).map(({ ex, r }) => {
      return {
        exId: ex.id, key: ex.key, name: ex.name, group: ex.group, bw: ex.bw, bar: ex.bar, equip: equipOf(ex), heavy: ex.heavy, step: ex.step, rest: ex.rest,
        repMin: ex.repMin, repMax: ex.repMax, plan: r, sets: [], draft: { w: r.w || 0, r: r.reps || ex.repMin }
      };
    }),
    cardio: cardioCfg().on ? { type: cardioCfg().type, min: cardioCfg().min, done: false } : null
  };
  S.ui.tab = 'home'; saveLocal(); render(); window.scrollTo(0, 0);
}
function vActive() {
  const a = S.active;
  const tot = a.entries.reduce((s, e) => s + e.plan.sets, 0), dn = a.entries.reduce((s, e) => s + Math.min(e.sets.length, e.plan.sets), 0);
  let h = `<div class="pad" style="padding-top:8px"><div class="row" style="margin-bottom:8px"><span class="grow"><h2 class="mid">${esc(a.dayName)}</h2><span class="muted num" style="font-size:13px">${dn} из ${tot} подходов</span></span>
    <button class="pill sm dark" data-act="finish">Завершить</button></div>
    <div class="prog" style="margin-bottom:12px"><i style="width:${tot ? dn / tot * 100 : 0}%"></i></div>`;
  h += cardioHTML();
  // невыполненные — сверху в своём порядке, выполненные — вниз под подписью «Сделано»
  const isFull = e => e.sets.length >= e.plan.sets;
  const order = a.entries.map((e, i) => i).sort((x, y) => (isFull(a.entries[x]) - isFull(a.entries[y])) || ((y === a.open) - (x === a.open)) || x - y);
  let shownDone = false;
  order.forEach(ei => {
    const en = a.entries[ei];
    if (isFull(en) && !shownDone) { shownDone = true; h += '<div class="doneSep">Сделано</div>'; }
    h += exCoupon(en, ei, ei === a.open);
  });
  h += `<button class="btn" style="margin-top:6px" data-act="finish">Завершить и зафиксировать</button>
    <button class="btn danger" data-act="cancelWorkout">Отменить без сохранения</button></div>`;
  return h;
}
function exCoupon(en, ei, open) {
  const p = en.plan, done = en.sets.length, full = done >= p.sets;
  const dots = goalText(p.tiers);
  const calib = p.mode === 'calib';
  const cnt = calib ? (en.calibDone ? (en.calibE1RM ? '✓ 1ПМ ≈ ' + fmtW(Math.round(en.calibE1RM)) : '✓') : 'подбор') : done + '/' + p.sets;
  const head = `<div class="exHead" data-act="toggleEx" data-a="${ei}"><div class="exName">${esc(en.name)}</div><span class="cnt num${full ? ' full' : ''}">${cnt}</span></div>
    <div class="exMeta">${calib ? `подбор · по ${p.reps} ${repWord(en)} до «средне», без отказа` : `${p.sets} × ${en.repMin}–${en.repMax} ${repWord(en)} ${dots}`}</div>`;
  const acts = `<div class="exLinks"><button data-act="exLater" data-a="${ei}">Позже</button>${en.sets.length ? '' : `<button data-act="exSwap" data-a="${ei}">Заменить</button>`}</div>`;
  if (!open) {
    const chips = en.sets.map(s => `<span class="miniSet"><span class="dot ${s.tier}"></span>${en.bw ? '' : fmtW(s.w) + '×'}${s.r}</span>`).join('');
    return `<div class="coupon collapsed" id="ex${ei}" style="--cc:${pastel(ei)}">${head}${chips ? '<div class="miniSets">' + chips + '</div>' : ''}</div>`;
  }
  const d = en.draft;
  const old = !en.bw && p.prevW != null && p.prevW !== p.w ? `<s>${fmtW(p.prevW)}</s>` : '';
  const price = en.bw ? `×${p.reps} ${repWord(en)}` : p.w != null ? `${fmtW(p.w)} кг <span class="pillSub">× ${p.reps}</span>` : 'подбери вес';
  const art = equipArt(en, d.w || p.w, d.r || p.reps);
  let b = `<div class="pill">${old} ${price}</div><div class="note">${esc(p.note || '')}</div>${acts}
    <div class="exArt">${art.svg}${art.cap ? `<div class="plCap">${art.cap}</div>` : ''}</div>`;
  if (!done && !calib) b += warmupHTML(en, ei);
  b += '<div class="perf"><i></i><i></i></div>';
  en.sets.forEach((s, i) => {
    b += `<div class="setRow"><span class="n">${i + 1}</span><span class="v">${en.bw ? s.r + ' ' + repWord(en) : fmtW(s.w) + ' кг × ' + s.r}</span>
      ${s.pr ? '<span class="tagRed">рекорд</span>' : ''}<span class="dot ${s.tier}"></span><button class="x" data-act="delSet" data-a="${ei}" data-b="${i}" aria-label="Удалить подход">✕</button></div>`;
  });
  if (calib && en.calibDone) b += `<div class="doneRow"><span>${en.calibE1RM ? 'Сила зафиксирована: 1ПМ ≈ ' + fmtW(Math.round(en.calibE1RM)) + ' кг' : 'Зафиксировано'}</span></div>`;
  if (!full && !calib) {
    b += hintHTML(en);
  } else if (!calib) {
    b += `<div class="doneRow"><span>Готово ✓</span><button class="pill sm" data-act="extraSet" data-a="${ei}">Ещё подход ${ICON.plus}</button></div>`;
  }
  return `<div class="coupon" id="ex${ei}" style="--cc:${pastel(ei)}">${head}${b}</div>`;
}
// закреплённая панель ввода подхода над меню: не уезжает при прокрутке списка
function dockHTML(en, ei) {
  const p = en.plan, done = en.sets.length, d = en.draft, calib = p.mode === 'calib', tgt = E.targetTier(p, done);
  const step = (k, v, unit) => `<div class="dStep"><button data-act="bump" data-a="${ei}" data-b="${k}" data-c="-1" aria-label="Меньше">−</button>
    <label><input inputmode="decimal" value="${k === 'w' ? fmtW(v || 0) : v}" data-chg="draft" data-a="${ei}" data-b="${k}"><span>${unit}</span></label>
    <button data-act="bump" data-a="${ei}" data-b="${k}" data-c="1" aria-label="Больше">+</button></div>`;
  return `<div class="dockHead"><span class="grow"><b>${esc(en.name)}</b> · ${calib ? 'попытка ' + (done + 1) : 'подход ' + (done + 1) + ' из ' + p.sets}</span>
      <span class="dot ${tgt}"></span><span class="${tgt === 'r' ? 'fail' : ''}">${tgt === 'r' ? 'до отказа' : TIER[tgt].title.toLowerCase()}</span></div>
    <div class="dockRow">${en.bw ? '' : step('w', d.w, 'кг')}${step('r', d.r, /\(сек\)/.test(en.name) ? 'сек' : 'повт')}</div>
    <div class="rir dockRir">${['g', 'y', 'r'].map(k => `<button class="${k}${k === tgt ? ' tgt' : ''}${k === d.tier ? ' sel' : ''}" data-act="pickTier" data-a="${ei}" data-b="${k}"><b>${TIER[k].title}</b></button>`).join('')}</div>
    <button class="btn dockBtn" data-act="logSet" data-a="${ei}" ${d.tier ? '' : 'disabled'}>${d.tier
      ? `Записать: ${en.bw ? '' : fmtW(d.w) + ' кг × '}${d.r} · ${TIER[d.tier].title.toLowerCase()}` : 'Выбери, как прошёл подход'}</button>`;
}
function renderDock() {
  const a = S.active, dock = $('dock');
  const en = a && S.ui.tab === 'home' && a.open >= 0 ? a.entries[a.open] : null;
  const show = !!(en && en.sets.length < en.plan.sets);
  dock.innerHTML = show ? dockHTML(en, a.open) : '';
  dock.classList.toggle('show', show);
  document.body.classList.toggle('docked', show);
  document.documentElement.style.setProperty('--dockH', (show ? dock.offsetHeight : 0) + 'px');
}
function warmupHTML(en, ei) {
  const w = en.draft.w || en.plan.w;
  const ws = E.warmupSets(en, w, { bar: S.settings.bar || 20, deload: en.plan.deload });
  if (!ws.length) {
    if (!en.bw && !w) return '<div class="warmBox"><div class="warmT">Разминка</div><div class="warmN">2 лёгких подхода по 8–10, затем подбери рабочий вес</div></div>';
    return '';
  }
  const done = en.warmDone || [];
  const chips = ws.map((s, i) => `<button class="warmChip${done[i] ? ' on' : ''}" data-act="warmDone" data-a="${ei}" data-b="${i}">${en.bw ? '×' + s.r : (en.bar && s.w === (S.settings.bar || 20) ? 'гриф' : fmtW(s.w)) + ' × ' + s.r}</button>`).join('');
  return `<div class="warmBox"><div class="warmT">Разминка <span>${done.filter(Boolean).length}/${ws.length} · на прогрессию не влияет</span></div><div class="warmChips">${chips}</div></div>`;
}
function stepperHTML(ei, k, v) {
  return `<div class="stepper"><button data-act="bump" data-a="${ei}" data-b="${k}" data-c="-1" aria-label="Меньше">−</button>
    <input inputmode="decimal" value="${k === 'w' ? fmtW(v || 0) : v}" data-chg="draft" data-a="${ei}" data-b="${k}">
    <button data-act="bump" data-a="${ei}" data-b="${k}" data-c="1" aria-label="Больше">+</button></div>`;
}
function hintHTML(en) {
  const last = en.sets[en.sets.length - 1];
  if (!last) return '';
  const h = E.nextSetHint(en, last, en.sets.length - 1);
  if (!h) return '';
  return `<div class="hint">После подхода ${en.sets.length}: <b>${fmtW(h.w)} кг</b> — ${h.note}</div>`;
}
function logSet(ei) {
  const en = S.active.entries[ei], d = en.draft, tier = d.tier;
  if (!tier) { toast('Выбери, как прошёл подход'); return; }
  if (!(d.r > 0)) { toast('Укажи количество повторов'); return; }
  if (!en.bw && !(d.w > 0)) { toast('Укажи вес'); return; }
  const s = { w: en.bw ? 0 : d.w, r: d.r, tier };
  const best = PR().best[en.key];
  if (best) {
    const v = en.bw ? s.r : E.e1rm(s.w, s.r, s.tier);
    const prior = Math.max(best.v, ...en.sets.map(x => en.bw ? x.r : (E.e1rm(x.w, x.r, x.tier) || 0)));
    if (v > prior + 0.01) s.pr = true;
  }
  en.sets.push(s);
  if (en.plan.mode === 'calib') {
    const c = E.calibStep(en, s, en.sets.length);
    if (c.done) { en.calibDone = true; en.calibE1RM = c.e1rm; en.plan.sets = en.sets.length; }
    else { en.plan.sets = en.sets.length + 1; d.w = c.nextW; en.plan.tiers = Array(en.plan.sets).fill('y'); }
  } else {
    const h = E.nextSetHint(en, s, en.sets.length - 1);
    if (h) d.w = h.w;
  }
  d.tier = null;
  let moved = false;
  if (en.sets.length >= en.plan.sets) {
    const nx = S.active.entries.findIndex((e, i) => i > ei && e.sets.length < e.plan.sets);
    const nx2 = nx >= 0 ? nx : S.active.entries.findIndex(e => e.sets.length < e.plan.sets);
    if (nx2 >= 0) { S.active.open = nx2; moved = true; }
  }
  saveLocal(); render();
  if (moved) { const el = $('ex' + S.active.open); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  toast((s.pr ? '🏆 Рекорд! ' : '') + `${en.bw ? '' : fmtW(s.w) + '×'}${s.r} · ${TIER[tier].title.toLowerCase()}`, () => {
    const e2 = S.active && S.active.entries[ei];
    if (!e2) return;
    e2.sets.pop(); e2.draft.w = s.w; e2.draft.r = s.r; e2.draft.tier = s.tier; S.active.open = ei;
    if (e2.plan.mode === 'calib') { e2.calibDone = false; e2.calibE1RM = null; e2.plan.sets = e2.sets.length + 1; }
    restStop(); saveLocal(); render();
  });
  restStart(restOf(tier), tier);
}
function finishWorkout() {
  const a = S.active;
  const entries = a.entries.filter(e => e.sets.length).map(e => {
    const plan = { sets: e.plan.sets, tiers: e.plan.tiers, tier: e.plan.tier, repMin: e.repMin, repMax: e.repMax, w: e.plan.w, reps: e.plan.reps, mode: e.plan.mode };
    const j = e.plan.mode === 'calib' ? { outcome: 'calib', unplanned: 0 } : E.judge(e.sets, plan, e.bw);
    return { key: e.key, name: e.name, exId: e.exId, bw: e.bw, plan, outcome: j ? j.outcome : 'hold', unplanned: j ? j.unplanned : 0, sets: e.sets.map(s => ({ w: s.w, r: s.r, tier: s.tier })) };
  });
  if (!entries.length) {
    confirmSheet('Ни один подход не записан. Завершить без сохранения?', () => { S.active = null; restStop(); saveLocal(); render(); }, { title: 'Пустая тренировка', yes: 'Завершить', danger: true });
    return;
  }
  const achBefore = unlockedNames(), prBefore = PR().best;
  const recd = {
    id: uid(), date: new Date().toISOString(), dayId: a.dayId, dayName: a.dayName,
    durMin: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)), meso: a.meso, week: a.week, deload: a.week === 4, entries,
    cardio: a.cardio && a.cardio.done ? { type: a.cardio.type, min: a.cardio.min } : null
  };
  S.history.push(recd);
  let closed = null;
  if (a.meso === S.cycle.meso && a.week === S.cycle.week) {
    if (!S.cycle.done.includes(a.dayId)) S.cycle.done.push(a.dayId);
    if (weekComplete()) closed = advanceWeek();
  }
  S.active = null; restStop(); save();
  const newAch = unlockedNames().filter(n => !achBefore.includes(n));
  S.ui.tab = 'home'; render(); window.scrollTo(0, 0);
  openReceipt(recd, prBefore, closed, newAch);
}
function openReceipt(r, prBefore, closed, newAch) {
  const ton = r.entries.reduce((a, e) => a + tonnage(e), 0);
  const OUT = { up: '↑', hold: '=', down: '↓' };
  let rows = '';
  r.entries.forEach(en => {
    const ex = findEx(en.key), top = E.topValue(en).v;
    const isPR = prBefore[en.key] && top > prBefore[en.key].v + 0.01;
    let next = '—';
    if (ex) { const n = rec(ex); next = ex.bw ? `×${n.reps}` : n.w != null ? `${n.prevW != null && n.prevW !== n.w ? '<s>' + fmtW(n.prevW) + '</s> ' : ''}${fmtW(n.w)} кг` : '—'; }
    rows += `<div class="li"><div class="grow"><div class="liT">${esc(en.name)} ${isPR ? '<span class="tagRed">рекорд</span>' : ''}</div>
      <div class="liS num">${setsLine(en)}</div></div>
      <div style="text-align:right;flex:none"><div class="liS">${OUT[en.outcome] || ''} дальше</div><div class="num" style="font-weight:600">${next}</div></div></div>`;
  });
  let cyc = closed
    ? `<b>${weekName(closed.from.week)} закрыта.</b> ${closed.to.week === 1 ? 'Начинается мезоцикл ' + closed.to.meso + ': веса пересчитаны под «легко», у изолирующих +1 подход к стартовому объёму.' : 'Дальше: ' + weekName(closed.to.week) + ' · ' + WEEKS[closed.to.week].name + ' — ' + WEEKS[closed.to.week].desc + '.'}`
    : `${weekName(S.cycle.week)}: пройдено ${S.cycle.done.length} из ${days().length} дней.`;
  openSheet(`<div class="coupon" style="--cc:var(--p4);margin-top:12px">
    <div class="cTitle">Тренировка зафиксирована</div>
    <p class="cText num">${fmtDate(r.date)} · ${r.durMin} мин · ${Math.round(ton).toLocaleString('ru-RU')} кг тоннаж</p>
    <div class="perf"><i></i><i></i></div>
    <div class="card" style="margin:0">${rows}</div>
    <div class="perf"><i></i><i></i></div>
    ${r.cardio ? `<p class="cText">Кардио: ${esc(r.cardio.type)}, ${r.cardio.min} мин</p>` : ''}
    <p class="cText">${cyc}</p>
    ${newAch.length ? `<p class="cText" style="margin-top:10px">🏆 Новое: <b>${newAch.map(esc).join(', ')}</b></p>` : ''}
  </div><button class="btn" data-act="closeSheet">Отлично</button>`);
}

/* ---------- ТАЙМЕР ОТДЫХА ---------- */
let restEnd = 0, restTotal = 0, restIv = null, audioCtx = null;
const RING_C = 2 * Math.PI * 21;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination); o.frequency.value = 880;
    g.gain.setValueAtTime(.4, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .6);
    o.start(); o.stop(audioCtx.currentTime + .6);
  } catch (e) { }
  if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (e) { }
}
document.addEventListener('touchstart', () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { } }, { once: true });
let restKind = 'rest';
function restStart(sec, tier, kind) {
  restTotal = sec; restEnd = Date.now() + sec * 1000; restKind = kind || 'rest';
  $('restL').textContent = kind === 'cardio' ? 'кардио' : tier ? 'после «' + TIER[tier].title.toLowerCase() + '»' : 'отдых';
  $('restbar').classList.add('show'); document.body.classList.add('resting');
  clearInterval(restIv); restIv = setInterval(restTick, 250); restTick();
}
function restTick() {
  const left = Math.max(0, restEnd - Date.now()), s = Math.ceil(left / 1000);
  $('restT').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  $('restRing').style.strokeDasharray = RING_C.toFixed(1);
  $('restRing').style.strokeDashoffset = (RING_C * (1 - (restTotal ? left / (restTotal * 1000) : 0))).toFixed(1);
  if (left <= 0) { restStop(); beep(); toast(restKind === 'cardio' ? '⏱ Кардио окончено — переходи к силовой' : '⏱ Отдых окончен — следующий подход'); }
}
function restStop() { clearInterval(restIv); $('restbar').classList.remove('show'); document.body.classList.remove('resting'); }

/* ---------- ПРОГРАММА ---------- */
const scopeLabel = k => ({ fullbody: 'Фулбоди', split: 'Сплит', mine: 'Моя', prev: 'Прошлая' })[k] || k;
const dsOf = sc => S.program.custom[sc];
function curScope() { const sc = S.ui.progScope; return sc && S.program.custom[sc] ? sc : S.program.active; }
// сколько упражнений и подходов в неделю получает каждая группа: неделя 1 → пик (неделя 3)
function groupsCard(sc, ds) {
  const g = {};
  ds.forEach(d => d.exercises.forEach(ex => {
    const k = ex.group || 'other', r = (g[k] = g[k] || { n: 0, s1: 0, s3: 0 });
    r.n++; r.s1 += E.phase(ex, { meso: S.cycle.meso, week: 1 }).sets; r.s3 += E.phase(ex, { meso: S.cycle.meso, week: 3 }).sets;
  }));
  const per = ds.length ? Math.round(ds.reduce((a, d) => a + d.exercises.length, 0) / ds.length) : 0;
  const rows = [...Object.keys(L.GROUPS), 'other'].filter(k => g[k]).map(k => `<div class="li"><span class="grow liT">${L.GROUPS[k] || 'Другое'}</span>
    <span class="liS num" style="margin:0">${g[k].n} упр. · ${g[k].s1}→${g[k].s3} подх./нед</span></div>`).join('');
  return `<details class="card groupsBox"${S.ui.groupsOpen ? ' open' : ''}><summary class="row" data-act="groupsToggle"><h2 class="mid grow">Группы мышц</h2><span class="muted" style="font-size:13px">~${per} упр. на тренировку ›</span></summary>
    ${sc === 'fullbody' ? `<div class="row" style="margin:10px 0 4px"><span class="grow liS" style="margin:0">Упражнений на тренировку</span>
      ${[6, 7, 8].map(n => `<button class="chip${S.program.fbCount === n ? ' on' : ''}" style="background:${S.program.fbCount === n ? '' : 'var(--field)'}" data-act="fbCount" data-a="${n}">${n}</button>`).join('')}</div>` : ''}
    ${rows}</details>`;
}
function vProgram() {
  const sc = curScope(), ds = dsOf(sc), isAct = sc === S.program.active;
  const di = Math.min(S.ui.progDay || 0, Math.max(0, ds.length - 1));
  const seg = segHTML(Object.keys(S.program.custom).map(k => [k, scopeLabel(k) + (k === S.program.active ? ' <span class="dot g" title="активная"></span>' : '')]), sc, 'progScope');
  let h = '<div class="chips">' + ds.map((d, i) => `<button class="chip${i === di ? ' on' : ''}" data-act="progDay" data-a="${i}">${esc(d.name)}</button>`).join('')
    + (ds.length ? `<button class="chip" data-act="renameDay" data-a="${sc}" data-b="${di}" aria-label="Переименовать день">✎</button>` : '')
    + `<button class="chip" data-act="addDay" data-a="${sc}">+ день</button></div>`;
  if (!ds.length) return { seg, body: h + '<div class="empty">Нет дней — добавь первый.</div>' };
  const d = ds[di];
  h += '<div class="pgrid">';
  d.exercises.forEach((ex, xi) => {
    const r = rec(ex), ph = E.phase(ex, S.cycle);
    const price = ex.bw ? `×${r.reps}` : r.w != null ? fmtW(r.w) + ' кг' : 'подбор';
    h += `<button class="pcard" data-act="editEx" data-a="${sc}" data-b="${di}" data-c="${xi}">
      
      <div class="pArt">${equipArt(ex, r.w, r.reps).svg}</div><div class="prodName" style="margin:10px 0 6px">${esc(ex.name)}</div>
      <div class="prodMeta" style="margin:0 0 10px">${L.GROUPS[ex.group] || 'Другое'} · ${ex.repMin}–${ex.repMax}${ex.heavy ? ' · база' : ''}</div>
      <span class="pill">${price}</span></button>`;
  });
  h += `<button class="pcard add" data-act="addEx" data-a="${sc}" data-b="${di}">${ICON.plus}Упражнение</button></div>
    <div style="height:12px"></div>${groupsCard(sc, ds)}
    <div class="pad" style="margin-top:4px">
      ${isAct ? '' : `<button class="btn" data-act="makeActive" data-a="${sc}">Сделать активной</button>`}
      <button class="btn ghost" data-act="delDay" data-a="${sc}" data-b="${di}">Удалить день</button>
      ${TEMPLATES[sc] ? `<button class="btn ghost" data-act="resetScope" data-a="${sc}">Сбросить «${scopeLabel(sc)}» к шаблону</button>` : (sc !== S.program.active ? `<button class="btn danger" data-act="delScope" data-a="${sc}">Удалить набор «${scopeLabel(sc)}»</button>` : '')}</div>`;
  return { seg, body: h };
}
// другие упражнения библиотеки на ту же группу
function altList(ex, attrs, title) {
  const alts = L.libByGroup(ex.group).filter(e => normKey(e[0]) !== ex.key);
  if (!alts.length) return '';
  return `<div class="field"><label>${title || 'Заменить на упражнение той же группы'}</label><div class="card" style="margin:0;background:var(--card)">${alts.map(e =>
    `<button class="li" style="width:100%;text-align:left" ${attrs} data-alt="${esc(e[0])}"><span class="grow"><span class="liT">${esc(e[0])}</span><span class="liS">${EQUIP[{ b: 'barbell', p: 'plate', m: 'stack', d: 'dumbbell', w: 'bw' }[e[2]]]} · ${e[3]}–${e[4]} повт.</span></span><span class="muted">›</span></button>`).join('')}</div></div>`;
}
function openEditEx(sc, di, xi) {
  const ex = dsOf(sc)[di].exercises[xi], a = `data-a="${sc}" data-b="${di}" data-c="${xi}"`;
  const num = (lbl, k, step) => `<div class="field"><label>${lbl}</label><div class="stepper">
    <button data-act="exNum" ${a} data-d="${k}" data-e="${-step}">−</button>
    <input inputmode="decimal" value="${fmtW(ex[k] || 0)}" data-chg="exNum" ${a} data-d="${k}">
    <button data-act="exNum" ${a} data-d="${k}" data-e="${step}">+</button></div></div>`;
  const tog = (lbl, sub, k) => `<button class="toggleRow" data-act="exToggle" ${a} data-d="${k}"><span><span class="liT">${lbl}</span><div class="liS">${sub}</div></span><span class="switch${ex[k] ? ' on' : ''}"></span></button>`;
  openSheet(`<h3>Упражнение</h3>
    <div class="field"><label>Название</label><input type="text" value="${esc(ex.name)}" data-chg="exName" ${a}></div>
    <div class="two">${num('Подходы, старт (MEV)', 'sets', 1)}${num('Подходы, пик (MRV)', 'mrv', 1)}</div>
    <div class="two">${num('Повторы от', 'repMin', 1)}${num('Повторы до', 'repMax', 1)}</div>
    ${num('Шаг веса, кг', 'step', 0.5)}
    ${num('Стартовый 1ПМ, кг (необязательно)', 'seedE1RM', 2.5)}
    ${tog('Тяжёлое базовое', 'Растёт весом, не подходами; никогда не в отказ', 'heavy')}
    <div class="field"><label>Целевая группа</label><div class="eqPick">${Object.entries(L.GROUPS).map(([k, l]) => `<button class="chip${ex.group === k ? ' on' : ''}" data-act="exGroup" ${a} data-d="${k}">${l}</button>`).join('')}</div></div>
    ${altList(ex, `data-act="exReplace" ${a}`)}
    <div class="field"><label>Снаряд</label><div class="eqPick">${Object.entries(EQUIP).map(([k, l]) => `<button class="chip${equipOf(ex) === k ? ' on' : ''}" data-act="exEquip" ${a} data-d="${k}">${l}</button>`).join('')}</div></div>
    <div class="two" style="margin:6px 0 10px"><button class="btn ghost" data-act="moveEx" ${a} data-d="-1">↑ Выше</button><button class="btn ghost" data-act="moveEx" ${a} data-d="1">↓ Ниже</button></div>
    <button class="btn danger" data-act="delEx" ${a}>Удалить упражнение</button>
    <button class="btn" data-act="closeSheet" style="margin-top:10px">Готово</button>`);
}

/* ---------- ПИТАНИЕ ---------- */
const N = () => S.nutrition;
function foodDay() { return S.ui.foodDay || localKey(new Date()); }
function nTargets() {
  const p = N().profile; if (!p) return null;
  const ad = E.adaptiveTdee(N().log, N().weights, localKey(new Date()), p);
  return Object.assign(E.nutritionTargets(p, ad) || {}, { adaptive: ad });
}
function vFood() {
  const tab = S.ui.foodTab || 'today';
  const seg = segHTML([['today', 'Сегодня'], ['weight', 'Вес'], ['norm', 'Норма']], tab, 'foodTab');
  return { seg, body: tab === 'weight' ? vWeight() : tab === 'norm' ? vNorm() : vToday() };
}
function vToday() {
  const k = foodDay(), items = N().log[k] || [], t = nTargets();
  const kcal = items.reduce((a, i) => a + (i.kcal || 0), 0), prot = items.reduce((a, i) => a + (i.p || 0), 0);
  const isToday = k === localKey(new Date());
  let h = `<div class="pad" style="margin-top:10px"><div class="row" style="justify-content:space-between;margin-bottom:12px">
    <button class="calNav" data-act="foodShift" data-a="-1">‹</button>
    <h2 class="mid">${isToday ? 'Сегодня' : new Date(k + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}</h2>
    <button class="calNav" data-act="foodShift" data-a="1" ${isToday ? 'disabled style="opacity:.3"' : ''}>›</button></div>`;
  if (!t || !t.kcal) {
    h += `<div class="coupon" style="--cc:var(--p2)"><div class="cTitle">Настрой норму</div><p class="cText">Пол, возраст, рост, вес и цель — и появится дневная норма калорий и белка.</p>
      <div class="perf"><i></i><i></i></div><button class="pill" data-act="foodTab" data-a="norm">Настроить ${ICON.plus}</button></div>`;
  } else {
    const left = t.kcal - kcal, frac = Math.min(1, kcal / t.kcal), C = 2 * Math.PI * 74;
    h += `<div class="coupon" style="--cc:${left < 0 ? 'var(--p5)' : 'var(--p1)'}">
      <div class="ring"><svg width="170" height="170" viewBox="0 0 170 170"><circle cx="85" cy="85" r="74" fill="none" style="stroke:var(--line)" stroke-width="10"/>
        <circle cx="85" cy="85" r="74" fill="none" stroke="${left < 0 ? 'var(--tr)' : 'var(--ink)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/></svg>
        <div class="ringC"><div class="ringV num">${Math.abs(left)}</div><div class="ringL">${left < 0 ? 'ккал сверх нормы' : 'ккал осталось'}</div></div></div>
      <div class="perf"><i></i><i></i></div>
      <div class="row" style="gap:14px"><div class="macro"><div class="macroL"><span>Съедено</span><b class="num">${kcal} / ${t.kcal}</b></div><div class="macroBar"><i style="width:${frac * 100}%"></i></div></div>
        <div class="macro"><div class="macroL"><span>Белок</span><b class="num">${Math.round(prot)} / ${t.protein} г</b></div><div class="macroBar"><i style="width:${Math.min(100, prot / t.protein * 100)}%;background:var(--red)"></i></div></div></div>
      <p class="cText" style="font-size:13px">Жиры ~${t.fat} г · углеводы ~${t.carbs} г · ${t.source === 'adaptive' ? 'расход уточнён по твоему весу' : 'расход по формуле'}</p></div>`;
  }
  h += `<div class="card" style="margin:0 0 12px"><div class="qa">
      <div class="field"><label>Ккал</label><input type="number" inputmode="numeric" id="qaK" placeholder="350"></div>
      <div class="field"><label>Белок, г</label><input type="number" inputmode="decimal" id="qaP" placeholder="25"></div></div>
    <div class="field" style="margin-top:10px"><label>Что это (необязательно)</label><input type="text" id="qaN" placeholder="Творог 200 г"></div>
    <div class="two"><button class="btn" data-act="foodAdd">Добавить</button><button class="btn ghost" data-act="foodAdd" data-a="fav">+ в избранное</button></div></div>`;
  const favs = N().favs;
  const recent = []; const seen = new Set(favs.map(f => normKey(f.name)));
  Object.keys(N().log).sort().reverse().slice(0, 14).forEach(dk => (N().log[dk] || []).slice().reverse().forEach(i => {
    const nk = normKey(i.name); if (i.name && !seen.has(nk) && recent.length < 8) { seen.add(nk); recent.push(i); }
  }));
  if (favs.length || recent.length) {
    h += `<div class="stpLbl" style="margin:4px 0 6px 6px">Добавить одним касанием</div><div class="chips" style="padding:0 0 12px;flex-wrap:wrap">`
      + favs.map((f, i) => `<button class="chip" data-act="foodFav" data-a="${i}">★ ${esc(f.name)} · ${f.kcal}</button>`).join('')
      + recent.map(r => `<button class="chip" data-act="foodRepeat" data-a="${esc(r.name)}" data-b="${r.kcal}" data-c="${r.p || 0}">${esc(r.name)} · ${r.kcal}</button>`).join('')
      + (favs.length ? '<button class="chip" data-act="favEdit">Изменить ★</button>' : '') + '</div>';
  }
  if (items.length) {
    h += '<div class="card" style="margin:0 0 12px">' + items.slice().reverse().map(i => `<div class="food"><div class="grow"><div class="liT">${esc(i.name || 'Перекус')}</div>
      <div class="liS num">${new Date(i.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · белок ${i.p || 0} г</div></div>
      <b class="num">${i.kcal}</b><button class="x calNav" style="width:34px;height:34px;font-size:14px" data-act="foodDel" data-a="${i.id}">✕</button></div>`).join('') + '</div>';
  }
  const lastW = lastWeight(), todayW = N().weights[k];
  h += `<div class="card" style="margin:0 0 12px"><div class="row"><div class="grow"><div class="liT">Вес ${isToday ? 'сегодня' : 'в этот день'}</div>
      <div class="liS">${todayW ? 'записан: ' + fmtW(todayW) + ' кг' : 'утром, натощак — для точного тренда'}</div></div></div>
    <div class="two" style="margin-top:10px;align-items:center"><div class="stepper"><button data-act="wBump" data-a="-0.1">−</button>
      <input inputmode="decimal" id="wIn" value="${fmtW(todayW || lastW || (N().profile && N().profile.weight) || 70)}"><button data-act="wBump" data-a="0.1">+</button></div>
      <button class="btn" data-act="wSave">${todayW ? 'Обновить' : 'Записать'}</button></div></div></div>`;
  return h;
}
function lastWeight() { const ks = Object.keys(N().weights).sort(); return ks.length ? N().weights[ks[ks.length - 1]] : null; }
function vWeight() {
  const ks = Object.keys(N().weights).sort();
  if (!ks.length) return '<div class="empty">Записывай вес на вкладке «Сегодня» — здесь появится тренд.</div>';
  const tr = E.weightTrend(N().weights, localKey(new Date()), 14), t = nTargets();
  let h = `<div class="pad" style="margin-top:10px"><div class="grid3">
    <div class="tile" style="--cc:var(--p1)"><div class="tileV num">${fmtW(N().weights[ks[ks.length - 1]])}</div><div class="tileL">кг сейчас</div></div>
    <div class="tile" style="--cc:var(--p2)"><div class="tileV num">${tr ? (tr.perWeek >= 0 ? '+' : '') + fmtW(Math.round(tr.perWeek * 100) / 100) : '—'}</div><div class="tileL">кг/нед, 14 дн.</div></div>
    <div class="tile" style="--cc:var(--p3)"><div class="tileV num">${t && t.tdee ? t.tdee : '—'}</div><div class="tileL">${t && t.source === 'adaptive' ? 'расход (факт)' : 'расход (формула)'}</div></div></div></div>
    <div class="card" style="margin-top:12px"><div id="wchart"></div></div>`;
  if (t && t.adaptive) h += `<div class="card"><p class="prose">За ${t.adaptive.days} дней ты в среднем ел <b>${Math.round(t.adaptive.avgIn)} ккал</b>, вес менялся на <b>${fmtW(Math.round(t.adaptive.trend.perWeek * 100) / 100)} кг/нед</b>. Значит, реальный расход около <b>${Math.round(t.adaptive.tdee)} ккал</b> — норма считается от него.</p></div>`;
  else h += '<div class="card"><p class="prose">Когда наберётся 14+ дней записей еды и 6+ взвешиваний за 3 недели, расход будет считаться по твоим реальным данным, а не по формуле.</p></div>';
  h += '<div class="card">' + ks.slice(-14).reverse().map(k2 => `<div class="li"><span class="grow">${new Date(k2 + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}</span><b class="num">${fmtW(N().weights[k2])} кг</b><button class="x calNav" style="width:34px;height:34px;font-size:14px" data-act="wDel" data-a="${k2}">✕</button></div>`).join('') + '</div>';
  return h;
}
function drawWeightChart() {
  const el = $('wchart'); if (!el) return;
  const ks = Object.keys(N().weights).sort().slice(-60);
  if (ks.length < 2) { el.innerHTML = '<div class="muted" style="text-align:center">График появится после второго взвешивания</div>'; return; }
  const pts = ks.map(k => ({ x: E.dayNum(k), v: N().weights[k] }));
  const avg = pts.map((p, i) => { const win = pts.filter(q => q.x <= p.x && q.x > p.x - 7); return { x: p.x, v: win.reduce((a, q) => a + q.v, 0) / win.length }; });
  lineChart(el, pts, avg, v => fmtW(Math.round(v * 10) / 10));
}
function vNorm() {
  const p = N().profile || { sex: 'm', age: 30, height: 178, weight: lastWeight() || 75, act: 1.55, goal: 'keep' };
  const t = N().profile ? nTargets() : null;
  const opt = (v, cur, l) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${l}</option>`;
  return `<div class="pad" style="margin-top:10px">
    ${t && t.kcal ? `<div class="coupon" style="--cc:var(--p4)"><div class="cTitle">${t.kcal} ккал в день</div>
      <p class="cText num">белок ${t.protein} г · жиры ${t.fat} г · углеводы ${t.carbs} г</p><div class="perf"><i></i><i></i></div>
      <p class="cText" style="font-size:13.5px">Расход ${t.tdee} ккал (${t.source === 'adaptive' ? 'по факту веса и еды' : 'Миффлин — Сан Жеор × активность'}), цель «${E.GOALS[p.goal].title}»: ${E.GOALS[p.goal].adj ? (E.GOALS[p.goal].adj > 0 ? '+' : '') + Math.round(E.GOALS[p.goal].adj * 100) + '%' : 'без коррекции'}. Белок ${E.GOALS[p.goal].protein} г/кг.</p></div>` : ''}
    <div class="two"><div class="field"><label>Пол</label><select id="nSex">${opt('m', p.sex, 'Мужской')}${opt('f', p.sex, 'Женский')}</select></div>
      <div class="field"><label>Возраст</label><input type="number" inputmode="numeric" id="nAge" value="${p.age}"></div></div>
    <div class="two"><div class="field"><label>Рост, см</label><input type="number" inputmode="numeric" id="nH" value="${p.height}"></div>
      <div class="field"><label>Вес, кг</label><input type="number" inputmode="decimal" id="nW" value="${p.weight}"></div></div>
    <div class="field"><label>Активность</label><select id="nAct">${E.ACTIVITY.map(([v, l]) => opt(v, p.act, l)).join('')}</select></div>
    <div class="field"><label>Цель</label><select id="nGoal">${Object.entries(E.GOALS).map(([k, g]) => opt(k, p.goal, g.title)).join('')}</select></div>
    <button class="btn" data-act="normSave">Сохранить норму</button></div>`;
}

/* ---------- ПРОГРЕСС ---------- */
function vProgress() {
  const tab = S.ui.progTab || 'charts';
  const seg = segHTML([['charts', 'Графики'], ['calendar', 'Календарь'], ['records', 'Рекорды']], tab, 'progTab');
  return { seg, body: tab === 'calendar' ? vCalendar() : tab === 'records' ? vRecords() : vCharts() };
}
function exerciseIndex() {
  const m = new Map();
  S.history.forEach(w => w.entries.forEach(e => m.set(e.key, e.name)));
  days().forEach(d => d.exercises.forEach(e => { if (!m.has(e.key)) m.set(e.key, e.name); }));
  return m;
}
function seriesFor(key) {
  const prw = new Set(PR().events.filter(e => e.key === key).map(e => e.wid));
  const pts = [];
  S.history.forEach(w => {
    const en = w.entries.find(e => e.key === key);
    if (!en) return;
    const v = E.topValue(en).v;
    if (v) pts.push({ x: E.dayNum(localKey(w.date)), date: w.date, v: Math.round(v * 10) / 10, deload: !!w.deload, pr: prw.has(w.id), bw: !!en.bw, en, w });
  });
  return pts;
}
function vCharts() {
  const idx = exerciseIndex();
  if (!idx.size) return '<div class="empty">Нет упражнений</div>';
  if (!S.ui.progKey || !idx.has(S.ui.progKey)) S.ui.progKey = [...idx.keys()].find(k => S.history.some(w => w.entries.some(e => e.key === k))) || [...idx.keys()][0];
  const key = S.ui.progKey, pts = seriesFor(key);
  let h = `<div class="selPill" style="margin-top:10px"><select data-chg="progKey">${[...idx].map(([k, n]) => `<option value="${esc(k)}"${k === key ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>${ICON.chev}</div>`;
  if (!pts.length) return h + '<div class="empty">Прогресс появится после первой тренировки с этим упражнением.</div>';
  const bw = pts[0].bw, last = pts[pts.length - 1], best = pts.reduce((a, b) => b.v > a.v ? b : a), delta = last.v - pts[0].v;
  const unit = bw ? 'повт.' : 'кг';
  const st = E.stallInfo(S.history, key);
  h += `<div class="pad"><div class="grid3">
    <div class="tile" style="--cc:var(--p1)"><div class="tileV num">${fmtW(last.v)}</div><div class="tileL">${bw ? 'повт. сейчас' : '1ПМ сейчас, кг'}</div></div>
    <div class="tile" style="--cc:var(--p2)"><div class="tileV num">${fmtW(best.v)}</div><div class="tileL">рекорд, ${unit}</div></div>
    <div class="tile" style="--cc:${delta >= 0 ? 'var(--p6)' : 'var(--p5)'}"><div class="tileV num" style="color:${delta >= 0 ? 'var(--tg)' : 'var(--tr)'}">${delta >= 0 ? '+' : ''}${fmtW(Math.round(delta * 10) / 10)}</div><div class="tileL">с начала</div></div></div></div>
    <div class="card" style="margin-top:12px"><div id="chart"></div>
    <div class="legend"><span><span class="dot r"></span>рекорд</span><span><span class="dot hollow"></span>разгрузка</span>${st.stalled ? '<span class="tagGrey">плато ' + st.n + ' трен.</span>' : ''}</div></div>
    <div class="card"><h2 class="mid" style="margin-bottom:4px">Последние тренировки</h2>`;
  pts.slice(-10).reverse().forEach(p => {
    const o = p.en.outcome === 'up' ? '↑' : p.en.outcome === 'down' ? '↓' : '=';
    h += `<div class="li"><div class="grow"><div class="liT num">${setsLine(p.en)}</div><div class="liS">${fmtDate(p.date)} · ${weekName(p.w.week || 1)}${p.pr ? ' · <span style="color:var(--red)">рекорд</span>' : ''}</div></div><span class="muted">${p.en.outcome ? o : ''}</span></div>`;
  });
  return h + '</div>';
}
function drawChart() {
  const el = $('chart'); if (!el) return;
  const pts = seriesFor(S.ui.progKey).slice(-30);
  if (pts.length < 2) { el.innerHTML = '<div class="muted" style="text-align:center;padding:8px">График появится после второй тренировки</div>'; return; }
  lineChart(el, pts, null, v => fmtW(v));
}
function lineChart(el, pts, avg, fmt) {
  const W = el.clientWidth || 320, H = 180, PL = 8, PR_ = 8, PT = 18, PB = 22;
  const all = pts.map(p => p.v).concat(avg ? avg.map(p => p.v) : []);
  let mn = Math.min(...all), mx = Math.max(...all);
  if (mx - mn < 1) { mx += 0.5; mn -= 0.5; }
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x || x0 + 1;
  const X = (p, i) => PL + (W - PL - PR_) * (x1 === x0 ? i / (pts.length - 1) : (p.x - x0) / (x1 - x0));
  const Y = v => PT + (H - PT - PB) * (1 - (v - mn) / (mx - mn));
  const series = avg || pts;
  const line = series.map((p, i) => (i ? 'L' : 'M') + X(p, i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const area = line + ` L${X(series[series.length - 1], series.length - 1).toFixed(1)} ${H - PB} L${X(series[0], 0).toFixed(1)} ${H - PB} Z`;
  let dots = '';
  pts.forEach((p, i) => {
    const cx = X(p, i).toFixed(1), cy = Y(p.v).toFixed(1);
    if (avg) dots += `<circle cx="${cx}" cy="${cy}" r="3" fill="#C9C5BE"/>`;
    else if (p.pr) dots += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--red)"/>`;
    else if (p.deload) dots += `<circle cx="${cx}" cy="${cy}" r="3.5" style="fill:var(--bg)" stroke="var(--dim)" stroke-width="2"/>`;
    else dots += `<circle cx="${cx}" cy="${cy}" r="3.5" style="fill:var(--bg)" stroke="var(--ink)" stroke-width="2"/>`;
  });
  const lbl = (x, y, t, anchor) => `<text x="${x}" y="${y}" fill="#8E8E8E" font-size="11" text-anchor="${anchor || 'start'}">${t}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="График">
    <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--ink);stop-opacity:.10"/><stop offset="1" style="stop-color:var(--ink);stop-opacity:0"/></linearGradient></defs>
    <line x1="${PL}" x2="${W - PR_}" y1="${Y(mx)}" y2="${Y(mx)}" style="stroke:var(--line)" /><line x1="${PL}" x2="${W - PR_}" y1="${Y(mn)}" y2="${Y(mn)}" style="stroke:var(--line)"/>
    <path d="${area}" fill="url(#ga)"/><path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}
    ${lbl(PL, PT - 6, fmt(mx))}${lbl(PL, H - PB + 14, fmt(mn))}
    ${lbl(W - PR_, H - 4, fmtDate(new Date((x1) * 864e5)), 'end')}</svg>`;
}
let calView = null;
function vCalendar() {
  if (!calView) { const d = new Date(); calView = { y: d.getFullYear(), m: d.getMonth() }; }
  const { y, m } = calView, first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const today = localKey(new Date()), map = {};
  S.history.forEach(w => { (map[localKey(w.date)] = map[localKey(w.date)] || []).push(w); });
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="calCell empty"></div>';
  for (let d = 1; d <= dim; d++) {
    const k = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), it = map[k];
    cells += `<div class="calCell${k === today ? ' today' : ''}${it ? ' has' : ''}" ${it ? `data-act="dayDetail" data-a="${k}"` : ''}><span>${d}</span>
      <div class="calDots">${it ? it.slice(0, 3).map(w => `<span class="dot ${weekDot(w.week || 1)}"></span>`).join('') : ''}</div></div>`;
  }
  const month = S.history.filter(w => { const d = new Date(w.date); return d.getFullYear() === y && d.getMonth() === m; });
  return `<div class="card" style="margin-top:10px"><div class="row" style="margin-bottom:12px"><button class="calNav" data-act="calShift" data-a="-1">‹</button>
    <h2 class="mid grow" style="text-align:center;text-transform:capitalize">${first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h2>
    <button class="calNav" data-act="calShift" data-a="1">›</button></div>
    <div class="calWd">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(x => '<span>' + x + '</span>').join('')}</div><div class="calGrid">${cells}</div>
    <div class="legend">${[1, 2, 3, 4].map(w => `<span><span class="dot ${weekDot(w)}"></span>${WEEKS[w].name}</span>`).join('')}</div></div>
    ${month.length ? `<div class="card">${month.slice().reverse().map(w => `<div class="li" data-act="workout" data-a="${w.id}"><div class="grow"><div class="liT">${esc(w.dayName)}</div>
      <div class="liS">${fmtDate(w.date)} · ${weekName(w.week || 1)} · ${w.durMin} мин</div></div><span class="dot ${weekDot(w.week || 1)}"></span></div>`).join('')}</div>` : '<div class="empty">В этом месяце тренировок нет</div>'}`;
}
function openWorkout(id) {
  const w = S.history.find(x => x.id === id); if (!w) return;
  const ton = w.entries.reduce((a, e) => a + tonnage(e), 0);
  openSheet(`<h3>${esc(w.dayName)}</h3><p class="muted" style="margin:-6px 0 12px">${new Date(w.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · мезоцикл ${w.meso || 1}, ${weekName(w.week || 1).toLowerCase()} · ${w.durMin} мин · ${Math.round(ton).toLocaleString('ru-RU')} кг</p>
    <div class="card">${w.cardio ? `<div class="li"><div class="grow"><div class="liT">Кардио</div><div class="liS">${esc(w.cardio.type)} · ${w.cardio.min} мин</div></div></div>` : ''}${w.entries.map(en => `<div class="li"><div class="grow"><div class="liT">${esc(en.name)}</div><div class="liS num">${setsLine(en)}</div></div></div>`).join('')}</div>
    <button class="btn danger" data-act="delWorkout" data-a="${w.id}">Удалить запись</button><button class="btn ghost" data-act="closeSheet">Закрыть</button>`);
}
function vRecords() {
  const best = PR().best, keys = Object.keys(best);
  if (!keys.length) return '<div class="empty">Рекорды появятся после первых тренировок.</div>';
  keys.sort((a, b) => best[a].name.localeCompare(best[b].name, 'ru'));
  return `<div class="pad" style="margin-top:10px"><div class="coupon" style="--cc:var(--p4)"><div class="cTitle">Личные рекорды</div>
    <p class="cText">Расчётный 1ПМ с поправкой на запас повторов · ${PR().events.length} ${plural(PR().events.length, 'рекорд', 'рекорда', 'рекордов')} побито</p>
    <div class="perf"><i></i><i></i></div><div class="card" style="margin:0">${keys.map(k => {
      const b = best[k];
      return `<div class="li"><div class="grow"><div class="liT">${esc(b.name)}</div><div class="liS num">${b.bw ? '' : fmtW(b.w) + ' кг × '}${b.r} <span class="dot ${b.tier || 'g'}"></span> · ${fmtDate(b.date)}</div></div>
        <b class="num">${b.bw ? b.v + ' повт.' : '≈' + fmtW(Math.round(b.v * 10) / 10) + ' кг'}</b></div>`;
    }).join('')}</div></div></div>`;
}

/* ---------- ПРОФИЛЬ: достижения и данные ---------- */
function achGroups() {
  const total = S.history.length, ton = S.history.reduce((a, w) => a + w.entries.reduce((b, e) => b + tonnage(e), 0), 0);
  const streak = weekStreak(), meso = S.cycle.meso - 1, prs = PR().events.length;
  const exn = new Set(S.history.flatMap(w => w.entries.map(e => e.key))).size, hrs = Math.floor(S.history.reduce((a, w) => a + (w.durMin || 0), 0) / 60);
  const foodDays = Object.values(N().log).filter(x => x && x.length).length;
  const mk = (list, cur, ico) => list.map(([n, name, desc]) => ({ ico, name, desc, cur, target: n, unlocked: cur >= n }));
  return [
    ['Тренировки', mk([[1, 'Первая тренировка', 'Записана первая тренировка'], [10, 'Втянулся', '10 тренировок'], [25, 'Стабильность', '25 тренировок'], [50, 'Полтинник', '50 тренировок'], [100, 'Сотня', '100 тренировок'], [200, 'Двести', '200 тренировок']], total, '🏋️')],
    ['Тоннаж', mk([[10000, '10 тонн'], [50000, '50 тонн'], [100000, '100 тонн'], [500000, '500 тонн'], [1000000, 'Мегатоннаж']].map(([n, name]) => [n, name, 'Суммарно ' + n.toLocaleString('ru-RU') + ' кг']), ton, '🏔')],
    ['Серии', mk([[2, 'Есть ритм', '2 недели подряд'], [4, 'Месяц в форме', '4 недели подряд'], [12, 'Квартал дисциплины', '12 недель подряд']], streak, '🔥')],
    ['Мезоциклы', mk([[1, 'Первый мезоцикл', 'Пройдены 4 недели цикла'], [3, 'Опытный', '3 мезоцикла'], [6, 'Ветеран', '6 мезоциклов']], meso, '🌀')],
    ['Рекорды', mk([[1, 'Первый рекорд', 'Побит личный рекорд'], [10, 'Рекордсмен', '10 рекордов'], [25, 'Машина прогресса', '25 рекордов']], prs, '🏆')],
    ['Разное', [...mk([[10, 'Универсал', '10 разных упражнений']], exn, '🎯'), ...mk([[24, 'Марафонец', '24 часа в зале']], hrs, '⏱'), ...mk([[30, 'Считаю калории', '30 дней с записями еды']], foodDays, '🥗')]]
  ];
}
function unlockedNames() { return achGroups().flatMap(([, it]) => it).filter(a => a.unlocked).map(a => a.name); }
function vProfile() {
  const tab = S.ui.profTab || 'ach';
  const seg = segHTML([['ach', 'Достижения'], ['data', 'Данные'], ['how', 'Как считается']], tab, 'profTab');
  if (tab === 'data') return { seg, body: vData() };
  if (tab === 'how') return { seg, body: vHow() };
  const total = S.history.length, st = weekStreak(), ton = S.history.reduce((a, w) => a + w.entries.reduce((b, e) => b + tonnage(e), 0), 0);
  let h = `<div class="pad" style="margin-top:10px"><div class="grid3">
    <div class="tile" style="--cc:var(--p1)"><div class="tileV num">${total}</div><div class="tileL">${plural(total, 'тренировка', 'тренировки', 'тренировок')}</div></div>
    <div class="tile" style="--cc:var(--p2)"><div class="tileV num">${st}</div><div class="tileL">${plural(st, 'неделя', 'недели', 'недель')} подряд</div></div>
    <div class="tile" style="--cc:var(--p3)"><div class="tileV num">${fmtW(Math.round(ton / 100) / 10)}</div><div class="tileL">тонн поднято</div></div></div></div>`;
  achGroups().forEach(([title, items], gi) => {
    h += `<h1 class="big" style="padding-bottom:10px">${title} <span class="muted" style="font-weight:500">${items.filter(i => i.unlocked).length}/${items.length}</span></h1><div class="pad"><div class="grid2">`;
    items.forEach(a => {
      h += `<div class="ach${a.unlocked ? ' on' : ''}" style="--cc:${pastel(gi)}"><div class="achIco">${a.ico}</div><div class="achName">${esc(a.name)}</div><div class="achDesc">${esc(a.desc)}</div>
        ${a.unlocked ? '' : `<div class="achBar"><i style="width:${Math.min(100, a.cur / a.target * 100)}%"></i></div>`}</div>`;
    });
    h += '</div></div>';
  });
  return { seg, body: h };
}
function vData() {
  let sync;
  if (cloudOn()) sync = `<div class="card"><h2 class="mid" >Синхронизация</h2><p class="prose" style="margin-top:6px">Вход: <b>${esc(cloud.nick || '—')}</b></p>
    <p class="prose" id="syncStatus" style="margin-top:4px">${syncStatusText()}</p>
    <button class="btn ghost" style="margin-top:12px" data-act="syncNow">Синхронизировать сейчас</button><button class="btn danger" data-act="logout">Выйти</button></div>`;
  else sync = `<div class="card"><h2 class="mid" >Синхронизация</h2>
    <p class="prose" style="margin:6px 0 12px">Никнейм + ключ — и тренировки с питанием будут на всех твоих устройствах. Записи с двух телефонов объединяются, а не затирают друг друга.</p>
    <div class="field"><label>Никнейм</label><input type="text" id="cfgNick" placeholder="например, nikita" style="background:var(--pill)"></div>
    <div class="field"><label>Ключ (минимум 4 символа)</label><input type="password" id="cfgPass" style="background:var(--pill)"></div>
    <button class="btn" data-act="login">Войти</button></div>`;
  return `<div style="margin-top:10px">${sync}
    <div class="card"><h2 class="mid">Объём тренировки</h2>
      <div class="row" style="margin-top:10px"><span class="grow"><span class="liT">Рабочих подходов максимум</span><span class="liS">≈ ${Math.round(setBudget() * (restOf('y') + 40) / 60)} мин без кардио и разминки</span></span>
        <div class="stepper" style="width:150px"><button data-act="budgetBump" data-a="-2">−</button><input value="${setBudget()}" readonly><button data-act="budgetBump" data-a="2">+</button></div></div>
      <div style="height:12px"></div></div>
    <div class="card"><h2 class="mid">Кардио перед силовой</h2>
      <button class="toggleRow" style="background:var(--field);margin-top:10px" data-act="cardioOn"><span><span class="liT">Добавлять в каждую тренировку</span><span class="liS">лёгкий темп, разогрев перед весами</span></span><span class="switch${cardioCfg().on ? ' on' : ''}"></span></button>
      <div class="row"><span class="grow">Длительность, мин</span><div class="stepper" style="width:170px"><button data-act="cardioDef" data-a="-1">−</button><input value="${cardioCfg().min}" readonly><button data-act="cardioDef" data-a="1">+</button></div></div>
      <div style="height:12px"></div></div>
    <div class="card"><h2 class="mid">Отдых между подходами</h2>
      ${['g', 'y', 'r'].map(t => `<div class="row" style="margin-top:10px"><span class="grow row" style="gap:7px"><span class="dot ${t}"></span>После «${TIER[t].title.toLowerCase()}»</span>
        <div class="stepper" style="width:170px"><button data-act="restSet" data-a="${t}" data-b="-10">−</button><input value="${mmss(restOf(t))}" readonly><button data-act="restSet" data-a="${t}" data-b="10">+</button></div></div>`).join('')}
      <div style="height:12px"></div></div>
    <div class="card"><h2 class="mid">Оборудование</h2><div class="row" style="margin-top:10px"><span class="grow">Плита в стеке тренажёра</span>
      <div class="stepper" style="width:170px"><button data-act="stackBump" data-a="-0.5">−</button><input value="${fmtW(S.settings.stack || 5)}" readonly><button data-act="stackBump" data-a="0.5">+</button></div></div>
      <div class="row" style="margin-top:10px"><span class="grow">Вес грифа</span>
      <div class="stepper" style="width:170px"><button data-act="barBump" data-a="-2.5">−</button><input value="${fmtW(S.settings.bar)}" readonly><button data-act="barBump" data-a="2.5">+</button></div></div></div>
    <div class="card"><h2 class="mid" >Резервная копия</h2>
      <button class="btn ghost" style="margin-top:12px" data-act="export">Экспорт в файл</button>
      <label class="btn ghost" style="margin-top:10px">Импорт из файла<input type="file" accept=".json" data-chg="import" style="display:none"></label>
      <button class="btn danger" style="margin-top:10px" data-act="resetAll">Сбросить всё</button></div>
    <p class="muted" style="text-align:center;font-size:12px;margin:4px 0 12px">Версия ${APP_VERSION}</p></div>`;
}
function vHow() {
  const s = (t, body, cc) => `<div class="coupon" style="--cc:${cc}"><div class="cTitle">${t}</div><div class="perf"><i></i><i></i></div><div class="prose">${body}</div></div>`;
  return `<div class="pad" style="margin-top:10px">
  ${s('Недели цикла', `<p>Мезоцикл — <b>3 рабочие недели + разгрузка</b>. Неделя закрывается, когда пройдены <b>все дни</b> программы (а не «каждые 3 тренировки») — работает с любым числом дней.</p>
    <p><b>База</b> — минимальный объём (MEV), все подходы «легко». <b>Набор</b> — подходов больше, «средне». <b>Пик</b> — максимум (MRV), «средне». <b>Разгрузка</b> — половина подходов, −10% веса.</p>
    <p>Пропустил день — закрой неделю вручную в меню мезоцикла (нажми на заголовок сверху).</p>`, 'var(--p1)')}
  ${s('Подбор 1ПМ', `<p>Старт и возврат после перерыва — <b>неделя подбора</b>. По каждому упражнению: подходы на рабочие повторы (середина диапазона), вес растёт, пока подход не станет «средне» — 1–2 в запасе. Без отказа и без настоящего максимума — это безопасно после паузы.</p>
    <p>«Легко» → приложение предлагает следующий вес (+8–20%). «Средне» или «отказ» → сила зафиксирована: <b>1ПМ = вес × (1 + (повторы + запас) / 30)</b>.</p>`, 'var(--p3)')}
  ${s('Вес и повторы', `<p>Вес считается от <b>текущего 1ПМ</b> упражнения под целевые повторы (середина диапазона) и запас недели: легко = 3, средне = 1,5 повтора. Поэтому от недели к неделе цикла вес растёт сам, а после разгрузки новый цикл стартует легче.</p>
    <p>1ПМ <b>сглаженный</b>: каждая тренировка сдвигает оценку наполовину к лучшему подходу. Один плохой день не обрушит веса, рост силы виден за 1–2 тренировки.</p>
    <p>Ограничители: не больше <b>+5%</b> (минимум +1 шаг) за раз и не ниже −10%. Если шаг снаряда крупный (гантели) и вес не сдвинулся — <b>+1 повтор</b>, на верхней границе — следующая гантель.</p>
    <p>Между подходами: легче цели при плановых повторах → +шаг, тяжелее на 2 зоны или недобор → −шаг.</p>`, 'var(--p2)')}
  ${s('Объём', `<p>Подходы растут от недели к неделе цикла, но тренировка ограничена <b>${setBudget()} рабочими подходами</b> (меняется в «Данных»): сверх лимита срезается по подходу у упражнений с наибольшим объёмом, сначала не у базовых.</p>`, 'var(--p6)')}
  ${s('Отказ', `<p>«Отказ» = больше ни одного повтора. <b>Тяжёлая база</b> (присед, становая, жимы штанги) в отказ <b>не уходит никогда</b>: риск и утомление выше пользы.</p>
    <p>У изоляции в отказ идёт <b>только последний подход пиковой недели</b>. Незапланированный отказ снижает вес следующего подхода и учитывается как признак перегруза.</p>
    <p>Две тренировки подряд с провалами в 2+ упражнениях → приложение предложит <b>разгрузку раньше</b>.</p>`, 'var(--p5)')}
  ${s('Разминка', `<p>Перед первым рабочим подходом каждого упражнения — ступени к рабочему весу. Повторов мало, чтобы прогреть движение и не устать.</p>
    <p><b>Тяжёлая база:</b> гриф ×10 → 40% ×8 → 60% ×5 → 80% ×3. <b>Многосуставные</b> (от ≤ 8 повт.): 50% ×8 → 75% ×4. <b>Изоляция:</b> 50% ×10. <b>Разгрузка:</b> один подход 50%.</p>
    <p>Отмечай подходы тапом — после каждого запускается минута отдыха. На прогрессию и рекорды разминка не влияет.</p>`, 'var(--p3)')}
  ${s('Без осевой нагрузки', `<p>Из программ убраны движения, где вес давит на позвоночник: приседы, становая и румынская тяги, тяга штанги в наклоне, жимы над головой, подъёмы на носки стоя.</p>
    <p>Ноги — жим платформой, ягодичный мост, разгибания и сгибания в тренажёре. Спина — тяги с упором в грудь или скамью. Плечи — жим на наклонной 45°, махи и разведения.</p>`, 'var(--p2)')}
  ${s('Рекорды и плато', `<p>Рекорд — лучший <b>расчётный 1ПМ</b>: Эпли по «повторам до отказа» (сделано + запас). Первая тренировка упражнения — база, не рекорд.</p>
    <p>3 рабочие тренировки подряд без нового 1ПМ — <b>плато</b>: подсказка сбросить 10% и пройти заново.</p>
    <p>Каждый новый мезоцикл — +1 подход к стартовому объёму изолирующих (до ${E.MEV_CAP}); базовые растут весом.</p>`, 'var(--p4)')}
  ${s('Питание', `<p>Норма — <b>Миффлин — Сан Жеор × активность</b>, сушка −18%, набор +10%. Белок 1,8–2 г/кг.</p>
    <p>Через 2–3 недели записей (14+ дней еды, 6+ взвешиваний) расход считается <b>по факту</b>: средний приём − изменение веса × 7700 ккал/кг.</p>`, 'var(--p6)')}
  </div>`;
}

/* ---------- ШТОРКИ ---------- */
function openSheet(html) { const sh = $('sheet'); sh.style.transform = ''; sh.innerHTML = html; $('sheetwrap').classList.add('show'); sh.scrollTop = 0; }
// свайп вниз от верха шторки — закрыть
(function sheetSwipe() {
  const sh = $('sheet'); let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop > 0) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0 && sh.scrollTop <= 0) sh.style.transform = `translateY(${dy}px)`; else if (dy < 0) { y0 = null; sh.style.transform = ''; }
  }, { passive: true });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return;
    sh.style.transition = 'transform .2s ease';
    if (dy > 90) { sh.style.transform = 'translateY(100%)'; setTimeout(() => { closeSheet(); sh.style.transform = ''; sh.style.transition = ''; }, 190); }
    else sh.style.transform = '';
    y0 = null;
  });
})();
function closeSheet() { $('sheetwrap').classList.remove('show'); }
let confirmCb = null, promptCb = null;
function confirmSheet(msg, onYes, o = {}) {
  confirmCb = onYes;
  openSheet(`<h3>${esc(o.title || 'Подтверди')}</h3><p class="prose" style="margin-bottom:18px">${esc(msg)}</p>
    <button class="btn${o.danger ? ' danger' : ''}" data-act="confirmYes">${esc(o.yes || 'Да')}</button><button class="btn ghost" data-act="closeSheet">Отмена</button>`);
}
function promptSheet(title, val, onOk) {
  promptCb = onOk;
  openSheet(`<h3>${esc(title)}</h3><div class="field"><input type="text" id="promptIn" value="${esc(val || '')}"></div>
    <button class="btn" data-act="promptOk">Сохранить</button><button class="btn ghost" data-act="closeSheet">Отмена</button>`);
  setTimeout(() => { const el = $('promptIn'); if (el) { el.focus(); el.select(); } }, 60);
}
function openCycle() {
  const c = S.cycle, n = days().length, dn = c.done.filter(id => days().some(d => d.id === id)).length;
  const row = (act, title, sub) => `<button class="li" style="width:100%;text-align:left" data-act="cycleAction" data-a="${act}"><span class="grow"><span class="liT">${title}</span><span class="liS">${sub}</span></span><span class="muted">›</span></button>`;
  openSheet(`<h3>${c.week === 0 ? 'Подбор 1ПМ' : weekName(c.week) + ' · ' + WEEKS[c.week].name}</h3>
    <p class="prose" style="margin:-4px 2px 14px">Мезоцикл ${c.meso} · пройдено ${dn} из ${n} дней. ${WEEKS[c.week].desc[0].toUpperCase() + WEEKS[c.week].desc.slice(1)}.</p>
    <div class="card">
      ${row('close', 'Закрыть неделю', 'если пропустил день — перейти к следующей')}
      ${c.week !== 4 ? row('deload', 'Уйти на разгрузку', 'если накопилась усталость') : ''}
      ${row('calib', 'Подбор 1ПМ', 'заново узнать силу — после перерыва')}
      ${row('restart', 'Мезоцикл заново', 'вернуться к неделе 1')}
    </div>`);
}

/* ---------- ТОСТ (с отменой) ---------- */
let toastTimer = null, toastUndo = null;
function toast(msg, undo) {
  const el = $('toast');
  toastUndo = undo || null;
  el.innerHTML = `<span class="msg">${esc(msg)}</span>${undo ? '<button data-act="undo">Отменить</button>' : ''}`;
  if (!undo) el.style.paddingRight = '20px'; else el.style.paddingRight = '';
  el.classList.add('show');
  if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { }
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.classList.remove('show'); toastUndo = null; }, undo ? 4500 : 2400);
}

/* =================================================================
   ДЕЙСТВИЯ (делегирование событий: data-act / data-chg)
   ================================================================= */
function setTab(t) { S.ui.tab = t; saveLocal(); render(); window.scrollTo(0, 0); }
const rerender = () => { saveLocal(); render(); };
function exOf(d) { return dsOf(d.a)[+d.b].exercises[+d.c]; }
function afterExEdit(d) { save(); openEditEx(d.a, +d.b, +d.c); render(); }
function setExNum(ex, k, v) {
  v = Math.round((parseFloat(String(v).replace(',', '.')) || 0) * 100) / 100;
  if (v < 0) v = 0;
  if (['sets', 'mrv', 'repMin', 'repMax'].includes(k)) v = Math.max(1, Math.round(v));
  ex[k] = k === 'seedE1RM' && !v ? null : v;
  if (k === 'repMin' && ex.repMax < v) ex.repMax = v;
  if (k === 'repMax' && ex.repMin > v) ex.repMin = v;
  if (k === 'sets' && ex.mrv < v) ex.mrv = v;
  if (k === 'mrv' && ex.sets > v) ex.sets = v;
}
function addFood(name, kcal, p) {
  const k = foodDay();
  (N().log[k] = N().log[k] || []).push({ id: uid(), t: Date.now(), name: name || '', kcal: Math.round(kcal), p: Math.round((p || 0) * 10) / 10 });
  save(); render(); toast('+' + Math.round(kcal) + ' ккал' + (name ? ' · ' + name : ''));
}

const A = {
  tab: d => setTab(d.a),
  openCycle: () => openCycle(),
  closeSheet: () => closeSheet(),
  confirmYes: () => { const cb = confirmCb; confirmCb = null; closeSheet(); if (cb) cb(); },
  promptOk: () => { const v = ($('promptIn') || {}).value || ''; const cb = promptCb; promptCb = null; closeSheet(); if (cb) cb(v); },
  undo: () => { const u = toastUndo; toastUndo = null; $('toast').classList.remove('show'); if (u) u(); },

  startDay: d => startWorkout(d.a),
  exLater: d => {
    const a = S.active, i = +d.a, [en] = a.entries.splice(i, 1);
    a.entries.push(en);
    const nx = a.entries.findIndex(e => e.sets.length < e.plan.sets);
    a.open = nx >= 0 ? nx : a.entries.length - 1;
    rerender(); toast(en.name + ' — в конец списка');
    const el = $('ex' + a.open); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  exSwap: d => {
    const en = S.active.entries[+d.a];
    if (!en.group) en.group = L.guessGroup(en.name);
    const html = altList(en, `data-act="swapPick" data-a="${d.a}"`, 'Чем заменить · ' + (L.GROUPS[en.group] || 'другое'));
    openSheet(`<h3>Заменить</h3><p class="prose" style="margin-bottom:12px">${esc(en.name)} → упражнение на ту же группу. Вес подберётся по истории нового упражнения.</p>${html || '<div class="empty">Других упражнений на эту группу в библиотеке нет</div>'}<button class="btn ghost" data-act="closeSheet">Отмена</button>`);
  },
  swapPick: d => {
    const alt = d.alt, ei = d.a;
    openSheet(`<h3>${esc(alt)}</h3><p class="prose" style="margin-bottom:16px">Заменить только в этой тренировке или и в программе — тогда в следующий раз этот день будет уже с новым упражнением.</p>
      <button class="btn" data-act="swapDo" data-a="${ei}" data-alt="${esc(alt)}" data-b="prog">И в программе</button>
      <button class="btn ghost" data-act="swapDo" data-a="${ei}" data-alt="${esc(alt)}" data-b="once">Только сегодня</button>`);
  },
  swapDo: d => {
    const a = S.active, i = +d.a, old = a.entries[i], e = L.libFind(d.alt);
    if (!e) return;
    const ex = fromLib(e), r = rec(ex);
    a.entries[i] = { exId: ex.id, key: ex.key, name: ex.name, group: ex.group, bw: ex.bw, bar: ex.bar, equip: equipOf(ex), heavy: ex.heavy, step: ex.step,
      repMin: ex.repMin, repMax: ex.repMax, plan: r, sets: [], draft: { w: r.w || 0, r: r.reps || ex.repMin } };
    if (d.b === 'prog') {
      const day = days().find(x => x.id === a.dayId), xi = day ? day.exercises.findIndex(x => x.id === old.exId) : -1;
      if (xi >= 0) { const o = day.exercises[xi]; ex.id = o.id; ex.sets = o.sets; ex.mrv = o.mrv; day.exercises[xi] = ex; a.entries[i].exId = ex.id; save(); }
    }
    a.open = i; closeSheet(); rerender(); toast(old.name + ' → ' + ex.name);
  },
  cardioType: d => { S.active.cardio.type = d.a; S.settings.cardio = Object.assign(cardioCfg(), { type: d.a }); save(); render(); },
  cardioMin: d => { const c = S.active.cardio; c.min = Math.max(1, Math.min(60, c.min + (+d.a))); rerender(); },
  cardioTimer: () => restStart(S.active.cardio.min * 60, null, 'cardio'),
  cardioDone: () => { S.active.cardio.done = true; if (restKind === 'cardio') restStop(); rerender(); },
  cardioSkip: () => { S.active.cardio = null; if (restKind === 'cardio') restStop(); rerender(); },
  groupsToggle: (d, el, e) => { e.preventDefault(); S.ui.groupsOpen = !S.ui.groupsOpen; rerender(); },
  cardioOpen: () => { S.active.cardio.open = !S.active.cardio.open; rerender(); },
  cardioReopen: () => { S.active.cardio.done = false; rerender(); },
  cardioOn: () => { S.settings.cardio = Object.assign(cardioCfg(), { on: !cardioCfg().on }); save(); render(); },
  cardioDef: d => { const c = cardioCfg(); c.min = Math.max(1, Math.min(60, c.min + (+d.a))); S.settings.cardio = c; save(); render(); },
  warmDone: d => {
    const en = S.active.entries[+d.a]; en.warmDone = en.warmDone || [];
    en.warmDone[+d.b] = !en.warmDone[+d.b];
    rerender();
    if (en.warmDone[+d.b]) restStart(60, null);
  },
  toggleEx: d => { S.active.open = S.active.open === +d.a ? -1 : +d.a; rerender(); },
  setReps: d => { S.active.entries[+d.a].draft.r = +d.b; rerender(); },
  bump: d => {
    const en = S.active.entries[+d.a], k = d.b, step = k === 'w' ? (en.step || 1) : (en.repMax - en.repMin > 10 ? 5 : 1);
    en.draft[k] = Math.max(0, Math.round(((en.draft[k] || 0) + (+d.c) * step) * 100) / 100); rerender();
  },
  logSet: d => logSet(+d.a),
  pickTier: d => { const dr = S.active.entries[+d.a].draft; dr.tier = dr.tier === d.b ? null : d.b; rerender(); },
  delSet: d => { S.active.entries[+d.a].sets.splice(+d.b, 1); rerender(); },
  extraSet: d => { const en = S.active.entries[+d.a]; en.plan.sets++; en.plan.tiers = [...(en.plan.tiers || []), (en.plan.tiers || ['g']).slice(-1)[0] === 'r' ? 'y' : (en.plan.tiers || ['g']).slice(-1)[0]]; S.active.open = +d.a; rerender(); },
  finish: () => finishWorkout(),
  cancelWorkout: () => confirmSheet('Удалить текущую тренировку без сохранения?', () => { S.active = null; restStop(); saveLocal(); render(); }, { title: 'Отменить тренировку?', yes: 'Удалить', danger: true }),
  restAdd: d => { restEnd += (+d.a) * 1000; restTotal += +d.a; restTick(); },
  restStop: () => restStop(),

  cycleAction: d => {
    const txt = { close: 'Закрыть текущую неделю и перейти к следующей? Пропущенные дни останутся пропущенными.', deload: 'Перейти к разгрузке прямо сейчас? После неё начнётся новый мезоцикл.', restart: 'Вернуться к неделе 1 текущего мезоцикла?', calib: 'Начать неделю подбора 1ПМ? Каждый день программы — разведка силы по всем упражнениям. После неё начнётся неделя 1 с весами от новой оценки.' }[d.a];
    confirmSheet(txt, () => {
      if (d.a === 'close') advanceWeek();
      else if (d.a === 'deload') S.cycle = { ...S.cycle, week: 4, done: [], weekStartedAt: Date.now() };
      else if (d.a === 'calib') S.cycle = { ...S.cycle, week: 0, done: [], weekStartedAt: Date.now() };
      else S.cycle = { ...S.cycle, week: 1, done: [], weekStartedAt: Date.now() };
      save(); render();
    }, { title: 'Мезоцикл', yes: 'Да' });
  },

  progScope: d => { S.ui.progScope = d.a; S.ui.progDay = 0; rerender(); },
  progDay: d => { S.ui.progDay = +d.a; rerender(); },
  makeActive: d => confirmSheet(`Сделать «${scopeLabel(d.a)}» активной программой? История и позиция в цикле сохранятся, отметки дней этой недели сбросятся.`, () => {
    S.program.active = d.a; S.cycle.done = []; save(); render();
  }, { title: 'Активная программа', yes: 'Сделать активной' }),
  resetScope: d => confirmSheet(`Сбросить «${scopeLabel(d.a)}» к шаблону? Изменения в упражнениях этого набора пропадут, история останется.`, () => {
    S.program.custom[d.a] = TEMPLATES[d.a](S.program.fbCount || 7); if (S.program.active === d.a) S.cycle.done = []; save(); render();
  }, { title: 'Сбросить?', yes: 'Сбросить', danger: true }),
  addDay: d => { const ds = dsOf(d.a); ds.push({ id: uid(), name: 'День ' + (ds.length + 1), exercises: [] }); S.ui.progDay = ds.length - 1; save(); render(); },
  delDay: d => { const ds = dsOf(d.a), day = ds[+d.b]; confirmSheet(`Удалить «${day.name}»? История сохранится.`, () => { ds.splice(+d.b, 1); S.cycle.done = S.cycle.done.filter(x => x !== day.id); S.ui.progDay = 0; save(); render(); }, { title: 'Удалить день?', yes: 'Удалить', danger: true }); },
  renameDay: d => { const day = dsOf(d.a)[+d.b]; promptSheet('Название дня', day.name, v => { if (v.trim()) { day.name = v.trim(); save(); render(); } }); },
  addEx: d => { const ex = mkEx('Новое упражнение', 3, 8, 12, 2.5, 120, null, 'm'); dsOf(d.a)[+d.b].exercises.push(ex); save(); render(); openEditEx(d.a, +d.b, dsOf(d.a)[+d.b].exercises.length - 1); },
  editEx: d => openEditEx(d.a, +d.b, +d.c),
  exNum: d => { const ex = exOf(d); setExNum(ex, d.d, (ex[d.d] || 0) + (+d.e)); afterExEdit(d); },
  exEquip: d => { setEquip(exOf(d), d.d); afterExEdit(d); },
  exGroup: d => { exOf(d).group = d.d; afterExEdit(d); },
  exReplace: d => {
    const day = dsOf(d.a)[+d.b], old = day.exercises[+d.c], e = L.libFind(d.alt);
    if (!e) return;
    const nx = fromLib(e); nx.id = old.id; nx.sets = old.sets; nx.mrv = old.mrv;
    day.exercises[+d.c] = nx; save(); render(); openEditEx(d.a, +d.b, +d.c); toast(old.name + ' → ' + nx.name);
  },
  fbCount: d => {
    const n = +d.a; if (n === S.program.fbCount) return;
    confirmSheet(`Пересобрать дни фулбоди: ${n} упражнений на тренировку? Ручные изменения в фулбоди пропадут, история и прогресс по упражнениям сохранятся.`, () => {
      S.program.fbCount = n; S.program.custom.fullbody = buildFullbody(n, S.program.custom.fullbody); save(); render();
    }, { title: 'Структура фулбоди', yes: 'Пересобрать' });
  },
  delScope: d => confirmSheet(`Удалить набор «${scopeLabel(d.a)}»? История тренировок останется.`, () => {
    delete S.program.custom[d.a]; S.ui.progScope = S.program.active; save(); render();
  }, { title: 'Удалить набор?', yes: 'Удалить', danger: true }),
  exToggle: d => {
    const ex = exOf(d); ex[d.d] = !ex[d.d];
    // «свой вес» и «на штанге» взаимоисключающие: у упражнения без кг нет раскладки блинов
    if (d.d === 'bw' && ex.bw) ex.bar = false;
    if (d.d === 'bar' && ex.bar) ex.bw = false;
    afterExEdit(d);
  },
  moveEx: d => {
    const a = dsOf(d.a)[+d.b].exercises, i = +d.c, j = i + (+d.d);
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; save(); render(); openEditEx(d.a, +d.b, j);
  },
  delEx: d => confirmSheet('Удалить упражнение из программы? История по нему сохранится.', () => { dsOf(d.a)[+d.b].exercises.splice(+d.c, 1); save(); render(); }, { title: 'Удалить?', yes: 'Удалить', danger: true }),

  foodTab: d => { S.ui.foodTab = d.a; rerender(); },
  foodShift: d => { const dt = new Date(foodDay() + 'T12:00:00'); dt.setDate(dt.getDate() + (+d.a)); const k = localKey(dt); S.ui.foodDay = k > localKey(new Date()) ? localKey(new Date()) : k; rerender(); },
  foodAdd: d => {
    const k = parseFloat(($('qaK').value || '').replace(',', '.')), p = parseFloat(($('qaP').value || '').replace(',', '.')) || 0, n = $('qaN').value.trim();
    if (!(k > 0)) { toast('Укажи калории'); return; }
    if (d.a === 'fav') { if (!n) { toast('Для избранного нужно название'); return; } N().favs.push({ id: uid(), name: n, kcal: Math.round(k), p }); }
    addFood(n, k, p);
  },
  foodFav: d => { const f = N().favs[+d.a]; if (f) addFood(f.name, f.kcal, f.p); },
  foodRepeat: d => addFood(d.a, +d.b, +d.c),
  foodDel: d => { const k = foodDay(); N().log[k] = (N().log[k] || []).filter(i => i.id !== d.a); S.deleted.push(d.a); save(); render(); },
  favEdit: () => openSheet('<h3>Избранное</h3><div class="card">' + N().favs.map((f, i) => `<div class="li"><div class="grow"><div class="liT">${esc(f.name)}</div><div class="liS">${f.kcal} ккал · белок ${f.p} г</div></div><button class="calNav" data-act="favDel" data-a="${i}">✕</button></div>`).join('') + '</div><button class="btn" data-act="closeSheet">Готово</button>'),
  favDel: d => { N().favs.splice(+d.a, 1); save(); render(); A.favEdit(); },
  wBump: d => { const el = $('wIn'); el.value = fmtW(Math.round(((parseFloat(el.value.replace(',', '.')) || 0) + (+d.a)) * 10) / 10); },
  wSave: () => {
    const v = parseFloat($('wIn').value.replace(',', '.'));
    if (!(v > 20 && v < 400)) { toast('Проверь вес'); return; }
    N().weights[foodDay()] = Math.round(v * 10) / 10;
    if (N().profile && foodDay() === localKey(new Date())) N().profile.weight = Math.round(v * 10) / 10;
    save(); render(); toast('Вес записан: ' + fmtW(v) + ' кг');
  },
  wDel: d => { delete N().weights[d.a]; save(); render(); },
  normSave: () => {
    const num = id => parseFloat(($(id).value || '').replace(',', '.'));
    const p = { sex: $('nSex').value, age: num('nAge'), height: num('nH'), weight: num('nW'), act: +$('nAct').value, goal: $('nGoal').value };
    if (!(p.age > 10 && p.height > 100 && p.weight > 30)) { toast('Проверь возраст, рост и вес'); return; }
    N().profile = p; save(); render(); toast('Норма сохранена');
  },

  progTab: d => { S.ui.progTab = d.a; rerender(); },
  calShift: d => { let m = calView.m + (+d.a), y = calView.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } calView = { y, m }; render(); },
  dayDetail: d => { const ws = S.history.filter(w => localKey(w.date) === d.a); if (ws.length === 1) openWorkout(ws[0].id); else openSheet('<h3>' + new Date(d.a + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + '</h3><div class="card">' + ws.map(w => `<div class="li" data-act="workout" data-a="${w.id}"><span class="grow liT">${esc(w.dayName)}</span>›</div>`).join('') + '</div>'); },
  workout: d => openWorkout(d.a),
  delWorkout: d => {
    const w = S.history.find(x => x.id === d.a); if (!w) return;
    confirmSheet(`Удалить «${w.dayName}» от ${fmtDate(w.date)}? Рекорды и рекомендации пересчитаются. Закрытые недели цикла не откатываются.`, () => {
      S.history = S.history.filter(x => x.id !== w.id); S.deleted.push(w.id);
      if (w.meso === S.cycle.meso && w.week === S.cycle.week && !S.history.some(x => x.meso === w.meso && x.week === w.week && x.dayId === w.dayId))
        S.cycle.done = S.cycle.done.filter(x => x !== w.dayId);
      save(); render();
    }, { title: 'Удалить запись?', yes: 'Удалить', danger: true });
  },

  profTab: d => { S.ui.profTab = d.a; rerender(); },
  budgetBump: d => { S.settings.setBudget = Math.max(14, Math.min(44, setBudget() + (+d.a))); save(); render(); },
  restSet: d => {
    const r = Object.assign({}, E.REST_DEFAULT, S.settings.rest || {});
    r[d.a] = Math.max(20, Math.min(600, r[d.a] + (+d.b)));
    S.settings.rest = r; save(); render();
  },
  stackBump: d => { S.settings.stack = Math.max(1, (S.settings.stack || 5) + (+d.a)); save(); render(); },
  barBump: d => { S.settings.bar = Math.max(0, (S.settings.bar || 20) + (+d.a)); save(); render(); },
  syncNow: () => cloudSync(),
  login: async () => {
    const nick = $('cfgNick').value.trim(), pass = $('cfgPass').value;
    if (!nick || !pass) { toast('Укажи никнейм и ключ'); return; }
    if (pass.length < 4) { toast('Ключ слишком короткий — минимум 4 символа'); return; }
    cloud = { code: await sha256Hex(nick.toLowerCase() + '::' + pass), nick };
    localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud));
    lastSyncAt = null; render(); await cloudSync(); render();
  },
  logout: () => confirmSheet(`Выйти из «${cloud.nick || ''}» на этом устройстве? Данные в облаке останутся.`, () => { cloud = null; localStorage.removeItem(CLOUD_KEY); render(); }, { title: 'Выйти?', yes: 'Выйти' }),
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = 'progressia-' + localKey(new Date()) + '.json'; a.click();
  },
  resetAll: () => confirmSheet('Удалить программу, историю и питание? Действие необратимо.', () => { S = defaultState(); prCache = null; save(); render(); }, { title: 'Сбросить всё?', yes: 'Удалить всё', danger: true })
};
const CHG = {
  draft: (d, el) => {
    const en = S.active.entries[+d.a];
    let v = parseFloat(String(el.value).replace(',', '.'));
    if (isNaN(v) || v < 0) v = 0;
    en.draft[d.b] = d.b === 'r' ? Math.round(v) : Math.round(v * 100) / 100; rerender();
  },
  exNum: (d, el) => { setExNum(exOf(d), d.d, el.value); afterExEdit(d); },
  exName: (d, el) => {
    const ex = exOf(d), n = el.value.trim() || 'Упражнение';
    ex.name = n;
    // ключ связывает упражнение с историей: меняем, только если истории ещё нет
    if (!E.entriesFor(S.history, ex.key, { limit: 1 }).length) ex.key = normKey(n);
    if (E.isAxial(n)) toast('⚠ Осевая нагрузка на позвоночник — ты её исключил');
    save(); render();
  },
  progKey: (d, el) => { S.ui.progKey = el.value; rerender(); },
  import: (d, el) => {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const x = JSON.parse(r.result); if (!x.program || !x.history) throw new Error('неверный формат'); S = migrateState(x); prCache = null; save(); render(); toast('Данные загружены'); }
      catch (e) { toast('Не удалось импортировать: ' + e.message); }
    };
    r.readAsText(f);
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  // отложенно: change часто приходит из blur, а перерисовка во время blur ломает DOM
  if (el && CHG[el.dataset.chg]) setTimeout(() => CHG[el.dataset.chg](el.dataset, el, e), 0);
});

/* ---------- старт ---------- */
if (S.active) S.ui.tab = 'home';
render();
if (S.ui.axialLog) {
  const log = S.ui.axialLog; delete S.ui.axialLog; save();
  openSheet(`<h3>Без осевой нагрузки</h3><p class="prose" style="margin-bottom:12px">Упражнения, которые нагружают позвоночник сверху или в наклоне, заменены во всех программах. История по ним сохранена.</p>
    <div class="card">${log.map(l => `<div class="li"><span class="liT">${esc(l)}</span></div>`).join('')}</div>
    <button class="btn" data-act="closeSheet">Понятно</button>`);
}
cloudSync();
// новая версия на сервере → новый service worker берёт управление → одна перезагрузка
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded && !S.active) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
  }).catch(() => { });
}
window.__S = () => S; // для отладки из консоли
