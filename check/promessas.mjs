import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATUS_PROMESSA, validarPromessas, resumoPromessas } from '../src/regras/promessas.js';

// O arquivo real (editado à mão) passa na validação.
const real = JSON.parse(readFileSync(new URL('../data/referencia/promessas.json', import.meta.url), 'utf8'));
assert.deepEqual(validarPromessas(real), []);

const I = (numero, status = 'sem informação', provas = []) => ({ numero, texto: `Item ${numero}`, status, provas });
const D = (...areas) => ({ areas });

assert.deepEqual(STATUS_PROMESSA, ['sem informação', 'em andamento', 'cumprida']);
assert.equal(validarPromessas(D({ area: 'A', itens: [I('1.1'), I('1.2')] })).length, 0);
assert.equal(validarPromessas(D({ area: 'A', itens: [I('1.1', 'feita')] })).length, 1);
assert.equal(validarPromessas(D({ area: 'A', itens: [I('1.1', 'cumprida')] })).length, 1);
assert.equal(validarPromessas(D({ area: 'A', itens: [I('1.1', 'em andamento', [{ titulo: 'x', url: 'http://a.gov.br' }])] })).length, 1);
assert.equal(validarPromessas(D({ area: 'A', itens: [I('1.1', 'cumprida', [{ titulo: 'Decreto', url: 'https://a.gov.br/d' }])] })).length, 0);
assert.equal(validarPromessas(D({ area: 'A', itens: [I('1.1')] }, { area: 'B', itens: [I('1.1')] })).length, 1);

const r = resumoPromessas(D(
  { area: 'A', itens: [I('1.1'), I('1.2', 'cumprida', [{ titulo: 'x', url: 'https://a.br' }])] },
  { area: 'B', itens: [I('2.1')] },
));
assert.equal(r.total, 3);
assert.deepEqual(r.porStatus, { 'sem informação': 2, 'em andamento': 0, cumprida: 1 });
assert.equal(r.porArea.length, 2);
assert.equal(r.porArea[0].total, 2);
assert.equal(r.porArea[0].porStatus.cumprida, 1);
console.log('ok: promessas');
