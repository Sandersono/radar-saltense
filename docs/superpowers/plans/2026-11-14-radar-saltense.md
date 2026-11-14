# Radar Saltense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um site estático que mostra, só com dados oficiais da Câmara de Salto/SP, presença, propostas, pedidos por bairro e votações de cada um dos 11 vereadores desde 01/01/2025, atualizado sozinho todo dia.

**Architecture:** Um robô em Node.js coleta três fontes: o portal APEX de proposituras (via Playwright), os PDFs mensais de presença e os PDFs anuais de votação (via pdfjs-dist). Depois aplica regras puras (classificação, rua e bairro, ligação de nomes), passa por uma barreira de conferência e gera HTML estático em `dist/`. O GitHub Actions roda tudo às 06:00 UTC e publica no GitHub Pages.

**Tech Stack:** Node.js ≥ 20 (local: v24.15.0), Playwright (Chromium), pdfjs-dist, HTML/CSS/JS sem framework, GitHub Actions + GitHub Pages.

Spec: `docs/superpowers/specs/2026-11-14-radar-saltense-design.md`

## Global Constraints

- Só dado oficial. Todo número tem link para a fonte oficial.
- A régua é a mesma para todos os vereadores, e as regras ficam publicadas em `fontes.html`.
- O site diz o que é estimativa. "Dado ausente não é falta." "Pedido repetido não prova que a Prefeitura ignorou."
- Período: desde `2025-01-01` (`ANO_INICIO = 2025`).
- Vereadores esperados: `11`.
- User-Agent: `RadarSaltense/1.0 (projeto civico independente; contato: instagram.com/sandersonoliveira1)`. Espera de 2000 ms entre downloads.
- Rodapé: "Radar Saltense é um projeto independente de Sanderson Oliveira, feito por morador, sem vínculo com a Câmara, com a Prefeitura ou com partido." Contato: Instagram @sandersonoliveira1.
- O contador de salário só aparece com fonte oficial (`SALARIO` em `src/config.js`; padrão `null`).
- Checagens: só `node:assert` em `check/regras.mjs`, rodadas com `node`. Sem framework de teste, sem stubs, sem ambiente simulado. Coletores e gerador de HTML não têm checagem automática; são verificados rodando de verdade.
- Em cada tarefa, todas as edições vão de uma vez, e a verificação roda uma vez no fim.
- Commits só com autorização do usuário. Os passos "Commit" marcam onde commitar.
- Os textos do site são em português simples, para o morador comum no celular, com fundo branco.
- Neste computador, o hook `hook-limpar-texto.py` reescreve os arquivos `.md`/`.html`/`.txt` gravados pelas ferramentas Write/Edit e colapsa a indentação. Grave arquivos `.md` (como o `README.md`) com outra extensão e renomeie com `mv`. Os arquivos `.js`, `.css`, `.yml` e `.json` não são afetados.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `.gitignore`, `README.md` | Projeto, scripts npm e passo a passo do usuário |
| `src/config.js` | Constantes: URLs, UA, anos, autor e salário |
| `src/util/texto.js` | `normalizar`, `limparHtml`, `slug`, `esc`, `esperar` |
| `src/regras/nomes.js` | Liga o nome ao vereador pelo primeiro nome e divide listas de nomes |
| `src/regras/classificar.js` | Grupo de cada propositura |
| `src/regras/local.js` | Rua, bairro e tipo de pedido |
| `src/regras/apex.js` | Converte um card do APEX em propositura |
| `src/regras/vereadores-html.js` | Lê os vereadores da página inicial da Câmara |
| `src/regras/presenca-html.js` | Links dos PDFs de presença; mês e ano pelo nome do arquivo |
| `src/regras/linhas.js` | Agrupa os itens de texto do PDF em linhas |
| `src/regras/presenca-pdf.js` | Lê a tabela de presença |
| `src/regras/votacao-pdf.js` | Lê o PDF de votações |
| `src/pdf.js` | Extrai do PDF os itens de texto com posição (pdfjs-dist) |
| `src/coleta/http.js` | Download educado, com cache |
| `src/coleta/vereadores.js`, `proposituras.js`, `presenca.js`, `votacoes.js` | Coletores |
| `src/coletar.js` | Roda todos os coletores e grava `data/bruto/coleta.json` |
| `src/processar.js` | Junta tudo no objeto de dados do site |
| `src/conferir.js` | Barreira de publicação |
| `src/relatorio.js` | Gera o `conferencia.md` |
| `src/gerar-site.js`, `src/gerar.js` | Geram o `dist/` |
| `src/atualizar.js` | Coleta, processa, confere e gera |
| `site/estilo.css`, `site/busca.js` | Visual e interações no navegador |
| `check/regras.mjs` | Checagens das funções puras |
| `.github/workflows/atualizar.yml` | Robô diário e publicação |

---

### Task 1: Base do projeto

**Files:**
- Create: `package.json`, `.gitignore`, `src/config.js`, `src/util/texto.js`, `check/regras.mjs`

**Interfaces:**
- Produces:
  - `config.js`: `CAMARA: string`, `APEX: string`, `UA: string`, `ANO_INICIO: 2025`, `VEREADORES_ESPERADOS: 11`, `ESPERA_MS: 2000`, `AUTOR: {nome, instagram}`, `SALARIO: null | {valorMensal:number, fonte:string}`, `anos(): number[]`, `fichaOficial(id): string`
  - `texto.js`: `normalizar(s): string`, `limparHtml(s): string`, `slug(s): string`, `esc(s): string`, `esperar(ms): Promise<void>`

- [ ] **Step 1: Iniciar o repositório e as dependências**

```bash
git init
npm init -y
npm install playwright pdfjs-dist
npx playwright install chromium
```

- [ ] **Step 2: Ajustar o `package.json` (mantém as dependências que o npm acabou de gravar)**

```bash
npm pkg set name=radar-saltense private=true --json
npm pkg set type=module engines.node=">=20"
npm pkg set scripts.checar="node check/regras.mjs" scripts.coletar="node src/coletar.js" scripts.atualizar="node src/atualizar.js" scripts.processar="node src/atualizar.js --usar-cache" scripts.gerar="node src/gerar.js" scripts.ver="python -m http.server 8080 -d dist"
npm pkg delete main scripts.test
```

- [ ] **Step 3: Escrever `.gitignore`**

```
node_modules/
dist/
conferencia.md
data/bruto/coleta.json
```

- [ ] **Step 4: Escrever `src/config.js`**

```js
export const CAMARA = 'https://www.camarasalto.sp.gov.br';
export const APEX = 'https://cmsalto.sisvetor.com.br/ords/cmsalto/f';
export const UA = 'RadarSaltense/1.0 (projeto civico independente; contato: instagram.com/sandersonoliveira1)';
export const ANO_INICIO = 2025;
export const VEREADORES_ESPERADOS = 11;
export const ESPERA_MS = 2000;
export const AUTOR = { nome: 'Sanderson Oliveira', instagram: 'sandersonoliveira1' };
// Só preencher com fonte oficial (lei de fixação do subsídio ou Portal da Transparência):
// export const SALARIO = { valorMensal: 0, fonte: 'https://...' };
export const SALARIO = null;

export function anos() {
  const fim = new Date().getFullYear();
  const lista = [];
  for (let a = ANO_INICIO; a <= fim; a++) lista.push(a);
  return lista;
}

export const fichaOficial = (id) => `${APEX}?p=742:78:::::P78_ID_PROJETO:${id}`;
```

- [ ] **Step 5: Escrever `src/util/texto.js`**

```js
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function limparHtml(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slug(s) {
  return normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
```

- [ ] **Step 6: Criar `check/regras.mjs` com a primeira seção**

```js
import assert from 'node:assert/strict';
import { normalizar, slug, limparHtml } from '../src/util/texto.js';

assert.equal(normalizar('  Antônio   Moreira '), 'antonio moreira');
assert.equal(slug('Luzia de Fátima Izidório Vidal'), 'luzia-de-fatima-izidorio-vidal');
assert.equal(limparHtml('a<br>b &amp; <strong>c</strong>'), 'a b & c');
console.log('ok: texto');
```

- [ ] **Step 7: Rodar a checagem**

Run: `npm run checar`
Expected: `ok: texto`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore src check docs
git commit -m "chore: base do projeto Radar Saltense"
```

---

### Task 2: Nomes e classificação

**Files:**
- Create: `src/regras/nomes.js`, `src/regras/classificar.js`
- Modify: `check/regras.mjs` (acrescentar seção no fim)

**Interfaces:**
- Consumes: `normalizar` (Task 1)
- Produces:
  - `primeiroNome(nome): string`
  - `criarCasador(vereadores: {id, nome}[]): (nome: string) => string | null`. Lança erro se dois vereadores tiverem o mesmo primeiro nome.
  - `dividirNomes(texto): string[]`
  - `GRUPOS: {melhoria, cobranca, homenagem, lei, outros, administrativo}` (rótulos para exibir)
  - `classificar(categoria, ementa): 'melhoria'|'cobranca'|'homenagem'|'lei'|'outros'|'administrativo'`

- [ ] **Step 1: Acrescentar ao fim de `check/regras.mjs`**

```js
import { criarCasador, dividirNomes } from '../src/regras/nomes.js';
import { classificar } from '../src/regras/classificar.js';

{
  const casar = criarCasador([
    { id: 'antonio', nome: 'Antônio Moreira Sobrinho' },
    { id: 'rogerio', nome: 'Rogério dos Santos Filho' },
    { id: 'edival', nome: 'Edival Pereira Rosa' },
  ]);
  assert.equal(casar('Antonio Moreira Sobrinho'), 'antonio');
  assert.equal(casar('Rogério'), 'rogerio');
  assert.equal(casar('Edival Pereira Rosa Preto'), 'edival');
  assert.equal(casar('Comissão de Finanças'), null);
  assert.equal(casar('Prefeitura da Estância Turística de Salto'), null);
  assert.throws(() => criarCasador([{ id: 'a', nome: 'Ana X' }, { id: 'b', nome: 'Ana Y' }]));
  assert.deepEqual(dividirNomes('Graziela, Michel, Antônio'), ['Graziela', 'Michel', 'Antônio']);
  assert.deepEqual(dividirNomes('e Arildo'), ['Arildo']);
  assert.deepEqual(dividirNomes('Graziela e Edemilson'), ['Graziela', 'Edemilson']);
  console.log('ok: nomes');
}

{
  assert.equal(classificar('Indicação', 'Solicitando tamponamento'), 'melhoria');
  assert.equal(classificar('Requerimento', 'Solicitando informações'), 'cobranca');
  assert.equal(classificar('Moção', 'Moção de Congratulações aos profissionais'), 'homenagem');
  assert.equal(classificar('Moção', 'Moção de Pesar pelo falecimento'), 'homenagem');
  assert.equal(classificar('Moção', 'Moção de repúdio ao aumento da tarifa'), 'outros');
  assert.equal(classificar('Decreto Legislativo', 'Concede Título de Cidadão Salteense a Fulano'), 'homenagem');
  assert.equal(classificar('Decreto Legislativo', 'Institui a honraria Maria de Lourdes Guarda'), 'homenagem');
  assert.equal(classificar('Lei Ordinária', 'Denomina Rua Fulano de Tal'), 'homenagem');
  assert.equal(classificar('Lei Ordinária', 'Institui o Dia Municipal do Ciclista'), 'homenagem');
  assert.equal(classificar('Lei Ordinária', 'Institui sobre o Selo Empresa Amiga 60+'), 'lei');
  assert.equal(classificar('Ementa Lei Orgânica', 'Modifica a redação do Art. 73'), 'lei');
  assert.equal(classificar('Portaria', 'Designa servidor'), 'administrativo');
  assert.equal(classificar('Atos da Mesa', 'Ponto facultativo'), 'administrativo');
  console.log('ok: classificar');
}
```

- [ ] **Step 2: Escrever `src/regras/nomes.js`**

```js
import { normalizar } from '../util/texto.js';

export function primeiroNome(nome) {
  return normalizar(nome).split(' ')[0] || '';
}

