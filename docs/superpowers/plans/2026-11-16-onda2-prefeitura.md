# Onda 2 (Prefeitura) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `prefeitura.html` com a nota IEGM do TCE-SP, as obras do painel do TCE-SP, as compras no PNCP e a campanha do prefeito; o menu "Prefeitura" passa a levar para ela.

**Architecture:** Dois módulos de dados independentes feitos em paralelo em worktrees (Task 1: painéis Pentaho do TCE-SP, IEGM e obras, com um cliente CDA compartilhado; Task 2: PNCP), cada um com regras puras, checagem própria, coletor e carga inicial. Task 3 integra ao robô e monta a página. Fontes novas nunca param o robô.

**Tech Stack:** Node ≥22.13 ES modules, `fetch` nativo, HTML por template string, `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-16-onda2-prefeitura-design.md`

## Global Constraints

- Só dado oficial, com link para a fonte. Fato, nunca acusação.
- Nenhum nome de pessoa física sai dos coletores (fornecedor ou contratado com CPF vira "pessoa física" ou só entra em totais). Nada de CPF.
- Coleta educada: User-Agent `UA` de `src/config.js`, pelo menos 1 s entre requisições (`aguardarVez()`/`marcarFim()` de `src/coleta/http.js` dão 2 s, pode usar).
- Checagens só com `node:assert`, em `check/<modulo>.mjs`; sem framework, sem stubs, sem rede.
- `.md` é escrito como `.tmp` e renomeado. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tasks 1 e 2 rodam em paralelo: cada uma só cria os arquivos listados nela; não mexer em `package.json`, `src/coletar.js`, `src/atualizar.js`, `src/processar.js` nem em telas.

---

### Task 1: Painéis do TCE-SP (IEGM e obras)

**Files:**
- Create: `src/regras/pentaho.js`, `src/regras/iegm.js`, `src/regras/obras.js`, `src/coleta/pentaho.js`, `src/coleta/iegm.js`, `src/coleta/obras.js`, `src/ferramentas/tce-paineis.js`, `check/tce.mjs`
- Create (gerado e versionado): `data/processado/iegm.json`, `data/processado/obras.json`

**Interfaces:**
- Produces:
  - `linhasCda(json) -> objetos[]` (resposta CDA `{ metadata: [{colName}], resultset: [[...]] }` → objetos por nome de coluna).
  - `FAIXAS_IEGM`, `DIMENSOES_IEGM`, `MUNICIPIOS_IEGM`, `resumirIegm(linhas) -> { <Municipio>: { iegm, plan, fisc, educ, saude, amb, cidade, gov } }`.
  - `normalizarObras(linhas) -> [{ situacao, paralisada, valor, contratado, cnpj, contratante, ano, objeto }]` (paralisadas primeiro, depois maior valor).
  - `consultaCda({ base, painel, path, dataAccessId, params }) -> objetos[]` (sessão anônima + GET doQuery), `coletarIegm(anos?) -> { anos: { AAAA: resumo } }` (sem `anos` = todos os da lista `exercicioDS`), `coletarObras() -> { dataBase, obras }`.
  - Arquivos: `data/processado/iegm.json` `{ anos: {...} }`, `data/processado/obras.json` `{ dataBase, obras }`.

- [ ] **Step 1: Checagens (falham)** — `check/tce.mjs`:

