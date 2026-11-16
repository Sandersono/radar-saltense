# Onda 1 (Câmara) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menu novo e página `camara.html` com custo da Câmara (folha), requerimentos respondidos e campanha de 2024, também resumidos na página de cada vereador.

**Architecture:** Três módulos de dados independentes (folha, respostas, campanha), cada um com regras puras + checagem própria + coletor/ferramenta, feitos em paralelo em worktrees separados (Tasks 1–3). Depois uma tarefa de integração (Task 4) liga tudo ao robô, à barreira e às telas. Fontes novas são secundárias: se falharem, o robô mantém o último dado bom salvo em `data/processado/` e avisa.

**Tech Stack:** Node ≥22.13 ES modules, Playwright (Chromium, já no projeto), `node:zlib` para o zip do TSE, HTML por template string, `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-16-onda1-camara-design.md`

## Global Constraints

- Só dado oficial, com link para a fonte. Fato, nunca acusação.
- Nomes de pessoas físicas nunca saem dos coletores, a não ser os 11 vereadores e o prefeito. Nada de CPF.
- Coleta educada: User-Agent `UA` de `src/config.js`, pelo menos 2 s entre páginas (`aguardarVez()`/`marcarFim()` de `src/coleta/http.js`).
- Checagens só com `node:assert`, em arquivos `check/<modulo>.mjs` (um por módulo, para as tarefas paralelas não mexerem no mesmo arquivo); sem framework, sem stubs, sem rede.
- `.md` é escrito como `.tmp` e renomeado (hook local colapsa indentação).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tasks 1–3 rodam em paralelo: cada uma só cria os arquivos listados nela. Não mexer em `package.json`, `src/coletar.js`, `src/processar.js` nem em telas (isso é da Task 4).

---

### Task 1: Folha da Câmara

**Files:**
- Create: `src/regras/folha.js`, `src/coleta/folha-camara.js`, `src/ferramentas/folha-camara.js`, `check/folha.mjs`
- Create (gerado e versionado): `data/processado/folha-camara.json`

**Interfaces:**
- Consumes: `normalizar` (`src/util/texto.js`), `criarCasador(vereadores)` (`src/regras/nomes.js`, casa nome → id; vereadores `{id, nome, apelido}`), `UA`, `aguardarVez`, `marcarFim`.
- Produces:
  - `GRUPOS_FOLHA`, `lerCsvFolha(texto) -> objetos[]`, `grupoFolha(linha) -> 'vereadores'|'assessores'|'servidores'`, `resumirFolha(linhas, vereadores) -> { grupos: {vereadores:{total,pessoas}, assessores:{…}, servidores:{…}}, porVereador: {id: bruto}, indenizacoes }`, `mesclarFolha(salvo, novos) -> objeto` (novos com valor `null` não apagam o salvo).
  - `coletarFolha(meses: ['AAAA-MM'], vereadores) -> { 'AAAA-MM': resumo | null }` (null = mês sem folha publicada).
  - Arquivo `data/processado/folha-camara.json`: `{ "AAAA-MM": resumo }`.

- [ ] **Step 1: Checagens (falham)** — `check/folha.mjs`:

