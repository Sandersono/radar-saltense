import assert from 'node:assert/strict';
import { reaproveitarTce, datasTce, idadeTce } from '../src/regras/tce-anterior.js';
import { mensagemErro } from '../src/util/texto.js';

// Data da última coleta boa: coletado agora = agora; fora do ar = a data guardada antes (ou a da execução anterior).
const agora = '2026-11-16T06:00:00.000Z';
assert.deepEqual(datasTce({ receitas: {}, despesas: null }, { tceColetadoEm: { despesas: '2026-11-10T06:00:00.000Z' } }, agora), { receitas: agora, despesas: '2026-11-10T06:00:00.000Z' });
assert.deepEqual(datasTce({ receitas: null, despesas: {} }, { atualizadoEm: '2026-11-15T06:00:00.000Z' }, agora), { receitas: '2026-11-15T06:00:00.000Z', despesas: agora });
// TCE fora nunca trava: aviso para o leitor e linha de manutenção; passou de 10 dias, a manutenção diz o limite.
const i1 = idadeTce({ receitas: agora, despesas: '2026-11-06T06:00:00.000Z' }, agora);
assert.deepEqual(i1.avisos, ['Gastos do TCE-SP até 06/11/2026: a fonte não respondeu nas últimas atualizações.']);
assert.equal(i1.manutencao.length, 1);
const i2 = idadeTce({ receitas: '2026-11-05T05:00:00.000Z', despesas: '2026-11-05T05:00:00.000Z' }, agora);
assert.deepEqual(i2.avisos, ['Receitas e gastos do TCE-SP até 05/11/2026: a fonte não respondeu nas últimas atualizações.']);
assert.match(i2.manutencao[0], /^Receitas do TCE-SP: a fonte não responde há 11 dias.*limite de 10 dias/);
assert.ok(!('problemas' in i2));
assert.deepEqual(idadeTce({ receitas: null, despesas: agora }, agora).avisos, ['Receitas do TCE-SP: a fonte não respondeu nas últimas atualizações.']);
assert.deepEqual(idadeTce({ receitas: agora, despesas: agora }, agora), { avisos: [], manutencao: [] });
// Erros de tempo e de rede em português.
assert.equal(mensagemErro(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })), 'a fonte não respondeu a tempo (tempo esgotado)');
assert.equal(mensagemErro('page.goto: Timeout 60000ms exceeded.\nCall log: ...'), 'a fonte não respondeu a tempo (tempo esgotado)');
assert.equal(mensagemErro('fetch failed'), 'não foi possível conectar à fonte');
assert.equal(mensagemErro('HTTP 503 em https://x\nmais'), 'HTTP 503 em https://x');

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
