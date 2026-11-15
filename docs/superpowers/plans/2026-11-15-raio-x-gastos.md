# Raio-X dos gastos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `gastos.html` mostrando quanto Prefeitura, Câmara e SAAE pagaram, para quais áreas e para quais empresas, por ano desde 2025, com busca por empresa e pontos de atenção neutros.

**Architecture:** Mesmo caminho do impostômetro: coletores baixam a API de despesas do TCE-SP (mensal) e o RREO Anexo 02 do SICONFI (bimestral) para `coleta.json`; regras puras em `src/regras/despesas.js` resumem; `processar` monta `dados.gastos`; `conferir` barra mudanças estranhas; `gerar-site` escreve a página e `dados/empresas.json` (carregado pela busca no navegador).

**Tech Stack:** Node ≥22.13 (ES modules), HTML por template string, CSS sem framework, `node:assert` em `check/regras.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-15-raio-x-gastos-design.md`

## Global Constraints

- Nome da seção: "Raio-X dos gastos". Nunca usar "auditoria".
- Nomes de pessoas físicas nunca aparecem: só total e quantidade, com os dois links oficiais (Prefeitura `https://salto.obaratec.com.br/ords/salto02/f?p=839:7` e TCE-SP `https://transparencia.tce.sp.gov.br/despesas-fornecedor`).
- MEI/empresa individual (CNPJ) aparece com nome, como empresa.
- Pontos de atenção sempre com a frase: "Isto é um fato tirado dos dados oficiais, não uma acusação. Há explicações comuns para cada caso."
- Ano a ano desde `ANO_INICIO` (2025). Valor principal = evento "Valor Pago".
- Coleta educada: sempre `baixar()` de `src/coleta/http.js` (User-Agent e 2 s de espera).
- Checagens só com `node:assert` em `check/regras.mjs`; sem framework, sem stubs. Rodar com `npm run checar`.
- Arquivos `.md` são escritos como `.tmp` e renomeados (hook local colapsa indentação de `.md`).
- Commits com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Regras puras das despesas

**Files:**
- Create: `src/regras/despesas.js`
- Modify: `check/regras.mjs` (acrescentar bloco no fim)

**Interfaces:**
- Consumes: `valorBR(s)` de `src/regras/receitas.js` (lê "1.234,56", lança erro se inválido); `normalizar(s)` de `src/util/texto.js` (sem acento, minúsculo, espaços colapsados).
- Produces:
  - `ORGAOS = { prefeitura, camara, saae }` (rótulos), `GRUPOS_GASTO = { empresas, publicos, pessoas }` (rótulos), `LISTA_PUBLICOS` (array de termos), `FUNCOES` (28 nomes), `NOVA_LIMITE = 1000000`.
  - `grupoFornecedor(linha) -> 'pessoas' | 'publicos' | 'empresas'`
  - `cnpjDe(id_fornecedor) -> string(14) | null`
  - `formatarCnpj(cnpj) -> '30.681.633/0001-73'`
  - `orgaoChave(orgao) -> 'prefeitura' | 'camara' | 'saae'`
  - `resumirDespesas(porMes, cnpjs2024) -> { anos, novas, empresas, mensal }` (formato na Step 3)
  - `areasSiconfi(itens) -> { total, somaAreas, lista: [{ area, valor }] }`

- [ ] **Step 1: Escrever as checagens (falham)**

Acrescentar ao fim de `check/regras.mjs`:

```js
import { grupoFornecedor, cnpjDe, formatarCnpj, orgaoChave, resumirDespesas, areasSiconfi } from '../src/regras/despesas.js';

{
  const L = (orgao, evento, id, nome, valor, mes = 'Janeiro') => ({ orgao, mes, evento, nr_empenho: '1-2025', id_fornecedor: id, nm_fornecedor: nome, dt_emissao_despesa: '01/01/2025', vl_despesa: valor });
  const PREF = 'PREFEITURA MUNICIPAL DE SALTO';
  const CAM = 'CÂMARA MUNICIPAL DE SALTO';
  const SAAE = 'SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO';
  const pj = (n) => `CNPJ - PESSOA JURÍDICA - ${n}`;

  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', 'PESSOA FÍSICA - 121458', 'FULANO DE TAL', '10,00')), 'pessoas');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('46634507000106'), 'MUNICIPIO DE SALTO', '10,00')), 'publicos');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('29979036000140'), 'INSTITUTO NACIONAL DO SEGURO SOCIAL', '10,00')), 'publicos');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('00360305000104'), 'CAIXA ECONOMICA FEDERAL S/A', '10,00')), 'publicos');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('30681633000173'), 'CSO AMBIENTAL DE SALTO SPE SA', '10,00')), 'empresas');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('58645656000141'), 'ANTONIO CARLOS BRUNI JUNIOR', '10,00')), 'empresas');
  assert.equal(cnpjDe('CNPJ - PESSOA JURÍDICA - 30681633000173'), '30681633000173');
  assert.equal(cnpjDe('PESSOA FÍSICA - 121458'), null);
  assert.equal(formatarCnpj('30681633000173'), '30.681.633/0001-73');
  assert.equal(orgaoChave(PREF), 'prefeitura');
  assert.equal(orgaoChave(CAM), 'camara');
  assert.equal(orgaoChave(SAAE), 'saae');

  const porMes = {
    '2025-01': [
      L(PREF, 'Valor Pago', pj('11111111000111'), 'EMPRESA A LTDA', '1.500.000,00'),
      L(CAM, 'Valor Pago', pj('22222222000122'), 'EMPRESA B LTDA', '100,00'),
      L(PREF, 'Valor Pago', pj('46634507000106'), 'MUNICIPIO DE SALTO', '900,00'),
      L(SAAE, 'Valor Pago', 'PESSOA FÍSICA - 121458', 'FULANO DE TAL', '50,00'),
      L(PREF, 'Valor Pago', 'PESSOA FÍSICA - 999999', 'BELTRANO', '25,00'),
      L(PREF, 'Empenhado', pj('22222222000122'), 'EMPRESA B LTDA', '5.000,00'),
      L(PREF, 'Anulação', pj('22222222000122'), 'EMPRESA B LTDA', '300,00'),
    ],
    '2026-02': [
      L(PREF, 'Valor Pago', pj('22222222000122'), 'EMPRESA B LTDA', '2.000.000,00', 'Fevereiro'),
      L(PREF, 'Valor Pago', pj('33333333000133'), 'EMPRESA C LTDA', '999.999,99', 'Fevereiro'),
    ],
  };
  const r = resumirDespesas(porMes, ['22222222000122']);
  const a25 = r.anos['2025'];
  assert.equal(a25.total, 1501075);
  assert.equal(a25.ultimoMes, '2025-01');
  assert.equal(a25.mesesPublicados, 1);
  assert.deepEqual(a25.porOrgao, { prefeitura: 1500925, camara: 100, saae: 50 });
  assert.deepEqual(a25.porGrupo, { empresas: 1500100, publicos: 900, pessoas: 75 });
  assert.deepEqual(a25.pessoasFisicas, { total: 75, quantidade: 2 });
  assert.deepEqual(a25.topEmpresas.map((e) => e.cnpj), ['11111111000111', '22222222000122']);
  assert.equal(a25.topEmpresas[0].nome, 'EMPRESA A LTDA');
  assert.deepEqual(a25.concentracao, { top10: 1500100, totalEmpresas: 1500100, percentual: 100 });
  assert.equal(a25.anulado.total, 300);
  assert.deepEqual(a25.anulado.top, [{ cnpj: '22222222000122', nome: 'EMPRESA B LTDA', total: 300 }]);
  assert.equal(r.anos['2026'].total, 2999999.99);
  // novas: A (fora de 2024, R$ 1,5 mi) entra; B (pagou em 2024) e C (abaixo de R$ 1 mi) não
  assert.deepEqual(r.novas, [{ cnpj: '11111111000111', nome: 'EMPRESA A LTDA', total: 1500000, primeiroMes: '2025-01' }]);
  assert.deepEqual(r.mensal, { '2025-01': 1501075, '2026-02': 2999999.99 });
  // empresas: todos os CNPJs com pago > 0 (inclui órgão público), maior primeiro; nunca pessoa física
  assert.deepEqual(r.empresas.map((e) => e.cnpj), ['22222222000122', '11111111000111', '33333333000133', '46634507000106']);
  assert.deepEqual(r.empresas[0], { cnpj: '22222222000122', nome: 'EMPRESA B LTDA', porMes: { '2025-01': 100, '2026-02': 2000000 }, porOrgao: { camara: 100, prefeitura: 2000000 } });

  const COL = 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)';
  const ROT = 'Total das Despesas Exceto Intra-Orçamentárias';
  const it = (conta, valor, coluna = COL) => ({ rotulo: ROT, coluna, conta, valor });
  const areas = areasSiconfi([
    it('DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)', 300),
    it('Saúde', 200), it('Atenção Básica', 150), it('Educação', 100), it('Habitação', 0),
    it('Saúde', 999, 'DOTAÇÃO INICIAL'),
  ]);
  assert.deepEqual(areas, { total: 300, somaAreas: 300, lista: [{ area: 'Saúde', valor: 200 }, { area: 'Educação', valor: 100 }] });
  console.log('ok: despesas');
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run checar`
Expected: FAIL com `Cannot find module ... src/regras/despesas.js`.