```js
import assert from 'node:assert/strict';
import { lerCsvFolha, grupoFolha, resumirFolha, mesclarFolha } from '../src/regras/folha.js';

const csv = [
  '"Matrícula";"Nome";"Local de Trabalho";"Tipo de Folha";"Unidade";"Cargo";"Regime";"Admissão";"Demissão";"Evento";"Salário Bruto";"Descontos";"Salário Líquido";"Orgão";"Indenizações";"Ano"',
  '"1001";"ALMIR DE MELO SANTOS";"CAMARA MUNICIPAL";"Pagamento";"-";"VEREADOR";"VEREADORES";"01/01/2025";"-";"Exibir";"10.000,00";"4.154,26";"5.845,74";"-";"0,00";"2026"',
  '"1002";"ARILDO GUADAGNINI";"CAMARA MUNICIPAL";"Pagamento";"-";"PRESIDENTE DA CAMARA";"VEREADORES";"01/01/2025";"-";"Exibir";"12.500,00";"5.000,00";"7.500,00";"-";"0,00";"2026"',
  '"2001";"FULANO ASSESSOR";"COMISSIONADOS";"Pagamento";"-";"ASSESSOR PARLAMENTAR";"COMISSAO";"01/02/2025";"-";"Exibir";"4.775,83";"900,00";"3.875,83";"-";"0,00";"2026"',
  '"2002";"BELTRANO CHEFE";"COMISSIONADOS";"Pagamento";"-";"CHEFE DE GABINETE PRESIDENCIA";"COMISSAO";"01/02/2025";"-";"Exibir";"6.512,49";"1.000,00";"5.512,49";"-";"0,00";"2026"',
  '"3001";"CICLANO SERVIDOR";"ADMINISTRATIVO";"Pagamento";"-";"ANALISTA LEGISLATIVO";"CLT";"01/02/2010";"-";"Exibir";"10.479,00";"2.000,00";"8.479,00";"-";"150,00";"2026"',
  '"3001";"CICLANO SERVIDOR";"ADMINISTRATIVO";"13º Salário";"-";"ANALISTA LEGISLATIVO";"CLT";"01/02/2010";"-";"Exibir";"1.000,00";"0,00";"1.000,00";"-";"0,00";"2026"',
  '"3002";"BELTRANA INATIVA";"ADMINISTRATIVO";"Pagamento";"-";"INATIVO";"INATIVOS";"01/02/1990";"-";"Exibir";"3.000,00";"0,00";"3.000,00";"-";"-";"2026"',
].join('\r\n');

const linhas = lerCsvFolha(csv);
assert.equal(linhas.length, 7);
assert.equal(linhas[0]['Nome'], 'ALMIR DE MELO SANTOS');
assert.equal(grupoFolha(linhas[0]), 'vereadores');
assert.equal(grupoFolha(linhas[1]), 'vereadores');
assert.equal(grupoFolha(linhas[2]), 'assessores');
assert.equal(grupoFolha(linhas[3]), 'assessores');
assert.equal(grupoFolha(linhas[4]), 'servidores');
assert.equal(grupoFolha(linhas[6]), 'servidores');
const vereadores = [{ id: 'almir', nome: 'Almir de Melo Santos' }, { id: 'arildo', nome: 'Arildo Guadagnini' }];
const r = resumirFolha(linhas, vereadores);
assert.deepEqual(r.grupos, {
  vereadores: { total: 22500, pessoas: 2 },
  assessores: { total: 11288.32, pessoas: 2 },
  servidores: { total: 14479, pessoas: 2 },
});
assert.deepEqual(r.porVereador, { almir: 10000, arildo: 12500 });
assert.equal(r.indenizacoes, 150);
assert.ok(!JSON.stringify(r).includes('FULANO') && !JSON.stringify(r).includes('CICLANO'));
assert.deepEqual(mesclarFolha({ '2025-01': 1, '2025-02': 2 }, { '2025-02': 3, '2025-03': null }), { '2025-01': 1, '2025-02': 3 });
assert.throws(() => resumirFolha(lerCsvFolha(csv.replace('"10.000,00"', '"dez mil"')), vereadores), /inválido/);
console.log('ok: folha');
```

- [ ] **Step 2:** `node check/folha.mjs` → FAIL (módulo não existe).

- [ ] **Step 3: `src/regras/folha.js`**

