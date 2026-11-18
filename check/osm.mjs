import assert from 'node:assert/strict';
import {
  casarNome, distancia, nucleoNome, montarSalto, jsonCompacto, errosDigitacao, compararOsm, relatorioMarkdown, RELACAO_SALTO, LICENCA,
} from '../src/regras/osm.js';

// Só dados inventados: nenhuma rede, nenhum dado real.

// ---------- nomes
assert.equal(distancia('gabrile', 'gabriel'), 1); // transposição conta 1
assert.equal(distancia('ciudade', 'cidade'), 1);
assert.equal(nucleoNome("Jardim D'Icaraí"), 'icarai');
assert.equal(nucleoNome('Condomínio Fechado Moradas São Luiz'), 'moradas sao luiz');

assert.deepEqual(casarNome('Jardim Monte Pascoal', ['Jardim Monte Paschoal']), { nivel: 'grafia', com: 'Jardim Monte Paschoal' });
assert.deepEqual(casarNome('Bairro Guaraú', ['Guaraú']), { nivel: 'nucleo', com: 'Guaraú' });
assert.deepEqual(casarNome('Jd. Planalto', ['Jardim Planalto']), { nivel: 'exato', com: 'Jardim Planalto' });
// "Condomínio" na frente não muda o lugar; "Jardim" e "Parque" mudam.
assert.deepEqual(casarNome('Condomínio Parque Imperial', ['Jardim Imperial', 'Parque Imperial']), { nivel: 'exato', com: 'Parque Imperial' });
assert.equal(casarNome('Jardim Imperial', ['Residencial Parque Imperial']).nivel, 'contido'); // só pista fraca
assert.equal(casarNome('Jardim Iracema', ['Chácaras Iracema']).nivel, 'contido');
// Fase "I" é o próprio loteamento; "II" é outro.
assert.deepEqual(casarNome('Jardim Celani I', ['Jardim Celani II', 'Jardim Celani']), { nivel: 'nucleo', com: 'Jardim Celani' });
assert.equal(casarNome('Bairro Boa Vista', ['Parque Bela Vista']), null);
assert.equal(casarNome('Jardim Santa Marta II', ['Jardim Santa Marta III']).nivel, 'numeral');

// ---------- montagem (quadrado do município partido em dois trechos, para testar a junção do contorno)
const p = (lat, lon) => ({ lat, lon });
const quadrado = (la1, lo1, la2, lo2) => [p(la1, lo1), p(la1, lo2), p(la2, lo2), p(la2, lo1), p(la1, lo1)];
const limite = {
  type: 'relation', id: RELACAO_SALTO, tags: { boundary: 'administrative', admin_level: '8', name: 'Salto' },
  members: [
    { type: 'way', role: 'outer', geometry: [p(-23.2, -47.4), p(-23.2, -47.3), p(-23.1, -47.3)] },
    { type: 'way', role: 'outer', geometry: [p(-23.2, -47.4), p(-23.1, -47.4), p(-23.1, -47.3)] },
  ],
};
const lugares = [
  { type: 'way', id: 1, tags: { boundary: 'administrative', admin_level: '10', name: 'Jardim Testemunha' }, geometry: quadrado(-23.18, -47.38, -23.16, -47.36) },
  { type: 'node', id: 2, lat: -23.17, lon: -47.37, tags: { place: 'quarter', name: 'Jardim Testemunha' } },
  { type: 'node', id: 3, lat: -23.12, lon: -47.32, tags: { place: 'quarter', name: 'Vila Pontual' } },
  { type: 'way', id: 4, tags: { landuse: 'residential', residential: 'apartments', name: 'Residencial Prédio' }, geometry: quadrado(-23.175, -47.375, -23.165, -47.365) },
  { type: 'way', id: 5, tags: { boundary: 'administrative', admin_level: '10', name: 'Contorno Aberto' }, geometry: [p(-23.15, -47.35), p(-23.14, -47.35), p(-23.14, -47.34)] },
  { type: 'way', id: 6, tags: { boundary: 'administrative', admin_level: '10', name: 'Jardim Fora' }, geometry: quadrado(-23.05, -47.25, -23.04, -47.24) },
  { type: 'relation', id: 7, tags: { boundary: 'administrative', admin_level: '9', name: 'Salto' }, members: [] },
  { type: 'node', id: 8, lat: -23.15, lon: -47.33, tags: { place: 'quarter' } },
];
const ruas = [
  limite,
  { type: 'way', id: 10, tags: { highway: 'residential', name: 'Rua A' }, geometry: [p(-23.17, -47.375), p(-23.17, -47.365)] },
  { type: 'way', id: 11, tags: { highway: 'residential', name: 'Rua B' }, geometry: [p(-23.121, -47.321), p(-23.122, -47.322)] },
  { type: 'way', id: 12, tags: { highway: 'residential', name: 'Rua C' }, geometry: [p(-23.05, -47.25), p(-23.04, -47.24)] },
];
const enderecos = [{ type: 'node', id: 20, tags: { 'addr:suburb': 'Centro' } }, { type: 'node', id: 21, tags: { 'addr:suburb': 'Centro' } }];

