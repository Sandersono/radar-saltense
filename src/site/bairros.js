import { ANO_INICIO, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { TIPOS_NOME } from '../regras/local.js';
import { CORTE_BAIRRO, resumoBairro } from '../regras/bairros.js';
import { ROTULO_PGV, TEXTO_SEM_OFICIAL, porFonte, juntarNomes } from '../regras/bairros-oficiais.js';
import { esc } from '../util/texto.js';
import { layout, ENDERECO, SUFIXO, dataBR, link, aviso, seloFonte, barraProporcao, cartaoNumero, numero, sumario, apelidoHtml, GRUPOS_PUBLICOS } from './base.js';
import { itensRepetidos } from './inicio.js';
import { URL_PROPOSITURAS } from './camara.js';
import { GRUPOS as GRUPOS_OBRA, tituloCurto } from './obras.js';

const AVISO_BAIRRO = 'Pedido não é obra feita. Pedido repetido não prova que a Prefeitura ignorou.';
const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`;
const rotuloObra = Object.fromEntries(GRUPOS_OBRA.map(([g, titulo]) => [g, titulo]));

// "e as obras" só quando a página tem obras.
export const descricaoBairro = (nome, total, temObras = false) =>
  `Em ${nome} (Salto/SP), os vereadores fizeram ${plural(total, 'pedido', 'pedidos')} desde ${ANO_INICIO}: veja os tipos de problema, as ruas mais citadas${temObras ? ', os pedidos repetidos e as obras.' : ' e os pedidos repetidos.'}`;

// schema.org Place: só o nome do bairro, a cidade e o estado.
export const lugarJsonLd = (b) => ({
  '@context': 'https://schema.org',
  '@type': 'Place',
  name: b.nome,
  url: `${ENDERECO}bairro/${b.slug}.html`,
  containedInPlace: { '@type': 'City', name: 'Salto', containedInPlace: { '@type': 'State', name: 'São Paulo' } },
});

// Título do bairro: com o sufixo, até 65 caracteres; encurta em passos.
export const tituloBairro = (nome) => [`${nome}, Salto/SP: pedidos dos vereadores e obras`, `${nome}, Salto/SP: pedidos e obras`, `${nome}, Salto/SP`]
  .find((t) => (t + SUFIXO).length <= 65) || nome;

// Linha do nome oficial na página do bairro (situacao de situacoesOficiais). Sem situação ou "pendente": nada.
// pgvUrl: link da lei para a frase "não consta". prefixo: caminho até a raiz do site (links para outras páginas).
export function htmlOficial(s, pgvUrl, prefixo = '../') {
  if (!s || s.tipo === 'pendente') return '';
  const grupos = porFonte(s.oficiais);
  const soPgv = grupos.every((g) => g.rotulo === ROTULO_PGV);
  const fontes = grupos.map((g) => `<strong>${esc(juntarNomes(g.nomes))}</strong> (${seloFonte(g.url, g.rotulo)})`).join('; ');
  let frase;
  if (s.tipo === 'sem') frase = `${esc(TEXTO_SEM_OFICIAL)}${pgvUrl ? ` ${seloFonte(pgvUrl, 'Lei 3.227/2013')}` : ''}`;
  else if (s.tipo === 'igual') frase = `Este nome consta ${soPgv ? 'no cadastro oficial' : 'em ato oficial'} da Prefeitura (${grupos.map((g) => seloFonte(g.url, g.rotulo)).join('; ')}).`;
  else if (s.tipo === 'grafia') frase = `${soPgv ? 'No cadastro oficial da Prefeitura' : 'Nome oficial na Prefeitura'}: ${fontes}.`;
  else frase = `Nomes ligados a este bairro ${soPgv ? 'no cadastro oficial' : 'nos registros oficiais'} da Prefeitura: ${fontes}.`;
  const outras = (s.mesmoOficial || []).map((o) => `<a href="${prefixo}bairro/${esc(o.slug)}.html">${esc(o.nome)}</a>`);
  const mesmo = outras.length ? ` ${outras.length === 1 ? 'Outra página deste site com o mesmo nome oficial' : 'Outras páginas deste site com o mesmo nome oficial'}: ${juntarNomes(outras)}.` : '';
  return `<p class="nome-oficial">${frase}${mesmo}</p>`;
}

// Marca no índice de bairros: "oficial" quando o nome é o do cadastro; o nome oficial embaixo quando é outro.
export function marcaOficial(s) {
  if (!s) return '';
  if (s.tipo === 'igual') return ' <span class="tag tag-oficial">oficial</span>';
  if (s.tipo === 'grafia' || s.tipo === 'ligados') return `<span class="nota nome-cadastro">no cadastro: ${esc(juntarNomes(s.oficiais.map((o) => o.nome)))}</span>`;
  return '';
}

const itemPedido = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> <strong>${esc(p.autoresTexto)}</strong> ${esc(p.ementa)} ${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

// oficial: { situacao, url } do cadastro oficial (null: arquivo ausente ou bairro não conferido; a página sai sem a linha).
export function paginaBairro(b, d, todos = [], oficial = null) {
  const linhaOficial = oficial ? htmlOficial(oficial.situacao, oficial.url) : '';
  const r = resumoBairro(b, d, todos);
  const porId = new Map(d.vereadores.map((v) => [v.id, v]));
  const quem = r.vereadores.map(({ id, n }) => {
    const v = porId.get(id);
    const nome = v ? `<a href="../vereador/${esc(v.id)}.html">${esc(v.nome)}${apelidoHtml(v)}</a>` : esc(id);
    return `<li>${nome} <span class="num">${plural(n, 'proposta', 'propostas')}</span></li>`;
  }).join('');
  const tipos = r.tipos.map(({ tipo, n }) => `<li>${esc(TIPOS_NOME[tipo] || tipo)} <span class="num">${numero(n)}</span></li>`).join('');
  const ruas = r.ruas.map(({ nome, n }) => `<li>${esc(nome)} <span class="num">${numero(n)}</span></li>`).join('');
  const { html: repetidos, extras } = itensRepetidos(r.repetidos);
  const obras = r.obras.map((o) =>
    `<li><a href="../obras.html#${esc(o.id)}">${esc(tituloCurto(o, 110))}</a> <span class="tag">${esc(rotuloObra[o.grupo] || 'Obra')}</span></li>`).join('');

  const secoes = `<section id="numeros" class="secao">
<h2>Os números</h2>
<div class="grade-numeros">
${cartaoNumero({ valor: numero(r.total), rotulo: `propostas desde ${ANO_INICIO}` })}
${cartaoNumero({ valor: numero(r.porGrupo.melhoria || 0), rotulo: 'pedidos de melhoria' })}
</div>
${barraProporcao(GRUPOS_PUBLICOS.map((g) => ({ rotulo: GRUPOS[g], valor: r.porGrupo[g] || 0, classe: `g-${g}` })))}
${quem ? `<div class="cartao">
<h3>Quem mais citou o bairro</h3>
<ol class="lista lista-compacta">${quem}</ol>
<p class="nota">Proposta com mais de um autor conta para cada um.</p>
</div>` : ''}
</section>
${tipos ? `<section id="tipos" class="secao cartao">
<h2>Tipos de problema</h2>
<p>Os pedidos mais comuns para ${esc(b.nome)}, pela mesma regra usada em "O problema que não some". Um pedido pode ter mais de um tipo.</p>
<ul class="lista lista-compacta">${tipos}</ul>
</section>` : ''}
${ruas ? `<section id="ruas" class="secao cartao">
<h2>Ruas mais citadas</h2>
<p>Ruas que aparecem nos mesmos pedidos que ${esc(b.nome)}.</p>
<ol class="lista lista-compacta">${ruas}</ol>
</section>` : ''}
${repetidos ? `<section id="repetidos" class="secao">
<h2>O problema que não some</h2>
<p>Pedidos do mesmo tipo que voltaram mais de uma vez para uma rua citada junto com ${esc(b.nome)}. A contagem é da rua inteira, que pode passar por outros bairros.</p>
${aviso('Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.')}
<ol class="lista cartao">${repetidos}</ol>
${extras ? `<p><button type="button" class="botao-secundario" id="ver-mais-repetidos" hidden>Ver mais ${extras} casos</button></p>` : ''}
</section>` : ''}
<section id="ultimos" class="secao cartao">
<h2>Últimos pedidos</h2>
<ul class="lista">${r.recentes.map(itemPedido).join('')}</ul>
<p><a href="../#bairro">Ver todos na busca</a></p>
</section>
${obras ? `<section id="obras" class="secao cartao">
<h2>Obras que citam o bairro</h2>
<p>Obras cuja descrição oficial cita o bairro.</p>
<ul class="lista">${obras}</ul>
</section>` : ''}
<section id="fontes-bairro" class="secao cartao">
<h2>Fontes</h2>
<p>As propostas vêm do ${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}. O bairro e a rua são lidos do texto de cada proposta. <a href="../fontes.html#ruas">Veja como</a>.</p>
${linhaOficial ? `<p>O nome do bairro nesta página é o usado nos documentos da Câmara. O nome oficial vem do cadastro da Prefeitura (${seloFonte(oficial.url, ROTULO_PGV)}) e de decretos e leis de loteamento.</p>` : ''}
</section>`;

  const corpo = `<h1>${esc(b.nome)}, Salto: o que os vereadores pediram</h1>
<p>O que os vereadores de Salto pediram ou perguntaram citando ${esc(b.nome)} desde ${ANO_INICIO}, com o documento oficial de cada proposta.</p>
${linhaOficial}
${aviso(AVISO_BAIRRO)}
${sumario(secoes, [['numeros', 'Números'], ['tipos', 'Tipos de problema'], ['ruas', 'Ruas'], ['repetidos', 'Repetidos'], ['ultimos', 'Últimos pedidos'], ['obras', 'Obras']])}
${secoes}`;
  return layout({
    titulo: tituloBairro(b.nome),
    trilha: [{ nome: 'Bairros', caminho: 'bairros.html' }, { nome: b.nome, caminho: `bairro/${b.slug}.html` }],
    mostrarAtualizado: true,
    descricao: descricaoBairro(b.nome, r.total, r.obras.length > 0),
    caminho: `bairro/${b.slug}.html`,
    jsonld: lugarJsonLd(b),
    corpo,
    prefixo: '../',
    atualizadoEm: d.meta.atualizadoEm,
  });
}

// Índice de A a Z. O filtro (busca.js) procura também nas outras grafias do nome e nos nomes oficiais.
// situacoes: Map chave -> situação no cadastro oficial (vazio: arquivo oficial ausente; o índice sai sem marcas).
export function paginaBairros(lista, d, situacoes = new Map(), pgvUrl = '') {
  const az = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const itens = az.map((b) => {
    const s = situacoes.get(b.chave);
    const nomes = [b.nome, ...b.grafias, ...(s ? s.oficiais.map((o) => o.nome) : [])];
    return `<li data-nome="${esc([...new Set(nomes)].join(' | '))}"><span class="bairro-nome"><a href="bairro/${esc(b.slug)}.html">${esc(b.nome)}</a>${marcaOficial(s)}</span> <span class="num">${plural(b.total, 'proposta', 'propostas')}</span></li>`;
  }).join('\n');
  const legenda = situacoes.size && pgvUrl
    ? `<p class="nota"><span class="tag tag-oficial">oficial</span> nome igual ao do cadastro oficial da Prefeitura (${seloFonte(pgvUrl, ROTULO_PGV)}) ou de um decreto ou lei de loteamento. Sem a marca, o nome é o usado nos documentos da Câmara; quando o cadastro usa outro nome, ele aparece embaixo.</p>`
    : '';
  const corpo = `<h1>Bairros de Salto</h1>
<p>Escolha o bairro e veja o que os vereadores pediram para lá desde ${ANO_INICIO}: tipos de problema, ruas mais citadas, pedidos repetidos e obras.</p>
<p>Só os ${numero(lista.length)} bairros com ${CORTE_BAIRRO} propostas ou mais têm página própria. Os outros estão na <a href="./#bairro">busca da página inicial</a>, junto com as ruas.</p>
${aviso(AVISO_BAIRRO)}
<div class="filtros">
<label class="sr-only" for="filtro-bairros">Nome do bairro</label>
<input id="filtro-bairros" class="busca busca-pequena" type="search" placeholder="Digite o nome do bairro" autocomplete="off">
</div>
${legenda}
<p id="contagem-bairros" class="nota" aria-live="polite"></p>
<ul id="lista-bairros" class="lista cartao lista-bairros">
${itens}
</ul>
<p>As propostas vêm do ${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}. O bairro é lido do texto de cada proposta. <a href="fontes.html#ruas">Veja como</a>.</p>`;
  return layout({
    titulo: 'Bairros de Salto/SP: pedidos dos vereadores e obras',
    trilha: [{ nome: 'Bairros', caminho: 'bairros.html' }],
    mostrarAtualizado: true,
    descricao: `Os bairros de Salto/SP com ${CORTE_BAIRRO} propostas ou mais dos vereadores: pedidos, ruas mais citadas, pedidos repetidos e obras. Só dado oficial.`,
    caminho: 'bairros.html',
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Bairros de Salto', url: `${ENDERECO}bairros.html`, inLanguage: 'pt-BR' },
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}
