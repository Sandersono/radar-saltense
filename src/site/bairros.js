import { ANO_INICIO, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { TIPOS_NOME } from '../regras/local.js';
import { CORTE_BAIRRO, resumoBairro } from '../regras/bairros.js';
import { esc } from '../util/texto.js';
import { layout, ENDERECO, dataBR, link, aviso, seloFonte, barraProporcao, cartaoNumero, numero, sumario, apelidoHtml, GRUPOS_PUBLICOS } from './base.js';
import { itensRepetidos } from './inicio.js';
import { URL_PROPOSITURAS } from './camara.js';
import { GRUPOS as GRUPOS_OBRA, tituloCurto } from './obras.js';

const AVISO_BAIRRO = 'Pedido não é obra feita. Pedido repetido não prova que a Prefeitura ignorou.';
const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`;
const rotuloObra = Object.fromEntries(GRUPOS_OBRA.map(([g, titulo]) => [g, titulo]));

// "e as obras" só quando a página tem obras.
export const descricaoBairro = (nome, total, temObras = false) =>
  `Em ${nome} (Salto/SP), os vereadores fizeram ${plural(total, 'pedido', 'pedidos')} desde ${ANO_INICIO}: veja os tipos de problema, as ruas mais citadas${temObras ? ', os pedidos repetidos e as obras.' : ' e os pedidos repetidos.'}`;

// schema.org Place: só o nome do bairro e a cidade.
export const lugarJsonLd = (b) => ({
  '@context': 'https://schema.org',
  '@type': 'Place',
  name: b.nome,
  url: `${ENDERECO}bairro/${b.slug}.html`,
  containedInPlace: { '@type': 'City', name: 'Salto', address: { '@type': 'PostalAddress', addressLocality: 'Salto', addressRegion: 'SP', addressCountry: 'BR' } },
});

const itemPedido = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> <strong>${esc(p.autoresTexto)}</strong> ${esc(p.ementa)} ${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

export function paginaBairro(b, d, todos = []) {
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
<p><a href="../index.html#bairro">Ver todos na busca</a></p>
</section>
${obras ? `<section id="obras" class="secao cartao">
<h2>Obras que citam o bairro</h2>
<p>Obras cuja descrição oficial cita o bairro.</p>
<ul class="lista">${obras}</ul>
</section>` : ''}
<section id="fontes-bairro" class="secao cartao">
<h2>Fontes</h2>
<p>As propostas vêm do ${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}. O bairro e a rua são lidos do texto de cada proposta. <a href="../fontes.html#ruas">Veja como</a>.</p>
</section>`;

  const corpo = `<p class="nota"><a href="../bairros.html">Todos os bairros</a></p>
<h1>${esc(b.nome)}</h1>
<p>O que os vereadores de Salto pediram ou perguntaram citando ${esc(b.nome)} desde ${ANO_INICIO}, com o documento oficial de cada proposta.</p>
${aviso(AVISO_BAIRRO)}
${sumario(secoes, [['numeros', 'Números'], ['tipos', 'Tipos de problema'], ['ruas', 'Ruas'], ['repetidos', 'Repetidos'], ['ultimos', 'Últimos pedidos'], ['obras', 'Obras']])}
${secoes}`;
  return layout({
    titulo: `${b.nome}, Salto: pedidos dos vereadores, ruas e obras: Radar Saltense`,
    descricao: descricaoBairro(b.nome, r.total, r.obras.length > 0),
    caminho: `bairro/${b.slug}.html`,
    jsonld: lugarJsonLd(b),
    corpo,
    prefixo: '../',
    atualizadoEm: d.meta.atualizadoEm,
  });
}

// Índice de A a Z. O filtro (busca.js) procura também nas outras grafias do nome.
export function paginaBairros(lista, d) {
  const az = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const itens = az.map((b) =>
    `<li data-nome="${esc([b.nome, ...b.grafias].join(' | '))}"><a href="bairro/${esc(b.slug)}.html">${esc(b.nome)}</a> <span class="num">${plural(b.total, 'proposta', 'propostas')}</span></li>`).join('\n');
  const corpo = `<h1>Bairros de Salto</h1>
<p>Escolha o bairro e veja o que os vereadores pediram para lá desde ${ANO_INICIO}: tipos de problema, ruas mais citadas, pedidos repetidos e obras.</p>
<p>Só os ${numero(lista.length)} bairros com ${CORTE_BAIRRO} propostas ou mais têm página própria. Os outros estão na <a href="index.html#bairro">busca da página inicial</a>, junto com as ruas.</p>
${aviso(AVISO_BAIRRO)}
<div class="filtros">
<label class="sr-only" for="filtro-bairros">Nome do bairro</label>
<input id="filtro-bairros" class="busca busca-pequena" type="search" placeholder="Digite o nome do bairro" autocomplete="off">
</div>
<p id="contagem-bairros" class="nota" aria-live="polite"></p>
<ul id="lista-bairros" class="lista cartao lista-bairros">
${itens}
</ul>
<p>As propostas vêm do ${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}. O bairro é lido do texto de cada proposta. <a href="fontes.html#ruas">Veja como</a>.</p>`;
  return layout({
    titulo: 'Bairros de Salto: o que os vereadores pediram e as obras: Radar Saltense',
    descricao: `Os bairros de Salto/SP com ${CORTE_BAIRRO} propostas ou mais dos vereadores: pedidos, ruas mais citadas, pedidos repetidos e obras. Só dado oficial.`,
    caminho: 'bairros.html',
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Bairros de Salto', url: `${ENDERECO}bairros.html`, inLanguage: 'pt-BR' },
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}
