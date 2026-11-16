import assert from 'node:assert/strict';
import { reaproveitarTce } from '../src/regras/tce-anterior.js';

const ant = { receitas: { r: 1 }, gastos: { anos: { 2025: { x: 1, areas: { a: 1 } }, 2026: { x: 2, areas: { a: 2 } } }, empresas: ['E'] } };
const metaAnt = { receitasMensais: { '2026-01': 10 }, despesasMensais: { '2026-01': 20 } };
const novo = { receitas: null, gastos: null, avisos: ['a'], meta: { receitasMensais: {}, despesasMensais: {}, outro: 1 } };

// Receitas e despesas fora: reaproveita tudo do anterior, sem mexer no resto.
const r = reaproveitarTce(novo, { receitas: null, despesas: null, siconfi: null }, ant, metaAnt);
assert.deepEqual(r.receitas, ant.receitas);
assert.deepEqual(r.gastos, ant.gastos);
assert.deepEqual(r.meta, { receitasMensais: { '2026-01': 10 }, despesasMensais: { '2026-01': 20 }, outro: 1 });
assert.deepEqual(r.avisos, ['a']);

// Só o SICONFI fora: gastos novos, areas antigas por ano (ano sem antigo fica null).
const novos = { receitas: { r: 9 }, gastos: { anos: { 2026: { x: 99, areas: null }, 2027: { x: 5, areas: null } }, empresas: ['N'] }, meta: { receitasMensais: { m: 1 }, despesasMensais: { m: 2 } } };
const s = reaproveitarTce(novos, { receitas: {}, despesas: {}, siconfi: null }, ant, metaAnt);
assert.deepEqual(s.gastos.anos, { 2026: { x: 99, areas: { a: 2 } }, 2027: { x: 5, areas: null } });
assert.deepEqual(s.gastos.empresas, ['N']);
assert.deepEqual(s.receitas, { r: 9 });
assert.deepEqual(s.meta.despesasMensais, { m: 2 });

// Tudo coletado: nada muda. Sem dado anterior: continua como veio.
assert.deepEqual(reaproveitarTce(novos, { receitas: {}, despesas: {}, siconfi: {} }, ant, metaAnt), novos);
assert.deepEqual(reaproveitarTce(novo, { receitas: null, despesas: null, siconfi: null }, {}, {}), novo);
console.log('tce-anterior: ok');
