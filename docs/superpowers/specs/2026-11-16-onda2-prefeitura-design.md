# Onda 2: página da Prefeitura (nota do TCE, obras, compras e campanha do prefeito) — Design

Data: 2026-11-16 · Projeto: Radar Saltense (https://sandersono.github.io/radar-saltense/)
Pesquisa de origem: `.superpowers/pesquisa/tce-obras-iegm-pncp.md`. Mesmos princípios da onda 1: só dado oficial com link, fato e não acusação, nada de nome de pessoa física (exceto vereadores e prefeito), celular primeiro, simples. Fonte nova que falhar não para o robô: mantém o último dado salvo em `data/processado/` e avisa.

## 1. Objetivo

Uma página `prefeitura.html` (o item "Prefeitura" do menu passa a levar para ela) que mostra, em poucas seções curtas:
1. a nota que o Tribunal de Contas dá à gestão da Prefeitura (IEGM), ano a ano e comparada com cidades vizinhas;
2. as obras que a Prefeitura cadastrou no painel do TCE-SP e a situação de cada uma;
3. como a Prefeitura compra (contratações por modalidade, com destaque para as feitas sem disputa) e as empresas com mais valor contratado;
4. de onde veio o dinheiro da campanha de 2024 do prefeito (dado já coletado na onda 1);
5. atalhos para o Raio-X dos gastos e o Impostômetro.

O parecer do TCE sobre as contas anuais fica de fora (só há dado aberto até 2017, antes do mandato).

## 2. Página `prefeitura.html`

Topo: título "A Prefeitura de Salto" e uma frase. Logo abaixo, cartões-atalho (âncoras) para as seções e para `gastos.html` e `impostometro.html`, no padrão `cartaoNumero` (um número e um rótulo cada): nota IEGM mais recente, obras cadastradas (e quantas paralisadas), contratações no ano, total pago (Raio-X).

### 2.1 Nota da gestão (IEGM)
- Fonte: painel IEGM do TCE-SP (`https://iegm.tce.sp.gov.br/`), consulta pública `faixaTodosMunicipiosPeriodo` (Pentaho CDA) por ano-base, mais `exercicioDS` para a lista de anos. Campos: `iegm, iplanejamento, ifiscal, ieduc, isaude, iamb, icidade, igov`, em faixas A, B+, B, C+, C.
- Significado das faixas (texto oficial do TCE): A "Altamente efetiva", B+ "Muito efetiva", B "Efetiva", C+ "Em fase de adequação", C "Baixo nível de adequação".
- Municípios: Salto e, para comparar, Itu, Indaiatuba, Itupeva, Cabreúva e Sorocaba, casados pelo **nome** normalizado exato (não confundir com Salto de Pirapora ou Salto Grande).
- Tela: a faixa geral mais recente em destaque com o significado ("2024: C, baixo nível de adequação"), a linha do tempo de Salto (2015 em diante, uma faixa por ano), as 7 dimensões do último ano, e a tabela de comparação do último ano (Salto em primeiro). Nota: "O ano-base 2024 é o IEG-M divulgado em 2025. A nota mede a gestão em cada área a partir de questionários e dados enviados ao TCE."
- Dados: `data/processado/iegm.json` `{ anos: { "AAAA": { "<municipio>": {iegm, plan, fisc, educ, saude, amb, cidade, gov} } } }`. Carga inicial por ferramenta (todos os anos); robô diário rebaixa só a lista de anos e o ano mais novo.

### 2.2 Obras no painel do TCE-SP
- Fonte: Painel de Obras do TCE-SP, consulta pública `obrasTabela` (Pentaho CDA) com o município 3545209 e o período mais recente da lista `selPeriodo`. Campos: `ds_situacao, vl_ajuste, nome (contratado), doc (CNPJ), ds_entidade (contratante), ano_ajuste, objeto_ajuste`.
- Tela: data-base do painel, lista das obras (objeto, contratante, empresa contratada com CNPJ, valor, ano, situação) com as paralisadas primeiro; total em valor. Nota: "Só aparecem obras que o órgão cadastrou no sistema do TCE. O painel não informa datas nem o quanto já foi feito." Link para o painel.
- Contratado pessoa física (CPF em `doc`) → mostra "pessoa física" sem nome.
- Dados: `data/processado/obras.json` `{ dataBase, obras: [...] }`, rebaixado todo dia (uma requisição).

### 2.3 Como a Prefeitura compra (PNCP)
- Fonte: API pública do PNCP (`https://pncp.gov.br/api/consulta/v1/`), órgão CNPJ 46634507000106.
- Contratações (`/contratacoes/publicacao`) do ano anterior e do ano corrente, por modalidade (a API exige a modalidade; percorrer as modalidades conhecidas e paginar até `paginasRestantes = 0`; resposta 204 = nada).
- Contratos (`/contratos`) dos mesmos anos, para o ranking de fornecedores por valor (`valorGlobal`) e a contagem.
- Por ano: quantidade e valor (homologado; se vazio, estimado) por modalidade; parte "sem disputa" (dispensa + inexigibilidade) em quantidade e valor; as 10 empresas com mais valor contratado (só CNPJ; fornecedor com CPF entra só no total); total de contratos.
- Tela: barras por modalidade (quantidade e valor), a frase de fato "Em 2026, X% das contratações (Y% do valor) foram por dispensa ou inexigibilidade, sem disputa entre empresas." com a explicação: "A lei permite comprar sem licitação em casos como valor baixo, emergência ou fornecedor único. Isto é um fato, não uma acusação." Lista das 10 empresas com link do PNCP do contrato ou da empresa. Aditivos e número de concorrentes ficam de fora (a API não dá isso com segurança).
- Dados: `data/processado/contratos.json` agregado por ano (sem nomes de pessoas). Robô diário rebaixa o ano corrente; o ano anterior só se ainda não estiver salvo ou uma vez por mês.

### 2.4 Campanha do prefeito
- Dado de `data/referencia/campanha-2024.json` (`candidatos.prefeito`). Mesmo cartão da página do vereador: total, barra por origem, "N pessoas doaram", link do TSE.

## 3. Barreira e avisos

Nenhuma das fontes desta onda bloqueia a publicação. Falha de coleta → aviso e último dado salvo. Avisos extras: obras com data-base mais velha que a salva; IEGM sem Salto no ano mais novo; contratos do ano corrente que diminuem em relação ao salvo (o PNCP não deveria perder registros).

## 4. Arquivos

- Novos: `src/regras/iegm.js`, `src/regras/obras.js`, `src/regras/contratos.js`, `src/coleta/iegm.js`, `src/coleta/obras.js`, `src/coleta/contratos.js`, `src/coleta/pentaho.js` (sessão anônima e consulta CDA, compartilhado por IEGM e obras), ferramentas de carga inicial, `check/iegm.mjs`, `check/obras.mjs`, `check/contratos.mjs`, `src/site/prefeitura.js`.
- Alterados: `package.json` (checar), `src/coletar.js`, `src/atualizar.js`, `src/processar.js`, `src/relatorio.js`, `src/gerar-site.js`, `src/site/base.js` (menu), `src/site/fontes.js`, `site/estilo.css`.

## 5. Checagens (node:assert)

- IEGM: resumo de linhas montadas à mão (casamento exato por nome; Salto de Pirapora não casa; anos ordenados; significado das faixas).
- Obras: normalização das linhas (valor, situação, PF sem nome, paralisadas primeiro).
- Contratos: agregação por modalidade, parte sem disputa, ranking só com CNPJ, valor homologado com recaída no estimado.

## 6. Fora do escopo

Parecer das contas anuais (sem dado aberto depois de 2017), aditivos de contrato, número de participantes por licitação, datas e percentual executado das obras, promessas do prefeito (onda 3).
