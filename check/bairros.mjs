import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chaveBairro, montarBairros, bairrosComPagina, validarApelidos, validarNomes, obraCitaBairro, nomeBomParaObra, nomesMaiores, nomesParaObra,
  atribuirSlugs, limparRua, resumoBairro, CORTE_BAIRRO,
} from '../src/regras/bairros.js';
import { tituloVereador, descricaoVereador, pessoaJsonLd } from '../src/site/vereador.js';
import { descricaoBairro, lugarJsonLd, htmlOficial, marcaOficial } from '../src/site/bairros.js';
import { indiceOficial, situacoesOficiais, avisosOficiais, chaveOficial, juntarNomes, TEXTO_SEM_OFICIAL, ROTULO_PGV } from '../src/regras/bairros-oficiais.js';

// Sobras na rua lida do texto.
assert.equal(limparRua('Rua Japão e o'), 'Rua Japão');
assert.equal(limparRua('Rua Japão ao'), 'Rua Japão');
assert.equal(limparRua('Rua Botucatu com a Rua Campinas'), 'Rua Botucatu');
assert.equal(limparRua('Rua 7 de Setembro'), 'Rua 7 de Setembro');
assert.equal(limparRua('Rua Santa Maria Goretti'), 'Rua Santa Maria Goretti');
assert.equal(limparRua('Rua 5 A'), 'Rua 5 A'); // letra final do nome fica
assert.equal(limparRua('Rua 5 a'), 'Rua 5 a');
assert.equal(limparRua('Rua 5A'), 'Rua 5A');
assert.equal(limparRua('Praça XV e'), 'Praça XV');
assert.equal(limparRua('Praça do'), ''); // só o tipo: some
assert.equal(limparRua('Rua do'), '');
assert.equal(limparRua('Avenida entre o'), '');
assert.equal(limparRua('Rua que liga os Bairros'), '');
assert.equal(limparRua('Rua Japão que interliga o'), 'Rua Japão');
assert.equal(limparRua('Avenida das Nações Unidas e as casas do'), 'Avenida das Nações Unidas');
assert.equal(limparRua('Rua Quintino Bocaiuva e os fundos do Carrefour'), 'Rua Quintino Bocaiuva');
assert.equal(limparRua('Rua Palma de Ouro para que realize a limpeza do local'), 'Rua Palma de Ouro');
assert.equal(limparRua('Rua das Madressilvas e demais ruas do'), 'Rua das Madressilvas');

// chaveBairro: sufixo de cidade, "Jd."/"Vl.", acentos; números romanos continuam.
assert.equal(chaveBairro('Vila Teixeira - Salto/SP'), 'vila teixeira');
assert.equal(chaveBairro('Vila Teixeira, Salto - SP'), 'vila teixeira');
assert.equal(chaveBairro('Vila Teixeira (Salto/SP)'), 'vila teixeira');
assert.equal(chaveBairro('Jd. Planalto'), 'jardim planalto');
assert.equal(chaveBairro('Jd Planalto'), 'jardim planalto');
assert.equal(chaveBairro('Vl. Norma'), 'vila norma');
assert.equal(chaveBairro('Jardim  São   João'), 'jardim sao joao');
assert.equal(chaveBairro('Salto de São José'), 'salto de sao jose'); // "Salto" no começo do nome não é sufixo
assert.equal(chaveBairro('Salto Ville'), 'salto ville');
assert.notEqual(chaveBairro('Jardim Celani'), chaveBairro('Jardim Celani II'));

// Montagem: cada proposta conta uma vez por bairro; apelido junta só o que foi listado.
const prop = (...bairros) => ({ locais: bairros.map((nome) => ({ tipo: 'bairro', nome })) });
const props = [
  ...Array.from({ length: 9 }, () => prop('Jardim Celani')),
  prop('Celani', 'Jardim Celani II'),
  prop('Jardim Celani II', 'Jd. Celani II'),
  ...Array.from({ length: 9 }, () => prop('Vila Nova')),
];
const lista = montarBairros(props, { celani: 'Jardim Celani' });
const de = (nome) => lista.find((b) => b.nome === nome);
assert.equal(de('Jardim Celani').total, 10);
assert.deepEqual(de('Jardim Celani').grafias, ['Jardim Celani', 'Celani']);
assert.equal(de('Jardim Celani II').total, 2); // "Jd. Celani II" na mesma proposta conta uma vez
assert.equal(de('Vila Nova').total, 9);

