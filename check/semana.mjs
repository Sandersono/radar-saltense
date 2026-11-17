import assert from 'node:assert/strict';
import { janelaSemana, hojeSP, resumoSemana, marcos, textoWhatsApp, acumularNovidades, resumoSemanaCalendario, atualizarSemanas, serializarSemanas, INICIO_ARQUIVO } from '../src/regras/semana.js';
import { layout } from '../src/site/base.js';

// Novidades guardadas 7 dias, sem repetir o mesmo texto.
const rec = acumularNovidades([{ data: '2026-11-09', texto: 'velha' }, { data: '2026-11-12', texto: 'A' }], ['A', 'B'], '2026-11-16');
assert.deepEqual(rec, [{ data: '2026-11-12', texto: 'A' }, { data: '2026-11-16', texto: 'B' }]);
import { paginaSemana, paginaSemanaArquivo, periodoExtenso, periodoCurto, descricaoSemana } from '../src/site/semana.js';
import { feedRss } from '../src/site/feed.js';

// Janela: 7 dias terminando hoje; instante de 01:30 UTC ainda é o dia anterior em São Paulo.
assert.deepEqual(janelaSemana('2026-11-16'), { inicio: '2026-11-10', fim: '2026-11-16' });
assert.deepEqual(janelaSemana('2026-03-03'), { inicio: '2026-02-25', fim: '2026-03-03' });
assert.equal(hojeSP('2026-11-17T01:30:00Z'), '2026-11-16');

const loc = (nome) => ({ tipo: 'bairro', nome, chave: nome.toLowerCase() });
const d = {
  vereadores: [{ id: 'a', nome: 'Ana' }, { id: 'b', nome: 'Bia' }],
  proposituras: [
    { data: '2026-11-10', vereadores: ['a'], grupo: 'melhoria', locais: [loc('Centro'), loc('Jardim')] },
    { data: '2026-11-16', vereadores: ['a', 'b'], grupo: 'melhoria', locais: [loc('Centro')] },
    { data: '2026-11-09', vereadores: ['b'], grupo: 'melhoria', locais: [loc('Fora')] },
    { data: '2026-11-17', vereadores: ['b'], grupo: 'melhoria', locais: [loc('Depois')] },
  ],
  votacoes: [
    { rotulo: 'PL 1/2026', eventos: [{ data: '2026-11-12', resultado: 'Aprovado por maioria', contra: ['b'] }, { data: '2026-10-01', resultado: 'x', contra: [] }] },
  ],
  camara: { respostas: { recentes: [{ data: '2026-11-11', vereadores: ['a'] }, { data: '2026-11-01', vereadores: ['b'] }] }, folha: { ultimoMes: '2026-10' } },
  receitas: { ultimoMesOficial: '2026-09' },
  gastos: { anos: { 2026: { ultimoMes: '2026-09' } } },
  prefeitura: { obras: { obras: [{ cnpj: '1', ano: 2024, objeto: 'Ponte & <cais>', situacao: 'Paralisada' }] }, iegm: { anos: { 2023: {} } } },
  meta: { atualizadoEm: '2026-11-16T23:00:00Z' },
};
const r = resumoSemana(d, '2026-11-16');
assert.equal(r.proposituras.total, 2);
assert.deepEqual(r.proposituras.porVereador.map((x) => [x.nome, x.total]), [['Ana', 2], ['Bia', 1]]);
assert.deepEqual(r.proposituras.bairros, [{ nome: 'Centro', total: 2 }, { nome: 'Jardim', total: 1 }]);
assert.deepEqual(r.votacoes, [{ rotulo: 'PL 1/2026', data: '2026-11-12', resultado: 'Aprovado por maioria', contra: ['Bia'] }]);
assert.equal(r.respondidos.total, 1);
assert.deepEqual(r.novidades, []); // sem anterior, nada a comparar

// Novidades: compara com os marcos da execução anterior.
const ant = marcos(d);
const d2 = structuredClone(d);
d2.receitas.ultimoMesOficial = '2026-10';
d2.camara.folha.ultimoMes = '2026-11';
d2.prefeitura.obras.obras[0].situacao = 'Em andamento';
const n = resumoSemana(d2, '2026-11-16', ant).novidades;
assert.equal(n.length, 3);
assert.ok(n.some((t) => /receitas/i.test(t)) && n.some((t) => /folha/i.test(t)) && n.some((t) => /obra/i.test(t)));
assert.deepEqual(resumoSemana(d, '2026-11-16', ant).novidades, []);

