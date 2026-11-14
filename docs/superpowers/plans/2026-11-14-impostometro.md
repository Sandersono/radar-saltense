# Impostômetro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao Radar Saltense um impostômetro municipal com estes elementos:
- um contador "rodando" dos impostos pagos à cidade no ano;
- um painel "De onde vem o dinheiro de Salto";
- tudo a partir da API de receitas do TCE-SP e atualizado pelo robô diário.

**Architecture:**
- Um coletor baixa as receitas mensais da API do TCE-SP (ano atual e anterior).
- Regras puras em `src/regras/receitas.js` classificam cada linha (grupo e tipo de imposto) e montam o resumo.
- O resumo inclui a parte oficial, o ritmo diário e o início da estimativa.
- `processar` põe esse resumo em `dados.receitas`, a barreira ganha três regras novas e o gerador cria `impostometro.html` e um bloco na home.
- O contador roda no navegador a partir de atributos `data-*`.

**Tech Stack:** o mesmo do projeto: Node.js ≥ 22.13 (ES modules), HTML e CSS estáticos e o `site/busca.js` sem framework.

Spec: `docs/superpowers/specs/2026-11-14-impostometro-design.md`

## Global Constraints

- Só dado oficial. O que é estimativa vem sempre escrito ao lado do número: "Oficial até dd/mm/aaaa: R$ Y · daqui em diante é estimativa pelo ritmo dos últimos 12 meses".
- Fonte: `https://transparencia.tce.sp.gov.br/api/json/receitas/salto/<ano>/<mes>`. Um mês conta como publicado quando a API devolve pelo menos uma linha.
- Coleta educada: usar `baixar()` de `src/coleta/http.js`, com User-Agent RadarSaltense e espera de 2000 ms.
- População: `141988` (IBGE, informada ao Tesouro Nacional no RREO 2025).
- Grupos e tipos: exatamente as tabelas 3.1 e 3.2 da spec.
- Barreira: não publica se:
  - um mês publicado antes sumir;
  - a partir de março, o ano anterior tiver menos de 12 meses;
  - os impostos de um mês já publicado caírem mais de 5%.
- Checagens: só `node:assert` em `check/regras.mjs`, rodadas com `npm run checar`. Sem framework.
- Neste computador, o hook `hook-limpar-texto.py` reescreve arquivos `.md`/`.html`/`.txt` gravados pelas ferramentas Write/Edit. Para criar `.md`, grave como `.tmp` e renomeie com `mv`. Os `.js` e `.css` não são afetados.
- Commits são locais e já autorizados, com mensagem em português e a linha `Co-Authored-By` no final. Nunca fazer push.
- Textos do site em português simples, para o morador comum, pensados primeiro para o celular.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/regras/receitas.js` (novo) | `valorBR`, `grupoReceita`, `tipoImposto`, `resumirReceitas`, `montarImpostometro`, `valorContador`, `GRUPOS_RECEITA`, `TIPOS_IMPOSTO` |
| `src/coleta/receitas.js` (novo) | `coletarReceitas(anoAtual, mesAtual)` |
| `src/config.js` | `TCE_RECEITAS`, `POPULACAO` |
| `src/coletar.js` | Incluir `receitas` na coleta |
| `src/processar.js` | `dados.receitas` e `meta.receitasMensais` |
| `src/conferir.js` | As três regras novas da barreira |
| `src/relatorio.js` | A seção "Impostômetro" |
| `src/gerar-site.js` | O bloco da home, `impostometro.html`, o menu e a fonte |
| `site/busca.js` | O contador rodando |
| `site/estilo.css` | O estilo do contador e das barras |
| `check/regras.mjs` | As checagens novas |

---

### Task 1: Regras puras das receitas

**Files:**
- Create: `src/regras/receitas.js`
- Modify: `check/regras.mjs` (acrescentar uma seção no fim)

**Interfaces:**
- Produces:
  - `GRUPOS_RECEITA`: `{impostos, estado, uniao, fundeb, saae, emprestimos, outras}`, os rótulos para exibir.
  - `TIPOS_IMPOSTO`: `{iptu, iss, ir, itbi, taxas, outros}`, os rótulos.
  - `valorBR(s): number`, que lança erro se o valor for inválido.
  - `grupoReceita(linha): 'fora'|'saae'|'impostos'|'estado'|'uniao'|'fundeb'|'emprestimos'|'outras'`.
  - `tipoImposto(linha): 'iptu'|'itbi'|'ir'|'iss'|'taxas'|'outros'`.
  - `resumirReceitas(linhasPorMes: Record<'AAAA-MM', linha[]>): { meses: Record<'AAAA-MM', {grupos, tipos, impostos: number, fora: number}> }`.
  - `montarImpostometro(resumo, anoAtual): Impostometro`, que devolve:
    - `anoAtual`, `ultimoMesOficial` ('AAAA-MM' ou `null`), `fimOficial` ('AAAA-MM-DD' ou `null`);
    - `oficialAno`, `ritmoDiario`, `inicioEstimativa` ('AAAA-MM-DD');
    - `gruposAno`, `tiposAno`, `foraAno`;
    - `serie` (`{[ano]: (number|null)[12]}`);
    - `anoAnterior` (`{ano, mesesPublicados, total, fechado}`).
  - `valorContador(imp, instanteMs): number`.
- A linha do TCE-SP tem: `orgao`, `ds_alinea` ("<8 dígitos> - descrição") e `vl_arrecadacao` ("1.234,56").

- [ ] **Step 1: Acrescentar ao fim de `check/regras.mjs`**

```js
import { valorBR, grupoReceita, tipoImposto, resumirReceitas, montarImpostometro, valorContador } from '../src/regras/receitas.js';

