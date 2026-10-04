/* ============================================================
   engine.js — вся тренировочная и пищевая математика.
   Чистые функции без DOM: состояние передаётся аргументом,
   поэтому модуль целиком покрыт тестами (tests/engine.test.mjs).
   ============================================================ */

/* ---------- зоны усилия (RIR — повторы в запасе) ---------- */
export const TIER = {
  g: { rank: 0, rir: 3,   title: 'Легко',  sub: '3+ в запасе' },
  y: { rank: 1, rir: 1.5, title: 'Средне', sub: '1–2 в запасе' },
  r: { rank: 2, rir: 0,   title: 'Отказ',  sub: 'больше ни раза' }
};
const rank = t => (TIER[t] ? TIER[t].rank : 0);

/* ---------- мезоцикл: 3 рабочие недели + разгрузка ---------- */
export const WEEKS = {
  1: { name: 'База',      short: 'Нед 1', desc: 'объём у минимума (MEV), все подходы — легко' },
  2: { name: 'Набор',     short: 'Нед 2', desc: 'подходов больше, все — средне' },
  3: { name: 'Пик',       short: 'Нед 3', desc: 'объём у максимума (MRV), средне; у изоляции последний подход — в отказ' },
  4: { name: 'Разгрузка', short: 'Разгр.', desc: 'половина подходов, −10% веса, всё легко' }
};
export const MEV_CAP = 5;   // потолок стартового объёма на упражнение за сессию
export const MRV_CAP = 7;   // потолок пикового объёма
export const STALL_SESSIONS = 3;

/* ---------- базовая арифметика ---------- */
// Эпли по «повторам до отказа» = сделано + запас. Работает на любом диапазоне повторов,
// в отличие от RPE-таблицы, которая обрывается на 10 повторах.
export function e1rm(w, r, tier) {
  if (!w || !r) return null;
  const rtf = r + (tier && TIER[tier] ? TIER[tier].rir : 0);
  return rtf <= 1 ? w : w * (1 + rtf / 30);
}
export function weightFor(e, reps, tier) {
  return e / (1 + (reps + TIER[tier].rir) / 30);
}
export function roundStep(w, step) {
  if (!step) return Math.round(w * 10) / 10;
  return Math.round(Math.round(w / step) * step * 100) / 100;
}
export const normKey = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

/* ---------- план подходов на неделю ----------
   Подходы: MEV → середина → MRV → 50% MRV.
   Каждый завершённый мезоцикл добавляет +1 подход к MEV изолирующих упражнений
   (до MEV_CAP). Тяжёлые базовые растут только весом.                         */
export function phase(ex, cyc) {
  const bonus = ex.heavy ? 0 : Math.max(0, Math.min(cyc.meso - 1, MEV_CAP - ex.sets));
  const mev = ex.sets + bonus;
  const mrv = Math.max(mev, Math.min((ex.mrv || ex.sets + 2) + bonus, MRV_CAP));
  const wk = cyc.week;
  let sets, tiers;
  if (wk === 4) {
    sets = Math.max(1, Math.round(mrv / 2));
    tiers = Array(sets).fill('g');
  } else {
    sets = wk === 1 ? mev : wk === 2 ? Math.round((mev + mrv) / 2) : mrv;
    tiers = Array(sets).fill(wk === 1 ? 'g' : 'y');
    // отказ — только последний подход пиковой недели и только не у тяжёлой базы
    if (wk === 3 && !ex.heavy) tiers[sets - 1] = 'r';
  }
  return { sets, tiers, tier: tiers[0], deload: wk === 4, mev, mrv };
}
export function targetTier(plan, i) {
  if (plan.tiers && plan.tiers.length) return plan.tiers[Math.min(i, plan.tiers.length - 1)];
  return plan.tier || 'g';
}

/* ---------- оценка выполненного упражнения ----------
   Рабочий вес = максимальный вес сессии. Сравниваем каждый подход с его целевой зоной:
   up   — все рабочие подходы ≥ верх диапазона и не тяжелее цели → +шаг;
   down — хоть один подход < низа диапазона или на 2 зоны тяжелее цели → −шаг;
   hold — иначе: тот же вес, +1 повтор.                                          */
