# Onda 1: menu novo, custo da Câmara, respostas a requerimentos e campanha 2024 — Design

Data: 2026-11-16 · Projeto: Radar Saltense (https://sandersono.github.io/radar-saltense/)
Pesquisas de origem: `.superpowers/pesquisa/camara-emendas-custos.md`, `respostas-pedidos.md`, `tse-doacoes-plano.md`.
Continuam valendo: só dado oficial com link para a fonte, fato e não acusação, nomes de pessoas físicas nunca aparecem (exceto os próprios vereadores e o prefeito), celular primeiro, simples.

## 1. Objetivo

Mostrar ao morador, sem complicar o portal:
- quanto custa a Câmara e quanto ganha cada vereador;
- se a Prefeitura respondeu os requerimentos de cada vereador;
- de onde veio o dinheiro da campanha de 2024 de cada vereador (e do prefeito, guardado para a onda 2).

## 2. Princípio para fontes novas

As fontes desta onda são secundárias. Se uma delas falhar no robô (página fora do ar, formulário mudou), o site **não para**: usa o último dado bom já salvo em `data/processado/` e registra um aviso no `conferencia.md` e na seção de avisos de `fontes.html`. Só a barreira de consistência (números que mudam de forma impossível) impede publicar.

## 3. Menu e organização

Menu: **Seu bairro · Câmara · Prefeitura · Impostos · Fontes**.
- "Câmara" → nova página `camara.html`.
- "Prefeitura" → `gastos.html` por enquanto (vira página-resumo com cartões na onda 2).
- "Impostos" → `impostometro.html`. "Fontes" → `fontes.html` (rótulo curto no menu; título da página continua).
- "Resumo da semana" entra no menu só na onda 3.
- A home continua igual (busca por bairro, vereadores, números, problema que não some).

`camara.html`:
1. Título "A Câmara de Salto" e uma frase.
2. Cartões de entrada: "Os 11 vereadores" (→ `index.html#vereadores`), "Votações" (→ `votacoes.html`).
3. Seção "Quanto custa a Câmara" (4.1).
4. Seção "Requerimentos respondidos" (5.2).
5. Seção "Campanha de 2024" com a tabela dos 11 (6.2).

Página do vereador ganha, depois de "Votações", três cartões curtos: "Salário", "Requerimentos respondidos", "Campanha de 2024".

## 4. Custo da Câmara

### 4.1 Fonte e regra
- Portal da Transparência da Câmara (Oracle APEX app 839), página `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=839:8` (Recursos Humanos), ano e mês, tipo "Geral", "Detalhar", exportação CSV. Coleta com Playwright (já usado no projeto), sem login.
- Colunas: `Matrícula;Nome;Local de Trabalho;Tipo de Folha;Unidade;Cargo;Regime;Admissão;Demissão;Evento;Salário Bruto;Descontos;Salário Líquido;Orgão;Indenizações;Ano`.
- Grupos por linha (pela coluna Cargo/Regime): **Vereadores** (Cargo "VEREADOR" ou "PRESIDENTE…", Regime "VEREADORES"), **Assessores dos vereadores** (Cargo "ASSESSOR PARLAMENTAR" ou "CHEFE DE GABINETE…"), **Servidores da Câmara** (o resto, incluindo inativos).
- Valor = Salário Bruto (custo para a Câmara, antes dos descontos). Indenizações somadas à parte, se houver.
- Guardado por mês, **só agregado**: total por grupo e quantidade de pessoas por grupo; e, para cada um dos 11 vereadores (casado pelo nome com a regra de nomes do projeto), o bruto do mês. Nenhum outro nome sai do coletor.
- Arquivo versionado `data/processado/folha-camara.json`: `{ "AAAA-MM": { grupos: { vereadores: {total, pessoas}, assessores: {...}, servidores: {...} }, porVereador: { <id>: bruto } } }`, de 2025-01 até o último mês publicado.
- Robô diário: baixa só os 2 últimos meses (o corrente pode não ter folha) e mantém os anteriores do arquivo. Uma ferramenta `node src/ferramentas/folha-camara.js --desde 2025-01` faz a carga inicial.

### 4.2 Telas
- `camara.html`, "Quanto custa a Câmara": folha do último mês (total bruto, em destaque), barra dos 3 grupos, linha "Salário de vereador: R$ 10.000 (presidente: R$ 12.500) por mês, antes dos descontos", total do ano corrente e do mandato, série mês a mês (barras, como no impostômetro). Nota: "Cada vereador tem 1 assessor parlamentar; o portal não diz qual assessor é de qual vereador." Link para a fonte.
- Vereador, cartão "Salário": bruto do último mês e soma desde jan/2025, link para a fonte.
- Diárias e viagens: só link para os PDFs oficiais (escaneados): `https://www.camarasalto.sp.gov.br/contas-publicas/category/619-despesas-viagens-vereadores-servidores`.

### 4.3 Barreira (acrescenta ao `conferir`)
- Mês com folha em que o grupo "vereadores" não tem 11 pessoas → aviso (não bloqueia; pode haver suplente ou licença).
- Total de um mês já salvo que cai mais de 20% → bloqueia, como nas despesas.

## 5. Respostas a requerimentos

### 5.1 Fonte e regra
- Página oficial de cada propositura (`f?p=742:78:::::P78_ID_PROJETO:<ID>`, já usada nos links do site). Em "Anexos", um anexo com `Tipo Documento: Resposta Requerimento` e `Data Documento: dd/mm/aaaa` = **respondido**, na data do anexo (a mais antiga, se houver mais de uma).
- Só **requerimentos** (as indicações não têm resposta registrada no portal; a página diz isso).
- Arquivo versionado `data/processado/respostas.json`: `{ <id>: { respondido: bool, data: "AAAA-MM-DD"|null, conferidoEm: "AAAA-MM-DD" } }`.
- Robô diário com **orçamento de 150 páginas** (≈6 min, 2 s entre páginas): primeiro os requerimentos nunca conferidos (mais novos primeiro), depois os sem resposta de até 180 dias conferidos há mais tempo. Respondido não é reconferido. Carga inicial pela ferramenta `node src/ferramentas/respostas.js` (sem limite, rodada à mão uma vez, ~1,5 h).
- Requerimento com vários autores conta para cada autor.

### 5.2 Telas
- `camara.html`: total de requerimentos desde 2025, % respondidos, tempo mediano até a resposta (dias), e a tabela por vereador (feitos, respondidos, %, mediana). Frase: "Resposta = documento 'Resposta Requerimento' anexado no portal da Câmara. Requerimentos ainda não conferidos pelo robô ficam de fora da conta." Mostra quantos ainda faltam conferir enquanto a carga não termina.
- Vereador, cartão "Requerimentos respondidos": "X de Y respondidos (Z%) · resposta leva em média N dias".
- Na lista de propostas do vereador, requerimento respondido ganha "respondido em dd/mm/aaaa".

## 6. Campanha de 2024

### 6.1 Fonte e regra
- TSE, dados abertos: `https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2024.zip`, só a entrada `receitas_candidatos_2024_SP.csv` (baixada com `Range` depois de ler o diretório do zip). CSV `;`, latin-1, decimal com vírgula.
- Filtro: `SG_UE = 70050` (Salto). Os 11 vereadores (casados por nome com a regra de nomes) e o prefeito eleito (`SQ_CANDIDATO = 250001985008`).
- Por candidato: total (`VR_RECEITA`), divisão por `DS_ORIGEM_RECEITA` em: Partido (inclui FEFC), Pessoas físicas (valor e **quantidade de doadores distintos**, nunca nomes nem CPF), Recursos próprios, Financiamento coletivo, Outros candidatos.
- Coleta única por ferramenta `node src/ferramentas/campanha-2024.js` → `data/referencia/campanha-2024.json` (versionado). O robô diário não baixa nada do TSE.
- Link oficial por candidato: página do candidato no DivulgaCandContas (`https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/2045202024/<SQ_CANDIDATO>/2024/70050`).
- Totais de referência para a conferência: prefeito R$ 515.650,04; Henrique R$ 79.200,00; Graziela R$ 61.151,00; os 11 somam R$ 258.517,18.

### 6.2 Telas
- Vereador, cartão "Campanha de 2024": total arrecadado, barra por origem, "N pessoas doaram", link "ver doadores no TSE".
- `camara.html`: tabela dos 11 (total e a maior origem), ordenada por total. Nota: "Desde 2015 empresas não podem doar. Os nomes dos doadores estão no site do TSE."
- O dado do prefeito fica no JSON para a onda 2.

## 7. Arquivos

- Novos: `src/coleta/folha-camara.js`, `src/coleta/respostas.js`, `src/ferramentas/folha-camara.js`, `src/ferramentas/respostas.js`, `src/ferramentas/campanha-2024.js`, `src/regras/folha.js`, `src/regras/respostas.js`, `src/regras/campanha.js`, `src/site/camara.js`.
- Alterados: `src/coletar.js`, `src/processar.js`, `src/conferir.js`, `src/relatorio.js`, `src/gerar-site.js`, `src/site/base.js` (menu), `src/site/vereador.js`, `src/site/fontes.js`, `site/estilo.css`, `check/regras.mjs`.

## 8. Checagens (`check/regras.mjs`, só node:assert)

- `grupoFolha(linha)` com linhas de vereador, presidente, assessor, chefe de gabinete, servidor e inativo; `resumirFolha(csv, vereadores)` com um CSV curto montado à mão (agregados certos, nenhum nome além dos vereadores no resultado).
- `lerRespostas(textoDaPagina)` com o texto de uma página com resposta (data certa), sem resposta e com duas respostas; `filaRespostas(estado, requerimentos, hoje, 150)` na ordem da regra 5.1; `resumoRespostas` (%, mediana).
- `resumirCampanha(linhas)` com linhas montadas à mão das 5 origens e doadores repetidos (quantidade distinta certa).
- `conferir` com as regras de 4.3.

## 9. Fora do escopo

Diárias detalhadas (PDF escaneado), despesa total da Câmara pelo portal (formulário não funcionou na pesquisa), qual assessor é de qual vereador, respostas a indicações, texto das respostas (só PDF), nomes de doadores, cruzamento doador x fornecedor.