- [ ] **Step 3: Implementar `src/regras/despesas.js`**

```js
import { normalizar } from '../util/texto.js';
import { valorBR } from './receitas.js';

export const ORGAOS = { prefeitura: 'Prefeitura', camara: 'Câmara', saae: 'SAAE (água e esgoto)' };
export const GRUPOS_GASTO = { empresas: 'Empresas e entidades', publicos: 'Órgãos públicos, impostos e folha', pessoas: 'Pessoas físicas' };

// Spec 3.2: quem recebe e é órgão público, imposto, previdência, banco da folha etc.
export const LISTA_PUBLICOS = [
  'MUNICIPIO', 'PREFEITURA', 'CAMARA MUNICIPAL', 'SERVICO AUTONOMO', 'FUNDO', 'FUNDEB',
  'INSTITUTO NACIONAL DO SEGURO SOCIAL', 'PREVIDENCIA', 'RECEITA FEDERAL', 'SECRETARIA', 'MINISTERIO',
  'TRIBUNAL', 'CAIXA ECONOMICA FEDERAL', 'BANCO DO BRASIL', 'BANCO SANTANDER', 'BANCO BRADESCO',
  'ITAU UNIBANCO', 'DESENVOLVE SP', 'PRODESP', 'CETESB', 'COMPANHIA DE PROCESSAMENTO DE DADOS',
];

// Funções de governo (Portaria 42/1999), como aparecem no RREO Anexo 02.
export const FUNCOES = [
  'Legislativa', 'Judiciária', 'Essencial à Justiça', 'Administração', 'Defesa Nacional', 'Segurança Pública',
  'Relações Exteriores', 'Assistência Social', 'Previdência Social', 'Saúde', 'Trabalho', 'Educação', 'Cultura',
  'Direitos da Cidadania', 'Urbanismo', 'Habitação', 'Saneamento', 'Gestão Ambiental', 'Ciência e Tecnologia',
  'Agricultura', 'Organização Agrária', 'Indústria', 'Comércio e Serviços', 'Comunicações', 'Energia',
  'Transporte', 'Desporto e Lazer', 'Encargos Especiais',
];

export const NOVA_LIMITE = 1000000;

const maiusculo = (s) => normalizar(s).toUpperCase();
const centavos = (v) => Math.round(v * 100) / 100;
const RE_PUBLICOS = new RegExp(`\\b(${LISTA_PUBLICOS.join('|')})\\b`);

export function grupoFornecedor(linha) {
  if (/^PESSOA FISICA/.test(maiusculo(linha.id_fornecedor))) return 'pessoas';
  if (RE_PUBLICOS.test(maiusculo(linha.nm_fornecedor))) return 'publicos';
  return 'empresas';
}

export const cnpjDe = (id) => (String(id ?? '').match(/CNPJ\D*(\d{14})\s*$/) || [])[1] || null;
export const formatarCnpj = (c) => String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export function orgaoChave(orgao) {
  const o = maiusculo(orgao);
  if (/CAMARA/.test(o)) return 'camara';
  if (/SAAE|AGUA E ESGOTO/.test(o)) return 'saae';
  return 'prefeitura';
}

const soma = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

// porMes: { 'AAAA-MM': linhas da API }; cnpjs2024: CNPJs que receberam em 2024 (base das "novas").
export function resumirDespesas(porMes, cnpjs2024 = []) {
  const base2024 = new Set(cnpjs2024);
  const nomes = new Map();
  const acc = {};
  const empresas = new Map(); // cnpj -> { cnpj, nome, grupo, porMes, porOrgao }
  const mensal = {};
  for (const chave of Object.keys(porMes).sort()) {
    const ano = chave.slice(0, 4);
    const a = acc[ano] ??= {
      meses: new Set(), total: 0, anulado: 0,
      porOrgao: { prefeitura: 0, camara: 0, saae: 0 },
      porGrupo: { empresas: 0, publicos: 0, pessoas: 0 },
      pessoas: new Set(), pagoEmp: new Map(), anuladoEmp: new Map(),
    };
    mensal[chave] = 0;
    for (const l of porMes[chave]) {
      const v = valorBR(l.vl_despesa);
      const grupo = grupoFornecedor(l);
      const cnpj = cnpjDe(l.id_fornecedor);
      if (cnpj) nomes.set(cnpj, String(l.nm_fornecedor ?? '').trim());
      if (l.evento === 'Anulação') {
        a.anulado += v;
        if (grupo === 'empresas' && cnpj) soma(a.anuladoEmp, cnpj, v);
        continue;
      }
      if (l.evento !== 'Valor Pago') continue;
      const orgao = orgaoChave(l.orgao);
      a.meses.add(chave);
      a.total += v;
      mensal[chave] += v;
      a.porOrgao[orgao] += v;
      a.porGrupo[grupo] += v;
      if (grupo === 'pessoas') { a.pessoas.add(String(l.id_fornecedor)); continue; }
      if (!cnpj) continue;
      if (grupo === 'empresas') soma(a.pagoEmp, cnpj, v);
      const e = empresas.get(cnpj) ?? { cnpj, nome: '', grupo, porMes: {}, porOrgao: {} };
      e.porMes[chave] = (e.porMes[chave] || 0) + v;
      e.porOrgao[orgao] = (e.porOrgao[orgao] || 0) + v;
      empresas.set(cnpj, e);
    }
  }
  const ranking = (mapa, n) => [...mapa].sort((x, y) => y[1] - x[1]).slice(0, n)
    .map(([cnpj, total]) => ({ cnpj, nome: nomes.get(cnpj) || '', total: centavos(total) }));
  const arred = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, centavos(v)]));
  const anos = {};
  for (const [ano, a] of Object.entries(acc)) {
    const valores = [...a.pagoEmp.values()].sort((x, y) => y - x);
    const totalEmp = valores.reduce((s, v) => s + v, 0);
    const top10 = valores.slice(0, 10).reduce((s, v) => s + v, 0);
    const meses = [...a.meses].sort();
    anos[ano] = {
      ultimoMes: meses.at(-1) || null,
      mesesPublicados: meses.length,
      total: centavos(a.total),
      porOrgao: arred(a.porOrgao),
      porGrupo: arred(a.porGrupo),
      pessoasFisicas: { total: centavos(a.porGrupo.pessoas), quantidade: a.pessoas.size },
      topEmpresas: ranking(a.pagoEmp, 20),
      concentracao: { top10: centavos(top10), totalEmpresas: centavos(totalEmp), percentual: totalEmp > 0 ? Math.round((top10 / totalEmp) * 100) : 0 },
      anulado: { total: centavos(a.anulado), top: ranking(a.anuladoEmp, 5) },
    };
  }
  const totalDe = (e) => Object.values(e.porMes).reduce((s, v) => s + v, 0);
  const lista = [...empresas.values()].map((e) => ({ ...e, nome: nomes.get(e.cnpj) || '', total: totalDe(e) }))
    .filter((e) => e.total > 0).sort((x, y) => y.total - x.total);
  const novas = lista
    .filter((e) => e.grupo === 'empresas' && !base2024.has(e.cnpj) && e.total > NOVA_LIMITE)
    .map((e) => ({ cnpj: e.cnpj, nome: e.nome, total: centavos(e.total), primeiroMes: Object.keys(e.porMes).sort()[0] }));
  return {
    anos,
    novas,
    empresas: lista.map((e) => ({ cnpj: e.cnpj, nome: e.nome, porMes: arred(e.porMes), porOrgao: arred(e.porOrgao) })),
    mensal: arred(mensal),
  };
}

const COLUNA_SICONFI = 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)';
const ROTULO_SICONFI = 'Total das Despesas Exceto Intra-Orçamentárias';

// Itens do RREO Anexo 02 -> total, soma das funções (para a barreira) e áreas com valor.
export function areasSiconfi(itens) {
  const linhas = itens.filter((i) => i.coluna === COLUNA_SICONFI && i.rotulo === ROTULO_SICONFI);
  const totalLinha = linhas.find((i) => /^DESPESAS \(EXCETO INTRA/.test(i.conta));
  const funcoes = linhas.filter((i) => FUNCOES.includes(i.conta));
  return {
    total: totalLinha ? centavos(Number(totalLinha.valor)) : null,
    somaAreas: centavos(funcoes.reduce((s, i) => s + Number(i.valor), 0)),
    lista: funcoes.filter((i) => Number(i.valor) > 0)
      .map((i) => ({ area: i.conta, valor: centavos(Number(i.valor)) }))
      .sort((x, y) => y.valor - x.valor),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run checar`