// Seção vazia não aparece; semana sem nada diz isso.
const vazio = { ...d, proposituras: [], votacoes: [], camara: { respostas: { recentes: [] }, folha: d.camara.folha } };
const pv = paginaSemana({ ...vazio, semana: resumoSemana(vazio, '2026-11-16') });
assert.ok(!/Propostas novas/.test(pv) && !/Votações da semana/.test(pv) && !/Dados oficiais novos/.test(pv));
assert.match(pv, /Nada de novo/);
const pc = paginaSemana({ ...d, semana: r });
assert.match(pc, /Propostas novas/);
assert.match(pc, /Votações da semana/);
assert.match(pc, /wa\.me\/\?text=/);
assert.ok(!/Dados oficiais novos/.test(pc));

// WhatsApp: no máximo 4 linhas e o link.
const url = 'https://radarsaltense.com.br/semana.html';
const t = textoWhatsApp(resumoSemana(d2, '2026-11-16', ant), url);
assert.ok(t.split('\n').length <= 5);
assert.ok(t.endsWith(url));
assert.ok(textoWhatsApp(resumoSemana(vazio, '2026-11-16'), url).split('\n').length <= 5);

// Semana de calendário: segunda a domingo; a corrente é cortada em hoje; "completa" quando o domingo já passou.
const dr = { ...d, proposituras: [...d.proposituras, { data: '2026-10-01', vereadores: ['b'], grupo: 'lei', locais: [], respondidoEm: '2026-11-13' }] };
const passada = resumoSemanaCalendario(dr, '2026-11-09', '2026-11-16', [{ data: '2026-11-12', texto: 'A' }, { data: '2026-11-16', texto: 'B' }]);
assert.deepEqual([passada.inicio, passada.fim, passada.domingo, passada.completa], ['2026-11-09', '2026-11-15', '2026-11-15', true]);
assert.equal(passada.proposituras.total, 2); // 09/11 e 10/11
assert.equal(passada.votacoes.length, 1);
assert.deepEqual(passada.respondidos.porVereador.map((x) => [x.nome, x.total]), [['Bia', 1]]); // pela data da resposta
assert.deepEqual(passada.novidades, ['A']);
const corrente = resumoSemanaCalendario(dr, '2026-11-16', '2026-11-16');
assert.deepEqual([corrente.inicio, corrente.fim, corrente.completa, corrente.proposituras.total], ['2026-11-16', '2026-11-16', false, 1]);
assert.equal(resumoSemanaCalendario(dr, '2026-11-16', '2026-11-22').completa, false); // domingo ainda não acabou
assert.equal(resumoSemanaCalendario(dr, '2026-11-16', '2026-11-23').completa, true);
assert.equal(resumoSemanaCalendario(dr, '2026-11-16', '2026-11-23').proposituras.total, 2);

// Histórico: começa em 2024-12-30; semana completa salva não é reescrita; semana incompleta é refeita sem perder novidades.
const hist = atualizarSemanas({}, dr, '2025-01-15');
assert.deepEqual(Object.keys(hist), [INICIO_ARQUIVO, '2025-01-06', '2025-01-13']);
assert.equal(INICIO_ARQUIVO, '2024-12-30');
assert.deepEqual(Object.values(hist).map((x) => x.completa), [true, true, false]);
const salva = { completa: true, marcador: 'antiga' };
const hist2 = atualizarSemanas({ '2024-12-30': salva, '2025-01-13': { completa: false, novidades: ['velha'] } }, dr, '2025-01-20', [{ data: '2025-01-20', texto: 'nova' }]);
assert.equal(hist2['2024-12-30'], salva);
assert.deepEqual(hist2['2025-01-13'].novidades, ['velha']);
assert.equal(hist2['2025-01-13'].completa, true);
assert.deepEqual(hist2['2025-01-20'].novidades, ['nova']);
assert.deepEqual(Object.keys(hist2), ['2024-12-30', '2025-01-06', '2025-01-13', '2025-01-20']);
assert.deepEqual(JSON.parse(serializarSemanas(hist2)), hist2);

// layout: canonical da raiz e de uma página interna; JSON-LD com "</" escapado.
const lay = (caminho, jsonld) => layout({ titulo: 't', corpo: '', atualizadoEm: '2026-11-16T12:00:00Z', caminho, jsonld });
assert.match(lay('index.html'), /<link rel="canonical" href="https:\/\/radarsaltense\.com\.br\/">/);
assert.match(lay('vereador/x.html'), /<link rel="canonical" href="https:\/\/radarsaltense\.com\.br\/vereador\/x\.html">/);
assert.match(lay('vereador/x.html'), /<meta property="og:url" content="https:\/\/radarsaltense\.com\.br\/vereador\/x\.html">/);
const ld = lay('index.html', { name: 'a</script><b>' });
assert.ok(ld.includes('a<\\/script><b>') && !ld.includes('a</script>'));

