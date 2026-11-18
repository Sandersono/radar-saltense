import assert from 'node:assert/strict';
import { blocoOrigens } from '../src/site/impostometro.js';

const r = { temOficialAno: true, anoPainel: 2026, fimOficial: '2026-09-30', gruposPainel: { impostos: 200, estado: 300, uniao: 100, fundeb: 0 } };
const gastos = { anos: { 2026: { total: 550, ultimoMes: '2026-09' } } };
const h = blocoOrigens(r, gastos, '', false);
assert.ok(h.includes('De janeiro a setembro de 2026'));
assert.ok(h.includes('33%'), 'impostos = 200 de 600');
assert.ok(h.includes('Repasses do Estado') && !h.includes('FUNDEB'), 'grupo zerado fica de fora');
assert.ok(h.includes('pagaram'), 'pago do mesmo período');
// Pago de outro período não aparece (não mistura meses)
assert.ok(!blocoOrigens(r, { anos: { 2026: { total: 550, ultimoMes: '2026-08' } } }, '', false).includes('pagaram'));
// Sem mês oficial do ano: nada (não inventa)
assert.equal(blocoOrigens({ ...r, temOficialAno: false }, gastos, '', false), '');
// Resumido (página do impostômetro): sem barras
assert.ok(!blocoOrigens(r, gastos, '', true).includes('class="barras"'));
console.log('painel: ok');
