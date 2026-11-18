import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resumirMsc, origemReceita, destinoFonte, tipoEmenda, primeiroComDados, conferir, totaisTce,
  mesclarOrigem, codigosSemNome, consultadoHoje, maioresAreas, montarOrigem, compactarMsc, expandirMsc,
} from '../src/regras/origem.js';

// Linha da MSC (o valor vem sempre positivo; o sentido é a natureza C/D).
// (compactarMsc/expandirMsc: o que é salvo em data/processado/origem.json)
const linha = (conta, valor, extra = {}) => ({ conta_contabil: conta, valor, natureza_conta: 'C', poder_orgao: '10131', ...extra });
const rec = (valor, nr, fonte, co = null) => linha('621200000', valor, { natureza_receita: nr, fonte_recursos: fonte, complemento_fonte: co });
const ded = (conta, valor, nr, fonte) => linha(conta, valor, { natureza_conta: 'D', natureza_receita: nr, fonte_recursos: fonte });
const desp = (conta, valor, fonte, funcao, co = null, po = '10131') => linha(conta, valor, { fonte_recursos: fonte, funcao, complemento_fonte: co, poder_orgao: po, natureza_despesa: '33903900' });

// Cálculo das contas: líquida = realizada - deduções; empenhada = .01 a .07; liquidada = .03 + .04 + .07; paga = .04.
const exemplo = [
  rec(1000, '17215001', '1500'), // ICMS
  ded('621310100', 200, '17215001', '1500'), // retenção do Fundeb
  ded('621390000', 10, '11125001', '1500'), // restituição de IPTU
  rec(300, '11125001', '1500'), // IPTU
  rec(150, '17515001', '1540'), // Fundeb
  rec(50, '79239901', '1500'), // intraorçamentária
  rec(40, '17135011', '1747', '3110'), // emenda individual da União (finalidade definida, no SUS)
  rec(20, '24195101', '1706', '3110'), // transferência especial da União
  desp('622130100', 7, '1500', '04'),
  desp('622130200', 5, '1500', '04'),
  desp('622130300', 11, '1500', '10', '1002'),
  desp('622130400', 100, '1500', '04'),
  desp('622130400', 30, '1747', '10', '3110'),
  desp('622130400', 9, '1500', '01', null, '20231'),
  desp('622130500', 13, '1540', '12'),
  desp('622130700', 2, '1540', '12'),
  linha('622110000', 999, { fonte_recursos: '1500', funcao: '04' }), // crédito disponível: fora
  rec(1, '17215001', '1500'), // mesma combinação de campos de outra linha: somada ao salvar
];
exemplo.splice(0, 1, rec(999, '17215001', '1500'));
const r = resumirMsc(exemplo);
// Salvo compacto (sem a conta 622110000, linhas iguais somadas) dá o mesmo resumo.
const compacto = compactarMsc(exemplo);
assert.equal(compacto.length, exemplo.length - 2);
assert.deepEqual(resumirMsc(expandirMsc(compacto)), r);
assert.equal(r.receita.bruta, 1560);
assert.equal(r.receita.deducaoFundeb, 200);
assert.equal(r.receita.outrasDeducoes, 10);
assert.equal(r.receita.liquida, 1350);
assert.equal(r.receita.intra, 50);
assert.equal(r.receita.total, 1300);
assert.equal(r.despesa.empenhada, 177);
assert.equal(r.despesa.liquidada, 152);
assert.equal(r.despesa.paga, 139);
assert.equal(r.despesa.camaraPaga, 9);
// Retenção do Fundeb sai do grupo do imposto retido; a restituição, do IPTU.
assert.deepEqual(r.origem, { estado: 800, impostos: 290, fundeb: 150, convenios: 60 });
assert.deepEqual(r.emendas.receita, { 'uniao-individual': 40, 'uniao-especial': 20 });
assert.equal(r.emendas.liquidado, 30);
assert.deepEqual(r.destino.saude.funcoes, { 10: 11 }); // CO 1002 conta como saúde
assert.equal(r.destino.convenios.pago, 30);
assert.equal(r.destino.educacao.liquidado, 2); // .05 (RP não processado) não é liquidado
assert.deepEqual(r.fontesUsadas, ['500', '540', '706', '747']);
assert.deepEqual(r.cosUsados, ['1002', '3110']);

