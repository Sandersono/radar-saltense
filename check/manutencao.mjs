import assert from 'node:assert/strict';
import { mudou, montarCorpo } from '../src/manutencao/comum.js';
import { serieIbge, maisRecente, avaliarPopulacao, linhaNova } from '../src/manutencao/populacao.js';
import { vencimento, avaliarDominio } from '../src/manutencao/dominio.js';
import { codigosSemNomeOrigem, bairrosPendentes, idadeListaOficial, avaliarReferencias } from '../src/manutencao/referencias.js';
import { avaliarVirada, semanaDaVirada, linhasVirada } from '../src/manutencao/virada-do-ano.js';

// Comum: a data (1ª linha) e a menção ao dono não contam como mudança.
const agora = '2026-11-18T12:00:00Z';
const a = montarCorpo(agora, ['⚠️ item']);
assert.ok(a.startsWith('Verificação de 18/11/2026.'));
assert.equal(mudou(`${a}\n\n@dono`, montarCorpo('2026-12-18T12:00:00Z', ['⚠️ item'])), false);
assert.equal(mudou(a, montarCorpo(agora, ['⚠️ outro item'])), true);

// População: resposta no formato da API de agregados do IBGE.
const resposta = (serie) => [{ id: '9324', resultados: [{ classificacoes: [], series: [{ localidade: { id: '3545209' }, serie }] }] }];
assert.deepEqual(serieIbge(resposta({ 2025: '141111', 2026: '141994', 2027: '-' })), [{ ano: 2025, valor: 141111 }, { ano: 2026, valor: 141994 }]);
assert.deepEqual(serieIbge({ erro: 'formato novo' }), []);
const est = serieIbge(resposta({ 2026: '141994' }));
assert.deepEqual(maisRecente({ estimativa: est, censo: [{ ano: 2022, valor: 134319 }] }), { ano: 2026, valor: 141994, tipo: 'estimativa' });
assert.equal(maisRecente({ estimativa: [{ ano: 2030, valor: 1 }], censo: [{ ano: 2030, valor: 2 }] }).tipo, 'censo');
const ibge = { ano: 2026, valor: 141994, tipo: 'estimativa' };
const linha = { numero: 31, texto: "export const POPULACAO ={ valor: 141988, fonte: 'RREO' };" };
const dif = avaliarPopulacao({ atual: { valor: 141988, fonte: 'RREO' }, ibge, linha });
assert.equal(dif.precisa, true);
assert.ok(dif.linhas.includes(linhaNova(ibge)) && dif.linhas.includes(linha.texto));
assert.ok(dif.linhas.join('\n').includes('linha 31') && dif.linhas.join('\n').includes('sidra.ibge.gov.br/tabela/6579'));
assert.equal(avaliarPopulacao({ atual: { valor: 141994, fonte: 'IBGE' }, ibge, linha }).precisa, false);
assert.equal(avaliarPopulacao({ atual: { valor: 141994, ano: 2025, fonte: 'IBGE' }, ibge, linha }).precisa, true); // mesmo número, ano novo
assert.throws(() => avaliarPopulacao({ atual: { valor: 1 }, ibge: null, linha }));

// Domínio: RDAP do Registro.br.
const rdap = (data, status = ['active']) => ({ status, events: [{ eventAction: 'registration', eventDate: '2026-11-15T10:09:11Z' }, { eventAction: 'expiration', eventDate: data }] });
assert.equal(vencimento(rdap('2027-11-15T10:09:11Z')), '2027-11-15T10:09:11Z');
assert.equal(vencimento({ events: [] }), null);
assert.equal(avaliarDominio(rdap('2027-11-15T10:09:11Z'), agora).precisa, false);
const perto = avaliarDominio(rdap('2027-01-10T10:00:00Z'), '2026-11-18T12:00:00Z');
assert.equal(perto.precisa, true);
assert.equal(perto.dias, 52);
assert.equal(avaliarDominio({ events: [] }, agora).precisa, true);
assert.equal(avaliarDominio(rdap('2027-11-15T10:09:11Z', ['on hold']), agora).precisa, true);

// Referências: código sem nome na tabela do Tesouro (linha compactada da MSC: 7 campos + valor).
const origem = { anos: { 2026: { linhas: [['621200000', '1500', '', '11125001', '', '10131', 'C', 100], ['621200000', '1999', '9999', '11125001', '', '10131', 'C', 5]] } } };
const fontes = { fontes: [{ codigo: '500' }], complementos: [] };
assert.deepEqual(codigosSemNomeOrigem(origem, fontes), [{ ano: '2026', codigos: ['fonte 999', 'CO 9999'] }]);
assert.deepEqual(codigosSemNomeOrigem({ anos: { 2026: origem.anos[2026] } }, { fontes: [{ codigo: '500' }, { codigo: '999' }], complementos: [{ codigo: '9999' }] }), []);

// Bairro com 10 propostas: sem nome fixo e sem conferência -> 2 avisos; conferido -> nenhum.
const props = Array.from({ length: 10 }, () => ({ locais: [{ tipo: 'bairro', nome: 'Jardim Teste' }] }));
const oficiais = { url: 'https://exemplo.gov.br/pgv.pdf', data: '2013-10-23 (consolidada em 2018-10-04)', bairros: [{ nome: 'Jardim Teste' }] };
const pend = bairrosPendentes(props, { apelidos: {}, nomes: {} }, oficiais);
assert.equal(pend.total, 1);
assert.equal(pend.avisos.length, 2);
assert.deepEqual(bairrosPendentes(props, { nomes: { 'jardim teste': 'Jardim Teste' }, oficial: { 'jardim teste': ['Jardim Teste'] } }, oficiais).avisos, []);
assert.equal(bairrosPendentes(null, {}, oficiais).avisos.length, 1);

