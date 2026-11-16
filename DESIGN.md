---
name: Radar Saltense
description: Site cívico de Salto/SP que mostra o trabalho dos vereadores, o impostômetro e os gastos da cidade, só com dados oficiais.
colors:
  rio-escuro: "#0B2545"
  ambar: "#FFC20E"
  rio: "#0E6BA8"
  rio-claro: "#E6F2FA"
  areia: "#FFF7EA"
  areia-escura: "#F6E7CC"
  branco: "#FFFFFF"
  linha: "#E8DCC6"
  suave: "#5B6472"
  ambar-escuro: "#7A4A00"
  falta: "#B3261E"
  presente: "#1E7A46"
typography:
  display:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 6vw, 2.6rem)"
    fontWeight: 800
    lineHeight: 1.2
  headline:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "clamp(1.35rem, 4.5vw, 1.8rem)"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 800
    lineHeight: 1.2
  number:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 6vw, 2rem)"
    fontWeight: 800
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
  note:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
rounded:
  marca: "2px"
  foco: "6px"
  caixa: "14px"
  cartao: "18px"
  contador: "22px"
  pilula: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  base: "1rem"
  lg: "1.25rem"
  secao: "2.25rem"
  rodape: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.ambar}"
    textColor: "{colors.rio-escuro}"
    typography: "{typography.title}"
    rounded: "{rounded.pilula}"
    padding: "0.6rem 1.4rem"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#E6AE00"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.rio}"
    typography: "{typography.label}"
    rounded: "{rounded.pilula}"
    padding: "0.5rem 1.2rem"
    height: "44px"
  chip:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.rio-escuro}"
    typography: "{typography.label}"
    rounded: "{rounded.pilula}"
    padding: "0.45rem 1rem"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.rio}"
    textColor: "{colors.branco}"
  card:
    backgroundColor: "{colors.branco}"
    rounded: "{rounded.cartao}"
    padding: "1rem 1.1rem"
  card-list:
    backgroundColor: "{colors.branco}"
    rounded: "{rounded.cartao}"
    padding: "0.35rem 1.1rem"
  counter:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.rio}"
    typography: "{typography.number}"
    rounded: "{rounded.contador}"
    padding: "1.1rem"
  input-search:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.rio-escuro}"
    typography: "{typography.body}"
    rounded: "{rounded.pilula}"
    padding: "0.7rem 1.2rem"
    height: "52px"
  select:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.rio-escuro}"
    rounded: "{rounded.pilula}"
    padding: "0.5rem 1rem"
    height: "46px"
  source-badge:
    backgroundColor: "{colors.rio-claro}"
    textColor: "{colors.rio}"
    rounded: "{rounded.pilula}"
    padding: "0.15rem 0.65rem"
  tag:
    backgroundColor: "{colors.rio-claro}"
    textColor: "{colors.rio-escuro}"
    rounded: "{rounded.pilula}"
    padding: "0.12rem 0.55rem"
  notice:
    backgroundColor: "{colors.areia-escura}"
    textColor: "{colors.rio-escuro}"
    rounded: "{rounded.caixa}"
    padding: "0.7rem 0.9rem"
---

# Design System: Radar Saltense

## Overview

**Creative North Star: "Salto Vivo, o vizinho que mostra a fonte"**

O Radar Saltense é um painel cívico que fala como gente da cidade. A identidade nasce do logo oficial: azul-marinho profundo e amarelo vivo, assentados sobre um fundo cor de areia que tira a frieza de "portal de dados". Tudo é arredondado e macio (pílulas, cartões de canto generoso, uma onda separando o cabeçalho do conteúdo), para que números de Câmara e de orçamento pareçam conversa de vizinho, e não planilha de prefeitura.

A densidade é baixa e o ritmo é vertical: uma coluna de leitura no celular, que só se abre em grade de dois a quatro itens a partir de 768 px. Cada número grande vem acompanhado de um rótulo curto e de um caminho até a fonte oficial (o selo de fonte azul-claro). Cor carrega significado: azul é informação e ação, amarelo é marca e chamada principal, verde e vermelho aparecem só como registro factual de presença e falta, nunca como alarme.

O sistema rejeita, de forma confirmada no produto, o portal burocrático (tabelas cruas, menus sem fim), o painel corporativo frio de BI e o visual sensacionalista de denúncia.

**Key Characteristics:**
- Cabeçalho em três camadas: faixa branca com o logo, régua amarela de 4 px, bloco azul-marinho com uma onda cor de areia na base.
- Fundo areia quente; superfícies brancas com borda bege e sombra quase imperceptível.
- Pílulas para tudo que se toca (botões, chips, busca, selos, etiquetas).
- Números grandes em Nunito 800 azul, com algarismos tabulares.
- Alvos de toque de 44 px ou mais; foco visível em anel duplo azul-marinho e amarelo.

