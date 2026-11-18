import { ANO_INICIO, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { esc } from '../util/texto.js';
import { layout, ENDERECO, CAMARA_JSONLD, SUFIXO, MAX_TITULO, dataBR, link, aviso, foto, seloFonte, barraProporcao, cartaoNumero, reais, numero, GRUPOS_PUBLICOS, AVISO_NOMES, apelidoHtml } from './base.js';
import { cartaoCampanha } from './campanha.js';
import { cartaoEmendas } from './emendas.js';
import { URL_RH_CAMARA, mesAno } from './camara.js';
import { percentual, fotoSite } from './util.js';
import { amostraBoa } from '../regras/respostas.js';

const ROTULO_MARCA = { P: 'presente', A: 'falta', AJ: 'falta justificada', vazio: 'sem registro' };

const itemProposta = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> ${esc(p.ementa)} ${p.respondidoEm ? `<span class="nota">respondido em ${dataBR(p.respondidoEm)}</span> ` : ''}${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

function cartaoSalario(v, d) {
  const f = d.camara.folha;
  if (!f.ultimoMes) return '';
  const bruto = f.meses[f.ultimoMes].porVereador[v.id];
  if (bruto === undefined) return '';
  const meses = Object.keys(f.meses).filter((m) => !f.meses[m].parcial && f.meses[m].porVereador[v.id] !== undefined);
  const soma = meses.reduce((s, m) => s + f.meses[m].porVereador[v.id], 0);
  return `<section class="secao cartao">
<h2>Salário</h2>
<p><strong>${reais(bruto)}</strong> em ${mesAno(f.ultimoMes)}, antes dos descontos.</p>
<p>Desde janeiro de 2025: <strong>${reais(soma)}</strong>, em ${meses.length} meses publicados.</p>
<p>${seloFonte(URL_RH_CAMARA, 'folha no portal da Câmara')}</p>
</section>`;
}

function cartaoRespostas(v, d) {
  const x = d.camara.respostas.porVereador[v.id];
  if (!x || !x.conferidos) return '';
  const espera = x.feitos - x.conferidos;
  return `<section class="secao cartao">
<h2>Requerimentos respondidos</h2>
${amostraBoa(x) ? `<p><strong>${numero(x.respondidos)} de ${numero(x.conferidos)}</strong> requerimentos conferidos foram respondidos (${x.percentual}%).${x.medianaDias === null ? '' : ` A resposta costuma levar ${x.medianaDias} dias.`}</p>` : `<p>${numero(x.conferidos)} de ${numero(x.feitos)} conferidos até agora; o percentual aparece quando o robô terminar de conferir.</p>`}
${espera > 0 && amostraBoa(x) ? `<p class="nota">Ainda faltam conferir ${numero(espera)} de ${numero(x.feitos)} requerimentos.</p>` : ''}
<p class="nota">Resposta = documento anexado na ficha oficial. Indicações não entram: o portal não registra resposta a elas.</p>
</section>`;
}

// Sem gênero: o texto nunca diz "vereador" ou "vereadora" de uma pessoa. Até ~155 caracteres:
// "Dados oficiais." só entra quando cabe.
// Com apelido, ele vem primeiro (é por ele que as pessoas procuram) e o fim sai aos poucos até caber em ~160.
export const descricaoVereador = (v) => {
  if (v.apelido) {
    const quem = `${v.apelido} (${v.nome}${v.partido ? `, ${v.partido}` : ''}) na Câmara de Salto/SP:`;
    const opcoes = [
      `${quem} presença nas sessões, votos, propostas, requerimentos respondidos e emendas. Dados oficiais.`,
      `${quem} presença nas sessões, votos, propostas, requerimentos respondidos e emendas.`,
      `${quem} presença, votos, propostas, requerimentos respondidos e emendas.`,
      `${quem} presença, votos e propostas.`,
    ];
    return opcoes.find((t) => t.length <= 160) || opcoes[opcoes.length - 1];
  }
  const frase = `Presença, votos, propostas, requerimentos respondidos e emendas de ${v.nome}${v.partido ? ` (${v.partido})` : ''} na Câmara de Salto/SP.`;
  return frase.length + 16 <= 155 ? `${frase} Dados oficiais.` : frase;
};

// O apelido abre o título (busca por apelido); o nome completo vem entre parênteses.
// Com o sufixo " | Radar Saltense", até 70 caracteres: o fim sai aos poucos, e por último o nome completo. Sem gênero.
export const tituloVereador = (v) => {
  const max = MAX_TITULO - SUFIXO.length;
  const opcoes = v.apelido
    ? [`${v.apelido} (${v.nome}) na Câmara de Salto`, `${v.apelido} (${v.nome}), Salto/SP`, `${v.apelido} (${v.nome})`, `${v.apelido} na Câmara de Salto`]
    : [`${v.nome} na Câmara de Salto: presença e votos`, `${v.nome} na Câmara de Salto`, v.nome];
  return opcoes.find((t) => t.length <= max) || opcoes[opcoes.length - 1];
};

// Os 5 bairros com página mais citados nas propostas da pessoa (b.idx = posições em d.proposituras).
export function bairrosDoVereador(v, d, bairros = []) {
  return bairros
    .map((b) => ({ b, n: b.idx.filter((i) => d.proposituras[i] && d.proposituras[i].vereadores.includes(v.id)).length }))
    .filter((x) => x.n > 0)
    .sort((a, c) => c.n - a.n || a.b.nome.localeCompare(c.b.nome, 'pt-BR'))
    .slice(0, 5);
}

// schema.org Person, sem cargo (jobTitle) e sem gênero.
export function pessoaJsonLd(v) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: v.nome,
    ...(v.apelido ? { alternateName: v.apelido } : {}),
    ...(v.fotoLocal ? { image: `${ENDERECO}${fotoSite(v.fotoLocal)}` } : {}),
    url: `${ENDERECO}vereador/${v.id}.html`,
    ...(v.url ? { sameAs: v.url } : {}),
    memberOf: CAMARA_JSONLD,
    ...(v.partido ? { affiliation: { '@type': 'PoliticalParty', name: v.partido } } : {}),
  };
}

