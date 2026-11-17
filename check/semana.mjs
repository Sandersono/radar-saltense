import assert from 'node:assert/strict';
import { janelaSemana, hojeSP, resumoSemana, marcos, textoWhatsApp, acumularNovidades } from '../src/regras/semana.js';

// Novidades guardadas 7 dias, sem repetir o mesmo texto.
const rec = acumularNovidades([{ data: '2026-11-09', texto: 'velha' }, { data: '2026-11-12', texto: 'A' }], ['A', 'B'], '2026-11-16');
assert.deepEqual(rec, [{ data: '2026-11-12', texto: 'A' }, { data: '2026-11-16', texto: 'B' }]);
import { paginaSemana } from '../src/site/semana.js';
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

// Feed: um item por semana, guid pela segunda-feira (SP), igual nos dias da mesma semana; XML escapado.
const U = 'https://radarsaltense.com.br/';
const f1 = feedRss({ ...d, semana: r }, U);
const f2 = feedRss({ ...d, semana: resumoSemana(d, '2026-11-16'), meta: { atualizadoEm: '2026-11-16T10:00:00Z' } }, U);
const guid = (x) => x.match(/<guid[^>]*>([^<]*)<\/guid>/)[1];
const feedDoDia = (dia) => feedRss({ ...d, semana: resumoSemana(d, dia), meta: { atualizadoEm: `${dia}T15:00:00Z` } }, U);
assert.equal(guid(f1), guid(f2));
assert.equal(guid(f1), 'semana-2026-11-16');
assert.equal(guid(feedDoDia('2026-11-18')), 'semana-2026-11-16');
assert.equal(guid(feedDoDia('2026-11-22')), 'semana-2026-11-16');
assert.equal(guid(feedDoDia('2026-11-23')), 'semana-2026-11-23');
assert.match(f1, /<title>Semana de 16\/11<\/title>/);
assert.match(f1, /<pubDate>Mon, 16 Nov 2026 23:00:00 GMT<\/pubDate>/);
assert.match(f1, /<atom:link href="https:\/\/radarsaltense\.com\.br\/feed\.xml" rel="self" type="application\/rss\+xml"\/>/);
// Marco anterior vazio (fonte fora do ar): a volta da fonte não é "mês novo".
const semReceita = { ...marcos(d), receitas: null };
assert.ok(!resumoSemana(d2, '2026-11-16', semReceita).novidades.some((t) => /receitas/i.test(t)));
// Cada bloco da página tem fonte.
assert.match(pc, /portal de proposituras/);
assert.match(pc, /votacoes\.html/);
assert.match(f1, /<link>https:\/\/radarsaltense\.com\.br\/semana\.html<\/link>/);
const fe = feedRss({ ...d, semana: { ...r, novidades: ['A & B <c>'] } }, 'https://radarsaltense.com.br/');
assert.ok(fe.includes('A &amp; B &lt;c&gt;') && !fe.includes('<c>'));
console.log('semana: ok');