// Corte de 10.
assert.equal(CORTE_BAIRRO, 10);
assert.deepEqual(bairrosComPagina(lista).map((b) => b.nome), ['Jardim Celani']);

// Slug estável, sem colisão, independente da ordem.
assert.equal(de('Jardim Celani').slug, 'jardim-celani');
assert.equal(de('Jardim Celani II').slug, 'jardim-celani-ii');
const s1 = atribuirSlugs([{ nome: 'Jardim D’Icaraí', chave: 'jardim d’icarai' }, { nome: 'Jardim D Icaraí', chave: 'jardim d icarai' }]);
const s2 = atribuirSlugs([{ nome: 'Jardim D Icaraí', chave: 'jardim d icarai' }, { nome: 'Jardim D’Icaraí', chave: 'jardim d’icarai' }]);
assert.deepEqual(s1.map((b) => b.slug).sort(), ['jardim-d-icarai', 'jardim-d-icarai-2']);
assert.equal(s1.find((b) => b.chave === 'jardim d’icarai').slug, s2.find((b) => b.chave === 'jardim d’icarai').slug);

// Obras: fronteira de palavra, genéricos e nomes curtos não casam, "X" não casa em "X II".
assert.equal(obraCitaBairro('Pavimentação de ruas no Jardim das Nações', 'Jardim das Nações'), true);
assert.equal(obraCitaBairro('PAVIMENTACAO NO JARDIM DAS NACOES, SALTO', 'Jardim das Nações'), true);
assert.equal(obraCitaBairro('Drenagem no Jardim das Nações II', 'Jardim das Nações'), false);
assert.equal(obraCitaBairro('Drenagem no Jardim das Nações II', 'Jardim das Nações II'), true);
assert.equal(obraCitaBairro('Escola no Jardim Celanização', 'Jardim Celani'), false);
assert.equal(obraCitaBairro('Reforma do centro cirúrgico', 'Centro'), false);
assert.equal(obraCitaBairro('Estação elevatória de esgoto', 'Estação'), false);
assert.equal(obraCitaBairro('Praça no Rondon', 'Rondon'), false);
// Trecho que é nome de OUTRO bairro maior não conta para o menor.
const escola = 'Escola no Jardim Barnabé, bairro Residencial Barnabé';
assert.equal(obraCitaBairro(escola, 'Barnabé'), true);
assert.equal(obraCitaBairro(escola, 'Barnabé', nomesMaiores({ nome: 'Barnabé', chave: 'barnabe' }, montarBairros([prop('Barnabé'), prop('Residencial Barnabé'), prop('Jardim Barnabé')]))), false);
assert.equal(obraCitaBairro('Implantação da ETA Barnabé', 'Barnabé', ['residencial barnabe', 'jardim barnabe']), true);
assert.equal(nomeBomParaObra('Vila Nova'), false);
assert.equal(nomeBomParaObra('Barnabé'), true);
assert.equal(nomeBomParaObra('CECAP'), false);
// Outras grafias valem na obra só se já começam por Jardim, Vila, Parque etc.
assert.deepEqual(nomesParaObra({ nome: 'Jardim Santa Cruz', grafias: ['Jardim Santa Cruz', 'Santa Cruz'] }), ['Jardim Santa Cruz']);
assert.deepEqual(nomesParaObra({ nome: 'Parque Laguna', grafias: ['Parque Laguna', 'Laguna', 'Residencial Parque Laguna'] }), ['Parque Laguna', 'Residencial Parque Laguna']);

// Nome fixo: vence a grafia mais comum e corrige nome cortado; chave inexistente é erro.
const fixos = montarBairros([prop('São Pedro'), prop('São Pedro'), prop('Jardim São Pedro')], { 'sao pedro': 'Jardim São Pedro' }, { 'jardim sao pedro': 'Jardim São Pedro e São Paulo' });
assert.equal(fixos[0].nome, 'Jardim São Pedro e São Paulo');
assert.equal(fixos[0].slug, 'jardim-sao-pedro-e-sao-paulo');
assert.equal(fixos[0].fixo, true);
assert.ok(validarNomes({ 'jardim x': 'Jardim X' }, fixos).length > 0);

// Repetido só de rua citada com o bairro em 2 propostas ou mais (a grafia com sobra conta como a mesma rua).
const ruaProp = (i, ...ruas) => ({ id: String(i), data: `2026-01-0${i}`, grupo: 'melhoria', vereadores: [], tipos: [], ementa: '',
  locais: [{ tipo: 'bairro', nome: 'Jardim Y' }, ...ruas.map((nome) => ({ tipo: 'rua', nome }))] });