```js
import assert from 'node:assert/strict';
import { linhasCda } from '../src/regras/pentaho.js';
import { resumirIegm, FAIXAS_IEGM } from '../src/regras/iegm.js';
import { normalizarObras } from '../src/regras/obras.js';

assert.deepEqual(linhasCda({ metadata: [{ colName: 'a' }, { colName: 'b' }], resultset: [[1, 'x'], [2, 'y']] }), [{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
assert.deepEqual(linhasCda({ metadata: [{ colName: 'a' }], resultset: [] }), []);

const L = (nome, f) => ({ nome, iegm: f[0], iplanejamento: f[1], ifiscal: f[2], ieduc: f[3], isaude: f[4], iamb: f[5], icidade: f[6], igov: f[7] });
const r = resumirIegm([
  L('SALTO', ['C', 'C', 'C+', 'C+', 'C+', 'C+', 'C', 'C']),
  L('SALTO DE PIRAPORA', ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']),
  L('Itu', ['C+', 'C', 'B', 'B', 'B', 'B', 'C+', 'C']),
  L('CABREUVA', ['C+', 'C+', 'C+', 'B', 'B+', 'C', 'C', 'B']),
  L('Campinas', ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']),
]);
assert.deepEqual(Object.keys(r).sort(), ['Cabreúva', 'Itu', 'Salto']);
assert.deepEqual(r.Salto, { iegm: 'C', plan: 'C', fisc: 'C+', educ: 'C+', saude: 'C+', amb: 'C+', cidade: 'C', gov: 'C' });
assert.equal(FAIXAS_IEGM.C, 'Baixo nível de adequação');

const obras = normalizarObras([
  { ds_situacao: 'Em execução - no prazo', vl_ajuste: 4655497.25, nome: 'CHRONOS LTDA', doc: '12.345.678/0001-90', ds_entidade: 'PREFEITURA', ano_ajuste: '2025', objeto_ajuste: 'Clínica' },
  { ds_situacao: 'Paralisada', vl_ajuste: '4.730.664,35', nome: 'PRIME LTDA', doc: '98765432000110', ds_entidade: 'PREFEITURA', ano_ajuste: 2024, objeto_ajuste: 'Água' },
  { ds_situacao: 'Em execução - no prazo', vl_ajuste: 1000, nome: 'JOAO DA SILVA', doc: '123.456.789-01', ds_entidade: 'PREFEITURA', ano_ajuste: '2025', objeto_ajuste: 'Reparo' },
]);
assert.deepEqual(obras.map((o) => o.objeto), ['Água', 'Clínica', 'Reparo']);
assert.deepEqual(obras[0], { situacao: 'Paralisada', paralisada: true, valor: 4730664.35, contratado: 'PRIME LTDA', cnpj: '98765432000110', contratante: 'PREFEITURA', ano: 2024, objeto: 'Água' });
assert.equal(obras[1].cnpj, '12345678000190');
assert.equal(obras[2].contratado, 'Pessoa física');
assert.equal(obras[2].cnpj, null);
assert.ok(!JSON.stringify(obras).includes('JOAO'));
console.log('ok: tce');
```

- [ ] **Step 2:** `node check/tce.mjs` → FAIL.

- [ ] **Step 3: Regras**

`src/regras/pentaho.js`:
```js
export function linhasCda(json) {
  const cols = (json?.metadata || []).map((m) => m.colName);
  return (json?.resultset || []).map((linha) => Object.fromEntries(cols.map((c, i) => [c, linha[i]])));
}
```

`src/regras/iegm.js`:
```js
import { normalizar } from '../util/texto.js';

export const FAIXAS_IEGM = { 'A': 'Altamente efetiva', 'B+': 'Muito efetiva', 'B': 'Efetiva', 'C+': 'Em fase de adequação', 'C': 'Baixo nível de adequação' };
// Rótulos das dimensões: conferir com o manual/painel do TCE e ajustar só o texto se o nome oficial for outro.
export const DIMENSOES_IEGM = { iegm: 'Nota geral', plan: 'Planejamento', fisc: 'Gestão fiscal', educ: 'Educação', saude: 'Saúde', amb: 'Meio ambiente', cidade: 'Proteção dos cidadãos', gov: 'Governança de TI' };
export const MUNICIPIOS_IEGM = ['Salto', 'Itu', 'Indaiatuba', 'Itupeva', 'Cabreúva', 'Sorocaba'];
const CAMPOS = { iegm: 'iegm', plan: 'iplanejamento', fisc: 'ifiscal', educ: 'ieduc', saude: 'isaude', amb: 'iamb', cidade: 'icidade', gov: 'igov' };

export function resumirIegm(linhas) {
  const alvo = new Map(MUNICIPIOS_IEGM.map((m) => [normalizar(m), m]));
  const out = {};
  for (const l of linhas) {
    const m = alvo.get(normalizar(l.nome));
    if (!m) continue;
    out[m] = Object.fromEntries(Object.entries(CAMPOS).map(([k, c]) => [k, String(l[c] ?? '').trim() || null]));
  }
  return out;
}
```

`src/regras/obras.js`:
```js
import { valorBR } from './receitas.js';

const valor = (v) => (typeof v === 'number' ? v : String(v ?? '').trim() ? valorBR(String(v).trim()) : 0);

export function normalizarObras(linhas) {
  return linhas.map((l) => {
    const doc = String(l.doc ?? '').replace(/\D/g, '');
    const pf = doc.length === 11;
    return {
      situacao: String(l.ds_situacao ?? '').trim(),
      paralisada: /paralisad/i.test(String(l.ds_situacao ?? '')),
      valor: valor(l.vl_ajuste),
      contratado: pf ? 'Pessoa física' : String(l.nome ?? '').trim(),
      cnpj: !pf && doc.length === 14 ? doc : null,
      contratante: String(l.ds_entidade ?? '').trim(),
      ano: Number(l.ano_ajuste) || null,
      objeto: String(l.objeto_ajuste ?? '').trim(),
    };
  }).sort((a, b) => (Number(b.paralisada) - Number(a.paralisada)) || (b.valor - a.valor));
}
```

