// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const ex = (o = {}) => ({ key: 'жим', name: 'Жим', sets: 3, mrv: 5, repMin: 5, repMax: 8, step: 2.5, heavy: false, bw: false, ...o });
const sess = (week, sets, plan, extra = {}) => ({
  id: Math.random().toString(36), date: '2026-10-01T10:00:00Z', meso: 1, week, deload: week === 4,
  entries: [{ key: 'жим', name: 'Жим', sets, plan, ...extra }]
});

test('phase: объём MEV→MRV, отказ только в последнем подходе пиковой недели', () => {
  const p1 = E.phase(ex(), { meso: 1, week: 1 });
  assert.equal(p1.sets, 3); assert.deepEqual(p1.tiers, ['g', 'g', 'g']);
  assert.equal(E.phase(ex(), { meso: 1, week: 2 }).sets, 4);
  const p3 = E.phase(ex(), { meso: 1, week: 3 });
  assert.deepEqual(p3.tiers, ['y', 'y', 'y', 'y', 'r']);
  const h3 = E.phase(ex({ heavy: true, mrv: 4 }), { meso: 1, week: 3 });
  assert.ok(!h3.tiers.includes('r'), 'тяжёлая база не уходит в отказ');
  const d = E.phase(ex(), { meso: 1, week: 4 });
  assert.equal(d.sets, 3); assert.ok(d.deload);
});

test('phase: рост MEV по мезоциклам с потолком, база не растёт', () => {
  assert.equal(E.phase(ex(), { meso: 3, week: 1 }).sets, 5);
  assert.equal(E.phase(ex(), { meso: 9, week: 1 }).sets, E.MEV_CAP);
  assert.equal(E.phase(ex({ heavy: true }), { meso: 9, week: 1 }).sets, 3);
  assert.ok(E.phase(ex(), { meso: 9, week: 3 }).sets <= E.MRV_CAP);
});

test('запланированный отказ не считается провалом, незапланированный — считается', () => {
  const plan = { repMin: 5, repMax: 8, tiers: ['y', 'y', 'r'] };
  const ok = E.judge([{ w: 80, r: 8, tier: 'y' }, { w: 80, r: 8, tier: 'y' }, { w: 80, r: 8, tier: 'r' }], plan);
  assert.equal(ok.outcome, 'up'); assert.equal(ok.unplanned, 0);
  const bad = E.judge([{ w: 80, r: 6, tier: 'r' }, { w: 80, r: 6, tier: 'y' }], { repMin: 5, repMax: 8, tiers: ['g', 'g'] });
  assert.equal(bad.outcome, 'down'); assert.equal(bad.unplanned, 1);
});

test('рекорды: первая сессия — база, не рекорд', () => {
  const p = { repMin: 5, repMax: 8, tiers: ['g'] };
  const h = [sess(1, [{ w: 80, r: 5, tier: 'g' }], p), sess(1, [{ w: 85, r: 5, tier: 'g' }], p)];
  assert.equal(E.computePRs(h).events.length, 1);
  assert.equal(E.computePRs(h.slice(0, 1)).events.length, 0);
});

test('e1rm работает на высоких повторах и с запасом', () => {
  assert.ok(E.e1rm(20, 15, 'g') > E.e1rm(20, 15, 'r'));
  assert.equal(E.e1rm(100, 1, 'r'), 100);
});

test('сигнал перегруза', () => {
  const mk = () => ({ meso: 1, week: 2, deload: false, entries: [{ outcome: 'down' }, { outcome: 'down' }, { outcome: 'hold' }] });
  assert.ok(E.fatigueSignal([mk(), mk()], { meso: 1, week: 2 }));
  assert.equal(E.fatigueSignal([mk()], { meso: 1, week: 2 }), null);
});

test('питание: формула и адаптивный расход', () => {
  const p = { sex: 'm', weight: 80, height: 180, age: 30, act: 1.55, goal: 'cut' };
  assert.equal(E.bmr(p), 1780);
  const t = E.nutritionTargets(p, null);
  assert.equal(t.protein, 160); assert.ok(t.kcal < t.tdee);
  const food = {}, w = {};
  for (let i = 1; i <= 20; i++) {
    const d = new Date(2026, 9, 20 - i); const k = d.toISOString().slice(0, 10);
    food[k] = [{ kcal: 2500 }]; w[k] = 80 + i * 0.05; // вес падает ~0,35 кг/нед
  }
  const a = E.adaptiveTdee(food, w, '2026-10-20', p);
  assert.ok(a && a.tdee > 2700 && a.tdee < 3000, JSON.stringify(a));
});

test('отдых: стандарт по сложности подхода', () => {
  assert.equal(E.restFor('g'), 80);
  assert.equal(E.restFor('y'), 110);
  assert.equal(E.restFor('r'), 150);
  assert.equal(E.restFor('g', { g: 60 }), 60);
  assert.equal(E.restFor('r', { g: 60 }), 150);
});