const dRep = { proposituras: [ruaProp(1, 'Rua A Um', 'Rua B Dois'), ruaProp(2, 'Rua A Um e o')], obras: { lista: [] },
  repetidos: [{ rua: 'Rua A Um', tipo: 'buraco', pedidos: [] }, { rua: 'Rua B Dois', tipo: 'buraco', pedidos: [] }] };
assert.deepEqual(resumoBairro(montarBairros(dRep.proposituras)[0], dRep).repetidos.map((r) => r.rua), ['Rua A Um']);

// Apelidos: todo destino existe nos nomes vistos (lista real contra os dados reais).
assert.ok(validarApelidos({ 'santa cruz': 'Jardim Santa Kruz' }, ['Santa Cruz']).length > 0);
assert.ok(validarApelidos({ 'Santa Cruz': 'Jardim Santa Cruz' }, ['Jardim Santa Cruz']).length > 0);
const { apelidos, nomes } = JSON.parse(readFileSync('data/referencia/bairros-apelidos.json', 'utf8'));
const dados = JSON.parse(readFileSync('data/processado/dados.json', 'utf8'));
const vistos = dados.proposituras.flatMap((p) => (p.locais || []).filter((l) => l.tipo === 'bairro').map((l) => l.nome));
// Dados reais mudam todo dia: aqui é aviso, não assert (o checar roda antes do robô e não pode travá-lo).
const errosApelidos = validarApelidos(apelidos, vistos);
if (errosApelidos.length) console.warn(`Aviso: apelidos de bairro: ${errosApelidos.join('; ')}`);
// Nunca juntar "X II" com "X" (nem "X 2" com "X"): apelido e destino têm o mesmo número no fim (romano de i a x, ou arábico), ou nenhum.
const numeroFinal = (s) => (chaveBairro(s).match(/ (i{1,3}|iv|vi{0,3}|ix|x|\d+)$/) || [''])[0];
assert.equal(numeroFinal('Jardim Y VI'), ' vi');
assert.equal(numeroFinal('Jardim Y 2'), ' 2');
assert.equal(numeroFinal('Jardim Y'), '');
for (const [k, n] of Object.entries(apelidos)) assert.equal(numeroFinal(k), numeroFinal(n), `${k} → ${n}`);
// Todo bairro com página tem nome fixo (o endereço não muda quando a grafia mais comum muda).
const todos = montarBairros(dados.proposituras, apelidos, nomes);
const errosNomes = validarNomes(nomes, todos);
if (errosNomes.length) console.warn(`Aviso: nomes fixos de bairro: ${errosNomes.join('; ')}`);
// Bairro novo que passa do corte com os dados reais não pode travar o robô (o checar roda antes dele):
// vira aviso aqui e aviso de manutenção no gerador (a sentinela leva ao e-mail). Os testes acima seguem como assert.
const semNome = bairrosComPagina(todos).filter((b) => !b.fixo).map((b) => b.chave);
if (semNome.length) console.warn(`Aviso: bairro com página e sem nome fixo em bairros-apelidos.json: ${semNome.join(', ')}`);

// Nome oficial (cadastro da Prefeitura): só fixtures aqui; com os dados reais, só aviso (o checar não pode travar o robô).
const refOf = { url: 'https://x/pgv.pdf', bairros: [{ nome: 'Jardim Monte Paschoal' }, { nome: 'Jardim Celani' }, { nome: 'Loteamento São Pedro/São Paulo' }, { nome: 'Jardim Santa Cruz I' }, { nome: 'Bairro Santa Cruz' }],
  loteamentos_posteriores: { itens: [{ nome: 'Jardim dos Ipês', ato: 'Decreto nº 263/2019', url: 'https://x/263.pdf' }, { nome: 'Sem Link', ato: 'Decreto 1' }] } };
const { indice: idxOf, erros: errosOf } = indiceOficial(refOf);
assert.equal(idxOf.size, 6);
assert.deepEqual(errosOf, ['"Sem Link": ato sem nome ou sem link.']);
assert.deepEqual(indiceOficial(null).indice.size, 0);
assert.ok(indiceOficial({ bairros: 'x' }).erros.length > 0);
assert.ok(indiceOficial({ url: 'u', bairros: [{ nome: 'A' }, { nome: 'A' }] }).erros.some((e) => e.includes('duas vezes')));
assert.equal(chaveOficial('Jardim Arco-Íris'), chaveOficial('JD. ARCO IRIS'));
const conf = { oficial: { 'jardim celani': ['Jardim Celani'], 'jardim monte pascoal': ['Jardim Monte Paschoal'], 'smart city': [], 'jardim dos ipes': ['Jardim dos Ipês'],
  'jardim sao pedro': ['Loteamento São Pedro/São Paulo'], 'terras de sao pedro': ['Loteamento São Pedro/São Paulo'], 'jardim x': ['Inexistente'] },
  oficial_ligados: { 'jardim santa cruz': ['Jardim Santa Cruz I', 'Bairro Santa Cruz'] } };