{
  const P = 'PREFEITURA MUNICIPAL DE SALTO';
  const L = (alinea, v = '0,00', orgao = P) => ({ orgao, ds_alinea: alinea, vl_arrecadacao: v });
  assert.equal(valorBR('1.234,56'), 1234.56);
  assert.equal(valorBR('-10,00'), -10);
  assert.throws(() => valorBR('abc'));

  const IPTU = '11125001 - Imposto sobre a Propriedade Predial e Territorial Urbana';
  assert.deepEqual([grupoReceita(L(IPTU)), tipoImposto(L(IPTU))], ['impostos', 'iptu']);
  assert.equal(tipoImposto(L('11125300 - Impostos sobre Transmissão &quot;Inter Vivos&quot; de Bens Imóveis')), 'itbi');
  assert.equal(tipoImposto(L('11145100 - Impostos sobre Serviços de Qualquer Natureza')), 'iss');
  assert.equal(tipoImposto(L('11130311 - Imposto sobre a Renda - Retido na Fonte - Trabalho')), 'ir');
  assert.deepEqual([grupoReceita(L('11210400 - Taxa de Controle e Fiscalização Ambiental')), tipoImposto(L('11210400 - Taxa de Controle e Fiscalização Ambiental'))], ['impostos', 'taxas']);
  assert.equal(grupoReceita(L('17215010 - Cota-Parte do ICMS')), 'estado');
  assert.equal(grupoReceita(L('17115110 - Cota-Parte do Fundo de Participação dos Municípios')), 'uniao');
  assert.equal(grupoReceita(L('17515000 - Transferências de Recursos do FUNDEB')), 'fundeb');
  assert.equal(grupoReceita(L('21120000 - Operações de Crédito Internas')), 'emprestimos');
  assert.equal(grupoReceita(L('79230000 - Outros Ressarcimentos - Intra OFSS')), 'fora');
  assert.equal(grupoReceita(L('16990000 - Serviços Sujeitos à Regulação', '1,00', 'SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO')), 'saae');
  assert.equal(grupoReceita(L('13210100 - Remuneração de Depósitos Bancários')), 'outras');

  const r1 = resumirReceitas({
    '2026-09': [L(IPTU, '1.000,00'), L('11145100 - Impostos sobre Serviços', '500,50'), L(IPTU, '-100,00'),
      L('17215010 - Cota-Parte do ICMS', '2.000,00'), L('79230000 - Intra', '50,00'),
      L('16990000 - Serviços', '300,00', 'SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO')],
    '2026-10': [],
  });
  assert.deepEqual(Object.keys(r1.meses), ['2026-09']);
  assert.deepEqual(r1.meses['2026-09'], { grupos: { impostos: 1400.5, estado: 2000, saae: 300 }, tipos: { iptu: 900, iss: 500.5 }, impostos: 1400.5, fora: 50 });

  // 12 meses publicados (out/2025 a set/2026), R$ 1.000 de IPTU cada; out/2025 a set/2026 somam 365 dias.
  const porMes = {};
  for (const m of ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) porMes[m] = [L(IPTU, '1.000,00')];
  const imp = montarImpostometro(resumirReceitas(porMes), 2026);
  assert.equal(imp.ultimoMesOficial, '2026-09');
  assert.equal(imp.fimOficial, '2026-09-30');
  assert.equal(imp.oficialAno, 9000);
  assert.equal(imp.inicioEstimativa, '2026-10-01');
  assert.ok(Math.abs(imp.ritmoDiario - 12000 / 365) < 1e-9);
  assert.deepEqual(imp.anoAnterior, { ano: 2025, mesesPublicados: 3, total: 3000, fechado: false });
  assert.equal(imp.serie[2026][8], 1000);
  assert.equal(imp.serie[2026][9], null);
  assert.deepEqual(imp.tiposAno, { iptu: 9000 });
  const dia = (s) => Date.parse(`${s}T00:00:00-03:00`);
  assert.ok(Math.abs(valorContador(imp, dia('2026-10-11')) - (9000 + 10 * 12000 / 365)) < 1e-6);
  assert.equal(valorContador(imp, dia('2026-09-15')), 9000);
  // virada do ano: o contador de 2026 para em 31/12 (92 dias de out a dez)
  assert.ok(Math.abs(valorContador(imp, dia('2027-01-05')) - (9000 + 92 * 12000 / 365)) < 1e-6);
  // janeiro de 2027 sem mês publicado: a parte oficial é 0 e a estimativa começa em 1º/01
  const jan = montarImpostometro(resumirReceitas(porMes), 2027);
  assert.equal(jan.oficialAno, 0);
  assert.equal(jan.inicioEstimativa, '2027-01-01');
  assert.deepEqual(jan.anoAnterior, { ano: 2026, mesesPublicados: 9, total: 9000, fechado: false });
  assert.ok(Math.abs(valorContador(jan, dia('2027-01-11')) - 10 * 12000 / 365) < 1e-6);
  console.log('ok: receitas');
}
```

- [ ] **Step 2: Escrever `src/regras/receitas.js`**

```js
export const GRUPOS_RECEITA = {
  impostos: 'Impostos da cidade',
  estado: 'Repasses do Estado',
  uniao: 'Repasses da União',
  fundeb: 'FUNDEB (educação)',
  saae: 'Água e esgoto (SAAE)',
  emprestimos: 'Empréstimos',
  outras: 'Outras receitas',
};