export function criarCasador(vereadores) {
  const mapa = new Map();
  for (const v of vereadores) {
    const p = primeiroNome(v.nome);
    if (mapa.has(p)) throw new Error(`Primeiro nome repetido entre vereadores: "${p}". Revise a regra de nomes.`);
    mapa.set(p, v.id);
  }
  return (nome) => mapa.get(primeiroNome(nome)) ?? null;
}

export function dividirNomes(texto) {
  return String(texto ?? '')
    .split(/\s*(?:,|;|\s+e\s+)\s*/)
    .map((s) => s.trim().replace(/^e\s+/i, '').trim())
    .filter(Boolean);
}
```

- [ ] **Step 3: Escrever `src/regras/classificar.js`**

```js
import { normalizar } from '../util/texto.js';

export const GRUPOS = {
  melhoria: 'Pedidos de melhoria nos bairros',
  cobranca: 'Perguntas e cobranças',
  homenagem: 'Homenagens',
  lei: 'Propostas de lei',
  outros: 'Outros',
  administrativo: 'Atos administrativos (não contam por vereador)',
};

const HOMENAGEM_MOCAO = /(aplauso|congratula|parabeniza|pesar|homenage|reconhecimento)/;
const HONRARIA = /(titulo de cidadao|cidadao (salteense|honorario|emerito)|honra ao merito|honraria|medalha|comenda|diploma)/;
const NOME_OU_DATA = /(denomina|da denominacao|institui (o|a) (dia|semana|mes)|data comemorativa|calendario oficial)/;
const ADMINISTRATIVO = ['ato da presidencia', 'atos da mesa', 'portaria'];
const PODE_SER_HOMENAGEM = ['lei ordinaria', 'lei complementar', 'resolucao', 'decreto legislativo'];
const LEI = ['lei ordinaria', 'lei complementar', 'ementa lei organica', 'resolucao', 'decreto legislativo', 'iniciativa popular'];

export function classificar(categoria, ementa) {
  const c = normalizar(categoria);
  const e = normalizar(ementa);
  if (c === 'indicacao') return 'melhoria';
  if (c === 'requerimento') return 'cobranca';
  if (c === 'mocao') return HOMENAGEM_MOCAO.test(e) ? 'homenagem' : 'outros';
  if (ADMINISTRATIVO.includes(c)) return 'administrativo';
  if (c === 'decreto legislativo' && HONRARIA.test(e)) return 'homenagem';
  if (PODE_SER_HOMENAGEM.includes(c) && NOME_OU_DATA.test(e)) return 'homenagem';
  if (LEI.includes(c)) return 'lei';
  return 'outros';
}
```

- [ ] **Step 4: Rodar a checagem**

Run: `npm run checar`
Expected: `ok: texto`, `ok: nomes`, `ok: classificar`

- [ ] **Step 5: Commit**

```bash
git add src/regras/nomes.js src/regras/classificar.js check/regras.mjs
git commit -m "feat: regras de nomes e classificação das propostas"
```

---

### Task 3: Rua, bairro e tipo de pedido

**Files:**
- Create: `src/regras/local.js`
- Modify: `check/regras.mjs` (acrescentar seção)

**Interfaces:**
- Consumes: `normalizar` (Task 1)
- Produces:
  - `extrairLocais(ementa): {tipo: 'rua'|'bairro', nome: string, chave: string}[]`, na ordem em que aparecem no texto e sem repetição
  - `tiposPedido(ementa): string[]`, com valores entre `buraco`, `asfalto`, `iluminacao`, `limpeza`, `drenagem`, `sinalizacao`, `arvore`, `lixo`
  - `TIPOS_NOME: Record<string,string>` (rótulos para exibir)

- [ ] **Step 1: Acrescentar ao fim de `check/regras.mjs`**

```js
import { extrairLocais, tiposPedido } from '../src/regras/local.js';

{
  const fmt = (t) => extrairLocais(t).map((l) => `${l.tipo}:${l.nome}`);
  assert.deepEqual(
    fmt('Vereador Edemilson – Solicitando a manutenção da área de lazer no Bairro Santa Lúcia, especialmente nas Ruas Tangará e Melvin Jones.'),
    ['bairro:Santa Lúcia', 'rua:Rua Tangará', 'rua:Rua Melvin Jones'],
  );
  assert.deepEqual(
    fmt('Solicitando o tamponamento de buracos em toda a extensão das Avenidas Nações Unidas e Valter Nardelli; em toda a extensão da Rua São Felipe, no Bairro Jardim São Judas.'),
    ['rua:Avenida Nações Unidas', 'rua:Avenida Valter Nardelli', 'rua:Rua São Felipe', 'bairro:Jardim São Judas'],
  );
  assert.deepEqual(fmt('Solicitando reparos no Jd. Saltense'), ['bairro:Jardim Saltense']);
  assert.deepEqual(fmt('na Rua 9 de Julho em frente à Caixa Econômica'), ['rua:Rua 9 de Julho']);
  assert.deepEqual(
    fmt('revitalização do parque localizado entre as Ruas Irã e Marechal Deodoro, no Jardim das Nações.'),
    ['rua:Rua Irã', 'rua:Rua Marechal Deodoro', 'bairro:Jardim das Nações'],
  );
  assert.deepEqual(fmt('limpeza no Centro de Convivência José Lisboa'), []);
  assert.deepEqual(fmt('recape da Rua 9 de Julho, no Centro.'), ['rua:Rua 9 de Julho', 'bairro:Centro']);
  assert.equal(extrairLocais('na Rua São Felipe')[0].chave, 'rua sao felipe');
  assert.deepEqual(tiposPedido('Solicitando o tamponamento de buracos e o nivelamento da Rua Rússia'), ['buraco', 'asfalto']);
  assert.deepEqual(tiposPedido('Solicitando a desobstrução e a manutenção dos bueiros'), ['drenagem']);
  console.log('ok: local');
}
```

- [ ] **Step 2: Escrever `src/regras/local.js`**

```js
import { normalizar } from '../util/texto.js';

// Minúsculas e sem acento, com o MESMO comprimento do original, para os índices baterem.
const semAcento = (s) => s.split('').map((c) => c.normalize('NFD')[0]).join('').toLowerCase();

const PREFIXO_RUA = {
  rua: 'Rua', ruas: 'Rua', avenida: 'Avenida', avenidas: 'Avenida', av: 'Avenida',
  travessa: 'Travessa', estrada: 'Estrada', alameda: 'Alameda', praca: 'Praça', rodovia: 'Rodovia',
};
const PREFIXO_BAIRRO = {
  bairro: '', jardim: 'Jardim', jd: 'Jardim', vila: 'Vila', parque: 'Parque', residencial: 'Residencial',
  chacara: 'Chácara', chacaras: 'Chácaras', condominio: 'Condomínio', loteamento: 'Loteamento',
};

const RUA = /\b(ruas|rua|avenidas|avenida|av|travessa|estrada|alameda|praca|rodovia)\.?\s+(.+?)(?=\s*[,;.()]|\s+(?:no|na|nos|nas|em|ate|entre|esquina|proximo|altura|ao lado|desde|sentido|bairro|jardim|jd|vila|parque)\b|\s+e\s+(?:rua|ruas|av|avenida|avenidas|na|no|nas|nos)\b|$)/g;
const BAIRRO = /\b(bairro|jardim|jd|vila|parque|residencial|chacaras|chacara|condominio|loteamento)\.?\s+(.+?)(?=\s*[,;.()]|\s+(?:e|no|na|nos|nas|em|ate|entre|proximo|especialmente|sentido|onde|para|com|que)\b|$)/g;
const CENTRO = /\b(no|na) centro\b(?!\s+de\b)/;

const maiuscula = (c) => !!c && c !== c.toLowerCase();
const digito = (c) => /\d/.test(c || '');

function coletar(re, prefixos, tipo, original, base, achados) {
  for (const m of base.matchAll(re)) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const nomeOriginal = original.slice(fim - m[2].length, fim).trim();
    // Aceita se o prefixo está em maiúscula ("Rua", "Jardim") ou se o nome começa com maiúscula ou número.
    if (!maiuscula(original[ini]) && !maiuscula(nomeOriginal[0]) && !digito(nomeOriginal[0])) continue;
    const plural = m[1] === 'ruas' || m[1] === 'avenidas';
    for (const parte of plural ? nomeOriginal.split(/\s+e\s+/) : [nomeOriginal]) {
      const limpo = parte.trim();
      if (limpo.length < 2) continue;
      const prefixo = prefixos[m[1]];
      const nome = prefixo ? `${prefixo} ${limpo}` : limpo;
      achados.push({ pos: ini, tipo, nome, chave: normalizar(nome) });
    }
  }
}

