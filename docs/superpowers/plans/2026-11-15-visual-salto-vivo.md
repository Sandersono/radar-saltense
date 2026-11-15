# Visual "Salto vivo" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular o visual do Radar Saltense na direção "Salto vivo", com estas peças:
- cores do rio e da areia, Nunito + Inter, cantos arredondados e onda no topo;
- fotos oficiais dos vereadores;
- home reorganizada.

Nenhum dado, regra, aviso ou número pode mudar.

**Architecture:**
- O gerador continua em template strings, dividido em módulos por página em `src/site/`.
- `site/estilo.css` é reescrito com tokens.
- `site/busca.js` ganha:
  - o menu do celular;
  - as sugestões de bairro;
  - a ordenação por botões;
  - o "ver mais".
- Um coletor novo baixa as fotos oficiais, com cache.
- As fontes vêm de pacotes `@fontsource` e são copiadas para `dist/fontes/`.

**Tech Stack:** Node.js ≥ 22.13 (ES modules), HTML e CSS estáticos, `@fontsource/nunito` e `@fontsource/inter` (SIL OFL), sem framework.

Spec: `docs/superpowers/specs/2026-11-15-visual-salto-vivo-design.md`

## Global Constraints

- **Tokens de cor** (`:root`):

  | Token | Cor |
  |---|---|
  | `--rio` | #0E6BA8 |
  | `--rio-escuro` | #10324A |
  | `--areia` | #FFF7EA |
  | `--areia-escura` | #F6E7CC |
  | `--ambar` | #F2A541 |
  | `--ambar-escuro` | #7A4A00 |
  | `--branco` | #FFFFFF |
  | `--suave` | #5B6472 |
  | `--linha` | #E8DCC6 |
  | `--falta` | #B3261E |
  | `--justificada` | #B26A00 |
  | `--presente` | #1E7A46 |

- **Contraste:** todo texto precisa de contraste ≥ 4,5:1 (AA). O texto sobre âmbar é `--rio-escuro`, nunca branco.
- **Tipografia:**
  - títulos em Nunito 800;
  - texto em Inter 400/600;
  - números com `font-variant-numeric: tabular-nums`;
  - fontes servidas de `dist/fontes/`, sem Google Fonts nem CDN.
- **Toque e larguras:**
  - alvos de toque ≥ 44 px;
  - sem rolagem horizontal em 320, 375 e 414 px;
  - largura máxima de 1040 px;
  - vereadores em 3 colunas a partir de 1024 px;
  - números da Câmara em 4 colunas a partir de 768 px.
- **Acessibilidade:**
  - foco visível (contorno âmbar de 3 px);
  - menu com `aria-expanded`;
  - imagens com `alt`;
  - o contador mantém `aria-live="off"`;
  - `prefers-reduced-motion` respeitado.
- **Fotos:**
  - oficiais da Câmara, baixadas pelo robô com `baixar()` (User-Agent RadarSaltense, espera de 2 s) e cache por URL;
  - falha numa foto **não** para o robô: o vereador fica sem foto, o site mostra as iniciais e entra um aviso;
  - crédito "Foto: Câmara Municipal de Salto".
- **Peso:** a home sem fotos e sem `busca.json` deve ter até 200 KB (HTML + CSS + JS + fontes).
- **Textos:** todos os avisos e regras de transparência de hoje continuam. Os textos estão em português simples.
- **Checagens:** só `node:assert` em `check/regras.mjs`, rodadas com `npm run checar`.
- **Hook local:** o `hook-limpar-texto.py` reescreve arquivos `.md`/`.html`/`.txt` gravados pelas ferramentas Write/Edit. Os arquivos deste plano são `.js`/`.css`, que não são afetados, e o HTML é gerado pelo Node.
- **Commits:** locais e já autorizados, em português, com a linha `Co-Authored-By`. Nunca fazer push.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/site/util.js` (novo) | `iniciais`, `percentual`, `sugestoesBairros` (puras) |
| `src/coleta/fotos.js` (novo) | `coletarFotos(vereadores)` |
| `src/site/base.js` (novo) | `layout`, os helpers (`dataBR`, `reais`, `numero`, `link`, `seloFonte`, `aviso`, `foto`, `barraProporcao`, `cartaoNumero`, `quandoBR`) e as constantes `GRUPOS_PUBLICOS` e `AVISO_NOMES` |
| `src/site/impostometro.js` (novo) | `blocoContador`, `paginaImpostometro` |
| `src/site/votacoes.js` (novo) | `paginaVotacoes` |
| `src/site/fontes.js` (novo) | `paginaFontes` |
| `src/site/inicio.js` (novo) | `paginaInicial` |
| `src/site/vereador.js` (novo) | `paginaVereador` |
| `src/gerar-site.js` | Só organiza: escreve as páginas, `busca.json`, copia o CSS, o JS, as fontes e as fotos |
| `site/estilo.css` | Reescrito |
| `site/busca.js` | Reescrito, com os comportamentos novos |
| `src/coletar.js`, `src/processar.js` | Fotos na coleta e `fotoLocal` no vereador |

---

### Task 1: Fotos, fontes e funções puras

**Files:**
- Create: `src/site/util.js`, `src/coleta/fotos.js`
- Modify: `src/coletar.js`, `src/processar.js`, `check/regras.mjs`, `package.json` (dependências)

**Interfaces:**
- Produces:
  - `iniciais(nome): string`: primeira letra do primeiro e do último nome significativo, ignorando de/da/do/das/dos/e. Devolve `'?'` se o nome estiver vazio.
  - `percentual(parte, total): number`: inteiro arredondado, 0 se o total for 0.
  - `sugestoesBairros(locais, n = 6): string[]`: os nomes dos locais com `tipo === 'bairro'`, do maior para o menor `idx.length`, com empate em ordem alfabética.
  - `coletarFotos(vereadores): Promise<{ fotos: Record<id, 'fotos/<id>.<ext>'>, avisos: string[] }>`.
  - `coleta.fotos` e `coleta.avisosFotos`.
  - Cada vereador em `dados.vereadores` ganha `fotoLocal: string | null`.

- [ ] **Step 1: Instalar as fontes**

```bash
npm install @fontsource/nunito @fontsource/inter
ls node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2 node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2 node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2
```
Expected: os três arquivos existem. Se o nome for outro na versão instalada, anote o nome correto no relatório. A Task 2 usa esses caminhos.

- [ ] **Step 2: Acrescentar ao fim de `check/regras.mjs`**

```js
import { iniciais, percentual, sugestoesBairros } from '../src/site/util.js';

{
  assert.equal(iniciais('Almir de Melo Santos'), 'AS');
  assert.equal(iniciais('Arildo Guadagnini'), 'AG');
  assert.equal(iniciais('Luzia de Fátima Izidório Vidal'), 'LV');
  assert.equal(iniciais('Clayton'), 'C');
  assert.equal(iniciais(''), '?');
  assert.equal(percentual(79, 84), 94);
  assert.equal(percentual(0, 0), 0);
  const locais = [
    { tipo: 'bairro', nome: 'Centro', idx: [1, 2, 3] },
    { tipo: 'rua', nome: 'Rua X', idx: [1, 2, 3, 4] },
    { tipo: 'bairro', nome: 'Jardim B', idx: [1] },
    { tipo: 'bairro', nome: 'Jardim A', idx: [5] },
  ];
  assert.deepEqual(sugestoesBairros(locais, 2), ['Centro', 'Jardim A']);
  assert.deepEqual(sugestoesBairros(locais), ['Centro', 'Jardim A', 'Jardim B']);
  console.log('ok: site util');
}
```

- [ ] **Step 3: Escrever `src/site/util.js`**

```js
import { normalizar } from '../util/texto.js';

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter((p) => p && !PARTICULAS.has(normalizar(p)));
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

export function percentual(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function sugestoesBairros(locais, n = 6) {
  return locais
    .filter((l) => l.tipo === 'bairro')
    .sort((a, b) => b.idx.length - a.idx.length || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, n)
    .map((l) => l.nome);
}
```

- [ ] **Step 4: Escrever `src/coleta/fotos.js`**

```js
import { readFile } from 'node:fs/promises';
import { baixar, salvar, existe } from './http.js';

const PASTA = 'data/bruto/fotos';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function tipoImagem(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(PNG)) return 'png';
  return null;
}