```js
import { normalizar } from '../util/texto.js';
import { criarCasador } from './nomes.js';

export const GRUPOS_FOLHA = { vereadores: 'Vereadores', assessores: 'Assessores dos vereadores', servidores: 'Servidores da Câmara' };

const M = (s) => normalizar(s).toUpperCase();
const centavos = (v) => Math.round(v * 100) / 100;

export function valorFolha(s) {
  const t = String(s ?? '').trim();
  if (!t || t === '-') return 0;
  if (!/^-?[\d.]*\d(,\d+)?$/.test(t)) throw new Error(`Valor da folha inválido: "${s}"`);
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

export function lerCsvFolha(texto) {
  const linhas = String(texto ?? '').replace(/^/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const tira = (c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
  const cab = linhas[0].split(';').map(tira);
  return linhas.slice(1).map((l) => {
    const c = l.split(';').map(tira);
    return Object.fromEntries(cab.map((k, i) => [k, c[i] ?? '']));
  });
}

export function grupoFolha(l) {
  const cargo = M(l['Cargo']);
  if (M(l['Regime']) === 'VEREADORES' || /^(VEREADOR|PRESIDENTE)/.test(cargo)) return 'vereadores';
  if (/ASSESSOR PARLAMENTAR|CHEFE DE GABINETE/.test(cargo)) return 'assessores';
  return 'servidores';
}

// Só agregados; o único nome que sai é o id do vereador.
export function resumirFolha(linhas, vereadores) {
  const casar = criarCasador(vereadores);
  const grupos = Object.fromEntries(Object.keys(GRUPOS_FOLHA).map((g) => [g, { total: 0, pessoas: 0 }]));
  const porVereador = {};
  const pessoas = new Set();
  let indenizacoes = 0;
  for (const l of linhas) {
    const g = grupoFolha(l);
    const bruto = valorFolha(l['Salário Bruto']);
    grupos[g].total += bruto;
    indenizacoes += valorFolha(l['Indenizações']);
    const chave = `${g}|${l['Matrícula'] || l['Nome']}`;
    if (!pessoas.has(chave)) { pessoas.add(chave); grupos[g].pessoas++; }
    if (g === 'vereadores') {
      const id = casar(l['Nome']);
      if (id) porVereador[id] = centavos((porVereador[id] || 0) + bruto);
    }
  }
  for (const g of Object.values(grupos)) g.total = centavos(g.total);
  return { grupos, porVereador, indenizacoes: centavos(indenizacoes) };
}

export function mesclarFolha(salvo, novos) {
  const r = { ...salvo };
  for (const [mes, v] of Object.entries(novos)) if (v !== null && v !== undefined) r[mes] = v;
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
}
```

- [ ] **Step 4:** `node check/folha.mjs` → `ok: folha`.

- [ ] **Step 5: Coletor `src/coleta/folha-camara.js`** — `export async function coletarFolha(meses, vereadores)`:
  - Playwright Chromium headless, `newPage({ userAgent: UA, acceptDownloads: true })`, abre `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=839:8` (Recursos Humanos do Portal da Transparência da Câmara).
  - Para cada mês: escolher o exercício (item de página global, na pesquisa `#GLOBAL_EXERCICIO`) e o mês (`#P8_MES`), tipo "Geral", "Detalhar", esperar `networkidle` depois de cada seleção (a página recarrega), e baixar a exportação **CSV** do relatório interativo (menu Ações → Download → CSV, ou o botão de download do relatório). Ler o arquivo como texto (`download.path()`; testar UTF-8 e cair para latin-1 se aparecer `�`).
  - `resultado[mes] = linhas.length ? resumirFolha(lerCsvFolha(texto), vereadores) : null`. Mês sem folha publicada → `null` (não é erro). Página/formulário que mudou → lança `Error` com mensagem clara (a Task 4 transforma em aviso).
  - `aguardarVez()`/`marcarFim()` em cada navegação. Os nomes nunca são gravados em disco: o CSV fica só na memória (apagar o arquivo temporário do download).
  - Descobrir os seletores reais no portal (a pesquisa achou `#GLOBAL_EXERCICIO`, `#P8_MES`, botão `#B137830017131526819`); preferir seletores por rótulo/texto quando possível e documentar os usados num comentário.

- [ ] **Step 6: Ferramenta `src/ferramentas/folha-camara.js`** — `node src/ferramentas/folha-camara.js --desde 2025-01`: lê os vereadores de `data/processado/dados.json` (`id`, `nome`, `apelido`), monta a lista de meses de `--desde` até o mês corrente (fuso de São Paulo, `anoMesBR` de `src/util/texto.js`), chama `coletarFolha`, faz `mesclarFolha` com o arquivo existente (se houver) e grava `data/processado/folha-camara.json` (JSON com 2 espaços, `\n` no fim). Imprime por mês: grupos (pessoas e total) e quantos vereadores casaram.

- [ ] **Step 7: Rodar e conferir:** `node src/ferramentas/folha-camara.js --desde 2025-01`. Esperado: meses de 2025-01 até o último publicado; em 2026-10 `vereadores.pessoas` = 11, `porVereador` com 11 ids (10 × R$ 10.000 e 1 × R$ 12.500), `assessores.pessoas` ≈ 11. Se algum mês tiver menos de 11 vereadores casados, anotar no relatório (pode ser suplente/licença) sem forçar.

- [ ] **Step 8: Commit** de `src/regras/folha.js src/coleta/folha-camara.js src/ferramentas/folha-camara.js check/folha.mjs data/processado/folha-camara.json` com a mensagem `feat: folha da Câmara (regras, coletor e carga inicial)`.

---

