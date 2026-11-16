import assert from 'node:assert/strict';
import { linhasCda } from '../src/regras/pentaho.js';
import { resumirIegm, FAIXAS_IEGM } from '../src/regras/iegm.js';
import { normalizarObras, frase } from '../src/regras/obras.js';
import { limparNomeEmpresa } from '../src/util/texto.js';

assert.deepEqual(linhasCda({ metadata: [{ colName: 'a' }, { colName: 'b' }], resultset: [[1, 'x'], [2, 'y']] }), [{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
assert.deepEqual(linhasCda({ metadata: [{ colName: 'a' }], resultset: [] }), []);

const L = (nome, f) => ({ nome, iegm: f[0], iplanejamento: f[1], ifiscal: f[2], ieduc: f[3], isaude: f[4], iamb: f[5], icidade: f[6], igov: f[7] });
const r = resumirIegm([
  L('SALTO', ['C', 'C', 'C+', 'C+', 'C+', 'C+', 'C', 'C']),
  L('SALTO DE PIRAPORA', ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']),
  L('Itu', ['C+', 'C', 'B', 'B', 'B', 'B', 'C+', 'C']),
  L('CABREUVA', ['C+', 'C+', 'C+', 'B', 'B+', 'C', 'C', 'B']),
  L('Campinas', ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']),
]);
assert.deepEqual(Object.keys(r).sort(), ['Cabreúva', 'Itu', 'Salto']);
assert.deepEqual(r.Salto, { iegm: 'C', plan: 'C', fisc: 'C+', educ: 'C+', saude: 'C+', amb: 'C+', cidade: 'C', gov: 'C' });
assert.equal(FAIXAS_IEGM.C, 'Baixo nível de adequação');

const obras = normalizarObras([
  { ds_situacao: 'Em execução - no prazo', vl_ajuste: 4655497.25, nome: 'CHRONOS LTDA', doc: '12.345.678/0001-90', ds_entidade: 'PREFEITURA', ano_ajuste: '2025', objeto_ajuste: 'Clínica' },
  { ds_situacao: 'Paralisada', vl_ajuste: '4.730.664,35', nome: 'PRIME LTDA', doc: '98765432000110', ds_entidade: 'PREFEITURA', ano_ajuste: 2024, objeto_ajuste: 'Água' },
  { ds_situacao: 'Em execução - no prazo', vl_ajuste: 1000, nome: 'JOAO DA SILVA', doc: '123.456.789-01', ds_entidade: 'PREFEITURA', ano_ajuste: '2025', objeto_ajuste: 'Reparo' },
]);
assert.deepEqual(obras.map((o) => o.objeto), ['Água', 'Clínica', 'Reparo']);
assert.deepEqual(obras[0], { situacao: 'Paralisada', paralisada: true, valor: 4730664.35, contratado: 'PRIME LTDA', cnpj: '98765432000110', contratante: 'PREFEITURA', ano: 2024, objeto: 'Água' });
assert.equal(obras[1].cnpj, '12345678000190');
assert.equal(obras[2].contratado, 'Pessoa física');
assert.equal(obras[2].cnpj, null);
assert.ok(!JSON.stringify(obras).includes('JOAO'));
assert.deepEqual(linhasCda({}), []);
const o2 = normalizarObras([
  { ds_situacao: 'x', vl_ajuste: 1, nome: 'MARIA SEM ZERO', doc: '1234567890', ds_entidade: 'P', ano_ajuste: 2025, objeto_ajuste: 'a' },
  { ds_situacao: 'x', vl_ajuste: 1, nome: 'EMPRESA SEM DOC', doc: '', ds_entidade: 'P', ano_ajuste: 2025, objeto_ajuste: 'b' },
]);
assert.equal(o2[0].contratado, 'Pessoa física');
assert.equal(o2[1].contratado, 'Não informado');
assert.ok(!JSON.stringify(o2).includes('MARIA') && !JSON.stringify(o2).includes('EMPRESA'));
assert.equal(frase('CONTRATACAO DE EMPRESA EM SALTO SP CONFORME ABNT'), 'Contratacao de empresa em salto SP conforme ABNT');
assert.equal(frase('  '), '');
assert.equal(limparNomeEmpresa('FULANO DA SILVA 123.456.789-01'), 'FULANO DA SILVA');
assert.equal(limparNomeEmpresa('12345678901 - FULANO ME'), 'FULANO ME');
assert.equal(limparNomeEmpresa('CHRONOS LTDA'), 'CHRONOS LTDA');
assert.equal(limparNomeEmpresa('30 565 924 FULANA'), '30 565 924 FULANA');
assert.equal(limparNomeEmpresa('30565924 FULANA 111.222.333-44'), '30565924 FULANA');
assert.equal(normalizarObras([{ nome: 'X 123.456.789-01 LTDA', doc: '12345678000190', objeto_ajuste: 'REFORMA' }])[0].contratado, 'X LTDA');
console.log('ok: tce');
