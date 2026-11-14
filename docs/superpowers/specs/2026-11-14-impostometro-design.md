# Impostômetro de Salto — Design

Data: 2026-11-14 · Projeto: Radar Saltense (https://sandersono.github.io/radar-saltense/)
Depende do design principal: `docs/superpowers/specs/2026-11-14-radar-saltense-design.md`. As regras de lá continuam valendo: só dado oficial, dizer o que é estimativa, barreira antes de publicar e coleta educada.

## 1. Objetivo

Mostrar ao morador quanto Salto arrecada em impostos no ano, com um contador que "roda". Também mostrar de onde vem todo o dinheiro da cidade. Tudo sai de dados oficiais e é atualizado sozinho pelo robô diário que já existe.

## 2. Fonte (verificada em 2026-11-14)

API pública do TCE-SP (Portal da Transparência Municipal), sem autenticação:
`https://transparencia.tce.sp.gov.br/api/json/receitas/salto/<ano>/<mes>`

- Cada linha tem: `orgao`, `mes`, `ds_fonte_recurso`, `ds_cd_aplicacao_fixo`, `ds_alinea` ("<código de 8 dígitos> - <descrição>"), `ds_subalinea` e `vl_arrecadacao`. O valor usa o formato "1.234,56" e pode ser negativo, porque deduções e estornos aparecem como valores negativos.
- Órgãos: "PREFEITURA MUNICIPAL DE SALTO" e "SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO".
- Atraso: em 14/11/2026, setembro de 2026 tinha 290 linhas e outubro devolveu `[]`, ou seja, cerca de 1,5 mês de atraso.
- Números de referência de jan a set/2026, para a conferência:
  - IPTU: R$ 90,6 mi;
  - ISS: R$ 56,9 mi;
  - IR retido: R$ 20,9 mi;
  - ITBI: R$ 18,6 mi;
  - taxas: R$ 5,8 mi;
  - total geral: R$ 712 mi.

Um mês conta como **publicado** quando a API devolve pelo menos uma linha para ele.

## 3. Regras

### 3.1 Grupos (pelo código da alínea, os 8 primeiros dígitos de `ds_alinea`)

| Ordem | Condição | Grupo |
|---|---|---|
| 1 | código começa com `7` ou `8` (receitas intraorçamentárias) | **fora do total** (é dinheiro que passa de um setor público para outro; contaria duas vezes) |
| 2 | `orgao` contém "SAAE" | Água e esgoto (SAAE) |
| 3 | começa com `111` ou `112` | Impostos da cidade |
| 4 | começa com `172` ou `242` | Repasses do Estado |
| 5 | começa com `171` ou `241` | Repasses da União |
| 6 | começa com `175` | FUNDEB (educação) |
| 7 | começa com `21` | Empréstimos |
| 8 | qualquer outro | Outras receitas (rendimentos, serviços, multas, restituições) |

### 3.2 Tipos de imposto (só dentro de "Impostos da cidade")

| Condição | Tipo |
|---|---|
| começa com `1112` e a descrição tem "Predial e Territorial" | IPTU |
| começa com `1112` e a descrição tem "Transmiss" | ITBI |
| começa com `1113` | Imposto de Renda retido |
| começa com `1114` | ISS |
| começa com `112` | Taxas |
| outro código `111` | Outros impostos |

### 3.3 Contador

- O que conta: só o grupo "Impostos da cidade", no ano atual.
- **Parte oficial:** soma dos meses publicados do ano atual. `fimOficial` é o último dia do último mês publicado.
- **Ritmo:** soma dos impostos dos últimos 12 meses publicados, juntando o ano atual e o anterior, dividida pelo número de dias desses meses. O resultado é em R$ por dia.
- **Valor em um instante t do ano atual:** `oficialAno + ritmo × dias(desde max(fimOficial, 1º de janeiro do ano atual) até t)`.
- Se nenhum mês do ano atual foi publicado ainda (janeiro e fevereiro), a parte oficial é 0 e a estimativa começa em 1º de janeiro.
- **Por morador:** valor do contador dividido pela população (`POPULACAO = 141988`, IBGE, informada ao Tesouro Nacional no RREO de 2025). A população e a fonte ficam em `src/config.js`.
- **Virada do ano:** a página mostra também o ano anterior.
  - Se os 12 meses foram publicados: "2025 fechado em R$ X (oficial)".
  - Se não: "2025: R$ X oficial até <mês>".
- O contador nunca aparece sem o texto "Oficial até dd/mm/aaaa: R$ Y · daqui em diante é estimativa pelo ritmo dos últimos 12 meses".

## 4. Telas

**Home:** um bloco logo abaixo do título, com:
- o contador grande ("Salto já arrecadou R$ … em impostos em 2026");
- a linha por morador;
- a linha "Oficial até …";
- o link "De onde vem o dinheiro de Salto →".

**`impostometro.html`:**
1. O contador maior, com a explicação da parte oficial e da estimativa. Explica também que o IR retido é o que a Prefeitura desconta dos salários e fica com a cidade, por lei.
2. "Os impostos da cidade": barra horizontal e valor do ano atual para cada tipo (3.2).
3. "Mês a mês": barras dos impostos da cidade em cada mês, com o ano atual ao lado do anterior. Meses ainda não publicados aparecem como "ainda não publicado".
4. "De onde vem o dinheiro de Salto": cada grupo (3.1) com barra, valor e percentual do ano atual (só meses publicados), mais a nota sobre os valores que ficaram fora do total.
5. "De onde vêm os números": link da API do TCE-SP, a tabela de regras 3.1 e 3.2 e a data do último mês oficial.

**`fontes.html`:** ganha um link para a seção 5.

Os gráficos são feitos só com HTML e CSS (larguras em %), sem biblioteca, priorizando o celular. Os números aparecem no formato brasileiro (R$ 1.234.567).

## 5. Robô e dados

- **Coletor `src/coleta/receitas.js`:**
  - Para o ano atual e o anterior (desde que `>= ANO_INICIO`), baixa cada mês de 1 até 12. No ano atual, para no mês do calendário corrente.
  - Usa `baixar()`, com o mesmo User-Agent e a espera de 2 s.
  - Salva em `data/bruto/receitas/<ano>-<mm>.json`.
  - Uma resposta `[]` quer dizer "não publicado" e não é erro.
  - Erro HTTP ou JSON inválido faz o robô parar com erro, e o site não publica.
- **Regras puras em `src/regras/receitas.js`:**
  - `valorBR(s)`: lê "1.234,56";
  - `grupoReceita(linha)`;
  - `tipoImposto(linha)`;
  - `resumirReceitas(linhasPorMes)` devolve os totais por ano, mês, grupo e tipo;
  - `ritmoDiario(resumo, hoje)`;
  - `valorContador(resumo, instante)`.
- **`processar`:** ganha `dados.receitas`, com:
  - `anoAtual` e `ultimoMesOficial` ("AAAA-MM");
  - `fimOficial` ("AAAA-MM-DD");
  - `oficialAno` e `ritmoDiario`;
  - `populacao`;
  - os totais por grupo e por tipo do ano atual;
  - a série mensal dos impostos da cidade nos dois anos;
  - o fechamento do ano anterior.
- **O contador no navegador:**
  - O valor é calculado em `site/busca.js` a partir de atributos `data-*`: `data-oficial`, `data-ritmo`, `data-inicio-estimativa` e `data-populacao`.
  - Quando o JavaScript está desligado, a página mostra o valor oficial já escrito no HTML.

## 6. Barreira (acrescenta ao `conferir`)

Não publica se acontecer qualquer um destes casos:
- um mês que estava publicado no `meta.json` anterior agora volta vazio;
- a partir de março, o ano anterior tem menos de 12 meses publicados;
- o total de impostos da cidade de um mês já publicado cai mais de 5% em relação ao `meta.json` anterior.
- Para isso, o `meta.json` guarda `receitasMensais: { "AAAA-MM": totalImpostos }`.

O relatório `conferencia.md` ganha a seção "Impostômetro". Ela mostra:
- o último mês oficial;
- o total oficial do ano;
- o ritmo diário;
- os totais por tipo de imposto;
- os totais por grupo.

## 7. Checagens (`check/regras.mjs`, só node:assert)

- `valorBR('1.234,56') === 1234.56` e `valorBR('-10,00') === -10`.
- `grupoReceita` e `tipoImposto` com códigos reais:
  - IPTU 1112…, ITBI, ISS 1114…, IR 1113…, taxa 112…;
  - ICMS 1721…, FPM 1711…, FUNDEB 1751…, empréstimo 2112…;
  - intra 7923…;
  - uma linha do SAAE.
- `valorContador` em três situações:
  - um instante logo após `fimOficial` (deve dar o oficial mais o ritmo vezes a fração do dia);
  - janeiro sem nenhum mês publicado (a estimativa começa em 1º de janeiro);
  - mudança de ano.
- `conferir` com as três novas regras.

## 8. Fora do escopo

- Gastos e despesas (projeto "Raio-X dos gastos", depois).
- Comparação com outras cidades.
- Receitas da Câmara.
- Valores corrigidos pela inflação.