### Task 2: Respostas a requerimentos

**Files:**
- Create: `src/regras/respostas.js`, `src/coleta/respostas.js`, `src/ferramentas/respostas.js`, `check/respostas.mjs`
- Create (gerado e versionado): `data/processado/respostas.json`

**Interfaces:**
- Consumes: `APEX` e `UA` (`src/config.js`), `aguardarVez`, `marcarFim`; requerimentos vêm de `data/processado/dados.json` → `proposituras` com `categoria === 'Requerimento'` (`id`, `data` 'AAAA-MM-DD', `vereadores` [ids]).
- Produces:
  - `lerRespostas(texto) -> { respondido, data }`, `filaRespostas(estado, requerimentos, hoje, limite) -> ids[]`, `resumoRespostas(estado, requerimentos) -> { geral, porVereador }` (cada um `{ feitos, conferidos, respondidos, percentual, medianaDias }`).
  - `coletarRespostas(ids, hoje) -> { <id>: { respondido, data, conferidoEm } }`.
  - Arquivo `data/processado/respostas.json`: `{ <id>: { respondido, data, conferidoEm } }`.

- [ ] **Step 1: Checagens (falham)** — `check/respostas.mjs`:

```js
import assert from 'node:assert/strict';
import { lerRespostas, filaRespostas, resumoRespostas } from '../src/regras/respostas.js';

const com = 'Anexos\nNome: Resp. Req. 752-25 - X.pdf\nTipo Documento: Resposta Requerimento\nData Documento: 03/02/2026\nDownload\nNome: Req. 752-25 - X.pdf\nTipo Documento: Requerimento\nData Documento: 10/12/2025\nDownload\nTotal 2';
const sem = 'Anexos\nNome: Req. 1-26.pdf\nTipo Documento: Requerimento\nData Documento: 05/01/2026\nTotal 1';
const duas = 'Tipo Documento: Resposta Requerimento\nData Documento: 20/03/2026\nTipo Documento: Resposta Requerimento\nData Documento: 01/03/2026';
assert.deepEqual(lerRespostas(com), { respondido: true, data: '2026-02-03' });
assert.deepEqual(lerRespostas(sem), { respondido: false, data: null });
assert.deepEqual(lerRespostas(duas), { respondido: true, data: '2026-03-01' });

const reqs = [
  { id: '1', data: '2026-11-01', vereadores: ['a'] },
  { id: '2', data: '2026-10-01', vereadores: ['a', 'b'] },
  { id: '3', data: '2026-09-01', vereadores: ['b'] },
  { id: '4', data: '2026-01-01', vereadores: ['b'] },
  { id: '5', data: '2026-08-01', vereadores: ['a'] },
];
const estado = {
  '3': { respondido: false, data: null, conferidoEm: '2026-11-10' },
  '4': { respondido: false, data: null, conferidoEm: '2026-11-01' },
  '5': { respondido: false, data: null, conferidoEm: '2026-11-05' },
};
// nunca conferidos (mais novos primeiro), depois pendentes de até 180 dias conferidos há mais tempo; o 4 tem mais de 180 dias
assert.deepEqual(filaRespostas(estado, reqs, '2026-11-16', 10), ['1', '2', '5', '3']);
assert.deepEqual(filaRespostas(estado, reqs, '2026-11-16', 3), ['1', '2', '5']);
assert.deepEqual(filaRespostas({ ...estado, '5': { ...estado['5'], conferidoEm: '2026-11-16' } }, reqs, '2026-11-16', 10), ['1', '2', '3']);

const est2 = {
  '1': { respondido: true, data: '2026-11-11', conferidoEm: '2026-11-16' },
  '2': { respondido: true, data: '2026-10-31', conferidoEm: '2026-11-16' },
  '3': { respondido: false, data: null, conferidoEm: '2026-11-16' },
};
const r = resumoRespostas(est2, reqs);
assert.deepEqual(r.geral, { feitos: 5, conferidos: 3, respondidos: 2, percentual: 67, medianaDias: 20 });
assert.deepEqual(r.porVereador.a, { feitos: 3, conferidos: 2, respondidos: 2, percentual: 100, medianaDias: 20 });
assert.deepEqual(r.porVereador.b, { feitos: 3, conferidos: 2, respondidos: 1, percentual: 50, medianaDias: 30 });
console.log('ok: respostas');
```

- [ ] **Step 2:** `node check/respostas.mjs` → FAIL.

