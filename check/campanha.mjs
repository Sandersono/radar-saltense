import assert from 'node:assert/strict';
import { origemCampanha, resumirCampanha } from '../src/regras/campanha.js';

assert.equal(origemCampanha('Recursos de partido político'), 'partido');
assert.equal(origemCampanha('Recursos de pessoas físicas'), 'pessoas');
assert.equal(origemCampanha('Recursos próprios'), 'proprios');
assert.equal(origemCampanha('Recursos de Financiamento Coletivo'), 'coletivo');
assert.equal(origemCampanha('Recursos de outros candidatos'), 'outros');
assert.equal(origemCampanha('#NULO'), null);
const L = (origem, valor, doador) => ({ DS_ORIGEM_RECEITA: origem, VR_RECEITA: valor, NR_CPF_CNPJ_DOADOR: doador });
const r = resumirCampanha([
  L('Recursos de partido político', '30000,00', '11111111000111'),
  L('Recursos de pessoas físicas', '1000,00', '12345678901'),
  L('Recursos de pessoas físicas', '500,50', '12345678901'),
  L('Recursos de pessoas físicas', '200,00', '98765432100'),
  L('Recursos próprios', '7000,00', '55555555555'),
  L('Recursos de Financiamento Coletivo', '9171,00', '22222222000122'),
  L('#NULO', '0,00', '-1'),
]);
assert.deepEqual(r, { total: 47871.5, origens: { partido: 30000, pessoas: 1700.5, proprios: 7000, coletivo: 9171, outros: 0 }, doadoresPessoas: 2 });
assert.ok(!JSON.stringify(r).includes('12345678901'));
console.log('ok: campanha');