// Lista oficial: a data mais nova (no texto de "data" ou o pedido por LAI) vale; lembrete a cada 365 dias.
assert.deepEqual(idadeListaOficial(oficiais, agora).ultima, '2018-10-04');
assert.equal(idadeListaOficial(oficiais, agora).precisa, true);
assert.equal(idadeListaOficial({ ...oficiais, lai_pedido_em: '2026-03-01' }, agora).precisa, false);
assert.equal(idadeListaOficial({}, agora).precisa, true);

// Juntando: tudo certo -> não precisa; placeholder desconhecido no Entenda -> precisa e cita o arquivo.
const entenda = {
  artigos: [{ slug: 'teste', titulo: 'T', descricao: 'D', resumo: 'R {{custoCamaraMes}}', secoes: [{ titulo: 'S', paragrafos: ['P'] }], perguntas: [], fontes: [{ titulo: 'F', url: 'https://exemplo.gov.br' }], relacionados: ['camara.html'] }],
  faq: [],
};
const base = { origem: { anos: {} }, fontes, proposituras: props, apelidos: { nomes: { 'jardim teste': 'Jardim Teste' }, oficial: { 'jardim teste': ['Jardim Teste'] } }, oficiais: { ...oficiais, lai_pedido_em: '2026-03-01' }, entenda, agora };
assert.equal(avaliarReferencias(base).precisa, false);
const ruim = avaliarReferencias({ ...base, entenda: { ...entenda, artigos: [{ ...entenda.artigos[0], resumo: 'R {{custoCamara}}' }] } });
assert.equal(ruim.precisa, true);
assert.ok(ruim.linhas.join('\n').includes('{{custoCamara}}') && ruim.linhas.join('\n').includes('data/referencia/entenda.json'));

// Virada do ano: semana com 1º de janeiro.
assert.equal(semanaDaVirada({ '2026-12-28': { inicio: '2026-12-28' }, '2027-01-04': {} }, 2027).chave, '2026-12-28');
assert.equal(semanaDaVirada({ '2027-01-04': {} }, 2027), null);

// Virada: ano anterior fechado, ano novo ainda sem mês oficial (normal, ✅), emendas do ano novo faltando (⚠️ com npm run emendas).
const doze = (ano) => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`${ano}-${String(i + 1).padStart(2, '0')}`, 1]));
const entrada = {
  ano: 2027,
  dados: { receitas: { anoAnterior: { ano: 2026, fechado: true } }, gastos: { anos: { 2026: { mesesPublicados: 12 } } }, promessas: { resumo: { total: 162 } }, obras: { lista: [{}] } },
  meta: { atualizadoEm: '2027-01-10T06:20:00Z', receitasMensais: doze(2026), despesasMensais: doze(2026) },
  semanas: { '2026-12-28': { inicio: '2026-12-28', fim: '2027-01-03', completa: true } },
  origem: { anos: { 2026: { tipo: 'MSCC', mes: 11 } } },
  emendas: { 2026: {} },
  fontes: { urls: { tabela2027: 'https://exemplo' }, versao: 'Tabela 2027' },
};
const v = avaliarVirada(entrada);
const texto = (r) => r.itens.map((i) => `${i.ok ? 'OK' : 'OLHAR'} ${i.texto}`).join('\n');
assert.match(texto(v), /OK Receitas de 2027 \(TCE-SP\): ainda sem mês oficial/);
assert.match(texto(v), /OK Receitas de 2026: ano fechado/);
assert.match(texto(v), /OLHAR Origem do dinheiro de 2026: ainda com a matriz mensal de novembro\. Pendente e normal/);
assert.match(texto(v), /OLHAR Emendas impositivas de 2027: .*npm run emendas/);
assert.match(texto(v), /OK Resumo da semana de 28\/12\/2026 a 03\/01\/2027/);
assert.match(texto(v), /OK Tabela de fontes do Tesouro de 2027/);
assert.equal(v.lembretes.length, 5);
assert.ok(linhasVirada(2027, v).some((l) => l.startsWith('- [ ] População')));
const v2 = avaliarVirada({ ...entrada, meta: { ...entrada.meta, receitasMensais: { ...doze(2026), '2027-01': 1 } }, origem: { anos: { 2026: { tipo: 'MSCE', mes: 12 } } }, emendas: { 2027: {} }, fontes: { versao: 'Tabela 2026' }, semanas: {} });
assert.match(texto(v2), /OK Receitas de 2027 \(TCE-SP\): já há dados até janeiro/);
assert.match(texto(v2), /OK Origem do dinheiro de 2026: matriz de encerramento/);
assert.match(texto(v2), /OK Emendas impositivas de 2027 já/);
assert.match(texto(v2), /OLHAR Tabela de fontes do Tesouro de 2027/);
assert.match(texto(v2), /OLHAR Resumo da semana da virada/);
assert.equal(avaliarVirada({ ano: 2027 }).itens.filter((i) => !i.ok).length > 0, true); // sem arquivos: não quebra

console.log('manutencao: ok');