export function extrairLocais(ementa) {
  const original = String(ementa ?? '');
  const base = semAcento(original);
  const achados = [];
  coletar(RUA, PREFIXO_RUA, 'rua', original, base, achados);
  coletar(BAIRRO, PREFIXO_BAIRRO, 'bairro', original, base, achados);
  const c = base.search(CENTRO);
  if (c >= 0) achados.push({ pos: c, tipo: 'bairro', nome: 'Centro', chave: 'centro' });
  achados.sort((a, b) => a.pos - b.pos);
  const vistos = new Set();
  return achados
    .filter((a) => {
      const k = `${a.tipo}:${a.chave}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map(({ tipo, nome, chave }) => ({ tipo, nome, chave }));
}

const TIPOS = [
  ['buraco', /(buraco|tamponamento|cratera)/],
  ['asfalto', /(asfalt|pavimenta|recape|paralelepipedo|nivelamento)/],
  ['iluminacao', /(ilumina|lampada|poste)/],
  ['limpeza', /(limpeza|mato|capina|rocada|entulho)/],
  ['drenagem', /(bueiro|boca de lobo|drenagem|galeria pluvial|alagamento)/],
  ['sinalizacao', /(sinaliza|lombada|faixa de pedestre|redutor de velocidade|semaforo)/],
  ['arvore', /(poda|arvore|galhos)/],
  ['lixo', /(coleta de lixo|lixo|conteiner|cacamba|residuos)/],
];

export const TIPOS_NOME = {
  buraco: 'buracos', asfalto: 'asfalto e pavimentação', iluminacao: 'iluminação', limpeza: 'limpeza e mato',
  drenagem: 'bueiros e drenagem', sinalizacao: 'sinalização', arvore: 'poda de árvores', lixo: 'lixo e coleta',
};

export function tiposPedido(ementa) {
  const e = normalizar(ementa);
  return TIPOS.filter(([, re]) => re.test(e)).map(([t]) => t);
}
```

- [ ] **Step 3: Rodar a checagem**

Run: `npm run checar`
Expected: as linhas anteriores mais `ok: local`.
Se uma asserção de `local` falhar, ajuste só as listas de parada das regex `RUA`/`BAIRRO`. Não mude as asserções: elas são frases reais da Câmara.

- [ ] **Step 4: Commit**

```bash
git add src/regras/local.js check/regras.mjs
git commit -m "feat: extração de rua, bairro e tipo de pedido"
```

---

### Task 4: Leitores de HTML (APEX, vereadores, lista de PDFs)

**Files:**
- Create: `src/regras/apex.js`, `src/regras/vereadores-html.js`, `src/regras/presenca-html.js`
- Modify: `check/regras.mjs` (acrescentar seção)

**Interfaces:**
- Consumes: `normalizar`, `limparHtml`, `slug` (Task 1); `dividirNomes` (Task 2)
- Produces:
  - `lerCard({id, titulo, texto}): {id: string, categoria, numero, autores: string[], data: 'AAAA-MM-DD'|'', ementa, solucao}`
  - `lerVereadores(html, base): {id, nome, partido, url, foto}[]`
  - `linkCategoriaAno(html, ano, base): string|null`
  - `linksPdfPresenca(html, base): string[]` (URLs absolutas)
  - `mesDoArquivo(url): {mes: number|null, ano: number} | null`

- [ ] **Step 1: Acrescentar ao fim de `check/regras.mjs`**

```js
import { lerCard } from '../src/regras/apex.js';
import { lerVereadores } from '../src/regras/vereadores-html.js';
import { linkCategoriaAno, linksPdfPresenca, mesDoArquivo } from '../src/regras/presenca-html.js';

{
  const B = 'https://www.camarasalto.sp.gov.br';
  assert.deepEqual(
    lerCard({
      id: 92700,
      titulo: '<strong>Categoria:</strong> Indicação</br><strong>Número do Documento:</strong> 2062</br><strong>Autor(es):</strong> Almir de Melo Santos</br><strong> Data:</strong> 10/11/2026 00:00:00',
      texto: 'Vereador Almir – Solicitando o tamponamento de buracos na Rua São Joaquim.<br><strong> Solução Final: Aprovado</strong>',
    }),
    {
      id: '92700', categoria: 'Indicação', numero: '2062', autores: ['Almir de Melo Santos'], data: '2026-11-10',
      ementa: 'Vereador Almir – Solicitando o tamponamento de buracos na Rua São Joaquim.', solucao: 'Aprovado',
    },
  );

  const home = `<a href="/vereador-almir-de-melo-santos">
    <img src="https://camarasalto.sp.gov.br/images/legislatura-2024-2028/almir_de_melo_santos.jpg" alt="Almir de Melo Santos (PRD)" class="img-thumbnail img_profile">
    <div class="name_profile">Almir de Melo Santos (PRD)</div></a>
    <a href="/vereador-arildo-guadagnini"><img src="https://camarasalto.sp.gov.br/images/a.jpg" class="img_profile">
    <div class="name_profile">Arildo Guadagnini (Democracia Cristã)</div></a>`;
  assert.deepEqual(lerVereadores(home, B), [
    { id: 'almir-de-melo-santos', nome: 'Almir de Melo Santos', partido: 'PRD', url: `${B}/vereador-almir-de-melo-santos`, foto: 'https://camarasalto.sp.gov.br/images/legislatura-2024-2028/almir_de_melo_santos.jpg' },
    { id: 'arildo-guadagnini', nome: 'Arildo Guadagnini', partido: 'Democracia Cristã', url: `${B}/vereador-arildo-guadagnini`, foto: 'https://camarasalto.sp.gov.br/images/a.jpg' },
  ]);

  const indice = '<a href="/sessoes/presenca-dos-vereadores/category/346-2025">2025</a><a href="/sessoes/presenca-dos-vereadores/category/608-2026">2026</a>';
  assert.equal(linkCategoriaAno(indice, 2025, B), `${B}/sessoes/presenca-dos-vereadores/category/346-2025`);
  assert.equal(linkCategoriaAno(indice, 2019, B), null);
  const lista = '<a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-março-2025.pdf">a</a><a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-agosto-2025 II.pdf">b</a><a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-março-2025.pdf">a</a>';
  const links = linksPdfPresenca(lista, B);
  assert.equal(links.length, 2);
  assert.deepEqual(mesDoArquivo(links[0]), { mes: 3, ano: 2025 });
  assert.deepEqual(mesDoArquivo(links[1]), { mes: 8, ano: 2025 });
  console.log('ok: leitores html');
}
```

- [ ] **Step 2: Escrever `src/regras/apex.js`**

```js
import { normalizar, limparHtml } from '../util/texto.js';
import { dividirNomes } from './nomes.js';

// titulo: "<strong>Categoria:</strong> X</br><strong>Número do Documento:</strong> N</br><strong>Autor(es):</strong> A</br><strong> Data:</strong> dd/mm/aaaa hh:mm:ss"
export function lerCard({ id, titulo, texto }) {
  const campos = {};
  for (const parte of String(titulo ?? '').split(/<\/?br\s*\/?>/i)) {
    const m = parte.match(/<strong>\s*([^<:]+):\s*<\/strong>\s*(.*)$/i);
    if (m) campos[normalizar(m[1])] = limparHtml(m[2]);
  }
  const partes = String(texto ?? '').split(/<strong>\s*Solu[çc][ãa]o Final\s*:?/i);
  const [d, m, a] = (campos['data'] || '').split(' ')[0].split('/');
  return {
    id: String(id),
    categoria: campos['categoria'] || '',
    numero: campos['numero do documento'] || '',
    autores: dividirNomes(campos['autor(es)'] || ''),
    data: a ? `${a}-${m}-${d}` : '',
    ementa: limparHtml(partes[0]),
    solucao: limparHtml(partes[1] || ''),
  };
}
```

- [ ] **Step 3: Escrever `src/regras/vereadores-html.js`**

```js
import { limparHtml, slug } from '../util/texto.js';

export function lerVereadores(html, base) {
  const re = /<a href="(\/vereador-[^"]+)">[\s\S]{0,400}?<img src="([^"]+)"[\s\S]{0,400}?<div class="name_profile">([^<]+)<\/div>/g;
  const lista = [];
  const vistos = new Set();
  for (const m of String(html).matchAll(re)) {
    const texto = limparHtml(m[3]);
    const p = texto.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const nome = p ? p[1] : texto;
    const partido = p ? p[2] : '';
    const id = slug(nome);
    if (vistos.has(id)) continue;
    vistos.add(id);
    lista.push({ id, nome, partido, url: new URL(m[1], base).href, foto: m[2] });
  }
  return lista;
}
```

- [ ] **Step 4: Escrever `src/regras/presenca-html.js`**

```js
import { normalizar } from '../util/texto.js';

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

export function linkCategoriaAno(html, ano, base) {
  const m = String(html).match(new RegExp(`href="([^"]*presenca-dos-vereadores/category/\\d+-${ano})"`));
  return m ? new URL(m[1], base).href : null;
}

export function linksPdfPresenca(html, base) {
  const links = new Set();
  for (const m of String(html).matchAll(/href="([^"]*\/presenca-dos-vereadores\/[^"]*\.pdf)"/gi)) links.add(new URL(m[1], base).href);
  return [...links];
}

export function mesDoArquivo(url) {
  const n = normalizar(decodeURIComponent(String(url)));
  const m = n.match(/presenca-reunioes-([a-z]+)-(\d{4})/);
  return m ? { mes: MESES[m[1]] ?? null, ano: Number(m[2]) } : null;
}
```

- [ ] **Step 5: Rodar a checagem**

Run: `npm run checar`
Expected: as linhas anteriores mais `ok: leitores html`

- [ ] **Step 6: Commit**

```bash
git add src/regras/apex.js src/regras/vereadores-html.js src/regras/presenca-html.js check/regras.mjs
git commit -m "feat: leitores do portal APEX e das páginas da Câmara"
```

---

### Task 5: Leitores de PDF (presença e votações)

**Files:**
- Create: `src/pdf.js`, `src/regras/linhas.js`, `src/regras/presenca-pdf.js`, `src/regras/votacao-pdf.js`
- Modify: `check/regras.mjs` (acrescentar seção)

**Interfaces:**
- Consumes: `dividirNomes` (Task 2)
- Produces:
  - `itensDoPdf(buffer): Promise<{str, x, y}[][]>` (uma lista de itens por página; `y` cresce para cima)
  - `agruparLinhas(itens, tol=2): {y, itens}[]` (de cima para baixo)
  - `textoDe(itens): string`
  - `lerPresenca(itens): {sessoes: string[] /* 'd/m' */, linhas: {nome, marcas: ('P'|'A'|'AJ'|null)[]}[]}`
  - `lerVotacoes(paginas): {rotulo, ementa, autor, eventos: {data:'AAAA-MM-DD', turno, resultado, contra: string[], ausentes: string[]}[]}[]`

Posições medidas no PDF real de votações de 2026 (página A4 deitada, com 842 de largura): a coluna "Nº da Propositura" fica em x < 100; a ementa, de 100 a 250; o autor, de 250 a 315; e "Data da Votação / Solução Final", de 575 a 750.

- [ ] **Step 1: Acrescentar ao fim de `check/regras.mjs`**

```js
import { lerPresenca } from '../src/regras/presenca-pdf.js';
import { lerVotacoes } from '../src/regras/votacao-pdf.js';

{
  const itens = [
    { str: 'PRESENÇA DOS VEREADORES - NOVEMBRO 2026', x: 100, y: 800 },
    { str: 'VEREADOR', x: 120, y: 780 }, { str: '3/11', x: 262, y: 780 }, { str: '10/11', x: 300, y: 780 },
    { str: 'Almir de Melo Santos', x: 50, y: 765 }, { str: 'P', x: 268, y: 765 }, { str: 'P', x: 308, y: 765 },
    { str: 'Arildo Guadagnini', x: 50, y: 750 }, { str: 'AJ', x: 266, y: 750 },
    { str: 'LEGENDAS', x: 100, y: 700 }, { str: 'P = PRESENÇA', x: 100, y: 690 },
  ];
  assert.deepEqual(lerPresenca(itens), {
    sessoes: ['3/11', '10/11'],
    linhas: [
      { nome: 'Almir de Melo Santos', marcas: ['P', 'P'] },
      { nome: 'Arildo Guadagnini', marcas: ['AJ', null] },
    ],
  });

  const pagina = [
    { str: 'Nº da', x: 34, y: 503 }, { str: 'Propositura', x: 34, y: 492 }, { str: 'Data da Votação', x: 631, y: 503 },
    { str: 'Projeto de Lei', x: 34, y: 321 }, { str: 'nº 72', x: 34, y: 310 }, { str: '/2025', x: 54, y: 310 },
    { str: 'Dispõe sobre receitas digitadas', x: 105, y: 321 },
    { str: 'Graziela Costa', x: 253, y: 321 }, { str: 'Leite', x: 270, y: 310 },
    { str: '04.11.2025', x: 578, y: 321 },
    { str: 'Projeto aprovado por maioria de votos.', x: 578, y: 310 },
    { str: 'Contra: Rogério', x: 578, y: 288 },
    { str: '15.12.2025', x: 578, y: 277 },
    { str: 'Veto Total ao', x: 34, y: 244 }, { str: 'Autógrafo nº', x: 34, y: 234 }, { str: '69/2025 do', x: 34, y: 223 },
    { str: 'Projeto de Lei', x: 34, y: 211 }, { str: 'nº 72/2025', x: 34, y: 201 },
    { str: 'Prefeitura', x: 261, y: 244 },
    { str: 'Veto rejeitado por unanimidade de votos.', x: 578, y: 244 },
    { str: 'Ausente :', x: 578, y: 233 }, { str: 'Antônio', x: 615, y: 233 },
  ];
  const pagina2 = [
    { str: 'Projeto de Emenda', x: 34, y: 500 }, { str: 'à Lei Orgânica 01/2026', x: 34, y: 489 },
    { str: '31.03.2026', x: 578, y: 500 }, { str: '–', x: 621, y: 500 }, { str: '1º Turno', x: 628, y: 500 },
    { str: 'Veto aprovado por maioria de votos', x: 578, y: 489 },
    { str: 'Contrários ao veto : Graziela, Michel, Antônio', x: 578, y: 478 },
    { str: 'e Arildo', x: 578, y: 467 },
  ];
  const r = lerVotacoes([pagina, pagina2]);
  assert.equal(r.length, 3);
  assert.equal(r[0].rotulo, 'Projeto de Lei nº 72/2025');
  assert.equal(r[0].autor, 'Graziela Costa Leite');
  assert.deepEqual(r[0].eventos.map((e) => [e.data, e.resultado, e.contra, e.ausentes]), [['2025-11-04', 'Projeto aprovado por maioria de votos.', ['Rogério'], []]]);
  assert.equal(r[1].rotulo, 'Veto Total ao Autógrafo nº 69/2025 do Projeto de Lei nº 72/2025');
  assert.equal(r[1].autor, 'Prefeitura');
  assert.deepEqual(r[1].eventos.map((e) => [e.data, e.resultado, e.ausentes]), [['2025-12-15', 'Veto rejeitado por unanimidade de votos.', ['Antônio']]]);
  assert.deepEqual(r[2].eventos.map((e) => [e.data, e.turno, e.contra]), [['2026-03-31', '1º Turno', ['Graziela', 'Michel', 'Antônio', 'Arildo']]]);
  console.log('ok: leitores pdf');
}
```

- [ ] **Step 2: Escrever `src/pdf.js`**

```js
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function itensDoPdf(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const { items } = await pagina.getTextContent();
    paginas.push(
      items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] })),
    );
  }
  await doc.destroy();
  return paginas;
}
```

- [ ] **Step 3: Escrever `src/regras/linhas.js`**

```js
export function agruparLinhas(itens, tol = 2) {
  const linhas = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const linha = linhas.find((l) => Math.abs(l.y - it.y) <= tol);
    if (linha) linha.itens.push(it);
    else linhas.push({ y: it.y, itens: [it] });
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  return linhas.sort((a, b) => b.y - a.y);
}