// Origem por prefixo da natureza, com a emenda na frente.
const o = (nr, fonte = '1500', co = null) => origemReceita({ natureza_receita: nr, fonte_recursos: fonte, complemento_fonte: co });
assert.equal(o('11145111'), 'impostos');
assert.equal(o('12400011'), 'impostos'); // COSIP
assert.equal(o('17115111'), 'uniao');
assert.equal(o('24115121', '1631'), 'uniao');
assert.equal(o('17215001'), 'estado');
assert.equal(o('17515001', '1540'), 'fundeb');
assert.equal(o('17179901', '1700'), 'convenios');
assert.equal(o('17245001', '1632'), 'convenios');
assert.equal(o('21125201', '1754'), 'financiamentos');
assert.equal(o('16995011', '1753'), 'outros');
assert.equal(o('79239901'), 'intra');
assert.equal(o('17135011', '1747', '3110'), 'convenios'); // SUS, mas é emenda
assert.equal(o('24299901', '1710', '3210'), 'convenios');
assert.equal(o('17195701', '1706'), 'convenios'); // transferência especial sem CO
assert.equal(tipoEmenda('3130', '747'), 'uniao-comissao');
assert.equal(tipoEmenda('3220', '748'), 'estado-bancada');
assert.equal(tipoEmenda(null, '710'), 'estado-especial');
assert.equal(tipoEmenda('3210', '710', '24299901'), 'estado-especial');
assert.equal(tipoEmenda('3110', '706', '17135011'), 'uniao-individual'); // fonte 706 usada para emenda do SUS
assert.equal(tipoEmenda('3110', '706', '13210101'), 'uniao-especial'); // rendimento da transferência especial
assert.equal(tipoEmenda('3110', '706', '24195101'), 'uniao-especial');
assert.equal(tipoEmenda('3101', '600'), null); // calamidade não é emenda
assert.equal(tipoEmenda(null, '500'), null);

// Destino pela faixa da fonte, com o CO na frente.
assert.equal(destinoFonte('500'), 'livre');
assert.equal(destinoFonte('501'), 'livre');
assert.equal(destinoFonte('500', '1001'), 'educacao');
assert.equal(destinoFonte('500', '1002'), 'saude');
assert.equal(destinoFonte('599', '1001'), 'educacao');
assert.equal(destinoFonte('540', '1070'), 'educacao');
assert.equal(destinoFonte('631'), 'saude');
assert.equal(destinoFonte('665'), 'assistencia');
assert.equal(destinoFonte('700'), 'convenios');
assert.equal(destinoFonte('706'), 'convenios');
assert.equal(destinoFonte('747', '3110'), 'convenios');
assert.equal(destinoFonte('747'), 'outras');
assert.equal(destinoFonte('754'), 'financiamentos');
assert.equal(destinoFonte('753'), 'outras');
// Mesma detecção de emenda da origem: a natureza da transferência especial vale também no destino.
assert.equal(destinoFonte('500', null, '17195701'), 'convenios');
assert.equal(o('17195701', '1500'), 'convenios');

// Último mês: o mês vazio cai para o anterior; nenhum mês com dados = null.
const publicados = { 9: [1, 2], 8: [1] };
const pedidos = [];
const achado = await primeiroComDados([11, 10, 9, 8], async (m) => { pedidos.push(m); return publicados[m] || []; });
assert.deepEqual(achado, { mes: 9, itens: [1, 2] });
assert.deepEqual(pedidos, [11, 10, 9]);
assert.equal(await primeiroComDados([2, 1], async () => []), null);

// Ano corrente: uma consulta por dia (dia de São Paulo).
assert.equal(consultadoHoje('2026-11-17T09:00:00Z', '2026-11-17T20:00:00Z'), true);
assert.equal(consultadoHoje('2026-11-17T02:00:00Z', '2026-11-17T12:00:00Z'), false); // 23h do dia 16 em SP
assert.equal(consultadoHoje(null, '2026-11-17T12:00:00Z'), false);

// Mescla: encerramento vence mensal; mês mais novo vence; empate fica com o novo.
const reg = (tipo, mes, tag) => ({ tipo, mes, tag, linhas: [['621200000', '1500', '', '11125001', '', '10131', 'C', 1]] });
const m = mesclarOrigem({ anos: { 2025: reg('MSCE', 12, 'e'), 2026: reg('MSCC', 9, 'velho') } }, { anos: { 2025: reg('MSCC', 11, 'x'), 2026: reg('MSCC', 9, 'novo'), 2027: reg('MSCC', 1, 'n') } });
assert.equal(m.anos[2025].tag, 'e');
assert.equal(m.anos[2026].tag, 'novo');
assert.equal(m.anos[2027].tag, 'n');
assert.equal(mesclarOrigem({ anos: { 2026: reg('MSCC', 9, 'a') } }, { anos: { 2026: reg('MSCC', 8, 'b') } }).anos[2026].tag, 'a');
assert.deepEqual(mesclarOrigem(null, {}), { anos: {} });