- [ ] **Step 3: `src/regras/respostas.js`**

```js
const DIA = 86400000;
const dias = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);
const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// Texto da página oficial (P78): resposta = anexo "Resposta Requerimento"; vale a data mais antiga.
export function lerRespostas(texto) {
  const datas = [];
  let respondido = false;
  for (const parte of String(texto ?? '').split(/Tipo Documento:/).slice(1)) {
    const tipo = parte.split(/\n|\|/)[0].trim();
    if (!/^Resposta Requerimento/i.test(tipo)) continue;
    respondido = true;
    const m = parte.match(/Data Documento:\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) datas.push(`${m[3]}-${m[2]}-${m[1]}`);
  }
  datas.sort();
  return { respondido, data: datas[0] || null };
}

// Ordem: nunca conferidos (mais novos primeiro); depois sem resposta, de até 180 dias, conferidos há mais tempo (não hoje).
export function filaRespostas(estado, requerimentos, hoje, limite = 150) {
  const nunca = requerimentos.filter((r) => !estado[r.id])
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || String(b.id).localeCompare(String(a.id)));
  const pendentes = requerimentos.filter((r) => {
    const e = estado[r.id];
    return e && !e.respondido && r.data && dias(r.data, hoje) <= 180 && e.conferidoEm < hoje;
  }).sort((a, b) => estado[a.id].conferidoEm.localeCompare(estado[b.id].conferidoEm) || String(a.id).localeCompare(String(b.id)));
  return [...nunca, ...pendentes].slice(0, limite).map((r) => r.id);
}

export function resumoRespostas(estado, requerimentos) {
  const novo = () => ({ feitos: 0, conferidos: 0, respondidos: 0, dias: [] });
  const geral = novo();
  const porVereador = {};
  for (const r of requerimentos) {
    const e = estado[r.id];
    for (const alvo of [geral, ...r.vereadores.map((v) => (porVereador[v] ??= novo()))]) {
      alvo.feitos++;
      if (!e) continue;
      alvo.conferidos++;
      if (!e.respondido) continue;
      alvo.respondidos++;
      if (e.data && r.data) alvo.dias.push(Math.max(0, dias(r.data, e.data)));
    }
  }
  const fechar = (a) => ({ feitos: a.feitos, conferidos: a.conferidos, respondidos: a.respondidos, percentual: a.conferidos ? Math.round((a.respondidos / a.conferidos) * 100) : 0, medianaDias: mediana(a.dias) });
  return { geral: fechar(geral), porVereador: Object.fromEntries(Object.entries(porVereador).map(([k, v]) => [k, fechar(v)])) };
}
```

- [ ] **Step 4:** `node check/respostas.mjs` → `ok: respostas`.

- [ ] **Step 5: Coletor `src/coleta/respostas.js`** — `export async function coletarRespostas(ids, hoje)`: Playwright (uma página reaproveitada), para cada id abre `${APEX}?p=742:78:::::P78_ID_PROJETO:${id}` com `waitUntil: 'networkidle'`, lê `document.body.innerText`, aplica `lerRespostas` e devolve `{ [id]: { ...resultado, conferidoEm: hoje } }`. `aguardarVez()`/`marcarFim()` em cada página. Página sem a seção "Anexos" ou que não carregou → pula o id (não grava nada para ele) e conta num array `falhas` devolvido junto: retorno `{ estado: {...}, falhas: [ids] }`. Se mais da metade falhar, lança `Error` (portal mudou).

- [ ] **Step 6: Ferramenta `src/ferramentas/respostas.js`** — `node src/ferramentas/respostas.js [--limite N]`: lê `data/processado/dados.json` (requerimentos = `proposituras` com `categoria === 'Requerimento'`, mapeados para `{ id, data, vereadores }`), lê `data/processado/respostas.json` se existir, `hoje` = data de São Paulo (AAAA-MM-DD), `fila = filaRespostas(estado, reqs, hoje, limite ?? Infinity)`, coleta em lotes de 50 gravando o arquivo depois de cada lote (para não perder trabalho), imprime o progresso e no fim `resumoRespostas(...).geral`.

- [ ] **Step 7: Rodar uma amostra:** `node src/ferramentas/respostas.js --limite 40`. Esperado: ~40 requerimentos conferidos, parte deles respondida (a pesquisa achou 11 de 14 em amostra antiga; os mais novos tendem a não ter resposta ainda). **Não** rodar a carga completa (≈1,5 h): o controlador roda depois.