Expected: todas as linhas `ok: …`, incluindo `ok: despesas`.

- [ ] **Step 5: Commit**

```bash
git add src/regras/despesas.js check/regras.mjs
git commit -m "feat: regras do Raio-X dos gastos (grupos, resumo por ano, áreas)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Coleta (TCE-SP, SICONFI e base de 2024)

**Files:**
- Modify: `src/config.js` (constantes novas)
- Create: `src/coleta/despesas.js`
- Create: `src/coleta/siconfi.js`
- Create: `src/ferramentas/base-2024.js`
- Create (gerado e versionado): `data/referencia/cnpjs-pagos-2024.json`
- Modify: `src/coletar.js`

**Interfaces:**
- Consumes: `baixar(url) -> Buffer` e `salvar(caminho, texto)` de `src/coleta/http.js`; `cnpjDe(id)` da Task 1; `anoMesBR() -> { ano, mes }` de `src/util/texto.js`.
- Produces (no objeto `coleta`, lido por `processar` na Task 3):
  - `despesas: { 'AAAA-MM': linhas[] }` (só meses publicados, de `ANO_INICIO` até o mês anterior ao corrente);
  - `siconfi: { 'AAAA': { bimestre: número, itens: [...] } }` (anos sem bimestre publicado ficam de fora);
  - `cnpjs2024: string[]`.
- Constantes em `src/config.js`: `TCE_DESPESAS`, `SICONFI_RREO`, `IBGE_SALTO`, `LINKS_CREDOR = { prefeitura, tce }`.

Não há checagem nova (rede); a verificação é rodar a ferramenta e o coletor e olhar a saída.

- [ ] **Step 1: Constantes em `src/config.js`**

Acrescentar depois da linha `export const TCE_RECEITAS = ...`:

```js
export const TCE_DESPESAS = 'https://transparencia.tce.sp.gov.br/api/json/despesas/salto';
export const SICONFI_RREO = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo';
export const IBGE_SALTO = 3545209;
// Onde o morador confere nomes de quem recebeu (o site não mostra nome de pessoa física).
export const LINKS_CREDOR = {
  prefeitura: 'https://salto.obaratec.com.br/ords/salto02/f?p=839:7',
  tce: 'https://transparencia.tce.sp.gov.br/despesas-fornecedor',
};
```

- [ ] **Step 2: Coletor `src/coleta/despesas.js`**

```js
import { TCE_DESPESAS, ANO_INICIO } from '../config.js';
import { baixar, salvar } from './http.js';