test('осевая нагрузка распознаётся', () => {
  ['Приседания со штангой', 'Фронтальные приседания', 'Становая тяга', 'Румынская тяга', 'Тяга штанги в наклоне',
   'Жим штанги стоя', 'Жим гантелей сидя', 'Подъёмы на носки', 'Выпады с гантелями'].forEach(n => assert.ok(E.isAxial(n), n));
  ['Жим платформы ногами', 'Жим штанги лёжа', 'Подъёмы на носки сидя', 'Тяга с упором в грудь', 'Ягодичный мост со штангой']
    .forEach(n => assert.ok(!E.isAxial(n), n));
});

test('разминка: ступени к рабочему весу', () => {
  const heavy = E.warmupSets({ bar: true, heavy: true, step: 2.5, repMin: 5 }, 100, { bar: 20 });
  assert.deepEqual(heavy.map(s => s.w), [20, 40, 60, 80]);
  const comp = E.warmupSets({ step: 2, repMin: 8 }, 30);
  assert.deepEqual(comp.map(s => s.w), [16, 22]);
  assert.equal(E.warmupSets({ step: 1, repMin: 12 }, 10).length, 1);
  assert.equal(E.warmupSets({ bar: true, heavy: true, step: 2.5, repMin: 5 }, 100, { deload: true }).length, 1);
  assert.equal(E.warmupSets({ bar: true, heavy: true, step: 2.5, repMin: 5 }, 20, { bar: 20 }).length, 0);
  assert.equal(E.warmupSets({ step: 2.5, repMin: 5 }, null).length, 0);
  assert.ok(E.warmupSets({ bw: true, repMin: 12 }, 0)[0].r === 6);
  heavy.forEach(s => assert.ok(s.w < 100));
});

import * as L from '../js/library.js';
test('библиотека: без осевой нагрузки, у всех есть группа', () => {
  L.LIB.forEach(e => { assert.ok(!E.isAxial(e[0]), e[0]); assert.ok(L.GROUPS[e[1]], e[0]); });
});
test('фулбоди: 6/7/8 упражнений, крупные группы в каждом дне, без повторов внутри дня', () => {
  [6, 7, 8].forEach(n => {
    const plan = L.fullbodyPlan(n);
    assert.equal(plan.length, 3);
    plan.forEach(day => {
      assert.equal(day.length, n);
      assert.equal(new Set(day.map(e => e[0])).size, n);
      ['quads', 'chest', 'back', 'post', 'delts'].forEach(g => assert.ok(day.some(e => e[1] === g), n + ' ' + g));
    });
    // в разные дни — разные упражнения на ту же группу
    assert.notEqual(plan[0][0][0], plan[1][0][0]);
  });
  assert.equal(L.fullbodyPlan(7)[0].filter(e => e[7] === 'h').length, 1);
});
test('группа по названию', () => {
  assert.equal(L.guessGroup('Сгибания ног'), 'post');
  assert.equal(L.guessGroup('Разгибания ног в тренажёре'), 'quads');
  assert.equal(L.guessGroup('Разгибания рук на блоке'), 'triceps');
  assert.equal(L.guessGroup('Подтягивания'), 'back');
  assert.equal(L.guessGroup('Тяга гантели к поясу'), 'back');
});

test('вес от 1ПМ: растёт с силой и с запасом недели, без скачков', () => {
  const pg = { repMin: 5, repMax: 8, tiers: ['g', 'g', 'g'] };
  const h = [sess(1, [{ w: 80, r: 8, tier: 'g' }, { w: 80, r: 8, tier: 'g' }, { w: 80, r: 8, tier: 'g' }], pg)];
  const w1 = E.recommend(ex(), { meso: 1, week: 1 }, h), w2 = E.recommend(ex(), { meso: 1, week: 2 }, h);
  assert.equal(w1.reps, 7);
  assert.ok(w1.w >= 80 && w1.w <= 84, 'неделя 1: ' + w1.w);
  assert.ok(w2.w > 80 && w2.w <= 84, 'неделя 2 тяжелее, но ≤ +5%: ' + w2.w);
  assert.ok(w2.w >= w1.w);
});

test('провал снижает вес', () => {
  const h = [sess(1, [{ w: 80, r: 4, tier: 'r' }], { repMin: 5, repMax: 8, tiers: ['g'] })];
  assert.ok(E.recommend(ex(), { meso: 1, week: 1 }, h).w < 80);
});

test('разгрузка: −10%, её данные не влияют на оценку', () => {
  const py = { repMin: 5, repMax: 8, tiers: ['y', 'y'] };
  const h = [sess(2, [{ w: 100, r: 6, tier: 'y' }, { w: 100, r: 6, tier: 'y' }], py)];
  const d = E.recommend(ex(), { meso: 1, week: 4 }, h);
  assert.ok(d.w < 100 && d.w >= 80, 'разгрузка ' + d.w); assert.equal(d.sets, 3); assert.equal(d.reason, 'deload');
  const before = E.estimateE1RM(h, 'жим');
  h.push(sess(4, [{ w: 50, r: 5, tier: 'g' }], { repMin: 5, repMax: 8, tiers: ['g'] }));
  assert.equal(E.estimateE1RM(h, 'жим'), before);
});