// Feed: as 8 semanas mais recentes, link e guid = endereço fixo da página da semana, iguais nos dias da mesma semana.
const U = 'https://radarsaltense.com.br/';
const guids = (x) => [...x.matchAll(/<guid isPermaLink="true">([^<]*)<\/guid>/g)].map((m) => m[1]);
const feedDoDia = (dia) => feedRss({ ...d, meta: { atualizadoEm: `${dia}T15:00:00Z` } }, U, atualizarSemanas({}, d, dia));
const f1 = feedDoDia('2026-11-16');
assert.equal(guids(f1).length, 8);
assert.equal(new Set(guids(f1)).size, 8);
assert.equal(guids(f1)[0], `${U}semana/2026-11-16.html`);
assert.equal(guids(f1)[1], `${U}semana/2026-11-09.html`);
assert.deepEqual(guids(feedDoDia('2026-11-18')), guids(f1));
assert.deepEqual(guids(feedDoDia('2026-11-22')), guids(f1));
assert.equal(guids(feedDoDia('2026-11-23'))[0], `${U}semana/2026-11-23.html`);
assert.match(f1, /<link>https:\/\/radarsaltense\.com\.br\/semana\/2026-11-16\.html<\/link>/);
assert.match(f1, /<title>Semana de 16\/11 a 22\/11\/2026<\/title>/);
assert.match(f1, /<pubDate>Mon, 16 Nov 2026 15:00:00 GMT<\/pubDate>/); // em andamento: atualizadoEm
assert.match(f1, /<pubDate>Sun, 15 Nov 2026 15:00:00 GMT<\/pubDate>/); // completa: domingo, 12:00 em São Paulo
assert.match(f1, /<atom:link href="https:\/\/radarsaltense\.com\.br\/feed\.xml" rel="self" type="application\/rss\+xml"\/>/);
// Marco anterior vazio (fonte fora do ar): a volta da fonte não é "mês novo".
const semReceita = { ...marcos(d), receitas: null };
assert.ok(!resumoSemana(d2, '2026-11-16', semReceita).novidades.some((t) => /receitas/i.test(t)));
// Cada bloco da página tem fonte.
assert.match(pc, /portal de proposituras/);
assert.match(pc, /votacoes\.html/);
const fe = feedRss(d, U, { '2026-11-16': { ...corrente, novidades: ['A & B <c>'] } });
assert.ok(fe.includes('A &amp; B &lt;c&gt;') && !fe.includes('<c>'));

// Página da semana: links de vereador com ../, navegação, aviso de semana em andamento, JSON-LD Article.
const pa = paginaSemanaArquivo(corrente, d, { anterior: '2026-11-09' });
assert.match(pa, /href="\.\.\/vereador\/a\.html"/);
assert.match(pa, /href="2026-11-09\.html" rel="prev"/);
assert.ok(!/rel="next"/.test(pa));
assert.match(pa, /Semana em andamento/);
assert.match(pa, /<h1>Semana de 16 a 22 de novembro de 2026 em Salto<\/h1>/);
assert.match(pa, /<title>Semana de 16\/11 a 22\/11\/2026 em Salto: Radar Saltense<\/title>/);
assert.match(pa, /"@type":"Article"/);
assert.match(pa, /semana%2F2026-11-16\.html/); // WhatsApp com o link fixo
assert.ok(!/Semana em andamento/.test(paginaSemanaArquivo(passada, d)));
assert.match(paginaSemanaArquivo(resumoSemanaCalendario(vazio, '2026-11-09', '2026-11-16'), vazio), /Nada de novo nos dados oficiais desta semana/);
assert.equal(periodoExtenso('2024-12-30', '2025-01-05'), '30 de dezembro de 2024 a 5 de janeiro de 2025');
assert.equal(periodoExtenso('2025-10-27', '2025-11-02'), '27 de outubro a 2 de novembro de 2025');
assert.equal(periodoCurto('2024-12-30', '2025-01-05'), '30/12/2024 a 05/01/2025');
assert.equal(descricaoSemana(passada), 'Em Salto, de 09/11 a 15/11/2026: 2 propostas novas na Câmara, 1 votação, 1 requerimento respondido.');
// semana.html: link para a semana corrente e as anteriores por ano.
const ps = paginaSemana({ ...d, semana: r }, U, atualizarSemanas({}, d, '2026-11-16'));
assert.match(ps, /href="semana\/2026-11-16\.html"/);
assert.match(ps, /id="semanas-anteriores"/);
assert.match(ps, /<details open><summary>2026/);
assert.match(ps, /<li><a href="semana\/2026-11-09\.html">09\/11 a 15\/11<\/a>: 2 propostas, 1 votação<\/li>/);
console.log('semana: ok');