## Colors

Uma paleta de marca de dois polos (marinho e amarelo do logo), um azul de ação e neutros quentes de papel e areia.

### Primary
- **Marinho do Logo** (rio-escuro): a cor do texto corrido, dos títulos, do fundo do cabeçalho e do rodapé, e do anel de foco. É a voz principal do site.
- **Amarelo Salto** (ambar): a régua sob a faixa do logo, o botão principal, a borda do contador de impostos, o link do rodapé e o halo externo do foco. Aparece pouco e sempre como marca ou chamada.

### Secondary
- **Azul Rio** (rio): links, números grandes, chips selecionados, contorno da busca e do botão secundário, barras de dados. É a cor da informação e da ação secundária.
- **Névoa do Rio** (rio-claro): fundo do selo de fonte, das etiquetas de tema e do trilho das barras. No CSS é a variável `--rio-claro`.

### Tertiary
- **Verde Presença** (presente): presença em sessão (bolinhas, barra de presença) e a fatia "lei" no gráfico de proporção.
- **Vermelho Falta** (falta): ausência em sessão (bolinha quadrada, marca "A"). Uso estritamente factual.
- **Âmbar Queimado** (ambar-escuro): ausência justificada e a etiqueta de ausentes; o tom escuro do amarelo que garante contraste sobre fundo claro.

### Neutral
- **Areia** (areia): fundo da página e cor da onda do cabeçalho.
- **Areia Escura** (areia-escura): fundo dos avisos.
- **Branco** (branco): superfície dos cartões, campos e chips; faixa do logo.
- **Linha Bege** (linha): bordas de cartão, divisórias de lista e tabela, chips em repouso, fundo vazio da barra de proporção.
- **Cinza Ardósia** (suave): notas, datas, rótulos de número, partidos, numeração de listas.

### Named Rules
**The Dois Polos Rule.** Marinho e amarelo são as cores da marca e vêm do logo oficial; nenhuma outra cor disputa esse papel. O amarelo nunca é usado como cor de texto sobre fundo claro (para isso existe o âmbar queimado).

**The Fato Não Alarme Rule.** Verde e vermelho só marcam presença e falta, e a etiqueta "contra" numa votação. Vermelho não vira fundo, faixa, título ou destaque de página.

## Typography

**Display Font:** Nunito 800 (com system-ui, sans-serif), auto-hospedada.
**Body Font:** Inter 400 e 600 (com system-ui, -apple-system, Segoe UI, Roboto, sans-serif), auto-hospedada.

**Character:** Nunito de terminais arredondados dá aos títulos e números o mesmo tom amigável das formas do site; Inter segura o texto corrido com clareza neutra. Só três arquivos de fonte: Nunito 800, Inter 400, Inter 600.

### Hierarchy
- **Display** (Nunito 800, clamp de 1,8 a 2,6 rem, 1,2): o h1 de cada página; branco dentro do bloco marinho da home, marinho no corpo das demais páginas.
- **Headline** (Nunito 800, clamp de 1,35 a 1,8 rem, 1,2): títulos de seção (h2).
- **Title** (Nunito 800, 1,15 rem, 1,2): h3, título de votação, nome do vereador no cartão, título das chamadas.
- **Number** (Nunito 800, clamp de 1,5 a 2 rem, algarismos tabulares, azul rio): os números grandes dos cartões de número; o contador de impostos sobe até 2,4 rem (3 rem na página própria).
- **Body** (Inter 400, 1 rem, 1,6): texto corrido, listas, tabelas.
- **Label** (Inter 600, 0,9 a 0,95 rem): chips, botão secundário, menu, resumo de "ver mais", rótulos fortes.
- **Note** (Inter 400, 0,85 a 0,9 rem, cinza ardósia): notas de rodapé de seção, datas, partidos, rótulos de número.

### Named Rules
**The Número Tabular Rule.** Todo número que se compara (valores, contagens, datas, marcadores de lista numerada, células de tabela) usa algarismos tabulares.

**The Nada Miúdo Rule.** O texto de leitura não desce abaixo de 0,85 rem; etiquetas e selos em pílula ficam em 0,78 a 0,8 rem e sempre em peso 600 ou com fundo próprio.

## Layout

Coluna única, celular primeiro. O conteúdo vive num contêiner de no máximo 1040 px, centralizado, com respiro lateral de 1 rem (o mesmo no cabeçalho, no bloco marinho, no conteúdo e no rodapé). Tudo precisa caber em 320 px: textos longos quebram em qualquer ponto e grades usam colunas `minmax(0, 1fr)` para nunca estourar.

Ritmo vertical: seções separadas por 2,25 rem; dentro delas, passos de 0,25 / 0,5 / 0,75 / 1 rem. O rodapé abre com 3 rem de distância.