const bx = (chave, nome) => ({ chave, nome, slug: chave.replace(/ /g, '-') });
const pags = [bx('jardim celani', 'Jardim Celani'), bx('jardim monte pascoal', 'Jardim Monte Pascoal'), bx('smart city', 'Smart City'), bx('jardim dos ipes', 'Jardim dos Ipês'),
  bx('jardim sao pedro', 'Jardim São Pedro e São Paulo'), bx('terras de sao pedro', 'Terras de São Pedro e São Paulo'), bx('jardim santa cruz', 'Jardim Santa Cruz'), bx('vila nova', 'Vila Nova'), bx('jardim x', 'Jardim X')];
const sits = situacoesOficiais(pags, conf, idxOf);
const tipoDe = (k) => sits.get(k).tipo;
assert.equal(tipoDe('jardim celani'), 'igual');
assert.equal(tipoDe('jardim monte pascoal'), 'grafia');
assert.equal(tipoDe('smart city'), 'sem');
assert.equal(tipoDe('jardim dos ipes'), 'igual');
assert.equal(tipoDe('jardim santa cruz'), 'ligados');
assert.equal(tipoDe('vila nova'), 'pendente'); // bairro novo, ainda sem conferência
assert.equal(tipoDe('jardim x'), 'pendente'); // nome oficial inexistente não vira correspondência
assert.deepEqual(sits.get('jardim sao pedro').mesmoOficial.map((b) => b.chave), ['terras de sao pedro']);
const avOf = avisosOficiais(pags, sits);
assert.equal(avOf.length, 3); // vila nova pendente; jardim x: nome inexistente + pendente
assert.ok(avOf.some((a) => a.includes('"vila nova"')));
assert.ok(avOf.some((a) => a.includes('Inexistente')));
// Textos: fato, com link da fonte; nome escapado.
assert.ok(htmlOficial(sits.get('jardim monte pascoal'), 'https://x/pgv.pdf').includes('No cadastro oficial da Prefeitura: <strong>Jardim Monte Paschoal</strong> ('));
assert.ok(htmlOficial(sits.get('jardim celani'), 'https://x/pgv.pdf').startsWith('<p class="nome-oficial">Este nome consta no cadastro oficial da Prefeitura ('));
assert.ok(htmlOficial(sits.get('jardim dos ipes'), 'u').includes('em ato oficial da Prefeitura'));
assert.ok(htmlOficial(sits.get('smart city'), 'https://x/pgv.pdf').includes(TEXTO_SEM_OFICIAL));
assert.ok(htmlOficial(sits.get('jardim santa cruz'), 'u').includes('Nomes ligados a este bairro no cadastro oficial da Prefeitura: <strong>Jardim Santa Cruz I e Bairro Santa Cruz</strong>'));
assert.ok(htmlOficial(sits.get('jardim sao pedro'), 'u').includes('Outra página deste site com o mesmo nome oficial: <a href="../bairro/terras-de-sao-pedro.html">Terras de São Pedro e São Paulo</a>.'));
assert.equal(htmlOficial(sits.get('vila nova'), 'u'), '');
assert.equal(htmlOficial(null, 'u'), '');
assert.ok(!htmlOficial({ tipo: 'grafia', oficiais: [{ nome: '<b>', rotulo: ROTULO_PGV, url: 'u' }] }, 'u').includes('<b>'));
assert.ok(marcaOficial(sits.get('jardim celani')).includes('oficial'));
assert.ok(marcaOficial(sits.get('jardim monte pascoal')).includes('no cadastro: Jardim Monte Paschoal'));
assert.equal(marcaOficial(sits.get('smart city')), '');
assert.equal(juntarNomes(['A', 'B', 'C']), 'A, B e C');
// Arquivo real: conferência inexistente ou nome que sumiu vira aviso, nunca assert.
try {
  const { indice: idxReal, erros: errosReal } = indiceOficial(JSON.parse(readFileSync('data/referencia/bairros-oficiais.json', 'utf8')));
  const refReal = JSON.parse(readFileSync('data/referencia/bairros-apelidos.json', 'utf8'));
  const avisosReal = [...errosReal, ...avisosOficiais(bairrosComPagina(todos), situacoesOficiais(bairrosComPagina(todos), refReal, idxReal))];
  if (avisosReal.length) console.warn(`Aviso: bairros oficiais: ${avisosReal.join(' | ')}`);
} catch (e) { console.warn(`Aviso: bairros oficiais não lidos: ${e.message}`); }