export const textoDe = (itens) => itens.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
```

- [ ] **Step 4: Escrever `src/regras/presenca-pdf.js`**

```js
import { agruparLinhas, textoDe } from './linhas.js';

const MARCA = /^(P|A|AJ)$/;

export function lerPresenca(itens) {
  const linhas = agruparLinhas(itens);
  const iCab = linhas.findIndex((l) => l.itens.some((i) => /^VEREADOR$/i.test(i.str.trim())));
  if (iCab < 0) return { sessoes: [], linhas: [] };
  const colunas = linhas[iCab].itens
    .filter((i) => /^\d{1,2}\/\d{1,2}$/.test(i.str.trim()))
    .map((i) => ({ data: i.str.trim(), x: i.x }));
  const resultado = [];
  for (const l of linhas.slice(iCab + 1)) {
    if (/^LEGENDA/i.test(textoDe(l.itens))) break;
    const nome = textoDe(l.itens.filter((i) => !MARCA.test(i.str.trim())));
    if (!nome) continue;
    const marcas = colunas.map(() => null);
    for (const i of l.itens.filter((i) => MARCA.test(i.str.trim()))) {
      let melhor = -1;
      let dist = Infinity;
      colunas.forEach((c, k) => {
        const d = Math.abs(c.x - i.x);
        if (d < dist) { dist = d; melhor = k; }
      });
      if (melhor >= 0 && dist < 25) marcas[melhor] = i.str.trim();
    }
    resultado.push({ nome, marcas });
  }
  return { sessoes: colunas.map((c) => c.data), linhas: resultado };
}
```

- [ ] **Step 5: Escrever `src/regras/votacao-pdf.js`**

```js
import { agruparLinhas, textoDe } from './linhas.js';
import { dividirNomes } from './nomes.js';

const COL = { rotulo: [0, 100], ementa: [100, 250], autor: [250, 315], solucao: [575, 750] };
const naColuna = (i, [a, b]) => i.x >= a && i.x < b;
const CABECALHO = /^(n[º°o]\.?\s*da|propositura)$/i;
const INICIO = /^(projeto|veto|emenda|substitutivo|proposta|mo[cç][aã]o|requerimento)/i;
const DATA = /^(\d{2})\.(\d{2})\.(\d{4})\s*[–-]?\s*(.*)$/;
const RESULTADO = /(aprovad|rejeitad|retirad|arquivad|adiad|prejudicad|mantid|derrubad)/i;
const LISTA = /^(contra[^:]*|contr[aá]ri[oa]s?[^:]*|ausentes?[^:]*)\s*:\s*(.*)$/i;

// Bloco do projeto que contém a altura y: o de menor y que ainda está acima (com folga de 3).
// Antes do primeiro bloco da página, vale o último bloco da página anterior.
function blocoPara(blocos, pagina, y) {
  let escolhido = null;
  for (const b of blocos) {
    if (b.pagina < pagina) escolhido = b;
    else if (b.pagina === pagina && b.y >= y - 3) escolhido = b;
  }
  return escolhido;
}

export function lerVotacoes(paginas) {
  const blocos = [];
  const eventos = [];
  let ev = null;

  paginas.forEach((itens, p) => {
    let anteriorY = null;
    for (const l of agruparLinhas(itens.filter((i) => naColuna(i, COL.rotulo)))) {
      const t = textoDe(l.itens);
      if (CABECALHO.test(t)) continue;
      const atual = blocos[blocos.length - 1];
      const gap = anteriorY === null ? Infinity : anteriorY - l.y;
      if (INICIO.test(t) && (gap > 25 || !atual)) blocos.push({ pagina: p, y: l.y, rotulo: t, ementa: '', autor: '', eventos: [] });
      else if (atual) atual.rotulo += ` ${t}`;
      anteriorY = l.y;
    }

    for (const [campo, faixa] of [['ementa', COL.ementa], ['autor', COL.autor]]) {
      for (const l of agruparLinhas(itens.filter((i) => naColuna(i, faixa)))) {
        const b = blocoPara(blocos, p, l.y);
        if (b) b[campo] = `${b[campo]} ${textoDe(l.itens)}`.trim();
      }
    }

    for (const l of agruparLinhas(itens.filter((i) => naColuna(i, COL.solucao)))) {
      const t = textoDe(l.itens);
      const d = t.match(DATA);
      if (d) {
        ev = { data: `${d[3]}-${d[2]}-${d[1]}`, turno: d[4].replace(/^[–-]\s*/, '').trim(), resultado: '', contra: [], ausentes: [], pagina: p, yRef: l.y, lista: null, temResultado: false };
        eventos.push(ev);
        continue;
      }
      if (!ev) continue;
      const li = t.match(LISTA);
      if (li) {
        ev.lista = /^aus/i.test(li[1]) ? 'ausentes' : 'contra';
        ev[ev.lista].push(...dividirNomes(li[2]));
        continue;
      }
      if (RESULTADO.test(t) && !ev.temResultado) {
        ev.resultado = t;
        ev.temResultado = true;
        ev.pagina = p;
        ev.yRef = l.y;
        ev.lista = null;
        continue;
      }
      if (ev.lista) ev[ev.lista].push(...dividirNomes(t));
      else if (ev.temResultado) ev.resultado = `${ev.resultado} ${t}`;
    }
  });

  for (const e of eventos) {
    const b = blocoPara(blocos, e.pagina, e.yRef);
    if (b) b.eventos.push({ data: e.data, turno: e.turno, resultado: e.resultado, contra: e.contra, ausentes: e.ausentes });
  }
  return blocos.map(({ rotulo, ementa, autor, eventos }) => ({
    rotulo: rotulo.replace(/\s+\//g, '/').replace(/\s+/g, ' ').trim(),
    ementa,
    autor,
    eventos,
  }));
}
```

- [ ] **Step 6: Rodar a checagem**

Run: `npm run checar`
Expected: as linhas anteriores mais `ok: leitores pdf`

- [ ] **Step 7: Conferir com os PDFs reais (já verificados como PDFs de texto)**

Criar um arquivo descartável `scratch-pdf.mjs` na raiz (não commitar):

```js
import { itensDoPdf } from './src/pdf.js';
import { lerPresenca } from './src/regras/presenca-pdf.js';
import { lerVotacoes } from './src/regras/votacao-pdf.js';
const baixar = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());
const pres = await itensDoPdf(await baixar('https://www.camarasalto.sp.gov.br/pdf/presenca-dos-vereadores/2026/presenca-reunioes-novembro-2026.pdf'));
console.log(JSON.stringify(lerPresenca(pres[0]), null, 1));
const vot = lerVotacoes(await itensDoPdf(await baixar('https://www.camarasalto.sp.gov.br/pdf/tramitacao-votacao-dos-projetos/votacao-dos-projetos-2026.pdf')));
console.log(vot.length, 'projetos; sem eventos:', vot.filter((v) => !v.eventos.length).length);
console.log(JSON.stringify(vot.slice(0, 3), null, 1));
```

Run: `node scratch-pdf.mjs`, depois apagar o arquivo.
Expected: a presença deve trazer `sessoes: ["3/11","10/11"]` e 11 linhas, todas `["P","P"]`. As votações devem trazer dezenas de projetos. O primeiro deve ser "Projeto de Emenda a Lei Orgânica nº 01/2026", com 2 eventos (31/03 e 23/04) e os ausentes Antônio e Luzia. Se as faixas de x não baterem, ajuste só `COL` em `votacao-pdf.js` e repita as duas verificações.

- [ ] **Step 8: Commit**

```bash
git add src/pdf.js src/regras/linhas.js src/regras/presenca-pdf.js src/regras/votacao-pdf.js check/regras.mjs
git commit -m "feat: leitura dos PDFs de presença e de votações"
```

---

### Task 6: Coletores

**Files:**
- Create: `src/coleta/http.js`, `src/coleta/vereadores.js`, `src/coleta/proposituras.js`, `src/coleta/presenca.js`, `src/coleta/votacoes.js`, `src/coletar.js`

**Interfaces:**
- Consumes: Tasks 1, 4 e 5
- Produces:
  - `baixar(url): Promise<Buffer>` (lança erro com `.status`), `salvar(caminho, conteudo)`, `existe(caminho)`, `baixarComCache(url, caminho, {renovar})`
  - `coletarVereadores(): Promise<{id,nome,partido,url,foto}[]>`
  - `coletarProposituras(anos, anoAtual): Promise<Record<ano, {id,titulo,texto}[]>>`
  - `coletarPresencas(anos, anoAtual): Promise<{arquivo, url, ano, mes, sessoes, linhas}[]>`
  - `coletarVotacoes(anos, anoAtual): Promise<{ano, url, blocos}[]>`
  - `coletarTudo(): Promise<{vereadores, cardsPorAno, presencas, votacoes, coletadoEm}>`, que também grava `data/bruto/coleta.json`

Sem checagem automática, porque é entrada e saída de rede. A verificação é a coleta real do Step 7.

- [ ] **Step 1: Escrever `src/coleta/http.js`**

```js
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UA, ESPERA_MS } from '../config.js';
import { esperar } from '../util/texto.js';

let ultimo = 0;

export async function baixar(url) {
  const falta = ultimo + ESPERA_MS - Date.now();
  if (falta > 0) await esperar(falta);
  ultimo = Date.now();
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) {
    const erro = new Error(`HTTP ${r.status} em ${url}`);
    erro.status = r.status;
    throw erro;
  }
  return Buffer.from(await r.arrayBuffer());
}

export async function existe(caminho) {
  try { await access(caminho); return true; } catch { return false; }
}

export async function salvar(caminho, conteudo) {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo);
}

export async function baixarComCache(url, caminho, { renovar = false } = {}) {
  if (!renovar && (await existe(caminho))) return readFile(caminho);
  const buf = await baixar(url);
  await salvar(caminho, buf);
  return buf;
}
```

- [ ] **Step 2: Escrever `src/coleta/vereadores.js`**

```js
import { CAMARA } from '../config.js';
import { lerVereadores } from '../regras/vereadores-html.js';
import { baixar, salvar } from './http.js';

export async function coletarVereadores() {
  const html = (await baixar(`${CAMARA}/`)).toString('utf8');
  await salvar('data/bruto/home.html', html);
  return lerVereadores(html, CAMARA);
}
```

- [ ] **Step 3: Escrever `src/coleta/proposituras.js`**

```js
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { APEX, UA } from '../config.js';
import { existe, salvar } from './http.js';

// O portal é Oracle APEX: a lista é uma região "Cards" carregada por AJAX.
// Pegamos o modelo da região e pedimos todos os registros (fetchAll), como o próprio portal faz ao paginar.
export async function coletarProposituras(anos, anoAtual) {
  const porAno = {};
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA });
    for (const ano of anos) {
      const arquivo = `data/bruto/proposituras-${ano}.json`;
      if (ano !== anoAtual && (await existe(arquivo))) {
        porAno[ano] = JSON.parse(await readFile(arquivo, 'utf8'));
        continue;
      }
      await page.goto(`${APEX}?p=742:92::::92:P92_ANO:${ano}&tz=America/Sao_Paulo;-3:00`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(() => window.apex && window.apex.region, null, { timeout: 60000 });
      const { total, registros } = await page.evaluate(async () => {
        const el = [...document.querySelectorAll('[id]')].find((e) => apex.region.isRegion(e.id) && apex.region(e.id).type === 'Cards');
        if (!el) throw new Error('Região de cards não encontrada no portal');
        const m = apex.region(el.id).call('getModel');
        await new Promise((ok, falha) => {
          const t = setTimeout(() => falha(new Error('tempo esgotado no fetchAll')), 300000);
          m.fetchAll((s) => { if (s.done) { clearTimeout(t); ok(); } });
        });
        const registros = [];
        m.forEach((r) => registros.push({ id: String(m.getValue(r, 'ID')), titulo: String(m.getValue(r, 'CARD_TITLE')), texto: String(m.getValue(r, 'CARD_TEXT')) }));
        return { total: m.getTotalRecords(), registros };
      });
      if (registros.length !== total) throw new Error(`Proposituras ${ano}: vieram ${registros.length} de ${total}`);
      await salvar(arquivo, JSON.stringify(registros));
      porAno[ano] = registros;
    }
  } finally {
    await browser.close();
  }
  return porAno;
}
```

- [ ] **Step 4: Escrever `src/coleta/presenca.js`**

```js
import { CAMARA } from '../config.js';
import { itensDoPdf } from '../pdf.js';
import { linkCategoriaAno, linksPdfPresenca, mesDoArquivo } from '../regras/presenca-html.js';
import { lerPresenca } from '../regras/presenca-pdf.js';
import { baixar, baixarComCache } from './http.js';

