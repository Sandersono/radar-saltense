# Visual "Salto vivo" — Design

Data: 2026-11-15 · Projeto: Radar Saltense (https://sandersono.github.io/radar-saltense/)
Depende de `2026-11-14-radar-saltense-design.md` e `2026-11-14-impostometro-design.md`. Nenhuma regra de dados muda: os números, as fontes, a barreira e o robô continuam como estão. Esta reformulação mexe só no visual e na organização das páginas.

## 1. Objetivo

Deixar o site atraente e próximo do morador de Salto antes da divulgação, mantendo a credibilidade. Os números e as fontes oficiais ficam sempre visíveis. A direção escolhida pelo usuário é a "C · Salto vivo": cores do rio e da cidade, cantos arredondados, tom amigável e bom para prints em redes sociais.

## 2. Abordagem

O gerador atual (`src/gerar-site.js`, HTML em template strings) continua. As mudanças são:
- reescrever `site/estilo.css`;
- reorganizar o HTML de cada página;
- acrescentar comportamentos pequenos em `site/busca.js`, como o menu do celular e as sugestões de bairro.

Sem framework e sem etapa de build nova.

## 3. Identidade

### 3.1 Cores (tokens CSS em `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--rio` | `#0E6BA8` | topo, números em destaque, links |
| `--rio-escuro` | `#10324A` | títulos e texto principal |
| `--areia` | `#FFF7EA` | fundo da página |
| `--ambar` | `#F2A541` | destaque, botão principal, borda do impostômetro |
| `--ambar-escuro` | `#7A4A00` | texto sobre âmbar claro |
| `--branco` | `#FFFFFF` | cartões |
| `--suave` | `#5B6472` | texto secundário |
| `--linha` | `#E8DCC6` | bordas e divisórias |
| `--falta` | `#B3261E` | faltas (A) |
| `--justificada` | `#B26A00` | ausência justificada (AJ) |
| `--presente` | `#1E7A46` | presença (P) |

Todo par de texto e fundo precisa de contraste de pelo menos 4,5:1 (WCAG AA). O texto sobre âmbar usa `--rio-escuro`, nunca branco.

### 3.2 Tipografia

- Títulos: Nunito 800, de `@fontsource/nunito`.
- Texto e números: Inter 400/600, de `@fontsource/inter`, com `font-variant-numeric: tabular-nums` nos números.
- Os arquivos `.woff2` do subconjunto latin são copiados pelo gerador para `dist/fontes/` e declarados com `@font-face` e `font-display: swap`.
- Licença: SIL OFL. A página "De onde vêm os números" cita as fontes tipográficas.

### 3.3 Componentes

- **Topo:**
  - faixa azul `--rio` com a marca "Radar Saltense" e o menu;
  - no celular (até 768 px), o menu vira o botão ☰ (`aria-expanded`, `aria-controls`) e abre uma lista; no computador, links em linha;
  - na home, a faixa continua com o título e termina numa onda SVG.
- **Cartão:** fundo branco, raio de 18 px, borda de 1 px `--linha`, sombra leve (`0 2px 8px rgb(16 50 74 / 6%)`).
- **Botão principal:** âmbar, formato de pílula, texto `--rio-escuro`, peso 800. **Botão secundário:** contorno azul.
- **Selo de fonte:** `<a class="selo-fonte">fonte oficial ↗</a>`, pequeno, ao lado dos números que vêm de documento oficial.
- **Aviso:** fundo areia mais escuro, ícone ⓘ e texto `--rio-escuro`.
- **Barra de proporção:** faixa horizontal com segmentos coloridos e legenda em texto.
- **Bolinhas de presença:** uma por sessão (P verde, A vermelho, AJ âmbar, vazio cinza), cada uma com `title` e um rótulo acessível que diz a data e o registro.
- **Rodapé:** fundo `--rio-escuro`, texto claro, com a assinatura, as fontes e o contato.
- **Foco visível:** contorno de 3 px âmbar em todos os elementos interativos.

## 4. Páginas

### 4.1 Home (`index.html`), na ordem

1. **Topo e herói:** "Salto de olho na Câmara", o subtítulo "O que cada vereador fez desde a posse, atualizado todo dia. Só dado oficial." e "Atualizado em dd/mm/aaaa às hh:mm".
2. **Impostômetro:** o bloco atual, restilizado, com o mesmo conteúdo e as mesmas regras.
3. **"O que pediram pro seu bairro?":**
   - campo grande em formato de pílula;
   - abaixo, até 6 sugestões tocáveis com os bairros com mais pedidos (calculadas de `d.locais` do tipo `bairro`, pela quantidade de pedidos);
   - tocar numa sugestão preenche o campo e roda a busca.
4. **"A Câmara em números":** quatro cartões.
   - Propostas desde 2025: `d.proposituras.length`.
   - Ruas com pedido repetido: quantidade de ruas diferentes em `d.repetidos`.
   - Sessões com presença registrada: o maior `presenca.total` entre os vereadores.
   - Votações registradas: soma dos eventos em `d.votacoes`.
   - Cada cartão tem link para a seção correspondente.
5. **"Os 11 vereadores":**
   - os filtros (nome, partido e ordenação) viram botões em formato de pílula para a ordenação, com os mesmos critérios de hoje, além do campo de nome e do seletor de partido;
   - cada cartão mostra a foto oficial, o nome, o partido, a barra de presença ("79 de 84 sessões") e os mesmos números de hoje.
6. **"O problema que não some":**
   - mostra as 10 primeiras ruas;
   - um botão "ver mais" revela o restante, até as 30 de hoje, sem carregar mais dados;
   - o aviso continua.
7. **"Homenagem ou trabalho?":** a barra de proporção dos cinco grupos públicos fica acima dos mesmos `details` de hoje.
8. **Chamada final:** cartões "De onde vêm os números" e "Achou um erro? Fale comigo" (com link para o Instagram).

### 4.2 Página do vereador

1. Topo com a foto (120 px, redonda), o nome, o partido e o link para a página oficial.
2. Três cartões de número:
   - presença em % (P ÷ sessões registradas, arredondado);
   - total de propostas;
   - quantas vezes votou contra.
3. Presença:
   - a linha de bolinhas, da mais antiga para a mais nova, com a legenda;
   - o resumo em texto (P, A, AJ);
   - os avisos de hoje;
   - a tabela sessão por sessão continua dentro de `details`.
4. Propostas: a barra de proporção por grupo e os `details` por grupo, como hoje.
5. Votações: listas "Votou contra" e "Ausente na votação" em cartões, com os avisos de hoje.

### 4.3 Votações, Impostômetro e Fontes

- **Votações:** cada projeto é um cartão. O resultado de cada evento aparece em destaque, com etiquetas "Contra:" (vermelho suave) e "Ausentes:" (âmbar suave).
- **Impostômetro:** mesmo conteúdo e regras, com a nova identidade. As barras usam `--rio` (ano atual) e `#9CC7E6` (ano anterior).
- **Fontes:**
  - um sumário com âncoras no topo;
  - o mesmo conteúdo de hoje;
  - acrescenta "Fotos: Câmara Municipal de Salto (site oficial)" e "Fontes tipográficas: Nunito e Inter (SIL Open Font License)".

Todos os textos, avisos e regras de hoje são mantidos. Nenhum aviso de transparência pode sumir na reformulação.

## 5. Fotos dos vereadores

- **Novo coletor `src/coleta/fotos.js`:**
  - para cada vereador com `foto` (URL do site da Câmara), baixa a imagem com `baixar()`, com o mesmo User-Agent e a mesma espera;
  - salva em `data/bruto/fotos/<id>.jpg`;
  - mantém em `data/bruto/fotos/origem.json` o mapa `id → url` da última foto baixada;
  - só baixa de novo quando a URL muda ou o arquivo não existe;
  - se a imagem falhar (erro HTTP ou tipo diferente de `image/*`), registra aviso, o vereador fica sem foto e o robô **não** para.
- **No processamento:** cada vereador ganha `fotoLocal: 'fotos/<id>.jpg'`, ou `null` sem foto.
- **No gerador:**
  - copia `data/bruto/fotos/*.jpg` para `dist/fotos/`;
  - usa `<img src="(prefixo)fotos/<id>.jpg" alt="Foto de <nome>" loading="lazy" width="… " height="…">`;
  - sem foto, aparece um círculo com as iniciais;
  - a legenda "Foto: Câmara Municipal de Salto" fica na página do vereador e na seção de fontes.

## 6. Requisitos de qualidade

- **Peso:** a home sem fotos e sem `busca.json` deve ter até 200 KB (HTML + CSS + JS + fontes). As fotos usam `loading="lazy"`.
- **Celular primeiro:**
  - sem rolagem horizontal em 320, 375 e 414 px;
  - alvos de toque com pelo menos 44 px;
  - no computador (≥ 1024 px), conteúdo centralizado com largura máxima de 1040 px, cartões de vereador em 3 colunas e números da Câmara em 4.
- **Acessibilidade:**
  - contraste AA;
  - foco visível;
  - menu com `aria-expanded`;
  - imagens com `alt`;
  - o contador mantém `aria-live="off"`;
  - `prefers-reduced-motion` desliga as animações.
- **Sem dependência externa em tempo de execução:** nem Google Fonts nem CDN.

## 7. Checagens e conferência

- `check/regras.mjs` ganha checagens para as funções puras novas, se houver:
  - ordenação das sugestões de bairro;
  - cálculo de presença em %;
  - escolha de iniciais.
- **Conferência visual (controlador):**
  - capturas da home, de um vereador, de Votações, do Impostômetro e de Fontes em 375 px e em 1280 px;
  - checagem de que não há rolagem horizontal em 320 px;
  - checagem de que nenhum número mudou em relação à versão publicada, comparando os totais da home, dos 11 cartões e do impostômetro antes e depois.

## 8. Fora do escopo

- Modo escuro.
- Novas fontes de dados ou novas regras.
- O Raio-X dos gastos, que é o próximo projeto.
- Domínio próprio.