// Baixa a foto oficial de cada vereador só quando a URL muda ou o arquivo não existe.
// Falha numa foto não para o robô: o vereador fica sem foto (o site mostra as iniciais) e entra um aviso.
export async function coletarFotos(vereadores) {
  let origem = {};
  try {
    origem = JSON.parse(await readFile(`${PASTA}/origem.json`, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const fotos = {};
  const avisos = [];
  for (const v of vereadores) {
    if (!v.foto) {
      avisos.push(`Foto de ${v.nome}: não encontrada na página da Câmara. O site mostra as iniciais.`);
      continue;
    }
    const anterior = origem[v.id];
    if (anterior && anterior.url === v.foto && (await existe(`${PASTA}/${anterior.arquivo}`))) {
      fotos[v.id] = `fotos/${anterior.arquivo}`;
      continue;
    }
    try {
      const buf = await baixar(v.foto);
      const ext = tipoImagem(buf);
      if (!ext) throw new Error('o arquivo não é uma imagem JPG ou PNG');
      const arquivo = `${v.id}.${ext}`;
      await salvar(`${PASTA}/${arquivo}`, buf);
      origem[v.id] = { url: v.foto, arquivo };
      fotos[v.id] = `fotos/${arquivo}`;
    } catch (e) {
      avisos.push(`Foto de ${v.nome}: não foi possível baixar (${e.message}). O site mostra as iniciais.`);
    }
  }
  await salvar(`${PASTA}/origem.json`, `${JSON.stringify(origem, null, 2)}\n`);
  return { fotos, avisos };
}
```

- [ ] **Step 5: `src/coletar.js`**

- Importe: `import { coletarFotos } from './coleta/fotos.js';`
- Logo depois de `const vereadores = await coletarVereadores();`, acrescente: `const { fotos, avisos: avisosFotos } = await coletarFotos(vereadores);`
- Inclua `fotos, avisosFotos` no objeto `coleta`.
- No resumo impresso, acrescente: `console.log(\`Fotos: ${Object.keys(c.fotos).length} de ${c.vereadores.length}\`);`

- [ ] **Step 6: `src/processar.js`**

- Na desestruturação da assinatura de `processar`, acrescente `fotos, avisosFotos`.
- Logo depois de `const avisos = [];`, acrescente: `avisos.push(...(avisosFotos || []));`
- No objeto devolvido para cada vereador (o `return { ...v, porGrupo, ... }` dentro de `resumo`), acrescente: `fotoLocal: (fotos && fotos[v.id]) || null,`

- [ ] **Step 7: Rodar a checagem e baixar as fotos de verdade (rede, cerca de 30 s)**

Run: `npm run checar`
Expected: todas as seções anteriores mais `ok: site util`.

Depois, crie um script descartável na pasta scratchpad (fora do repositório). Ele deve:
1. ler `data/bruto/coleta.json`;
2. chamar `coletarFotos(coleta.vereadores)` (import via URL `file:///`, rodando o node a partir da raiz do repositório);
3. gravar `coleta.fotos` e `coleta.avisosFotos` de volta no `coleta.json`.

Em seguida rode `npm run processar`.
Expected:
- 11 arquivos em `data/bruto/fotos/` e um `origem.json`;
- "Pronto.";
- `data/processado/dados.json` com `fotoLocal` preenchido nos 11.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/site/util.js src/coleta/fotos.js src/coletar.js src/processar.js check/regras.mjs data/bruto/fotos data/processado
git commit -m "feat: fotos oficiais dos vereadores, fontes Nunito/Inter e funções do novo visual"
```

---

### Task 2: Base visual (layout, CSS, menu, fontes e fotos no dist)

**Files:**
- Create: `src/site/base.js`
- Modify: `src/gerar-site.js`
- Replace: `site/estilo.css`, `site/busca.js`

**Interfaces:**
- Consumes: `iniciais` (Task 1); `AUTOR` (config); `esc` (`util/texto.js`).
- Produces, exportado de `src/site/base.js`:
  - `GRUPOS_PUBLICOS`, `AVISO_NOMES`;
  - `dataBR(d)`, `reais(v)`, `numero(v)`, `quandoBR(iso)`;
  - `link(url, texto)`, `seloFonte(url, texto?)`, `aviso(html)`, `foto(v, prefixo, tamanho)`;
  - `barraProporcao(segmentos: {rotulo, valor, classe}[])`, `cartaoNumero({valor, rotulo, href?})`;
  - `layout({ titulo, corpo, prefixo = '', atualizadoEm, heroi = '' })`.
- Classes CSS que as Tasks 3 e 4 usam:
  - `secao`, `cartao`, `botao`, `botao-secundario`, `selo-fonte`, `aviso`;
  - `busca`, `busca-pequena`, `sugestoes`, `ordens`, `chip`, `filtros`, `cartoes`;
  - `cartao-vereador`, `cartao-vereador-topo`, `presenca-resumo`, `presenca-barra`, `presenca-preenchida`, `cartao-dados`;
  - `grade-numeros`, `cartao-numero`, `numero-grande`, `numero-rotulo`;
  - `proporcao`, `fatia`, `g-melhoria`, `g-cobranca`, `g-homenagem`, `g-lei`, `g-outros`, `legenda`, `ponto`;
  - `perfil`, `credito`, `bolinhas`, `bolinha`, `b-P`, `b-A`, `b-AJ`, `b-vazio`;
  - `votacao`, `votacao-titulo`, `eventos`, `resultado`, `etiqueta`, `etiqueta-contra`, `etiqueta-ausentes`;
  - `chamadas`, `chamada`, `sumario`;
  - `contador-impostos`, `barras`, `meses`, `trilho`, `barra`, `vazio`, `nota`;
  - `lista`, `data`, `tag`, `num`, `partido`, `sr-only`.

- [ ] **Step 1: Escrever `src/site/base.js`**

```js
import { AUTOR } from '../config.js';
import { esc } from '../util/texto.js';
import { iniciais } from './util.js';

export const GRUPOS_PUBLICOS = ['melhoria', 'cobranca', 'homenagem', 'lei', 'outros'];
export const AVISO_NOMES = 'Nomes escritos de outro jeito no PDF (ex.: apelidos) ficam de fora e podem mudar estes números.';

export const dataBR = (d) => (d ? d.split('-').reverse().join('/') : 'sem data');
export const reais = (v) => Math.round(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const numero = (v) => Number(v).toLocaleString('pt-BR');
export const quandoBR = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
export const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener">${texto}</a>`;
export const seloFonte = (url, texto = 'fonte oficial') =>
  `<a class="selo-fonte" href="${esc(url)}" target="_blank" rel="noopener">${esc(texto)} <span aria-hidden="true">↗</span></a>`;
export const aviso = (html) => `<p class="aviso"><span class="aviso-icone" aria-hidden="true">i</span><span>${html}</span></p>`;

export function foto(v, prefixo, tamanho) {
  return v.fotoLocal
    ? `<img class="foto" src="${prefixo}${esc(v.fotoLocal)}" alt="Foto de ${esc(v.nome)}" width="${tamanho}" height="${tamanho}" loading="lazy">`
    : `<span class="foto foto-iniciais" style="width:${tamanho}px;height:${tamanho}px" aria-hidden="true">${esc(iniciais(v.nome))}</span>`;
}

export function barraProporcao(segmentos) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  if (!total) return '';
  const pct = (v) => String(Math.round((v / total) * 1000) / 10).replace('.', ',');
  const fatias = segmentos.filter((x) => x.valor > 0)
    .map((x) => `<span class="fatia ${x.classe}" style="width:${((x.valor / total) * 100).toFixed(2)}%" title="${esc(x.rotulo)}: ${numero(x.valor)}"></span>`).join('');
  const legenda = segmentos
    .map((x) => `<li><span class="ponto ${x.classe}" aria-hidden="true"></span>${esc(x.rotulo)} <strong>${numero(x.valor)}</strong> <small>(${pct(x.valor)}%)</small></li>`).join('');
  const rotulo = segmentos.map((x) => `${x.rotulo}: ${numero(x.valor)}`).join('; ');
  return `<div class="proporcao" role="img" aria-label="${esc(rotulo)}">${fatias}</div><ul class="legenda">${legenda}</ul>`;
}

export const cartaoNumero = ({ valor, rotulo, href }) => href
  ? `<a class="cartao cartao-numero" href="${esc(href)}"><span class="numero-grande">${esc(valor)}</span><span class="numero-rotulo">${esc(rotulo)}</span></a>`
  : `<div class="cartao cartao-numero"><span class="numero-grande">${esc(valor)}</span><span class="numero-rotulo">${esc(rotulo)}</span></div>`;

export function layout({ titulo, corpo, prefixo = '', atualizadoEm, heroi = '' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="O que cada vereador de Salto/SP fez desde a posse e quanto a cidade arrecada em impostos, só com dados oficiais.">
<meta name="theme-color" content="#0E6BA8">
<link rel="stylesheet" href="${prefixo}estilo.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
<div class="topo-barra">
<a class="marca" href="${prefixo}index.html">Radar Saltense</a>
<button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu-principal">Menu</button>
<nav id="menu-principal" class="menu" aria-label="Principal"><a href="${prefixo}index.html#bairro">Seu bairro</a><a href="${prefixo}index.html#vereadores">Vereadores</a><a href="${prefixo}votacoes.html">Votações</a><a href="${prefixo}impostometro.html">Impostômetro</a><a href="${prefixo}fontes.html">De onde vêm os números</a></nav>
</div>
${heroi ? `<div class="heroi">${heroi}</div>` : ''}
<svg class="onda" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 30C240 60 480 0 720 22S1200 50 1440 18V60H0Z"/></svg>
</header>
<main id="conteudo">
${corpo}
</main>
<footer class="rodape"><div class="rodape-dentro">
<p class="rodape-marca">Radar Saltense</p>
<p>Atualizado em ${esc(quandoBR(atualizadoEm))}. Tudo sai de fontes oficiais: Câmara Municipal de Salto, Tribunal de Contas do Estado (TCE-SP) e IBGE. <a href="${prefixo}fontes.html">Veja de onde vêm os números</a>.</p>
<p>Radar Saltense é um projeto independente de ${esc(AUTOR.nome)}, feito por morador, sem vínculo com a Câmara, com a Prefeitura ou com partido.</p>
<p>Achou um erro? Me chama no Instagram: <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>.</p>
</div></footer>
<script src="${prefixo}busca.js" defer></script>
</body>
</html>
`;
}
```

- [ ] **Step 2: `src/gerar-site.js`, primeira parte da troca**

1. Apague as definições locais de `GRUPOS_PUBLICOS`, `dataBR`, `AVISO_NOMES`, `link`, `reais` e a função `layout` inteira.
2. Acrescente aos imports: `import { layout, dataBR, link, reais, GRUPOS_PUBLICOS, AVISO_NOMES } from './site/base.js';`
3. Substitua a função `gerarSite` por:

```js
const FONTES = [
  ['node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2', 'nunito-800.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
];

export async function gerarSite(d, destino) {
  for (const pasta of ['vereador', 'dados', 'fontes', 'fotos']) await mkdir(`${destino}/${pasta}`, { recursive: true });
  await writeFile(`${destino}/index.html`, paginaInicial(d));
  for (const v of d.vereadores) await writeFile(`${destino}/vereador/${v.id}.html`, paginaVereador(v, d));
  await writeFile(`${destino}/votacoes.html`, paginaVotacoes(d));
  await writeFile(`${destino}/fontes.html`, paginaFontes(d));
  if (d.receitas) await writeFile(`${destino}/impostometro.html`, paginaImpostometro(d));
  const busca = {
    p: d.proposituras.map((p) => [p.id, p.data, p.grupo, p.autoresTexto, p.ementa, `${p.categoria} ${p.numero}`]),
    l: d.locais.map((l) => [l.nome, l.idx]),
  };
  await writeFile(`${destino}/dados/busca.json`, JSON.stringify(busca));
  await copyFile('site/estilo.css', `${destino}/estilo.css`);
  await copyFile('site/busca.js', `${destino}/busca.js`);
  for (const [origem, nome] of FONTES) await copyFile(origem, `${destino}/fontes/${nome}`);
  for (const v of d.vereadores) if (v.fotoLocal) await copyFile(`data/bruto/${v.fotoLocal}`, `${destino}/${v.fotoLocal}`);
  await writeFile(`${destino}/.nojekyll`, '');
}
```

Se a Task 1 registrou nomes de arquivo de fonte diferentes, use os nomes reais na coluna de origem.

- [ ] **Step 3: Substituir `site/estilo.css` inteiro**

```css
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 800; font-display: swap; src: url('fontes/nunito-800.woff2') format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; font-display: swap; src: url('fontes/inter-400.woff2') format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 600; font-display: swap; src: url('fontes/inter-600.woff2') format('woff2'); }

:root {
  --rio: #0E6BA8; --rio-escuro: #10324A; --areia: #FFF7EA; --areia-escura: #F6E7CC;
  --ambar: #F2A541; --ambar-escuro: #7A4A00; --branco: #FFFFFF; --suave: #5B6472; --linha: #E8DCC6;
  --falta: #B3261E; --justificada: #B26A00; --presente: #1E7A46;
  --sombra: 0 2px 8px rgb(16 50 74 / 6%); --raio: 18px;
  --titulo: 'Nunito', system-ui, sans-serif;
  --texto: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--areia); color: var(--rio-escuro); font: 400 1rem/1.6 var(--texto); }
img { max-width: 100%; }
a { color: var(--rio); text-underline-offset: 2px; }
h1, h2, h3 { font-family: var(--titulo); font-weight: 800; line-height: 1.2; color: var(--rio-escuro); }
h1 { font-size: clamp(1.8rem, 6vw, 2.6rem); margin: .25rem 0 .5rem; }
h2 { font-size: clamp(1.35rem, 4.5vw, 1.8rem); margin: 0 0 .75rem; }
h3 { font-size: 1.15rem; margin: 1.25rem 0 .5rem; }
:focus-visible { outline: 3px solid var(--ambar); outline-offset: 2px; border-radius: 6px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.pular { position: absolute; left: -999px; top: .5rem; background: var(--ambar); color: var(--rio-escuro); padding: .5rem 1rem; border-radius: 999px; z-index: 10; font-weight: 600; }
.pular:focus { left: .5rem; }

.topo { background: var(--rio); color: #fff; }
.topo-barra { max-width: 1040px; margin: 0 auto; padding: .75rem 1rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; }
.marca { font-family: var(--titulo); font-weight: 800; font-size: 1.3rem; color: #fff; text-decoration: none; }
.menu-botao { display: none; align-items: center; gap: .4rem; min-height: 44px; padding: .4rem .9rem; border: 2px solid rgb(255 255 255 / 70%); border-radius: 999px; background: transparent; color: #fff; font: 600 .95rem var(--texto); cursor: pointer; }
.menu-botao::before { content: '☰'; font-size: 1.1rem; }
.menu { display: flex; flex-wrap: wrap; gap: .25rem 1.1rem; width: 100%; }
.menu a { color: #fff; text-decoration: none; padding: .55rem 0; font-weight: 600; }
.menu a:hover { text-decoration: underline; }
.heroi { max-width: 1040px; margin: 0 auto; padding: .5rem 1rem 1.25rem; }
.heroi h1 { color: #fff; }
.heroi p { margin: .25rem 0; color: #E3F1FB; font-size: 1.05rem; }
.heroi .heroi-sobre { text-transform: uppercase; letter-spacing: .08em; font-size: .8rem; font-weight: 600; color: #FFE7C2; }
.heroi .atualizado { font-size: .88rem; }
.onda { display: block; width: 100%; height: 36px; fill: var(--areia); margin-top: -1px; }

main { max-width: 1040px; margin: 0 auto; padding: .5rem 1rem 2rem; }
.secao { margin: 2.25rem 0; }
.cartao { background: var(--branco); border: 1px solid var(--linha); border-radius: var(--raio); box-shadow: var(--sombra); padding: 1rem 1.1rem; }
.botao { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: .6rem 1.4rem; border-radius: 999px; background: var(--ambar); color: var(--rio-escuro); font-family: var(--titulo); font-weight: 800; text-decoration: none; border: 0; cursor: pointer; text-align: center; }
.botao:hover { background: #E8952A; }
.botao-secundario { display: inline-flex; align-items: center; min-height: 44px; padding: .5rem 1.2rem; border-radius: 999px; border: 2px solid var(--rio); background: transparent; color: var(--rio); font: 600 .95rem var(--texto); cursor: pointer; text-decoration: none; }
.selo-fonte { display: inline-flex; gap: .25rem; align-items: center; font-size: .8rem; font-weight: 600; color: var(--rio); background: #E6F2FA; border-radius: 999px; padding: .15rem .65rem; text-decoration: none; }
.aviso { display: flex; gap: .6rem; align-items: flex-start; background: var(--areia-escura); border-radius: 14px; padding: .7rem .9rem; font-size: .95rem; }
.aviso-icone { flex: 0 0 auto; width: 1.4rem; height: 1.4rem; border-radius: 50%; background: var(--rio-escuro); color: #fff; font: 800 .85rem/1.4rem var(--titulo); text-align: center; }
.nota { font-size: .85rem; color: var(--suave); }

.busca { width: 100%; min-height: 52px; padding: .7rem 1.2rem; border: 2px solid var(--rio); border-radius: 999px; font: 400 1.05rem var(--texto); background: var(--branco); color: var(--rio-escuro); }
.busca-pequena { min-height: 46px; font-size: 1rem; }
select { min-height: 46px; padding: .5rem 1rem; border: 2px solid var(--linha); border-radius: 999px; font: 400 1rem var(--texto); background: var(--branco); color: var(--rio-escuro); }
.sugestoes, .ordens { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; }
.chip { min-height: 44px; padding: .45rem 1rem; border-radius: 999px; border: 1px solid var(--linha); background: var(--branco); color: var(--rio-escuro); font: 600 .9rem var(--texto); cursor: pointer; }
.chip:hover { border-color: var(--rio); }
.chip[aria-pressed="true"] { background: var(--rio); border-color: var(--rio); color: #fff; }

.lista { list-style: none; padding: 0; margin: .5rem 0; }
.lista > li { padding: .7rem 0; border-bottom: 1px solid var(--linha); overflow-wrap: anywhere; }
ol.lista { list-style: decimal; padding-left: 1.4rem; }
ol.lista > li { padding-left: .25rem; }
.data { color: var(--suave); font-variant-numeric: tabular-nums; margin-right: .25rem; font-size: .9rem; }
.tag { display: inline-block; font-size: .78rem; background: #E6F2FA; color: var(--rio-escuro); border-radius: 999px; padding: .05rem .55rem; margin-right: .25rem; }
details { background: var(--branco); border: 1px solid var(--linha); border-radius: 14px; padding: .6rem .9rem; margin: .5rem 0; }
summary { cursor: pointer; font-weight: 600; min-height: 32px; }
.num { float: right; color: var(--suave); font-weight: 400; font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: .4rem; border-bottom: 1px solid var(--linha); }
.m-A { color: var(--falta); font-weight: 600; }
.m-AJ { color: var(--justificada); font-weight: 600; }
.m-P { color: var(--presente); }
.partido { color: var(--suave); font-size: .9rem; }

.proporcao { display: flex; height: 18px; border-radius: 999px; overflow: hidden; background: var(--linha); margin: .75rem 0 .5rem; }
.fatia { display: block; height: 100%; }
.g-melhoria { background: #0E6BA8; }
.g-cobranca { background: #5AB0DE; }
.g-homenagem { background: #F2A541; }
.g-lei { background: #1E7A46; }
.g-outros { background: #9AA5B1; }
.legenda { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-wrap: wrap; gap: .35rem 1rem; font-size: .9rem; }
.ponto { display: inline-block; width: .8rem; height: .8rem; border-radius: 50%; margin-right: .35rem; vertical-align: -1px; }

.grade-numeros { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
.cartao-numero { display: flex; flex-direction: column; gap: .2rem; text-decoration: none; color: var(--rio-escuro); }
a.cartao-numero:hover { border-color: var(--rio); }
.numero-grande { font-family: var(--titulo); font-weight: 800; font-size: clamp(1.5rem, 6vw, 2rem); color: var(--rio); font-variant-numeric: tabular-nums; }
.numero-rotulo { font-size: .9rem; color: var(--suave); }

.filtros { display: grid; gap: .5rem; margin: .75rem 0; }
.cartoes { list-style: none; padding: 0; display: grid; gap: .9rem; grid-template-columns: minmax(0, 1fr); }
.cartao-vereador-topo { display: flex; gap: .8rem; align-items: center; text-decoration: none; color: var(--rio-escuro); }
.cartao-vereador-topo strong { display: block; font-family: var(--titulo); font-size: 1.1rem; }
.foto { border-radius: 50%; object-fit: cover; flex: 0 0 auto; background: #D6ECFA; }
.foto-iniciais { display: inline-flex; align-items: center; justify-content: center; font: 800 1.1rem var(--titulo); color: var(--rio); }
.presenca-resumo { margin: .8rem 0 .4rem; font-size: .9rem; }
.presenca-barra { display: block; height: 8px; border-radius: 999px; background: #F4E3E1; margin-top: .3rem; overflow: hidden; }
.presenca-preenchida { display: block; height: 100%; background: var(--presente); border-radius: 999px; }
.cartao-dados { display: grid; grid-template-columns: 1fr auto; gap: .2rem .75rem; margin: .5rem 0 0; font-size: .92rem; }
.cartao-dados dd { margin: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }

.perfil { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-top: .5rem; }
.perfil h1 { margin: 0; }
.credito { font-size: .8rem; color: var(--suave); margin: .25rem 0 0; }
.bolinhas { list-style: none; padding: 0; margin: .75rem 0; display: flex; flex-wrap: wrap; gap: 5px; }
.bolinha { width: 14px; height: 14px; border-radius: 50%; }
.b-P { background: var(--presente); }
.b-A { background: var(--falta); }
.b-AJ { background: var(--ambar); }
.b-vazio { background: #C9CED6; }

.votacao { margin: 1rem 0; }
.votacao-titulo { font-size: 1.15rem; margin: 0 0 .4rem; }
.eventos { list-style: none; padding: 0; margin: .5rem 0 0; }
.eventos > li { border-top: 1px solid var(--linha); padding: .6rem 0; }
.eventos p { margin: .2rem 0; }
.resultado { font-weight: 600; }
.etiqueta { display: inline-block; font-size: .78rem; font-weight: 600; border-radius: 999px; padding: .05rem .6rem; margin-right: .3rem; }
.etiqueta-contra { background: #FBE4E2; color: #8A1C15; }
.etiqueta-ausentes { background: #FDEBCB; color: var(--ambar-escuro); }

.contador-impostos { background: var(--branco); border: 3px solid var(--ambar); border-radius: 22px; box-shadow: var(--sombra); padding: 1.1rem; margin: 1rem 0; text-align: center; }
.contador-impostos .rotulo { margin: 0; color: var(--suave); font-weight: 600; }
.contador-impostos .valor { font-family: var(--titulo); font-weight: 800; color: var(--rio); font-size: clamp(1.7rem, 9vw, 2.4rem); margin: .2rem 0; font-variant-numeric: tabular-nums; }
.contador-impostos.grande .valor { font-size: clamp(1.9rem, 10vw, 3rem); }
.contador-impostos .por-morador { margin: .3rem 0; }
.contador-impostos .botao { margin-top: .5rem; }
.barras, .meses { list-style: none; padding: 0; }
.barras li { display: grid; grid-template-columns: minmax(0, 1fr); gap: .25rem; margin: .7rem 0; }
.trilho { display: block; background: #E6F2FA; border-radius: 999px; height: 12px; overflow: hidden; }
.barra { display: block; height: 100%; background: var(--rio); border-radius: 999px; }
.barra.anterior { background: #9CC7E6; }
.barras .num, .meses .num { float: none; color: var(--rio-escuro); font-weight: 600; }
.vazio { display: block; font-size: .7rem; line-height: 12px; color: var(--suave); padding-left: .4rem; }
.meses li { margin: .7rem 0; }
.meses .rotulo { font-weight: 600; }
.meses .par div { display: grid; grid-template-columns: 3rem minmax(0, 1fr) 7.5rem; gap: .5rem; align-items: center; font-size: .85rem; }
.meses .par .num { text-align: right; }

.chamadas { display: grid; gap: .9rem; }
.chamada { display: flex; flex-direction: column; gap: .25rem; text-decoration: none; color: var(--rio-escuro); }
.chamada strong { font-family: var(--titulo); font-size: 1.15rem; color: var(--rio); }
.sumario { display: flex; flex-wrap: wrap; gap: .5rem; margin: .5rem 0 1.5rem; }

.rodape { background: var(--rio-escuro); color: #E7EEF5; margin-top: 3rem; }
.rodape-dentro { max-width: 1040px; margin: 0 auto; padding: 1.75rem 1rem; font-size: .92rem; }
.rodape a { color: #FFD79A; }
.rodape-marca { font-family: var(--titulo); font-weight: 800; font-size: 1.2rem; color: #fff; }

@media (max-width: 767px) {
  .js .menu-botao { display: inline-flex; }
  .js .menu { display: none; flex-direction: column; gap: 0; padding: .25rem 0 .5rem; }
  .js .menu.aberto { display: flex; }
  .js .menu a { padding: .7rem 0; border-top: 1px solid rgb(255 255 255 / 20%); }
}
@media (min-width: 768px) {
  .menu { width: auto; }
  .filtros { grid-template-columns: 2fr 1fr; }
  .cartoes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grade-numeros { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .chamadas { grid-template-columns: 1fr 1fr; }
  .barras li { grid-template-columns: 11rem minmax(0, 1fr) 11rem; align-items: center; }
  .barras .num { text-align: right; }
}
@media (min-width: 1024px) {
  .cartoes { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 4: Substituir `site/busca.js` inteiro**

```js
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dataBR = (d) => (d ? d.split('-').reverse().join('/') : 'sem data');
  const ficha = (id) => `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:78:::::P78_ID_PROJETO:${esc(id)}`;
  let dados = null;
  const carregar = async () => dados || (dados = await (await fetch('dados/busca.json')).json());
  const item = ([id, data, , autores, ementa, doc]) =>
    `<li><span class="data">${esc(dataBR(data))}</span> <strong>${esc(autores)}</strong> <span class="tag">${esc(doc)}</span> ${esc(ementa)} <a href="${ficha(id)}" target="_blank" rel="noopener">ficha oficial</a></li>`;

  // Menu do celular
  const botaoMenu = document.querySelector('.menu-botao');
  const menu = document.getElementById('menu-principal');
  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', () => {
      const aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
      botaoMenu.setAttribute('aria-expanded', String(!aberto));
      menu.classList.toggle('aberto', !aberto);
    });
  }

  // Busca por bairro ou rua (+ sugestões tocáveis)
  const campo = document.getElementById('busca-bairro');
  if (campo) {
    const saida = document.getElementById('resultado-busca');
    let espera;
    campo.addEventListener('input', () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const q = norm(campo.value);
        if (q.length < 3) { saida.innerHTML = ''; return; }
        const d = await carregar();
        const idx = new Set();
        const nomes = [];
        for (const [nome, lista] of d.l) {
          if (norm(nome).includes(q)) { nomes.push(nome); lista.forEach((i) => idx.add(i)); }
        }
        const itens = [...idx].map((i) => d.p[i]).sort((a, b) => b[1].localeCompare(a[1]));
        saida.innerHTML = itens.length
          ? `<p>${itens.length} ${itens.length === 1 ? 'pedido' : 'pedidos'} para: ${nomes.slice(0, 8).map(esc).join(', ')}${nomes.length > 8 ? '…' : ''}</p><ul class="lista">${itens.slice(0, 200).map(item).join('')}</ul>${itens.length > 200 ? '<p>Mostrando os 200 mais recentes.</p>' : ''}`
          : '<p>Nada encontrado. Tente outro nome ou só uma parte dele.</p>';
      }, 250);
    });
    for (const chip of document.querySelectorAll('[data-busca]')) {
      chip.addEventListener('click', () => {
        campo.value = chip.dataset.busca;
        campo.dispatchEvent(new Event('input'));
        campo.focus();
      });
    }
  }

  // Grupos "Homenagem ou trabalho?" carregam ao abrir
  for (const det of document.querySelectorAll('details.grupo')) {
    det.addEventListener('toggle', async () => {
      const ul = det.querySelector('.lista');
      if (!det.open || ul.dataset.ok) return;
      const d = await carregar();
      const itens = d.p.filter((p) => p[2] === det.dataset.grupo);
      ul.innerHTML = itens.slice(0, 500).map(item).join('') + (itens.length > 500 ? '<li>Mostrando as 500 mais recentes. Veja todas na página de cada vereador.</li>' : '');
      ul.dataset.ok = '1';
    });
  }

  // "O problema que não some": mostra 10 e um botão "ver mais"
  const verMais = document.getElementById('ver-mais-repetidos');
  if (verMais) {
    const extras = [...document.querySelectorAll('#repetidos [data-extra]')];
    extras.forEach((li) => { li.hidden = true; });
    verMais.hidden = false;
    verMais.addEventListener('click', () => {
      extras.forEach((li) => { li.hidden = false; });
      verMais.hidden = true;
    });
  }

  // Filtro e ordem dos vereadores (ordem por botões)
  const lista = document.getElementById('lista-vereadores');
  if (lista) {
    const nome = document.getElementById('filtro-nome');
    const partido = document.getElementById('filtro-partido');
    const botoesOrdem = [...document.querySelectorAll('[data-ordem]')];
    let ordem = 'nome';
    const aplicar = () => {
      const q = norm(nome ? nome.value : '');
      const pt = partido ? partido.value : '';
      const cartoes = [...lista.children];
      cartoes.sort((a, b) => (ordem === 'nome' ? 0 : Number(b.dataset[ordem]) - Number(a.dataset[ordem])) || a.dataset.nome.localeCompare(b.dataset.nome, 'pt-BR'));
      for (const c of cartoes) {
        c.hidden = Boolean((q && !norm(c.dataset.nome).includes(q)) || (pt && c.dataset.partido !== pt));
        lista.appendChild(c);
      }
    };
    for (const b of botoesOrdem) {
      b.addEventListener('click', () => {
        ordem = b.dataset.ordem;
        botoesOrdem.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        aplicar();
      });
    }
    [nome, partido].filter(Boolean).forEach((el) => el.addEventListener('input', aplicar));
    aplicar();
  }

  // Contador de salário (só existe na página se houver fonte oficial)
  const sal = document.getElementById('contador-salario');
  if (sal) {
    const porMs = (Number(sal.dataset.mensal) * 12) / (365.25 * 24 * 3600 * 1000);
    const inicio = new Date(`${sal.dataset.inicio}T00:00:00-03:00`).getTime();
    const tique = () => { sal.textContent = ((Date.now() - inicio) * porMs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); };
    tique();
    setInterval(tique, 1000);
  }

  // Impostômetro: oficial + ritmo diário × dias desde o início da estimativa (para em 31/12).
  const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  for (const el of document.querySelectorAll('.contador-impostos')) {
    const oficial = Number(el.dataset.oficial);
    const ritmo = Number(el.dataset.ritmo);
    const inicio = Number(el.dataset.inicio);
    const fim = Number(el.dataset.fim);
    const pop = Number(el.dataset.populacao);
    const valor = el.querySelector('.valor');
    const porMorador = el.querySelector('.por-morador strong');
    const tique = () => {
      const v = oficial + ritmo * Math.max(0, (Math.min(Date.now(), fim) - inicio) / 86400000);
      valor.textContent = moeda(v);
      if (porMorador && pop) porMorador.textContent = moeda(v / pop);
    };
    tique();
    setInterval(tique, 1000);
  }
})();
```

- [ ] **Step 5: Gerar e verificar**

Run: `npm run checar && npm run processar`
Expected: tudo `ok` e "Pronto.".

Confira:
- `dist/fontes/` tem os 3 arquivos `.woff2`;
- `dist/fotos/` tem 11 imagens;
- `dist/index.html` contém `class="menu-botao"` e `class="onda"`.

As páginas ainda usam as estruturas antigas. É esperado: a Task 3 troca três delas e a Task 4 troca as outras duas.

- [ ] **Step 6: Commit**

```bash
git add src/site/base.js src/gerar-site.js site/estilo.css site/busca.js
git commit -m "feat: base do visual Salto vivo (layout, cores, fontes, menu, fotos no site)"
```

---

### Task 3: Páginas Impostômetro, Votações e Fontes

**Files:**
- Create: `src/site/impostometro.js`, `src/site/votacoes.js`, `src/site/fontes.js`
- Modify: `src/gerar-site.js`

**Interfaces:**
- Consumes:
  - de `src/site/base.js` (Task 2): `layout`, `dataBR`, `reais`, `numero`, `link`, `seloFonte`, `aviso`;
  - de `src/regras/receitas.js`: `GRUPOS_RECEITA`, `TIPOS_IMPOSTO`;
  - de `src/config.js`: `POPULACAO`, `AUTOR`, `SALARIO`, `ANO_INICIO`.
- Produces:
  - `blocoContador(r, prefixo, grande)` e `paginaImpostometro(d)`, em `src/site/impostometro.js`;
  - `paginaVotacoes(d)`, em `src/site/votacoes.js`;
  - `paginaFontes(d)`, em `src/site/fontes.js`.

- [ ] **Step 1: Escrever `src/site/impostometro.js`**

```js
import { POPULACAO } from '../config.js';
import { esc } from '../util/texto.js';
import { GRUPOS_RECEITA, TIPOS_IMPOSTO } from '../regras/receitas.js';
import { layout, dataBR, reais, seloFonte, aviso } from './base.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const instanteBR = (dia) => Date.parse(`${dia}T00:00:00-03:00`);