export const TIPOS_IMPOSTO = {
  iptu: 'IPTU',
  iss: 'ISS',
  ir: 'Imposto de Renda retido',
  itbi: 'ITBI',
  taxas: 'Taxas',
  outros: 'Outros impostos',
};

export function valorBR(s) {
  const n = Number(String(s ?? '').trim().replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`Valor de receita inválido: "${s}"`);
  return n;
}

const codigo = (linha) => (String(linha.ds_alinea ?? '').match(/^\s*(\d{8})/) || [])[1] || '';

// Tabela 3.1 da spec. A ordem importa.
export function grupoReceita(linha) {
  const c = codigo(linha);
  if (/^[78]/.test(c)) return 'fora'; // intraorçamentária: contaria o mesmo dinheiro duas vezes
  if (/SAAE/i.test(String(linha.orgao ?? ''))) return 'saae';
  if (/^11[12]/.test(c)) return 'impostos';
  if (/^(172|242)/.test(c)) return 'estado';
  if (/^(171|241)/.test(c)) return 'uniao';
  if (/^175/.test(c)) return 'fundeb';
  if (/^21/.test(c)) return 'emprestimos';
  return 'outras';
}

// Tabela 3.2 da spec (só faz sentido dentro do grupo "impostos").
export function tipoImposto(linha) {
  const c = codigo(linha);
  const d = String(linha.ds_alinea ?? '');
  if (c.startsWith('1112') && /Predial e Territorial/i.test(d)) return 'iptu';
  if (c.startsWith('1112') && /Transmiss/i.test(d)) return 'itbi';
  if (c.startsWith('1113')) return 'ir';
  if (c.startsWith('1114')) return 'iss';
  if (c.startsWith('112')) return 'taxas';
  return 'outros';
}

const somarEm = (alvo, chave, v) => { alvo[chave] = (alvo[chave] || 0) + v; };

export function resumirReceitas(linhasPorMes) {
  const meses = {};
  for (const mes of Object.keys(linhasPorMes).sort()) {
    const linhas = linhasPorMes[mes];
    if (!linhas || !linhas.length) continue; // mês sem linhas = ainda não publicado
    const m = { grupos: {}, tipos: {}, impostos: 0, fora: 0 };
    for (const l of linhas) {
      const v = valorBR(l.vl_arrecadacao);
      const g = grupoReceita(l);
      if (g === 'fora') { m.fora += v; continue; }
      somarEm(m.grupos, g, v);
      if (g === 'impostos') {
        somarEm(m.tipos, tipoImposto(l), v);
        m.impostos += v;
      }
    }
    meses[mes] = m;
  }
  return { meses };
}

const doisDigitos = (n) => String(n).padStart(2, '0');
const diasNoMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};
const instanteBR = (dia) => Date.parse(`${dia}T00:00:00-03:00`);
const somarObjetos = (lista) => {
  const acc = {};
  for (const o of lista) for (const [k, v] of Object.entries(o)) somarEm(acc, k, v);
  return acc;
};