// Textos da página de bairro: "e as obras" só com obras.
assert.equal(descricaoBairro('Jardim Celani', 70, true), 'Em Jardim Celani (Salto/SP), os vereadores fizeram 70 pedidos desde 2025: veja os tipos de problema, as ruas mais citadas, os pedidos repetidos e as obras.');
assert.equal(descricaoBairro('Jardim Celani', 70, false), 'Em Jardim Celani (Salto/SP), os vereadores fizeram 70 pedidos desde 2025: veja os tipos de problema, as ruas mais citadas e os pedidos repetidos.');
const lugar = lugarJsonLd({ nome: 'Jardim Celani', slug: 'jardim-celani' });
assert.equal(lugar['@type'], 'Place');
assert.equal(lugar.containedInPlace.name, 'Salto');
assert.equal(lugar.containedInPlace.containedInPlace.name, 'São Paulo');
assert.equal('address' in lugar.containedInPlace, false);

// Vereador: o apelido abre o título e a descrição; sem gênero; nome completo no JSON-LD.
const comApelido = { id: 'x', nome: 'Rogério dos Santos Filho', apelido: 'Dr. Rogério Pinheiro', partido: 'Solidariedade' };
const semApelido = { id: 'y', nome: 'Arildo Guadagnini', apelido: null, partido: 'Democracia Cristã' };
// Título com apelido: com o sufixo " | Radar Saltense", até 70 caracteres, encurtando em passos.
assert.equal(tituloVereador({ ...comApelido, apelido: 'Preto', nome: 'Ana Lima' }), 'Preto (Ana Lima) na Câmara de Salto');
assert.equal(tituloVereador(comApelido), 'Dr. Rogério Pinheiro (Rogério dos Santos Filho)');
assert.equal(tituloVereador({ ...comApelido, apelido: 'Chell', nome: 'Michel Oliveira Rodrigues da Silva' }), 'Chell (Michel Oliveira Rodrigues da Silva), Salto/SP');
assert.equal(tituloVereador({ ...comApelido, nome: 'Nome Muito Comprido de Alguém da Silva Pereira Souza' }), 'Dr. Rogério Pinheiro na Câmara de Salto');
for (const v of [comApelido, semApelido, { ...comApelido, apelido: 'Chell', nome: 'Michel Oliveira Rodrigues da Silva' }]) assert.ok(`${tituloVereador(v)} | Radar Saltense`.length <= 70);
assert.equal(tituloVereador(semApelido), 'Arildo Guadagnini na Câmara de Salto');
assert.equal(tituloVereador({ ...semApelido, nome: 'Ana Lima' }), 'Ana Lima na Câmara de Salto: presença e votos');
for (const v of [comApelido, { ...comApelido, apelido: 'Almir da Adega', nome: 'Almir de Melo Santos', partido: 'PRD' }, { ...comApelido, nome: 'Nome Muito Comprido de Alguém da Silva Pereira Souza', partido: 'Partido Muito Comprido' }]) {
  const t = descricaoVereador(v);
  assert.ok(t.startsWith(`${v.apelido} (${v.nome}, ${v.partido}) na Câmara de Salto/SP:`), t);
  assert.ok(t.length <= 160 || t.endsWith('presença, votos e propostas.'), t);
}
assert.equal(descricaoVereador({ ...comApelido, apelido: 'Almir da Adega', nome: 'Almir de Melo Santos', partido: 'PRD' }),
  'Almir da Adega (Almir de Melo Santos, PRD) na Câmara de Salto/SP: presença nas sessões, votos, propostas, requerimentos respondidos e emendas. Dados oficiais.');
for (const v of [comApelido, semApelido]) assert.ok(!/\bvereador(a|es)?\b/i.test(`${tituloVereador(v)} ${descricaoVereador(v)}`));
assert.equal(pessoaJsonLd(comApelido).name, 'Rogério dos Santos Filho');
assert.equal(pessoaJsonLd(comApelido).alternateName, 'Dr. Rogério Pinheiro');
assert.equal('alternateName' in pessoaJsonLd(semApelido), false);

console.log('bairros: ok');