// Contador: o HTML traz o valor OFICIAL (sem JavaScript, nada é estimado); busca.js troca pelo valor correndo.
export function blocoContador(r, prefixo, grande) {
  const ritmo = `estimativa pelo ritmo dos últimos ${r.mesesRitmo} meses publicados`;
  const oficialAte = r.temOficialAno
    ? `Oficial até ${dataBR(r.fimOficial)}: ${reais(r.oficialAno)} · daqui em diante é ${ritmo}.`
    : `Ainda não há mês oficial de ${r.anoAtual}: todo o valor é ${ritmo}.`;
  return `<div class="contador-impostos${grande ? ' grande' : ''}" data-oficial="${r.oficialAno}" data-ritmo="${r.ritmoDiario}" data-inicio="${instanteBR(r.inicioEstimativa)}" data-fim="${instanteBR(`${r.anoAtual + 1}-01-01`)}" data-populacao="${POPULACAO.valor}">
<p class="rotulo">Impostos e taxas pagos à cidade em ${r.anoAtual}</p>
<p class="valor" aria-live="off">${reais(r.oficialAno)}</p>
<p class="nota">(parte oficial + estimativa)</p>
<p class="por-morador">Dividido pelos ${POPULACAO.valor.toLocaleString('pt-BR')} moradores: <strong>${reais(r.oficialAno / POPULACAO.valor)}</strong> por pessoa</p>
<p class="nota">${esc(oficialAte)}</p>
<p>${seloFonte('https://transparencia.tce.sp.gov.br/', 'fonte: TCE-SP')}</p>
${grande ? '' : `<p><a class="botao" href="${prefixo}impostometro.html">De onde vem o dinheiro de Salto →</a></p>`}
</div>`;
}