export function montarImpostometro(resumo, anoAtual) {
  const publicados = Object.keys(resumo.meses).sort();
  const ultimo = publicados.length ? publicados[publicados.length - 1] : null;
  const ultimos12 = publicados.slice(-12);
  const dias = ultimos12.reduce((s, m) => s + diasNoMes(m), 0);
  const ritmoDiario = dias ? ultimos12.reduce((s, m) => s + resumo.meses[m].impostos, 0) / dias : 0;
  const doAno = (ano) => publicados.filter((m) => m.startsWith(`${ano}-`));
  const atuais = doAno(anoAtual);
  const anteriores = doAno(anoAtual - 1);

  let fimOficial = null;
  let inicioEstimativa = `${anoAtual}-01-01`;
  if (ultimo) {
    const [a, m] = ultimo.split('-').map(Number);
    fimOficial = `${ultimo}-${doisDigitos(diasNoMes(ultimo))}`;
    if (a === anoAtual) inicioEstimativa = m === 12 ? `${anoAtual + 1}-01-01` : `${a}-${doisDigitos(m + 1)}-01`;
  }
  const serie = (ano) => Array.from({ length: 12 }, (_, i) => {
    const k = `${ano}-${doisDigitos(i + 1)}`;
    return resumo.meses[k] ? resumo.meses[k].impostos : null;
  });

  return {
    anoAtual,
    ultimoMesOficial: ultimo,
    fimOficial,
    oficialAno: atuais.reduce((s, m) => s + resumo.meses[m].impostos, 0),
    ritmoDiario,
    inicioEstimativa,
    gruposAno: somarObjetos(atuais.map((m) => resumo.meses[m].grupos)),
    tiposAno: somarObjetos(atuais.map((m) => resumo.meses[m].tipos)),
    foraAno: atuais.reduce((s, m) => s + resumo.meses[m].fora, 0),
    serie: { [anoAtual - 1]: serie(anoAtual - 1), [anoAtual]: serie(anoAtual) },
    anoAnterior: {
      ano: anoAtual - 1,
      mesesPublicados: anteriores.length,
      total: anteriores.reduce((s, m) => s + resumo.meses[m].impostos, 0),
      fechado: anteriores.length === 12,
    },
  };
}

// Oficial do ano + ritmo diário × dias desde o início da estimativa; para em 31/12 do ano do contador.
export function valorContador(imp, instanteMs) {
  const inicio = instanteBR(imp.inicioEstimativa);
  const fimAno = instanteBR(`${imp.anoAtual + 1}-01-01`);
  const dias = Math.max(0, (Math.min(instanteMs, fimAno) - inicio) / 86400000);
  return imp.oficialAno + imp.ritmoDiario * dias;
}
```

- [ ] **Step 3: Rodar a checagem**

Run: `npm run checar`
Expected: todas as seções anteriores mais `ok: receitas`.

- [ ] **Step 4: Commit**

```bash
git add src/regras/receitas.js check/regras.mjs
git commit -m "feat: regras do impostômetro (grupos, tipos de imposto e contador)"
```

---

### Task 2: Coleta, processamento, barreira e relatório

**Files:**
- Create: `src/coleta/receitas.js`
- Modify: `src/config.js`, `src/coletar.js`, `src/processar.js`, `src/conferir.js`, `src/relatorio.js`, `check/regras.mjs`

**Interfaces:**
- Consumes: `resumirReceitas`, `montarImpostometro`, `GRUPOS_RECEITA` e `TIPOS_IMPOSTO` (Task 1); `baixar` e `salvar` (`src/coleta/http.js`).
- Produces:
  - `coletarReceitas(anoAtual, mesAtual): Promise<Record<'AAAA-MM', linha[]>>`, só com os meses publicados.
  - `coleta.receitas`.
  - `dados.receitas`: o objeto `Impostometro` da Task 1, ou `null` se a coleta não trouxe receitas.
  - `dados.meta.receitasMensais`: `Record<'AAAA-MM', number>`, os impostos da cidade de cada mês, arredondados em centavos.
  - `src/config.js`: `TCE_RECEITAS` e `POPULACAO` (`{ valor, fonte }`).

- [ ] **Step 1: Ajustar `check/regras.mjs` (seção `conferir`)**

No bloco do `conferir`, troque a linha `    meta: { totalProposituras: 100 },` do objeto `base` por:

```js
    receitas: { anoAnterior: { ano: 2025, mesesPublicados: 12 } },
    meta: { totalProposituras: 100, atualizadoEm: '2026-11-14T09:00:00Z', receitasMensais: { '2026-09': 100 } },