// Todos os meses do mandato (o mês corrente nunca está publicado). Sempre baixa de novo: o TCE-SP corrige meses passados.
// Resposta [] = mês ainda não publicado (não é erro).
export async function coletarDespesas(anoAtual, mesAtual) {
  const porMes = {};
  for (let ano = ANO_INICIO; ano <= anoAtual; ano++) {
    const ultimoMes = ano === anoAtual ? mesAtual - 1 : 12;
    for (let mes = 1; mes <= ultimoMes; mes++) {
      const chave = `${ano}-${String(mes).padStart(2, '0')}`;
      const texto = (await baixar(`${TCE_DESPESAS}/${ano}/${mes}`)).toString('utf8');
      let linhas;
      try { linhas = JSON.parse(texto); } catch { throw new Error(`Despesas ${chave}: a resposta do TCE-SP não é JSON.`); }
      if (!Array.isArray(linhas)) throw new Error(`Despesas ${chave}: formato inesperado da API do TCE-SP.`);
      await salvar(`data/bruto/despesas/${chave}.json`, texto);
      if (linhas.length) porMes[chave] = linhas;
    }
  }
  return porMes;
}
```

- [ ] **Step 3: Coletor `src/coleta/siconfi.js`**

```js
import { SICONFI_RREO, IBGE_SALTO, ANO_INICIO } from '../config.js';
import { baixar } from './http.js';

const COLUNA = 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)';
const ROTULO = 'Total das Despesas Exceto Intra-Orçamentárias';

// Para cada ano do mandato, o último bimestre do RREO Anexo 02 (despesa por função) já publicado.
export async function coletarSiconfi(anoAtual) {
  const porAno = {};
  for (let ano = ANO_INICIO; ano <= anoAtual; ano++) {
    for (let bimestre = 6; bimestre >= 1; bimestre--) {
      const url = `${SICONFI_RREO}?an_exercicio=${ano}&nr_periodo=${bimestre}&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&id_ente=${IBGE_SALTO}`;
      const texto = (await baixar(url)).toString('utf8');
      let json;
      try { json = JSON.parse(texto); } catch { throw new Error(`SICONFI ${ano}/${bimestre}: a resposta não é JSON.`); }
      const itens = Array.isArray(json.items) ? json.items : null;
      if (!itens) throw new Error(`SICONFI ${ano}/${bimestre}: formato inesperado.`);
      if (!itens.length) continue;
      porAno[ano] = { bimestre, itens: itens.filter((i) => i.coluna === COLUNA && i.rotulo === ROTULO) };
      break;
    }
  }
  return porAno;
}
```

- [ ] **Step 4: Ferramenta `src/ferramentas/base-2024.js` (roda uma vez, à mão)**

```js
// Gera data/referencia/cnpjs-pagos-2024.json: CNPJs que receberam ("Valor Pago" > 0) em 2024.
// Base fixa para o ponto de atenção "novas com valor alto". Rodar: node src/ferramentas/base-2024.js
import { mkdir, writeFile } from 'node:fs/promises';
import { TCE_DESPESAS } from '../config.js';
import { baixar } from '../coleta/http.js';
import { cnpjDe } from '../regras/despesas.js';
import { valorBR } from '../regras/receitas.js';

const pago = new Map();
for (let mes = 1; mes <= 12; mes++) {
  const linhas = JSON.parse((await baixar(`${TCE_DESPESAS}/2024/${mes}`)).toString('utf8'));
  if (!Array.isArray(linhas) || !linhas.length) throw new Error(`2024/${mes}: sem dados no TCE-SP.`);
  for (const l of linhas) {
    const cnpj = cnpjDe(l.id_fornecedor);
    if (cnpj && l.evento === 'Valor Pago') pago.set(cnpj, (pago.get(cnpj) || 0) + valorBR(l.vl_despesa));
  }
  console.log(`2024/${mes}: ${linhas.length} linhas`);
}
const lista = [...pago].filter(([, v]) => v > 0).map(([c]) => c).sort();
await mkdir('data/referencia', { recursive: true });
await writeFile('data/referencia/cnpjs-pagos-2024.json', `${JSON.stringify(lista)}\n`);
console.log(`${lista.length} CNPJs pagos em 2024.`);
```

- [ ] **Step 5: Ligar em `src/coletar.js`**

Imports (junto dos outros):

```js
import { readFile } from 'node:fs/promises';
import { coletarDespesas } from './coleta/despesas.js';
import { coletarSiconfi } from './coleta/siconfi.js';
```

Em `coletarTudo()`, trocar:

```js
  const receitas = await coletarReceitas(hoje.ano, hoje.mes);
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, receitas, fotos, avisosFotos, coletadoEm: new Date().toISOString() };
```

por:

```js
  const receitas = await coletarReceitas(hoje.ano, hoje.mes);
  const despesas = await coletarDespesas(hoje.ano, hoje.mes);
  const siconfi = await coletarSiconfi(hoje.ano);
  const cnpjs2024 = JSON.parse(await readFile('data/referencia/cnpjs-pagos-2024.json', 'utf8'));
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, receitas, despesas, siconfi, cnpjs2024, fotos, avisosFotos, coletadoEm: new Date().toISOString() };
```

E no bloco de log no fim do arquivo, depois da linha de `Receitas`:

```js
  console.log(`Despesas: ${Object.keys(c.despesas).length} meses publicados`);
  console.log(`SICONFI: ${Object.entries(c.siconfi).map(([a, s]) => `${a} bimestre ${s.bimestre}`).join(', ') || 'nada'}`);