Quebras de tela:
- **Abaixo de 768 px:** com JavaScript, o menu vira lista recolhida atrás de um botão "Menu"; cada link ganha divisória e área de toque alta. Sem JavaScript, o menu aparece aberto e em linha.
- **A partir de 768 px:** logo sobe de 48 para 56 px de altura; cartões de número em 4 colunas (2 no celular); cartões de vereador em 2 colunas; chamadas em 2 colunas; filtros em 2/1; linhas de barra em três colunas (rótulo de 11 rem, trilho, valor de 11 rem alinhado à direita).
- **A partir de 1024 px:** cartões de vereador em 3 colunas.

### Named Rules
**The Respiro É do Cartão Rule.** O espaço interno de um cartão vem só do seu padding. A margem de cima do primeiro filho e a de baixo do último filho são zeradas, para não somar respiro duplo.

**The Lista que É Cartão Rule.** Quando uma lista é ela mesma o cartão, ela recupera o padding lateral do cartão (0,35 rem em cima e embaixo, 1,1 rem nos lados), e a lista numerada recua 2,9 rem para que os marcadores de dois dígitos (10 ou mais itens) fiquem dentro da borda. Listas numeradas fora de cartão recuam 2,2 rem.

## Elevation & Depth

O sistema é quase plano. A profundidade vem do contraste entre a superfície branca e o fundo areia, reforçado por uma borda bege de 1 px. Há uma única sombra, ambiente e muito leve, aplicada a cartões e ao contador de impostos; ela não muda no hover.

### Shadow Vocabulary
- **Sombra ambiente** (`box-shadow: 0 2px 8px rgb(11 37 69 / 6%)`): cartões e contador de impostos. Marinho a 6%, nunca preto.

### Named Rules
**The Papel Sobre Areia Rule.** Elevação é branco sobre areia com borda bege. Não se empilham sombras nem se aumenta a sombra para dar destaque; destaque se faz com a borda amarela (contador) ou com a cor do número.

## Shapes

Tudo que é tocável é pílula (999 px): botões, chips, campo de busca, select, selos de fonte, etiquetas, barras e trilhos. Contêineres usam cantos generosos: cartão em 18 px, contador de impostos em 22 px, aviso e caixa "ver mais" em 14 px. O foco e o link do logo usam 6 px. Fotos de vereador são círculos.

A forma também carrega significado no registro de presença: presença é um círculo verde cheio, ausência justificada é um círculo branco com aro âmbar queimado de 3 px, falta é um quadrado vermelho de canto 2 px, sessão sem registro é um círculo cinza. A diferença de forma garante leitura sem depender só da cor.

A assinatura do cabeçalho é a onda: um SVG de 36 px de altura, preenchido com a cor areia, que encerra o bloco marinho e se funde com o fundo da página.

## Components

### Buttons
Cheios, amigáveis e grandes o bastante para o polegar.
- **Shape:** pílula (999 px).
- **Primary:** fundo amarelo Salto, texto marinho em Nunito 800, altura mínima de 48 px, padding de 0,6 por 1,4 rem. Usado para a chamada principal de um bloco (como "De onde vem o dinheiro de Salto" no contador).
- **Hover:** o fundo escurece para um amarelo mais fechado (`--ambar-hover`, `#E6AE00`), sem sair da paleta.
- **Focus:** anel marinho de 3 px com halo amarelo de 5 px (global).
- **Secondary:** contorno azul rio de 2 px, texto azul rio em Inter 600 0,95 rem, fundo transparente, altura mínima de 44 px. Usado para "ver mais".

### Chips
- **Style:** fundo branco, borda bege de 1 px, texto marinho em Inter 600 0,9 rem, altura mínima de 44 px.
- **State:** no hover a borda fica azul rio; selecionado (`aria-pressed="true"`) vira azul rio cheio com texto branco. Usados para sugestões de busca, ordenação e escolha de ano; os grupos de chips somem quando não há JavaScript.

### Cards / Containers
- **Corner Style:** 18 px.
- **Background:** branco sobre a areia da página.
- **Shadow Strategy:** sombra ambiente única (ver Elevation & Depth).
- **Border:** 1 px bege (linha); cartões que são links ficam com borda azul rio no hover.
- **Internal Padding:** 1 rem em cima e embaixo, 1,1 rem nos lados; margens externas do primeiro e do último filho zeradas.
- **Variantes:** cartão de número (número grande azul + rótulo cinza, empilhados), cartão de vereador (foto circular, nome em Nunito, barra de presença verde de 8 px, lista de dados em duas colunas com valores à direita), chamada (título azul em Nunito + texto), seção-cartão (a maioria das seções de Gastos, Impostômetro, Fontes e perfil).