- [ ] **Step 4:** `node check/tce.mjs` → `ok: tce`.

- [ ] **Step 5: Coletores**
  - `src/coleta/pentaho.js` → `consultaCda({ base, painel, path, dataAccessId, params })`: abre a URL pública do painel (`painel`, com `userid=anony&password=zero`) para obter o cookie de sessão anônima (guardar o `set-cookie` JSESSIONID), depois `GET ${base}/pentaho/plugin/cda/api/doQuery?path=…&dataAccessId=…&<params>` com o cookie e o UA; resposta JSON → `linhasCda`. Erro HTTP ou JSON inválido → lança `Error` claro. Reusar a sessão entre consultas do mesmo painel.
  - IEGM: base `https://painel.tce.sp.gov.br`, painel `https://painel.tce.sp.gov.br/pentaho/api/repos/%3Apublic%3Aieg_m%3Aiegm.wcdf/generatedContent?userid=anony&password=zero`, path `/public/ieg_m/iegm.cda`; anos de `exercicioDS`; por ano `faixaTodosMunicipiosPeriodo` com `parampExercicio_mapa=<ano>&parampRegiao=-1` → `resumirIegm`. `coletarIegm(anos)`; sem `anos`, todos.
  - Obras: base `https://paineldeobras.tce.sp.gov.br`, painel `https://paineldeobras.tce.sp.gov.br/pentaho/api/repos/%3Apublic%3AObra%3Apainel_obras.wcdf/generatedContent?userid=anony&password=zero`, path `/public/Obra/painel_obras.cda`; período mais recente de `selPeriodo` (guardar o rótulo como `dataBase`, ex. "17/10/2026"); `obrasTabela` com `parampMunicipio=3545209&parampPeriodo=<id>&parampSituacao=-1&parampFonteRecurso=-1&parampContratante=-1&parampContratado=-1` → `normalizarObras`.
  - Descobrir os nomes exatos dos parâmetros das consultas auxiliares (`exercicioDS`, `selPeriodo`) olhando a resposta; documentar num comentário.
- [ ] **Step 6: Ferramenta `src/ferramentas/tce-paineis.js`**: roda `coletarIegm()` (todos os anos) e `coletarObras()`, grava `data/processado/iegm.json` e `data/processado/obras.json` (2 espaços, `\n` no fim) e imprime o IEGM de Salto por ano e as obras.
- [ ] **Step 7: Rodar e conferir com a pesquisa:** Salto 2024 = C (C, C+, C+, C+, C+, C, C nas dimensões), 2015 = B+; 6 municípios no ano mais novo; obras de Salto = 5, uma "Paralisada" de R$ 4.730.664,35. Conferir no manual/painel o nome oficial de cada dimensão e ajustar só os rótulos de `DIMENSOES_IEGM` se preciso (anotar no relatório).
- [ ] **Step 8: Commit** dos arquivos da tarefa com `feat: painéis do TCE-SP (IEGM e obras)`.

---

### Task 2: Compras da Prefeitura no PNCP

**Files:**
- Create: `src/regras/contratos.js`, `src/coleta/contratos.js`, `src/ferramentas/contratos.js`, `check/contratos.mjs`
- Create (gerado e versionado): `data/processado/contratos.json`

**Interfaces:**
- Produces:
  - `MODALIDADES` (id → nome), `SEM_DISPUTA = [8, 9]`, `resumirContratacoes(lista) -> { porModalidade: { <id>: { nome, quantidade, valor } }, total: { quantidade, valor }, semDisputa: { quantidade, valor, pctQuantidade, pctValor } }`, `resumirContratos(lista, n=10) -> { quantidade, valor, top: [{ cnpj, nome, valor, contratos }] }`.
  - `coletarContratos(anos) -> { <ano>: { contratacoes: resumo, contratos: resumo, coletadoEm } }`.
  - Arquivo `data/processado/contratos.json`: `{ <ano>: {...} }`.

- [ ] **Step 1: Checagens (falham)** — `check/contratos.mjs`:

```js
import assert from 'node:assert/strict';
import { resumirContratacoes, resumirContratos, MODALIDADES } from '../src/regras/contratos.js';

assert.equal(MODALIDADES[8], 'Dispensa');
assert.equal(MODALIDADES[9], 'Inexigibilidade');
const c = resumirContratacoes([
  { modalidadeId: 8, valorTotalHomologado: 1000, valorTotalEstimado: 1200 },
  { modalidadeId: 8, valorTotalHomologado: 0, valorTotalEstimado: 500 },
  { modalidadeId: 9, valorTotalHomologado: 2000, valorTotalEstimado: 2000 },
  { modalidadeId: 6, valorTotalHomologado: null, valorTotalEstimado: 7000 },
]);
assert.deepEqual(c.porModalidade, {
  6: { nome: 'Pregão eletrônico', quantidade: 1, valor: 7000 },
  8: { nome: 'Dispensa', quantidade: 2, valor: 1500 },
  9: { nome: 'Inexigibilidade', quantidade: 1, valor: 2000 },
});
assert.deepEqual(c.total, { quantidade: 4, valor: 10500 });
assert.deepEqual(c.semDisputa, { quantidade: 3, valor: 3500, pctQuantidade: 75, pctValor: 33 });

const k = resumirContratos([
  { niFornecedor: '11111111000111', nomeRazaoSocialFornecedor: 'A LTDA', valorGlobal: 100 },
  { niFornecedor: '11111111000111', nomeRazaoSocialFornecedor: 'A LTDA', valorGlobal: 50.5 },
  { niFornecedor: '22222222000122', nomeRazaoSocialFornecedor: 'B SA', valorGlobal: 120 },
  { niFornecedor: '12345678901', nomeRazaoSocialFornecedor: 'FULANO DE TAL', valorGlobal: 999 },
]);
assert.equal(k.quantidade, 4);
assert.equal(k.valor, 1269.5);
assert.deepEqual(k.top, [
  { cnpj: '11111111000111', nome: 'A LTDA', valor: 150.5, contratos: 2 },
  { cnpj: '22222222000122', nome: 'B SA', valor: 120, contratos: 1 },
]);
assert.ok(!JSON.stringify(k).includes('FULANO') && !JSON.stringify(k).includes('12345678901'));
console.log('ok: contratos');
```

- [ ] **Step 2:** `node check/contratos.mjs` → FAIL.

- [ ] **Step 3: `src/regras/contratos.js`**

```js
export const MODALIDADES = {
  1: 'Leilão eletrônico', 2: 'Diálogo competitivo', 3: 'Concurso', 4: 'Concorrência eletrônica', 5: 'Concorrência presencial',
  6: 'Pregão eletrônico', 7: 'Pregão presencial', 8: 'Dispensa', 9: 'Inexigibilidade', 10: 'Manifestação de interesse',
  11: 'Pré-qualificação', 12: 'Credenciamento', 13: 'Leilão presencial',
};
export const SEM_DISPUTA = [8, 9];
const centavos = (v) => Math.round(v * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function resumirContratacoes(lista) {
  const porModalidade = {};
  const total = { quantidade: 0, valor: 0 };
  const semDisputa = { quantidade: 0, valor: 0 };
  for (const c of lista) {
    const id = Number(c.modalidadeId);
    const valor = Number(c.valorTotalHomologado) > 0 ? Number(c.valorTotalHomologado) : Number(c.valorTotalEstimado) || 0;
    const m = (porModalidade[id] ??= { nome: MODALIDADES[id] || c.modalidadeNome || `Modalidade ${id}`, quantidade: 0, valor: 0 });
    m.quantidade++; m.valor += valor;
    total.quantidade++; total.valor += valor;
    if (SEM_DISPUTA.includes(id)) { semDisputa.quantidade++; semDisputa.valor += valor; }
  }
  for (const m of Object.values(porModalidade)) m.valor = centavos(m.valor);
  return {
    porModalidade,
    total: { quantidade: total.quantidade, valor: centavos(total.valor) },
    semDisputa: { quantidade: semDisputa.quantidade, valor: centavos(semDisputa.valor), pctQuantidade: pct(semDisputa.quantidade, total.quantidade), pctValor: pct(semDisputa.valor, total.valor) },
  };
}

// Ranking só com CNPJ; fornecedor com CPF entra apenas nos totais.
export function resumirContratos(lista, n = 10) {
  const por = new Map();
  let valor = 0;
  for (const c of lista) {
    const v = Number(c.valorGlobal) || 0;
    valor += v;
    const doc = String(c.niFornecedor ?? '').replace(/\D/g, '');
    if (doc.length !== 14) continue;
    const e = por.get(doc) ?? { cnpj: doc, nome: String(c.nomeRazaoSocialFornecedor ?? '').trim(), valor: 0, contratos: 0 };
    e.valor += v; e.contratos++;
    por.set(doc, e);
  }
  const top = [...por.values()].sort((a, b) => b.valor - a.valor).slice(0, n).map((e) => ({ ...e, valor: centavos(e.valor) }));
  return { quantidade: lista.length, valor: centavos(valor), top };
}
```