- [ ] **Step 8: Commit** de `src/regras/respostas.js src/coleta/respostas.js src/ferramentas/respostas.js check/respostas.mjs data/processado/respostas.json` com `feat: respostas a requerimentos (regras, coletor e amostra)`.

---

### Task 3: Campanha de 2024

**Files:**
- Create: `src/regras/campanha.js`, `src/ferramentas/campanha-2024.js`, `check/campanha.mjs`
- Create (gerado e versionado): `data/referencia/campanha-2024.json`

**Interfaces:**
- Consumes: `normalizar`, `valorBR` (`src/regras/receitas.js`), `UA`.
- Produces:
  - `ORIGENS_CAMPANHA` (rótulos), `origemCampanha(ds) -> chave | null`, `resumirCampanha(linhas) -> { total, origens: {partido, pessoas, proprios, coletivo, outros}, doadoresPessoas }`.
  - Arquivo `data/referencia/campanha-2024.json`: `{ fonte, geradoEm, candidatos: { <idVereador> | "prefeito": { nome, partido, sq, total, origens, doadoresPessoas, link } } }`.

- [ ] **Step 1: Checagens (falham)** — `check/campanha.mjs`:

```js
import assert from 'node:assert/strict';
import { origemCampanha, resumirCampanha } from '../src/regras/campanha.js';

assert.equal(origemCampanha('Recursos de partido político'), 'partido');
assert.equal(origemCampanha('Recursos de pessoas físicas'), 'pessoas');
assert.equal(origemCampanha('Recursos próprios'), 'proprios');
assert.equal(origemCampanha('Recursos de Financiamento Coletivo'), 'coletivo');
assert.equal(origemCampanha('Recursos de outros candidatos'), 'outros');
assert.equal(origemCampanha('#NULO'), null);
const L = (origem, valor, doador) => ({ DS_ORIGEM_RECEITA: origem, VR_RECEITA: valor, NR_CPF_CNPJ_DOADOR: doador });
const r = resumirCampanha([
  L('Recursos de partido político', '30000,00', '11111111000111'),
  L('Recursos de pessoas físicas', '1000,00', '12345678901'),
  L('Recursos de pessoas físicas', '500,50', '12345678901'),
  L('Recursos de pessoas físicas', '200,00', '98765432100'),
  L('Recursos próprios', '7000,00', '55555555555'),
  L('Recursos de Financiamento Coletivo', '9171,00', '22222222000122'),
  L('#NULO', '0,00', '-1'),
]);
assert.deepEqual(r, { total: 47871.5, origens: { partido: 30000, pessoas: 1700.5, proprios: 7000, coletivo: 9171, outros: 0 }, doadoresPessoas: 2 });
assert.ok(!JSON.stringify(r).includes('12345678901'));
console.log('ok: campanha');
```

- [ ] **Step 2:** `node check/campanha.mjs` → FAIL.

- [ ] **Step 3: `src/regras/campanha.js`**

```js
import { normalizar } from '../util/texto.js';
import { valorBR } from './receitas.js';

export const ORIGENS_CAMPANHA = { partido: 'Partido (inclui fundo eleitoral)', pessoas: 'Pessoas físicas', proprios: 'Recursos próprios', coletivo: 'Financiamento coletivo', outros: 'Outros candidatos' };
const centavos = (v) => Math.round(v * 100) / 100;

export function origemCampanha(ds) {
  const o = normalizar(ds);
  if (/partido/.test(o)) return 'partido';
  if (/pessoas fisicas/.test(o)) return 'pessoas';
  if (/proprios/.test(o)) return 'proprios';
  if (/financiamento coletivo/.test(o)) return 'coletivo';
  if (/outros candidatos/.test(o)) return 'outros';
  return null;
}

// Só totais e a quantidade de doadores pessoa física; nenhum nome ou CPF sai daqui.
export function resumirCampanha(linhas) {
  const origens = Object.fromEntries(Object.keys(ORIGENS_CAMPANHA).map((k) => [k, 0]));
  const doadores = new Set();
  let total = 0;
  for (const l of linhas) {
    const o = origemCampanha(l.DS_ORIGEM_RECEITA);
    if (!o) continue;
    const v = valorBR(l.VR_RECEITA);
    total += v;
    origens[o] += v;
    if (o === 'pessoas') doadores.add(String(l.NR_CPF_CNPJ_DOADOR));
  }
  return { total: centavos(total), origens: Object.fromEntries(Object.entries(origens).map(([k, v]) => [k, centavos(v)])), doadoresPessoas: doadores.size };
}
```