### Lists
- **Style:** sem marcadores; cada item com 0,7 rem de padding vertical e divisória bege embaixo, exceto o último.
- **Numeradas:** marcador decimal em algarismos tabulares e cinza ardósia; recuo de 2,2 rem (2,9 rem quando a lista é o cartão).
- **Ver mais dentro de item:** o `details` perde a caixa (sem fundo, borda ou padding) e o resumo vira um link azul de 0,92 rem, para não criar caixa dentro de cartão.
- **Contagens:** número alinhado à direita em cinza tabular.

### Inputs / Fields
- **Busca:** pílula branca com contorno azul rio de 2 px, altura mínima de 52 px (46 px na versão pequena), texto Inter 1,05 rem.
- **Select:** pílula branca com contorno bege de 2 px, altura mínima de 46 px.
- **Focus:** o anel global marinho e amarelo.

### Navigation
- **Cabeçalho:** faixa branca com o logo (48 px de altura, 56 px a partir de 768 px) e o menu; régua amarela de 4 px; bloco marinho; onda areia.
- **Menu:** links marinhos em Inter 600, sem sublinhado, sublinhados no hover; em linha e com quebra no desktop.
- **Celular:** botão "Menu" em pílula com contorno marinho de 2 px, altura mínima de 44 px, que expande uma lista vertical com divisórias.
- **Bloco marinho (só na home):** h1 branco, parágrafos em azul muito claro (`#E3F1FB`) a 1,05 rem, data de atualização a 0,88 rem. O foco dentro dele é um contorno branco sem halo.
- **Rodapé:** marinho, texto em azul acinzentado claro, links amarelos, nome do site em Nunito 800 branco; foco amarelo sem halo.
- **Pular para o conteúdo:** pílula amarela que aparece no foco.

### Contador de impostos (componente de assinatura)
Cartão branco com borda amarela de 3 px e cantos de 22 px, centralizado: rótulo cinza em Inter 600, valor grande em Nunito 800 azul tabular (clamp até 2,4 rem; até 3 rem na versão grande), linha "por morador" e o botão principal amarelo. É o único contêiner com borda amarela.

### Barras e proporções
- **Barras de valor:** trilho névoa do rio de 12 px em pílula com preenchimento azul rio; o ano anterior em azul claro (`#9CC7E6`). Valores em marinho 600 tabular. Barra vazia mostra um texto pequeno "sem dado".
- **Barra de proporção:** faixa de 18 px em pílula dividida em fatias (azul rio, azul céu, amarelo, verde, cinza), sempre com legenda de pontos coloridos, números e porcentagem, e um rótulo acessível com os valores.

### Selos, etiquetas e avisos
- **Selo de fonte:** pílula névoa do rio, texto azul rio 600 a 0,8 rem; acompanha todo número que leva à fonte oficial.
- **Etiqueta de tema:** pílula névoa do rio, texto marinho 0,78 rem.
- **Etiqueta de votação:** pílula rosada com texto vinho para "contra", pílula creme com texto âmbar queimado para "ausentes".
- **Aviso:** caixa areia escura de 14 px, texto 0,95 rem, com um marcador circular marinho à esquerda.

## Do's and Don'ts

### Do:
- **Do** manter marinho (#0B2545) e amarelo (#FFC20E) como as únicas cores de marca, vindas do logo oficial.
- **Do** colocar todo número relevante num cartão branco sobre areia, em Nunito 800 azul com algarismos tabulares, e ligá-lo à fonte oficial com o selo de fonte.
- **Do** usar pílula (999 px) em todo controle tocável, com altura mínima de 44 px (48 px no botão principal, 52 px na busca).
- **Do** deixar o respiro do cartão vir só do padding: zere a margem do primeiro e do último filho.
- **Do** devolver o padding lateral quando a lista é o próprio cartão, e recuar listas numeradas o bastante para marcadores de dois dígitos (2,2 rem; 2,9 rem dentro de cartão).
- **Do** diferenciar presença, ausência justificada e falta por forma e cor juntas, sempre com legenda.
- **Do** manter o anel de foco marinho de 3 px com halo amarelo; em fundo marinho, contorno branco ou amarelo sem halo.
- **Do** garantir que tudo funcione sem JavaScript: menu aberto, chips de filtro escondidos, conteúdo completo no HTML.

### Don't:
- **Don't** usar vermelho fora do registro de falta e da etiqueta "contra": nada de faixa, fundo ou título vermelho de alerta.
- **Don't** usar o amarelo como cor de texto sobre fundo claro; use âmbar queimado (#7A4A00).
- **Don't** colocar uma caixa dentro de um cartão: "ver mais" dentro de lista perde fundo e borda.
- **Don't** criar novas sombras ou sombras mais fortes; a profundidade é branco sobre areia com borda bege.
- **Don't** usar texto de leitura menor que 0,85 rem nem cinza mais claro que o cinza ardósia.
- **Don't** usar cantos retos em controles ou cartões; o canto reto é reservado à marca de falta.