export function judge(sets, plan, bw) {
  const ws = (sets || []).map((s, i) => ({ ...s, i })).filter(s => s.r > 0);
  if (!ws.length) return null;
  const w0 = bw ? 0 : Math.max(...ws.map(s => s.w || 0));
  const top = bw ? ws : ws.filter(s => (s.w || 0) === w0);
  const diffs = top.map(s => rank(s.tier || targetTier(plan, s.i)) - rank(targetTier(plan, s.i)));
  const reps = top.map(s => s.r);
  const unplanned = ws.filter(s => s.tier === 'r' && targetTier(plan, s.i) !== 'r').length;
  let outcome = 'hold';
  if (reps.some(r => r < plan.repMin) || diffs.some(d => d >= 2)) outcome = 'down';
  else if (reps.every(r => r >= plan.repMax) && diffs.every(d => d <= 0)) outcome = 'up';
  return { w0, outcome, minR: Math.min(...reps), maxR: Math.max(...reps), unplanned };
}

/* ---------- выборки из истории ---------- */
export function entriesFor(history, key, opts = {}) {
  const out = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const w = history[i];
    if (opts.skipDeload && w.deload) continue;
    const en = w.entries.find(e => e.key === key && e.sets.some(s => s.r > 0));
    if (en) out.push({ w, en });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}
export function planOf(en, w, ex) {
  if (en.plan && en.plan.repMin != null) return en.plan;
  // записи старой версии без плана: восстанавливаем из упражнения и недели
  const wk = w.week || 1;
  return {
    repMin: ex ? ex.repMin : 1, repMax: ex ? ex.repMax : 99,
    tier: wk === 1 || wk === 4 ? 'g' : (wk === 3 && !(ex && ex.heavy) ? 'r' : 'y'),
    sets: en.sets.length
  };
}
export function topValue(en) {
  let v = null, set = null;
  en.sets.forEach(s => {
    const x = en.bw ? (s.r || 0) : e1rm(s.w, s.r, s.tier);
    if (x && (v == null || x > v)) { v = x; set = s; }
  });
  return { v, set };
}

/* ---------- рекорды: производная от истории, пересчитывается при удалении ----------
   Первая сессия упражнения задаёт базу, а не рекорд.                              */
export function computePRs(history) {
  const best = {}, events = [];
  history.forEach(w => w.entries.forEach(en => {
    const { v, set } = topValue(en);
    if (v == null) return;
    const b = best[en.key];
    if (b && v > b.v + 0.01) events.push({ wid: w.id, key: en.key, name: en.name, v, prev: b.v, date: w.date, bw: !!en.bw });
    if (!b || v > b.v) best[en.key] = { v, w: set.w, r: set.r, tier: set.tier, date: w.date, name: en.name, bw: !!en.bw };
  }));
  return { best, events };
}

/* ---------- плато: N рабочих сессий подряд без нового лучшего 1ПМ ---------- */
export function stallInfo(history, key) {
  const list = entriesFor(history, key, { skipDeload: true }).reverse();
  let best = null, since = 0;
  list.forEach(({ en }) => {
    const { v } = topValue(en);
    if (v == null) return;
    if (best == null || v > best + 0.01) { best = v; since = 0; } else since++;
  });
  return { n: since, stalled: list.length > STALL_SESSIONS && since >= STALL_SESSIONS };
}