```

- [ ] **Step 6: Gerar a base de 2024 e conferir os coletores**

Run: `node src/ferramentas/base-2024.js`
Expected: 12 linhas `2024/<mes>: <n> linhas` e `<N> CNPJs pagos em 2024.` (N na casa de 1.000).

Run (só os coletores novos, sem o robô inteiro):

```bash
node --input-type=module -e "import { coletarDespesas } from './src/coleta/despesas.js'; import { coletarSiconfi } from './src/coleta/siconfi.js'; const d = await coletarDespesas(2026, 11); console.log(Object.keys(d)); const s = await coletarSiconfi(2026); console.log(Object.entries(s).map(([a, x]) => a + ' b' + x.bimestre + ' ' + x.itens.length))"
```

Expected: meses `2025-01` … `2026-09` (21 meses); SICONFI `2025 b6 …` e `2026 b4 …` (ou bimestre mais novo, se já publicado).

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/coleta/despesas.js src/coleta/siconfi.js src/ferramentas/base-2024.js src/coletar.js data/referencia/cnpjs-pagos-2024.json
git commit -m "feat: coleta das despesas (TCE-SP), áreas (SICONFI) e base de 2024

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Processar, barreira e relatório

**Files:**
- Modify: `src/processar.js`
- Modify: `src/conferir.js`
- Modify: `src/relatorio.js`
- Modify: `check/regras.mjs` (bloco `conferir` existente)

**Interfaces:**
- Consumes: `resumirDespesas`, `areasSiconfi`, `GRUPOS_GASTO` (Task 1); `coleta.despesas`, `coleta.siconfi`, `coleta.cnpjs2024` (Task 2).
- Produces:
  - `dados.gastos = { anos: { 'AAAA': { ultimoMes, mesesPublicados, total, porOrgao, porGrupo, pessoasFisicas, topEmpresas, concentracao, anulado, areas: { bimestre, total, somaAreas, lista } | null } }, novas: [...], empresas: [{ cnpj, nome, porMes, porOrgao }] }` ou `null` quando não houve coleta;
  - `dados.meta.despesasMensais = { 'AAAA-MM': totalPago }`.

- [ ] **Step 1: Checagens da barreira (falham)**

Em `check/regras.mjs`, no bloco `conferir` (começa em `import { conferir } from '../src/conferir.js';`):

1. No objeto `base`, depois de `receitas: { anoAnterior: { ano: 2025, mesesPublicados: 12 } },`, acrescentar:

```js
    gastos: { anos: { 2026: { areas: { bimestre: 4, total: 300, somaAreas: 300, lista: [] } } }, novas: [], empresas: [] },
```

2. Antes de `console.log('ok: conferir');`, acrescentar:

```js
  const antD = { totalProposituras: 90, despesasMensais: { '2026-09': 1000 } };
  const comD = (m) => ({ ...base, meta: { ...base.meta, despesasMensais: m } });
  assert.equal(conferir({ ...base, gastos: null }, null, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 1000 }), antD, 11).length, 0);
  assert.equal(conferir(comD({}), antD, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 1060 }), antD, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 940 }), antD, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 1040 }), antD, 11).length, 0);
  assert.equal(conferir({ ...base, gastos: { anos: { 2026: { areas: { bimestre: 4, total: 300, somaAreas: 290, lista: [] } } }, novas: [], empresas: [] } }, null, 11).length, 1);
  assert.equal(conferir({ ...base, gastos: { anos: { 2026: { areas: null } }, novas: [], empresas: [] } }, null, 11).length, 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run checar`
Expected: FAIL no bloco `conferir` (`gastos: null` ainda devolve 0 problemas).

- [ ] **Step 3: Barreira em `src/conferir.js`**

1. Mover a linha `const reais = (v) => \`R$ ${Math.round(v).toLocaleString('pt-BR')}\`;` de dentro do `else` das receitas para logo depois de `const problemas = [];`.
2. Antes de `return problemas;`, acrescentar:

```js
  const g = dados.gastos;
  if (!g) {
    problemas.push('Despesas do Raio-X dos gastos não foram coletadas.');
  } else {
    const novosD = dados.meta.despesasMensais || {};
    const dicaD = 'Confira o mês no Portal da Transparência do TCE-SP; se a mudança for real, ajuste despesasMensais em data/processado/meta.json e rode o robô de novo.';
    for (const [mes, valor] of Object.entries((anterior && anterior.despesasMensais) || {})) {
      if (!(mes in novosD)) problemas.push(`Despesas de ${mes} sumiram da fonte. ${dicaD}`);
      else if (Math.abs(novosD[mes] - valor) > Math.abs(valor) * 0.05) problemas.push(`Total pago em ${mes} mudou mais de 5% (de ${reais(valor)} para ${reais(novosD[mes])}). ${dicaD}`);
    }
    for (const [ano, a] of Object.entries(g.anos)) {
      if (a.areas && a.areas.total !== null && Math.abs(a.areas.somaAreas - a.areas.total) > 1) {
        problemas.push(`SICONFI ${ano}: a soma das áreas (${reais(a.areas.somaAreas)}) não bate com o total (${reais(a.areas.total)}).`);
      }
    }
  }
```

- [ ] **Step 4: `src/processar.js`**

1. Import: `import { resumirDespesas, areasSiconfi } from './regras/despesas.js';`
2. Assinatura: `export function processar({ vereadores, cardsPorAno, presencas, votacoes, receitas, despesas, siconfi, cnpjs2024, fotos, avisosFotos, coletadoEm }) {`
3. Logo depois da linha `const impostometro = ...`, acrescentar:

```js
  const resumoDespesas = despesas ? resumirDespesas(despesas, cnpjs2024 || []) : null;
  const gastos = resumoDespesas
    ? {
        anos: Object.fromEntries(Object.entries(resumoDespesas.anos).map(([ano, a]) => [ano, {
          ...a,
          areas: siconfi && siconfi[ano] ? { bimestre: siconfi[ano].bimestre, ...areasSiconfi(siconfi[ano].itens) } : null,
        }])),
        novas: resumoDespesas.novas,
        empresas: resumoDespesas.empresas,
      }
    : null;
```

4. No objeto devolvido, depois de `receitas: impostometro,` acrescentar `gastos,`; e dentro de `meta`, depois de `receitasMensais: …,` acrescentar:

```js
      despesasMensais: resumoDespesas ? resumoDespesas.mensal : {},
```

- [ ] **Step 5: Seção no `src/relatorio.js`**

1. Import: `import { GRUPOS_GASTO } from './regras/despesas.js';`
2. Antes de `l.push('', '## O que é estimativa', '');`, acrescentar:

```js
  const g = d.gastos;
  l.push('', '## Raio-X dos gastos', '');
  if (!g) {
    l.push('- Despesas não coletadas.');
  } else {
    for (const [ano, a] of Object.entries(g.anos)) {
      l.push(`### ${ano}`, '');
      l.push(`- Último mês: ${a.ultimoMes || 'nenhum'} (${a.mesesPublicados} meses)`);
      l.push(`- Total pago: ${reais(a.total)}`);
      l.push(...Object.entries(a.porGrupo).map(([k, v]) => `- ${GRUPOS_GASTO[k]}: ${reais(v)}`));
      l.push(`- Pessoas físicas: ${a.pessoasFisicas.quantidade}`);
      l.push(...a.topEmpresas.slice(0, 5).map((e) => `- Top: ${e.nome} (${e.cnpj}): ${reais(e.total)}`));
      l.push(`- Anulado: ${reais(a.anulado.total)}`);
      l.push(`- SICONFI: ${a.areas ? `bimestre ${a.areas.bimestre}, total liquidado ${reais(a.areas.total)}` : 'ainda não publicado'}`, '');
    }
    l.push(`- Novas com valor alto no mandato: ${g.novas.length}`);
  }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run checar`
Expected: todas `ok: …`, incluindo `ok: conferir` e `ok: despesas`.

- [ ] **Step 7: Commit**

```bash
git add src/processar.js src/conferir.js src/relatorio.js check/regras.mjs
git commit -m "feat: Raio-X dos gastos no processar, na barreira e no relatório

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Telas (página, busca, home, menu)