test('оценка 1ПМ сглажена, подбор её переписывает', () => {
  const pg = { repMin: 5, repMax: 8, tiers: ['y'] };
  const h = [sess(1, [{ w: 100, r: 6, tier: 'y' }], pg), sess(2, [{ w: 60, r: 6, tier: 'y' }], pg)];
  const est = E.estimateE1RM(h, 'жим');
  assert.ok(est > 60 * 1.25 && est < 100 * 1.25, 'один плохой день не роняет оценку вдвое');
  h.push({ ...sess(0, [{ w: 70, r: 7, tier: 'y' }], pg), week: 0 });
  assert.equal(Math.round(E.estimateE1RM(h, 'жим')), Math.round(E.e1rm(70, 7, 'y')));
});

test('крупный шаг снаряда: прогрессия повторами, на верхней границе — шагом', () => {
  const d = ex({ key: 'махи', step: 2, repMin: 10, repMax: 12 });
  const p = { repMin: 10, repMax: 12, tiers: ['g', 'g'] };
  const s1 = [{ id: 'a', date: 'x', meso: 1, week: 1, entries: [{ key: 'махи', sets: [{ w: 10, r: 11, tier: 'g' }, { w: 10, r: 11, tier: 'g' }], plan: p }] }];
  const r1 = E.recommend(d, { meso: 1, week: 1 }, s1);
  assert.equal(r1.w, 10); assert.equal(r1.reps, 12);
  const s2 = [{ id: 'b', date: 'x', meso: 1, week: 1, entries: [{ key: 'махи', sets: [{ w: 10, r: 12, tier: 'g' }, { w: 10, r: 12, tier: 'g' }], plan: p }] }];
  assert.equal(E.recommend(d, { meso: 1, week: 1 }, s2).w, 12);
});

test('«легко» при цели «средне» не застревает: запас 4', () => {
  assert.ok(E.e1rm(80, 7, 'g', 'y') > E.e1rm(80, 7, 'g', 'g'));
});

test('подсказка на подход', () => {
  const en = { step: 2.5, repMin: 5, repMax: 8, plan: { tiers: ['y', 'y', 'y'], reps: 7 } };
  assert.equal(E.nextSetHint(en, { w: 80, r: 7, tier: 'g' }, 0).w, 82.5);
  assert.equal(E.nextSetHint(en, { w: 80, r: 4, tier: 'r' }, 0).w, 77.5);
  assert.equal(E.nextSetHint(en, { w: 80, r: 7, tier: 'r' }, 0).dir, -1);
  assert.equal(E.nextSetHint(en, { w: 80, r: 7, tier: 'y' }, 0).dir, 0);
});

test('подбор 1ПМ: растём до «средне», без отказа', () => {
  const e = ex({ repMin: 5, repMax: 8, step: 2.5 });
  const a1 = E.calibStep(e, { w: 40, r: 7, tier: 'g' }, 1);
  assert.ok(!a1.done && a1.nextW >= 46 && a1.nextW <= 50.5, 'скачок ' + a1.nextW);
  const a2 = E.calibStep(e, { w: 60, r: 7, tier: 'y' }, 3);
  assert.ok(a2.done); assert.equal(Math.round(a2.e1rm), Math.round(60 * (1 + 8.5 / 30)));
  assert.ok(E.calibStep(e, { w: 60, r: 7, tier: 'g' }, E.CALIB_MAX).done);
  // после подбора рабочий вес недели 1 — под «легко»
  const h = [{ id: 'c', date: 'x', meso: 1, week: 0, entries: [{ key: 'жим', sets: [{ w: 60, r: 7, tier: 'y' }], plan: { repMin: 5, repMax: 8, tiers: ['y'] } }] }];
  const r = E.recommend(e, { meso: 1, week: 1 }, h);
  assert.ok(r.w < 60 && r.w >= 52.5, 'неделя 1 после подбора: ' + r.w);
});

test('лимит подходов за тренировку', () => {
  const plans = Array.from({ length: 7 }, (_, i) => ({ sets: 5, tiers: ['y', 'y', 'y', 'y', 'r'], heavy: i === 1 }));
  const out = E.fitBudget(plans, 28);
  assert.equal(out.reduce((a, p) => a + p.sets, 0), 28);
  assert.ok(out.every(p => p.sets >= 2 && p.tiers.length === p.sets));
  assert.ok(out.filter(p => !p.heavy).every(p => p.tiers[p.tiers.length - 1] === 'r'));
  assert.equal(E.fitBudget(plans, 0)[0].sets, 5);
});

test('неделя подбора не даёт пиковый объём', () => {
  assert.equal(E.phase(ex(), { meso: 1, week: 0 }).sets, 3);
});