assert.throws(() => montarSalto({ lugares, limiteRuas: ruas.slice(1) }), /limite do município/);
const salto = montarSalto({ lugares, limiteRuas: ruas, enderecos, extraidoEm: '2026-01-01T00:00:00Z' });
assert.equal(salto.licenca, LICENCA);
assert.deepEqual(salto.bairros.map((b) => [b.nome, b.geom]), [
  ['Contorno Aberto', 'linha'], ['Jardim Testemunha', 'poligono'], ['Residencial Prédio', 'poligono'], ['Vila Pontual', 'ponto'],
]);
const teste = salto.bairros.find((b) => b.nome === 'Jardim Testemunha');
assert.deepEqual(teste.osm, ['n2', 'w1']); // ponto e polígono do mesmo lugar viram um registro
assert.deepEqual(teste.centro, [-23.17, -47.37]);
assert.deepEqual(salto.problemas.fora_do_limite.map((f) => [f.nome, f.vertices_dentro]), [['Jardim Fora', '0/5']]);
assert.deepEqual(salto.problemas.sem_nome, ['n8']);
assert.deepEqual(salto.problemas.contorno_aberto, ['w5 Contorno Aberto']);
assert.deepEqual(salto.addr_suburb, { Centro: 2 });
// Rua dentro do prédio conta o bairro, não o prédio; rua sem polígono só ganha "perto"; rua fora do município sai.
assert.deepEqual(salto.ruas, [
  { nome: 'Rua A', p: [-23.17, -47.37], bairros: ['Jardim Testemunha'] },
  { nome: 'Rua B', p: [-23.1215, -47.3215], perto: 'Vila Pontual' },
]);
assert.equal(salto.resumo.trechos, 2);
assert.equal(salto.resumo.ruas_com_bairro, 1);
assert.deepEqual(JSON.parse(jsonCompacto(salto)), salto);

// ---------- erros de digitação no OSM
assert.deepEqual(
  errosDigitacao(['Jardim da Ciudade II', 'Vile Martins II', 'Residencial Cata-Vento', 'Distrito Indústrial'], ['Jardim da Cidade II', 'Vila Nova', 'Vila Flora', 'Vila Ideal', 'Bairro da Mata', 'Distrito Industrial']).map((e) => [e.palavra, e.sugestao, e.so_acento]),
  [['Ciudade', 'Cidade', false], ['Vile', 'Vila', false], ['Indústrial', 'Industrial', true]],
);

// ---------- comparação e relatório
const apelidos = {
  nomes: { 'jardim testemunho': 'Jardim Testemunho', 'vila nova': 'Vila Nova', centro: 'Centro' },
  oficial: { 'jardim testemunho': ['Jardim Testemunha'], 'vila nova': [], centro: ['Centro'] },
  oficial_ligados: {},
};
const oficiais = { url: 'https://exemplo.gov.br/pgv.pdf', bairros: [{ nome: 'Jardim Testemunha' }, { nome: 'Centro' }], loteamentos_posteriores: { itens: [] } };
const cmp = compararOsm({ salto, apelidos, oficiais });
assert.deepEqual(cmp.divergencias.map((d) => [d.pagina, d.osm]), [['Jardim Testemunho', 'Jardim Testemunha']]);
assert.deepEqual(cmp.soNoOsm.map((s) => s.nome), ['Contorno Aberto', 'Vila Pontual']);
assert.deepEqual(cmp.predios, ['Residencial Prédio']);
assert.deepEqual(cmp.semOsm.map((s) => [s.pagina, s.enderecos]), [['Vila Nova', null], ['Centro', 'Centro (2)']]);
const md = relatorioMarkdown(cmp, { extraidoEm: 'x', geradoEm: 'y', resumo: salto.resumo });
for (const t of ['## 1. Grafias divergentes', '## 3. Loteamentos só no OSM', '## 4. Páginas do site sem nada no OSM', '## 5. Correções', 'ODbL']) assert.ok(md.includes(t), t);

console.log('osm: ok');