**Files:**
- Create: `src/site/gastos.js`
- Modify: `src/site/impostometro.js` (exportar `barras` e `NOMES_MES`)
- Modify: `src/gerar-site.js`
- Modify: `src/site/inicio.js:7` e `:51`
- Modify: `src/site/base.js` (menu e rodapé)
- Modify: `src/site/fontes.js:24`
- Modify: `site/busca.js` (seletor de ano e busca por empresa)
- Modify: `site/estilo.css`

**Interfaces:**
- Consumes: `dados.gastos` (Task 3); `LINKS_CREDOR`, `TCE_DESPESAS`, `SICONFI_RREO` (Task 2); `ORGAOS`, `GRUPOS_GASTO`, `LISTA_PUBLICOS`, `formatarCnpj`, `NOVA_LIMITE` (Task 1); de `base.js`: `layout`, `reais`, `numero`, `aviso`, `link`.
- Produces: `paginaGastos(d) -> html`, `chamadaGastos(gastos) -> html`; arquivos `dist/gastos.html` e `dist/dados/empresas.json` (`[[cnpj, nome, porMes, porOrgao], ...]`, maior total primeiro).

- [ ] **Step 1: Exportar helpers do impostômetro**

Em `src/site/impostometro.js`, trocar `const NOMES_MES = [` por `export const NOMES_MES = [` e `const barras = (pares, total) =>` por `export const barras = (pares, total) =>`.

- [ ] **Step 2: Criar `src/site/gastos.js`**

```js
import { esc } from '../util/texto.js';
import { LINKS_CREDOR, TCE_DESPESAS, SICONFI_RREO } from '../config.js';
import { ORGAOS, GRUPOS_GASTO, LISTA_PUBLICOS, formatarCnpj, NOVA_LIMITE } from '../regras/despesas.js';
import { layout, reais, numero, aviso, link } from './base.js';
import { barras, NOMES_MES } from './impostometro.js';

const ATENCAO = 'Isto é um fato tirado dos dados oficiais, não uma acusação. Há explicações comuns para cada caso.';
const linkTce = (cnpj) => `${LINKS_CREDOR.tce}?nr_identificador_despesa=${encodeURIComponent(cnpj)}`;
const mesBR = (chave) => `${NOMES_MES[Number(chave.slice(5, 7)) - 1]} de ${chave.slice(0, 4)}`;
const periodo = (a) => (a.mesesPublicados === 12 ? 'ano fechado' : `até ${mesBR(a.ultimoMes)}`);
const anosOrdenados = (g) => Object.keys(g.anos).sort();

const listaEmpresas = (lista) => (lista.length
  ? `<ol class="lista lista-empresas">${lista.map((e) => `<li><strong>${esc(e.nome)}</strong> <span class="nota">CNPJ ${esc(formatarCnpj(e.cnpj))}</span><br><span class="valor-linha">${reais(e.total)}</span> ${link(linkTce(e.cnpj), 'ver no TCE-SP')}</li>`).join('')}</ol>`
  : '<p>Nenhuma.</p>');

const pessoasFisicas = (a) => `<p>Pessoas físicas: ${reais(a.pessoasFisicas.total)} para ${numero(a.pessoasFisicas.quantidade)} pessoas. Os nomes de pessoas físicas não aparecem aqui. Para conferir, use a consulta oficial por credor: ${link(LINKS_CREDOR.prefeitura, 'Portal da Transparência da Prefeitura (Despesa Detalhada por Credor)')}, escolhendo a instituição e o ano, ou ${link(LINKS_CREDOR.tce, 'TCE-SP, Despesas por Fornecedor')}.</p>`;

function blocoAno(ano, a) {
  const orgaos = Object.entries(a.porOrgao).filter(([, v]) => v > 0).map(([k, v]) => [ORGAOS[k], v]);
  const grupos = Object.entries(a.porGrupo).map(([k, v]) => [GRUPOS_GASTO[k], v]);
  const areas = a.areas
    ? `<p>Valor liquidado (serviço ou compra entregue e conferido) até ${NOMES_MES[a.areas.bimestre * 2 - 1]} de ${ano}, informado pela Prefeitura ao Tesouro Nacional. Não bate exatamente com o valor pago acima: é outra etapa da despesa e outro período.</p>${barras(a.areas.lista.map((x) => [x.area, x.valor]), a.areas.total)}`
    : '<p>O Tesouro Nacional ainda não publicou a divisão por área deste ano.</p>';
  return `<section class="ano-gastos" data-ano="${ano}" aria-labelledby="t-gastos-${ano}">
