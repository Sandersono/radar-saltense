import assert from 'node:assert/strict';
import { lerCsvFolha, grupoFolha, resumirFolha, mesclarFolha } from '../src/regras/folha.js';

const csv = [
  '"Matrícula";"Nome";"Local de Trabalho";"Tipo de Folha";"Unidade";"Cargo";"Regime";"Admissão";"Demissão";"Evento";"Salário Bruto";"Descontos";"Salário Líquido";"Orgão";"Indenizações";"Ano"',
  '"1001";"ALMIR DE MELO SANTOS";"CAMARA MUNICIPAL";"Pagamento";"-";"VEREADOR";"VEREADORES";"01/01/2025";"-";"Exibir";"10.000,00";"4.154,26";"5.845,74";"-";"0,00";"2026"',
  '"1002";"ARILDO GUADAGNINI";"CAMARA MUNICIPAL";"Pagamento";"-";"PRESIDENTE DA CAMARA";"VEREADORES";"01/01/2025";"-";"Exibir";"12.500,00";"5.000,00";"7.500,00";"-";"0,00";"2026"',
  '"2001";"FULANO ASSESSOR";"COMISSIONADOS";"Pagamento";"-";"ASSESSOR PARLAMENTAR";"COMISSAO";"01/02/2025";"-";"Exibir";"4.775,83";"900,00";"3.875,83";"-";"0,00";"2026"',
  '"2002";"BELTRANO CHEFE";"COMISSIONADOS";"Pagamento";"-";"CHEFE DE GABINETE PRESIDENCIA";"COMISSAO";"01/02/2025";"-";"Exibir";"6.512,49";"1.000,00";"5.512,49";"-";"0,00";"2026"',
  '"3001";"CICLANO SERVIDOR";"ADMINISTRATIVO";"Pagamento";"-";"ANALISTA LEGISLATIVO";"CLT";"01/02/2010";"-";"Exibir";"10.479,00";"2.000,00";"8.479,00";"-";"150,00";"2026"',
  '"3001";"CICLANO SERVIDOR";"ADMINISTRATIVO";"13º Salário";"-";"ANALISTA LEGISLATIVO";"CLT";"01/02/2010";"-";"Exibir";"1.000,00";"0,00";"1.000,00";"-";"0,00";"2026"',
  '"3002";"BELTRANA INATIVA";"ADMINISTRATIVO";"Pagamento";"-";"INATIVO";"INATIVOS";"01/02/1990";"-";"Exibir";"3.000,00";"0,00";"3.000,00";"-";"-";"2026"',
].join('\r\n');

const linhas = lerCsvFolha(csv);
assert.equal(linhas.length, 7);
assert.equal(linhas[0]['Nome'], 'ALMIR DE MELO SANTOS');
assert.equal(grupoFolha(linhas[0]), 'vereadores');
assert.equal(grupoFolha(linhas[1]), 'vereadores');
assert.equal(grupoFolha(linhas[2]), 'assessores');
assert.equal(grupoFolha(linhas[3]), 'assessores');
assert.equal(grupoFolha(linhas[4]), 'servidores');
assert.equal(grupoFolha(linhas[6]), 'servidores');
const vereadores = [{ id: 'almir', nome: 'Almir de Melo Santos' }, { id: 'arildo', nome: 'Arildo Guadagnini' }];
const r = resumirFolha(linhas, vereadores);
assert.deepEqual(r.grupos, {
  vereadores: { total: 22500, pessoas: 2 },
  assessores: { total: 11288.32, pessoas: 2 },
  servidores: { total: 14479, pessoas: 2 },
});
assert.deepEqual(r.porVereador, { almir: 10000, arildo: 12500 });
assert.equal(r.indenizacoes, 150);
assert.ok(!JSON.stringify(r).includes('FULANO') && !JSON.stringify(r).includes('CICLANO'));
assert.deepEqual(mesclarFolha({ '2025-01': 1, '2025-02': 2 }, { '2025-02': 3, '2025-03': null }), { '2025-01': 1, '2025-02': 3 });
assert.throws(() => resumirFolha(lerCsvFolha(csv.replace('"10.000,00"', '"dez mil"')), vereadores), /inválido/);
console.log('ok: folha');