const barras = (pares, total) => `<ul class="barras">${pares.map(([rotulo, v]) => `<li><span class="rotulo">${esc(rotulo)}</span><span class="trilho"><span class="barra" style="width:${total > 0 ? Math.max(0, (v / total) * 100).toFixed(1) : 0}%"></span></span><span class="num">${reais(v)}${total > 0 ? ` <small>(${((v / total) * 100).toFixed(1).replace('.', ',')}%)</small>` : ''}</span></li>`).join('')}</ul>`;

export function paginaImpostometro(d) {
  const r = d.receitas;
  const tipos = Object.entries(r.tiposPainel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS_IMPOSTO[k] || k, v]);
  const totalTipos = tipos.reduce((s, [, v]) => s + v, 0);
  const grupos = Object.entries(r.gruposPainel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [GRUPOS_RECEITA[k] || k, v]);
  const totalGrupos = grupos.reduce((s, [, v]) => s + v, 0);
  const anoAnt = r.anoAnterior;
  const serieAtual = r.serie[r.anoAtual];
  const serieAnt = r.serie[anoAnt.ano];
  const maiorMes = Math.max(1, ...serieAtual.filter((v) => v !== null), ...serieAnt.filter((v) => v !== null));
  const linhaMes = (ano, v) => v === null
    ? `<span class="trilho"><span class="vazio">ainda não publicado</span></span><span class="num"></span>`
    : `<span class="trilho"><span class="barra${ano === r.anoAtual ? '' : ' anterior'}" style="width:${((v / maiorMes) * 100).toFixed(1)}%"></span></span><span class="num">${reais(v)}</span>`;
  const meses = MESES.map((nome, i) => `<li><span class="rotulo">${nome}</span><div class="par"><div><span>${anoAnt.ano}</span>${linhaMes(anoAnt.ano, serieAnt[i])}</div><div><span>${r.anoAtual}</span>${linhaMes(r.anoAtual, serieAtual[i])}</div></div></li>`).join('');
  const ultimoIdx = serieAnt.reduce((acc, v, i) => (v === null ? acc : i), -1);
  const fechamento = anoAnt.fechado
    ? `${anoAnt.ano} fechado em ${reais(anoAnt.total)} (oficial).`
    : ultimoIdx < 0
      ? `${anoAnt.ano}: nenhum mês publicado.`
      : `${anoAnt.ano}: ${reais(anoAnt.total)} oficial até ${NOMES_MES[ultimoIdx]}.`;
  const avisoPainel = r.anoPainel !== r.anoAtual ? aviso(`Ainda não há mês oficial de ${r.anoAtual}; os quadros abaixo mostram ${r.anoPainel}.`) : '';

  const corpo = `<h1>Impostômetro de Salto</h1>
${blocoContador(r, '', true)}
<p>A parte oficial é o que a Prefeitura registrou no Tribunal de Contas do Estado (TCE-SP), que publica os números com cerca de um mês e meio de atraso. Depois do último mês oficial, o contador sobe no ritmo médio dos últimos ${r.mesesRitmo} meses publicados: é uma estimativa e se corrige sozinha quando sai um mês novo.</p>
${aviso(esc(fechamento))}
${avisoPainel}
<section class="secao cartao">
<h2>Os impostos da cidade em ${r.anoPainel}</h2>
<p>Impostos e taxas que o morador e as empresas pagam direto à Prefeitura. O Imposto de Renda retido é o que a Prefeitura desconta dos salários e de outros pagamentos que faz e, por lei, fica com a cidade.</p>
${barras(tipos, totalTipos)}
</section>
<section class="secao cartao">
<h2>Mês a mês</h2>
<ul class="meses">${meses}</ul>
</section>
<section class="secao cartao">
<h2>De onde vem o dinheiro de Salto</h2>
<p>Toda a arrecadação oficial de ${r.anoPainel}, até o último mês publicado. Os repasses do Estado e da União vêm, em boa parte, de impostos que eles arrecadam (como ICMS, IPVA e Imposto de Renda) e dividem com as cidades por regras da lei.</p>
${barras(grupos, totalGrupos)}
<p class="nota">Ficaram fora do total ${reais(r.foraPainel)} que só passaram de um órgão público da cidade para outro (receitas intraorçamentárias), para não contar o mesmo dinheiro duas vezes.</p>
</section>
<section id="fontes-impostometro" class="secao">
<h2>De onde vêm os números</h2>
<ul>
<li><a href="https://transparencia.tce.sp.gov.br/">Portal da Transparência Municipal do TCE-SP</a>, receitas de Salto mês a mês. Os dados vêm da API pública https://transparencia.tce.sp.gov.br/api/json/receitas/salto/&lt;ano&gt;/&lt;mês&gt;. Último mês oficial: ${r.ultimoMesOficial ? esc(r.ultimoMesOficial.split('-').reverse().join('/')) : 'nenhum'}.</li>
<li>População: ${POPULACAO.valor.toLocaleString('pt-BR')} habitantes. Fonte: ${esc(POPULACAO.fonte)}.</li>
<li>Tipos de imposto: IPTU e ITBI (códigos 1112), Imposto de Renda retido (1113), ISS (1114) e Taxas (112).</li>
<li>Grupos: impostos da cidade (códigos 111 e 112), repasses do Estado (172 e 242), repasses da União (171 e 241), FUNDEB (175), empréstimos (21), água e esgoto (tudo o que entra no SAAE) e outras receitas (o resto).</li>
</ul>
</section>`;
  return layout({ titulo: 'Impostômetro de Salto: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
```

- [ ] **Step 2: Escrever `src/site/votacoes.js`**

```js
import { esc } from '../util/texto.js';
import { layout, dataBR, seloFonte, aviso, numero } from './base.js';

export function paginaVotacoes(d) {
  const nome = Object.fromEntries(d.vereadores.map((v) => [v.id, v.nome]));
  const nomes = (ids) => ids.map((id) => esc(nome[id])).join(', ');
  const totalEventos = d.votacoes.reduce((s, p) => s + p.eventos.length, 0);
  const artigos = d.votacoes.map((pj) => `<article class="cartao votacao">
<h2 class="votacao-titulo">${esc(pj.rotulo)}</h2>
<p>${esc(pj.ementa)}</p>
<p class="partido">Autor: ${esc(pj.autor)}</p>
<ul class="eventos">${pj.eventos.map((e) => `<li>
<p class="resultado"><span class="data">${dataBR(e.data)}</span> ${e.turno ? `${esc(e.turno)}: ` : ''}${esc(e.resultado)}</p>
${e.contra.length ? `<p><span class="etiqueta etiqueta-contra">Contra</span> ${nomes(e.contra)}</p>` : ''}
${e.ausentes.length ? `<p><span class="etiqueta etiqueta-ausentes">Ausentes</span> ${nomes(e.ausentes)}</p>` : ''}
<p>${seloFonte(e.url, 'PDF oficial')}</p>
</li>`).join('')}</ul>
</article>`).join('\n');
  const corpo = `<h1>Votações</h1>
<p>${numero(d.votacoes.length)} projetos e ${numero(totalEventos)} votações registradas no documento oficial da Câmara.</p>
${aviso('Leitura do documento oficial "Resultado das votações", publicado pela Câmara. Ele só cita quem votou contra ou faltou, às vezes só pelo primeiro nome. Nome que não deu para identificar com certeza fica de fora.')}
${artigos}`;
  return layout({ titulo: 'Votações: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
```

- [ ] **Step 3: Escrever `src/site/fontes.js`**

```js
import { AUTOR, SALARIO, ANO_INICIO } from '../config.js';
import { esc } from '../util/texto.js';
import { layout, link, aviso } from './base.js';

export function paginaFontes(d) {
  const avisos = d.avisos && d.avisos.length
    ? `<ul>${d.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '<p>Nenhum aviso.</p>';
  const contagemNomes = new Map();
  for (const x of d.naoAtribuidos || []) if (x.fonte.startsWith('votação')) contagemNomes.set(x.nome, (contagemNomes.get(x.nome) || 0) + 1);
  const nomesSoltos = [...contagemNomes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const nomesHtml = nomesSoltos.length
    ? `<ul>${nomesSoltos.map(([nome, c]) => `<li>"${esc(nome)}": ${c} ${c === 1 ? 'registro' : 'registros'}</li>`).join('')}</ul>`
    : '<p>Nenhum.</p>';
  const corpo = `<h1>De onde vêm os números</h1>
<p>Tudo sai de fontes oficiais. Nada é digitado à mão, exceto a população do IBGE, que fica registrada no código com a fonte. O site é refeito todo dia de madrugada.</p>
<nav class="sumario" aria-label="Nesta página"><a class="chip" href="#fontes">Fontes</a><a class="chip" href="#regras">A regra das propostas</a><a class="chip" href="#ruas">Ruas e bairros</a><a class="chip" href="#presenca">Presença</a><a class="chip" href="#votacoes">Votações</a><a class="chip" href="#avisos">Avisos</a><a class="chip" href="#creditos">Fotos e fontes</a></nav>
<section id="fontes" class="secao cartao">
<h2>Fontes</h2>
<ul>
<li><strong>Propostas:</strong> <a href="https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92">portal de proposituras da Câmara</a>. Cada proposta tem link para a ficha oficial.</li>
<li><strong>Presença:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/presenca-dos-vereadores">PDFs mensais de presença</a>. P = presença, A = ausência, AJ = ausência justificada.</li>
<li><strong>Votações:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/votacao-tramitacao-dos-projetos">PDF anual "Resultado das votações"</a>.</li>
<li><strong>Impostos e receitas:</strong> <a href="impostometro.html#fontes-impostometro">API de receitas do TCE-SP</a>, usada no impostômetro.</li>
<li><strong>Vereadores e partidos:</strong> <a href="https://www.camarasalto.sp.gov.br/">página inicial da Câmara</a>.</li>
</ul>
</section>
<section id="regras" class="secao cartao">
<h2>Homenagem ou trabalho: a regra</h2>
<table><thead><tr><th>Tipo de documento</th><th>Grupo</th></tr></thead><tbody>
<tr><td>Indicação</td><td>Pedidos de melhoria nos bairros</td></tr>
<tr><td>Requerimento</td><td>Perguntas e cobranças</td></tr>
<tr><td>Moção de aplauso, congratulação, parabéns, pesar, homenagem ou reconhecimento</td><td>Homenagens</td></tr>
<tr><td>Moção de apelo, repúdio ou apoio</td><td>Outros</td></tr>
<tr><td>Decreto Legislativo de título de cidadão, honra ao mérito, honraria, medalha, comenda ou diploma</td><td>Homenagens</td></tr>
<tr><td>Lei ou resolução que dá nome a rua ou prédio, ou cria dia, semana ou data comemorativa</td><td>Homenagens</td></tr>
<tr><td>Demais leis, resoluções, decretos legislativos, emendas à Lei Orgânica e iniciativa popular</td><td>Propostas de lei</td></tr>
<tr><td>Ato da Presidência, Atos da Mesa e Portaria</td><td>Não contam para nenhum vereador</td></tr>
</tbody></table>
<p>Proposta com mais de um autor conta para cada autor. Propostas de comissões, da Mesa, de frentes parlamentares e da Prefeitura não contam para nenhum vereador.</p>
</section>
<section id="ruas" class="secao cartao">
<h2>Ruas e bairros</h2>
<p>O nome da rua e do bairro é lido do próprio texto do pedido. Quando o texto não deixa claro o lugar, o pedido continua no site, mas fica fora da busca por bairro. "O problema que não some" junta pedidos do mesmo tipo (buraco, asfalto, iluminação, limpeza, bueiro, sinalização, poda, lixo) para a mesma rua, a partir de 2 pedidos.</p>
${aviso('Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.')}
</section>
<section id="presenca" class="secao cartao">
<h2>Presença</h2>
<p>Contamos as marcas P, A e AJ dos PDFs oficiais. "Quem mais faltou" conta só as ausências sem justificativa (A). Dado ausente não é falta: célula vazia não conta. As sessões extraordinárias aparecem junto com as ordinárias.</p>
</section>
<section id="votacoes" class="secao cartao">
<h2>Votações</h2>
<p>O PDF oficial informa o resultado e cita, às vezes só pelo primeiro nome, quem votou contra ou faltou. O primeiro nome é ligado ao vereador. Se um nome não bater com exatamente um vereador, ele fica de fora. Um voto só é ligado ao vereador se ele aparece na tabela de presença daquele mês (quando ela existe). O site não deduz votos a favor.</p>
</section>
<section id="avisos" class="secao cartao">
<h2>Avisos sobre os dados oficiais</h2>
<p>Quando um documento oficial traz algo fora do padrão, o site avisa aqui em vez de esconder.</p>
${avisos}
<h3>Nomes nas votações que não deu para ligar a um vereador</h3>
<p>Estes nomes aparecem nos PDFs de votação, mas não bateram com exatamente um vereador (apelidos, grafias diferentes ou vereador fora da tabela de presença do mês). O site não atribui esses votos a ninguém.</p>
${nomesHtml}
</section>
<section id="creditos" class="secao cartao">
<h2>Fotos e fontes</h2>
<p>Fotos dos vereadores: Câmara Municipal de Salto (site oficial).</p>
<p>Fontes tipográficas: Nunito e Inter, sob a licença SIL Open Font License.</p>
</section>
${SALARIO ? `<section class="secao cartao"><h2>Salário</h2><p>O contador multiplica o salário mensal oficial pelo número de vereadores, desde 1º de janeiro de ${ANO_INICIO}. É uma estimativa. ${link(SALARIO.fonte, 'Fonte oficial do valor')}.</p></section>` : ''}
<section class="secao cartao">
<h2>Achou um erro?</h2>
<p>Me chama no Instagram <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>. Se a Câmara corrigir o dado na fonte, o site se corrige sozinho na próxima atualização.</p>
</section>`;
  return layout({ titulo: 'De onde vêm os números: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
```

- [ ] **Step 4: `src/gerar-site.js`**

1. Apague as definições locais de `MESES`, `instanteBR`, `NOMES_MES`, `blocoContador`, `barras`, `paginaVotacoes`, `paginaImpostometro` e `paginaFontes`.
2. Acrescente aos imports:
   ```js
   import { blocoContador, paginaImpostometro } from './site/impostometro.js';
   import { paginaVotacoes } from './site/votacoes.js';
   import { paginaFontes } from './site/fontes.js';
   ```
3. Remova os imports que não forem mais usados (o Node não reclama, mas mantenha o arquivo limpo).

`paginaInicial` e `paginaVereador` continuam neste arquivo até a Task 4.

- [ ] **Step 5: Gerar e verificar**

Run: `npm run checar && npm run processar`
Expected: tudo `ok` e "Pronto.".

Num script descartável na pasta scratchpad, confirme:
- `dist/impostometro.html` contém "Impostômetro de Salto", "Oficial até 30/09/2026", "fonte: TCE-SP" e "De onde vem o dinheiro de Salto";
- `dist/votacoes.html` contém `class="cartao votacao"` e `etiqueta-contra`, e nenhum `<h3>` aparece antes de um `<h2>`;
- `dist/fontes.html` contém `id="creditos"`, `id="avisos"` e o sumário.

- [ ] **Step 6: Commit**

```bash
git add src/site/impostometro.js src/site/votacoes.js src/site/fontes.js src/gerar-site.js
git commit -m "feat: visual novo no impostômetro, votações e fontes"
```

---

### Task 4: Home e página do vereador

**Files:**
- Create: `src/site/inicio.js`, `src/site/vereador.js`
- Replace: `src/gerar-site.js` (fica só como organizador)

**Interfaces:**
- Consumes:
  - de `src/site/base.js`: `layout`, `dataBR`, `link`, `numero`, `aviso`, `foto`, `seloFonte`, `barraProporcao`, `cartaoNumero`, `quandoBR`, `GRUPOS_PUBLICOS`, `AVISO_NOMES`;
  - de `src/site/util.js`: `percentual`, `sugestoesBairros`;
  - `blocoContador`, `paginaImpostometro`, `paginaVotacoes` e `paginaFontes` (Task 3);
  - `GRUPOS` (`regras/classificar.js`), `TIPOS_NOME` (`regras/local.js`), `fichaOficial`, `SALARIO`, `ANO_INICIO` e `AUTOR` (config).
- Produces: `paginaInicial(d)` e `paginaVereador(v, d)`.
- Os atributos `data-*` dos cartões ficam iguais aos de hoje (`data-nome`, `data-partido`, `data-faltas`, `data-lei`, `data-homenagem`, `data-melhoria`, `data-contra`), porque o `busca.js` usa todos.

- [ ] **Step 1: Escrever `src/site/inicio.js`**

```js
import { SALARIO, ANO_INICIO, AUTOR, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { TIPOS_NOME } from '../regras/local.js';
import { esc } from '../util/texto.js';
import { layout, dataBR, link, numero, aviso, foto, barraProporcao, cartaoNumero, quandoBR, GRUPOS_PUBLICOS, AVISO_NOMES } from './base.js';
import { percentual, sugestoesBairros } from './util.js';
import { blocoContador } from './impostometro.js';

const ORDENS = [
  ['nome', 'Nome (A–Z)'],
  ['faltas', 'Quem mais faltou'],
  ['lei', 'Mais propostas de lei'],
  ['homenagem', 'Mais homenagens'],
  ['melhoria', 'Mais pedidos para os bairros'],
  ['contra', 'Quem mais votou contra'],
];

function cartaoVereador(v) {
  const pr = v.presenca;
  return `<li class="cartao cartao-vereador" data-nome="${esc(v.nome)}" data-partido="${esc(v.partido)}" data-faltas="${pr.A}" data-lei="${v.porGrupo.lei}" data-homenagem="${v.porGrupo.homenagem}" data-melhoria="${v.porGrupo.melhoria}" data-contra="${v.votosContra}">
<a class="cartao-vereador-topo" href="vereador/${esc(v.id)}.html">${foto(v, '', 64)}<span><strong>${esc(v.nome)}</strong><span class="partido">${esc(v.partido)}</span></span></a>
<div class="presenca-resumo"><span>Presença: <strong>${pr.P} de ${pr.total}</strong> sessões</span><span class="presenca-barra" aria-hidden="true"><span class="presenca-preenchida" style="width:${percentual(pr.P, pr.total)}%"></span></span></div>
<dl class="cartao-dados"><dt>Faltas</dt><dd>${pr.A}</dd><dt>Pedidos para os bairros</dt><dd>${v.porGrupo.melhoria}</dd><dt>Perguntas e cobranças</dt><dd>${v.porGrupo.cobranca}</dd><dt>Propostas de lei</dt><dd>${v.porGrupo.lei}</dd><dt>Homenagens</dt><dd>${v.porGrupo.homenagem}</dd><dt>Votou contra</dt><dd>${v.votosContra}</dd></dl>
</li>`;
}

export function paginaInicial(d) {
  const n = d.vereadores.length;
  const salario = SALARIO
    ? `<p class="destaque">Salário pago aos ${n} vereadores desde a posse: <strong id="contador-salario" data-mensal="${SALARIO.valorMensal * n}" data-inicio="${ANO_INICIO}-01-01">—</strong><br><small>Estimativa: ${n} salários de R$ ${SALARIO.valorMensal.toLocaleString('pt-BR')} por mês desde 1º de janeiro de ${ANO_INICIO}. ${link(SALARIO.fonte, 'fonte oficial')}</small></p>`
    : '';
  const repetidos = d.repetidos.slice(0, 30).map((r, i) =>
    `<li${i >= 10 ? ' data-extra' : ''}><strong>${esc(r.rua)}</strong>: ${esc(TIPOS_NOME[r.tipo] || r.tipo)}, pedido ${r.pedidos.length} vezes
<details><summary>ver datas e autores</summary><ul class="lista">${r.pedidos.map((p) => `<li><span class="data">${dataBR(p.data)}</span> ${esc(p.autores)} ${link(fichaOficial(p.id), 'ficha')}</li>`).join('')}</ul></details></li>`).join('\n');
  const extras = Math.max(0, Math.min(30, d.repetidos.length) - 10);
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, d.proposituras.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) =>
    `<details class="grupo" data-grupo="${g}"><summary>${esc(GRUPOS[g])} <span class="num">${contagem[g]}</span></summary><ul class="lista"></ul></details>`).join('\n');
  const proporcao = barraProporcao(GRUPOS_PUBLICOS.map((g) => ({ rotulo: GRUPOS[g], valor: contagem[g], classe: `g-${g}` })));
  const partidos = [...new Set(d.vereadores.map((v) => v.partido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sessoes = Math.max(0, ...d.vereadores.map((v) => v.presenca.total));
  const totalVotacoes = d.votacoes.reduce((s, p) => s + p.eventos.length, 0);
  const sugestoes = sugestoesBairros(d.locais);

  const heroi = `<p class="heroi-sobre">Salto · SP</p>
<h1>Salto de olho na Câmara</h1>
<p>O que cada vereador fez desde a posse, atualizado todo dia. Só dado oficial.</p>
<p class="atualizado">Atualizado em ${esc(quandoBR(d.meta.atualizadoEm))}</p>`;

  const corpo = `${salario}
${d.receitas ? blocoContador(d.receitas, '', false) : ''}
<section id="bairro" class="secao">
<h2>O que pediram pro seu bairro?</h2>
<p>Veja tudo o que os vereadores pediram para a sua rua ou o seu bairro, com link para o documento oficial.</p>
<label class="sr-only" for="busca-bairro">Nome do bairro ou da rua</label>
<input id="busca-bairro" class="busca" type="search" placeholder="Digite o bairro ou a rua" autocomplete="off">
${sugestoes.length ? `<div class="sugestoes" aria-label="Bairros com mais pedidos">${sugestoes.map((s) => `<button type="button" class="chip" data-busca="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
<div id="resultado-busca" aria-live="polite"></div>
</section>
<section class="secao" aria-labelledby="t-numeros">
<h2 id="t-numeros">A Câmara em números</h2>
<div class="grade-numeros">
${cartaoNumero({ valor: numero(d.proposituras.length), rotulo: `propostas desde ${ANO_INICIO}`, href: '#trabalho' })}
${cartaoNumero({ valor: numero(d.repetidos.length), rotulo: 'ruas com pedido repetido', href: '#repetidos' })}
${cartaoNumero({ valor: numero(sessoes), rotulo: 'sessões com presença registrada', href: '#vereadores' })}
${cartaoNumero({ valor: numero(totalVotacoes), rotulo: 'votações registradas', href: 'votacoes.html' })}
</div>
</section>
<section id="vereadores" class="secao">
<h2>Os ${n} vereadores</h2>
${aviso(AVISO_NOMES)}
<div class="filtros">
<input id="filtro-nome" class="busca busca-pequena" type="search" placeholder="Buscar por nome" aria-label="Buscar vereador por nome">
<select id="filtro-partido" aria-label="Filtrar por partido"><option value="">Todos os partidos</option>${partidos.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
</div>
<div class="ordens" role="group" aria-label="Ordenar vereadores">${ORDENS.map(([k, r], i) => `<button type="button" class="chip" data-ordem="${k}" aria-pressed="${i === 0}">${r}</button>`).join('')}</div>
<ul id="lista-vereadores" class="cartoes">
${d.vereadores.map(cartaoVereador).join('\n')}
</ul>
</section>
<section id="repetidos" class="secao">
<h2>O problema que não some</h2>
<p>Pedidos do mesmo tipo que voltaram mais de uma vez para a mesma rua. No site da Câmara, cada pedido aparece sozinho. Aqui eles são cruzados.</p>
${aviso('Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.')}
<ol class="lista cartao">${repetidos}</ol>
${extras ? `<p><button type="button" class="botao-secundario" id="ver-mais-repetidos" hidden>Ver mais ${extras} ruas</button></p>` : ''}
</section>
<section id="trabalho" class="secao">
<h2>Homenagem ou trabalho?</h2>
<p>Todas as propostas desde ${ANO_INICIO}, separadas pela mesma regra para todos os vereadores. <a href="fontes.html#regras">Veja a regra</a>.</p>
${proporcao}
${grupos}
</section>
<section class="secao chamadas">
<a class="cartao chamada" href="fontes.html"><strong>De onde vêm os números</strong><span>Todas as fontes oficiais e as regras usadas, para você conferir.</span></a>
<a class="cartao chamada" href="https://instagram.com/${AUTOR.instagram}"><strong>Achou um erro?</strong><span>Me chama no Instagram @${AUTOR.instagram}.</span></a>
</section>`;
  return layout({ titulo: 'Radar Saltense: o que cada vereador de Salto fez', corpo, atualizadoEm: d.meta.atualizadoEm, heroi });
}
```

- [ ] **Step 2: Escrever `src/site/vereador.js`**

```js
import { ANO_INICIO, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { esc } from '../util/texto.js';
import { layout, dataBR, link, aviso, foto, seloFonte, barraProporcao, cartaoNumero, GRUPOS_PUBLICOS, AVISO_NOMES } from './base.js';
import { percentual } from './util.js';

const ROTULO_MARCA = { P: 'presente', A: 'falta', AJ: 'falta justificada', vazio: 'sem registro' };

const itemProposta = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> ${esc(p.ementa)} ${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

export function paginaVereador(v, d) {
  const props = d.proposituras.filter((p) => p.vereadores.includes(v.id));
  const pres = d.presenca[v.id];
  const sessoes = [...pres.sessoes].reverse().map((s) =>
    `<tr><td>${dataBR(s.data)}</td><td class="m-${s.marca || 'vazio'}">${s.marca || '—'}</td><td>${link(s.url, 'PDF')}</td></tr>`).join('');
  const bolinhas = pres.sessoes.map((s) => {
    const marca = s.marca || 'vazio';
    const texto = `${dataBR(s.data)}: ${ROTULO_MARCA[marca]}`;
    return `<li class="bolinha b-${marca}" title="${texto}"><span class="sr-only">${texto}</span></li>`;
  }).join('');
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, props.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) => {
    const lista = props.filter((p) => p.grupo === g);
    return `<details><summary>${esc(GRUPOS[g])} <span class="num">${lista.length}</span></summary><ul class="lista">${lista.map(itemProposta).join('')}</ul></details>`;
  }).join('\n');
  const votos = (campo) =>
    d.votacoes.flatMap((pj) => pj.eventos.filter((e) => e[campo].includes(v.id)).map((e) =>
      `<li><span class="data">${dataBR(e.data)}</span> ${esc(pj.rotulo)}${e.turno ? ` (${esc(e.turno)})` : ''}: ${esc(e.resultado)} ${link(e.url, 'PDF')}</li>`)).join('') || '<li>Nenhum registro.</li>';
  const veja = d.avisos && d.avisos.length ? ' Veja os <a href="../fontes.html#avisos">avisos sobre os dados oficiais</a>.' : '';

  const corpo = `<section class="perfil cartao">
${foto(v, '../', 120)}
<div>
<h1>${esc(v.nome)}</h1>
<p class="partido">${esc(v.partido)}</p>
<p>${seloFonte(v.url, 'página oficial na Câmara')}</p>
${v.fotoLocal ? '<p class="credito">Foto: Câmara Municipal de Salto</p>' : ''}
</div>
</section>
<section class="secao">
<div class="grade-numeros">
${cartaoNumero({ valor: `${percentual(pres.P, pres.sessoes.length)}%`, rotulo: `de presença (${pres.P} de ${pres.sessoes.length} sessões)` })}
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
<details><summary>Sessão por sessão</summary><table><thead><tr><th>Data</th><th>Registro</th><th>Fonte</th></tr></thead><tbody>${sessoes}</tbody></table></details>
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
</section>`;
  return layout({ titulo: `${v.nome}: Radar Saltense`, corpo, prefixo: '../', atualizadoEm: d.meta.atualizadoEm });
}
```

- [ ] **Step 3: Substituir `src/gerar-site.js` inteiro**

```js
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { paginaInicial } from './site/inicio.js';
import { paginaVereador } from './site/vereador.js';
import { paginaVotacoes } from './site/votacoes.js';
import { paginaImpostometro } from './site/impostometro.js';
import { paginaFontes } from './site/fontes.js';

const FONTES = [
  ['node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2', 'nunito-800.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
];

export async function gerarSite(d, destino) {
  for (const pasta of ['vereador', 'dados', 'fontes', 'fotos']) await mkdir(`${destino}/${pasta}`, { recursive: true });
  await writeFile(`${destino}/index.html`, paginaInicial(d));
  for (const v of d.vereadores) await writeFile(`${destino}/vereador/${v.id}.html`, paginaVereador(v, d));
  await writeFile(`${destino}/votacoes.html`, paginaVotacoes(d));
  await writeFile(`${destino}/fontes.html`, paginaFontes(d));
  if (d.receitas) await writeFile(`${destino}/impostometro.html`, paginaImpostometro(d));
  const busca = {
    p: d.proposituras.map((p) => [p.id, p.data, p.grupo, p.autoresTexto, p.ementa, `${p.categoria} ${p.numero}`]),
    l: d.locais.map((l) => [l.nome, l.idx]),
  };
  await writeFile(`${destino}/dados/busca.json`, JSON.stringify(busca));
  await copyFile('site/estilo.css', `${destino}/estilo.css`);
  await copyFile('site/busca.js', `${destino}/busca.js`);
  for (const [origem, nome] of FONTES) await copyFile(origem, `${destino}/fontes/${nome}`);
  for (const v of d.vereadores) if (v.fotoLocal) await copyFile(`data/bruto/${v.fotoLocal}`, `${destino}/${v.fotoLocal}`);
  await writeFile(`${destino}/.nojekyll`, '');
}
```

Use os nomes reais dos arquivos de fonte que a Task 1 tiver registrado, se forem outros.

- [ ] **Step 4: Gerar e verificar**

Run: `npm run checar && npm run processar`
Expected: tudo `ok` e "Pronto.".

Num script descartável na pasta scratchpad, confirme em `dist/index.html`:
- existem "Salto de olho na Câmara", `class="sugestoes"` com até 6 botões `data-busca`, 4 `class="cartao cartao-numero"`, 11 `cartao-vereador`, 11 `<img class="foto"` e 6 botões `data-ordem`;
- existem `id="ver-mais-repetidos"`, `data-extra` e `class="proporcao"`;
- o peso de `index.html` + `estilo.css` + `busca.js` + `dist/fontes/*` é menor que 200 KB (informe o total).

Em `dist/vereador/almir-de-melo-santos.html`, confirme:
- `class="bolinhas"` com tantos `<li class="bolinha` quanto o número de sessões do Almir em `data/processado/dados.json`;
- "Foto: Câmara Municipal de Salto";
- os textos de aviso.

- [ ] **Step 5: Commit**

```bash
git add src/site/inicio.js src/site/vereador.js src/gerar-site.js
git commit -m "feat: nova home e nova página do vereador no visual Salto vivo"
```