<h2 id="t-gastos-${ano}">${ano} <small>(${esc(periodo(a))})</small></h2>
<section class="secao cartao">
<h3>Quanto foi pago</h3>
<p class="numero-grande">${reais(a.total)}</p>
<p>Pago pela Prefeitura, pela Câmara e pelo SAAE em ${ano}, ${esc(periodo(a))}.</p>
${barras(orgaos, a.total)}
<h4>Para quem</h4>
${barras(grupos, a.total)}
${pessoasFisicas(a)}
</section>
<section class="secao cartao">
<h3>Para quais áreas</h3>
${areas}
</section>
<section class="secao cartao">
<h3>Empresas e entidades que mais receberam</h3>
${listaEmpresas(a.topEmpresas)}
</section>
<section class="secao cartao">
<h3>Pontos de atenção</h3>
${aviso(esc(ATENCAO))}
<h4>Concentração</h4>
<p>As 10 empresas e entidades que mais receberam ficaram com <strong>${a.concentracao.percentual}%</strong> do que foi pago a empresas e entidades em ${ano} (${reais(a.concentracao.top10)} de ${reais(a.concentracao.totalEmpresas)}).</p>
<h4>Reservado e depois cancelado</h4>
<p>Empenhar é reservar o dinheiro para uma despesa; anular é cancelar essa reserva, por sobra, troca de contrato ou erro de lançamento. Em ${ano} foram anulados ${reais(a.anulado.total)}. Empresas e entidades com mais valor anulado:</p>
${listaEmpresas(a.anulado.top)}
</section>
</section>`;
}

export function chamadaGastos(g) {
  const anos = anosOrdenados(g);
  if (!anos.length) return '';
  const ano = anos[anos.length - 1];
  const a = g.anos[ano];
  return `<a class="cartao cartao-numero chamada-gastos" href="gastos.html"><span class="numero-rotulo">Raio-X dos gastos</span><span class="numero-grande">${reais(a.total)}</span><span class="numero-rotulo">pagos pela Prefeitura, Câmara e SAAE em ${ano} (${esc(periodo(a))}). Veja para quem e para quais áreas →</span></a>`;
}

export function paginaGastos(d) {
  const g = d.gastos;
  const anos = anosOrdenados(g);
  const seletor = `<div class="anos" role="group" aria-label="Escolher o ano">${anos.map((ano, i) => `<button type="button" class="chip" data-ano-botao="${ano}" aria-pressed="${i === anos.length - 1}">${ano}</button>`).join('')}</div>`;
  const ultimos = anos.map((ano) => `${ano}: ${esc(periodo(g.anos[ano]))}`).join('; ');
  const sic = anos.filter((ano) => g.anos[ano].areas).map((ano) => `${ano}: até ${NOMES_MES[g.anos[ano].areas.bimestre * 2 - 1]}`).join('; ') || 'nenhum';
  const corpo = `<h1>Raio-X dos gastos</h1>
<p>Quanto a Prefeitura, a Câmara e o SAAE pagaram, para quais áreas e para quais empresas, ano a ano desde o início do mandato. Tudo sai do Tribunal de Contas do Estado (TCE-SP), que publica com cerca de um mês e meio de atraso, e do Tesouro Nacional.</p>
${seletor}
${anos.map((ano) => blocoAno(ano, g.anos[ano])).join('\n')}
<section class="secao cartao" aria-labelledby="t-novas">
<h2 id="t-novas">Ponto de atenção do mandato: novas com valor alto</h2>
${aviso(esc(ATENCAO))}
<p>Empresas e entidades que não receberam nada da cidade em 2024 e que, desde ${anos[0] || ''}, já receberam mais de ${reais(NOVA_LIMITE)}. Empresa nova pode ser fruto de licitação nova, troca de contrato ou mudança de CNPJ.</p>
${g.novas.length ? `<ol class="lista lista-empresas">${g.novas.map((e) => `<li><strong>${esc(e.nome)}</strong> <span class="nota">CNPJ ${esc(formatarCnpj(e.cnpj))} · primeiro pagamento em ${esc(mesBR(e.primeiroMes))}</span><br><span class="valor-linha">${reais(e.total)}</span> ${link(linkTce(e.cnpj), 'ver no TCE-SP')}</li>`).join('')}</ol>` : '<p>Nenhuma.</p>'}
</section>
<section class="secao cartao" id="busca-empresas">
<h2>Busca por empresa</h2>
<p>Digite parte do nome ou o CNPJ (com ou sem pontos). Pessoas físicas não entram na busca.</p>
<label class="sr-only" for="busca-empresa">Nome ou CNPJ da empresa</label>
<input id="busca-empresa" class="busca" type="search" placeholder="Ex.: nome da empresa ou CNPJ" autocomplete="off">
<div id="resultado-empresa" aria-live="polite"></div>
<noscript><p>A busca precisa de JavaScript. Sem ele, use a ${link(LINKS_CREDOR.tce, 'consulta do TCE-SP')}.</p></noscript>
</section>
<section id="fontes-gastos" class="secao">
<h2>De onde vêm os números</h2>
<ul>
<li>Pagamentos: API pública de despesas do TCE-SP, ${esc(TCE_DESPESAS)}/&lt;ano&gt;/&lt;mês&gt; (Prefeitura, Câmara e SAAE). Conta o evento "Valor Pago". Último mês publicado: ${esc(ultimos)}.</li>
<li>Por área: Tesouro Nacional (SICONFI), Relatório Resumido da Execução Orçamentária, Anexo 2, despesa liquidada por função (${esc(SICONFI_RREO)}). Último bimestre: ${esc(sic)}.</li>
<li>"Órgãos públicos, impostos e folha" junta quem recebe e tem no nome: ${esc(LISTA_PUBLICOS.join(', '))}. O resto com CNPJ é "Empresas e entidades" (inclui MEI e organizações sociais).</li>
<li>Para conferir nomes de quem recebeu: ${link(LINKS_CREDOR.prefeitura, 'Portal da Transparência da Prefeitura')} e ${link(LINKS_CREDOR.tce, 'TCE-SP, Despesas por Fornecedor')}.</li>
</ul>
</section>`;
  return layout({ titulo: 'Raio-X dos gastos: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
```

- [ ] **Step 3: `src/gerar-site.js`**

1. Import: `import { paginaGastos } from './site/gastos.js';`
2. Depois da linha `if (d.receitas) await writeFile(...impostometro.html...)`, acrescentar:

```js
  if (d.gastos) {
    await writeFile(`${destino}/gastos.html`, paginaGastos(d));
    await writeFile(`${destino}/dados/empresas.json`, JSON.stringify(d.gastos.empresas.map((e) => [e.cnpj, e.nome, e.porMes, e.porOrgao])));
  }
```

- [ ] **Step 4: Home, menu, rodapé e fontes**

1. `src/site/inicio.js`: depois de `import { blocoContador } from './impostometro.js';` acrescentar `import { chamadaGastos } from './gastos.js';`. Trocar a linha `${d.receitas ? blocoContador(d.receitas, '', false) : ''}` por:

```js
${d.receitas ? blocoContador(d.receitas, '', false) : ''}
${d.gastos ? chamadaGastos(d.gastos) : ''}
```

2. `src/site/base.js`, no menu: trocar `<a href="${prefixo}impostometro.html">Impostômetro</a>` por `<a href="${prefixo}impostometro.html">Impostômetro</a><a href="${prefixo}gastos.html">Gastos</a>`. No rodapé: trocar `Tribunal de Contas do Estado (TCE-SP) e IBGE.` por `Tribunal de Contas do Estado (TCE-SP), Tesouro Nacional e IBGE.`

