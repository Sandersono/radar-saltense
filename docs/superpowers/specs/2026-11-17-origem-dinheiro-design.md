# De onde vem e para onde vai o dinheiro de Salto — design

Data: 2026-11-17. Desenho aprovado pelo usuário ("Aprovado"). A pesquisa com endpoints, contas, a tabela de fontes e a conferência está em `.superpowers/pesquisa/origem-dinheiro.md` e `origem-fontes.json`, e é a referência técnica desta spec.

## Fonte

**SICONFI, MSC orçamentária, classe 6:** `apidatalake.tesouro.gov.br/ords/siconfi/tt/msc_orcamentaria`, `id_ente=3545209`.
- **Ano corrente:** `co_tipo_matriz=MSCC`, `id_tv=ending_balance`, último mês publicado. Tente o mês atual e volte até achar dados; hoje o último é 2026-09. O saldo já é o acumulado do ano.
- **Ano fechado (2025 em diante):** `co_tipo_matriz=MSCE`, `me_referencia=12`, `ending_balance`. **Não** usar a MSC de dezembro (pagos em duplicidade, emendas sem marca).

**Contas:**
- Receita realizada = 621200000 menos as deduções 6213* (621310100 é a retenção do Fundeb). Mostrar o valor bruto e a dedução.
- Empenhada = 6221301 a 6221307.
- Liquidada = .03 + .04 + .07.
- Paga = 622130400.

**Dimensões:**
- `fonte_recursos`: o 1º dígito diz o exercício (1 corrente, 2 anteriores, 9 condicionado); os 3 dígitos seguintes são a fonte;
- `complemento_fonte` (CO);
- `funcao`;
- `natureza_receita`;
- `poder_orgao`: 10131 Executivo, 20231 Câmara.

**Robô:**
- Coleta sequencial, com repetição em caso de erro.
- Ano fechado guardado em `data/processado/origem.json` e reconsultado só se ainda não existir.
- Ano corrente: uma consulta por dia, do último mês.
- Falha: mantém o último dado e gera aviso. Nunca trava.

**Tabela de fontes:** `data/referencia/fontes-recursos.json`, a partir de `origem-fontes.json`. Traz o nome oficial de cada fonte e de cada CO e a URL da planilha oficial do Tesouro (Portaria STN 710/2021 e atualizações).

## Agrupamento para o cidadão (regras da pesquisa)

**De onde vem** (pela natureza da receita; o CO e as fontes 706/710 marcam as emendas antes):
- Impostos e taxas da cidade.
- Repasses da União.
- Repasses do Estado.
- Fundeb.
- Convênios e emendas parlamentares.
- Financiamentos.
- Outros.

**Para que serve** (pela faixa da fonte; o CO prevalece):
- Livre.
- Educação.
- Saúde.
- Assistência social.
- Convênios e emendas.
- Financiamentos.
- Outras vinculadas.

## Página `origem.html`

**Título:** "De onde vem e para onde vai o dinheiro de Salto: Radar Saltense". Descrição, caminho e JSON-LD (`Dataset` ou `WebPage`) próprios. Seletor de ano igual ao do Raio-X.

**Seções:**
1. **De onde vem.**
   - Total arrecadado no período, informando o último mês.
   - Barras pelos grupos de origem, com valor e percentual.
   - Nota da retenção do Fundeb (bruto, retenção e líquido), em uma frase simples.
2. **Dinheiro livre e dinheiro carimbado.**
   - Uma barra com as duas partes.
   - Explicação: o livre pode ir para qualquer área; o carimbado, só para a finalidade dele (saúde, educação, uma obra).
3. **Para onde foi cada fonte.**
   - Um cartão por grupo de destino: "Entraram R$ X. Foram gastos (liquidado) R$ Y, pagos R$ Z".
   - Barras por área (função), as 6 maiores e "outras".
   - **Pagamento por empresa não é ligado à fonte**, porque a base do TCE não informa. Dizer isso de forma clara e curta.
4. **Emendas parlamentares recebidas.**
   - Entradas marcadas como emenda (União e Estado), em R$.
   - O que já foi liquidado com elas e em quais áreas.
   - Link para a página de emendas da Câmara (as municipais), deixando claro que são outra coisa: as municipais são dos vereadores; estas vêm de deputados e senadores.
5. **Conferência com outras fontes.**
   - Uma linha comparando o total arrecadado e o total pago com o TCE-SP (os números que o impostômetro e o Raio-X já mostram) e a diferença explicada.
   - Em 2026, a MSC não marca o intraorçamentário, cerca de 1,5%.
   - Se a diferença passar de 3%, mostrar um aviso público e registrar manutenção, em vez de esconder.
6. **De onde vêm os números.** MSC/SICONFI com o link da consulta, a planilha oficial de fontes e a explicação dos termos (liquidado e pago).

**Ligações:**
- O impostômetro ganha "De onde vem o dinheiro (por fonte)" → `origem.html`.
- O Raio-X ganha "De onde veio o dinheiro gasto" → `origem.html#destino`.
- A página de fontes ganha a entrada nova.
- Sitemap via `pagina()`.
- Vistoria 0/0.
- Não entra na grade de 10 atalhos; entra só pelos links acima, pelo menu Impostos e pela página de fontes.

## Regras do projeto

- Só dado oficial, com fonte. Fato, nunca acusação.
- Linguagem simples: explicar "liquidado" (serviço entregue e conferido) e "pago".
- Sem CPF.
- Celular primeiro, sem rolagem lateral de 320 a 1440 px.
- `esc()` em tudo.
- Checagens só com node:assert em funções puras.

## Checagens (`check/origem.mjs`)

- Cálculo das contas: receita líquida, empenhada, liquidada e paga, com linhas de exemplo.
- Agrupamento de origem por prefixo da natureza, com a precedência de emenda.
- Destino por fonte, com a precedência do CO.
- Último mês: o mês vazio cai para o anterior.
- Conferência: aviso acima de 3%.
- Tabela de fontes: todo código usado nos dados de Salto tem nome.