// Conferência com o TCE-SP no mesmo período; aviso acima de 3%.
const meses = { '2026-01': { grupos: { impostos: 60, estado: 30 }, fora: 5 }, '2026-02': { grupos: { impostos: 10 }, fora: 0 } };
const tce = totaisTce(meses, { '2026-01': 50, '2026-02': 50, '2026-03': 70 }, '2026', 2);
assert.deepEqual(tce, { receitaSemIntra: 100, receitaIntra: 5, receita: 105, pago: 100 });
assert.deepEqual(totaisTce(meses, {}, '2026', 3), { receitaSemIntra: null, receitaIntra: null, receita: null, pago: null });
const base = { receita: { liquida: 105 }, despesa: { paga: 102 } };
assert.equal(conferir(base, tce).acimaDoLimite, false); // 2% no pago
assert.equal(conferir({ receita: { liquida: 105 }, despesa: { paga: 104 } }, tce).acimaDoLimite, true); // 4%
assert.equal(conferir(base, { receita: null, pago: null }).acimaDoLimite, false);
const montado = montarOrigem({
  origem: { anos: { 2026: { tipo: 'MSCC', mes: 2, url: 'u', linhas: compacto } } }, // 1.350 arrecadados contra 105 no TCE-SP
  ref: { fontes: [{ codigo: '500', nome: 'Livre' }, { codigo: '540', nome: 'F' }, { codigo: '706', nome: 'T' }, { codigo: '747', nome: 'O' }], complementos: [{ codigo: '1002' }, { codigo: '3110' }] },
  receitasMeses: meses, despesasMensais: { '2026-01': 50, '2026-02': 50 },
});
assert.equal(montado.avisos.length, 1);
assert.match(montado.avisos[0], /mais de 3%/);
assert.equal(montado.manutencao.length, 1);
assert.deepEqual(montado.dados.anos[2026].origem.map((x) => x.grupo), ['estado', 'impostos', 'fundeb', 'convenios']);
assert.equal(montado.dados.anos[2026].livre + montado.dados.anos[2026].carimbado, r.receita.total);

// Livre + carimbado = total, mesmo com um grupo negativo depois das deduções (sem cortar em zero).
const negativo = compactarMsc([rec(100, '11125001', '1500'), rec(10, '17135011', '1600'), ded('621390000', 30, '17135011', '1600')]);
const mn = montarOrigem({ origem: { anos: { 2026: { tipo: 'MSCC', mes: 1, url: 'u', linhas: negativo } } }, ref: null });
assert.equal(mn.dados.anos[2026].livre, 100);
assert.equal(mn.dados.anos[2026].carimbado, -20);
assert.equal(mn.dados.anos[2026].livre + mn.dados.anos[2026].carimbado, mn.dados.anos[2026].receita.total);
for (const a of Object.values(montado.dados.anos)) assert.equal(Math.round((a.livre + a.carimbado) * 100), Math.round(a.receita.total * 100));
// Tabela de fontes ausente: a página sai com "Fonte NNN" e a manutenção pede o nome.
assert.ok(mn.manutencao.some((x) => /código sem nome/.test(x)));
assert.equal(mn.dados.anos[2026].destino.find((x) => x.grupo === 'livre').principais[0].nome, 'Fonte 500');
// Dado estragado nunca derruba o robô.
assert.deepEqual(montarOrigem({ origem: null, ref: null }), { dados: null, avisos: [], manutencao: [] });
const estragado = montarOrigem({ origem: { anos: { 2025: null, 2026: { tipo: 'MSCC', mes: 3, linhas: null }, 2027: { tipo: 'MSCC', mes: 2, linhas: [null, ['x'], ['621200000', '1500', '', '11125001', '', '10131', 'C', 'abc']] } } }, ref: null });
assert.equal(estragado.manutencao.length >= 2, true);
assert.equal(estragado.dados.anos[2027].receita.total, 0);
assert.equal(estragado.dados.anos[2025], undefined);

// Nome de fonte hostil sai escapado na página.
const { paginaOrigem } = await import('../src/site/origem.js');
const hostil = montarOrigem({
  origem: { anos: { 2026: { tipo: 'MSCC', mes: 2, url: 'https://apidatalake.tesouro.gov.br/x', linhas: compacto } } },
  ref: { fontes: [{ codigo: '500', nome: '<script>alert(1)</script>' }] },
});
const html = paginaOrigem({ origem: hostil.dados, emendas: null, meta: { atualizadoEm: '2026-11-17T09:00:00Z' } });
assert.ok(!html.includes('<script>alert(1)'));
assert.ok(html.includes('&lt;script&gt;alert(1)'));

// Áreas: as 6 maiores e "Outras áreas".
assert.deepEqual(maioresAreas({ 10: 5, 12: 4, '04': 3, 17: 2, 28: 1.5, '06': 1, 15: 0.5, 26: 0.25 }).map((x) => x.area), ['Saúde', 'Educação', 'Administração', 'Saneamento', 'Encargos Especiais', 'Segurança Pública', 'Outras áreas']);

// Tabela de fontes: todo código usado nos dados de Salto tem nome oficial.
assert.deepEqual(codigosSemNome({ fontesUsadas: ['500', '123'], cosUsados: ['9999'] }, { fontes: [{ codigo: '500' }], complementos: [] }), ['fonte 123', 'CO 9999']);
const ref = JSON.parse(readFileSync('data/referencia/fontes-recursos.json', 'utf8'));
const salvo = JSON.parse(readFileSync('data/processado/origem.json', 'utf8'));
for (const [ano, a] of Object.entries(salvo.anos)) assert.deepEqual(codigosSemNome(resumirMsc(expandirMsc(a.linhas)), ref), [], `códigos sem nome em ${ano}`);

console.log('check/origem.mjs ok');