/* ---------- рекомендация на следующую сессию ---------- */
export function recommend(ex, cyc, history) {
  const ph = phase(ex, cyc);
  const step = ex.step || 0;
  const base = { sets: ph.sets, tiers: ph.tiers, tier: ph.tier, deload: ph.deload, repMin: ex.repMin, repMax: ex.repMax };
  const hist = entriesFor(history, ex.key, { skipDeload: true, limit: 1 });

  if (ex.bw) {
    if (!hist.length) return { ...base, w: 0, prevW: null, reps: ex.repMin, reason: 'new', note: 'Первый раз — сделай сколько выйдет в целевой зоне' };
    const j = judge(hist[0].en.sets, planOf(hist[0].en, hist[0].w, ex), true);
    let reps = j.outcome === 'down' ? Math.max(1, j.maxR - 1) : j.maxR + 1;
    let note = j.outcome === 'down' ? 'Прошлый раз было тяжело — на повтор меньше' : 'Плюс повтор к прошлому разу';
    if (reps > ex.repMax) note = 'Верх диапазона пройден — пора усложнить вариант или взять отягощение';
    if (ph.deload) { reps = Math.max(1, Math.round(j.maxR * 0.7)); note = 'Разгрузка: ~70% повторов, всё легко'; }
    return { ...base, w: 0, prevW: null, reps, prevReps: j.maxR, reason: ph.deload ? 'deload' : j.outcome, note };
  }

  if (!hist.length) {
    if (ex.seedE1RM) {
      const w = roundStep(weightFor(ex.seedE1RM, ex.repMin, ph.tier) * (ph.deload ? 0.9 : 1), step);
      return { ...base, w, prevW: null, reps: ex.repMin, reason: 'seed', note: 'Из стартового 1ПМ — первая тренировка уточнит' };
    }
    return { ...base, w: null, prevW: null, reps: ex.repMin, reason: 'calib', note: 'Вес неизвестен: начни с лёгкого, первый подход — разведка' };
  }

  const last = hist[0], lastPlan = planOf(last.en, last.w, ex);
  const j = judge(last.en.sets, lastPlan, false);
  let w = j.w0, reps = ex.repMin, reason = j.outcome, note;

  if (rank(ph.tier) < rank(targetTier(lastPlan, 0)) && !ph.deload) {
    // новый мезоцикл после разгрузки: цель стала легче → вес от 1ПМ под «легко»
    const mid = Math.round((ex.repMin + ex.repMax) / 2);
    const e = topValue(last.en).v;
    w = Math.min(j.w0, roundStep(weightFor(e, mid, ph.tier), step));
    reps = mid; reason = 'reset';
    note = 'Новый цикл: вес под «легко» по прошлому 1ПМ, дальше снова растём';
  } else if (j.outcome === 'up') {
    w = j.w0 + step; reps = ex.repMin;
    note = 'Все подходы на верх диапазона — +' + fmtW(step) + ' кг';
  } else if (j.outcome === 'down') {
    w = Math.max(0, j.w0 - step); reps = ex.repMin;
    note = 'Прошлый раз тяжелее плана — −' + fmtW(step) + ' кг';
  } else {
    reps = Math.min(ex.repMax, Math.max(ex.repMin, j.minR + 1));
    note = 'Тот же вес — добиваем до ' + reps + ' повт.';
  }
  const st = stallInfo(history, ex.key);
  if (st.stalled && reason !== 'up') note += ' · плато ' + st.n + ' трен.: сбрось 10% и пройди заново';
  if (ph.deload) { w = w * 0.9; reps = ex.repMin; reason = 'deload'; note = 'Разгрузка: −10% веса и половина подходов'; }
  return { ...base, w: roundStep(w, step), prevW: j.w0, reps, reason, note, stall: st.stalled };
}

/* ---------- подсказка на следующий подход внутри тренировки ---------- */
export function nextSetHint(en, s, idx) {
  if (en.bw || !en.step || !s.w) return null;
  const tgt = targetTier(en.plan, idx);
  const d = rank(s.tier) - rank(tgt);
  if (s.r < en.repMin || d >= 2) return { w: Math.max(0, s.w - en.step), dir: -1, note: 'тяжелее плана — сбавь' };
  if (tgt !== 'r' && s.tier === 'r') return { w: Math.max(0, s.w - en.step), dir: -1, note: 'незапланированный отказ — сбавь' };
  if (d < 0 && s.r > en.repMax) return { w: s.w + en.step, dir: 1, note: 'легко и сверх диапазона — добавь' };
  if (d <= -2 && s.r >= en.repMax) return { w: s.w + en.step, dir: 1, note: 'сильно легче цели — добавь' };
  return { w: s.w, dir: 0, note: 'в цели — держи вес' };
}

/* ---------- сигнал перегруза: предложить разгрузку раньше ----------
   Две последние рабочие сессии текущего мезоцикла, в каждой ≥2 упражнения с провалом
   или ≥3 незапланированных отказа.                                                  */
export function fatigueSignal(history, cyc) {
  if (cyc.week === 4) return null;
  const recent = history.filter(w => w.meso === cyc.meso && !w.deload).slice(-2);
  if (recent.length < 2) return null;
  const score = recent.map(w => ({
    downs: w.entries.filter(e => e.outcome === 'down').length,
    fails: w.entries.reduce((a, e) => a + (e.unplanned || 0), 0)
  }));
  if (score.every(s => s.downs >= 2 || s.fails >= 3)) {
    return { downs: score.reduce((a, s) => a + s.downs, 0), fails: score.reduce((a, s) => a + s.fails, 0) };
  }
  return null;
}