```

E acrescente antes de `console.log('ok: conferir');`:

```js
  assert.equal(conferir({ ...base, receitas: null }, null, 11).length, 1);
  const anoIncompleto = { ...base, receitas: { anoAnterior: { ano: 2025, mesesPublicados: 11 } } };
  assert.equal(conferir(anoIncompleto, null, 11).length, 1);
  assert.equal(conferir({ ...anoIncompleto, meta: { ...base.meta, atualizadoEm: '2026-02-10T09:00:00Z' } }, null, 11).length, 0);
  assert.equal(conferir({ ...base, meta: { ...base.meta, receitasMensais: {} } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11).length, 1);
  assert.equal(conferir({ ...base, meta: { ...base.meta, receitasMensais: { '2026-09': 90 } } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11).length, 1);
  assert.equal(conferir({ ...base, meta: { ...base.meta, receitasMensais: { '2026-09': 96 } } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11).length, 0);
```

- [ ] **Step 2: `src/config.js`: acrescentar no fim**

```js
export const TCE_RECEITAS = 'https://transparencia.tce.sp.gov.br/api/json/receitas/salto';
export const POPULACAO = { valor: 141988, fonte: 'IBGE, informada pela Prefeitura ao Tesouro Nacional (RREO 2025)' };
```

- [ ] **Step 3: Escrever `src/coleta/receitas.js`**

```js
import { TCE_RECEITAS, ANO_INICIO } from '../config.js';
import { baixar, salvar } from './http.js';

// Baixa as receitas do ano anterior (12 meses) e do ano atual (até o mês corrente).
// Sempre baixa de novo: o TCE-SP corrige meses passados. Resposta [] = mês ainda não publicado.
export async function coletarReceitas(anoAtual, mesAtual) {
  const porMes = {};
  for (const ano of [anoAtual - 1, anoAtual]) {
    if (ano < ANO_INICIO) continue;
    const ultimoMes = ano === anoAtual ? mesAtual : 12;
    for (let mes = 1; mes <= ultimoMes; mes++) {
      const chave = `${ano}-${String(mes).padStart(2, '0')}`;
      const texto = (await baixar(`${TCE_RECEITAS}/${ano}/${mes}`)).toString('utf8');
      let linhas;
      try { linhas = JSON.parse(texto); } catch { throw new Error(`Receitas ${chave}: a resposta do TCE-SP não é JSON.`); }
      if (!Array.isArray(linhas)) throw new Error(`Receitas ${chave}: formato inesperado da API do TCE-SP.`);
      await salvar(`data/bruto/receitas/${chave}.json`, texto);
      if (linhas.length) porMes[chave] = linhas;
    }
  }
  return porMes;
}
```

- [ ] **Step 4: `src/coletar.js`**

- Importe: `import { coletarReceitas } from './coleta/receitas.js';`
- Em `coletarTudo`, depois de `const votacoes = ...`, acrescente:
  ```js
  const hoje = new Date();
  const receitas = await coletarReceitas(hoje.getFullYear(), hoje.getMonth() + 1);
  ```
- Inclua `receitas` no objeto `coleta`: `{ vereadores, cardsPorAno, presencas, votacoes, receitas, coletadoEm: ... }`.
- No bloco que imprime o resumo, acrescente: `console.log(\`Receitas: ${Object.keys(c.receitas).length} meses publicados\`);`

- [ ] **Step 5: `src/processar.js`**

- Importe: `import { resumirReceitas, montarImpostometro } from './regras/receitas.js';`
- Troque a assinatura por `export function processar({ vereadores, cardsPorAno, presencas, votacoes, receitas, coletadoEm }) {`.
- Logo antes do `return {` final, acrescente:
  ```js
  const resumoReceitas = receitas ? resumirReceitas(receitas) : null;
  const anoReceitas = new Date(coletadoEm || Date.now()).getFullYear();
  ```
- No objeto devolvido, acrescente `receitas: resumoReceitas ? montarImpostometro(resumoReceitas, anoReceitas) : null,` (por exemplo, depois de `avisos`).
- Dentro de `meta`, acrescente:
  ```js
  receitasMensais: resumoReceitas
    ? Object.fromEntries(Object.entries(resumoReceitas.meses).map(([m, x]) => [m, Math.round(x.impostos * 100) / 100]))
    : {},
  ```

- [ ] **Step 6: `src/conferir.js`: acrescentar antes do `return problemas;`**

```js
  const r = dados.receitas;
  if (!r) {
    problemas.push('Receitas do impostômetro não foram coletadas.');
  } else {
    const mesCalendario = new Date(dados.meta.atualizadoEm || Date.now()).getMonth() + 1;
    if (mesCalendario >= 3 && r.anoAnterior && r.anoAnterior.mesesPublicados < 12) {
      problemas.push(`Receitas de ${r.anoAnterior.ano}: só ${r.anoAnterior.mesesPublicados} de 12 meses publicados.`);
    }
    const novos = dados.meta.receitasMensais || {};
    for (const [mes, valor] of Object.entries((anterior && anterior.receitasMensais) || {})) {
      if (!(mes in novos)) problemas.push(`Receitas de ${mes} sumiram da fonte.`);
      else if (novos[mes] < valor * 0.95) problemas.push(`Impostos de ${mes} caíram mais de 5% (de ${valor} para ${novos[mes]}).`);
    }
  }
```

- [ ] **Step 7: `src/relatorio.js`**

Importe `import { GRUPOS_RECEITA, TIPOS_IMPOSTO } from './regras/receitas.js';` e acrescente, logo antes de `l.push('', '## O que é estimativa', '');`:

```js
  const r = d.receitas;
  const reais = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  l.push('', '## Impostômetro', '');
  if (!r) {
    l.push('- Receitas não coletadas.');
  } else {
    l.push(`- Último mês oficial: ${r.ultimoMesOficial || 'nenhum'} (fim ${r.fimOficial || '-'})`);
    l.push(`- Impostos da cidade em ${r.anoAtual}, oficial: ${reais(r.oficialAno)}`);
    l.push(`- Ritmo diário (últimos 12 meses publicados): ${reais(r.ritmoDiario)} por dia`);
    l.push(`- ${r.anoAnterior.ano}: ${r.anoAnterior.mesesPublicados} meses publicados, ${reais(r.anoAnterior.total)}`);
    l.push('', 'Por tipo de imposto (ano atual):', ...Object.entries(r.tiposAno).map(([k, v]) => `- ${TIPOS_IMPOSTO[k] || k}: ${reais(v)}`));
    l.push('', 'Por grupo (ano atual):', ...Object.entries(r.gruposAno).map(([k, v]) => `- ${GRUPOS_RECEITA[k] || k}: ${reais(v)}`));
    l.push(`- Fora do total (intraorçamentárias): ${reais(r.foraAno)}`);
  }
```

- [ ] **Step 8: Rodar a checagem**

Run: `npm run checar`
Expected: todas as seções `ok`, inclusive `ok: conferir` com as asserções novas.

- [ ] **Step 9: Verificar com dados reais (rede, cerca de 1 minuto)**

Crie um script descartável na pasta scratchpad (não no repositório). Ele deve:
1. importar `coletarReceitas` (via URL `file:///`);
2. chamar `coletarReceitas(2026, 11)`;
3. juntar o resultado em `data/bruto/coleta.json` como `coleta.receitas` e gravar o arquivo de volta.

Depois rode `npm run processar` uma vez (`gerar-site` continua igual e não usa as receitas ainda).

Expected:
- "Pronto.";
- `conferencia.md` com a seção "Impostômetro" mostrando:
  - último mês 2026-09;
  - impostos de 2026 em torno de R$ 187 mi;
  - por tipo: IPTU ≈ R$ 90,6 mi, ISS ≈ R$ 56,9 mi, IR ≈ R$ 20,9 mi, ITBI ≈ R$ 18,6 mi, taxas ≈ R$ 5,8 mi;
  - 2025 com 12 meses.

Cole esses números no relatório.

- [ ] **Step 10: Commit**

```bash
git add src/config.js src/coleta/receitas.js src/coletar.js src/processar.js src/conferir.js src/relatorio.js check/regras.mjs data/bruto/receitas data/processado
git commit -m "feat: coleta das receitas do TCE-SP, barreira e relatório do impostômetro"
```

---

### Task 3: O impostômetro no site

**Files:**
- Modify: `src/gerar-site.js`, `site/busca.js`, `site/estilo.css`

**Interfaces:**
- Consumes:
  - `d.receitas` (o `Impostometro` da Task 1, ou `null`);
  - `GRUPOS_RECEITA` e `TIPOS_IMPOSTO` (Task 1);
  - `POPULACAO` (Task 2);
  - `valorContador` (Task 1), para o valor escrito no HTML.
- Produces:
  - `dist/impostometro.html`;
  - o bloco `.contador-impostos` na home;
  - um item "Impostômetro" no menu;
  - uma linha na lista de fontes de `fontes.html`.

- [ ] **Step 1: `src/gerar-site.js`: imports e helpers**

Acrescente aos imports:

```js
import { POPULACAO } from './config.js';
import { GRUPOS_RECEITA, TIPOS_IMPOSTO, valorContador } from './regras/receitas.js';
```

Logo abaixo de `const link = ...`, acrescente:

```js
const reais = (v) => Math.round(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const instanteBR = (dia) => Date.parse(`${dia}T00:00:00-03:00`);

// Contador: o HTML já traz o valor do momento da geração; busca.js faz ele rodar.
function blocoContador(r, prefixo, grande) {
  const agora = valorContador(r, Date.now());
  const oficialAte = r.fimOficial ? `Oficial até ${dataBR(r.fimOficial)}: ${reais(r.oficialAno)}` : `Ainda não há mês oficial de ${r.anoAtual}`;
  return `<div class="contador-impostos${grande ? ' grande' : ''}" data-oficial="${r.oficialAno}" data-ritmo="${r.ritmoDiario}" data-inicio="${instanteBR(r.inicioEstimativa)}" data-fim="${instanteBR(`${r.anoAtual + 1}-01-01`)}" data-populacao="${POPULACAO.valor}">
<p class="rotulo">Salto já arrecadou em impostos em ${r.anoAtual}</p>
<p class="valor" aria-live="off">${reais(agora)}</p>
<p class="por-morador">Cada saltense, em média: <strong>${reais(agora / POPULACAO.valor)}</strong></p>
<p class="nota">${esc(oficialAte)} · daqui em diante é estimativa pelo ritmo dos últimos 12 meses.</p>
${grande ? '' : `<p><a class="botao" href="${prefixo}impostometro.html">De onde vem o dinheiro de Salto →</a></p>`}
</div>`;
}

const barras = (pares, total) => `<ul class="barras">${pares.map(([rotulo, v]) => `<li><span class="rotulo">${esc(rotulo)}</span><span class="trilho"><span class="barra" style="width:${total > 0 ? Math.max(0, (v / total) * 100).toFixed(1) : 0}%"></span></span><span class="num">${reais(v)}${total > 0 ? ` <small>(${((v / total) * 100).toFixed(1).replace('.', ',')}%)</small>` : ''}</span></li>`).join('')}</ul>`;
```

- [ ] **Step 2: Menu e home**

- No `layout`, acrescente ao `<nav>`, depois de "Votações": `<a href="${prefixo}impostometro.html">Impostômetro</a>`.
- Em `paginaInicial`, logo depois de `${salario}` dentro da `<section class="hero">`, acrescente: `${d.receitas ? blocoContador(d.receitas, '', false) : ''}`.

- [ ] **Step 3: Página `impostometro.html`**

Acrescente a função:

```js
function paginaImpostometro(d) {
  const r = d.receitas;
  const tipos = Object.entries(r.tiposAno).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS_IMPOSTO[k] || k, v]);
  const grupos = Object.entries(r.gruposAno).sort((a, b) => b[1] - a[1]).map(([k, v]) => [GRUPOS_RECEITA[k] || k, v]);
  const totalGrupos = grupos.reduce((s, [, v]) => s + v, 0);
  const anoAnt = r.anoAnterior;
  const serieAtual = r.serie[r.anoAtual];
  const serieAnt = r.serie[anoAnt.ano];
  const maiorMes = Math.max(1, ...serieAtual.filter((v) => v !== null), ...serieAnt.filter((v) => v !== null));
  const linhaMes = (ano, v) => v === null
    ? `<span class="trilho"><span class="vazio">ainda não publicado</span></span>`
    : `<span class="trilho"><span class="barra${ano === r.anoAtual ? '' : ' anterior'}" style="width:${((v / maiorMes) * 100).toFixed(1)}%"></span></span><span class="num">${reais(v)}</span>`;
  const meses = MESES.map((nome, i) => `<li><span class="rotulo">${nome}</span><div class="par"><div>${anoAnt.ano}: ${linhaMes(anoAnt.ano, serieAnt[i])}</div><div>${r.anoAtual}: ${linhaMes(r.anoAtual, serieAtual[i])}</div></div></li>`).join('');
  const fechamento = anoAnt.fechado
    ? `${anoAnt.ano} fechado em ${reais(anoAnt.total)} (oficial).`
    : `${anoAnt.ano}: ${reais(anoAnt.total)} oficial até ${anoAnt.mesesPublicados} ${anoAnt.mesesPublicados === 1 ? 'mês publicado' : 'meses publicados'}.`;

  const corpo = `<h1>Impostômetro de Salto</h1>
${blocoContador(r, '', true)}
<p>A parte oficial é o que a Prefeitura registrou no Tribunal de Contas do Estado (TCE-SP), que publica os números com cerca de um mês e meio de atraso. Depois do último mês oficial, o contador sobe no ritmo médio dos últimos 12 meses: é uma estimativa e se corrige sozinha quando sai um mês novo.</p>
<p class="aviso">${esc(fechamento)}</p>
<section>
<h2>Os impostos da cidade em ${r.anoAtual}</h2>
<p>Impostos e taxas que o morador e as empresas pagam direto à Prefeitura. O Imposto de Renda retido é o que a Prefeitura desconta dos salários que paga e, por lei, fica com a cidade.</p>
${barras(tipos, r.oficialAno)}
</section>
<section>
<h2>Mês a mês</h2>
<ul class="meses">${meses}</ul>
</section>
<section>
<h2>De onde vem o dinheiro de Salto</h2>
<p>Toda a arrecadação oficial de ${r.anoAtual}, até o último mês publicado. Os repasses do Estado e da União também são impostos pagos pela população, arrecadados por eles e devolvidos à cidade.</p>
${barras(grupos, totalGrupos)}
<p class="nota">Ficaram fora do total ${reais(r.foraAno)} que só passaram de um órgão público da cidade para outro (receitas intraorçamentárias), para não contar o mesmo dinheiro duas vezes.</p>
</section>
<section id="fontes-impostometro">
<h2>De onde vêm os números</h2>
<ul>
<li><a href="https://transparencia.tce.sp.gov.br/">Portal da Transparência Municipal do TCE-SP</a>, receitas de Salto mês a mês. Último mês oficial: ${r.ultimoMesOficial ? esc(r.ultimoMesOficial.split('-').reverse().join('/')) : 'nenhum'}.</li>
<li>População: ${POPULACAO.valor.toLocaleString('pt-BR')} habitantes (${esc(POPULACAO.fonte)}).</li>
<li>Grupos: impostos da cidade (códigos 111 e 112), repasses do Estado (172 e 242), repasses da União (171 e 241), FUNDEB (175), empréstimos (21), água e esgoto (tudo o que entra no SAAE) e outras receitas (o resto).</li>
</ul>
</section>`;
  return layout({ titulo: 'Impostômetro de Salto: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
```

- Em `gerarSite`, depois de escrever `fontes.html`, acrescente: `if (d.receitas) await writeFile(\`${destino}/impostometro.html\`, paginaImpostometro(d));`
- Em `paginaFontes`, na lista "Fontes", acrescente um item: `<li><strong>Impostos e receitas:</strong> <a href="impostometro.html#fontes-impostometro">API de receitas do TCE-SP</a>, usada no impostômetro.</li>`

- [ ] **Step 4: `site/busca.js`: contador rodando**

Acrescente antes do `})();` final:

```js
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
```

- [ ] **Step 5: `site/estilo.css`: acrescentar antes do bloco `@media`**

```css
.contador-impostos { border: 2px solid var(--link); border-radius: 12px; padding: 1rem; margin: 1rem 0; text-align: center; }
.contador-impostos .rotulo { margin: 0; color: var(--suave); }
.contador-impostos .valor { font-size: 2rem; font-weight: 800; margin: .25rem 0; font-variant-numeric: tabular-nums; }
.contador-impostos.grande .valor { font-size: 2.6rem; }
.contador-impostos .por-morador { margin: .25rem 0; }
.nota { font-size: .85rem; color: var(--suave); }
.botao { display: inline-block; padding: .55rem 1rem; border-radius: 8px; background: var(--link); color: #fff; text-decoration: none; font-weight: 600; }
.barras, .meses { list-style: none; padding: 0; }
.barras li { display: grid; grid-template-columns: 1fr; gap: .2rem; margin: .6rem 0; }
.trilho { display: block; background: #eef3fa; border-radius: 6px; height: .9rem; overflow: hidden; }
.barra { display: block; height: 100%; background: var(--link); border-radius: 6px; }
.barra.anterior { background: #9bb7d8; }
.vazio { font-size: .75rem; color: var(--suave); padding-left: .3rem; }
.meses li { margin: .6rem 0; }
.meses .par div { display: grid; grid-template-columns: 3.2rem 1fr 7rem; gap: .4rem; align-items: center; font-size: .85rem; }
.meses .par .num { text-align: right; }
```

- [ ] **Step 6: Gerar e verificar**

Run: `npm run checar && npm run processar`
Expected: tudo `ok` e "Pronto.".

Depois, com um script descartável na pasta scratchpad, confirme:
- `dist/impostometro.html` existe e contém "Impostômetro de Salto", "Os impostos da cidade", "De onde vem o dinheiro de Salto" e "Oficial até 30/09/2026";
- `dist/index.html` contém `class="contador-impostos"` e `impostometro.html`;
- todas as páginas têm "Impostômetro" no menu.

A conferência visual no navegador fica com o controlador.

- [ ] **Step 7: Commit**

```bash
git add src/gerar-site.js site/busca.js site/estilo.css data/processado
git commit -m "feat: impostômetro na home e página própria"
```
