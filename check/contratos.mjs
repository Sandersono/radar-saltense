import assert from 'node:assert/strict';
import { resumirContratacoes, resumirContratos, MODALIDADES } from '../src/regras/contratos.js';

assert.equal(MODALIDADES[8], 'Dispensa');
assert.equal(MODALIDADES[9], 'Inexigibilidade');
const c = resumirContratacoes([
  { modalidadeId: 8, valorTotalHomologado: 1000, valorTotalEstimado: 1200 },
  { modalidadeId: 8, valorTotalHomologado: 0, valorTotalEstimado: 500 },
  { modalidadeId: 9, valorTotalHomologado: 2000, valorTotalEstimado: 2000 },
  { modalidadeId: 6, valorTotalHomologado: null, valorTotalEstimado: 7000 },
]);
assert.deepEqual(c.porModalidade, {
  6: { nome: 'Pregão eletrônico', quantidade: 1, valor: 7000 },
  8: { nome: 'Dispensa', quantidade: 2, valor: 1500 },
  9: { nome: 'Inexigibilidade', quantidade: 1, valor: 2000 },
});
assert.deepEqual(c.total, { quantidade: 4, valor: 10500 });
assert.deepEqual(c.semDisputa, { quantidade: 3, valor: 3500, pctQuantidade: 75, pctValor: 33 });

const k = resumirContratos([
  { niFornecedor: '11111111000111', nomeRazaoSocialFornecedor: 'A LTDA', valorGlobal: 100 },
  { niFornecedor: '11111111000111', nomeRazaoSocialFornecedor: 'A LTDA', valorGlobal: 50.5 },
  { niFornecedor: '22222222000122', nomeRazaoSocialFornecedor: 'B SA', valorGlobal: 120 },
  { niFornecedor: '12345678901', nomeRazaoSocialFornecedor: 'FULANO DE TAL', valorGlobal: 999 },
]);
assert.equal(k.quantidade, 4);
assert.equal(k.valor, 1269.5);
assert.deepEqual(k.top, [
  { cnpj: '11111111000111', nome: 'A LTDA', valor: 150.5, contratos: 2 },
  { cnpj: '22222222000122', nome: 'B SA', valor: 120, contratos: 1 },
]);
assert.ok(!JSON.stringify(k).includes('FULANO') && !JSON.stringify(k).includes('12345678901'));
console.log('ok: contratos');