- [ ] **Step 4:** `node check/campanha.mjs` → `ok: campanha`.

- [ ] **Step 5: Ferramenta `src/ferramentas/campanha-2024.js`** (roda uma vez, à mão):
  - ZIP: `https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2024.zip` (~1,3 GB; **não** baixar inteiro). `HEAD` para o tamanho; `Range` dos últimos ~400 KB para achar o diretório central (EOCD `PK\x05\x06`, registros `PK\x01\x02`: nome, método, tamanho compactado, offset); achar `receitas_candidatos_2024_SP.csv`; `Range` do cabeçalho local (30 bytes + nome + extra) e dos dados; `zlib.inflateRawSync`; decodificar latin-1 (`new TextDecoder('latin1')`). Se o zip usar ZIP64 (offsets > 4 GB não devem ocorrer, mas tratar o campo extra se `0xFFFFFFFF`), documentar.
  - CSV `;` com aspas; filtrar `SG_UE === '70050'`.
  - Vereadores: de `data/processado/dados.json` (`id`, `nome`, `partido`). Casar pelo **nome completo normalizado igual** (`normalizar(NM_CANDIDATO) === normalizar(v.nome)`), só `DS_CARGO` de vereador. Prefeito: `SQ_CANDIDATO === '250001985008'`. Se algum dos 11 não casar, parar com erro listando quem faltou e os nomes candidatos parecidos (para ajuste manual).
  - Por candidato: `resumirCampanha(linhas)`, `nome` (do site, não do TSE), `partido` (`SG_PARTIDO`), `sq`, `link`.
  - Link: testar com Playwright se `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/2045202024/<SQ>/2024/70050` abre a página do candidato (o texto da página contém o nome). Se abrir, usar esse padrão; se não der para confirmar (bloqueio), usar `https://divulgacandcontas.tse.jus.br/divulga/#/home` e registrar no relatório.
  - Grava `data/referencia/campanha-2024.json` (2 espaços, `\n` no fim) com `fonte` = URL do zip e `geradoEm`.

- [ ] **Step 6: Rodar e conferir com a referência:** prefeito R$ 515.650,04 (partido 400.000, pessoas 93.500 com 18 doadores, próprios 22.150,04); Henrique 79.200,00; Graziela 61.151,00 (coletivo 9.171); soma dos 11 = 258.517,18. Divergência → investigar antes de commitar.

- [ ] **Step 7: Commit** de `src/regras/campanha.js src/ferramentas/campanha-2024.js check/campanha.mjs data/referencia/campanha-2024.json` com `feat: campanha de 2024 (TSE) por vereador e prefeito`.

---

### Task 4: Integração, barreira e telas (depois de juntar as Tasks 1–3)

**Files:**
- Create: `src/site/camara.js`
- Modify: `package.json` (script `checar`), `src/coletar.js`, `src/atualizar.js`, `src/processar.js`, `src/conferir.js`, `src/relatorio.js`, `src/gerar-site.js`, `src/site/base.js`, `src/site/vereador.js`, `src/site/fontes.js`, `site/estilo.css`, `check/regras.mjs` (bloco `conferir`)

**Interfaces:**
- Consumes: tudo o que as Tasks 1–3 produzem (nomes e formatos acima).
- Produces: `dados.camara = { folha: { meses: {AAAA-MM: resumo}, ultimoMes }, respostas: { geral, porVereador, pendentes }, campanha: { candidatos } }`; `camara.html`; cartões no vereador; menu novo.

- [ ] **Step 1: `package.json`** — `"checar": "node check/regras.mjs && node check/folha.mjs && node check/respostas.mjs && node check/campanha.mjs"`.