export async function coletarPresencas(anos, anoAtual) {
  const indice = (await baixar(`${CAMARA}/sessoes/presenca-dos-vereadores`)).toString('utf8');
  const lidas = [];
  for (const ano of anos) {
    const urlAno = linkCategoriaAno(indice, ano, CAMARA);
    if (!urlAno) {
      if (ano === anoAtual) continue; // ano recém-começado, ainda sem página
      throw new Error(`Não achei a página de presença de ${ano}`);
    }
    const html = (await baixar(urlAno)).toString('utf8');
    for (const url of linksPdfPresenca(html, CAMARA)) {
      const info = mesDoArquivo(url);
      if (!info || info.ano !== ano) continue;
      const arquivo = decodeURIComponent(url.split('/').pop());
      const buf = await baixarComCache(url, `data/bruto/presenca/${ano}/${arquivo}`, { renovar: ano === anoAtual });
      let achou = false;
      for (const itens of await itensDoPdf(buf)) {
        const r = lerPresenca(itens);
        if (!r.sessoes.length) continue;
        achou = true;
        lidas.push({ arquivo, url, ano, mes: info.mes, ...r });
      }
      if (!achou) lidas.push({ arquivo, url, ano, mes: info.mes, sessoes: [], linhas: [] }); // a barreira acusa
    }
  }
  return lidas;
}
```

- [ ] **Step 5: Escrever `src/coleta/votacoes.js`**

```js
import { CAMARA } from '../config.js';
import { itensDoPdf } from '../pdf.js';
import { lerVotacoes } from '../regras/votacao-pdf.js';
import { baixarComCache } from './http.js';

export async function coletarVotacoes(anos, anoAtual) {
  const lidas = [];
  for (const ano of anos) {
    const url = `${CAMARA}/pdf/tramitacao-votacao-dos-projetos/votacao-dos-projetos-${ano}.pdf`;
    let buf;
    try {
      buf = await baixarComCache(url, `data/bruto/votacoes/votacao-dos-projetos-${ano}.pdf`, { renovar: ano === anoAtual });
    } catch (e) {
      if (e.status === 404 && ano === anoAtual) continue;
      throw e;
    }
    lidas.push({ ano, url, blocos: lerVotacoes(await itensDoPdf(buf)) });
  }
  return lidas;
}
```

- [ ] **Step 6: Escrever `src/coletar.js`**

```js
import { pathToFileURL } from 'node:url';
import { anos } from './config.js';
import { coletarVereadores } from './coleta/vereadores.js';
import { coletarProposituras } from './coleta/proposituras.js';
import { coletarPresencas } from './coleta/presenca.js';
import { coletarVotacoes } from './coleta/votacoes.js';
import { salvar } from './coleta/http.js';

export async function coletarTudo() {
  const lista = anos();
  const anoAtual = lista[lista.length - 1];
  const vereadores = await coletarVereadores();
  const cardsPorAno = await coletarProposituras(lista, anoAtual);
  const presencas = await coletarPresencas(lista, anoAtual);
  const votacoes = await coletarVotacoes(lista, anoAtual);
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, coletadoEm: new Date().toISOString() };
  await salvar('data/bruto/coleta.json', JSON.stringify(coleta));
  return coleta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = await coletarTudo();
  console.log(`Vereadores: ${c.vereadores.length}`);
  for (const [ano, l] of Object.entries(c.cardsPorAno)) console.log(`Proposituras ${ano}: ${l.length}`);
  console.log(`Tabelas de presença: ${c.presencas.length} (linhas: ${[...new Set(c.presencas.map((p) => p.linhas.length))].join(', ')})`);
  for (const v of c.votacoes) console.log(`Votações ${v.ano}: ${v.blocos.length} projetos`);
}
```

- [ ] **Step 7: Rodar a coleta real (leva alguns minutos)**

Run: `npm run coletar`
Expected, aproximadamente: `Vereadores: 11`, `Proposituras 2025: 3302` (ou mais), `Proposituras 2026: 2880` (ou mais), cerca de 20 tabelas de presença com `linhas: 11`, e `Votações 2025`/`2026` com dezenas de projetos cada.
Se `Vereadores` não der 11, abra `data/bruto/home.html`, ajuste a regex de `lerVereadores` e acrescente o caso real em `check/regras.mjs`.

- [ ] **Step 8: Commit**

```bash
git add src/coleta src/coletar.js data/bruto
git commit -m "feat: coletores da Câmara de Salto"
```

---

### Task 7: Processamento, barreira e relatório de conferência

**Files:**
- Create: `src/processar.js`, `src/conferir.js`, `src/relatorio.js`, `src/atualizar.js`
- Modify: `check/regras.mjs` (acrescentar seção do `conferir`)

**Interfaces:**
- Consumes: `coletarTudo` (Task 6) e as regras das Tasks 2 a 4
- Produces o objeto `Dados`, que o site usa (Task 8):
  ```
  {
    vereadores: {id,nome,partido,url,foto, porGrupo:{melhoria,cobranca,homenagem,lei,outros,administrativo}, totalPropostas,
                 presenca:{P,A,AJ,total}, votosContra, ausenciasVotacao}[],
    proposituras: {id,categoria,numero,data,ementa,solucao,autores,grupo,vereadores:string[],autoresTexto,locais,tipos}[]  // da mais nova para a mais antiga
    locais: {nome,tipo,idx:number[]}[]          // idx = posição em proposituras
    repetidos: {rua,tipo,pedidos:{id,data,autores}[]}[]
    presenca: Record<id, {sessoes:{data,marca,url}[], P,A,AJ}>
    votacoes: {rotulo,ementa,autor,url,eventos:{data,turno,resultado,contra:id[],ausentes:id[],url}[]}[]
    naoAtribuidos: {fonte,nome}[]
    presencasLidas: {arquivo,linhas:number}[]
    votacoesLidas: {ano,blocos:number,semEventos:number}[]
    meta: {atualizadoEm, totalProposituras, semLocal}
  }
  ```
  - `conferir(dados, anteriorMeta|null, esperados): string[]` (lista vazia = pode publicar)
  - `relatorio(dados, problemas): string` (markdown)

- [ ] **Step 1: Acrescentar ao fim de `check/regras.mjs`**

```js
import { conferir } from '../src/conferir.js';

{
  const base = {
    vereadores: Array.from({ length: 11 }, (_, i) => ({ id: String(i) })),
    presencasLidas: [{ arquivo: 'a.pdf', linhas: 11 }],
    votacoesLidas: [{ ano: 2026, blocos: 5, semEventos: 0 }],
    proposituras: [{}],
    meta: { totalProposituras: 100 },
  };
  assert.deepEqual(conferir(base, { totalProposituras: 90 }, 11), []);
  assert.deepEqual(conferir(base, null, 11), []);
  assert.equal(conferir({ ...base, meta: { totalProposituras: 80 } }, { totalProposituras: 90 }, 11).length, 1);
  assert.equal(conferir({ ...base, presencasLidas: [{ arquivo: 'a.pdf', linhas: 10 }] }, null, 11).length, 1);
  assert.equal(conferir({ ...base, vereadores: base.vereadores.slice(1) }, null, 11).length, 1);
  assert.equal(conferir({ ...base, votacoesLidas: [{ ano: 2026, blocos: 0, semEventos: 0 }] }, null, 11).length, 1);
  console.log('ok: conferir');
}
```

- [ ] **Step 2: Escrever `src/conferir.js`**

```js
export function conferir(dados, anterior, esperados) {
  const problemas = [];
  if (dados.vereadores.length !== esperados) problemas.push(`Esperava ${esperados} vereadores, vieram ${dados.vereadores.length}.`);
  for (const p of dados.presencasLidas) {
    if (p.linhas !== esperados) problemas.push(`PDF de presença ${p.arquivo}: ${p.linhas} linhas lidas (esperado ${esperados}).`);
  }
  for (const v of dados.votacoesLidas) {
    if (v.blocos === 0) problemas.push(`PDF de votações de ${v.ano}: nenhum projeto lido.`);
  }
  if (!dados.proposituras.length) problemas.push('Nenhuma propositura coletada.');
  if (anterior && dados.meta.totalProposituras < anterior.totalProposituras) {
    problemas.push(`O total de proposituras caiu de ${anterior.totalProposituras} para ${dados.meta.totalProposituras}.`);
  }
  return problemas;
}
```

- [ ] **Step 3: Escrever `src/processar.js`**

```js
import { ANO_INICIO } from './config.js';
import { lerCard } from './regras/apex.js';
import { classificar, GRUPOS } from './regras/classificar.js';
import { extrairLocais, tiposPedido } from './regras/local.js';
import { criarCasador } from './regras/nomes.js';
import { normalizar } from './util/texto.js';

const doisDigitos = (n) => String(n).padStart(2, '0');