3. `src/site/fontes.js`: depois da linha `<li><strong>Impostos e receitas:</strong> …</li>` acrescentar:

```js
<li><strong>Gastos:</strong> <a href="gastos.html#fontes-gastos">API de despesas do TCE-SP e SICONFI (Tesouro Nacional)</a>, usados no Raio-X dos gastos.</li>
```

- [ ] **Step 5: `site/busca.js`**

Antes do comentário `// Contador de salário`, acrescentar:

```js
  // Raio-X: seletor de ano (sem JS todos os anos aparecem)
  const botoesAno = [...document.querySelectorAll('[data-ano-botao]')];
  if (botoesAno.length) {
    const mostrarAno = (ano) => {
      botoesAno.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.anoBotao === ano)));
      document.querySelectorAll('.ano-gastos').forEach((s) => { s.hidden = s.dataset.ano !== ano; });
    };
    botoesAno.forEach((b) => b.addEventListener('click', () => mostrarAno(b.dataset.anoBotao)));
    mostrarAno(botoesAno[botoesAno.length - 1].dataset.anoBotao);
  }

  // Raio-X: busca por empresa (carrega dados/empresas.json no primeiro uso)
  const campoEmpresa = document.getElementById('busca-empresa');
  if (campoEmpresa) {
    const saidaEmpresa = document.getElementById('resultado-empresa');
    const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const ORG = { prefeitura: 'Prefeitura', camara: 'Câmara', saae: 'SAAE' };
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const fmtCnpj = (c) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    let empresas = null;
    let esperaEmpresa;
    const itemEmpresa = ([cnpj, nome, porMes, porOrgao]) => {
      const porAno = {};
      for (const [k, v] of Object.entries(porMes)) porAno[k.slice(0, 4)] = (porAno[k.slice(0, 4)] || 0) + v;
      const anos = Object.entries(porAno).sort().map(([a, v]) => `${a}: ${real.format(v)}`).join(' · ');
      const meses = Object.entries(porMes).sort().map(([k, v]) => `${MES[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}: ${real.format(v)}`).join(' · ');
      const orgaos = Object.entries(porOrgao).map(([k, v]) => `${ORG[k] || k}: ${real.format(v)}`).join(' · ');
      return `<li><strong>${esc(nome)}</strong> <span class="nota">CNPJ ${esc(fmtCnpj(cnpj))}</span><br>Por ano: ${esc(anos)}<br>Por órgão: ${esc(orgaos)}<details><summary>Mês a mês</summary><p>${esc(meses)}</p></details><a href="https://transparencia.tce.sp.gov.br/despesas-fornecedor?nr_identificador_despesa=${esc(cnpj)}" target="_blank" rel="noopener">ver no TCE-SP</a></li>`;
    };
    campoEmpresa.addEventListener('input', () => {
      clearTimeout(esperaEmpresa);
      esperaEmpresa = setTimeout(async () => {
        const q = norm(campoEmpresa.value);
        const digitos = campoEmpresa.value.replace(/\D/g, '');
        if (q.length < 3) { saidaEmpresa.innerHTML = ''; return; }
        empresas = empresas || await (await fetch('dados/empresas.json')).json();
        const achadas = empresas.filter(([cnpj, nome]) => norm(nome).includes(q) || (digitos.length >= 3 && cnpj.includes(digitos)));
        saidaEmpresa.innerHTML = achadas.length
          ? `<p>${achadas.length} ${achadas.length === 1 ? 'resultado' : 'resultados'}${achadas.length > 30 ? ' (mostrando os 30 que mais receberam)' : ''}.</p><ul class="lista">${achadas.slice(0, 30).map(itemEmpresa).join('')}</ul>`
          : '<p>Nenhuma empresa encontrada. Tente outra parte do nome ou o CNPJ.</p>';
      }, 250);
    });
  }

```

- [ ] **Step 6: `site/estilo.css`**

1. Trocar `.sugestoes, .ordens { display: flex;` por `.sugestoes, .ordens, .anos { display: flex;`.
2. Trocar `html:not(.js) .ordens, html:not(.js) .sugestoes, html:not(.js) .filtros { display: none; }` por `html:not(.js) .ordens, html:not(.js) .sugestoes, html:not(.js) .filtros, html:not(.js) .anos { display: none; }`.
3. Acrescentar no fim, fora de qualquer `@media`:

```css
.chamada-gastos { margin: 1rem 0; }
.ano-gastos h2 small { font-size: .9rem; font-weight: 600; color: var(--suave); }
.lista-empresas .valor-linha { font-weight: 600; color: var(--rio-escuro); margin-right: .4rem; }
#resultado-empresa details { margin: .4rem 0; }
```

- [ ] **Step 7: Gerar com dados de verdade e conferir a página**

Run: `npm run atualizar` (robô completo; leva alguns minutos). Depois `npm run checar`.
Expected: `Pronto. Veja conferencia.md e a pasta dist/.` e `conferencia.md` com a seção "Raio-X dos gastos". Conferir com a spec 2.1: 2025 total ≈ R$ 725 mi, empresas ≈ R$ 322 mi, pessoas físicas 384; 2026 (até set) ≈ R$ 599 mi, anulado ≈ R$ 66 mi; soma das áreas = total do SICONFI.

Abrir `http://localhost:8765/gastos.html` (preview `radar-saltense`, com `fetch(…, {cache:'reload'})` em `estilo.css` e `busca.js` antes de recarregar) e conferir: seletor troca o ano; busca "cso" e "30681633" acham a CSO Ambiental; nenhum nome de pessoa física na página (`document.body.innerText` não contém nomes vindos de linhas "PESSOA FÍSICA"); sem rolagem horizontal em 320 px e 375 px; card na home leva a `gastos.html`; menu tem "Gastos".

- [ ] **Step 8: Commit**

```bash
git add src/site/gastos.js src/site/impostometro.js src/gerar-site.js src/site/inicio.js src/site/base.js src/site/fontes.js site/busca.js site/estilo.css data/processado/dados.json data/processado/meta.json
git commit -m "feat: página Raio-X dos gastos, busca por empresa e chamada na home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Publicar

- [ ] **Step 1:** Mostrar ao usuário a página no preview e os números da conferência; publicar só com o "pode publicar" dele.
- [ ] **Step 2:** `git checkout main && git pull --rebase && git merge --no-edit raio-x && npm run checar && git push`, depois `gh workflow run atualizar.yml -f so_publicar=true` e conferir `https://sandersono.github.io/radar-saltense/gastos.html` no ar.