- [ ] **Step 2: Robô (`src/coletar.js`, `src/atualizar.js`)**
  - `coletarTudo()` lê `data/processado/folha-camara.json` e `data/processado/respostas.json` (se não existirem, `{}`) e `data/referencia/campanha-2024.json`.
  - Folha: `coletarFolha([mês anterior, mês corrente], vereadores)` em `try/catch`; sucesso → `mesclarFolha(salvo, novos)`; erro → mantém o salvo e acrescenta `"Folha da Câmara: <mensagem>; mantido o último dado salvo."` em `avisosFontes`.
  - Respostas: requerimentos de `cardsPorAno` lidos com `lerCard` (`src/regras/apex.js`) e casados com `criarCasador` como no `processar` (ou receber de lá: o mais simples é calcular a fila no `atualizar.js` depois do `processar`, usando `dados.proposituras`; escolher uma das duas e documentar). Orçamento 150 por dia, `try/catch` com o mesmo tratamento de aviso; `falhas` viram aviso se > 0.
  - O objeto `coleta` ganha `folhaCamara`, `respostas`, `campanha`, `avisosFontes`. `atualizar.js` grava `folha-camara.json` e `respostas.json` em `data/processado/` **só depois** da barreira passar (como `dados.json`).
- [ ] **Step 3: `processar`** monta `dados.camara` (folha com `ultimoMes`, resumo de respostas com `pendentes` = requerimentos ainda não conferidos, campanha) e junta `avisosFontes` aos `avisos`. Requerimento respondido: a propositura ganha `respondidoEm` ('AAAA-MM-DD') para a lista do vereador.
- [ ] **Step 4: Barreira (`src/conferir.js`) + checagens no bloco `conferir` de `check/regras.mjs`:** total da folha de um mês já salvo (no `meta.folhaMensal` anterior) que cai mais de 20% → problema; mês da folha com `vereadores.pessoas !== 11` → **aviso** (não bloqueia; vai para `dados.avisos`). `meta.folhaMensal = { AAAA-MM: total geral }`. A base das checagens existentes ganha `camara` vazio para continuar passando; acrescentar asserts: queda de 25% bloqueia, queda de 10% não.
- [ ] **Step 5: Relatório** — seção "Câmara" no `conferencia.md`: último mês da folha e totais por grupo, vereadores casados no mês; respostas (conferidos, respondidos, pendentes, conferidos hoje); campanha (total dos 11 e do prefeito).
- [ ] **Step 6: Menu (`src/site/base.js`):** `Seu bairro · Câmara · Prefeitura · Impostos · Fontes` → `index.html#bairro`, `camara.html`, `gastos.html`, `impostometro.html`, `fontes.html`. Rodapé cita também o TSE.
- [ ] **Step 7: `src/site/camara.js` → `paginaCamara(d)`**, seguindo a spec §3, §4.2, §5.2, §6.2 e o visual existente (`cartao`, `cartaoNumero`, `barras` de `impostometro.js`, `barraProporcao` de `base.js`, `reais`, `numero`, `link`, `seloFonte`). Textos simples, frases curtas. Links de fonte: portal RH da Câmara (`https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=839:8`), PDFs de viagens, página P78 (fonte das respostas), link TSE de cada candidato.
- [ ] **Step 8: `src/site/vereador.js`:** depois de "Votações", cartões "Salário" (bruto do último mês e soma desde jan/2025), "Requerimentos respondidos" (X de Y conferidos, %, mediana em dias; frase sobre indicações) e "Campanha de 2024" (total, `barraProporcao` por origem, "N pessoas doaram", link TSE). Na lista de propostas, requerimento com `respondidoEm` mostra "respondido em dd/mm/aaaa". Cartão sem dado → não aparece.
- [ ] **Step 9: `gerar-site`** escreve `camara.html`; `fontes.js` ganha os itens das 3 fontes novas; CSS só o necessário, usando as classes e tokens existentes (ver `DESIGN.md`).
- [ ] **Step 10: Verificar:** `npm run checar`; `npm run atualizar` (robô completo; a folha baixa 2 meses e as respostas até 150 páginas); ler o `conferencia.md` (barreira ok, seção Câmara). Não fazer a parte do navegador (o controlador confere).
- [ ] **Step 11: Commit** dos arquivos da tarefa + `data/processado/*` com `feat: página da Câmara, custo, respostas e campanha nos vereadores`.

---

### Task 5: Carga completa de respostas e publicação (controlador)

- [ ] Rodar `node src/ferramentas/respostas.js` (sem limite, em segundo plano, ~1,5 h), commitar `data/processado/respostas.json`.
- [ ] Conferir no navegador (`camara.html`, um vereador, menu) em 320/375/1280; auditoria de containers.
- [ ] Revisão final do ramo; publicar só com o "pode publicar" do usuário.