export function processar({ vereadores, cardsPorAno, presencas, votacoes, coletadoEm }) {
  const casar = criarCasador(vereadores);
  const inicio = `${ANO_INICIO}-01-01`;
  const naoAtribuidos = [];

  // Proposituras
  const vistos = new Set();
  const proposituras = [];
  for (const cards of Object.values(cardsPorAno)) {
    for (const c of cards) {
      if (vistos.has(String(c.id))) continue;
      vistos.add(String(c.id));
      const p = lerCard(c);
      if (!p.data || p.data < inicio) continue;
      proposituras.push({
        ...p,
        grupo: classificar(p.categoria, p.ementa),
        vereadores: [...new Set(p.autores.map(casar).filter(Boolean))],
        autoresTexto: p.autores.join(', '),
        locais: extrairLocais(p.ementa),
        tipos: tiposPedido(p.ementa),
      });
    }
  }
  proposituras.sort((a, b) => b.data.localeCompare(a.data) || Number(b.numero) - Number(a.numero));

  // Índice de ruas e bairros (para a busca)
  const mapaLocais = new Map();
  proposituras.forEach((p, i) => {
    if (p.grupo === 'administrativo') return;
    for (const l of p.locais) {
      const k = `${l.tipo}:${l.chave}`;
      if (!mapaLocais.has(k)) mapaLocais.set(k, { nome: l.nome, tipo: l.tipo, idx: [] });
      mapaLocais.get(k).idx.push(i);
    }
  });
  const locais = [...mapaLocais.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // O problema que não some: mesmo tipo de pedido, mesma rua, 2 vezes ou mais
  const mapaRep = new Map();
  for (const p of proposituras) {
    if (p.grupo !== 'melhoria') continue;
    for (const l of p.locais.filter((x) => x.tipo === 'rua')) {
      for (const t of p.tipos) {
        const k = `${l.chave}|${t}`;
        if (!mapaRep.has(k)) mapaRep.set(k, { rua: l.nome, tipo: t, pedidos: [] });
        mapaRep.get(k).pedidos.push({ id: p.id, data: p.data, autores: p.autoresTexto });
      }
    }
  }
  const repetidos = [...mapaRep.values()]
    .filter((r) => r.pedidos.length >= 2)
    .sort((a, b) => b.pedidos.length - a.pedidos.length || a.rua.localeCompare(b.rua, 'pt-BR'));

  // Presença
  const presenca = Object.fromEntries(vereadores.map((v) => [v.id, { sessoes: [], P: 0, A: 0, AJ: 0 }]));
  const dataDoArquivo = new Map(); // a mesma data vinda de outro PDF (ex.: "agosto II") é ignorada
  for (const arq of presencas) {
    arq.sessoes.forEach((dm, k) => {
      const [d, m] = dm.split('/').map(Number);
      const data = `${arq.ano}-${doisDigitos(m)}-${doisDigitos(d)}`;
      if (data < inicio) return;
      if (dataDoArquivo.has(data) && dataDoArquivo.get(data) !== arq.arquivo) return;
      if (arq.linhas.every((l) => !l.marcas[k])) return; // sessão sem nenhum registro: dado ausente não é falta
      dataDoArquivo.set(data, arq.arquivo);
      for (const l of arq.linhas) {
        const id = casar(l.nome);
        if (!id) { naoAtribuidos.push({ fonte: `presença ${arq.arquivo}`, nome: l.nome }); continue; }
        const marca = l.marcas[k];
        presenca[id].sessoes.push({ data, marca, url: arq.url });
        if (marca) presenca[id][marca]++;
      }
    });
  }
  for (const p of Object.values(presenca)) p.sessoes.sort((a, b) => a.data.localeCompare(b.data));

  // Votações (o mesmo projeto pode aparecer nos PDFs de dois anos)
  const projetos = new Map();
  for (const v of votacoes) {
    for (const b of v.blocos) {
      const k = normalizar(b.rotulo);
      if (!projetos.has(k)) projetos.set(k, { rotulo: b.rotulo, ementa: b.ementa, autor: b.autor, url: v.url, eventos: [], chaves: new Set() });
      const pj = projetos.get(k);
      for (const e of b.eventos) {
        if (e.data < inicio) continue;
        const ek = `${e.data}|${normalizar(e.turno)}`;
        if (pj.chaves.has(ek)) continue;
        pj.chaves.add(ek);
        const contra = [];
        const ausentes = [];
        for (const [lista, destino] of [[e.contra, contra], [e.ausentes, ausentes]]) {
          for (const n of lista) {
            const id = casar(n);
            if (id) destino.push(id);
            else naoAtribuidos.push({ fonte: `votação ${b.rotulo} (${e.data})`, nome: n });
          }
        }
        pj.eventos.push({ data: e.data, turno: e.turno, resultado: e.resultado, contra: [...new Set(contra)], ausentes: [...new Set(ausentes)], url: v.url });
      }
    }
  }
  const listaVotacoes = [...projetos.values()]
    .filter((p) => p.eventos.length)
    .map(({ chaves, ...p }) => ({ ...p, eventos: p.eventos.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.eventos[b.eventos.length - 1].data.localeCompare(a.eventos[a.eventos.length - 1].data));

  // Resumo por vereador
  const todosEventos = listaVotacoes.flatMap((pj) => pj.eventos);
  const resumo = vereadores.map((v) => {
    const props = proposituras.filter((p) => p.vereadores.includes(v.id));
    const porGrupo = Object.fromEntries(Object.keys(GRUPOS).map((g) => [g, props.filter((p) => p.grupo === g).length]));
    const pr = presenca[v.id];
    return {
      ...v,
      porGrupo,
      totalPropostas: props.length,
      presenca: { P: pr.P, A: pr.A, AJ: pr.AJ, total: pr.sessoes.length },
      votosContra: todosEventos.filter((e) => e.contra.includes(v.id)).length,
      ausenciasVotacao: todosEventos.filter((e) => e.ausentes.includes(v.id)).length,
    };
  });

  const vistosNA = new Set();
  return {
    vereadores: resumo,
    proposituras,
    locais,
    repetidos,
    presenca,
    votacoes: listaVotacoes,
    naoAtribuidos: naoAtribuidos.filter((n) => {
      const k = `${n.fonte}|${n.nome}`;
      if (vistosNA.has(k)) return false;
      vistosNA.add(k);
      return true;
    }),
    presencasLidas: presencas.map((p) => ({ arquivo: p.arquivo, linhas: p.linhas.length })),
    votacoesLidas: votacoes.map((v) => ({ ano: v.ano, blocos: v.blocos.length, semEventos: v.blocos.filter((b) => !b.eventos.length).length })),
    meta: {
      atualizadoEm: coletadoEm || new Date().toISOString(),
      totalProposituras: proposituras.length,
      semLocal: proposituras.filter((p) => p.grupo === 'melhoria' && !p.locais.length).length,
    },
  };
}
```

- [ ] **Step 4: Escrever `src/relatorio.js`**

```js
export function relatorio(d, problemas) {
  const l = [];
  l.push('# Conferência do Radar Saltense', '', `Dados de ${d.meta.atualizadoEm}`, '');
  l.push('## Barreira automática', '');
  l.push(...(problemas.length ? problemas.map((p) => `- ❌ ${p}`) : ['- ✅ Tudo certo. Pode publicar.']), '');
  l.push('## Números por vereador', '', 'Abra a ficha oficial de 2 ou 3 vereadores e compare com esta tabela.', '');
  l.push('| Vereador | Presenças | Faltas | AJ | Sessões | Pedidos | Cobranças | Homenagens | Leis | Outros | Votou contra | Ausente em votação |');
  l.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of d.vereadores) {
    l.push(`| ${v.nome} | ${v.presenca.P} | ${v.presenca.A} | ${v.presenca.AJ} | ${v.presenca.total} | ${v.porGrupo.melhoria} | ${v.porGrupo.cobranca} | ${v.porGrupo.homenagem} | ${v.porGrupo.lei} | ${v.porGrupo.outros} | ${v.votosContra} | ${v.ausenciasVotacao} |`);
  }
  l.push('', '## PDFs de presença lidos', '', ...d.presencasLidas.map((p) => `- ${p.arquivo}: ${p.linhas} linhas`));
  l.push('', '## PDFs de votação lidos', '', ...d.votacoesLidas.map((v) => `- ${v.ano}: ${v.blocos} projetos (${v.semEventos} sem votação lida)`));
  l.push('', '## Nomes não atribuídos (ficaram de fora do site)', '');
  l.push(...(d.naoAtribuidos.length ? d.naoAtribuidos.map((n) => `- ${n.fonte}: "${n.nome}"`) : ['- nenhum']));
  l.push('', '## O que é estimativa', '');
  l.push('- Grupos de propostas: regra automática pela categoria e por palavras da ementa (publicada no site).');
  l.push(`- Ruas e bairros: lidos do texto da ementa. Pedidos de melhoria sem lugar identificado: ${d.meta.semLocal}.`);
  l.push('- Votações: leitura do PDF oficial; primeiro nome ligado ao vereador. Votos a favor não são deduzidos.');
  l.push('- Presença: sessões extraordinárias não são separadas das ordinárias.');
  return `${l.join('\n')}\n`;
}
```

- [ ] **Step 5: Escrever `src/atualizar.js`**

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { VEREADORES_ESPERADOS } from './config.js';
import { coletarTudo } from './coletar.js';
import { processar } from './processar.js';
import { conferir } from './conferir.js';
import { relatorio } from './relatorio.js';
import { gerarSite } from './gerar-site.js';

const usarCache = process.argv.includes('--usar-cache');
const coleta = usarCache ? JSON.parse(await readFile('data/bruto/coleta.json', 'utf8')) : await coletarTudo();
const dados = processar(coleta);

let anterior = null;
try { anterior = JSON.parse(await readFile('data/processado/meta.json', 'utf8')); } catch { /* primeira execução */ }

const problemas = conferir(dados, anterior, VEREADORES_ESPERADOS);
await writeFile('conferencia.md', relatorio(dados, problemas));
if (problemas.length) {
  console.error(`NÃO PUBLICADO. O site continua na última versão boa.\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}

await mkdir('data/processado', { recursive: true });
await writeFile('data/processado/dados.json', JSON.stringify(dados));
await writeFile('data/processado/meta.json', `${JSON.stringify(dados.meta, null, 2)}\n`);
await gerarSite(dados, 'dist');
console.log('Pronto. Veja conferencia.md e a pasta dist/.');
```

> `src/atualizar.js` importa `gerarSite`, que só é criado na Task 8. Por isso ele só roda na Task 8. Nesta tarefa, a verificação usa um script descartável (Step 6).

- [ ] **Step 6: Rodar a checagem e processar a coleta da Task 6**

Run: `npm run checar`
Expected: todas as seções `ok`, inclusive `ok: conferir`.

Criar um arquivo descartável `scratch-processar.mjs` na raiz (não commitar):

```js
import { readFile, writeFile } from 'node:fs/promises';
import { processar } from './src/processar.js';
import { conferir } from './src/conferir.js';
import { relatorio } from './src/relatorio.js';
const d = processar(JSON.parse(await readFile('data/bruto/coleta.json', 'utf8')));
await writeFile('conferencia.md', relatorio(d, conferir(d, null, 11)));
console.log(d.meta, JSON.stringify(d.repetidos.slice(0, 3), null, 1));
```

Run: `node scratch-processar.mjs`, depois apagar o arquivo.
Expected: `conferencia.md` com "✅ Tudo certo" e uma tabela de 11 vereadores, sem zeros suspeitos. Os `repetidos` devem trazer ruas reais (ex.: "Avenida Nações Unidas"). Leia a seção "Nomes não atribuídos". Se aparecer o apelido de um vereador, corrija `dividirNomes` ou a leitura do PDF. Não force a atribuição.

- [ ] **Step 7: Commit**

```bash
git add src/processar.js src/conferir.js src/relatorio.js src/atualizar.js check/regras.mjs
git commit -m "feat: processamento, barreira de publicação e relatório de conferência"
```

---

### Task 8: O site

**Files:**
- Create: `src/gerar-site.js`, `src/gerar.js`, `site/estilo.css`, `site/busca.js`

**Interfaces:**
- Consumes: o objeto `Dados` (Task 7), `GRUPOS` (Task 2), `TIPOS_NOME` (Task 3), `esc` e a config (Task 1)
- Produces: `gerarSite(dados, destino): Promise<void>`, que escreve `index.html`, `vereador/<id>.html`, `votacoes.html`, `fontes.html`, `dados/busca.json`, `estilo.css`, `busca.js` e `.nojekyll`
- Formato de `dados/busca.json`: `{ p: [id, data, grupo, autoresTexto, ementa, "Categoria Nº"][], l: [nomeLocal, idx[]][] }`, em que `idx` aponta para `p` (mesma ordem de `dados.proposituras`)

Sem checagem automática, porque é HTML. A verificação é feita no navegador (Step 6).

- [ ] **Step 1: Escrever `src/gerar-site.js`**

```js
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { AUTOR, SALARIO, ANO_INICIO, fichaOficial } from './config.js';
import { GRUPOS } from './regras/classificar.js';
import { TIPOS_NOME } from './regras/local.js';
import { esc } from './util/texto.js';

const GRUPOS_PUBLICOS = ['melhoria', 'cobranca', 'homenagem', 'lei', 'outros'];
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener">${texto}</a>`;

function layout({ titulo, corpo, prefixo = '', atualizadoEm }) {
  const quando = new Date(atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="O que cada vereador de Salto/SP fez desde a posse, só com dados oficiais da Câmara.">
<link rel="stylesheet" href="${prefixo}estilo.css">
</head>
<body>
<header class="topo">
  <a class="marca" href="${prefixo}index.html">Radar Saltense</a>
  <nav><a href="${prefixo}index.html#bairro">Seu bairro</a><a href="${prefixo}index.html#vereadores">Vereadores</a><a href="${prefixo}votacoes.html">Votações</a><a href="${prefixo}fontes.html">De onde vêm os números</a></nav>
</header>
<main>
${corpo}
</main>
<footer>
  <p>Atualizado em ${esc(quando)}. Tudo sai dos sistemas oficiais da Câmara Municipal de Salto.</p>
  <p>Radar Saltense é um projeto independente de ${esc(AUTOR.nome)}, feito por morador, sem vínculo com a Câmara, com a Prefeitura ou com partido.</p>
  <p>Achou um erro? Me chama no Instagram: <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>.</p>
</footer>
<script src="${prefixo}busca.js" defer></script>
</body>
</html>
`;
}

const itemProposta = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> ${esc(p.ementa)} ${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

function paginaInicial(d) {
  const n = d.vereadores.length;
  const salario = SALARIO
    ? `<p class="destaque">Salário pago aos ${n} vereadores desde a posse: <strong id="contador-salario" data-mensal="${SALARIO.valorMensal * n}" data-inicio="${ANO_INICIO}-01-01">—</strong><br><small>Estimativa: ${n} salários de R$ ${SALARIO.valorMensal.toLocaleString('pt-BR')} por mês desde 1º de janeiro de ${ANO_INICIO}. ${link(SALARIO.fonte, 'fonte oficial')}</small></p>`
    : '';
  const repetidos = d.repetidos.slice(0, 30).map((r) =>
    `<li><strong>${esc(r.rua)}</strong>: ${esc(TIPOS_NOME[r.tipo] || r.tipo)}, pedido ${r.pedidos.length} vezes
<details><summary>ver datas e autores</summary><ul class="lista">${r.pedidos.map((p) => `<li><span class="data">${dataBR(p.data)}</span> ${esc(p.autores)} ${link(fichaOficial(p.id), 'ficha')}</li>`).join('')}</ul></details></li>`).join('\n');
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, d.proposituras.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) =>
    `<details class="grupo" data-grupo="${g}"><summary>${esc(GRUPOS[g])} <span class="num">${contagem[g]}</span></summary><ul class="lista"></ul></details>`).join('\n');
  const partidos = [...new Set(d.vereadores.map((v) => v.partido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const cartoes = d.vereadores.map((v) => `<li class="cartao" data-nome="${esc(v.nome)}" data-partido="${esc(v.partido)}" data-faltas="${v.presenca.A}" data-lei="${v.porGrupo.lei}" data-homenagem="${v.porGrupo.homenagem}" data-melhoria="${v.porGrupo.melhoria}" data-contra="${v.votosContra}">
  <a href="vereador/${esc(v.id)}.html"><strong>${esc(v.nome)}</strong> <span class="partido">${esc(v.partido)}</span></a>
  <dl><dt>Faltas</dt><dd>${v.presenca.A} de ${v.presenca.total} sessões</dd><dt>Pedidos para os bairros</dt><dd>${v.porGrupo.melhoria}</dd><dt>Perguntas e cobranças</dt><dd>${v.porGrupo.cobranca}</dd><dt>Propostas de lei</dt><dd>${v.porGrupo.lei}</dd><dt>Homenagens</dt><dd>${v.porGrupo.homenagem}</dd><dt>Votou contra</dt><dd>${v.votosContra}</dd></dl>
</li>`).join('\n');

  const corpo = `<section class="hero">
<h1>Radar Saltense</h1>
<p>O que cada vereador de Salto fez desde a posse, atualizado todo dia. Só dado oficial, com link para a fonte.</p>
${salario}
</section>
<section id="bairro">
<h2>O que pediram pro seu bairro?</h2>
<label for="busca-bairro">Digite o nome do bairro ou da rua</label>
<input id="busca-bairro" type="search" placeholder="Ex.: Jardim Saltense ou Rua Nove de Julho" autocomplete="off">
<div id="resultado-busca" aria-live="polite"></div>
</section>
<section id="repetidos">
<h2>O problema que não some</h2>
<p>Pedidos do mesmo tipo que voltaram mais de uma vez para a mesma rua. No site da Câmara, cada pedido aparece sozinho. Aqui eles são cruzados.</p>
<p class="aviso">Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.</p>
<ol class="lista">${repetidos}</ol>
</section>
<section id="trabalho">
<h2>Homenagem ou trabalho?</h2>
<p>Todas as propostas desde ${ANO_INICIO}, separadas pela mesma regra para todos os vereadores. <a href="fontes.html#regras">Veja a regra</a>.</p>
${grupos}
</section>
<section id="vereadores">
<h2>Os ${n} vereadores</h2>
<div class="filtros">
<input id="filtro-nome" type="search" placeholder="Buscar por nome" aria-label="Buscar vereador por nome">
<select id="filtro-partido" aria-label="Filtrar por partido"><option value="">Todos os partidos</option>${partidos.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
<select id="ordem" aria-label="Ordenar"><option value="nome">Nome (A–Z)</option><option value="faltas">Quem mais faltou</option><option value="lei">Mais propostas de lei</option><option value="homenagem">Mais homenagens</option><option value="melhoria">Mais pedidos para os bairros</option><option value="contra">Quem mais votou contra</option></select>
</div>
<ul id="lista-vereadores" class="cartoes">
${cartoes}
</ul>
</section>`;
  return layout({ titulo: 'Radar Saltense: o que cada vereador de Salto fez', corpo, atualizadoEm: d.meta.atualizadoEm });
}

function paginaVereador(v, d) {
  const props = d.proposituras.filter((p) => p.vereadores.includes(v.id));
  const pres = d.presenca[v.id];
  const sessoes = [...pres.sessoes].reverse().map((s) =>
    `<tr><td>${dataBR(s.data)}</td><td class="m-${s.marca || 'vazio'}">${s.marca || '—'}</td><td>${link(s.url, 'PDF')}</td></tr>`).join('');
  const grupos = GRUPOS_PUBLICOS.map((g) => {
    const lista = props.filter((p) => p.grupo === g);
    return `<details><summary>${esc(GRUPOS[g])} <span class="num">${lista.length}</span></summary><ul class="lista">${lista.map(itemProposta).join('')}</ul></details>`;
  }).join('\n');
  const votos = (campo) =>
    d.votacoes.flatMap((pj) => pj.eventos.filter((e) => e[campo].includes(v.id)).map((e) =>
      `<li><span class="data">${dataBR(e.data)}</span> ${esc(pj.rotulo)}${e.turno ? ` (${esc(e.turno)})` : ''}: ${esc(e.resultado)} ${link(e.url, 'PDF')}</li>`)).join('') || '<li>Nenhum registro.</li>';

  const corpo = `<section class="perfil">
<h1>${esc(v.nome)}</h1>
<p class="partido">${esc(v.partido)}</p>
<p>${link(v.url, 'Página oficial na Câmara')}</p>
</section>
<section>
<h2>Presença</h2>
<p><strong>${pres.P}</strong> presenças, <strong>${pres.A}</strong> faltas e <strong>${pres.AJ}</strong> ausências justificadas, em ${pres.sessoes.length} sessões registradas.</p>
<p class="aviso">As sessões extraordinárias aparecem junto com as ordinárias. Célula vazia no PDF não conta como falta.</p>
<details><summary>Sessão por sessão</summary><table><thead><tr><th>Data</th><th>Registro</th><th>Fonte</th></tr></thead><tbody>${sessoes}</tbody></table></details>
</section>
<section>
<h2>Propostas</h2>
<p>${props.length} propostas desde ${ANO_INICIO}. Proposta com mais de um autor conta para cada um.</p>
${grupos}
</section>
<section>
<h2>Votações</h2>
<p class="aviso">Leitura do documento oficial de votações. Ele só cita quem votou contra ou faltou, e o site não deduz votos a favor.</p>
<h3>Votou contra</h3><ul class="lista">${votos('contra')}</ul>
<h3>Ausente na votação</h3><ul class="lista">${votos('ausentes')}</ul>
</section>`;
  return layout({ titulo: `${v.nome}: Radar Saltense`, corpo, prefixo: '../', atualizadoEm: d.meta.atualizadoEm });
}

function paginaVotacoes(d) {
  const nome = Object.fromEntries(d.vereadores.map((v) => [v.id, v.nome]));
  const nomes = (ids) => ids.map((id) => esc(nome[id])).join(', ');
  const artigos = d.votacoes.map((pj) => `<article class="votacao">
<h3>${esc(pj.rotulo)}</h3>
<p>${esc(pj.ementa)}</p>
<p class="partido">Autor: ${esc(pj.autor)}</p>
<ul class="lista">${pj.eventos.map((e) => `<li><span class="data">${dataBR(e.data)}</span> ${e.turno ? `${esc(e.turno)}: ` : ''}${esc(e.resultado)}${e.contra.length ? `<br>Contra: ${nomes(e.contra)}` : ''}${e.ausentes.length ? `<br>Ausentes: ${nomes(e.ausentes)}` : ''} ${link(e.url, 'PDF')}</li>`).join('')}</ul>
</article>`).join('\n');
  const corpo = `<h1>Votações</h1>
<p class="aviso">Leitura do documento oficial "Resultado das votações", publicado pela Câmara. Ele só cita quem votou contra ou faltou, às vezes só pelo primeiro nome. Nome que não deu para identificar com certeza fica de fora.</p>
${artigos}`;
  return layout({ titulo: 'Votações: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}

function paginaFontes(d) {
  const corpo = `<h1>De onde vêm os números</h1>
<p>Tudo sai dos sistemas oficiais da Câmara Municipal de Salto. Nada é digitado à mão. O site é refeito todo dia de madrugada.</p>
<h2>Fontes</h2>
<ul>
<li><strong>Propostas:</strong> <a href="https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92">portal de proposituras da Câmara</a>. Cada proposta tem link para a ficha oficial.</li>
<li><strong>Presença:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/presenca-dos-vereadores">PDFs mensais de presença</a>. P = presença, A = ausência, AJ = ausência justificada.</li>
<li><strong>Votações:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/votacao-tramitacao-dos-projetos">PDF anual "Resultado das votações"</a>.</li>
<li><strong>Vereadores e partidos:</strong> <a href="https://www.camarasalto.sp.gov.br/">página inicial da Câmara</a>.</li>
</ul>
<h2 id="regras">Homenagem ou trabalho: a regra</h2>
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
<h2>Ruas e bairros</h2>
<p>O nome da rua e do bairro é lido do próprio texto do pedido. Quando o texto não deixa claro o lugar, o pedido continua no site, mas fica fora da busca por bairro. "O problema que não some" junta pedidos do mesmo tipo (buraco, asfalto, iluminação, limpeza, bueiro, sinalização, poda, lixo) para a mesma rua, a partir de 2 pedidos.</p>
<p class="aviso">Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.</p>
<h2>Presença</h2>
<p>Contamos as marcas P, A e AJ dos PDFs oficiais. "Quem mais faltou" conta só as ausências sem justificativa (A). Dado ausente não é falta: célula vazia não conta. As sessões extraordinárias aparecem junto com as ordinárias.</p>
<h2>Votações</h2>
<p>O PDF oficial informa o resultado e cita, às vezes só pelo primeiro nome, quem votou contra ou faltou. O primeiro nome é ligado ao vereador. Se um nome não bater com exatamente um vereador, ele fica de fora. O site não deduz votos a favor.</p>
${SALARIO ? `<h2>Salário</h2><p>O contador multiplica o salário mensal oficial pelo número de vereadores, desde 1º de janeiro de ${ANO_INICIO}. É uma estimativa. ${link(SALARIO.fonte, 'Fonte oficial do valor')}.</p>` : ''}
<h2>Achou um erro?</h2>
<p>Me chama no Instagram <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>. Se a Câmara corrigir o dado na fonte, o site se corrige sozinho na próxima atualização.</p>`;
  return layout({ titulo: 'De onde vêm os números: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}

export async function gerarSite(d, destino) {
  await mkdir(`${destino}/vereador`, { recursive: true });
  await mkdir(`${destino}/dados`, { recursive: true });
  await writeFile(`${destino}/index.html`, paginaInicial(d));
  for (const v of d.vereadores) await writeFile(`${destino}/vereador/${v.id}.html`, paginaVereador(v, d));
  await writeFile(`${destino}/votacoes.html`, paginaVotacoes(d));
  await writeFile(`${destino}/fontes.html`, paginaFontes(d));
  const busca = {
    p: d.proposituras.map((p) => [p.id, p.data, p.grupo, p.autoresTexto, p.ementa, `${p.categoria} ${p.numero}`]),
    l: d.locais.map((l) => [l.nome, l.idx]),
  };
  await writeFile(`${destino}/dados/busca.json`, JSON.stringify(busca));
  await copyFile('site/estilo.css', `${destino}/estilo.css`);
  await copyFile('site/busca.js', `${destino}/busca.js`);
  await writeFile(`${destino}/.nojekyll`, '');
}
```

- [ ] **Step 2: Escrever `src/gerar.js`**

```js
import { readFile } from 'node:fs/promises';
import { gerarSite } from './gerar-site.js';

const dados = JSON.parse(await readFile('data/processado/dados.json', 'utf8'));
await gerarSite(dados, 'dist');
console.log('Site gerado em dist/');
```

- [ ] **Step 3: Escrever `site/busca.js`**

```js
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
  const ficha = (id) => `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:78:::::P78_ID_PROJETO:${id}`;
  let dados = null;
  const carregar = async () => dados || (dados = await (await fetch('dados/busca.json')).json());
  const item = ([id, data, , autores, ementa, doc]) =>
    `<li><span class="data">${dataBR(data)}</span> <strong>${esc(autores)}</strong> <span class="tag">${esc(doc)}</span> ${esc(ementa)} <a href="${ficha(id)}" target="_blank" rel="noopener">ficha oficial</a></li>`;

  // Busca por bairro ou rua
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
          ? `<p>${itens.length} pedidos para: ${nomes.slice(0, 8).map(esc).join(', ')}${nomes.length > 8 ? '…' : ''}</p><ul class="lista">${itens.slice(0, 200).map(item).join('')}</ul>${itens.length > 200 ? '<p>Mostrando os 200 mais recentes.</p>' : ''}`
          : '<p>Nada encontrado. Tente outro nome ou só uma parte dele.</p>';
      }, 250);
    });
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

  // Filtro e ordem dos vereadores
  const lista = document.getElementById('lista-vereadores');
  if (lista) {
    const nome = document.getElementById('filtro-nome');
    const partido = document.getElementById('filtro-partido');
    const ordem = document.getElementById('ordem');
    const aplicar = () => {
      const q = norm(nome.value);
      const pt = partido.value;
      const o = ordem.value;
      const cartoes = [...lista.children];
      cartoes.sort((a, b) => (o === 'nome' ? 0 : Number(b.dataset[o]) - Number(a.dataset[o])) || a.dataset.nome.localeCompare(b.dataset.nome, 'pt-BR'));
      for (const c of cartoes) {
        c.hidden = Boolean((q && !norm(c.dataset.nome).includes(q)) || (pt && c.dataset.partido !== pt));
        lista.appendChild(c);
      }
    };
    [nome, partido, ordem].forEach((el) => el.addEventListener('input', aplicar));
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
})();
```

- [ ] **Step 4: Escrever `site/estilo.css`**

```css
:root { --texto: #1a1a1a; --suave: #5b5b5b; --linha: #e3e3e3; --link: #0b5cad; --fundo: #ffffff; --aviso: #fff6db; --falta: #b3261e; --justif: #8a6d00; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--texto); background: var(--fundo); }
a { color: var(--link); }
.topo { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; justify-content: space-between; padding: .75rem 1rem; border-bottom: 1px solid var(--linha); }
.marca { font-weight: 800; font-size: 1.15rem; color: var(--texto); text-decoration: none; }
.topo nav { display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-size: .95rem; }
main { max-width: 860px; margin: 0 auto; padding: 1rem; }
section { margin: 2rem 0; }
h1 { font-size: 1.9rem; line-height: 1.2; margin: .5rem 0; }
h2 { font-size: 1.4rem; margin: .25rem 0 .75rem; }
h3 { font-size: 1.1rem; }
.hero p { font-size: 1.1rem; }
.destaque strong { font-size: 1.5rem; }
.aviso { background: var(--aviso); padding: .5rem .75rem; border-radius: 6px; font-size: .95rem; }
label { display: block; font-weight: 600; }
input[type=search], select { width: 100%; font: inherit; padding: .65rem .75rem; border: 1px solid #bdbdbd; border-radius: 8px; margin: .25rem 0 .75rem; background: #fff; }
.filtros { display: grid; gap: .5rem; }
.lista { list-style: none; padding: 0; margin: .5rem 0; }
.lista li { padding: .6rem 0; border-bottom: 1px solid var(--linha); overflow-wrap: anywhere; }
ol.lista { list-style: decimal inside; }
.data { color: var(--suave); font-variant-numeric: tabular-nums; margin-right: .25rem; }
.tag { display: inline-block; font-size: .8rem; background: #eef3fa; border-radius: 4px; padding: 0 .35rem; margin-right: .25rem; }
details { border: 1px solid var(--linha); border-radius: 8px; padding: .5rem .75rem; margin: .5rem 0; }
summary { cursor: pointer; font-weight: 600; }
.num { float: right; color: var(--suave); font-weight: 400; }
.cartoes { list-style: none; padding: 0; display: grid; gap: .75rem; }
.cartao { border: 1px solid var(--linha); border-radius: 10px; padding: .75rem; }
.cartao a { text-decoration: none; }
.partido { color: var(--suave); font-size: .9rem; }
.cartao dl { display: grid; grid-template-columns: 1fr auto; gap: .15rem .75rem; margin: .5rem 0 0; font-size: .95rem; }
.cartao dd { margin: 0; text-align: right; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .35rem; border-bottom: 1px solid var(--linha); }
.m-A { color: var(--falta); font-weight: 700; }
.m-AJ { color: var(--justif); }
.votacao { border-bottom: 1px solid var(--linha); padding: .75rem 0; }
.votacao h3 { margin: .25rem 0; }
footer { border-top: 1px solid var(--linha); padding: 1rem; color: var(--suave); font-size: .9rem; max-width: 860px; margin: 2rem auto 0; }
@media (min-width: 640px) {
  .filtros { grid-template-columns: 2fr 1fr 1.5fr; }
  .cartoes { grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 5: Gerar o site a partir da coleta já feita**

Run: `npm run processar`
Expected: `Pronto. Veja conferencia.md e a pasta dist/.`, além de `data/processado/dados.json` e `meta.json` criados.

- [ ] **Step 6: Ver no navegador (celular e computador)**

Run: `npm run ver` e abrir `http://localhost:8080`.
Conferir:
- a busca "Santa Lúcia" lista pedidos com link para a ficha oficial;
- "O problema que não some" mostra ruas com a contagem e as datas;
- os grupos abrem e listam as propostas;
- aparecem os 11 cartões, e ordenar por "Quem mais faltou" muda a ordem;
- a página de um vereador mostra presença, propostas e votações;
- `votacoes.html` e `fontes.html` abrem;
- na largura de celular (375 px), não há rolagem horizontal.

- [ ] **Step 7: Commit**

```bash
git add src/gerar-site.js src/gerar.js site data/processado
git commit -m "feat: páginas do Radar Saltense"
```

---

### Task 9: Robô diário e publicação no GitHub

**Files:**
- Create: `.github/workflows/atualizar.yml`, `README.md`

**Interfaces:**
- Consumes: `npm run checar`, `npm run atualizar` e `dist/` (Tasks 1 a 8)

- [ ] **Step 1: Escrever `.github/workflows/atualizar.yml`**

```yaml
name: Atualizar Radar Saltense

on:
  schedule:
    - cron: '0 6 * * *' # 03:00 em Brasília
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: radar-saltense
  cancel-in-progress: false

jobs:
  atualizar:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.publicar.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run checar
      - name: Coletar, conferir e gerar
        run: npm run atualizar
      - name: Guardar relatório de conferência
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: conferencia
          path: conferencia.md
          if-no-files-found: ignore
      - name: Salvar dados no repositório
        run: |
          git config user.name "radar-saltense-robo"
          git config user.email "radar-saltense-robo@users.noreply.github.com"
          git add data
          git diff --cached --quiet || git commit -m "dados: atualização diária"
          git push
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: publicar
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Escrever o `README.md`, gravando primeiro como `README.tmp` e depois com `mv README.tmp README.md` (por causa do hook de limpeza de `.md`)**

````markdown
# Radar Saltense

O que cada vereador de Salto/SP fez desde a posse, só com dados oficiais da Câmara. Atualizado sozinho todo dia.

Projeto independente de Sanderson Oliveira (@sandersonoliveira1). Inspirado no radarptlandia.org.

## Como funciona

Todo dia às 03:00 (Brasília), o GitHub Actions:
1. coleta as proposituras, os PDFs de presença e os PDFs de votação da Câmara;
2. organiza os dados (`src/processar.js`);
3. confere os dados (`src/conferir.js`). Se algo parecer errado, **não publica**, e o site continua na última versão boa;
4. gera o site em `dist/` e publica no GitHub Pages.

O relatório `conferencia.md` de cada execução fica em Actions → execução → Artifacts.

## Comandos

```bash
npm install
npx playwright install chromium
npm run checar      # checagens das regras
npm run coletar     # só coleta (gera data/bruto/coleta.json)
npm run processar   # processa a última coleta e gera o site
npm run atualizar   # tudo: coleta, confere e gera
npm run ver         # abre dist/ em http://localhost:8080
```

## Publicar (uma vez)

1. Crie uma conta em github.com e um repositório **público** chamado `radar-saltense`.
2. No repositório, vá em Settings → Pages → Source e escolha **GitHub Actions**.
3. Envie este projeto para o repositório (`git remote add origin ...` e `git push -u origin main`).
4. Em Actions → "Atualizar Radar Saltense", clique em **Run workflow**.
5. Abra o `conferencia.md` da execução e confira 2 ou 3 vereadores na fonte oficial antes de divulgar.

Domínio próprio (opcional): em Settings → Pages → Custom domain, e cadastre as entradas de DNS no painel de onde você comprou o domínio.

## Plano B: a Câmara bloqueou o GitHub

Rode `npm run atualizar` no seu computador e depois `git add data && git commit -m "dados" && git push`. Em seguida, rode o workflow manualmente para publicar.
````

- [ ] **Step 3: Rodar a checagem final local**

Run: `npm run checar && npm run processar`
Expected: todas as seções `ok` e a mensagem `Pronto.`

- [ ] **Step 4: Commit**

```bash
git add .github README.md
git commit -m "ci: robô diário e publicação no GitHub Pages"
```

- [ ] **Step 5: Publicar (junto com o usuário)**

O usuário faz os passos 1 e 2 da seção "Publicar" do README e informa `usuário/radar-saltense`. Depois:

```bash
git branch -M main
git remote add origin https://github.com/<usuário>/radar-saltense.git
git push -u origin main
```

Rodar o workflow manualmente (Actions → Run workflow) e acompanhar.
Expected: o job fica verde, e a URL do Pages aparece no resumo da execução.
Se a coleta falhar só no GitHub, com erro de rede ou 403, aplicar o Plano B do README e avisar o usuário.

- [ ] **Step 6: Conferência humana antes de divulgar (Passo 5 do manual)**

Baixar o artifact `conferencia`. Junto com o usuário, abrir a ficha oficial de 2 ou 3 vereadores (a presença do mês no PDF, 3 propostas no portal e 1 votação no PDF) e comparar com o site. Registrar no `conferencia.md` o que bate e o que não bate. Divulgar só depois disso.

---

### Task 10 (opcional): Contador de salário com fonte oficial

**Files:**
- Modify: `src/config.js` (`SALARIO`)

- [ ] **Step 1: Procurar o valor oficial do subsídio dos vereadores de Salto (legislatura 2025–2028)**

Fontes aceitas: a lei ou resolução que fixa o subsídio (no portal de Leis da Câmara, `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:103` → Leis) ou a folha no Portal da Transparência (`https://cmsalto.giap.com.br/ords/cmsalto/f?p=839`). Notícia de jornal não vale.

- [ ] **Step 2: Só se achou a fonte, preencher `src/config.js` com o valor mensal em reais e a URL do documento oficial encontrado**

```js
export const SALARIO = { valorMensal: VALOR_DA_LEI, fonte: 'URL_DO_DOCUMENTO_OFICIAL' };
```

`VALOR_DA_LEI` e `URL_DO_DOCUMENTO_OFICIAL` vêm do Step 1 e não podem ser inventados. Se não houver fonte oficial, mantenha `SALARIO = null`: o contador não aparece e nada mais muda.

- [ ] **Step 3: Gerar e conferir**

Run: `npm run gerar`, depois `npm run ver`, e abrir `http://localhost:8080`.
Expected: o contador aparece no topo, sobe a cada segundo e tem link para a fonte. A página `fontes.html` ganha a seção "Salário".

- [ ] **Step 4: Commit**

```bash
git add src/config.js
git commit -m "feat: contador de salário com fonte oficial"
```
