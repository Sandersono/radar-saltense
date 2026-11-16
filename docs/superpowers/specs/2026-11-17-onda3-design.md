# Onda 3: emendas dos vereadores, promessas do prefeito e resumo da semana — Design

Data: 2026-11-17 · Projeto: Radar Saltense (https://radarsaltense.com.br)
Pesquisas de origem: `.superpowers/pesquisa/camara-emendas-custos.md` (seção 1) e `tse-doacoes-plano.md` (seção 3). Mesmos princípios das ondas 1 e 2: só dado oficial com link, fato e não acusação, nada de nome de pessoa física fora vereadores e prefeito, nada de CPF, celular primeiro, simples. Fonte que falhar não para o robô.

## 1. Emendas impositivas (para onde cada vereador mandou dinheiro)

### 1.1 Fonte
- Site da Câmara, "Orçamento Público > Emendas Impositivas" (`https://www.camarasalto.sp.gov.br/orcamento-publico/emendas-impositivas`), PDFs com texto.
- **2025 (execução):** relatórios trimestrais da Lei 4.124/2024; o do 4º trimestre traz cada emenda com secretaria, valor, empenhado, liquidado, pago, objeto (entidade beneficiada + iniciais do vereador no fim) e situação (CONCLUÍDA, EM EXECUÇÃO, INICIADA, NÃO EXECUTADA, DEVOLVIDA). O 1º trimestre traz o nome completo do vereador, o que permite conferir as iniciais.
- **2026 (planejado):** PDF consolidado "Emenda impositiva - tabela" (mais recente da categoria 2026), um bloco por vereador com secretaria, entidade, projeto e valor; sem execução. As "Alterações" de 2026 são escaneadas e ficam só como link.
- Sem CNPJ: não há cruzamento com pagamentos.

### 1.2 Regra
- Uma **ferramenta** (`node src/ferramentas/emendas.js`), rodada à mão quando a Câmara publica um PDF novo, lê os PDFs por posição de texto (pdfjs, já usado no projeto) e grava `data/referencia/emendas.json`: `{ "2025": { fonte, atualizadoEm, emendas: [{ vereador, entidade, objeto, secretaria, valor, pago, situacao }] }, "2026": { fonte, emendas: [{ vereador, entidade, projeto, secretaria, valor }] } }`.
- Iniciais → vereador: tabela conferida (iniciais de 2025 contra o nome completo do 1º trimestre); se houver iniciais ambíguas ou não casadas, a ferramenta para e lista os casos para conferência manual (registrada no código, como as grafias de nomes).
- O robô diário não lê PDFs de emendas (formatos mudam); só confere se a categoria da Câmara ganhou arquivo novo e, nesse caso, gera um aviso no `conferencia.md` ("há PDF novo de emendas; rodar a ferramenta").

### 1.3 Telas
- **Página do vereador**, cartão "Emendas ao orçamento": total por ano e lista curta (entidade, valor, situação em 2025; entidade e valor planejado em 2026), com link do PDF oficial.
- **`camara.html`**, seção "Emendas ao orçamento": cada vereador indica R$ 278.153,30 por ano (metade para a saúde); tabela por vereador com quanto já foi pago em 2025 e quantas emendas estão concluídas, em execução, não executadas ou devolvidas. Frase de fato: "Emenda não executada ou devolvida pode ter motivo técnico ou legal; isto é um fato, não uma acusação."

## 2. Promessas do prefeito (plano de governo 2025–2028)

### 2.1 Fonte e regra
- Plano de governo registrado no TSE (PDF do prefeito José Geraldo Garcia, 14 páginas, 165 itens numerados em 16 áreas), obtido do zip de dados abertos do TSE por `Range` (mesma técnica da campanha).
- Ferramenta `node src/ferramentas/promessas.js` extrai os itens e grava `data/referencia/promessas.json`: `{ fonte, areas: [{ area, itens: [{ numero, texto, status, provas: [] }] }] }`. A extração perde espaços e tem falhas de numeração: o texto de cada item é revisado (o agente corrige espaços e numeração à mão, item por item, sem mudar o sentido) antes de gravar.
- **Status manual:** `sem informação` (padrão), `em andamento`, `cumprida`. Só muda com pelo menos um link de prova oficial (decreto, notícia oficial da Prefeitura, painel do TCE, licitação). O arquivo é editado à mão pelo dono do site (ou voluntários); o robô só lê.
- Itens genéricos ("incentivar", "aprimorar") ficam como estão; a página não julga.

### 2.2 Tela
- Nova página `promessas.html`, com cartão de entrada na página da Prefeitura: contagem por status (barra), lista por área (acordeões), cada item com o texto e, se houver, o status e os links de prova. Frase: "Plano registrado no TSE em 2024. O status é atualizado à mão, sempre com prova oficial; 'sem informação' quer dizer que ainda não achamos prova, não que a promessa foi esquecida."
- Link para o PDF oficial do plano.

## 3. Resumo da semana

### 3.1 Regra
- O robô gera todo dia, a partir dos dados que já tem, um resumo dos **últimos 7 dias** (fuso de São Paulo):
  - proposituras novas: total, por vereador, os 3 bairros mais citados;
  - votações da semana (resultado e quem votou contra);
  - requerimentos que receberam resposta na semana;
  - dados oficiais novos: mês de receitas/despesas publicado pelo TCE, folha nova da Câmara, mudança de situação de obra, nota nova do IEGM.
- Seção sem novidade não aparece. Se a semana inteira não tiver novidade, a página diz isso.
- Não precisa de histórico: o resumo é recalculado todo dia.

### 3.2 Telas e compartilhamento
- Nova página `semana.html` ("Resumo da semana") e item no menu (o menu passa a ser: Seu bairro · Câmara · Prefeitura · Impostos · Resumo da semana · Fontes).
- Botão "Compartilhar no WhatsApp" (`https://wa.me/?text=` com 3–4 linhas do resumo e o link da página), sem conta nem serviço externo.
- Feed RSS `feed.xml` com um item por semana (identificado pelo início da semana); leitores de RSS mostram o resumo novo toda segunda-feira.

## 4. Arquivos (previsão)

- Novos: `src/regras/emendas.js`, `src/ferramentas/emendas.js`, `src/regras/promessas.js`, `src/ferramentas/promessas.js`, `src/regras/semana.js`, `src/site/promessas.js`, `src/site/semana.js`, `src/site/feed.js`, `check/emendas.mjs`, `check/promessas.mjs`, `check/semana.mjs`, `data/referencia/emendas.json`, `data/referencia/promessas.json`.
- Alterados: `package.json` (checar), `src/coletar.js` (aviso de PDF novo de emendas), `src/processar.js`, `src/gerar-site.js`, `src/site/base.js` (menu), `src/site/vereador.js`, `src/site/camara.js`, `src/site/prefeitura.js`, `src/site/fontes.js`, `site/estilo.css`.

## 5. Checagens (node:assert)

- Emendas: leitura de linhas montadas à mão dos dois layouts; casamento de iniciais (inclusive ambíguas → erro); somas por vereador e por situação.
- Promessas: status válidos; item com status diferente de "sem informação" sem prova → erro; contagens.
- Semana: janela de 7 dias no fuso de SP; seções vazias somem; texto do WhatsApp com no máximo 4 linhas e o link.

## 6. Fora do escopo

Cruzamento de emendas com pagamentos (sem CNPJ), leitura das "Alterações" escaneadas, envio de e-mail ou mensagem automática (o compartilhamento é manual pelo botão), julgamento automático de promessas.