// opcoes.bairros: bairros com página; opcoes.cartao: há prévia própria (marca/og/vereador-<id>.png).
export function paginaVereador(v, d, opcoes = {}) {
  const props = d.proposituras.filter((p) => p.vereadores.includes(v.id));
  const pres = d.presenca[v.id];
  const sessoes = [...pres.sessoes].reverse().map((s) =>
    `<tr><td>${dataBR(s.data)}</td><td class="m-${s.marca || 'vazio'}">${s.marca || '—'}</td><td>${link(s.url, 'PDF')}</td></tr>`).join('');
  const bolinhas = pres.sessoes.map((s) => {
    const marca = s.marca || 'vazio';
    const texto = `${dataBR(s.data)}: ${ROTULO_MARCA[marca]}`;
    return `<li class="bolinha b-${marca}" title="${esc(texto)}"><span class="sr-only">${esc(texto)}</span></li>`;
  }).join('');
  const registradas = pres.P + pres.A + pres.AJ;
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, props.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) => {
    const lista = props.filter((p) => p.grupo === g);
    return `<details><summary>${esc(GRUPOS[g])} <span class="num">${lista.length}</span></summary><ul class="lista">${lista.map(itemProposta).join('')}</ul></details>`;
  }).join('\n');
  const votos = (campo) =>
    d.votacoes.flatMap((pj) => pj.eventos.filter((e) => e[campo].includes(v.id)).map((e) =>
      `<li><span class="data">${dataBR(e.data)}</span> ${esc(pj.rotulo)}${e.turno ? ` (${esc(e.turno)})` : ''}: ${esc(e.resultado)} ${link(e.url, 'PDF')}</li>`)).join('') || '<li>Nenhum registro.</li>';
  const veja = d.avisos && d.avisos.length ? ' Veja os <a href="../fontes.html#avisos">avisos sobre os dados oficiais</a>.' : '';

  const citados = bairrosDoVereador(v, d, opcoes.bairros || []);
  const outros = d.vereadores.filter((x) => x.id !== v.id);
  const corpo = `<section class="perfil cartao">
${foto(v, '../', 120, true)}
<div>
<h1>${esc(v.nome)}${apelidoHtml(v)}</h1>
<p class="partido">${esc(v.partido)}</p>
<p>${seloFonte(v.url, 'página oficial na Câmara')}</p>
${v.fotoLocal ? '<p class="credito">Foto: Câmara Municipal de Salto</p>' : ''}
</div>
</section>
<section class="secao">
<div class="grade-numeros">
${cartaoNumero({ valor: `${percentual(pres.P, registradas)}%`, rotulo: `de presença (${pres.P} de ${registradas} sessões com registro)` })}
${cartaoNumero({ valor: String(props.length), rotulo: `propostas desde ${ANO_INICIO}` })}
${cartaoNumero({ valor: String(v.votosContra), rotulo: 'vezes votou contra' })}
</div>
</section>
<section class="secao cartao">
<h2>Presença</h2>
<ul class="bolinhas" aria-label="Presença sessão por sessão, da mais antiga para a mais nova">${bolinhas}</ul>
<ul class="legenda"><li><span class="ponto b-P" aria-hidden="true"></span>presente</li><li><span class="ponto b-A" aria-hidden="true"></span>falta</li><li><span class="ponto b-AJ" aria-hidden="true"></span>falta justificada</li><li><span class="ponto b-vazio" aria-hidden="true"></span>sem registro</li></ul>
<p><strong>${pres.P}</strong> presenças, <strong>${pres.A}</strong> faltas e <strong>${pres.AJ}</strong> ausências justificadas, em ${pres.sessoes.length} sessões registradas.</p>
${aviso(`As sessões extraordinárias aparecem junto com as ordinárias. Célula vazia no PDF não conta como falta.${veja}`)}
<details><summary>Sessão por sessão</summary><table class="tabela-sessoes"><thead><tr><th>Data</th><th>Registro</th><th>Fonte</th></tr></thead><tbody>${sessoes}</tbody></table></details>
</section>
<section class="secao cartao">
<h2>Propostas</h2>
<p>${props.length} propostas desde ${ANO_INICIO}. Proposta com mais de um autor conta para cada um.</p>
${barraProporcao(GRUPOS_PUBLICOS.map((g) => ({ rotulo: GRUPOS[g], valor: contagem[g], classe: `g-${g}` })))}
${grupos}
</section>
<section class="secao cartao">
<h2>Votações</h2>
${aviso(`Leitura do documento oficial de votações. Ele só cita quem votou contra ou faltou, e o site não deduz votos a favor. ${AVISO_NOMES}`)}
<h3>Votou contra</h3><ul class="lista">${votos('contra')}</ul>
<h3>Ausente na votação</h3><ul class="lista">${votos('ausentes')}</ul>
</section>
${cartaoSalario(v, d)}
${cartaoRespostas(v, d)}
${cartaoEmendas(v, d)}
${cartaoCampanha(d.camara.campanha.candidatos[v.id])}
${citados.length ? `<section id="bairros-citados" class="secao cartao">
<h2>Bairros mais citados por ${esc(v.nome)}</h2>
<ol class="lista lista-compacta">${citados.map(({ b, n }) => `<li><a href="../bairro/${esc(b.slug)}.html">${esc(b.nome)}</a> <span class="num">${numero(n)} ${n === 1 ? 'proposta' : 'propostas'}</span></li>`).join('')}</ol>
<p class="nota">Só bairros com página própria. Proposta que cita mais de um bairro conta para cada um.</p>
</section>` : ''}
${outros.length ? `<nav class="secao" aria-labelledby="t-outros">
<h2 id="t-outros">Outros vereadores</h2>
<ul class="lista lista-compacta">${outros.map((x) => `<li><a href="${esc(x.id)}.html">${esc(x.nome)}${apelidoHtml(x)}</a></li>`).join('')}</ul>
</nav>` : ''}`;
  return layout({
    titulo: tituloVereador(v),
    descricao: descricaoVereador(v),
    caminho: `vereador/${v.id}.html`,
    jsonld: (() => { const { '@context': _, ...pessoa } = pessoaJsonLd(v); return { '@context': 'https://schema.org', '@type': 'ProfilePage', url: `${ENDERECO}vereador/${v.id}.html`, inLanguage: 'pt-BR', mainEntity: pessoa }; })(),
    trilha: [{ nome: 'Câmara', caminho: 'camara.html' }, { nome: v.nome, caminho: `vereador/${v.id}.html` }],
    mostrarAtualizado: true,
    ...(opcoes.cartao ? { imagem: { url: `${ENDERECO}marca/og/vereador-${v.id}.png`, alt: `Foto e nome de ${v.nome}, Câmara de Salto` } } : {}),
    corpo,
    prefixo: '../',
    atualizadoEm: d.meta.atualizadoEm,
  });
}
