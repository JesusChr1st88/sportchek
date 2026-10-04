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

test('двойная прогрессия: up / hold / down', () => {
  const plan = { repMin: 5, repMax: 8, tier: 'g', tiers: ['g', 'g', 'g'] };
  const up = [sess(1, [{ w: 80, r: 8, tier: 'g' }, { w: 80, r: 8, tier: 'g' }, { w: 80, r: 8, tier: 'g' }], plan)];
  assert.equal(E.recommend(ex(), { meso: 1, week: 1 }, up).w, 82.5);
  const hold = [sess(1, [{ w: 80, r: 7, tier: 'g' }, { w: 80, r: 6, tier: 'g' }], plan)];
  const rh = E.recommend(ex(), { meso: 1, week: 1 }, hold);
  assert.equal(rh.w, 80); assert.equal(rh.reps, 7);
  const down = [sess(1, [{ w: 80, r: 4, tier: 'r' }], plan)];
  assert.equal(E.recommend(ex(), { meso: 1, week: 1 }, down).w, 77.5);
});

test('запланированный отказ не считается провалом, незапланированный — считается', () => {
  const plan = { repMin: 5, repMax: 8, tiers: ['y', 'y', 'r'] };
  const ok = E.judge([{ w: 80, r: 8, tier: 'y' }, { w: 80, r: 8, tier: 'y' }, { w: 80, r: 8, tier: 'r' }], plan);
  assert.equal(ok.outcome, 'up'); assert.equal(ok.unplanned, 0);
  const bad = E.judge([{ w: 80, r: 6, tier: 'r' }, { w: 80, r: 6, tier: 'y' }], { repMin: 5, repMax: 8, tiers: ['g', 'g'] });
  assert.equal(bad.outcome, 'down'); assert.equal(bad.unplanned, 1);
});

test('разгрузка: −10% и её данные не влияют на прогрессию', () => {
  const plan = { repMin: 5, repMax: 8, tiers: ['y', 'y'] };
  const h = [sess(2, [{ w: 100, r: 6, tier: 'y' }, { w: 100, r: 6, tier: 'y' }], plan)];
  const r = E.recommend(ex(), { meso: 1, week: 4 }, h);
  assert.equal(r.w, 90); assert.equal(r.sets, 3);
  h.push(sess(4, [{ w: 50, r: 5, tier: 'g' }], { repMin: 5, repMax: 8, tiers: ['g'] }));
  assert.equal(E.recommend(ex(), { meso: 1, week: 2 }, h).w, 100);
});

test('новый мезоцикл: вес пересчитывается под «легко», не выше прошлого', () => {
  const plan = { repMin: 5, repMax: 8, tiers: ['y', 'y', 'r'] };
  const h = [sess(3, [{ w: 100, r: 8, tier: 'y' }, { w: 100, r: 8, tier: 'y' }, { w: 100, r: 9, tier: 'r' }], plan)];
  const r = E.recommend(ex(), { meso: 2, week: 1 }, h);
  assert.equal(r.reason, 'reset'); assert.ok(r.w <= 100 && r.w > 80, 'w=' + r.w);
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

test('подсказка на подход', () => {
  const en = { step: 2.5, repMin: 5, repMax: 8, plan: { tiers: ['y', 'y', 'y'] } };
  assert.equal(E.nextSetHint(en, { w: 80, r: 10, tier: 'g' }, 0).w, 82.5);
  assert.equal(E.nextSetHint(en, { w: 80, r: 4, tier: 'r' }, 0).w, 77.5);
  assert.equal(E.nextSetHint(en, { w: 80, r: 6, tier: 'r' }, 0).dir, -1);
  assert.equal(E.nextSetHint(en, { w: 80, r: 7, tier: 'y' }, 0).dir, 0);
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
