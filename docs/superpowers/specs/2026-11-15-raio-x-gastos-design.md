# Raio-X dos gastos — Design

Data: 2026-11-15 · Projeto: Radar Saltense (https://sandersono.github.io/radar-saltense/)
Depende do design principal (`2026-11-14-radar-saltense-design.md`) e do impostômetro (`2026-11-14-impostometro-design.md`). Continuam valendo: só dado oficial, dizer o que é estimativa, barreira antes de publicar, coleta educada. O nome é "Raio-X dos gastos"; nunca "auditoria".

## 1. Objetivo

Mostrar ao morador quanto a cidade pagou, para quais áreas e para quais empresas, sempre separado por ano desde o início do mandato (2025, `ANO_INICIO`). Inclui uma busca por empresa e "pontos de atenção" escritos como fatos, sem acusar ninguém.

## 2. Fontes (verificadas em 2026-11-15)

### 2.1 Pagamentos: API do TCE-SP

`https://transparencia.tce.sp.gov.br/api/json/despesas/salto/<ano>/<mes>`

- Linha: `orgao`, `mes`, `evento`, `nr_empenho`, `id_fornecedor`, `nm_fornecedor`, `dt_emissao_despesa`, `vl_despesa` ("1.234,56").
- `evento`: "Empenhado", "Anulação", "Valor Liquidado", "Valor Pago".
- `orgao`: "PREFEITURA MUNICIPAL DE SALTO", "CÂMARA MUNICIPAL DE SALTO", "SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO".
- `id_fornecedor`: "CNPJ - PESSOA JURÍDICA - <14 dígitos>" ou "PESSOA FÍSICA - <6 dígitos do CPF>". Não apareceu outro tipo em 2025–2026.
- Atraso de cerca de 1,5 mês; `[]` = mês ainda não publicado (mesma regra das receitas).
- Referência para a conferência (valor pago):
  - 2025 (12 meses): R$ 725 mi; empresas e entidades R$ 322 mi (1.010 CNPJs); órgãos públicos, impostos e folha R$ 400 mi; pessoas físicas R$ 3,1 mi (384).
  - 2026 (jan–set): R$ 599 mi; empresas e entidades R$ 276 mi (880); órgãos públicos, impostos e folha R$ 322 mi; pessoas físicas R$ 1,6 mi (281).
  - Anulações: R$ 75 mi (2025) e R$ 66 mi (2026 até set).

### 2.2 Por área: SICONFI (Tesouro Nacional)

`https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=<ano>&nr_periodo=<bimestre>&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&id_ente=3545209`

- Usa o último bimestre publicado do ano (tenta 6, 5, …, 1).
- Linhas com `rotulo` = "Total das Despesas Exceto Intra-Orçamentárias" e `coluna` = "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)".
- Área = `conta` igual a um nome da lista oficial de funções (Portaria 42/1999): Legislativa, Judiciária, Essencial à Justiça, Administração, Defesa Nacional, Segurança Pública, Relações Exteriores, Assistência Social, Previdência Social, Saúde, Trabalho, Educação, Cultura, Direitos da Cidadania, Urbanismo, Habitação, Saneamento, Gestão Ambiental, Ciência e Tecnologia, Agricultura, Organização Agrária, Indústria, Comércio e Serviços, Comunicações, Energia, Transporte, Desporto e Lazer, Encargos Especiais.
- Total = `conta` "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)". Em 2026 bimestre 4 a soma das áreas bate com o total ao centavo (R$ 524.062.973,15).
- É valor **liquidado** e vai até o bimestre publicado; por isso não bate com o pago do TCE-SP. A página diz isso.

### 2.3 Onde conferir nomes (links oficiais)

- Portal da Transparência da Prefeitura, "Despesa Detalhada por Credor": `https://salto.obaratec.com.br/ords/salto02/f?p=839:7` (escolher instituição — Prefeitura, Câmara ou SAAE — e o ano).
- TCE-SP, "Despesas por Fornecedor": `https://transparencia.tce.sp.gov.br/despesas-fornecedor`. Para empresa, link direto `?nr_identificador_despesa=<CNPJ>` (testado: traz as linhas de Salto). Para pessoa física não há link por pessoa: os 6 dígitos do CPF se repetem em outras cidades.

## 3. Regras

### 3.1 Valor e evento

- Valor pago = soma de `vl_despesa` com `evento` = "Valor Pago". É o número principal de toda a página.
- Anulado = soma com `evento` = "Anulação".
- O ano e o mês vêm do arquivo baixado (`<ano>/<mes>`), não de `dt_emissao_despesa`.

### 3.2 Grupos de quem recebe (a ordem importa)

| Ordem | Condição | Grupo |
|---|---|---|
| 1 | `id_fornecedor` começa com "PESSOA FÍSICA" | Pessoas físicas (só total, sem nome) |
| 2 | `nm_fornecedor` casa com a lista de órgãos públicos, impostos e folha (abaixo) | Órgãos públicos, impostos e folha |
| 3 | qualquer outro CNPJ | Empresas e entidades |

Lista do grupo 2 (normalizada, sem acento, maiúsculas): MUNICIPIO, PREFEITURA, CAMARA MUNICIPAL, SERVICO AUTONOMO, FUNDO, FUNDEB, INSTITUTO NACIONAL DO SEGURO SOCIAL, PREVIDENCIA, RECEITA FEDERAL, SECRETARIA, MINISTERIO, TRIBUNAL, CAIXA ECONOMICA FEDERAL, BANCO DO BRASIL, BANCO SANTANDER, BANCO BRADESCO, ITAU UNIBANCO, DESENVOLVE SP, PRODESP, CETESB, COMPANHIA DE PROCESSAMENTO DE DADOS. Fica em `src/regras/despesas.js` e aparece na seção "De onde vêm os números".

MEI e empresa individual (CNPJ com nome de pessoa) ficam em "Empresas e entidades", com nome, como o próprio TCE-SP mostra.

### 3.3 Pontos de atenção (por ano)

Cada um vem com a frase fixa: "Isto é um fato tirado dos dados oficiais, não uma acusação. Há explicações comuns para cada caso."

1. **Concentração:** percentual do valor pago a "Empresas e entidades" que foi para as 10 que mais receberam. Ex.: "As 10 empresas que mais receberam ficaram com 67% do que foi pago a empresas em 2026."
2. **Reservado e depois cancelado:** total anulado no ano e as 5 empresas e entidades com mais valor anulado. Texto explica que empenhar é reservar dinheiro e anular é cancelar a reserva (sobra, troca de contrato, erro de lançamento).
3. **Novas com valor alto:** empresas e entidades que não receberam nada em 2024 e cujo pago no mandato (soma de 2025 em diante) passa de R$ 1 milhão; lista com o valor e o primeiro mês em que receberam. A base de 2024 é um arquivo fixo (3.4).

Ficou de fora: empenhos logo abaixo do limite de dispensa (nos dados aparecem quase só órgãos públicos; sinal fraco e com cara de acusação).

### 3.4 Base de 2024

`data/referencia/cnpjs-pagos-2024.json`: lista ordenada dos CNPJs com "Valor Pago" > 0 em 2024, gerada uma vez por `node src/ferramentas/base-2024.js` (baixa os 12 meses de 2024 do TCE-SP) e versionada. O robô diário não baixa 2024.

## 4. Telas

**Home:** um cartão "Raio-X dos gastos" na grade de números (total pago no ano mais recente e "até <mês>"), com link para a página.

**`gastos.html`** (menu: "Gastos"):
- Seletor de ano no topo (botões 2025, 2026, …; abre no ano mais recente). Sem JS, todos os anos aparecem um abaixo do outro.
- Para o ano escolhido:
  1. **Quanto foi pago:** total, "até <mês>" ou "ano fechado", por órgão (Prefeitura, Câmara, SAAE) e a barra dos 3 grupos (3.2). Pessoas físicas: só o total e a quantidade, com o texto "Os nomes de pessoas físicas não aparecem aqui. Para conferir, use a consulta oficial por credor" e os dois links de 2.3.
  2. **Para quais áreas:** barras das áreas com valor > 0 (SICONFI), "liquidado até <bimestre>", nota de que não bate com o pago.
  3. **Empresas que mais receberam:** as 20 maiores de "Empresas e entidades", com CNPJ formatado, valor e link "ver no TCE-SP" (link direto por CNPJ).
  4. **Busca por empresa:** campo para nome ou CNPJ (mínimo 3 caracteres; CNPJ com ou sem pontuação). Mostra até 30 resultados; cada um com total por ano, meses com pagamento e divisão por órgão, e o link do TCE-SP. Pessoas físicas não entram na busca.
  5. **Pontos de atenção:** os três de 3.3.
  6. **De onde vêm os números:** links das APIs, regras de 3.2, data do último mês publicado e do bimestre do SICONFI.

Mesmo visual do site (cartões, barras em HTML/CSS, `reais()` sem centavos). Celular primeiro.

## 5. Robô e dados

- **`src/coleta/despesas.js`:** para cada ano de `ANO_INICIO` até o atual, baixa os meses (no ano atual, até o mês anterior ao corrente) com `baixar()`. Salva em `data/bruto/despesas/<ano>-<mm>.json`. `[]` = não publicado. HTTP com erro ou JSON inválido para o robô (o site não publica).
- **`src/coleta/siconfi.js`:** para cada ano do mandato, acha o último bimestre com itens e guarda as linhas filtradas (2.2). Erro de rede para o robô, como no TCE-SP.
- **Regras puras em `src/regras/despesas.js`:** `grupoFornecedor(linha)`, `cnpjDe(id)`, `resumirDespesas(porMes, cnpjs2024)`, `areasSiconfi(itens)`, `formatarCnpj(cnpj)`. `valorBR` vem de `receitas.js`.
- **`processar`:** ganha `dados.gastos = { anos: { <ano>: { ultimoMes, total, porOrgao, porGrupo, pessoasFisicas: {total, quantidade}, topEmpresas[20], concentracao, anulado: {total, top[5]}, novas[], areas: {bimestre, total, lista[]} } }, mandato: {...} }`.
- **`gerar-site`:** escreve `dist/gastos.html` e `dist/dados/empresas.json` (`[cnpj, nome, {ano: {mes: valor}}, {orgao: valor}]`, só CNPJ, só valor pago > 0), carregado pela busca quando o campo é usado.
- **`meta.json`:** ganha `despesasMensais: { "AAAA-MM": totalPago }`.

## 6. Barreira (acrescenta ao `conferir`)

Não publica se:
- um mês com pagamento no `meta.json` anterior agora volta vazio;
- o total pago de um mês já publicado muda mais de 5% em relação ao `meta.json` anterior;
- a soma das áreas do SICONFI difere do total do anexo em mais de R$ 1,00.

O `conferencia.md` ganha a seção "Raio-X dos gastos": por ano, último mês, total pago, grupos, top 5 empresas, anulado, bimestre do SICONFI.

## 7. Checagens (`check/regras.mjs`, só node:assert)

- `grupoFornecedor` com linhas reais: pessoa física, "MUNICIPIO DE SALTO", "INSTITUTO NACIONAL DO SEGURO SOCIAL", "CAIXA ECONOMICA FEDERAL S/A", "CSO AMBIENTAL DE SALTO SPE SA", um MEI.
- `cnpjDe` e `formatarCnpj`.
- `resumirDespesas` com poucas linhas montadas à mão: pago, anulado, concentração, novas (com e sem CNPJ em 2024, acima e abaixo de R$ 1 mi).
- `areasSiconfi` ignora subfunções e soma igual ao total.
- `conferir` com as três regras novas.

## 8. Fora do escopo

- Nomes de pessoas físicas (decisão do usuário: só totais e link oficial).
- Dados diários do portal da Prefeitura (raspagem de formulário APEX; fica como ideia para deixar o Raio-X mais fresco).
- Contratos, licitações e data de abertura de CNPJ (outra fonte).
- Valores corrigidos pela inflação e comparação com outras cidades.