export function fmtW(w) { return (Math.round(w * 100) / 100).toString().replace('.', ','); }

/* ============================================================
   ПИТАНИЕ
   ============================================================ */
export const ACTIVITY = [
  [1.2, 'Сидячий, без тренировок'],
  [1.375, '1–3 тренировки в неделю'],
  [1.55, '3–5 тренировок в неделю'],
  [1.725, '6–7 тренировок в неделю']
];
export const GOALS = {
  cut:  { title: 'Сушка',      adj: -0.18, protein: 2.0 },
  keep: { title: 'Поддержание', adj: 0,     protein: 1.8 },
  bulk: { title: 'Набор',      adj: 0.10,  protein: 1.8 }
};
// Миффлин — Сан Жеор
export function bmr(p) {
  if (!p || !p.weight || !p.height || !p.age) return null;
  return 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
}
export function formulaTdee(p) { const b = bmr(p); return b ? b * (p.act || 1.55) : null; }

// Тренд веса: линейная регрессия по последним `days` дням, кг/день
export function weightTrend(weights, today, days = 14) {
  const t0 = dayNum(today);
  const pts = Object.entries(weights || {})
    .map(([k, v]) => [dayNum(k) - t0, v]).filter(([x]) => x > -days && x <= 0);
  if (pts.length < 2) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx;
  return { slope, perWeek: slope * 7, avg: my, n };
}
/* Адаптивный расход: за 21 день, если записана еда ≥ 14 дней и вес ≥ 6 раз.
   TDEE = средний приём − (изменение веса в день × 7700 ккал/кг).
   Ограничиваем ±25% от формулы, чтобы шум в данных не уводил цифру в космос. */
export function adaptiveTdee(foodByDay, weights, today, profile) {
  const t0 = dayNum(today);
  const days = Object.entries(foodByDay || {})
    .filter(([k, items]) => { const x = dayNum(k) - t0; return x > -21 && x < 0 && items && items.length; })
    .map(([, items]) => items.reduce((a, i) => a + (i.kcal || 0), 0));
  const wc = Object.keys(weights || {}).filter(k => { const x = dayNum(k) - t0; return x > -21 && x <= 0; }).length;
  if (days.length < 14 || wc < 6) return null;
  const trend = weightTrend(weights, today, 21);
  if (!trend) return null;
  const avgIn = days.reduce((a, b) => a + b, 0) / days.length;
  let tdee = avgIn - trend.slope * 7700;
  const f = formulaTdee(profile);
  if (f) tdee = Math.max(f * 0.75, Math.min(f * 1.25, tdee));
  return { tdee, avgIn, days: days.length, trend };
}
export function nutritionTargets(profile, adaptive) {
  const base = adaptive ? adaptive.tdee : formulaTdee(profile);
  if (!base) return null;
  const g = GOALS[profile.goal] || GOALS.keep;
  const kcal = Math.round(base * (1 + g.adj) / 10) * 10;
  const protein = Math.round(profile.weight * g.protein);
  const fat = Math.round(profile.weight * 0.8);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, tdee: Math.round(base), source: adaptive ? 'adaptive' : 'formula' };
}
export function dayNum(key) {
  const d = key instanceof Date ? key : new Date(String(key).slice(0, 10) + 'T12:00:00');
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/* ---------- отдых после подхода ----------
   Базовый отдых упражнения = отдых после «средне». После лёгкого подхода утомление
   меньше — восстанавливаемся быстрее; после отказа нужно заметно больше времени,
   иначе следующий подход потеряет повторы (Schoenfeld 2016, Grgic 2017 — длинный отдых
   сохраняет объём в многосуставных движениях). Тяжёлой базе — не меньше 2 минут.  */
export const REST_K = { g: 0.7, y: 1, r: 1.4 };
export function restFor(base, tier, heavy) {
  if (!base) return 0;
  let s = base * (REST_K[tier] || 1);
  s = Math.max(heavy ? 120 : 45, s);
  return Math.round(s / 15) * 15;
}