- [ ] **Step 4:** `node check/contratos.mjs` → `ok: contratos`.

- [ ] **Step 5: Coletor `src/coleta/contratos.js`** — `coletarContratos(anos)`: base `https://pncp.gov.br/api/consulta/v1`, órgão CNPJ `46634507000106`.
  - Contratações: para cada ano e cada modalidade 1..13, `GET /contratacoes/publicacao?dataInicial=AAAA0101&dataFinal=<AAAA1231 ou hoje>&codigoModalidadeContratacao=<id>&cnpj=46634507000106&pagina=<n>&tamanhoPagina=50`, paginando até `paginasRestantes === 0`; HTTP 204 = sem itens. Filtrar só itens cujo órgão seja o CNPJ (se a API devolver outros).
  - Contratos: `GET /contratos?dataInicial=…&dataFinal=…&cnpjOrgao=46634507000106&pagina=<n>&tamanhoPagina=500`, paginando.
  - Resumir com as regras; nada de lista bruta em disco. ~1 requisição por segundo, UA do projeto; erro HTTP ≠ 204 → lança `Error`.
  - Descobrir e registrar num comentário um link público do PNCP para ver as contratações do órgão (para o site), se existir de forma estável.
- [ ] **Step 6: Ferramenta `src/ferramentas/contratos.js`**: `coletarContratos([2025, <ano corrente>])` e grava `data/processado/contratos.json`; imprime o resumo por ano.
- [ ] **Step 7: Conferir com a pesquisa:** 2025 com ~800 contratações (Dispensa ≈ 629, Pregão eletrônico ≈ 97, Inexigibilidade ≈ 35, Concorrência eletrônica ≈ 26, Credenciamento ≈ 9) e ~975 contratos; ano corrente na mesma ordem de grandeza.
- [ ] **Step 8: Commit** com `feat: compras da Prefeitura no PNCP`.

---

### Task 3: Integração e página da Prefeitura (depois de juntar as Tasks 1–2)

**Files:**
- Create: `src/site/prefeitura.js`
- Modify: `package.json` (checar: + `node check/tce.mjs && node check/contratos.mjs`), `src/coletar.js`, `src/atualizar.js`, `src/processar.js`, `src/relatorio.js`, `src/gerar-site.js`, `src/site/base.js` (menu "Prefeitura" → `prefeitura.html`), `src/site/fontes.js`, `site/estilo.css`

- [ ] **Step 1:** Robô: `coletarIegm([ano mais novo])` + mescla com `iegm.json`; `coletarObras()`; `coletarContratos([ano corrente])` (ano anterior só se não estiver salvo ou se o `coletadoEm` salvo tiver mais de 30 dias). Cada um em try/catch com aviso e último dado salvo (mesmo padrão da onda 1, `lerJson` tolerante). Gravar os arquivos só depois da barreira. Avisos da spec §3.
- [ ] **Step 2:** `processar` monta `dados.prefeitura = { iegm, obras, contratos, campanhaPrefeito }`.
- [ ] **Step 3:** `src/site/prefeitura.js` → `paginaPrefeitura(d)` conforme a spec §2 (cartões-atalho no topo; seções IEGM, obras, compras, campanha do prefeito; reaproveitar `cartaoNumero`, `barras`, `barraProporcao`, `aviso`, `seloFonte`, `.tabela-empilha` + `data-rotulo` para tabelas; o cartão de campanha igual ao do vereador — extrair para uma função compartilhada se hoje estiver só em `vereador.js`). Frases curtas.
- [ ] **Step 4:** Menu, `gerar-site` (escreve `prefeitura.html`), fontes (itens novos), relatório (seção "Prefeitura": IEGM de Salto no ano mais novo, nº de obras e paralisadas, contratações por ano e % sem disputa).
- [ ] **Step 5:** `npm run checar`; `npm run atualizar` (robô completo); `conferencia.md` "Tudo certo". Sem navegador (o controlador confere).
- [ ] **Step 6:** Commit com `feat: página da Prefeitura (nota do TCE, obras, compras e campanha do prefeito)`.
